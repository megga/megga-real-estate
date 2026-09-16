/**
 * Garde-fou : la jauge et les boutons de « Nouveau bien » disent la même chose.
 *
 * ⛔ Les conditions de mise en ligne sont celles de l'ancien wizard (≥ 5 photos) ; une
 * divergence ferait refuser par un parcours ce que l'autre accepte.
 */
import { describe, it, expect } from 'vitest'
import { EMPTY_WIZARD, type WizardData, type WizardPhoto } from '@/components/crm-wizard/tokens'
import {
  PHOTOS_MIN_PUBLICATION, apercuBien, manquesPublication, pointsCompletude, pourcentageCompletude,
} from '@/components/crm/biens/nouveau/completude'

const photo = (i: number): WizardPhoto => ({ id: `p${i}`, label: '', kind: 'interior', tone: '', previewUrl: `blob:${i}` })
const plein: WizardData = {
  ...EMPTY_WIZARD,
  addr: 'Avenue de Champel 12, 1206 Genève', addrConfirmed: true, postCode: '1206', city: 'Genève', cantonShort: 'GE',
  addrStreet: 'Avenue de Champel', addrHouseNumber: '12',
  type: 'appartement', area: 118, rooms: 4.5, price: 1_450_000,
  photos: Array.from({ length: PHOTOS_MIN_PUBLICATION }, (_, i) => photo(i)),
  description: 'x'.repeat(250), ownerContactId: 'c1',
}

describe('Nouveau bien — complétude', () => {
  it('un bien vide : rien de fait, et la mise en ligne attend adresse, prix et photos', () => {
    const points = pointsCompletude(EMPTY_WIZARD)
    expect(pourcentageCompletude(points)).toBeLessThan(20)
    expect(manquesPublication(points)).toEqual(['adresse', 'prix', 'photos'])
  })

  it('un bien complet est publiable, à 100 %', () => {
    const points = pointsCompletude(plein)
    expect(manquesPublication(points)).toEqual([])
    expect(pourcentageCompletude(points)).toBe(100)
  })

  it('une photo de moins que le seuil bloque la mise en ligne', () => {
    const points = pointsCompletude({ ...plein, photos: plein.photos.slice(1) })
    expect(manquesPublication(points)).toEqual(['photos'])
  })

  it('une adresse saisie à la main compte avec NPA et localité, même non confirmée', () => {
    const manuelle = { ...plein, addrConfirmed: false }
    expect(manquesPublication(pointsCompletude(manuelle))).toEqual([])
    expect(manquesPublication(pointsCompletude({ ...manuelle, city: '' }))).toEqual(['adresse'])
  })

  it('en location, c’est le loyer qui compte ; un terrain n’a pas besoin de pièces', () => {
    const location = { ...plein, transaction: 'location' as const, price: null, rent: null }
    expect(manquesPublication(pointsCompletude(location))).toEqual(['prix'])
    const terrain = pointsCompletude({ ...plein, type: 'terrain', rooms: null })
    expect(terrain.find((p) => p.cle === 'bien')?.fait).toBe(true)
  })

  it('l’aperçu est la carte de Mes biens : brouillon, couverture = première photo', () => {
    const carte = apercuBien(plein, 'Appartement 4,5 pièces · Genève')
    expect(carte.status).toBe('draft')
    expect(carte.coverPhoto).toBe('blob:0')
    expect(carte.addr).toBe('Avenue de Champel 12, Genève')
    expect(carte.photoCount).toBe(PHOTOS_MIN_PUBLICATION)
  })
})
