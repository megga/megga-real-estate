// supabase/functions/realadvisor-sync/index.ts
//
// Sync RealAdvisor.ch → market_listings — surface INDÉPENDANTE (ne touche ni
// flatfox-sync ni market-scraper ; sa propre table realadvisor_sync_runs).
//
// Source : endpoint public anonyme `https://realadvisor.ch/api/listings`
//   - pas d'auth, pas de clé ; réponse JSON, 36 résultats/page (limit ignoré)
//   - pagination `page=N` (1-based), tri par défaut `created_at_desc`
//   - `total_count` dans chaque réponse → itération déterministe
//   Décision business/conformité : go explicite de Gregory (accès assumé). Le
//   robots.txt de RealAdvisor n'autorise pas /api/ ; on reste donc poli (pacing,
//   backoff, un seul run à la fois) et on n'active aucun cron sans décision.
//
// Architecture : identique à flatfox-sync (self-invoking chunks, verrou
// singleton, budget de temps, sweep) mais pagination AVANT — RealAdvisor honore
// `page` + `sort`, donc page=1..N du plus récent au plus ancien.
//
// Tolérance edge function Pro : ~150s/invocation → on rend la main à 100s.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ─── Config ──────────────────────────────────────────────────────

const RA_BASE = 'https://realadvisor.ch'
const PAGE_SIZE = 36           // fixe côté RealAdvisor
const CHUNK_PAGES = 8          // pages par bloc entre deux updates de tracking
const PACE_MS = 1500           // délai poli entre pages (anti bot-management Cloudflare)
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

// Concurrence structurelle = 1 : une invocation boucle des blocs en SÉRIE
// jusqu'à TIME_BUDGET_MS, puis fait UN seul self-invoke. Jamais de fan-out.
const TIME_BUDGET_MS = 100_000
// ~42k biens / 36 ≈ 1187 pages ; ~50 pages/invocation ≈ 24 relais. 80 = marge.
const MAX_HANDOFFS = 80
const STALE_RUN_MS = 10 * 60 * 1000

const MAX_PHOTOS = 60
const MAX_DESCRIPTION_CHARS = 8000

const BACKOFF_ON = new Set([429, 500, 502, 503, 504])
const BACKOFF_RETRIES = 4
const BACKOFF_BASE_MS = 2000

// Sweep : ne marque 'removed' que si on a revu ≥ 80% des biens attendus.
const SAFETY_MIN_RATIO = 0.8

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── Types ───────────────────────────────────────────────────────

interface SyncRequest {
  offer_type?: 'buy' | 'rent'      // défaut : 'buy' (RealAdvisor = surtout vente)
  place_slugs?: string[]           // ex ['canton-geneve'] ; vide/absent = toute la Suisse
  lang?: 'fr' | 'de' | 'en' | 'it'
  property_type?: string           // compositePropertyType_eq (HOUSE_APPT par défaut)
  max_pages?: number               // borne (run de test) ; absent = tout le catalogue
  page?: number                    // curseur de reprise (1-based)
  sync_start_at?: string
  mode?: 'chunk' | 'sweep'
  total_expected?: number
  stats?: SyncStats
  run_id?: string
  trigger_source?: string
  handoff_count?: number
}

interface SyncStats {
  fetched: number
  upserted: number
  skipped: number
  errors: number
  pages: number
  chunks: number
}

// Sous-ensemble du hit RealAdvisor qu'on projette en colonnes. Le hit COMPLET
// est conservé dans market_listings.source_payload (totalité garantie).
interface RawHit {
  id: number | string
  portal?: string | null
  title?: string | null
  translated_titles?: Record<string, string> | null
  description?: string | null
  property_main_type?: string | null
  property_type?: string | null
  offer_type?: string | null
  currency?: string | null
  sale_price?: number | null
  sale_price_per_living_surface?: number | null
  gross_rent_monthly?: number | null
  rent_net_monthly?: number | null
  rent_extra?: number | null
  number_of_rooms?: number | null
  number_of_bathrooms?: number | null
  number_of_parking?: number | null
  living_surface?: number | null
  usable_surface?: number | null
  computed_surface?: number | null
  land_surface?: number | null
  construction_year?: number | null
  renovation_year?: number | null
  address?: string | null
  postcode?: string | null
  locality?: string | null
  sub_locality?: string | null
  state?: string | null
  lat?: number | null
  lng?: number | null
  created_at?: string | null
  agency_name?: string | null
  agency_logo_url?: string | null
  agency_reference?: string | null
  agency_contact_phone_number?: string | null
  visit_contact_person?: string | null
  visit_contact_phone_number?: string | null
  bullet_points?: unknown
  images?: Array<{ file_name?: string; bucket_name?: string }> | null
}

interface RealAdvisorPage {
  total_count: number
  listings: RawHit[]
}

// ─── Type mapping (RealAdvisor → market_listings.type) ────────────

const TYPE_MAP: Record<string, string> = {
  APPT: 'apartment', HOUSE_APPT: 'house', HOUSE: 'house',
  ROOM: 'apartment', PARK: 'parking', BUILDING: 'commercial',
  COMMERCIAL: 'commercial', GASTRO: 'commercial', PROP: 'land', OTHER: 'apartment',
}

// ─── NPA → canton (réutilisé de flatfox-sync, ~95% de précision) ──

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

// Repli sur le nom de canton renvoyé par RealAdvisor (`state`) si le NPA échoue.
const STATE_MAP: Record<string, string> = {
  'Genève': 'GE', 'Geneva': 'GE', 'Genf': 'GE',
  'Vaud': 'VD', 'Waadt': 'VD',
  'Valais': 'VS', 'Wallis': 'VS',
  'Neuchâtel': 'NE', 'Fribourg': 'FR', 'Freiburg': 'FR',
  'Jura': 'JU', 'Berne': 'BE', 'Bern': 'BE',
  'Zurich': 'ZH', 'Zürich': 'ZH', 'Lucerne': 'LU', 'Luzern': 'LU',
  'Zoug': 'ZG', 'Zug': 'ZG', 'Schwyz': 'SZ', 'Tessin': 'TI', 'Ticino': 'TI',
  'Grisons': 'GR', 'Graubünden': 'GR', 'Bâle-Ville': 'BS', 'Basel-Stadt': 'BS',
  'Bâle-Campagne': 'BL', 'Basel-Landschaft': 'BL', 'Argovie': 'AG', 'Aargau': 'AG',
  'Soleure': 'SO', 'Solothurn': 'SO', 'Thurgovie': 'TG', 'Thurgau': 'TG',
  'Schaffhouse': 'SH', 'Schaffhausen': 'SH', 'Saint-Gall': 'SG', 'St. Gallen': 'SG',
  'Appenzell Rhodes-Extérieures': 'AR', 'Appenzell Ausserrhoden': 'AR',
  'Appenzell Rhodes-Intérieures': 'AI', 'Appenzell Innerrhoden': 'AI',
  'Glaris': 'GL', 'Glarus': 'GL', 'Nidwald': 'NW', 'Nidwalden': 'NW',
  'Obwald': 'OW', 'Obwalden': 'OW', 'Uri': 'UR',
}

function npaToCanton(postcode: unknown, state: unknown): string | null {
  const z = parseInt(String(postcode ?? '').trim(), 10)
  if (z && z >= 1000 && z <= 9999) {
    for (const [min, max, canton] of NPA_RANGES) {
      if (z >= min && z <= max) return canton
    }
  }
  const s = typeof state === 'string' ? state.trim() : ''
  if (s && STATE_MAP[s]) return STATE_MAP[s]
  return s || null
}

// ─── Photos : URL CDN RealAdvisor (imgproxy base64url) ────────────

function buildImageUrl(image: { file_name?: string; bucket_name?: string }): string | null {
  if (!image?.file_name) return null
  const bucket = image.bucket_name || 'aggregator-images'
  const encoded = btoa(`https://storage.googleapis.com/${bucket}/${image.file_name}`)
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `https://img.realadvisor.ch/_/rs:fill:1200:800:1:0/q:75/${encoded}.webp`
}

function buildPhotos(images: RawHit['images']): string[] {
  if (!Array.isArray(images)) return []
  const out: string[] = []
  for (const img of images.slice(0, MAX_PHOTOS)) {
    const url = buildImageUrl(img || {})
    if (url) out.push(url)
  }
  return out
}

function cleanDescription(raw: unknown): string | null {
  return typeof raw === 'string' && raw
    ? raw.replace(/<[^>]+>/g, '').substring(0, MAX_DESCRIPTION_CHARS)
    : null
}

// bullet_points = { fr:[], de:[], en:[], it:[] } : on préfère FR.
function extractFeatures(bp: unknown): string[] {
  if (!bp || typeof bp !== 'object') return []
  const o = bp as Record<string, unknown>
  const arr = o.fr ?? o.en ?? o.de ?? o.it
  return Array.isArray(arr) ? arr.filter((x: unknown): x is string => typeof x === 'string') : []
}

// ─── Quality score (vente : prix/m² ; location : loyer/m²) ────────

function computeQualityScore(row: Record<string, unknown>, offerType: string): { quality_score: number; quality_flags: string[] } {
  const flags: string[] = []
  let score = 100
  const price = Number(row.price) || 0
  const surface = Number(row.surface_m2) || 0
  const rooms = Number(row.rooms) || 0
  const lat = Number(row.lat) || 0
  const lng = Number(row.lng) || 0
  const photos = Array.isArray(row.photos) ? row.photos : []

  if (price <= 0) { flags.push('no_price'); score -= 15 }
  if (price > 0 && surface > 0) {
    const perM2 = price / surface
    if (offerType === 'rent') {
      if (perM2 < 8) { flags.push('rent_per_m2_low'); score -= 8 }
      else if (perM2 > 120) { flags.push('rent_per_m2_high'); score -= 12 }
    } else {
      if (perM2 < 1000) { flags.push('price_per_m2_low'); score -= 8 }
      else if (perM2 > 40000) { flags.push('price_per_m2_high'); score -= 8 }
    }
  } else if (price > 0 && surface <= 0) { flags.push('missing_surface'); score -= 8 }

  if (rooms <= 0 && row.type !== 'commercial' && row.type !== 'land' && row.type !== 'parking') {
    flags.push('missing_rooms'); score -= 5
  }
  if (photos.length === 0) { flags.push('no_photos'); score -= 15 }
  else if (photos.length === 1) { flags.push('few_photos'); score -= 5 }
  if (lat === 0 || lng === 0) { flags.push('missing_coordinates'); score -= 10 }
  if (!row.canton || String(row.canton).length !== 2) { flags.push('missing_canton'); score -= 5 }
  if (!row.title || String(row.title).length < 5) { flags.push('missing_title'); score -= 5 }

  return { quality_score: Math.max(0, Math.min(100, score)), quality_flags: flags }
}

// ─── Mapping hit → row market_listings ────────────────────────────

function listingPath(offerType: string): string {
  return offerType === 'rent' ? 'louer' : 'acheter'
}

function mapHit(h: RawHit, offerType: string, nowIso: string): Record<string, unknown> | null {
  if (h.id === undefined || h.id === null || h.id === '') return null
  const sourceId = String(h.id)
  const price = offerType === 'rent'
    ? (Number(h.gross_rent_monthly) || 0)
    : (Number(h.sale_price) || 0)
  if (price <= 0) return null

  const rawType = h.property_main_type || h.property_type || 'APPT'
  const photos = buildPhotos(h.images)
  const parking = typeof h.number_of_parking === 'number' ? h.number_of_parking : null
  const surface = Number(h.living_surface) || Number(h.computed_surface) || null

  const row: Record<string, unknown> = {
    source_portal: 'realadvisor',
    source_id: sourceId,
    source_url: `${RA_BASE}/fr/${listingPath(offerType)}/bien-immobilier/${sourceId}`,
    transaction_type: offerType,
    title: h.translated_titles?.fr || h.title || `Bien à ${h.locality || 'Suisse'}`,
    description: cleanDescription(h.description),
    type: TYPE_MAP[rawType] || 'apartment',
    property_type_detail: (h.property_type as string) || null,
    currency: h.currency || 'CHF',
    price,
    price_at_first_seen: price,
    current_price: price,
    price_per_m2: offerType === 'rent' ? null : (Number(h.sale_price_per_living_surface) || null),
    rooms: Number(h.number_of_rooms) || null,
    bathrooms: Number(h.number_of_bathrooms) || null,
    surface_m2: surface,
    usable_surface: Number(h.usable_surface) || null,
    land_surface: Number(h.land_surface) || null,
    year_built: (h.construction_year as number) ?? null,
    year_renovated: (h.renovation_year as number) ?? null,
    parking_count: parking,
    features: extractFeatures(h.bullet_points),
    photos,
    photos_count: photos.length,
    address: h.address || null,
    city: h.locality || null,
    postal_code: h.postcode ? String(h.postcode) : null,
    canton: npaToCanton(h.postcode, h.state),
    lat: h.lat ?? null,
    lng: h.lng ?? null,
    agency_name: h.agency_name || null,
    agency_phone: h.agency_contact_phone_number || null,
    agency_logo_url: h.agency_logo_url || null,
    agency_reference: h.agency_reference || null,
    visit_contact_name: h.visit_contact_person || null,
    visit_contact_phone: h.visit_contact_phone_number || null,
    charges_monthly: offerType === 'rent' && h.rent_extra ? Number(h.rent_extra) : null,
    source_created_at: h.created_at || null,
    first_seen_at: h.created_at || nowIso,
    last_seen_at: nowIso,
    status: 'active',
    source_payload: h, // TOTALITÉ : hit brut conservé
  }
  if (parking != null && parking > 0) row.has_parking = true
  const { quality_score, quality_flags } = computeQualityScore(row, offerType)
  row.quality_score = quality_score
  row.quality_flags = quality_flags
  return row
}

// ─── Fetch RealAdvisor /api/listings (avec backoff) ───────────────

function buildSearchParams(cfg: SyncRequest, page: number): URLSearchParams {
  const sp = new URLSearchParams()
  sp.set('offerType_eq', cfg.offer_type || 'buy')
  if (cfg.property_type) sp.set('compositePropertyType_eq', cfg.property_type)
  if (Array.isArray(cfg.place_slugs) && cfg.place_slugs.length > 0) {
    const lang = cfg.lang || 'fr'
    sp.set('placeSlugs', JSON.stringify(cfg.place_slugs.map((slug) => ({ slug, lang }))))
  }
  sp.set('sort', 'created_at_desc')
  sp.set('page', String(page))
  return sp
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchPage(cfg: SyncRequest, page: number): Promise<RealAdvisorPage> {
  const url = `${RA_BASE}/api/listings?${buildSearchParams(cfg, page).toString()}`
  let attempt = 0
  while (true) {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT, 'Accept-Language': 'fr-CH,fr;q=0.9,en;q=0.8' },
    })
    if (res.ok) {
      const body = await res.json()
      return { total_count: body.total_count ?? 0, listings: body.listings ?? [] }
    }
    // Vider le body pour fermer proprement la connexion avant un éventuel retry.
    await res.text().catch(() => {})
    if (BACKOFF_ON.has(res.status) && attempt < BACKOFF_RETRIES) {
      await sleep(BACKOFF_BASE_MS * 2 ** attempt)
      attempt += 1
      continue
    }
    throw new Error(`realadvisor /api/listings page ${page} → ${res.status}`)
  }
}

// ─── Upserts par batch (sous le timeout gateway ~60s) ─────────────

const UPSERT_BATCH = 25

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function upsertRows(supabase: any, rows: Record<string, unknown>[]): Promise<{ upserted: number; errors: number }> {
  if (rows.length === 0) return { upserted: 0, errors: 0 }
  let upserted = 0
  let errors = 0
  for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
    const batch = rows.slice(i, i + UPSERT_BATCH)
    const { error } = await supabase
      .from('market_listings')
      .upsert(batch, { onConflict: 'source_portal,source_id' })
    if (error) {
      console.error(`upsert batch ${i}-${i + batch.length}:`, error.message)
      errors += batch.length
    } else {
      upserted += batch.length
    }
  }
  return { upserted, errors }
}

// ─── Tracking realadvisor_sync_runs ───────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function reapStaleRuns(supabase: any): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_RUN_MS).toISOString()
  try {
    await supabase.from('realadvisor_sync_runs')
      .update({ status: 'failed', ended_at: new Date().toISOString(), error_message: 'auto-reaped: no chunk progress > 10min' })
      .eq('status', 'running').lt('last_chunk_at', cutoff)
    await supabase.from('realadvisor_sync_runs')
      .update({ status: 'failed', ended_at: new Date().toISOString(), error_message: 'auto-reaped: started but no chunk > 10min' })
      .eq('status', 'running').is('last_chunk_at', null).lt('started_at', cutoff)
  } catch (err) { console.error('[reap] exception:', err) }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function createRunRow(supabase: any, offerType: string, triggerSource: string | undefined): Promise<{ id: string | null; blocked: boolean }> {
  try {
    const { data, error } = await supabase
      .from('realadvisor_sync_runs')
      .insert({ offer_type: offerType, trigger_source: triggerSource || 'cron' })
      .select('id').single()
    if (error) {
      const blocked = error.code === '23505' || /duplicate key|unique/i.test(error.message || '')
      if (blocked) console.warn('[run create] another run already active — aborting')
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
    await supabase.from('realadvisor_sync_runs').update({
      total_expected: totalExpected || null,
      total_seen: stats.fetched,
      total_upserted: stats.upserted,
      total_errors: stats.errors,
      pages_fetched: stats.pages,
      chunks_completed: stats.chunks,
      last_chunk_at: new Date().toISOString(),
    }).eq('id', runId)
  } catch (err) { console.error('[run chunk] exception:', err) }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function finalizeRun(supabase: any, runId: string | undefined, final: { status: string; totalSeen?: number; removed?: number; errorMessage?: string }): Promise<void> {
  if (!runId) return
  try {
    await supabase.from('realadvisor_sync_runs').update({
      status: final.status,
      ended_at: new Date().toISOString(),
      total_seen: final.totalSeen ?? null,
      total_removed: final.removed ?? 0,
      error_message: final.errorMessage ?? null,
    }).eq('id', runId)
  } catch (err) { console.error('[run finalize] exception:', err) }
}

// ─── Self-invoke (attend l'ack 202 du prochain isolate) ───────────

async function selfInvoke(body: SyncRequest): Promise<void> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/realadvisor-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify(body),
    })
    await resp.text().catch(() => {})
    if (!resp.ok) console.error(`self-invoke status ${resp.status}`)
  } catch (err) { console.error('self-invoke failed:', err) }
}

// ─── Sweep : marque 'removed' les biens non revus dans ce sync ────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runSweep(supabase: any, offerType: string, syncStartAt: string, totalExpected: number): Promise<{ removed: number; skipped_safety: boolean }> {
  const { count: seen } = await supabase
    .from('market_listings').select('id', { count: 'exact', head: true })
    .eq('source_portal', 'realadvisor').eq('transaction_type', offerType)
    .gte('last_seen_at', syncStartAt)
  const totalSeen = seen ?? 0
  const ratio = totalExpected > 0 ? totalSeen / totalExpected : 0
  console.log(`[sweep] seen=${totalSeen} expected=${totalExpected} ratio=${Math.round(ratio * 100)}%`)
  if (ratio < SAFETY_MIN_RATIO) {
    console.warn(`⚠️ sweep skipped: only ${Math.round(ratio * 100)}% seen (< ${Math.round(SAFETY_MIN_RATIO * 100)}%)`)
    return { removed: 0, skipped_safety: true }
  }
  const { data, error } = await supabase
    .from('market_listings')
    .update({ status: 'removed', updated_at: new Date().toISOString() })
    .eq('source_portal', 'realadvisor').eq('transaction_type', offerType)
    .in('status', ['active', 'price_reduced']).lt('last_seen_at', syncStartAt)
    .select('id')
  if (error) { console.error('sweep error:', error.message); return { removed: 0, skipped_safety: false } }
  return { removed: Array.isArray(data) ? data.length : 0, skipped_safety: false }
}

// ─── Worker sériel avec budget de temps ───────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runBackground(body: SyncRequest, supabase: any): Promise<void> {
  const startedAtMs = Date.now()
  let runId: string | undefined = body.run_id
  const handoffCount = body.handoff_count ?? 0
  const offerType = body.offer_type || 'buy'
  try {
    const syncStartAt = body.sync_start_at ?? new Date().toISOString()
    const mode = body.mode ?? 'chunk'
    const stats: SyncStats = body.stats ?? { fetched: 0, upserted: 0, skipped: 0, errors: 0, pages: 0, chunks: 0 }
    let totalExpected = body.total_expected ?? 0

    if (mode === 'sweep') {
      const sweep = await runSweep(supabase, offerType, syncStartAt, totalExpected)
      console.log(`[sweep done] removed=${sweep.removed} skipped=${sweep.skipped_safety}`)
      await finalizeRun(supabase, runId, {
        status: sweep.skipped_safety ? 'safety_skipped' : 'completed',
        totalSeen: stats.fetched, removed: sweep.removed,
      })
      return
    }

    if (handoffCount > MAX_HANDOFFS) {
      console.error(`[chunk] handoff ceiling ${handoffCount} > ${MAX_HANDOFFS} — aborting`)
      await finalizeRun(supabase, runId, { status: 'failed', errorMessage: `exceeded MAX_HANDOFFS (${MAX_HANDOFFS})` })
      return
    }

    const nowIso = new Date().toISOString()

    // Première invocation : peek total_count + reap + acquisition du verrou.
    let startPage = body.page
    if (startPage === undefined) {
      const peek = await fetchPage(body, 1)
      totalExpected = peek.total_count || 0
      await reapStaleRuns(supabase)
      const lock = await createRunRow(supabase, offerType, body.trigger_source)
      if (lock.blocked) { console.warn('[chunk] aborting: another run active'); return }
      runId = lock.id ?? undefined
      // L'INSERT du run EST le verrou singleton : sans id (insert qui a throw, ou
      // pas de ligne retournée) on n'a NI verrou NI tracking → on abandonne plutôt
      // que de tourner non verrouillé et invisible au monitoring.
      if (!runId) { console.error('[chunk] aborting: run lock not acquired (no run id)'); return }
      startPage = 1
      console.log(`[chunk] first invocation: offer=${offerType} total=${totalExpected} runId=${runId}`)
    }

    // Traite un bloc de CHUNK_PAGES pages. Retourne true si le dataset est épuisé.
    const processBlock = async (firstPage: number): Promise<boolean> => {
      let done = false
      for (let i = 0; i < CHUNK_PAGES; i++) {
        const page = firstPage + i
        if (i > 0) await sleep(PACE_MS)
        const res = await fetchPage(body, page)
        if (totalExpected === 0 && res.total_count) totalExpected = res.total_count
        const listings = res.listings || []
        if (listings.length === 0) { done = true; break }
        stats.fetched += listings.length
        stats.pages++
        const rows: Record<string, unknown>[] = []
        for (const hit of listings) {
          const row = mapHit(hit, offerType, nowIso)
          if (row === null) { stats.skipped++; continue }
          rows.push(row)
        }
        const { upserted, errors } = await upsertRows(supabase, rows)
        stats.upserted += upserted
        stats.errors += errors
        // Dernière page atteinte (page partielle, couverture du total, ou borne de test).
        if (listings.length < PAGE_SIZE || (totalExpected > 0 && page * PAGE_SIZE >= totalExpected)) {
          done = true; break
        }
        if (body.max_pages && stats.pages >= body.max_pages) { done = true; break }
      }
      stats.chunks++
      return done
    }

    let page = startPage
    while (true) {
      const done = await processBlock(page)
      await updateRunChunk(supabase, runId, stats, totalExpected)
      const nextPage = page + CHUNK_PAGES
      console.log(`[chunk] pages ${page}..${nextPage - 1} done — upserted=${stats.upserted}/${totalExpected} elapsed=${Math.round((Date.now() - startedAtMs) / 1000)}s`)

      if (done) {
        // Un run scopé (placeSlugs) ou borné (max_pages) n'a pas vu tout le
        // catalogue → sweeper marquerait à tort 'removed' les biens hors scope.
        // On ne sweep que sur un run complet.
        const scoped = (Array.isArray(body.place_slugs) && body.place_slugs.length > 0) || !!body.max_pages
        if (scoped) {
          await finalizeRun(supabase, runId, { status: 'completed', totalSeen: stats.fetched, removed: 0 })
        } else {
          await selfInvoke({ mode: 'sweep', offer_type: offerType, sync_start_at: syncStartAt, stats, total_expected: totalExpected, run_id: runId, trigger_source: body.trigger_source })
        }
        return
      }
      if (Date.now() - startedAtMs > TIME_BUDGET_MS) {
        await selfInvoke({ ...body, page: nextPage, sync_start_at: syncStartAt, stats, total_expected: totalExpected, run_id: runId, handoff_count: handoffCount + 1 })
        return
      }
      await sleep(PACE_MS)
      page = nextPage
    }
  } catch (err) {
    console.error('realadvisor-sync background error:', err)
    await finalizeRun(supabase, runId, { status: 'failed', errorMessage: String(err).slice(0, 500) })
  }
}

// ─── Handler ──────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const body: SyncRequest = req.method === 'POST' ? await req.json().catch(() => ({})) : {}

    const work = runBackground(body, supabase)
    // @ts-expect-error EdgeRuntime is a Supabase-specific Deno global
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      // @ts-expect-error keep the isolate alive until the work resolves
      EdgeRuntime.waitUntil(work)
    }

    return new Response(
      JSON.stringify({ ok: true, accepted: true, offer_type: body.offer_type || 'buy', mode: body.mode ?? 'chunk', page: body.page ?? 1 }),
      { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('realadvisor-sync error:', err)
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
