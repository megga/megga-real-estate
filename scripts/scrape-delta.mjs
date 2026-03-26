#!/usr/bin/env node

/**
 * Delta scrape RealAdvisor → Supabase (daily updates)
 *
 * Lightweight version of scrape-paginated.mjs that only fetches recent listings.
 * - Sorts by createdAt DESC to get newest first
 * - Max 2-3 pages per price range (72-108 items)
 * - Bigger price steps (50K instead of 5-10K)
 * - Runs in ~2-3 minutes instead of 20+
 * - Uses same upsert logic (on_conflict=source_id)
 *
 * Usage: SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/scrape-delta.mjs
 *
 * Options env:
 *   DRY_RUN=1           — log sans insérer en DB
 *   MAX_PAGES=N          — max pages per range (défaut: 3)
 *   DELAY_MS=N           — délai entre tranches en ms (défaut: 300)
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
  console.error('Missing env vars. Usage: SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/scrape-delta.mjs')
  process.exit(1)
}

const DRY_RUN = process.env.DRY_RUN === '1'
const MAX_PAGES_PER_RANGE = parseInt(process.env.MAX_PAGES || '3', 10)
const DELAY_MS = parseInt(process.env.DELAY_MS || '300', 10)
const PAGE_SIZE = 36

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

// ── Delta price ranges (bigger steps) ───────────────────────

function generateDeltaRanges() {
  const ranges = []
  // 0-200K: step 100K
  for (let p = 0; p < 200000; p += 100000) ranges.push([p, p + 100000])
  // 200K-500K: step 50K
  for (let p = 200000; p < 500000; p += 50000) ranges.push([p, p + 50000])
  // 500K-1M: step 50K (higher density zone)
  for (let p = 500000; p < 1000000; p += 50000) ranges.push([p, p + 50000])
  // 1M-2M: step 100K
  for (let p = 1000000; p < 2000000; p += 100000) ranges.push([p, p + 100000])
  // 2M-5M: step 250K
  for (let p = 2000000; p < 5000000; p += 250000) ranges.push([p, p + 250000])
  // 5M-10M: step 500K
  for (let p = 5000000; p < 10000000; p += 500000) ranges.push([p, p + 500000])
  // 10M-50M: step 5M
  for (let p = 10000000; p < 50000000; p += 5000000) ranges.push([p, p + 5000000])
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

// ── API fetch (sorted by newest) ────────────────────────────

async function fetchPage(priceMin, priceMax, page) {
  const url = `https://realadvisor.ch/api/listings?offerType_eq=buy&salePrice_gte=${priceMin}&salePrice_lte=${priceMax}&page=${page}&sort=createdAt_desc`

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

// ── Score Engine: Market Change Detection ───────────────

async function detectMarketChanges(rows) {
  // Fetch existing listings for these source_ids to compare prices
  const sourceIds = rows.map(r => r.source_id)

  // Batch fetch in chunks of 100
  const existingMap = new Map()
  for (let i = 0; i < sourceIds.length; i += 100) {
    const chunk = sourceIds.slice(i, i + 100)
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/market_listings?source_id=in.(${chunk.join(',')})&select=id,source_id,price,title,city,canton,type,rooms`,
      {
        headers: {
          'apikey': ANON_KEY,
          'Authorization': `Bearer ${SERVICE_KEY}`,
        },
      }
    )
    if (resp.ok) {
      const data = await resp.json()
      for (const item of data) {
        existingMap.set(item.source_id, item)
      }
    }
  }

  const changes = []

  for (const row of rows) {
    const existing = existingMap.get(row.source_id)

    if (!existing) {
      // New listing — never seen before
      changes.push({
        change_type: 'new',
        old_price: null,
        new_price: row.price,
        change_pct: null,
        listing_title: row.title,
        listing_city: row.city,
        listing_canton: row.canton,
        listing_type: row.type,
        listing_rooms: row.rooms,
      })
    } else if (existing.price && row.price && Math.abs(existing.price - row.price) > 1) {
      const pct = ((row.price - existing.price) / existing.price) * 100
      changes.push({
        market_listing_id: existing.id,
        change_type: pct < 0 ? 'price_drop' : 'price_increase',
        old_price: existing.price,
        new_price: row.price,
        change_pct: Math.round(pct * 100) / 100,
        listing_title: row.title || existing.title,
        listing_city: row.city || existing.city,
        listing_canton: row.canton || existing.canton,
        listing_type: row.type || existing.type,
        listing_rooms: row.rooms || existing.rooms,
      })
    }
  }

  // Insert changes
  if (changes.length > 0) {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/market_changes`, {
      method: 'POST',
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(changes),
    })
    if (resp.ok) {
      const newCount = changes.filter(c => c.change_type === 'new').length
      const dropCount = changes.filter(c => c.change_type === 'price_drop').length
      const upCount = changes.filter(c => c.change_type === 'price_increase').length
      if (newCount + dropCount + upCount > 0) {
        console.log(`  📡 Radar: ${newCount} nouveaux, ${dropCount} baisses, ${upCount} hausses`)
      }
    }
  }
}

async function detectRemovedListings() {
  // Listings not seen in 48h that are still 'active' → mark as removed
  const threshold = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/market_listings?status=eq.active&last_seen_at=lt.${threshold}&select=id,title,city,canton,type,rooms,price&limit=100`,
    {
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
      },
    }
  )
  if (!resp.ok) return

  const stale = await resp.json()
  if (stale.length === 0) return

  // Log as removed
  const changes = stale.map(l => ({
    market_listing_id: l.id,
    change_type: 'removed',
    old_price: l.price,
    new_price: null,
    change_pct: null,
    listing_title: l.title,
    listing_city: l.city,
    listing_canton: l.canton,
    listing_type: l.type,
    listing_rooms: l.rooms,
  }))

  await fetch(`${SUPABASE_URL}/rest/v1/market_changes`, {
    method: 'POST',
    headers: {
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(changes),
  })

  // Update status to 'removed'
  const ids = stale.map(l => l.id)
  await fetch(
    `${SUPABASE_URL}/rest/v1/market_listings?id=in.(${ids.join(',')})`,
    {
      method: 'PATCH',
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ status: 'removed' }),
    }
  )

  console.log(`  📡 Radar: ${stale.length} biens retirés du marché`)
}

// ── Process one price range (max 2-3 pages, newest first) ───

let stats = { fetched: 0, upserted: 0, errors: 0, pagesTotal: 0, rangesWithData: 0 }

async function processRange(priceMin, priceMax, rangeIndex, totalRanges) {
  const label = priceMin >= 1000000
    ? `${(priceMin/1000000).toFixed(1)}M-${(priceMax/1000000).toFixed(1)}M`
    : `${(priceMin/1000).toFixed(0)}K-${(priceMax/1000).toFixed(0)}K`

  try {
    // Page 0 — get total and first batch (sorted by createdAt DESC)
    const firstPage = await fetchPage(priceMin, priceMax, 0)
    const totalCount = firstPage.totalCount
    if (totalCount === 0) return

    stats.rangesWithData++
    const pagesToFetch = Math.min(Math.ceil(totalCount / PAGE_SIZE), MAX_PAGES_PER_RANGE)
    const allItems = [...firstPage.listings]
    stats.pagesTotal++

    // Fetch remaining pages (up to MAX_PAGES_PER_RANGE)
    for (let p = 1; p < pagesToFetch; p++) {
      try {
        const result = await fetchPage(priceMin, priceMax, p)
        allItems.push(...result.listings)
        stats.pagesTotal++
      } catch {
        // skip failed page
      }
      await new Promise(r => setTimeout(r, 100))
    }

    // Deduplicate & transform
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

    // ── Score Engine: detect market changes before upsert ──
    if (!DRY_RUN && rows.length > 0) {
      await detectMarketChanges(rows)
    }

    // Batch upsert
    if (!DRY_RUN && rows.length > 0) {
      for (let i = 0; i < rows.length; i += 200) {
        const chunk = rows.slice(i, i + 200)
        const n = await supabaseBatchUpsert(chunk)
        stats.upserted += n
      }
    } else if (DRY_RUN) {
      stats.upserted += rows.length
    }

    if (rows.length > 0) {
      console.log(
        `  [${rangeIndex}/${totalRanges}] ${label}: ${totalCount} total, ${pagesToFetch} pages → ${rows.length} upserted`
      )
    }
  } catch (err) {
    console.error(`  [${rangeIndex}/${totalRanges}] ${label}: ERROR ${err.message}`)
    stats.errors++
  }
}

// ── Main ────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now()
  const startCount = DRY_RUN ? 0 : await getDbCount()
  const ranges = generateDeltaRanges()

  console.log(`\n${'═'.repeat(55)}`)
  console.log(`DELTA SCRAPE — RealAdvisor → Supabase`)
  console.log(`${'═'.repeat(55)}`)
  console.log(`DB actuelle:       ${startCount.toLocaleString()} biens`)
  console.log(`Tranches:          ${ranges.length}`)
  console.log(`Max pages/tranche: ${MAX_PAGES_PER_RANGE} (${MAX_PAGES_PER_RANGE * PAGE_SIZE} items)`)
  console.log(`Tri:               createdAt DESC (plus récents d'abord)`)
  console.log(`Mode:              ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  console.log(`${'═'.repeat(55)}\n`)

  for (let i = 0; i < ranges.length; i++) {
    const [min, max] = ranges[i]
    await processRange(min, max, i + 1, ranges.length)
    await new Promise(r => setTimeout(r, DELAY_MS))
  }

  // Detect removed listings (not seen in 48h)
  if (!DRY_RUN) {
    await detectRemovedListings()
  }

  const finalCount = DRY_RUN ? stats.upserted : await getDbCount()
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  const newListings = typeof finalCount === 'number' ? finalCount - startCount : '?'

  console.log(`\n${'═'.repeat(55)}`)
  console.log(`TERMINÉ — ${elapsed}s`)
  console.log(`${'═'.repeat(55)}`)
  console.log(`Tranches scannées: ${ranges.length} (${stats.rangesWithData} avec données)`)
  console.log(`Pages totales:     ${stats.pagesTotal}`)
  console.log(`Fetched unique:    ${stats.fetched.toLocaleString()}`)
  console.log(`Upserted:          ${stats.upserted.toLocaleString()}`)
  console.log(`Errors:            ${stats.errors}`)
  console.log(`${'─'.repeat(55)}`)
  console.log(`DB AVANT:          ${startCount.toLocaleString()}`)
  console.log(`DB APRÈS:          ${typeof finalCount === 'number' ? finalCount.toLocaleString() : finalCount}`)
  console.log(`NOUVEAUX:          +${typeof newListings === 'number' ? newListings.toLocaleString() : newListings}`)
  console.log(`${'═'.repeat(55)}\n`)
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
