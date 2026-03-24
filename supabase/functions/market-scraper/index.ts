import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Types ──────────────────────────────────────────────────

interface ScrapeRequest {
  offset?: number  // Pagination offset (default 0)
  limit?: number   // Items per page (default 36, max 36)
  cantons?: string[]  // Filter: only keep these cantons (e.g. ['Genève', 'Vaud'])
}

interface ScrapeResult {
  listings_created: number
  listings_updated: number
  listings_skipped: number
  photos_found: number
  price_changes: number
  total_found: number
  total_api: number
  offset: number
}

// ── Canton name mapping (API uses full German/French names) ──

const CANTON_MAP: Record<string, string> = {
  'Genève': 'GE', 'Geneva': 'GE', 'Genf': 'GE',
  'Vaud': 'VD', 'Waadt': 'VD',
}

const TYPE_NORMALIZE: Record<string, string> = {
  'APARTMENT': 'apartment', 'APPT': 'apartment', 'apartment': 'apartment',
  'HOUSE': 'house', 'house': 'house',
  'VILLA': 'villa', 'villa': 'villa',
  'COMMERCIAL': 'commercial', 'commercial': 'commercial',
  'LAND': 'land', 'land': 'land',
}

// ── Image URL builder ──────────────────────────────────────

function buildImageUrl(image: { file_name?: string; bucket_name?: string }): string | null {
  if (!image?.file_name) return null
  const bucket = image.bucket_name || 'aggregator-images'
  const encodedPath = btoa(`https://storage.googleapis.com/${bucket}/${image.file_name}`)
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `https://img.realadvisor.ch/_/rs:fill:1200:800:1:0/q:75/${encodedPath}.webp`
}

// ── Main Handler ───────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const params: ScrapeRequest = await req.json()
    const offset = params.offset || 0
    const limit = Math.min(params.limit || 36, 36)
    const cantonFilter = params.cantons || ['Genève', 'Vaud']

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    // ── Fetch from RealAdvisor JSON API ──
    const apiUrl = `https://realadvisor.ch/api/listings?offerType_eq=buy&limit=${limit}&offset=${offset}`
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    })

    if (!response.ok) {
      throw new Error(`RealAdvisor API returned ${response.status}`)
    }

    const data = await response.json()
    const apiListings = data.listings || []
    const totalApi = data.total_count || 0

    const result: ScrapeResult = {
      listings_created: 0, listings_updated: 0, listings_skipped: 0,
      photos_found: 0, price_changes: 0,
      total_found: apiListings.length, total_api: totalApi, offset,
    }

    for (const item of apiListings) {
      // Filter by canton
      const stateName = item.state || ''
      const cantonCode = CANTON_MAP[stateName]
      if (!cantonFilter.includes(stateName) && !cantonFilter.includes(cantonCode)) {
        result.listings_skipped++
        continue
      }

      const sourceId = String(item.id)
      const salePrice = item.sale_price || 0
      if (salePrice <= 0) { result.listings_skipped++; continue }

      // Build photo URLs from images array
      const photoUrls: string[] = []
      if (Array.isArray(item.images)) {
        for (const img of item.images) {
          const url = buildImageUrl(img)
          if (url) photoUrls.push(url)
        }
      }

      const rawType = item.property_main_type || item.property_type || 'APPT'
      const canton = cantonCode || stateName

      // Check if exists (dedup by source_id)
      const { data: existing } = await supabase
        .from('market_listings').select('id, current_price, photos')
        .eq('source_id', sourceId).maybeSingle()

      // Use RealAdvisor CDN URLs directly (R2 upload deferred to background job)
      const photoUrlsFinal = photoUrls.slice(0, 15)

      if (existing) {
        const updates: Record<string, unknown> = {
          last_seen_at: new Date().toISOString(),
          title: item.title || '',
          agency_name: item.agency_name,
          photos: photoUrlsFinal,
          photos_count: photoUrlsFinal.length,
        }

        const oldPrice = Number(existing.current_price) || 0
        if (oldPrice > 0 && salePrice > 0 && oldPrice !== salePrice) {
          await supabase.from('market_price_history').insert({
            market_listing_id: existing.id, old_price: oldPrice, new_price: salePrice,
            change_pct: Math.round(((salePrice - oldPrice) / oldPrice) * 10000) / 100,
          })
          updates.current_price = salePrice
          updates.price = salePrice
          updates.status = salePrice < oldPrice ? 'price_reduced' : 'active'
          result.price_changes++
        }
        await supabase.from('market_listings').update(updates).eq('id', existing.id)
        result.listings_updated++
      } else {
        const title = item.translated_titles?.fr || item.title || ''
        await supabase.from('market_listings').insert({
          canton,
          city: item.locality || item.sub_locality || '',
          postal_code: item.postcode || null,
          address: item.address || '',
          lat: item.lat || null, lng: item.lng || null,
          title,
          description: (item.description && !item.description.startsWith('$'))
            ? item.description.substring(0, 2000) : null,
          type: TYPE_NORMALIZE[rawType] || 'apartment',
          transaction_type: 'buy',
          price: salePrice, price_at_first_seen: salePrice, current_price: salePrice,
          price_per_m2: item.sale_price_per_living_surface || null,
          rooms: item.number_of_rooms || null,
          bedrooms: item.number_of_bedrooms || null,
          bathrooms: item.number_of_bathrooms || null,
          surface_m2: item.living_surface || item.computed_surface || null,
          floor: item.floor || null, features: '[]',
          photos: photoUrlsFinal, photos_count: photoUrlsFinal.length,
          source_portal: item.portal || 'realadvisor',
          source_url: item.clickout_url?.url || `https://realadvisor.ch/fr/acheter/bien-immobilier/${sourceId}`,
          source_id: sourceId,
          agency_name: item.agency_name || null,
          agency_phone: item.agency_contact_phone_number || null,
          status: 'active',
        })
        result.listings_created++
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
