import { describe, it, expect } from 'vitest'
import {
  RADAR_DEFAULTS, daysSince, isDealStagnant, isMatchIgnored,
  stagnantDealReason, ignoredMatchReason, stageLabelFr,
} from './radar-detectors'

const NOW = Date.parse('2026-07-05T12:00:00Z')
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString()

describe('daysSince', () => {
  it('compte les jours entiers écoulés', () => {
    expect(daysSince(daysAgo(14), NOW)).toBe(14)
    expect(daysSince(daysAgo(0), NOW)).toBe(0)
  })
  it('futur ou invalide → 0', () => {
    expect(daysSince(new Date(NOW + 86_400_000).toISOString(), NOW)).toBe(0)
    expect(daysSince(null, NOW)).toBe(0)
    expect(daysSince('pas une date', NOW)).toBe(0)
  })
})

describe('isDealStagnant', () => {
  const base = { status: 'active', stage: 'negotiation', updatedAt: daysAgo(20), now: NOW }
  it('actif, étape en cours, inactif ≥ seuil → true', () => {
    expect(isDealStagnant(base)).toBe(true)
  })
  it('inactif < seuil → false', () => {
    expect(isDealStagnant({ ...base, updatedAt: daysAgo(10) })).toBe(false)
  })
  it('statut non actif → false', () => {
    expect(isDealStagnant({ ...base, status: 'lost' })).toBe(false)
  })
  it('étape terminale/début exclue (signed, closed, lost, new_lead, to_qualify) → false', () => {
    for (const stage of ['signed', 'closed', 'lost', 'new_lead', 'lead', 'to_qualify']) {
      expect(isDealStagnant({ ...base, stage })).toBe(false)
    }
  })
  it('seuil surchargeable', () => {
    expect(isDealStagnant({ ...base, updatedAt: daysAgo(10), days: 7 })).toBe(true)
  })
})

describe('isMatchIgnored', () => {
  const base = { status: 'suggested', score: 82, sentAt: null, createdAt: daysAgo(6), now: NOW }
  it('suggéré, score ≥ seuil, non envoyé, ancien → true', () => {
    expect(isMatchIgnored(base)).toBe(true)
  })
  it('déjà envoyé → false', () => {
    expect(isMatchIgnored({ ...base, sentAt: daysAgo(1) })).toBe(false)
  })
  it('score sous le seuil → false', () => {
    expect(isMatchIgnored({ ...base, score: 60 })).toBe(false)
  })
  it('trop récent → false', () => {
    expect(isMatchIgnored({ ...base, createdAt: daysAgo(2) })).toBe(false)
  })
  it('statut ≠ suggested → false', () => {
    expect(isMatchIgnored({ ...base, status: 'sent' })).toBe(false)
  })
})

describe('raisons (message_template)', () => {
  it('stagnantDealReason : chiffré + étape lisible', () => {
    const r = stagnantDealReason('negotiation', 18)
    expect(r).toContain('18 jours')
    expect(r).toContain('Négociation')
  })
  it('ignoredMatchReason : score marqué estimation + jours + bien optionnel', () => {
    expect(ignoredMatchReason(82, 6)).toContain('score 82, estimation')
    expect(ignoredMatchReason(82, 6)).toContain('6 jours')
    expect(ignoredMatchReason(82, 6, '3.5p Carouge')).toContain('(3.5p Carouge)')
  })
  it('stageLabelFr : connu traduit, inconnu tel quel', () => {
    expect(stageLabelFr('offer')).toBe('Offre')
    expect(stageLabelFr('inconnu')).toBe('inconnu')
    expect(stageLabelFr(null)).toBe('en cours')
  })
})

describe('RADAR_DEFAULTS', () => {
  it('seuils conservateurs par défaut', () => {
    expect(RADAR_DEFAULTS.dealStagnantDays).toBe(14)
    expect(RADAR_DEFAULTS.matchIgnoredDays).toBe(5)
    expect(RADAR_DEFAULTS.matchIgnoredMinScore).toBe(70)
  })
})
