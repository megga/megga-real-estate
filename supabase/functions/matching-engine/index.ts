import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'
import { isServiceSecret } from '../_shared/require-service-secret.ts'
import { redactedErrorMessage, reportEdgeError } from '../_shared/audit-edge-error.ts'
import {
  calculateScoreV2,
  inferTransactionType,
  normalizeZones,
  parseScoringConfig,
  DEFAULT_SCORING_CONFIG,
  type ScoringConfig,
  type ScoreResult,
} from '../_shared/matching-normalize.ts'
import {
  aJournaliser, aRattraper, baremeLisible, estUuid, fusionnerCorrection, lireCorrection, lireRefus, notesAEcrire,
  PLAFOND_RATTRAPAGE, renoter, REFUS_MAX, tranches, type MatchARattraper, type MatchARenoter,
} from '../_shared/matching-renotation.ts'
import {
  candidatsProspects, debutFenetreDeal, noterProspects, type OrigineProspect, type RechercheClose,
} from '../_shared/matching-prospects.ts'
import {
  buildRentStatsIndex,
  rentPosition,
  type RentStatsIndex,
  type RentStatsRow,
  type RentSubject,
} from '../_shared/rent-reference.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
}

interface RequestBody {
  mode: 'match-property' | 'match-contact' | 'scan-all' | 'rescore-search' | 'prospects' | 'reactiver-prospect'
  property_id?: string
  /** prospects, reactiver-prospect : une annonce du marché au lieu d'un mandat (lot C ; lot D pour l'écran). */
  market_listing_id?: string
  /** reactiver-prospect : pourquoi il était un ancien prospect (journal). */
  origine?: string
  contact_id?: string
  include_market?: boolean // Aussi matcher contre market_listings (veille marché)
  /** rescore-search : la recherche dont les matchs à proposer sont renotés ; reactiver-prospect : celle qu'on rouvre. */
  client_search_id?: string
  /**
   * rescore-search : la SEULE clé corrigée et sa valeur (`{ cle, valeur }`), fusionnée dans les critères
   * d'aujourd'hui APRÈS la renotation. Absente : ses critères actuels, rien de posé.
   */
  correction?: unknown
  /** rescore-search : le motif de refus qui a produit la correction (journal). */
  motif?: string
  /** rescore-search : les refus pris en compte (`apprentissage_at`), `REFUS_MAX` au plus. */
  refus_ids?: unknown
}

// Ligne de match prête à insérer (commune interne/marché).
interface MatchRow {
  agency_id: string
  contact_id: string
  property_id?: string
  market_listing_id?: string
  client_search_id: string | null
  score: number
  reasons: ScoreResult['reasons']
  score_version: number
}

const numOrNull = (v: unknown): number | null => {
  if (v == null || v === '') return null
  const n = typeof v === 'string' ? Number(v) : (v as number)
  return Number.isFinite(n) ? n : null
}

// colonnes lues par le scoring (jamais description/photos — règles perf §7)
// Lot C : chambres, état (saisi, ou déduit de l'année de construction) et l'interrupteur off-market.
const PROP_COLS = 'id, transaction_type, price, type, canton, city, rooms, surface_m2, features, bedrooms, condition, year_built, off_market'
/**
 * Ce que le barème lit d'une annonce du marché — ce que rend `match_candidate_listings` —, et ce que son
 * pré-filtre dur trie (`quality_score`) : la renotation le rejoue (`renoter`).
 */
const COLS_ANNONCE_NOTE = 'id, price, current_price, type, canton, city, rooms, surface_m2, features, status, price_at_first_seen, transaction_type, quality_score, bedrooms, year_built, year_renovated'
/**
 * Ce que la renotation lit d'un match : son bien, de quoi savoir s'il se renote (`renoter`), et sa note — score,
 * version, raisons —, pour savoir si la nouvelle change quelque chose (`notesAEcrire`, `aJournaliser`).
 */
const COLS_MATCH_NOTE = 'id, property_id, market_listing_id, status, score, score_version, reasons'
/** Les motifs qu'« Apprendre » chiffre (le CHECK `matches_reaction_motif_check` en porte d'autres). */
const MOTIFS_CORRECTION = new Set(['prix', 'quartier', 'surface', 'pieces', 'type', 'equipements'])
/** `max_rows` de PostgREST : au-delà, une lecture tronque EN SILENCE. */
const PAGE_MATCHS = 1000
const LOT_IDS = 100
const LOT_NOTES = 500

/**
 * Une lecture ENTIÈRE, page par page (`max_rows` de PostgREST tronque EN SILENCE au-delà de {@link PAGE_MATCHS}).
 * `page(depuis, jusqua)` pose ses filtres, un ordre stable (`.order('id')`, sans quoi deux pages se recouvrent) et
 * `.range(depuis, jusqua)`.
 */
async function toutesLesPages<T>(
  page: (depuis: number, jusqua: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
): Promise<T[]> {
  const lignes: T[] = []
  for (let depuis = 0; ; depuis += PAGE_MATCHS) {
    const { data, error } = await page(depuis, depuis + PAGE_MATCHS - 1)
    if (error) throw error
    const lot = (data ?? []) as T[]
    lignes.push(...lot)
    if (lot.length < PAGE_MATCHS) return lignes
  }
}

/** La position loyer d'une annonce du marché (bonus du barème) : la même pour la renotation et les prospects. */
const refLoyer = (rentIndex: RentStatsIndex) => (a: Record<string, unknown>) => rentPosition({
  canton: (a.canton as string | null) ?? null,
  type: (a.type as string | null) ?? null,
  surface_m2: numOrNull(a.surface_m2),
  loyer: numOrNull(a.current_price) ?? numOrNull(a.price),
}, rentIndex)

/** Ce que les notes d'une recherche ont produit : les matchs réécrits, et ceux qu'elles ont sortis d'« À proposer ». */
interface NotesEcrites {
  reevalues: number
  ecartes: string[]
  /** Un match réécrit a changé de note ou de statut (`aJournaliser`) : c'est ce qu'une ligne au journal dirait. */
  aJournaliser: boolean
}

const aucuneNote = (): NotesEcrites => ({ reevalues: 0, ecartes: [], aJournaliser: false })

/** Les matchs à proposer d'une recherche, page par page (`idx_matches_agency_focus`). */
function matchsDeLaRecherche(
  supabase: SupabaseClient, agencyId: string, recherche: { id: string; contact_id: string },
): Promise<MatchARenoter[]> {
  return toutesLesPages<MatchARenoter>((depuis, jusqua) => supabase
    .from('matches')
    .select(COLS_MATCH_NOTE)
    .eq('agency_id', agencyId)
    .eq('contact_id', recherche.contact_id)
    .eq('client_search_id', recherche.id)
    .eq('status', 'suggested')
    .order('id')
    .range(depuis, jusqua))
}

/**
 * Renote des matchs d'UNE recherche avec `criteres` — le vrai barème et son pré-filtre (`renoter`) — puis écrit celles
 * de leurs notes qui changent quelque chose (`notesAEcrire` ; `matching_appliquer_notes`, qui ne réécrit qu'un match
 * encore à proposer de cette recherche et de l'agence) : sous le seuil, ou hors du pré-filtre, un match sort
 * d'« À proposer ». Leurs biens sont lus d'abord, colonnes du barème seulement. `ecrites`, le bilan de CETTE recherche,
 * vide à l'appel, se remplit lot par lot : une écriture qui échoue en route laisse lisible ce que la base a déjà écrit.
 */
async function ecrireNotes(
  supabase: SupabaseClient,
  agencyId: string,
  rechercheId: string,
  matchs: readonly MatchARenoter[],
  criteres: Record<string, unknown>,
  cfg: ScoringConfig,
  rentIndex: RentStatsIndex,
  ecrites: NotesEcrites = aucuneNote(),
): Promise<NotesEcrites> {
  const biens = new Map<string, Record<string, unknown>>()
  const mandats = [...new Set(matchs.map((m) => m.property_id).filter((id): id is string => id != null))]
  for (const lot of tranches(mandats, LOT_IDS)) {
    const { data, error } = await supabase.from('properties').select(PROP_COLS).eq('agency_id', agencyId).in('id', lot)
    if (error) throw error
    for (const p of (data ?? []) as Record<string, unknown>[]) biens.set(p.id as string, p)
  }
  const annonces = [...new Set(matchs.map((m) => m.market_listing_id).filter((id): id is string => id != null))]
  for (const lot of tranches(annonces, LOT_IDS)) {
    const { data, error } = await supabase.from('market_listings').select(COLS_ANNONCE_NOTE).in('id', lot)
    if (error) throw error
    for (const a of (data ?? []) as Record<string, unknown>[]) biens.set(a.id as string, a)
  }

  // Rien à écrire, aucun appel — et donc aucune ligne au journal, qui se juge sur ce que la base a écrit.
  const notes = notesAEcrire(matchs, renoter(matchs, biens, criteres, cfg, refLoyer(rentIndex)))
  const reecrits = new Set<string>()
  for (const lot of tranches(notes, LOT_NOTES)) {
    const { data, error } = await supabase.rpc('matching_appliquer_notes', {
      p_agency_id: agencyId, p_client_search_id: rechercheId, p_notes: lot,
    })
    if (error) throw error
    for (const l of (data ?? []) as { id: string; status: string }[]) {
      reecrits.add(l.id)
      if (l.status === 'ignored') ecrites.ecartes.push(l.id)
    }
    ecrites.reevalues = reecrits.size
  }
  // Ce qui a changé se juge sur ce que la base a écrit : un match sorti d'« À proposer » entre la lecture et
  // l'écriture n'a pas reçu sa note.
  ecrites.aJournaliser = aJournaliser(matchs, notes.filter((n) => reecrits.has(n.id)))
  return ecrites
}

/** Le bilan d'une renotation, que `matching_ajuster_recherche` recopie au journal. */
const bilanDes = (n: NotesEcrites, cfg: ScoringConfig, mode: RequestBody['mode']) => ({
  mode, reevalues: n.reevalues, ecartes: n.ecartes.length, match_ids_ecartes: n.ecartes.slice(0, 50), score_version: cfg.version,
})

/**
 * `rescore-search` — la réévaluation des matchs à proposer d'une recherche ajustée (lot B, « Apprendre »).
 *
 * ⚠ L'ORDRE EST LE CONTRAT. (1) renoter EN MÉMOIRE avec les critères d'aujourd'hui où la seule clé corrigée
 * est remplacée ; (2) écrire les notes (`matching_appliquer_notes`) ; (3) d'UN BLOC, `matching_ajuster_recherche` :
 * la clé fusionnée dans la recherche (et dans la fiche si elle portait les mêmes critères — sans quoi le pont
 * `sync_contact_client_search` remettrait l'ancienne au prochain enregistrement de la fiche), les refus pris
 * en compte, UNE ligne au journal. Une panne avant (3) laisse la correction proposée à l'écran, et la même
 * validation renote puis écrit tout ; (3) n'a pas de milieu. Écrire les critères d'abord effaçait la
 * correction (plus d'écart à proposer) sans avoir rien renoté. Sur des données de repli, rien de tout cela ne
 * commence : le gestionnaire rend 503 sans l'appeler.
 *
 * ⚠ La mise à jour des critères déclenche `trigger_matching_on_search_updated`, qui relance le moteur en
 * `match-contact` (pg_net, asynchrone) : les biens que la recherche corrigée retient DE PLUS y naissent, et ses
 * matchs à proposer y sont renotés une seconde fois, aux mêmes notes — rien ne s'y réécrit (`notesAEcrire`), et
 * aucune ligne ne suit celle-ci au journal pour ELLE. Mais `match-contact` renote aussi les AUTRES recherches actives
 * du contact, avec leurs propres critères : une note qui y a changé s'écrit, et sa recherche a sa ligne
 * `matchs_reevalues`.
 */
async function renoterRecherche(
  supabase: SupabaseClient,
  agencyId: string,
  acteurId: string | null,
  body: RequestBody,
  cfg: ScoringConfig,
  rentIndex: RentStatsIndex,
): Promise<{ statut: number; corps: Record<string, unknown> }> {
  const refus = lireRefus(body.refus_ids)
  const correction = body.correction === undefined ? null : lireCorrection(body.correction)
  if (!estUuid(body.client_search_id) || refus === null || (body.correction !== undefined && correction === null)
    || (body.motif !== undefined && !MOTIFS_CORRECTION.has(body.motif))) {
    return { statut: 400, corps: { error: 'invalid_body' } }
  }
  // Une borne, pas un plafond de travail : le fil ne lit pas davantage de refus (`REFUS_MAX`).
  if (refus.length > REFUS_MAX) return { statut: 413, corps: { error: 'too_many_refus', max: REFUS_MAX } }

  const { data: recherche, error: rErr } = await supabase
    .from('client_searches')
    .select('id, contact_id, criteria')
    .eq('id', body.client_search_id)
    .eq('agency_id', agencyId)
    .maybeSingle()
  if (rErr) throw rErr
  if (!recherche) return { statut: 404, corps: { error: 'search_not_found' } }
  const avant = (recherche.criteria ?? null) as Record<string, unknown> | null
  const criteres = correction ? fusionnerCorrection(avant, correction) : avant
  if (!criteres) return { statut: 400, corps: { error: 'invalid_body' } }

  // 1-2. Les matchs à proposer de la recherche, notés par le VRAI barème sur les critères corrigés — AVANT de les
  //      poser —, et leurs notes écrites.
  const ecrites = await ecrireNotes(
    supabase, agencyId, recherche.id, await matchsDeLaRecherche(supabase, agencyId, recherche), criteres, cfg, rentIndex,
  )

  // 3. D'UN BLOC : la clé corrigée (recherche, fiche identique), les refus pris en compte — deux NOUVEAUX
  //    refus pour ce motif en proposeront une autre —, et UNE ligne au journal (CLAUDE.md §5), qui dit ce
  //    que la renotation a produit.
  const { data: ajuste, error: aErr } = await supabase.rpc('matching_ajuster_recherche', {
    p_agency_id: agencyId,
    p_client_search_id: recherche.id,
    p_acteur_id: acteurId,
    p_cle: correction?.cle ?? null,
    p_valeur: correction?.valeur ?? null,
    p_motif: body.motif ?? null,
    p_refus_ids: refus,
    p_bilan: bilanDes(ecrites, cfg, 'rescore-search'),
  })
  if (aErr) throw aErr
  // Supprimée entre la lecture et l'écriture : rien n'a été posé.
  if (ajuste == null) return { statut: 404, corps: { error: 'search_not_found' } }

  return {
    statut: 200,
    corps: { reevalues: ecrites.reevalues, ecartes: ecrites.ecartes.length, mode: 'rescore-search', scoreVersion: cfg.version },
  }
}

/** Une recherche active, telle que `match-contact` et `scan-all` la lisent. */
interface RechercheActive {
  id: string
  contact_id: string
  criteria: Record<string, unknown> | null
}

/**
 * Une recherche renotée par le moteur lui-même, avec ses critères du moment — `match-contact` quand ils ont changé,
 * `scan-all` pour une version antérieure du barème : les notes de `matchs` qui changent quelque chose, puis UNE ligne
 * `matchs_reevalues` au journal, avec son bilan (`matching_ajuster_recherche` sans clé ni refus : rien d'autre n'est
 * posé). La ligne ne s'écrit que si un match a changé de note ou de statut (`aJournaliser`) ; une note qui ne fait
 * que tamponner la version du barème s'écrit sans ligne — la nuit suivante ne la reprend pas. Une recherche sans
 * critères n'est pas notée, comme à la création. `ecrites` : son bilan, vide à l'appel (`ecrireNotes`).
 */
async function reevaluerRecherche(
  supabase: SupabaseClient,
  agencyId: string,
  acteurId: string | null,
  recherche: RechercheActive,
  matchs: readonly MatchARenoter[],
  cfg: ScoringConfig,
  rentIndex: RentStatsIndex,
  mode: RequestBody['mode'],
  ecrites: NotesEcrites,
): Promise<void> {
  if (!recherche.criteria) return
  await ecrireNotes(supabase, agencyId, recherche.id, matchs, recherche.criteria, cfg, rentIndex, ecrites)
  if (!ecrites.aJournaliser) return
  const { error } = await supabase.rpc('matching_ajuster_recherche', {
    p_agency_id: agencyId,
    p_client_search_id: recherche.id,
    p_acteur_id: acteurId,
    p_cle: null,
    p_valeur: null,
    p_motif: null,
    p_refus_ids: [],
    p_bilan: bilanDes(ecrites, cfg, mode),
  })
  if (error) throw error
}

/** Ce que la renotation d'un appel a produit : les matchs réécrits, les écartés, et les recherches en échec. */
interface Renotation {
  reevalues: number
  ecartes: number
  echecs: number
  /** Le message caviardé du premier échec (`redactedErrorMessage`) : la cause que le signalement nomme. */
  premierEchec: string | null
}

/**
 * Renote les recherches une à une (`reevaluerRecherche`), leurs matchs rendus par `matchsDe` (`undefined` : rien à
 * renoter), sans qu'un échec — lecture, écriture ou journal — n'arrête les suivantes, ni la création qui suit dans
 * `match-contact`. Chaque échec se compte, et s'écrit en console avec l'id de sa recherche et ce que la base en
 * avait déjà écrit : des notes écrites dont la ligne au journal a échoué ne se rattrapent pas — identiques à la
 * lecture suivante, elles ne repartent plus (`notesAEcrire`), et leur ligne non plus. Rien n'est signalé ici : le
 * gestionnaire le fait une fois pour tout l'appel (`signalerRenotation`), avec le compte et la cause du premier.
 */
async function reevaluerRecherches(
  supabase: SupabaseClient,
  agencyId: string,
  acteurId: string | null,
  recherches: readonly RechercheActive[],
  matchsDe: (recherche: RechercheActive) => Promise<readonly MatchARenoter[] | undefined>,
  cfg: ScoringConfig,
  rentIndex: RentStatsIndex,
  mode: RequestBody['mode'],
): Promise<Renotation> {
  const bilan: Renotation = { reevalues: 0, ecartes: 0, echecs: 0, premierEchec: null }
  for (const recherche of recherches) {
    const ecrites = aucuneNote()
    try {
      const matchs = await matchsDe(recherche)
      if (matchs) await reevaluerRecherche(supabase, agencyId, acteurId, recherche, matchs, cfg, rentIndex, mode, ecrites)
    } catch (error) {
      const message = redactedErrorMessage(error)
      bilan.echecs++
      bilan.premierEchec ??= message
      console.error('[matching-engine] renotation en échec :', {
        mode, agency_id: agencyId, client_search_id: recherche.id,
        reevalues: ecrites.reevalues, ecartes: ecrites.ecartes.length,
      }, message)
    }
    bilan.reevalues += ecrites.reevalues
    bilan.ecartes += ecrites.ecartes.length
  }
  return bilan
}

/**
 * Les couples que le scan de nuit renote (`aRattraper`) : les matchs à proposer de l'agence qu'une version antérieure
 * du barème a notés, ou sans version, et qui ont une recherche — sans elle, un couple ne se renote jamais —, lus page
 * par page dans l'ordre de `idx_matches_agency_focus` (`agency_id, contact_id, score desc`, à proposer). Chaque page
 * ne garde que ce qui se choisit, dans ce qui reste du plafond : la mémoire n'en porte pas davantage, et la lecture
 * s'arrête quand il est atteint — les suivants attendent la nuit d'après.
 */
async function couplesARattraper(
  supabase: SupabaseClient, agencyId: string, version: number, actives: ReadonlySet<string>,
): Promise<Map<string, MatchARattraper[]>> {
  const selection = new Map<string, MatchARattraper[]>()
  let pris = 0
  for (let depuis = 0; ; depuis += PAGE_MATCHS) {
    const { data, error } = await supabase
      .from('matches')
      .select(`${COLS_MATCH_NOTE}, client_search_id`)
      .eq('agency_id', agencyId)
      .eq('status', 'suggested')
      .not('client_search_id', 'is', null)
      .or(`score_version.is.null,score_version.lt.${version}`)
      .order('contact_id')
      .order('score', { ascending: false })
      .order('id')
      .range(depuis, depuis + PAGE_MATCHS - 1)
    if (error) throw error
    const page = (data ?? []) as MatchARattraper[]
    for (const [recherche, groupe] of aRattraper(page, version, actives, PLAFOND_RATTRAPAGE - pris)) {
      selection.set(recherche, [...(selection.get(recherche) ?? []), ...groupe])
      pris += groupe.length
    }
    if (page.length < PAGE_MATCHS || pris >= PLAFOND_RATTRAPAGE) return selection
  }
}

/** Le bien visé par `prospects` et `reactiver-prospect` : un mandat OU une annonce du marché, jamais les deux. */
type CibleBien = { genre: 'mandat' | 'annonce'; id: string }

function lireCible(body: RequestBody): CibleBien | null {
  const mandat = estUuid(body.property_id)
  const annonce = estUuid(body.market_listing_id)
  if (mandat === annonce) return null
  return mandat ? { genre: 'mandat', id: body.property_id as string } : { genre: 'annonce', id: body.market_listing_id as string }
}

/**
 * Le bien, colonnes du barème et du pré-filtre. Un mandat d'une autre agence est introuvable, et un mandat qui n'est
 * pas en service (brouillon, vendu, archivé) aussi : le moteur ne note que les mandats actifs, et réactiver sur lui
 * créerait un match que le moteur n'aurait jamais fait. Une annonce retirée passe ici, mais `annonceRetenue` l'écarte.
 */
async function lireBien(supabase: SupabaseClient, agencyId: string, cible: CibleBien): Promise<Record<string, unknown> | null> {
  const { data, error } = cible.genre === 'mandat'
    ? await supabase.from('properties').select(PROP_COLS).eq('id', cible.id).eq('agency_id', agencyId).eq('status', 'active').maybeSingle()
    : await supabase.from('market_listings').select(COLS_ANNONCE_NOTE).eq('id', cible.id).maybeSingle()
  if (error) throw error
  return (data ?? null) as Record<string, unknown> | null
}

const colonneDe = (cible: CibleBien): 'property_id' | 'market_listing_id' =>
  (cible.genre === 'mandat' ? 'property_id' : 'market_listing_id')

/**
 * `prospects` — les ANCIENS PROSPECTS d'un bien, notés À LA DEMANDE (lot C, « Qui pour ce bien ? »). Lecture
 * seule : rien n'est écrit, ni match, ni journal. Règles : `_shared/matching-prospects.ts`.
 */
async function prospectsDuBien(
  supabase: SupabaseClient, agencyId: string, body: RequestBody, cfg: ScoringConfig, rentIndex: RentStatsIndex,
): Promise<{ statut: number; corps: Record<string, unknown> }> {
  const cible = lireCible(body)
  if (!cible) return { statut: 400, corps: { error: 'invalid_body' } }
  const bien = await lireBien(supabase, agencyId, cible)
  if (!bien) return { statut: 404, corps: { error: 'bien_not_found' } }
  const maintenant = Date.now()
  const colonne = colonneDe(cible)

  // Les recherches closes de l'agence.
  const recherches = await toutesLesPages<RechercheClose>((depuis, jusqua) => supabase
    .from('client_searches')
    .select('id, contact_id, criteria, updated_at')
    .eq('agency_id', agencyId)
    .eq('is_active', false)
    .order('id')
    .range(depuis, jusqua))
  if (recherches.length === 0) return { statut: 200, corps: { prospects: [] } }

  const deals = await toutesLesPages<{ contact_buyer_id: string; updated_at: string }>((depuis, jusqua) => supabase
    .from('transactions')
    .select('contact_buyer_id, updated_at')
    .eq('agency_id', agencyId)
    .eq('stage', 'lost')
    .gte('updated_at', new Date(debutFenetreDeal(maintenant)).toISOString())
    .not('contact_buyer_id', 'is', null)
    .order('id')
    .range(depuis, jusqua))
  // Tout acheteur qui a déjà un match sur ce bien, quel qu'en soit l'état : l'agent en a déjà jugé.
  const dejaMatch = await toutesLesPages<{ contact_id: string }>((depuis, jusqua) => supabase
    .from('matches')
    .select('contact_id')
    .eq('agency_id', agencyId)
    .eq(colonne, cible.id)
    .order('id')
    .range(depuis, jusqua))
  // Et tout acheteur qui a un deal SUR CE BIEN, quel qu'en soit le stade : perdu, c'est ce bien-là qui n'a pas
  // convenu ; en cours, l'agent le suit déjà.
  const dejaDeal = await toutesLesPages<{ contact_buyer_id: string }>((depuis, jusqua) => supabase
    .from('transactions')
    .select('contact_buyer_id')
    .eq('agency_id', agencyId)
    .eq(colonne, cible.id)
    .not('contact_buyer_id', 'is', null)
    .order('id')
    .range(depuis, jusqua))

  const candidats = candidatsProspects(
    recherches,
    deals.map((d) => ({ contact_id: d.contact_buyer_id, le: d.updated_at })),
    new Set([...dejaMatch.map((m) => m.contact_id), ...dejaDeal.map((d) => d.contact_buyer_id)]),
    maintenant,
  )
  const notes = noterProspects(candidats, bien, cible.genre === 'annonce', cfg, refLoyer(rentIndex), maintenant)
  if (notes.length === 0) return { statut: 200, corps: { prospects: [] } }

  const { data: contacts, error: cErr } = await supabase
    .from('contacts')
    .select('id, first_name, last_name')
    .eq('agency_id', agencyId)
    .in('id', notes.map((n) => n.contact_id))
  if (cErr) throw cErr
  const parId = new Map(((contacts ?? []) as { id: string; first_name: string | null; last_name: string | null }[]).map((c) => [c.id, c]))
  const prospects = notes.flatMap((n) => {
    const c = parId.get(n.contact_id)
    // Un contact que la lecture ne rend pas (supprimé entre-temps) : on n'invente pas la ligne.
    return c ? [{
      contact_id: n.contact_id, prenom: c.first_name ?? '', nom: c.last_name ?? '', client_search_id: n.client_search_id,
      score: n.score, origine: n.origine, depuis: n.depuis,
    }] : []
  })
  return { statut: 200, corps: { prospects } }
}

/**
 * `reactiver-prospect` — un clic de l'agent (lot C). Les refus se décident d'abord, en lecture (403, 400, 404, 409,
 * dont la note sous le seuil) ; puis, d'UN BLOC, `matching_reactiver_prospect` : le match naît `suggested` avec la
 * note du moteur, la recherche ROUVRE, UNE ligne au journal (CLAUDE.md §5) — écrits un à un, une panne au milieu
 * laissait un match sans journal, ou né d'une recherche restée close. Rien n'est écrit à l'acheteur.
 * ⚠ Rouvrir une recherche ne relance pas le moteur (`on_search_criteria_updated` ne part que sur un changement de
 * critères) : ses autres biens viennent au scan de la nuit.
 */
async function reactiverProspect(
  supabase: SupabaseClient, agencyId: string, acteurId: string | null, body: RequestBody, cfg: ScoringConfig,
  rentIndex: RentStatsIndex,
): Promise<{ statut: number; corps: Record<string, unknown> }> {
  // Un geste d'agent, jamais d'un appel de service : le journal le nomme.
  if (!acteurId) return { statut: 403, corps: { error: 'agent_only' } }
  const cible = lireCible(body)
  if (!cible || !estUuid(body.client_search_id)) return { statut: 400, corps: { error: 'invalid_body' } }
  const origine: OrigineProspect | null = body.origine === 'deal_perdu' || body.origine === 'recherche_close' ? body.origine : null

  const { data: recherche, error: rErr } = await supabase
    .from('client_searches')
    .select('id, contact_id, criteria, updated_at')
    .eq('id', body.client_search_id)
    .eq('agency_id', agencyId)
    .maybeSingle()
  if (rErr) throw rErr
  if (!recherche) return { statut: 404, corps: { error: 'search_not_found' } }
  // Défense en profondeur : la RLS de `client_searches` ne lit que son `agency_id`, une recherche de l'agence peut
  // donc désigner le contact d'une autre. La RPC le refuse aussi ; ici, le refus a son code.
  const { data: contact, error: cErr } = await supabase
    .from('contacts')
    .select('id')
    .eq('id', recherche.contact_id)
    .eq('agency_id', agencyId)
    .maybeSingle()
  if (cErr) throw cErr
  if (!contact) return { statut: 404, corps: { error: 'search_not_found' } }
  const bien = await lireBien(supabase, agencyId, cible)
  if (!bien) return { statut: 404, corps: { error: 'bien_not_found' } }

  const colonne = colonneDe(cible)
  const { data: deja, error: dErr } = await supabase
    .from('matches')
    .select('id')
    .eq('agency_id', agencyId)
    .eq('contact_id', recherche.contact_id)
    .eq(colonne, cible.id)
    .limit(1)
  if (dErr) throw dErr
  if ((deja ?? []).length > 0) return { statut: 409, corps: { error: 'deja_sur_ce_bien' } }

  const [note] = noterProspects(
    [{ ...(recherche as RechercheClose), origine: origine ?? 'recherche_close', depuis: null }],
    bien, cible.genre === 'annonce', cfg, refLoyer(rentIndex), Date.now(),
  )
  if (!note) return { statut: 409, corps: { error: 'sous_le_seuil' } }

  const { data: matchId, error: iErr } = await supabase.rpc('matching_reactiver_prospect', {
    p_agency_id: agencyId,
    p_acteur_id: acteurId,
    p_client_search_id: recherche.id,
    p_property_id: cible.genre === 'mandat' ? cible.id : null,
    p_market_listing_id: cible.genre === 'annonce' ? cible.id : null,
    p_score: note.score,
    p_reasons: note.reasons,
    p_score_version: cfg.version,
    p_origine: origine,
  })
  if (iErr) throw iErr
  // NULL : un match est né entre la lecture et l'écriture (`ON CONFLICT DO NOTHING`), ou la recherche a quitté
  // l'agence entre-temps. La RPC n'a rien écrit, ni réouverture ni journal.
  if (matchId == null) return { statut: 409, corps: { error: 'deja_sur_ce_bien' } }

  return { statut: 200, corps: { match_id: matchId, score: note.score } }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const startedAt = Date.now()
    // ── Auth — secret de service pour les appels internes, sinon JWT agent ──
    // Appelants internes : `daily_matching_scan()` (tâche `daily-matching-scan`) et les
    // quatre triggers de client_searches (nouvelle recherche, critères modifiés) et de
    // properties (bien activé, prix modifié) — tous rejouent `app_config.service_role_key`
    // en Bearer. Le front (useMatching, atelier, écran mobile) envoie le JWT de l'agent, qui
    // n'est pas le secret et retombe sur requireAgentAuth.
    // S8 (audit du 13.09.2026) : un `===` contre la seule clé de l'env ne tenait que par la
    // coïncidence des deux clés ; `isServiceSecret` accepte app_config OU l'env, à temps
    // constant.
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const isServiceRole = await isServiceSecret(admin, req)

    const body = (await req.json()) as RequestBody & { agency_id?: string }
    const { mode, property_id, contact_id, include_market = true } = body

    let supabase: SupabaseClient
    let agency_id: string
    // L'agent derrière le JWT — `null` pour un appel de service : le journal d'une renotation le nomme.
    let acteurId: string | null = null

    if (isServiceRole) {
      supabase = admin
      if (!body.agency_id) {
        return new Response(
          JSON.stringify({ error: 'agency_id required for service-role calls' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
      agency_id = body.agency_id
    } else {
      const auth = await requireAgentAuth(req, corsHeaders)
      if (auth instanceof Response) return auth
      supabase = auth.supabase
      agency_id = auth.profile.agency_id // JWT-derived, on ignore body.agency_id
      acteurId = auth.profile.id
    }

    // ── Barème de scoring (externalisé, ajustable sans redéploiement) ──
    let cfg: ScoringConfig = DEFAULT_SCORING_CONFIG
    // Le barème de la base, sa version comprise (`baremeLisible`) : sur les défauts, la renotation est sautée.
    let baremeLu = false
    try {
      const { data: cfgVal, error: cfgErr } = await supabase.rpc('get_app_config', { config_key: 'matching_scoring_v2' })
      cfg = parseScoringConfig(typeof cfgVal === 'string' ? cfgVal : null)
      baremeLu = !cfgErr && baremeLisible(cfgVal)
    } catch (_) {
      cfg = DEFAULT_SCORING_CONFIG // jamais de crash sur une config absente/cassée
    }

    // ── Référence loyer marché (signal déterministe, lookup en mémoire) ──
    // Chargé UNE fois ; jamais de GROUP BY live. Absence/erreur ⇒ index vide ⇒
    // rentPosition()=null ⇒ bonus pricePosP=0 ⇒ barème 100 pts inchangé
    // (dégradation silencieuse). v1 plafonné L1 : canton_surf seul car la RPC
    // match_candidate_listings ne renvoie PAS postal_code (finesse city/NPA =
    // choix de scope v1, voir docs/estimation-loyer-vague2-concevoir.md §8.8).
    let rentIndex: RentStatsIndex = buildRentStatsIndex([])
    // La lecture a abouti, l'index fût-il vide : seule une lecture en échec fait un repli (`replis`).
    let loyersLus = false
    const { data: statsRows, error: statsErr } = await supabase
      .from('market_rent_stats')
      .select('*')
      .eq('level', 'canton_surf')
    if (statsErr) {
      console.error('[matching-engine] market_rent_stats load failed, axis inactive:', statsErr.message)
    } else {
      rentIndex = buildRentStatsIndex((statsRows ?? []) as RentStatsRow[])
      loyersLus = true
    }

    // ⛔ UNE RENOTATION NE TOURNE PAS SUR DES DONNÉES DE REPLI. Barème par défaut, ou index des loyers illisible (le
    // bonus de position perdu) : elle écarterait à tort des couples que le vrai barème garde — et pour de bon, un match
    // sorti d'« À proposer » ne se renote plus. La création, elle, ne change pas.
    // ⚠ Sautée, elle attend un passage où les deux lectures ont abouti — en `scan-all` SEULEMENT, dont les couples
    // gardent leur version antérieure : la nuit suivante les reprend, comme ceux d'une renotation en échec. En
    // `match-contact`, sautée ou en échec, PERSONNE ne la rejoue — la nuit ne rattrape que les versions antérieures, et
    // ces couples portent la courante — : leurs notes attendent le prochain changement de critères, ou de version du
    // barème. `rescore-search`, lui, refuse (503).
    const replis = [...(baremeLu ? [] : ['bareme']), ...(loyersLus ? [] : ['loyers'])]

    // ⛔ UNE RENOTATION QUI N'A PAS TOURNÉ SE SIGNALE. La nuit et le déclencheur passent par pg_net, dont personne ne
    // lit la réponse : sautée ou en échec, elle rend 200, et une panne systématique (délai dépassé, droit révoqué,
    // barème illisible) se répéterait chaque nuit sans alerter personne. Elle part au canal des pannes
    // (`reportEdgeError` : KPI d'erreurs du monitoring, santé par fonction, seuil d'alerte `edge_errors_24h`), UNE fois
    // par invocation — jamais par recherche. ⚠ Un événement de PLATEFORME (`agencyId` nul), l'agence nommée dans le
    // message par son seul identifiant : posé sur l'agence, il entrerait dans la cloche et le journal de tous ses
    // agents, texte d'erreur compris — une panne technique ne les concerne pas.
    const signaler = (cause: string) =>
      reportEdgeError(admin, 'matching-engine', new Error(`${cause} — agence ${agency_id ?? 'inconnue'}`), {
        agencyId: null, startedAt,
      })

    let newMatches = 0
    let newMarketMatches = 0
    // Ce que la renotation a produit (`match-contact`, `scan-all`) : les matchs réécrits, ceux qu'elle a écartés, les
    // recherches en échec (`reevaluerRecherches`) et la cause de la première, et si elle a été sautée (`replis`).
    let reevalues = 0
    let ecartes = 0
    let echecs = 0
    let premierEchec: string | null = null
    let renotationSautee = false

    /** Le signalement de la renotation de cet appel, sautée ou en échec (ci-dessus) : appelé une fois, après elle. */
    async function signalerRenotation(): Promise<void> {
      if (renotationSautee) {
        await signaler(`renotation sautée (${mode}), lecture illisible : ${replis.join(', ')}`)
      } else if (echecs > 0) {
        await signaler(`renotation en échec (${mode}) : ${echecs} échec${echecs > 1 ? 's' : ''}, le premier : ${premierEchec}`)
      }
    }

    // ── Insertion batch dé-dupliquée + audit sur les lignes RÉELLEMENT créées ──
    async function flush(rows: MatchRow[], rpc: 'insert_market_matches' | 'insert_internal_matches', source: 'market' | 'internal'): Promise<number> {
      if (rows.length === 0) return 0
      const { data: created, error } = await supabase.rpc(rpc, { p_rows: rows })
      if (error) throw error
      const createdRows = (created ?? []) as { id: string; contact_id: string; property_id: string | null; market_listing_id: string | null; score: number }[]
      if (createdRows.length > 0) {
        const { error: auditErr } = await supabase.from('activity_events').insert(
          createdRows.map((m) => ({
            agency_id,
            actor_id: null,
            actor_kind: 'ai',
            action: 'match_suggested',
            // `category` manquait ici, et cette seule omission faisait 95 % des lignes
            // sans catégorie de toute la table (4 616 sur 4 858, mesuré à l'étape 6) —
            // ce que la décision PO n° 6 décrivait comme un héritage diffus alors que
            // c'était UN émetteur. Le passé reste nul (activity_events refuse l'UPDATE),
            // mais le futur est classé.
            //
            // `contact` et non `ai` : un match est suggéré À un contact, c'est sa famille
            // MÉTIER. Que l'IA en soit l'auteur est déjà porté par `actor_kind`, et le
            // redire ici ferait de la catégorie `ai` deux choses à la fois. La puce
            // « Matchs » de l'écran vient du couple category + entity_type (§5.2), et
            // `entity_type: 'match'` la désigne déjà sans ambiguïté.
            category: 'contact',
            entity_type: 'match',
            entity_id: m.id,
            metadata: {
              contact_id: m.contact_id,
              property_id: m.property_id,
              market_listing_id: m.market_listing_id,
              score: m.score,
              mode,
              source,
              score_version: cfg.version,
            },
          })),
        )
        // Audit obligatoire (actor_kind='ai', cf CLAUDE.md) — un échec RLS ne doit pas passer inaperçu
        if (auditErr) console.error('[matching-engine] activity_events insert failed:', auditErr.message)
      }
      return createdRows.length
    }

    // ── Matchs internes (properties de l'agence). Filtre DUR transaction_type. ──
    function buildInternalRows(
      searches: Record<string, unknown>[],
      properties: Record<string, unknown>[],
      resolveContactId: (s: Record<string, unknown>) => string,
    ): MatchRow[] {
      const rows: MatchRow[] = []
      for (const search of searches) {
        const criteria = search.criteria as Record<string, unknown> | null
        if (!criteria) continue
        const tx = inferTransactionType(criteria)
        const cId = resolveContactId(search)
        for (const property of properties) {
          const pTx = property.transaction_type as string | null
          if (pTx && pTx !== tx) continue // un loyer n'est jamais une vente
          const score = calculateScoreV2(property, criteria, cfg)
          if (score.total >= cfg.threshold) {
            rows.push({
              agency_id,
              contact_id: cId,
              property_id: property.id as string,
              client_search_id: (search.id as string) ?? null,
              score: score.total,
              reasons: score.reasons,
              score_version: cfg.version,
            })
          }
        }
      }
      return rows
    }

    // ── Matchs marché (market_listings) via pré-filtre SQL DUR puis scoring soft ──
    async function matchSearchesAgainstMarket(
      searches: Record<string, unknown>[],
      resolveContactId: (s: Record<string, unknown>) => string,
    ): Promise<void> {
      if (!include_market) return
      const rows: MatchRow[] = []
      for (const search of searches) {
        const criteria = search.criteria as Record<string, unknown> | null
        if (!criteria) continue
        const cId = resolveContactId(search)
        const tx = inferTransactionType(criteria)
        const { cantons } = normalizeZones(criteria.zones)

        const { data: candidates, error } = await supabase.rpc('match_candidate_listings', {
          p_tx: tx,
          p_budget_min: numOrNull(criteria.budget_min),
          p_budget_max: numOrNull(criteria.budget_max),
          p_cantons: cantons.length > 0 ? cantons : null,
          p_types: null, // le type reste un axe SOFT (scoring), pas un filtre dur
          p_limit: 400,
        })
        if (error) throw error

        for (const ml of (candidates ?? []) as Record<string, unknown>[]) {
          // Sujet pour la référence loyer : loyer canonique = COALESCE(current_price, price).
          // Gate tx==='rent' → jamais de raison loyer sur une vente. Résolution L1
          // (canton) car la RPC ne renvoie pas postal_code. rentRef null ⇒ bonus 0.
          const subject: RentSubject = {
            canton: (ml.canton as string | null) ?? null,
            type: (ml.type as string | null) ?? null,
            surface_m2: numOrNull(ml.surface_m2),
            loyer: numOrNull(ml.current_price) ?? numOrNull(ml.price),
          }
          const rentRef = tx === 'rent' ? rentPosition(subject, rentIndex) : null
          const score = calculateScoreV2(ml, criteria, cfg, rentRef)
          if (score.total >= cfg.threshold) {
            rows.push({
              agency_id,
              contact_id: cId,
              market_listing_id: ml.id as string,
              client_search_id: (search.id as string) ?? null,
              score: score.total,
              reasons: score.reasons,
              score_version: cfg.version,
            })
          }
        }
      }
      newMarketMatches += await flush(rows, 'insert_market_matches', 'market')
    }

    if (mode === 'match-property' && property_id) {
      // ── Nouveau bien interne → scanner tous les acheteurs (interne uniquement) ──
      const { data: property, error: propError } = await supabase
        .from('properties')
        .select(PROP_COLS)
        .eq('id', property_id)
        .eq('agency_id', agency_id) // défense en profondeur : ne score que le bien de l'agence
        .single()
      if (propError || !property) {
        return new Response(JSON.stringify({ error: 'property_not_found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data: searches, error: searchError } = await supabase
        .from('client_searches')
        .select('id, contact_id, criteria')
        .eq('agency_id', agency_id)
        .eq('is_active', true)
      if (searchError) throw searchError

      const rows = buildInternalRows(searches || [], [property], (s) => s.contact_id as string)
      newMatches += await flush(rows, 'insert_internal_matches', 'internal')
    } else if (mode === 'match-contact' && contact_id) {
      // ── Acheteur (modifié) → scanner les biens internes + la veille marché ──
      // `supabase` est un client service-role : sans le filtre d'agence, ce
      // `contact_id` venu du corps atteignait les recherches de N'IMPORTE quel
      // contact de la plateforme, et les matches créés ensuite portaient
      // l'agence de l'APPELANT sur le contact d'une autre. Les deux autres
      // branches de ce switch (`match-property`, `scan-all`) filtraient déjà.
      // Les deux appelants légitimes passent : le front envoie l'agence du
      // profil, et le pont `client_searches` (20260621120000) poste
      // `NEW.agency_id`, c'est-à-dire l'agence de la ligne visée.
      const { data: searches, error: searchError } = await supabase
        .from('client_searches')
        .select('id, contact_id, criteria')
        .eq('contact_id', contact_id)
        .eq('agency_id', agency_id)
        .eq('is_active', true)
      if (searchError) throw searchError
      if (!searches || searches.length === 0) {
        return new Response(JSON.stringify({
          newMatches: 0, reevalues: 0, ecartes: 0, echecs: 0, renotationSautee: false, message: 'No active searches',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Ses critères ont pu changer (`on_search_criteria_updated`) : les matchs à proposer de chaque recherche active
      // sont renotés avec ceux du moment, AVANT la création — ceux qu'elle fait naître sont déjà notés, le bilan ne les
      // compte pas, et un échec de la renotation ne la prive de rien (`reevaluerRecherches`).
      if (replis.length > 0) {
        renotationSautee = true
        console.warn('[matching-engine] renotation sautée, données de repli :', { mode, agency_id, contact_id, replis })
      } else {
        const r = await reevaluerRecherches(
          supabase, agency_id, acteurId, searches as RechercheActive[],
          (recherche) => matchsDeLaRecherche(supabase, agency_id, recherche), cfg, rentIndex, mode,
        )
        reevalues += r.reevalues
        ecartes += r.ecartes
        echecs += r.echecs
        premierEchec = r.premierEchec
      }
      // Avant la création : une panne de celle-ci (500) ne doit pas taire celle de la renotation.
      await signalerRenotation()

      const { data: properties, error: propError } = await supabase
        .from('properties')
        .select(PROP_COLS)
        .eq('agency_id', agency_id)
        .eq('status', 'active')
      if (propError) throw propError

      const rows = buildInternalRows(searches, properties || [], () => contact_id!)
      newMatches += await flush(rows, 'insert_internal_matches', 'internal')

      await matchSearchesAgainstMarket(searches, () => contact_id!)
    } else if (mode === 'scan-all') {
      // ── Scan complet (pg_cron) ──
      const { data: searches } = await supabase
        .from('client_searches')
        .select('id, contact_id, criteria')
        .eq('agency_id', agency_id)
        .eq('is_active', true)

      const { data: properties } = await supabase
        .from('properties')
        .select(PROP_COLS)
        .eq('agency_id', agency_id)
        .eq('status', 'active')

      const rows = buildInternalRows(searches || [], properties || [], (s) => s.contact_id as string)
      newMatches += await flush(rows, 'insert_internal_matches', 'internal')

      await matchSearchesAgainstMarket(searches || [], (s) => s.contact_id as string)

      // ── Le rattrapage : les matchs à proposer qu'une version antérieure du barème a notés (sans version compris),
      // PLAFOND_RATTRAPAGE au plus, recherche par recherche. Après la création : ceux qu'elle vient de noter portent la
      // version courante, et un échec ici ne coûte pas à la nuit ses nouveaux matchs — il se compte dans la réponse, et
      // se signale (`signalerRenotation`).
      const actives = (searches ?? []) as RechercheActive[]
      if (replis.length > 0) {
        renotationSautee = true
        console.warn('[matching-engine] renotation sautée, données de repli :', { mode, agency_id, replis })
      } else {
        try {
          const selection = await couplesARattraper(supabase, agency_id, cfg.version, new Set(actives.map((s) => s.id)))
          const r = await reevaluerRecherches(
            supabase, agency_id, acteurId, actives, async (recherche) => selection.get(recherche.id), cfg, rentIndex, mode,
          )
          reevalues += r.reevalues
          ecartes += r.ecartes
          echecs += r.echecs
          premierEchec = r.premierEchec
        } catch (error) {
          // La lecture de nuit elle-même : aucune recherche n'a été renotée.
          echecs++
          premierEchec = redactedErrorMessage(error)
          console.error('[matching-engine] lecture du rattrapage en échec :', { mode, agency_id }, premierEchec)
        }
      }
      await signalerRenotation()
    } else if (mode === 'rescore-search' || mode === 'prospects' || mode === 'reactiver-prospect') {
      // ⛔ « Apprendre » ÉCRIT ce qu'il renote : sur des données de repli, un couple proche du seuil sortirait pour de
      // bon (`recherche_ajustee`), ou garderait une version par défaut que la nuit ne reverrait jamais. Il rend donc 503
      // AVANT toute écriture — ni notes, ni clé corrigée, ni journal — : la correction reste à l'écran, et la même
      // validation se rejoue.
      if (mode === 'rescore-search' && replis.length > 0) {
        await signaler(`renotation refusée (${mode}), lecture illisible : ${replis.join(', ')}`)
        return new Response(JSON.stringify({ error: 'renotation_indisponible', illisibles: replis }), {
          status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const r = mode === 'rescore-search' ? await renoterRecherche(supabase, agency_id, acteurId, body, cfg, rentIndex)
        : mode === 'prospects' ? await prospectsDuBien(supabase, agency_id, body, cfg, rentIndex)
          : await reactiverProspect(supabase, agency_id, acteurId, body, cfg, rentIndex)
      return new Response(JSON.stringify(r.corps), {
        status: r.statut, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } else {
      return new Response(JSON.stringify({ error: 'invalid_mode' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({
      newMatches, newMarketMatches, reevalues, ecartes, echecs, renotationSautee, mode, scoreVersion: cfg.version,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    // Ce catch reçoit les erreurs Postgres des RPC d'insertion et des lectures (`throw error`
    // plus haut) : leur message nomme tables et contraintes. Journal, pas réponse — audit
    // S14. Les deux refus dus à l'APPELANT (mode inconnu, bien absent) sortent avant, avec
    // leur code : ils passaient par ici en 500, texte compris.
    console.error('[matching-engine] échec :', redactedErrorMessage(error))
    return new Response(JSON.stringify({ error: 'internal_error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
