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
  property_type: string  // 'appartement' | 'maison' | 'villa' | 'bien-immobilier'
  zone: string           // 'canton-geneve' | 'carouge' | etc.
}

interface ScrapeResult {
  listings_created: number
  listings_updated: number
  photos_uploaded: number
  price_changes: number
  total_found: number
  zone: string
  property_type: string
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
  photo_urls: string[]
  source_url: string
  source_portal: string
  agency_name: string | null
  agency_phone: string | null
  price_per_m2: number | null
}

const TYPE_NORMALIZE: Record<string, string> = {
  'APARTMENT': 'apartment', 'APPT': 'apartment', 'apartment': 'apartment',
  'HOUSE': 'house', 'house': 'house',
  'VILLA': 'villa', 'villa': 'villa',
  'COMMERCIAL': 'commercial', 'commercial': 'commercial',
  'LAND': 'land', 'land': 'land',
}

// ── RealAdvisor Image URL builder ──────────────────────────

function buildImageUrl(fileName: string): string | null {
  if (!fileName) return null
  const encodedPath = btoa(`https://storage.googleapis.com/aggregator-images/${fileName}`)
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `https://img.realadvisor.ch/_/rs:fill:1200:800:1:0/q:75/${encodedPath}.webp`
}

// ── RSC Parser v2 — regex field extraction ─────────────────
// RealAdvisor uses RSC references ($xx) that break JSON parsing.
// Instead we find each listing by {"id":DIGITS,"created_at" and
// extract fields individually via regex from a surrounding window.

function parseListingsFromHtml(html: string, sourceUrl: string, canton: string): ParsedListing[] {
  const chunkRegex = /self\.__next_f\.push\(\[1,"(.*?)"\]\)/g
  let allText = ''
  let chunkMatch: RegExpExecArray | null
  while ((chunkMatch = chunkRegex.exec(html)) !== null) {
    try { allText += JSON.parse('"' + chunkMatch[1] + '"') } catch { /* skip */ }
  }

  const listings: ParsedListing[] = []
  const seenIds = new Set<string>()
  const idRegex = /\{"id":(\d{6,}),"created_at"/g
  let idMatch: RegExpExecArray | null

  while ((idMatch = idRegex.exec(allText)) !== null) {
    const listingId = idMatch[1]
    if (seenIds.has(listingId)) continue

    const start = idMatch.index
    const window = allText.substring(start, start + 8000)

    const extract = (pattern: RegExp): string | null => {
      const m = pattern.exec(window)
      return m ? m[1] : null
    }

    const salePrice = extract(/"sale_price":(\d+)/)
    if (!salePrice || salePrice === '0') continue
    seenIds.add(listingId)

    // Extract image file_names
    const photoUrls: string[] = []
    const fileNameRegex = /"file_name":"([^"]+)"/g
    let fm: RegExpExecArray | null
    while ((fm = fileNameRegex.exec(window)) !== null) {
      const url = buildImageUrl(fm[1])
      if (url) photoUrls.push(url)
    }

    const rawType = extract(/"property_main_type":"([^"]+)"/) || 'APPT'

    listings.push({
      source_id: listingId,
      title: extract(/"title":"([^"]+)"/) || '',
      price: parseInt(salePrice),
      address: extract(/"address":"([^"]+)"/) || '',
      city: extract(/"locality":"([^"]+)"/) || '',
      canton: extract(/"state":"([^"]+)"/) || canton,
      postal_code: extract(/"postcode":"([^"]+)"/),
      lat: extract(/"lat":([\d.-]+)/) ? parseFloat(extract(/"lat":([\d.-]+)/)!) : null,
      lng: extract(/"lng":([\d.-]+)/) ? parseFloat(extract(/"lng":([\d.-]+)/)!) : null,
      rooms: extract(/"number_of_rooms":([\d.]+)/) ? parseFloat(extract(/"number_of_rooms":([\d.]+)/)!) : null,
      bedrooms: extract(/"number_of_bedrooms":(\d+)/) ? parseInt(extract(/"number_of_bedrooms":(\d+)/)!) : null,
      bathrooms: extract(/"number_of_bathrooms":(\d+)/) ? parseInt(extract(/"number_of_bathrooms":(\d+)/)!) : null,
      surface_m2: extract(/"living_surface":([\d.]+)/) ? parseFloat(extract(/"living_surface":([\d.]+)/)!) : null,
      floor: extract(/"floor":(\d+)/) ? parseInt(extract(/"floor":(\d+)/)!) : null,
      type: TYPE_NORMALIZE[rawType] || 'apartment',
      description: null,
      photo_urls: photoUrls,
      source_url: sourceUrl,
      source_portal: extract(/"portal":"([^"]+)"/) || 'realadvisor',
      agency_name: extract(/"agency_name":"([^"]+)"/),
      agency_phone: extract(/"agency_contact_phone_number":"([^"]+)"/),
      price_per_m2: extract(/"sale_price_per_living_surface":([\d.]+)/) ? parseFloat(extract(/"sale_price_per_living_surface":([\d.]+)/)!) : null,
    })
  }

  return listings
}

// ── R2 Upload ──────────────────────────────────────────────

async function uploadPhotoToR2(
  r2Client: AwsClient, r2Endpoint: string, r2Bucket: string,
  r2PublicUrl: string, photoUrl: string, r2Path: string
): Promise<string | null> {
  try {
    const resp = await fetch(photoUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'image/*,*/*;q=0.8' },
    })
    if (!resp.ok) return null
    const data = await resp.arrayBuffer()
    if (data.byteLength < 100) return null
    const uploadResp = await r2Client.fetch(`${r2Endpoint}/${r2Bucket}/${r2Path}`, {
      method: 'PUT', body: data, headers: { 'Content-Type': 'image/webp' },
    })
    if (!uploadResp.ok) return null
    return `${r2PublicUrl}/${r2Path}`
  } catch { return null }
}

// ── Main Handler ───────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const params: ScrapeRequest = await req.json()
    if (!params.canton || !params.zone || !params.property_type) {
      return new Response(
        JSON.stringify({ error: 'canton, zone, and property_type are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const r2Client = new AwsClient({
      accessKeyId: Deno.env.get('R2_ACCESS_KEY_ID')!,
      secretAccessKey: Deno.env.get('R2_SECRET_ACCESS_KEY')!,
    })
    const r2Endpoint = Deno.env.get('R2_ENDPOINT')!
    const r2Bucket = Deno.env.get('R2_BUCKET_NAME')!
    const r2PublicUrl = Deno.env.get('R2_PUBLIC_URL')!

    const url = `https://realadvisor.ch/fr/acheter/${params.property_type}/${params.zone}`
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'fr-CH,fr;q=0.9',
        'Accept-Encoding': 'identity',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
      },
    })

    if (!response.ok) throw new Error(`RealAdvisor returned ${response.status} for ${url}`)

    const html = await response.text()
    const parsed = parseListingsFromHtml(html, url, params.canton)

    const result: ScrapeResult = {
      listings_created: 0, listings_updated: 0,
      photos_uploaded: 0, price_changes: 0,
      total_found: parsed.length,
      zone: params.zone, property_type: params.property_type, canton: params.canton,
    }

    for (const listing of parsed) {
      const { data: existing } = await supabase
        .from('market_listings').select('id, current_price, photos')
        .eq('source_id', listing.source_id).maybeSingle()

      const r2Photos: string[] = []
      if (!existing || (existing.photos as string[] || []).length === 0) {
        for (let i = 0; i < listing.photo_urls.length; i++) {
          const r2Path = `${params.canton.toLowerCase()}/${listing.source_id}/photo-${i}.webp`
          const r2Url = await uploadPhotoToR2(r2Client, r2Endpoint, r2Bucket, r2PublicUrl, listing.photo_urls[i], r2Path)
          if (r2Url) { r2Photos.push(r2Url); result.photos_uploaded++ }
        }
      }

      if (existing) {
        const updates: Record<string, unknown> = {
          last_seen_at: new Date().toISOString(), title: listing.title, agency_name: listing.agency_name,
        }
        if (r2Photos.length > 0) { updates.photos = r2Photos; updates.photos_count = r2Photos.length }
        const oldPrice = Number(existing.current_price) || 0
        if (oldPrice > 0 && listing.price > 0 && oldPrice !== listing.price) {
          await supabase.from('market_price_history').insert({
            market_listing_id: existing.id, old_price: oldPrice, new_price: listing.price,
            change_pct: Math.round(((listing.price - oldPrice) / oldPrice) * 10000) / 100,
          })
          updates.current_price = listing.price; updates.price = listing.price
          updates.status = listing.price < oldPrice ? 'price_reduced' : 'active'
          result.price_changes++
        }
        await supabase.from('market_listings').update(updates).eq('id', existing.id)
        result.listings_updated++
      } else {
        await supabase.from('market_listings').insert({
          canton: listing.canton || params.canton, city: listing.city,
          postal_code: listing.postal_code, address: listing.address,
          lat: listing.lat, lng: listing.lng, title: listing.title,
          description: listing.description, type: listing.type,
          transaction_type: 'buy', price: listing.price,
          price_at_first_seen: listing.price, current_price: listing.price,
          price_per_m2: listing.price_per_m2, rooms: listing.rooms,
          bedrooms: listing.bedrooms, bathrooms: listing.bathrooms,
          surface_m2: listing.surface_m2, floor: listing.floor, features: '[]',
          photos: r2Photos, photos_count: r2Photos.length,
          source_portal: listing.source_portal, source_url: listing.source_url,
          source_id: listing.source_id, agency_name: listing.agency_name,
          agency_phone: listing.agency_phone, status: 'active',
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
