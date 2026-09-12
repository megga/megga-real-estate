// MEGGA CRM Sugar v3 — Dashboard Analytics (Sprint 4) — Mock leads relance
// Port pixel-près de sprint-4/crm-dashboard-relance-data.jsx
//
// 47 leads dormants + brouillons IA pré-rédigés + variantes de ton.
// Cette base sert à crédibiliser le sentiment "MEGGA AI a vraiment réfléchi
// pour chaque lead".

export type IconName =
  | 'eye'
  | 'check'
  | 'mail'
  | 'phone'
  | 'doc'
  | 'msg'
  | 'clock'

export type KycStatus = 'verified' | 'pending' | 'none'

export interface RelanceLead {
  id: string
  /** Real Supabase contact id when sourced from `contacts`; null for seed
   * demo leads. Used by the Resend wiring to decide whether to send the
   * email for real or just log the audit attempt against a synthetic
   * destination. */
  contactId: string | null
  /** Real contact email when present. Mock seed leads carry null — the
   * relance session synthesizes `${first}.${last}@relance-demo.megga.local`
   * so the audit row reflects a real Resend attempt + the deliverability
   * failure. When `email` is non-null, the send goes to a real recipient. */
  email: string | null
  first: string
  last: string
  /** `contacts.language` — langue de CORRESPONDANCE du client. NULL = jamais choisie. */
  language: string | null
  avatarBg: string
  score: number
  bien: string
  bienPrice: string
  budget: string
  kyc: KycStatus
  dormSince: number
  /** True if last_interaction_at was set (real recency). Distinct du sentinel
   * dormSince=999 (NULL) : permet un libellé honnête « jamais recontacté » vs
   * « se refroidit depuis N j » sans collision avec un contact dormant ~999 j. */
  engaged?: boolean
  reason: string
  quote: string | null
  history: Array<{ d: string; t: string; icon: IconName }>
  nextStep: string
  nextStepHint: string
}

// ─── 8 leads détaillés (les 39 autres sont fillers) ────────────────────

// ─── Fillers pour atteindre 47 leads ───────────────────────────────────
// ─── Brouillons MEGGA AI par lead ──────────────────────────────────────


// ─── Variantes de ton MEGGA AI ─────────────────────────────────────────
// ─── Session storage (pause/reprise) ───────────────────────────────────
