import { describe, it, expect } from 'vitest'
import { detectTransactionType, parseAmount, mapCriteria, isSearchable, computeMissing } from './whatsapp-lead'

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
