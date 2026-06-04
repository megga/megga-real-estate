# Agent WhatsApp — Apprentissage Tranche 2 : corrections/préférences par agent + rotation du cron (plan d'implémentation)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) ou superpowers:executing-plans, tâche par tâche. Étapes en cases à cocher (`- [ ]`).

**Goal:** MEGGA apprend les **corrections récurrentes** que chaque agent lui apporte (« non, plutôt mercredi », « pas ce contact », « en fait l'autre prix ») et les distille en **préférences durables** d'organisation/communication, injectées sur WhatsApp **après activation humaine** — réutilisant exactement le pipeline de la Tranche 1 (style). En passant, on **assainit la sélection du cron** (rotation par ancienneté + saut si rien de nouveau).

**Architecture:** Même pipeline que la T1 — `capture → distille (DeepSeek) → stocke → (revue super-admin) → injecte`. On ajoute une 2ᵉ colonne `agent_ai_profiles.learned_corrections` (parallèle à `learned_style`), une 2ᵉ distillation dans le **même** worker `learn-agent-style` (pas de nouveau cron), un 2ᵉ bloc `formatCorrectionsBlock` appended **après** le bloc de style dans `whatsapp-agent`, des RPC `get/set_agent_learned_correction` gardées `is_super_admin`, et une section « Préférences apprises » sur la page super-admin existante. Le worker passe d'une sélection `.limit(5)` naïve à une **RPC de rotation** `get_agents_to_learn` (ordonnée par ancienneté d'apprentissage) + un **garde de fraîcheur** (ne re-distille que s'il y a du nouveau depuis le dernier `updated_at`).

**Tech Stack:** Supabase Edge (Deno/TS), PostgreSQL (migrations additives idempotentes), pg_cron existant (réutilisé, pas de nouveau job), DeepSeek (jamais Claude), React 18 + Vite + React Query + react-i18next (4 langues). Réutilise la T1 livrée (PR #567).

---

## Avant de commencer — consulter le cerveau

```bash
npx ruflo memory search -q "whatsapp apprentissage learned_style learned_corrections learn-agent-style cron rotation is_super_admin confirmation_log deepseek" -n megga
npx ruflo memory get -k "megga/megga-ai-agent-learning" -n megga
npx ruflo memory get -k "megga/whatsapp-copilot-lessons" -n megga   # leçon (14) Apprentissage T1 + le piège is_super_admin (P3b)
npx ruflo memory get -k "megga/whatsapp-data" -n megga              # tables whatsapp_messages / agent_ai_profiles / agent_links
```
Re-consulter au début de chaque tâche. **Ne pas modifier le seed** avant la dernière tâche.

## Contraintes dures (non négociables — héritées de la T1)

- **DeepSeek uniquement** (jamais Claude/Anthropic/OpenAI). Cerveau `deepseek-not-claude`.
- **Human-in-the-loop** : un `learned_corrections` n'est JAMAIS injecté tant que son `status` n'est pas `active` (mis par un super-admin). Le worker ne pose que `suggested` et **préserve** un status humain (`active`/`off`).
- **Additif / non contournant** : le bloc de préférences est appended **APRÈS** le `SYSTEM` figé ET après le bloc de style ; il ne touche jamais le socle légal, la persona, ni les gardes de confirmation. **Spécifique T2 :** une « préférence » apprise ne doit JAMAIS encoder une règle qui contourne une confirmation, une validation humaine ou le cadre légal — c'est une préférence d'**organisation/communication** uniquement. Cette règle est imposée (a) dans le prompt de distillation, (b) dans le texte du bloc injecté, (c) en contrainte de revue.
- **Pas de PII** : la distillation extrait des **préférences**, pas le contenu — le prompt interdit noms/adresses/montants/données de contact. On ne persiste qu'un `summary` borné, jamais les messages bruts.
- **RPC super-admin gardées côté SERVEUR** par `public.is_super_admin()` (leçon P3b : `RAISE EXCEPTION ... ERRCODE '42501'`). La RPC de rotation `get_agents_to_learn` est **cron-only** (REVOKE authenticated/anon ; GRANT service_role).
- **Migrations additives + idempotentes, DATÉES DU JOUR DE MERGE** (cerveau `deploy-migrations-gate` : la CI n'applique que les migrations dont la date `YYYYMMDD` ≥ jour de deploy UTC ; une migration datée d'avant est **sautée en silence**). `npm run build` passe avant tout push. **Specs backend tournent LIVE en CI** (skipIf n'est PAS un skip là-bas ; nettoyage `.then(()=>{}, ()=>{})`, JAMAIS `.catch`). i18n 4 langues (skill `i18n-sync`).
- **Ne pas régresser la T1** : le worker est réécrit ; la distillation de **style** (prompt + échantillon entrants) doit rester identique en comportement. Seuls la **sélection** (RPC de rotation) et le **garde de fraîcheur** changent autour.

## Périmètre

**FAIT (ce plan) :** colonne `learned_corrections` ; `LearnedCorrections` + `formatCorrectionsBlock` (TDD) ; RPC de rotation `get_agents_to_learn` (cron-only) ; réécriture du worker (rotation + fraîcheur + 2ᵉ distillation corrections) ; injection du bloc corrections dans `whatsapp-agent` ; RPC `get/set_agent_learned_correction` gardées ; section « Préférences apprises » sur `/dashboard/admin/learning` ; specs live ; cerveau.

**PAS fait (tranches suivantes, MÊME pipeline) :** patterns d'horaires de visite (signal = créneaux réellement planifiés/acceptés), contacts fréquents, signal structuré via `whatsapp_confirmation_log` (yes/no par outil — plus riche mais hors périmètre ici), auto-activation sans revue, surveillance des crons (plan séparé `get_cron_health`).

---

## File Structure

**Créer :**
- `supabase/migrations/<stamp>_agent_learned_corrections_column.sql` — colonne `learned_corrections` (Task 1).
- `supabase/migrations/<stamp>_get_agents_to_learn_rpc.sql` — RPC de rotation cron-only (Task 3).
- `supabase/migrations/<stamp>_agent_corrections_rpcs.sql` — RPC get/set corrections gardées `is_super_admin` (Task 6).
- `tests/backend/whatsapp-learning-corrections.spec.ts` — spec live (Task 8).

**Modifier :**
- `supabase/functions/_shared/agent-style.ts` — ajouter `LearnedCorrections` + `formatCorrectionsBlock` (Task 2).
- `supabase/functions/_shared/agent-style.test.ts` — ajouter les tests de `formatCorrectionsBlock` (Task 2). *(Le fichier est déjà dans le glob `include` de `vitest.config.ts` — rien à ajouter au config.)*
- `supabase/functions/learn-agent-style/index.ts` — réécriture : rotation via RPC + fraîcheur + 2ᵉ distillation corrections (Task 4).
- `supabase/functions/whatsapp-agent/index.ts` — fetch `learned_corrections` + append `${correctionsBlock}` (Task 5).
- `src/hooks/useAdminLearning.ts` — ajouter `useAdminCorrections` + `useSetLearnedCorrection` (Task 7).
- `src/pages/admin/AdminLearningPage.tsx` — ajouter la section « Préférences apprises » (Task 7).
- `src/i18n/locales/{fr,de,en,it}/admin.json` — clés `learning.corrections.*` (Task 7).

**Contrats (définis UNE fois, réutilisés partout) :**
```ts
// _shared/agent-style.ts (la T1 y définit déjà LearnedStyle + formatStyleBlock — ne pas y toucher)
type LearnedCorrections = {
  summary: string            // 1-3 préférences récurrentes, bornées, AUCUNE PII, JAMAIS une règle de contournement
  status: 'suggested' | 'active' | 'off'
  updated_at: string         // ISO
  sample_count: number
}
```
Stocké en `jsonb` sur `agent_ai_profiles.learned_corrections`.

---

## Task 1 : Migration — colonne `learned_corrections`

**Files:** Create `supabase/migrations/<stamp>_agent_learned_corrections_column.sql`

- [ ] **Step 1 : Écrire la migration.** Stamp = `YYYYMMDDHHMMSS` du **jour de merge** (UTC). La T1 a mergé des migrations `20260604140000/140100/140200` ; choisir un stamp postérieur, p.ex. `20260604150000` si merge le 4 juin, sinon le jour réel. (Vérifier d'abord la colonne `learned_style` existante : `20260604140000_agent_learned_style_column.sql`.)

```sql
-- Apprentissage T2 : préférences/corrections récurrentes apprises par agent (jsonb), sur agent_ai_profiles.
-- Additif + idempotent. NULL = pas encore de corrections apprises (whatsapp-agent n'injecte rien de plus).
BEGIN;
ALTER TABLE public.agent_ai_profiles
  ADD COLUMN IF NOT EXISTS learned_corrections jsonb NULL;
COMMENT ON COLUMN public.agent_ai_profiles.learned_corrections IS
  'Apprentissage T2 : corrections/preferences recurrentes apprises { summary, status(suggested|active|off), updated_at, sample_count }. Injecte dans whatsapp-agent UNIQUEMENT si status=active (human-in-the-loop), APRES le bloc de style. Distille par learn-agent-style (DeepSeek) depuis les tours ou l agent corrige MEGGA ; jamais de PII, jamais une regle qui contourne une confirmation ou le cadre legal.';
COMMIT;
```

- [ ] **Step 2 : Commit**
```bash
git add supabase/migrations/*_agent_learned_corrections_column.sql
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "feat(learning): colonne agent_ai_profiles.learned_corrections (T2)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2 : `formatCorrectionsBlock` + type `LearnedCorrections` (TDD)

**Files:** Modify `supabase/functions/_shared/agent-style.ts` + `agent-style.test.ts`

- [ ] **Step 1 : Tests (échouent)** — AJOUTER au fichier existant `agent-style.test.ts`. D'abord, élargir l'import en tête : `import { formatStyleBlock, formatCorrectionsBlock, type LearnedStyle, type LearnedCorrections } from './agent-style'`. Puis ajouter ce bloc :
```ts
const baseCorr: LearnedCorrections = { summary: 'préfère les visites en fin de journée ; vouvoie les nouveaux contacts', status: 'active', updated_at: '2026-06-04T00:00:00Z', sample_count: 12 }

describe('formatCorrectionsBlock', () => {
  it('rend un bloc de préférences borné pour un profil actif', () => {
    const s = formatCorrectionsBlock(baseCorr)
    expect(s).toContain('Préférences récurrentes')
    expect(s).toContain('fin de journée')
    expect(s.length).toBeLessThanOrEqual(300)
  })
  it('renvoie chaîne vide si non actif, absent, ou summary vide', () => {
    expect(formatCorrectionsBlock({ ...baseCorr, status: 'suggested' })).toBe('')
    expect(formatCorrectionsBlock({ ...baseCorr, status: 'off' })).toBe('')
    expect(formatCorrectionsBlock({ ...baseCorr, summary: '   ' })).toBe('')
    expect(formatCorrectionsBlock(null)).toBe('')
    expect(formatCorrectionsBlock(undefined)).toBe('')
  })
  it('tronque un summary trop long (borne le prompt)', () => {
    expect(formatCorrectionsBlock({ ...baseCorr, summary: 'x'.repeat(500) }).length).toBeLessThanOrEqual(300)
  })
})
```

- [ ] **Step 2 : Run → FAIL.** `npx vitest run supabase/functions/_shared/agent-style.test.ts` (le fichier est déjà dans le glob `include`).

- [ ] **Step 3 : Implémenter** — AJOUTER à `agent-style.ts` (sans toucher `LearnedStyle`/`formatStyleBlock`) :
```ts
export type LearnedCorrections = {
  summary: string
  status: 'suggested' | 'active' | 'off'
  updated_at: string
  sample_count: number
}

/** Bloc de PRÉFÉRENCES injecté APRÈS le bloc de style. Vide si pas 'active'. Borné (~300 car.).
 *  JAMAIS une règle qui contourne une confirmation ou le socle légal — préférences d'organisation/com. seulement. */
export function formatCorrectionsBlock(lc: LearnedCorrections | null | undefined): string {
  if (!lc || lc.status !== 'active') return ''
  const summary = (lc.summary ?? '').slice(0, 220)
  if (!summary.trim()) return ''
  return `\n\nPréférences récurrentes de cet agent (ajuste tes propositions, jamais tes règles ni le socle légal) : ${summary}`.slice(0, 300)
}
```

- [ ] **Step 4 : Run → PASS.** `npx vitest run supabase/functions/_shared/agent-style.test.ts` (les 3 tests T1 + les 3 nouveaux passent). Puis `deno check supabase/functions/_shared/agent-style.ts`.

- [ ] **Step 5 : Commit**
```bash
git add supabase/functions/_shared/agent-style.ts supabase/functions/_shared/agent-style.test.ts
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "feat(learning): formatCorrectionsBlock + type LearnedCorrections (pur, TDD)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3 : RPC de rotation `get_agents_to_learn` (cron-only)

> Corrige la dette T1 (sélection `.limit(5)` sans rotation). Renvoie les N agents dont l'apprentissage est le plus ancien (rotation : chacun passe à son tour), avec leur état actuel (pour préserver le status humain sans re-query). **Cron-only** : REVOKE authenticated/anon, GRANT service_role. Pas de garde `is_super_admin` (ce n'est pas appelé par un humain) — la protection est l'absence de GRANT à `authenticated`.

**Files:** Create `supabase/migrations/<stamp>_get_agents_to_learn_rpc.sql`

- [ ] **Step 1 : Migration** (bare `CREATE OR REPLACE`, pas de BEGIN/COMMIT, comme les RPC T1). Stamp postérieur à la Task 1.
```sql
-- Apprentissage T2 : selection des agents a distiller, ordonnee par ANCIENNETE d'apprentissage
-- (rotation : chaque agent passe a son tour, ne starve jamais au-dela de BATCH). Cron-only :
-- appelee par learn-agent-style en service_role. NON exposee a authenticated/anon.
CREATE OR REPLACE FUNCTION public.get_agents_to_learn(p_batch int DEFAULT 5)
RETURNS TABLE (profile_id uuid, wa_number text, learned_style jsonb, learned_corrections jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT wal.profile_id, wal.wa_number, ap.learned_style, ap.learned_corrections
  FROM whatsapp_agent_links wal
  LEFT JOIN agent_ai_profiles ap ON ap.agent_id = wal.profile_id
  WHERE wal.verified = true AND wal.wa_number IS NOT NULL
  ORDER BY LEAST(
    COALESCE((ap.learned_style->>'updated_at')::timestamptz, 'epoch'::timestamptz),
    COALESCE((ap.learned_corrections->>'updated_at')::timestamptz, 'epoch'::timestamptz)
  ) ASC, wal.profile_id ASC
  LIMIT GREATEST(1, LEAST(p_batch, 50));
$$;
REVOKE ALL ON FUNCTION public.get_agents_to_learn(int) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_agents_to_learn(int) TO service_role;
COMMENT ON FUNCTION public.get_agents_to_learn(int) IS 'Apprentissage T2 — selection cron-only (service_role) des agents a distiller, ordonnee par apprentissage le plus ancien (rotation). Jamais exposee a authenticated/anon (renvoie wa_number + etat appris cross-agence).';
```
> Note : `'epoch'::timestamptz` met les agents jamais distillés (NULL) tout en haut (les plus anciens) → ils passent en premier. Le tie-break `wal.profile_id` rend l'ordre déterministe.

- [ ] **Step 2 : Commit**
```bash
git add supabase/migrations/*_get_agents_to_learn_rpc.sql
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "feat(learning): RPC get_agents_to_learn (rotation cron-only par ancienneté)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4 : Réécriture du worker `learn-agent-style` (rotation + fraîcheur + corrections)

> Le worker passe de « 5 premiers agents arbitraires, re-distillés chaque jour » à « les 5 agents les plus anciens (via RPC), seulement s'il y a du nouveau depuis le dernier apprentissage, + une 2ᵉ distillation pour les corrections ». **La distillation de style (prompt + échantillon entrants) reste identique** ; seuls la sélection et le garde de fraîcheur l'entourent.

**Files:** Modify `supabase/functions/learn-agent-style/index.ts` (réécriture complète du fichier)

- [ ] **Step 1 : Remplacer tout le contenu** par :
```ts
// supabase/functions/learn-agent-style/index.ts
// Cron quotidien : distille (a) le STYLE et (b) les CORRECTIONS récurrentes de chaque agent via DeepSeek,
// et écrit learned_style / learned_corrections dans agent_ai_profiles (status 'suggested' par défaut,
// préserve 'active'/'off' posé par l'humain). Appelé UNIQUEMENT par pg_cron en service-role (verify_jwt=false,
// garde app_config.service_role_key). Rotation par ancienneté (RPC get_agents_to_learn) + garde de fraîcheur
// (ne re-distille que s'il y a du nouveau depuis le dernier updated_at). PII interdite ; corrections =
// préférences d'organisation/communication seulement (jamais une règle contournant une confirmation/le légal).

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MIN_MSGS = 10            // signal minimum
const SAMPLE = 30             // style : derniers messages entrants
const THREAD = 40             // corrections : derniers tours (2 sens)
const BATCH = 5               // agents par tick (coût borné)
const DEEPSEEK_TIMEOUT_MS = 20_000

type Envelope = { status?: string; updated_at?: string } | null

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0
}
const json = (o: unknown, c: number) => new Response(JSON.stringify(o), { status: c, headers: { 'Content-Type': 'application/json' } })

async function distill(apiKey: string, prompt: string): Promise<Record<string, unknown> | null> {
  try {
    const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }], temperature: 0, max_tokens: 300, response_format: { type: 'json_object' } }),
      signal: AbortSignal.timeout(DEEPSEEK_TIMEOUT_MS),
    })
    if (!r.ok) { console.error('deepseek http', r.status); return null }
    const d = await r.json()
    return JSON.parse(d?.choices?.[0]?.message?.content ?? 'null')
  } catch (e) { console.error('distill failed:', (e as Error)?.name ?? 'error'); return null }
}

serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  // Garde : appelé par pg_cron avec Bearer = app_config.service_role_key (comme whatsapp-agent-async).
  const { data: cfg } = await admin.from('app_config').select('value').eq('key', 'service_role_key').maybeSingle()
  const expected = (cfg?.value as string) ?? ''
  const provided = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!expected || !safeEqual(provided, expected)) return json({ error: 'Forbidden' }, 403)

  const apiKey = Deno.env.get('DEEPSEEK_API_KEY')
  if (!apiKey) return json({ error: 'no deepseek key' }, 200)

  // Rotation : les agents dont l'apprentissage est le plus ancien d'abord (RPC cron-only).
  const { data: agents } = await admin.rpc('get_agents_to_learn', { p_batch: BATCH })
  let styled = 0, corrected = 0
  for (const a of (agents ?? []) as Array<{ profile_id: string; wa_number: string; learned_style: Envelope; learned_corrections: Envelope }>) {
    const waNumber = (a.wa_number ?? '').replace(/\D/g, '')   // chiffres only (déjà garanti par la vérif) — sûr pour le filtre .or()
    if (!waNumber) continue
    const lastLearn = Math.max(
      a.learned_style?.updated_at ? Date.parse(a.learned_style.updated_at) : 0,
      a.learned_corrections?.updated_at ? Date.parse(a.learned_corrections.updated_at) : 0,
    )

    // --- STYLE : messages entrants récents (logique T1, inchangée) ---
    const { data: inbound } = await admin.from('whatsapp_messages')
      .select('body, created_at').eq('wa_from', waNumber).eq('direction', 'inbound')
      .not('body', 'is', null).order('created_at', { ascending: false }).limit(SAMPLE)
    const inRows = (inbound ?? []) as Array<{ body: string; created_at: string }>
    const freshInbound = inRows.length > 0 && Date.parse(inRows[0].created_at) > lastLearn
    const texts = inRows.map((m) => m.body).filter((b) => b && b.trim().length > 1)
    if (texts.length >= MIN_MSGS && (lastLearn === 0 || freshInbound)) {
      const prompt = `Voici des messages écrits par un agent immobilier à son assistante. Résume SON style de communication. Réponds UNIQUEMENT en JSON strict: {"language":"fr|en|mixed","formality":"tu|vous|direct","emoji":true|false,"traits":"1-2 phrases sur ses tournures/préférences"}. RÈGLE ABSOLUE: décris le STYLE seulement — AUCUN nom, adresse, montant, ni donnée de contact. Messages:\n${texts.slice(0, SAMPLE).map((t) => `- ${t.slice(0, 200)}`).join('\n')}`
      const s = (await distill(apiKey, prompt)) as { language?: string; formality?: string; emoji?: boolean; traits?: string } | null
      if (s && ['fr', 'en', 'mixed'].includes(s.language ?? '')) {
        const prev = a.learned_style?.status
        const status = prev === 'active' || prev === 'off' ? prev : 'suggested'
        await admin.from('agent_ai_profiles').upsert({ agent_id: a.profile_id, learned_style: {
          language: s.language, formality: ['tu', 'vous', 'direct'].includes(s.formality ?? '') ? s.formality : 'tu',
          emoji: !!s.emoji, traits: (s.traits ?? '').slice(0, 240), status, updated_at: new Date().toISOString(), sample_count: texts.length,
        } }, { onConflict: 'agent_id' })
        styled++
      }
    }

    // --- CORRECTIONS : derniers tours (2 sens), extraire les corrections RÉCURRENTES ---
    const { data: thread } = await admin.from('whatsapp_messages')
      .select('body, direction, created_at, is_agent_error')
      .or(`and(wa_from.eq.${waNumber},direction.eq.inbound),and(wa_to.eq.${waNumber},direction.eq.outbound)`)
      .not('body', 'is', null).order('created_at', { ascending: false }).limit(THREAD)
    const thRows = (thread ?? []) as Array<{ body: string; direction: string; created_at: string; is_agent_error: boolean }>
    const freshThread = thRows.length > 0 && Date.parse(thRows[0].created_at) > lastLearn
    const turns = thRows
      .filter((m) => !(m.direction === 'outbound' && m.is_agent_error))   // exclut les réponses MEGGA en échec
      .reverse()                                                           // ordre chronologique
      .map((m) => `${m.direction === 'inbound' ? 'Agent' : 'MEGGA'}: ${m.body.slice(0, 160)}`)
    if (turns.length >= MIN_MSGS && (lastLearn === 0 || freshThread)) {
      const prompt = `Voici un fil entre une assistante (MEGGA) et un agent immobilier. Identifie les CORRECTIONS RÉCURRENTES que l'agent apporte aux propositions de l'assistante (ex: « non, plutôt mercredi », « pas ce contact », « en fait l'autre »). Résume-les en PRÉFÉRENCES durables d'organisation/communication. Réponds UNIQUEMENT en JSON strict: {"has_corrections":true|false,"summary":"1-3 préférences récurrentes, courtes"}. RÈGLES ABSOLUES: (1) préférences d'organisation/communication SEULEMENT — JAMAIS une règle qui contourne une confirmation, une validation humaine ou le cadre légal. (2) AUCUN nom, adresse, montant, ni donnée de contact. (3) si aucune correction récurrente claire: has_corrections=false. Fil:\n${turns.join('\n')}`
      const c = (await distill(apiKey, prompt)) as { has_corrections?: boolean; summary?: string } | null
      const summary = (c?.summary ?? '').trim()
      if (c?.has_corrections === true && summary) {
        const prev = a.learned_corrections?.status
        const status = prev === 'active' || prev === 'off' ? prev : 'suggested'
        await admin.from('agent_ai_profiles').upsert({ agent_id: a.profile_id, learned_corrections: {
          summary: summary.slice(0, 240), status, updated_at: new Date().toISOString(), sample_count: turns.length,
        } }, { onConflict: 'agent_id' })
        corrected++
      }
    }
  }
  return json({ ok: true, styled, corrected }, 200)
})
```
> Notes de revue : (1) `waNumber` est ré-assaini `\D`→'' avant le filtre `.or()` (défense en profondeur, déjà chiffres-only en base). (2) Les deux `upsert` ne posent chacun QUE leur colonne → l'un n'écrase pas l'autre (PostgREST n'update que les colonnes fournies on-conflict). (3) Best-effort conservé : `distill` renvoie `null` sur toute erreur → on skip sans écrire. (4) Fraîcheur : `lastLearn === 0` (jamais appris) force la 1ʳᵉ distillation ; sinon on exige un message plus récent que `lastLearn`.

- [ ] **Step 2 : Vérifier** `deno check supabase/functions/learn-agent-style/index.ts` → 0 erreur. Relire : style inchangé en logique ; corrections best-effort ; pas de PII ; pas de nouveau cron (le job `learn-agent-style-daily` existant déclenche tout).

- [ ] **Step 3 : Commit**
```bash
git add supabase/functions/learn-agent-style/index.ts
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "feat(learning): worker — rotation par ancienneté + fraîcheur + distillation des corrections

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5 : Injection du bloc corrections dans `whatsapp-agent`

**Files:** Modify `supabase/functions/whatsapp-agent/index.ts`

- [ ] **Step 1 : Élargir l'import** (l. 24 actuelle) :
```ts
import { formatStyleBlock, formatCorrectionsBlock, type LearnedStyle, type LearnedCorrections } from '../_shared/agent-style.ts'
```

- [ ] **Step 2 : Fetch + format** — le bloc T1 (≈ l.87-90) sélectionne `learned_style`. Le remplacer par :
```ts
  // Apprentissage : style (T1) + préférences/corrections (T2), injectés SEULEMENT si activés (human-in-the-loop).
  const { data: prof } = await supabase.from('agent_ai_profiles')
    .select('learned_style, learned_corrections').eq('agent_id', profileId).maybeSingle()
  const styleBlock = formatStyleBlock((prof?.learned_style as LearnedStyle | null) ?? null)
  const correctionsBlock = formatCorrectionsBlock((prof?.learned_corrections as LearnedCorrections | null) ?? null)
```

- [ ] **Step 3 : Append au message système** — l. 117 actuelle se termine par `...Ne mélange pas les langues.${styleBlock}`. Ajouter `${correctionsBlock}` juste après `${styleBlock}` (donc avant le backtick fermant) :
```ts
    { role: 'system', content: `${SYSTEM}\n\nDate/heure actuelles (Europe/Zurich) : ${nowZurich}. Convertis toute date relative en ISO 8601 avec le décalage de Genève (+02:00 en été, +01:00 en hiver).\n\nLangue : réponds TOUJOURS dans la langue du dernier message de l'agent (français ou anglais). Ne mélange pas les langues.${styleBlock}${correctionsBlock}` },
```
> Ordre : SYSTEM figé → date → langue → style → préférences. `correctionsBlock` est `''` si pas `active` → comportement strictement inchangé. Il commence par `\n\n` quand non vide.

- [ ] **Step 4 : Vérifier** `deno check supabase/functions/whatsapp-agent/index.ts` → 0 erreur. Confirmer : sans corrections actives, le prompt est byte-identique à la T1 ; le bloc préférences est TOUJOURS après le style, jamais avant le SYSTEM.

- [ ] **Step 5 : Commit**
```bash
git add supabase/functions/whatsapp-agent/index.ts
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "feat(learning): whatsapp-agent injecte les préférences apprises actives (après le style)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6 : RPC `get/set_agent_learned_correction` (gardées `is_super_admin`)

> Miroir EXACT des RPC T1 (`get_agent_learned_styles`/`set_agent_learned_style`, cf. `20260604140200_agent_learning_rpcs.sql`) : plpgsql, gate `is_super_admin()` en 1ʳᵉ instruction (42501), validation status (22023), REVOKE public/anon + GRANT authenticated, COMMENT.

**Files:** Create `supabase/migrations/<stamp>_agent_corrections_rpcs.sql`

- [ ] **Step 1 : Migration** (stamp postérieur aux Tasks 1 & 3)
```sql
-- Apprentissage T2 : RPC super-admin pour lire et activer les corrections/preferences apprises.
-- Gardees is_super_admin() cote SERVEUR (42501) — donnees par-agent CROSS-AGENCE ; l'activation
-- injecte les preferences dans le prompt WhatsApp de l'agent cible. Miroir exact des RPC T1.
CREATE OR REPLACE FUNCTION public.get_agent_learned_corrections()
RETURNS TABLE (agent_id uuid, agent_name text, agency_id uuid, learned_corrections jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden: super_admin only' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT p.id, p.full_name, p.agency_id, ap.learned_corrections
    FROM agent_ai_profiles ap JOIN profiles p ON p.id = ap.agent_id
    WHERE ap.learned_corrections IS NOT NULL
    ORDER BY p.full_name;
END;
$$;
REVOKE ALL ON FUNCTION public.get_agent_learned_corrections() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_agent_learned_corrections() TO authenticated;
COMMENT ON FUNCTION public.get_agent_learned_corrections() IS 'Apprentissage T2 — liste les corrections/preferences apprises (learned_corrections IS NOT NULL) pour le super-admin. Garde serveur is_super_admin() (42501). Donnees CROSS-AGENCE.';

CREATE OR REPLACE FUNCTION public.set_agent_learned_correction(p_agent_id uuid, p_status text, p_summary text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'forbidden: super_admin only' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('suggested', 'active', 'off') THEN
    RAISE EXCEPTION 'bad status' USING ERRCODE = '22023';
  END IF;
  UPDATE agent_ai_profiles
    SET learned_corrections = jsonb_set(
      jsonb_set(COALESCE(learned_corrections, '{}'::jsonb), '{status}', to_jsonb(p_status)),
      '{summary}', to_jsonb(COALESCE(p_summary, learned_corrections->>'summary', ''))
    )
    WHERE agent_id = p_agent_id AND learned_corrections IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.set_agent_learned_correction(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_agent_learned_correction(uuid, text, text) TO authenticated;
COMMENT ON FUNCTION public.set_agent_learned_correction(uuid, text, text) IS 'Apprentissage T2 — le super-admin active/suspend/edite les preferences apprises. UPDATE conditionne a learned_corrections IS NOT NULL. Garde serveur is_super_admin() (42501).';
```

- [ ] **Step 2 : Commit**
```bash
git add supabase/migrations/*_agent_corrections_rpcs.sql
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "feat(learning): RPC get/set agent learned corrections (gardées is_super_admin)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7 : UI super-admin — section « Préférences apprises »

> Étendre la page `/dashboard/admin/learning` existante (pas de nouvelle page) : sous la section Styles, une section Préférences avec la même liste/toggle/édition. Réutiliser le pattern de `AdminLearningPage`/`useAdminLearning`.

**Files:** Modify `src/hooks/useAdminLearning.ts`, `src/pages/admin/AdminLearningPage.tsx`, les 4 `admin.json`

- [ ] **Step 1 : Hook** — AJOUTER à `src/hooks/useAdminLearning.ts` (sans toucher l'existant) :
```tsx
export interface LearnedCorrectionRow {
  agent_id: string
  agent_name: string | null
  agency_id: string | null
  learned_corrections: { summary: string; status: string; updated_at: string; sample_count: number } | null
}

export function useAdminCorrections() {
  return useQuery({
    queryKey: ['admin', 'learned-corrections'],
    queryFn: async (): Promise<LearnedCorrectionRow[]> => {
      const { data, error } = await (supabase.rpc as unknown as
        (fn: string) => Promise<{ data: unknown; error: Error | null }>)('get_agent_learned_corrections')
      if (error) throw error
      return (data ?? []) as LearnedCorrectionRow[]
    },
    staleTime: 60_000,
  })
}

export function useSetLearnedCorrection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { agent_id: string; status: string; summary?: string }) => {
      const { error } = await (supabase.rpc as unknown as
        (fn: string, args: unknown) => Promise<{ error: Error | null }>)('set_agent_learned_correction', {
          p_agent_id: v.agent_id, p_status: v.status, p_summary: v.summary ?? null,
        })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'learned-corrections'] }) },
  })
}
```

- [ ] **Step 2 : Page** — dans `src/pages/admin/AdminLearningPage.tsx`, importer `useAdminCorrections`, `useSetLearnedCorrection`, `type LearnedCorrectionRow` ; ajouter SOUS la section styles existante une 2ᵉ section « Préférences apprises » qui mappe `useAdminCorrections()` en réutilisant exactement la structure d'une ligne du tableau styles (nom agent, `summary`, `status`, bouton Activer/Désactiver câblé sur `useSetLearnedCorrection`, édition inline du `summary` via le même pattern Modifier→input→Enregistrer/Annuler que les traits). États loading/empty/error miroir (bannière rouge `border-red-500/30 bg-red-500/5 text-red-400`). `useTranslation('admin')`, clés `learning.corrections.*`. Tokens thème, pas de `bg-white`/`text-gray-*`/shadow, capitalize. Lecture seule par défaut ; activation/édition = clic humain explicite.

- [ ] **Step 3 : i18n** — ajouter aux 4 `src/i18n/locales/{fr,de,en,it}/admin.json` (format PLAT dot-notation, comme `autonomy.*`/`learning.*`) les clés : `learning.corrections.title`, `learning.corrections.subtitle`, `learning.corrections.observeNote`, `learning.corrections.empty`, `learning.corrections.error`, `learning.corrections.col.agent`, `learning.corrections.col.summary`, `learning.corrections.col.status`, `learning.corrections.col.action`, `learning.corrections.activate`, `learning.corrections.deactivate`, `learning.corrections.edit`, `learning.corrections.save`, `learning.corrections.cancel`, `learning.corrections.placeholder`. FR + EN rédigés naturellement, DE + IT traduits fidèlement. Vérifier que chaque JSON parse (`node -e "require('./src/i18n/locales/fr/admin.json')"` × 4).

- [ ] **Step 4 : Vérifier** `npm run build` → vert (tsc + vite ; lancer le vrai build, pas seulement `tsc --noEmit`).

- [ ] **Step 5 : Commit**
```bash
git add src/hooks/useAdminLearning.ts src/pages/admin/AdminLearningPage.tsx src/i18n/locales/*/admin.json
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "feat(admin): section « Préférences apprises » sur /dashboard/admin/learning

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8 : Spec live + build + cerveau + PR

**Files:** Create `tests/backend/whatsapp-learning-corrections.spec.ts`

- [ ] **Step 1 : Spec live** — mirror `tests/backend/whatsapp-learning-style.spec.ts` (helper `setupTwoAgencies()`, `serviceRoleClient()`, promotion agentA en `super_admin`, `describe.skipIf(!HAS_KEYS)`, cleanup `.then(() => {}, () => {})`). Couvrir :
  1. **RPC corrections gardée** : seed `agent_ai_profiles.learned_corrections` (status 'suggested') pour agentB via `serviceRoleClient()` ; `clientA` (super_admin) → `get_agent_learned_corrections()` renvoie la ligne d'agentB ; `clientB` (agent) → erreur (gate 42501).
  2. **Activation** : `clientA` → `set_agent_learned_correction(agentB, 'active')` → la ligne passe `status='active'` (re-lecture via `serviceRoleClient()`) ; `clientB` → rejet ; après le rejet, la ligne est inchangée.
  3. **Rotation cron-only `get_agents_to_learn`** : `clientB`/`clientA` (authenticated) appelant `get_agents_to_learn` → erreur (EXECUTE non accordé à authenticated — message « permission denied » ; asserter `error` non-null, sans dépendre du code exact). Via `serviceRoleClient()` → renvoie des lignes, et un agent jamais distillé (learned_style/corrections NULL) apparaît avant un agent récemment distillé (asserter l'ordre : seed agentB avec `learned_style.updated_at` récent, laisser agentA NULL, vérifier qu'agentA précède agentB dans le retour, ou au minimum qu'agentA est présent avant agentB).
  4. **Injection conditionnelle** (pur) : déjà couverte par les tests unit de `formatCorrectionsBlock` (Task 2) — citer en commentaire, ne pas dupliquer.
  Nettoyage `afterAll` : remettre `learned_corrections`/`learned_style` à NULL pour agentA/B (ou supprimer la row), démote agentA, le tout en `.then(() => {}, () => {})`, puis `setup.cleanup()`.

- [ ] **Step 2 : Lancer** `npm run build && npx vitest run` (build vert, unit verts dont les 6 de `agent-style`). `npx vitest run --config=vitest.backend.config.ts tests/backend/whatsapp-learning-corrections.spec.ts` → collecte propre (skip local sans clés ; tourne live en CI).

- [ ] **Step 3 : Cerveau** :
- `megga/megga-ai-agent-learning` : la couche d'apprentissage avance — **Tranche 2 « corrections/préférences » LIVRÉE** (même pipeline : `learned_corrections` ; distillation des tours où l'agent corrige MEGGA → préférences durables ; injection conditionnelle `status='active'` APRÈS le style ; RPC get/set gardées ; section sur /dashboard/admin/learning). Le cron tourne désormais en **rotation par ancienneté** (`get_agents_to_learn`) + garde de fraîcheur (dette T1 corrigée).
- `megga/whatsapp-copilot-lessons` : leçon « Apprentissage T2 : corrections distillées depuis le fil (2 sens, tours « non plutôt… »), stockées en préférences bornées ; bloc injecté APRÈS le style (jamais une règle de contournement — préférence d'organisation/com. seulement) ; worker passé en rotation (RPC get_agents_to_learn cron-only, REVOKE authenticated/GRANT service_role) + fraîcheur (skip si rien de nouveau depuis updated_at) ».
- `megga/whatsapp-data` (si présent) : noter la colonne `agent_ai_profiles.learned_corrections` + la RPC `get_agents_to_learn`.
Puis `npm run ruflo:seed` ; valider le JSON (`node -e "require('./.claude-flow/knowledge/megga-memory.seed.json')"`).

- [ ] **Step 4 : Commit + PR**
```bash
git add tests/backend/whatsapp-learning-corrections.spec.ts .claude-flow/knowledge/megga-memory.seed.json
git -c user.name="MEGGA" -c user.email="megga@megga.ch" commit -m "test(learning): spec corrections gardées + rotation ; cerveau apprentissage T2

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```
Ouvrir la PR vers `main`. **Dater les migrations du jour de merge** (sinon date-gate). NE PAS merger sans accord humain (CI verte d'abord). Le contrôleur ouvre la PR et confirme quand c'est vert.

---

## Self-Review (vérifié contre la spec/les contraintes)

- ✅ Même pipeline réutilisé : capture (tours) → distille (DeepSeek, Task 4) → stocke (`learned_corrections`, Task 1) → revue (RPC Task 6 + page Task 7) → injecte (Task 5).
- ✅ Human-in-the-loop : injection SEULEMENT si `status='active'` (Task 5 + `formatCorrectionsBlock` Task 2) ; le worker pose `suggested` et préserve `active`/`off` (Task 4).
- ✅ Additif/tonal/non-contournant : `formatCorrectionsBlock` ≤300 car., appended APRÈS le style, prompt + bloc interdisent toute règle de contournement (Tasks 2/4/5).
- ✅ DeepSeek-only (Task 4) ; pas de PII (prompt + `summary` borné).
- ✅ RPC corrections gardées `is_super_admin` côté serveur (Task 6) ; RPC rotation cron-only (Task 3) ; testées live (Task 8).
- ✅ Dette T1 corrigée : rotation par ancienneté + garde de fraîcheur (Tasks 3/4) — plus de starvation au-delà de BATCH, plus de re-distillation quotidienne à vide.
- ✅ Pas de régression style : logique de distillation du style inchangée (Task 4) ; sans corrections actives, prompt whatsapp-agent byte-identique (Task 5).
- ✅ Migrations additives/idempotentes (`ADD COLUMN IF NOT EXISTS`, `CREATE OR REPLACE`) ; datées du jour de merge.
- ✅ Léger : réutilise la T1 (1 colonne de plus, MÊME worker/cron, MÊME page étendue, MÊMES patterns RPC). Pas de nouveau cron, pas de nouvelle page.
- ✅ i18n 4 langues (Task 7). `npm run build` vert avant push (Tasks 7/8). Specs live (Task 8).

**Cohérence des noms :** `learned_corrections` (colonne) ↔ `LearnedCorrections` (type) ↔ `formatCorrectionsBlock` ↔ `get_agents_to_learn` (rotation) ↔ `get_agent_learned_corrections`/`set_agent_learned_correction` (RPC) ↔ `useAdminCorrections`/`useSetLearnedCorrection` ↔ clés i18n `learning.corrections.*`.

---

## Exécution

Session FRAÎCHE, **subagent-driven** : un sous-agent par tâche + revue conformité-puis-qualité (comme T1). Consulter le cerveau au début de chaque tâche. **Dater les migrations du jour de merge.** Mettre le cerveau à jour à la Task 8. i18n 4 langues synchronisées. Attention particulière (revue) : (1) non-régression de la distillation de style, (2) la RPC de rotation est bien cron-only (authenticated rejeté), (3) la « préférence » apprise ne peut pas encoder un contournement de confirmation/légal.
