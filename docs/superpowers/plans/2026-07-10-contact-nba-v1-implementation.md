# Contact NBA v1 — Implementation Plan (Vague 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer `contact_next_action` v1 — la « prochaine meilleure action » déterministe par contact, lue à l'identique par l'agent WhatsApp et le copilote CRM (spec validée : [2026-07-10-contact-nba-v1.md](2026-07-10-contact-nba-v1.md), révision v1.1 post-revue adverse).

**Architecture:** 1 fonction SQL cœur (service-role, le paramètre est le scope) + 1 wrapper JWT (une seule logique, deux portes — blocker B1) + 1 trigger `touch_transactions_updated_at` (pré-requis R4) ; 1 module TS pur `_shared/contact-nba.ts` (parse défensif + libellés contrôlés FR/EN + guardrail prompt) ; câblage additif dans les exécuteurs déjà partagés `execGetContactBrief`/`execPrepareMeeting` (+ exposition `rolling_summary`).

**Tech Stack:** PostgreSQL plpgsql (Supabase), Deno Edge Functions, TypeScript, vitest (unit + backend live).

---

## Contexte repo pour l'exécuteur (à lire AVANT de commencer)

- **Worktree** : tout se passe dans `/Users/megga/Desktop/megga-real-estate/.claude/worktrees/whatsapp-crm-agent-memory-91472a`, branche `claude/whatsapp-crm-agent-memory-91472a`. Si `npm run build` échoue étrangement → `npm ci` d'abord (deps de worktree manquantes, ce n'est PAS un bug source).
- **La spec fait foi** : [2026-07-10-contact-nba-v1.md](2026-07-10-contact-nba-v1.md). En cas de doute sur une règle, c'est elle qu'on lit. Ce plan est son exécution pas-à-pas.
- **Schéma vérifié en prod (10.07.2026)** — ne pas re-deviner :
  - `reminders` : `trigger_at` (PAS `due_at`), `status` text (valeur live `'triggered'`), `completed_at`, NOT NULL sans défaut : `agency_id, type, trigger_rule`.
  - `crm_offers` : PAS de `contact_id` → lien via `transaction_id`. Enums : `status` (`pending,accepted,rejected,expired,withdrawn`), `kind` (`offer,counter`), `from_party` (`buyer,seller`). NOT NULL sans défaut : `agency_id, kind, from_party, by_label, amount, expires_at`.
  - `visits` : `status` text (`planned/confirmed/done/cancelled/no_show`), `rapport` jsonb, `feedback_agent` text. NOT NULL sans défaut : `agency_id, property_id, contact_id, scheduled_at` (⚠ les seeds de visite exigent un bien).
  - `transactions` : `contact_buyer_id`, `contact_seller_id`, `stage` enum (18 valeurs dont legacy), `status` enum (`active,on_hold,cancelled,completed`), `updated_at`. **Aucun trigger ne rafraîchit `updated_at` aujourd'hui** — c'est ce que ce plan corrige.
  - `kyc_cases` : `status` enum (`pending,in_progress,review,validated,rejected`), `type` enum (`buyer_pp,buyer_pm,seller_pp,seller_pm`), `completion_pct`.
  - `matches` : `status` text, `response_at`, `snoozed_until`, index partiel `idx_matches_agency_focus (agency_id, contact_id, score DESC) WHERE status='suggested'`.
  - `contacts.type` : CHECK 7 valeurs `buyer,seller,tenant,landlord,investor,both,lead`.
  - `app_config` : PK = `key`, `value` TEXT.
- **Invariants à ne JAMAIS violer** : DeepSeek only (aucun appel/log/mention Claude/Anthropic) ; aucun nouvel outil LLM, aucun tier modifié, `canLeaveConfirm` intact ; KYC jamais bloquant ; scores = « estimation » ; pas de tiret cadratin dans les libellés ; multi-tenant : `p_agency` + `p_contact` dans CHAQUE sous-requête SQL.
- **CI** : le job « Vitest unit » enchaîne `lint:prose` / `lint:i18n` / `i18n:parity` / `test:unit` + **`deno check --no-lock` sur toutes les Edge Functions hors `*.test.ts`** (`.github/workflows/unit-tests.yml:70-77`) — le module et les câblages doivent passer `deno check`. Les tests backend (`tests/backend/*.spec.ts`) tournent **LIVE en CI** contre un Supabase local seedé (skipIf ne skippe PAS en CI) : c'est la vraie validation.
- **Vitest config piège** : `vitest.config.ts` a une liste `include` EXPLICITE — un nouveau test colocalisé dans `_shared/` ne tourne PAS tant qu'il n'y est pas ajouté (Task 1, Step 2).
- **Commits** : un commit par task (messages donnés). **PAS de push avant la fin** (Task 9) ; `npm run build` (tsc -b) obligatoire avant push.
- **Migration date-guard (piège prouvé)** : le deploy n'applique que les migrations datées `>= jour UTC du merge`. Le fichier est créé `20260710200000_…` ; la Task 9 contient l'étape de re-stamp si le merge n'a pas lieu le 10.07.

---

### Task 0 : Pré-vol

**Files:** aucun (vérifications)

- [ ] **Step 1 : Se placer dans le worktree et vérifier l'état**

```bash
cd /Users/megga/Desktop/megga-real-estate/.claude/worktrees/whatsapp-crm-agent-memory-91472a
git status --short && git branch --show-current
```
Expected: branche `claude/whatsapp-crm-agent-memory-91472a`, tree clean (hors `docs/superpowers/plans/*.md` déjà présents).

- [ ] **Step 2 : Vérifier les deps du worktree**

```bash
node -e "require.resolve('vitest')" 2>/dev/null || npm ci
```

- [ ] **Step 3 : Lire la spec en entier**

Lire `docs/superpowers/plans/2026-07-10-contact-nba-v1.md` (contrat §2, règles §3, architecture §5, câblage §6, tests §9).

---

### Task 1 : Module pur `_shared/contact-nba.ts` (TDD)

**Files:**
- Test : `supabase/functions/_shared/contact-nba.test.ts` (créer)
- Modify : `vitest.config.ts:18` (ajouter le test à l'`include`)
- Create : `supabase/functions/_shared/contact-nba.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `supabase/functions/_shared/contact-nba.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import {
  parseNextAction, formatNextAction, formatKycNote, NBA_PROMPT_GUARDRAIL,
  type ContactNextAction,
} from './contact-nba'

const raw = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  version: 1,
  action: 'relance',
  reason_key: 'dormant',
  params: { days_dormant: 21 },
  due_at: null,
  kyc_note: null,
  computed_at: '2026-07-10T12:00:00Z',
  ...over,
})

const parsed = (over: Record<string, unknown> = {}): ContactNextAction => {
  const p = parseNextAction(raw(over))
  if (!p) throw new Error('parse attendu non-null')
  return p
}

describe('parseNextAction (défensif)', () => {
  it('parse un objet valide (snake_case → camelCase)', () => {
    const p = parsed()
    expect(p.action).toBe('relance')
    expect(p.reasonKey).toBe('dormant')
    expect(p.params.days_dormant).toBe(21)
    expect(p.dueAt).toBeNull()
    expect(p.kycNote).toBeNull()
  })
  it('rejette action ou reason_key hors whitelist → null', () => {
    expect(parseNextAction(raw({ action: 'hack' }))).toBeNull()
    expect(parseNextAction(raw({ reason_key: 'unknown' }))).toBeNull()
  })
  it('rejette les formes non-objet → null', () => {
    expect(parseNextAction(null)).toBeNull()
    expect(parseNextAction('relance')).toBeNull()
    expect(parseNextAction([raw()])).toBeNull()
  })
  it('params non-objet → {} (jamais d\'exception)', () => {
    expect(parsed({ params: 'x' }).params).toEqual({})
  })
  it('kyc_note valide → parsée ; invalide → null', () => {
    const p = parsed({ kyc_note: { status: 'pending', completion_pct: 40 } })
    expect(p.kycNote).toEqual({ status: 'pending', completionPct: 40 })
    expect(parsed({ kyc_note: { nope: true } }).kycNote).toBeNull()
  })
})

describe('formatNextAction (libellés contrôlés)', () => {
  const cases: Array<[Record<string, unknown>, RegExp, RegExp]> = [
    // [surcharge raw, attendu FR, attendu EN]
    [{ action: 'rappel', reason_key: 'reminder_overdue', params: { reminder_type: 'dormant_lead', days_overdue: 3, reminder_id: 'a1b2c3d4-0000-0000-0000-000000000000' } },
      /rappel.*retard de 3 j/i, /reminder.*overdue by 3 d/i],
    [{ action: 'rappel', reason_key: 'reminder_today', params: { reminder_type: 'missing_document' } },
      /rappel.*aujourd'hui/i, /today's/i],
    [{ action: 'offre_expirante', reason_key: 'offer_expiring', params: { amount: 850000, days_left: 2, offer_id: 'a1b2c3d4-0000-0000-0000-000000000000' } },
      /offre de CHF 850'000.*2 j/, /CHF 850'000.*2 d/],
    [{ action: 'offre_expirante', reason_key: 'offer_expiring', params: { amount: 850000, days_left: -1 } },
      /échéance dépassée/i, /deadline passed/i],
    [{ action: 'visite_preparer', reason_key: 'visit_today', params: {}, due_at: '2026-07-10T12:30:00Z' },
      /préparer la visite d'aujourd'hui/i, /prepare today's visit/i],
    [{ action: 'visite_debrief', reason_key: 'visit_debrief', params: {}, due_at: '2026-07-08T10:00:00Z' },
      /débriefer la visite/i, /debrief the visit/i],
    [{ action: 'deal_stagnant', reason_key: 'deal_stalled', params: { stage: 'offer', days_stalled: 20, transaction_id: 'a1b2c3d4-0000-0000-0000-000000000000' } },
      /faire avancer le dossier.*20 j/i, /move the deal forward.*20 d/i],
    [{ action: 'match_a_envoyer', reason_key: 'matches_to_send', params: { count: 3, best_score: 88, gate: 70 } },
      /3 bien\(s\).*~88/i, /3 matching listing\(s\).*~88/i],
    [{ action: 'relance', reason_key: 'never_contacted', params: {} },
      /jamais recontacté/i, /never contacted/i],
    [{ action: 'relance', reason_key: 'dormant', params: { days_dormant: 21 } },
      /sans échange depuis 21 j/i, /no exchange for 21 d/i],
    [{ action: 'aucune', reason_key: 'none', params: {} },
      /aucune action urgente/i, /no urgent action/i],
  ]

  it('chaque reason_key rend un libellé FR et EN attendu, cadré « estimation »', () => {
    for (const [over, frRe, enRe] of cases) {
      const fr = formatNextAction(parsed(over), 'fr')
      const en = formatNextAction(parsed(over), 'en')
      expect(fr).toMatch(frRe)
      expect(en).toMatch(enRe)
      expect(fr.toLowerCase()).toContain('estimation')
      expect(en.toLowerCase()).toContain('estimate')
    }
  })

  it('jamais d\'UUID ni de tiret cadratin dans un libellé rendu', () => {
    const uuidRe = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i
    for (const [over] of cases) {
      for (const lang of ['fr', 'en'] as const) {
        const label = formatNextAction(parsed(over), lang)
        expect(label).not.toMatch(uuidRe)
        expect(label).not.toContain('—')
        expect(label).not.toContain('–')
      }
    }
  })
})

describe('formatKycNote + guardrail', () => {
  it('note KYC = facultatif, jamais bloquant', () => {
    const note = { status: 'pending', completionPct: 40 }
    expect(formatKycNote(note, 'fr').toLowerCase()).toContain('facultatif')
    expect(formatKycNote(note, 'en').toLowerCase()).toContain('optional')
  })
  it('NBA_PROMPT_GUARDRAIL interdit l\'initiative outillée et cadre l\'estimation', () => {
    expect(NBA_PROMPT_GUARDRAIL).toContain("N'appelle AUCUN outil")
    expect(NBA_PROMPT_GUARDRAIL.toLowerCase()).toContain('estimation')
    expect(NBA_PROMPT_GUARDRAIL).toContain('next_action_estimee')
  })
})
```

- [ ] **Step 2 : Ajouter le test à l'include vitest**

Dans `vitest.config.ts`, ligne 18, ajouter à la fin du tableau `include` (avant le `]`) :

```ts
, 'supabase/functions/_shared/contact-nba.test.ts'
```

- [ ] **Step 3 : Vérifier que le test échoue**

```bash
npx vitest run supabase/functions/_shared/contact-nba.test.ts
```
Expected: FAIL (`Cannot find module './contact-nba'`).

- [ ] **Step 4 : Implémenter le module**

Créer `supabase/functions/_shared/contact-nba.ts` — **PUR : zéro import, zéro I/O, zéro Deno** (il doit passer à la fois vitest/Node et `deno check`) :

```ts
// NBA par contact (cerveau partagé WhatsApp ⇄ copilote) — côté TS : parse DÉFENSIF du
// jsonb rendu par le RPC contact_next_action + libellés CONTRÔLÉS par clé (patron
// REASON_KEY_LABEL du Focus : on ne rend JAMAIS un texte libre venu d'ailleurs).
// Module PUR (zéro I/O, zéro import) : testable vitest, comble le trou deno/tsc.
// Doctrine : le LLM ne fournit ni le tri ni le libellé de priorité (blocker B3) ;
// libellés = estimation, jamais d'UUID, jamais de tiret cadratin (meggaProse-safe).

export type NbaAction =
  | 'rappel' | 'offre_expirante' | 'visite_preparer' | 'visite_debrief'
  | 'deal_stagnant' | 'match_a_envoyer' | 'relance' | 'aucune'

export type NbaReasonKey =
  | 'reminder_overdue' | 'reminder_today' | 'offer_expiring' | 'visit_today'
  | 'visit_debrief' | 'deal_stalled' | 'matches_to_send'
  | 'never_contacted' | 'dormant' | 'none'

export interface ContactNextAction {
  version: number
  action: NbaAction
  reasonKey: NbaReasonKey
  params: Record<string, unknown>
  dueAt: string | null
  kycNote: { status: string; completionPct: number | null } | null
  computedAt: string | null
}

const ACTIONS = new Set<string>([
  'rappel', 'offre_expirante', 'visite_preparer', 'visite_debrief',
  'deal_stagnant', 'match_a_envoyer', 'relance', 'aucune',
])
const REASONS = new Set<string>([
  'reminder_overdue', 'reminder_today', 'offer_expiring', 'visit_today',
  'visit_debrief', 'deal_stalled', 'matches_to_send',
  'never_contacted', 'dormant', 'none',
])

/** Parse défensif du jsonb RPC : toute forme inattendue → null, jamais d'exception. */
export function parseNextAction(rawInput: unknown): ContactNextAction | null {
  if (!rawInput || typeof rawInput !== 'object' || Array.isArray(rawInput)) return null
  const o = rawInput as Record<string, unknown>
  const action = typeof o.action === 'string' ? o.action : ''
  const reasonKey = typeof o.reason_key === 'string' ? o.reason_key : ''
  if (!ACTIONS.has(action) || !REASONS.has(reasonKey)) return null
  const params = o.params && typeof o.params === 'object' && !Array.isArray(o.params)
    ? (o.params as Record<string, unknown>)
    : {}
  let kycNote: ContactNextAction['kycNote'] = null
  if (o.kyc_note && typeof o.kyc_note === 'object' && !Array.isArray(o.kyc_note)) {
    const k = o.kyc_note as Record<string, unknown>
    if (typeof k.status === 'string' && k.status) {
      kycNote = {
        status: k.status,
        completionPct: typeof k.completion_pct === 'number' && Number.isFinite(k.completion_pct)
          ? k.completion_pct : null,
      }
    }
  }
  return {
    version: 1,
    action: action as NbaAction,
    reasonKey: reasonKey as NbaReasonKey,
    params,
    dueAt: typeof o.due_at === 'string' ? o.due_at : null,
    kycNote,
    computedAt: typeof o.computed_at === 'string' ? o.computed_at : null,
  }
}

// ── Helpers de rendu (purs, jamais d'exception) ──────────────────────────────
const intOf = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : null

const chf = (v: unknown): string | null => {
  const n = intOf(v)
  return n === null ? null : `CHF ${Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'")}`
}

/** Date suisse (Europe/Zurich). withTime → « 10.07.2026 14:30 ». Invalide → null. */
const zurich = (iso: string | null, withTime: boolean): string | null => {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const s = new Intl.DateTimeFormat('fr-CH', {
    timeZone: 'Europe/Zurich', day: '2-digit', month: '2-digit', year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(d)
  return s.replace(', ', ' ')
}

/** Libellé humain contrôlé par reason_key. JAMAIS d'UUID, JAMAIS de tiret cadratin,
 *  toujours cadré « estimation ». lang suit WaLang (fr|en) — DE/IT rendus par le LLM
 *  en aval à partir du FR (comportement copilote existant). */
export function formatNextAction(nba: ContactNextAction, lang: 'fr' | 'en' = 'fr'): string {
  const en = lang === 'en'
  const p = nba.params
  if (nba.reasonKey === 'none') {
    return en
      ? 'No urgent action for this contact (internal estimate).'
      : 'Aucune action urgente pour ce contact (estimation interne).'
  }
  let core: string
  switch (nba.reasonKey) {
    case 'reminder_overdue': {
      const t = typeof p.reminder_type === 'string' && p.reminder_type ? p.reminder_type : (en ? 'reminder' : 'rappel')
      const d = intOf(p.days_overdue) ?? 0
      core = en ? `handle the "${t}" reminder, overdue by ${d} d` : `traiter le rappel « ${t} », en retard de ${d} j`
      break
    }
    case 'reminder_today': {
      const t = typeof p.reminder_type === 'string' && p.reminder_type ? p.reminder_type : (en ? 'reminder' : 'rappel')
      core = en ? `handle today's "${t}" reminder` : `traiter le rappel « ${t} » prévu aujourd'hui`
      break
    }
    case 'offer_expiring': {
      const a = chf(p.amount)
      const dl = intOf(p.days_left)
      const what = a ? (en ? `the ${a} offer` : `l'offre de ${a}`) : (en ? 'the pending offer' : "l'offre en attente")
      core = dl !== null && dl < 0
        ? (en ? `respond to ${what} (deadline passed)` : `répondre à ${what} (échéance dépassée)`)
        : (en ? `respond to ${what} (expires in ${dl ?? 0} d)` : `répondre à ${what} (échéance dans ${dl ?? 0} j)`)
      break
    }
    case 'visit_today': {
      const at = zurich(nba.dueAt, true)
      core = en
        ? `prepare today's visit${at ? ` (${at})` : ''}`
        : `préparer la visite d'aujourd'hui${at ? ` (${at})` : ''}`
      break
    }
    case 'visit_debrief': {
      const at = zurich(nba.dueAt, false)
      core = en
        ? `debrief the visit${at ? ` of ${at}` : ''} (report missing)`
        : `débriefer la visite${at ? ` du ${at}` : ''} (rapport manquant)`
      break
    }
    case 'deal_stalled': {
      const st = typeof p.stage === 'string' && p.stage ? p.stage : '?'
      const d = intOf(p.days_stalled) ?? 0
      core = en
        ? `move the deal forward (stage ${st}, no movement for ${d} d)`
        : `faire avancer le dossier (étape ${st}, immobile depuis ${d} j)`
      break
    }
    case 'matches_to_send': {
      const n = intOf(p.count) ?? 0
      const best = intOf(p.best_score)
      core = en
        ? `propose a selection: ${n} matching listing(s)${best !== null ? `, best score ~${best}` : ''}`
        : `proposer une sélection : ${n} bien(s) pertinent(s)${best !== null ? `, meilleur score ~${best}` : ''}`
      break
    }
    case 'never_contacted':
      core = en ? 'make a first contact (never contacted yet)' : 'prendre un premier contact (jamais recontacté)'
      break
    case 'dormant': {
      const d = intOf(p.days_dormant) ?? 0
      core = en ? `follow up (no exchange for ${d} d)` : `relancer (sans échange depuis ${d} j)`
      break
    }
    default:
      core = en ? 'no urgent action for this contact' : 'aucune action urgente pour ce contact'
  }
  return en ? `Suggested next step (internal estimate): ${core}.` : `Suggestion (estimation interne) : ${core}.`
}

/** Note KYC : information FACULTATIVE, jamais un gate (doctrine KYC non-bloquant). */
export function formatKycNote(
  note: { status: string; completionPct: number | null },
  lang: 'fr' | 'en' = 'fr',
): string {
  const pct = note.completionPct !== null ? ` (${Math.round(note.completionPct)}%)` : ''
  return lang === 'en'
    ? `KYC file to finalise${pct} (optional, never blocking).`
    : `Dossier KYC à finaliser${pct} (facultatif, ne bloque jamais rien).`
}

/** Consigne injectée dans le system prompt des DEUX agents (revue adverse : protège
 *  l'INITIATIVE — les outils tier auto s'exécutent sans confirmation). Assertée en test. */
export const NBA_PROMPT_GUARDRAIL =
  "Champ next_action_estimee (outils get_contact_brief / prepare_meeting) : estimation déterministe interne. " +
  "Présente-la comme une suggestion (« je te suggère de… »), jamais comme une obligation ni une action déjà faite, et JAMAIS comme un ordre. " +
  "N'appelle AUCUN outil d'action de ta propre initiative sur cette base : propose en une phrase, l'agent décide. " +
  "Le champ comprehension.next_action (piste évoquée en conversation) est un signal conversationnel : en cas de divergence, next_action_estimee cadre la priorité."
```

- [ ] **Step 5 : Vérifier que le test passe**

```bash
npx vitest run supabase/functions/_shared/contact-nba.test.ts
```
Expected: PASS (tous les cas).

- [ ] **Step 6 : Commit**

```bash
git add supabase/functions/_shared/contact-nba.ts supabase/functions/_shared/contact-nba.test.ts vitest.config.ts
git commit -m "feat(nba): module pur contact-nba (parse défensif + libellés contrôlés + guardrail)"
```

---

### Task 2 : Migration SQL (cœur + wrapper + trigger + config)

**Files:**
- Create : `supabase/migrations/20260710200000_contact_nba_v1.sql`

- [ ] **Step 1 : Vérifier que le timestamp est libre**

```bash
ls supabase/migrations/ | grep 20260710
```
Expected: `…190000_whatsapp_insight_rolling_summary.sql` est le dernier ; `200000` est libre. (La PR #833, si mergée entre-temps, occupe `191000` — toujours libre.)

- [ ] **Step 2 : Écrire la migration**

Créer `supabase/migrations/20260710200000_contact_nba_v1.sql` :

```sql
-- Contact NBA v1 — « prochaine meilleure action » déterministe par contact,
-- cerveau partagé agent WhatsApp ⇄ copilote CRM.
-- Spec : docs/superpowers/plans/2026-07-10-contact-nba-v1.md (v1.1 post-revue adverse).
--
-- Contenu (idempotent, re-run sûr) :
--   1. touch_transactions_updated_at — pré-requis R4 : AUCUN chemin ne rafraîchit
--      transactions.updated_at aujourd'hui (pas de trigger ; wa_move_transaction_stage
--      ne SET que stage ; le front n'envoie que {stage, notes}) → sans ce trigger,
--      le proxy « deal qui stagne » serait cassé dans le sens MASQUANT.
--   2. contact_next_action(p_contact, p_agency) — fonction CŒUR, service_role only
--      (le paramètre EST le scope, patron calculate_contact_scores). Règles en
--      priorité ABSOLUE : rappel > offre expirante > visite (jour puis débrief) >
--      deal stagnant > matches à envoyer > relance dormance > aucune.
--      + kyc_note transverse : information FACULTATIVE, JAMAIS l'action (doctrine
--      KYC non-bloquant).
--   3. get_contact_next_action(p_contact) — wrapper JWT (agence dérivée de
--      get_user_agency_id(), zéro paramètre forgeable, patron focus_top_matches).
--      Deux portes, UNE logique (blocker B1).
--   4. app_config.contact_nba_v1 — tunables (COALESCE littéral : un JSON cassé ne
--      casse rien). match_gate ABSENT volontairement : R5 le lit en fallback depuis
--      today_focus_v1.thresholds.match_gate (une notion, un tunable).
--
-- ⚠ DATE-GUARD DEPLOY : la partie date de CE fichier doit être la date UTC du jour
-- du MERGE (deploy.yml n'applique que stamp_date >= TODAY). Re-stamper si la PR glisse.

-- ── 1. Trigger touch updated_at (pré-requis R4) ──────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_transactions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_transactions_updated_at ON public.transactions;
CREATE TRIGGER trg_touch_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.touch_transactions_updated_at();

-- ── 2. Fonction cœur ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.contact_next_action(p_contact uuid, p_agency uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
SET statement_timeout = '8s'
AS $$
DECLARE
  cfg jsonb := '{}'::jsonb;
  focus_cfg jsonb := '{}'::jsonb;
  v_dormant_days int;
  v_offer_window_days int;
  v_deal_stall_days int;
  v_debrief_days int;
  v_match_gate numeric;
  v_now timestamptz := now();
  v_sod timestamptz;   -- début de journée Europe/Zurich
  v_eod timestamptz;   -- fin de journée Europe/Zurich
  c RECORD;
  r RECORD;
  o RECORD;
  vi RECORD;
  tx RECORD;
  ky RECORD;
  m_count int;
  m_best numeric;
  v_kyc jsonb := NULL;
  v_action jsonb := NULL;
BEGIN
  IF p_contact IS NULL OR p_agency IS NULL THEN RETURN NULL; END IF;

  -- Tunables (un value non-JSON ne casse rien : exception → défauts littéraux)
  BEGIN
    SELECT value::jsonb INTO cfg FROM public.app_config WHERE key = 'contact_nba_v1';
  EXCEPTION WHEN others THEN cfg := '{}'::jsonb;
  END;
  BEGIN
    SELECT value::jsonb INTO focus_cfg FROM public.app_config WHERE key = 'today_focus_v1';
  EXCEPTION WHEN others THEN focus_cfg := '{}'::jsonb;
  END;
  cfg := COALESCE(cfg, '{}'::jsonb);
  focus_cfg := COALESCE(focus_cfg, '{}'::jsonb);

  v_dormant_days      := COALESCE((cfg->>'dormant_days')::int, 14);
  v_offer_window_days := COALESCE((cfg->>'offer_window_days')::int, 7);
  v_deal_stall_days   := COALESCE((cfg->>'deal_stall_days')::int, 14);
  v_debrief_days      := COALESCE((cfg->>'visit_debrief_window_days')::int, 21);
  -- match_gate : fallback sur le gate du radar Focus (une seule notion partagée)
  v_match_gate        := COALESCE((cfg->>'match_gate')::numeric,
                                  (focus_cfg->'thresholds'->>'match_gate')::numeric,
                                  70);

  -- Bornes de journée Europe/Zurich
  v_sod := date_trunc('day', v_now AT TIME ZONE 'Europe/Zurich') AT TIME ZONE 'Europe/Zurich';
  v_eod := v_sod + interval '1 day' - interval '1 second';

  -- Garde d'entrée : contact de CETTE agence, sinon NULL (pas de fuite d'existence)
  SELECT c2.id, c2.type, c2.last_interaction_at INTO c
  FROM public.contacts c2
  WHERE c2.id = p_contact AND c2.agency_id = p_agency;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- Note KYC transverse (JAMAIS une action) : dossier ouvert non terminal sur un
  -- deal closing-proximate. Information facultative.
  SELECT k2.status::text AS status, k2.completion_pct INTO ky
  FROM public.kyc_cases k2
  WHERE k2.contact_id = p_contact AND k2.agency_id = p_agency
    AND k2.status NOT IN ('validated', 'rejected')
    AND EXISTS (
      SELECT 1 FROM public.transactions t2
      WHERE t2.agency_id = p_agency
        AND (t2.contact_buyer_id = p_contact OR t2.contact_seller_id = p_contact)
        AND t2.status = 'active'
        AND t2.stage IN ('interest_confirmed','offer','negotiation','reserved','financing','notary','signed')
    )
  ORDER BY k2.created_at DESC
  LIMIT 1;
  IF FOUND THEN
    v_kyc := jsonb_build_object('status', ky.status, 'completion_pct', ky.completion_pct);
  END IF;

  -- R1 — Rappel échu ou du jour
  SELECT r2.id, r2.type, r2.trigger_at INTO r
  FROM public.reminders r2
  WHERE r2.contact_id = p_contact AND r2.agency_id = p_agency
    AND r2.status IN ('pending', 'triggered')
    AND r2.completed_at IS NULL
    AND r2.trigger_at <= v_eod
  ORDER BY r2.trigger_at ASC
  LIMIT 1;
  IF FOUND THEN
    v_action := jsonb_build_object(
      'action', 'rappel',
      'reason_key', CASE WHEN r.trigger_at < v_sod THEN 'reminder_overdue' ELSE 'reminder_today' END,
      'params', jsonb_build_object(
        'reminder_type', r.type,
        'days_overdue', GREATEST(0, floor(extract(epoch FROM (v_now - r.trigger_at)) / 86400))::int,
        'reminder_id', r.id),
      'due_at', to_jsonb(r.trigger_at));
  END IF;

  -- R2 — Offre en attente proche d'échéance (lien contact via transaction_id)
  IF v_action IS NULL THEN
    SELECT o2.id, o2.amount, o2.expires_at INTO o
    FROM public.crm_offers o2
    JOIN public.transactions t2 ON t2.id = o2.transaction_id AND t2.agency_id = p_agency
    WHERE o2.agency_id = p_agency AND o2.status = 'pending'
      AND (t2.contact_buyer_id = p_contact OR t2.contact_seller_id = p_contact)
      AND o2.expires_at IS NOT NULL   -- défensif (NOT NULL au schéma live)
      AND o2.expires_at <= v_now + make_interval(days => v_offer_window_days)
    ORDER BY o2.expires_at ASC
    LIMIT 1;
    IF FOUND THEN
      v_action := jsonb_build_object(
        'action', 'offre_expirante',
        'reason_key', 'offer_expiring',
        'params', jsonb_build_object(
          'amount', o.amount,
          'days_left', floor(extract(epoch FROM (o.expires_at - v_now)) / 86400)::int,
          'offer_id', o.id),
        'due_at', to_jsonb(o.expires_at));
    END IF;
  END IF;

  -- R3a — Visite à venir AUJOURD'HUI (Europe/Zurich)
  IF v_action IS NULL THEN
    SELECT v2.id, v2.scheduled_at INTO vi
    FROM public.visits v2
    WHERE v2.contact_id = p_contact AND v2.agency_id = p_agency
      AND v2.status IN ('planned', 'confirmed')
      AND v2.scheduled_at >= v_now
      AND (v2.scheduled_at AT TIME ZONE 'Europe/Zurich')::date = (v_now AT TIME ZONE 'Europe/Zurich')::date
    ORDER BY v2.scheduled_at ASC
    LIMIT 1;
    IF FOUND THEN
      v_action := jsonb_build_object(
        'action', 'visite_preparer', 'reason_key', 'visit_today',
        'params', jsonb_build_object('visit_id', vi.id, 'scheduled_at', vi.scheduled_at),
        'due_at', to_jsonb(vi.scheduled_at));
    END IF;
  END IF;

  -- R3b — Visite passée non clôturée (fenêtre bornée — pas de débrief antique)
  IF v_action IS NULL THEN
    SELECT v2.id, v2.scheduled_at INTO vi
    FROM public.visits v2
    WHERE v2.contact_id = p_contact AND v2.agency_id = p_agency
      AND ((v2.status IN ('planned', 'confirmed') AND v2.scheduled_at < v_now)
        OR (v2.status = 'done' AND v2.rapport IS NULL
            AND (v2.feedback_agent IS NULL OR btrim(v2.feedback_agent) = '')))
      AND v2.scheduled_at >= v_now - make_interval(days => v_debrief_days)
    ORDER BY v2.scheduled_at DESC
    LIMIT 1;
    IF FOUND THEN
      v_action := jsonb_build_object(
        'action', 'visite_debrief', 'reason_key', 'visit_debrief',
        'params', jsonb_build_object('visit_id', vi.id, 'scheduled_at', vi.scheduled_at),
        'due_at', to_jsonb(vi.scheduled_at));
    END IF;
  END IF;

  -- R4 — Deal actif qui stagne (proxy updated_at, rendu VIVANT par le trigger §1)
  IF v_action IS NULL THEN
    SELECT t2.id, t2.stage::text AS stage, t2.updated_at INTO tx
    FROM public.transactions t2
    WHERE t2.agency_id = p_agency
      AND (t2.contact_buyer_id = p_contact OR t2.contact_seller_id = p_contact)
      AND t2.status = 'active'
      AND t2.stage NOT IN ('signed', 'closed', 'lost', 'to_recontact')
      AND t2.updated_at < v_now - make_interval(days => v_deal_stall_days)
    ORDER BY t2.updated_at ASC
    LIMIT 1;
    IF FOUND THEN
      v_action := jsonb_build_object(
        'action', 'deal_stagnant', 'reason_key', 'deal_stalled',
        'params', jsonb_build_object(
          'stage', tx.stage,
          'days_stalled', floor(extract(epoch FROM (v_now - tx.updated_at)) / 86400)::int,
          'transaction_id', tx.id),
        'due_at', NULL);
    END IF;
  END IF;

  -- R5 — Matches à envoyer (index partiel idx_matches_agency_focus)
  IF v_action IS NULL THEN
    SELECT count(*)::int, max(m2.score) INTO m_count, m_best
    FROM public.matches m2
    WHERE m2.contact_id = p_contact AND m2.agency_id = p_agency
      AND m2.status = 'suggested' AND m2.response_at IS NULL
      AND (m2.snoozed_until IS NULL OR m2.snoozed_until <= v_now)
      AND m2.score >= v_match_gate;
    IF m_count > 0 THEN
      v_action := jsonb_build_object(
        'action', 'match_a_envoyer', 'reason_key', 'matches_to_send',
        'params', jsonb_build_object('count', m_count, 'best_score', m_best, 'gate', v_match_gate),
        'due_at', NULL);
    END IF;
  END IF;

  -- R6 — Relance dormance (whitelist = les 7 types de contacts_type_check)
  IF v_action IS NULL
     AND c.type IN ('buyer', 'seller', 'tenant', 'landlord', 'investor', 'both', 'lead') THEN
    IF c.last_interaction_at IS NULL THEN
      v_action := jsonb_build_object(
        'action', 'relance', 'reason_key', 'never_contacted',
        'params', jsonb_build_object('never', true),
        'due_at', NULL);
    ELSIF c.last_interaction_at < v_now - make_interval(days => v_dormant_days) THEN
      v_action := jsonb_build_object(
        'action', 'relance', 'reason_key', 'dormant',
        'params', jsonb_build_object(
          'days_dormant', floor(extract(epoch FROM (v_now - c.last_interaction_at)) / 86400)::int),
        'due_at', NULL);
    END IF;
  END IF;

  -- R7 — Rien (zéro honnête)
  IF v_action IS NULL THEN
    v_action := jsonb_build_object(
      'action', 'aucune', 'reason_key', 'none',
      'params', '{}'::jsonb, 'due_at', NULL);
  END IF;

  RETURN v_action || jsonb_build_object(
    'version', 1,
    'kyc_note', COALESCE(v_kyc, 'null'::jsonb),
    'computed_at', v_now);
END;
$$;

REVOKE ALL ON FUNCTION public.contact_next_action(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.contact_next_action(uuid, uuid) TO service_role;

-- ── 3. Wrapper JWT ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_contact_next_action(p_contact uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_agency uuid;
BEGIN
  v_agency := public.get_user_agency_id();
  IF v_agency IS NULL THEN RETURN NULL; END IF;
  RETURN public.contact_next_action(p_contact, v_agency);
END;
$$;

REVOKE ALL ON FUNCTION public.get_contact_next_action(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_contact_next_action(uuid) TO authenticated, service_role;

-- ── 4. Tunables ──────────────────────────────────────────────────────────────
INSERT INTO public.app_config (key, value)
VALUES ('contact_nba_v1',
        '{"dormant_days":14,"offer_window_days":7,"deal_stall_days":14,"visit_debrief_window_days":21,"version":1}')
ON CONFLICT (key) DO NOTHING;
```

- [ ] **Step 3 : Commit**

```bash
git add supabase/migrations/20260710200000_contact_nba_v1.sql
git commit -m "feat(nba): RPC contact_next_action (coeur service-role + wrapper JWT) + trigger touch transactions.updated_at + tunables"
```

---

### Task 3 : Câblage `execGetContactBrief` (+ `rolling_summary`)

**Files:**
- Modify : `supabase/functions/_shared/whatsapp-actions.ts` (imports ~l.17-30 ; `execGetContactBrief` ~l.225-245)

- [ ] **Step 1 : Ajouter l'import**

Dans le bloc d'imports de `whatsapp-actions.ts` (après la ligne `import { logDeepSeekUsageWith } from './ai-usage.ts'`) :

```ts
import { parseNextAction, formatNextAction, formatKycNote } from './contact-nba.ts'
```

- [ ] **Step 2 : Étendre le SELECT insight avec `rolling_summary`**

Dans `execGetContactBrief`, remplacer la ligne :

```ts
    .select('summary, intent, sentiment, urgency, language, objections, next_action, commitments, source_message_count, generated_at')
```
par :
```ts
    .select('summary, rolling_summary, intent, sentiment, urgency, language, objections, next_action, commitments, source_message_count, generated_at')
```

- [ ] **Step 3 : Ajouter l'appel NBA best-effort + le champ de sortie**

Toujours dans `execGetContactBrief`, remplacer la ligne de retour :

```ts
  return JSON.stringify({ contact: c, recherches_actives: searches ?? [], timeline: timeline ?? [], comprehension: insight ?? null })
```

par :

```ts
  // NBA déterministe (cerveau partagé WhatsApp ⇄ copilote) — best-effort : ne casse
  // JAMAIS le brief. supabase.rpc() ne throw pas → on consulte `error` explicitement
  // (le try/catch n'est qu'un filet réseau).
  let nextActionEstimee: Record<string, unknown> | null = null
  try {
    const { data: nbaRaw, error: nbaErr } = await ctx.supabase.rpc('contact_next_action', {
      p_contact: c.id,
      p_agency: ctx.agencyId,
    })
    if (nbaErr) {
      console.error('contact_next_action rpc failed')
    } else {
      const nba = parseNextAction(nbaRaw)
      if (nba) {
        nextActionEstimee = {
          action: nba.action,
          label: formatNextAction(nba, ctx.lang ?? 'fr'),
          due_at: nba.dueAt,
          kyc_note: nba.kycNote ? formatKycNote(nba.kycNote, ctx.lang ?? 'fr') : null,
        }
      }
    }
  } catch (_e) {
    console.error('contact_next_action threw')
  }
  return JSON.stringify({
    contact: c,
    recherches_actives: searches ?? [],
    timeline: timeline ?? [],
    comprehension: insight ?? null,
    next_action_estimee: nextActionEstimee,
  })
```

- [ ] **Step 4 : Commit**

```bash
git add supabase/functions/_shared/whatsapp-actions.ts
git commit -m "feat(nba): get_contact_brief expose next_action_estimee + rolling_summary (les 2 agents)"
```

---

### Task 4 : Câblage `execPrepareMeeting`

**Files:**
- Modify : `supabase/functions/_shared/whatsapp-actions.ts` (`execPrepareMeeting` ~l.2149-2290)

- [ ] **Step 1 : Étendre le SELECT insight + le type local**

Remplacer :
```ts
  const { data: insightRow } = await ctx.supabase.from('whatsapp_conversation_insights')
    .select('summary, intent, sentiment, urgency, language, objections, next_action, commitments')
```
par :
```ts
  const { data: insightRow } = await ctx.supabase.from('whatsapp_conversation_insights')
    .select('summary, rolling_summary, intent, sentiment, urgency, language, objections, next_action, commitments')
```
et dans le type inline `const insight = insightRow as { … } | null`, ajouter le champ :
```ts
    summary: string | null; rolling_summary: string | null; intent: string | null; sentiment: string | null
```
(remplace la première ligne du type ; le reste est inchangé).

- [ ] **Step 2 : Récupérer le NBA (même bloc best-effort)**

Juste APRÈS le bloc « 4. Visite à venir » (après la résolution de `visitTitle`) et AVANT « 5. Où on en est », insérer :

```ts
  // 4bis. NBA déterministe (cerveau partagé) — best-effort, jamais bloquant.
  let nbaLabel: string | null = null
  let nbaKycNote: string | null = null
  try {
    const { data: nbaRaw, error: nbaErr } = await ctx.supabase.rpc('contact_next_action', {
      p_contact: contact.id,
      p_agency: ctx.agencyId,
    })
    if (nbaErr) {
      console.error('contact_next_action rpc failed')
    } else {
      const nba = parseNextAction(nbaRaw)
      if (nba && nba.reasonKey !== 'none') nbaLabel = formatNextAction(nba, lang)
      if (nba?.kycNote) nbaKycNote = formatKycNote(nba.kycNote, lang)
    }
  } catch (_e) {
    console.error('contact_next_action threw')
  }
```

- [ ] **Step 3 : Étiquetage distinct + préséance dans le contexte DeepSeek**

Dans le bloc `ctxLines` :

a) après la ligne `if (insight?.summary) ctxLines.push(...)`, ajouter :
```ts
    if (insight?.rolling_summary) ctxLines.push(`Mémoire longue de la conversation : ${insight.rolling_summary}`)
```

b) remplacer :
```ts
    if (nextActionLabel) ctxLines.push(`Prochaine action suggérée : ${nextActionLabel}`)
```
par :
```ts
    if (nbaLabel) ctxLines.push(`Prochaine action (dossier, estimation interne) : ${nbaLabel}`)
    if (nbaKycNote) ctxLines.push(`Conformité (jamais bloquant) : ${nbaKycNote}`)
    if (nextActionLabel) ctxLines.push(`Piste évoquée en conversation : ${nextActionLabel}`)
```

- [ ] **Step 4 : Commit**

```bash
git add supabase/functions/_shared/whatsapp-actions.ts
git commit -m "feat(nba): prepare_meeting ancre les 3 points sur le NBA déterministe (+ mémoire longue)"
```

---

### Task 5 : Guardrail prompt (2 agents) + description d'outil

**Files:**
- Modify : `supabase/functions/whatsapp-agent/index.ts` (imports + `systemStable` ~l.176)
- Modify : `supabase/functions/_shared/copilot-tools.ts` (import + `copilotToolsBlock`)
- Modify : `supabase/functions/_shared/whatsapp-tools.ts:96` (description `get_contact_brief`)

- [ ] **Step 1 : whatsapp-agent — injecter le guardrail après `antiFabBlock`**

Dans `supabase/functions/whatsapp-agent/index.ts` :

a) ajouter l'import (près des autres imports `_shared`) :
```ts
import { NBA_PROMPT_GUARDRAIL } from '../_shared/contact-nba.ts'
```

b) juste après la déclaration de `antiFabBlock` (la longue template string), ajouter :
```ts
  const nbaGuardrailBlock = `\n\n${NBA_PROMPT_GUARDRAIL}`
```

c) dans la template `systemStable` (l.~176), remplacer `${antiFabBlock}` par `${antiFabBlock}${nbaGuardrailBlock}` (fin de template inchangée).

- [ ] **Step 2 : copilot-tools — même guardrail dans le bloc outils**

Dans `supabase/functions/_shared/copilot-tools.ts` :

a) ajouter l'import en tête :
```ts
import { NBA_PROMPT_GUARDRAIL } from './contact-nba.ts'
```

b) dans `copilotToolsBlock(...)`, remplacer :
```ts
  let block = TOOLS_BLOCK_BASE
```
par :
```ts
  let block = TOOLS_BLOCK_BASE + `\n- ${NBA_PROMPT_GUARDRAIL}`
```

- [ ] **Step 3 : Description d'outil `get_contact_brief`**

Dans `supabase/functions/_shared/whatsapp-tools.ts` (l.96), remplacer la description par :

```ts
      description: "Fiche synthétique d'un contact (infos, critères, 5 dernières actions) + compréhension de la dernière conversation WhatsApp (résumé, mémoire longue, piste évoquée en conversation) + prochaine action du dossier (next_action_estimee, estimation déterministe interne). Pour « résume Dubois », « où en est X », « rédige une réponse pour X ». contact_id via search_contacts.",
```

- [ ] **Step 4 : Vérifier que les tests unit existants ne cassent pas**

```bash
npx vitest run supabase/functions/_shared/copilot-tools.test.ts supabase/functions/_shared/agent-loop.test.ts
```
Expected: PASS. Si `copilot-tools.test.ts` asserte le contenu exact du bloc (fin de chaîne), ajuster l'assertion pour tolérer/attendre la nouvelle puce guardrail (c'est un ajout voulu).

- [ ] **Step 5 : Commit**

```bash
git add supabase/functions/whatsapp-agent/index.ts supabase/functions/_shared/copilot-tools.ts supabase/functions/_shared/whatsapp-tools.ts
git commit -m "feat(nba): guardrail anti-initiative dans les prompts des 2 agents + description outil"
```

---

### Task 6 : `deno check` + suite unit complète

**Files:** aucun (vérification)

- [ ] **Step 1 : deno check comme la CI**

```bash
cd /Users/megga/Desktop/megga-real-estate/.claude/worktrees/whatsapp-crm-agent-memory-91472a
files=$(find supabase/functions -name '*.ts' ! -name '*.test.ts')
deno check --no-lock $files
```
Expected: 0 erreur. (Si `deno` absent localement : noter que la CI le fera, mais tenter `brew install deno` d'abord — le gate est BLOQUANT en CI.)

- [ ] **Step 2 : suite unit complète**

```bash
npm run test:unit
```
Expected: tout vert (dont `contact-nba.test.ts`).

---

### Task 7 : Backend spec live `tests/backend/contact-nba.spec.ts`

**Files:**
- Create : `tests/backend/contact-nba.spec.ts`

> Couvre N1-N22 de la spec §9.2 (certains cas fusionnés). Patron : `setupTwoAgencies()` + seeds service-role + cleanup dans `afterAll`. ⚠ Ne JAMAIS insérer de `client_searches` (trigger `net.http_post` → piège CI contact-scores). ⚠ `visits.property_id` est NOT NULL → un bien est seedé pour les visites.

- [ ] **Step 1 : Écrire le spec**

Créer `tests/backend/contact-nba.spec.ts` :

```ts
// Backend test (live CI) — Contact NBA v1 : RPC contact_next_action (coeur) +
// get_contact_next_action (wrapper JWT) + trigger touch_transactions_updated_at
// (migration 20260710200000_contact_nba_v1.sql).
//
// skipIf(!HAS_KEYS) ne SKIP PAS en CI : tourne contre un Supabase local seedé.
// Couvre la spec §9.2 (N1-N22) : priorité absolue, gates/exclusions matches,
// dormance (never/dated, 7 types), débrief + fenêtre 21 j, deal stagnant + proxy
// vivant (trigger touch), offre via transaction_id + fenêtre, kyc_note jamais
// l'action, isolation agence ET par-contact, permissions (coeur service-role only,
// wrapper happy-path ≡ coeur), tunable live.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'
const ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY ?? ''

interface Nba {
  action: string
  reason_key: string
  params: Record<string, unknown>
  due_at: string | null
  kyc_note: Record<string, unknown> | null
  version: number
}

const DAY = 86_400_000
const iso = (deltaMs: number): string => new Date(Date.now() + deltaMs).toISOString()

describe.skipIf(!HAS_KEYS)('contact_next_action — NBA v1 (live + isolation)', () => {
  let setup: TwoAgenciesSetup
  let svc: SupabaseClient
  let propId = ''
  const contactIds: string[] = []
  let nbaCfgBefore: { had: boolean; value: string } = { had: false, value: '' }

  const core = async (contact: string, agency: string): Promise<Nba | null> => {
    const { data, error } = await svc.rpc('contact_next_action', { p_contact: contact, p_agency: agency })
    if (error) throw new Error(`core: ${error.message}`)
    return data as Nba | null
  }

  const mkContact = async (opts: {
    type?: string | null
    lastInteraction?: string | null
  } = {}): Promise<string> => {
    const { data, error } = await svc.from('contacts').insert({
      agency_id: setup.agencyAId,
      first_name: 'NBA', last_name: `QA-${contactIds.length}-${setup.stamp}`,
      type: opts.type === undefined ? 'buyer' : opts.type,
      last_interaction_at: opts.lastInteraction === undefined ? null : opts.lastInteraction,
    }).select('id').single()
    if (error) throw new Error(`contact: ${error.message}`)
    contactIds.push(data.id)
    return data.id
  }

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    svc = serviceRoleClient()

    // sauvegarde du tunable (restauré en afterAll)
    const { data: cfg } = await svc.from('app_config').select('value').eq('key', 'contact_nba_v1').maybeSingle()
    nbaCfgBefore = cfg ? { had: true, value: cfg.value as string } : { had: false, value: '' }

    // bien support (visites NOT NULL property_id + matches internal)
    const { data: prop, error: pErr } = await svc.from('properties').insert({
      agency_id: setup.agencyAId, title: `NBA QA bien ${setup.stamp}`,
      type: 'apartment', status: 'draft', price: 900_000, rooms: 4, surface_m2: 100,
      city: 'Genève', canton: 'GE', photos: ['https://example.test/p.jpg'],
    }).select('id').single()
    if (pErr) throw new Error(`property: ${pErr.message}`)
    propId = prop.id
  }, 60_000)

  afterAll(async () => {
    if (!svc) return
    if (contactIds.length) {
      await svc.from('matches').delete().in('contact_id', contactIds)
      await svc.from('reminders').delete().in('contact_id', contactIds)
      await svc.from('visits').delete().in('contact_id', contactIds)
      await svc.from('kyc_cases').delete().in('contact_id', contactIds)
      const { data: txs } = await svc.from('transactions').select('id').in('contact_buyer_id', contactIds)
      const txIds = (txs ?? []).map((t: { id: string }) => t.id)
      if (txIds.length) await svc.from('crm_offers').delete().in('transaction_id', txIds)
      await svc.from('transactions').delete().in('contact_buyer_id', contactIds)
      await svc.from('contacts').delete().in('id', contactIds)
    }
    if (propId) await svc.from('properties').delete().eq('id', propId)
    if (nbaCfgBefore.had) await svc.from('app_config').update({ value: nbaCfgBefore.value }).eq('key', 'contact_nba_v1')
    await setup.cleanup()
  }, 60_000)

  // N4 — jamais recontacté → relance/never_contacted
  it('N4: contact jamais recontacté → relance / never_contacted', async () => {
    const c = await mkContact({ lastInteraction: null })
    const nba = await core(c, setup.agencyAId)
    expect(nba?.action).toBe('relance')
    expect(nba?.reason_key).toBe('never_contacted')
  })

  // N5 — dormance datée → relance/dormant
  it('N5: dormance 30 j → relance / dormant (days_dormant ≥ 14)', async () => {
    const c = await mkContact({ lastInteraction: iso(-30 * DAY) })
    const nba = await core(c, setup.agencyAId)
    expect(nba?.action).toBe('relance')
    expect(nba?.reason_key).toBe('dormant')
    expect(Number(nba?.params.days_dormant)).toBeGreaterThanOrEqual(14)
  })

  // N6 — rien → aucune
  it('N6: contact frais sans signal → aucune / none', async () => {
    const c = await mkContact({ lastInteraction: iso(-1 * DAY) })
    const nba = await core(c, setup.agencyAId)
    expect(nba?.action).toBe('aucune')
    expect(nba?.reason_key).toBe('none')
    expect(nba?.kyc_note).toBeNull()
  })

  // N22 — type investor couvert (whitelist 7 types)
  it('N22: contact investor jamais recontacté → relance', async () => {
    const c = await mkContact({ type: 'investor', lastInteraction: null })
    const nba = await core(c, setup.agencyAId)
    expect(nba?.action).toBe('relance')
  })

  // N1 + N21 — priorité absolue rappel > match ; départage plus ancien
  it('N1/N21: rappel échu prime sur matches ; le plus ancien trigger_at gagne', async () => {
    const c = await mkContact({ lastInteraction: iso(-1 * DAY) })
    const { error: mErr } = await svc.from('matches').insert({
      agency_id: setup.agencyAId, contact_id: c, score: 90, source: 'internal',
      status: 'suggested', property_id: propId,
      reasons: { budget: { match: true } },
    })
    if (mErr) throw new Error(`match: ${mErr.message}`)
    const mkRem = async (delta: number, type: string) => {
      const { error } = await svc.from('reminders').insert({
        agency_id: setup.agencyAId, contact_id: c, type, trigger_rule: 'nba_qa',
        status: 'triggered', trigger_at: iso(delta),
      })
      if (error) throw new Error(`reminder: ${error.message}`)
    }
    await mkRem(-2 * DAY, 'dormant_lead')      // le plus ancien → doit gagner
    await mkRem(-1 * DAY, 'missing_document')
    const nba = await core(c, setup.agencyAId)
    expect(nba?.action).toBe('rappel')
    expect(nba?.reason_key).toBe('reminder_overdue')
    expect(nba?.params.reminder_type).toBe('dormant_lead')
    expect(Number(nba?.params.days_overdue)).toBeGreaterThanOrEqual(2)
  })

  // N2/N3 — gates matches : sous le gate / response_at / snooze futur → exclus
  it('N2/N3: matches sous gate, répondus ou snoozés → pas match_a_envoyer', async () => {
    const c = await mkContact({ lastInteraction: iso(-1 * DAY) })
    const mk = async (over: Record<string, unknown>) => {
      const { error } = await svc.from('matches').insert({
        agency_id: setup.agencyAId, contact_id: c, source: 'internal',
        status: 'suggested', property_id: propId, reasons: {},
        ...over,
      })
      if (error) throw new Error(`match: ${error.message}`)
    }
    // ⚠ uq_matches_contact_property : UN SEUL match (contact, bien) à la fois →
    // on teste les 3 exclusions séquentiellement (delete entre chaque).
    await mk({ score: 60 })                                        // sous le gate 70
    const nba1 = await core(c, setup.agencyAId)
    expect(nba1?.action).toBe('aucune')
    await svc.from('matches').delete().eq('contact_id', c)
    await mk({ score: 90, response_at: iso(-1 * DAY) })            // répondu → exclu
    const nba2 = await core(c, setup.agencyAId)
    expect(nba2?.action).toBe('aucune')
    await svc.from('matches').delete().eq('contact_id', c)
    await mk({ score: 85, snoozed_until: iso(+2 * DAY) })          // snoozé (futur) → exclu
    const nba3 = await core(c, setup.agencyAId)
    expect(nba3?.action).toBe('aucune')
  })

  // R5 positif
  it('R5: match ≥ gate ouvert → match_a_envoyer avec count/best_score', async () => {
    const c = await mkContact({ lastInteraction: iso(-1 * DAY) })
    const { error } = await svc.from('matches').insert({
      agency_id: setup.agencyAId, contact_id: c, score: 88, source: 'internal',
      status: 'suggested', property_id: propId, reasons: {},
    })
    if (error) throw new Error(`match: ${error.message}`)
    const nba = await core(c, setup.agencyAId)
    expect(nba?.action).toBe('match_a_envoyer')
    expect(Number(nba?.params.count)).toBe(1)
    expect(Number(nba?.params.best_score)).toBe(88)
  })

  // N12 + N16 + N17 — visites
  it('N12: visite aujourd\'hui prime sur deal stagnant', async () => {
    const c = await mkContact({ lastInteraction: iso(-1 * DAY) })
    const { error: tErr } = await svc.from('transactions').insert({
      agency_id: setup.agencyAId, contact_buyer_id: c, property_id: propId,
      stage: 'offer', status: 'active', updated_at: iso(-30 * DAY),
    })
    if (tErr) throw new Error(`tx: ${tErr.message}`)
    const { error: vErr } = await svc.from('visits').insert({
      agency_id: setup.agencyAId, contact_id: c, property_id: propId,
      scheduled_at: iso(5 * 60_000), status: 'planned',
    })
    if (vErr) throw new Error(`visit: ${vErr.message}`)
    const nba = await core(c, setup.agencyAId)
    expect(nba?.action).toBe('visite_preparer')
    expect(nba?.reason_key).toBe('visit_today')
  })

  it('N16/N17: débrief dans la fenêtre 21 j, exclu au-delà', async () => {
    const cIn = await mkContact({ lastInteraction: iso(-1 * DAY) })
    const { error: v1 } = await svc.from('visits').insert({
      agency_id: setup.agencyAId, contact_id: cIn, property_id: propId,
      scheduled_at: iso(-3 * DAY), status: 'done', rapport: null, feedback_agent: null,
    })
    if (v1) throw new Error(`visit-in: ${v1.message}`)
    const nbaIn = await core(cIn, setup.agencyAId)
    expect(nbaIn?.action).toBe('visite_debrief')

    const cOut = await mkContact({ lastInteraction: iso(-1 * DAY) })
    const { error: v2 } = await svc.from('visits').insert({
      agency_id: setup.agencyAId, contact_id: cOut, property_id: propId,
      scheduled_at: iso(-30 * DAY), status: 'done', rapport: null, feedback_agent: null,
    })
    if (v2) throw new Error(`visit-out: ${v2.message}`)
    const nbaOut = await core(cOut, setup.agencyAId)
    expect(nbaOut?.action).toBe('aucune')
  })

  // N14 + N15 — deal stagnant + proxy vivant (trigger touch)
  it('N14/N15: deal immobile > 14 j → deal_stagnant ; bougé (UPDATE stage) → plus stagnant', async () => {
    const c = await mkContact({ lastInteraction: iso(-1 * DAY) })
    const { data: tx, error: tErr } = await svc.from('transactions').insert({
      agency_id: setup.agencyAId, contact_buyer_id: c, property_id: propId,
      stage: 'qualified', status: 'active', updated_at: iso(-30 * DAY),
    }).select('id').single()
    if (tErr) throw new Error(`tx: ${tErr.message}`)
    const nba1 = await core(c, setup.agencyAId)
    expect(nba1?.action).toBe('deal_stagnant')
    expect(Number(nba1?.params.days_stalled)).toBeGreaterThanOrEqual(14)
    // UPDATE → trigger touch_transactions_updated_at rafraîchit updated_at
    const { error: uErr } = await svc.from('transactions').update({ stage: 'visit_planned' }).eq('id', tx.id)
    if (uErr) throw new Error(`tx update: ${uErr.message}`)
    const nba2 = await core(c, setup.agencyAId)
    expect(nba2?.action).not.toBe('deal_stagnant')
  })

  // N13 + N20 — offre via transaction_id + fenêtre
  it('N13/N20: offre pending J+2 → offre_expirante ; J+30 → non', async () => {
    const c = await mkContact({ lastInteraction: iso(-1 * DAY) })
    const { data: tx, error: tErr } = await svc.from('transactions').insert({
      agency_id: setup.agencyAId, contact_buyer_id: c, property_id: propId,
      stage: 'offer', status: 'active',
    }).select('id').single()
    if (tErr) throw new Error(`tx: ${tErr.message}`)
    const mkOffer = async (expiresAt: string) => {
      const { data, error } = await svc.from('crm_offers').insert({
        agency_id: setup.agencyAId, transaction_id: tx.id, status: 'pending',
        kind: 'offer', from_party: 'buyer', by_label: 'NBA QA', amount: 850_000,
        expires_at: expiresAt,
      }).select('id').single()
      if (error) throw new Error(`offer: ${error.message}`)
      return data.id
    }
    const far = await mkOffer(iso(30 * DAY))
    const nbaFar = await core(c, setup.agencyAId)
    expect(nbaFar?.action).not.toBe('offre_expirante')   // N20 (le deal frais → pas stagnant non plus)
    await mkOffer(iso(2 * DAY))
    const nbaNear = await core(c, setup.agencyAId)
    expect(nbaNear?.action).toBe('offre_expirante')       // N13
    expect(Number(nbaNear?.params.amount)).toBe(850_000)
    await svc.from('crm_offers').delete().in('id', [far])
  })

  // N10 — kyc_note jamais l'action
  it('N10: KYC ouvert sur deal closing-proximate → kyc_note remplie, action ≠ kyc', async () => {
    const c = await mkContact({ lastInteraction: iso(-1 * DAY) })
    const { error: tErr } = await svc.from('transactions').insert({
      agency_id: setup.agencyAId, contact_buyer_id: c, property_id: propId,
      stage: 'offer', status: 'active',
    })
    if (tErr) throw new Error(`tx: ${tErr.message}`)
    const { error: kErr } = await svc.from('kyc_cases').insert({
      agency_id: setup.agencyAId, contact_id: c, type: 'buyer_pp', status: 'pending',
    })
    if (kErr) throw new Error(`kyc: ${kErr.message}`)
    const nba = await core(c, setup.agencyAId)
    expect(nba?.kyc_note).not.toBeNull()
    expect((nba?.kyc_note as Record<string, unknown>).status).toBe('pending')
    expect(['rappel', 'offre_expirante', 'visite_preparer', 'visite_debrief',
      'deal_stagnant', 'match_a_envoyer', 'relance', 'aucune']).toContain(nba?.action)
  })

  // N7 + N18 — isolations
  it('N7: coeur avec la mauvaise agence → null (pas de fuite d\'existence)', async () => {
    const c = await mkContact({})
    const nba = await core(c, setup.agencyBId)
    expect(nba).toBeNull()
  })

  it('N18: signaux d\'un AUTRE contact de la même agence → aucune pour p_contact', async () => {
    const cSignal = await mkContact({ lastInteraction: iso(-1 * DAY) })
    const cQuiet = await mkContact({ lastInteraction: iso(-1 * DAY) })
    const { error } = await svc.from('reminders').insert({
      agency_id: setup.agencyAId, contact_id: cSignal, type: 'dormant_lead',
      trigger_rule: 'nba_qa', status: 'triggered', trigger_at: iso(-1 * DAY),
    })
    if (error) throw new Error(`reminder: ${error.message}`)
    const nba = await core(cQuiet, setup.agencyAId)
    expect(nba?.action).toBe('aucune')
  })

  // N9 + N19 + N8 — permissions & dual-mode
  it('N9: authenticated ne peut PAS appeler le coeur (permission denied)', async () => {
    const c = await mkContact({})
    const { error } = await setup.clientA.rpc('contact_next_action', {
      p_contact: c, p_agency: setup.agencyAId,
    })
    expect(error).toBeTruthy()
  })

  it('N19: wrapper happy-path ≡ coeur (deux portes, une logique)', async () => {
    const c = await mkContact({ lastInteraction: null })
    const viaCore = await core(c, setup.agencyAId)
    const { data: viaWrapper, error } = await setup.clientA.rpc('get_contact_next_action', { p_contact: c })
    expect(error).toBeNull()
    const w = viaWrapper as Nba | null
    expect(w?.action).toBe(viaCore?.action)
    expect(w?.reason_key).toBe(viaCore?.reason_key)
  })

  it('N8: wrapper avec JWT sans agence → null', async () => {
    const email = `nba-orphan-${setup.stamp}@megga-test.local`
    const { data: u, error: uErr } = await svc.auth.admin.createUser({
      email, password: 'Test-Password-123!', email_confirm: true,
    })
    if (uErr) throw new Error(`orphan user: ${uErr.message}`)
    const orphan = createClient(URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    const { error: sErr } = await orphan.auth.signInWithPassword({ email, password: 'Test-Password-123!' })
    if (sErr) throw new Error(`orphan signin: ${sErr.message}`)
    const c = await mkContact({})
    const { data, error } = await orphan.rpc('get_contact_next_action', { p_contact: c })
    expect(error).toBeNull()
    expect(data).toBeNull()
    await svc.auth.admin.deleteUser(u.user.id)
  })

  // N11 — tunable live
  it('N11: dormant_days abaissé à 3 via app_config → dormance 5 j détectée', async () => {
    const c = await mkContact({ lastInteraction: iso(-5 * DAY) })
    const before = await core(c, setup.agencyAId)
    expect(before?.action).toBe('aucune')   // 5 j < défaut 14
    await svc.from('app_config').upsert(
      { key: 'contact_nba_v1', value: '{"dormant_days":3,"version":1}' },
      { onConflict: 'key' },
    )
    const after = await core(c, setup.agencyAId)
    expect(after?.action).toBe('relance')
    expect(after?.reason_key).toBe('dormant')
    // restauration immédiate (les autres tests dépendent du défaut 14)
    if (nbaCfgBefore.had) await svc.from('app_config').update({ value: nbaCfgBefore.value }).eq('key', 'contact_nba_v1')
    else await svc.from('app_config').update({ value: '{"dormant_days":14,"offer_window_days":7,"deal_stall_days":14,"visit_debrief_window_days":21,"version":1}' }).eq('key', 'contact_nba_v1')
  })
})
```

- [ ] **Step 2 : Lancer localement (skipIf sans stack locale, PASS avec)**

```bash
npx vitest run tests/backend/contact-nba.spec.ts
```
Expected: `skipped` si pas de Supabase local, sinon tout vert. **La CI est le juge** (base fraîche + migrations).

- [ ] **Step 3 : Commit**

```bash
git add tests/backend/contact-nba.spec.ts
git commit -m "test(nba): spec backend live contact_next_action (priorités, gates, isolations, dual-mode, tunable)"
```

---

### Task 8 : Validation pré-merge sur la base réelle (BEGIN/ROLLBACK)

**Files:** aucun (validation via Supabase MCP, project_id `eayczugyrvmtqnnmvjod`)

> Objectif spec §9.3 : prouver que la migration s'applique et que le RPC ne throw sur AUCUN contact réel — **sans rien persister** (tout dans une transaction annulée).

- [ ] **Step 1 : Exécuter la migration + un balayage en transaction annulée**

Via l'outil Supabase MCP `execute_sql`, envoyer EN UNE SEULE requête : le contenu **intégral** du fichier `supabase/migrations/20260710200000_contact_nba_v1.sql`, suivi de :

```sql
DO $qa$
DECLARE
  rec RECORD;
  res jsonb;
  n int := 0;
BEGIN
  FOR rec IN SELECT id, agency_id FROM public.contacts WHERE agency_id IS NOT NULL LOOP
    res := public.contact_next_action(rec.id, rec.agency_id);
    IF res IS NULL THEN RAISE EXCEPTION 'NULL inattendu pour contact %', rec.id; END IF;
    RAISE NOTICE 'contact % -> % / %', rec.id, res->>'action', res->>'reason_key';
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'ALL_OK — % contacts balayés', n;
END
$qa$;
ROLLBACK;
```

en préfixant le tout par `BEGIN;`.

Expected: notices `contact … -> action / reason` pour les 12 contacts + `ALL_OK`, puis ROLLBACK (rien de persisté — vérifiable : `SELECT count(*) FROM pg_proc WHERE proname='contact_next_action'` doit rendre 0 après).

- [ ] **Step 2 : Vérifier la plausibilité de la distribution**

Attendu sur les données du 10.07 : majoritairement `relance` (never_contacted/dormant), `match_a_envoyer` (4 contacts à matches), `deal_stagnant` pour les contacts Rockwell liés aux 4 deals figés depuis mai (légitime : ils stagnent réellement), `aucune` pour le reste. Toute action `visite_*`/`offre_*` serait suspecte (tables vides) → investiguer avant de continuer.

---

### Task 9 : Build, re-stamp, push, PR

**Files:**
- Éventuellement Rename : `supabase/migrations/20260710200000_contact_nba_v1.sql`

- [ ] **Step 1 : Build + suites complètes (obligatoire avant push)**

```bash
npm run build && npm run lint && npm run test:unit
```
Expected: build OK (tsc -b), lint OK, unit vert.

- [ ] **Step 2 : Re-stamp de la migration si nécessaire (piège date-guard)**

Si la date UTC du jour du merge ≠ `20260710` :
```bash
# exemple si merge le 11.07 UTC :
git mv supabase/migrations/20260710200000_contact_nba_v1.sql supabase/migrations/20260711090000_contact_nba_v1.sql
# puis mettre à jour la référence dans tests/backend/contact-nba.spec.ts (commentaire d'en-tête)
```
Le deploy n'applique QUE les migrations `stamp_date >= jour UTC du merge` — un fichier daté d'hier n'est JAMAIS appliqué en prod (feature morte, CI verte). Si la PR reste ouverte plusieurs jours, re-stamper au moment du merge.

- [ ] **Step 3 : Push + PR**

```bash
git push -u origin claude/whatsapp-crm-agent-memory-91472a
gh pr create --title "feat(nba): contact_next_action v1 — prochaine action déterministe partagée WhatsApp × copilote" --body "$(cat <<'EOF'
## Contact NBA v1 — cerveau partagé (Vague 3)

Spec validée (revue adverse 3 lentilles, 5 mustFix intégrés) : docs/superpowers/plans/2026-07-10-contact-nba-v1.md

### Contenu
- RPC coeur `contact_next_action(p_contact, p_agency)` (service-role only, le param EST le scope) + wrapper JWT `get_contact_next_action` — deux portes, UNE logique (résout l'incompatibilité JWT vs service-role).
- 7 règles en priorité absolue : rappel échu > offre expirante > visite (jour/débrief) > deal stagnant > matches à envoyer > relance dormance > aucune. `kyc_note` transverse : information facultative, JAMAIS l'action (KYC non-bloquant).
- Trigger `touch_transactions_updated_at` (pré-requis : rien ne rafraîchissait `updated_at` → le proxy « deal stagnant » aurait masqué à perpétuité).
- Module pur `_shared/contact-nba.ts` : parse défensif + libellés contrôlés FR/EN (« estimation », zéro UUID, zéro tiret cadratin) + `NBA_PROMPT_GUARDRAIL` (anti-initiative outillée, injecté dans les prompts des 2 agents).
- Câblage additif : `get_contact_brief` (+ `next_action_estimee` + `rolling_summary`) et `prepare_meeting` (étiquetage « dossier » vs « piste conversationnelle », le déterministe cadre).
- Tunables `app_config.contact_nba_v1` ; `match_gate` en fallback sur `today_focus_v1.thresholds.match_gate` (une notion, un tunable).

### Garde-fous
- 0 LLM dans le tri ; le LLM ne fournit jamais la priorité.
- Aucun nouvel outil, aucun tier modifié, `canLeaveConfirm` intact.
- Multi-tenant : agence + contact scopés dans chaque sous-requête ; coeur inaccessible à `authenticated` (testé).

### Tests
- Unit : `_shared/contact-nba.test.ts` (parse, libellés FR/EN, anti-UUID, guardrail).
- Backend live : `tests/backend/contact-nba.spec.ts` (priorités, gates matches, dormance 7 types, débrief + fenêtre, proxy deal vivant via trigger, offre via transaction_id, kyc_note jamais l'action, isolation agence + par-contact, permissions + wrapper ≡ coeur, tunable live).
- Validation pré-merge : migration + balayage des 12 contacts prod en transaction ROLLBACK (ALL_OK).

⚠ Migration date-guardée : re-stamper au jour UTC du merge si la PR glisse.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4 : NE PAS merger**

Attendre : (1) CI verte — en particulier le job backend live et `deno check` ; (2) validation humaine (Julien). Re-run des jobs flaky connus (« Setup Supabase CLI: rate limit ») : `gh run rerun --failed`.

---

## Après merge (Vague 4 — ne pas oublier)

1. Mettre à jour le cerveau : éditer `.claude-flow/knowledge/megga-memory.seed.json` (nouveau noeud `megga/contact-nba` : RPC dual-mode, règles, tunables, trigger touch, guardrail ; MAJ `megga/whatsapp-agent-copilot` + `megga/copilot-engine` : get_contact_brief expose next_action_estimee + rolling_summary) + `docs/system-map.md` si besoin, puis `npm run ruflo:seed`.
2. Vérifier post-deploy que la migration est bien appliquée en PROD (piège date-guard) : `SELECT proname FROM pg_proc WHERE proname IN ('contact_next_action','get_contact_next_action');` doit rendre 2 lignes, et `SELECT tgname FROM pg_trigger WHERE tgname='trg_touch_transactions_updated_at';` 1 ligne. Sinon : appliquer la migration à la main (idempotente).
3. Suites (hors périmètre de ce plan, ne PAS implémenter) : Phase 0 produit (flag `copilot_tools_enabled` pilote, `agency_wa_numbers`, consolidation pilote 1 agence) ; Phase 2 radar backend ; PR #833 → `suggested_hour` dans les params de `relance`.
