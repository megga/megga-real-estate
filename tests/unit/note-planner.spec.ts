/**
 * Garde-fou : la note de contact ne perd pas la dernière frappe, et ne l'écrit
 * pas deux fois.
 *
 * ⛔ CE QUI A MOTIVÉ CE FICHIER. `onSaveNote` était un `(v: string) => void`
 * sans retour, appelé à chaque caractère, et la page le débouçait avec un
 * `setTimeout` que RIEN ne nettoyait — `ContactDetailSugarV3Page` n'a aucun
 * `useEffect`. Un échec d'écriture ne se voyait donc nulle part : l'agent a
 * tapé, il croit que c'est parti.
 *
 * ⚠ ET LE CORRECTIF ÉVIDENT EST UN PIÈGE. « Nettoyer le minuteur au démontage »
 * — ce que demandait l'audit — remplacerait une écriture muette par une frappe
 * PERDUE. Quitter la fiche dans les 600 ms n'écrirait plus rien du tout. On
 * chasse donc l'écriture en attente au lieu de l'annuler, et c'est cette
 * distinction que ce fichier éprouve : elle ne se lit pas dans le code, elle se
 * mesure.
 *
 * Le contrat côté React (promesse, témoin de succès, témoin d'échec) est gardé
 * ailleurs : par `tsc` pour le type de la prop, et par
 * `contacts-note-contrat.spec.ts` pour les deux témoins.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { creerNotePlanner, NOTE_DELAI_MS } from '@/components/crm-sugar/contacts-pager/notePlanner'

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('Le planificateur de note', () => {
  it('n’écrit rien avant le délai', () => {
    const ecrire = vi.fn()
    const p = creerNotePlanner()
    p.frapper('bon', ecrire)
    vi.advanceTimersByTime(NOTE_DELAI_MS - 1)
    expect(ecrire).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(ecrire).toHaveBeenCalledExactlyOnceWith('bon')
  })

  it('une rafale de frappes ne produit qu’une écriture, la dernière', () => {
    const ecrire = vi.fn()
    const p = creerNotePlanner()
    for (const v of ['b', 'bo', 'bon', 'bonj']) {
      p.frapper(v, ecrire)
      vi.advanceTimersByTime(100)
    }
    expect(ecrire).not.toHaveBeenCalled()
    vi.advanceTimersByTime(NOTE_DELAI_MS)
    expect(ecrire).toHaveBeenCalledExactlyOnceWith('bonj')
  })

  /**
   * ⛔ LE TEST QUI PORTE TOUT LE FICHIER. C'est le comportement qu'un correctif
   * « propre » — annuler le minuteur au démontage — casserait, sans que rien ne
   * le signale : l'écran serait identique, et la frappe partirait à la poubelle.
   */
  it('chasser écrit la frappe en attente au lieu de la perdre', () => {
    const ecrire = vi.fn()
    const p = creerNotePlanner()
    p.frapper('à moitié tapé', ecrire)
    expect(p.enAttente()).toBe(true)
    p.chasser()
    expect(ecrire).toHaveBeenCalledExactlyOnceWith('à moitié tapé')
    expect(p.enAttente()).toBe(false)
  })

  /**
   * Chasser puis laisser le délai s'écouler ne doit pas ré-écrire : la perte de
   * focus précède presque toujours le démontage, donc les deux chemins se
   * suivent de près et écriraient deux fois la même note.
   */
  it('une frappe chassée n’est pas ré-écrite par le minuteur', () => {
    const ecrire = vi.fn()
    const p = creerNotePlanner()
    p.frapper('une fois', ecrire)
    p.chasser()
    vi.advanceTimersByTime(NOTE_DELAI_MS * 3)
    expect(ecrire).toHaveBeenCalledTimes(1)
  })

  it('chasser sans rien en attente n’écrit pas', () => {
    const ecrire = vi.fn()
    const p = creerNotePlanner()
    p.chasser()
    p.frapper('x', ecrire)
    vi.advanceTimersByTime(NOTE_DELAI_MS)
    p.chasser()
    p.chasser()
    expect(ecrire).toHaveBeenCalledTimes(1)
  })

  /**
   * ⚠ L'écrivain est capturé à CHAQUE frappe. Un planificateur qui le retiendrait
   * de sa création garderait la fermeture du premier rendu — donc l'`id` du
   * contact ouvert à ce moment-là — et écrirait la note sur la mauvaise fiche
   * après une navigation. Le défaut serait invisible en relecture.
   */
  it('écrit avec l’écrivain de la DERNIÈRE frappe, pas du premier', () => {
    const vieux = vi.fn()
    const neuf = vi.fn()
    const p = creerNotePlanner()
    p.frapper('v', vieux)
    p.frapper('n', neuf)
    vi.advanceTimersByTime(NOTE_DELAI_MS)
    expect(vieux).not.toHaveBeenCalled()
    expect(neuf).toHaveBeenCalledExactlyOnceWith('n')
  })

  it('deux planificateurs n’ont aucun état commun', () => {
    const a = vi.fn(); const b = vi.fn()
    const p1 = creerNotePlanner(); const p2 = creerNotePlanner()
    p1.frapper('un', a)
    p2.frapper('deux', b)
    p1.chasser()
    expect(a).toHaveBeenCalledExactlyOnceWith('un')
    expect(b).not.toHaveBeenCalled()
    vi.advanceTimersByTime(NOTE_DELAI_MS)
    expect(b).toHaveBeenCalledExactlyOnceWith('deux')
  })
})
