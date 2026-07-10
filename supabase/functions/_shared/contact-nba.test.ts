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
