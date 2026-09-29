// Matching — la RÉÉVALUATION des matchs à proposer (lot B de la boucle chez l'agent, « Apprendre » ; lot E1,
// la renotation). Fonctions PURES, comme matching-normalize.ts : zéro I/O, zéro API Deno — réutilisées par
// l'edge matching-engine (modes `rescore-search`, `match-contact`, `scan-all`) ET par les tests vitest (Node).
//
// Conceptions : docs/superpowers/specs/2026-09-21-matching-boucle-agent-design.md, §4.6 et §12 ;
// docs/superpowers/specs/2026-09-27-matching-lot-e1-bureau-design.md, §5.7.
//
// POURQUOI. La création ne re-note jamais une paire existante : `insert_*_matches` est en
// `ON CONFLICT DO NOTHING`. Une recherche corrigée ou modifiée garderait ses anciens scores et ses anciennes
// raisons, et un barème changé laisserait les siens aux matchs déjà notés. Ce module rejoue le VRAI barème
// (`calculateScoreV2`) sur les matchs encore à proposer — d'une recherche corrigée (« Apprendre »), d'une
// recherche dont les critères ont changé (`match-contact`), et, chaque nuit, de ceux qu'une version antérieure
// du barème a notés (`aRattraper`, `scan-all`) ; l'edge en fait les lectures et les écritures (RPC
// `matching_appliquer_notes`, puis `matching_ajuster_recherche`).
//
// Mêmes règles qu'à la création : pour une annonce du MARCHÉ, le pré-filtre DUR de
// `match_candidate_listings` (statut vivant, transaction, qualité, prix > 0, budget à 15 % près, cantons) ;
// pour un MANDAT, la transaction seule (`buildInternalRows`). Un bien que le moteur ne créerait pas
// aujourd'hui n'est pas gardé : noté par le seul barème, un bien à 20 % au-dessus du budget restait à
// proposer dès que ses autres axes tenaient. Référence loyer SEULEMENT pour une annonce du marché d'une
// recherche de location.
//
// ⛔ UN MATCH AJOUTÉ À LA MAIN N'EST PAS RENOTÉ. La Recherche (« Ajouter à la sélection de … ») crée des
// matchs SANS `score_version`, avec ses propres raisons (`{ keys }`, ou rien) : l'agent les a choisis. Les
// écarter parce que le barème ne les retiendrait pas déferait une décision humaine. Un match que le moteur a
// noté AVANT les versions (juin 2026) n'en a pas non plus, mais il porte ses axes dans `reasons` : lui se
// renote (`ajouteALaMain`).
//
// ⛔ SEUL UN MATCH À PROPOSER (`suggested`) SE RENOTE : un bien proposé, répondu ou en visite garde la note
// qu'il avait quand on l'a proposé, et un match écarté la sienne.
//
// ⚠ UN BIEN REVENU EST À PROPOSER, DONC IL SE RENOTE. Refusé pour le prix puis revenu par une baisse
// (`match_retour_prix_*`), il est `suggested` et garde son `sent_at` et son motif `prix` : il se renote comme les
// autres, et, écarté, son motif `prix` — le refus de l'acheteur — cède la place à `recherche_ajustee`
// (`matching_appliquer_notes`).
//
// ⛔ UNE NOTE QUI NE CHANGE RIEN NE S'ÉCRIT PAS (`notesAEcrire`). `match-contact` renote TOUTES les recherches
// actives du contact quand une seule a changé, et celui qu'une correction d'« Apprendre » déclenche renote les
// mêmes matchs aux mêmes notes : réécrites à l'identique, elles coûteraient chacune un UPDATE, et un événement
// Realtime à la fiche ouverte. Seule part sans rien changer d'autre la note qui TAMPONNE la version du barème :
// sans elle, la nuit suivante la reprendrait, sans fin.
//
// ⚠ UNE RENOTATION QUI NE CHANGE RIEN NE SE JOURNALISE PAS (`aJournaliser`) : sans score ni statut changé, une
// ligne ne dirait rien — une version tamponnée seule non plus.
//
// ⛔ LA CORRECTION EST UNE CLÉ, PAS UN INSTANTANÉ. L'écran envoie la seule clé corrigée ; elle est fusionnée
// dans les critères d'AUJOURD'HUI (`fusionnerCorrection`, et `matching_ajuster_recherche` à l'identique
// côté base). Envoyés en entier, les critères que l'écran avait lus écrasaient ce qu'un collègue avait
// changé entre-temps sur une autre clé.

import {
  calculateScoreV2, inferTransactionType, normalizeZones, type MatchReasons, type ScoringConfig,
} from './matching-normalize.ts'
import type { RentPosition } from './rent-reference.ts'

/** Un match à renoter, tel que l'edge le lit. */
export interface MatchARenoter {
  id: string
  property_id: string | null
  market_listing_id: string | null
  /** Seul un match à proposer (`suggested`) se renote. */
  status: string
  /**
   * La note qu'il porte — avec sa version et ses raisons, ce qu'une renotation compare pour savoir si elle change
   * quelque chose (`notesAEcrire`, `aJournaliser`).
   */
  score: number
  /** La version du barème qui l'a noté ; `null` : noté avant les versions, ou ajouté à la main (Recherche). */
  score_version: number | null
  /** Ses raisons : les axes du moteur, ou celles d'un ajout à la main (`{ keys }`, ou rien). */
  reasons: unknown
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
export function annonceRetenue(a: Record<string, unknown>, criteres: Record<string, unknown>, tx: 'buy' | 'rent'): boolean {
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

/** Les axes que le moteur écrit dans `reasons`, depuis sa première version. */
const AXES_MOTEUR = ['budget', 'zone', 'type', 'rooms', 'features']

/**
 * Un match AJOUTÉ À LA MAIN (Recherche) : sans version, et sans aucun axe du moteur dans ses raisons — la Recherche
 * écrit `{ keys: [...] }`, ou rien. Sans version mais avec ses axes, c'est le moteur d'avant les versions qui l'a noté.
 */
function ajouteALaMain(m: MatchARenoter): boolean {
  if (m.score_version != null) return false
  const r = m.reasons
  return !(r != null && typeof r === 'object' && !Array.isArray(r) && AXES_MOTEUR.some((axe) => axe in r))
}

/** Un match qui se renote : à proposer, et noté par le moteur. */
const renotable = (m: MatchARenoter): boolean => m.status === 'suggested' && !ajouteALaMain(m)

/**
 * Les notes des matchs à proposer d'une recherche, avec ses critères du moment (CORRIGÉS, pour « Apprendre »).
 * `biens` : les mandats et les annonces par id, colonnes du barème et du pré-filtre ; `refLoyer` : la position
 * loyer d'une annonce du marché. Ni un ajout à la main, ni un bien déjà proposé n'y ont de note.
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
    if (!renotable(m)) continue
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
 * Deux valeurs JSON égales comme la base les compare : l'ordre des clés d'un objet ne compte pas — une colonne jsonb
 * les rend réordonnées —, celui d'une liste si, et une clé `undefined` n'existe pas (`JSON.stringify` la tait).
 */
function memeJson(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => memeJson(x, b[i]))
  }
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false
  const cles = (o: object) => Object.entries(o).filter(([, v]) => v !== undefined).map(([k]) => k).sort()
  const ka = cles(a)
  const kb = cles(b)
  return ka.length === kb.length
    && ka.every((k, i) => k === kb[i] && memeJson((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
}

/**
 * Les notes qui changent quelque chose au match lu, seules à partir vers l'écrivain : celle qui l'écarte (son statut
 * change, il sort d'« À proposer »), ou qui lui donne un autre score, une autre version du barème ou d'autres raisons
 * — comparées comme la base les rend (`memeJson`). Une note identique ne part pas : réécrite, elle ne coûterait
 * qu'un UPDATE et un événement Realtime. Celle qui ne fait que TAMPONNER la version (même score, mêmes raisons,
 * version antérieure ou nulle) part : sans elle, la nuit suivante la reprendrait, sans fin. Une note dont le match
 * n'est pas dans `lus` part aussi : rien ne dit qu'elle ne change rien. `lus` : les matchs tels que lus avant de les
 * renoter ; l'ordre des notes est gardé.
 */
export function notesAEcrire(lus: readonly MatchARenoter[], notes: readonly NoteMatch[]): NoteMatch[] {
  const parId = new Map(lus.map((m) => [m.id, m]))
  return notes.filter((n) => {
    const lu = parId.get(n.id)
    return lu === undefined || n.ecarte || lu.score !== n.score || lu.score_version !== n.score_version
      || !memeJson(lu.reasons, n.reasons)
  })
}

/**
 * Une renotation qui change quelque chose : une note écarte son match (il sort d'« À proposer »), ou lui donne un
 * autre score que celui lu avant d'écrire. Sinon, rien à journaliser — une version du barème tamponnée seule ne dit
 * rien à l'agent. `lus` : les matchs tels que lus ; `notes` : celles que la base a écrites.
 */
export function aJournaliser(lus: readonly MatchARenoter[], notes: readonly NoteMatch[]): boolean {
  const scores = new Map(lus.map((m) => [m.id, m.score]))
  return notes.some((n) => n.ecarte || scores.get(n.id) !== n.score)
}

/** Au plus tant de couples renotés par agence à chaque scan (`scan-all`, la nuit) : de quoi tenir le temps d'une fonction. */
export const PLAFOND_RATTRAPAGE = 2000

/** Un match tel que le scan de nuit le lit : sa recherche en plus. */
export interface MatchARattraper extends MatchARenoter {
  client_search_id: string | null
}

/**
 * Les couples que le scan de nuit renote, par recherche : à proposer, notés par une version ANTÉRIEURE du barème
 * (`version` est la courante) ou sans version — hors ajouts à la main —, d'une recherche ACTIVE. Dans l'ordre de
 * lecture, `plafond` au plus : les suivants attendent la nuit d'après, qui ne relit plus ceux-ci (renotés, ils
 * portent la version courante). Ni une recherche close ou supprimée, ni un match sans recherche : ses critères et
 * son écrivain (`matching_appliquer_notes`) passent par elle.
 */
export function aRattraper(
  matchs: readonly MatchARattraper[],
  version: number,
  actives: ReadonlySet<string>,
  plafond: number = PLAFOND_RATTRAPAGE,
): Map<string, MatchARattraper[]> {
  const parRecherche = new Map<string, MatchARattraper[]>()
  let pris = 0
  for (const m of matchs) {
    if (pris >= plafond) break
    const recherche = m.client_search_id
    if (recherche == null || !actives.has(recherche)) continue
    if ((m.score_version != null && m.score_version >= version) || !renotable(m)) continue
    const groupe = parRecherche.get(recherche)
    if (groupe) groupe.push(m)
    else parRecherche.set(recherche, [m])
    pris++
  }
  return parRecherche
}

/**
 * Le barème que la base a rendu (`app_config.matching_scoring_v2`) porte-t-il sa version ? Lecture en échec, clé
 * absente, texte illisible : le moteur tourne sur ses défauts (`parseScoringConfig`), barème et version. Un texte
 * lisible sans version est lu pour ce qu'il porte — poids, seuil — : seule sa version vient des défauts. Dans les
 * deux cas, de quoi créer, pas de quoi renoter : la version par défaut ferait « antérieurs » des couples notés par la
 * vraie, et un barème par défaut écarterait, pour de bon, ce que le vrai garde.
 */
export function baremeLisible(texte: unknown): boolean {
  if (typeof texte !== 'string' || texte === '') return false
  try {
    const brut: unknown = JSON.parse(texte)
    return brut !== null && typeof brut === 'object' && !Array.isArray(brut)
      && nombre((brut as { version?: unknown }).version) != null
  } catch {
    return false
  }
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
