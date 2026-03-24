import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ListingCardData } from '@/components/listings/ListingCard'

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
  minSurface?: number
  maxSurface?: number
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'newest' | 'surface_desc'
  q?: string
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

const PAGE_SIZE = 50

// ─── HELPERS ────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFilters(query: any, filters: MarketFilters) {
  let q = query.in('status', ['active', 'price_reduced'])
  q = q.eq('transaction_type', filters.context || 'buy')
  q = q.gt('price', 0) // Exclure les biens sans prix (prix sur demande)
  q = q.gte('quality_score', 50) // Exclure les biens suspects (contrôle qualité)
  if (filters.types && filters.types.length > 0) q = q.in('type', filters.types)
  if (filters.canton) q = q.eq('canton', filters.canton)
  if (filters.city) q = q.ilike('city', `%${filters.city}%`)
  if (filters.minPrice) q = q.gte('price', filters.minPrice)
  if (filters.maxPrice) q = q.lte('price', filters.maxPrice)
  if (filters.minRooms) q = q.gte('rooms', filters.minRooms)
  if (filters.maxRooms) q = q.lte('rooms', filters.maxRooms)
  if (filters.minBedrooms) q = q.gte('bedrooms', filters.minBedrooms)
  if (filters.minSurface) q = q.gte('surface_m2', filters.minSurface)
  if (filters.maxSurface) q = q.lte('surface_m2', filters.maxSurface)
  if (filters.q) {
    q = q.or(`title.ilike.%${filters.q}%,city.ilike.%${filters.q}%,address.ilike.%${filters.q}%,canton.ilike.%${filters.q}%`)
  }
  return q
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applySorting(query: any, sort: MarketFilters['sort']) {
  switch (sort) {
    case 'price_asc': return query.order('price', { ascending: true, nullsFirst: false })
    case 'price_desc': return query.order('price', { ascending: false, nullsFirst: false })
    case 'newest': return query.order('first_seen_at', { ascending: false })
    case 'surface_desc': return query.order('surface_m2', { ascending: false, nullsFirst: false })
    default: return query.order('created_at', { ascending: false })
  }
}

function transformToCardData(
  ml: Record<string, unknown>,
  source: 'market' | 'internal' = 'market'
): ListingCardData {
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
      context: 'buy',
      description: (ml.description as string) || '',
      canton: (ml.canton as string) || '',
      published_at: (ml.published_at as string) || (ml.created_at as string),
      lat: ml.lat as number | undefined,
      lng: ml.lng as number | undefined,
      is_exclusive: true,
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
    context: 'buy',
    description: (ml.description as string) || '',
    canton: (ml.canton as string) || '',
    published_at: (ml.first_seen_at as string) || (ml.created_at as string),
    lat: ml.lat as number | undefined,
    lng: ml.lng as number | undefined,
    is_hot: ml.status === 'price_reduced',
    source_portal: ml.source_portal as string | undefined,
    source_url: ml.source_url as string | undefined,
    agency_name: ml.agency_name as string | undefined,
    price_per_m2: ml.price_per_m2 as number | undefined,
    days_on_market: ml.days_on_market as number | undefined,
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
      let marketQuery = supabase
        .from('market_listings')
        .select(
          'id, title, price, current_price, address, city, canton, postal_code, rooms, bedrooms, surface_m2, photos, type, description, lat, lng, source_portal, source_url, agency_name, price_per_m2, days_on_market, status, first_seen_at, created_at',
          { count: 'exact' }
        )

      marketQuery = applyFilters(marketQuery, filters)
      marketQuery = applySorting(marketQuery, filters.sort)
      marketQuery = marketQuery.range(from, to)

      const { data: marketData, count } = await marketQuery

      const listings: ListingCardData[] = []

      // Ajouter les biens internes en première page uniquement
      if (pageParam === 0) {
        let internalQuery = supabase
          .from('properties')
          .select(
            'id, title, price, address, city, canton, postal_code, rooms, bedrooms, surface_m2, photos, type, description, lat, lng, created_at, published_at'
          )
          .eq('status', 'active')

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
          .limit(50)

        const { data: internalData } = await internalQuery
        if (internalData) {
          for (const p of internalData) {
            listings.push(transformToCardData(p, 'internal'))
          }
        }
      }

      // Ajouter les biens du marché
      if (marketData) {
        for (const ml of marketData) {
          listings.push(transformToCardData(ml, 'market'))
        }
      }

      const totalCount = (count ?? 0) + (pageParam === 0 ? listings.filter(l => l.id.startsWith('internal-')).length : 0)
      const hasMore = marketData ? marketData.length === PAGE_SIZE : false

      return {
        listings,
        nextPage: hasMore ? pageParam + 1 : null,
        totalCount,
      }
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// ─── HOOK 2 : Points carte (léger, tous les biens avec lat/lng) ─────────────

export function useMapPoints(filters: MarketFilters = {}) {
  return useQuery({
    queryKey: ['map-points', filters],
    queryFn: async (): Promise<MapPoint[]> => {
      // Charger uniquement les coordonnées + prix pour la carte
      // Beaucoup plus léger que les données complètes
      let query = supabase
        .from('market_listings')
        .select('id, lat, lng, price, current_price, type, rooms, transaction_type')
        .in('status', ['active', 'price_reduced'])
        .not('lat', 'is', null)
        .not('lng', 'is', null)

      if (filters.context) {
        query = query.eq('transaction_type', filters.context)
      } else {
        query = query.eq('transaction_type', 'buy')
      }

      if (filters.types && filters.types.length > 0) {
        query = query.in('type', filters.types)
      }

      if (filters.canton) {
        query = query.eq('canton', filters.canton)
      }

      if (filters.city) {
        query = query.ilike('city', `%${filters.city}%`)
      }

      if (filters.minPrice) {
        query = query.gte('price', filters.minPrice)
      }

      if (filters.maxPrice) {
        query = query.lte('price', filters.maxPrice)
      }

      if (filters.minRooms) {
        query = query.gte('rooms', filters.minRooms)
      }

      if (filters.minSurface) {
        query = query.gte('surface_m2', filters.minSurface)
      }

      // Supabase limit max = 1000 par requête, on doit paginer
      // IMPORTANT: recréer la query à chaque itération car .range() mute l'objet
      const allPoints: MapPoint[] = []
      let page = 0
      const batchSize = 1000
      let hasMore = true

      const buildQuery = () => {
        let q = supabase
          .from('market_listings')
          .select('id, lat, lng, price, current_price, type, rooms, transaction_type')
          .in('status', ['active', 'price_reduced'])
          .not('lat', 'is', null)
          .not('lng', 'is', null)
          .gt('price', 0)
          .gte('quality_score', 50)
          .eq('transaction_type', filters.context || 'buy')
        if (filters.types && filters.types.length > 0) q = q.in('type', filters.types)
        if (filters.canton) q = q.eq('canton', filters.canton)
        if (filters.city) q = q.ilike('city', `%${filters.city}%`)
        if (filters.minPrice) q = q.gte('price', filters.minPrice)
        if (filters.maxPrice) q = q.lte('price', filters.maxPrice)
        if (filters.minRooms) q = q.gte('rooms', filters.minRooms)
        if (filters.minSurface) q = q.gte('surface_m2', filters.minSurface)
        return q
      }

      while (hasMore) {
        const from = page * batchSize
        const to = from + batchSize - 1

        const { data } = await buildQuery().range(from, to)

        if (data && data.length > 0) {
          for (const d of data) {
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
          hasMore = data.length === batchSize
          page++
        } else {
          hasMore = false
        }
      }

      // Ajouter aussi les biens internes avec coordonnées
      const { data: internalData } = await supabase
        .from('properties')
        .select('id, lat, lng, price, type, rooms')
        .eq('status', 'active')
        .not('lat', 'is', null)
        .not('lng', 'is', null)

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

      // Stats globales
      const { count: totalCount } = await supabase
        .from('market_listings')
        .select('id', { count: 'exact', head: true })
        .eq('transaction_type', context)
        .in('status', ['active', 'price_reduced'])

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

export function useMarketListing(id: string | undefined) {
  return useQuery({
    queryKey: ['market-listing', id],
    queryFn: async () => {
      if (!id) return null

      const { data, error } = await supabase
        .from('market_listings')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      return data
    },
    enabled: !!id,
    staleTime: 10 * 60 * 1000,
  })
}
