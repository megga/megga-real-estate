import { describe, it, expect } from 'vitest'
import {
  percentile, salePriceM2, buildSaleStats, salePosition, MIN_COMPARABLES,
  type SaleCandidateRow,
} from './copilot-market'

const row = (over: Partial<SaleCandidateRow>): SaleCandidateRow => ({
  price: 1_000_000, current_price: null, city: 'Genève', rooms: 4, surface_m2: 100, ...over,
})

describe('percentile', () => {
  it('médiane d\'un tableau trié impair', () => {
    expect(percentile([10, 20, 30], 0.5)).toBe(20)
  })
  it('médiane d\'un tableau pair (interpolation)', () => {
    expect(percentile([10, 20, 30, 40], 0.5)).toBe(25)
  })
  it('p25 / p75', () => {
    expect(percentile([10, 20, 30, 40, 50], 0.25)).toBe(20)
    expect(percentile([10, 20, 30, 40, 50], 0.75)).toBe(40)
  })
  it('tableau vide → 0, singleton → sa valeur', () => {
    expect(percentile([], 0.5)).toBe(0)
    expect(percentile([42], 0.9)).toBe(42)
  })
})

describe('salePriceM2', () => {
  it('current_price prioritaire sur price', () => {
    expect(salePriceM2(row({ price: 1_000_000, current_price: 1_200_000, surface_m2: 100 }))).toBe(12_000)
  })
  it('surface aberrante → null (garde anti-données)', () => {
    expect(salePriceM2(row({ surface_m2: 3 }))).toBeNull()
    expect(salePriceM2(row({ surface_m2: 5000 }))).toBeNull()
  })
  it('prix/m² hors fenêtre suisse plausible → null', () => {
    expect(salePriceM2(row({ price: 60_000, current_price: null, surface_m2: 200 }))).toBeNull() // 300/m2 trop bas... mais 60k<50k? non 60k ok, 300/m2 <500 → null
    expect(salePriceM2(row({ price: 90_000_000, current_price: null, surface_m2: 1000 }))).toBeNull() // 90k/m2 > 60k → null
  })
  it('prix manquant → null', () => {
    expect(salePriceM2(row({ price: null, current_price: null }))).toBeNull()
  })
})

describe('buildSaleStats — seuil + fallback ville→canton', () => {
  // 25 lignes Genève à 12'000/m², 5 lignes Carouge à 10'000/m².
  const rows: SaleCandidateRow[] = [
    ...Array.from({ length: 25 }, () => row({ city: 'Genève', price: 1_200_000, surface_m2: 100 })),
    ...Array.from({ length: 5 }, () => row({ city: 'Carouge', price: 1_000_000, surface_m2: 100 })),
  ]

  it('ville sous le seuil → fallback canton (toutes lignes)', () => {
    const s = buildSaleStats(rows, 'Carouge')
    expect(s).not.toBeNull()
    expect(s!.level).toBe('canton')
    expect(s!.n).toBe(30)
  })
  it('ville au-dessus du seuil → stats ville', () => {
    const s = buildSaleStats(rows, 'Genève')
    expect(s!.level).toBe('city')
    expect(s!.n).toBe(25)
    expect(s!.median_price_m2).toBe(12_000)
  })
  it('canton total sous le seuil → null (échantillon insuffisant)', () => {
    const few = Array.from({ length: MIN_COMPARABLES - 1 }, () => row({}))
    expect(buildSaleStats(few, 'Genève')).toBeNull()
  })
  it('normalisation ville insensible à la casse/accents', () => {
    const s = buildSaleStats(rows, 'geneve')
    expect(s!.level).toBe('city')
    expect(s!.n).toBe(25)
  })
})

describe('salePosition', () => {
  const stats = { level: 'city' as const, n: 25, median_price_m2: 12_000, p25_price_m2: 10_000, p75_price_m2: 14_000 }
  it('bien au-dessus de la médiane → position positive', () => {
    const p = salePosition(stats, 1_300_000, 100) // 13'000/m2 vs 12'000 → +8%
    expect(p!.subject_price_m2).toBe(13_000)
    expect(p!.position_pct).toBe(8)
  })
  it('bien sous la médiane → position négative', () => {
    const p = salePosition(stats, 1_080_000, 100) // 10'800/m2 → -10%
    expect(p!.position_pct).toBe(-10)
  })
  it('surface ou montant manquant → null', () => {
    expect(salePosition(stats, null, 100)).toBeNull()
    expect(salePosition(stats, 1_000_000, null)).toBeNull()
  })
})
