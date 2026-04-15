#!/usr/bin/env node

/**
 * Scraping Flatfox.ch → Supabase (table market_listings)
 *
 * Utilise l'API publique Flatfox :
 *   https://flatfox.ch/api/v1/public-listing/?expand=images&offer_type=RENT&limit=100&offset=N
 *
 * Pas de clé d'authentification requise. Endpoint Django REST Framework standard.
 * Greenlight verbal de Gregory (Flatfox) — voir CLAUDE.md / discussion 2026-04-15.
 *
 * ⚠️ IMPORTANT : Flatfox ne propose QUE des annonces de LOCATION (RENT).
 * Le filtre offer_type=BUY est ignoré par leur API (renvoie toujours du RENT).
 * Tous les biens importés auront donc transaction_type = 'rent' dans MEGGA.
 * Pour les annonces de VENTE, voir scrape-paginated.mjs (RealAdvisor).
 *
 * Stratégie :
 *   - Pagination par offset, 100 listings par page (max API)
 *   - Filtre les types non pertinents (GARAGE_SLOT, PARK, STORAGE, etc.)
 *   - Mappe Flatfox JSON → market_listings shape avec transaction_type='rent'
 *   - Upsert via Supabase REST API avec on_conflict=source_portal,source_id
 *   - Rate limit : 1000ms entre requêtes (très respectueux pour partenaire)
 *
 * Prérequis DB :
 *   - Migration 20260415_001_rental_support.sql appliquée
 *   - Migration 20260415_003_market_listings_multi_portal.sql appliquée
 *
 * Usage :
 *   SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/scrape-flatfox.mjs
 *
 * Options env :
 *   DRY_RUN=1            — log sans insérer en DB (utile pour tester le mapping)
 *   START_OFFSET=N       — reprendre à un offset précis
 *   MAX_PAGES=N          — limite de pages (défaut : illimité, ~340 pages = 33K listings)
 *   DELAY_MS=N           — délai entre requêtes (défaut : 1000)
 *   PAGE_SIZE=N          — taille de page (défaut : 100, max API : 100)
 */

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { validateListing } from './lib/validate-listing.mjs'
import { npaToCanton } from './lib/swiss-postcodes.mjs'

// ─── Load env ────────────────────────────────────────────────

const __dirname_fix = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname_fix, '..', '.env.local')
const envContent = readFileSync(envPath, 'utf8')
const SUPABASE_URL = envContent.match(/VITE_SUPABASE_URL=(.+)/)?.[1]?.trim()
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing env vars. Usage: SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/scrape-flatfox.mjs')
  process.exit(1)
}

const DRY_RUN = process.env.DRY_RUN === '1'
const START_OFFSET = parseInt(process.env.START_OFFSET || '0', 10)
const MAX_PAGES = process.env.MAX_PAGES ? parseInt(process.env.MAX_PAGES, 10) : Infinity
const DELAY_MS = parseInt(process.env.DELAY_MS || '1000', 10)
const PAGE_SIZE = Math.min(parseInt(process.env.PAGE_SIZE || '100', 10), 100)

// Flatfox = location uniquement (vérifié 2026-04-15 : offer_type=BUY ignoré).
// On force RENT pour être explicite sur la distinction RENT vs BUY.
const OFFER_TYPE = 'RENT'

const FLATFOX_BASE = 'https://flatfox.ch'
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

// ─── Mappings ────────────────────────────────────────────────

// Flatfox object_type → market_listings type
const TYPE_MAP = {
  // Logements
  'APT': 'apartment',
  'APARTMENT': 'apartment',
  'FLAT': 'apartment',
  'STUDIO': 'apartment',
  'ATTIC_FLAT': 'apartment',
  'ROOF_FLAT': 'apartment',
  'DUPLEX': 'apartment',
  'TERRACE_FLAT': 'apartment',
  'GROUND_FLAT': 'apartment',
  'LOFT': 'apartment',
  'MAISONETTE': 'apartment',
  'FURNISHED_FLAT': 'apartment',
  'BACHELOR_FLAT': 'apartment',
  'HOUSE': 'house',
  'SINGLE_HOUSE': 'house',
  'TERRACE_HOUSE': 'house',
  'ROW_HOUSE': 'house',
  'CHALET': 'house',
  'VILLA': 'villa',
  'BIFAMILIAR_HOUSE': 'house',
  'MULTIFAMILIAR_HOUSE': 'house',
  // Commercial
  'OFFICE': 'commercial',
  'WORKSHOP': 'commercial',
  'COMMERCIAL': 'commercial',
  'SHOP': 'commercial',
  'RESTAURANT': 'commercial',
  'WAREHOUSE': 'commercial',
  'PRACTICE': 'commercial',
  'PRACTICE_SHARED': 'commercial',
  'GARAGE': 'commercial',
  // Terrain
  'BUILDING_LAND': 'land',
  'AGRICULTURAL_LAND': 'land',
}

// Types de biens à ignorer (parking, stockage, etc. — pas pertinent pour MEGGA)
const TYPES_TO_SKIP = new Set([
  'GARAGE_SLOT',
  'SINGLE_GARAGE',
  'OUTSIDE_PARK_SLOT',
  'COVERED_PARK_SLOT',
  'BOAT_SLOT',
  'HOBBY_ROOM',
  'PROVISION_ROOM',
  'STORAGE_ROOM',
  'CARPORT',
])

// ─── HTTP helpers ────────────────────────────────────────────

async function fetchPage(offerType, offset) {
  const url = `${FLATFOX_BASE}/api/v1/public-listing/?expand=images&offer_type=${offerType}&limit=${PAGE_SIZE}&offset=${offset}&ordering=-created`

  const resp = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': USER_AGENT,
      'Accept-Language': 'fr-CH,fr;q=0.9,en;q=0.8',
    },
  })

  if (!resp.ok) {
    throw new Error(`Flatfox API ${resp.status} on ${url}`)
  }

  return resp.json()
}

async function upsertBatch(rows) {
  if (DRY_RUN) {
    console.log(`  [DRY] Would upsert ${rows.length} rows`)
    return { upserted: rows.length, errors: 0 }
  }

  const resp = await fetch(`${SUPABASE_URL}/rest/v1/market_listings?on_conflict=source_portal,source_id`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  })

  if (!resp.ok) {
    const text = await resp.text()
    console.error(`  ❌ Supabase upsert error ${resp.status}: ${text.slice(0, 300)}`)
    return { upserted: 0, errors: rows.length }
  }

  return { upserted: rows.length, errors: 0 }
}

// ─── Mapping Flatfox → market_listings ────────────────────────

function mapImagesToUrls(images) {
  // images peut être une liste d'IDs (sans expand) ou d'objets (avec expand)
  if (!Array.isArray(images)) return []
  const urls = []
  for (const img of images.slice(0, 10)) {
    if (typeof img === 'object' && img !== null) {
      // Préférer la version medium pour MEGGA (équilibre qualité/poids)
      const path = img.url_thumb_l || img.url_thumb_m || img.url
      if (path) urls.push(path.startsWith('http') ? path : `${FLATFOX_BASE}${path}`)
    }
  }
  return urls
}

function mapPrice(listing) {
  // Stratégie de prix par ordre de préférence :
  //   1. price_display (champ officiel "ce que le client voit", inclut TVA si applicable)
  //   2. rent_gross (loyer brut = net + charges, pour les locations)
  //   3. rent_net + rent_charges (calcul depuis les composantes)
  //   4. price_display (fallback)
  // Pour les biens BUY (rares sur Flatfox), price_display = prix d'achat total.
  const display = Number(listing.price_display) || 0
  if (display > 0) return display
  if (listing.offer_type === 'RENT') {
    if (listing.rent_gross && Number(listing.rent_gross) > 0) return Number(listing.rent_gross)
    const net = Number(listing.rent_net) || 0
    const charges = Number(listing.rent_charges) || 0
    if (net > 0) return net + charges
  }
  return 0
}

function mapFeatures(attributes) {
  if (!Array.isArray(attributes)) return []
  // Mapping Flatfox attribute names → MEGGA features
  const ATTR_MAP = {
    lift: 'ascenseur',
    elevator: 'ascenseur',
    balconygarden: 'balcon',
    balcony: 'balcon',
    terrace: 'terrasse',
    garden: 'jardin',
    parking: 'parking',
    garage: 'garage',
    cellar: 'cave',
    fireplace: 'cheminée',
    pool: 'piscine',
    swimmingpool: 'piscine',
    dishwasher: 'lave-vaisselle',
    washingmachine: 'machine_à_laver',
    tumbler: 'sèche-linge',
    parquetflooring: 'parquet',
    quietneighborhood: 'quartier_calme',
    petsallowed: 'animaux_acceptés',
    minergiecertified: 'minergie',
    childfriendly: 'familial',
    barrierfree: 'accessible',
    airconditioning: 'climatisation',
  }
  return attributes
    .map((a) => {
      const name = typeof a === 'string' ? a : a.name
      return ATTR_MAP[name] || (typeof name === 'string' ? name : null)
    })
    .filter(Boolean)
}

function mapAgency(agency) {
  if (!agency || typeof agency !== 'object') return { name: null, phone: null }
  const parts = [agency.name, agency.name_2].filter(Boolean)
  return {
    name: parts.length > 0 ? parts.join(' — ') : null,
    phone: agency.phone || null,
  }
}

function mapListing(flatfox) {
  const objType = flatfox.object_type
  if (TYPES_TO_SKIP.has(objType)) return null // Skip parking, etc.

  // Distinction RENT vs BUY :
  // Flatfox actuellement = 100% rent. On garde la logique défensive au cas
  // où ils ajouteraient des ventes plus tard.
  if (flatfox.offer_type !== 'RENT' && flatfox.offer_type !== 'BUY') return null
  const transactionType = flatfox.offer_type === 'BUY' ? 'buy' : 'rent'

  const type = TYPE_MAP[objType] || 'apartment'
  const price = mapPrice(flatfox)
  const surface = Number(flatfox.surface_living) || Number(flatfox.surface_usable) || 0
  const rooms = Number(flatfox.number_of_rooms) || 0
  const photos = mapImagesToUrls(flatfox.images)
  const features = mapFeatures(flatfox.attributes)
  const agency = mapAgency(flatfox.agency)

  const zipcode = flatfox.zipcode ? String(flatfox.zipcode).padStart(4, '0') : null
  const canton = npaToCanton(zipcode)

  // URL complète vers la page Flatfox
  const sourceUrl = flatfox.url ? `${FLATFOX_BASE}${flatfox.url}` : `${FLATFOX_BASE}/${flatfox.pk}/`

  // Title : préférer short_title, sinon pitch_title, sinon construire depuis description_title
  const title = flatfox.short_title || flatfox.pitch_title || flatfox.description_title || flatfox.public_title || `Bien à ${flatfox.city || 'Suisse'}`

  // availability_date : moving_date au format ISO si présent
  let availabilityDate = null
  if (flatfox.moving_date) {
    try {
      availabilityDate = new Date(flatfox.moving_date).toISOString().slice(0, 10)
    } catch { /* ignore parse errors */ }
  }

  // Bien construit pour quality scoring
  const candidate = {
    title,
    description: flatfox.description || '',
    type,
    transaction_type: transactionType,
    price,
    currency: 'CHF',
    rooms,
    bedrooms: null, // Flatfox n'expose pas le nombre de chambres séparément
    bathrooms: null,
    surface_m2: surface,
    floor: flatfox.floor != null ? Number(flatfox.floor) : null,
    address: flatfox.street || null,
    city: flatfox.city || null,
    canton,
    postal_code: zipcode,
    lat: flatfox.latitude != null ? Number(flatfox.latitude) : null,
    lng: flatfox.longitude != null ? Number(flatfox.longitude) : null,
    photos,
    photos_count: photos.length,
    features,
    is_furnished: !!flatfox.is_furnished,
    deposit_months: null, // Flatfox n'expose pas la caution dans l'API publique
    availability_date: availabilityDate,
    external_regie: agency.name
      ? { name: agency.name, phone: agency.phone || '', email: '', website: '' }
      : null,
    source_portal: 'flatfox',
    source_id: String(flatfox.pk),
    source_url: sourceUrl,
    agency_name: agency.name,
    agency_phone: agency.phone,
    price_at_first_seen: price,
    current_price: price,
    first_seen_at: flatfox.created || flatfox.published || new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    days_on_market: flatfox.created
      ? Math.floor((Date.now() - new Date(flatfox.created).getTime()) / (1000 * 60 * 60 * 24))
      : 0,
    status: 'active',
    year_built: flatfox.year_built ? Number(flatfox.year_built) : null,
    charges_monthly: transactionType === 'rent' && flatfox.rent_charges ? Number(flatfox.rent_charges) : null,
  }

  // Quality score (la fonction validate prix/m² ne s'applique vraiment qu'à BUY,
  // pour RENT on calcule un score sans la pénalité prix/m²)
  const { quality_score, quality_flags } = transactionType === 'buy'
    ? validateListing(candidate)
    : validateRentalListing(candidate)

  return { ...candidate, quality_score, quality_flags }
}

// Validation simplifiée pour les locations (sans check prix/m² absolu)
function validateRentalListing(listing) {
  const flags = []
  let score = 100
  const price = Number(listing.price) || 0
  const surface = Number(listing.surface_m2) || 0
  const rooms = Number(listing.rooms) || 0
  const lat = Number(listing.lat) || 0
  const lng = Number(listing.lng) || 0
  const photos = listing.photos || []

  // Loyer (15 pts) — fourchettes raisonnables Suisse 200-15000 CHF/mois
  if (price <= 0) {
    flags.push('no_price')
    score -= 15
  } else if (price < 200) {
    flags.push('rent_too_low')
    score -= 10
  } else if (price > 15000) {
    flags.push('rent_too_high')
    score -= 5
  }

  // Loyer/m² cohérent (15 pts) — typiquement 15-80 CHF/m²/mois en Suisse
  if (price > 0 && surface > 0) {
    const rentPerM2 = price / surface
    if (rentPerM2 < 8) {
      flags.push('rent_per_m2_low')
      score -= 8
    } else if (rentPerM2 > 120) {
      flags.push('rent_per_m2_high')
      score -= 12
    }
  } else if (price > 0 && surface <= 0) {
    flags.push('missing_surface')
    score -= 8
  }

  // Surface (5 pts)
  if (surface > 0 && surface < 8) {
    flags.push('surface_too_small')
    score -= 5
  }

  // Pièces (5 pts)
  if (rooms <= 0 && listing.type !== 'commercial' && listing.type !== 'land') {
    flags.push('missing_rooms')
    score -= 5
  }

  // Photos (15 pts) — plus important pour location, conversion sans photos est faible
  if (photos.length === 0) {
    flags.push('no_photos')
    score -= 15
  } else if (photos.length === 1) {
    flags.push('few_photos')
    score -= 5
  }

  // Coordonnées (10 pts)
  if (lat === 0 || lng === 0) {
    flags.push('missing_coordinates')
    score -= 10
  }

  // Canton (5 pts)
  if (!listing.canton || listing.canton.length !== 2) {
    flags.push('missing_canton')
    score -= 5
  }

  // Titre (5 pts)
  if (!listing.title || listing.title.length < 5) {
    flags.push('missing_title')
    score -= 5
  }

  return {
    quality_score: Math.max(0, Math.min(100, score)),
    quality_flags: flags,
  }
}

// ─── Main loop ────────────────────────────────────────────────

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function scrapeListings(offerType) {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`  Scraping Flatfox offer_type=${offerType} (location uniquement)`)
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

  const stats = { fetched: 0, mapped: 0, skipped: 0, upserted: 0, errors: 0, pages: 0 }
  let offset = START_OFFSET
  let totalCount = null

  while (stats.pages < MAX_PAGES) {
    let page
    try {
      page = await fetchPage(offerType, offset)
    } catch (err) {
      console.error(`  ❌ Fetch error at offset ${offset}: ${err.message}`)
      stats.errors++
      break
    }

    if (totalCount === null) {
      totalCount = page.count
      console.log(`  Total ${offerType} listings on Flatfox : ${totalCount.toLocaleString('fr-CH')}`)
    }

    const results = page.results || []
    stats.fetched += results.length
    stats.pages++

    if (results.length === 0) {
      console.log(`  → No more results, stopping`)
      break
    }

    // Map + filter
    const rows = []
    for (const r of results) {
      const mapped = mapListing(r)
      if (mapped === null) {
        stats.skipped++
        continue
      }
      rows.push(mapped)
      stats.mapped++
    }

    // Upsert
    if (rows.length > 0) {
      const { upserted, errors } = await upsertBatch(rows)
      stats.upserted += upserted
      stats.errors += errors
    }

    const progress = totalCount > 0 ? `${Math.min(offset + results.length, totalCount).toLocaleString('fr-CH')} / ${totalCount.toLocaleString('fr-CH')}` : `${offset + results.length}`
    console.log(`  Page ${stats.pages.toString().padStart(3)} | offset ${offset.toString().padStart(5)} | fetched ${results.length.toString().padStart(3)} | mapped ${rows.length.toString().padStart(3)} | upserted ${stats.upserted.toString().padStart(5)} | progress ${progress}`)

    if (!page.next) {
      console.log(`  → Reached last page (no 'next' link)`)
      break
    }

    offset += PAGE_SIZE
    await sleep(DELAY_MS)
  }

  console.log(`\n  📊 Stats ${offerType} :`)
  console.log(`     fetched  : ${stats.fetched.toLocaleString('fr-CH')}`)
  console.log(`     mapped   : ${stats.mapped.toLocaleString('fr-CH')}`)
  console.log(`     skipped  : ${stats.skipped.toLocaleString('fr-CH')} (parking, etc.)`)
  console.log(`     upserted : ${stats.upserted.toLocaleString('fr-CH')}`)
  console.log(`     errors   : ${stats.errors}`)
  console.log(`     pages    : ${stats.pages}`)
  return stats
}

async function main() {
  console.log('🦊 Flatfox scraper → Supabase market_listings')
  console.log(`   Source: Flatfox.ch (LOCATION uniquement, ~33K biens)`)
  console.log(`   Mode: ${DRY_RUN ? '🔵 DRY RUN (no DB writes)' : '🟢 LIVE (writes to DB)'}`)
  console.log(`   transaction_type forcé : 'rent' (Flatfox = location only)`)
  console.log(`   Page size: ${PAGE_SIZE}`)
  console.log(`   Delay between requests: ${DELAY_MS}ms`)
  console.log(`   Max pages: ${MAX_PAGES === Infinity ? 'unlimited' : MAX_PAGES}`)
  if (START_OFFSET > 0) console.log(`   Starting offset: ${START_OFFSET}`)

  const startTime = Date.now()
  await scrapeListings(OFFER_TYPE)

  const elapsed = Math.round((Date.now() - startTime) / 1000)
  console.log(`\n✅ Done in ${Math.floor(elapsed / 60)}m ${elapsed % 60}s`)
  console.log(`   ℹ️  Pour les ventes, utiliser scrape-paginated.mjs (RealAdvisor).\n`)
}

main().catch((err) => {
  console.error('❌ Fatal error:', err)
  process.exit(1)
})
