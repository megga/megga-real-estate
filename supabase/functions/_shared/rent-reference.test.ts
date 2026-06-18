import { describe, it, expect } from 'vitest'
import {
  buildRentStatsIndex, rentPosition, surfaceBand, positionFrac,
  buildRentReasonSuffix, DEFAULT_POSITION_CURVE,
  type RentStatsRow, type RentPosition,
} from './rent-reference'

const GE_50_80: RentStatsRow = { level: 'canton_surf', canton: 'GE', type: 'apartment',
  surface_band: '50-80', postal_code: null, city: null,
  median_loyer_m2: 37.79, p25_loyer_m2: 31.44, p75_loyer_m2: 42.50, n_comparables: 128 }

// CORRECTION REVUE (mustFix honnêteté #2) : NPA fixture SYNTHÉTIQUE dont la
// médiane est DÉLIBÉRÉMENT distincte du canton — la distinctness EST le but du
// test (#12/#13 prouvent la SÉLECTION de niveau, pas une relecture du même
// nombre via deux chemins). On NE met PAS n=900 sur un NPA (forme impossible :
// la MV exige n>=20 ET le 8001 réel a n=13<20 → ne serait jamais matérialisé).
const ZH_NPA: RentStatsRow = { level: 'npa_surf', canton: 'ZH', type: 'apartment',
  surface_band: '<50', postal_code: '8001', city: null,
  median_loyer_m2: 64.00, p25_loyer_m2: 52.00, p75_loyer_m2: 78.00, n_comparables: 42 }
const ZH_CANTON: RentStatsRow = { level: 'canton_surf', canton: 'ZH', type: 'apartment',
  surface_band: '<50', postal_code: null, city: null,
  median_loyer_m2: 56.84, p25_loyer_m2: 44.00, p75_loyer_m2: 72.68, n_comparables: 1500 }
const idx = buildRentStatsIndex([GE_50_80, ZH_NPA, ZH_CANTON])

describe('rentPosition — résolution + arithmétique', () => {
  it('#1 surface null → null', () => {
    expect(rentPosition({ canton: 'GE', type: 'apartment', surface_m2: null, loyer: 2645 }, idx)).toBeNull()
  })
  it('#2 surface ≤ 0 → null', () => {
    expect(rentPosition({ canton: 'GE', type: 'apartment', surface_m2: 0, loyer: 2645 }, idx)).toBeNull()
  })
  it('#3 loyer null → null', () => {
    expect(rentPosition({ canton: 'GE', type: 'apartment', surface_m2: 70, loyer: null }, idx)).toBeNull()
  })
  it('#4 loyer ≤ 0 → null', () => {
    expect(rentPosition({ canton: 'GE', type: 'apartment', surface_m2: 70, loyer: 0 }, idx)).toBeNull()
  })
  it('#5 pas de segment → null', () => {
    expect(rentPosition({ canton: 'JU', type: 'apartment', surface_m2: 70, loyer: 1500 }, idx)).toBeNull()
  })
  it('#6 r=1 → frac 0.5, canton_surf', () => {
    const p = rentPosition({ canton: 'GE', type: 'apartment', surface_m2: 70, loyer: 2645 }, idx)!
    expect(p).not.toBeNull()
    expect(p.level).toBe('canton_surf')
    expect(p.position_pct).toBe(0)
    expect(p.frac).toBeCloseTo(0.50, 10)
    expect(p.expected_loyer_m2).toBe(37.79)
    expect(p.n_comparables).toBe(128)
  })
  it('#7 -20% → frac haut (<0.92)', () => {
    const p = rentPosition({ canton: 'GE', type: 'apartment', surface_m2: 70, loyer: 2120 }, idx)!
    expect(p.position_pct).toBe(-20)
    expect(p.frac).toBeGreaterThan(0.80)
    expect(p.frac).toBeLessThan(0.92)
  })
  it('#8 -36% → floor, jamais 1.0', () => {
    const p = rentPosition({ canton: 'GE', type: 'apartment', surface_m2: 70, loyer: 1700 }, idx)!
    expect(p.position_pct).toBe(-36)
    expect(p.frac).toBe(DEFAULT_POSITION_CURVE.frac_floor) // 0.62
    expect(p.frac).toBeLessThan(1)
  })
  it('#9 +20% → frac bas', () => {
    const p = rentPosition({ canton: 'GE', type: 'apartment', surface_m2: 70, loyer: 3170 }, idx)!
    expect(p.position_pct).toBe(20)
    expect(p.frac).toBeLessThan(0.50)
    expect(p.frac).toBeGreaterThan(0.05)
  })
  it('#10 +40% → floor over', () => {
    const p = rentPosition({ canton: 'GE', type: 'apartment', surface_m2: 70, loyer: 3700 }, idx)!
    expect(p.position_pct).toBe(40)
    expect(p.frac).toBe(DEFAULT_POSITION_CURVE.frac_over) // 0.05
  })
  it('#11 fallback canton si NPA absent de la MV', () => {
    const p = rentPosition({ canton: 'GE', type: 'apartment', surface_m2: 70, loyer: 2645, postal_code: '1201' }, idx)!
    expect(p.level).toBe('canton_surf')
  })
  it('#12 NPA préféré si présent (discrimine le niveau)', () => {
    const p = rentPosition({ canton: 'ZH', type: 'apartment', surface_m2: 40, loyer: 2200, postal_code: '8001' }, idx)!
    expect(p.level).toBe('npa_surf')
    expect(p.expected_loyer_m2).toBe(64.00) // ≠ canton 56.84
  })
  it('#13 fallback canton si NPA non indexé', () => {
    const p = rentPosition({ canton: 'ZH', type: 'apartment', surface_m2: 40, loyer: 2200, postal_code: '9999' }, idx)!
    expect(p.level).toBe('canton_surf')
    expect(p.expected_loyer_m2).toBe(56.84)
  })
  it('#14 garde collision de clé : NPA et canton coexistent', () => {
    const viaNpa = rentPosition({ canton: 'ZH', type: 'apartment', surface_m2: 40, loyer: 2200, postal_code: '8001' }, idx)!
    const viaCanton = rentPosition({ canton: 'ZH', type: 'apartment', surface_m2: 40, loyer: 2200 }, idx)!
    expect(viaNpa.level).toBe('npa_surf')
    expect(viaCanton.level).toBe('canton_surf')
    expect(viaNpa.expected_loyer_m2).not.toBe(viaCanton.expected_loyer_m2)
  })
  it('#17 div-by-zero (médiane 0) → null, pas NaN/Infinity', () => {
    const zeroIdx = buildRentStatsIndex([{ level: 'canton_surf', canton: 'NE', type: 'apartment',
      surface_band: '50-80', postal_code: null, city: null,
      median_loyer_m2: 0, p25_loyer_m2: 0, p75_loyer_m2: 0, n_comparables: 25 }])
    expect(rentPosition({ canton: 'NE', type: 'apartment', surface_m2: 70, loyer: 2645 }, zeroIdx)).toBeNull()
  })
})

describe('surfaceBand — edges fermés-à-gauche', () => {
  it('#15 bornes exactes', () => {
    expect(surfaceBand(49.99)).toBe('<50')
    expect(surfaceBand(50)).toBe('50-80')
    expect(surfaceBand(79.99)).toBe('50-80')
    expect(surfaceBand(80)).toBe('80-120')
    expect(surfaceBand(119.99)).toBe('80-120')
    expect(surfaceBand(120)).toBe('120+')
  })
})

describe('positionFrac — courbe', () => {
  it('#16 courbe = hump non-monotone (max à r_under)', () => {
    const c = DEFAULT_POSITION_CURVE
    // (a) NON-DÉCROISSANT sur [r_floor, r_under]
    expect(positionFrac(0.70)).toBeLessThanOrEqual(positionFrac(0.78))
    expect(positionFrac(0.78)).toBeLessThanOrEqual(positionFrac(0.85))
    // (b) NON-CROISSANT sur [r_under, r_over]
    expect(positionFrac(0.85)).toBeGreaterThanOrEqual(positionFrac(0.97))
    expect(positionFrac(0.97)).toBeGreaterThanOrEqual(positionFrac(1.15))
    expect(positionFrac(1.15)).toBeGreaterThanOrEqual(positionFrac(1.25))
    // (c) max global = frac_under à r_under
    expect(positionFrac(0.85)).toBeCloseTo(c.frac_under, 10) // 0.92
    // (d) neutre exact au marché
    expect(positionFrac(1.0)).toBe(0.50)
    // (e) toutes les valeurs ∈ [frac_over, frac_under]
    for (const r of [0.5, 0.7, 0.85, 0.97, 1.0, 1.05, 1.25, 1.5]) {
      const f = positionFrac(r)
      expect(f).toBeGreaterThanOrEqual(c.frac_over)   // 0.05
      expect(f).toBeLessThanOrEqual(c.frac_under)     // 0.92
    }
    // (f) sous le marché (r<r_market_lo) JAMAIS puni sous le neutre
    for (const r of [0.5, 0.7, 0.85, 0.90, 0.96]) {
      expect(positionFrac(r)).toBeGreaterThanOrEqual(c.frac_market) // >= 0.50
    }
  })
  it('#19 r dégénéré → frac_market, no throw', () => {
    expect(positionFrac(0)).toBe(DEFAULT_POSITION_CURVE.frac_market)   // 0.50
    expect(positionFrac(NaN)).toBe(DEFAULT_POSITION_CURVE.frac_market) // 0.50
  })
})

describe('buildRentReasonSuffix — wording compliance-safe', () => {
  const mk = (position_pct: number, n_comparables: number): RentPosition => ({
    expected_loyer_m2: 37.79, p25: 31.44, p75: 42.5, n_comparables,
    position_pct, level: 'canton_surf', frac: 0.5,
  })
  it('#18 sous / au prix / au-dessus + pluriel + jamais "valeur"/"garanti"', () => {
    expect(buildRentReasonSuffix(mk(-12, 47))).toBe(' · ~12% sous le marché du secteur (sur 47 comparables)')
    expect(buildRentReasonSuffix(mk(0, 47))).toBe(' · au prix du marché du secteur (sur 47 comparables)')
    expect(buildRentReasonSuffix(mk(9, 47))).toBe(' · ~9% au-dessus du marché du secteur (sur 47 comparables)')
    expect(buildRentReasonSuffix(mk(-12, 1))).toBe(' · ~12% sous le marché du secteur (sur 1 comparable)') // singulier
    expect(buildRentReasonSuffix(null)).toBe('')
    for (const s of [mk(-12, 47), mk(0, 47), mk(9, 47)]) {
      expect(buildRentReasonSuffix(s)).not.toMatch(/valeur|garanti/i)
    }
  })
})
