# WhatsApp backend — hygiène : santé des crons + purge L3 des audios (plan d'implémentation)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) ou superpowers:executing-plans, tâche par tâche. Étapes en cases à cocher (`- [ ]`).

**Goal:** Que le backend WhatsApp ne meure jamais en silence (1) un **panneau « santé des crons »** sur la page super-admin monitoring qui montre, pour chaque job pg_cron, sa dernière exécution + s'il est en retard ; (2) une **purge L3** des audios dans R2 après transcription (minimisation LPD + coût), à fenêtre de 30 jours.

**Architecture :** (1) RPC `get_cron_health()` (SECURITY DEFINER, gardée `is_super_admin`) qui lit directement les tables natives de pg_cron (`cron.job` + dernier `cron.job_run_details` par job) — **aucune instrumentation des crons**, couvre les 9 jobs d'un coup ; dégrade proprement (renvoie vide) là où le schéma `cron` est absent (local/CI). Un helper pur `cronStale()` calcule « en retard » côté front (testable). (2) La purge L3 se branche dans le worker existant `whatsapp-process` (il a déjà le client R2) un lot borné par run supprime l'objet R2 des audios transcrits > 30 j puis vide `media_r2_key`. **Pas de nouvelle edge function, pas de nouveau cron.**

**Tech Stack :** PostgreSQL (migrations additives idempotentes, pg_cron), Supabase Edge (Deno/TS, client R2 `aws4fetch`), React 18 + React Query + react-i18next (4 langues). DeepSeek non concerné ici.

---

## Avant de commencer — consulter le cerveau

```bash
npx ruflo memory search -q "whatsapp cron pg_cron monitoring santé backend purge R2 audio transcription is_super_admin" -n megga
npx ruflo memory get -k "megga/deploy-migrations-gate" -n megga
npx ruflo memory get -k "megga/super-admin" -n megga
```
Re-consulter au début de chaque tâche. **Ne pas modifier le seed** avant la dernière tâche.

## Contraintes dures

- **Migrations additives + idempotentes, DATÉES DU JOUR DE MERGE** (cerveau `deploy-migrations-gate` : une migration datée avant le jour de deploy UTC est **sautée en silence**). Il y a 2 migrations ici (RPC + index purge) → les dater du jour de merge.
- **RPC gardée côté SERVEUR** `is_super_admin()` (`RAISE ... ERRCODE '42501'`), REVOKE public/anon, GRANT authenticated — mirror du pattern T1 (`get_agent_learned_styles`). Données cross-agence (tous les crons de la plateforme).
- **Dégradation propre** : `get_cron_health()` doit renvoyer un set vide (jamais d'erreur) si le schéma `cron` est absent (local/CI où pg_cron n'est pas installé). Idem la purge L3 : best-effort, un échec R2 laisse `media_r2_key` (re-tenté au prochain run), ne casse jamais `whatsapp-process`.
- **Purge L3 = minimisation, pas suppression agressive** : fenêtre 30 jours après transcription réussie (`transcript IS NOT NULL`), uniquement `media_type='audio'`. Bornée (LIMIT par run).
- **Léger** : 1 RPC + 1 helper + 1 panneau + 1 step dans un worker existant + 1 index. Pas de table heartbeat, pas de nouveau cron, pas de nouvelle fonction.
- `npm run build` passe avant push. **Specs backend tournent LIVE en CI** (skipIf n'est PAS un skip ; nettoyage `.then(()=>{}, ()=>{})`). i18n 4 langues.

## Périmètre

**FAIT (ce plan) :** RPC `get_cron_health` ; helper `cronStale` (TDD) ; hook `useCronHealth` + panneau « Santé des crons » sur `AdminMonitoringPage` (i18n 4 langues) ; purge L3 R2 dans `whatsapp-process` + index partiel ; spec live (gate) ; cerveau.

**PAS fait (hors périmètre) :** santé *interne* des edge functions (déjà couverte par le panneau « Edge Functions » existant via `activity_events`) ; alerting/notifications push ; heartbeat applicatif par cron (non nécessaire — `cron.job_run_details` suffit). La correction du sur-claim cerveau « 22 outils / #529 » est pliée dans la Task 5 (cerveau) au passage.

---

## File Structure

**Créer :**
- `supabase/migrations/<stamp>_get_cron_health_rpc.sql` — RPC + grants (Task 1).
- `src/lib/cronHealth.ts` — helper pur `cronStale()` + types (Task 2).
- `tests/unit/cron-health.test.ts` — tests du helper (Task 2).
- `src/hooks/useCronHealth.ts` — hook React Query (Task 3).
- `supabase/migrations/<stamp>_wa_media_r2_purge_index.sql` — index partiel pour la purge (Task 4).
- `tests/backend/cron-health.spec.ts` — spec live (Task 5).

**Modifier :**
- `src/pages/admin/AdminMonitoringPage.tsx` — panneau « Santé des crons » (Task 3).
- `src/i18n/locales/{fr,de,en,it}/admin.json` — clés `monitoring.cronHealth.*` (Task 3).
- `supabase/functions/whatsapp-process/index.ts` — step de purge L3 (Task 4).

**Contrat `get_cron_health` (défini une fois) :**
```ts
// une ligne par job pg_cron
type CronHealthRow = {
  jobname: string
  schedule: string          // ex '* * * * *', '40 4 * * *'
  active: boolean
  last_start: string | null // ISO, null si jamais exécuté
  last_status: string | null// 'succeeded' | 'failed' | null
}
```

---

## Task 1 : RPC `get_cron_health()` (gardée, lecture pg_cron, dégradation propre)

**Files:** Create `supabase/migrations/<stamp>_get_cron_health_rpc.sql` (stamp = jour de merge UTC, postérieur aux migrations existantes ; bare `CREATE OR REPLACE`, pas de BEGIN/COMMIT — comme les RPC T1)

- [ ] **Step 1 : Migration**
```sql
-- Hygiène backend : santé des crons pour le super-admin. Lit directement pg_cron
-- (cron.job + dernier cron.job_run_details par job). SECURITY DEFINER (proprio postgres
-- → peut lire le schéma cron sur Supabase). Gardée is_super_admin (données plateforme).
-- Dégrade proprement : si le schéma cron est absent (local/CI), renvoie un set vide.
CREATE OR REPLACE FUNCTION public.get_cron_health()
RETURNS TABLE (jobname text, schedule text, active boolean, last_start timestamptz, last_status text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden: super_admin only' USING ERRCODE = '42501';
  END IF;

  -- pg_cron absent (local/CI) → set vide, jamais d'erreur (late binding plpgsql :
  -- la requête sur cron.* n'est jamais exécutée si le schéma n'existe pas).
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT j.jobname::text, j.schedule::text, j.active,
           d.start_time, d.status::text
    FROM cron.job j
    LEFT JOIN LATERAL (
      SELECT r.start_time, r.status
      FROM cron.job_run_details r
      WHERE r.jobid = j.jobid
      ORDER BY r.start_time DESC
      LIMIT 1
    ) d ON true
    ORDER BY j.jobname;
END;
$$;

REVOKE ALL ON FUNCTION public.get_cron_health() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_cron_health() TO authenticated;
COMMENT ON FUNCTION public.get_cron_health() IS
  'Hygiène backend — santé des jobs pg_cron (dernier run + statut) pour le super-admin. Garde is_super_admin (42501). Lit cron.job/cron.job_run_details ; renvoie vide si pg_cron absent (local/CI).';

-- Belt-and-suspenders : s'assurer que le rôle proprio (postgres) peut lire le schéma cron.
-- Gardé : ne s'exécute que si pg_cron est présent.
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    GRANT USAGE ON SCHEMA cron TO postgres;
    GRANT SELECT ON cron.job TO postgres;
    GRANT SELECT ON cron.job_run_details TO postgres;
  END IF;
END
$do$;
```
> Si les GRANT échouent (le proprio du schéma cron diffère selon l'instance), ce n'est pas bloquant pour la migration tant que `get_cron_health` peut lire — vérifier en prod via la spec/au déploiement. Le `RETURN` anticipé couvre CI.

- [ ] **Step 2 : Commit**
```bash
git add supabase/migrations/*_get_cron_health_rpc.sql
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "feat(monitoring): RPC get_cron_health (gardée is_super_admin, lit pg_cron)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2 : Helper pur `cronStale()` (TDD)

**Files:** Create `src/lib/cronHealth.ts` + `tests/unit/cron-health.test.ts`

- [ ] **Step 1 : Test (échoue)** — `tests/unit/cron-health.test.ts` (mirror l'import des `tests/unit/*` : `import { describe, it, expect } from 'vitest'`)
```ts
import { cronStale } from '@/lib/cronHealth'

const NOW = Date.parse('2026-06-04T12:00:00Z')

describe('cronStale', () => {
  it('flague un échec quel que soit le timing', () => {
    expect(cronStale('40 4 * * *', '2026-06-04T11:59:00Z', 'failed', NOW).stale).toBe(true)
  })
  it('flague un job jamais exécuté', () => {
    expect(cronStale('40 4 * * *', null, null, NOW)).toEqual({ stale: true, reason: 'never' })
  })
  it('quotidien : OK si <26h, en retard si >26h', () => {
    expect(cronStale('40 4 * * *', '2026-06-04T05:00:00Z', 'succeeded', NOW).stale).toBe(false)   // 7h
    expect(cronStale('40 4 * * *', '2026-06-03T05:00:00Z', 'succeeded', NOW)).toEqual({ stale: true, reason: 'overdue' }) // 31h
  })
  it('chaque minute : OK si <15min, en retard sinon', () => {
    expect(cronStale('* * * * *', '2026-06-04T11:58:00Z', 'succeeded', NOW).stale).toBe(false)   // 2min
    expect(cronStale('* * * * *', '2026-06-04T11:30:00Z', 'succeeded', NOW).stale).toBe(true)    // 30min
  })
  it('horaire : OK si <2h, en retard sinon', () => {
    expect(cronStale('15 * * * *', '2026-06-04T11:15:00Z', 'succeeded', NOW).stale).toBe(false)  // 45min
    expect(cronStale('15 * * * *', '2026-06-04T09:00:00Z', 'succeeded', NOW).stale).toBe(true)   // 3h
  })
})
```

- [ ] **Step 2 : Run → FAIL.** `npx vitest run tests/unit/cron-health.test.ts`.

- [ ] **Step 3 : Implémenter** `src/lib/cronHealth.ts`
```ts
export type CronHealthRow = {
  jobname: string
  schedule: string
  active: boolean
  last_start: string | null
  last_status: string | null
}

export type CronStale = { stale: boolean; reason?: 'failed' | 'never' | 'overdue' }

/** Seuil de retard (ms) déduit de la cadence cron. Heuristique simple, suffisante pour un témoin. */
function thresholdMs(schedule: string): number {
  const s = (schedule ?? '').trim()
  if (s === '* * * * *') return 15 * 60_000                 // chaque minute → 15 min
  if (/^\S+ \* \* \* \*$/.test(s)) return 2 * 60 * 60_000   // horaire (min fixe, heure *) → 2 h
  return 26 * 60 * 60_000                                    // quotidien / autre → 26 h
}

/** Détermine si un job cron est « en retard »/en échec. `now` injectable pour les tests. */
export function cronStale(
  schedule: string, lastStart: string | null, lastStatus: string | null, now: number = Date.now(),
): CronStale {
  if (lastStatus === 'failed') return { stale: true, reason: 'failed' }
  if (!lastStart) return { stale: true, reason: 'never' }
  const age = now - Date.parse(lastStart)
  if (age > thresholdMs(schedule)) return { stale: true, reason: 'overdue' }
  return { stale: false }
}
```

- [ ] **Step 4 : Run → PASS.** `npx vitest run tests/unit/cron-health.test.ts`.

- [ ] **Step 5 : Commit**
```bash
git add src/lib/cronHealth.ts tests/unit/cron-health.test.ts
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "feat(monitoring): helper pur cronStale + types (TDD)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3 : Hook `useCronHealth` + panneau « Santé des crons » + i18n

**Files:** Create `src/hooks/useCronHealth.ts` ; Modify `src/pages/admin/AdminMonitoringPage.tsx`, les 4 `admin.json`

- [ ] **Step 1 : Lire** `src/hooks/useAdminMonitoring.ts` (pattern de hook + cast `supabase.rpc`) et `src/pages/admin/AdminMonitoringPage.tsx` (où insérer un panneau `rounded-xl border border-theme-border`, le namespace `useTranslation('admin')`, le style des cartes santé).

- [ ] **Step 2 : Hook** `src/hooks/useCronHealth.ts`
```tsx
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { CronHealthRow } from '@/lib/cronHealth'

export function useCronHealth() {
  return useQuery({
    queryKey: ['admin', 'cron-health'],
    staleTime: 60_000,
    queryFn: async (): Promise<CronHealthRow[]> => {
      const { data, error } = await (supabase.rpc as unknown as
        (fn: string) => Promise<{ data: unknown; error: Error | null }>)('get_cron_health')
      if (error) throw error
      return (data ?? []) as CronHealthRow[]
    },
  })
}
```

- [ ] **Step 3 : Panneau** — dans `AdminMonitoringPage.tsx`, importer `useCronHealth` + `cronStale` (`@/lib/cronHealth`), et ajouter une section `rounded-xl border border-theme-border p-4` (après le panneau Flatfox) titrée `t('monitoring.cronHealth.title')`. Pour chaque ligne (`data ?? []`), calculer `const st = cronStale(row.schedule, row.last_start, row.last_status)` et afficher : un dot (vert si `!st.stale`, rouge sinon — texte coloré/dot, pas de fond plein), `row.jobname`, `row.schedule`, la dernière exécution relative (`row.last_start` → "il y a Xh" ou `t('monitoring.cronHealth.never')` si null), et un libellé statut (`st.stale ? t('monitoring.cronHealth.stale') : t('monitoring.cronHealth.ok')`). États loading (`t('common.loading')` si dispo, sinon texte) / error (bannière rouge `border-red-500/30 bg-red-500/5 text-red-400`) / empty (texte « aucun cron visible » — normal hors prod). Tokens `text-theme-*`, `overflow-x-auto` sur la liste. Mirror le style des cartes santé existantes.

- [ ] **Step 4 : i18n** — ajouter aux 4 `src/i18n/locales/{fr,de,en,it}/admin.json` (format PLAT dot-notation, prefix `monitoring.cronHealth.*`) : `title`, `job`, `schedule`, `lastRun`, `status`, `ok`, `stale`, `never`, `empty`. FR + EN rédigés, DE + IT traduits fidèlement. Vérifier que chaque JSON parse.

- [ ] **Step 5 : Vérifier** `npm run build` → vert.

- [ ] **Step 6 : Commit**
```bash
git add src/hooks/useCronHealth.ts src/pages/admin/AdminMonitoringPage.tsx src/i18n/locales/*/admin.json
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "feat(monitoring): panneau « Santé des crons » (super-admin)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4 : Purge L3 des audios R2 dans `whatsapp-process` (+ index)

> R2 ne se supprime pas en SQL → la purge vit dans le worker qui a déjà le client R2. Bornée, best-effort, fenêtre 30 j, audio transcrit uniquement. Vider `media_r2_key` UNIQUEMENT après suppression R2 réussie (sinon on orpheline l'objet).

**Files:** Create `supabase/migrations/<stamp>_wa_media_r2_purge_index.sql` ; Modify `supabase/functions/whatsapp-process/index.ts`

- [ ] **Step 1 : Index partiel** (rend le SELECT de purge cheap) — `supabase/migrations/<stamp>_wa_media_r2_purge_index.sql` (stamp jour de merge) :
```sql
-- Hygiène backend : index partiel pour la purge L3 (audios R2 transcrits anciens).
CREATE INDEX IF NOT EXISTS idx_wa_msg_r2_audio_purge
  ON public.whatsapp_messages (created_at)
  WHERE media_r2_key IS NOT NULL AND media_type = 'audio';
```

- [ ] **Step 2 : Step de purge** — dans `supabase/functions/whatsapp-process/index.ts`, APRÈS le traitement principal (avant le `return` final), lire le client R2 déjà en place (`r2`, `r2Account`, `r2Bucket`) et ajouter :
```ts
  // L3 : purge des audios R2 transcrits > 30 j (minimisation LPD). Best-effort, borné.
  try {
    const { data: stale } = await admin.from('whatsapp_messages')
      .select('id, media_r2_key')
      .eq('media_type', 'audio')
      .not('media_r2_key', 'is', null)
      .not('transcript', 'is', null)
      .lt('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .limit(20)
    for (const m of (stale ?? []) as Array<{ id: string; media_r2_key: string }>) {
      const key = m.media_r2_key
      if (!key) continue
      const del = await r2.fetch(`https://${r2Account}.r2.cloudflarestorage.com/${r2Bucket}/${key}`, { method: 'DELETE' })
      // R2 DELETE renvoie 204 (supprimé) ou 404 (déjà absent) → dans les deux cas on vide la clé.
      if (del.ok || del.status === 404) {
        await admin.from('whatsapp_messages').update({ media_r2_key: null }).eq('id', m.id)
      } else {
        console.error('L3 purge R2 delete failed', del.status, key)   // laisse la clé → retry au prochain run
      }
    }
  } catch (e) { console.error('L3 purge failed:', (e as Error)?.name ?? 'error') }   // ne casse jamais le worker
```
> Placer ce bloc de façon à réutiliser `r2`, `r2Account`, `r2Bucket` (déjà définis en tête du serve). Si ces variables sont scoping-locales à une autre fonction, les hisser ou recréer un `AwsClient` identique (mêmes env vars). Vérifier le scope en lisant le fichier.

- [ ] **Step 3 : Vérifier** `deno check supabase/functions/whatsapp-process/index.ts` → 0 erreur. Relire : la clé n'est vidée qu'après DELETE réussi (204) ou 404 ; tout échec/exception est best-effort (loggé, jamais throw).

- [ ] **Step 4 : Commit**
```bash
git add supabase/migrations/*_wa_media_r2_purge_index.sql supabase/functions/whatsapp-process/index.ts
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "feat(whatsapp): purge L3 des audios R2 transcrits >30j (minimisation LPD)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5 : Spec live + build + cerveau + PR

**Files:** Create `tests/backend/cron-health.spec.ts`

- [ ] **Step 1 : Spec live** — mirror `tests/backend/whatsapp-learning-style.spec.ts` (helper `setupTwoAgencies()`, promotion agentA en `super_admin`, `describe.skipIf(!HAS_KEYS)`, cleanup `.then(()=>{}, ()=>{})`). Couvrir :
  1. **Gate** : `clientB` (agent) appelant `get_cron_health()` → erreur (42501). `clientA` (super_admin) → succès sans erreur (en CI, pg_cron absent → set vide ; asserter que l'appel résout sans throw et renvoie un tableau).
  2. **Pas d'exposition anon** : un appel via le client anon (sans session) → erreur.
  Pas de seed nécessaire (lecture pg_cron). Pas de cleanup de données (juste démote agentA si le helper ne le fait pas).

- [ ] **Step 2 : Lancer** `npm run build && npx vitest run` (build vert ; unit verts dont `cronStale`). `npx vitest run --config=vitest.backend.config.ts tests/backend/cron-health.spec.ts` → collecte propre.

- [ ] **Step 3 : Cerveau** — éditer `.claude-flow/knowledge/megga-memory.seed.json` (JSON-safe via node, valider le parse) :
  - Nœud `megga/super-admin` : noter le panneau « Santé des crons » sur la page monitoring (RPC `get_cron_health` gardée is_super_admin, lit pg_cron).
  - Nœud WhatsApp pipeline / `megga/whatsapp-data` : noter la purge L3 (audios R2 transcrits > 30 j, dans `whatsapp-process`, minimisation LPD).
  - **Au passage, corriger le sur-claim outils** : le nœud qui dit « 22 outils / Lot 1 mergé en #529 » → mettre le compte réel après #541 (vérifier dans `supabase/functions/_shared/whatsapp-tools.ts` sur ce worktree : 19 de base + 4 de #541 = 23 ; confirmer le chiffre dans le code, ne pas le supposer) et la bonne réf PR (#541).
  Puis `npm run ruflo:seed` ; valider (`node -e "require('./.claude-flow/knowledge/megga-memory.seed.json')"`).

- [ ] **Step 4 : Commit + PR**
```bash
git add tests/backend/cron-health.spec.ts .claude-flow/knowledge/megga-memory.seed.json
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "test(monitoring): spec get_cron_health gardée ; cerveau hygiène backend + fix compte outils

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```
Ouvrir la PR vers `main`. **Dater les 2 migrations du jour de merge.** NE PAS merger sans accord humain (CI verte d'abord). Le contrôleur ouvre la PR et confirme quand c'est vert.

---

## Self-Review (vérifié contre les contraintes)

- ✅ Santé crons : `get_cron_health` lit pg_cron directement (9 jobs), zéro instrumentation ; dégrade en vide hors prod ; gardée `is_super_admin` (42501) + testée live.
- ✅ Purge L3 : dans le worker existant (R2 client réutilisé), bornée, best-effort, clé vidée seulement après DELETE R2 OK/404 (pas d'orphelin), fenêtre 30 j, audio transcrit only ; index partiel pour le coût.
- ✅ Léger : 1 RPC + 1 helper testé + 1 hook + 1 panneau + 1 step worker + 1 index. Pas de table heartbeat, pas de nouveau cron/fonction.
- ✅ Migrations additives/idempotentes (`CREATE OR REPLACE`, `CREATE INDEX IF NOT EXISTS`), datées du jour de merge.
- ✅ i18n 4 langues ; `npm run build` vert ; spec live (gate) ; helper TDD.
- ✅ Bonus : corrige le sur-claim cerveau (compte d'outils WhatsApp) à la Task 5.

**Cohérence des noms :** `get_cron_health` (RPC) ↔ `CronHealthRow`/`cronStale` (`src/lib/cronHealth.ts`) ↔ `useCronHealth` ↔ clés i18n `monitoring.cronHealth.*` ; purge L3 ↔ `idx_wa_msg_r2_audio_purge` ↔ `whatsapp-process`.

---

## Exécution

Session FRAÎCHE, **subagent-driven** : un sous-agent par tâche + revue conformité-puis-qualité. Worktree frais branché sur le main à jour. **Dater les migrations du jour de merge.** Cerveau à jour à la Task 5. Attention de revue : la dégradation propre de `get_cron_health` (vide si cron absent, jamais d'erreur), et la purge L3 qui ne vide `media_r2_key` qu'après suppression R2 réussie.
