import { describe, it, expect } from 'vitest'
import { detectTransactionType, parseAmount, mapCriteria, isSearchable, computeMissing, normalizeZone, canonicalPropertyType, mergeCriteria, criteriaDelta, type LeadCriteria } from './whatsapp-lead'

describe('normalizeZone', () => {
  it('corrige les coquilles STT connues', () => {
    expect(normalizeZone('Carrouges')).toBe('Carouge')
    expect(normalizeZone('carouge')).toBe('Carouge')
    expect(normalizeZone('geneve')).toBe('Genève')
    expect(normalizeZone('Eaux-Vives')).toBe('Eaux-Vives')
  })
  it('laisse les zones inconnues telles quelles', () => {
    expect(normalizeZone('Lausanne')).toBe('Lausanne')
    expect(normalizeZone('Bidonville')).toBe('Bidonville')
  })
})

describe('detectTransactionType', () => {
  it('rent / buy / inconnu', () => {
    expect(detectTransactionType('appartement à louer, 3000 par mois')).toBe('rent')
    expect(detectTransactionType('je veux acheter une villa')).toBe('buy')
    expect(detectTransactionType('bonjour')).toBeUndefined()
  })
})

describe('parseAmount', () => {
  it('formats courants', () => {
    expect(parseAmount('3000')).toBe(3000)
    expect(parseAmount('1,2M')).toBe(1_200_000)
    expect(parseAmount('1.2 million')).toBe(1_200_000)
    expect(parseAmount("900'000")).toBe(900_000)
    expect(parseAmount('CHF 720’000')).toBe(720_000)
    expect(parseAmount('900k')).toBe(900_000)
  })
  it('ne confond pas « 3000 par mois » avec des millions', () => {
    expect(parseAmount('3000 par mois')).toBe(3000)
  })
  it('invalides', () => {
    expect(parseAmount(null)).toBeUndefined()
    expect(parseAmount('')).toBeUndefined()
  })
})

describe('mapCriteria (cas Sarah : location Carouge 3000 terrasse)', () => {
  const c = mapCriteria('recherche_location',
    { type: 'appartement', zones: ['Carouge'], budget: '3000', pieces: '' },
    "j'ai une cliente qui cherche un appartement à louer 3000 par mois à Carouge avec terrasse")
  it('mappe rent + type EN + zone + budget + feature', () => {
    expect(c.transaction_type).toBe('rent')
    expect(c.type).toBe('apartment')
    expect(c.zones).toEqual(['Carouge'])
    expect(c.budget_max).toBe(3000)
    expect(c.features).toContain('Terrasse')
  })
  it('est searchable', () => { expect(isSearchable(c)).toBe(true) })
  it('manque téléphone + pièces', () => {
    const missing = computeMissing(c, { phone: null, email: null })
    expect(missing).toContain('moyen de contact (téléphone ou email)')
    expect(missing).toContain('nombre de pièces')
    expect(missing).not.toContain('budget')
  })
})

describe('isSearchable', () => {
  it('faux si pas de transaction_type', () => {
    expect(isSearchable({ type: 'apartment', zones: ['Genève'] })).toBe(false)
  })
  it('faux si transaction_type seul', () => {
    expect(isSearchable({ transaction_type: 'rent' })).toBe(false)
  })
})

describe('canonicalPropertyType', () => {
  it('mappe les types FR vers la valeur market_listings.type', () => {
    expect(canonicalPropertyType('appartement')).toBe('apartment')
    expect(canonicalPropertyType('Studio')).toBe('apartment')
    expect(canonicalPropertyType('maison')).toBe('house')
    expect(canonicalPropertyType('villa')).toBe('villa')
    expect(canonicalPropertyType('bureau')).toBe('office')
    expect(canonicalPropertyType('terrain')).toBe('land')
    expect(canonicalPropertyType('parking')).toBe('parking')
    expect(canonicalPropertyType('dépôt')).toBe('storage')
  })
  it('accepte une valeur déjà canonique', () => {
    expect(canonicalPropertyType('apartment')).toBe('apartment')
    expect(canonicalPropertyType('storage')).toBe('storage')
  })
  it('renvoie undefined pour inconnu, vide, ou un type absent du marché (immeuble→building)', () => {
    expect(canonicalPropertyType('immeuble')).toBeUndefined() // building n'existe pas dans market_listings.type
    expect(canonicalPropertyType('chalet')).toBeUndefined()
    expect(canonicalPropertyType('')).toBeUndefined()
    expect(canonicalPropertyType(null)).toBeUndefined()
    expect(canonicalPropertyType(undefined)).toBeUndefined()
  })
})

describe('mergeCriteria — fusion NON destructive (enrichissement continu)', () => {
  it('remplit les champs absents sans toucher au reste', () => {
    const cur: LeadCriteria = { transaction_type: 'buy', zones: ['Carouge'] }
    const out = mergeCriteria(cur, { type: 'apartment', budget_max: 1000000 })
    expect(out).toEqual({ transaction_type: 'buy', zones: ['Carouge'], type: 'apartment', budget_max: 1000000 })
  })
  it('n’ÉCRASE JAMAIS une valeur déjà posée (agent)', () => {
    const cur: LeadCriteria = { type: 'house', budget_max: 800000, transaction_type: 'buy' }
    const out = mergeCriteria(cur, { type: 'apartment', budget_max: 2000000, transaction_type: 'rent' })
    expect(out.type).toBe('house')           // gardé
    expect(out.budget_max).toBe(800000)      // pas élargi
    expect(out.transaction_type).toBe('buy') // gardé
  })
  it('fait l’UNION des zones et prestations (jamais de retrait, dédup casse-insensible)', () => {
    const cur: LeadCriteria = { zones: ['Carouge'], features: ['balcon'] }
    const out = mergeCriteria(cur, { zones: ['carouge', 'Champel'], features: ['parking'] })
    expect(out.zones).toEqual(['Carouge', 'Champel'])
    expect(out.features).toEqual(['balcon', 'parking'])
  })
  it('gère current null (1re fusion) et ne crée pas de tableaux vides', () => {
    expect(mergeCriteria(null, { type: 'villa' })).toEqual({ type: 'villa' })
    expect(mergeCriteria({}, {}).zones).toBeUndefined()
  })
})

describe('criteriaDelta — décrit ce qui est ajouté', () => {
  it('liste les nouveautés (champ comblé + zone ajoutée)', () => {
    const before: LeadCriteria = { transaction_type: 'buy', zones: ['Carouge'] }
    const after: LeadCriteria = { transaction_type: 'buy', zones: ['Carouge', 'Champel'], type: 'apartment', budget_max: 1000000 }
    const d = criteriaDelta(before, after)
    expect(d).toContain('type apartment')
    expect(d).toContain('budget 1000000')
    expect(d).toContain('secteur Champel')
    expect(d.some((x) => x.includes('Carouge'))).toBe(false) // pas re-listée
  })
  it('vide si rien de neuf', () => {
    const c: LeadCriteria = { transaction_type: 'buy', type: 'apartment', zones: ['Carouge'] }
    expect(criteriaDelta(c, c)).toEqual([])
    expect(criteriaDelta(c, mergeCriteria(c, { zones: ['carouge'] }))).toEqual([]) // doublon CI → aucun ajout
  })
})
