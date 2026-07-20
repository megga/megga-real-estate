// Backend test — biais de troncature sur les statistiques de marché (VENTE).
//
// LE BUG (20 juillet 2026). execGetMarketStats calculait ses médianes de vente à
// partir de match_candidate_listings avec p_limit 400. Cette RPC triait par
// `quality_score DESC NULLS LAST, COALESCE(current_price, price) ASC`. Or en
// production 36 222 annonces actives partagent le MÊME quality_score (100) : la
// 1re clé ne départage rien, et `prix ASC` décide seul. Au-delà de 400 annonces
// le copilote calculait donc sa « médiane de marché » sur les 400 annonces LES
// MOINS CHÈRES, puis citait le chiffre aux agents comme une donnée de marché.
//
// Ampleur mesurée en prod : jusqu'à −39,5 % (TI house, 3 415 vs 5 642 CHF/m²),
// −24,8 % (TI apartment), −23,4 % (VD apartment)… mais seulement −0,2 % sur GE
// apartment. L'écart dépend de la part tronquée et de la corrélation prix total
// ↔ prix/m². D'où le choix ici d'une population semée où les deux sont
// parfaitement corrélés (surface constante) : le biais y est maximal et le test
// devient déterministe, au lieu de dépendre du segment observé.
//
// Ce fichier fige deux garanties, sur une population semée à quality_score
// SATURÉ (100 partout) pour reproduire exactement la condition de production :
//
//   A. market_sale_stats agrège TOUTE la population — sa médiane vaut la
//      médiane vraie, et diverge de la médiane du sous-échantillon le moins
//      cher (le test mesure l'écart : c'est la démonstration du biais).
//   B. match_candidate_listings tronque SANS corrélation au prix — quand la
//      population dépasse p_limit, les biens strictement DANS le budget passent
//      avant ceux qui ne tiennent que par la marge ±15 %.
//
// Canton AI + type 'storage' : segment volontairement inutilisé par les autres
// specs, pour que l'agrégat porte sur la seule population semée ici.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { type SupabaseClient } from '@supabase/supabase-js'
import { serviceRoleClient } from './helpers/supabase'
import { pickSaleStats, type SaleStatsRow } from '../../supabase/functions/_shared/copilot-market.ts'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const STAMP = `${Date.now()}`

const CANTON = 'AI'
const TYPE = 'storage'
const CITY = 'Appenzell'
const SURFACE = 100

/** Médiane par interpolation linéaire — même définition que percentile_cont. */
function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b)
  const idx = 0.5 * (s.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  return lo === hi ? s[lo] : s[lo] + (idx - lo) * (s[hi] - s[lo])
}

describe.skipIf(!HAS_KEYS)('Stats de marché vente — population complète, pas échantillon', () => {
  let service: SupabaseClient
  const seededIds: string[] = []

  // 60 annonces, surface constante 100 m², prix 100k → 6M par pas de 100k.
  // Prix/m² = 1 000 → 60 000 : toutes dans la fenêtre de plausibilité suisse.
  // Médiane vraie = (30 000 + 31 000) / 2 = 30 500.
  const PRICES = Array.from({ length: 60 }, (_, i) => (i + 1) * 100_000)
  const TRUE_MEDIAN_M2 = 30_500

  beforeAll(async () => {
    service = serviceRoleClient()
    const rows = PRICES.map((price, i) => ({
      source_id: `salestats-${i}-${STAMP}`,
      source_portal: 'flatfox',
      title: `Sale stats QA ${i}`,
      city: CITY, canton: CANTON, type: TYPE,
      transaction_type: 'buy',
      price,
      surface_m2: SURFACE,
      status: 'active',
      // Saturation VOLONTAIRE : c'est la condition qui neutralise la 1re clé de
      // tri en production. Sans elle, le bug ne se reproduit pas.
      quality_score: 100,
    }))
    const { data, error } = await service.from('market_listings').insert(rows).select('id')
    if (error) throw new Error(`seed market_listings: ${error.message}`)
    seededIds.push(...data.map((r) => r.id as string))
  })

  afterAll(async () => {
    if (seededIds.length) await service.from('market_listings').delete().in('id', seededIds)
  })

  // ─────────────────── A. L'agrégat porte sur toute la population ───────────
  it('market_sale_stats : médiane = médiane VRAIE de la population entière', async () => {
    const { data, error } = await service.rpc('market_sale_stats', {
      p_canton: CANTON, p_type: TYPE, p_city: null, p_min_quality: 50,
    })
    expect(error).toBeNull()

    const stats = pickSaleStats((data ?? []) as SaleStatsRow[])
    expect(stats).not.toBeNull()
    expect(stats!.level).toBe('canton')
    expect(stats!.n).toBe(PRICES.length) // les 60, pas un sous-ensemble
    expect(stats!.median_price_m2).toBe(TRUE_MEDIAN_M2)
    expect(stats!.p25_price_m2).toBe(15_750)
    expect(stats!.p75_price_m2).toBe(45_250)
  })

  it('DÉMONSTRATION du biais : la médiane des N moins chères est très en dessous', async () => {
    // Reproduit ce que faisait l'ancien code : prendre les N premières lignes
    // d'un tri `prix ASC` (quality_score étant saturé, c'était le tri effectif).
    const SAMPLE = 20
    const cheapest = [...PRICES].sort((a, b) => a - b).slice(0, SAMPLE)
    const biasedMedian = median(cheapest.map((p) => p / SURFACE))
    const trueMedian = median(PRICES.map((p) => p / SURFACE))

    expect(trueMedian).toBe(TRUE_MEDIAN_M2)
    expect(biasedMedian).toBe(10_500) // 34 % de la médiane vraie

    // L'écart est la raison d'être de ce fichier : tant qu'il est massif, un
    // échantillon « les moins chères » ne peut PAS être cité comme le marché.
    expect(biasedMedian).toBeLessThan(trueMedian * 0.5)

    // Et la RPC, elle, ne retourne pas ce chiffre-là.
    const { data } = await service.rpc('market_sale_stats', {
      p_canton: CANTON, p_type: TYPE, p_city: null, p_min_quality: 50,
    })
    const stats = pickSaleStats((data ?? []) as SaleStatsRow[])
    expect(stats!.median_price_m2).not.toBe(biasedMedian)
  })

  it('cran ville : demandée et au-dessus du seuil → level=city sur la population de la ville', async () => {
    const { data, error } = await service.rpc('market_sale_stats', {
      p_canton: CANTON, p_type: TYPE, p_city: 'appenzell', p_min_quality: 50, // casse/accents insensibles
    })
    expect(error).toBeNull()
    const stats = pickSaleStats((data ?? []) as SaleStatsRow[])
    expect(stats!.level).toBe('city')
    expect(stats!.n).toBe(PRICES.length)
    expect(stats!.median_price_m2).toBe(TRUE_MEDIAN_M2)
  })

  it('ville inconnue → n=0 sur le cran ville → fallback canton (jamais de médiane locale bidon)', async () => {
    const { data, error } = await service.rpc('market_sale_stats', {
      p_canton: CANTON, p_type: TYPE, p_city: `ville-inexistante-${STAMP}`, p_min_quality: 50,
    })
    expect(error).toBeNull()
    const rows = (data ?? []) as SaleStatsRow[]
    expect(rows.find((r) => r.level === 'city')!.n).toBe(0)
    expect(pickSaleStats(rows)!.level).toBe('canton')
  })

  // ─────────────────── B. La troncature n'est plus corrélée au prix ─────────
  it('match_candidate_listings : sous troncature, le budget STRICT passe avant la marge', async () => {
    // Budget [3.0M ; 4.0M]. Marge ±15 % → fourchette SQL [2.55M ; 4.6M].
    // Population semée dans cette fourchette : 2.6M→4.6M, soit les prix 26..46.
    //   · strictement DANS le budget : 3.0M → 4.0M (prix 30..40) = 11 annonces
    //   · seulement dans la marge     : 2.6M→2.9M et 4.1M→4.6M    = 10 annonces
    // Avec l'ancien tri `prix ASC`, un p_limit de 4 ne ramenait que du 2.6M–2.9M :
    // QUE des biens sous le budget minimum, ceux-là mêmes que scorePrice pénalise.
    const BUDGET_MIN = 3_000_000
    const BUDGET_MAX = 4_000_000

    const { data, error } = await service.rpc('match_candidate_listings', {
      p_tx: 'buy',
      p_budget_min: BUDGET_MIN,
      p_budget_max: BUDGET_MAX,
      p_margin: 0.15,
      p_cantons: [CANTON],
      p_types: [TYPE],
      p_min_quality: 50,
      p_limit: 4,
    })
    expect(error).toBeNull()

    const rows = (data ?? []) as { id: string; price: number | string }[]
    expect(rows).toHaveLength(4)

    // INVARIANT : chaque ligne retenue est strictement dans le budget.
    for (const r of rows) {
      const price = Number(r.price)
      expect(price).toBeGreaterThanOrEqual(BUDGET_MIN)
      expect(price).toBeLessThanOrEqual(BUDGET_MAX)
    }

    // Régression frontale : le moins cher de la fourchette (2.6M, hors budget
    // strict) était systématiquement retenu avant. Il ne doit plus l'être.
    const prices = rows.map((r) => Number(r.price))
    expect(prices).not.toContain(2_600_000)
  })

  it('sans budget, la troncature ne privilégie plus le bas de gamme', async () => {
    // Aucun budget → tous les biens sont « dans le budget » (bornes NULL) et le
    // départage tombe sur id : ordre stable, NON corrélé au prix. L'ancien tri
    // aurait renvoyé exactement les 10 moins chères (100k → 1M).
    const { data, error } = await service.rpc('match_candidate_listings', {
      p_tx: 'buy', p_cantons: [CANTON], p_types: [TYPE], p_min_quality: 50, p_limit: 10,
    })
    expect(error).toBeNull()

    const prices = ((data ?? []) as { price: number | string }[]).map((r) => Number(r.price))
    expect(prices).toHaveLength(10)

    const cheapestTen = [...PRICES].sort((a, b) => a - b).slice(0, 10)
    expect([...prices].sort((a, b) => a - b)).not.toEqual(cheapestTen)
  })
})
