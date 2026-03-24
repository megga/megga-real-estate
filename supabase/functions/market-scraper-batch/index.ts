import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Pagination: 36 items per page, scan up to MAX_PAGES
const PAGE_SIZE = 36
const MAX_PAGES = 50 // 50 × 36 = 1'800 listings per batch call

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

interface BatchRequest {
  start_offset?: number  // Resume from this offset (default 0)
  max_pages?: number     // Max pages to scan (default 50)
  cantons?: string[]     // Filter cantons (default ['Genève', 'Vaud'])
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const params: BatchRequest = await req.json()
    const startOffset = params.start_offset || 0
    const maxPages = Math.min(params.max_pages || MAX_PAGES, MAX_PAGES)
    const cantons = params.cantons || ['Genève', 'Vaud']

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const grandTotal = { found: 0, created: 0, updated: 0, skipped: 0, photos: 0, priceChanges: 0 }
    let totalApi = 0
    let pagesScanned = 0
    let lastOffset = startOffset

    for (let page = 0; page < maxPages; page++) {
      const offset = startOffset + (page * PAGE_SIZE)

      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/market-scraper`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({ offset, limit: PAGE_SIZE, cantons }),
        })

        if (!resp.ok) {
          console.error(`Page ${page + 1} (offset ${offset}): HTTP ${resp.status}`)
          break
        }

        const result = await resp.json()
        pagesScanned++
        totalApi = result.total_api || totalApi
        grandTotal.found += result.total_found || 0
        grandTotal.created += result.listings_created || 0
        grandTotal.updated += result.listings_updated || 0
        grandTotal.skipped += result.listings_skipped || 0
        grandTotal.photos += result.photos_uploaded || 0
        grandTotal.priceChanges += result.price_changes || 0
        lastOffset = offset + PAGE_SIZE

        const geVd = (result.listings_created || 0) + (result.listings_updated || 0)
        console.log(
          `[${page + 1}/${maxPages}] offset=${offset}: ${result.total_found} found, ` +
          `${geVd} GE/VD (${result.listings_created} new), ${result.listings_skipped} skipped`
        )

        // Stop if API returned fewer items than PAGE_SIZE (last page)
        if ((result.total_found || 0) < PAGE_SIZE) {
          console.log('Last page reached — stopping')
          break
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error'
        console.error(`Page ${page + 1}: ${msg}`)
        break
      }

      // Rate limit: 2s between pages
      await sleep(2000)
    }

    // Count unique listings in DB
    const { count: geCount } = await supabase
      .from('market_listings').select('id', { count: 'exact', head: true })
      .eq('canton', 'GE').in('status', ['active', 'price_reduced'])
    const { count: vdCount } = await supabase
      .from('market_listings').select('id', { count: 'exact', head: true })
      .eq('canton', 'VD').in('status', ['active', 'price_reduced'])
    const { count: geneveCount } = await supabase
      .from('market_listings').select('id', { count: 'exact', head: true })
      .ilike('canton', '%gen%').in('status', ['active', 'price_reduced'])
    const { count: vaudCount } = await supabase
      .from('market_listings').select('id', { count: 'exact', head: true })
      .ilike('canton', '%vaud%').in('status', ['active', 'price_reduced'])

    return new Response(JSON.stringify({
      pages_scanned: pagesScanned,
      total_api_listings: totalApi,
      ...grandTotal,
      next_offset: lastOffset,
      db_counts: {
        GE: (geCount || 0) + (geneveCount || 0),
        VD: (vdCount || 0) + (vaudCount || 0),
      },
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
