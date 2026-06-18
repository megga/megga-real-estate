// Scorer non-régression — pricePosition est un BONUS ADDITIF (hors redistribution).
// Golden EN DUR (capturés depuis le calculateScoreV2 d'origin/main, prouvés old==new
// pour rentRef=null) : un futur retour à la pollution de totalWeight casserait ces
// constantes. Pas de new-vs-new (mustFix revue SQL #2 + intégration #1).
import { describe, it, expect } from 'vitest'
import { calculateScoreV2, DEFAULT_SCORING_CONFIG } from '../../supabase/functions/_shared/matching-normalize'
import type { RentPosition } from '../../supabase/functions/_shared/rent-reference'

const RENT_LISTING = { current_price: 2645, type: 'apartment', canton: 'GE', city: 'Genève', rooms: 3, surface_m2: 70, features: ['balcon'] }
// pas de `features` demandées → 1 axe inactif + fracs partiels (zone canton 0.6) → total ≠ 100 trivial
const RENT_CRITERIA = { budget_min: 2000, budget_max: 2800, zones: ['GE'], type: 'apartment', rooms_min: 3, rooms_max: 4, surface_min: 60 }
const BUY_LISTING = { current_price: 1100000, type: 'apartment', canton: 'VD', city: 'Lausanne', rooms: 4, surface_m2: 100, features: [] }
const BUY_CRITERIA = { budget_min: 900000, budget_max: 1200000, zones: ['VD'], type: 'apartment', rooms_min: 4, rooms_max: 5, surface_min: 90 }

const cfg = DEFAULT_SCORING_CONFIG // version 3, barème 100 inchangé
const GOLDEN_RENT_NULL = 89 // barème 6 axes (figé, == old code)
const GOLDEN_BUY_NULL = 89

const mk = (position_pct: number, n_comparables: number, frac: number): RentPosition => ({
  expected_loyer_m2: 37.79, p25: 31.44, p75: 42.5, n_comparables, position_pct, level: 'canton_surf', frac,
})

describe('pricePosition = bonus additif (non-régression du barème 100)', () => {
  it('candidat partiel-frac : total(null) == golden 6 axes figé', () => {
    expect(calculateScoreV2(RENT_LISTING, RENT_CRITERIA, cfg, null).total).toBe(GOLDEN_RENT_NULL)
  })

  it('candidat buy : aucun décalage de seuil (bonus 0), v3 == v2', () => {
    const v3 = calculateScoreV2(BUY_LISTING, BUY_CRITERIA, cfg, null).total
    const v2 = calculateScoreV2(BUY_LISTING, BUY_CRITERIA, { ...cfg, version: 2 }, null).total
    expect(v3).toBe(GOLDEN_BUY_NULL)
    expect(v3).toBe(v2)
  })

  it('rentRef frac 0 ⇒ identité au barème (bonus 0)', () => {
    expect(calculateScoreV2(RENT_LISTING, RENT_CRITERIA, cfg, mk(0, 128, 0)).total).toBe(GOLDEN_RENT_NULL)
  })

  it('rentRef frac 0.5 / 1.0 ⇒ bonus additif borné, monotone', () => {
    const f05 = calculateScoreV2(RENT_LISTING, RENT_CRITERIA, cfg, mk(0, 128, 0.5)).total
    const f1 = calculateScoreV2(RENT_LISTING, RENT_CRITERIA, cfg, mk(0, 128, 1)).total
    expect(f05).toBe(93) // 89.33 + 3.5 → round 93
    expect(f1).toBe(96)  // 89.33 + 7   → round 96
    expect(f05).toBeGreaterThan(GOLDEN_RENT_NULL)
    expect(f1).toBeGreaterThan(f05)
    expect(f1).toBeLessThanOrEqual(100)
  })

  it('budget.detail enrichi sans 6ᵉ clé (contrat 5 clés)', () => {
    const res = calculateScoreV2(RENT_LISTING, RENT_CRITERIA, cfg, mk(-12, 47, 0.7))
    expect(res.reasons.budget.detail).toMatch(/marché du secteur/)
    expect(res.reasons.budget.detail).toMatch(/Dans le budget/) // le détail budget d'origine est préservé
    expect(Object.keys(res.reasons).length).toBe(5)
    expect(Object.keys(res.reasons).sort()).toEqual(['budget', 'features', 'rooms', 'type', 'zone'])
  })

  it('bien sous le marché ET hors budget : budget.match reste false + suffixe présent', () => {
    const overBudget = { ...RENT_CRITERIA, budget_max: 2000 } // 2645 > 2000 ⇒ au-dessus du budget
    const res = calculateScoreV2(RENT_LISTING, overBudget, cfg, mk(-12, 47, 0.7))
    expect(res.reasons.budget.match).toBe(false)
    expect(res.reasons.budget.detail).toMatch(/au-dessus du budget/)
    expect(res.reasons.budget.detail).toMatch(/sous le marché du secteur/)
  })
})
