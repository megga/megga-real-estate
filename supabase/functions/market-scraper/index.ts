import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.18'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Types ──────────────────────────────────────────────────

interface ScrapeRequest {
  canton: 'GE' | 'VD'
  city: string       // City slug to scan (e.g. 'carouge', 'geneve')
}

interface ScrapeResult {
  listings_created: number
  listings_updated: number
  photos_uploaded: number
  price_changes: number
  total_found: number
  city: string
  canton: string
}

interface ParsedListing {
  source_id: string
  title: string
  price: number
  address: string
  city: string
  canton: string
  postal_code: string | null
  lat: number | null
  lng: number | null
  rooms: number | null
  bedrooms: number | null
  bathrooms: number | null
  surface_m2: number | null
  floor: number | null
  type: string
  description: string | null
  features: Record<string, unknown>[]
  photo_urls: string[]
  source_url: string
  source_portal: string
  agency_name: string | null
  agency_phone: string | null
  price_per_m2: number | null
}

const TYPE_MAP: Record<string, string> = {
  'APARTMENT': 'apartment', 'apartment': 'apartment', 'APPT': 'apartment',
  'HOUSE': 'house', 'house': 'house',
  'VILLA': 'villa', 'villa': 'villa',
  'COMMERCIAL': 'commercial', 'commercial': 'commercial',
  'LAND': 'land', 'land': 'land',
}

// ── RealAdvisor Image URL builder ──────────────────────────

function buildImageUrl(
  image: { file_name?: string; bucket_name?: string } | null,
  size: 'thumb' | 'large' = 'large'
): string | null {
  if (!image || !image.file_name) return null
  const dims = size === 'large' ? 'rs:fill:1200:800:1:0/q:75' : 'rs:fill:600:400:1:0/q:60'
  const encodedPath = btoa(
    `https://storage.googleapis.com/${image.bucket_name || 'aggregator-images'}/${image.file_name}`
  )
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `https://img.realadvisor.ch/_/${dims}/${encodedPath}.webp`
}

// ── URL builder — uses landing page pattern (search endpoint returns 403) ──

function buildUrl(city: string): string {
  return `https://realadvisor.ch/fr/acheter/bien-immobilier/${city}`
}

// ── RSC Flight Data Parser ─────────────────────────────────

function parseRscListings(html: string, sourceUrl: string, canton: string): ParsedListing[] {
  const listings: ParsedListing[] = []
  const seenIds = new Set<string>()

  const chunkRegex = /self\.__next_f\.push\(\[1,"(.*?)"\]\)/g
  let chunkMatch: RegExpExecArray | null

  while ((chunkMatch = chunkRegex.exec(html)) !== null) {
    let unescaped: string
    try {
      unescaped = JSON.parse('"' + chunkMatch[1] + '"')
    } catch {
      continue
    }

    const listingRegex = /\{"listing":\{"id":(\d+)/g
    let listingMatch: RegExpExecArray | null

    while ((listingMatch = listingRegex.exec(unescaped)) !== null) {
      const startPos = listingMatch.index + '{"listing":'.length
      let braceCount = 0
      let endPos = startPos

      for (let i = startPos; i < unescaped.length; i++) {
        if (unescaped[i] === '{') braceCount++
        else if (unescaped[i] === '}') {
          braceCount--
          if (braceCount === 0) {
            endPos = i + 1
            break
          }
        }
      }

      try {
        const listingJson = unescaped.substring(startPos, endPos)
        const item = JSON.parse(listingJson)
        const id = String(item.id)

        if (seenIds.has(id)) continue
        seenIds.add(id)

        const photoUrls: string[] = []
        if (Array.isArray(item.images)) {
          for (const img of item.images) {
            const url = buildImageUrl(img, 'large')
            if (url) photoUrls.push(url)
          }
        }

        const title = item.translated_titles?.fr || item.title || ''
        const rawDesc = item.description
        const description = (typeof rawDesc === 'string' && !rawDesc.startsWith('$'))
          ? rawDesc : null

        const rawType = item.property_main_type || item.property_type || 'apartment'
        const normalizedType = TYPE_MAP[rawType] || 'apartment'

        listings.push({
          source_id: id,
          title,
          price: item.sale_price || 0,
          address: item.address || '',
          city: item.locality || item.sub_locality || '',
          canton: item.state || canton,
          postal_code: item.postcode || null,
          lat: item.lat || null,
          lng: item.lng || null,
          rooms: item.number_of_rooms || null,
          bedrooms: item.number_of_bedrooms || null,
          bathrooms: item.number_of_bathrooms || null,
          surface_m2: item.living_surface || item.computed_surface || null,
          floor: item.floor || null,
          type: normalizedType,
          description,
          features: [],
          photo_urls: photoUrls,
          source_url: sourceUrl,
          source_portal: item.portal || 'realadvisor',
          agency_name: item.agency_name || null,
          agency_phone: item.agency_contact_phone_number || null,
          price_per_m2: item.sale_price_per_living_surface || null,
        })
      } catch {
        // Skip malformed listing
      }
    }
  }

  return listings
}

// ── R2 Upload ──────────────────────────────────────────────

async function uploadPhotoToR2(
  r2Client: AwsClient,
  r2Endpoint: string,
  r2Bucket: string,
  r2PublicUrl: string,
  photoUrl: string,
  r2Path: string
): Promise<string | null> {
  try {
    const response = await fetch(photoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'image/webp,image/avif,image/*,*/*;q=0.8',
      },
    })
    if (!response.ok) return null

    const imageData = await response.arrayBuffer()
    if (imageData.byteLength < 100) return null

    const uploadUrl = `${r2Endpoint}/${r2Bucket}/${r2Path}`
    const uploadResponse = await r2Client.fetch(uploadUrl, {
      method: 'PUT',
      body: imageData,
      headers: { 'Content-Type': 'image/webp' },
    })

    if (!uploadResponse.ok) return null
    return `${r2PublicUrl}/${r2Path}`
  } catch {
    return null
  }
}

// ── Main Handler ───────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const params: ScrapeRequest = await req.json()

    if (!params.canton || !params.city) {
      return new Response(
        JSON.stringify({ error: 'canton and city are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const r2Client = new AwsClient({
      accessKeyId: Deno.env.get('R2_ACCESS_KEY_ID')!,
      secretAccessKey: Deno.env.get('R2_SECRET_ACCESS_KEY')!,
    })
    const r2Endpoint = Deno.env.get('R2_ENDPOINT')!
    const r2Bucket = Deno.env.get('R2_BUCKET_NAME')!
    const r2PublicUrl = Deno.env.get('R2_PUBLIC_URL')!

    // Fetch RealAdvisor landing page (search endpoint returns 403)
    const url = buildUrl(params.city)
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'fr-CH,fr;q=0.9,en;q=0.8',
        'Accept-Encoding': 'identity',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
      },
    })

    if (!response.ok) {
      throw new Error(`RealAdvisor returned ${response.status} for ${url}`)
    }

    const html = await response.text()
    const parsed = parseRscListings(html, url, params.canton)

    const result: ScrapeResult = {
      listings_created: 0,
      listings_updated: 0,
      photos_uploaded: 0,
      price_changes: 0,
      total_found: parsed.length,
      city: params.city,
      canton: params.canton,
    }

    for (const listing of parsed) {
      if (listing.price <= 0) continue

      const { data: existing } = await supabase
        .from('market_listings')
        .select('id, current_price, photos')
        .eq('source_id', listing.source_id)
        .maybeSingle()

      // Upload ALL photos to R2 (only for new listings or those without photos)
      const r2Photos: string[] = []
      if (!existing || (existing.photos as string[] || []).length === 0) {
        for (let i = 0; i < listing.photo_urls.length; i++) {
          const r2Path = `${params.canton.toLowerCase()}/${listing.source_id}/photo-${i}.webp`
          const r2Url = await uploadPhotoToR2(
            r2Client, r2Endpoint, r2Bucket, r2PublicUrl,
            listing.photo_urls[i], r2Path
          )
          if (r2Url) {
            r2Photos.push(r2Url)
            result.photos_uploaded++
          }
        }
      }

      if (existing) {
        const updates: Record<string, unknown> = {
          last_seen_at: new Date().toISOString(),
          title: listing.title,
          description: listing.description,
          agency_name: listing.agency_name,
          agency_phone: listing.agency_phone,
        }

        if (r2Photos.length > 0) {
          updates.photos = r2Photos
          updates.photos_count = r2Photos.length
        }

        const oldPrice = Number(existing.current_price) || 0
        const newPrice = listing.price
        if (oldPrice > 0 && newPrice > 0 && oldPrice !== newPrice) {
          const changePct = ((newPrice - oldPrice) / oldPrice) * 100
          await supabase.from('market_price_history').insert({
            market_listing_id: existing.id,
            old_price: oldPrice,
            new_price: newPrice,
            change_pct: Math.round(changePct * 100) / 100,
          })
          updates.current_price = newPrice
          updates.price = newPrice
          updates.price_per_m2 = listing.price_per_m2
          updates.status = newPrice < oldPrice ? 'price_reduced' : 'active'
          result.price_changes++
        }

        await supabase.from('market_listings').update(updates).eq('id', existing.id)
        result.listings_updated++
      } else {
        await supabase.from('market_listings').insert({
          canton: listing.canton || params.canton,
          city: listing.city,
          postal_code: listing.postal_code,
          address: listing.address,
          lat: listing.lat, lng: listing.lng,
          title: listing.title,
          description: listing.description,
          type: listing.type,
          transaction_type: 'buy',
          price: listing.price,
          price_at_first_seen: listing.price,
          current_price: listing.price,
          price_per_m2: listing.price_per_m2,
          rooms: listing.rooms,
          bedrooms: listing.bedrooms,
          bathrooms: listing.bathrooms,
          surface_m2: listing.surface_m2,
          floor: listing.floor,
          features: listing.features,
          photos: r2Photos,
          photos_count: r2Photos.length,
          source_portal: listing.source_portal,
          source_url: listing.source_url,
          source_id: listing.source_id,
          agency_name: listing.agency_name,
          agency_phone: listing.agency_phone,
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
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
