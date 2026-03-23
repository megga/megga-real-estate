import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Scoring Engine v2 (100 pts + bonus, no LLM) ─────────────────────────────
// Niveau 1: Must-have / nice-to-have + pondération dynamique
// Niveau 2: Scoring géospatial (Haversine)
// Niveau 3: Decay temporel (fraîcheur du bien)

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
  // Niveau 1 — Must-have / nice-to-have
  must_have?: string[]
  nice_to_have?: string[]
  // Niveau 2 — Géospatial : centre de recherche
  center_lat?: number
  center_lng?: number
  radius_km?: number
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
  // Niveau 2
  lat: number | null
  lng: number | null
  // Niveau 3
  published_at: string | null
  created_at: string
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
  // Niveau 1
  must_have_met: boolean
  must_have_missing: string[]
  nice_to_have_matched: string[]
  // Niveau 2
  distance_km: number | null
  // Niveau 3
  freshness_decay: number
  days_on_market: number
}

// ── Niveau 2 — Haversine distance (km) ──────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── Centres géographiques des villes/cantons suisses ─────────────────────────

const ZONE_CENTERS: Record<string, { lat: number; lng: number }> = {
  // Cantons
  'ge': { lat: 46.2044, lng: 6.1432 },
  'vd': { lat: 46.5197, lng: 6.6323 },
  'vs': { lat: 46.2330, lng: 7.3607 },
  'ne': { lat: 46.9900, lng: 6.9293 },
  'fr': { lat: 46.8065, lng: 7.1620 },
  'be': { lat: 46.9480, lng: 7.4474 },
  'zh': { lat: 47.3769, lng: 8.5417 },
  'bs': { lat: 47.5596, lng: 7.5886 },
  'lu': { lat: 47.0502, lng: 8.3093 },
  'ti': { lat: 46.0037, lng: 8.9511 },
  'sg': { lat: 47.4245, lng: 9.3767 },
  'ag': { lat: 47.3913, lng: 8.0455 },
  'so': { lat: 47.2088, lng: 7.5323 },
  'bl': { lat: 47.4855, lng: 7.7271 },
  'tg': { lat: 47.5536, lng: 9.0727 },
  'gr': { lat: 46.8508, lng: 9.5320 },
  'zg': { lat: 47.1724, lng: 8.5177 },
  'sz': { lat: 47.0207, lng: 8.6530 },
  'sh': { lat: 47.6960, lng: 8.6340 },
  'ju': { lat: 47.3667, lng: 7.3500 },
  'ar': { lat: 47.3831, lng: 9.2787 },
  'ai': { lat: 47.3317, lng: 9.4099 },
  'nw': { lat: 46.9579, lng: 8.3652 },
  'ow': { lat: 46.8737, lng: 8.2464 },
  'ur': { lat: 46.8803, lng: 8.6440 },
  'gl': { lat: 47.0411, lng: 9.0680 },
  // Villes principales
  'genève': { lat: 46.2044, lng: 6.1432 },
  'lausanne': { lat: 46.5197, lng: 6.6323 },
  'zürich': { lat: 47.3769, lng: 8.5417 },
  'zurich': { lat: 47.3769, lng: 8.5417 },
  'berne': { lat: 46.9480, lng: 7.4474 },
  'bern': { lat: 46.9480, lng: 7.4474 },
  'bâle': { lat: 47.5596, lng: 7.5886 },
  'basel': { lat: 47.5596, lng: 7.5886 },
  'lucerne': { lat: 47.0502, lng: 8.3093 },
  'luzern': { lat: 47.0502, lng: 8.3093 },
  'lugano': { lat: 46.0037, lng: 8.9511 },
  'fribourg': { lat: 46.8065, lng: 7.1620 },
  'neuchâtel': { lat: 46.9900, lng: 6.9293 },
  'sion': { lat: 46.2330, lng: 7.3607 },
  'montreux': { lat: 46.4312, lng: 6.9107 },
  'nyon': { lat: 46.3833, lng: 6.2396 },
  'morges': { lat: 46.5117, lng: 6.4985 },
  'vevey': { lat: 46.4628, lng: 6.8432 },
  'carouge': { lat: 46.1839, lng: 6.1390 },
  'lancy': { lat: 46.1833, lng: 6.1167 },
  'meyrin': { lat: 46.2333, lng: 6.0833 },
  'vernier': { lat: 46.2167, lng: 6.0833 },
  'onex': { lat: 46.1833, lng: 6.1000 },
  'thônex': { lat: 46.2167, lng: 6.2000 },
  'cologny': { lat: 46.2167, lng: 6.1833 },
  'vandoeuvres': { lat: 46.2167, lng: 6.2167 },
  'chêne-bourg': { lat: 46.2000, lng: 6.1833 },
  'plan-les-ouates': { lat: 46.1667, lng: 6.1167 },
}

function getZoneCenter(zone: string): { lat: number; lng: number } | null {
  return ZONE_CENTERS[zone.toLowerCase()] || null
}

// ── Niveau 3 — Decay temporel ───────────────────────────────────────────────

function calculateDecay(publishedAt: string | null, createdAt: string): { decay: number; daysOnMarket: number } {
  const refDate = publishedAt || createdAt
  const daysOnMarket = Math.max(0, Math.floor((Date.now() - new Date(refDate).getTime()) / 86400000))

  // Decay : 1.0 pour un bien neuf, 0.7 minimum après 180 jours
  // Formule douce : decay = max(0.7, 1.0 - (jours / 600))
  const decay = Math.max(0.7, 1.0 - (daysOnMarket / 600))
  return { decay, daysOnMarket }
}

// ── Score Budget (30 pts) ────────────────────────────────────────────────────

function scoreBudget(price: number, budgetMin?: number, budgetMax?: number): number {
  if (!budgetMin && !budgetMax) return 15
  const min = budgetMin || 0
  const max = budgetMax || Infinity

  if (price >= min && price <= max) return 30
  if (price > max) {
    const overRatio = price / max
    if (overRatio <= 1.15) return Math.max(5, Math.round(30 * (1 - (overRatio - 1) / 0.15)))
    return 0
  }
  if (price >= min * 0.7) return 20
  return 0
}

// ── Score Zone (25 pts) — Niveau 2 : géospatial si lat/lng disponibles ──────

function scoreZone(
  city: string,
  canton: string,
  zones?: string[],
  propertyLat?: number | null,
  propertyLng?: number | null,
  centerLat?: number,
  centerLng?: number,
  radiusKm?: number,
): { score: number; distanceKm: number | null } {
  // Si on a les coordonnées du bien ET un centre de recherche → géospatial
  if (propertyLat && propertyLng && centerLat && centerLng) {
    const distance = haversineKm(propertyLat, propertyLng, centerLat, centerLng)
    const maxRadius = radiusKm || 10
    if (distance <= maxRadius * 0.5) return { score: 25, distanceKm: Math.round(distance * 10) / 10 }
    if (distance <= maxRadius) return { score: 20, distanceKm: Math.round(distance * 10) / 10 }
    if (distance <= maxRadius * 1.5) return { score: 10, distanceKm: Math.round(distance * 10) / 10 }
    return { score: 0, distanceKm: Math.round(distance * 10) / 10 }
  }

  // Sinon, si le bien a des coords ET on a des zones → calculer la distance au centre de zone le plus proche
  if (propertyLat && propertyLng && zones && zones.length > 0) {
    let bestScore = 0
    let bestDistance: number | null = null

    for (const zone of zones) {
      const center = getZoneCenter(zone)
      if (center) {
        const distance = haversineKm(propertyLat, propertyLng, center.lat, center.lng)
        const d = Math.round(distance * 10) / 10
        // Scoring progressif : 0-3km = 25pts, 3-8km = 20pts, 8-15km = 12pts, 15-25km = 5pts
        let s = 0
        if (distance <= 3) s = 25
        else if (distance <= 8) s = Math.round(25 - (distance - 3) * 1)
        else if (distance <= 15) s = Math.round(20 - (distance - 8) * 1.14)
        else if (distance <= 25) s = Math.round(12 - (distance - 15) * 0.7)
        else s = 0

        if (s > bestScore) {
          bestScore = s
          bestDistance = d
        }
      }
    }

    if (bestScore > 0) return { score: bestScore, distanceKm: bestDistance }
  }

  // Fallback : matching textuel classique (ville/canton)
  if (!zones || zones.length === 0) return { score: 12, distanceKm: null }
  const normalizedCity = city.toLowerCase()
  const normalizedCanton = canton.toLowerCase()

  for (const zone of zones) {
    const z = zone.toLowerCase()
    if (z === normalizedCity) return { score: 25, distanceKm: null }
    if (z === normalizedCanton) return { score: 15, distanceKm: null }
    if (normalizedCanton === 'ge' && z.includes('genèv')) return { score: 20, distanceKm: null }
    if (normalizedCanton === 'vd' && z.includes('lausann')) return { score: 20, distanceKm: null }
  }
  return { score: 0, distanceKm: null }
}

// ── Score Type (15 pts) ──────────────────────────────────────────────────────

function scoreType(propertyType: string, searchType?: string): number {
  if (!searchType) return 7
  const normalized = searchType.toLowerCase()
  const propNorm = propertyType.toLowerCase()

  if (propNorm === normalized) return 15
  if ((propNorm === 'villa' && normalized === 'house') || (propNorm === 'house' && normalized === 'villa')) return 10
  if ((propNorm === 'villa' && normalized === 'maison') || (propNorm === 'house' && normalized === 'maison')) return 10
  if ((propNorm === 'apartment' && normalized === 'appartement')) return 15
  return 0
}

// ── Score Pièces/Surface (15 pts) ────────────────────────────────────────────


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

// ── Score Features (15 pts) — Niveau 1 : must-have / nice-to-have ───────────

function scoreFeatures(
  propertyFeatures: string[] | null,
  searchFeatures?: string[],
  mustHave?: string[],
  niceToHave?: string[],
): { score: number; mustHaveMet: boolean; mustHaveMissing: string[]; niceToHaveMatched: string[] } {
  const propSet = new Set((propertyFeatures || []).map((f) => f.toLowerCase()))

  // Niveau 1 : vérifier les must_have
  const mustHaveMissing: string[] = []
  if (mustHave && mustHave.length > 0) {
    for (const mh of mustHave) {
      if (!propSet.has(mh.toLowerCase())) {
        mustHaveMissing.push(mh)
      }
    }
  }
  const mustHaveMet = mustHaveMissing.length === 0

  // Niveau 1 : compter les nice_to_have
  const niceToHaveMatched: string[] = []
  if (niceToHave && niceToHave.length > 0) {
    for (const nth of niceToHave) {
      if (propSet.has(nth.toLowerCase())) {
        niceToHaveMatched.push(nth)
      }
    }
  }

  // Score classique basé sur features générales
  if (!searchFeatures || searchFeatures.length === 0) {
    // Pas de features classiques → bonus nice-to-have uniquement
    const niceBonus = niceToHave && niceToHave.length > 0
      ? Math.round((niceToHaveMatched.length / niceToHave.length) * 8)
      : 0
    return { score: 7 + niceBonus, mustHaveMet, mustHaveMissing, niceToHaveMatched }
  }

  if (!propertyFeatures || propertyFeatures.length === 0) {
    return { score: 0, mustHaveMet, mustHaveMissing, niceToHaveMatched }
  }


  let matched = 0
  for (const sf of searchFeatures) {
    if (propSet.has(sf.toLowerCase())) matched++
  }

  const baseScore = Math.round((matched / searchFeatures.length) * 15)

  // Bonus nice-to-have (jusqu'à +5 pts)
  const niceBonus = niceToHave && niceToHave.length > 0
    ? Math.round((niceToHaveMatched.length / niceToHave.length) * 5)
    : 0

  return {
    score: Math.min(15, baseScore) + niceBonus,
    mustHaveMet,
    mustHaveMissing,
    niceToHaveMatched,
  }
}

// ── Score final composite ────────────────────────────────────────────────────


function calculateScore(
  property: Property,
  search: ClientSearch,
): { score: number; reasons: MatchReason } {
  const c = search.criteria

  const budgetScore = scoreBudget(property.price, c.budget_min, c.budget_max)
  const { score: zoneScore, distanceKm } = scoreZone(
    property.city, property.canton, c.zones,
    property.lat, property.lng,
    c.center_lat, c.center_lng, c.radius_km,
  )
  const typeScore = scoreType(property.type, c.type)
  const roomsSurfaceScore = scoreRoomsSurface(
    property.rooms, property.surface_m2,
    c.rooms_min, c.rooms_max, c.surface_min, c.surface_max,
  )
  const { score: featuresScore, mustHaveMet, mustHaveMissing, niceToHaveMatched } = scoreFeatures(
    property.features, c.features, c.must_have, c.nice_to_have,
  )

  // Score brut (peut dépasser 100 avec bonus nice-to-have)
  let rawScore = budgetScore + zoneScore + typeScore + roomsSurfaceScore + featuresScore

  // Niveau 1 : si un must_have manque → score plafonné à 40
  if (!mustHaveMet) {
    rawScore = Math.min(40, rawScore)
  }

  // Niveau 3 : decay temporel — biens récents favorisés
  const { decay, daysOnMarket } = calculateDecay(property.published_at, property.created_at)
  const finalScore = Math.min(100, Math.round(rawScore * decay))

  return {
    score: finalScore,
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
      must_have_met: mustHaveMet,
      must_have_missing: mustHaveMissing,
      nice_to_have_matched: niceToHaveMatched,
      distance_km: distanceKm,
      freshness_decay: Math.round(decay * 100) / 100,
      days_on_market: daysOnMarket,
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

    // Fetch properties (v2: includes lat, lng, published_at for geospatial + decay)
    const PROPERTY_SELECT = 'id, agency_id, type, status, price, rooms, surface_m2, city, canton, features, lat, lng, published_at, created_at'

    let propertiesQuery = supabase
      .from('properties')
      .select(PROPERTY_SELECT)
      .eq('agency_id', agency_id)
      .eq('status', 'active')

    if (trigger === 'new_property' && property_id) {
      propertiesQuery = supabase
        .from('properties')
        .select(PROPERTY_SELECT)
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
