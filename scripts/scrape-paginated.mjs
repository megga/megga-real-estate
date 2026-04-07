#!/usr/bin/env node

/**
 * Scraping paginé RealAdvisor → Supabase
 *
 * L'API supporte `page` (0-indexed, 36 items/page) mais plafonne à ~21 pages (756 items).
 * Stratégie : quand une tranche a >700 résultats, on subdivise par propertyType_eq
 * et/ou on réduit la tranche de prix pour rester sous le plafond.
 *
 * Usage: SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/scrape-paginated.mjs
 *
 * Options env:
 *   DRY_RUN=1           — log sans insérer en DB
 *   START_RANGE=N        — reprendre à la tranche N (0-indexed)
 *   CONCURRENCY=N        — nombre de pages en parallèle (défaut: 3)
 *   DELAY_MS=N           — délai entre requêtes en ms (défaut: 800)
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { validateListing } from './lib/validate-listing.mjs'

// ── Load env ────────────────────────────────────────────────

const __dirname_fix = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname_fix, '..', '.env.local')
const envContent = readFileSync(envPath, 'utf8')
const SUPABASE_URL = envContent.match(/VITE_SUPABASE_URL=(.+)/)?.[1]?.trim()
const ANON_KEY = envContent.match(/VITE_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim()
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing env vars. Usage: SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/scrape-paginated.mjs')
  process.exit(1)
}

const DRY_RUN = process.env.DRY_RUN === '1'
const START_RANGE = parseInt(process.env.START_RANGE || '0', 10)
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '3', 10)
const DELAY_MS = parseInt(process.env.DELAY_MS || '800', 10)
const PAGE_SIZE = 36
const MAX_ITEMS_PER_QUERY = 720 // safe limit (20 pages × 36)

// Max pages the API serves (0-indexed, so page 0-19 = 20 pages × 36 = 720)
const MAX_PAGES = 20

// ── Canton mapping ──────────────────────────────────────────

const CANTON_MAP = {
  'Genève': 'GE', 'Geneva': 'GE', 'Genf': 'GE',
  'Vaud': 'VD', 'Waadt': 'VD',
  'Valais': 'VS', 'Wallis': 'VS',
  'Neuchâtel': 'NE', 'Neuenburg': 'NE',
  'Fribourg': 'FR', 'Freiburg': 'FR',
  'Berne': 'BE', 'Bern': 'BE',
  'Jura': 'JU',
  'Bâle-Ville': 'BS', 'Basel-Stadt': 'BS',
  'Bâle-Campagne': 'BL', 'Basel-Landschaft': 'BL',
  'Argovie': 'AG', 'Aargau': 'AG',
  'Soleure': 'SO', 'Solothurn': 'SO',
  'Zurich': 'ZH', 'Zürich': 'ZH',
  'Lucerne': 'LU', 'Luzern': 'LU',
  'Zoug': 'ZG', 'Zug': 'ZG',
  'Schwyz': 'SZ',
  'Nidwald': 'NW', 'Nidwalden': 'NW',
  'Obwald': 'OW', 'Obwalden': 'OW',
  'Uri': 'UR',
  'Glaris': 'GL', 'Glarus': 'GL',
  'Schaffhouse': 'SH', 'Schaffhausen': 'SH',
  'Thurgovie': 'TG', 'Thurgau': 'TG',
  'Appenzell Rhodes-Extérieures': 'AR', 'Appenzell Ausserrhoden': 'AR',
  'Appenzell Rhodes-Intérieures': 'AI', 'Appenzell Innerrhoden': 'AI',
  'Saint-Gall': 'SG', 'St. Gallen': 'SG',
  'Grisons': 'GR', 'Graubünden': 'GR',
  'Tessin': 'TI', 'Ticino': 'TI',
}

const TYPE_MAP = {
  'APARTMENT': 'apartment', 'APPT': 'apartment', 'apartment': 'apartment',
  'HOUSE': 'house', 'house': 'house',
  'VILLA': 'villa', 'villa': 'villa',
  'COMMERCIAL': 'commercial', 'commercial': 'commercial',
  'LAND': 'land', 'land': 'land',
}

function buildImageUrl(image) {
  if (!image?.file_name) return null
  const bucket = image.bucket_name || 'aggregator-images'
  const raw = `https://storage.googleapis.com/${bucket}/${image.file_name}`
  const encoded = Buffer.from(raw).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `https://img.realadvisor.ch/_/rs:fill:1200:800:1:0/q:75/${encoded}.webp`
}

// ── Price ranges ────────────────────────────────────────────

function generateRanges() {
  const ranges = []
  // 0-200K: step 20K (low density)
  for (let p = 0; p < 200000; p += 20000) ranges.push([p, p + 20000])
  // 200K-500K: step 10K (medium density, max ~465/range)
  for (let p = 200000; p < 500000; p += 10000) ranges.push([p, p + 10000])
  // 500K-2M: step 5K (HIGH density — keeps each range under 720 cap)
  for (let p = 500000; p < 2000000; p += 5000) ranges.push([p, p + 5000])
  // 2M-5M: step 25K
  for (let p = 2000000; p < 5000000; p += 25000) ranges.push([p, p + 25000])
  // 5M-10M: step 100K
  for (let p = 5000000; p < 10000000; p += 100000) ranges.push([p, p + 100000])
  // 10M-50M: step 500K
  for (let p = 10000000; p < 50000000; p += 500000) ranges.push([p, p + 500000])
  return ranges
}

// ── Supabase helpers ────────────────────────────────────────

async function supabaseBatchUpsert(listings) {
  if (listings.length === 0) return 0
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/market_listings?on_conflict=source_id`, {
    method: 'POST',
    headers: {
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(listings),
  })
  if (!resp.ok) {
    const text = await resp.text()
    console.error(`  Upsert error: ${resp.status} — ${text.substring(0, 200)}`)
    return 0
  }
  return listings.length
}

async function getDbCount() {
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/market_listings?select=id&limit=1`,
    {
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Prefer': 'count=exact',
        'Range': '0-0',
      },
    }
  )
  const cr = resp.headers.get('content-range')
  return cr ? parseInt(cr.split('/')[1]) : 0
}

// ── API fetch ───────────────────────────────────────────────

async function fetchPage(priceMin, priceMax, page) {
  const url = `https://realadvisor.ch/api/listings?offerType_eq=buy&salePrice_gte=${priceMin}&salePrice_lte=${priceMax}&page=${page}`

  const resp = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    },
  })
  if (!resp.ok) throw new Error(`API HTTP ${resp.status}`)
  const data = await resp.json()
  return {
    listings: data.listings || [],
    totalCount: data.total_count || 0,
  }
}

function transformListing(item) {
  const sourceId = String(item.id)
  const salePrice = item.sale_price || 0
  if (salePrice <= 0) return null

  const stateName = item.state || ''
  const canton = CANTON_MAP[stateName] || stateName

  const photos = []
  if (Array.isArray(item.images)) {
    for (const img of item.images.slice(0, 15)) {
      const url = buildImageUrl(img)
      if (url) photos.push(url)
    }
  }

  const rawType = item.property_main_type || item.property_type || 'APPT'
  const title = item.translated_titles?.fr || item.title || ''
  const description = item.description && typeof item.description === 'string'
    ? item.description.replace(/<[^>]+>/g, '').substring(0, 2000) : null

  return {
    canton,
    city: item.locality || '',
    postal_code: item.postcode || null,
    address: item.address || '',
    lat: item.lat || null,
    lng: item.lng || null,
    title,
    description,
    type: TYPE_MAP[rawType] || 'apartment',
    transaction_type: 'buy',
    price: salePrice,
    price_at_first_seen: salePrice,
    current_price: salePrice,
    price_per_m2: item.sale_price_per_living_surface || null,
    rooms: item.number_of_rooms || null,
    bedrooms: item.number_of_bedrooms || null,
    bathrooms: item.number_of_bathrooms || null,
    surface_m2: item.living_surface || item.computed_surface || null,
    floor: item.floor || null,
    features: '[]',
    photos,
    photos_count: photos.length,
    source_portal: item.portal || 'realadvisor',
    source_url: `https://realadvisor.ch/fr/acheter/bien-immobilier/${sourceId}`,
    source_id: sourceId,
    agency_name: item.agency_name || null,
    agency_phone: item.agency_contact_phone_number || null,
    status: 'active',
  }

  // Calcul du score qualité
  const { quality_score, quality_flags } = validateListing(listing)
  listing.quality_score = quality_score
  listing.quality_flags = JSON.stringify(quality_flags)

  return listing
}

// ── Process one price range with full pagination ────────────

let stats = { fetched: 0, upserted: 0, errors: 0, pagesTotal: 0, capped: 0 }

async function processRange(priceMin, priceMax, rangeIndex, totalRanges) {
  const label = priceMin >= 1000000
    ? `${(priceMin/1000000).toFixed(2)}M-${(priceMax/1000000).toFixed(2)}M`
    : `${(priceMin/1000).toFixed(0)}K-${(priceMax/1000).toFixed(0)}K`

  try {
    // Page 0 — get total and first batch
    const firstPage = await fetchPage(priceMin, priceMax, 0, null)
    const totalCount = firstPage.totalCount
    if (totalCount === 0) return

    const totalPages = Math.min(Math.ceil(totalCount / PAGE_SIZE), MAX_PAGES)
    const allItems = [...firstPage.listings]
    stats.pagesTotal++

    if (totalCount > MAX_PAGES * PAGE_SIZE) {
      stats.capped++
    }

    // Fetch remaining pages in batches of CONCURRENCY
    for (let startPage = 1; startPage < totalPages; startPage += CONCURRENCY) {
      const promises = []
      for (let p = startPage; p < Math.min(startPage + CONCURRENCY, totalPages); p++) {
        promises.push(
          fetchPage(priceMin, priceMax, p, null)
            .then(r => { stats.pagesTotal++; return r.listings })
            .catch(() => [])
        )
      }
      const results = await Promise.all(promises)
      for (const items of results) allItems.push(...items)
      if (startPage + CONCURRENCY < totalPages) {
        await new Promise(r => setTimeout(r, 150))
      }
    }

    // Deduplicate
    const seenIds = new Set()
    const rows = []
    for (const item of allItems) {
      const sid = String(item.id)
      if (!seenIds.has(sid)) {
        seenIds.add(sid)
        const row = transformListing(item)
        if (row) rows.push(row)
      }
    }

    stats.fetched += rows.length

    // Batch upsert (chunks of 200)
    if (!DRY_RUN && rows.length > 0) {
      for (let i = 0; i < rows.length; i += 200) {
        const chunk = rows.slice(i, i + 200)
        const n = await supabaseBatchUpsert(chunk)
        stats.upserted += n
      }
    } else if (DRY_RUN) {
      stats.upserted += rows.length
    }

    const cappedStr = totalCount > MAX_PAGES * PAGE_SIZE ? ` [CAPPED ${totalCount}→${rows.length}]` : ''
    if (rows.length > 0 || rangeIndex % 50 === 0) {
      console.log(
        `[${rangeIndex}/${totalRanges}] ${label}: ${totalCount} total → ${rows.length} unique${cappedStr}`
      )
    }

  } catch (err) {
    console.error(`[${rangeIndex}/${totalRanges}] ${label}: ERROR ${err.message}`)
    stats.errors++
  }
}

// ── Main ────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now()
  const startCount = DRY_RUN ? 0 : await getDbCount()
  const ranges = generateRanges()

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`SCRAPE PAGINÉ v2 — RealAdvisor → Supabase`)
  console.log(`${'═'.repeat(60)}`)
  console.log(`DB actuelle:     ${startCount.toLocaleString()} biens`)
  console.log(`Tranches:        ${ranges.length} (à partir de ${START_RANGE})`)
  console.log(`Concurrence:     ${CONCURRENCY} pages en parallèle`)
  console.log(`Max pages/query:  ${MAX_PAGES} (720 items)`)
  console.log(`Mode:            ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  console.log(`${'═'.repeat(60)}\n`)

  for (let i = START_RANGE; i < ranges.length; i++) {
    const [min, max] = ranges[i]
    await processRange(min, max, i + 1, ranges.length)
    await new Promise(r => setTimeout(r, DELAY_MS))

    // Progress every 30 ranges
    if ((i + 1) % 30 === 0) {
      const elapsed = ((Date.now() - startTime) / 60000).toFixed(1)
      const pct = ((i + 1 - START_RANGE) / (ranges.length - START_RANGE) * 100).toFixed(1)
      const currentCount = DRY_RUN ? `~${stats.upserted}` : (await getDbCount()).toLocaleString()
      console.log(`\n${'─'.repeat(55)}`)
      console.log(`PROGRESS: ${pct}% — ${elapsed} min — DB: ${currentCount}`)
      console.log(`Pages: ${stats.pagesTotal} | Fetched: ${stats.fetched.toLocaleString()} | Upserted: ${stats.upserted.toLocaleString()} | Capped: ${stats.capped} | Errors: ${stats.errors}`)
      console.log(`${'─'.repeat(55)}\n`)
    }
  }

  const finalCount = DRY_RUN ? stats.upserted : await getDbCount()
  const elapsed = ((Date.now() - startTime) / 60000).toFixed(1)

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`TERMINÉ — ${elapsed} minutes`)
  console.log(`${'═'.repeat(60)}`)
  console.log(`Tranches:        ${ranges.length - START_RANGE}`)
  console.log(`Pages totales:   ${stats.pagesTotal}`)
  console.log(`Ranges capped:   ${stats.capped}`)
  console.log(`Fetched unique:  ${stats.fetched.toLocaleString()}`)
  console.log(`Upserted:        ${stats.upserted.toLocaleString()}`)
  console.log(`Errors:          ${stats.errors}`)
  console.log(`DB AVANT:        ${startCount.toLocaleString()}`)
  console.log(`DB APRÈS:        ${typeof finalCount === 'number' ? finalCount.toLocaleString() : finalCount}`)
  if (typeof finalCount === 'number') {
    console.log(`NOUVEAUX:        +${(finalCount - startCount).toLocaleString()}`)
  }
  console.log(`${'═'.repeat(60)}\n`)
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
