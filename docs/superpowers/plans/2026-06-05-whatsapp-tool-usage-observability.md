# Observabilité de l'usage des outils du copilote WhatsApp — MVP

> Plan autonome. Cerveau : `megga/whatsapp-observability-backlog`.
> Branche/worktree : `claude/goofy-gauss-14ba49` (chemin
> `/Users/megga/Desktop/megga-real-estate/.claude/worktrees/goofy-gauss-14ba49`).
> **Chaque sous-agent doit commencer par `cd <worktree>`** (il démarre au cwd du dépôt principal).

## Pourquoi

On veut savoir quels outils MEGGA utilise vraiment sur WhatsApp (read/auto/confirm/slow_async),
le taux d'erreur, et lesquels ne sont jamais utilisés — un métalevier pour décider quoi améliorer
au lieu de deviner. Aujourd'hui : `ai_usage_logs` est orientée coût modèle (inadaptée) ; le copilote
logge les noms d'outils en console (`wa-agent turn ... tools:`) mais c'est éphémère ;
`whatsapp_confirmation_log` ne couvre QUE les confirmations oui/non.

**Pattern cloné (déjà en prod) :** `whatsapp_confirmation_log` (table) +
`get_whatsapp_autonomy_suggestions` (RPC `SECURITY DEFINER`, garde `is_super_admin()` côté serveur)
+ page super-admin lecture seule.

## Portée

**MVP = table + wiring + RPC + spec live.** La page super-admin de visualisation est **Phase 2**
(l'utilisateur dira quand). Ne PAS la construire ici.

## Contraintes dures (non négociables)

1. **DeepSeek uniquement** pour toute inférence (aucun changement de provider). Ce chantier ne touche
   pas l'inférence : on ajoute juste un log d'usage.
2. **Log fire-and-forget NON bloquant** : jamais `await`. L'UX du copilote ne dépend JAMAIS du log.
3. **PII-safe** : logger UNIQUEMENT `tool` / `tier` / `outcome` (+ `agency_id` / `profile_id` pour le
   scope RLS). **JAMAIS** les arguments d'outil ni le contenu du message.
4. **RLS super_admin** : garde `is_super_admin()` côté SERVEUR (pas seulement le frontend).
5. **Migration datée idempotente** (`YYYYMMDDHHMMSS`). La CI backend applique les migrations via
   `supabase start` AVANT `npm run test:backend` → la table existe quand le spec insère.
6. **Specs backend live en CI** : pas de `skipIf` factice. En CI les clés sont présentes → le test
   tourne réellement contre un Supabase local seedé. Il doit PASSER.

## Référence terrain (déjà vérifiée — ne pas re-explorer inutilement)

- Table à cloner : `supabase/migrations/20260603120200_whatsapp_confirmation_log.sql`
- RPC à cloner : `supabase/migrations/20260603130100_whatsapp_autonomy_suggestions_rpc.sql`
- RLS agence + super_admin (idiome à copier) :
  `supabase/migrations/20260602100000_whatsapp_conversation_insights.sql` (policies
  `wa_insights_agency_select` + `wa_insights_super_admin_all`, helpers `public.get_my_agency_id()` /
  `public.is_super_admin()`).
- Modèle fire-and-forget : `supabase/functions/_shared/ai-provider.ts` → `logUsage()` (l.62-81).
- Boucle d'outils à instrumenter : `supabase/functions/whatsapp-agent/index.ts` (l.178-230).
  - `name = call.function?.name`, `tier = toolTier(name)` (l.184/187).
  - `ctx.agencyId` (re-dérivé du lien vérifié l.92), `profileId` (body, l.70), `supabase`
    (client service-role l.79) sont en scope dans le handler.
- Tiers : `supabase/functions/_shared/whatsapp-agent-router.ts` → `ToolTier =
  'read'|'auto'|'confirm'|'slow_async'` ; `toolTier(name)` (défaut `'confirm'`).
- Spec à cloner : `tests/backend/whatsapp-autonomy-suggestions.spec.ts`
  (helpers `setupTwoAgencies`, `serviceRoleClient`).
- CI backend : `.github/workflows/backend.yml` → `supabase start` applique les migrations puis
  `npm run test:backend`. ✅ ordre OK.
- Deploy prod : `.github/workflows/deploy.yml` → applique les migrations dont la date (8 premiers
  caractères) `>= TODAY` (jour du deploy UTC, `date -u +%Y%m%d`). **⚠ CONSÉQUENCE : la migration doit
  être mergée le jour de sa date (UTC).** On date au 2026-06-05 ; à signaler dans la PR : merger le
  2026-06-05 UTC, sinon re-dater à la veille du merge.

## Outcomes par chemin de la boucle d'outils (source de vérité du wiring)

| Chemin dans `index.ts` | `tier` | `outcome` à logger |
|---|---|---|
| `slow_async` → `enqueueAsyncJob` puis `return` (l.189-196) | `slow_async` | `async_queued` |
| `confirm` + autonomie → `execUpdatePipelineWithUndo` + `continue` (l.201-209) | `confirm` | `executed` |
| `confirm` → `stashPending` status `busy` + `return` (l.212-214) | `confirm` | `busy` |
| `confirm` → `stashPending` status `error` + `return` (l.215-217) | `confirm` | `error` |
| `confirm` → `stashPending` ok + `return` prompt (l.218) | `confirm` | `confirm_pending` |
| `read`/`auto` → `runTool` (cache F4) puis `messages.push` (l.221-229) | `read`/`auto` | `executed` |

Note : pour `read`/`auto`, une erreur éventuelle est encodée dans la string de résultat ; le MVP ne la
distingue pas → on logge `executed` (l'outcome `error` est réservé au chemin stash). C'est le design
du cerveau. On logge CHAQUE appel, y compris une ré-exécution servie par le cache F4.

---

## Tâche 1 — Migration : table `whatsapp_tool_usage` (+ RLS + index)

**Fichier :** `supabase/migrations/20260605060000_whatsapp_tool_usage.sql`

```sql
-- Observabilité de l'usage des outils du copilote WhatsApp (MVP — cerveau
-- megga/whatsapp-observability-backlog). Capture CHAQUE appel d'outil de la boucle DeepSeek de
-- whatsapp-agent : QUEL outil, QUEL tier, QUEL outcome (executed / confirm_pending / async_queued /
-- busy / error). Métalevier pour décider quoi améliorer (outils jamais utilisés, taux d'erreur).
--
-- PII-SAFE par construction : on ne stocke QUE tool / tier / outcome (+ agency_id / profile_id pour
-- le scope RLS). JAMAIS les arguments d'outil ni le contenu du message — garde dure.
--
-- Le log est fire-and-forget côté edge (jamais await) : l'UX du copilote ne dépend pas de cette table.
-- Pas de FK (comme whatsapp_confirmation_log) : un insert ne doit JAMAIS échouer sur une course de
-- suppression de profil/agence et bloquer la boucle d'outils.
--
-- RLS : super_admin (ALL) — données CROSS-AGENCE sensibles ; agence (SELECT own) ; écriture =
-- service_role (le edge), qui bypass la RLS. Additif + idempotent.

BEGIN;

CREATE TABLE IF NOT EXISTS public.whatsapp_tool_usage (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  agency_id   uuid        NULL,
  profile_id  uuid        NOT NULL,
  tool        text        NOT NULL,
  tier        text        NOT NULL CHECK (tier IN ('read','auto','confirm','slow_async')),
  outcome     text        NOT NULL CHECK (outcome IN ('executed','confirm_pending','async_queued','busy','error'))
);

ALTER TABLE public.whatsapp_tool_usage ENABLE ROW LEVEL SECURITY;

-- authenticated : voit l'usage de SON agence (miroir des autres tables WhatsApp).
DROP POLICY IF EXISTS "wa_tool_usage_agency_select" ON public.whatsapp_tool_usage;
CREATE POLICY "wa_tool_usage_agency_select"
  ON public.whatsapp_tool_usage
  FOR SELECT TO authenticated
  USING (agency_id = public.get_my_agency_id());

-- super_admin : tout (lecture cross-agence pour l'observabilité).
DROP POLICY IF EXISTS "wa_tool_usage_super_admin_all" ON public.whatsapp_tool_usage;
CREATE POLICY "wa_tool_usage_super_admin_all"
  ON public.whatsapp_tool_usage
  FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
-- Écriture : service_role uniquement (le edge whatsapp-agent), bypass RLS — pas de policy INSERT.

-- Index aligné sur la récence (cerveau : « created_at desc, tool »).
CREATE INDEX IF NOT EXISTS idx_wa_tool_usage_created_tool
  ON public.whatsapp_tool_usage (created_at DESC, tool);

COMMIT;
```

**Critères :** idempotent (relançable sans erreur), RLS ON, deux policies, CHECK sur `tier` et
`outcome`, index présent. `get_my_agency_id()` et `is_super_admin()` existent déjà en prod.

---

## Tâche 2 — Migration : RPC `get_whatsapp_tool_usage_stats`

**Fichier :** `supabase/migrations/20260605060100_whatsapp_tool_usage_stats_rpc.sql`

Clone de `get_whatsapp_autonomy_suggestions`. Par outil : nb d'appels, nb d'erreurs, taux d'erreur,
dernière utilisation. **Outils jamais utilisés :** via le paramètre `p_known_tools text[]` (le
catalogue `WHATSAPP_TOOLS` passé par le frontend, **source de vérité unique** des noms d'outils) — un
`LEFT JOIN` fait apparaître les outils à `total_calls = 0` / `last_used_at = NULL`. Sans le paramètre,
renvoie seulement les outils observés.

> **Choix d'ingénierie (divergence documentée du « clone zéro-arg ») :** coder le catalogue en dur en
> SQL créerait une dérive TS↔SQL silencieuse à chaque ajout d'outil. Le paramètre garde une seule
> source de vérité (le `.ts`). Zéro-arg reste valide (outils observés). La garde serveur, le
> `SECURITY DEFINER`, le `REVOKE/GRANT` sont identiques au clone.

```sql
-- RPC d'agrégation de l'usage des outils du copilote WhatsApp (clone de
-- get_whatsapp_autonomy_suggestions). Par outil : nb d'appels, nb d'erreurs, taux d'erreur, dernière
-- utilisation. Avec p_known_tools (catalogue WHATSAPP_TOOLS, SOURCE DE VÉRITÉ unique des noms
-- d'outils) : un LEFT JOIN révèle les OUTILS JAMAIS UTILISÉS (total_calls = 0, last_used_at = NULL).
-- Sans le paramètre : seulement les outils observés.
--
-- Pourquoi un paramètre plutôt qu'un catalogue codé en dur : la liste vit dans
-- _shared/whatsapp-tools.ts (TS). La coder ici créerait une dérive TS↔SQL. Le frontend phase-2 passe
-- le catalogue → une seule source de vérité.
--
-- SECURITY DEFINER (contourne la RLS) ; garde SERVEUR public.is_super_admin() (données cross-agence
-- sensibles) + SuperAdminGuard frontend ; REVOKE anon / GRANT authenticated. Idempotent.

CREATE OR REPLACE FUNCTION public.get_whatsapp_tool_usage_stats(p_known_tools text[] DEFAULT NULL)
RETURNS TABLE (
  tool text, total_calls bigint, error_count bigint, error_rate numeric, last_used_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  -- Garde d'accès SERVEUR (pas seulement le SuperAdminGuard frontend) : usage par-agent CROSS-AGENCE.
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden: super_admin only' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH agg AS (
    SELECT u.tool AS tool,
      count(*)::bigint AS total_calls,
      count(*) FILTER (WHERE u.outcome = 'error')::bigint AS error_count,
      max(u.created_at) AS last_used_at
    FROM whatsapp_tool_usage u
    GROUP BY u.tool
  ),
  -- Univers des outils : le catalogue fourni (révèle les jamais-utilisés) OU, à défaut, les seuls
  -- outils observés.
  universe AS (
    SELECT DISTINCT x AS tool
    FROM unnest(COALESCE(p_known_tools, ARRAY(SELECT a.tool FROM agg a))) AS x
  )
  SELECT
    un.tool,
    COALESCE(a.total_calls, 0)::bigint,
    COALESCE(a.error_count, 0)::bigint,
    CASE WHEN COALESCE(a.total_calls, 0) = 0 THEN 0::numeric
         ELSE round(a.error_count::numeric / a.total_calls, 4) END,
    a.last_used_at
  FROM universe un
  LEFT JOIN agg a ON a.tool = un.tool
  ORDER BY COALESCE(a.total_calls, 0) DESC, un.tool;
END;
$$;

REVOKE ALL ON FUNCTION public.get_whatsapp_tool_usage_stats(text[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_whatsapp_tool_usage_stats(text[]) TO authenticated;

COMMENT ON FUNCTION public.get_whatsapp_tool_usage_stats(text[]) IS 'Observabilité outils WhatsApp — agrège whatsapp_tool_usage par outil (nb appels, erreurs, taux, dernière utilisation). p_known_tools (catalogue WHATSAPP_TOOLS) révèle les outils jamais utilisés via LEFT JOIN. Garde serveur public.is_super_admin() (ERRCODE 42501) + SuperAdminGuard frontend.';
```

**Critères :** `CREATE OR REPLACE` (idempotent), garde serveur `is_super_admin()` (ERRCODE 42501),
`REVOKE anon` + `GRANT authenticated`, colonnes qualifiées (pas d'ambiguïté avec les OUT params),
`total_calls`/`error_count` en `bigint`, `error_rate` en `numeric` arrondi.

---

## Tâche 3 — Wiring : log fire-and-forget dans `whatsapp-agent/index.ts`

**Fichier :** `supabase/functions/whatsapp-agent/index.ts`

### 3a. Helper module-scope (modèle `logUsage` de ai-provider.ts)

À ajouter au niveau module (ex. juste avant ou après `enqueueAsyncJob`). Fire-and-forget : on ne
`await` jamais, on `try`/`catch`, on logge une erreur d'insert sans la propager.

```ts
// Observabilité PII-SAFE de l'usage des outils (cerveau megga/whatsapp-observability-backlog).
// Fire-and-forget : JAMAIS await — l'UX du copilote ne dépend pas du log (garde dure).
// On ne logge QUE tool / tier / outcome (+ agency_id / profile_id pour le scope RLS) :
// JAMAIS les arguments d'outil ni le contenu du message.
function logToolUsage(
  supabase: ReturnType<typeof createClient>,
  row: { agency_id: string | null; profile_id: string; tool: string; tier: string; outcome: string },
) {
  try {
    supabase
      .from('whatsapp_tool_usage')
      .insert(row)
      .then(({ error }) => {
        if (error) console.error('[wa-agent] tool_usage log failed:', error.message)
      })
  } catch (err) {
    console.error('[wa-agent] tool_usage log threw:', err)
  }
}
```

### 3b. Closure DRY dans le handler + 6 points d'appel

Dans la boucle `for (const call of toolCalls)`, juste APRÈS `const tier = toolTier(name)` (l.187),
définir une closure qui capture `name`/`tier` du tour courant :

```ts
const tier = toolTier(name)
// Log d'usage PII-safe (fire-and-forget) : appelé sur chaque chemin terminal de la boucle.
const logTool = (outcome: string) =>
  logToolUsage(supabase, { agency_id: ctx.agencyId, profile_id: profileId, tool: name, tier, outcome })
```

Puis brancher les 6 appels (cf. tableau « Outcomes par chemin ») :

- `slow_async` : après `const ack = await enqueueAsyncJob(...)`, avant `return json({ reply: ack }, 200)` →
  `logTool('async_queued')`
- `confirm` auto (gate true) : après `const auto = await execUpdatePipelineWithUndo(ctx, args)`, avant
  `messages.push(...)` → `logTool('executed')`
- stash `busy` : avant `return json({ reply: t(lang, 'busy'), ... })` → `logTool('busy')`
- stash `error` : avant `return json({ reply: stash.error ?? ... })` → `logTool('error')`
- stash ok : avant `return json({ reply: stash.prompt ?? ... })` → `logTool('confirm_pending')`
- `read`/`auto` : après le bloc cache (`result` calculé), avant `messages.push({ role: 'tool', ... })`
  → `logTool('executed')`

**Critères :** aucun `await` sur `logTool`/`logToolUsage` ; uniquement `tool`/`tier`/`outcome`
(+ ids) ; 6 points couverts ; rien d'autre dans la boucle modifié ; `deno check` vert.

---

## Tâche 4 — Spec backend live `whatsapp-tool-usage.spec.ts`

**Fichier :** `tests/backend/whatsapp-tool-usage.spec.ts` (clone de
`whatsapp-autonomy-suggestions.spec.ts`).

Couverture :
1. **Agrégation RPC** (caller super_admin) : insérer des lignes pour agentB (tools/outcomes variés),
   appeler la RPC sans `p_known_tools`, vérifier `total_calls`, `error_count`, `error_rate`,
   `last_used_at` par outil.
2. **Outils jamais utilisés** : appeler avec `p_known_tools` contenant un outil non inséré → ligne à
   `total_calls = 0`, `last_used_at = null`.
3. **Garde serveur** : caller non-super-admin (clientB) → erreur (ERRCODE 42501).
4. **RLS agence read-own** : insérer une ligne agence A + des lignes agence B ; `clientB.select` ne
   voit QUE l'agence B (jamais l'agence A).

Notes de typage PostgREST : `bigint` (`count(*)`) revient en **number** ; `numeric` (`error_rate`)
revient en **string** → comparer avec `Number(...)` / `toBeCloseTo`.

```ts
// Observabilité outils WhatsApp — RPC get_whatsapp_tool_usage_stats + RLS whatsapp_tool_usage (live).
//
//  Test 1 — agrégation par outil (caller super_admin) : nb appels, nb erreurs, taux, dernière util.
//  Test 2 — p_known_tools révèle un outil jamais utilisé (total_calls=0, last_used_at=null).
//  Test 3 — caller non-super-admin rejeté (garde serveur 42501).
//  Test 4 — RLS agence : clientB ne voit QUE les lignes de son agence.
//
// Runs live in CI (SUPABASE_TEST_* keys present). Skips cleanly locally when keys are absent.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

type UsageRow = { agency_id: string | null; profile_id: string; tool: string; tier: string; outcome: string }

describe.skipIf(!HAS_KEYS)('get_whatsapp_tool_usage_stats — observabilité outils', () => {
  let setup: TwoAgenciesSetup

  const insert = async (rows: UsageRow[]) => {
    const { error } = await serviceRoleClient().from('whatsapp_tool_usage').insert(rows)
    if (error) throw new Error(`insert usage: ${error.message}`)
  }
  // Repart d'un état propre : seules ces deux profils/agences sont touchés par ce spec.
  const wipe = async () => {
    const svc = serviceRoleClient()
    await svc.from('whatsapp_tool_usage').delete().in('profile_id', [setup.agentAId, setup.agentBId]).then(() => {}, () => {})
  }

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    // agentA = CALLER promu super_admin pour toutes les assertions RPC.
    const { error } = await serviceRoleClient().from('profiles').update({ role: 'super_admin' }).eq('id', setup.agentAId)
    if (error) throw new Error(`promote super_admin: ${error.message}`)
    await wipe()
  })

  afterAll(async () => {
    await wipe()
    await setup.cleanup()
  })

  // ── Test 1 — agrégation par outil ──────────────────────────────────────────
  it('agrège par outil : nb appels, erreurs, taux, dernière utilisation', async () => {
    await wipe()
    await insert([
      // search_contacts (read) : 3 executed + 1 error → 4 appels, 1 erreur, taux 0.25
      { agency_id: setup.agencyBId, profile_id: setup.agentBId, tool: 'search_contacts', tier: 'read', outcome: 'executed' },
      { agency_id: setup.agencyBId, profile_id: setup.agentBId, tool: 'search_contacts', tier: 'read', outcome: 'executed' },
      { agency_id: setup.agencyBId, profile_id: setup.agentBId, tool: 'search_contacts', tier: 'read', outcome: 'executed' },
      { agency_id: setup.agencyBId, profile_id: setup.agentBId, tool: 'search_contacts', tier: 'read', outcome: 'error' },
      // update_pipeline (confirm) : 2 confirm_pending → 2 appels, 0 erreur
      { agency_id: setup.agencyBId, profile_id: setup.agentBId, tool: 'update_pipeline', tier: 'confirm', outcome: 'confirm_pending' },
      { agency_id: setup.agencyBId, profile_id: setup.agentBId, tool: 'update_pipeline', tier: 'confirm', outcome: 'confirm_pending' },
    ])

    const { data, error } = await setup.clientA.rpc('get_whatsapp_tool_usage_stats')
    if (error) throw new Error(`rpc: ${error.message}`)

    const sc = (data ?? []).find((r: { tool: string }) => r.tool === 'search_contacts')
    expect(sc, 'search_contacts row').toBeDefined()
    expect(sc.total_calls).toBe(4)
    expect(sc.error_count).toBe(1)
    expect(Number(sc.error_rate)).toBeCloseTo(0.25, 4)
    expect(sc.last_used_at).not.toBeNull()

    const up = (data ?? []).find((r: { tool: string }) => r.tool === 'update_pipeline')
    expect(up, 'update_pipeline row').toBeDefined()
    expect(up.total_calls).toBe(2)
    expect(up.error_count).toBe(0)
    expect(Number(up.error_rate)).toBe(0)
  })

  // ── Test 2 — outils jamais utilisés via p_known_tools ───────────────────────
  it('p_known_tools révèle un outil jamais utilisé', async () => {
    await wipe()
    await insert([
      { agency_id: setup.agencyBId, profile_id: setup.agentBId, tool: 'search_contacts', tier: 'read', outcome: 'executed' },
    ])

    const { data, error } = await setup.clientA.rpc('get_whatsapp_tool_usage_stats', {
      p_known_tools: ['search_contacts', 'send_kyc_report'], // send_kyc_report jamais inséré
    })
    if (error) throw new Error(`rpc: ${error.message}`)

    const never = (data ?? []).find((r: { tool: string }) => r.tool === 'send_kyc_report')
    expect(never, 'never-used tool row').toBeDefined()
    expect(never.total_calls).toBe(0)
    expect(never.last_used_at).toBeNull()
  })

  // ── Test 3 — garde serveur ──────────────────────────────────────────────────
  it('caller non-super-admin rejeté (garde serveur)', async () => {
    const { error } = await setup.clientB.rpc('get_whatsapp_tool_usage_stats')
    expect(error, 'error non-null pour un caller non super_admin').not.toBeNull()
  })

  // ── Test 4 — RLS agence read-own ────────────────────────────────────────────
  it('RLS : une agence ne voit que ses propres lignes', async () => {
    await wipe()
    await insert([
      { agency_id: setup.agencyAId, profile_id: setup.agentAId, tool: 'get_daily_brief', tier: 'read', outcome: 'executed' },
      { agency_id: setup.agencyBId, profile_id: setup.agentBId, tool: 'get_daily_brief', tier: 'read', outcome: 'executed' },
    ])

    // clientB = agentB, rôle 'agent', agence B (PAS super_admin).
    const { data, error } = await setup.clientB.from('whatsapp_tool_usage').select('agency_id')
    if (error) throw new Error(`select: ${error.message}`)
    const agencies = new Set((data ?? []).map((r: { agency_id: string | null }) => r.agency_id))
    expect(agencies.has(setup.agencyBId), 'voit son agence').toBe(true)
    expect(agencies.has(setup.agencyAId), 'ne voit pas l’agence A').toBe(false)
  })
})
```

**Critères :** pas de `skipIf` factice (en CI les clés sont là → tourne réellement) ; 4 tests ;
nettoyage en `afterAll` ; assertions robustes au typage PostgREST.

> ⚠ **À VÉRIFIER par le sous-agent** : la forme exacte du helper `setupTwoAgencies` (champs
> `agentAId`, `agentBId`, `agencyAId`, `agencyBId`, `clientA`, `clientB`, `cleanup`). Lire
> `tests/backend/helpers/two-agencies.ts` et `tests/backend/whatsapp-autonomy-suggestions.spec.ts`
> avant d'écrire, et aligner les noms de champs réels.

---

## Vérification terrain (l'orchestrateur la fait lui-même)

```bash
cd /Users/megga/Desktop/megga-real-estate/.claude/worktrees/goofy-gauss-14ba49
npm run build        # tsc -b + vite : VERT obligatoire avant push (leçon CI PR #180)
npx vitest run --config=vitest.backend.config.ts whatsapp-tool-usage   # skip propre en local (pas de clés)
deno check supabase/functions/whatsapp-agent/index.ts   # si deno dispo ; sinon noter
```

Le spec live tourne réellement en CI (`backend.yml`). En local sans clés il skippe proprement.

## Revues (méthode subagent-driven)

1. **Revue conformité spec** : chaque livrable respecte-t-il le cerveau + les contraintes dures
   (fire-and-forget non bloquant, PII-safe, RLS super_admin serveur, migration idempotente datée,
   spec live) ? Le wiring couvre-t-il bien les 6 outcomes ?
2. **Revue qualité de code** : idiomes alignés (clone fidèle), pas de duplication, typage strict,
   pas d'`any`, pas de fuite PII, pas de `console.log`, idempotence réelle.
3. **Revue finale adversariale** : chercher activement un trou — un `await` accidentel sur le log, une
   colonne PII, une policy RLS trop permissive (anon/authenticated cross-agence), un risque de
   div-par-zéro, une ambiguïté de colonne dans la RPC, un échec d'insert qui remonterait dans l'UX.

## Mise à jour du cerveau (DERNIÈRE tâche)

Éditer `.claude-flow/knowledge/megga-memory.seed.json` : marquer le MVP observabilité comme livré
(table + wiring + RPC + spec live), pointer vers les fichiers, et rappeler que la Phase 2 (page
super-admin de visualisation) reste à faire. Puis `npm run ruflo:seed`.

## PR

Ouvrir une PR vers `main`. **NE PAS merger** (l'utilisateur valide la CI verte). Mentionner dans la
description la contrainte deploy.yml (`stamp_date >= TODAY`) : merger le 2026-06-05 UTC, sinon re-dater.
