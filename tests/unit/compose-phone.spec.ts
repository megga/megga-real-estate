/**
 * Garde-fou : la composition d'un numéro de téléphone international.
 *
 * ⛔ POURQUOI ELLE MÉRITE UN TEST. C'est un numéro d'ENVOI, pas une note : la
 * passerelle WhatsApp attend un format international, et la règle porte deux
 * pièges qui ne se voient NI en relisant le code NI à l'écran — le composant
 * n'affiche que la partie locale, la valeur composée ne vit que dans l'état.
 *
 * 1. Un numéro local VIDE doit rendre une chaîne vide, jamais l'indicatif seul.
 *    Sans ça, un formulaire non renseigné enverrait « +41 » comme numéro.
 * 2. Le zéro de tête part. Il n'existe qu'en composition NATIONALE (079…) et,
 *    placé derrière un indicatif, il casse le numéro.
 *
 * La règle vivait en DOUBLE — écrite à la main dans la réservation d'appel
 * d'onboarding, puis recopiée dans la création de contact du CRM. Sur ce dépôt,
 * une valeur ou une règle recopiée a toujours fini par diverger (la carte des
 * types du wizard, la table des statuts trouvée en trois exemplaires, le titre
 * synthétisé). Elle est désormais unique, et c'est ce fichier qui la tient.
 */
import { describe, it, expect } from 'vitest'
import { composePhone } from '@/lib/countries'

describe('composePhone', () => {
  it('ne rend rien quand le numéro local est vide', () => {
    for (const vide of ['', '   ', '\t']) {
      expect(composePhone('CH', vide), `« ${vide} » a produit un numéro`).toBe('')
    }
  })

  /**
   * ⛔ LE TEST QUI PORTE LE FICHIER. Un indicatif seul est un numéro FAUX qui
   * ressemble à une donnée saisie : il passerait les contrôles de présence, se
   * rangerait en base, et ne serait découvert qu'au premier envoi.
   */
  it('ne rend JAMAIS l’indicatif seul', () => {
    expect(composePhone('CH', '')).not.toBe('+41')
    expect(composePhone('FR', '')).not.toBe('+33')
    expect(composePhone('CH', '')).toHaveLength(0)
  })

  /**
   * ⛔ CE QUI MANQUAIT AU TEST CI-DESSUS, ET QUI L'A LAISSÉ VERT SUR UN INVARIANT
   * FAUX : il n'éprouvait que la chaîne VIDE. Or la garde portait sur la saisie
   * brute, si bien que tout ce qui s'efface APRÈS elle produisait l'indicatif
   * seul — au premier rang « 0 », qui est justement la première frappe d'un
   * numéro suisse. Le titre annonçait « JAMAIS » ; il vérifiait « pas quand
   * c'est vide ».
   */
  it('ne rend pas l’indicatif seul sur une saisie qui s’efface', () => {
    // Le « 0 » de tête est retiré : il ne reste aucun chiffre.
    expect(composePhone('CH', '0')).toBe('')
    expect(composePhone('CH', '000')).toBe('')
    // Ponctuation de formatage seule, collée ou espacée.
    expect(composePhone('CH', '-')).toBe('')
    expect(composePhone('FR', ' ( ) ')).toBe('')
  })

  it('retire le zéro de composition nationale', () => {
    expect(composePhone('CH', '079 874 94 84')).toBe('+41798749484')
    expect(composePhone('CH', '0798749484')).toBe('+41798749484')
    // Plusieurs zéros de tête — un « 0041 » recopié depuis un ancien carnet.
    expect(composePhone('CH', '0041798749484')).toBe('+4141798749484')
  })

  it('ne garde que les chiffres du numéro local', () => {
    expect(composePhone('CH', '79 874 94 84')).toBe('+41798749484')
    expect(composePhone('CH', '79-874-94-84')).toBe('+41798749484')
    expect(composePhone('CH', '(79) 874 94 84')).toBe('+41798749484')
  })

  it('suit le pays choisi', () => {
    expect(composePhone('FR', '6 12 34 56 78')).toBe('+33612345678')
    expect(composePhone('DE', '151 23456789')).toBe('+4915123456789')
    expect(composePhone('IT', '312 345 6789')).toBe('+393123456789')
  })

  /**
   * Un pays inconnu retombe sur la Suisse — c'est le marché, et un numéro sans
   * indicatif du tout serait pire qu'un numéro à l'indicatif discutable.
   */
  it('retombe sur la Suisse pour un pays inconnu', () => {
    expect(composePhone('ZZ', '798749484')).toBe('+41798749484')
  })

  /**
   * ⚠ Le « 0041 » ci-dessus montre une limite ASSUMÉE : la fonction ne
   * reconnaît pas un indicatif déjà présent dans la partie locale, elle le
   * traite comme des chiffres. C'est `splitDialCode` qui fait ce travail, à
   * l'entrée (quand on préremplit depuis un numéro déjà stocké), et la saisie
   * en deux contrôles rend le cas improbable. Figé ici pour que le jour où
   * quelqu'un veut le corriger, il voie que ce n'est pas un oubli.
   */
  it('ne prétend pas reconnaître un indicatif déjà tapé', () => {
    expect(composePhone('CH', '+41 79 874 94 84')).toBe('+414179874 9484'.replace(/\s/g, ''))
  })
})
