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
import { MEGGA_WA_BUSINESS_DIGITS } from '@/lib/whatsappBusiness'
import { formatInternationalPhone } from '@/lib/countries'

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
    expect(formatInternationalPhone(MEGGA_WA_BUSINESS_DIGITS)).toBe('+41 22 567 00 75')
  })

  it('groupe AUSSI les autres pays, chacun selon sa forme', () => {
    // ⚠ CETTE ATTENTE A ÉTÉ INVERSÉE le 17.08.2026, et c'est le fond du correctif.
    // Elle disait « rend un numéro hors moule tel quel plutôt que mal découpé » et
    // figeait `+33612345678` d'un bloc — ce qui était juste tant que le formateur ne
    // servait QUE le numéro Business, suisse par construction. Réemployé pour le numéro
    // personnel de l'agent, il rendait ce bloc à un Français à l'endroit même où le champ
    // de saisie venait de lui proposer « 6 12 34 56 78 » en exemple.
    // Le groupement n'est pas devenu « de force » pour autant : il est DÉRIVÉ de
    // PHONE_EXAMPLES, dont chaque entrée a été vérifiée.
    expect(formatInternationalPhone('33612345678')).toBe('+33 6 12 34 56 78')
    expect(formatInternationalPhone('4915123456789')).toBe('+49 151 23456789')
    expect(formatInternationalPhone('393123456789')).toBe('+39 312 345 6789')
  })

  it('détache seulement l\'indicatif quand la longueur ne colle pas', () => {
    // Numéro suisse trop court d'un chiffre : le moule CH attend 9 chiffres nationaux.
    // On rend l'indicatif détaché et le national INTACT — un découpage forcé produirait
    // un numéro faux qui se recopie de travers sans que rien ne signale l'erreur.
    expect(formatInternationalPhone('4122567007')).toBe('+41 22567007')
    // Indicatif inconnu du registre : rien à dériver, on rend les chiffres tels quels.
    expect(formatInternationalPhone('99912345678')).toBe('+99912345678')
    expect(formatInternationalPhone('')).toBe('')
    expect(formatInternationalPhone(null)).toBe('')
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

// ── Indicatifs PARTAGÉS ─────────────────────────────────────────────────────
//
// ⛔ Une revue avait signalé ce cas, puis l'avait elle-même RÉFUTÉ ; la mesure a donné
// raison à la trouvaille. `countryForDialCode('+1')` rend « BS » (Bahamas) et `+7` rend
// « KZ » — deux pays dépourvus d'exemple. Les entrées US, CA et RU de PHONE_EXAMPLES
// étaient donc INATTEIGNABLES, et un numéro américain ressortait « +1 2015550123 » d'un
// bloc, c'est-à-dire exactement le défaut que ce formateur existe pour corriger.
//
// Le test fige la propriété qui manquait : chercher le premier pays de l'indicatif QUI
// AIT un exemple, et non le premier pays tout court.
describe('formatInternationalPhone — indicatifs partagés entre pays', () => {
  it('trouve un exemple même quand le premier pays de l\'indicatif n\'en a pas', () => {
    expect(formatInternationalPhone('12015550123')).toBe('+1 201 555 0123')
    expect(formatInternationalPhone('79123456789')).toBe('+7 912 345 67 89')
  })
})
