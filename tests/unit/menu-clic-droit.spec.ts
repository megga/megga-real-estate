/**
 * Le clic droit du Pipeline (28.09.2026) : ses deux règles pures.
 *
 * 1. `menuNatifVoulu` rend au navigateur SON menu — ⇧, un champ, un lien, du texte sélectionné.
 *    Un menu maison qui confisque « Copier » ou « Ouvrir le lien » se fait haïr ; et le jour où
 *    cette règle casse, rien d'autre ne rougit : le menu maison s'ouvre, simplement, partout.
 * 2. `joursProposes` : les jours d'une (re)planification, les mêmes dans la pastille de la
 *    Timeline, la fiche et le menu — sans doublon (un dimanche, « Lundi » EST « Demain »).
 *
 * L'ouverture elle-même se prouve dans un vrai navigateur : `tests/e2e/menus-clic-droit.spec.ts`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { menuNatifVoulu } from '@/components/crm/pipeline/menuClicDroit'
import { echeanceDans, joursProposes } from '@/components/crm/pipeline/affaire'

const clic = (cible: Element, shiftKey = false) => ({ target: cible, shiftKey }) as unknown as ReactMouseEvent

describe('menuNatifVoulu — le menu du navigateur reste à portée', () => {
  afterEach(() => { window.getSelection()?.removeAllRanges(); document.body.innerHTML = '' })

  it('une carte, sans rien de sélectionné : le menu maison', () => {
    document.body.innerHTML = '<div id="carte"><span id="nom">Julie Morand</span></div>'
    expect(menuNatifVoulu(clic(document.getElementById('nom')!))).toBe(false)
  })

  it('⇧ + clic droit : le navigateur, partout', () => {
    document.body.innerHTML = '<div id="carte">Julie</div>'
    expect(menuNatifVoulu(clic(document.getElementById('carte')!, true))).toBe(true)
  })

  it('un champ ou un lien : le navigateur (coller, ouvrir le lien)', () => {
    document.body.innerHTML = '<input id="champ" /><a id="lien" href="https://wa.me/1"><span id="dans">WhatsApp</span></a><textarea id="zone"></textarea>'
    expect(menuNatifVoulu(clic(document.getElementById('champ')!))).toBe(true)
    expect(menuNatifVoulu(clic(document.getElementById('zone')!))).toBe(true)
    expect(menuNatifVoulu(clic(document.getElementById('dans')!))).toBe(true)
  })

  it('du texte sélectionné : le navigateur (copier)', () => {
    document.body.innerHTML = '<p id="texte">Villa individuelle · Cologny</p>'
    const range = document.createRange()
    range.selectNodeContents(document.getElementById('texte')!)
    window.getSelection()!.addRange(range)
    expect(menuNatifVoulu(clic(document.getElementById('texte')!))).toBe(true)
  })
})

describe('joursProposes — les mêmes jours partout, jamais deux fois le même', () => {
  afterEach(() => { vi.useRealTimers() })

  it('un mercredi : Demain, Après-demain, Lundi, Dans une semaine', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 30, 9))
    expect(joursProposes(false)).toEqual([
      { cle: 'demain', jours: 1 }, { cle: 'apresDemain', jours: 2 }, { cle: 'lundi', jours: 5 }, { cle: 'semaine', jours: 7 },
    ])
  })

  it('un dimanche, « Lundi » EST « Demain » : il ne s’offre qu’une fois', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 27, 9))
    expect(joursProposes(false).map((c) => c.cle)).toEqual(['demain', 'apresDemain', 'semaine'])
  })

  it('un lundi, « Lundi » EST « Dans une semaine »', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 28, 9))
    expect(joursProposes(false).map((c) => c.cle)).toEqual(['demain', 'apresDemain', 'lundi'])
  })

  it('« Aujourd’hui » seulement pour une première action', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 30, 9))
    expect(joursProposes(true)[0]).toEqual({ cle: 'aujourdhui', jours: 0 })
    expect(joursProposes(false).some((c) => c.cle === 'aujourdhui')).toBe(false)
  })
})

describe('echeanceDans — l’heure gardée, 10 h pour une première', () => {
  afterEach(() => { vi.useRealTimers() })

  it('replanifie à la même heure', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 30, 9))
    const d = echeanceDans(2, new Date(2026, 8, 29, 14, 30).toISOString())
    expect([d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2, 14, 30])
  })

  it('une première action tombe à 10 h', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 8, 30, 9))
    const d = echeanceDans(1, null)
    expect([d.getDate(), d.getHours(), d.getMinutes()]).toEqual([1, 10, 0])
  })
})
