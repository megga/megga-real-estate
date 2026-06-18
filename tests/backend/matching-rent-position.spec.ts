// Backend test (live CI) — Référence de loyer marché, Vague 3 PR2.
//
// Couvre les artefacts DB de la primitive (MV market_rent_stats + config +
// RPC, migration 20260618210000) ET l'intégration pure MV → rentPosition →
// calculateScoreV2 (le suffixe « marché du secteur » ride dans budget.detail,
// jamais une 6ᵉ clé reasons).
//
// skipIf(!HAS_KEYS) ne SKIP PAS en CI : exécution contre un Supabase local seedé.
// La MV peut être VIDE en CI (market_listings non seedé) → les assertions
// par-ligne sont conditionnelles (vacuously-safe en CI, réelles contre la prod
// où la MV a 285 segments). La config/RPC est posée par la migration → réelle
// partout. supabase-js ne peut pas émettre REFRESH → l'idempotence CONCURRENTLY
// est vérifiée à la main via MCP + le cron nocturne, pas ici.
//
// Couvre :
//   R1 get_market_rent_reference_config : version + min_comparables=20 (barème migration).
//   R2 MV interrogeable + invariants par-ligne (level/surface_band/positivité/n≥20/seg_key).
//   R3 Anti-dérive : aucune ligne city_surf à city vide/blanche ; aucun npa_surf à postal vide ; seg_key jamais null.
//   R4 Intégration : une ligne canton_surf réelle → rentPosition → calculateScoreV2 enrichit budget.detail (5 clés).

import { describe, it, expect, beforeAll } from 'vitest'
import { type SupabaseClient } from '@supabase/supabase-js'
import { serviceRoleClient } from './helpers/supabase'
import { calculateScoreV2, DEFAULT_SCORING_CONFIG } from '../../supabase/functions/_shared/matching-normalize'
import { buildRentStatsIndex, rentPosition, type RentStatsRow } from '../../supabase/functions/_shared/rent-reference'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const LEVELS = new Set(['canton_surf', 'city_surf', 'npa_surf'])
const BANDS = new Set(['<50', '50-80', '80-120', '120+'])
const SURF_FOR_BAND: Record<string, number> = { '<50': 40, '50-80': 65, '80-120': 100, '120+': 150 }
const num = (x: unknown): number => Number(x)

describe.skipIf(!HAS_KEYS)('Référence de loyer marché — MV + config + intégration scorer', () => {
  let svc: SupabaseClient
  let rows: RentStatsRow[] = []

  beforeAll(async () => {
    svc = serviceRoleClient()
    const { data, error } = await svc.from('market_rent_stats').select('*')
    if (error) throw error
    rows = (data ?? []) as RentStatsRow[]
  })

  it('R1 get_market_rent_reference_config : version + min_comparables=20', async () => {
    const { data, error } = await svc.rpc('get_market_rent_reference_config')
    expect(error).toBeNull()
    const cfg = data as Record<string, unknown>
    expect(cfg).toBeTruthy()
    expect(num(cfg.version)).toBe(1)
    expect(num(cfg.min_comparables)).toBe(20)
    expect(cfg.position_curve).toBeTruthy()
  })

  it('R2 MV interrogeable + invariants par-ligne', () => {
    expect(Array.isArray(rows)).toBe(true)
    for (const r of rows) {
      expect(LEVELS.has(r.level as string)).toBe(true)
      expect(BANDS.has(r.surface_band as string)).toBe(true)
      expect(num(r.median_loyer_m2)).toBeGreaterThan(0)
      expect(num(r.p25_loyer_m2)).toBeGreaterThan(0)
      expect(num(r.p75_loyer_m2)).toBeGreaterThan(0)
      expect(num(r.n_comparables)).toBeGreaterThanOrEqual(20) // honnêteté par construction
      expect(num(r.p25_loyer_m2)).toBeLessThanOrEqual(num(r.median_loyer_m2))
      expect(num(r.median_loyer_m2)).toBeLessThanOrEqual(num(r.p75_loyer_m2))
    }
  })

  it('R3 anti-dérive : pas de clé dégénérée (city/postal vides, seg_key null)', () => {
    for (const r of rows) {
      expect((r as { seg_key?: unknown }).seg_key ?? null).not.toBeNull()
      if (r.level === 'city_surf') expect(String(r.city ?? '').trim().length).toBeGreaterThan(0)
      if (r.level === 'npa_surf') expect(String(r.postal_code ?? '').trim().length).toBeGreaterThan(0)
    }
  })

  it('R4 intégration : ligne canton_surf réelle → rentPosition → budget.detail enrichi (5 clés)', () => {
    const cantonRows = rows.filter((r) => r.level === 'canton_surf')
    if (cantonRows.length === 0) return // CI sans données : vacuously-safe (réel contre la prod)

    const index = buildRentStatsIndex(rows)
    const R = cantonRows[0]
    const surf = SURF_FOR_BAND[R.surface_band as string]
    const median = num(R.median_loyer_m2)
    const loyer = median * surf // r ≈ 1 → au prix du marché

    const pos = rentPosition({ canton: R.canton, type: R.type, surface_m2: surf, loyer }, index)
    expect(pos).not.toBeNull()
    expect(pos!.level).toBe('canton_surf')
    expect(pos!.n_comparables).toBeGreaterThanOrEqual(20)

    const listing = { current_price: loyer, type: R.type, canton: R.canton, surface_m2: surf, city: '', rooms: 3, features: [] }
    const criteria = { budget_min: loyer * 0.5, budget_max: loyer * 1.5, zones: [R.canton], type: R.type }
    const res = calculateScoreV2(listing, criteria, DEFAULT_SCORING_CONFIG, pos)
    expect(res.reasons.budget.detail).toMatch(/marché du secteur/)
    expect(Object.keys(res.reasons).length).toBe(5)
  })
})
