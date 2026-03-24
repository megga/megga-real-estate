import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Cities per canton ──────────────────────────────────────

const CANTON_CITIES: Record<string, string[]> = {
  GE: [
    'geneve', 'carouge', 'lancy', 'meyrin', 'vernier', 'onex', 'thonex',
    'chene-bourg', 'plan-les-ouates', 'cologny', 'vandoeuvres', 'grand-saconnex',
    'bernex', 'confignon', 'pregny-chambesy', 'bellevue', 'collonge-bellerive',
  ],
  VD: [
    'lausanne', 'nyon', 'morges', 'montreux', 'vevey', 'renens',
    'yverdon-les-bains', 'pully', 'lutry', 'prilly', 'ecublens', 'aigle', 'bex',
  ],
}

interface BatchRequest {
  canton: 'GE' | 'VD'
  transaction_type: 'buy' | 'rent'
}

interface CityResult {
  city: string
  listings_created: number
  listings_updated: number
  photos_uploaded: number
  price_changes: number
  total_found: number
  error?: string
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const params: BatchRequest = await req.json()

    if (!params.canton || !params.transaction_type) {
      return new Response(
        JSON.stringify({ error: 'canton and transaction_type are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const cities = CANTON_CITIES[params.canton]
    if (!cities) {
      return new Response(
        JSON.stringify({ error: `Unknown canton: ${params.canton}. Supported: GE, VD` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // ── Scan each city ──
    const cityResults: CityResult[] = []
    let totalCreated = 0
    let totalUpdated = 0
    let totalPhotos = 0
    let totalPriceChanges = 0
    let totalFound = 0

    for (let i = 0; i < cities.length; i++) {
      const city = cities[i]

      try {
        // Call market-scraper Edge Function
        const scraperResponse = await fetch(
          `${supabaseUrl}/functions/v1/market-scraper`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({
              canton: params.canton,
              city,
              transaction_type: params.transaction_type,
            }),
          }
        )

        if (!scraperResponse.ok) {
          const errorText = await scraperResponse.text()
          cityResults.push({
            city,
            listings_created: 0,
            listings_updated: 0,
            photos_uploaded: 0,
            price_changes: 0,
            total_found: 0,
            error: `HTTP ${scraperResponse.status}: ${errorText}`,
          })
          continue
        }

        const result = await scraperResponse.json()
        cityResults.push({
          city,
          listings_created: result.listings_created || 0,
          listings_updated: result.listings_updated || 0,
          photos_uploaded: result.photos_uploaded || 0,
          price_changes: result.price_changes || 0,
          total_found: result.total_found || 0,
        })

        totalCreated += result.listings_created || 0
        totalUpdated += result.listings_updated || 0
        totalPhotos += result.photos_uploaded || 0
        totalPriceChanges += result.price_changes || 0
        totalFound += result.total_found || 0

        console.log(
          `[${i + 1}/${cities.length}] ${city}: ` +
          `${result.total_found} found, ${result.listings_created} new, ` +
          `${result.listings_updated} updated, ${result.photos_uploaded} photos`
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        cityResults.push({
          city,
          listings_created: 0,
          listings_updated: 0,
          photos_uploaded: 0,
          price_changes: 0,
          total_found: 0,
          error: message,
        })
        console.error(`[${i + 1}/${cities.length}] ${city}: ERROR - ${message}`)
      }

      // Rate limiting: 2s delay between cities
      if (i < cities.length - 1) {
        await sleep(2000)
      }
    }

    // ── Mark stale listings as removed ──
    // Listings in this canton not seen in the last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { count: removedCount } = await supabase
      .from('market_listings')
      .update({ status: 'removed' })
      .eq('canton', params.canton)
      .eq('transaction_type', params.transaction_type)
      .eq('status', 'active')
      .lt('last_seen_at', sevenDaysAgo)
      .select('id', { count: 'exact', head: true })

    return new Response(JSON.stringify({
      canton: params.canton,
      transaction_type: params.transaction_type,
      cities_scanned: cities.length,
      total_found: totalFound,
      total_created: totalCreated,
      total_updated: totalUpdated,
      total_photos: totalPhotos,
      total_price_changes: totalPriceChanges,
      listings_removed: removedCount || 0,
      city_results: cityResults,
    }), {
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
