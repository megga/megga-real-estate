import { useQuery, useInfiniteQuery, keepPreviousData } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ListingCardData } from '@/components/listings/ListingCard'
// applyPlaceholders removed — was replacing real Flatfox data (photos,
// titles, addresses, agencies) with fake Unsplash/demo content.
import type { PostgrestFilterBuilder } from '@supabase/postgrest-js'

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

const PAGE_SIZE = 20

// ─── HELPERS ────────────────────────────────────────────────────────────────

// Supabase query builder type after .select() — constrains to PostgrestFilterBuilder chain
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MarketListingsQuery = PostgrestFilterBuilder<any, any, any, any>

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
  if (filters.q) {
    q = q.or(`title.ilike.%${filters.q}%,city.ilike.%${filters.q}%,address.ilike.%${filters.q}%,canton.ilike.%${filters.q}%`)
  }
  return q
}

function applySorting<Q extends MarketListingsQuery>(query: Q, sort: MarketFilters['sort']): Q {
  switch (sort) {
    case 'price_asc': return query.order('price', { ascending: true, nullsFirst: false })
    case 'price_desc': return query.order('price', { ascending: false, nullsFirst: false })
    case 'newest': return query.order('first_seen_at', { ascending: false })
    case 'surface_desc': return query.order('surface_m2', { ascending: false, nullsFirst: false })
    case 'best_deals': return query.order('price_per_m2', { ascending: true, nullsFirst: false })
    case 'recommended': return query.order('created_at', { ascending: false }) // client-side re-sort
    default: return query.order('created_at', { ascending: false })
  }
}

function transformToCardData(
  ml: Record<string, unknown>,
  source: 'market' | 'internal' = 'market'
): ListingCardData {
  const txType = (ml.transaction_type as 'buy' | 'rent') || 'buy'
  const isFurnished = !!ml.is_furnished
  const depositMonths = (ml.deposit_months as number | null | undefined) ?? null
  const externalRegie = (ml.external_regie as { name?: string; phone?: string; email?: string; website?: string } | null) ?? null

  if (source === 'internal') {
    return {
      id: `internal-${ml.id}`,
      title: (ml.title as string) || 'Bien immobilier',
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
    }
  }

  return {
    id: `market-${ml.id}`,
    title: (ml.title as string) || 'Bien immobilier',
    price: Number(ml.current_price ?? ml.price ?? 0),
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
  return useInfiniteQuery({
    queryKey: ['market-listings', filters],
    queryFn: async ({ pageParam = 0 }): Promise<{
      listings: ListingCardData[]
      nextPage: number | null
      totalCount: number
    }> => {
      const from = pageParam * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      // ── Market listings ──
      // Light SELECT: exclude `description` (heavy text, loaded on detail page
      // only) to avoid statement timeout on 33K+ rows. Photos kept as needed
      // for cards, but limited server-side isn't possible so we handle in transform.
      let marketQuery = supabase
        .from('market_listings')
        .select(
          'id, title, price, current_price, price_at_first_seen, address, city, canton, postal_code, rooms, bedrooms, surface_m2, photos, type, lat, lng, source_portal, source_url, agency_name, agency_logo_url, price_per_m2, days_on_market, status, first_seen_at, created_at, transaction_type, is_furnished, deposit_months, charges_monthly, external_regie'
        )

      marketQuery = applyFilters(marketQuery, filters)
      marketQuery = applySorting(marketQuery, filters.sort)
      marketQuery = marketQuery.range(from, to)

      const { data: marketData } = await marketQuery

      const listings: ListingCardData[] = []

      // Ajouter les biens internes en première page uniquement
      if (pageParam === 0) {
        let internalQuery = supabase
          .from('properties')
          .select(
            'id, title, price, address, city, canton, postal_code, rooms, bedrooms, surface_m2, photos, type, description, lat, lng, created_at, published_at, transaction_type'
          )
          .eq('status', 'active')

        // Filter by transaction_type so BUY properties don't appear on /louer
        // and RENT properties don't appear on /acheter
        if (filters.context) {
          internalQuery = internalQuery.eq('transaction_type', filters.context)
        }

        if (filters.types && filters.types.length > 0) {
          internalQuery = internalQuery.in('type', filters.types)
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

        const { data: internalData } = await internalQuery
        if (internalData) {
          for (let i = 0; i < internalData.length; i++) {
            listings.push(transformToCardData(internalData[i], 'internal'))
          }
        }
      }

      // Ajouter les biens du marché
      if (marketData) {
        for (let i = 0; i < marketData.length; i++) {
          listings.push(transformToCardData(marketData[i], 'market'))
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

// ─── HOOK 2 : Points carte (léger, tous les biens avec lat/lng) ─────────────

export function useMapPoints(filters: MarketFilters = {}) {
  return useQuery({
    queryKey: ['map-points', filters],
    queryFn: async (): Promise<MapPoint[]> => {
      // Single RPC call returns all points at once (bypasses REST 1000-row limit)
      const marketPromise = supabase.rpc('get_market_map_points', {
        p_context: filters.context || 'buy',
        p_types: filters.types && filters.types.length > 0 ? filters.types : null,
        p_canton: filters.canton || null,
        p_city: filters.city || null,
        p_min_price: filters.minPrice ?? null,
        p_max_price: filters.maxPrice ?? null,
        p_min_rooms: filters.minRooms ?? null,
        p_min_surface: filters.minSurface ?? null,
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

      return allPoints
    },
    staleTime: 10 * 60 * 1000, // 10 minutes — les points changent rarement
    placeholderData: keepPreviousData, // keep old points visible during refetch
  })
}

// ─── HOOK 3 : Compteurs par canton (pour les filtres) ───────────────────────

export function useMarketStats(context: 'buy' | 'rent' = 'buy') {
  return useQuery({
    queryKey: ['market-stats', context],
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

      return {
        totalCount: totalCount ?? 0,
        cantonCounts: (cantonCounts as Array<{ canton: string; count: number }>) || [],
        typeCounts: (typeCounts as Array<{ type: string; count: number }>) || [],
      }
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

      const { data, error } = await supabase
        .from('market_listings')
        .select('*, agency_profile:agency_profile_id(slug, status)')
        .eq('id', id)
        .single()

      if (error) throw error
      return data
    },
    enabled: !!id,
    staleTime: 10 * 60 * 1000,
  })
}
