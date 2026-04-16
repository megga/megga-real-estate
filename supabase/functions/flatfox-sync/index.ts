// supabase/functions/flatfox-sync/index.ts
//
// Sync automatique Flatfox.ch → market_listings
//
// Architecture self-invoking chunks :
//   - Chaque invocation traite CHUNK_PAGES pages (~25s)
//   - Se ré-invoque elle-même pour la tranche suivante (fire-and-forget via EdgeRuntime.waitUntil)
//   - Quand plus de résultats : mode='sweep' → marque les biens disparus
//
// Tolérance Edge Function Supabase : ~150s par invocation (Pro)
// Rate limit Flatfox : 1 req/s (respectueux partenaire)
//
// Trigger :
//   - Manuellement : POST {} vers l'URL de la fonction
//   - Automatiquement : pg_cron (voir migration 20260415_004_flatfox_sync_cron.sql)
//
// Greenlight Flatfox : Gregory (team Flatfox) — discussion 2026-04-15

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ─── Config ──────────────────────────────────────────────────────

const FLATFOX_BASE = 'https://flatfox.ch'
const PAGE_SIZE = 100
const CHUNK_PAGES = 5  // 5 pages × ~1.5s (fetch + upsert + delay) = ~8s par invocation
const DELAY_MS = 300   // 300ms entre pages (Flatfox ne rate-limite pas, on reste poli)
const USER_AGENT = 'MEGGA Real Estate Sync (contact: tech@megga.ch)'

// Safety : ne JAMAIS sweeper si on a upserté moins de N% du total attendu
// (protège contre un incident Flatfox qui retourne 0 listings → on supprimerait tout sinon)
const SAFETY_MIN_RATIO = 0.8 // au moins 80% des listings attendus doivent avoir été vus

// ─── Types ───────────────────────────────────────────────────────

interface SyncRequest {
  offset?: number          // offset dans l'API Flatfox (défaut : 0 = début du sync)
  sync_start_at?: string   // ISO timestamp de début de sync (propagé entre chunks)
  mode?: 'chunk' | 'sweep' // défaut : 'chunk'
  total_expected?: number  // rempli au premier chunk, propagé ensuite pour le safety check
  stats?: SyncStats        // stats accumulées
}

interface SyncStats {
  fetched: number
  upserted: number
  skipped: number
  errors: number
  pages: number
  chunks: number
}

interface FlatfoxListing {
  pk: number
  url: string
  offer_type: 'RENT' | 'BUY'
  object_type: string
  price_display: number | null
  rent_net: number | null
  rent_charges: number | null
  rent_gross: number | null
  short_title: string | null
  pitch_title: string | null
  description_title: string | null
  description: string | null
  surface_living: number | null
  surface_usable: number | null
  number_of_rooms: number | null
  floor: number | null
  attributes: Array<{ name: string }> | null
  is_furnished: boolean
  street: string | null
  zipcode: number | null
  city: string | null
  latitude: number | null
  longitude: number | null
  year_built: number | null
  moving_date: string | null
  created: string
  images: Array<{ pk: number; url: string; url_thumb_m?: string; url_thumb_l?: string; url_listing_search?: string; ordering?: number }> | null
  agency: { name?: string; name_2?: string; phone?: string; street?: string; zipcode?: string; city?: string; country?: string; logo?: { url?: string; url_org_logo_m?: string } } | null
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── Type mapping ────────────────────────────────────────────────

// Only truly irrelevant types are skipped (boats, gardening plots).
// Parkings, garages, storage, and offices are now included per Gregory's
// request (2026-04-16) — mapped to the new property types.
const TYPES_TO_SKIP = new Set([
  'BOAT_SLOT', 'GARDENING',
])

const TYPE_MAP: Record<string, string> = {
  // Residential
  APT: 'apartment', APARTMENT: 'apartment', FLAT: 'apartment',
  STUDIO: 'apartment', ATTIC_FLAT: 'apartment', ROOF_FLAT: 'apartment',
  DUPLEX: 'apartment', TERRACE_FLAT: 'apartment', GROUND_FLAT: 'apartment',
  LOFT: 'apartment', MAISONETTE: 'apartment', FURNISHED_FLAT: 'apartment',
  BACHELOR_FLAT: 'apartment', SHARED_FLAT: 'apartment', SINGLE_ROOM: 'apartment',
  GRANNY_FLAT: 'apartment',
  HOUSE: 'house', SINGLE_HOUSE: 'house', TERRACE_HOUSE: 'house',
  ROW_HOUSE: 'house', CHALET: 'house', FARM_HOUSE: 'house', DUPLEX_HOUSE: 'house',
  MULTI_FAMILY_HOUSE: 'house',
  VILLA: 'villa', BIFAMILIAR_HOUSE: 'house', MULTIFAMILIAR_HOUSE: 'house',
  // Office
  OFFICE: 'office', PRACTICE: 'office',
  // Commercial (shops, restaurants, workshops, warehouses, arcades, ateliers, etc.)
  SHOP: 'commercial', RESTAURANT: 'commercial', COMMERCIAL: 'commercial',
  WORKSHOP: 'commercial', WAREHOUSE: 'commercial',
  INDUSTRIAL_OBJECT: 'commercial', ATELIER: 'commercial', ARCADE: 'commercial',
  LIVING_COMMERCIAL_BUILDING: 'commercial', COFFEEHOUSE: 'commercial',
  // Parking / Garage
  GARAGE_SLOT: 'parking', SINGLE_GARAGE: 'parking', GARAGE: 'parking',
  OUTSIDE_PARK_SLOT: 'parking', COVERED_PARK_SLOT: 'parking',
  COVERED_SLOT: 'parking', OPEN_SLOT: 'parking', CARPORT: 'parking',
  COVERED_PARKING_PLACE_BIKE: 'parking', OUTDOOR_PARKING_PLACE_BIKE: 'parking',
  // Storage / Hobby
  STORAGE_ROOM: 'storage', PROVISION_ROOM: 'storage', HOBBY_ROOM: 'storage',
  // Land
  BUILDING_LAND: 'land', AGRICULTURAL_LAND: 'land',
}

// ─── NPA → canton (Suisse, précision ~95%) ───────────────────────

const NPA_RANGES: Array<[number, number, string]> = [
  [1000, 1099, 'VD'], [1100, 1199, 'VD'], [1200, 1299, 'GE'], [1300, 1399, 'VD'],
  [1400, 1499, 'VD'], [1500, 1599, 'VD'], [1600, 1699, 'FR'], [1700, 1799, 'FR'],
  [1800, 1899, 'VD'], [1900, 1999, 'VS'], [2000, 2099, 'NE'], [2100, 2399, 'NE'],
  [2400, 2499, 'NE'], [2500, 2549, 'BE'], [2550, 2799, 'BE'], [2800, 2999, 'JU'],
  [3000, 3199, 'BE'], [3200, 3299, 'BE'], [3300, 3399, 'BE'], [3400, 3499, 'BE'],
  [3500, 3599, 'BE'], [3600, 3699, 'BE'], [3700, 3799, 'BE'], [3800, 3899, 'BE'],
  [3900, 3999, 'VS'], [4000, 4099, 'BS'], [4100, 4199, 'BL'], [4200, 4299, 'BL'],
  [4300, 4399, 'AG'], [4400, 4499, 'BL'], [4500, 4699, 'SO'], [4700, 4899, 'BL'],
  [4900, 4999, 'BL'], [5000, 5499, 'AG'], [5500, 5999, 'AG'], [6000, 6099, 'LU'],
  [6100, 6299, 'LU'], [6300, 6399, 'ZG'], [6400, 6499, 'SZ'], [6500, 6599, 'TI'],
  [6600, 6699, 'TI'], [6700, 6799, 'GR'], [6800, 6899, 'TI'], [6900, 6999, 'TI'],
  [7000, 7599, 'GR'], [7600, 7899, 'GR'], [8000, 8099, 'ZH'], [8100, 8199, 'ZH'],
  [8200, 8299, 'SH'], [8300, 8499, 'ZH'], [8500, 8599, 'TG'], [8600, 8699, 'ZH'],
  [8700, 8729, 'ZH'], [8730, 8799, 'TG'], [8800, 8899, 'ZH'], [8900, 8999, 'ZH'],
  [9000, 9099, 'SG'], [9100, 9199, 'AR'], [9200, 9299, 'SG'], [9300, 9399, 'SG'],
  [9400, 9499, 'SG'], [9500, 9599, 'SG'], [9600, 9699, 'SG'], [9700, 9799, 'AI'],
  [9800, 9899, 'GR'], [9900, 9999, 'SG'],
]

function npaToCanton(zipcode: number | string | null): string | null {
  const z = parseInt(String(zipcode || '').trim(), 10)
  if (!z || z < 1000 || z > 9999) return null
  for (const [min, max, canton] of NPA_RANGES) {
    if (z >= min && z <= max) return canton
  }
  return null
}

// ─── Prix + features + photos ────────────────────────────────────

function mapPrice(l: FlatfoxListing): number {
  const display = Number(l.price_display) || 0
  if (display > 0) return display
  if (l.offer_type === 'RENT') {
    const gross = Number(l.rent_gross) || 0
    if (gross > 0) return gross
    const net = Number(l.rent_net) || 0
    const charges = Number(l.rent_charges) || 0
    if (net > 0) return net + charges
  }
  return 0
}

function mapPhotos(images: FlatfoxListing['images']): string[] {
  if (!Array.isArray(images)) return []
  // Sort by Flatfox's `ordering` field — the agency sets photo order, usually
  // the most attractive shot (façade, main room) is ordering=1.
  // Images without ordering go last.
  const sorted = [...images].sort((a, b) => {
    const oa = a?.ordering ?? Number.MAX_SAFE_INTEGER
    const ob = b?.ordering ?? Number.MAX_SAFE_INTEGER
    return oa - ob
  })
  const urls: string[] = []
  for (const img of sorted.slice(0, 10)) {
    if (img && typeof img === 'object') {
      // Use original full-resolution URL (no alias = ~100KB, sharp)
      // Avoids pixelation in lightbox and listing detail pages
      const path = img.url
      if (path) urls.push(path.startsWith('http') ? path : `${FLATFOX_BASE}${path}`)
    }
  }
  return urls
}

const ATTR_MAP: Record<string, string> = {
  lift: 'ascenseur', elevator: 'ascenseur',
  balconygarden: 'balcon', balcony: 'balcon', terrace: 'terrasse',
  garden: 'jardin', parking: 'parking', garage: 'garage',
  cellar: 'cave', fireplace: 'cheminée',
  pool: 'piscine', swimmingpool: 'piscine',
  dishwasher: 'lave-vaisselle', washingmachine: 'machine_à_laver', tumbler: 'sèche-linge',
  parquetflooring: 'parquet', quietneighborhood: 'quartier_calme',
  petsallowed: 'animaux_acceptés', minergiecertified: 'minergie',
  childfriendly: 'familial', barrierfree: 'accessible', airconditioning: 'climatisation',
}

function mapFeatures(attributes: FlatfoxListing['attributes']): string[] {
  if (!Array.isArray(attributes)) return []
  return attributes
    .map((a) => {
      const name = typeof a === 'string' ? a : a?.name
      return (name && ATTR_MAP[name]) || (typeof name === 'string' ? name : null)
    })
    .filter((s): s is string => typeof s === 'string')
}

// ─── Quality score (spécifique location — loyer/m² plutôt que prix/m²) ───

function computeQualityScore(row: Record<string, unknown>): { quality_score: number; quality_flags: string[] } {
  const flags: string[] = []
  let score = 100
  const price = Number(row.price) || 0
  const surface = Number(row.surface_m2) || 0
  const rooms = Number(row.rooms) || 0
  const lat = Number(row.lat) || 0
  const lng = Number(row.lng) || 0
  const photos = Array.isArray(row.photos) ? row.photos : []

  if (price <= 0) { flags.push('no_price'); score -= 15 }
  else if (price < 200) { flags.push('rent_too_low'); score -= 10 }
  else if (price > 15000) { flags.push('rent_too_high'); score -= 5 }

  if (price > 0 && surface > 0) {
    const rentPerM2 = price / surface
    if (rentPerM2 < 8) { flags.push('rent_per_m2_low'); score -= 8 }
    else if (rentPerM2 > 120) { flags.push('rent_per_m2_high'); score -= 12 }
  } else if (price > 0 && surface <= 0) { flags.push('missing_surface'); score -= 8 }

  if (surface > 0 && surface < 8) { flags.push('surface_too_small'); score -= 5 }
  if (rooms <= 0 && row.type !== 'commercial' && row.type !== 'land') {
    flags.push('missing_rooms'); score -= 5
  }
  if (photos.length === 0) { flags.push('no_photos'); score -= 15 }
  else if (photos.length === 1) { flags.push('few_photos'); score -= 5 }
  if (lat === 0 || lng === 0) { flags.push('missing_coordinates'); score -= 10 }
  if (!row.canton || String(row.canton).length !== 2) { flags.push('missing_canton'); score -= 5 }
  if (!row.title || String(row.title).length < 5) { flags.push('missing_title'); score -= 5 }

  return { quality_score: Math.max(0, Math.min(100, score)), quality_flags: flags }
}

// ─── Fetch Flatfox API + mapping ─────────────────────────────────

async function fetchFlatfoxPage(offset: number): Promise<{ results: FlatfoxListing[]; next: string | null; count: number }> {
  const url = `${FLATFOX_BASE}/api/v1/public-listing/?expand=images&offer_type=RENT&limit=${PAGE_SIZE}&offset=${offset}&ordering=-created`
  const resp = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT, 'Accept-Language': 'fr-CH,fr;q=0.9,en;q=0.8' },
  })
  if (!resp.ok) throw new Error(`Flatfox API ${resp.status}`)
  return resp.json()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
// Slugify agency name: "Apleona Schweiz AG" → "apleona-schweiz-ag"
function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

// Upsert all unique agencies from a batch and return a slug → id map.
// Called once per chunk (before mapping listings to rows).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function upsertAgencyProfiles(supabase: any, listings: FlatfoxListing[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const uniqueBySlug = new Map<string, {
    slug: string; name: string; logo_url: string | null; phone: string | null;
    address: string | null; zipcode: string | null; city: string | null; canton: string | null;
  }>()

  for (const ff of listings) {
    const parts = [ff.agency?.name, ff.agency?.name_2].filter(Boolean)
    const name = parts.length > 0 ? parts.join(' — ') : null
    if (!name) continue
    const slug = slugifyName(name)
    if (!slug || uniqueBySlug.has(slug)) continue
    const logoPath = ff.agency?.logo?.url_org_logo_m || ff.agency?.logo?.url || null
    uniqueBySlug.set(slug, {
      slug,
      name,
      logo_url: logoPath ? `${FLATFOX_BASE}${logoPath}` : null,
      phone: ff.agency?.phone || null,
      address: ff.agency?.street || null,
      zipcode: ff.agency?.zipcode || null,
      city: ff.agency?.city || null,
      canton: npaToCanton(ff.agency?.zipcode || null),
    })
  }

  if (uniqueBySlug.size === 0) return map

  const rows = Array.from(uniqueBySlug.values()).map(a => ({
    slug: a.slug,
    name: a.name,
    logo_url: a.logo_url,
    phone: a.phone,
    address: a.address,
    city: a.city,
    canton: a.canton,
    source: 'flatfox',
    status: 'unclaimed',
  }))

  const { data, error } = await supabase
    .from('agency_profiles')
    .upsert(rows, { onConflict: 'slug', ignoreDuplicates: false })
    .select('id, slug')

  if (error) {
    console.error('[agency_profiles upsert] error:', error.message)
    return map
  }

  if (data) {
    for (const row of data as Array<{ id: string; slug: string }>) {
      map.set(row.slug, row.id)
    }
  }
  return map
}

function mapListingToRow(ff: FlatfoxListing, nowIso: string, agencyProfileIdMap: Map<string, string>): Record<string, any> | null {
  if (TYPES_TO_SKIP.has(ff.object_type)) return null

  const transactionType = ff.offer_type === 'BUY' ? 'buy' : 'rent'
  const type = TYPE_MAP[ff.object_type] || 'apartment'
  const price = mapPrice(ff)
  const surface = Number(ff.surface_living) || Number(ff.surface_usable) || 0
  const rooms = Number(ff.number_of_rooms) || 0
  const photos = mapPhotos(ff.images)
  const features = mapFeatures(ff.attributes)

  const zipcode = ff.zipcode ? String(ff.zipcode).padStart(4, '0') : null
  const canton = npaToCanton(zipcode)
  const sourceUrl = ff.url ? `${FLATFOX_BASE}${ff.url}` : `${FLATFOX_BASE}/${ff.pk}/`
  const title = ff.short_title || ff.pitch_title || ff.description_title || `Bien à ${ff.city || 'Suisse'}`

  let availabilityDate: string | null = null
  if (ff.moving_date) {
    try { availabilityDate = new Date(ff.moving_date).toISOString().slice(0, 10) } catch { /* ignore */ }
  }

  const agencyParts = [ff.agency?.name, ff.agency?.name_2].filter(Boolean)
  const agencyName = agencyParts.length > 0 ? agencyParts.join(' — ') : null
  const agencyPhone = ff.agency?.phone || null
  const agencyLogoPath = ff.agency?.logo?.url_org_logo_m || ff.agency?.logo?.url || null
  const agencyLogoUrl = agencyLogoPath ? `${FLATFOX_BASE}${agencyLogoPath}` : null
  const agencyProfileId = agencyName ? agencyProfileIdMap.get(slugifyName(agencyName)) ?? null : null

  const row: Record<string, unknown> = {
    title,
    description: ff.description || '',
    type,
    transaction_type: transactionType,
    price,
    currency: 'CHF',
    rooms,
    surface_m2: surface,
    floor: ff.floor != null ? Number(ff.floor) : null,
    address: ff.street || null,
    city: ff.city || null,
    canton,
    postal_code: zipcode,
    lat: ff.latitude != null ? Number(ff.latitude) : null,
    lng: ff.longitude != null ? Number(ff.longitude) : null,
    photos,
    photos_count: photos.length,
    features,
    is_furnished: !!ff.is_furnished,
    availability_date: availabilityDate,
    external_regie: agencyName
      ? {
          name: agencyName,
          phone: agencyPhone || '',
          email: '',
          website: '',
          street: ff.agency?.street || '',
          zipcode: ff.agency?.zipcode || '',
          city: ff.agency?.city || '',
          country: ff.agency?.country || '',
        }
      : null,
    source_portal: 'flatfox',
    source_id: String(ff.pk),
    source_url: sourceUrl,
    agency_name: agencyName,
    agency_phone: agencyPhone,
    agency_logo_url: agencyLogoUrl,
    agency_profile_id: agencyProfileId,
    price_at_first_seen: price,
    current_price: price,
    first_seen_at: ff.created || nowIso,
    last_seen_at: nowIso,
    days_on_market: ff.created ? Math.floor((Date.now() - new Date(ff.created).getTime()) / 86400000) : 0,
    status: 'active',
    year_built: ff.year_built ? Number(ff.year_built) : null,
    charges_monthly: transactionType === 'rent' && ff.rent_charges ? Number(ff.rent_charges) : null,
  }
  const { quality_score, quality_flags } = computeQualityScore(row)
  row.quality_score = quality_score
  row.quality_flags = quality_flags
  return row
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function upsertRows(supabase: any, rows: Record<string, any>[]): Promise<{ upserted: number; errors: number }> {
  if (rows.length === 0) return { upserted: 0, errors: 0 }
  const { error } = await supabase
    .from('market_listings')
    .upsert(rows, { onConflict: 'source_portal,source_id' })
  if (error) {
    console.error('upsert error:', error.message)
    return { upserted: 0, errors: rows.length }
  }
  return { upserted: rows.length, errors: 0 }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

// ─── Self-invoke : lance le prochain isolate et ATTEND sa réponse ─────────
// On attend l'acknowledgement 202 du serveur pour garantir que le prochain
// chunk a démarré avant de rendre la main. Coût : ~200-500ms par chunk.
async function selfInvoke(body: SyncRequest): Promise<void> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const url = `${supabaseUrl}/functions/v1/flatfox-sync`
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify(body),
    })
    // Lire le body pour s'assurer que la connexion est bien fermée proprement
    await resp.text().catch(() => {})
    if (!resp.ok) {
      console.error(`self-invoke got status ${resp.status}`)
    }
  } catch (err) {
    console.error('self-invoke failed:', err)
  }
}

// ─── Sweep : marque 'removed' les biens Flatfox non vus depuis sync_start_at ───

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runSweep(supabase: any, syncStartAt: string, _totalSeen: number, totalExpected: number): Promise<{ removed: number; skipped_safety: boolean }> {
  // Count via DB (plus fiable que stats fragmentés entre chunks parallèles)
  const { count: actuallySeen } = await supabase
    .from('market_listings')
    .select('id', { count: 'exact', head: true })
    .eq('source_portal', 'flatfox')
    .gte('last_seen_at', syncStartAt)
  const totalSeen = actuallySeen ?? 0
  const ratio = totalExpected > 0 ? totalSeen / totalExpected : 0
  console.log(`[sweep check] totalSeen=${totalSeen} totalExpected=${totalExpected} ratio=${Math.round(ratio * 100)}%`)
  if (ratio < SAFETY_MIN_RATIO) {
    console.warn(`⚠️ Safety skip: only ${Math.round(ratio * 100)}% of expected listings upserted (${totalSeen}/${totalExpected}, threshold ${Math.round(SAFETY_MIN_RATIO * 100)}%). Sweep skipped to avoid wipe.`)
    return { removed: 0, skipped_safety: true }
  }
  // Marque comme removed : biens Flatfox encore actifs mais non revus dans ce sync.
  // On ne supprime JAMAIS les rows (historique conservé).
  const { data, error } = await supabase
    .from('market_listings')
    .update({ status: 'removed', updated_at: new Date().toISOString() })
    .eq('source_portal', 'flatfox')
    .in('status', ['active', 'price_reduced'])
    .lt('last_seen_at', syncStartAt)
    .select('id', { count: 'exact' })
  if (error) {
    console.error('sweep error:', error.message)
    return { removed: 0, skipped_safety: false }
  }
  const removed = Array.isArray(data) ? data.length : 0
  return { removed, skipped_safety: false }
}

// ─── Main handler ────────────────────────────────────────────────

// ─── Background worker : fait TOUT le travail après la réponse HTTP ────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runBackground(body: SyncRequest, supabase: any): Promise<void> {
  try {
    const offset = body.offset ?? 0
    const syncStartAt = body.sync_start_at ?? new Date().toISOString()
    const mode = body.mode ?? 'chunk'
    const stats: SyncStats = body.stats ?? { fetched: 0, upserted: 0, skipped: 0, errors: 0, pages: 0, chunks: 0 }
    let totalExpected = body.total_expected ?? 0

    // ─── SWEEP MODE ───
    if (mode === 'sweep') {
      console.log(`[sweep] totalSeen=${stats.upserted} totalExpected=${totalExpected} syncStartAt=${syncStartAt}`)
      const sweep = await runSweep(supabase, syncStartAt, stats.upserted, totalExpected)
      console.log(`[sweep done] removed=${sweep.removed} skipped_safety=${sweep.skipped_safety}`)
      return
    }

    // ─── CHUNK MODE ───
    // Stratégie anti-kill : on fait un peek sur la première page pour connaître
    // le total et décider si on a une suite. Puis on SCHEDULE tout de suite le
    // chunk suivant (ou le sweep) AVANT de faire le travail. Comme ça, même si
    // l'isolate se fait tuer mid-chunk, le prochain est déjà en queue.
    const nowIso = new Date().toISOString()
    const firstPage = await fetchFlatfoxPage(offset)
    if (totalExpected === 0 && firstPage.count) totalExpected = firstPage.count
    const firstResults = firstPage.results || []

    if (firstResults.length === 0) {
      // Fin du sync → déclenche le sweep
      console.log(`[chunk] reached end at offset=${offset}, triggering sweep`)
      await selfInvoke({ mode: 'sweep', sync_start_at: syncStartAt, stats, total_expected: totalExpected })
      return
    }

    // Schedule la suite SEULEMENT si Flatfox signale qu'il y a encore des résultats
    // après notre chunk courant. Évite de pre-scheduler un chunk vide qui déclencherait
    // un sweep prématuré.
    const nextOffset = offset + (CHUNK_PAGES * PAGE_SIZE)
    if (totalExpected === 0 || nextOffset < totalExpected) {
      await selfInvoke({ mode: 'chunk', offset: nextOffset, sync_start_at: syncStartAt, stats, total_expected: totalExpected })
    } else {
      // Ce chunk est le dernier → il déclenchera le sweep après son travail
      console.log(`[chunk] last chunk (offset=${offset}, nextOffset=${nextOffset} >= total=${totalExpected})`)
    }

    // Maintenant, le travail du chunk courant (peut se faire tuer sans casser la chaîne)
    let currentOffset = offset
    let pagesThisChunk = 0

    // Page 1 déjà fetched (firstPage)
    const processPage = async (results: FlatfoxListing[]) => {
      stats.fetched += results.length
      stats.pages++
      pagesThisChunk++
      // First: upsert all unique agencies in this page, get slug→id map
      const agencyProfileIdMap = await upsertAgencyProfiles(supabase, results)
      const rows: Record<string, unknown>[] = []
      for (const r of results) {
        const row = mapListingToRow(r, nowIso, agencyProfileIdMap)
        if (row === null) { stats.skipped++; continue }
        rows.push(row)
      }
      const { upserted, errors } = await upsertRows(supabase, rows)
      stats.upserted += upserted
      stats.errors += errors
    }

    await processPage(firstResults)
    if (!firstPage.next) {
      console.log(`[chunk done-early] offset=${offset} pages=${pagesThisChunk} upserted=${stats.upserted}/${totalExpected}`)
      return
    }

    let reachedEnd = !firstPage.next
    while (pagesThisChunk < CHUNK_PAGES) {
      currentOffset += PAGE_SIZE
      await sleep(DELAY_MS)
      const page = await fetchFlatfoxPage(currentOffset)
      const results = page.results || []
      if (results.length === 0) { reachedEnd = true; break }
      await processPage(results)
      if (!page.next) { reachedEnd = true; break }
    }
    stats.chunks++
    console.log(`[chunk ${stats.chunks}] offset=${offset}→${currentOffset} pages=${pagesThisChunk} upserted=${stats.upserted}/${totalExpected} reachedEnd=${reachedEnd}`)

    // Si ce chunk est le dernier (API signale fin OU nextOffset au-delà du total),
    // et qu'on n'a PAS pré-scheduled un chunk suivant, on déclenche le sweep nous-même.
    const weScheduledNext = totalExpected === 0 || nextOffset < totalExpected
    if (reachedEnd && !weScheduledNext) {
      console.log(`[chunk] last chunk completed, triggering sweep`)
      await selfInvoke({ mode: 'sweep', sync_start_at: syncStartAt, stats, total_expected: totalExpected })
    }
  } catch (err) {
    console.error('flatfox-sync background error:', err)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    const body: SyncRequest = req.method === 'POST' ? await req.json().catch(() => ({})) : {}

    // Fire-and-forget : on démarre le worker en arrière-plan et on répond
    // immédiatement pour éviter tout timeout côté pg_net / caller HTTP.
    const work = runBackground(body, supabase)
    // @ts-expect-error EdgeRuntime is Supabase-specific Deno global
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      // @ts-expect-error EdgeRuntime.waitUntil keeps the isolate alive until promise resolves
      EdgeRuntime.waitUntil(work)
    }
    // Fallback (dev/local) : on laisse le worker tourner mais on répond quand même

    return new Response(
      JSON.stringify({ ok: true, accepted: true, mode: body.mode ?? 'chunk', offset: body.offset ?? 0 }),
      { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('flatfox-sync error:', err)
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
