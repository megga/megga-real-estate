// Garde DÉTERMINISTE : aucun bien dans un message ou un e-mail que le CRM envoie au client.
//
// Décision de Julien (21.09.2026) : le matching reste EXCLUSIVEMENT chez l'agent. Le CRM ne propose
// jamais un bien au client, et ses copilotes non plus — MÊME quand l'agent le leur demande : c'est
// l'agent qui présente un bien (appel, rendez-vous, sa propre messagerie), puis le consigne
// (« Je l'ai proposé »). Les prompts des copilotes le disent ; un prompt se contourne (une demande
// insistante, un modèle qui dérive). Cette garde ne dépend d'aucun modèle : elle se pose devant
// chaque chemin par lequel un copilote écrit au client — `send_client_message` (WhatsApp), et
// `sendRelanceEmail`, que partagent `send_client_email` et la relance d'« Aujourd'hui » (dont le
// brouillon vient de l'action `draft_email` du copilote web).
//
// Elle refuse un texte qui porte :
//   · un lien vers une ANNONCE d'un portail — un domaine de `PORTAILS_ANNONCES` suivi d'un chemin ;
//   · un lien vers une fiche de bien MEGGA (`getmegga.com` : chemins de bien) ;
//   · une référence de bien MEGGA (`MG-IN-…`, `MG-MK-…`, `MG-FL-…`).
// Ce qu'elle laisse passer, VOLONTAIREMENT : un portail nommé sans lien vers une annonce (« votre
// bien sera publié sur homegate.ch »), un lien MEGGA qui n'est pas un bien (lien KYC, gestion d'une
// visite), une visite, une adresse, un montant. Le « prix de bien » de la décision reste la règle des
// prompts : un montant ne dit pas s'il est un budget ou un prix, et une garde qui refuserait « votre
// budget de CHF 1'200'000 » bloquerait des messages légitimes — puis se ferait débrancher.
//
// ⚠ La liste des portails n'est PAS importée d'`extract-property-url` : elle y vit dans le module
// d'entrée d'une fonction, qui démarre son serveur au chargement. Elle en reprend les domaines, et
// `message-sans-bien.test.ts` vérifie qu'elle les contient TOUS : un portail ajouté là-bas sans
// l'être ici rougit.
//
// PUR : aucun I/O, testable sous Node comme sous Deno.

/** Domaines de portails d'annonces : un lien avec chemin vers l'un d'eux désigne une annonce. */
export const PORTAILS_ANNONCES: readonly string[] = [
  // Ceux dont `extract-property-url` sait importer une annonce.
  'homegate.ch', 'immoscout24.ch', 'realadvisor.ch', 'comparis.ch', 'immomig.ch', 'acheter-louer.ch',
  'flatfox.ch', 'newhome.ch', 'propertybase.com', 'casaone.ch', 'anibis.ch', 'petitesannonces.ch',
  // Les autres portails d'annonces suisses courants, dont immobilier.ch, où MEGGA publie.
  'immobilier.ch', 'home.ch', 'immostreet.ch', 'tutti.ch', 'alle-immobilien.ch', 'properstar.ch',
]

/**
 * Les hôtes de MEGGA : l'app et la vitrine. L'ancienne zone n'y figure pas : le CRM n'y sert plus
 * rien depuis le 11.09.2026, et elle est promise à la holding (CLAUDE.md, migration de domaine).
 */
const HOTES_MEGGA = ['getmegga.com']

/** Chemins d'une fiche de bien chez MEGGA (app : `/dashboard/listings/:id`, `/dashboard/market/:id` ;
 *  anciennes pages publiques : `/propriete/:id`, `/listing/:id`). */
const CHEMIN_BIEN_MEGGA = /\/(?:listings?|market|propriete|proprietes|biens?|annonces?)(?:\/|$)/i

/** Référence d'un bien telle que le CRM l'affiche (`refBienInterne`, `refAnnonceMarche`). */
const REFERENCE_BIEN = /\bMG-(?:IN|MK|FL)-[A-Z0-9]/i

/** Un hôte (avec ou sans schéma) et son éventuel chemin. Couvre aussi « homegate.ch/louer/… » écrit
 *  sans `https://`, que les messageries rendent cliquable. */
const LIEN = /\b(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,})(?::\d+)?(\/[^\s<>"'`)\]]*)?/gi

export type MotifBien = 'lien_annonce' | 'fiche_megga' | 'reference_bien'

const couvre = (hote: string, domaine: string) => hote === domaine || hote.endsWith(`.${domaine}`)

/** Un chemin qui désigne une page, pas seulement la racine du site (`/`, `/?utm=…`). */
const cheminReel = (chemin: string) => chemin.split(/[?#]/)[0].replace(/\//g, '').length > 0

/**
 * Le motif pour lequel ces textes (objet, corps…) portent un bien, ou `null` s'ils n'en portent pas.
 * Un seul motif est rendu, le premier trouvé : il suffit à refuser.
 */
export function bienDansMessage(...textes: ReadonlyArray<string | null | undefined>): MotifBien | null {
  for (const texte of textes) {
    if (!texte) continue
    for (const m of texte.matchAll(LIEN)) {
      const hote = m[1].toLowerCase().replace(/^www\./, '')
      const chemin = m[2] ?? ''
      if (PORTAILS_ANNONCES.some((d) => couvre(hote, d)) && cheminReel(chemin)) return 'lien_annonce'
      if (HOTES_MEGGA.some((d) => couvre(hote, d)) && CHEMIN_BIEN_MEGGA.test(chemin)) return 'fiche_megga'
    }
    if (REFERENCE_BIEN.test(texte)) return 'reference_bien'
  }
  return null
}

/**
 * Ce que l'agent lit quand la garde refuse — sur WhatsApp, où le copilote le tutoie. Rien n'est
 * parti, et le message dit quoi faire à la place, plutôt qu'un « réessayez » qui n'y changerait rien.
 */
export function refusBienDansMessage(lang: string | null | undefined): string {
  return lang === 'en'
    ? "Nothing was sent: this message contains a property (a listing link or an MG-… reference). Matching stays with you: present the property to your client yourself (call, meeting, your own mailbox), then record « I proposed it » in matching. I can write the message without the property."
    : "Rien n'est parti : ce message contient un bien (un lien d'annonce ou une référence MG-…). Le matching reste chez toi : présente le bien au client toi-même (appel, rendez-vous, ta messagerie), puis consigne « Je l'ai proposé » dans le matching. Je peux rédiger le message sans le bien."
}
