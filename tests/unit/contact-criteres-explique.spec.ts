/**
 * Les trois critères du lot C sur la fiche contact : chambres, état minimum, off-market seulement. Ils passent par
 * `buildSearchCriteria`, qui reconstruit l'objet de zéro — une clé qu'il ignore est EFFACÉE au premier
 * enregistrement de la fiche, et le pont `sync_contact_client_search` recopie cet effacement dans la recherche.
 */
import { describe, expect, it } from 'vitest'
import { buildSearchCriteria, parseSearchCriteria, type CriteriaInput } from '@/lib/contactCriteria'

const BASE: CriteriaInput = { transaction: 'vente', types: ['appartement'], cantons: ['GE'], budgetMax: 2_500_000 }

describe('les critères du lot C', () => {
  it('s’écrivent, et se relisent à l’identique', () => {
    const c = buildSearchCriteria({ ...BASE, bedroomsMin: 4, conditionMin: 'renovated', offMarketOnly: true })
    expect(c).toMatchObject({ bedrooms_min: 4, condition_min: 'renovated', off_market_only: true })
    expect(parseSearchCriteria(c)).toMatchObject({ bedroomsMin: 4, conditionMin: 'renovated', offMarketOnly: true })
  })
  it('un critère vide ne s’écrit pas', () => {
    const c = buildSearchCriteria({ ...BASE, bedroomsMin: 0, conditionMin: null, offMarketOnly: false })
    expect(c).not.toHaveProperty('bedrooms_min')
    expect(c).not.toHaveProperty('condition_min')
    expect(c).not.toHaveProperty('off_market_only')
  })
  it('à lui seul, chacun rend la recherche signifiante', () => {
    const vide: CriteriaInput = { transaction: 'vente', types: [], cantons: [] }
    expect(buildSearchCriteria(vide)).toBeNull()
    expect(buildSearchCriteria({ ...vide, bedroomsMin: 3 })).not.toBeNull()
    expect(buildSearchCriteria({ ...vide, conditionMin: 'new' })).not.toBeNull()
    expect(buildSearchCriteria({ ...vide, offMarketOnly: true })).not.toBeNull()
  })
  it('une valeur d’état hors vocabulaire se relit comme absente', () => {
    expect(parseSearchCriteria({ condition_min: 'excellent' as never }).conditionMin).toBeNull()
  })
})
