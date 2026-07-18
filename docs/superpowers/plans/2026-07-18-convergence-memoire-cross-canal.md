# Convergence mémoire cross-canal WhatsApp ⇄ MEGGA AI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** un agent qui travaille un dossier contact dans le CRM (MEGGA AI) puis reprend sur WhatsApp une heure après (ou l'inverse) retrouve MEGGA **au courant** — même contact, même mémoire.

**Architecture:** deux mécanismes complémentaires, tous deux ancrés sur des tables existantes. (1) **« Contact chaud »** : 2 colonnes sur `agent_ai_profiles` (déjà lue à CHAQUE tour par les deux canaux → zéro lecture réseau ajoutée) posées fire-and-forget quand un exécuteur résout un contact ; au tour suivant (<6 h), un bloc mémoire compact (insight WhatsApp + résumé CRM) est injecté dans le suffixe dynamique du system prompt des deux canaux. (2) **Write-back CRM** : 2 colonnes `crm_summary`/`crm_summary_updated_at` sur `whatsapp_conversation_insights` (le dossier par-contact existant), écrites post-tour par un distillateur DeepSeek fire-and-forget côté copilote, lues par `get_contact_brief`/`prepare_meeting` (déjà partagés par les deux canaux). Le chantier « noyau commun » (fusion des boucles/personas — Chantier B de l'éval) est **hors périmètre** : plan séparé.

**Tech Stack:** Supabase (Postgres + Edge Functions Deno), DeepSeek `deepseek-chat` (json_object), Vitest (unit purs + backend live), pattern maison : flags `app_config` OFF par défaut, scoping `agency_id` explicite, `redactPII` avant tout prompt, préfixe stable pour le cache DeepSeek.

---

## Contexte vérifié (17-18 juil. 2026 — ne pas re-vérifier, déjà fait)

- **Déjà fait depuis l'éval du 10 juil.** : É0 (`copilot_tools_enabled=true` live) ; A1 (`rolling_summary` exposé dans `get_contact_brief` + `prepare_meeting`) ; P0 PII WhatsApp (redaction live `redactLlmMessages`, PR #838) ; NBA cerveau partagé (`contact_next_action`, cross-canal, PR #834).
- `agent_ai_profiles` : clé `agent_id` NOT NULL, `agency_id` nullable, lue par `whatsapp-agent/index.ts:106` et `ai-copilot/index.ts:649` à chaque tour.
- `whatsapp_conversation_insights` : clé UNIQUE `contact_id` + `agency_id` NOT NULL ; **tous les NOT NULL ont un default** (`entities '{}'`, `commitments/objections '[]'`, `source_message_count 0`, `generated_at now()`) → un INSERT partiel (contact_id, agency_id, crm_*) est valide. L'upsert PostgREST n'UPDATE que les colonnes fournies → le cron `whatsapp-process` (qui ne fournit pas `crm_*`) et le write-back CRM (qui ne fournit pas les colonnes WhatsApp) **ne peuvent pas s'écraser mutuellement**.
- `EdgeRuntime.waitUntil` : précédent maison dans `flatfox-sync/index.ts:759-761` (guard `typeof` + `@ts-expect-error`).
- Migrations : timestamps 14 chiffres `YYYYMMDDHHMMSS` (collision CI sinon).
- Cache DeepSeek : tout contenu volatil va dans le SUFFIXE du system prompt (après le préfixe stable), comme l'horodatage — jamais dans le préfixe.
- Volume prod : pré-pilote (34 messages WhatsApp/30 j). Tout est gated OFF par défaut ; l'activation est une décision produit.

## File Structure

- Create: `supabase/migrations/20260718100000_contact_memory_crossband.sql` — colonnes hot-contact + crm_summary + index.
- Create: `supabase/functions/_shared/contact-memory.ts` — le module de convergence : helpers PURS (format bloc, fraîcheur TTL, clamp, messages du distillateur) + I/O (touch, fetch bloc, upsert crm, distill).
- Create: `supabase/functions/_shared/contact-memory.test.ts` — unit purs (vitest).
- Modify: `supabase/functions/_shared/whatsapp-actions.ts` — touch dans `contactInAgency` + `execGetContactBrief` ; exposer `crm_summary` dans brief + meeting.
- Modify: `supabase/functions/whatsapp-agent/index.ts` — étendre le SELECT profil + injecter le bloc mémoire dans le suffixe system.
- Modify: `supabase/functions/ai-copilot/index.ts` — idem injection ; + distillateur post-tour gated + flag.
- Create: `tests/backend/contact-memory-crossband.spec.ts` — spec live (touch, upsert non-destructif, isolation agence, brief).

Aucun changement frontend (le pont passe par les exécuteurs partagés).

---

### Task 1 : Migration — colonnes contact chaud + mémoire CRM

**Files:**
- Create: `supabase/migrations/20260718100000_contact_memory_crossband.sql`

- [ ] **Step 1 : écrire la migration**

```sql
-- Convergence mémoire cross-canal WhatsApp ⇄ MEGGA AI (chantier A2+A3 de l'éval 10 juil.).
--
-- (1) « Contact chaud » par agent : posé fire-and-forget quand un exécuteur (partagé
--     par les DEUX canaux) résout un contact ; relu au tour suivant par whatsapp-agent
--     ET ai-copilot (agent_ai_profiles est déjà fetchée à chaque tour → 0 lecture ajoutée).
--     FK ON DELETE SET NULL : un contact supprimé (delete_contact) ne laisse pas de
--     pointeur pendouillant.
-- (2) Mémoire CRM par contact : le copilote distille ses tours « contact » dans le
--     dossier par-contact EXISTANT (whatsapp_conversation_insights, clé contact_id
--     UNIQUE). Colonnes ADDITIVES : le cron whatsapp-process et le write-back CRM ne
--     fournissent jamais les colonnes de l'autre → aucun écrasement croisé possible
--     (upsert PostgREST n'UPDATE que les colonnes fournies).
BEGIN;

ALTER TABLE agent_ai_profiles
  ADD COLUMN IF NOT EXISTS hot_contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hot_contact_at timestamptz;

ALTER TABLE whatsapp_conversation_insights
  ADD COLUMN IF NOT EXISTS crm_summary text,
  ADD COLUMN IF NOT EXISTS crm_summary_updated_at timestamptz;

-- Garde-fou taille (même discipline que rolling_summary : borné côté code à 800c,
-- le CHECK est le filet si un appelant contourne le clamp).
ALTER TABLE whatsapp_conversation_insights
  ADD CONSTRAINT wci_crm_summary_len CHECK (crm_summary IS NULL OR char_length(crm_summary) <= 1200);

COMMIT;
```

- [ ] **Step 2 : appliquer sur le projet** (`apply_migration` MCP, name `contact_memory_crossband`) et vérifier :

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name IN ('agent_ai_profiles','whatsapp_conversation_insights')
  AND column_name IN ('hot_contact_id','hot_contact_at','crm_summary','crm_summary_updated_at');
-- attendu : 4 lignes
```

- [ ] **Step 3 : commit**

```bash
git add supabase/migrations/20260718100000_contact_memory_crossband.sql
git commit -m "feat(ai): colonnes mémoire cross-canal (contact chaud + crm_summary)"
```

---

### Task 2 : Module partagé `contact-memory.ts` — helpers purs (TDD)

**Files:**
- Create: `supabase/functions/_shared/contact-memory.ts`
- Test: `supabase/functions/_shared/contact-memory.test.ts`

- [ ] **Step 1 : écrire les tests unitaires (échouent — le module n'existe pas)**

```ts
import { describe, it, expect } from 'vitest'
import {
  isHotContactFresh, clampSummary, formatHotContactBlock, buildDistillMessages,
  HOT_CONTACT_TTL_MS, CRM_SUMMARY_MAX,
} from './contact-memory'

describe('isHotContactFresh', () => {
  const now = Date.parse('2026-07-18T10:00:00Z')
  it('frais si < TTL (6h), périmé sinon, faux si null/invalide', () => {
    expect(isHotContactFresh('2026-07-18T09:00:00Z', now)).toBe(true)
    expect(isHotContactFresh(new Date(now - HOT_CONTACT_TTL_MS - 1).toISOString(), now)).toBe(false)
    expect(isHotContactFresh(null, now)).toBe(false)
    expect(isHotContactFresh('pas-une-date', now)).toBe(false)
  })
})

describe('clampSummary', () => {
  it('borne à CRM_SUMMARY_MAX (800), trim, null-safe', () => {
    expect(clampSummary('  x  ')).toBe('x')
    expect(clampSummary('a'.repeat(2000)).length).toBe(CRM_SUMMARY_MAX)
    expect(clampSummary(null)).toBe('')
  })
})

describe('formatHotContactBlock', () => {
  it("vide si pas de nom ou aucune mémoire ; sinon bloc borné, libellé anti-fab, FR/EN", () => {
    expect(formatHotContactBlock({ name: '', rollingSummary: 'x', crmSummary: null }, 'fr')).toBe('')
    expect(formatHotContactBlock({ name: 'Jean', rollingSummary: null, crmSummary: null }, 'fr')).toBe('')
    const fr = formatHotContactBlock(
      { name: 'Jean Dubois', rollingSummary: 'cherche 4p à Carouge', crmSummary: 'offre discutée à 950k' }, 'fr')
    expect(fr).toContain('Jean Dubois')
    expect(fr).toContain('cherche 4p à Carouge')
    expect(fr).toContain('offre discutée à 950k')
    expect(fr).toMatch(/mémoire interne/i)          // cadrage anti-fabrication
    expect(fr.length).toBeLessThanOrEqual(900)      // bloc borné (700c contenu + entête)
    const en = formatHotContactBlock({ name: 'Jean', rollingSummary: 's', crmSummary: null }, 'en')
    expect(en).toMatch(/internal memory/i)
  })
})

describe('buildDistillMessages', () => {
  it('inclut prior + échange, exige json_object {resume}, borne les entrées', () => {
    const msgs = buildDistillMessages({
      prior: 'ancien résumé', userMessage: 'u'.repeat(5000), assistantText: 'a'.repeat(5000), lang: 'fr',
    })
    expect(msgs[0].role).toBe('system')
    expect(String(msgs[0].content)).toMatch(/json/i)
    const user = String(msgs[1].content)
    expect(user).toContain('ancien résumé')
    expect(user.length).toBeLessThan(6000)          // entrées tronquées (2000c par côté)
  })
})
```

- [ ] **Step 2 : vérifier l'échec** — `npx vitest run supabase/functions/_shared/contact-memory.test.ts` → FAIL (module introuvable).

- [ ] **Step 3 : implémenter le module**

```ts
// supabase/functions/_shared/contact-memory.ts
// Convergence mémoire cross-canal WhatsApp ⇄ MEGGA AI (chantier A). Deux briques :
//   1. « Contact chaud » (agent_ai_profiles.hot_contact_*) : le dernier contact
//      RÉSOLU par un exécuteur, tous canaux confondus → au tour suivant (<6h),
//      les deux agents s'ouvrent avec sa mémoire (continuité « je reprends 1h après »).
//   2. Mémoire CRM (whatsapp_conversation_insights.crm_summary) : distillat des
//      tours copilote sur un contact, à côté du rolling_summary WhatsApp du cron.
// Helpers PURS d'abord (testables vitest, zéro Deno), I/O ensuite.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { redactPII } from './pii-redaction.ts'
import { logDeepSeekUsageWith } from './ai-usage.ts'

export const HOT_CONTACT_TTL_MS = 6 * 60 * 60 * 1000  // continuité intra-journée
export const CRM_SUMMARY_MAX = 800                     // même borne que rolling_summary
const DISTILL_INPUT_MAX = 2000                         // par côté (user / assistant)
const BLOCK_MAX = 700                                  // contenu du bloc injecté

export function isHotContactFresh(at: string | null | undefined, nowMs = Date.now()): boolean {
  if (!at) return false
  const t = Date.parse(at)
  return Number.isFinite(t) && nowMs - t < HOT_CONTACT_TTL_MS
}

export function clampSummary(s: string | null | undefined): string {
  return (s ?? '').trim().slice(0, CRM_SUMMARY_MAX)
}

/** Bloc mémoire injecté dans le SUFFIXE system (zone volatile, après le préfixe stable
 *  — discipline cache DeepSeek). Cadré « mémoire interne à vérifier » : jamais une
 *  source d'affirmation d'action (anti-fabrication). Vide si rien à dire. */
export function formatHotContactBlock(
  m: { name: string; rollingSummary: string | null; crmSummary: string | null },
  lang: 'fr' | 'en',
): string {
  const name = (m.name ?? '').trim()
  const wa = (m.rollingSummary ?? '').trim()
  const crm = (m.crmSummary ?? '').trim()
  if (!name || (!wa && !crm)) return ''
  const parts: string[] = []
  if (wa) parts.push(lang === 'en' ? `WhatsApp thread: ${wa}` : `Fil WhatsApp : ${wa}`)
  if (crm) parts.push(lang === 'en' ? `CRM work: ${crm}` : `Travail CRM : ${crm}`)
  const body = parts.join(' · ').slice(0, BLOCK_MAX)
  return lang === 'en'
    ? `\n\nRecently worked contact (internal memory, cross-channel — treat as context to VERIFY via tools, never as proof an action happened): ${name}. ${body}`
    : `\n\nContact travaillé récemment (mémoire interne, cross-canal — contexte à VÉRIFIER via les outils, jamais une preuve qu'une action a eu lieu) : ${name}. ${body}`
}

/** Messages du distillateur (PUR) : fusionne l'ancien résumé + l'échange du tour en un
 *  résumé factuel ≤800c. Entrées tronquées (coût borné) ; sortie json_object {resume}. */
export function buildDistillMessages(p: {
  prior: string | null; userMessage: string; assistantText: string; lang: 'fr' | 'en'
}): Array<{ role: 'system' | 'user'; content: string }> {
  const sys = p.lang === 'en'
    ? 'You maintain an internal CRM memory about ONE contact. Merge the prior summary and the new exchange into ONE factual summary (≤800 chars): facts, amounts, decisions, next steps. No invention, no advice. Answer as JSON: {"resume": "..."}'
    : 'Tu maintiens une mémoire CRM interne sur UN contact. Fusionne l\'ancien résumé et le nouvel échange en UN résumé factuel (≤800 caractères) : faits, montants, décisions, prochaines étapes. Aucune invention, aucun conseil. Réponds en JSON : {"resume": "..."}'
  const user = [
    p.prior ? `Ancien résumé : ${p.prior.slice(0, CRM_SUMMARY_MAX)}` : 'Ancien résumé : (aucun)',
    `Message de l'agent : ${p.userMessage.slice(0, DISTILL_INPUT_MAX)}`,
    `Réponse du copilote : ${p.assistantText.slice(0, DISTILL_INPUT_MAX)}`,
  ].join('\n\n')
  return [{ role: 'system', content: sys }, { role: 'user', content: user }]
}

// ── I/O (Deno/Supabase — hors périmètre des tests unit) ──────────────────────

/** Pose le contact chaud de l'agent. Fire-and-forget : JAMAIS await sur le chemin
 *  chaud d'un tour ; upsert (la ligne agent_ai_profiles peut ne pas exister). */
export function touchHotContact(
  supabase: SupabaseClient, profileId: string, agencyId: string | null, contactId: string,
): void {
  try {
    supabase.from('agent_ai_profiles')
      .upsert(
        { agent_id: profileId, agency_id: agencyId, hot_contact_id: contactId, hot_contact_at: new Date().toISOString() },
        { onConflict: 'agent_id' },
      )
      .then(({ error }) => { if (error) console.error('[contact-memory] touch failed:', error.message) })
  } catch (e) {
    console.error('[contact-memory] touch threw:', (e as Error)?.message ?? 'error')
  }
}

/** Charge et formate le bloc mémoire du contact chaud (ou '' si rien/périmé).
 *  Scopé agence au SQL (contact + insight) ; rédigé (redactPII) avant injection
 *  dans le system prompt — le suffixe system n'est pas couvert par la redaction live. */
export async function fetchHotContactBlock(
  supabase: SupabaseClient, agencyId: string | null,
  hot: { hot_contact_id: string | null; hot_contact_at: string | null } | null | undefined,
  lang: 'fr' | 'en',
): Promise<string> {
  if (!agencyId || !hot?.hot_contact_id || !isHotContactFresh(hot.hot_contact_at)) return ''
  const { data: c } = await supabase.from('contacts')
    .select('id, first_name, last_name')
    .eq('id', hot.hot_contact_id).eq('agency_id', agencyId).maybeSingle()
  if (!c) return ''
  const name = `${(c.first_name ?? '').trim()} ${(c.last_name ?? '').trim()}`.trim()
  const { data: ins } = await supabase.from('whatsapp_conversation_insights')
    .select('rolling_summary, summary, crm_summary')
    .eq('contact_id', c.id).eq('agency_id', agencyId).maybeSingle()
  const block = formatHotContactBlock({
    name,
    rollingSummary: (ins?.rolling_summary ?? ins?.summary ?? null) as string | null,
    crmSummary: (ins?.crm_summary ?? null) as string | null,
  }, lang)
  return block ? redactPII(block).redactedText : ''
}

/** Écrit le distillat CRM dans le dossier par-contact. Upsert PARTIEL : ne fournit
 *  jamais les colonnes du cron WhatsApp (et réciproquement) → pas d'écrasement croisé.
 *  Les NOT NULL de la table ont tous un default (vérifié) → l'INSERT partiel est valide. */
export async function upsertCrmSummary(
  supabase: SupabaseClient, agencyId: string, contactId: string, resume: string,
): Promise<void> {
  const { error } = await supabase.from('whatsapp_conversation_insights').upsert(
    {
      contact_id: contactId, agency_id: agencyId,
      crm_summary: clampSummary(resume), crm_summary_updated_at: new Date().toISOString(),
    },
    { onConflict: 'contact_id' },
  )
  if (error) console.error('[contact-memory] crm upsert failed:', error.message)
}

/** Distille un tour copilote → crm_summary (DeepSeek json_object, coût logué).
 *  Appelé fire-and-forget (EdgeRuntime.waitUntil) — jamais bloquant pour la réponse. */
export async function distillCrmTurn(p: {
  supabase: SupabaseClient; apiKey: string; agencyId: string; contactId: string
  userMessage: string; assistantText: string; lang: 'fr' | 'en'
}): Promise<void> {
  try {
    const { data: prior } = await p.supabase.from('whatsapp_conversation_insights')
      .select('crm_summary').eq('contact_id', p.contactId).eq('agency_id', p.agencyId).maybeSingle()
    const messages = buildDistillMessages({
      prior: (prior?.crm_summary ?? null) as string | null,
      // Défense en profondeur : le message agent est déjà rédigé en amont (copilot-redaction),
      // on re-rédige les deux côtés (l'output modèle peut répéter une PII d'un outil).
      userMessage: redactPII(p.userMessage).redactedText,
      assistantText: redactPII(p.assistantText).redactedText,
      lang: p.lang,
    })
    const started = Date.now()
    const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p.apiKey}` },
      body: JSON.stringify({ model: 'deepseek-chat', max_tokens: 400, messages, response_format: { type: 'json_object' } }),
      signal: AbortSignal.timeout(20_000),
    })
    if (!r.ok) { console.error('[contact-memory] distill http', r.status); return }
    const j = await r.json()
    logDeepSeekUsageWith(p.supabase, j?.usage, {
      edgeFunction: 'ai-copilot', module: 'copilot-distill',
      latencyMs: Date.now() - started, agencyId: p.agencyId,
    })
    let resume = ''
    try { resume = String(JSON.parse(j.choices?.[0]?.message?.content ?? '{}').resume ?? '') } catch { /* json cassé */ }
    if (resume.trim()) await upsertCrmSummary(p.supabase, p.agencyId, p.contactId, resume)
  } catch (e) {
    console.error('[contact-memory] distill threw:', (e as Error)?.name ?? 'error')
  }
}
```

- [ ] **Step 4 : vérifier** — `npx vitest run supabase/functions/_shared/contact-memory.test.ts` → PASS ; `deno check --no-lock supabase/functions/_shared/contact-memory.ts` → OK.

- [ ] **Step 5 : commit**

```bash
git add supabase/functions/_shared/contact-memory.ts supabase/functions/_shared/contact-memory.test.ts
git commit -m "feat(ai): module contact-memory (contact chaud + distillat CRM) + tests"
```

---

### Task 3 : Touch du contact chaud dans les exécuteurs partagés

Le pont cross-canal tient à UN geste : quand un exécuteur résout un contact, il le note. `contactInAgency` (11 call sites) + `execGetContactBrief` (résolution principale, SELECT inline) couvrent les deux canaux — le copilote passe par les MÊMES exécuteurs.

**Files:**
- Modify: `supabase/functions/_shared/whatsapp-actions.ts` (helper `contactInAgency` ~l.370 ; `execGetContactBrief` ~l.231)

- [ ] **Step 1 : importer + toucher dans `contactInAgency`**

```ts
// en tête de fichier, avec les autres imports _shared :
import { touchHotContact } from './contact-memory.ts'
```

```ts
/** Vérifie qu'un contact appartient à l'agence (garde SQL). Renvoie son nom ou null.
 *  Effet de bord voulu : pose le « contact chaud » de l'agent (mémoire cross-canal),
 *  fire-and-forget — résoudre un contact = travailler dessus. */
async function contactInAgency(
  ctx: ActionCtx, contactId: string,
): Promise<{ id: string; first_name: string | null; last_name: string | null } | null> {
  const { data } = await ctx.supabase
    .from('contacts').select('id, first_name, last_name')
    .eq('id', contactId).eq('agency_id', ctx.agencyId).maybeSingle()
  if (data) touchHotContact(ctx.supabase, ctx.profileId, ctx.agencyId, (data as { id: string }).id)
  return (data as { id: string; first_name: string | null; last_name: string | null } | null) ?? null
}
```

- [ ] **Step 2 : toucher dans `execGetContactBrief`** — juste après la garde `if (!c) return 'Contact introuvable dans votre agence.'` :

```ts
  touchHotContact(ctx.supabase, ctx.profileId, ctx.agencyId, c.id)
```

- [ ] **Step 3 : vérifier** — `deno check --no-lock supabase/functions/_shared/whatsapp-actions.ts` → OK ; `npx vitest run` (suite complète) → PASS.

- [ ] **Step 4 : commit**

```bash
git add supabase/functions/_shared/whatsapp-actions.ts
git commit -m "feat(ai): pose du contact chaud à la résolution d'un contact (2 points, cross-canal)"
```

---

### Task 4 : Exposer `crm_summary` aux lecteurs partagés (brief + meeting)

**Files:**
- Modify: `supabase/functions/_shared/whatsapp-actions.ts` (`execGetContactBrief` ~l.243 ; `execPrepareMeeting` ~l.2291)

- [ ] **Step 1 : `execGetContactBrief`** — étendre le SELECT insight :

```ts
  const { data: insight } = await ctx.supabase.from('whatsapp_conversation_insights')
    .select('summary, rolling_summary, crm_summary, crm_summary_updated_at, intent, sentiment, urgency, language, objections, next_action, commitments, source_message_count, generated_at')
    .eq('contact_id', c.id).eq('agency_id', ctx.agencyId).maybeSingle()
```

(le champ part tel quel dans `comprehension` — les deux canaux le reçoivent déjà en JSON.)

- [ ] **Step 2 : `execPrepareMeeting`** — même extension du SELECT (`crm_summary, crm_summary_updated_at` ajoutés), et dans le type inline `insight as { ... }` ajouter `crm_summary: string | null ; crm_summary_updated_at: string | null`. Si le bloc de sortie du meeting liste des champs nommés, ajouter `travail_crm: insight?.crm_summary ?? null`.

- [ ] **Step 3 : vérifier + commit**

```bash
deno check --no-lock supabase/functions/_shared/whatsapp-actions.ts
git add supabase/functions/_shared/whatsapp-actions.ts
git commit -m "feat(ai): crm_summary exposé dans get_contact_brief + prepare_meeting"
```

---

### Task 5 : Injection du bloc mémoire — canal WhatsApp

**Files:**
- Modify: `supabase/functions/whatsapp-agent/index.ts` (fetch profil ~l.105-107 ; assemblage system ~l.199-203)

- [ ] **Step 1 : étendre le SELECT profil**

```ts
  const { data: prof } = await supabase.from('agent_ai_profiles')
    .select('learned_style, hot_contact_id, hot_contact_at').eq('agent_id', profileId).maybeSingle()
```

- [ ] **Step 2 : charger le bloc (après la création de `ctx`)**

```ts
import { fetchHotContactBlock } from '../_shared/contact-memory.ts'
// …
  // Mémoire cross-canal : bloc « contact chaud » (<6h, tous canaux). VOLATIL → injecté
  // dans le SUFFIXE system avec l'horodatage, jamais dans le préfixe stable (cache).
  const hotBlock = await fetchHotContactBlock(supabase, ctx.agencyId, prof ?? null, lang === 'en' ? 'en' : 'fr')
```

- [ ] **Step 3 : injecter dans le suffixe** (l'horodatage reste en tout dernier) :

```ts
  const messages: Array<Record<string, unknown>> = [
    { role: 'system', content: `${systemStable}${hotBlock}\n\nDate/heure actuelles (Europe/Zurich) : ${nowZurich}.` },
    ...history,
    { role: 'user', content: message },
  ]
```

- [ ] **Step 4 : vérifier + commit**

```bash
deno check --no-lock supabase/functions/whatsapp-agent/index.ts
git add supabase/functions/whatsapp-agent/index.ts
git commit -m "feat(wa): injection mémoire contact chaud au tour WhatsApp (suffixe cache-safe)"
```

---

### Task 6 : Injection du bloc mémoire — copilote MEGGA AI

**Files:**
- Modify: `supabase/functions/ai-copilot/index.ts` (`buildSystemPrompt`, fetch aiProfile ~l.649 et suffixe horodaté ~l.686)

- [ ] **Step 1 : étendre le SELECT + charger le bloc** dans le `try` de personnalisation :

```ts
import { fetchHotContactBlock } from '../_shared/contact-memory.ts'
// …
    const { data: aiProfile } = await sb
      .from('agent_ai_profiles')
      .select('brief, learned_style, hot_contact_id, hot_contact_at')
      .eq('agent_id', auth.user.id)
      .maybeSingle()
// … (blocs existants inchangés)
    // Mémoire cross-canal (contact chaud <6h, posé par les exécuteurs des DEUX canaux).
    hotBlock = await fetchHotContactBlock(sb, auth.profile.agency_id, aiProfile ?? null, language === 'en' ? 'en' : 'fr')
```

(déclarer `let hotBlock = ''` avant le `try` ; best-effort comme le reste du bloc.)

- [ ] **Step 2 : injecter AVANT l'horodatage** (fin de `buildSystemPrompt`) :

```ts
  systemPrompt += hotBlock
  const nowZurich = new Date().toLocaleString('fr-CH', { timeZone: 'Europe/Zurich', dateStyle: 'full', timeStyle: 'short' })
  systemPrompt += `\n\nDate/heure actuelles (Europe/Zurich) : ${nowZurich}.`
```

- [ ] **Step 3 : vérifier + commit**

```bash
deno check --no-lock supabase/functions/ai-copilot/index.ts
git add supabase/functions/ai-copilot/index.ts
git commit -m "feat(copilot): injection mémoire contact chaud au tour web"
```

---

### Task 7 : Distillateur post-tour copilote (write-back CRM, gated OFF)

**Files:**
- Modify: `supabase/functions/ai-copilot/index.ts` (flags ~l.880 ; `runTurn` : capture du contact + fire-and-forget après le retour)

- [ ] **Step 1 : lire le flag** — ajouter `'contact_memory_crm_writeback_enabled'` à la liste `.in('key', [...])` du bloc flags, et :

```ts
        crmWritebackOn = toolsOn && val('contact_memory_crm_writeback_enabled') === 'true'
```

(déclarer `let crmWritebackOn = false` avec les autres ; absent = OFF, pattern maison.)

- [ ] **Step 2 : capturer le contact du tour** — dans `makeRunTool`, envelopper le dispatch pour retenir le dernier `contact_id` UUID passé à un outil contact :

```ts
const CONTACT_TOOLS = new Set(['get_contact_brief', 'add_note', 'create_reminder', 'prepare_meeting', 'get_kyc_status', 'get_matches'])
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function makeRunTool(actionCtx: ActionCtx, webCtx: WebToolCtx, onContact?: (id: string) => void) {
  return async (name: string, args: Record<string, unknown>): Promise<string> => {
    const cid = typeof args.contact_id === 'string' ? args.contact_id : ''
    if (onContact && CONTACT_TOOLS.has(name) && UUID_RE.test(cid)) onContact(cid)
    switch (name) { /* … dispatch existant inchangé … */ }
  }
}
```

et au call site : `let turnContactId: string | null = null` ; `const runTool = makeRunTool(actionCtx, webCtx, (id) => { turnContactId = id })`.

- [ ] **Step 3 : déclencher le distillat après le tour** — dans `runTurn`, juste avant le `return { final, … }` (chemin succès, hors `detect_intent`) :

```ts
      // Write-back CRM (gated) : distille ce tour dans le dossier par-contact partagé.
      // Fire-and-forget (waitUntil) : zéro latence ajoutée ; substance minimale exigée.
      if (crmWritebackOn && turnContactId && action !== 'detect_intent' && final.trim().length >= 80) {
        const work = distillCrmTurn({
          supabase: auth.supabase, apiKey: deepseekApiKey,
          agencyId: auth.profile.agency_id, contactId: turnContactId,
          userMessage: red.message, assistantText: final,
          lang: language === 'en' ? 'en' : 'fr',
        })
        // @ts-expect-error EdgeRuntime.waitUntil keeps the isolate alive until promise resolves
        if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) EdgeRuntime.waitUntil(work)
        else void work
      }
```

(import `distillCrmTurn` depuis `../_shared/contact-memory.ts` ; le contact du tour est déjà validé in-agency par l'exécuteur qui l'a résolu — le distillat re-scope par `agency_id` à l'écriture.)

- [ ] **Step 4 : vérifier + commit**

```bash
deno check --no-lock supabase/functions/ai-copilot/index.ts
git add supabase/functions/ai-copilot/index.ts
git commit -m "feat(copilot): distillateur crm_summary post-tour (gated contact_memory_crm_writeback_enabled)"
```

---

### Task 8 : Spec backend live (isolation + non-écrasement croisé)

**Files:**
- Create: `tests/backend/contact-memory-crossband.spec.ts`

- [ ] **Step 1 : écrire la spec** (pattern `whatsapp-matches-enrich.spec.ts` : `skipIf(!HAS_KEYS)`, tourne live en CI) :

```ts
// Couverture LIVE de la mémoire cross-canal (contact chaud + crm_summary).
// Épingle : (1) résoudre un contact pose hot_contact_* pour l'agent appelant ;
// (2) l'upsert CRM ne détruit PAS les colonnes du cron WhatsApp (et réciproquement) ;
// (3) isolation agence : l'agent B ne voit jamais le bloc du contact de A ;
// (4) get_contact_brief expose crm_summary.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { type SupabaseClient } from '@supabase/supabase-js'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'
import { execGetContactBrief, type ActionCtx } from '../../supabase/functions/_shared/whatsapp-actions'
import { fetchHotContactBlock, upsertCrmSummary } from '../../supabase/functions/_shared/contact-memory'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('mémoire cross-canal (live)', () => {
  let svc: SupabaseClient
  let setup: TwoAgenciesSetup
  let ctxA: ActionCtx
  let contactId = ''

  beforeAll(async () => {
    svc = serviceRoleClient()
    setup = await setupTwoAgencies()
    ctxA = { supabase: svc, profileId: setup.agentAId, agencyId: setup.agencyAId, lang: 'fr', via: 'web' }
    const { data, error } = await svc.from('contacts').insert({
      agency_id: setup.agencyAId, first_name: 'MEM', last_name: `X-${setup.stamp}`, type: 'buyer',
    }).select('id').single()
    if (error) throw new Error(error.message)
    contactId = data.id as string
  })

  afterAll(async () => {
    await svc.from('whatsapp_conversation_insights').delete().eq('contact_id', contactId)
    await svc.from('contacts').delete().eq('id', contactId)
    await setup?.cleanup()
  })

  it('T1 — get_contact_brief pose le contact chaud de l’agent (fire-and-forget)', async () => {
    await execGetContactBrief(ctxA, { contact_id: contactId })
    await new Promise((r) => setTimeout(r, 800)) // le touch est fire-and-forget
    const { data } = await svc.from('agent_ai_profiles')
      .select('hot_contact_id').eq('agent_id', setup.agentAId).maybeSingle()
    expect(data?.hot_contact_id).toBe(contactId)
  })

  it('T2 — upsert CRM n’écrase pas les colonnes WhatsApp (ni l’inverse)', async () => {
    // simule le cron : pose un rolling_summary
    await svc.from('whatsapp_conversation_insights').upsert(
      { contact_id: contactId, agency_id: setup.agencyAId, rolling_summary: 'fil whatsapp' },
      { onConflict: 'contact_id' })
    await upsertCrmSummary(svc, setup.agencyAId, contactId, 'travail crm')
    // re-simule un tour de cron (upsert partiel côté whatsapp)
    await svc.from('whatsapp_conversation_insights').upsert(
      { contact_id: contactId, agency_id: setup.agencyAId, rolling_summary: 'fil whatsapp v2' },
      { onConflict: 'contact_id' })
    const { data } = await svc.from('whatsapp_conversation_insights')
      .select('rolling_summary, crm_summary').eq('contact_id', contactId).maybeSingle()
    expect(data?.rolling_summary).toBe('fil whatsapp v2')
    expect(data?.crm_summary).toBe('travail crm')   // survit aux upserts du cron
  })

  it('T3 — bloc contact chaud : présent pour A, VIDE pour l’agence B (isolation)', async () => {
    const hot = { hot_contact_id: contactId, hot_contact_at: new Date().toISOString() }
    const blockA = await fetchHotContactBlock(svc, setup.agencyAId, hot, 'fr')
    expect(blockA).toContain('MEM')
    expect(blockA).toContain('travail crm')
    const blockB = await fetchHotContactBlock(svc, setup.agencyBId, hot, 'fr')
    expect(blockB).toBe('') // contact hors agence B → rien
  })

  it('T4 — get_contact_brief expose crm_summary', async () => {
    const out = await execGetContactBrief(ctxA, { contact_id: contactId })
    expect(out).toContain('travail crm')
  })
})
```

- [ ] **Step 2 : vérifier localement** — `npx vitest run --config=vitest.backend.config.ts tests/backend/contact-memory-crossband.spec.ts` → `skipped` sans clés (import OK) ; la CI l'exécute live.

- [ ] **Step 3 : commit**

```bash
git add tests/backend/contact-memory-crossband.spec.ts
git commit -m "test(ai): spec live mémoire cross-canal (touch, non-écrasement, isolation, brief)"
```

---

### Task 9 : Vérifications finales + PR

- [ ] **Step 1 : gates locaux**

```bash
npx vitest run                          # suite unit complète (dont contact-memory.test.ts)
npm run build                           # tsc + vite
deno check --no-lock supabase/functions/whatsapp-agent/index.ts supabase/functions/ai-copilot/index.ts supabase/functions/_shared/whatsapp-actions.ts supabase/functions/_shared/contact-memory.ts
npm run lint:deadcode
```

Attendu : tout vert.

- [ ] **Step 2 : PR** — branche `claude/contact-memory-crossband`, base `main`. Corps : objectif (scénario continuité), archi (contact chaud + write-back), gates (`contact_memory_crm_writeback_enabled` absent=OFF → **le write-back ne tourne pas tant qu'on ne l'allume pas** ; l'injection du bloc, elle, est inerte tant qu'aucune mémoire n'existe), vérifs.

- [ ] **Step 3 : après merge** — mettre à jour le cerveau (seed ruflo + `docs/system-map.md`, section agents IA) puis `npm run ruflo:seed`. Activation produit (plus tard, décision explicite) : `INSERT INTO app_config (key, value) VALUES ('contact_memory_crm_writeback_enabled','true')` quand le pilote démarre.

---

## Hors périmètre (plans séparés)

- **Chantier B — noyau commun** : migrer `whatsapp-agent` sur `agent-loop.ts` (rapatrier slow_async KYC + garde anti-fabrication + ack déterministe), fusionner les personas en base+delta canal, brancher le knowledge RAG sur WhatsApp, client DeepSeek unique (`ai-provider.ts`). À planifier après preuve d'usage de la mémoire.
- **Continuité par HISTORIQUE de conversation** (rejouer le fil CRM dans WhatsApp) : volontairement écarté — la mémoire distillée par-contact est la bonne clé (l'éval l'a montré : `ai_copilot_conversations` est un journal par-agent, mauvaise clé).

## Écarts d'exécution (subagent-driven, 18 juil. 2026)

Le plan a été exécuté tâche par tâche avec double revue adverse (spec + qualité). **8 défauts du plan initial** ont été attrapés et corrigés en cours de route — le code livré DIFFÈRE du plan sur ces points (le code fait foi) :

1. **Migration** : `DROP CONSTRAINT IF EXISTS` (×2 noms) avant le ADD — la CI rejoue les migrations du jour à chaque push ; contrainte renommée `whatsapp_conversation_insights_crm_summary_check` ; `public.` partout ; 4 `COMMENT ON COLUMN`.
2. **distillCrmTurn** : le `prior` est AUSSI rédigé (auto-guérison d'une PII qui aurait fui dans crm_summary).
3. **touchHotContact** : `EdgeRuntime.waitUntil` + double handler `.then(ok, err)` (pattern logAIUsageWith) — sans quoi l'upsert pouvait être perdu à la gelée d'isolat.
4. **formatHotContactBlock** : nom borné (80c) + retour entier borné (900c) + test pathologique.
5. **Clause anti-initiative** ajoutée au bloc (parité `NBA_PROMPT_GUARDRAIL`) + épinglée par 2 assertions.
6. **detect_intent** exclu de l'injection (param `hotBlockOn`, miroir des gates tools/knowledge) — un classifieur JSON strict ne reçoit jamais de contexte contact ambiant.
7. **CRITICAL — garde tenant dans distillCrmTurn** : le contactId vient des args du modèle ; sans garde, un UUID étranger pouvait VOLER la ligne d'insight d'une autre agence via l'upsert `onConflict contact_id` (flip agency_id). Garde in-agency AVANT toute lecture/dépense/écriture. Épinglé par T5 de la spec live.
8. **Anti-mésattribution** : distillat seulement si EXACTEMENT UN contact travaillé ce tour (`Set`, 0 ou 2+ = no-op) + seuil nommé `MIN_SUBSTANCE_CHARS`.

## Risques & garde-fous

| Risque | Garde-fou |
|---|---|
| Coût : +1 appel DeepSeek par tour copilote « contact » | Gated OFF ; substance minimale (≥80c) ; max_tokens 400 ; fire-and-forget ; coût logué `copilot-distill` (visible AdminToolUsage) |
| Mémoire empoisonnée / périmée | Bloc cadré « mémoire interne à VÉRIFIER via les outils » (anti-fab) ; TTL 6 h sur le bloc ; ≤800c |
| PII → DeepSeek | `redactPII` sur le bloc injecté ET sur les deux côtés du distillat (le suffixe system n'est pas couvert par la redaction live) |
| Écrasement croisé cron ⇄ copilote | Upserts PARTIELS des deux côtés (colonnes disjointes) — épinglé par T2 de la spec live |
| Fuite inter-agences | `fetchHotContactBlock` re-valide contact ET insight par `agency_id` ; épinglé par T3 |
| Cache DeepSeek invalidé | Bloc injecté dans le SUFFIXE volatil (avec l'horodatage), préfixe stable intact |
| Contact supprimé (delete_contact) | FK `hot_contact_id` ON DELETE SET NULL ; `fetchHotContactBlock` dégrade à `''` |
