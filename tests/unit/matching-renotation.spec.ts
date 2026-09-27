/**
 * « Apprendre » côté moteur (lot B) : la réévaluation des matchs à proposer d'une recherche ajustée rejoue
 * le VRAI barème (`calculateScoreV2`) ET le pré-filtre dur du moteur, écarte ce qu'il ne créerait pas
 * aujourd'hui, et ne touche pas un match ajouté à la main. La correction part en UNE clé, fusionnée dans les
 * critères d'aujourd'hui. Module pur de l'edge `matching-engine`, mode `rescore-search`.
 */
import { describe, expect, it, vi } from 'vitest'
import { calculateScoreV2, DEFAULT_SCORING_CONFIG } from '../../supabase/functions/_shared/matching-normalize'
import {
  fusionnerCorrection, lireCorrection, lireRefus, renoter, tranches, type MatchARenoter,
} from '../../supabase/functions/_shared/matching-renotation'

const CRITERES = {
  transaction_type: 'buy', type: 'apartment', zones: ['Genève', 'Champel', 'GE'], budget_min: 1_300_000, budget_max: 1_550_000,
  rooms_min: 4, surface_min: 100, features: ['balcon', 'ascenseur', 'terrasse'],
}
const annonce = (id: string, prix: number, champs: Record<string, unknown> = {}): Record<string, unknown> => ({
  id, price: prix, current_price: prix, type: 'apartment', city: 'Genève', canton: 'GE', rooms: 4.5, surface_m2: 132,
  features: ['Terrasse', 'Ascenseur', 'Balcon'], status: 'active', price_at_first_seen: prix, transaction_type: 'buy',
  quality_score: 70, ...champs,
})
const match = (id: string, bienId: string, champs: Partial<MatchARenoter> = {}): MatchARenoter => ({
  id, property_id: null, market_listing_id: bienId, score_version: 4, ...champs,
})
const sansLoyer = () => null

describe('renoter — le vrai barème, sur les critères corrigés', () => {
  const biens = new Map<string, Record<string, unknown>>([
    ['ml-2', annonce('ml-2', 1_590_000)],
    ['ml-4', annonce('ml-4', 1_750_000, { city: 'Onex', rooms: 3.5, surface_m2: 92, features: ['Ascenseur'] })],
  ])

  it('score et raisons de calculateScoreV2 ; sous le seuil, écarté', () => {
    const notes = renoter([match('m9', 'ml-2'), match('m19', 'ml-4')], biens, CRITERES, DEFAULT_SCORING_CONFIG, sansLoyer)
    const attendu = (id: string) => calculateScoreV2(biens.get(id)!, CRITERES, DEFAULT_SCORING_CONFIG, null)
    expect(notes).toEqual([
      { id: 'm9', score: attendu('ml-2').total, reasons: attendu('ml-2').reasons, score_version: DEFAULT_SCORING_CONFIG.version, ecarte: false },
      { id: 'm19', score: attendu('ml-4').total, reasons: attendu('ml-4').reasons, score_version: DEFAULT_SCORING_CONFIG.version, ecarte: true },
    ])
    // Les notes du banc (Task 16) : 94, et 49 sous le seuil.
    expect(notes.map((n) => n.score)).toEqual([94, 49])
  })

  it('un match ajouté à la main (sans `score_version`), ou dont le bien est illisible, n’est pas renoté', () => {
    expect(renoter(
      [match('m-main', 'ml-2', { score_version: null }), match('m-perdu', 'ml-inconnue')],
      biens, CRITERES, DEFAULT_SCORING_CONFIG, sansLoyer,
    )).toEqual([])
  })

  it('un bien d’une autre transaction est écarté, comme le moteur ne l’aurait jamais créé', () => {
    const loc = new Map([['p-loc', annonce('p-loc', 3_000, { transaction_type: 'rent' })]])
    const [n] = renoter([match('m-x', 'p-loc', { market_listing_id: null, property_id: 'p-loc' })], loc, CRITERES, DEFAULT_SCORING_CONFIG, sansLoyer)
    expect(n).toMatchObject({ id: 'm-x', score: 0, ecarte: true })
  })

  it('la référence loyer ne sert qu’une annonce du MARCHÉ d’une recherche de LOCATION', () => {
    const refLoyer = vi.fn(() => null)
    renoter([match('m9', 'ml-2')], biens, CRITERES, DEFAULT_SCORING_CONFIG, refLoyer)
    expect(refLoyer).not.toHaveBeenCalled()
    const loyer = { ...CRITERES, transaction_type: 'rent', budget_min: 2_000, budget_max: 3_000 }
    const locations = new Map([
      ['ml-l', annonce('ml-l', 2_800, { transaction_type: 'rent' })],
      ['p-l', annonce('p-l', 2_800, { transaction_type: 'rent' })],
    ])
    renoter([match('a', 'ml-l'), match('b', 'p-l', { market_listing_id: null, property_id: 'p-l' })], locations, loyer, DEFAULT_SCORING_CONFIG, refLoyer)
    expect(refLoyer).toHaveBeenCalledTimes(1)
  })
})

describe('renoter — le pré-filtre dur de `match_candidate_listings`, rejoué', () => {
  const noter = (a: Record<string, unknown>) =>
    renoter([match('m', a.id as string)], new Map([[a.id as string, a]]), CRITERES, DEFAULT_SCORING_CONFIG, sansLoyer)[0]!

  it('au-delà du budget à 15 % près, écarté même quand le barème le garderait', () => {
    // 1'800'000 > 1'550'000 × 1,15 : le budget ne rapporte rien, les quatre autres axes suffiraient au seuil.
    const cher = annonce('ml-cher', 1_800_000)
    expect(calculateScoreV2(cher, CRITERES).total).toBeGreaterThanOrEqual(DEFAULT_SCORING_CONFIG.threshold)
    expect(noter(cher)).toMatchObject({ score: 0, ecarte: true })
    // À la borne, il passe (`<=`, comme en SQL) ; sous le minimum à 15 % près, il sort.
    expect(noter(annonce('ml-borne', 1_782_500)).ecarte).toBe(false)
    expect(noter(annonce('ml-bas', 1_100_000))).toMatchObject({ score: 0, ecarte: true })
  })

  it('hors des cantons de la recherche, sans prix, retirée, sans qualité : écartée', () => {
    expect(noter(annonce('ml-vd', 1_500_000, { canton: 'VD', city: 'Lausanne' })).ecarte).toBe(true)
    expect(noter(annonce('ml-0', 0, { current_price: 0 })).ecarte).toBe(true)
    expect(noter(annonce('ml-retiree', 1_500_000, { status: 'removed' })).ecarte).toBe(true)
    expect(noter(annonce('ml-qualite', 1_500_000, { quality_score: 40 })).ecarte).toBe(true)
    expect(noter(annonce('ml-inconnue', 1_500_000, { quality_score: null })).ecarte).toBe(true)
    expect(noter(annonce('ml-baisse', 1_500_000, { status: 'price_reduced', price_at_first_seen: 1_600_000 })).ecarte).toBe(false)
  })

  it('un MANDAT n’a pas de pré-filtre de prix : le barème seul décide, comme à sa création', () => {
    const cher = annonce('p-cher', 1_800_000)
    const [n] = renoter([match('m', 'p-cher', { market_listing_id: null, property_id: 'p-cher' })], new Map([['p-cher', cher]]), CRITERES, DEFAULT_SCORING_CONFIG, sansLoyer)
    expect(n).toMatchObject({ score: calculateScoreV2(cher, CRITERES).total, ecarte: false })
  })
})

describe('la correction : UNE clé, fusionnée dans les critères d’aujourd’hui', () => {
  it('lit les seules clés que la fiche écrit, chacune dans sa forme', () => {
    expect(lireCorrection({ cle: 'budget_max', valeur: 1_550_000 })).toEqual({ cle: 'budget_max', valeur: 1_550_000 })
    expect(lireCorrection({ cle: 'zones', valeur: ['Champel', 'GE'] })).toEqual({ cle: 'zones', valeur: ['Champel', 'GE'] })
    expect(lireCorrection({ cle: 'type', valeur: ' villa ' })).toEqual({ cle: 'type', valeur: 'villa' })
    for (const illisible of [
      null, [], { cle: 'budget_min', valeur: 1 }, { cle: 'toString', valeur: 1 }, { cle: 'budget_max', valeur: '1550000' },
      { cle: 'budget_max', valeur: 0 }, { cle: 'rooms_min', valeur: Number.NaN }, { cle: 'zones', valeur: [] },
      { cle: 'features', valeur: ['balcon', 3] }, { cle: 'type', valeur: '  ' },
    ]) expect(lireCorrection(illisible), JSON.stringify(illisible)).toBeNull()
  })

  it('ne remplace que sa clé : ce qu’un collègue a changé entre-temps sur une autre reste', () => {
    // L'écran avait lu `rooms_min: 4` ; la recherche porte désormais 5.
    const aujourdhui = { ...CRITERES, rooms_min: 5 }
    expect(fusionnerCorrection(aujourdhui, { cle: 'budget_max', valeur: 1_450_000 })).toEqual({ ...CRITERES, rooms_min: 5, budget_max: 1_450_000 })
    expect(fusionnerCorrection(null, { cle: 'type', valeur: 'house' })).toEqual({ type: 'house' })
  })
})

describe('lireRefus et tranches', () => {
  const U1 = '00000000-0000-4000-8000-000000000001'
  const U2 = '00000000-0000-4000-8000-000000000002'

  it('des uuid, sans doublon, sans plafond de 50 ; absente : aucun', () => {
    expect(lireRefus(undefined)).toEqual([])
    expect(lireRefus([U1, U2, U1])).toEqual([U1, U2])
    const nombreux = Array.from({ length: 120 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`)
    expect(lireRefus(nombreux)).toHaveLength(120)
    expect(lireRefus([U1, 'pas-un-uuid'])).toBeNull()
    expect(lireRefus('m-1')).toBeNull()
  })

  it('découpe en lots', () => {
    expect(tranches([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(tranches([], 2)).toEqual([])
  })
})
