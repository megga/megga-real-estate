// Matching · Recherche hybride — accès données LIVE (marché connecté + acheteurs).
//
// Le proto handoff filtrait un petit jeu démo côté client. En prod, `market_listings`
// pèse ~66k annonces actives : le filtre DUR (transaction, canton, type, budget) est
// poussé EN SQL via la RPC perf-safe `match_candidate_listings` (déjà déployée, servie
// par un index partiel, LIMIT bornée), puis on récupère les colonnes d'affichage par
// lot d'IDs (`.in('id', …)` = index PK, borné). Le texte libre + le scoring + le tri +
// « proches des critères » restent côté client sur ce sous-ensemble borné.
//
// ⚠️ Règles perf (CLAUDE.md §7) respectées : pas de `count:'exact'`, pas d'`ORDER BY`
// hors index sur la grande table (le tri se fait sur le sous-ensemble borné), colonnes
// lourdes (`description`) jamais chargées ici.

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { mapListingRow, mapSearchRow, type MrhBien, type MrhContact } from '@/components/matching-recherche/types'

// Colonnes d'affichage (JAMAIS `description` — 2 Ko/row). photos_cf = R2 (rapide,
// sans hotlink) prioritaire sur photos (portail).
const CARD_COLS =
  'id,title,address,city,postal_code,canton,type,transaction_type,price,current_price,' +
  'price_at_first_seen,price_per_m2,rooms,bedrooms,bathrooms,surface_m2,features,photos,photos_cf,' +
  'status,source_portal,source_url,source_id,agency_name,agency_phone,agency_logo_url,lat,lng,' +
  'year_built,days_on_market,land_surface'

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

/** IDs candidats via la RPC perf-safe, pour une transaction donnée. */
async function candidateIds(p: MatchingSearchParams, tx: 'buy' | 'rent'): Promise<string[]> {
  // NB : les args optionnels de la RPC (DEFAULT NULL) sont typés `| undefined`
  // côté client ; on passe `undefined` (→ omis → DEFAULT NULL), pas `null`.
  const { data, error } = await supabase.rpc('match_candidate_listings', {
    p_tx: tx,
    p_budget_min: p.budgetMin ?? undefined,
    p_budget_max: p.budgetMax ?? undefined,
    p_margin: 0.15,
    p_cantons: p.cantons && p.cantons.length ? p.cantons : undefined,
    p_types: p.types && p.types.length ? p.types : undefined,
    p_min_quality: 50,
    p_limit: p.limitPerTx ?? 60,
    p_city: p.city && p.city.trim() ? p.city.trim() : undefined,
  })
  if (error) throw error
  return (data ?? []).map((r: { id: string }) => r.id)
}

/**
 * Annonces du marché connecté correspondant aux filtres durs, mappées pour l'UI.
 * Enabled même sans filtre (vue « Tout » = meilleures annonces des deux transactions).
 */
export function useMatchingSearch(params: MatchingSearchParams) {
  const { profile } = useAuth()
  const enabled = !!profile?.agency_id
  return useQuery<MrhBien[]>({
    queryKey: ['mrh-search', params],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const txList: Array<'buy' | 'rent'> = params.transaction ? [params.transaction] : ['buy', 'rent']
      const idLists = await Promise.all(txList.map((tx) => candidateIds(params, tx)))
      // Ordre stable : IDs concaténés par transaction (qualité DESC de la RPC).
      // Borne globale à 120 pour tenir l'URL du `.in` + le poids de la grille.
      const ids = idLists.flat().slice(0, 120)
      if (!ids.length) return []
      const { data, error } = await supabase
        .from('market_listings')
        .select(CARD_COLS)
        .in('id', ids)
      if (error) throw error
      const order = new Map(ids.map((id, i) => [id, i]))
      return (data ?? [])
        .map((row) => mapListingRow(row as unknown as Record<string, unknown>))
        .sort((a, b) => (order.get(a.id) ?? 1e9) - (order.get(b.id) ?? 1e9))
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
