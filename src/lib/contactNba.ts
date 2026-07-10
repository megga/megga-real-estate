// NBA par contact côté FRONT — parse défensif du jsonb rendu par le RPC wrapper JWT
// `get_contact_next_action` (migration 20260710200000_contact_nba_v1) + mapping
// reason_key → clé i18n (namespace contacts, préfixe `nba.`).
//
// Miroir du contrat §2 de la spec (docs/superpowers/plans/2026-07-10-contact-nba-v1.md).
// Le formatteur edge (supabase/functions/_shared/contact-nba.ts) sert les agents LLM
// en FR/EN ; le front passe par react-i18next pour couvrir les 4 langues du CRM.
// Doctrine : le NBA est une ESTIMATION (icône sparkle + tag « estimation » côté UI),
// jamais une obligation ; la kyc_note est une information facultative, jamais l'action.

import { crmFmtCHF } from '@/components/crm-sugar/tokens'

export type NbaAction =
  | 'rappel' | 'offre_expirante' | 'visite_preparer' | 'visite_debrief'
  | 'deal_stagnant' | 'match_a_envoyer' | 'relance' | 'aucune'

export type NbaReasonKey =
  | 'reminder_overdue' | 'reminder_today' | 'offer_expiring' | 'visit_today'
  | 'visit_debrief' | 'deal_stalled' | 'matches_to_send'
  | 'never_contacted' | 'dormant' | 'none'

export interface ContactNba {
  action: NbaAction
  reasonKey: NbaReasonKey
  params: Record<string, unknown>
  dueAt: string | null
  hasKycNote: boolean
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

/** Parse défensif : toute forme inattendue → null, jamais d'exception. */
export function parseContactNba(raw: unknown): ContactNba | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const action = typeof o.action === 'string' ? o.action : ''
  const reasonKey = typeof o.reason_key === 'string' ? o.reason_key : ''
  if (!ACTIONS.has(action) || !REASONS.has(reasonKey)) return null
  const params = o.params && typeof o.params === 'object' && !Array.isArray(o.params)
    ? (o.params as Record<string, unknown>)
    : {}
  const kyc = o.kyc_note
  const hasKycNote = !!kyc && typeof kyc === 'object' && !Array.isArray(kyc)
    && typeof (kyc as Record<string, unknown>).status === 'string'
  return {
    action: action as NbaAction,
    reasonKey: reasonKey as NbaReasonKey,
    params,
    dueAt: typeof o.due_at === 'string' ? o.due_at : null,
    hasKycNote,
  }
}

const intOf = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : null

/** Date suisse courte (Europe/Zurich), '' si invalide. */
function swissDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('fr-CH', {
    timeZone: 'Europe/Zurich', day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(d)
}

export interface NbaI18n {
  /** Clé i18n (namespace contacts), ex. `nba.dormant`. */
  key: string
  /** Params d'interpolation prêts pour t() (jours/count numériques, montant déjà formaté CHF). */
  params: Record<string, unknown>
}

/** Mapping reason_key → clé i18n + params. `null` quand il n'y a rien à afficher
 *  (reason `none` : la fiche reste sobre, pas de bruit « aucune action »). */
export function nbaToI18n(nba: ContactNba): NbaI18n | null {
  const p = nba.params
  switch (nba.reasonKey) {
    case 'reminder_overdue':
      return { key: 'nba.reminderOverdue', params: { days: intOf(p.days_overdue) ?? 0 } }
    case 'reminder_today':
      return { key: 'nba.reminderToday', params: {} }
    case 'offer_expiring': {
      const days = intOf(p.days_left)
      const amount = typeof p.amount === 'number' ? crmFmtCHF(p.amount) : crmFmtCHF(null)
      return days !== null && days < 0
        ? { key: 'nba.offerExpired', params: { amount } }
        : { key: 'nba.offerExpiring', params: { amount, days: days ?? 0 } }
    }
    case 'visit_today':
      return { key: 'nba.visitToday', params: {} }
    case 'visit_debrief':
      return { key: 'nba.visitDebrief', params: { date: swissDate(nba.dueAt) } }
    case 'deal_stalled':
      return { key: 'nba.dealStalled', params: { days: intOf(p.days_stalled) ?? 0 } }
    case 'matches_to_send':
      return { key: 'nba.matchesToSend', params: { count: intOf(p.count) ?? 0 } }
    case 'never_contacted':
      return { key: 'nba.neverContacted', params: {} }
    case 'dormant':
      return { key: 'nba.dormant', params: { days: intOf(p.days_dormant) ?? 0 } }
    case 'none':
    default:
      return null
  }
}
