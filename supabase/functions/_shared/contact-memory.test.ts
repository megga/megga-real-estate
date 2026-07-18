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

  it('borne le bloc ENTIER même avec nom et mémoires pathologiques (name = text sans CHECK)', () => {
    const long = formatHotContactBlock(
      { name: 'X'.repeat(500), rollingSummary: 'y'.repeat(1000), crmSummary: 'z'.repeat(1000) }, 'fr')
    expect(long.length).toBeLessThanOrEqual(900)
    expect(long).toContain('XXX') // le nom tronqué reste présent
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
