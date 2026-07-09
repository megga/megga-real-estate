// Backend test — Signal « prix baissé » dans le matching (migration 20260709140000).
//
// Producteur : trigger ra_price_status (19/06) — baisses RealAdvisor →
// status='price_reduced', price_at_first_seen figé. Consommateur (cette PR) :
// la RPC match_candidate_listings renvoie status + price_at_first_seen, et
// calculateScoreV2 applique un BONUS additif borné (façon pricePosition,
// design red-team 19/06) + un suffixe sur budget.detail — JAMAIS une 6ᵉ clé
// reasons (contrat figé, lu par l'Atelier).
//
// Partie pure (calculateScoreV2) : toujours exécutée (zéro I/O).
// Partie DB (shape de la RPC) : skipIf(!HAS_KEYS) — en CI, tourne contre le
// Supabase local seedé ; market_listings peut être vide → assertions par-ligne
// conditionnelles (pattern vacuously-safe maison, cf matching-rent-position).

import { describe, it, expect } from 'vitest'
import { serviceRoleClient } from './helpers/supabase'
import { calculateScoreV2, DEFAULT_SCORING_CONFIG } from '../../supabase/functions/_shared/matching-normalize'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

// Bien de référence : dans le budget, bonne zone → score haut mais < 100
// (laisse la place au bonus pour être observable).
const CRITERIA = {
  transaction_type: 'buy',
  budget_min: 800_000,
  budget_max: 1_200_000,
  zones: ['GE'],
  type: 'apartment',
  rooms_min: 3,
  surface_min: 80,
}
const BASE_LISTING = {
  id: 'x',
  price: 1_000_000,
  current_price: 1_000_000,
  type: 'apartment',
  canton: 'GE',
  city: 'Genève',
  rooms: 4,
  surface_m2: 100,
  features: [],
  transaction_type: 'buy',
}

describe('calculateScoreV2 — bonus « prix baissé » (pur, zéro I/O)', () => {
  it('bonus appliqué : status=price_reduced + baisse ≥10% → +priceDrop pts et suffixe budget.detail', () => {
    const plain = calculateScoreV2(BASE_LISTING, CRITERIA, DEFAULT_SCORING_CONFIG)
    const reduced = calculateScoreV2(
      { ...BASE_LISTING, status: 'price_reduced', price_at_first_seen: 1_150_000, current_price: 1_000_000 },
      CRITERIA,
      DEFAULT_SCORING_CONFIG,
    )
    // ~13% de baisse → bonus plein (5 pts), modulo le clamp 100.
    const expected = Math.min(100, plain.total + DEFAULT_SCORING_CONFIG.weights.priceDrop)
    expect(reduced.total).toBe(expected)
    expect(reduced.total).toBeGreaterThan(plain.total)
    expect(reduced.reasons.budget.detail).toMatch(/Prix baissé de 13%/)
    // Contrat figé : EXACTEMENT 5 clés reasons, pas de 6ᵉ.
    expect(Object.keys(reduced.reasons).sort()).toEqual(['budget', 'features', 'rooms', 'type', 'zone'])
  })

  it('bonus linéaire sous 10% de baisse (5% → moitié du poids)', () => {
    const plain = calculateScoreV2(BASE_LISTING, CRITERIA, DEFAULT_SCORING_CONFIG)
    const reduced = calculateScoreV2(
      // 1_052_631 → baisse exacte de 5.0%
      { ...BASE_LISTING, status: 'price_reduced', price_at_first_seen: 1_052_631, current_price: 1_000_000 },
      CRITERIA,
      DEFAULT_SCORING_CONFIG,
    )
    const delta = reduced.total - plain.total
    expect(delta).toBeGreaterThanOrEqual(2)
    expect(delta).toBeLessThanOrEqual(3) // 0.5 × 5 pts = 2.5 ± arrondi
  })

  it('anti-bruit : baisse <2% → aucun bonus, aucun suffixe', () => {
    const plain = calculateScoreV2(BASE_LISTING, CRITERIA, DEFAULT_SCORING_CONFIG)
    const tiny = calculateScoreV2(
      { ...BASE_LISTING, status: 'price_reduced', price_at_first_seen: 1_010_000, current_price: 1_000_000 },
      CRITERIA,
      DEFAULT_SCORING_CONFIG,
    )
    expect(tiny.total).toBe(plain.total)
    expect(tiny.reasons.budget.detail).not.toMatch(/Prix baissé/)
  })

  it("pas de bonus sans le statut (une baisse de champ seule ne suffit pas) ni sans price_at_first_seen", () => {
    const plain = calculateScoreV2(BASE_LISTING, CRITERIA, DEFAULT_SCORING_CONFIG)
    const noStatus = calculateScoreV2(
      { ...BASE_LISTING, price_at_first_seen: 1_150_000 },
      CRITERIA,
      DEFAULT_SCORING_CONFIG,
    )
    const noRef = calculateScoreV2({ ...BASE_LISTING, status: 'price_reduced' }, CRITERIA, DEFAULT_SCORING_CONFIG)
    expect(noStatus.total).toBe(plain.total)
    expect(noRef.total).toBe(plain.total)
  })

  it('clamp : le bonus ne pousse jamais au-dessus de 100', () => {
    const perfect = calculateScoreV2(
      {
        ...BASE_LISTING,
        features: ['balcon'],
        status: 'price_reduced',
        price_at_first_seen: 1_300_000,
        current_price: 1_000_000,
      },
      { ...CRITERIA, features: ['balcon'] },
      DEFAULT_SCORING_CONFIG,
    )
    expect(perfect.total).toBeLessThanOrEqual(100)
  })

  it('config : poids priceDrop surchargeable, absent d’une vieille config → défaut 5', () => {
    // parseScoringConfig spreade les défauts — une app_config posée avant cette
    // PR (sans priceDrop) doit produire le poids par défaut, pas undefined/NaN.
    expect(DEFAULT_SCORING_CONFIG.weights.priceDrop).toBe(5)
    const reduced = calculateScoreV2(
      { ...BASE_LISTING, status: 'price_reduced', price_at_first_seen: 1_150_000 },
      CRITERIA,
      { ...DEFAULT_SCORING_CONFIG, weights: { ...DEFAULT_SCORING_CONFIG.weights, priceDrop: 0 } },
    )
    const plain = calculateScoreV2(BASE_LISTING, CRITERIA, DEFAULT_SCORING_CONFIG)
    expect(reduced.total).toBe(plain.total) // poids 0 = signal éteint proprement
  })
})

describe.skipIf(!HAS_KEYS)('match_candidate_listings — shape avec status + price_at_first_seen', () => {
  it('la RPC expose les 2 nouvelles colonnes (rows conditionnelles en CI)', async () => {
    const svc = serviceRoleClient()
    const { data, error } = await svc.rpc('match_candidate_listings', {
      p_tx: 'buy',
      p_limit: 5,
    })
    expect(error).toBeNull()
    const rows = (data ?? []) as Record<string, unknown>[]
    // CI : market_listings peut être vide → assertions par-ligne conditionnelles.
    for (const r of rows) {
      expect(r).toHaveProperty('status')
      expect(r).toHaveProperty('price_at_first_seen')
      expect(['active', 'price_reduced']).toContain(r.status)
    }
  })
})
