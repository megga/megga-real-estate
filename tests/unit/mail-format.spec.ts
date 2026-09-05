/**
 * Les formats d'affichage de la Messagerie — la seule partie de l'écran qui se
 * mesure sans monter un composant.
 *
 * La date de liste porte trois formes (README §2 : `08:29` · `Hier` · `23.08`),
 * et c'est la BORNE DE JOURNÉE qui se casse en silence : elle doit se lire dans
 * le fuseau suisse, pas dans celui de la machine.
 */
import { describe, it, expect } from 'vitest'
import { mailDateLabel, initialsOf, displayAddress } from '@/lib/mail/format'

const NOW = new Date('2026-09-03T14:00:00+02:00')
describe('mailDateLabel (maquette : 08:29 · Hier · 23.08)', () => {
  it('aujourd hui = heure, hier = Hier, sinon JJ.MM', () => {
    expect(mailDateLabel('2026-09-03T06:29:00Z', NOW, 'fr')).toBe('08:29')
    expect(mailDateLabel('2026-09-02T18:00:00Z', NOW, 'fr')).toBe('Hier')
    expect(mailDateLabel('2026-08-23T18:00:00Z', NOW, 'fr')).toBe('23.08')
    expect(mailDateLabel('2026-09-02T18:00:00Z', NOW, 'de')).toBe('Gestern')
    expect(mailDateLabel('2026-09-02T18:00:00Z', NOW, 'en')).toBe('Yesterday')
    expect(mailDateLabel('2026-09-02T18:00:00Z', NOW, 'it')).toBe('Ieri')
  })
  it('année différente = JJ.MM.AA', () => {
    expect(mailDateLabel('2025-12-24T10:00:00Z', NOW, 'fr')).toBe('24.12.25')
  })
})
describe('initialsOf / displayAddress', () => {
  it('initiales sur nom, sinon sur adresse', () => {
    expect(initialsOf('Zoé Rochat', 'zoe@ex.ch')).toBe('ZR')
    expect(initialsOf(null, 'zoe@ex.ch')).toBe('Z')
    expect(initialsOf('Banque Cantonale de Genève', 'x@bcge.ch')).toBe('BC')
  })
  it('affichage : nom sinon adresse', () => {
    expect(displayAddress({ name: 'Zoé', email: 'zoe@ex.ch' })).toBe('Zoé')
    expect(displayAddress({ name: null, email: 'zoe@ex.ch' })).toBe('zoe@ex.ch')
  })
})
