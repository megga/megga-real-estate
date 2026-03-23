import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

interface ExternalSearchParams {
  zone: string
  type: string
  budget_max: number
  budget_min?: number
  rooms_min?: number
  rooms_max?: number
}

interface ExternalListing {
  external_id: string
  title: string
  price: number
  address: string
  city: string
  canton: string
  rooms: number | null
  surface_m2: number | null
  type: string
  photo_url: string | null
  photos: string[]
  source_url: string
  source_portal: string
  source_agency: string | null
  source_logo_url: string | null
  // Enriched fields (Niveau 2)
  description: string | null
  property_type_detail: string | null
  construction_year: number | null
  renovation_year: number | null
  bathrooms: number | null
  land_surface: number | null
  parking: number | null
  price_per_m2: number | null
  lat: number | null
  lng: number | null
  postcode: string | null
  agency_phone: string | null
  visit_contact: string | null
}

const ZONE_SLUGS: Record<string, string> = {
  // Cantons
  'GE': 'canton-geneve',
  'VD': 'canton-vaud',
  'VS': 'canton-valais',
  'NE': 'canton-neuchatel',
  'FR': 'canton-fribourg',
  'BE': 'canton-berne',
  'JU': 'canton-jura',
  'BS': 'canton-bale-ville',
  'BL': 'canton-bale-campagne',
  'AG': 'canton-argovie',
  'SO': 'canton-soleure',
  'ZH': 'canton-zurich',
  'LU': 'canton-lucerne',
  'ZG': 'canton-zoug',
  'SZ': 'canton-schwyz',
  'NW': 'canton-nidwald',
  'OW': 'canton-obwald',
  'UR': 'canton-uri',
  'GL': 'canton-glaris',
  'SH': 'canton-schaffhouse',
  'TG': 'canton-thurgovie',
  'AR': 'canton-appenzell-rhodes-exterieures',
  'AI': 'canton-appenzell-rhodes-interieures',
  'SG': 'canton-saint-gall',
  'GR': 'canton-grisons',
  'TI': 'canton-tessin',
  // Villes / quartiers courants
  'geneve': 'canton-geneve',
  'genève': 'canton-geneve',
  'lausanne': 'lausanne',
  'zurich': 'zurich',
  'berne': 'berne',
  'eaux-vives': 'eaux-vives',
  'champel': 'champel',
  'plainpalais': 'plainpalais',
  'carouge': 'carouge',
  'nyon': 'nyon',
  'morges': 'morges',
  'montreux': 'montreux',
  'sion': 'sion',
  'fribourg': 'fribourg',
}

const TYPE_SLUGS: Record<string, string> = {
  'apartment': 'appartement',
  'APARTMENT': 'appartement',
  'house': 'maison',
  'HOUSE': 'maison',
  'villa': 'villa',
  'VILLA': 'villa',
  'commercial': 'bien-immobilier',
  'land': 'bien-immobilier',
}

function resolveZoneSlug(zone: string): string {
  const trimmed = zone.trim()

  // 1. Exact match
  if (ZONE_SLUGS[trimmed]) return ZONE_SLUGS[trimmed]
  if (ZONE_SLUGS[trimmed.toLowerCase()]) return ZONE_SLUGS[trimmed.toLowerCase()]

  // 2. Normalize: remove accents, lowercase
  const normalized = trimmed.toLowerCase()
    .replace(/[éèêë]/g, 'e')
    .replace(/[àâä]/g, 'a')
    .replace(/[ùûü]/g, 'u')
    .replace(/[ôö]/g, 'o')
    .replace(/[îï]/g, 'i')
    .replace(/[ç]/g, 'c')

  // 3. Try each known slug as substring match (e.g. "Genève centre" contains "geneve")
  const knownZones: [string, string][] = [
    ['geneve', 'canton-geneve'], ['genève', 'canton-geneve'],
    ['lausanne', 'lausanne'], ['zurich', 'zurich'], ['berne', 'berne'],
    ['eaux-vives', 'eaux-vives'], ['champel', 'champel'],
    ['plainpalais', 'plainpalais'], ['carouge', 'carouge'],
    ['nyon', 'nyon'], ['morges', 'morges'], ['montreux', 'montreux'],
    ['sion', 'sion'], ['fribourg', 'fribourg'], ['florissant', 'quartier-florissant-malagnou'],
    ['malagnou', 'quartier-florissant-malagnou'], ['lancy', 'lancy'],
    ['vernier', 'vernier'], ['meyrin', 'meyrin'], ['onex', 'onex'],
    ['vevey', 'vevey'], ['neuchatel', 'neuchatel'], ['lugano', 'lugano'],
    ['bale', 'canton-bale-ville'], ['lucerne', 'canton-lucerne'],
  ]

  for (const [key, slug] of knownZones) {
    if (normalized.includes(key)) return slug
  }

  // 4. Fallback: slugify directly
  return normalized.replace(/\s+/g, '-')
}

function buildRealAdvisorUrl(params: ExternalSearchParams): string {
  const typeSlug = TYPE_SLUGS[params.type] || 'bien-immobilier'
  const zoneSlug = resolveZoneSlug(params.zone)

  const searchParams = new URLSearchParams()
  if (params.budget_max) searchParams.set('salePrice_lte', String(params.budget_max))
  if (params.budget_min) searchParams.set('salePrice_gte', String(params.budget_min))
  if (params.rooms_min) searchParams.set('numberOfRooms_gte', String(params.rooms_min))
  if (params.rooms_max) searchParams.set('numberOfRooms_lte', String(params.rooms_max))

  const qs = searchParams.toString()
  return `https://realadvisor.ch/fr/acheter/${typeSlug}/${zoneSlug}${qs ? '?' + qs : ''}`
}

function buildImageUrl(image: {
  file_name?: string
  bucket_name?: string
} | null, size: 'thumb' | 'large' = 'thumb'): string | null {
  if (!image || !image.file_name) return null
  const dims = size === 'large' ? 'rs:fill:1200:800:1:0/q:75' : 'rs:fill:600:400:1:0/q:60'
  const encodedPath = btoa(`https://storage.googleapis.com/${image.bucket_name || 'aggregator-images'}/${image.file_name}`)
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `https://img.realadvisor.ch/_/${dims}/${encodedPath}.webp`
}

function parseRealAdvisorResults(html: string, searchUrl: string): ExternalListing[] {
  const listings: ExternalListing[] = []

  // Extract RSC flight data chunks from self.__next_f.push([1,"..."]) calls
  const chunkRegex = /self\.__next_f\.push\(\[1,"(.*?)"\]\)/g
  let chunkMatch: RegExpExecArray | null

  while ((chunkMatch = chunkRegex.exec(html)) !== null) {
    let unescaped: string
    try {
      unescaped = JSON.parse('"' + chunkMatch[1] + '"')
    } catch {
      continue
    }

    // Find listing JSON objects in the RSC data
    // Pattern: {"listing":{"id":NUMBER,...}}
    const listingRegex = /\{"listing":\{"id":(\d+)/g
    let listingMatch: RegExpExecArray | null

    while ((listingMatch = listingRegex.exec(unescaped)) !== null) {
      // Extract the listing JSON object
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

        // Build all photo URLs (thumb for card, large for detail)
        const allPhotos: string[] = []
        if (Array.isArray(item.images)) {
          for (const img of item.images) {
            const url = buildImageUrl(img, 'large')
            if (url) allPhotos.push(url)
          }
        }
        const thumbUrl = item.images?.[0] ? buildImageUrl(item.images[0], 'thumb') : null

        // Resolve translated title (prefer FR)
        const title = item.translated_titles?.fr || item.title || ''

        // Description: RSC references like "$71" can't be resolved here
        // We pass null and handle descriptions separately if available
        const rawDesc = item.description
        const description = (typeof rawDesc === 'string' && !rawDesc.startsWith('$'))
          ? rawDesc
          : null

        listings.push({
          external_id: String(item.id),
          title,
          price: item.sale_price || 0,
          address: item.address || '',
          city: item.locality || item.sub_locality || '',
          canton: item.state || '',
          rooms: item.number_of_rooms || null,
          surface_m2: item.living_surface || item.computed_surface || null,
          type: item.property_main_type || item.property_type || '',
          photo_url: thumbUrl,
          photos: allPhotos,
          source_url: searchUrl,
          source_portal: item.portal || 'realadvisor',
          source_agency: item.agency_name || null,
          source_logo_url: item.agency_logo_url || null,
          // Enriched fields
          description,
          property_type_detail: item.property_type || null,
          construction_year: item.construction_year || null,
          renovation_year: item.renovation_year || null,
          bathrooms: item.number_of_bathrooms || null,
          land_surface: item.land_surface || null,
          parking: item.number_of_parking || null,
          price_per_m2: item.sale_price_per_living_surface || null,
          lat: item.lat || null,
          lng: item.lng || null,
          postcode: item.postcode || null,
          agency_phone: item.agency_contact_phone_number || null,
          visit_contact: item.visit_contact_person || null,
        })
      } catch {
        // Skip malformed listing
      }
    }
  }

  return listings
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  try {
    const params: ExternalSearchParams = await req.json()

    if (!params.zone || !params.budget_max) {
      return new Response(JSON.stringify({
        error: 'zone and budget_max are required',
        listings: [],
        count: 0,
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Build URL and fetch
    const url = buildRealAdvisorUrl(params)

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
      throw new Error(`RealAdvisor returned ${response.status}`)
    }

    const html = await response.text()
    const listings = parseRealAdvisorResults(html, url)

    return new Response(JSON.stringify({
      listings,
      source: 'realadvisor',
      source_url: url,
      fetched_at: new Date().toISOString(),
      count: listings.length,
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({
      error: message,
      listings: [],
      count: 0,
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }
})
