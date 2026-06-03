# Agent WhatsApp — Palier 2 : outils KYC lents en asynchrone (plan d'implémentation)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sortir les outils KYC lents de la boucle de réflexion DeepSeek vers une file de jobs traitée par un cron, pour qu'aucun tour ne dépasse ~4 s et que le worker ne soit plus jamais tué (cause racine du « l'agent plante / oublie tout »).

**Architecture :** On clone le pattern déjà en prod `whatsapp-process` (job en base + cron à la minute + claim atomique `FOR UPDATE SKIP LOCKED`). Un nouveau tier `slow_async` dans le router : quand la boucle voit `run_kyc_screening` ou `send_kyc_report`, elle **n'exécute pas** — elle **enfile un job** (`whatsapp_async_jobs`) et renvoie un **ACK immédiat** à DeepSeek (« Je lance le screening, je te reviens dans ~15 s »). Une nouvelle edge `whatsapp-agent-async`, réclamée par un cron à la minute, exécute l'outil lourd hors requête et **livre le résultat à l'AGENT seul** (jamais au client). Aucune techno nouvelle.

**Tech Stack :** Supabase Edge Functions (Deno/TypeScript), PostgreSQL (migrations additives idempotentes), pg_cron, Cloudflare R2 (déjà en place pour `whatsapp-process`), Vitest backend (specs live en CI).

**Réf. stratégie (la spec) :** [docs/strategy/2026-06-03-whatsapp-agent-autonomy-strategy.md](../../strategy/2026-06-03-whatsapp-agent-autonomy-strategy.md), §3 (Architecture ASYNC des outils lents) + §3.4 (budget temps) + §3.5 (garde service-role). **Cerveau :** `megga/whatsapp-agent-stability-autonomy-strategy`, `megga/whatsapp-p1-stabilisation-plan` (le palier dont celui-ci dépend), `megga/whatsapp-outbound-flow`, `megga/deploy-migrations-gate` (piège de date des migrations), `megga/kyc-non-blocking`, `megga/ai-guardrails`, `megga/megga-ai-persona`.

---

## Avant de commencer — consulter le cerveau

```bash
npx ruflo memory search -q "whatsapp-process file job cron claim async outbound R2 service_role app_config" -n megga
npx ruflo memory get -k "megga/deploy-migrations-gate" -n megga   # piège de date : voir Contraintes
```

**Ne pas modifier le seed** pendant l'implémentation (la mise à jour du cerveau est la dernière tâche).

## Périmètre — ce que ce plan fait, et ce qu'il ne fait PAS

**FAIT (P2, ce plan) :** passage en async des **2 outils vraiment lents et sans média** — `run_kyc_screening` (abort 50 s) et `send_kyc_report` (abort 60 s). Ce sont eux qui produisent le pire cas ~122 s. À la fin : plus aucun tour > 4 s pour ces deux outils, worker jamais tué, race PDF supprimée (l'envoi sort de la requête).

**PAS fait (→ P2b, plan séparé court) :** `attach_kyc_document` reste **synchrone** (tier `auto`) pour l'instant. Son passage en async exige un prérequis distinct : le lien média Meta expire en 5‑10 min, donc il faut d'abord persister les bytes en R2 sur la branche agent du webhook (§3.2), puis faire lire R2 par l'exécuteur. C'est un sous-système à part, livré ensuite. `attach_kyc_document` synchrone fonctionne déjà (l'OCR est plus rapide qu'un screening, et le lien Meta est frais dans la requête).

## Contraintes dures (non négociables)

- **IA = DeepSeek uniquement** (`model: 'deepseek-chat'`). Ne rien changer au provider.
- **Human-in-the-loop légal intact** : on ne touche AUCUN tier `confirm` (`send_client_message`, `send_listings`, `record_offer`, `open_kyc_case`). Le résultat KYC va **à l'agent seul** via son numéro ; `is_completed`/`dossier_status='verified'` restent réservés au MLRO (cerveau `kyc-non-blocking`, `ai-guardrails`).
- **Migrations additives + idempotentes** (`IF NOT EXISTS` / `CREATE OR REPLACE` / `DROP ... IF EXISTS`). **PIÈGE DE DATE (cerveau `deploy-migrations-gate`)** : la CI n'applique une migration que si sa date (`YYYYMMDD`) ≥ jour du deploy UTC (`deploy.yml:154`). **Dater les fichiers du jour de merge prévu** ; si le merge glisse, re-dater. Sinon la migration est sautée silencieusement et l'edge casse.
- **Edges internes déployées `--no-verify-jwt`** (auth applicative dans la fonction) ; `verify_jwt = false` dans `config.toml`. La nouvelle edge est appelée par **pg_cron**, donc garde alignée sur `app_config.service_role_key` comme `whatsapp-process` (§3.5), PAS sur l'env `SUPABASE_SERVICE_ROLE_KEY`.
- `npm run build` doit passer avant tout push.

---

## File Structure

**Créer :**
- `supabase/migrations/<YYYYMMDDHHMMSS>_whatsapp_async_jobs.sql` — table `whatsapp_async_jobs` + index UNIQUE partiel + RPC `claim_whatsapp_async_jobs`.
- `supabase/migrations/<YYYYMMDDHHMMSS>_whatsapp_agent_async_cron.sql` — cron `whatsapp-agent-async-minute` (clone de `20260602093000`).
- `supabase/functions/whatsapp-agent-async/index.ts` — worker (jumeau de `whatsapp-process`).
- `tests/backend/whatsapp-async-jobs-claim.spec.ts` — spec live : claim atomique + dédup enqueue.

**Modifier :**
- `supabase/config.toml` — enregistrer `[functions.whatsapp-agent-async] verify_jwt = false`.
- `supabase/functions/_shared/whatsapp-agent-router.ts` — tier `slow_async` + reclasser `run_kyc_screening` + `send_kyc_report`.
- `supabase/functions/_shared/whatsapp-agent-router.test.ts` — couvrir le nouveau tier + invariant socle légal.
- `supabase/functions/_shared/whatsapp-i18n.ts` — ACK async (fonction `asyncAck`) + clé `complexRetry`.
- `supabase/functions/whatsapp-agent/index.ts` — branche `slow_async` (enqueue + ACK) dans la boucle + budget temps global 45 s.

**Réutilisé sans changement :** `whatsapp-process` (modèle), `claim_whatsapp_jobs` (modèle de RPC), `get_app_config` (cron), `getProvider`/`buildSendTextRequest` (envoi à l'agent), `safeEqual`, les 3 `exec*` de `whatsapp-actions.ts` (appelées depuis le worker, déplacées d'appelant mais non réécrites).

---

## Task 1 : Migration — table `whatsapp_async_jobs` + index dédup + RPC `claim_whatsapp_async_jobs`

**Files:**
- Create: `supabase/migrations/<stamp>_whatsapp_async_jobs.sql`

- [ ] **Step 1 : Écrire la migration** (dater le fichier du jour de merge — voir Contraintes)

```sql
-- File de jobs des outils KYC lents (run_kyc_screening, send_kyc_report) sortis de la
-- boucle DeepSeek. Jumeau de la file de whatsapp-process (le message est le job), mais
-- ici une table dédiée car le job n'est pas un message. claim_whatsapp_async_jobs()
-- réclame un lot atomiquement (FOR UPDATE SKIP LOCKED) pour le cron whatsapp-agent-async.
-- Additif + idempotent.

BEGIN;

CREATE TABLE IF NOT EXISTS public.whatsapp_async_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      uuid NOT NULL,
  agency_id       uuid NULL,
  wa_agent_phone  text NOT NULL,              -- numéro de l'AGENT : où livrer le résultat
  tool            text NOT NULL CHECK (tool IN ('run_kyc_screening','send_kyc_report')),
  args            jsonb NOT NULL DEFAULT '{}'::jsonb,
  contact_id      uuid NULL,
  lang            text NOT NULL DEFAULT 'fr' CHECK (lang IN ('fr','en')),
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','processing','done','failed')),
  claimed_at      timestamptz NULL,
  retry_count     smallint NOT NULL DEFAULT 0,
  last_error      text NULL,
  result_summary  text NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL DEFAULT now() + interval '15 minutes'
);

-- RLS : table de back-office, jamais lue côté client. service_role écrit (bypass RLS) ;
-- on active RLS sans policy SELECT (aucun accès anon/authenticated). Défense en profondeur.
ALTER TABLE public.whatsapp_async_jobs ENABLE ROW LEVEL SECURITY;

-- Dédup à l'enqueue : un seul job vivant par (profile, outil, contact). COALESCE car
-- UNIQUE(...) laisserait passer deux contact_id NULL (NULL <> NULL). Le WHERE partiel
-- permet de re-créer un job une fois l'ancien terminé (done/failed).
CREATE UNIQUE INDEX IF NOT EXISTS uq_whatsapp_async_dedup
  ON public.whatsapp_async_jobs (profile_id, tool, COALESCE(contact_id::text, '∅'))
  WHERE status IN ('pending','processing');

-- Index de réclamation (ce que le cron balaie).
CREATE INDEX IF NOT EXISTS idx_whatsapp_async_claim
  ON public.whatsapp_async_jobs (created_at)
  WHERE status IN ('pending','processing','failed');

-- Réclamation atomique d'un lot. SECURITY DEFINER : seul service_role l'appelle
-- (REVOKE plus bas). SKIP LOCKED => pas de double-traitement entre deux ticks cron.
-- Reprend les 'processing' bloqués > 5 min (worker tué) et retente les 'failed' < 3.
CREATE OR REPLACE FUNCTION public.claim_whatsapp_async_jobs(p_batch int DEFAULT 5)
RETURNS SETOF public.whatsapp_async_jobs
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.whatsapp_async_jobs j
  SET status = 'processing', claimed_at = now()
  WHERE j.id IN (
    SELECT id FROM public.whatsapp_async_jobs
    WHERE status = 'pending'
       OR (status = 'processing' AND claimed_at < now() - interval '5 minutes')
       OR (status = 'failed' AND retry_count < 3)
    ORDER BY created_at
    LIMIT GREATEST(p_batch, 1)
    FOR UPDATE SKIP LOCKED
  )
  RETURNING j.*;
$$;

REVOKE ALL ON FUNCTION public.claim_whatsapp_async_jobs(int) FROM public, anon, authenticated;

COMMIT;
```

- [ ] **Step 2 : Vérifier l'idempotence**

Relire : `CREATE TABLE IF NOT EXISTS`, `CREATE UNIQUE INDEX IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, `ENABLE ROW LEVEL SECURITY` (no-op si déjà actif). Tout est re-jouable. Le `CHECK (tool IN (...))` ne liste QUE les 2 outils de P2 (attach viendra en P2b).

- [ ] **Step 3 : Commit**

```bash
git add supabase/migrations/*_whatsapp_async_jobs.sql
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "feat(whatsapp): table whatsapp_async_jobs + claim RPC (file outils KYC lents)"
```

---

## Task 2 : Migration — cron `whatsapp-agent-async-minute`

**Files:**
- Create: `supabase/migrations/<stamp>_whatsapp_agent_async_cron.sql`

- [ ] **Step 1 : Écrire la migration** (copie conforme de `20260602093000_whatsapp_process_cron.sql`)

```sql
-- Planifie whatsapp-agent-async chaque minute. Miroir EXACT du cron whatsapp-process
-- (get_app_config + net.http_post + Bearer service_role). Gardé par la présence de
-- pg_cron : planifié en prod, sauté en local/CI (schema "cron" absent) pour ne pas
-- casser l'application des migrations.

BEGIN;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    PERFORM cron.schedule(
      'whatsapp-agent-async-minute',
      '* * * * *',
      $cron$
      SELECT net.http_post(
        url := public.get_app_config('supabase_url') || '/functions/v1/whatsapp-agent-async',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || public.get_app_config('service_role_key')
        ),
        body := '{}'::jsonb
      );
      $cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron absent (local/CI) — whatsapp-agent-async-minute non planifié';
  END IF;
END
$do$;

COMMIT;
```

> `cron.schedule` avec un nom déjà existant met à jour le job (idempotent en pratique sur ce projet). Le garde `pg_namespace nspname='cron'` est obligatoire (sinon les migrations cassent en CI/local).

- [ ] **Step 2 : Commit**

```bash
git add supabase/migrations/*_whatsapp_agent_async_cron.sql
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "feat(whatsapp): cron whatsapp-agent-async-minute (clone whatsapp-process)"
```

---

## Task 3 : `config.toml` — enregistrer la nouvelle edge en `verify_jwt = false`

**Files:**
- Modify: `supabase/config.toml`

- [ ] **Step 1 : Ajouter le bloc** (à côté de `[functions.whatsapp-process]`, ≈ l.417)

Trouver :
```toml
[functions.whatsapp-process]
verify_jwt = false
```
Ajouter juste après :
```toml
[functions.whatsapp-agent-async]
verify_jwt = false
```
> Raison : `deploy.yml` déploie toute fonction `--no-verify-jwt` (allowlist `JWT_PROTECTED` vide). La plateforme rejette la clé service-role legacy si `verify_jwt=true`. L'auth se fait DANS la fonction (Task 7). Aligné sur `whatsapp-agent` et `whatsapp-process`.

- [ ] **Step 2 : Commit**

```bash
git add supabase/config.toml
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "chore(whatsapp): config.toml verify_jwt=false pour whatsapp-agent-async"
```

---

## Task 4 : Router — tier `slow_async` + reclasser les 2 outils + tests

**Files:**
- Modify: `supabase/functions/_shared/whatsapp-agent-router.ts`
- Modify: `supabase/functions/_shared/whatsapp-agent-router.test.ts`

- [ ] **Step 1 : Étendre le type `ToolTier`** (≈ l.17)

```ts
export type ToolTier = 'read' | 'auto' | 'confirm' | 'slow_async'
```

- [ ] **Step 2 : Reclasser `run_kyc_screening` et `send_kyc_report`** dans `TOOL_TIERS` (≈ l.41-42)

Remplacer :
```ts
  attach_kyc_document: 'auto',
  run_kyc_screening: 'auto',
  send_kyc_report: 'auto',
```
par :
```ts
  attach_kyc_document: 'auto',          // reste synchrone (P2b : async + R2)
  run_kyc_screening: 'slow_async',      // ~50s Dilisense → hors boucle (file + cron)
  send_kyc_report: 'slow_async',        // ~60s render PDF + envoi → hors boucle
```
> `toolTier()` (l.45) est inchangé : il renvoie la valeur du map. `attach_kyc_document` reste `auto`.

- [ ] **Step 3 : Étendre le test du router** (`whatsapp-agent-router.test.ts`)

Lire d'abord le test existant. Ajouter un bloc qui asserte le routage des tiers et l'invariant socle légal :
```ts
import { describe, it, expect } from 'vitest'
import { toolTier } from './whatsapp-agent-router'

describe('toolTier — tiers des outils KYC (Palier 2)', () => {
  it('run_kyc_screening et send_kyc_report sont slow_async', () => {
    expect(toolTier('run_kyc_screening')).toBe('slow_async')
    expect(toolTier('send_kyc_report')).toBe('slow_async')
  })
  it('attach_kyc_document reste auto (synchrone, P2b)', () => {
    expect(toolTier('attach_kyc_document')).toBe('auto')
  })
  it('le socle légal reste confirm (jamais slow_async/auto)', () => {
    for (const t of ['send_client_message', 'send_listings', 'record_offer', 'open_kyc_case']) {
      expect(toolTier(t)).toBe('confirm')
    }
  })
  it('un outil inconnu reste confirm (fail-safe)', () => {
    expect(toolTier('outil_inexistant')).toBe('confirm')
  })
})
```

- [ ] **Step 4 : Lancer le test**

Run: `npx vitest run supabase/functions/_shared/whatsapp-agent-router.test.ts`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add supabase/functions/_shared/whatsapp-agent-router.ts supabase/functions/_shared/whatsapp-agent-router.test.ts
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "feat(whatsapp): tier slow_async pour run_kyc_screening + send_kyc_report"
```

---

## Task 5 : i18n — ACK async + clé `complexRetry`

**Files:**
- Modify: `supabase/functions/_shared/whatsapp-i18n.ts`

- [ ] **Step 1 : Ajouter la clé statique `complexRetry`** dans l'objet `STR` (≈ l.79, à côté de `reformulate`)

```ts
  complexRetry: {
    fr: "Ta demande est un peu chargée — je m'en occupe par étapes, redonne-moi un instant.",
    en: "Your request is a bit heavy — I'm handling it in steps, give me a moment.",
  },
```

- [ ] **Step 2 : Ajouter la fonction `asyncAck`** (en bas du fichier, à côté des autres helpers exportés comme `confirmSendClient`)

```ts
/** ACK renvoyé à DeepSeek quand un outil lent part en file (le résultat suivra,
 *  livré à l'agent par le worker). `name` = nom humain du contact (jamais un id). */
export function asyncAck(lang: WaLang, kind: 'screening' | 'report', name: string): string {
  const n = name && name.trim() ? name.trim() : ''
  if (lang === 'en') {
    const who = n ? ` for ${n}` : ''
    return kind === 'screening'
      ? `I'm running the screening${who} — I'll send you the result in ~15s.`
      : `I'm preparing the KYC report${who} — you'll get the PDF in ~15s.`
  }
  const who = n ? ` de ${n}` : ''
  return kind === 'screening'
    ? `Je lance le screening${who}, je te donne le résultat dans ~15 s.`
    : `Je prépare le rapport KYC${who}, tu reçois le PDF dans ~15 s.`
}
```

- [ ] **Step 3 : Vérifier**

Run: `deno check supabase/functions/_shared/whatsapp-i18n.ts`
Expected: 0 erreur.

- [ ] **Step 4 : Commit**

```bash
git add supabase/functions/_shared/whatsapp-i18n.ts
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "feat(whatsapp): i18n ACK async (asyncAck) + clé complexRetry"
```

---

## Task 6 : `whatsapp-agent` — enqueue + ACK pour `slow_async` + budget temps global

**Files:**
- Modify: `supabase/functions/whatsapp-agent/index.ts`

- [ ] **Step 1 : Importer `asyncAck`** (ligne d'import depuis `whatsapp-i18n`, ≈ l.15)

Ajouter `asyncAck` à l'import existant :
```ts
import { detectLang, t, asyncAck, confirmSendClient, confirmUpdatePipeline, pipelineWhoDefault, pipelineWhoNamed } from '../_shared/whatsapp-i18n.ts'
```

- [ ] **Step 2 : Ajouter le helper d'enqueue** (juste avant `function json(...)`, ≈ l.167)

```ts
// Enfile un job pour un outil lent (slow_async) et renvoie l'ACK à mettre comme
// résultat d'outil. Dédup via l'index UNIQUE partiel de la Task 1 : un INSERT en
// doublon lève 23505, qu'on traite comme « déjà en file » (succès) — on NE peut PAS
// utiliser upsert/onConflict ici, car ON CONFLICT n'infère pas un index PARTIEL sur
// expression (COALESCE). INSERT + catch 23505 est le bon pattern.
async function enqueueAsyncJob(
  ctx: ActionCtx, waNumber: string, tool: string, args: Record<string, unknown>,
): Promise<string> {
  const contactId = typeof args.contact_id === 'string' ? args.contact_id : null
  const lang = ctx.lang ?? 'fr'
  const { error } = await ctx.supabase.from('whatsapp_async_jobs').insert({
    profile_id: ctx.profileId,
    agency_id: ctx.agencyId,
    wa_agent_phone: waNumber,
    tool,
    args: { ...args, __lang: lang },
    contact_id: contactId,
    lang,
  })
  // 23505 = job déjà en file pour (profile, tool, contact) → dédup VOULUE : on ACK quand
  // même (l'ancien job livrera le résultat). Toute autre erreur : on log (PII-safe).
  if (error && error.code !== '23505') {
    console.error('enqueue async job failed:', (error.message ?? 'error').slice(0, 120))
  }
  // Nom humain pour l'ACK (jamais l'id). Best-effort : si pas de contact, ACK générique.
  let name = ''
  if (contactId && ctx.agencyId) {
    const { data: c } = await ctx.supabase.from('contacts')
      .select('first_name, last_name').eq('id', contactId).eq('agency_id', ctx.agencyId).maybeSingle()
    if (c) name = `${(c.first_name ?? '').trim()} ${(c.last_name ?? '').trim()}`.trim()
  }
  return asyncAck(lang, tool === 'run_kyc_screening' ? 'screening' : 'report', name)
}
```
> L'index partiel `uq_whatsapp_async_dedup` (Task 1) est sur `COALESCE(contact_id::text,'∅')` et partiel (`WHERE status IN ('pending','processing')`). PostgREST `upsert`/`onConflict` ne sait PAS cibler un tel index → on fait un INSERT simple et on avale le `23505`. C'est cohérent avec la spec de la Task 8 (qui attend le `23505` sur le doublon).

- [ ] **Step 3 : Brancher `slow_async` dans la boucle d'outils** (≈ l.142, juste après `const tier = toolTier(name)`)

Avant le bloc `if (tier === 'confirm') {`, insérer :
```ts
      if (tier === 'slow_async') {
        const ack = await enqueueAsyncJob(ctx, waNumber, name, args)
        // ACK comme résultat d'outil : DeepSeek conclut le tour avec une phrase humaine.
        messages.push({ role: 'tool', tool_call_id: call.id, content: ack })
        continue
      }
```

- [ ] **Step 4 : Ajouter le budget temps global** (filet de dernier recours, §3.4)

En tête de `serve(async (req) => {` après la lecture du body (≈ l.63, après `const lang = detectLang(message)`), ajouter :
```ts
  const T0 = Date.now()
  const overBudget = () => Date.now() - T0 > 45_000
```
Puis tester en tête de la boucle des tours (≈ l.116, première ligne du `for (let turn...`):
```ts
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    if (overBudget()) return json({ reply: t(lang, 'complexRetry'), isError: true }, 200)
    const resp = await callDeepSeek(apiKey, messages)
```
Et en tête de la boucle des appels d'outils (≈ l.134, première ligne du `for (const call...`):
```ts
    for (const call of toolCalls) {
      if (overBudget()) return json({ reply: t(lang, 'complexRetry'), isError: true }, 200)
      if (toolCallsUsed >= MAX_TOOL_CALLS) {
```
> `complexRetry` est `isError: true` (réponse dégradée → exclue de la mémoire C1 par le filtre du Palier 1).

- [ ] **Step 5 : Vérifier**

Run: `deno check supabase/functions/whatsapp-agent/index.ts`
Expected: 0 erreur. Re-lire : la branche `slow_async` est AVANT `confirm` ; `run_kyc_screening`/`send_kyc_report` ne passent plus par `runTool`.

- [ ] **Step 6 : Commit**

```bash
git add supabase/functions/whatsapp-agent/index.ts
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "feat(whatsapp): enqueue + ACK slow_async + budget temps global 45s"
```

---

## Task 7 : Nouvelle edge `whatsapp-agent-async` (worker)

**Files:**
- Create: `supabase/functions/whatsapp-agent-async/index.ts`

- [ ] **Step 1 : Écrire le worker** (jumeau de `whatsapp-process` — garde `app_config`, BUDGET, claim, livraison à l'agent)

```ts
// supabase/functions/whatsapp-agent-async/index.ts
// Worker cron des outils KYC lents (run_kyc_screening, send_kyc_report) sortis de la
// boucle DeepSeek. Réclame des jobs (claim_whatsapp_async_jobs), exécute l'outil hors
// requête, et LIVRE LE RÉSULTAT À L'AGENT SEUL (jamais au client) via buildSendTextRequest.
// Appelé UNIQUEMENT par pg_cron en service-role. verify_jwt=false (config.toml) — garde
// applicative alignée sur app_config.service_role_key (comme whatsapp-process, §3.5).
//
// Compliance : le résultat va au numéro de l'agent ; aucune validation KYC automatique
// (is_completed reste réservé MLRO). DeepSeek inchangé : les exec* font le travail.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getProvider, type SendConfig } from '../_shared/whatsapp-gateway.ts'
import { execRunKycScreening, execSendKycReport, type ActionCtx } from '../_shared/whatsapp-actions.ts'
import { asWaLang } from '../_shared/whatsapp-i18n.ts'

const BATCH = 5
const MAX_RETRIES = 3
const BUDGET_MS = 90_000

function json(o: unknown, c: number): Response {
  return new Response(JSON.stringify(o), { status: c, headers: { 'Content-Type': 'application/json' } })
}
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Garde service-role : pg_cron envoie Bearer <service_role_key d'app_config>.
  {
    const { data: cfg } = await admin.from('app_config').select('value').eq('key', 'service_role_key').maybeSingle()
    const expectedKey = (cfg?.value as string | undefined) ?? ''
    const providedKey = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!expectedKey || !safeEqual(providedKey, expectedKey)) return json({ error: 'Forbidden' }, 403)
  }

  const t0 = Date.now()
  const overBudget = () => Date.now() - t0 > BUDGET_MS
  const metaToken = Deno.env.get('META_WHATSAPP_TOKEN') ?? ''
  const apiVersion = Deno.env.get('META_API_VERSION') ?? 'v22.0'
  const metaPhoneNumberId = Deno.env.get('META_PHONE_NUMBER_ID') ?? ''
  const provider = getProvider('meta')
  const sendCfg: SendConfig = { metaToken, metaPhoneNumberId, metaApiVersion: apiVersion }

  const { data: jobs, error } = await admin.rpc('claim_whatsapp_async_jobs', { p_batch: BATCH })
  if (error) return json({ error: error.message }, 500)

  let done = 0, failed = 0
  for (const j of (jobs ?? []) as Array<Record<string, unknown>>) {
    if (overBudget()) break  // reste 'processing' → repris au tick suivant (>5 min)
    const id = j.id as string
    try {
      const ctx: ActionCtx = {
        supabase: admin,
        profileId: j.profile_id as string,
        agencyId: (j.agency_id as string | null) ?? null,
        inboundMedia: null,
        lang: asWaLang(j.lang),
        agentPhone: j.wa_agent_phone as string,
      }
      const args = (j.args as Record<string, unknown>) ?? {}
      const tool = j.tool as string
      const result = tool === 'run_kyc_screening'
        ? await execRunKycScreening(ctx, args)
        : await execSendKycReport(ctx, args)

      // Livrer le résultat à l'AGENT (jamais au client). Fenêtre 24h ouverte (l'agent
      // vient d'écrire). buildSendTextRequest comme whatsapp-process (avis LPD).
      if (metaToken && metaPhoneNumberId) {
        const sreq = provider.buildSendTextRequest({ toPhone: j.wa_agent_phone as string, body: result }, sendCfg)
        await fetch(sreq.url, { method: sreq.method, headers: sreq.headers, body: sreq.body, signal: AbortSignal.timeout(8000) })
      }
      await admin.from('whatsapp_async_jobs').update({
        status: 'done', result_summary: result.slice(0, 500), last_error: null,
      }).eq('id', id)
      done++
    } catch (e) {
      const rc = ((j.retry_count as number) ?? 0) + 1
      await admin.from('whatsapp_async_jobs').update({
        status: rc >= MAX_RETRIES ? 'failed' : 'pending',
        retry_count: rc,
        last_error: String((e as Error)?.message ?? 'error').slice(0, 300),
      }).eq('id', id)
      failed++
    }
  }

  return json({ ok: true, claimed: (jobs ?? []).length, done, failed }, 200)
})
```

> Points de vigilance : (a) `execSendKycReport` lit `ctx.agentPhone` pour le `to_phone` du PDF → on le fournit via `wa_agent_phone`. (b) `execRunKycScreening` pose le verrou `screening_status` du Palier 1 — intact, c'est lui la dernière barrière anti-double-crédit. (c) On NE retire PAS `attach_kyc_document` ici (pas dans le CHECK de la table ; reste synchrone).

- [ ] **Step 2 : Vérifier**

Run: `deno check supabase/functions/whatsapp-agent-async/index.ts`
Expected: 0 erreur (les exports `execRunKycScreening`/`execSendKycReport`/`ActionCtx` existent déjà dans `whatsapp-actions.ts`).

- [ ] **Step 3 : Commit**

```bash
git add supabase/functions/whatsapp-agent-async/index.ts
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "feat(whatsapp): edge whatsapp-agent-async (worker outils KYC lents, livre à l'agent)"
```

---

## Task 8 : Spec backend live + build + cerveau + PR

**Files:**
- Create: `tests/backend/whatsapp-async-jobs-claim.spec.ts`

- [ ] **Step 1 : Spec claim + dédup**

Lire d'abord `tests/backend/whatsapp-messages-rls.spec.ts` (helpers) et `tests/backend/kyc-screening-lock.spec.ts` (pattern Palier 1). Puis écrire la spec qui, contre la stack locale (service-role) :
- insère 2 jobs `whatsapp_async_jobs` pour le MÊME `(profile_id, tool, contact_id)` → assert que le 2e INSERT échoue (index UNIQUE partiel) OU n'en crée qu'un via upsert `ignoreDuplicates` ;
- appelle `claim_whatsapp_async_jobs(5)` → assert qu'un job revient avec `status='processing'` ;
- un 2e `claim` immédiat ne re-réclame pas le même job (déjà processing < 5 min).

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('whatsapp_async_jobs — dédup enqueue + claim atomique', () => {
  let setup: TwoAgenciesSetup
  const ids: string[] = []
  const profileId = '00000000-0000-4000-8000-0000000000aa' // profil fictif (FK non contrainte ici)
  const contactId = '00000000-0000-4000-8000-0000000000bb'

  beforeAll(async () => { setup = await setupTwoAgencies() })
  afterAll(async () => {
    const svc = serviceRoleClient()
    for (const id of ids) await svc.from('whatsapp_async_jobs').delete().eq('id', id)
    await svc.from('whatsapp_async_jobs').delete().eq('profile_id', profileId)
    await setup.cleanup()
  })

  it('un 2e job pending identique est refusé (dédup partielle)', async () => {
    const svc = serviceRoleClient()
    const row = {
      profile_id: profileId, agency_id: setup.agencyAId, wa_agent_phone: '41790000001',
      tool: 'run_kyc_screening', contact_id: contactId, lang: 'fr',
    }
    const { data: a, error: e1 } = await svc.from('whatsapp_async_jobs').insert(row).select('id').single()
    expect(e1).toBeNull()
    if (a?.id) ids.push(a.id)
    const { error: e2 } = await svc.from('whatsapp_async_jobs').insert(row).select('id').single()
    expect(e2).not.toBeNull() // violation de uq_whatsapp_async_dedup
  })

  it('claim_whatsapp_async_jobs réclame puis ne re-réclame pas (processing)', async () => {
    const svc = serviceRoleClient()
    const { data: claimed } = await svc.rpc('claim_whatsapp_async_jobs', { p_batch: 5 })
    expect((claimed ?? []).some((j: { contact_id: string }) => j.contact_id === contactId)).toBe(true)
    const { data: again } = await svc.rpc('claim_whatsapp_async_jobs', { p_batch: 5 })
    expect((again ?? []).some((j: { contact_id: string }) => j.contact_id === contactId)).toBe(false)
  })
})
```
> Adapter aux colonnes obligatoires réelles. Si `profile_id` a une FK vers `profiles`, créer un profil de test via le helper ou un id de `setup` (sinon garder un uuid libre si la colonne n'est pas contrainte). Vérifier ce point avant d'écrire (lire la migration Task 1 : `profile_id uuid NOT NULL` sans REFERENCES → uuid libre OK).

- [ ] **Step 2 : Lancer le tout**

Run: `npm run build && npx vitest run`
Expected: build vert, unit verts. (Backend specs : verts en CI contre la stack locale ; skip propre en local sans Docker.)

- [ ] **Step 3 : Mettre à jour le cerveau** (exigé)

Éditer `.claude-flow/knowledge/megga-memory.seed.json` :
- Nœud `megga/whatsapp-agent-stability-autonomy-strategy` : passer « P2 » de planifié à LIVRÉ (screening + report async ; attach reste P2b).
- Nœud `megga/whatsapp-copilot-lessons` : ajouter une leçon « (10) outils KYC lents sortis de la boucle (tier slow_async, table whatsapp_async_jobs + cron whatsapp-agent-async-minute, clone de whatsapp-process) ; ACK immédiat à DeepSeek, résultat livré à l'AGENT seul ; budget temps global 45s. attach_kyc_document encore synchrone (P2b, prérequis R2). »
- Nœud `megga/whatsapp-data-model` : ajouter la table `whatsapp_async_jobs` (profile_id, tool slow_async, status, dédup partielle).

Puis `npm run ruflo:seed` et vérifier : `npx ruflo memory search -q "whatsapp_async_jobs slow_async cron worker" -n megga`.

- [ ] **Step 4 : Commit + PR**

```bash
git add tests/backend/whatsapp-async-jobs-claim.spec.ts .claude-flow/knowledge/megga-memory.seed.json
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "test(whatsapp): spec file async + cerveau P2 livré"
```
Ouvrir la PR vers `main`. **Vérifier la date des migrations = jour du merge** (cerveau `deploy-migrations-gate`).

---

## Self-Review (vérifié contre la stratégie §3)

- ✅ §3.1 mécanisme : tier `slow_async` (Task 4), enqueue + ACK 1 tour (Task 6), table+RPC (Task 1), edge jumelle (Task 7), cron (Task 2).
- ✅ §3.5 garde service-role alignée sur `app_config.service_role_key` + `verify_jwt=false` (Task 3, Task 7).
- ✅ §3.4 budget temps global 45 s + clé `complexRetry` créée (Task 5, Task 6).
- ✅ Idempotence/dédup : index UNIQUE partiel `COALESCE(contact_id::text,'∅')` (Task 1) + `FOR UPDATE SKIP LOCKED` (Task 1) + verrou `screening_status` du Palier 1 conservé (Task 7).
- ✅ Compliance : résultat livré à l'AGENT seul (`wa_agent_phone`) ; aucun tier `confirm` touché ; `is_completed` jamais posé. DeepSeek-only intact.
- **Cohérence des noms :** `whatsapp_async_jobs` (table) ↔ `claim_whatsapp_async_jobs` (RPC) ↔ `whatsapp-agent-async` (edge) ↔ `whatsapp-agent-async-minute` (cron) ↔ `slow_async` (tier).

**Hors périmètre (P2b, plan séparé) :** `attach_kyc_document` async — nécessite (1) persister `media_id` + pousser les bytes en R2 sur la branche agent du webhook (`whatsapp-webhook/index.ts:282-303`, réutiliser `buildMediaKey` + `AwsClient` comme `whatsapp-process:84-87`), (2) faire lire `media_r2_key` par `execAttachKycDocument` (`whatsapp-actions.ts:702`, aujourd'hui re-fetch Meta l.720), (3) ajouter `attach_kyc_document` au `CHECK tool` de la table + au dispatch du worker, (4) dédup `(kyc_case_id, wa_message_id)` sur `kyc_magic_link_uploads`.

---

## Exécution

Session fraîche, **subagent-driven** : un sous-agent par tâche + revue conformité-puis-qualité. Consulter le cerveau au début de chaque tâche. **Dater les migrations du jour de merge** (piège `deploy-migrations-gate`). Mettre le cerveau à jour à la Task 8.
