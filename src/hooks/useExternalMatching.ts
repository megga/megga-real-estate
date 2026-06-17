import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface ExternalSearchCriteria {
  zone: string
  type: string
  budget_max: number
  budget_min?: number
  rooms_min?: number
}

export interface ExternalListing {
  external_id: string
  title: string
  price: number
  address: string
  city: string
  canton: string
  rooms: number | null
  surface_m2: number | null
  type: string
  photo_url: string | null
  photos: string[]
  source_url: string
  source_portal: string
  source_agency: string | null
  source_logo_url: string | null
  // Niveau 2 — champs enrichis
  description: string | null
  property_type_detail: string | null
  construction_year: number | null
  renovation_year: number | null
  bathrooms: number | null
  land_surface: number | null
  parking: number | null
  price_per_m2: number | null
  lat: number | null
  lng: number | null
  postcode: string | null
  agency_phone: string | null
  visit_contact: string | null
}

function hashCriteria(criteria: ExternalSearchCriteria): string {
  const normalized = JSON.stringify(criteria, Object.keys(criteria).sort())
  let hash = 0
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return `ext_${Math.abs(hash).toString(36)}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRowToListing(row: Record<string, any>): ExternalListing {
  const photos: string[] = Array.isArray(row.photos) ? row.photos : row.photo_url ? [row.photo_url] : []
  return {
    external_id: row.external_id ?? '',
    title: row.title ?? '',
    price: Number(row.price) || 0,
    address: row.address ?? '',
    city: row.city ?? '',
    canton: row.canton ?? '',
    rooms: row.rooms ? Number(row.rooms) : null,
    surface_m2: row.surface_m2 ? Number(row.surface_m2) : null,
    type: row.type ?? '',
    photo_url: photos[0] ?? null,
    photos,
    source_url: row.source_url,
    source_portal: row.source_portal ?? 'realadvisor',
    source_agency: row.source_agency ?? null,
    source_logo_url: row.source_logo_url ?? null,
    description: row.description ?? null,
    property_type_detail: row.property_type_detail ?? null,
    construction_year: row.construction_year ? Number(row.construction_year) : null,
    renovation_year: row.renovation_year ? Number(row.renovation_year) : null,
    bathrooms: row.bathrooms ? Number(row.bathrooms) : null,
    land_surface: row.land_surface ? Number(row.land_surface) : null,
    parking: row.parking ? Number(row.parking) : null,
    price_per_m2: row.price_per_m2 ? Number(row.price_per_m2) : null,
    lat: row.lat ? Number(row.lat) : null,
    lng: row.lng ? Number(row.lng) : null,
    postcode: row.postcode ?? null,
    agency_phone: row.agency_phone ?? null,
    visit_contact: row.visit_contact ?? null,
  }
}

async function fetchExternalListings(criteria: ExternalSearchCriteria): Promise<ExternalListing[]> {
  const searchHash = hashCriteria(criteria)

  // 1. Check cache first (gracefully handle missing table)
  try {
    const { data: cached, error: cacheError } = await supabase
      .from('external_listings')
      .select('*')
      .eq('search_hash', searchHash)
      .gt('expires_at', new Date().toISOString())
      .order('price', { ascending: true })

    if (!cacheError && cached && cached.length > 0) {
      return cached.map((row) => mapRowToListing(row))
    }
  } catch {
    // Cache miss or table not available — proceed to Edge Function
  }

  // 2. No cache → call Edge Function directly via fetch (works without auth)
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

  const response = await fetch(`${supabaseUrl}/functions/v1/external-matching`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify(criteria),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `Edge Function returned ${response.status}`)
  }

  const data = await response.json()
  const rawListings: Record<string, unknown>[] = data?.listings || []
  const listings: ExternalListing[] = rawListings.map(mapRowToListing)

  // 3. Cache results if we have any and user is authenticated
  if (listings.length > 0) {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_id')
        .single()

      if (profile?.agency_id) {
        const rows = listings.map((l) => ({
          agency_id: profile.agency_id,
          search_hash: searchHash,
          external_id: l.external_id,
          title: l.title,
          price: l.price,
          address: l.address,
          city: l.city,
          canton: l.canton,
          rooms: l.rooms,
          surface_m2: l.surface_m2,
          type: l.type,
          photo_url: l.photo_url,
          source_url: l.source_url,
          source_portal: l.source_portal,
          source_agency: l.source_agency,
          source_logo_url: l.source_logo_url,
        }))

        // Fire and forget — don't block on cache write, but surface failures.
        supabase.from('external_listings').insert(rows).then(({ error }) => {
          if (error) console.error('[useExternalMatching] cache write failed:', error.message)
        })
      }
    } catch {
      // Cache write failed (no auth) — silently ignore
    }
  }

  return listings
}

export function useExternalMatching(criteria: ExternalSearchCriteria | null) {
  return useQuery({
    queryKey: ['external-matching', criteria],
    queryFn: () => fetchExternalListings(criteria!),
    enabled: !!criteria && !!criteria.zone && !!criteria.budget_max,
    staleTime: 1000 * 60 * 30, // 30 minutes
    retry: 1,
  })
}
