import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Zones per canton (canton-level + city-level for broader coverage) ──
const CANTON_ZONES: Record<string, string[]> = {
  GE: [
    'canton-geneve',
    'geneve', 'carouge', 'lancy', 'meyrin', 'vernier', 'onex', 'thonex',
    'chene-bourg', 'plan-les-ouates', 'cologny', 'vandoeuvres', 'grand-saconnex',
    'bernex', 'confignon', 'pregny-chambesy', 'bellevue', 'collonge-bellerive',
  ],
  VD: [
    'canton-vaud',
    'lausanne', 'nyon', 'morges', 'montreux', 'vevey', 'renens',
    'yverdon-les-bains', 'pully', 'lutry', 'prilly', 'ecublens', 'aigle', 'bex',
  ],
}

// Property types to scan for each zone
const PROPERTY_TYPES = ['appartement', 'maison', 'villa']

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

interface ScanResult {
  zone: string
  property_type: string
  total_found: number
  listings_created: number
  listings_updated: number
  photos_uploaded: number
  error?: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { canton } = (await req.json()) as { canton: 'GE' | 'VD' }
    if (!canton || !CANTON_ZONES[canton]) {
      return new Response(
        JSON.stringify({ error: 'canton is required (GE or VD)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const zones = CANTON_ZONES[canton]
    const results: ScanResult[] = []
    const grandTotal = { found: 0, created: 0, updated: 0, photos: 0 }

    // Scan each zone × property type combination
    for (const zone of zones) {
      for (const ptype of PROPERTY_TYPES) {
        try {
          const resp = await fetch(`${supabaseUrl}/functions/v1/market-scraper`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({ canton, zone, property_type: ptype }),
          })

          if (!resp.ok) {
            const errText = await resp.text()
            results.push({
              zone, property_type: ptype, total_found: 0,
              listings_created: 0, listings_updated: 0, photos_uploaded: 0,
              error: `HTTP ${resp.status}: ${errText.substring(0, 200)}`,
            })
            continue
          }

          const data = await resp.json()
          results.push({
            zone, property_type: ptype,
            total_found: data.total_found || 0,
            listings_created: data.listings_created || 0,
            listings_updated: data.listings_updated || 0,
            photos_uploaded: data.photos_uploaded || 0,
          })

          grandTotal.found += data.total_found || 0
          grandTotal.created += data.listings_created || 0
          grandTotal.updated += data.listings_updated || 0
          grandTotal.photos += data.photos_uploaded || 0

          console.log(
            `[${canton}] ${ptype}/${zone}: ${data.total_found} found, ` +
            `${data.listings_created} new, ${data.listings_updated} upd, ${data.photos_uploaded} photos`
          )
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error'
          results.push({
            zone, property_type: ptype, total_found: 0,
            listings_created: 0, listings_updated: 0, photos_uploaded: 0, error: msg,
          })
        }

        // Rate limit: 2s between requests
        await sleep(2000)
      }
    }

    // Mark stale listings
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { count: removedCount } = await supabase
      .from('market_listings').update({ status: 'removed' })
      .eq('canton', canton).eq('status', 'active')
      .lt('last_seen_at', sevenDaysAgo)
      .select('id', { count: 'exact', head: true })

    // Count unique listings in DB for this canton
    const { count: totalInDb } = await supabase
      .from('market_listings').select('id', { count: 'exact', head: true })
      .eq('canton', canton).in('status', ['active', 'price_reduced'])

    return new Response(JSON.stringify({
      canton,
      scans: zones.length * PROPERTY_TYPES.length,
      grand_total_found: grandTotal.found,
      grand_total_created: grandTotal.created,
      grand_total_updated: grandTotal.updated,
      grand_total_photos: grandTotal.photos,
      unique_listings_in_db: totalInDb || 0,
      listings_removed: removedCount || 0,
      scan_results: results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
