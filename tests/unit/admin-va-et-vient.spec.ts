/**
 * Le va-et-vient CRM ↔ console super-admin — chaque sens retrouve l'endroit
 * qu'il a quitté (`src/lib/adminEntry.ts`).
 *
 * Ce qui casse en silence ici n'est pas le rendu : c'est l'ADRESSE. Une reprise
 * qui accepterait n'importe quel chemin stocké enverrait hors de la console ; un
 * retour qui suivrait une pile de téléphone rouvrirait un écran de bureau d'une
 * autre session. Aucun des deux ne lève d'erreur — on atterrit ailleurs, c'est
 * tout.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ADMIN_CONSOLE_PATH, consoleAReprendre, memoriserPageConsole, retourAuCrm } from '@/lib/adminEntry'

afterEach(() => {
  vi.unstubAllGlobals()
  sessionStorage.clear()
})

describe('reprise de la console', () => {
  it('rouvre sur l’accueil tant que rien n’est retenu', () => {
    expect(consoleAReprendre()).toBe(ADMIN_CONSOLE_PATH)
  })

  it('rouvre sur la dernière page, query comprise', () => {
    memoriserPageConsole(`${ADMIN_CONSOLE_PATH}/agencies/abc`)
    memoriserPageConsole(`${ADMIN_CONSOLE_PATH}/users?q=dupont`)
    expect(consoleAReprendre()).toBe(`${ADMIN_CONSOLE_PATH}/users?q=dupont`)
  })

  it('ne retient QUE des pages de console — la borne est le segment, pas le préfixe', () => {
    memoriserPageConsole(`${ADMIN_CONSOLE_PATH}/live`)
    for (const intrus of ['/dashboard/contacts', `${ADMIN_CONSOLE_PATH}istration`, 'https://ailleurs.test/dashboard/admin']) {
      memoriserPageConsole(intrus)
      expect(consoleAReprendre(), intrus).toBe(`${ADMIN_CONSOLE_PATH}/live`)
    }
  })

  it('ignore une valeur réécrite hors console dans le stockage', () => {
    sessionStorage.setItem('megga.admin.reprise', '/dashboard/administration')
    expect(consoleAReprendre()).toBe(ADMIN_CONSOLE_PATH)
  })

  it('un stockage refusé ramène à l’accueil, sans lever', () => {
    // ⚠ Par `stubGlobal` et non par un espion sur `Storage.prototype` : sous
    // jsdom l'espion ne voit pas l'appel, l'écriture passait — et le test
    // mesurait le stockage réel en croyant mesurer le refus.
    const refuse = () => { throw new Error('SecurityError') }
    vi.stubGlobal('sessionStorage', { getItem: refuse, setItem: refuse })
    expect(() => memoriserPageConsole(`${ADMIN_CONSOLE_PATH}/plans`)).not.toThrow()
    expect(consoleAReprendre()).toBe(ADMIN_CONSOLE_PATH)
  })
})

describe('retour au CRM', () => {
  const fiche = { path: '/dashboard/contacts/c-1', search: '?tab=docs' }

  it('ramène à l’onglet actif, query comprise', () => {
    expect(retourAuCrm(fiche, false)).toBe('/dashboard/contacts/c-1?tab=docs')
  })

  it('retombe sur le tableau de bord sans onglet', () => {
    expect(retourAuCrm(undefined, false)).toBe('/dashboard')
  })

  it('ignore la pile sur téléphone — elle n’y suit pas la navigation', () => {
    expect(retourAuCrm(fiche, true)).toBe('/dashboard')
  })

  it('n’y « revient » jamais sur un chemin de console resté dans une vieille pile', () => {
    expect(retourAuCrm({ path: `${ADMIN_CONSOLE_PATH}/agencies`, search: '' }, false)).toBe('/dashboard')
  })
})
