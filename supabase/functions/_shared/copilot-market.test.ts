import { describe, it, expect } from 'vitest'
import { pickSaleStats, salePosition, MIN_COMPARABLES, type SaleStatsRow } from './copilot-market'

// L'agrégation vit désormais en SQL (RPC market_sale_stats) : ce module ne
// choisit plus que le cran géographique. Les fixtures imitent donc la sortie
// de la RPC — deux lignes ('city' puis 'canton'), déjà agrégées.
const stat = (over: Partial<SaleStatsRow>): SaleStatsRow => ({
  level: 'canton', n: 300, median_price_m2: 12_000, p25_price_m2: 10_000, p75_price_m2: 14_000, ...over,
})

describe('pickSaleStats — seuil + fallback ville→canton', () => {
  it('ville au-dessus du seuil → cran ville', () => {
    const s = pickSaleStats([stat({ level: 'city', n: 25, median_price_m2: 15_000 }), stat({})])
    expect(s!.level).toBe('city')
    expect(s!.n).toBe(25)
    expect(s!.median_price_m2).toBe(15_000)
  })

  it('ville sous le seuil → fallback canton', () => {
    const s = pickSaleStats([stat({ level: 'city', n: MIN_COMPARABLES - 1 }), stat({ n: 300 })])
    expect(s!.level).toBe('canton')
    expect(s!.n).toBe(300)
  })

  it('ville non demandée (n=0, médianes NULL) → canton', () => {
    const empty = stat({ level: 'city', n: 0, median_price_m2: null, p25_price_m2: null, p75_price_m2: null })
    const s = pickSaleStats([empty, stat({ n: 300 })])
    expect(s!.level).toBe('canton')
  })

  it('canton lui-même sous le seuil → null (échantillon insuffisant)', () => {
    expect(pickSaleStats([stat({ n: MIN_COMPARABLES - 1 })])).toBeNull()
    expect(pickSaleStats([])).toBeNull()
  })

  it('numeric SQL sérialisé en string → parsé (pas de NaN publié)', () => {
    // PostgREST renvoie les `numeric` en string : sans parsing, la médiane
    // partirait en NaN dans le prompt.
    const s = pickSaleStats([stat({ median_price_m2: '12000', p25_price_m2: '10000', p75_price_m2: '14000' })])
    expect(s!.median_price_m2).toBe(12_000)
    expect(s!.p25_price_m2).toBe(10_000)
  })

  it('n suffisant mais médiane NULL → null (jamais de chiffre bidon)', () => {
    expect(pickSaleStats([stat({ n: 300, median_price_m2: null })])).toBeNull()
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
