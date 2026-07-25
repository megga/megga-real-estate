// Matching · Recherche hybride — accès données LIVE (marché connecté + acheteurs).
//
// Le proto handoff filtrait un petit jeu démo côté client. En prod, `market_listings`
// pèse ~61k annonces actives : le filtre DUR (transaction, canton, type, budget, ville)
// est poussé EN SQL via `search_market_listings`, servie par l'index partiel
// `idx_ml_search_recent` (transaction_type, created_at DESC, id DESC) ; puis on récupère
// les colonnes d'affichage par lots d'IDs (`.in('id', …)` = index PK, découpé).
//
// ⚠️ LIMITE CONNUE, à corriger : le texte libre, le scoring acheteur, les tris et
// « proches des critères » restent CÔTÉ CLIENT, donc ne portent que sur les candidats
// déjà chargés — pas sur les 61k. Taper « duplex » ne cherche pas dans 1 220 annonces
// mais dans les 400 en mémoire. C'est pourquoi cet écran affiche le total réel du
// marché filtré (`useMatchingSearchTotal`) au lieu de laisser croire à l'exhaustivité.
// Tant que ce filtrage n'est pas en SQL, NE PAS ajouter de pagination / scroll infini :
// les tris et le compteur de « rescue » classeraient dans la tranche chargée avec
// aplomb, transformant un manque visible en réponse fausse invisible.
//
// ⚠️ Règles perf (CLAUDE.md §7) : pas d'`ORDER BY` hors index sur la grande table,
// colonnes lourdes (`description`) jamais chargées ici. Le `count` exact est une
// exception assumée et mesurée — voir `useMatchingSearchTotal`.

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { mapListingRow, mapListingDetailRow, mapSearchRow, type MrhBien, type MrhBienDetail, type MrhContact } from '@/components/matching-recherche/types'

// Colonnes d'affichage (JAMAIS `description` — 2 Ko/row). photos_cf = R2 (rapide,
// sans hotlink) prioritaire sur photos (portail).
const CARD_COLS =
  'id,title,address,city,postal_code,canton,type,transaction_type,price,current_price,' +
  'price_at_first_seen,price_per_m2,rooms,bedrooms,bathrooms,surface_m2,features,photos,photos_cf,' +
  'status,source_portal,source_url,source_id,agency_name,agency_phone,agency_logo_url,lat,lng,' +
  'year_built,days_on_market,land_surface'

/** Plafond de candidats PAR transaction (= `p_limit` de la RPC). */
const MAX_PER_TX = 400
/**
 * Plafond global après entrelacement — borne le DOM de la grille, qui n'est pas
 * virtualisée. Ce n'est PAS une contrainte base : le plan de la RPC est identique
 * à LIMIT 60 et à LIMIT 5000 (elle scanne de toute façon le sous-ensemble filtré).
 */
const MAX_CANDIDATES = 400
/**
 * Taille de lot du `.in('id', …)`. PostgREST passe les UUID en query string
 * (~37 o pièce) : au-delà du plafond d'URL du proxy, l'échec est un 414 franc,
 * pas une lenteur. On découpe donc en requêtes parallèles.
 */
const ID_CHUNK = 150

export type SearchTx = 'buy' | 'rent' | null

export interface MatchingSearchParams {
  /** null = les deux transactions (vue « Tout ») */
  transaction: SearchTx
  cantons?: string[]
  /** enums internes market_listings ('apartment'…) */
  types?: string[]
  budgetMin?: number | null
  budgetMax?: number | null
  /** ville exacte (accent/casse-insensible via unaccent, poussée EN SQL) */
  city?: string | null
  /** plafond de candidats PAR transaction (borne l'IN + le DOM) */
  limitPerTx?: number
}

/**
 * IDs candidats pour une transaction, LES PLUS RÉCENTS d'abord.
 *
 * Utilise `search_market_listings` et NON `match_candidate_listings` : cette
 * dernière trie par `quality_score DESC, prix ASC`, or 36 222 annonces sont à
 * égalité sur quality_score = 100 — le prix décidait donc seul, et l'écran
 * servait les annonces les moins chères de Suisse (zéro Genève sur 3 667).
 * `match_candidate_listings` reste intacte : elle sert aussi le moteur de
 * matching et les stats de vente du copilote.
 */
async function candidateIds(p: MatchingSearchParams, tx: 'buy' | 'rent'): Promise<string[]> {
  // NB : les args optionnels de la RPC (DEFAULT NULL) sont typés `| undefined`
  // côté client ; on passe `undefined` (→ omis → DEFAULT NULL), pas `null`.
  const { data, error } = await supabase.rpc('search_market_listings', {
    p_tx: tx,
    p_budget_min: p.budgetMin ?? undefined,
    p_budget_max: p.budgetMax ?? undefined,
    p_margin: 0.15,
    p_cantons: p.cantons && p.cantons.length ? p.cantons : undefined,
    p_types: p.types && p.types.length ? p.types : undefined,
    p_min_quality: 50,
    p_limit: p.limitPerTx ?? MAX_PER_TX,
    p_city: p.city && p.city.trim() ? p.city.trim() : undefined,
  })
  if (error) throw error
  return (data ?? []).map((r: { id: string }) => r.id)
}

/** Total EXACT du marché filtré pour une transaction (RPC bornée, prédicat indexé). */
async function candidateCount(p: MatchingSearchParams, tx: 'buy' | 'rent'): Promise<number> {
  const { data, error } = await supabase.rpc('count_market_listings', {
    p_tx: tx,
    p_budget_min: p.budgetMin ?? undefined,
    p_budget_max: p.budgetMax ?? undefined,
    p_margin: 0.15,
    p_cantons: p.cantons && p.cantons.length ? p.cantons : undefined,
    p_types: p.types && p.types.length ? p.types : undefined,
    p_min_quality: 50,
    p_city: p.city && p.city.trim() ? p.city.trim() : undefined,
  })
  if (error) throw error
  return Number(data ?? 0)
}

/**
 * Annonces du marché connecté correspondant aux filtres durs, mappées pour l'UI.
 * Enabled même sans filtre (vue « Tout » = meilleures annonces des deux transactions).
 */
export function useMatchingSearch(params: MatchingSearchParams) {
  // Gate sur la SESSION, pas sur `agency_id` : `market_listings` est le marché
  // connecté (données publiques des portails), lisible par tout `authenticated`
  // (policy « Authenticated users can read market_listings » USING true) — ce
  // n'est pas de la donnée agence-scopée. Gater sur l'agence rendait la Recherche
  // définitivement vide pour les profils sans agence (super_admin), et de façon
  // SILENCIEUSE : une query React Query désactivée reste `isPending` sans être
  // `isLoading`, donc l'UI tombait direct sur l'état vide « aucune annonce ».
  const { user } = useAuth()
  const enabled = !!user
  const query = useQuery<MrhBien[]>({
    queryKey: ['mrh-search', params],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const txList: Array<'buy' | 'rent'> = params.transaction ? [params.transaction] : ['buy', 'rent']
      const idLists = await Promise.all(txList.map((tx) => candidateIds(params, tx)))
      // Entrelacement round-robin AVANT la borne. `flat()` concatène vente PUIS
      // location : toute borne globale inférieure à la somme des lots effacerait
      // la seconde transaction de la vue « Tout », en silence. L'équilibre 60/60
      // d'avant n'était qu'une coïncidence de plafonds.
      const ids: string[] = []
      for (let rank = 0; rank < MAX_PER_TX && ids.length < MAX_CANDIDATES; rank++) {
        for (const list of idLists) {
          if (list[rank] && ids.length < MAX_CANDIDATES) ids.push(list[rank])
        }
      }
      if (!ids.length) return []
      // Découpage du `.in()` : voir ID_CHUNK — au-delà, le proxy renvoie un 414.
      const chunks: string[][] = []
      for (let i = 0; i < ids.length; i += ID_CHUNK) chunks.push(ids.slice(i, i + ID_CHUNK))
      const responses = await Promise.all(
        chunks.map((chunk) => supabase.from('market_listings').select(CARD_COLS).in('id', chunk)),
      )
      const failed = responses.find((r) => r.error)
      if (failed?.error) throw failed.error
      const data = responses.flatMap((r) => r.data ?? [])
      const order = new Map(ids.map((id, i) => [id, i]))
      return (data ?? [])
        .map((row) => mapListingRow(row as unknown as Record<string, unknown>))
        .sort((a, b) => (order.get(a.id) ?? 1e9) - (order.get(b.id) ?? 1e9))
    },
  })
  // `blocked` = la query n'a pas le DROIT de partir (gate `enabled` faux). React
  // Query ne distingue pas ce cas de « en vol » : les deux sont `isPending`. Sans
  // cette information, l'UI ne peut choisir qu'entre mentir (état vide) et tourner
  // indéfiniment (spinner) — on a successivement fait les deux.
  return { ...query, blocked: !enabled }
}

/**
 * Total EXACT du marché filtré, toutes transactions demandées confondues.
 *
 * Sert à ce que l'écran arrête de présenter la taille d'une TRANCHE comme un
 * nombre de marché : « 1 146 annonces · 400 affichées ». Le count exact est
 * permis ici — la règle « JAMAIS `count:'exact'` » (CLAUDE.md §7) vise le count
 * SANS prédicat indexable, alors que celui-ci est toujours au moins scopé par
 * transaction : mesuré 74,8 ms (transaction seule), 10,6 ms (+ canton).
 */
export function useMatchingSearchTotal(params: MatchingSearchParams) {
  const { user } = useAuth()
  return useQuery<number>({
    queryKey: ['mrh-search-total', params],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const txList: Array<'buy' | 'rent'> = params.transaction ? [params.transaction] : ['buy', 'rent']
      const counts = await Promise.all(txList.map((tx) => candidateCount(params, tx)))
      return counts.reduce((sum, n) => sum + n, 0)
    },
  })
}

/**
 * Acheteurs / locataires pour l'omnibox — dérivés des `client_searches` ACTIFS
 * (source réelle du modèle acheteur, agency-scopée par RLS). Un contact peut avoir
 * plusieurs recherches → plusieurs entrées (désambiguïsées par le libellé).
 */
export function useMatchingBuyers() {
  const { profile } = useAuth()
  const enabled = !!profile?.agency_id
  return useQuery<MrhContact[]>({
    queryKey: ['mrh-buyers', profile?.agency_id],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_searches')
        .select('id, contact_id, label, criteria, contact:contacts(first_name, last_name)')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return (data ?? []).map((row) => {
        const r = row as {
          id: string; contact_id: string; label: string | null; criteria: Record<string, unknown> | null
          contact: { first_name: string | null; last_name: string | null } | Array<{ first_name: string | null; last_name: string | null }> | null
        }
        const contact = Array.isArray(r.contact) ? r.contact[0] ?? null : r.contact
        return mapSearchRow(r, contact)
      })
    },
  })
}

/**
 * Colonnes réservées à la FICHE d'une annonce — jamais chargées en liste.
 * `description` fait ~1,5 Ko en moyenne (max 9,3 Ko) : sur 400 candidats ce
 * serait ~600 Ko de payload pour un texte que personne ne lit dans la grille.
 */
const DETAIL_COLS =
  'description,floor,parking_count,year_renovated,usable_surface,charges_monthly,' +
  'is_furnished,availability_date,visit_contact_name,agency_reference'

/**
 * Champs de fiche d'UNE annonce, chargés à l'ouverture de « Voir l'annonce ».
 *
 * Lecture par clé primaire (index PK) : le coût est constant et sans rapport
 * avec la taille de `market_listings` — c'est ce qui autorise `description` ici
 * alors que la liste se l'interdit. `null` = annonce introuvable (retirée entre
 * le chargement de la liste et l'ouverture) ; la fiche affiche alors seulement
 * ce que la grille lui a déjà donné, sans bloquer.
 */
export function useMarketListingDetail(id: string | null) {
  const { user } = useAuth()
  return useQuery<MrhBienDetail | null>({
    queryKey: ['mrh-listing-detail', id],
    enabled: !!user && !!id,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('market_listings')
        .select(DETAIL_COLS)
        .eq('id', id as string)
        .maybeSingle()
      if (error) throw error
      return data ? mapListingDetailRow(data as unknown as Record<string, unknown>) : null
    },
  })
}

export interface CityHit { city: string; canton: string; n: number }

/**
 * Autocomplétion des VILLES (RPC `search_cities`) — toutes les villes qui ont des
 * annonces au marché connecté (~3750). Alimente l'omnibox : l'agent tape ≥ 2 lettres
 * → suggestions de vraies villes → picker pose un jeton ville → filtre `p_city` en SQL.
 * Débounce léger via `staleTime` + gate sur la longueur du préfixe.
 */
export function useCitySuggest(prefix: string, tx: SearchTx) {
  const p = prefix.trim()
  return useQuery<CityHit[]>({
    queryKey: ['mrh-cities', p.toLowerCase(), tx],
    enabled: p.length >= 2,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('search_cities', {
        p_prefix: p,
        p_tx: tx ?? undefined,
        p_limit: 6,
      })
      if (error) throw error
      return (data ?? []).map((r) => ({ city: r.city, canton: r.canton, n: Number(r.n) }))
    },
  })
}
