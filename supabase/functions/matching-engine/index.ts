import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Scoring Engine (100 points, no LLM) ─────────────────────────────────────

interface ClientSearchCriteria {
  budget_min?: number
  budget_max?: number
  zones?: string[]
  type?: string
  rooms_min?: number
  rooms_max?: number
  surface_min?: number
  surface_max?: number
  features?: string[]
}

interface Property {
  id: string
  agency_id: string
  type: string
  status: string
  price: number
  rooms: number
  surface_m2: number
  city: string
  canton: string
  features: string[] | null
}

interface ClientSearch {
  id: string
  agency_id: string
  contact_id: string
  criteria: ClientSearchCriteria
  is_active: boolean
}

interface MatchReason {
  budget: boolean
  zone: boolean
  type: boolean
  rooms_surface: boolean
  features: boolean
  budget_score: number
  zone_score: number
  type_score: number
  rooms_surface_score: number
  features_score: number
}

function scoreBudget(price: number, budgetMin?: number, budgetMax?: number): number {
  if (!budgetMin && !budgetMax) return 15 // No budget constraint → partial score
  const min = budgetMin || 0
  const max = budgetMax || Infinity

  if (price >= min && price <= max) return 30
  if (price > max) {
    const overRatio = price / max
    if (overRatio <= 1.15) return Math.max(5, Math.round(30 * (1 - (overRatio - 1) / 0.15)))
    return 0
  }
  // Under budget
  if (price >= min * 0.7) return 20
  return 0
}

function scoreZone(city: string, canton: string, zones?: string[]): number {
  if (!zones || zones.length === 0) return 12 // No zone constraint → partial score
  const normalizedCity = city.toLowerCase()
  const normalizedCanton = canton.toLowerCase()

  for (const zone of zones) {
    const z = zone.toLowerCase()
    if (z === normalizedCity) return 25
    if (z === normalizedCanton) return 15
    // Partial match (e.g. "genève" matches "ge")
    if (normalizedCanton === 'ge' && z.includes('genèv')) return 20
    if (normalizedCanton === 'vd' && z.includes('lausann')) return 20
  }
  return 0
}

function scoreType(propertyType: string, searchType?: string): number {
  if (!searchType) return 7 // No type constraint → partial score
  const normalized = searchType.toLowerCase()
  const propNorm = propertyType.toLowerCase()

  if (propNorm === normalized) return 15
  // Villa ≈ house
  if ((propNorm === 'villa' && normalized === 'house') || (propNorm === 'house' && normalized === 'villa')) return 10
  if ((propNorm === 'villa' && normalized === 'maison') || (propNorm === 'house' && normalized === 'maison')) return 10
  if ((propNorm === 'apartment' && normalized === 'appartement')) return 15
  return 0
}

function scoreRoomsSurface(
  rooms: number,
  surfaceM2: number,
  roomsMin?: number,
  roomsMax?: number,
  surfaceMin?: number,
  surfaceMax?: number,
): number {
  let s = 0

  if (roomsMin != null) {
    if (rooms >= roomsMin) s += 4
    else if (rooms === roomsMin - 1) s += 2
  } else {
    s += 2
  }

  if (roomsMax != null) {
    if (rooms <= roomsMax) s += 4
    else if (rooms === roomsMax + 1) s += 2
  } else {
    s += 2
  }

  if (surfaceMin != null) {
    if (surfaceM2 >= surfaceMin) s += 4
    else if (surfaceM2 >= surfaceMin * 0.9) s += 2
  } else {
    s += 2
  }

  if (surfaceMax != null && surfaceM2 <= surfaceMax) {
    s += 3
  } else if (surfaceMax == null) {
    s += 2
  }

  return Math.min(15, s)
}

function scoreFeatures(propertyFeatures: string[] | null, searchFeatures?: string[]): number {
  if (!searchFeatures || searchFeatures.length === 0) return 7 // No constraint → partial
  if (!propertyFeatures || propertyFeatures.length === 0) return 0

  const propSet = new Set(propertyFeatures.map((f) => f.toLowerCase()))
  let matched = 0
  for (const sf of searchFeatures) {
    if (propSet.has(sf.toLowerCase())) matched++
  }

  if (searchFeatures.length === 0) return 7
  return Math.min(15, Math.round((matched / searchFeatures.length) * 15))
}

function calculateScore(
  property: Property,
  search: ClientSearch,
): { score: number; reasons: MatchReason } {
  const c = search.criteria

  const budgetScore = scoreBudget(property.price, c.budget_min, c.budget_max)
  const zoneScore = scoreZone(property.city, property.canton, c.zones)
  const typeScore = scoreType(property.type, c.type)
  const roomsSurfaceScore = scoreRoomsSurface(
    property.rooms, property.surface_m2,
    c.rooms_min, c.rooms_max, c.surface_min, c.surface_max,
  )
  const featuresScore = scoreFeatures(property.features, c.features)

  const score = budgetScore + zoneScore + typeScore + roomsSurfaceScore + featuresScore

  return {
    score,
    reasons: {
      budget: budgetScore >= 20,
      zone: zoneScore >= 15,
      type: typeScore >= 10,
      rooms_surface: roomsSurfaceScore >= 8,
      features: featuresScore >= 8,
      budget_score: budgetScore,
      zone_score: zoneScore,
      type_score: typeScore,
      rooms_surface_score: roomsSurfaceScore,
      features_score: featuresScore,
    },
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Also create a client with the user's auth token for RLS-scoped queries
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const body = await req.json()
    const { trigger, property_id, contact_id, agency_id } = body as {
      trigger: 'new_property' | 'new_search' | 'daily'
      property_id?: string
      contact_id?: string
      agency_id: string
    }

    if (!agency_id) {
      return new Response(JSON.stringify({ error: 'agency_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch properties
    let propertiesQuery = supabase
      .from('properties')
      .select('id, agency_id, type, status, price, rooms, surface_m2, city, canton, features')
      .eq('agency_id', agency_id)
      .eq('status', 'active')

    if (trigger === 'new_property' && property_id) {
      propertiesQuery = supabase
        .from('properties')
        .select('id, agency_id, type, status, price, rooms, surface_m2, city, canton, features')
        .eq('id', property_id)
        .eq('status', 'active')
    }

    const { data: properties, error: propError } = await propertiesQuery
    if (propError) throw propError

    // Fetch active client_searches
    let searchesQuery = supabase
      .from('client_searches')
      .select('id, agency_id, contact_id, criteria, is_active')
      .eq('agency_id', agency_id)
      .eq('is_active', true)

    if (trigger === 'new_search' && contact_id) {
      searchesQuery = supabase
        .from('client_searches')
        .select('id, agency_id, contact_id, criteria, is_active')
        .eq('contact_id', contact_id)
        .eq('is_active', true)
    }

    const { data: searches, error: searchError } = await searchesQuery
    if (searchError) throw searchError

    if (!properties?.length || !searches?.length) {
      return new Response(JSON.stringify({ matches_created: 0, matches: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch existing matches to avoid duplicates
    const { data: existingMatches } = await supabase
      .from('matches')
      .select('contact_id, property_id')
      .eq('agency_id', agency_id)
      .in('status', ['suggested', 'sent', 'visit_planned', 'interested'])

    const existingSet = new Set(
      (existingMatches || []).map((m: { contact_id: string; property_id: string }) => `${m.contact_id}-${m.property_id}`),
    )

    // Calculate matches
    const newMatches: Array<{
      agency_id: string
      contact_id: string
      property_id: string
      client_search_id: string
      score: number
      reasons: MatchReason
      status: string
    }> = []

    for (const search of searches as ClientSearch[]) {
      for (const property of properties as Property[]) {
        // Skip if already matched
        const key = `${search.contact_id}-${property.id}`
        if (existingSet.has(key)) continue

        const { score, reasons } = calculateScore(property, search)

        if (score >= 60) {
          newMatches.push({
            agency_id,
            contact_id: search.contact_id,
            property_id: property.id,
            client_search_id: search.id,
            score,
            reasons: reasons as unknown as MatchReason,
            status: 'suggested',
          })
        }
      }
    }

    // Insert new matches
    let insertedMatches: Array<Record<string, unknown>> = []
    if (newMatches.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from('matches')
        .insert(newMatches)
        .select()

      if (insertError) throw insertError
      insertedMatches = inserted || []

      // Audit trail — toute action IA loggée avec actor_id = 'ai'
      for (const match of insertedMatches) {
        await supabase.from('activity_events').insert({
          agency_id,
          actor_id: 'ai',
          action: 'match_suggested',
          entity_type: 'match',
          entity_id: match.id,
          metadata: {
            contact_id: match.contact_id,
            property_id: match.property_id,
            score: match.score,
            trigger,
          },
        })
      }

      // Update last_matched_at on client_searches that had matches
      const searchIdsWithMatches = [...new Set(newMatches.map((m) => m.client_search_id))]
      if (searchIdsWithMatches.length > 0) {
        await supabase
          .from('client_searches')
          .update({ last_matched_at: new Date().toISOString() })
          .in('id', searchIdsWithMatches)
      }
    }

    return new Response(
      JSON.stringify({
        matches_created: insertedMatches.length,
        matches: insertedMatches,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
