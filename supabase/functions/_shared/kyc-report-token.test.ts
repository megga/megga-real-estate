/**
 * Seul un jeton de RENDU ouvre le rapport KYC (audit S10, 13.09.2026) : sans `k`, et à moins
 * de dix minutes de son échéance. Chaque famille de jeton signée par le même secret est
 * confrontée à la règle, avec le jeton de rendu réel comme témoin.
 */
import { describe, it, expect } from 'vitest'
import { REPORT_TOKEN_MAX_TTL_S, REPORT_TOKEN_TTL_S, isReportTokenPayload } from './kyc-report-token.ts'

const NOW = 1_800_000_000
const JOUR = 86_400

describe('isReportTokenPayload', () => {
  it('TÉMOIN — le jeton émis par kyc-report-pdf (5 min, avec ou sans `p`) est accepté', () => {
    expect(isReportTokenPayload({ id: 'dossier', exp: NOW + REPORT_TOKEN_TTL_S }, NOW)).toBe(true)
    expect(isReportTokenPayload({ id: 'dossier', exp: NOW + REPORT_TOKEN_TTL_S, p: 'agent' }, NOW)).toBe(true)
    expect(isReportTokenPayload({ id: 'dossier', exp: NOW + REPORT_TOKEN_MAX_TTL_S }, NOW)).toBe(true)
  })

  it('un lien KYC (7 à 30 jours, sans `k`) est refusé par son échéance', () => {
    expect(isReportTokenPayload({ id: 'lien', exp: NOW + 7 * JOUR }, NOW)).toBe(false)
    expect(isReportTokenPayload({ id: 'lien', exp: NOW + 30 * JOUR }, NOW)).toBe(false)
  })

  it('un lien de réception acheteur (jusqu’à 90 jours, avec `p`) est refusé', () => {
    expect(isReportTokenPayload({ id: 'reception', exp: NOW + 90 * JOUR, p: 'agent' }, NOW)).toBe(false)
  })

  it('une seconde au-delà du plafond suffit à refuser', () => {
    expect(isReportTokenPayload({ id: 'dossier', exp: NOW + REPORT_TOKEN_MAX_TTL_S + 1 }, NOW)).toBe(false)
  })

  it('tout jeton portant un `k` est refusé, même à échéance courte', () => {
    for (const k of ['appt', 'wa_optin', 'unsub'] as const) {
      expect(isReportTokenPayload({ id: 'x', exp: NOW + 60, k }, NOW), k).toBe(false)
    }
  })

  it('la durée émise tient sous le plafond, avec de la marge pour l’horloge', () => {
    expect(REPORT_TOKEN_TTL_S).toBeLessThan(REPORT_TOKEN_MAX_TTL_S)
    // Le plafond reste des jours en deçà du plus court des jetons longs (un lien KYC : 1 jour au minimum).
    expect(REPORT_TOKEN_MAX_TTL_S).toBeLessThan(JOUR)
  })
})
