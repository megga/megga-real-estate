/**
 * « Aujourd'hui » — le segment Matching (lot D1, conception `2026-09-23-matching-lot-d1-surfaces-design.md` §5) :
 * modèle de vue PUR des lignes de `matching_actions_du_jour()`. Ni React, ni Supabase, ni traduction.
 *
 * La RPC classe et coupe (cinq au plus) ; ce module dit OÙ chaque action mène et avec quels MOTS — une clé et ses
 * valeurs, que l'écran traduit. Une ligne mal formée (sorte inconnue, identifiant manquant) est écartée : une action
 * sans destination serait un bouton mort.
 *
 * ⚠ Une baisse de prix mène à la PLACE du match dans le fil (`lienPlace`) : « Retours de … » s'il attend une réponse,
 * sa ligne s'il est revenu à proposer — la ligne « Marché » de l'acheteur pour une annonce du marché.
 */
import { lienFil, lienPlace } from '@/components/matching-fil/filLiens'
import { cleSelection } from '@/components/matching-fil/filModele'

/** Le plafond du segment (§5.1) : au-delà, « Voir tout » ouvre le fil. */
export const MAX_ACTIONS = 5

export type GenreAction = 'retour' | 'prix' | 'mandat' | 'marche'

/** Une ligne de `matching_actions_du_jour()`. */
export interface LigneAction {
  genre: string
  contact_id: string | null
  prenom: string | null
  nom: string | null
  match_id: string | null
  property_id: string | null
  market_listing_id: string | null
  statut: string | null
  titre: string | null
  ville: string | null
  nombre: number | null
  nouveaux: number | null
  baisses: number | null
  montant: number | string | null
  location: boolean | null
  quand: string | null
  total: number | null
}

/** Une action du segment, prête à écrire. */
export interface ActionMatching {
  /** Stable d'une lecture à l'autre : la clé React de la ligne. */
  cle: string
  genre: GenreAction
  /** Le texte : une clé `today.h.matching.*` et ses valeurs. Un `montant` s'écrit en CHF par l'écran. */
  texte: { cle: string; valeurs: Record<string, string | number> }
  /** La seconde ligne : le bien nommé, s'il y en a un. */
  detail: string | null
  montant: number | null
  location: boolean
  /** Une place du fil (sa requête), ou la fiche d'un mandat sur « Qui pour ce bien ? ». */
  cible: { vers: 'fil'; requete: string } | { vers: 'mandat'; id: string }
}

const enNombre = (v: number | string | null): number | null => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Une ligne de la RPC, écrite ; `null` si elle ne peut mener nulle part. */
export function versAction(l: LigneAction): ActionMatching | null {
  const location = l.location === true
  const prenom = l.prenom?.trim() || ''
  switch (l.genre) {
    case 'retour': {
      if (!l.contact_id) return null
      return {
        cle: `retour:${l.contact_id}`, genre: 'retour', detail: null, montant: null, location,
        texte: { cle: 'today.h.matching.retour', valeurs: { prenom, count: l.nombre ?? 0 } },
        cible: { vers: 'fil', requete: lienFil({ attente: l.contact_id }) },
      }
    }
    case 'prix': {
      const montant = enNombre(l.montant)
      if (!l.contact_id || !l.match_id || montant == null || montant <= 0) return null
      // Seuls « proposé » (sent) et « à proposer » (suggested) ont un texte et une place dans le fil : un
      // statut « interested »/« rejected »/nul écrirait « refusé par … » à tort et mènerait à « À conclure ».
      if (l.statut !== 'sent' && l.statut !== 'suggested') return null
      // `reporte: false` — la RPC `matching_actions_du_jour` écarte déjà les revenus reportés
      // (`snoozed_until`), donc une action « prix » n'est jamais un match reporté.
      const requete = lienPlace({ id: l.match_id, statut: l.statut, contactId: l.contact_id, marche: l.market_listing_id != null, reporte: false })
      if (!requete) return null
      return {
        cle: `prix:${l.match_id}`, genre: 'prix', detail: l.titre?.trim() || null, montant, location,
        texte: { cle: l.statut === 'sent' ? 'today.h.matching.prixPropose' : 'today.h.matching.prixRefuse', valeurs: { prenom } },
        cible: { vers: 'fil', requete },
      }
    }
    case 'mandat': {
      if (!l.property_id) return null
      return {
        cle: `mandat:${l.property_id}`, genre: 'mandat', detail: l.titre?.trim() || null, montant: null, location,
        texte: { cle: 'today.h.matching.mandat', valeurs: { count: l.nombre ?? 0 } },
        cible: { vers: 'mandat', id: l.property_id },
      }
    }
    case 'marche': {
      if (!l.contact_id) return null
      const nouveaux = l.nouveaux ?? 0
      const baisses = l.baisses ?? 0
      // Sans nouveauté ni baisse, la ligne n'a pas de raison d'être : elle écrirait un nom sans texte.
      if (nouveaux + baisses === 0) return null
      const seul = nouveaux + baisses === 1
      const ville = l.ville?.trim() || ''
      const cle = !seul ? 'today.h.matching.marchePlusieurs'
        : baisses === 1 ? (ville ? 'today.h.matching.marcheBaisse' : 'today.h.matching.marcheBaisseSansVille')
          : (ville ? 'today.h.matching.marcheNouveau' : 'today.h.matching.marcheNouveauSansVille')
      return {
        cle: `marche:${l.contact_id}`, genre: 'marche', detail: seul ? l.titre?.trim() || null : null, montant: null, location,
        texte: { cle, valeurs: { prenom, ville, nouveaux, baisses } },
        cible: { vers: 'fil', requete: lienFil({ ligne: cleSelection(l.contact_id), contact: l.contact_id }) },
      }
    }
    default:
      return null
  }
}
