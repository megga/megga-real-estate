import { useQuery, useInfiniteQuery, keepPreviousData } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import type { ListingCardData } from '@/components/listings/ListingCard'
// applyPlaceholders removed — was replacing real Flatfox data (photos,
// titles, addresses, agencies) with fake Unsplash/demo content.
import type { PostgrestFilterBuilder } from '@supabase/postgrest-js'
import { generateListingTitle, type Lang } from '@/lib/listingTitle'

// ─── TYPES ──────────────────────────────────────────────────────────────────

export interface MarketFilters {
  context?: 'buy' | 'rent'
  types?: string[]
  canton?: string
  city?: string
  minPrice?: number
  maxPrice?: number
  minRooms?: number
  maxRooms?: number
  minBedrooms?: number
  minBathrooms?: number
  minSurface?: number
  maxSurface?: number
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'newest' | 'surface_desc' | 'best_deals' | 'recommended'
  q?: string
  energyLabel?: string
  maxDaysOnMarket?: number
  isFurnished?: boolean
  availableNow?: boolean
  // Amenity codes understood by get_market_map_points (balcony, pool, view,
  // garage, elevator, furnished, pets_allowed, fireplace, new_building,
  // minergie, parking). Terrace is deferred to v2 — see docs/backlog.md.
  features?: string[]
}

export interface MapPoint {
  id: string
  lat: number
  lng: number
  price: number
  type: string
  rooms: number
  context: 'buy' | 'rent'
}

// Bumped from 20 → 50 : x2.5 réduction des round-trips réseau sur scroll
// infinite (audit perf /rent Sprint 4 polish). 50 items = ~3.5 pages
// virtuelles à 14 rows visibles dans la viewport — confortable.
const PAGE_SIZE = 50

// ─── HELPERS ────────────────────────────────────────────────────────────────

// Supabase query builder type after .select() — constrains to PostgrestFilterBuilder chain
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MarketListingsQuery = PostgrestFilterBuilder<any, any, any, any>

// Échappe les caractères qui ont une signification dans la syntaxe PostgREST
// `.or()` ou dans les patterns LIKE :
//   - `%` et `_` → wildcards LIKE → escape avec `\`
//   - `,` `(` `)` → séparateurs/groupes `.or()` → remplacer par espace
// Sans ça, un user qui tape `"50%"` matche tout, ou `"a,b)"` casse la requête
// (erreur 400 PostgREST). Utilisé par `applyFilters` (filters.q) et
// `useCitiesAutocomplete`.
export function escapeForOrLike(s: string): string {
  return s
    .replace(/[\\%_]/g, '\\$&')
    .replace(/[(),]/g, ' ')
    .trim()
}

function applyFilters<Q extends MarketListingsQuery>(query: Q, filters: MarketFilters): Q {
  // Use eq instead of in — the partial index only covers status='active' and
  // 99.9% of listings are 'active'. The 'price_reduced' status is handled by
  // the price_at_first_seen vs current_price comparison on the card itself.
  let q = query.eq('status', 'active')
  q = q.eq('transaction_type', filters.context || 'buy')
  // For sales, exclude listings without a price (useless to display).
  // For rentals, allow price=0 because many parking/storage/office listings
  // have "prix sur demande" which Flatfox reports as 0.
  if (filters.context !== 'rent') {
    q = q.gt('price', 0)
  }
  q = q.gte('quality_score', 50)
  if (filters.types && filters.types.length > 0) q = q.in('type', filters.types)
  if (filters.canton) q = q.eq('canton', filters.canton)
  if (filters.city) q = q.ilike('city', `%${filters.city}%`)
  if (filters.minPrice) q = q.gte('price', filters.minPrice)
  if (filters.maxPrice) q = q.lte('price', filters.maxPrice)
  if (filters.minRooms) q = q.gte('rooms', filters.minRooms)
  if (filters.maxRooms) q = q.lte('rooms', filters.maxRooms)
  if (filters.minBedrooms) q = q.gte('bedrooms', filters.minBedrooms)
  if (filters.minBathrooms) q = q.gte('bathrooms', filters.minBathrooms)
  if (filters.minSurface) q = q.gte('surface_m2', filters.minSurface)
  if (filters.maxSurface) q = q.lte('surface_m2', filters.maxSurface)
  if (filters.energyLabel) {
    if (filters.energyLabel === 'minergie') {
      q = q.eq('energy_label', 'minergie')
    } else if (filters.energyLabel === 'D+') {
      q = q.in('energy_label', ['D', 'E', 'F', 'G'])
    } else {
      q = q.eq('energy_label', filters.energyLabel)
    }
  }
  if (filters.maxDaysOnMarket) q = q.lte('days_on_market', filters.maxDaysOnMarket)
  if (filters.isFurnished) q = q.eq('is_furnished', true)
  if (filters.availableNow) q = q.lte('availability_date', new Date().toISOString().slice(0, 10))
  if (filters.features && filters.features.length > 0) {
    // Map feature codes → market_listings boolean/array columns.
    // Keep in sync with get_market_map_points migration 20260418_001.
    const featureColumn: Record<string, string> = {
      balcony: 'has_balcony',
      pool: 'has_swimming_pool',
      view: 'has_nice_view',
      garage: 'has_garage',
      parking: 'has_parking',
      elevator: 'has_elevator',
      furnished: 'is_furnished',
      pets_allowed: 'pets_allowed',
      fireplace: 'has_fireplace',
      new_building: 'is_new_building',
      minergie: 'is_minergie',
    }
    for (const f of filters.features) {
      const col = featureColumn[f]
      if (col) q = q.eq(col, true)
      // Unknown codes are silently ignored — keeps the query valid if the
      // LLM ever emits something outside the v1 whitelist.
    }
  }
  if (filters.q) {
    const safe = escapeForOrLike(filters.q)
    if (safe.length > 0) {
      q = q.or(`title.ilike.%${safe}%,city.ilike.%${safe}%,address.ilike.%${safe}%,canton.ilike.%${safe}%`)
    }
  }
  return q
}

function applySorting<Q extends MarketListingsQuery>(query: Q, sort: MarketFilters['sort']): Q {
  switch (sort) {
    case 'price_asc': return query.order('price', { ascending: true, nullsFirst: false })
    case 'price_desc': return query.order('price', { ascending: false, nullsFirst: false })
    // 'newest' = `created_at` (pas `first_seen_at`) pour utiliser le partial
    // index `idx_ml_rent_active_created` (CLAUDE.md §7). `first_seen_at` n'a
    // pas d'index dédié → sort en mémoire sur 33K rows → timeout.
    case 'newest': return query.order('created_at', { ascending: false })
    case 'surface_desc': return query.order('surface_m2', { ascending: false, nullsFirst: false })
    case 'best_deals': return query.order('price_per_m2', { ascending: true, nullsFirst: false })
    // 'recommended' = vrai score multi-signal (migration 20260515_001) :
    // quality + photos + complétude + price valid + description. Couvert par
    // le partial index `idx_ml_relevance` (transaction_type, relevance_score
    // DESC, created_at DESC) WHERE status='active' AND quality_score>=50.
    // Le created_at fait tiebreaker (la fraîcheur intervient en 2e clé).
    case 'recommended':
      return query
        .order('relevance_score', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
    default: return query.order('created_at', { ascending: false })
  }
}

function normalizeLang(raw: string | undefined): Lang {
  const short = (raw || 'fr').slice(0, 2).toLowerCase()
  return short === 'de' || short === 'en' || short === 'it' ? short : 'fr'
}

export function transformToCardData(
  ml: Record<string, unknown>,
  source: 'market' | 'internal' = 'market',
  lang: Lang = 'fr'
): ListingCardData {
  const txType = (ml.transaction_type as 'buy' | 'rent') || 'buy'
  const isFurnished = !!ml.is_furnished
  const depositMonths = (ml.deposit_months as number | null | undefined) ?? null
  const externalRegie = (ml.external_regie as { name?: string; phone?: string; email?: string; website?: string } | null) ?? null

  const localizedTitle = generateListingTitle(
    {
      type: ml.type as string | null,
      rooms: Number(ml.rooms) || 0,
      city: ml.city as string | null,
      transaction_type: txType,
      title: ml.title as string | null,
    },
    lang,
  )

  if (source === 'internal') {
    return {
      id: `internal-${ml.id}`,
      title: localizedTitle || (ml.title as string) || 'Bien immobilier',
      price: Number(ml.price) || 0,
      address: (ml.address as string) || '',
      city: (ml.city as string) || '',
      rooms: Number(ml.rooms) || 0,
      bedrooms: (ml.bedrooms as number) || 0,
      surface_m2: Number(ml.surface_m2) || 0,
      photos: (ml.photos as string[]) || [],
      type: (ml.type as string) || 'apartment',
      context: txType,
      description: (ml.description as string) || '',
      canton: (ml.canton as string) || '',
      published_at: (ml.published_at as string) || (ml.created_at as string),
      lat: ml.lat as number | undefined,
      lng: ml.lng as number | undefined,
      is_exclusive: true,
      transaction_type: txType,
      is_furnished: isFurnished,
      deposit_months: depositMonths,
      external_regie: externalRegie,
      c2pa_verified: !!ml.c2pa_verified,
      c2pa_verified_at: (ml.c2pa_verified_at as string | undefined) ?? undefined,
    }
  }

  return {
    id: `market-${ml.id}`,
    title: localizedTitle || (ml.title as string) || 'Bien immobilier',
    price: Number(ml.current_price ?? ml.price ?? 0),
    address: (ml.address as string) || '',
    city: (ml.city as string) || '',
    rooms: Number(ml.rooms) || 0,
    bedrooms: (ml.bedrooms as number) || 0,
    surface_m2: Number(ml.surface_m2) || 0,
    photos: (ml.photos as string[]) || [],
    photos_cf: (ml.photos_cf as ListingCardData['photos_cf']) ?? null,
    type: (ml.type as string) || 'apartment',
    context: txType,
    description: (ml.description as string) || '',
    canton: (ml.canton as string) || '',
    published_at: (ml.first_seen_at as string) || (ml.created_at as string),
    lat: ml.lat as number | undefined,
    lng: ml.lng as number | undefined,
    is_hot: ml.status === 'price_reduced',
    source_portal: ml.source_portal as string | undefined,
    source_url: ml.source_url as string | undefined,
    agency_name: ml.agency_name as string | undefined,
    agency_logo_url: ml.agency_logo_url as string | undefined,
    price_per_m2: ml.price_per_m2 as number | undefined,
    days_on_market: ml.days_on_market as number | undefined,
    bathrooms: ml.bathrooms as number | undefined,
    year_built: ml.year_built as number | undefined,
    energy_label: ml.energy_label as string | undefined,
    has_balcony: !!ml.has_balcony,
    has_swimming_pool: !!ml.has_swimming_pool,
    has_nice_view: !!ml.has_nice_view,
    has_garage: !!ml.has_garage,
    has_parking: !!ml.has_parking,
    has_elevator: !!ml.has_elevator,
    has_fireplace: !!ml.has_fireplace,
    is_new_building: !!ml.is_new_building,
    is_minergie: !!ml.is_minergie,
    transaction_type: txType,
    is_furnished: isFurnished,
    deposit_months: depositMonths,
    external_regie: externalRegie,
    price_drop_pct: (() => {
      const initial = Number(ml.price_at_first_seen || ml.price)
      const current = Number(ml.current_price ?? ml.price ?? 0)
      if (initial > 0 && current > 0 && current < initial) {
        return Math.round(((initial - current) / initial) * 100)
      }
      return undefined
    })(),
  }
}

// ─── HOOK 1 : Liste paginée avec filtres ────────────────────────────────────

export function useMarketListings(filters: MarketFilters = {}) {
  const { i18n } = useTranslation()
  const lang = normalizeLang(i18n.language)
  return useInfiniteQuery({
    queryKey: ['market-listings', filters, lang],
    queryFn: async ({ pageParam = 0 }): Promise<{
      listings: ListingCardData[]
      nextPage: number | null
      totalCount: number
    }> => {
      const from = pageParam * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      // ── Market listings ──
      // Light SELECT: exclude `description` (CLAUDE.md §7 — colonne lourde
      // ~2 KB/row × 33K = 66 MB potentiel, jamais affiché dans la card, chargé
      // uniquement sur la page détail via useMarketListingDetail). Photos
      // gardées car nécessaires pour le hero card + carousel.
      let marketQuery = supabase
        .from('market_listings')
        .select(
          'id, title, price, current_price, price_at_first_seen, address, city, canton, postal_code, rooms, bedrooms, bathrooms, surface_m2, photos, photos_cf, type, lat, lng, source_portal, source_url, agency_name, agency_logo_url, price_per_m2, days_on_market, status, first_seen_at, created_at, transaction_type, is_furnished, deposit_months, charges_monthly, external_regie, year_built, energy_label, has_balcony, has_swimming_pool, has_nice_view, has_garage, has_parking, has_elevator, has_fireplace, is_new_building, is_minergie'
        )

      marketQuery = applyFilters(marketQuery, filters)
      marketQuery = applySorting(marketQuery, filters.sort)
      marketQuery = marketQuery.range(from, to)

      const { data: marketData, error: marketError } = await marketQuery
      if (marketError) {
        // Surface to React Query so the UI can show an error state instead of
        // a silent empty list. Previously the error was swallowed and the page
        // rendered "Aucun bien trouvé" even when the database was unreachable.
        throw new Error(`market_listings query failed: ${marketError.message}`)
      }

      const listings: ListingCardData[] = []

      // Ajouter les biens internes en première page uniquement.
      // Guard auth : la table `properties` a une RLS basée sur get_user_agency_id().
      // Pour les anon/particuliers, cette RPC est bloquée (permission denied),
      // donc on skip directement la query au lieu de la laisser échouer en boucle.
      const { data: { session } } = await supabase.auth.getSession()
      if (pageParam === 0 && session?.user) {
        let internalQuery = supabase
          .from('properties')
          .select(
            'id, title, price, address, city, canton, postal_code, rooms, bedrooms, surface_m2, photos, type, description, lat, lng, created_at, published_at, transaction_type, c2pa_verified, c2pa_verified_at'
          )
          .eq('status', 'active')

        // Filter by transaction_type so BUY properties don't appear on /rent
        // and RENT properties don't appear on /buy
        if (filters.context) {
          internalQuery = internalQuery.eq('transaction_type', filters.context)
        }

        if (filters.types && filters.types.length > 0) {
          internalQuery = internalQuery.in('type', filters.types as ('apartment' | 'house' | 'villa' | 'commercial' | 'land')[])
        }
        if (filters.canton) {
          internalQuery = internalQuery.eq('canton', filters.canton)
        }
        if (filters.minPrice) {
          internalQuery = internalQuery.gte('price', filters.minPrice)
        }
        if (filters.maxPrice) {
          internalQuery = internalQuery.lte('price', filters.maxPrice)
        }
        if (filters.minRooms) {
          internalQuery = internalQuery.gte('rooms', filters.minRooms)
        }

        internalQuery = internalQuery
          .order('published_at', { ascending: false })
          .limit(PAGE_SIZE)

        const { data: internalData, error: internalError } = await internalQuery
        if (internalError) {
          // Internal-listings failure is non-fatal — they're a tiny set of
          // agent-owned mandates and should not break the marketplace view.
          // We log and continue with just market listings.
           
          console.warn('[useMarketListings] internal properties query failed:', internalError.message)
        } else if (internalData) {
          for (let i = 0; i < internalData.length; i++) {
            listings.push(transformToCardData(internalData[i], 'internal', lang))
          }
        }
      }

      // Ajouter les biens du marché
      if (marketData) {
        for (let i = 0; i < marketData.length; i++) {
          listings.push(transformToCardData(marketData[i], 'market', lang))
        }
      }

      // No count query (was causing statement timeout on 33K+ rows).
      // totalCount is approximate: we know there are more pages if we got a full batch.
      const internalCount = pageParam === 0 ? listings.filter(l => l.id.startsWith('internal-')).length : 0
      const marketCount = marketData?.length ?? 0
      const hasMore = marketCount === PAGE_SIZE
      const totalCount = hasMore ? internalCount + marketCount + 1 : internalCount + marketCount

      return {
        listings,
        nextPage: hasMore ? pageParam + 1 : null,
        totalCount,
      }
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    staleTime: 5 * 60 * 1000, // 5 minutes
    placeholderData: keepPreviousData, // keep UI stable during filter changes
  })
}

// ─── HOOK 1b : Compteur estimé pour les filtres en cours ────────────────────
//
// Postgres `count: 'estimated'` retourne l'estimation du planner (instantané)
// — pas un COUNT(*) qui timeout sur 33K rows. Le résultat est approximatif
// mais largement suffisant pour afficher "X biens trouvés" dans la filter bar.
//
// JAMAIS `count: 'exact'` ici (voir CLAUDE.md section 7).

export function useMarketListingsCount(filters: MarketFilters = {}) {
  // Le `filters.q` (free text ILIKE/OR) est exclu du compteur : sur 33K rows
  // un .or() multi-champs peut friser 3s même avec count: 'estimated'. On
  // accepte un léger overcount quand l'user tape — le résultat reste une
  // estimation et le brief autorise cette imprécision (CLAUDE.md §7).
  const lightFilters = filters.q ? { ...filters, q: undefined } : filters
  return useQuery({
    queryKey: ['market-listings-count', lightFilters],
    queryFn: async (): Promise<number> => {
      let query = supabase
        .from('market_listings')
        .select('id', { count: 'estimated', head: true })
      query = applyFilters(query, lightFilters)
      const { count, error } = await query
      if (error) throw new Error(`market_listings count failed: ${error.message}`)
      return count ?? 0
    },
    staleTime: 60 * 1000, // 1 min
    placeholderData: keepPreviousData,
  })
}

// ─── HOOK 1c : Autocomplete villes pour la search bar du hero ───────────────
//
// MVP : ILIKE prefix sur `market_listings.city`, dédupliqué client-side.
// Le partial index sur transaction_type + status couvre déjà 99% des rows ;
// l'ILIKE prefix sur city est rapide dans ce sous-ensemble (~33K rows pour
// rent, ~1K pour buy). Si ça devient lent → migrer vers un RPC dédié.

export function useCitiesAutocomplete(query: string, context: 'buy' | 'rent' = 'buy') {
  const trimmed = query.trim()
  return useQuery({
    queryKey: ['cities-autocomplete', trimmed, context],
    queryFn: async (): Promise<string[]> => {
      if (trimmed.length < 2) return []
      const safe = escapeForOrLike(trimmed)
      if (safe.length === 0) return []
      const { data, error } = await supabase
        .from('market_listings')
        .select('city')
        .eq('status', 'active')
        .eq('transaction_type', context)
        .ilike('city', `${safe}%`)
        .limit(80)
      if (error) return []
      const seen = new Set<string>()
      const out: string[] = []
      for (const row of (data as Array<{ city?: string }>) || []) {
        // Normalise les espaces multiples avant dedupe pour éviter que
        // "Genève" et "Genève " (avec espace final) comptent comme 2 entrées.
        const c = row.city?.replace(/\s+/g, ' ').trim()
        if (c && !seen.has(c.toLowerCase())) {
          seen.add(c.toLowerCase())
          out.push(c)
          if (out.length >= 8) break
        }
      }
      return out
    },
    enabled: trimmed.length >= 2,
    staleTime: 5 * 60 * 1000,
  })
}

// ─── HOOK 1d : Médianes cantonales pour le badge "Bon prix" ─────────────────
//
// Tire le materialized view `cantonal_price_medians` (refresh quotidien via
// pg_cron 04:30 UTC, voir migration 20260515_001).
//
// La vue est petite (26 cantons × 2 tx × 8 types ≤ 416 rows), on tire tout
// d'un coup et on indexe en mémoire par clé `canton|tx|type`. staleTime 24h
// = même TTL que le refresh DB.
//
// Inspiré du Comparis Rating (seul à exposer un score d'opportunité prix en
// CH côté UX) — voir audit comparatif PR précédent.

export type CantonalMedian = {
  canton: string
  transaction_type: 'buy' | 'rent'
  type: string
  median_price_per_m2: number
  sample_size: number
}

export type CantonalMedianLookup = (params: {
  canton: string | null | undefined
  transaction_type: 'buy' | 'rent'
  type: string | null | undefined
}) => CantonalMedian | null

export function useCantonalMedians() {
  return useQuery<{ rows: CantonalMedian[]; lookup: CantonalMedianLookup }>({
    queryKey: ['cantonal-price-medians'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cantonal_price_medians')
        .select('canton, transaction_type, type, median_price_per_m2, sample_size')
      if (error) {
        // Non-fatal : si la matview n'existe pas encore (migration pas
        // appliquée) ou si la lecture échoue, on renvoie un lookup vide —
        // les cartes affichent juste pas le badge "Bon prix".
        return { rows: [], lookup: () => null }
      }
      const rows = (data as CantonalMedian[]) || []
      const index = new Map<string, CantonalMedian>()
      for (const r of rows) {
        index.set(`${r.canton}|${r.transaction_type}|${r.type}`, r)
      }
      const lookup: CantonalMedianLookup = ({ canton, transaction_type, type }) => {
        if (!canton || !type) return null
        return index.get(`${canton}|${transaction_type}|${type}`) ?? null
      }
      return { rows, lookup }
    },
    staleTime: 24 * 60 * 60 * 1000, // 24h — matche le refresh pg_cron
    gcTime: 24 * 60 * 60 * 1000,
  })
}

// Seuil "Bon prix" : prix/m² ≤ 85% de la médiane cantonale = sous le marché.
// Source : Idealista quality score & Comparis Rating tolérancent ~10-20%.
export const GOOD_DEAL_THRESHOLD = 0.85

export function isGoodDeal(
  pricePerM2: number | null | undefined,
  median: CantonalMedian | null,
): boolean {
  if (!pricePerM2 || pricePerM2 <= 0) return false
  if (!median || median.sample_size < 5) return false
  return pricePerM2 <= median.median_price_per_m2 * GOOD_DEAL_THRESHOLD
}

// ─── HOOK 2 : Points carte (léger, tous les biens avec lat/lng) ─────────────

// ─── Session cache ───
// Points change rarely (Flatfox sync is daily). Persist to sessionStorage so
// page refresh and same-tab navigation show pins instantly instead of waiting
// ~10s for the 33K-point RPC.
const MAP_POINTS_CACHE_TTL_MS = 10 * 60 * 1000 // 10 min

function readMapPointsCache(key: string): MapPoint[] | null {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const { t, v } = JSON.parse(raw) as { t: number; v: MapPoint[] }
    if (Date.now() - t > MAP_POINTS_CACHE_TTL_MS) return null
    return v
  } catch { return null }
}

function writeMapPointsCache(key: string, v: MapPoint[]) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), v }))
  } catch { /* quota exceeded — ignore */ }
}

export function useMapPoints(filters: MarketFilters = {}) {
  const cacheKey = `megga:map-points:${JSON.stringify(filters)}`
  return useQuery({
    queryKey: ['map-points', filters],
    // Hydrate instantly from sessionStorage — the query still runs in the
    // background to refresh, but the map paints its pins immediately.
    initialData: () => readMapPointsCache(cacheKey) ?? undefined,
    initialDataUpdatedAt: () => {
      try {
        const raw = sessionStorage.getItem(cacheKey)
        if (!raw) return undefined
        const { t } = JSON.parse(raw) as { t: number }
        return t
      } catch { return undefined }
    },
    queryFn: async (): Promise<MapPoint[]> => {
      // Single RPC call returns all points at once (bypasses REST 1000-row limit)
      const marketPromise = supabase.rpc('get_market_map_points', {
        p_context: filters.context || 'buy',
        p_types: filters.types && filters.types.length > 0 ? filters.types : undefined,
        p_canton: filters.canton || undefined,
        p_city: filters.city || undefined,
        p_min_price: filters.minPrice ?? undefined,
        p_max_price: filters.maxPrice ?? undefined,
        p_min_rooms: filters.minRooms ?? undefined,
        p_min_surface: filters.minSurface ?? undefined,
        p_features: filters.features && filters.features.length > 0 ? filters.features : undefined,
      })

      // Internal properties in parallel
      const internalPromise = supabase
        .from('properties')
        .select('id, lat, lng, price, type, rooms')
        .eq('status', 'active')
        .not('lat', 'is', null)
        .not('lng', 'is', null)

      const [{ data: marketData }, { data: internalData }] = await Promise.all([
        marketPromise,
        internalPromise,
      ])

      const allPoints: MapPoint[] = []

      if (marketData) {
        for (const d of marketData as Array<Record<string, unknown>>) {
          allPoints.push({
            id: `market-${d.id}`,
            lat: d.lat as number,
            lng: d.lng as number,
            price: Number(d.current_price ?? d.price ?? 0),
            type: (d.type as string) || 'apartment',
            rooms: Number(d.rooms) || 0,
            context: (d.transaction_type as 'buy' | 'rent') || 'buy',
          })
        }
      }

      if (internalData) {
        for (const p of internalData) {
          allPoints.push({
            id: `internal-${p.id}`,
            lat: p.lat as number,
            lng: p.lng as number,
            price: Number(p.price) || 0,
            type: (p.type as string) || 'apartment',
            rooms: Number(p.rooms) || 0,
            context: 'buy',
          })
        }
      }

      writeMapPointsCache(cacheKey, allPoints)
      return allPoints
    },
    staleTime: MAP_POINTS_CACHE_TTL_MS,
    placeholderData: keepPreviousData,
  })
}

// ─── HOOK 3 : Compteurs par canton (pour les filtres) ───────────────────────

export function useMarketStats(context: 'buy' | 'rent' = 'buy') {
  const statsKey = `megga:market-stats:${context}`
  type Stats = {
    totalCount: number
    cantonCounts: Array<{ canton: string; count: number }>
    typeCounts: Array<{ type: string; count: number }>
  }
  return useQuery<Stats>({
    queryKey: ['market-stats', context],
    initialData: () => {
      try {
        const raw = sessionStorage.getItem(statsKey)
        if (!raw) return undefined
        const parsed = JSON.parse(raw) as { t: number; v: Stats }
        if (Date.now() - parsed.t > 30 * 60 * 1000) return undefined
        return parsed.v
      } catch { return undefined }
    },
    initialDataUpdatedAt: () => {
      try {
        const raw = sessionStorage.getItem(statsKey)
        if (!raw) return undefined
        return (JSON.parse(raw) as { t: number }).t
      } catch { return undefined }
    },
    queryFn: async () => {
      // Comptage par canton
      const { data: cantonCounts } = await supabase
        .rpc('count_market_by_canton', { p_context: context })

      // Comptage par type
      const { data: typeCounts } = await supabase
        .rpc('count_market_by_type', { p_context: context })

      // Stats globales — use estimated count to avoid sequential scan timeout on 33K+ rows
      const { count: totalCount } = await supabase
        .from('market_listings')
        .select('id', { count: 'estimated', head: true })
        .eq('transaction_type', context)
        .eq('status', 'active')
        .gte('quality_score', 50)

      const result = {
        totalCount: totalCount ?? 0,
        cantonCounts: (cantonCounts as Array<{ canton: string; count: number }>) || [],
        typeCounts: (typeCounts as Array<{ type: string; count: number }>) || [],
      }
      try { sessionStorage.setItem(statsKey, JSON.stringify({ t: Date.now(), v: result })) } catch { /* quota */ }
      return result
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
  })
}

// ─── HOOK 4 : Détail d'un bien du marché ────────────────────────────────────

// ─── HOOK 5 : Villes par canton (pour le filtre localisation) ────────────

export function useCitiesByCanton(canton: string | undefined, context: 'buy' | 'rent' = 'buy') {
  return useQuery({
    queryKey: ['cities-by-canton', canton, context],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_cities_by_canton', { p_canton: canton!, p_context: context })
      if (error) throw error
      return (data as Array<{ city: string; count: number }>) || []
    },
    enabled: !!canton,
    staleTime: 30 * 60 * 1000,
  })
}

// ─── HOOK 6 : Détail d'un bien du marché ────────────────────────────────────

export function useMarketListing(id: string | undefined) {
  return useQuery({
    queryKey: ['market-listing', id],
    queryFn: async () => {
      if (!id) return null

      // NB: the previous embed 'agency_profile:agency_profile_id(...)' failed
      // with PGRST200 when PostgREST's schema cache didn't know about the FK
      // added in migration 20260416_006. We avoid the embed and instead run a
      // second lightweight query on agency_profiles once we have the FK id.
      const { data, error } = await supabase
        .from('market_listings')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error

      // Enrich with agency profile data (stored locally — survives Flatfox outage)
      if (data?.agency_profile_id) {
        const { data: agency } = await supabase
          .from('agency_profiles')
          .select('id, slug, name, logo_url, phone, email, website_url, address, city, canton, status, rating_avg, rating_count, description, founded_year, specialties, languages, certifications')
          .eq('id', data.agency_profile_id)
          .maybeSingle()
        if (agency) {
          ;(data as Record<string, unknown>).agency_profile = agency
        }
      }

      return data
    },
    enabled: !!id,
    staleTime: 10 * 60 * 1000,
  })
}
