#!/usr/bin/env node

/**
 * Scraping COMPLÉMENTAIRE RealAdvisor → Supabase
 *
 * Récupère les ~5K biens manquants via 3 stratégies :
 *   1. Biens "sur demande" (prix 0 ou pas de prix) — filtre salePrice_lte=0
 *   2. Subdiviser tranches denses par propertyType_eq (APARTMENT, HOUSE, VILLA, COMMERCIAL, LAND)
 *   3. Subdiviser tranches denses par numberOfRooms_gte/lte
 *
 * Usage: SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/scrape-extra.mjs
 */

import { readFileSync } from 'fs'
import { validateListing } from './lib/validate-listing.mjs'

// ── Load env ────────────────────────────────────────────────
const envPath = '/Users/megga/Desktop/megga-real-estate/.env.local'
const envContent = readFileSync(envPath, 'utf8')
const SUPABASE_URL = envContent.match(/VITE_SUPABASE_URL=(.+)/)?.[1]?.trim()
const ANON_KEY = envContent.match(/VITE_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim()
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing env vars. Usage: SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/scrape-extra.mjs')
  process.exit(1)
}

const DELAY_MS = parseInt(process.env.DELAY_MS || '600', 10)
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '3', 10)
const PAGE_SIZE = 36
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
async function fetchPage(params, page) {
  const searchParams = new URLSearchParams({
    ...params,
    page: String(page),
  })
  const url = `https://realadvisor.ch/api/listings?${searchParams.toString()}`

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

function transformListing(item, transactionType = 'buy') {
  const sourceId = String(item.id)
  const salePrice = item.sale_price || item.rent_net || item.rent_gross || 0

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
    transaction_type: transactionType,
    price: salePrice || 0,
    price_at_first_seen: salePrice || 0,
    current_price: salePrice || 0,
    price_per_m2: item.sale_price_per_living_surface || item.rent_net_per_living_surface || null,
    rooms: item.number_of_rooms || null,
    bedrooms: item.number_of_bedrooms || null,
    bathrooms: item.number_of_bathrooms || null,
    surface_m2: item.living_surface || item.computed_surface || null,
    floor: item.floor || null,
    features: '[]',
    photos,
    photos_count: photos.length,
    source_portal: item.portal || 'realadvisor',
    source_url: transactionType === 'buy'
      ? `https://realadvisor.ch/fr/acheter/bien-immobilier/${sourceId}`
      : `https://realadvisor.ch/fr/louer/bien-immobilier/${sourceId}`,
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

// ── Process one query (paginate fully) ─────────────────────
let stats = { fetched: 0, upserted: 0, newUnique: 0, errors: 0, pages: 0 }
const globalSeenIds = new Set()

async function processQuery(params, label, transactionType = 'buy') {
  try {
    const firstPage = await fetchPage(params, 0)
    const totalCount = firstPage.totalCount
    if (totalCount === 0) return

    const totalPages = Math.min(Math.ceil(totalCount / PAGE_SIZE), MAX_PAGES)
    const allItems = [...firstPage.listings]
    stats.pages++

    // Fetch remaining pages
    for (let startPage = 1; startPage < totalPages; startPage += CONCURRENCY) {
      const promises = []
      for (let p = startPage; p < Math.min(startPage + CONCURRENCY, totalPages); p++) {
        promises.push(
          fetchPage(params, p)
            .then(r => { stats.pages++; return r.listings })
            .catch(() => [])
        )
      }
      const results = await Promise.all(promises)
      for (const items of results) allItems.push(...items)
      if (startPage + CONCURRENCY < totalPages) {
        await new Promise(r => setTimeout(r, 100))
      }
    }

    // Deduplicate globally
    const rows = []
    for (const item of allItems) {
      const sid = String(item.id)
      if (!globalSeenIds.has(sid)) {
        globalSeenIds.add(sid)
        const row = transformListing(item, transactionType)
        if (row) rows.push(row)
      }
    }

    stats.fetched += rows.length

    // Batch upsert
    if (rows.length > 0) {
      for (let i = 0; i < rows.length; i += 200) {
        const chunk = rows.slice(i, i + 200)
        const n = await supabaseBatchUpsert(chunk)
        stats.upserted += n
      }
    }

    const cappedStr = totalCount > MAX_PAGES * PAGE_SIZE ? ` [CAPPED ${totalCount}]` : ''
    if (rows.length > 0) {
      console.log(`  ${label}: ${totalCount} total → ${rows.length} new${cappedStr}`)
    }

  } catch (err) {
    console.error(`  ${label}: ERROR ${err.message}`)
    stats.errors++
  }
}

// ── Strategies ──────────────────────────────────────────────

async function strategy1_noPriceBuy() {
  console.log('\n━━━ STRATÉGIE 1: Biens achat sans prix / prix 0 ━━━')

  // Try fetching with salePrice=0 (on demand)
  await processQuery({ offerType_eq: 'buy', salePrice_lte: '0' }, 'Prix ≤ 0')
  await new Promise(r => setTimeout(r, DELAY_MS))

  await processQuery({ offerType_eq: 'buy', salePrice_eq: '0' }, 'Prix = 0')
  await new Promise(r => setTimeout(r, DELAY_MS))

  // Try without price filter at all — sorted differently
  for (const sortBy of ['createdAt', 'salePricePerLivingSurface']) {
    for (const sortDir of ['ASC', 'DESC']) {
      await processQuery(
        { offerType_eq: 'buy', sortBy, sortDirection: sortDir },
        `No price filter, sort ${sortBy} ${sortDir}`
      )
      await new Promise(r => setTimeout(r, DELAY_MS))
    }
  }
}

async function strategy2_propertyTypeXprice() {
  console.log('\n━━━ STRATÉGIE 2: PropertyType × tranches denses ━━━')

  const propertyTypes = ['APARTMENT', 'HOUSE', 'VILLA', 'COMMERCIAL', 'LAND']

  // Dense ranges (500K-2M with finer grain + 200K-500K)
  const denseRanges = []
  // 200K-500K: step 10K
  for (let p = 200000; p < 500000; p += 10000) denseRanges.push([p, p + 10000])
  // 500K-2M: step 5K (most dense)
  for (let p = 500000; p < 2000000; p += 5000) denseRanges.push([p, p + 5000])
  // 2M-5M: step 25K
  for (let p = 2000000; p < 5000000; p += 25000) denseRanges.push([p, p + 25000])

  let queryCount = 0
  const totalQueries = propertyTypes.length * denseRanges.length

  for (const propType of propertyTypes) {
    console.log(`\n  ── ${propType} ──`)
    for (const [min, max] of denseRanges) {
      queryCount++
      const label = min >= 1000000
        ? `${propType} ${(min/1e6).toFixed(2)}M-${(max/1e6).toFixed(2)}M`
        : `${propType} ${(min/1000)}K-${(max/1000)}K`

      await processQuery(
        {
          offerType_eq: 'buy',
          salePrice_gte: String(min),
          salePrice_lte: String(max),
          propertyType_eq: propType,
        },
        label
      )
      await new Promise(r => setTimeout(r, DELAY_MS))

      // Progress every 100 queries
      if (queryCount % 100 === 0) {
        const pct = (queryCount / totalQueries * 100).toFixed(1)
        console.log(`\n  ── Progress: ${pct}% (${queryCount}/${totalQueries}) — New unique: ${stats.fetched} ──\n`)
      }
    }
  }
}

async function strategy3_roomsXprice() {
  console.log('\n━━━ STRATÉGIE 3: Rooms × tranches très denses ━━━')

  const roomRanges = [
    { numberOfRooms_gte: '1', numberOfRooms_lte: '1.5', label: '1-1.5p' },
    { numberOfRooms_gte: '2', numberOfRooms_lte: '2.5', label: '2-2.5p' },
    { numberOfRooms_gte: '3', numberOfRooms_lte: '3.5', label: '3-3.5p' },
    { numberOfRooms_gte: '4', numberOfRooms_lte: '4.5', label: '4-4.5p' },
    { numberOfRooms_gte: '5', numberOfRooms_lte: '5.5', label: '5-5.5p' },
    { numberOfRooms_gte: '6', numberOfRooms_lte: '7', label: '6-7p' },
    { numberOfRooms_gte: '7.5', numberOfRooms_lte: '20', label: '7.5+p' },
  ]

  // Only target the absolute densest ranges (600K-1.5M)
  const superDense = []
  for (let p = 600000; p < 1500000; p += 5000) superDense.push([p, p + 5000])

  let queryCount = 0

  for (const room of roomRanges) {
    console.log(`\n  ── ${room.label} ──`)
    for (const [min, max] of superDense) {
      queryCount++
      const label = `${room.label} ${(min/1000)}K-${(max/1000)}K`

      await processQuery(
        {
          offerType_eq: 'buy',
          salePrice_gte: String(min),
          salePrice_lte: String(max),
          numberOfRooms_gte: room.numberOfRooms_gte,
          numberOfRooms_lte: room.numberOfRooms_lte,
        },
        label
      )
      await new Promise(r => setTimeout(r, DELAY_MS))

      if (queryCount % 100 === 0) {
        console.log(`\n  ── Rooms progress: ${queryCount} queries — New unique: ${stats.fetched} ──\n`)
      }
    }
  }
}

async function strategy4_sortVariations() {
  console.log('\n━━━ STRATÉGIE 4: Sort variations sur tranches denses ━━━')

  const sorts = [
    { sortBy: 'createdAt', sortDirection: 'ASC' },
    { sortBy: 'salePricePerLivingSurface', sortDirection: 'ASC' },
    { sortBy: 'salePricePerLivingSurface', sortDirection: 'DESC' },
  ]

  // Medium ranges (capture different orderings to break the 720 cap)
  const ranges = []
  for (let p = 500000; p < 2000000; p += 10000) ranges.push([p, p + 10000])

  for (const sort of sorts) {
    console.log(`\n  ── Sort: ${sort.sortBy} ${sort.sortDirection} ──`)
    for (const [min, max] of ranges) {
      const label = `${sort.sortBy.substring(0,8)} ${sort.sortDirection} ${(min/1000)}K-${(max/1000)}K`

      await processQuery(
        {
          offerType_eq: 'buy',
          salePrice_gte: String(min),
          salePrice_lte: String(max),
          ...sort,
        },
        label
      )
      await new Promise(r => setTimeout(r, DELAY_MS))
    }
  }
}

// ── Main ────────────────────────────────────────────────────
async function main() {
  const startTime = Date.now()
  const startCount = await getDbCount()

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`SCRAPE EXTRA — Récupération des biens manquants`)
  console.log(`${'═'.repeat(60)}`)
  console.log(`DB actuelle:     ${startCount.toLocaleString()} biens`)
  console.log(`Objectif:        ~43'000`)
  console.log(`À trouver:       ~${(43000 - startCount).toLocaleString()}`)
  console.log(`${'═'.repeat(60)}`)

  // Strategy 1: No-price / price=0 listings (quick, ~5 min)
  await strategy1_noPriceBuy()
  const afterS1 = await getDbCount()
  console.log(`\n  → Après Stratégie 1: ${afterS1.toLocaleString()} (+${(afterS1 - startCount).toLocaleString()})`)

  // Strategy 4: Sort variations (quick, ~15 min)
  await strategy4_sortVariations()
  const afterS4 = await getDbCount()
  console.log(`\n  → Après Stratégie 4: ${afterS4.toLocaleString()} (+${(afterS4 - startCount).toLocaleString()})`)

  // Strategy 2: PropertyType × dense ranges (medium, ~45 min)
  await strategy2_propertyTypeXprice()
  const afterS2 = await getDbCount()
  console.log(`\n  → Après Stratégie 2: ${afterS2.toLocaleString()} (+${(afterS2 - startCount).toLocaleString()})`)

  // Strategy 3: Rooms × super-dense ranges (long, ~30 min)
  await strategy3_roomsXprice()
  const afterS3 = await getDbCount()
  console.log(`\n  → Après Stratégie 3: ${afterS3.toLocaleString()} (+${(afterS3 - startCount).toLocaleString()})`)

  // Final stats
  const finalCount = await getDbCount()
  const elapsed = ((Date.now() - startTime) / 60000).toFixed(1)

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`TERMINÉ — ${elapsed} minutes`)
  console.log(`${'═'.repeat(60)}`)
  console.log(`Pages:           ${stats.pages}`)
  console.log(`Fetched unique:  ${stats.fetched.toLocaleString()}`)
  console.log(`Upserted:        ${stats.upserted.toLocaleString()}`)
  console.log(`Errors:          ${stats.errors}`)
  console.log(`DB AVANT:        ${startCount.toLocaleString()}`)
  console.log(`DB APRÈS:        ${finalCount.toLocaleString()}`)
  console.log(`NOUVEAUX:        +${(finalCount - startCount).toLocaleString()}`)
  console.log(`${'═'.repeat(60)}\n`)
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
