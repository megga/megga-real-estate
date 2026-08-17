// Le numéro WhatsApp Business affiché à l'agent — et la garde contre sa péremption.
//
// Ce que ce fichier défend n'est pas une mise en forme, c'est un mode de panne SILENCIEUX.
// Entre la bascule de portefeuille Meta du 14.08.2026 et le 17.08, la carte d'appairage
// des Réglages a demandé aux agents d'envoyer leur code à `+41 79 874 94 84`, un numéro
// que le nouveau WABA ne servait plus. Le parcours n'échouait pas : il ATTENDAIT. Aucune
// erreur, aucun journal, juste un écran « en attente de votre message » qui ne se
// résoudrait jamais. Un littéral recopié dans un composant d'écran ne survit pas à un
// changement d'infrastructure, et rien ne le disait.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { MEGGA_WA_BUSINESS_DIGITS, formatWaBusinessNumber } from '@/lib/whatsappBusiness'

/** Ancien numéro pilote, retiré du service par la bascule du 14.08.2026. */
const NUMERO_PERIME = '41798749484'

/**
 * Blanchit commentaires de bloc et de ligne.
 *
 * ⚠ Sans ça la garde est INUTILISABLE, et pas par excès de zèle théorique : trois
 * fichiers la faisaient rougir dès sa première exécution, tous les trois pour la bonne
 * raison. `NewContactModal` et `OcBooking` citent « 079 874 94 84 » en commentaire comme
 * exemple de saisie mal formée à normaliser, et `whatsappBusiness.ts` documente
 * précisément le numéro périmé qu'il remplace. Une garde qui interdit d'ÉCRIRE l'histoire
 * d'un bug pousse à l'effacer — c'est-à-dire à perdre la seule trace qui empêche de le
 * refaire. On ne cherche donc que le code.
 */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

function fichiersSource(racine: string, acc: string[] = []): string[] {
  for (const nom of readdirSync(racine)) {
    const chemin = join(racine, nom)
    if (statSync(chemin).isDirectory()) { fichiersSource(chemin, acc); continue }
    if (/\.(ts|tsx)$/.test(chemin)) acc.push(chemin)
  }
  return acc
}

describe('numéro WhatsApp Business', () => {
  it('vaut le numéro du WABA en service depuis la bascule du 14.08.2026', () => {
    // Le seul témoin en dépôt est cette constante ; la source de vérité est Meta.
    // Le test fige donc la valeur pour que la CHANGER soit un geste ÉCRIT, revu, daté —
    // et non un littéral qu'on oublie de suivre.
    expect(MEGGA_WA_BUSINESS_DIGITS).toBe('41225670075')
  })

  it("groupe à la suisse — c'est ce que l'agent recopie à la main", () => {
    expect(formatWaBusinessNumber('41225670075')).toBe('+41 22 567 00 75')
    expect(formatWaBusinessNumber()).toBe('+41 22 567 00 75')
  })

  it('rend un numéro hors moule tel quel plutôt que mal découpé', () => {
    // Un numéro français ou allemand n'a pas la longueur du moule CH. Le grouper de
    // force produirait un numéro FAUX à l'écran ; non groupé, il reste recopiable.
    expect(formatWaBusinessNumber('33612345678')).toBe('+33612345678')
    expect(formatWaBusinessNumber('')).toBe('')
  })

  it("ne réapparaît nulle part dans src/ sous l'ancien numéro pilote", () => {
    // La régression exacte de l'épisode : le numéro vivait dans un composant d'écran.
    // Les formes cherchées portent toutes l'indicatif pays ou le zéro national — donc
    // elles se COMPOSENT. C'est volontaire : `countries.ts` et les placeholders i18n
    // emploient « 79 874 94 84 » nu comme exemple de saisie, et l'interdire là
    // n'aurait rien défendu.
    const formes = [NUMERO_PERIME, '+41 79 874 94 84', '079 874 94 84']
    const coupables: string[] = []
    for (const fichier of fichiersSource('src')) {
      // Les fixtures de démo ont le droit de nommer l'ancien numéro : elles ne
      // s'adressent à aucun agent réel.
      if (/\/pages\/dev\//.test(fichier)) continue
      const source = sansCommentaires(readFileSync(fichier, 'utf8'))
      if (formes.some((f) => source.includes(f))) coupables.push(fichier)
    }
    expect(coupables).toEqual([])
  })
})
