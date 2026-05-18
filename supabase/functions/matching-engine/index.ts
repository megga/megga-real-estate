import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MatchReasons {
  budget: { match: boolean; score: number; detail: string }
  zone: { match: boolean; score: number; detail: string }
  type: { match: boolean; score: number; detail: string }
  rooms: { match: boolean; score: number; detail: string }
  features: { match: boolean; score: number; detail: string }
}

interface ScoreResult {
  total: number
  reasons: MatchReasons
}

interface RequestBody {
  mode: 'match-property' | 'match-contact' | 'scan-all'
  property_id?: string
  contact_id?: string
  include_market?: boolean // Also match against market_listings
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ── Auth check — service_role bypass for pg_cron, else require agent JWT ──
    // pg_cron and other trusted callers send the service_role JWT directly.
    // For those callers we accept an `agency_id` in the body. For end-user
    // callers we derive agency_id from the JWT to prevent cross-tenant writes.
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || ''
    const token = authHeader.toLowerCase().startsWith('bearer ')
      ? authHeader.slice('bearer '.length).trim()
      : ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const isServiceRole = token !== '' && token === serviceRoleKey

    const body = (await req.json()) as RequestBody & { agency_id?: string }
    const { mode, property_id, contact_id, include_market = true } = body

    let supabase: ReturnType<typeof createClient>
    let agency_id: string

    if (isServiceRole) {
      supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        serviceRoleKey,
      )
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
      // Trust the JWT-derived agency_id; ignore any `agency_id` in the body.
      agency_id = auth.profile.agency_id
    }

    let newMatches = 0
    let newMarketMatches = 0

    // ── Helper: insert internal match + log activity event ──
    async function insertMatchWithAudit(
      matchContactId: string,
      matchPropertyId: string,
      searchId: string,
      score: ScoreResult
    ): Promise<boolean> {
      const { data: existing } = await supabase
        .from('matches')
        .select('id')
        .eq('contact_id', matchContactId)
        .eq('property_id', matchPropertyId)
        .maybeSingle()

      if (existing) return false

      const { data: inserted } = await supabase
        .from('matches')
        .insert({
          agency_id,
          contact_id: matchContactId,
          property_id: matchPropertyId,
          client_search_id: searchId,
          score: score.total,
          reasons: score.reasons,
          status: 'suggested',
          source: 'internal',
        })
        .select('id')
        .single()

      // Audit trail — toute action IA loggée avec actor_id = 'ai'
      if (inserted) {
        await supabase.from('activity_events').insert({
          agency_id,
          actor_id: null,
          actor_kind: 'ai',
          action: 'match_suggested',
          entity_type: 'match',
          entity_id: inserted.id,
          metadata: {
            contact_id: matchContactId,
            property_id: matchPropertyId,
            score: score.total,
            mode,
            source: 'internal',
          },
        })
      }

      return true
    }

    // ── Helper: insert market match + log activity event ──
    async function insertMarketMatchWithAudit(
      matchContactId: string,
      marketListingId: string,
      searchId: string,
      score: ScoreResult
    ): Promise<boolean> {
      const { data: existing } = await supabase
        .from('matches')
        .select('id')
        .eq('contact_id', matchContactId)
        .eq('market_listing_id', marketListingId)
        .maybeSingle()

      if (existing) return false

      const { data: inserted } = await supabase
        .from('matches')
        .insert({
          agency_id,
          contact_id: matchContactId,
          market_listing_id: marketListingId,
          client_search_id: searchId,
          score: score.total,
          reasons: score.reasons,
          status: 'suggested',
          source: 'market',
        })
        .select('id')
        .single()

      if (inserted) {
        await supabase.from('activity_events').insert({
          agency_id,
          actor_id: null,
          actor_kind: 'ai',
          action: 'match_suggested',
          entity_type: 'match',
          entity_id: inserted.id,
          metadata: {
            contact_id: matchContactId,
            market_listing_id: marketListingId,
            score: score.total,
            mode,
            source: 'market',
          },
        })
      }

      return true
    }

    // ── Helper: match searches against market listings ──
    async function matchSearchesAgainstMarket(
      searches: Record<string, unknown>[],
      resolveContactId: (search: Record<string, unknown>) => string
    ): Promise<void> {
      if (!include_market) return

      // Fetch active market listings (GE + VD for now)
      const { data: marketListings } = await supabase
        .from('market_listings')
        .select('*')
        .eq('status', 'active')
        .limit(5000)

      if (!marketListings || marketListings.length === 0) return

      for (const search of searches) {
        const cId = resolveContactId(search)
        for (const ml of marketListings) {
          // market_listings uses same fields as properties
          const score = calculateScore(ml, search)
          if (score.total >= 60) {
            const created = await insertMarketMatchWithAudit(cId, ml.id, search.id as string, score)
            if (created) newMarketMatches++
          }
        }
      }
    }

    if (mode === 'match-property' && property_id) {
      // ── Nouveau bien → scanner tous les acheteurs ──

      const { data: property, error: propError } = await supabase
        .from('properties')
        .select('*')
        .eq('id', property_id)
        .single()

      if (propError || !property) throw new Error(`Property not found: ${property_id}`)

      const { data: searches, error: searchError } = await supabase
        .from('client_searches')
        .select('*, contact:contacts(*)')
        .eq('agency_id', agency_id)
        .eq('is_active', true)

      if (searchError) throw searchError

      for (const search of searches || []) {
        const score = calculateScore(property, search)
        if (score.total >= 60) {
          const created = await insertMatchWithAudit(search.contact_id, property_id, search.id, score)
          if (created) newMatches++
        }
      }
    } else if (mode === 'match-contact' && contact_id) {
      // ── Nouvel acheteur → scanner tous les biens actifs ──

      const { data: searches, error: searchError } = await supabase
        .from('client_searches')
        .select('*')
        .eq('contact_id', contact_id)
        .eq('is_active', true)

      if (searchError) throw searchError
      if (!searches || searches.length === 0) {
        return new Response(JSON.stringify({ newMatches: 0, message: 'No active searches' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data: properties, error: propError } = await supabase
        .from('properties')
        .select('*')
        .eq('agency_id', agency_id)
        .eq('status', 'active')

      if (propError) throw propError

      for (const search of searches) {
        for (const property of properties || []) {
          const score = calculateScore(property, search)
          if (score.total >= 60) {
            const created = await insertMatchWithAudit(contact_id, property.id, search.id, score)
            if (created) newMatches++
          }
        }
      }

      // Also match against market listings
      await matchSearchesAgainstMarket(searches, () => contact_id!)
    } else if (mode === 'scan-all') {
      // ── Scan complet (appelé par pg_cron) ──

      const { data: searches } = await supabase
        .from('client_searches')
        .select('*, contact:contacts(*)')
        .eq('agency_id', agency_id)
        .eq('is_active', true)

      const { data: properties } = await supabase
        .from('properties')
        .select('*')
        .eq('agency_id', agency_id)
        .eq('status', 'active')

      for (const search of searches || []) {
        for (const property of properties || []) {
          const score = calculateScore(property, search)
          if (score.total >= 60) {
            const created = await insertMatchWithAudit(search.contact_id, property.id, search.id, score)
            if (created) newMatches++
          }
        }
      }

      // Also match against market listings
      await matchSearchesAgainstMarket(
        searches || [],
        (search) => search.contact_id as string
      )
    } else {
      throw new Error(`Invalid mode: ${mode}. Expected 'match-property', 'match-contact', or 'scan-all'`)
    }

    return new Response(JSON.stringify({ newMatches, newMarketMatches, mode }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// ── Scoring Engine (adapted from src/lib/matching.ts) ──────────────────────

function calculateScore(
  property: Record<string, unknown>,
  search: Record<string, unknown>
): ScoreResult {
  const criteria = search.criteria as Record<string, unknown> | null
  if (!criteria) return { total: 0, reasons: emptyReasons() }

  const price = (property.price as number) || 0
  const budgetMin = (criteria.budget_min as number) || 0
  const budgetMax = (criteria.budget_max as number) || Infinity
  const propertyType = (property.type as string) || ''
  const searchType = (criteria.type as string) || ''
  const propertyCity = ((property.city as string) || '').toLowerCase()
  const propertyCanton = ((property.canton as string) || '').toLowerCase()
  const searchZones = (criteria.zones as string[]) || []
  const propertyRooms = (property.rooms as number) || 0
  const searchRoomsMin = (criteria.rooms_min as number) || 0
  const searchRoomsMax = (criteria.rooms_max as number) || 99
  const propertySurface = (property.surface_m2 as number) || 0
  const searchSurfaceMin = (criteria.surface_min as number) || 0
  const propertyFeatures = (property.features as string[]) || []
  const searchFeatures = (criteria.features as string[]) || []

  // ── Budget (30 pts) ──
  let budgetScore = 0
  let budgetDetail = ''
  if (price >= budgetMin && price <= budgetMax) {
    budgetScore = 30
    budgetDetail = 'Dans le budget'
  } else if (price > budgetMax && price <= budgetMax * 1.15) {
    budgetScore = Math.round(30 * (1 - (price / budgetMax - 1) / 0.15))
    budgetDetail = `${Math.round((price / budgetMax - 1) * 100)}% au-dessus`
  } else if (price < budgetMin && price >= budgetMin * 0.7) {
    budgetScore = 20
    budgetDetail = 'Sous le budget minimum'
  } else {
    budgetDetail = 'Hors budget'
  }

  // ── Zone (25 pts) ──
  let zoneScore = 0
  let zoneDetail = ''
  const normalizedZones = searchZones.map((z: string) => z.toLowerCase())
  if (normalizedZones.some((z: string) => propertyCity.includes(z) || z.includes(propertyCity))) {
    zoneScore = 25
    zoneDetail = `${property.city} correspond`
  } else if (normalizedZones.some((z: string) => propertyCanton.includes(z) || z.includes(propertyCanton))) {
    zoneScore = 15
    zoneDetail = `Canton ${property.canton} correspond`
  } else {
    zoneDetail = 'Zone non correspondante'
  }

  // ── Type (15 pts) ──
  let typeScore = 0
  let typeDetail = ''
  if (propertyType === searchType || !searchType) {
    typeScore = 15
    typeDetail = propertyType || 'Tout type'
  } else if (
    (propertyType === 'villa' && searchType === 'house') ||
    (propertyType === 'house' && searchType === 'villa')
  ) {
    typeScore = 10
    typeDetail = 'Type similaire'
  } else {
    typeDetail = `${propertyType} ≠ ${searchType}`
  }

  // ── Pièces / Surface (15 pts) ──
  let roomsScore = 0
  const roomsDetails: string[] = []
  if (propertyRooms >= searchRoomsMin && propertyRooms <= searchRoomsMax) {
    roomsScore += 8
    roomsDetails.push(`${propertyRooms} pièces`)
  } else if (propertyRooms === searchRoomsMin - 1) {
    roomsScore += 4
    roomsDetails.push(`${propertyRooms} pièces (−1)`)
  }
  if (propertySurface >= searchSurfaceMin) {
    roomsScore += 7
    roomsDetails.push(`${propertySurface} m²`)
  } else if (propertySurface >= searchSurfaceMin * 0.9) {
    roomsScore += 4
    roomsDetails.push(`${propertySurface} m² (proche)`)
  }
  const roomsDetail = roomsDetails.join(', ') || 'Critères non remplis'

  // ── Features (15 pts) ──
  let featuresScore = 0
  let featuresDetail = ''
  if (searchFeatures.length > 0) {
    const found = searchFeatures.filter((f: string) =>
      propertyFeatures.some((pf: string) => pf.toLowerCase().includes(f.toLowerCase()))
    )
    featuresScore = Math.min(15, Math.round((found.length / searchFeatures.length) * 15))
    featuresDetail = found.length > 0 ? `${found.length}/${searchFeatures.length} critères` : 'Aucun match'
  } else {
    featuresScore = 10
    featuresDetail = 'Pas de critères spécifiques'
  }

  const total = budgetScore + zoneScore + typeScore + roomsScore + featuresScore

  return {
    total,
    reasons: {
      budget: { match: budgetScore >= 20, score: budgetScore, detail: budgetDetail },
      zone: { match: zoneScore >= 15, score: zoneScore, detail: zoneDetail },
      type: { match: typeScore >= 10, score: typeScore, detail: typeDetail },
      rooms: { match: roomsScore >= 8, score: roomsScore, detail: roomsDetail },
      features: { match: featuresScore >= 8, score: featuresScore, detail: featuresDetail },
    },
  }
}

function emptyReasons(): MatchReasons {
  return {
    budget: { match: false, score: 0, detail: '' },
    zone: { match: false, score: 0, detail: '' },
    type: { match: false, score: 0, detail: '' },
    rooms: { match: false, score: 0, detail: '' },
    features: { match: false, score: 0, detail: '' },
  }
}
