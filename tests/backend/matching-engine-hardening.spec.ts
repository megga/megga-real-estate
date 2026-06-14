// Backend test — Matching v2 (Direction A : durcir le moteur).
//
// Deux blocs :
//   A. Scoring PUR (sans DB, toujours exécuté) — invariants du barème
//      calculateScoreV2 + inferTransactionType + normalizeZones.
//   B. Pré-filtre SQL + dédup (DB live, skipIf sans clés) — prouve l'invariant
//      racine au niveau base : un budget d'ACHAT ne ramène JAMAIS de location,
//      le prix>0 est gardé, et l'insertion ON CONFLICT ne duplique pas.
//
// Le bug historique : matchSearchesAgainstMarket scorait un acheteur 'buy'
// contre 34 681 loyers (aucun filtre transaction_type). On le fige ici.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { type SupabaseClient } from '@supabase/supabase-js'
import { serviceRoleClient } from './helpers/supabase'
import {
  calculateScoreV2,
  inferTransactionType,
  normalizeZones,
  DEFAULT_SCORING_CONFIG,
} from '../../supabase/functions/_shared/matching-normalize.ts'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

// ════════════════════════ A. Scoring pur (sans DB) ════════════════════════
describe('Matching v2 — scoring pur', () => {
  it('inferTransactionType : explicite > inférence par budget', () => {
    expect(inferTransactionType({ transaction_type: 'buy' })).toBe('buy')
    expect(inferTransactionType({ transaction_type: 'rent' })).toBe('rent')
    expect(inferTransactionType({ budget_max: 900000 })).toBe('buy') // prix de vente
    expect(inferTransactionType({ budget_max: 3000 })).toBe('rent') // loyer mensuel
    expect(inferTransactionType({ budget_min: 700000 })).toBe('buy')
    expect(inferTransactionType({})).toBe('rent') // pas de budget → rent (pool dominant)
    expect(inferTransactionType(null)).toBe('rent')
  })

  it('normalizeZones : cantons durs (codes + noms) vs villes soft', () => {
    const z = normalizeZones(['Cologny', 'Vandoeuvres', 'GE'])
    expect(z.cantons).toEqual(['GE'])
    expect(z.cities).toContain('cologny')
    const z2 = normalizeZones(['Genève', 'GE'])
    expect(z2.cantons).toEqual(['GE'])
    const z3 = normalizeZones(['Carouge']) // ville pure → aucun canton dur
    expect(z3.cantons).toEqual([])
    expect(z3.cities).toContain('carouge')
  })

  it('reasons : EXACTEMENT 5 clés (contrat Atelier), aucune clé parasite', () => {
    const r = calculateScoreV2(
      { current_price: 1100000, type: 'apartment', canton: 'GE', city: 'Carouge', rooms: 4, surface_m2: 110, features: [] },
      { budget_min: 900000, budget_max: 1300000, zones: ['Carouge', 'GE'], type: 'apartment', rooms_min: 3, rooms_max: 5, surface_min: 90 },
    )
    expect(Object.keys(r.reasons).sort()).toEqual(['budget', 'features', 'rooms', 'type', 'zone'])
  })

  it('score borné 0-100 et cohérent (bien dans le budget = score élevé)', () => {
    const good = calculateScoreV2(
      { current_price: 1100000, type: 'apartment', canton: 'GE', city: 'Carouge', rooms: 4, surface_m2: 110, features: ['balcon'] },
      { budget_min: 900000, budget_max: 1300000, zones: ['Carouge'], type: 'apartment', rooms_min: 3, rooms_max: 5, surface_min: 90, features: ['Balcon'] },
    )
    expect(good.total).toBeGreaterThanOrEqual(0)
    expect(good.total).toBeLessThanOrEqual(100)
    expect(good.total).toBeGreaterThanOrEqual(DEFAULT_SCORING_CONFIG.threshold)
    expect(good.reasons.budget.match).toBe(true)
  })

  it('prix : 0 pt dès +15% au-dessus du budget max', () => {
    const r = calculateScoreV2(
      { current_price: 1500000, type: 'apartment', canton: 'GE', city: 'Carouge' },
      { budget_max: 1000000, zones: ['GE'], type: 'apartment' },
    )
    expect(r.reasons.budget.score).toBe(0) // 1.5M = +50% > tolérance 15%
    expect(r.reasons.budget.match).toBe(false)
  })

  it('features SANS critère → axe neutralisé (corrige le +10 par défaut)', () => {
    const r = calculateScoreV2(
      { current_price: 1100000, type: 'apartment', canton: 'GE', city: 'Carouge', features: ['balcon', 'parking'] },
      { budget_min: 900000, budget_max: 1300000, zones: ['GE'], type: 'apartment' }, // pas de features
    )
    expect(r.reasons.features.score).toBe(0)
    expect(r.reasons.features.match).toBe(false)
  })

  it('reason rooms = pièces + surface fusionnées (libellé Atelier)', () => {
    const r = calculateScoreV2(
      { current_price: 1100000, type: 'apartment', canton: 'GE', city: 'Carouge', rooms: 4, surface_m2: 110 },
      { budget_max: 1300000, zones: ['GE'], rooms_min: 3, rooms_max: 5, surface_min: 90 },
    )
    expect(r.reasons.rooms.detail).toContain('pièces')
    expect(r.reasons.rooms.detail).toContain('m²')
  })
})

// ════════════════ B. Pré-filtre SQL + dédup (DB live, CI) ═══════════════════
describe.skipIf(!HAS_KEYS)('Matching v2 — pré-filtre SQL + dédup (DB)', () => {
  const STAMP = Date.now()
  let service: SupabaseClient
  let agencyId: string
  let contactId: string
  let buyId: string
  let rentId: string
  let zeroId: string

  beforeAll(async () => {
    service = serviceRoleClient()

    const { data: agency, error: aErr } = await service
      .from('agencies')
      .insert({ name: `Matching v2 QA ${STAMP}`, slug: `matchv2-qa-${STAMP}` })
      .select('id')
      .single()
    if (aErr) throw new Error(`agency: ${aErr.message}`)
    agencyId = agency.id

    const { data: contact, error: cErr } = await service
      .from('contacts')
      .insert({ agency_id: agencyId, first_name: 'Vera', last_name: 'Filtrematch', type: 'buyer' })
      .select('id')
      .single()
    if (cErr) throw new Error(`contact: ${cErr.message}`)
    contactId = contact.id

    // Même canton (GE), même type, qualité OK : SEUL transaction_type distingue.
    const seed = async (suffix: string, tx: string, price: number) => {
      const { data, error } = await service
        .from('market_listings')
        .insert({
          source_id: `matchv2-${suffix}-${STAMP}`,
          source_portal: 'flatfox',
          title: `Matching v2 QA ${suffix}`,
          city: 'Genève', canton: 'GE', type: 'apartment',
          transaction_type: tx, price, status: 'active', quality_score: 70,
        })
        .select('id')
        .single()
      if (error) throw new Error(`ml ${suffix}: ${error.message}`)
      return data.id as string
    }
    buyId = await seed('buy', 'buy', 1100000)
    rentId = await seed('rent', 'rent', 2000)
    zeroId = await seed('zero', 'buy', 0) // prix 0 = bruit (parking/erreur) → exclu
  })

  afterAll(async () => {
    // agency D'ABORD : cascade matches/contacts → libère la FK matches→market_listing
    // (cette FK n'a PAS de ON DELETE CASCADE, supprimer le listing avant violerait 23503).
    if (agencyId) await service.from('agencies').delete().eq('id', agencyId)
    for (const id of [buyId, rentId, zeroId]) if (id) await service.from('market_listings').delete().eq('id', id)
  })

  it('INVARIANT : un budget d\'ACHAT ne ramène que des biens à la vente (jamais de location)', async () => {
    const { data, error } = await service.rpc('match_candidate_listings', {
      p_tx: 'buy', p_budget_min: 900000, p_budget_max: 1300000, p_cantons: ['GE'], p_min_quality: 0, p_limit: 100,
    })
    expect(error).toBeNull()
    const ids = (data as { id: string }[]).map((r) => r.id)
    expect(ids).toContain(buyId)
    expect(ids).not.toContain(rentId) // la location n'apparaît JAMAIS pour un acheteur
    expect(ids).not.toContain(zeroId) // prix 0 exclu
  })

  it('symétrie : un budget de LOCATION ne ramène que des locations', async () => {
    const { data, error } = await service.rpc('match_candidate_listings', {
      p_tx: 'rent', p_budget_min: 1500, p_budget_max: 2500, p_cantons: ['GE'], p_min_quality: 0, p_limit: 100,
    })
    expect(error).toBeNull()
    const ids = (data as { id: string }[]).map((r) => r.id)
    expect(ids).toContain(rentId)
    expect(ids).not.toContain(buyId)
  })

  it('flux RACINE : recherche SANS transaction_type → inférence → pool acheteur sans loyer', async () => {
    // Cas réel : 3 recherches sur 4 n'ont pas de transaction_type (cause du bug des 2313 matchs).
    const criteria = { budget_max: 1300000, zones: ['GE'] } as Record<string, unknown>
    const tx = inferTransactionType(criteria)
    expect(tx).toBe('buy') // budget de vente → achat inféré
    const { cantons } = normalizeZones(criteria.zones)
    const { data, error } = await service.rpc('match_candidate_listings', {
      p_tx: tx, p_budget_max: 1300000, p_cantons: cantons, p_min_quality: 0, p_limit: 100,
    })
    expect(error).toBeNull()
    const ids = (data as { id: string }[]).map((r) => r.id)
    expect(ids).toContain(buyId)
    expect(ids).not.toContain(rentId) // l'inférence évite le mur de loyers, bout-en-bout
  })

  it('fourchette de budget : un achat hors fourchette (+ marge) est exclu', async () => {
    const { data } = await service.rpc('match_candidate_listings', {
      p_tx: 'buy', p_budget_max: 800000, p_cantons: ['GE'], p_min_quality: 0, p_limit: 100,
    })
    const ids = (data as { id: string }[]).map((r) => r.id)
    expect(ids).not.toContain(buyId) // 1.1M > 800k * 1.15
  })

  it('insert_market_matches : ON CONFLICT ne duplique pas le couple (contact, bien)', async () => {
    const row = {
      agency_id: agencyId, contact_id: contactId, market_listing_id: buyId,
      score: 80, reasons: { budget: { match: true, score: 32, detail: 'Dans le budget' } },
      status: 'suggested', score_version: 2,
    }
    const { data: first, error: e1 } = await service.rpc('insert_market_matches', { p_rows: [row] })
    expect(e1).toBeNull()
    expect((first as unknown[]).length).toBe(1)

    const { data: second, error: e2 } = await service.rpc('insert_market_matches', { p_rows: [row] })
    expect(e2).toBeNull()
    expect((second as unknown[]).length).toBe(0) // dédup dure, aucune 23505 levée
  })
})
