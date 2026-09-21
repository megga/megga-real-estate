// Matching — la RÉÉVALUATION des matchs à proposer d'une recherche ajustée (lot B de la boucle chez
// l'agent, « Apprendre »). Fonctions PURES, comme matching-normalize.ts : zéro I/O, zéro API Deno —
// réutilisées par l'edge matching-engine (mode `rescore-search`) ET par les tests vitest (Node).
//
// Conception : docs/superpowers/specs/2026-09-21-matching-boucle-agent-design.md, §4.6 et §12.
//
// POURQUOI. Le moteur ne re-note jamais une paire existante : `insert_*_matches` est en
// `ON CONFLICT DO NOTHING`. Une recherche corrigée garderait ses anciens scores et ses anciennes raisons.
// Ce module rejoue le VRAI barème (`calculateScoreV2`) sur les matchs encore à proposer ; l'edge en fait
// les lectures et les écritures (RPC `matching_appliquer_notes`, puis `matching_ajuster_recherche`).
//
// Mêmes règles qu'à la création : pour une annonce du MARCHÉ, le pré-filtre DUR de
// `match_candidate_listings` (statut vivant, transaction, qualité, prix > 0, budget à 15 % près, cantons) ;
// pour un MANDAT, la transaction seule (`buildInternalRows`). Un bien que le moteur ne créerait pas
// aujourd'hui n'est pas gardé : noté par le seul barème, un bien à 20 % au-dessus du budget restait à
// proposer dès que ses autres axes tenaient. Référence loyer SEULEMENT pour une annonce du marché d'une
// recherche de location.
//
// ⛔ UN MATCH AJOUTÉ À LA MAIN N'EST PAS RENOTÉ. La Recherche (« Ajouter à la sélection de … ») crée des
// matchs SANS `score_version`, avec ses propres raisons : l'agent les a choisis. Les écarter parce que le
// barème ne les retiendrait pas déferait une décision humaine.
//
// ⛔ LA CORRECTION EST UNE CLÉ, PAS UN INSTANTANÉ. L'écran envoie la seule clé corrigée ; elle est fusionnée
// dans les critères d'AUJOURD'HUI (`fusionnerCorrection`, et `matching_ajuster_recherche` à l'identique
// côté base). Envoyés en entier, les critères que l'écran avait lus écrasaient ce qu'un collègue avait
// changé entre-temps sur une autre clé.

import {
  calculateScoreV2, inferTransactionType, normalizeZones, type MatchReasons, type ScoringConfig,
} from './matching-normalize.ts'
import type { RentPosition } from './rent-reference.ts'

/** Un match `suggested` de la recherche, tel que l'edge le lit. */
export interface MatchARenoter {
  id: string
  property_id: string | null
  market_listing_id: string | null
  /** `null` : ajouté à la main (Recherche), jamais renoté. */
  score_version: number | null
}

/** Ce que la RPC `matching_appliquer_notes` écrit pour un match. */
export interface NoteMatch {
  id: string
  score: number
  reasons: MatchReasons
  score_version: number
  /** Sous le seuil, ou hors du pré-filtre du moteur : le match sort des propositions. */
  ecarte: boolean
}

const nombre = (v: unknown): number | null => {
  if (v == null || v === '') return null
  const n = typeof v === 'string' ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}

/** Les valeurs par défaut de `match_candidate_listings` que le moteur ne surcharge pas (`p_margin`, `p_min_quality`). */
const MARGE_BUDGET_POURCENT = 15
const QUALITE_MIN = 50
const STATUTS_VIVANTS = new Set(['active', 'price_reduced'])

/**
 * Le pré-filtre DUR de `match_candidate_listings` (20260709140000), à l'identique : ce que le moteur
 * retiendrait aujourd'hui de cette annonce pour ces critères. Une qualité inconnue échoue, comme en SQL
 * (`NULL >= 50` n'est pas vrai).
 *
 * ⚠ La marge en POURCENTS ENTIERS, pas `max * 1.15` : SQL calcule en `numeric`, exact, et 1'550'000 × 1,15 y
 * vaut 1'782'500 ; en flottant, 1'782'499,999… — un bien pile à la borne sortait ici et restait là-bas.
 */
function annonceRetenue(a: Record<string, unknown>, criteres: Record<string, unknown>, tx: 'buy' | 'rent'): boolean {
  const prix = nombre(a.current_price) ?? nombre(a.price)
  const min = nombre(criteres.budget_min)
  const max = nombre(criteres.budget_max)
  const { cantons } = normalizeZones(criteres.zones)
  return typeof a.status === 'string' && STATUTS_VIVANTS.has(a.status)
    && a.transaction_type === tx
    && (nombre(a.quality_score) ?? -1) >= QUALITE_MIN
    && prix != null && prix > 0
    && (max == null || prix * 100 <= max * (100 + MARGE_BUDGET_POURCENT))
    && (min == null || prix * 100 >= min * (100 - MARGE_BUDGET_POURCENT))
    && (cantons.length === 0 || cantons.includes(String(a.canton ?? '')))
}

/**
 * Les notes des matchs à proposer d'une recherche, avec ses critères CORRIGÉS. `biens` : les mandats et les
 * annonces par id, colonnes du barème et du pré-filtre ; `refLoyer` : la position loyer d'une annonce du
 * marché.
 */
export function renoter(
  matchs: readonly MatchARenoter[],
  biens: ReadonlyMap<string, Record<string, unknown>>,
  criteres: Record<string, unknown>,
  cfg: ScoringConfig,
  refLoyer: (annonce: Record<string, unknown>) => RentPosition | null,
): NoteMatch[] {
  const tx = inferTransactionType(criteres)
  const notes: NoteMatch[] = []
  for (const m of matchs) {
    if (m.score_version == null) continue
    const marche = m.market_listing_id != null
    const idBien = marche ? m.market_listing_id : m.property_id
    const bien = idBien ? biens.get(idBien) : undefined
    // Un bien que la lecture n'a pas rendu (supprimé, autre agence) : on ne note pas sur une absence.
    if (!bien) continue
    const note = calculateScoreV2(bien, criteres, cfg, marche && tx === 'rent' ? refLoyer(bien) : null)
    const retenu = marche
      ? annonceRetenue(bien, criteres, tx)
      : !(typeof bien.transaction_type === 'string' && bien.transaction_type !== tx)
    notes.push({
      id: m.id,
      // Hors du pré-filtre, le moteur ne l'aurait jamais noté : pas de note, comme à la création.
      score: retenu ? note.total : 0,
      reasons: note.reasons,
      score_version: cfg.version,
      ecarte: !retenu || note.total < cfg.threshold,
    })
  }
  return notes
}

/**
 * Les critères qu'« Apprendre » corrige — les seuls que la fiche contact sait écrire, sans quoi le pont
 * `sync_contact_client_search` effacerait la correction —, et la forme de leur valeur.
 */
const FORME_CLE = {
  budget_max: 'nombre', surface_min: 'nombre', rooms_min: 'nombre', zones: 'liste', type: 'texte', features: 'liste',
} as const
export type CleCorrigee = keyof typeof FORME_CLE
const CLES_CORRIGEES = new Set<string>(Object.keys(FORME_CLE))

/** Une correction de recherche : UNE clé et sa nouvelle valeur. */
export interface CorrectionRecherche {
  cle: CleCorrigee
  valeur: number | string | string[]
}

/**
 * La correction d'un corps de requête, ou `null` si elle est illisible : une clé que la fiche n'écrit pas,
 * une valeur d'une autre forme, un nombre nul ou négatif, une liste vide (retirer toutes les zones élargirait
 * la recherche au pays entier). Mêmes refus que `matching_ajuster_recherche`.
 */
export function lireCorrection(brut: unknown): CorrectionRecherche | null {
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return null
  const { cle, valeur } = brut as { cle?: unknown; valeur?: unknown }
  if (typeof cle !== 'string' || !CLES_CORRIGEES.has(cle)) return null
  const c = cle as CleCorrigee
  switch (FORME_CLE[c]) {
    case 'nombre':
      return typeof valeur === 'number' && Number.isFinite(valeur) && valeur > 0 ? { cle: c, valeur } : null
    case 'texte':
      return typeof valeur === 'string' && valeur.trim() !== '' ? { cle: c, valeur: valeur.trim() } : null
    case 'liste':
      return Array.isArray(valeur) && valeur.length > 0 && valeur.every((v) => typeof v === 'string' && v.trim() !== '')
        ? { cle: c, valeur: [...valeur] as string[] }
        : null
  }
}

/** Les critères corrigés : ceux d'AUJOURD'HUI, la seule clé corrigée remplacée (`||` de `matching_ajuster_recherche`). */
export function fusionnerCorrection(criteres: Record<string, unknown> | null, c: CorrectionRecherche): Record<string, unknown> {
  return { ...(criteres ?? {}), [c.cle]: c.valeur }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** Un identifiant de ligne lisible. */
export const estUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v)

/**
 * La borne des refus d'une validation : `max_rows` de PostgREST, au-delà duquel le fil ne lit plus la boucle.
 * Une correction ne se fonde donc jamais sur davantage ; les 50 d'avant refusaient une vraie correction.
 */
export const REFUS_MAX = 1000

/** Les refus à prendre en compte, sans doublon (absents : aucun) ; `null` si la liste est illisible. */
export function lireRefus(brut: unknown): string[] | null {
  if (brut === undefined || brut === null) return []
  if (!Array.isArray(brut) || !brut.every(estUuid)) return null
  return [...new Set(brut)]
}

/** Découpe en lots : un `.in()` de centaines d'uuid dépasse la limite des en-têtes, et une RPC géante le délai. */
export function tranches<T>(xs: readonly T[], taille: number): T[][] {
  const lots: T[][] = []
  for (let i = 0; i < xs.length; i += taille) lots.push(xs.slice(i, i + taille))
  return lots
}
