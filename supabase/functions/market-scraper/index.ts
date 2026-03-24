import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Types ──────────────────────────────────────────────────

interface ScrapeRequest {
  price_min: number
  price_max: number
  cantons?: string[] | null  // null = accept all
  sort_by?: string     // e.g. 'createdAt', 'salePrice', 'salePricePerLivingSurface'
  sort_dir?: string    // 'ASC' | 'DESC'
}

interface ScrapeResult {
  listings_created: number
  listings_updated: number
  listings_skipped: number
  price_changes: number
  total_api: number
  total_fetched: number
  price_range: string
}

// ── Canton mapping ─────────────────────────────────────────

const CANTON_MAP: Record<string, string> = {
  'Genève': 'GE', 'Geneva': 'GE', 'Genf': 'GE',
  'Vaud': 'VD', 'Waadt': 'VD',
}

const TYPE_MAP: Record<string, string> = {
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
    if (params.price_min == null || params.price_max == null) {
      return new Response(
        JSON.stringify({ error: 'price_min and price_max are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const cantonFilter = params.cantons || null // null = accept all cantons
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Fetch from RealAdvisor JSON API with price range + optional sort
    let apiUrl = `https://realadvisor.ch/api/listings?offerType_eq=buy&salePrice_gte=${params.price_min}&salePrice_lte=${params.price_max}&limit=36`
    if (params.sort_by) apiUrl += `&sortBy=${params.sort_by}`
    if (params.sort_dir) apiUrl += `&sortDirection=${params.sort_dir}`
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
    })

    if (!response.ok) throw new Error(`API returned ${response.status}`)

    const data = await response.json()
    const apiListings = data.listings || []

    const result: ScrapeResult = {
      listings_created: 0, listings_updated: 0, listings_skipped: 0,
      price_changes: 0,
      total_api: data.total_count || 0,
      total_fetched: apiListings.length,
      price_range: `${params.price_min}-${params.price_max}`,
    }

    for (const item of apiListings) {
      const stateName = item.state || ''
      const cantonCode = CANTON_MAP[stateName]
      // If cantonFilter is set, skip listings outside those cantons
      if (cantonFilter && !cantonFilter.includes(stateName) && !cantonFilter.includes(cantonCode || '')) {
        result.listings_skipped++
        continue
      }

      const sourceId = String(item.id)
      const salePrice = item.sale_price || 0
      if (salePrice <= 0) { result.listings_skipped++; continue }

      // Build CDN photo URLs
      const photos: string[] = []
      if (Array.isArray(item.images)) {
        for (const img of item.images.slice(0, 15)) {
          const url = buildImageUrl(img)
          if (url) photos.push(url)
        }
      }

      const rawType = item.property_main_type || item.property_type || 'APPT'
      const canton = cantonCode || stateName
      const title = item.translated_titles?.fr || item.title || ''

      // Dedup check
      const { data: existing } = await supabase
        .from('market_listings').select('id, current_price')
        .eq('source_id', sourceId).maybeSingle()

      if (existing) {
        const updates: Record<string, unknown> = {
          last_seen_at: new Date().toISOString(),
          title, agency_name: item.agency_name,
          photos, photos_count: photos.length,
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
        const description = item.description && typeof item.description === 'string'
          ? item.description.replace(/<[^>]+>/g, '').substring(0, 2000) : null

        await supabase.from('market_listings').insert({
          canton, city: item.locality || '', postal_code: item.postcode || null,
          address: item.address || '', lat: item.lat || null, lng: item.lng || null,
          title, description, type: TYPE_MAP[rawType] || 'apartment',
          transaction_type: 'buy', price: salePrice,
          price_at_first_seen: salePrice, current_price: salePrice,
          price_per_m2: item.sale_price_per_living_surface || null,
          rooms: item.number_of_rooms || null,
          bedrooms: item.number_of_bedrooms || null,
          bathrooms: item.number_of_bathrooms || null,
          surface_m2: item.living_surface || item.computed_surface || null,
          floor: item.floor || null, features: '[]',
          photos, photos_count: photos.length,
          source_portal: item.portal || 'realadvisor',
          source_url: `https://realadvisor.ch/fr/acheter/bien-immobilier/${sourceId}`,
          source_id: sourceId, agency_name: item.agency_name || null,
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
