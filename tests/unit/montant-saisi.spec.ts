/**
 * La lecture d'un budget tapé à la main — cf. `src/lib/montantSaisi.ts`.
 * ⛔ Motif : « 900k » partait en base à 900 CHF, « 1.2m » à 1 CHF.
 */
import { describe, it, expect } from 'vitest'
import { grouperMilliers, lireMontant } from '@/lib/montantSaisi'

describe('lireMontant', () => {
  it.each([
    ['900000', 900000],
    ["1'250'000", 1250000],
    ['1 250 000', 1250000],
    ["CHF 1'250'000.-", 1250000],
    ["900'000 CHF", 900000],
    ['Fr. 3500', 3500],
  ])('chiffres groupés ou habillés : %s', (s, n) => expect(lireMontant(s)).toBe(n))

  it.each([
    ['900k', 900000],
    ['900 K', 900000],
    ['1.2m', 1200000],
    ['1,2 Mio', 1200000],
    ['1.25 mio.', 1250000],
    ['2 millions', 2000000],
    ['1,5 Millionen', 1500000],
    ['3.5k', 3500],
  ])('raccourcis : %s', (s, n) => expect(lireMontant(s)).toBe(n))

  it.each([
    ['1.250', 1250],
    ['1,250,000', 1250000],
    ['1.250.000', 1250000],
    ['1.250.000,50', 1250001],
    ['2450.5', 2451],
  ])('séparateur ambigu : %s', (s, n) => expect(lireMontant(s)).toBe(n))

  it.each(['', '   ', '0', '0k', 'abc', '900x', '12-15k'])('illisible ou nul : « %s »', (s) =>
    expect(lireMontant(s)).toBeNull())
})

describe('grouperMilliers', () => {
  it('pose l’apostrophe suisse', () => {
    expect(grouperMilliers(1250000)).toBe("1'250'000")
    expect(grouperMilliers('900')).toBe('900')
  })
})
