import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Price segments to bypass the ~756 listing cap per query ──
// RealAdvisor limits to ~21 pages (756 listings) per search.
// We split by price range so each segment stays under the cap.
const PRICE_SEGMENTS = [
  { min: 0, max: 500000, label: '0-500K' },
  { min: 500000, max: 800000, label: '500K-800K' },
  { min: 800000, max: 1200000, label: '800K-1.2M' },
  { min: 1200000, max: 2000000, label: '1.2M-2M' },
  { min: 2000000, max: 3500000, label: '2M-3.5M' },
  { min: 3500000, max: 5000000, label: '3.5M-5M' },
  { min: 5000000, max: 10000000, label: '5M-10M' },
  { min: 10000000, max: 0, label: '10M+' }, // max=0 means no upper limit
]

const MAX_PAGES_PER_SEGMENT = 21 // RealAdvisor hard cap

interface BatchRequest {
  canton: 'GE' | 'VD'
}

interface SegmentResult {
  segment: string
  pages_scanned: number
  listings_found: number
  listings_created: number
  listings_updated: number
  photos_uploaded: number
  price_changes: number
  errors: string[]
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

    if (!params.canton) {
      return new Response(
        JSON.stringify({ error: 'canton is required (GE or VD)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const segmentResults: SegmentResult[] = []
    let grandTotalFound = 0
    let grandTotalCreated = 0
    let grandTotalUpdated = 0
    let grandTotalPhotos = 0
    let grandTotalPriceChanges = 0

    // ── Scan each price segment with full pagination ──
    for (const segment of PRICE_SEGMENTS) {
      const segResult: SegmentResult = {
        segment: segment.label,
        pages_scanned: 0,
        listings_found: 0,
        listings_created: 0,
        listings_updated: 0,
        photos_uploaded: 0,
        price_changes: 0,
        errors: [],
      }

      for (let page = 1; page <= MAX_PAGES_PER_SEGMENT; page++) {
        try {
          const body: Record<string, unknown> = {
            canton: params.canton,
            page,
          }
          if (segment.min > 0) body.price_min = segment.min
          if (segment.max > 0) body.price_max = segment.max

          const scraperResponse = await fetch(
            `${supabaseUrl}/functions/v1/market-scraper`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${serviceRoleKey}`,
              },
              body: JSON.stringify(body),
            }
          )

          if (!scraperResponse.ok) {
            const errorText = await scraperResponse.text()
            segResult.errors.push(`Page ${page}: HTTP ${scraperResponse.status} — ${errorText}`)
            break // Stop this segment on error
          }

          const result = await scraperResponse.json()
          const found = result.total_found || 0

          segResult.pages_scanned++
          segResult.listings_found += found
          segResult.listings_created += result.listings_created || 0
          segResult.listings_updated += result.listings_updated || 0
          segResult.photos_uploaded += result.photos_uploaded || 0
          segResult.price_changes += result.price_changes || 0

          console.log(
            `[${params.canton}] ${segment.label} page ${page}: ${found} found, ` +
            `${result.listings_created || 0} new, ${result.listings_updated || 0} updated, ` +
            `${result.photos_uploaded || 0} photos`
          )

          // Stop pagination if no results on this page
          if (found === 0) {
            console.log(`[${params.canton}] ${segment.label}: no more results after page ${page - 1}`)
            break
          }

          // Rate limiting: 2s delay between pages
          if (page < MAX_PAGES_PER_SEGMENT && found > 0) {
            await sleep(2000)
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error'
          segResult.errors.push(`Page ${page}: ${message}`)
          break
        }
      }

      grandTotalFound += segResult.listings_found
      grandTotalCreated += segResult.listings_created
      grandTotalUpdated += segResult.listings_updated
      grandTotalPhotos += segResult.photos_uploaded
      grandTotalPriceChanges += segResult.price_changes
      segmentResults.push(segResult)

      console.log(
        `[${params.canton}] ✓ Segment ${segment.label} done: ` +
        `${segResult.pages_scanned} pages, ${segResult.listings_found} found, ` +
        `${segResult.listings_created} new`
      )

      // Small delay between segments
      await sleep(1000)
    }

    // ── Mark stale listings as removed ──
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { count: removedCount } = await supabase
      .from('market_listings')
      .update({ status: 'removed' })
      .eq('canton', params.canton)
      .eq('status', 'active')
      .lt('last_seen_at', sevenDaysAgo)
      .select('id', { count: 'exact', head: true })

    return new Response(JSON.stringify({
      canton: params.canton,
      segments_scanned: PRICE_SEGMENTS.length,
      grand_total_found: grandTotalFound,
      grand_total_created: grandTotalCreated,
      grand_total_updated: grandTotalUpdated,
      grand_total_photos: grandTotalPhotos,
      grand_total_price_changes: grandTotalPriceChanges,
      listings_removed: removedCount || 0,
      segment_results: segmentResults,
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
