/**
 * Le moteur du lot C : chambres, état, off-market (conception de la boucle, §4.1 et §13). Un critère que le bien
 * ne renseigne pas sort du dénominateur — le score dit ce qu'il sait ; une recherche sans ces critères garde
 * EXACTEMENT sa note ; et `reasons` garde ses cinq clés, que lisent le fil et l'écran mobile.
 */
import { describe, expect, it } from 'vitest'
import {
  axesComplementaires, calculateScoreV2, DEFAULT_SCORING_CONFIG, etatDuBien, parseScoringConfig,
} from '../../supabase/functions/_shared/matching-normalize'

/** Le 22.09.2026 : l'année de référence de l'état. */
const T = Date.UTC(2026, 8, 22)
const BIEN = { price: 1_400_000, type: 'apartment', canton: 'GE', city: 'Genève', rooms: 4.5, surface_m2: 110, features: ['Balcon'] }
const RECHERCHE = { transaction_type: 'buy', type: 'apartment', zones: ['Genève', 'GE'], budget_max: 1_500_000, rooms_min: 4 }
const note = (bien: Record<string, unknown>, criteres: Record<string, unknown>) =>
  calculateScoreV2(bien, criteres, DEFAULT_SCORING_CONFIG, null, T)

describe('etatDuBien', () => {
  it("lit l'état saisi sur un mandat, avant toute année", () => {
    expect(etatDuBien({ condition: 'good', year_built: 2024 }, 2026)).toEqual({ etat: 'good', source: 'saisi', annee: null })
  })
  it('déduit « neuf » d’une construction de 5 ans au plus, chantier compris', () => {
    expect(etatDuBien({ year_built: 2021 }, 2026)).toEqual({ etat: 'new', source: 'construction', annee: 2021 })
    expect(etatDuBien({ year_built: 2031 }, 2026)).toEqual({ etat: 'new', source: 'construction', annee: 2031 })
    expect(etatDuBien({ year_built: 2020 }, 2026)).toBeNull()
    expect(etatDuBien({ year_built: 2032 }, 2026)).toBeNull()
  })
  it('déduit « rénové » d’une rénovation de 10 ans au plus, jamais d’une rénovation future', () => {
    expect(etatDuBien({ year_built: 1968, year_renovated: 2016 }, 2026)).toEqual({ etat: 'renovated', source: 'renovation', annee: 2016 })
    expect(etatDuBien({ year_renovated: 2015 }, 2026)).toBeNull()
    expect(etatDuBien({ year_renovated: 2027 }, 2026)).toBeNull()
  })
  it('ne déduit jamais « bon état » ni « à rénover » d’une date, et ignore un état hors vocabulaire', () => {
    expect(etatDuBien({ year_built: 1968 }, 2026)).toBeNull()
    expect(etatDuBien({ condition: 'excellent' }, 2026)).toBeNull()
  })
})

describe('axesComplementaires', () => {
  const tout = { bedrooms_min: 3, condition_min: 'renovated', off_market_only: true }
  it('un critère non posé est inactif', () => {
    const a = axesComplementaires({ bedrooms: 3, condition: 'new', off_market: true }, {}, T)
    expect([a.chambres.active, a.etat.active, a.offMarket.active]).toEqual([false, false, false])
  })
  it('chambres : tenu, à moitié, pas tenu ; 0 et absent ne sont pas évalués', () => {
    const f = (bedrooms: unknown) => axesComplementaires({ bedrooms }, tout, T).chambres
    expect(f(3)).toMatchObject({ active: true, frac: 1 })
    expect(f(2)).toMatchObject({ active: true, frac: 0.5 })
    expect(f(1)).toMatchObject({ active: true, frac: 0 })
    expect(f(0).active).toBe(false)
    expect(f(null).active).toBe(false)
  })
  it('état : le rang voulu ou mieux tient, un rang en dessous à moitié', () => {
    const f = (champs: Record<string, unknown>) => axesComplementaires(champs, tout, T).etat
    expect(f({ condition: 'new' })).toMatchObject({ active: true, frac: 1 })
    expect(f({ condition: 'renovated' })).toMatchObject({ active: true, frac: 1 })
    expect(f({ condition: 'good' })).toMatchObject({ active: true, frac: 0.5 })
    expect(f({ condition: 'to_renovate' })).toMatchObject({ active: true, frac: 0 })
    expect(f({ year_built: 1968 }).active).toBe(false)
  })
  it('« à rénover » n’est pas un minimum : l’axe reste inactif', () => {
    expect(axesComplementaires({ condition: 'new' }, { condition_min: 'to_renovate' }, T).etat.active).toBe(false)
  })
  it('off-market : un mandat off-market tient ; une annonce du marché, publique, est évaluée et manque', () => {
    expect(axesComplementaires({ off_market: true }, tout, T).offMarket).toMatchObject({ active: true, frac: 1 })
    expect(axesComplementaires({ off_market: false }, tout, T).offMarket).toMatchObject({ active: true, frac: 0 })
    expect(axesComplementaires({ status: 'active' }, tout, T).offMarket).toMatchObject({ active: true, frac: 0 })
  })
})

describe('calculateScoreV2 et le lot C', () => {
  const complet = { ...BIEN, bedrooms: 3, condition: 'renovated', off_market: true }
  const exigeant = { ...RECHERCHE, bedrooms_min: 3, condition_min: 'renovated', off_market_only: true }

  it('une recherche SANS ces critères garde sa note, même sur un bien qui les renseigne', () => {
    expect(note(complet, RECHERCHE)).toEqual(note(BIEN, RECHERCHE))
  })
  it('un critère que le bien ne renseigne pas ne change pas la note', () => {
    const avant = note(BIEN, RECHERCHE).total
    expect(note(BIEN, { ...RECHERCHE, bedrooms_min: 3 }).total).toBe(avant)
    expect(note({ ...BIEN, bedrooms: 0 }, { ...RECHERCHE, bedrooms_min: 3 }).total).toBe(avant)
    expect(note({ ...BIEN, year_built: 1968 }, { ...RECHERCHE, condition_min: 'renovated' }).total).toBe(avant)
  })
  it('« à rénover » exigé ne change pas la note : un axe toujours tenu la gonflerait', () => {
    // 13,5 % au-dessus du budget, le canton sans la ville : 52. Toujours tenu, l'axe d'état en ferait 56 — au-dessus du
    // seuil de 55, un bien que le moteur n'aurait pas retenu.
    const limite = { ...BIEN, price: 1_702_500, city: 'Carouge', condition: 'good' }
    expect(note(limite, RECHERCHE).total).toBe(52)
    expect(note(limite, { ...RECHERCHE, condition_min: 'to_renovate' }).total).toBe(52)
  })
  it('tout tenu : 100 ; un critère manqué prend SA part, sur les poids vivants', () => {
    expect(note(complet, exigeant).total).toBe(100)
    // Poids vivants : 32 + 24 + 12 + 12 + 10 + 8 + 10 = 108. Off-market manqué : 10 / 108 → 91.
    expect(note({ ...complet, off_market: false }, exigeant).total).toBe(91)
    expect(note({ ...complet, bedrooms: 2 }, exigeant).total).toBe(95)
    expect(note({ ...complet, condition: 'good' }, exigeant).total).toBe(96)
  })
  it('reasons garde ses cinq clés', () => {
    const r = note({ ...BIEN, bedrooms: 3 }, { ...RECHERCHE, bedrooms_min: 4, off_market_only: true }).reasons
    expect(Object.keys(r).sort()).toEqual(['budget', 'features', 'rooms', 'type', 'zone'])
  })
  it('une configuration de production sans les nouveaux poids les reçoit par défaut', () => {
    const cfg = parseScoringConfig(JSON.stringify({ weights: { price: 32, zone: 24, type: 12, rooms: 12, surface: 10, features: 10 }, threshold: 55, version: 3 }))
    expect([cfg.weights.bedrooms, cfg.weights.condition, cfg.weights.offMarket]).toEqual([10, 8, 10])
  })
})
