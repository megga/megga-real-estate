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
// ⚠ Le payload Flatfox ne porte AUCUN libellé de canton (que zipcode + city), on
// appelle donc npaToCanton sans second argument : les 31 NPA à cheval sur deux
// cantons restent tranchés à la majorité d'adresses, faute de mieux. Tout le
// reste est exact depuis le passage au registre swisstopo — cf. _shared/npa.ts.
import { npaToCanton } from '../_shared/npa.ts'
import { reportEdgeError } from '../_shared/audit-edge-error.ts'
import { isServiceSecret } from '../_shared/require-service-secret.ts'

// ─── Config ──────────────────────────────────────────────────────

const FLATFOX_BASE = 'https://flatfox.ch'
const PAGE_SIZE = 100
const CHUNK_PAGES = 5  // pages traitées par "bloc" entre deux updates de tracking
const DELAY_MS = 300   // 300ms entre pages (Flatfox ne rate-limite pas, on reste poli)
const USER_AGENT = 'MEGGA Real Estate Sync (contact: tech@megga.ch)'

// Safety : ne JAMAIS sweeper si on a upserté moins de N% du total attendu
// (protège contre un incident Flatfox qui retourne 0 listings → on supprimerait tout sinon)
const SAFETY_MIN_RATIO = 0.8 // au moins 80% des listings attendus doivent avoir été vus

// ─── Anti-fan-out / concurrence (le fix de fond) ──────────────────────────
// Une invocation traite des blocs EN SÉRIE dans une seule boucle jusqu'à
// TIME_BUDGET_MS, PUIS fait UN SEUL self-invoke pour continuer. La concurrence
// est donc structurellement 1 (au lieu du fan-out parallèle de l'ancienne
// version qui planifiait le chunk suivant AVANT de bosser → ~40 invocations
// simultanées → pool de 60 connexions épuisé → DB down).
//
// Supabase Pro edge functions : ~150s de wall-clock par invocation. On rend
// la main à 100s pour garder une marge (le self-invoke + le dernier
// updateRunChunk + le sweep ont besoin de temps).
const TIME_BUDGET_MS = 100_000
// Plafond dur sur le nombre de relais : ~35k biens / ~4k par relais ≈ 9 relais
// en régime normal. 30 = marge large ; au-delà c'est forcément un bug → on
// coupe pour ne JAMAIS partir en runaway.
const MAX_HANDOFFS = 30
// Un run 'running' dont le dernier chunk date de > 10 min est considéré mort :
// on le marque 'failed' au démarrage du run suivant pour libérer le verrou
// singleton (sinon une chaîne morte bloquerait tous les runs futurs).
const STALE_RUN_MS = 10 * 60 * 1000

// ─── Types ───────────────────────────────────────────────────────

interface SyncRequest {
  offset?: number          // offset dans l'API Flatfox (défaut : 0 = début du sync)
  sync_start_at?: string   // ISO timestamp de début de sync (propagé entre chunks)
  mode?: 'chunk' | 'sweep' // défaut : 'chunk'
  total_expected?: number  // rempli au premier chunk, propagé ensuite pour le safety check
  stats?: SyncStats        // stats accumulées
  run_id?: string          // id de la row flatfox_sync_runs (créée au premier chunk)
  trigger_source?: string  // 'cron' | 'manual' | etc — stocké dans flatfox_sync_runs
  handoff_count?: number   // nombre de relais self-invoke déjà faits (plafond MAX_HANDOFFS)
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

function mapListingToRow(ff: FlatfoxListing, nowIso: string, agencyProfileIdMap: Map<string, string>): Record<string, unknown> | null {
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

// Batch upserts to keep each PostgREST call under Cloudflare's ~60s gateway
// timeout. market_listings carries ~19 indexes per row, and the index
// maintenance cost dominates upsert time — a 100-row batch (the page size)
// was reliably tripping 504 on the daily run. 25 rows × ~19 indexes per row
// stays comfortably under 10s per batch under normal load.
const UPSERT_BATCH = 25

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function upsertRows(supabase: any, rows: Record<string, any>[]): Promise<{ upserted: number; errors: number }> {
  if (rows.length === 0) return { upserted: 0, errors: 0 }
  let upserted = 0
  let errors = 0
  for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
    const batch = rows.slice(i, i + UPSERT_BATCH)
    const { error } = await supabase
      .from('market_listings')
      .upsert(batch, { onConflict: 'source_portal,source_id' })
    if (error) {
      console.error(`upsert batch error (rows ${i}-${i + batch.length}):`, error.message)
      errors += batch.length
    } else {
      upserted += batch.length
    }
  }
  return { upserted, errors }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

// ─── flatfox_sync_runs tracking ───────────────────────────────────
// Lightweight observability so the admin dashboard can detect dead or
// degraded runs. One row per run: insert on the first chunk, increment on
// every chunk, finalize on sweep / error. All writes use service_role and
// silently no-op if the table is unavailable (the sync must never fail
// because tracking failed).

// Reap dead runs BEFORE trying to acquire the lock. A 'running' row whose
// last_chunk_at is older than STALE_RUN_MS (or which never recorded a chunk
// and is older than STALE_RUN_MS) is considered dead — mark it 'failed' so the
// singleton unique index frees up and a new run can start. Without this, one
// crashed chain would block every future run forever.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function reapStaleRuns(supabase: any): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_RUN_MS).toISOString()
  try {
    // Rows that recorded at least one chunk but went silent.
    await supabase.from('flatfox_sync_runs')
      .update({ status: 'failed', ended_at: new Date().toISOString(), error_message: 'auto-reaped: no chunk progress > 10min (chain died)' })
      .eq('status', 'running')
      .lt('last_chunk_at', cutoff)
    // Rows that died at chunk 0 (never set last_chunk_at).
    await supabase.from('flatfox_sync_runs')
      .update({ status: 'failed', ended_at: new Date().toISOString(), error_message: 'auto-reaped: started but no chunk > 10min (chain died early)' })
      .eq('status', 'running')
      .is('last_chunk_at', null)
      .lt('started_at', cutoff)
  } catch (err) { console.error('[reap] exception:', err) }
}

// Acquire the singleton lock by INSERTing a 'running' row. The partial unique
// index flatfox_sync_runs_one_running guarantees at most one running row, so a
// concurrent INSERT fails with 23505 → we report blocked=true and the caller
// aborts. This is the DB-level guarantee against the parallel fan-out.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function createRunRow(supabase: any, triggerSource: string | undefined): Promise<{ id: string | null; blocked: boolean }> {
  try {
    const { data, error } = await supabase
      .from('flatfox_sync_runs')
      .insert({ trigger_source: triggerSource || 'cron' })
      .select('id')
      .single()
    if (error) {
      // 23505 = unique_violation on flatfox_sync_runs_one_running → a run is
      // already active. Any other error → treat as a soft failure (no tracking).
      const blocked = (error.code === '23505') || /duplicate key|unique/i.test(error.message || '')
      if (blocked) console.warn('[run create] another run is already active — aborting this trigger')
      else console.error('[run create] error:', error.message)
      return { id: null, blocked }
    }
    return { id: data?.id ?? null, blocked: false }
  } catch (err) {
    console.error('[run create] exception:', err); return { id: null, blocked: false }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function updateRunChunk(supabase: any, runId: string | undefined, stats: SyncStats, totalExpected: number): Promise<void> {
  if (!runId) return
  try {
    await supabase.from('flatfox_sync_runs').update({
      total_expected: totalExpected || null,
      total_upserted: stats.upserted,
      total_errors: stats.errors,
      pages_fetched: stats.pages,
      chunks_completed: stats.chunks,
      last_chunk_at: new Date().toISOString(),
    }).eq('id', runId)
  } catch (err) { console.error('[run chunk update] exception:', err) }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function finalizeRun(supabase: any, runId: string | undefined, final: {
  status: 'completed' | 'failed' | 'safety_skipped'
  totalSeen?: number
  removed?: number
  errorMessage?: string
}): Promise<void> {
  if (!runId) return
  try {
    await supabase.from('flatfox_sync_runs').update({
      status: final.status,
      ended_at: new Date().toISOString(),
      total_seen: final.totalSeen ?? null,
      total_removed: final.removed ?? 0,
      error_message: final.errorMessage ?? null,
    }).eq('id', runId)
  } catch (err) { console.error('[run finalize] exception:', err) }
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

// ─── Background worker : worker SÉRIEL avec budget de temps ────────────────
// Une invocation = une boucle qui traite des blocs descendants jusqu'à
// TIME_BUDGET_MS, puis UN seul self-invoke pour continuer (concurrence = 1).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runBackground(body: SyncRequest, supabase: any): Promise<void> {
  const startedAtMs = Date.now()
  let runId: string | undefined = body.run_id
  const handoffCount = body.handoff_count ?? 0
  try {
    const syncStartAt = body.sync_start_at ?? new Date().toISOString()
    const mode = body.mode ?? 'chunk'
    const stats: SyncStats = body.stats ?? { fetched: 0, upserted: 0, skipped: 0, errors: 0, pages: 0, chunks: 0 }
    let totalExpected = body.total_expected ?? 0

    // ─── SWEEP MODE ───
    if (mode === 'sweep') {
      console.log(`[sweep] totalSeen=${stats.upserted} totalExpected=${totalExpected} syncStartAt=${syncStartAt}`)
      const sweep = await runSweep(supabase, syncStartAt, stats.upserted, totalExpected)
      console.log(`[sweep done] removed=${sweep.removed} skipped_safety=${sweep.skipped_safety}`)

      // Dé-duplication des logos d'agence : Flatfox attribue le même logo (compte
      // org partagé) à des agences distinctes, que l'upsert ci-dessus recopie tel
      // quel → un faux logo s'affiche (ex. un garage avec le logo d'une régie).
      // On re-vide les logos partagés par des agences aux noms dissemblables.
      // Rejoué à chaque passe car l'upsert les réécrit. Non bloquant.
      try {
        const { data: logoNulled, error: logoErr } = await supabase.rpc('suppress_agency_logo_collisions')
        if (logoErr) console.error('[logo dedup] error:', logoErr.message)
        else console.log(`[logo dedup] cleared ${logoNulled ?? 0} mismatched agency logos`)
      } catch (e) {
        console.error('[logo dedup] threw:', String(e))
      }

      await finalizeRun(supabase, runId, {
        status: sweep.skipped_safety ? 'safety_skipped' : 'completed',
        totalSeen: stats.upserted,
        removed: sweep.removed,
      })
      return
    }

    // ─── Plafond dur anti-runaway ───
    if (handoffCount > MAX_HANDOFFS) {
      console.error(`[chunk] handoff ceiling exceeded (${handoffCount} > ${MAX_HANDOFFS}) — aborting`)
      await finalizeRun(supabase, runId, { status: 'failed', errorMessage: `exceeded MAX_HANDOFFS (${MAX_HANDOFFS})` })
      return
    }

    // ⚠️ L'API Flatfox ignore `ordering=-created` — les résultats sortent
    // toujours du plus ancien (offset 0) au plus récent (offset ≈ count). On
    // marche donc à REBOURS : on commence près de `count` et on décrémente, pour
    // capturer les annonces les plus fraîches en premier si la chaîne meurt.
    const nowIso = new Date().toISOString()
    const CHUNK_SPAN = CHUNK_PAGES * PAGE_SIZE

    // ─── Première invocation : peek count + reap + acquisition du verrou ───
    let blockStart = body.offset
    if (blockStart === undefined) {
      const peek = await fetchFlatfoxPage(0)
      totalExpected = peek.count || 0
      // Libère un éventuel verrou mort AVANT de tenter de prendre le nôtre.
      await reapStaleRuns(supabase)
      const lock = await createRunRow(supabase, body.trigger_source)
      if (lock.blocked) {
        // Un autre run est déjà actif (cron qui se superpose, double-fire,
        // run manuel en cours). On abandonne proprement — pas de fan-out.
        console.warn('[chunk] aborting: another sync run is already active')
        return
      }
      runId = lock.id ?? undefined
      blockStart = Math.max(0, totalExpected - CHUNK_SPAN)
      console.log(`[chunk] first invocation: total=${totalExpected}, starting at offset=${blockStart}, runId=${runId}`)
    }

    // Traite UN bloc (jusqu'à CHUNK_PAGES pages) à l'offset donné.
    const processBlock = async (off: number): Promise<void> => {
      for (let p = 0; p < CHUNK_PAGES; p++) {
        const pageOffset = off + p * PAGE_SIZE
        if (p > 0) await sleep(DELAY_MS)
        const page = await fetchFlatfoxPage(pageOffset)
        if (totalExpected === 0 && page.count) totalExpected = page.count
        const results = page.results || []
        if (results.length === 0) break
        stats.fetched += results.length
        stats.pages++
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
        if (!page.next) break
      }
      stats.chunks++
    }

    // ─── Boucle sérielle : descend les blocs jusqu'au budget de temps ───
    while (true) {
      await processBlock(blockStart)
      await updateRunChunk(supabase, runId, stats, totalExpected)
      console.log(`[chunk] block offset=${blockStart} done — upserted=${stats.upserted}/${totalExpected} pages=${stats.pages} elapsed=${Math.round((Date.now() - startedAtMs) / 1000)}s`)

      // Atteint le début du dataset → terminé, on lance le sweep (UN hop,
      // budget de temps frais pour l'UPDATE de sweep).
      if (blockStart === 0) {
        console.log('[chunk] reached offset 0 — handing off to sweep')
        await selfInvoke({ mode: 'sweep', sync_start_at: syncStartAt, stats, total_expected: totalExpected, run_id: runId, trigger_source: body.trigger_source })
        return
      }

      const nextBlock = Math.max(0, blockStart - CHUNK_SPAN)

      // Budget de temps dépassé → UN seul self-invoke de continuation, puis stop.
      if (Date.now() - startedAtMs > TIME_BUDGET_MS) {
        console.log(`[chunk] time budget reached — handing off chunk at offset=${nextBlock} (handoff ${handoffCount + 1})`)
        await selfInvoke({ mode: 'chunk', offset: nextBlock, sync_start_at: syncStartAt, stats, total_expected: totalExpected, run_id: runId, trigger_source: body.trigger_source, handoff_count: handoffCount + 1 })
        return
      }

      blockStart = nextBlock
    }
  } catch (err) {
    console.error('flatfox-sync background error:', err)
    await finalizeRun(supabase, runId, {
      status: 'failed',
      errorMessage: String(err).slice(0, 500),
    })
    // `flatfox_sync_runs` garde déjà la trace détaillée du run ; l'événement
    // d'audit sert la vue plateforme (santé par fonction, compteur 24 h, seuil
    // e-mail) qui ne connaît pas cette table.
    await reportEdgeError(supabase, 'flatfox-sync', err, { startedAt: startedAtMs })
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    // ── Auth : appel interne uniquement (pg_cron `flatfox-sync-daily`, self-invoke) ──
    // La fonction n'avait AUCUNE garde. Elle est déployée --no-verify-jwt, donc
    // elle était joignable par n'importe qui — et `mode:'sweep'` lit son garde-fou
    // `total_expected` dans le CORPS de la requête : un appelant anonyme fournissait
    // le dénominateur du ratio de sécurité et faisait passer tout le corpus Flatfox
    // actif en `removed` (le corpus qui alimente le matching CRM).
    // Le cron forwarde `app_config.service_role_key`, le self-invoke (ligne ~551)
    // envoie la clé env : `isServiceSecret` accepte les deux.
    if (!(await isServiceSecret(supabase, req))) {
      return new Response(
        JSON.stringify({ ok: false, error: 'service_role required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

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
