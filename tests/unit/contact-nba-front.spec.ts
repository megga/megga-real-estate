import { describe, it, expect } from 'vitest'
import { parseContactNba, nbaToI18n, type ContactNba } from '@/lib/contactNba'

const raw = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  version: 1,
  action: 'relance',
  reason_key: 'dormant',
  params: { days_dormant: 21 },
  due_at: null,
  kyc_note: null,
  computed_at: '2026-07-11T08:00:00Z',
  ...over,
})

const parsed = (over: Record<string, unknown> = {}): ContactNba => {
  const p = parseContactNba(raw(over))
  if (!p) throw new Error('parse attendu non-null')
  return p
}

describe('parseContactNba (défensif)', () => {
  it('parse un objet valide', () => {
    const p = parsed()
    expect(p.action).toBe('relance')
    expect(p.reasonKey).toBe('dormant')
    expect(p.hasKycNote).toBe(false)
  })
  it('rejette action / reason_key hors whitelist et formes non-objet', () => {
    expect(parseContactNba(raw({ action: 'hack' }))).toBeNull()
    expect(parseContactNba(raw({ reason_key: 'unknown' }))).toBeNull()
    expect(parseContactNba(null)).toBeNull()
    expect(parseContactNba('relance')).toBeNull()
    expect(parseContactNba([raw()])).toBeNull()
  })
  it('kyc_note valide → hasKycNote ; invalide → false', () => {
    expect(parsed({ kyc_note: { status: 'pending', completion_pct: 40 } }).hasKycNote).toBe(true)
    expect(parsed({ kyc_note: { nope: true } }).hasKycNote).toBe(false)
  })
})

describe('nbaToI18n (mapping reason_key → clé i18n)', () => {
  it('couvre chaque reason_key actionnable avec ses params', () => {
    expect(nbaToI18n(parsed({ action: 'rappel', reason_key: 'reminder_overdue', params: { days_overdue: 3 } })))
      .toEqual({ key: 'nba.reminderOverdue', params: { days: 3 } })
    expect(nbaToI18n(parsed({ action: 'rappel', reason_key: 'reminder_today', params: {} })))
      .toEqual({ key: 'nba.reminderToday', params: {} })
    expect(nbaToI18n(parsed({ action: 'visite_preparer', reason_key: 'visit_today', params: {} })))
      .toEqual({ key: 'nba.visitToday', params: {} })
    expect(nbaToI18n(parsed({ action: 'deal_stagnant', reason_key: 'deal_stalled', params: { days_stalled: 20 } })))
      .toEqual({ key: 'nba.dealStalled', params: { days: 20 } })
    expect(nbaToI18n(parsed({ action: 'match_a_envoyer', reason_key: 'matches_to_send', params: { count: 3, best_score: 88 } })))
      .toEqual({ key: 'nba.matchesToSend', params: { count: 3 } })
    expect(nbaToI18n(parsed({ action: 'relance', reason_key: 'never_contacted', params: {} })))
      .toEqual({ key: 'nba.neverContacted', params: {} })
    expect(nbaToI18n(parsed({ action: 'relance', reason_key: 'dormant', params: { days_dormant: 21 } })))
      .toEqual({ key: 'nba.dormant', params: { days: 21 } })
  })

  it('offre : montant formaté CHF apostrophe ; échéance dépassée → clé dédiée', () => {
    const near = nbaToI18n(parsed({ action: 'offre_expirante', reason_key: 'offer_expiring', params: { amount: 850000, days_left: 2 } }))
    expect(near).toEqual({ key: 'nba.offerExpiring', params: { amount: "CHF 850'000", days: 2 } })
    const past = nbaToI18n(parsed({ action: 'offre_expirante', reason_key: 'offer_expiring', params: { amount: 850000, days_left: -1 } }))
    expect(past).toEqual({ key: 'nba.offerExpired', params: { amount: "CHF 850'000" } })
  })

  it('visite à débriefer : date suisse depuis due_at', () => {
    const r = nbaToI18n(parsed({ action: 'visite_debrief', reason_key: 'visit_debrief', params: {}, due_at: '2026-07-08T10:00:00Z' }))
    expect(r?.key).toBe('nba.visitDebrief')
    expect(r?.params.date).toBe('08.07.2026')
  })

  it('none → null (la fiche reste sobre, rien à afficher)', () => {
    expect(nbaToI18n(parsed({ action: 'aucune', reason_key: 'none', params: {} }))).toBeNull()
  })

  it('params manquants → défauts sûrs, jamais d\'exception', () => {
    expect(nbaToI18n(parsed({ action: 'rappel', reason_key: 'reminder_overdue', params: {} })))
      .toEqual({ key: 'nba.reminderOverdue', params: { days: 0 } })
  })
})
