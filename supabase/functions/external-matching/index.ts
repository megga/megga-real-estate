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
  source_url: string
  source_portal: string
  source_agency: string | null
  source_logo_url: string | null
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
} | null): string | null {
  if (!image || !image.file_name) return null
  // RealAdvisor serves images via img.realadvisor.ch with imgproxy
  const encodedPath = btoa(`https://storage.googleapis.com/${image.bucket_name || 'aggregator-images'}/${image.file_name}`)
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `https://img.realadvisor.ch/_/rs:fill:600:400:1:0/q:60/${encodedPath}.webp`
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

        // Build image URL from first image
        const photoUrl = item.images?.[0]
          ? buildImageUrl(item.images[0])
          : null

        // Source URL: link to the search results page (detail pages use encrypted clickout URLs)
        listings.push({
          external_id: String(item.id),
          title: item.title || item.translated_titles?.fr || '',
          price: item.sale_price || 0,
          address: item.address || '',
          city: item.locality || item.sub_locality || '',
          canton: item.state || '',
          rooms: item.number_of_rooms || null,
          surface_m2: item.living_surface || item.computed_surface || null,
          type: item.property_main_type || item.property_type || '',
          photo_url: photoUrl,
          source_url: searchUrl,
          source_portal: item.portal || 'realadvisor',
          source_agency: item.agency_name || null,
          source_logo_url: item.agency_logo_url || null,
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
