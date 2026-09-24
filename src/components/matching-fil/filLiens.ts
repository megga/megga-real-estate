/**
 * Les liens d'arrivée du fil (lot D1, conception `2026-09-23-matching-lot-d1-surfaces-design.md` §4) — module PUR :
 * ni React, ni Supabase, ni traduction.
 *
 * Le fil LIT ses paramètres une fois, à l'arrivée (`lireArrivee`) ; les surfaces qui y mènent — « Aujourd'hui »,
 * « Sa boucle », « Qui pour ce bien ? » — les ÉCRIVENT par `lienFil` et `lienPlace`, jamais à la main : un paramètre
 * renommé d'un côté ne survit pas de l'autre.
 *
 * ⚠ Un lien d'arrivée l'emporte sur les filtres que l'onglet avait retenus : `lireArrivee` rend des filtres dès qu'un
 * seul paramètre du fil est là. Une ligne sans onglet ouvre « À proposer ».
 * ⚠ `?attente=`, pas `?retours=` : le filet secondaire de `redirection-ouverte.spec.ts` lit tout paramètre qui
 * commence par `retour` comme une URL de retour.
 * ⛔ Pas de `?annonce=m:` : le fil range les annonces du marché dans les lignes « Marché », qu'un filtre de bien écarte
 * (`construireSelections`) — aucune surface n'y mène (§10 de la conception).
 */
import { bienDeCle, cleSelection, type FilFiltres } from './filModele'
import { cleAttente, ONGLETS, type FilOnglet } from './filBoucle'

/** Ce qu'un lien d'arrivée demande au fil. */
interface ArriveeFil {
  /** Les filtres qu'il impose ; `null` : aucun lien, les filtres retenus restent. */
  filtres: FilFiltres | null
  /** L'onglet qu'il ouvre ; `null` : l'onglet retenu reste. */
  onglet: FilOnglet | null
  /** La ligne à choisir, une clé de l'ordre du fil ; absente de l'ordre, elle ne choisit rien (`ligneCourante`). */
  ligne: string | null
}

/** Ce qu'une surface demande au fil. */
interface CibleFil {
  onglet?: FilOnglet
  /** Une clé de l'ordre du fil : un match, `bien:<id>`, `marche:<contact>`, `correction:<recherche>:<motif>`. */
  ligne?: string
  /** Ouvre « Retours de … » de cet acheteur, dans « En attente ». */
  attente?: string
  /** Filtre le fil sur l'acheteur. */
  contact?: string
}

/** Les paramètres du fil — ceux sur lesquels le pager de Matching atterrit aussi (`estArriveeFil`). */
const PARAMETRES = ['contact', 'annonce', 'onglet', 'ligne', 'attente'] as const

/** Le paramètre d'une fiche de bien qui la fait défiler jusqu'à « Qui pour ce bien ? » (conception §7). */
export const PARAM_QUI_POUR = 'qui'

const valeur = (v: string | null): string | null => (v?.trim() ? v.trim() : null)

/** La page porte un lien d'arrivée du fil. */
export function estArriveeFil(params: URLSearchParams): boolean {
  return PARAMETRES.some((p) => params.has(p))
}

/**
 * Lit un lien d'arrivée. Rien d'inconnu ne casse le fil : un onglet inconnu est ignoré, une ligne absente de l'ordre ne
 * choisira rien. `?attente=` l'emporte sur `?onglet=`, `?ligne=` et `?contact=` : il désigne une ligne d'« En attente »
 * et le filtre qui va avec.
 */
export function lireArrivee(params: URLSearchParams): ArriveeFil {
  if (!estArriveeFil(params)) return { filtres: null, onglet: null, ligne: null }
  const attente = valeur(params.get('attente'))
  const annonce = valeur(params.get('annonce'))
  const brut = params.get('onglet')
  const ongletDemande = (ONGLETS as readonly (string | null)[]).includes(brut) ? brut as FilOnglet : null
  const ligne = attente ? cleAttente(attente) : valeur(params.get('ligne'))
  return {
    filtres: {
      bienId: annonce?.startsWith('p:') ? valeur(annonce.slice(2)) : null,
      acheteurId: attente ?? valeur(params.get('contact')),
      texte: '',
    },
    onglet: attente ? 'enAttente' : ongletDemande ?? (ligne ? 'aProposer' : null),
    ligne,
  }
}

/**
 * La requête d'un lien vers le fil (sans `?`). « À proposer » ne s'écrit pas quand une ligne l'accompagne : c'est
 * l'onglet qu'une ligne sans onglet ouvre déjà (`lireArrivee`) ; sans ligne, rien ne le redirait, donc il s'écrit.
 */
export function lienFil(c: CibleFil): string {
  const p = new URLSearchParams()
  if (c.attente) {
    p.set('attente', c.attente)
  } else {
    if (c.onglet && (c.onglet !== 'aProposer' || !c.ligne)) p.set('onglet', c.onglet)
    if (c.ligne) p.set('ligne', c.ligne)
    if (c.contact) p.set('contact', c.contact)
  }
  return p.toString()
}

/**
 * La place d'un match dans le fil, selon son statut : « Retours de … » s'il attend une réponse, « À conclure » s'il
 * intéresse, sa ligne s'il est à proposer — la ligne « Marché » de l'acheteur pour une annonce du marché, que le fil
 * range là. `null` : le fil ne le porte plus (refusé, visite planifiée, écarté) ou ne le range pas dans son ordre
 * (reporté) : une ligne sans place ne mène nulle part, plutôt qu'à une autre (conception §6).
 */
export function lienPlace(m: {
  id: string
  statut?: string | null
  contactId: string
  marche: boolean
  /**
   * Un report futur retire le match de l'ordre du fil (`construireFil`) — à l'appelant de le calculer, avec son
   * heure de lecture. Obligatoire : un appelant qui l'oublierait ferait revenir sans bruit le lien vers une autre
   * ligne.
   */
  reporte: boolean
}): string | null {
  switch (m.statut ?? 'suggested') {
    case 'suggested':
      return m.reporte ? null : lienFil({ ligne: m.marche ? cleSelection(m.contactId) : m.id, contact: m.contactId })
    case 'sent': return lienFil({ attente: m.contactId })
    case 'interested': return lienFil({ onglet: 'aConclure', ligne: m.id, contact: m.contactId })
    default: return null
  }
}

/**
 * La ligne courante du fil : le choix, s'il est dans l'ordre ; sinon la première ligne À TRAITER — pas l'en-tête d'un
 * bien (« Qui pour ce bien ? », lot C) : on arrive sur un match. Une ligne demandée par un lien et absente de l'ordre
 * (déjà traitée, filtrée) ne choisit donc rien d'autre que ce défaut.
 */
export function ligneCourante(choix: string | null, ordre: readonly string[]): string | null {
  if (choix && ordre.includes(choix)) return choix
  return ordre.find((k) => bienDeCle(k) == null) ?? ordre[0] ?? null
}
