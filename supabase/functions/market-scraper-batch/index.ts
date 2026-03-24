import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Price ranges — fine-grained to maximize unique results ──
// Each range returns up to 36 unique listings from the API.
// Fine ranges in high-density brackets, wider ranges at extremes.
const PRICE_RANGES: [number, number][] = [
  // Low end (fewer GE/VD but good for completeness)
  [0, 150000], [150000, 250000], [250000, 350000], [350000, 450000],
  [450000, 550000], [550000, 650000], [650000, 750000], [750000, 850000],
  [850000, 950000], [950000, 1050000],
  // Mid range
  [1050000, 1150000], [1150000, 1250000], [1250000, 1350000], [1350000, 1450000],
  [1450000, 1600000], [1600000, 1750000], [1750000, 1900000], [1900000, 2100000],
  [2100000, 2300000], [2300000, 2500000], [2500000, 2700000], [2700000, 2900000],
  // Upper mid (high GE/VD density)
  [2900000, 3100000], [3100000, 3300000], [3300000, 3500000], [3500000, 3800000],
  [3800000, 4100000], [4100000, 4500000], [4500000, 5000000],
  // Premium (very high GE/VD density)
  [5000000, 5500000], [5500000, 6000000], [6000000, 6500000], [6500000, 7000000],
  [7000000, 7500000], [7500000, 8000000], [8000000, 9000000], [9000000, 10000000],
  // Ultra premium
  [10000000, 12000000], [12000000, 15000000], [15000000, 20000000], [20000000, 50000000],
]

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const totals = { created: 0, updated: 0, skipped: 0, priceChanges: 0, fetched: 0 }
    const rangeResults: { range: string; fetched: number; created: number; updated: number; geVd: number }[] = []

    for (let i = 0; i < PRICE_RANGES.length; i++) {
      const [priceMin, priceMax] = PRICE_RANGES[i]
      const rangeLabel = `${priceMin / 1000}K-${priceMax / 1000}K`

      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/market-scraper`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({ price_min: priceMin, price_max: priceMax }),
        })

        if (!resp.ok) {
          console.error(`[${i + 1}/${PRICE_RANGES.length}] ${rangeLabel}: HTTP ${resp.status}`)
          rangeResults.push({ range: rangeLabel, fetched: 0, created: 0, updated: 0, geVd: 0 })
          continue
        }

        const r = await resp.json()
        const geVd = (r.listings_created || 0) + (r.listings_updated || 0)
        totals.created += r.listings_created || 0
        totals.updated += r.listings_updated || 0
        totals.skipped += r.listings_skipped || 0
        totals.priceChanges += r.price_changes || 0
        totals.fetched += r.total_fetched || 0

        rangeResults.push({
          range: rangeLabel, fetched: r.total_fetched || 0,
          created: r.listings_created || 0, updated: r.listings_updated || 0, geVd,
        })

        console.log(
          `[${i + 1}/${PRICE_RANGES.length}] ${rangeLabel}: ` +
          `${r.total_fetched} fetched, ${geVd} GE/VD (${r.listings_created} new), ` +
          `${r.listings_skipped} skipped`
        )
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown'
        console.error(`[${i + 1}/${PRICE_RANGES.length}] ${rangeLabel}: ${msg}`)
        rangeResults.push({ range: rangeLabel, fetched: 0, created: 0, updated: 0, geVd: 0 })
      }

      // Random delay 2-4s between requests
      await sleep(2000 + Math.random() * 2000)
    }

    // Count unique GE/VD listings in DB
    const { count: geCount } = await supabase
      .from('market_listings').select('id', { count: 'exact', head: true })
      .in('canton', ['GE', 'Genève']).in('status', ['active', 'price_reduced'])
    const { count: vdCount } = await supabase
      .from('market_listings').select('id', { count: 'exact', head: true })
      .in('canton', ['VD', 'Vaud']).in('status', ['active', 'price_reduced'])

    return new Response(JSON.stringify({
      ranges_scanned: PRICE_RANGES.length,
      ...totals,
      db_ge: geCount || 0,
      db_vd: vdCount || 0,
      db_total: (geCount || 0) + (vdCount || 0),
      range_results: rangeResults,
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
