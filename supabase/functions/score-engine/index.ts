// supabase/functions/score-engine/index.ts
// MEGGA Score Engine v1 — Behavioral scoring + Market radar + Property heat

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Action = 'calculate_contact_scores' | 'calculate_property_scores' | 'process_market_changes' | 'get_scores'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

function db() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
}

// ═══════════════════════════════════════════════════════════════
// PILIER 2 : Contact Behavior Score
// ═══════════════════════════════════════════════════════════════

async function calculateContactScores(agencyId?: string) {
  const supabase = db()
  let query = supabase.from('contacts').select('id, agency_id, type, score, budget_announced, budget_estimated_ai, ai_timing, notes, last_interaction_at, created_at')
  if (agencyId) query = query.eq('agency_id', agencyId)
  query = query.in('type', ['buyer', 'both', 'lead', 'investor'])
  const { data: contacts } = await query.limit(500)

  if (!contacts || contacts.length === 0) return { scored: 0 }

  let scored = 0

  for (const contact of contacts) {
    try {
      // 1. RÉACTIVITÉ (20%) — Temps moyen entre interactions
      const { data: events } = await supabase
        .from('activity_events')
        .select('created_at')
        .eq('entity_id', contact.id)
        .eq('entity_type', 'contact')
        .order('created_at', { ascending: true })
        .limit(30)

      let reactivityScore = 30 // default if no data
      if (events && events.length >= 2) {
        const gaps: number[] = []
        for (let i = 1; i < events.length; i++) {
          const gap = new Date(events[i].created_at).getTime() - new Date(events[i - 1].created_at).getTime()
          gaps.push(gap / (1000 * 60 * 60)) // in hours
        }
        const avgGapHours = gaps.reduce((a, b) => a + b, 0) / gaps.length
        if (avgGapHours < 2) reactivityScore = 100
        else if (avgGapHours < 12) reactivityScore = 80
        else if (avgGapHours < 24) reactivityScore = 65
        else if (avgGapHours < 72) reactivityScore = 45
        else reactivityScore = 20
      }

      // 2. ENGAGEMENT (25%) — Interactions des 30 derniers jours + tendance
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()

      const { count: totalRecent } = await supabase
        .from('activity_events')
        .select('id', { count: 'exact', head: true })
        .eq('entity_id', contact.id)
        .eq('entity_type', 'contact')
        .gte('created_at', thirtyDaysAgo)

      const { count: recentHalf } = await supabase
        .from('activity_events')
        .select('id', { count: 'exact', head: true })
        .eq('entity_id', contact.id)
        .eq('entity_type', 'contact')
        .gte('created_at', fifteenDaysAgo)

      const interactionsCount = totalRecent ?? 0
      let engagementScore = 10
      if (interactionsCount > 10) engagementScore = 100
      else if (interactionsCount > 5) engagementScore = 80
      else if (interactionsCount > 3) engagementScore = 60
      else if (interactionsCount > 1) engagementScore = 40

      // Trend bonus: more in last 15d than first 15d = rising
      const firstHalfCount = interactionsCount - (recentHalf ?? 0)
      const trend = (recentHalf ?? 0) > firstHalfCount ? 'rising' : (recentHalf ?? 0) < firstHalfCount ? 'declining' : 'stable'
      if (trend === 'rising') engagementScore = Math.min(100, engagementScore + 10)

      // 3. COHÉRENCE BUDGET (20%) — Biens visités vs budget déclaré
      const { data: sentMatches } = await supabase
        .from('matches')
        .select('score, property:properties(price), market_listing:market_listings(price)')
        .eq('contact_id', contact.id)
        .in('status', ['sent', 'visit_planned', 'interested'])
        .limit(20)

      let budgetCoherenceScore = 50 // default
      let estimatedRealBudget = contact.budget_announced

      if (sentMatches && sentMatches.length > 0) {
        const prices: number[] = []
        for (const m of sentMatches) {
          const prop = Array.isArray(m.property) ? m.property[0] : m.property
          const mkt = Array.isArray(m.market_listing) ? m.market_listing[0] : m.market_listing
          const price = (prop as { price: number } | null)?.price ?? (mkt as { price: number } | null)?.price
          if (price && price > 0) prices.push(price)
        }

        if (prices.length > 0) {
          const avgVisitedPrice = prices.reduce((a, b) => a + b, 0) / prices.length
          estimatedRealBudget = Math.round(avgVisitedPrice)

          if (contact.budget_announced && contact.budget_announced > 0) {
            const deviation = Math.abs(avgVisitedPrice - contact.budget_announced) / contact.budget_announced
            if (deviation < 0.10) budgetCoherenceScore = 100
            else if (deviation < 0.20) budgetCoherenceScore = 80
            else if (deviation < 0.30) budgetCoherenceScore = 60
            else budgetCoherenceScore = 40

            // If visiting ABOVE budget → real budget is higher
            if (avgVisitedPrice > contact.budget_announced * 1.1) {
              estimatedRealBudget = Math.round(avgVisitedPrice * 1.05) // add 5% margin
            }
          }
        }
      }

      // 4. QUALITÉ VISITES (20%) — Ratios et feedbacks
      const { data: visits } = await supabase
        .from('visits')
        .select('status, feedback_buyer, rating')
        .eq('contact_id', contact.id)
        .limit(20)

      let visitQualityScore = 30
      let rejectionPatterns: string[] = []
      const visitsCount = visits?.length ?? 0

      if (visits && visits.length > 0) {
        const done = visits.filter(v => v.status === 'done').length
        const cancelled = visits.filter(v => v.status === 'cancelled' || v.status === 'no_show').length
        const reliability = visits.length > 0 ? done / (done + cancelled || 1) : 0.5
        const avgRating = visits.filter(v => v.rating).reduce((a, v) => a + (v.rating ?? 0), 0) / (visits.filter(v => v.rating).length || 1)

        visitQualityScore = Math.round(reliability * 50 + Math.min(avgRating / 5, 1) * 50)

        // Detect rejection patterns from feedback
        const feedbacks = visits.map(v => v.feedback_buyer).filter(Boolean).join(' ').toLowerCase()
        const patterns: string[] = []
        if (/bruit|bruyant/i.test(feedbacks)) patterns.push('bruit')
        if (/sombre|luminosité|lumière/i.test(feedbacks)) patterns.push('sombre')
        if (/cher|prix|coût/i.test(feedbacks)) patterns.push('prix élevé')
        if (/petit|étroit|exigu/i.test(feedbacks)) patterns.push('trop petit')
        if (/rez|rdc|rez-de-chaussée/i.test(feedbacks)) patterns.push('rez-de-chaussée')
        if (/travaux|rénov/i.test(feedbacks)) patterns.push('travaux nécessaires')
        if (/vue|dégagement/i.test(feedbacks)) patterns.push('manque de vue')

        rejectionPatterns = patterns
      }

      // 5. CONVERSION (15%) — Pipeline progress + offers
      const { data: deals } = await supabase
        .from('transactions')
        .select('stage, status, price_offered')
        .or(`contact_buyer_id.eq.${contact.id},contact_seller_id.eq.${contact.id}`)
        .eq('status', 'active')
        .limit(5)

      let conversionScore = 10
      if (deals && deals.length > 0) {
        const advancedStages = ['offer', 'negotiation', 'reserved', 'financing', 'notary', 'signed']
        const hasAdvanced = deals.some(d => advancedStages.includes(d.stage))
        const hasOffer = deals.some(d => d.price_offered && d.price_offered > 0)
        if (hasOffer) conversionScore = 80
        else if (hasAdvanced) conversionScore = 60
        else conversionScore = 30
      }
      if (contact.ai_timing === 'immediate') conversionScore = Math.min(100, conversionScore + 20)

      // ── WEIGHTED BUYER SCORE ──
      const buyerScore = Math.round(
        reactivityScore * 0.20 +
        engagementScore * 0.25 +
        budgetCoherenceScore * 0.20 +
        visitQualityScore * 0.20 +
        conversionScore * 0.15
      )

      const conversionProbability = Math.round(
        buyerScore * 0.40 +
        conversionScore * 0.35 +
        engagementScore * 0.25
      )

      // ── UPSERT SCORES ──
      await supabase.from('contact_scores').upsert({
        contact_id: contact.id,
        agency_id: contact.agency_id,
        reactivity_score: reactivityScore,
        engagement_score: engagementScore,
        budget_coherence_score: budgetCoherenceScore,
        visit_quality_score: visitQualityScore,
        buyer_score: buyerScore,
        conversion_probability: Math.min(100, conversionProbability),
        estimated_real_budget: estimatedRealBudget,
        rejection_patterns: JSON.stringify(rejectionPatterns ?? []),
        intent_signals: JSON.stringify({}),
        engagement_trend: trend,
        interactions_count: interactionsCount,
        visits_count: visitsCount,
        matches_sent_count: sentMatches?.length ?? 0,
        last_calculated_at: new Date().toISOString(),
      }, { onConflict: 'contact_id' })

      // Update contact AI fields
      await supabase.from('contacts').update({
        ai_seriousness_score: buyerScore,
        ai_purchase_probability: Math.min(100, conversionProbability),
        budget_estimated_ai: estimatedRealBudget,
      }).eq('id', contact.id)

      scored++
    } catch {
      // Skip failed contact, continue
    }
  }

  return { scored }
}

// ═══════════════════════════════════════════════════════════════
// PILIER 3 : Property Heat Score
// ═══════════════════════════════════════════════════════════════

async function calculatePropertyScores(agencyId?: string) {
  const supabase = db()

  // Score internal properties (agency's own listings)
  let propQuery = supabase.from('properties').select('id, agency_id, price, city, canton, type, rooms, surface_m2, status, created_at, updated_at')
    .eq('status', 'active')
  if (agencyId) propQuery = propQuery.eq('agency_id', agencyId)
  const { data: properties } = await propQuery.limit(200)

  let scored = 0

  for (const prop of (properties ?? [])) {
    try {
      // 1. MARKET POSITION (30%) — Price vs comparables
      let marketPositionScore = 50
      let comparableCount = 0
      let avgComparablePrice = 0
      let priceVsMarketPct = 0

      if (prop.price && prop.city) {
        let compQuery = supabase
          .from('market_listings')
          .select('price, price_per_m2')
          .eq('city', prop.city)
          .in('status', ['active', 'price_reduced'])
          .gte('quality_score', 50)
          .gt('price', 0)

        if (prop.type) compQuery = compQuery.eq('type', prop.type)
        if (prop.rooms) compQuery = compQuery.gte('rooms', prop.rooms - 1).lte('rooms', prop.rooms + 1)
        if (prop.price) compQuery = compQuery.gte('price', prop.price * 0.6).lte('price', prop.price * 1.4)

        const { data: comparables } = await compQuery.limit(30)

        if (comparables && comparables.length > 0) {
          comparableCount = comparables.length
          const prices = comparables.map(c => c.price).filter(Boolean) as number[]
          avgComparablePrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)

          priceVsMarketPct = Math.round(((prop.price - avgComparablePrice) / avgComparablePrice) * 100 * 10) / 10

          // Score: 100 if at market price, decreases with deviation
          const absDeviation = Math.abs(priceVsMarketPct)
          if (absDeviation < 5) marketPositionScore = 100
          else if (absDeviation < 10) marketPositionScore = 80
          else if (absDeviation < 20) marketPositionScore = 60
          else if (absDeviation < 30) marketPositionScore = 40
          else marketPositionScore = 20
        }
      }

      // 2. INTEREST LEVEL (25%) — Matches + visits
      const { count: matchCount } = await supabase
        .from('matches')
        .select('id', { count: 'exact', head: true })
        .eq('property_id', prop.id)
        .neq('status', 'ignored')

      const { count: visitCount } = await supabase
        .from('visits')
        .select('id', { count: 'exact', head: true })
        .eq('property_id', prop.id)

      const totalInterest = (matchCount ?? 0) + (visitCount ?? 0) * 3 // visits count 3x
      let interestLevel = 10
      if (totalInterest > 15) interestLevel = 100
      else if (totalInterest > 8) interestLevel = 80
      else if (totalInterest > 4) interestLevel = 60
      else if (totalInterest > 1) interestLevel = 40

      // 3. FRESHNESS (25%) — Days on market
      const daysOnMarket = Math.floor((Date.now() - new Date(prop.created_at).getTime()) / (24 * 60 * 60 * 1000))
      let freshnessScore = 100
      if (daysOnMarket > 90) freshnessScore = 15
      else if (daysOnMarket > 60) freshnessScore = 30
      else if (daysOnMarket > 30) freshnessScore = 50
      else if (daysOnMarket > 14) freshnessScore = 70
      else if (daysOnMarket > 7) freshnessScore = 85

      // 4. PRICE TREND (20%) — from market_changes
      const { data: changes } = await supabase
        .from('market_changes')
        .select('change_type, change_pct')
        .eq('market_listing_id', prop.id)
        .order('detected_at', { ascending: false })
        .limit(5)

      let priceTrend: 'stable' | 'dropping' | 'rising' = 'stable'
      let trendScore = 60
      if (changes && changes.length > 0) {
        const drops = changes.filter(c => c.change_type === 'price_drop').length
        const rises = changes.filter(c => c.change_type === 'price_increase').length
        if (drops > rises) { priceTrend = 'dropping'; trendScore = 80 } // opportunity
        else if (rises > drops) { priceTrend = 'rising'; trendScore = 40 }
      }

      // ── WEIGHTED HEAT SCORE ──
      const heatScore = Math.round(
        marketPositionScore * 0.30 +
        interestLevel * 0.25 +
        freshnessScore * 0.25 +
        trendScore * 0.20
      )

      const stagnationRisk = daysOnMarket > 60 && interestLevel < 30 ? 'high'
        : daysOnMarket > 30 && interestLevel < 50 ? 'medium' : 'low'

      await supabase.from('property_scores').upsert({
        property_id: prop.id,
        source: 'internal',
        agency_id: prop.agency_id,
        heat_score: heatScore,
        market_position_score: marketPositionScore,
        interest_level: interestLevel,
        days_on_market: daysOnMarket,
        price_trend: priceTrend,
        stagnation_risk: stagnationRisk,
        comparable_count: comparableCount,
        avg_comparable_price: avgComparablePrice || null,
        price_vs_market_pct: priceVsMarketPct || null,
        last_calculated_at: new Date().toISOString(),
      }, { onConflict: 'property_id,source' })

      scored++
    } catch {
      // Skip failed property
    }
  }

  return { scored }
}

// ═══════════════════════════════════════════════════════════════
// PILIER 1 : Market Radar — Process changes → instant matching
// ═══════════════════════════════════════════════════════════════

async function processMarketChanges(agencyId?: string) {
  const supabase = db()

  // Fetch unprocessed changes (last 24h)
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: changes } = await supabase
    .from('market_changes')
    .select('*')
    .gte('detected_at', since)
    .in('change_type', ['new', 'price_drop'])
    .order('detected_at', { ascending: false })
    .limit(100)

  if (!changes || changes.length === 0) return { processed: 0, alerts: 0 }

  // Fetch all active client searches
  let searchQuery = supabase.from('client_searches').select('id, contact_id, agency_id, criteria, label').eq('is_active', true)
  if (agencyId) searchQuery = searchQuery.eq('agency_id', agencyId)
  const { data: searches } = await searchQuery.limit(200)

  if (!searches || searches.length === 0) return { processed: changes.length, alerts: 0 }

  let alertsGenerated = 0

  for (const change of changes) {
    if (!change.market_listing_id) continue

    // Fetch the full listing
    const { data: listing } = await supabase
      .from('market_listings')
      .select('id, price, city, canton, type, rooms, surface_m2, title, address')
      .eq('id', change.market_listing_id)
      .single()

    if (!listing) continue

    // Score against each active search
    for (const search of searches) {
      const criteria = search.criteria as Record<string, unknown>
      if (!criteria) continue

      let score = 0

      // Budget check (30 pts)
      const budgetMin = criteria.budget_min as number | undefined
      const budgetMax = criteria.budget_max as number | undefined
      if (listing.price && budgetMax) {
        if (listing.price >= (budgetMin ?? 0) && listing.price <= budgetMax) score += 30
        else if (listing.price <= budgetMax * 1.15) score += 15
      } else {
        score += 15 // no budget = partial match
      }

      // Zone check (25 pts)
      const zones = (criteria.zones as string[]) ?? []
      if (zones.length === 0) score += 12
      else if (zones.some(z => listing.city?.toLowerCase().includes(z.toLowerCase()) || listing.canton?.toLowerCase() === z.toLowerCase())) score += 25

      // Type check (15 pts)
      const searchType = criteria.type as string | undefined
      if (!searchType || searchType === listing.type) score += 15
      else score += 5

      // Rooms check (15 pts)
      const roomsMin = criteria.rooms_min as number | undefined
      const roomsMax = criteria.rooms_max as number | undefined
      if (listing.rooms) {
        if ((!roomsMin || listing.rooms >= roomsMin) && (!roomsMax || listing.rooms <= roomsMax)) score += 15
        else if (roomsMin && listing.rooms >= roomsMin - 1) score += 8
      } else {
        score += 8
      }

      // If score >= 60, generate an alert
      if (score >= 60) {
        const isNew = change.change_type === 'new'
        const title = isNew
          ? `Nouveau bien : ${listing.title || listing.city}`
          : `Baisse de prix (${change.change_pct}%) : ${listing.title || listing.city}`

        // Insert daily_action alert
        await supabase.from('daily_actions').insert({
          agency_id: search.agency_id,
          agent_id: search.contact_id, // will be resolved to agent later
          priority: score >= 80 ? 'high' : 'medium',
          category: 'match_found',
          title,
          description: `Score ${score}% — ${listing.city}, ${listing.rooms ?? '?'}p, CHF ${listing.price?.toLocaleString('fr-CH')}`,
          entity_type: 'property',
          entity_id: listing.id,
          action_type: 'send_property',
          is_completed: false,
          generated_at: new Date().toISOString(),
        })

        // Log audit event
        await supabase.from('activity_events').insert({
          agency_id: search.agency_id,
          actor_id: 'ai',
          action: isNew ? 'market_new_match' : 'market_price_drop_match',
          entity_type: 'match',
          entity_id: listing.id,
          metadata: {
            contact_id: search.contact_id,
            market_listing_id: listing.id,
            score,
            change_type: change.change_type,
            change_pct: change.change_pct,
            search_label: search.label,
          },
        })

        alertsGenerated++
      }
    }
  }

  return { processed: changes.length, alerts: alertsGenerated }
}

// ═══════════════════════════════════════════════════════════════
// GET SCORES — Read endpoint for frontend
// ═══════════════════════════════════════════════════════════════

async function getScores(params: { contact_id?: string; property_id?: string; market_listing_id?: string }) {
  const supabase = db()
  const result: Record<string, unknown> = {}

  if (params.contact_id) {
    const { data } = await supabase.from('contact_scores').select('*').eq('contact_id', params.contact_id).single()
    result.contact_score = data
  }

  if (params.property_id) {
    const { data } = await supabase.from('property_scores').select('*').eq('property_id', params.property_id).single()
    result.property_score = data
  }

  if (params.market_listing_id) {
    const { data } = await supabase.from('property_scores').select('*').eq('market_listing_id', params.market_listing_id).single()
    result.property_score = data
  }

  return result
}

// ═══════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const action = body.action as Action

    let result: Record<string, unknown>

    switch (action) {
      case 'calculate_contact_scores':
        result = await calculateContactScores(body.agency_id)
        break
      case 'calculate_property_scores':
        result = await calculatePropertyScores(body.agency_id)
        break
      case 'process_market_changes':
        result = await processMarketChanges(body.agency_id)
        break
      case 'get_scores':
        result = await getScores(body)
        break
      default:
        throw new Error(`Unknown action: ${action}`)
    }

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
