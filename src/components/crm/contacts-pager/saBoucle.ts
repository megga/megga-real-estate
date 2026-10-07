/**
 * « Sa boucle » (fiche contact, page 1) — modèle de vue PUR du lot D1 (conception
 * `2026-09-23-matching-lot-d1-surfaces-design.md` §6). Ni React, ni Supabase, ni traduction.
 *
 * ⚠ La boucle se lit en DEUX lectures (`useContactSentMatches`) : les statuts de la boucle, et les biens REVENUS —
 * `suggested` avec un prix de proposition, la règle de `suiviAProposer` dans le fil. Un bien revenu disparaissait de la
 * fiche au moment même où il redevenait une occasion. La règle est reposée ici (`bienBoucle`) : un `suggested` jamais
 * proposé n'entre pas, quoi que la lecture ramène — sur le banc, qui compare `gt` en chaînes (`'null' > '0'`), la
 * lecture des revenus ramène aussi les `suggested` jamais proposés.
 * ⚠ Un mandat SUPPRIMÉ n'a pas de ligne : la RLS le masque, sa jointure revient nulle, et le fil jette ces matchs
 * (`useMatchingFil`). Gardé, il s'affichait sans nom, avec un lien vers une place où le fil ne le porte pas. Un
 * super-administrateur le lit encore (`super_admin_read_all_properties`) : sa jointure dit `deleted_at`, et il n'a pas
 * de ligne non plus — le fil ne lit pas un mandat supprimé (lot E1).
 * ⚠ Chaque bien mène à SA place dans le fil (`lienPlace`) ; un refus ou une visite planifiée n'y ont plus de place,
 * leur ligne ne mène nulle part.
 * ⚠ Un bien revenu REPORTÉ non plus, tant que son report court : le fil le range dans ses reportés, hors de son ordre
 * (`construireFil`), et un lien vers sa place mènerait à un AUTRE bien de l'acheteur. Le report se juge à l'heure de
 * la lecture (`maintenant`), que l'appelant passe comme à tous les modules purs du fil ; il ne compte que pour un bien
 * revenu — « Retours de … » et « À conclure » ne lisent pas le report.
 * ⚠ Ni un bien revenu qui n'est plus une OCCASION, son état lu sur sa jointure : une annonce du marché RETIRÉE
 * (`removed`), que la ligne « Marché » du fil exclut ; un mandat qui n'est plus EN VENTE (lot E1, décision 12a : il
 * n'est pas `active`, la règle du fil et du copilote WhatsApp), qu'« À proposer » exclut. La règle de
 * `matching_actions_du_jour`, qui écarte le revenu sur l'un et l'autre. Un bien proposé ou intéressé garde sa place :
 * « Retours de … » et « À conclure » ne filtrent ni l'annonce ni le mandat.
 * ⚠ Un bien revenu ne compte pas parmi les « Proposés » (lot E1, décision 10a) : il est à proposer de nouveau, et le fil
 * ne le compte pas non plus (« Déjà proposé », `compterHistorique`). Il reste « à traiter » s'il a une place.
 * ⚠ « Apprendre » (lot B) se calcule avec les règles pures du fil (`construireCorrections`), sur les seuls matchs de ce
 * contact — ce qui suffit : une correction porte sur UNE recherche, qui n'appartient qu'à lui.
 */
import type { SearchCriteria } from '@/types/contact'
import { construireCorrections, type Correction } from '@/components/matching-fil/filApprendre'
import { lienFil, lienPlace } from '@/components/matching-fil/filLiens'
import {
  listeEquipements, nombreOuNull, photoAnnonce, temps, type FilBien, type FilMatch, type SuiviMatch,
} from '@/components/matching-fil/filModele'

export type EtatBoucle = 'propose' | 'interesse' | 'visite' | 'refuse' | 'revenu'

/** Les jointures d'un match de la fiche — le banc les porte sur la ligne, il n'applique pas `select`. */
interface JointureBien {
  title?: string | null; address?: string | null; city?: string | null; canton?: string | null
  price?: number | string | null; current_price?: number | string | null; rooms?: number | string | null
  surface_m2?: number | string | null; photos?: string[] | null; photos_cf?: unknown; type?: string | null
  transaction_type?: string | null; features?: unknown
  /** Celui d'une annonce du marché (`removed` : retirée) ou d'un mandat (`active` : en vente, lot E1). */
  status?: string | null
  /** Celui d'un mandat : un super-administrateur lit encore un mandat supprimé, pas un agent (lot E1). */
  deleted_at?: string | null
}

/** Une ligne `matches` lue par la fiche (`useContactSentMatches`). */
export interface LigneBoucleContact {
  id: string
  status: string
  score: number | string | null
  sent_at: string | null
  response_at: string | null
  reaction_motif: string | null
  reaction_note: string | null
  prix_propose: number | string | null
  apprentissage_at: string | null
  client_search_id: string | null
  snoozed_until: string | null
  property_id: string | null
  market_listing_id: string | null
  property?: JointureBien | JointureBien[] | null
  market_listing?: JointureBien | JointureBien[] | null
}

/** Un bien de la boucle, prêt à écrire. */
export interface BienBoucle {
  m: FilMatch
  etat: EtatBoucle
  /** La requête du fil qui l'ouvre à sa place ; `null` : le fil ne le porte plus, ou pas avant la fin de son report. */
  lien: string | null
}

export interface SaBoucle {
  /** La proposition la plus récente d'abord ; sans date en dernier ; l'id départage. */
  biens: BienBoucle[]
  /**
   * Ce qui attend un geste de l'agent : les intéressés, puis les biens revenus qui ont une place dans le fil — un revenu
   * reporté n'attend rien avant son retour, l'agent l'a lui-même remis à plus tard ; un revenu sur une annonce retirée ou
   * sur un mandat qui n'est plus en vente n'est plus une occasion.
   */
  aTraiter: BienBoucle[]
  /** Les corrections de recherche en attente (« Apprendre »), et où les ouvrir. */
  corrections: { c: Correction; lien: string }[]
  /**
   * L'en-tête : les biens proposés, dont les intéressés (visites comprises) et les refusés — comptés comme « Déjà
   * proposé » dans le fil (`compterHistorique`). Un bien revenu n'en est pas (lot E1, décision 10a) : il est à proposer
   * de nouveau.
   */
  compteurs: { proposes: number; interesses: number; refuses: number }
}

const ETATS: Record<string, EtatBoucle> = {
  sent: 'propose', interested: 'interesse', visit_planned: 'visite', rejected: 'refuse', suggested: 'revenu',
}

const premiere = <T>(x: T | T[] | null | undefined): T | null => (Array.isArray(x) ? x[0] ?? null : x ?? null)

/**
 * Le bien d'un match, tel qu'une fiche peut le montrer : son mandat, ou son annonce du marché. Un mandat supprimé revient
 * sans jointure (`properties_select_agency` exige `deleted_at is null`) ; un super-administrateur le lit encore, sa
 * jointure le dit (`deleted_at`) : pas de bien non plus. La RLS ne masque jamais une annonce du marché. Lu par
 * `versMatch` et par le journal de la fiche d'affaire (`titresDesMatchs`).
 */
export function jointureDuMatch(l: LigneBoucleContact): JointureBien | null {
  const mandat = premiere(l.property)
  if (l.property_id != null) return mandat != null && mandat.deleted_at == null ? mandat : null
  return premiere(l.market_listing)
}

/** Le nom d'un bien : son titre, son adresse à défaut. */
export const titreDuBien = (b: JointureBien | null): string => b?.title?.trim() || b?.address?.trim() || ''

/**
 * Un match de la fiche, dans la forme du fil ; `null` sans bien — un mandat masqué par la RLS, ou supprimé, n'en a pas.
 * Lu aussi par le bloc « Matching » de la fiche d'affaire (`filAffaire.ts`), pour ses biens à proposer.
 */
export function versMatch(l: LigneBoucleContact, acheteur: FilMatch['acheteur'], criteres: SearchCriteria | null): FilMatch | null {
  const bienId = l.property_id ?? l.market_listing_id
  if (!bienId) return null
  // Un mandat sans bien lisible — supprimé, ou masqué par la RLS (`jointureDuMatch`) : la règle du fil, on n'invente
  // pas la ligne.
  const b = jointureDuMatch(l)
  if (l.property_id != null && !b) return null
  const marche = l.property_id == null
  const bien: FilBien = {
    id: bienId,
    titre: titreDuBien(b),
    prix: marche ? nombreOuNull(b?.current_price ?? null) ?? nombreOuNull(b?.price ?? null) : nombreOuNull(b?.price ?? null),
    location: b?.transaction_type === 'rent',
    type: b?.type ?? null, pieces: nombreOuNull(b?.rooms ?? null), surface: nombreOuNull(b?.surface_m2 ?? null),
    ville: b?.city ?? null, canton: b?.canton ?? null, adresse: b?.address ?? null,
    equipements: listeEquipements(b?.features), photo: photoAnnonce(b?.photos_cf, b?.photos ?? null),
    ...(marche ? { marche: { ref: bienId, sourceUrl: null } } : {}),
  }
  const suivi: SuiviMatch = {
    statut: l.status as SuiviMatch['statut'], proposeLe: l.sent_at, reponduLe: l.response_at, motif: l.reaction_motif,
    note: l.reaction_note, prixPropose: nombreOuNull(l.prix_propose), apprisLe: l.apprentissage_at,
  }
  return {
    id: l.id, score: nombreOuNull(l.score) ?? 0, raisons: null, criteres, creeLe: null, reporteJusquau: l.snoozed_until,
    rechercheId: l.client_search_id, suivi, bien, acheteur,
  }
}

/**
 * Un match tel que la fiche le montre ; `null` hors de la boucle (écarté, jamais proposé, statut inconnu). Le report se
 * juge comme dans le fil (`construireFil`) : un report à venir le retire de l'ordre, un report échu l'y remet.
 */
function bienBoucle(
  m: FilMatch, maintenant: number, annoncesRetirees: ReadonlySet<string>, mandatsHorsVente: ReadonlySet<string>,
): BienBoucle | null {
  const s = m.suivi
  const etat = s ? ETATS[s.statut] : undefined
  if (!s || !etat) return null
  if (etat === 'revenu' && s.prixPropose == null && s.motif == null) return null
  // Un bien qui n'est plus une occasion — une annonce retirée, que la ligne « Marché » du fil exclut ; un mandat qui
  // n'est plus en vente, qu'« À proposer » exclut (lot E1, décision 12a) — n'a plus de place pour un revenu ; les autres
  // statuts gardent la leur. La règle de `matching_actions_du_jour`, qui écarte le revenu sur l'un et l'autre.
  if (etat === 'revenu' && (annoncesRetirees.has(m.bien.id) || mandatsHorsVente.has(m.bien.id))) {
    return { m, etat, lien: null }
  }
  const reporte = m.reporteJusquau != null && temps(m.reporteJusquau) > maintenant
  return { m, etat, lien: lienPlace({ id: m.id, statut: s.statut, contactId: m.acheteur.id, marche: m.bien.marche != null, reporte }) }
}

/**
 * « Sa boucle » d'un acheteur, depuis ses lignes : les deux lectures fusionnées (un match lu deux fois ne compte qu'une
 * fois), les critères de ses recherches, et son identité — le texte d'un bien revenu le nomme. `maintenant` est l'heure
 * de la lecture : c'est contre elle que se juge un report.
 */
export function construireSaBoucle(
  lignes: readonly LigneBoucleContact[], criteres: ReadonlyMap<string, SearchCriteria | null>, acheteur: FilMatch['acheteur'],
  maintenant: number,
): SaBoucle {
  const vus = new Set<string>()
  const matchs: FilMatch[] = []
  // Les annonces du marché retirées, lues sur la jointure de leur match : un revenu dessus n'a plus de place (`bienBoucle`).
  const annoncesRetirees = new Set<string>()
  // Lot E1 (décision 12a) : les mandats qui ne sont plus en vente, lus de même — en vente s'il est `active`, la règle
  // du fil (`versBien`) et du copilote WhatsApp (`occasion`). Un mandat supprimé n'a déjà plus de ligne (`versMatch`).
  const mandatsHorsVente = new Set<string>()
  for (const l of lignes) {
    if (vus.has(l.id)) continue
    vus.add(l.id)
    const m = versMatch(l, acheteur, l.client_search_id ? criteres.get(l.client_search_id) ?? null : null)
    if (!m) continue
    matchs.push(m)
    if (m.bien.marche && premiere(l.market_listing)?.status === 'removed') annoncesRetirees.add(m.bien.id)
    if (!m.bien.marche && premiere(l.property)?.status !== 'active') mandatsHorsVente.add(m.bien.id)
  }
  const biens = matchs
    .flatMap((m) => { const b = bienBoucle(m, maintenant, annoncesRetirees, mandatsHorsVente); return b ? [b] : [] })
    .sort((a, b) => temps(b.m.suivi?.proposeLe ?? null) - temps(a.m.suivi?.proposeLe ?? null) || a.m.id.localeCompare(b.m.id))
  return {
    biens,
    aTraiter: [...biens.filter((b) => b.etat === 'interesse'), ...biens.filter((b) => b.etat === 'revenu' && b.lien != null)],
    corrections: construireCorrections(matchs).map((c) => ({ c, lien: lienFil({ ligne: c.cle, contact: acheteur.id }) })),
    compteurs: {
      // Un bien revenu est à proposer de nouveau, pas « proposé » (lot E1, décision 10a) : la règle du fil.
      proposes: biens.filter((b) => b.etat !== 'revenu').length,
      interesses: biens.filter((b) => b.etat === 'interesse' || b.etat === 'visite').length,
      refuses: biens.filter((b) => b.etat === 'refuse').length,
    },
  }
}
