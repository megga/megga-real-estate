import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ListingCardData } from '@/components/listings/ListingCard'

/**
 * Fetches all public listings: internal properties (active) + market_listings (active).
 * Returns unified ListingCardData[] for the public SearchPage.
 * No authentication required — uses anon key.
 */
export function usePublicListings() {
  return useQuery({
    queryKey: ['public-listings'],
    queryFn: async (): Promise<ListingCardData[]> => {
      const results: ListingCardData[] = []

      // ── 1. Internal properties (published by MEGGA agencies) ──
      const { data: properties } = await supabase
        .from('properties')
        .select('id, title, price, address, city, canton, postal_code, rooms, bedrooms, surface_m2, photos, type, description, lat, lng, created_at, published_at')
        .eq('status', 'active')
        .order('published_at', { ascending: false })
        .limit(500)

      if (properties) {
        for (const p of properties) {
          results.push({
            id: `internal-${p.id}`,
            title: p.title || 'Bien immobilier',
            price: Number(p.price) || 0,
            address: p.address || '',
            city: p.city || '',
            rooms: Number(p.rooms) || 0,
            bedrooms: p.bedrooms || 0,
            surface_m2: Number(p.surface_m2) || 0,
            photos: p.photos || [],
            type: p.type || 'apartment',
            context: 'buy',
            description: p.description || '',
            canton: p.canton || '',
            published_at: p.published_at || p.created_at,
            lat: p.lat,
            lng: p.lng,
            is_exclusive: true, // Internal = MEGGA exclusive
          })
        }
      }

      // ── 2. Market listings (from RealAdvisor scan) ──
      const { data: marketListings } = await supabase
        .from('market_listings')
        .select('id, title, price, current_price, address, city, canton, postal_code, rooms, bedrooms, surface_m2, photos, type, description, lat, lng, source_portal, source_url, agency_name, price_per_m2, days_on_market, status, first_seen_at, created_at')
        .in('status', ['active', 'price_reduced'])
        .order('created_at', { ascending: false })
        .limit(5000)

      if (marketListings) {
        for (const ml of marketListings) {
          results.push({
            id: `market-${ml.id}`,
            title: ml.title || 'Bien immobilier',
            price: Number(ml.current_price ?? ml.price ?? 0),
            address: ml.address || '',
            city: ml.city || '',
            rooms: Number(ml.rooms) || 0,
            bedrooms: ml.bedrooms || 0,
            surface_m2: Number(ml.surface_m2) || 0,
            photos: ml.photos || [],
            type: ml.type || 'apartment',
            context: 'buy',
            description: ml.description || '',
            canton: ml.canton || '',
            published_at: ml.first_seen_at || ml.created_at,
            lat: ml.lat,
            lng: ml.lng,
            is_hot: ml.status === 'price_reduced',
          })
        }
      }

      return results
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}
