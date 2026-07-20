// supabase/functions/realadvisor-sync/index.ts
//
// Sync RealAdvisor.ch → market_listings — surface INDÉPENDANTE (ne touche ni
// flatfox-sync ni market-scraper ; sa propre table realadvisor_sync_runs).
//
// Source : endpoint public anonyme `https://realadvisor.ch/api/listings`.
//   Décision business/conformité : go explicite de Gregory (accès assumé). Le
//   robots.txt de RealAdvisor n'autorise pas /api/ ; on reste donc poli (pacing,
//   backoff, un seul run à la fois) et AUCUN cron n'est posé sans décision.
//
// ⚠️ CAP D'API : /api/listings plafonne TOUTE requête à ~750-900 résultats
// (pagination morte au-delà de ~page 22). Une simple pagination 1..N ne verrait
// donc que les ~900 premiers biens sur ~42 716. Pour TOUT avoir, on PARTITIONNE
// l'espace de recherche en "slices" assez petits pour passer sous le cap :
//   canton (les 26 cantons couvrent 100% : Σ counts = total_count exact)
//   × tranche de prix (salePrice/grossRentMonthly) pour les cantons denses.
// Chaque slice est paginé entièrement ; on balaye la work-list de slices,
// résumable par `slice_index` entre invocations (archi self-invoke + budget de
// temps + verrou singleton, comme flatfox-sync).
//
// Tolérance edge function Pro : ~150s/invocation → on rend la main à 100s.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ─── Config ──────────────────────────────────────────────────────

const RA_BASE = 'https://realadvisor.ch'
const PAGE_SIZE = 36
// Pacing volontairement lent : RA/Cloudflare throttle sous requêtes rapides
// soutenues (renvoie des 200 au corps non-JSON ou des listes vides). 2.5s + le
// retry anti-troncature ci-dessous = ingestion fiable au prix de la lenteur.
const PACE_MS = 2500
// UA par défaut : string Chrome générique qui PASSE le WAF Cloudflare de RA aujourd'hui.
// Surchargeable SANS redeploy via app_config.realadvisor_user_agent (cf loadIdentity) —
// on garde celui-ci comme fallback/rollback tant que RA n'a pas whitelisté un UA dédié.
const UA_DEFAULT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const TIME_BUDGET_MS = 100_000
const MAX_HANDOFFS = 200
const STALE_RUN_MS = 10 * 60 * 1000

// Plafond de temps d'UN slice. Le budget global n'est testé qu'entre deux slices : sans
// cette borne, un slice qui enchaîne les retries dépasse la tolérance de l'isolate, qui meurt
// AVANT finalizeRun/selfInvoke — le run reste alors 'running' et tient le verrou singleton
// jusqu'au reap (STALE_RUN_MS).
//
// Calibrage : RA plafonne à 20 pages (720 résultats), donc un slice PLEIN coûte
// 19 × PACE_MS + 20 fetches ≈ 60-70 s — mesuré à ~59 s sur la slice non filtrée de Genève.
// 90 s laisse de la marge sans tronquer un slice légitime.
//
// ⚠ Cette deadline n'est testée qu'en TÊTE de la boucle de pages, jamais pendant les retries
// d'une page. Une page qui pend coûte encore jusqu'à BACKOFF_RETRIES+1 timeouts + les backoffs
// (~155 s) PAR-DESSUS. Le pire cas d'invocation n'est donc pas TIME_BUDGET_MS + SLICE_MAX_MS :
// il peut approcher ~255 s. Borner la deadline jusque dans fetchPage reste à faire.
// La tolérance réelle de l'isolate n'est pas établie — seulement minorée par une invocation
// de ~214 s observée le 20/07.
const SLICE_MAX_MS = 90_000

// Timeout dur par requête. Sans lui, un RA qui accepte la connexion sans jamais répondre
// bloque l'invocation entière (le fetch de fetchPage était nu, contrairement à fetchIdIn).
const FETCH_TIMEOUT_MS = 25_000

// Nb de slices consécutifs en échec au-delà duquel on arrête le run : RA est en vrac,
// insister ne fait qu'aggraver le throttle.
const MAX_CONSECUTIVE_SLICE_FAILURES = 5

// Le cap réel observé flotte vers ~750-900. On pagine jusqu'à MAX_PAGES_PER_SLICE
// (la fenêtre atteignable) ; un slice dont total_count dépasse SLICE_CAP et qu'on
// n'a pas pu épuiser est marqué "capped" (résidu connu, loggé).
const MAX_PAGES_PER_SLICE = 28
const SLICE_CAP = 700

const MAX_PHOTOS = 60
const MAX_DESCRIPTION_CHARS = 8000

// RA est derrière Cloudflare, dont la famille 52x signale un incident TRANSITOIRE amont
// (524 = l'origine n'a pas répondu à temps). Le 524 est attesté : il a tué une énumération
// de 25 cantons au bout de 9 minutes le 20/07 parce qu'il ne figurait pas ici. Les autres
// 52x sont ajoutés par analogie de famille — non observés à ce jour.
const BACKOFF_ON = new Set([429, 500, 502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 527, 530])
const BACKOFF_RETRIES = 4
const BACKOFF_BASE_MS = 2000

const SAFETY_MIN_RATIO = 0.8

// ─── Sweep ENUM (suppression destructive SÛRE, cf red-team 19 juin) ───
// On ne supprime un bien QUE s'il tombe dans un slice (canton×bande) RÉELLEMENT
// énuméré en entier ce cycle (reçu fully_enumerated) et qu'il n'a pas été revu. Les
// résidus inatteignables (price=0 hors bandes, bandes plafonnées, cantons throttlés)
// ne sont jamais dans un reçu fully_enumerated → jamais supprimés. La fenêtre de cycle
// (8j) + le double plafond = garde-fou anti-wipe. Détails : runSweepEnum + RPC.
const SWEEP_WINDOW_DAYS = 8       // un canton est re-crawlé 1×/7j → fenêtre 8j (1j de marge)
const SWEEP_CAP_ABS = 1200        // jamais > 1200 retraits en une passe
const SWEEP_CAP_PCT = 0.03        // ni > 3% du vivant (au-delà = anomalie → on s'abstient)

// ─── Mode PROBE : oracle id_in (détection de disparition SANS énumération) ───
// On n'énumère plus le catalogue (throttlé). On DEMANDE « sur ces 36 ids, combien
// existent encore ? » → GET /api/listings?offerType_eq=buy&id_in=<36 ids>. absent =
// 36 − total_count. Requête légère/peu profonde → échappe au throttle des requêtes
// filtrées+paginées (hypothèse mesurée). Détails : runProbe.
const PROBE_BATCH = 36            // ids distincts par requête id_in (= cap d'une page)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 26 cantons (slugs RealAdvisor validés : Σ counts = total_count exact).
const CANTONS = [
  'canton-geneve', 'canton-vaud', 'canton-valais', 'canton-fribourg', 'canton-neuchatel',
  'canton-jura', 'canton-berne', 'canton-zurich', 'canton-lucerne', 'canton-zoug',
  'canton-schwyz', 'canton-tessin', 'canton-grisons', 'canton-bale-ville', 'canton-bale-campagne',
  'canton-argovie', 'canton-soleure', 'canton-thurgovie', 'canton-schaffhouse', 'canton-saint-gall',
  'canton-appenzell-rhodes-exterieures', 'canton-appenzell-rhodes-interieures', 'canton-glaris',
  'canton-nidwald', 'canton-obwald', 'canton-uri',
]

// slug RA → code canton 2 lettres (= market_listings.canton, dérivé du NPA). Sert au
// sweep ENUM : relier un reçu de slice (indexé par slug) aux lignes market_listings.
const SLUG_TO_CODE: Record<string, string> = {
  'canton-geneve': 'GE', 'canton-vaud': 'VD', 'canton-valais': 'VS', 'canton-fribourg': 'FR',
  'canton-neuchatel': 'NE', 'canton-jura': 'JU', 'canton-berne': 'BE', 'canton-zurich': 'ZH',
  'canton-lucerne': 'LU', 'canton-zoug': 'ZG', 'canton-schwyz': 'SZ', 'canton-tessin': 'TI',
  'canton-grisons': 'GR', 'canton-bale-ville': 'BS', 'canton-bale-campagne': 'BL',
  'canton-argovie': 'AG', 'canton-soleure': 'SO', 'canton-thurgovie': 'TG', 'canton-schaffhouse': 'SH',
  'canton-saint-gall': 'SG', 'canton-appenzell-rhodes-exterieures': 'AR',
  'canton-appenzell-rhodes-interieures': 'AI', 'canton-glaris': 'GL', 'canton-nidwald': 'NW',
  'canton-obwald': 'OW', 'canton-uri': 'UR',
}

// ─── Types ───────────────────────────────────────────────────────

interface Slice { canton: string; gte?: number; lte?: number }

interface SyncRequest {
  offer_type?: 'buy' | 'rent'
  cantons?: string[]               // override (run de test scopé) ; absent = les 26
  slice_index?: number             // curseur de reprise dans la work-list
  sync_start_at?: string
  mode?: 'chunk' | 'sweep' | 'fresh' | 'sweep_enum' | 'probe' | 'probe_sweep'
  total_expected?: number
  stats?: SyncStats
  run_id?: string
  trigger_source?: string
  handoff_count?: number
  slice_failures?: number          // cumul des slices en échec sur toute la chaîne de handoffs
  consecutive_slice_failures?: number // idem, mais remis à 0 par le premier slice réussi
  max_batches?: number             // mode probe : nb de batchs id_in à sonder
}

interface SyncStats {
  fetched: number
  upserted: number
  skipped: number
  errors: number
  pages: number
  slices: number
  capped: number
}

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

// ─── Type mapping ────────────────────────────────────────────────

const TYPE_MAP: Record<string, string> = {
  APPT: 'apartment', HOUSE_APPT: 'house', HOUSE: 'house',
  ROOM: 'apartment', PARK: 'parking', BUILDING: 'commercial',
  COMMERCIAL: 'commercial', GASTRO: 'commercial', PROP: 'land', OTHER: 'apartment',
}

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

// ─── Photos / description / features ──────────────────────────────

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

function extractFeatures(bp: unknown): string[] {
  if (!bp || typeof bp !== 'object') return []
  const o = bp as Record<string, unknown>
  const arr = o.fr ?? o.en ?? o.de ?? o.it
  return Array.isArray(arr) ? arr.filter((x: unknown): x is string => typeof x === 'string') : []
}

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

function listingPath(offerType: string): string {
  return offerType === 'rent' ? 'louer' : 'acheter'
}

function mapHit(h: RawHit, offerType: string, nowIso: string): Record<string, unknown> | null {
  if (h.id === undefined || h.id === null || h.id === '') return null
  const sourceId = String(h.id)
  // On garde TOUT, même les "prix sur demande" (price=0, convention flatfox pour
  // les sans-prix) — un bien sans prix a quand même photos/description. Seul un
  // id manquant fait skipper (cf garde ci-dessus).
  const price = offerType === 'rent'
    ? (Number(h.gross_rent_monthly) || 0)
    : (Number(h.sale_price) || 0)

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
    source_payload: h,
  }
  if (parking != null && parking > 0) row.has_parking = true
  const { quality_score, quality_flags } = computeQualityScore(row, offerType)
  row.quality_score = quality_score
  row.quality_flags = quality_flags
  return row
}

// ─── Work-list : partition canton × tranche de prix ───────────────

// Bandes de prix géométriques (déterministes) + une bande basse [1, lo] et une
// bande haute ouverte [hi, ∞]. Assez fines pour que chaque (canton × bande)
// passe sous le cap, même dans les cantons denses.
function priceBands(offerType: string): Array<{ gte?: number; lte?: number }> {
  const lo = offerType === 'rent' ? 500 : 50_000
  const hi = offerType === 'rent' ? 20_000 : 20_000_000
  const n = offerType === 'rent' ? 22 : 30
  const r = Math.pow(hi / lo, 1 / n)
  const edges: number[] = []
  let e = lo
  for (let i = 0; i <= n; i++) { edges.push(Math.round(e)); e *= r }
  const bands: Array<{ gte?: number; lte?: number }> = [{ gte: 1, lte: lo - 1 }]
  for (let i = 0; i < edges.length - 1; i++) bands.push({ gte: edges[i], lte: edges[i + 1] - 1 })
  bands.push({ gte: hi })
  return bands
}

function buildWorklist(offerType: string, cantons?: string[]): Slice[] {
  const cs = (cantons && cantons.length > 0) ? cantons : CANTONS
  const bands = priceBands(offerType)
  const slices: Slice[] = []
  for (const c of cs) {
    // Slice non filtré : capte les biens SANS prix (sortis des bandes) + les plus récents.
    slices.push({ canton: c })
    for (const b of bands) slices.push({ canton: c, gte: b.gte, lte: b.lte })
  }
  return slices
}

// ─── Identité réseau (UA configurable, rollout whitelist RA) ──────

interface Identity { ua: string; from: string | null }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getConfigValue(supabase: any, key: string): Promise<string | null> {
  try {
    const { data } = await supabase.from('app_config').select('value').eq('key', key).maybeSingle()
    return data ? String(data.value) : null
  } catch { return null }
}

// UA + From lus UNE fois par invocation. UA vide/trop court ou erreur app_config →
// UA_DEFAULT (le string Chrome qui marche), donc le rollback = 1 UPDATE sans redeploy.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadIdentity(supabase: any): Promise<Identity> {
  try {
    const { data } = await supabase.from('app_config').select('key,value')
      .in('key', ['realadvisor_user_agent', 'realadvisor_contact_email'])
    const m = new Map((data || []).map((r: { key: string; value: string }) => [r.key, r.value]))
    const uaRaw = String(m.get('realadvisor_user_agent') ?? '').trim()
    const fromRaw = String(m.get('realadvisor_contact_email') ?? '').trim()
    return { ua: uaRaw.length >= 10 ? uaRaw : UA_DEFAULT, from: fromRaw || null }
  } catch { return { ua: UA_DEFAULT, from: null } }
}

// ─── Fetch /api/listings (avec backoff) ───────────────────────────

function buildSearchParams(offerType: string, slice: Slice, page: number): URLSearchParams {
  const sp = new URLSearchParams()
  sp.set('offerType_eq', offerType)
  if (slice.canton) sp.set('placeSlugs', JSON.stringify([{ slug: slice.canton, lang: 'fr' }]))
  const pf = offerType === 'rent' ? 'grossRentMonthly' : 'salePrice'
  if (slice.gte != null) sp.set(`${pf}_gte`, String(slice.gte))
  if (slice.lte != null) sp.set(`${pf}_lte`, String(slice.lte))
  sp.set('sort', 'created_at_desc')
  // ⚠ RA indexe ses pages à partir de 0 : `page=1` est la DEUXIÈME page. Les appelants
  // comptent à partir de 1 (lisibilité des logs, tests `page === 1` = première page), on
  // décale donc ici, au seul endroit qui parle à RA. Envoyer `page=1` pour la première
  // page saute les 36 annonces les plus récentes (tri created_at_desc) et renvoie une
  // liste VIDE pour tout slice de ≤ 36 biens — ce qui a stérilisé le découpage par bande
  // de prix (174 slices vides sur 327) et bloqué l'énumération à ~720/canton.
  sp.set('page', String(page - 1))
  return sp
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchPage(offerType: string, slice: Slice, page: number, ident: Identity): Promise<RealAdvisorPage> {
  const url = `${RA_BASE}/api/listings?${buildSearchParams(offerType, slice, page).toString()}`
  let attempt = 0
  while (true) {
    let res: Response
    try {
      res = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': ident.ua,
          'Accept-Language': 'fr-CH,fr;q=0.9,en;q=0.8',
          ...(ident.from ? { From: ident.from } : {}),
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })
    } catch (err) {
      // Erreur de transport ou timeout : même politique de retry que les 5xx. Sans ce
      // catch le fetch était nu — une socket qui pend tuait l'invocation sans retry.
      if (attempt < BACKOFF_RETRIES) { await sleep(BACKOFF_BASE_MS * 2 ** attempt); attempt += 1; continue }
      throw new Error(`realadvisor réseau (${slice.canton} ${slice.gte ?? ''}-${slice.lte ?? ''} p${page}) après ${attempt} retries: ${err}`)
    }
    if (res.ok) {
      const text = await res.text()
      try {
        const body = JSON.parse(text)
        return { total_count: body.total_count ?? 0, listings: body.listings ?? [] }
      } catch {
        // HTTP 200 mais corps non-JSON = challenge/throttle Cloudflare → backoff + retry.
        if (attempt < BACKOFF_RETRIES) { await sleep(BACKOFF_BASE_MS * 2 ** attempt); attempt += 1; continue }
        throw new Error(`realadvisor non-JSON 200 (${slice.canton} p${page}) après ${attempt} retries`)
      }
    }
    await res.text().catch(() => {})
    if (BACKOFF_ON.has(res.status) && attempt < BACKOFF_RETRIES) {
      await sleep(BACKOFF_BASE_MS * 2 ** attempt)
      attempt += 1
      continue
    }
    throw new Error(`realadvisor /api/listings (${slice.canton} ${slice.gte ?? ''}-${slice.lte ?? ''} p${page}) → ${res.status}`)
  }
}

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

// Traite un slice ENTIER : pagine jusqu'à épuisement ou cap. Retourne capped=true
// si le slice avait plus de biens que ce que le cap d'API a laissé voir.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processSlice(supabase: any, offerType: string, slice: Slice, nowIso: string, stats: SyncStats, ident: Identity, cycleId: string): Promise<void> {
  let total = 0
  let seen = 0
  let page = 1
  let sliceUpsertErrors = 0
  const deadline = Date.now() + SLICE_MAX_MS
  while (page <= MAX_PAGES_PER_SLICE) {
    if (Date.now() > deadline) {
      // On sort AVANT de paginer plus loin. Le reçu ci-dessous est calculé sur ce qu'on a
      // réellement vu (seen < total ⇒ fully_enumerated=false), ce qui protège le sweep ENUM —
      // qui, lui, lit les reçus. ⚠ Ça ne protégeait PAS runSweep, qui ne les lit jamais ; c'est
      // pourquoi l'énumération n'enchaîne plus aucun retrait (cf. fin de runBackground).
      // Cette sortie ne LÈVE pas : elle n'incrémente donc aucun compteur d'échec, et un cycle
      // tronqué peut finir avec sliceFailures === 0. Ne jamais s'appuyer sur ce compteur pour
      // décider d'un retrait.
      console.warn(`[deadline] ${slice.canton} ${slice.gte ?? ''}-${slice.lte ?? ''}: arrêt à ${seen}/${total} après ${SLICE_MAX_MS}ms`)
      break
    }
    if (page > 1) await sleep(PACE_MS)
    // Sous throttle, RA renvoie des pages VIDES ou TRONQUÉES (< 36) même quand il
    // reste des résultats — on ne peut donc PAS prendre "page courte = dernière".
    // On retry tant qu'on attend encore des résultats ; la vraie fin d'un slice
    // sous cap = seen >= total (signal fiable).
    let listings: RawHit[] = []
    for (let attempt = 0; attempt <= BACKOFF_RETRIES; attempt++) {
      if (attempt > 0) await sleep(BACKOFF_BASE_MS * 2 ** (attempt - 1))
      const res = await fetchPage(offerType, slice, page, ident)
      if (page === 1 && total === 0) total = res.total_count
      listings = res.listings || []
      const subCap = total > 0 && total <= SLICE_CAP
      const moreExpected = subCap && (seen + listings.length) < total
      if (listings.length >= PAGE_SIZE) break        // page pleine → OK
      if (!moreExpected) break                        // fin légitime, ou slice plafonné (total>cap)
      if (listings.length > 0 && attempt >= 2) break  // partiel après retries → on accepte (anti-boucle)
      // sinon : vide/tronquée alors qu'on attend plus → retry
    }
    if (listings.length === 0) break
    seen += listings.length
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
    sliceUpsertErrors += errors
    const subCap = total > 0 && total <= SLICE_CAP
    if (subCap && seen >= total) break               // slice sous cap entièrement récupéré
    if (!subCap && listings.length < PAGE_SIZE) break // fin de la fenêtre d'un slice plafonné
    page++
  }
  stats.slices++
  // `seen` s'incrémente AVANT l'upsert : un lot d'upsert en échec laisse donc seen >= total
  // alors que les lignes ne sont pas en base. Sans la clause sur les erreurs, le reçu
  // dirait "tout vu" et autoriserait le sweep ENUM à retirer des biens jamais écrits.
  const fullyEnumerated = total > 0 && total <= SLICE_CAP && seen >= total && sliceUpsertErrors === 0
  if (total > SLICE_CAP && seen < total) {
    stats.capped++
    console.warn(`[capped] ${slice.canton} ${slice.gte ?? ''}-${slice.lte ?? ''}: total=${total} vu=${seen} (résidu au-dessus du cap d'API)`)
  }
  // Reçu d'énumération du slice : pilote le sweep ENUM. fully_enumerated=true ⇒ on a
  // vu TOUTES les annonces de ce (canton×bande) ⇒ celles qu'on n'a PAS revues sont
  // réellement parties. Un slice plafonné/throttlé reste fully_enumerated=false ⇒ exclu
  // du sweep (jamais de faux retrait). cycle_id = début du run (= last_seen des biens revus).
  try {
    await supabase.from('realadvisor_slice_coverage').insert({
      cycle_id: cycleId,
      canton: slice.canton,
      canton_code: SLUG_TO_CODE[slice.canton] ?? null,
      gte: slice.gte ?? null,
      lte: slice.lte ?? null,
      seen,
      total,
      fully_enumerated: fullyEnumerated,
    })
  } catch (err) { console.error('[coverage] insert exception:', err) }
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
      chunks_completed: stats.slices,
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

// Total attendu = total_count brut de l'offer_type (1 sonde), pour le ratio de sécurité du sweep.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchOfferTotal(offerType: string, ident: Identity): Promise<number> {
  try {
    const res = await fetch(`${RA_BASE}/api/listings?offerType_eq=${offerType}`, {
      headers: { Accept: 'application/json', 'User-Agent': ident.ua, ...(ident.from ? { From: ident.from } : {}) },
    })
    if (!res.ok) { await res.text().catch(() => {}); return 0 }
    const body = await res.json()
    return body.total_count ?? 0
  } catch { return 0 }
}

// ─── Sweep : marque 'removed' les biens non revus dans ce sync ────
//
// ⚠ CHEMIN LEGACY, LE PLUS DESTRUCTIF DU FICHIER. Contrairement à runSweepEnum, il n'a NI
// plafond de volume, NI lecture des reçus de couverture : il retire tout ce qui n'a pas été
// revu pendant le cycle. Plus aucun chemin interne ne l'enchaîne (l'énumération finalise sans
// retrait) ; il n'est atteignable que par un POST explicite mode:'sweep'. Le kill-switch
// ci-dessous le met en DRY-RUN par défaut, comme runSweepEnum, pour qu'un appel manuel ne
// puisse pas vider la base par inadvertance.
//
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runSweep(supabase: any, offerType: string, syncStartAt: string, totalExpected: number): Promise<{ removed: number; skipped_safety: boolean }> {
  if ((await getConfigValue(supabase, 'realadvisor_sweep_enabled')) !== 'true') {
    console.warn('[sweep] DRY-RUN — app_config.realadvisor_sweep_enabled ≠ true, aucun retrait')
    return { removed: 0, skipped_safety: true }
  }
  // count: 'estimated' et PAS 'exact' — market_listings fait > 100k lignes, un
  // count exact force un seq scan -> statement timeout (cf CLAUDE.md §7). Un
  // estimé suffit pour le garde-fou grossier (seuil 80%).
  const { count: seen } = await supabase
    .from('market_listings').select('id', { count: 'estimated', head: true })
    .eq('source_portal', 'realadvisor').eq('transaction_type', offerType)
    .gte('last_seen_at', syncStartAt)
  const totalSeen = seen ?? 0
  const ratio = totalExpected > 0 ? totalSeen / totalExpected : 0
  console.log(`[sweep] seen=${totalSeen} expected=${totalExpected} ratio=${Math.round(ratio * 100)}%`)
  if (ratio < SAFETY_MIN_RATIO) {
    console.warn(`sweep skipped: only ${Math.round(ratio * 100)}% seen (< ${Math.round(SAFETY_MIN_RATIO * 100)}%)`)
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

// ─── Mode FRESH : mise à jour quotidienne légère (accès RealAdvisor accordé) ─
// Ne balaye PAS la work-list canton×prix. UNE requête NATIONALE triée
// created_at_desc, on pagine le HAUT (les plus récents) et on s'arrête dès qu'on
// a rattrapé le delta. 4-18 requêtes RA/jour, une seule invocation, PAS de sweep.
// Kill-switch + circuit-breaker + détection du throttle silencieux.
const FRESH_MAX_PAGES = 22 // ≈ le cap d'API (~792 plus récents) : couvre un jour médian (~800 nouvelles/j)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function isFreshEnabled(supabase: any): Promise<boolean> {
  try {
    const { data } = await supabase.from('app_config').select('value').eq('key', 'realadvisor_fresh_enabled').maybeSingle()
    if (!data) return true // flag absent = activé par défaut
    return String(data.value).toLowerCase() !== 'false'
  } catch { return true }
}

// Circuit-breaker : si les 2 derniers runs cron-fresh sont throttled/failed, on n'y va pas.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function freshCircuitOpen(supabase: any): Promise<boolean> {
  try {
    const { data } = await supabase.from('realadvisor_sync_runs')
      .select('status').eq('trigger_source', 'cron-fresh')
      .order('started_at', { ascending: false }).limit(2)
    if (!data || data.length < 2) return false
    return data.every((r: { status: string }) => r.status === 'throttled' || r.status === 'failed')
  } catch { return false }
}

interface FreshStats { fetched: number; upserted: number; inserted: number; updated: number; skipped: number; errors: number; pages: number }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function updateFreshRun(supabase: any, runId: string | undefined, s: FreshStats, totalExpected: number): Promise<void> {
  if (!runId) return
  try {
    await supabase.from('realadvisor_sync_runs').update({
      total_expected: totalExpected || null,
      total_seen: s.fetched, total_upserted: s.upserted,
      total_inserted: s.inserted, total_updated: s.updated,
      total_errors: s.errors, pages_fetched: s.pages,
      last_chunk_at: new Date().toISOString(),
    }).eq('id', runId)
  } catch (err) { console.error('[fresh run update] exception:', err) }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runFresh(body: SyncRequest, supabase: any): Promise<void> {
  const offerType = body.offer_type || 'buy'
  const triggerSource = body.trigger_source || 'cron-fresh'

  if (!(await isFreshEnabled(supabase))) { console.warn('[fresh] kill-switch off (app_config.realadvisor_fresh_enabled=false) — abort'); return }
  if (await freshCircuitOpen(supabase)) {
    console.warn('[fresh] circuit-breaker ouvert (2 derniers cron-fresh KO) — abort')
    const l = await createRunRow(supabase, offerType, triggerSource)
    if (l.id) await finalizeRun(supabase, l.id, { status: 'circuit_open', errorMessage: '2 runs fresh consécutifs KO' })
    return
  }

  await reapStaleRuns(supabase)
  const lock = await createRunRow(supabase, offerType, triggerSource)
  if (lock.blocked) { console.warn('[fresh] un run est déjà actif — abort'); return }
  const runId = lock.id ?? undefined
  if (!runId) { console.error('[fresh] verrou non acquis (no run id) — abort'); return }

  const nowIso = new Date().toISOString()
  const ident = await loadIdentity(supabase)
  const national: Slice = { canton: '' } // requête nationale (buildSearchParams n'ajoute pas placeSlugs)
  const s: FreshStats = { fetched: 0, upserted: 0, inserted: 0, updated: 0, skipped: 0, errors: 0, pages: 0 }
  let totalExpected = 0

  try {
    for (let page = 1; page <= FRESH_MAX_PAGES; page++) {
      if (page > 1) await sleep(PACE_MS)
      const res = await fetchPage(offerType, national, page, ident)
      if (page === 1) totalExpected = res.total_count
      const listings = res.listings || []
      // Throttle silencieux : page 1 nationale vide alors qu'il y a un catalogue
      // (jamais 0 resultat national legitime) -> on n'ecrit RIEN, status throttled.
      if (listings.length === 0) {
        if (page === 1 && totalExpected > 0) {
          await finalizeRun(supabase, runId, { status: 'throttled', totalSeen: 0, errorMessage: 'page 1 nationale vide (throttle silencieux)' })
          return
        }
        break
      }
      s.fetched += listings.length
      s.pages++
      const ids = listings.map((h) => String(h.id)).filter(Boolean)
      const { data: existRows } = await supabase.from('market_listings')
        .select('source_id').eq('source_portal', 'realadvisor').in('source_id', ids)
      const known = new Set((existRows || []).map((r: { source_id: string }) => String(r.source_id)))
      const rows: Record<string, unknown>[] = []
      let newInPage = 0
      for (const hit of listings) {
        const row = mapHit(hit, offerType, nowIso)
        if (row === null) { s.skipped++; continue }
        if (!known.has(String(hit.id))) newInPage++
        rows.push(row)
      }
      const { upserted, errors } = await upsertRows(supabase, rows)
      s.upserted += upserted; s.errors += errors
      s.inserted += newInPage; s.updated += (rows.length - newInPage)
      await updateFreshRun(supabase, runId, s, totalExpected)
      // STOP : page entierement deja connue ET assez vieille -> delta rattrape.
      // Page entièrement déjà connue = on a rejoint le territoire des runs
      // précédents → delta rattrapé, on s'arrête (sinon on va jusqu'au cap API).
      if (newInPage === 0) break
    }
    await updateFreshRun(supabase, runId, s, totalExpected)
    await finalizeRun(supabase, runId, { status: 'completed', totalSeen: s.fetched, removed: 0 })
    console.log(`[fresh] done — inserted=${s.inserted} updated=${s.updated} pages=${s.pages}`)
  } catch (err) {
    console.error('[fresh] error:', err)
    await finalizeRun(supabase, runId, { status: 'failed', errorMessage: String(err).slice(0, 500) })
  }
}

// ─── Worker sériel : balaye la work-list de slices ────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runBackground(body: SyncRequest, supabase: any): Promise<void> {
  const startedAtMs = Date.now()
  let runId: string | undefined = body.run_id
  const handoffCount = body.handoff_count ?? 0
  const offerType = body.offer_type || 'buy'
  const isScoped = Array.isArray(body.cantons) && body.cantons.length > 0
  try {
    const syncStartAt = body.sync_start_at ?? new Date().toISOString()
    const ident = await loadIdentity(supabase)
    const mode = body.mode ?? 'chunk'
    const stats: SyncStats = body.stats ?? { fetched: 0, upserted: 0, skipped: 0, errors: 0, pages: 0, slices: 0, capped: 0 }
    let totalExpected = body.total_expected ?? 0

    if (mode === 'sweep') {
      const sweep = await runSweep(supabase, offerType, syncStartAt, totalExpected)
      console.log(`[sweep done] removed=${sweep.removed} skipped=${sweep.skipped_safety}`)
      await finalizeRun(supabase, runId, { status: sweep.skipped_safety ? 'safety_skipped' : 'completed', totalSeen: stats.fetched, removed: sweep.removed })
      return
    }

    if (handoffCount > MAX_HANDOFFS) {
      console.error(`[chunk] handoff ceiling ${handoffCount} > ${MAX_HANDOFFS} — aborting`)
      await finalizeRun(supabase, runId, { status: 'failed', errorMessage: `exceeded MAX_HANDOFFS (${MAX_HANDOFFS})` })
      return
    }

    const nowIso = new Date().toISOString()
    const worklist = buildWorklist(offerType, body.cantons)

    // Première invocation : total attendu + reap + verrou.
    let sliceIdx = body.slice_index
    if (sliceIdx === undefined) {
      // Rolling crawl (cron-rolling) : kill-switch + garde-fou anti full-crawl accidentel.
      if (body.trigger_source === 'cron-rolling') {
        if ((await getConfigValue(supabase, 'realadvisor_rolling_enabled')) === 'false') {
          console.warn('[rolling] kill-switch off (realadvisor_rolling_enabled=false) — abort'); return
        }
        if (!isScoped) {
          console.error('[rolling] cantons vide (shard_map manquant ?) — abort pour éviter un full-crawl involontaire'); return
        }
      }
      totalExpected = await fetchOfferTotal(offerType, ident)
      await reapStaleRuns(supabase)
      const lock = await createRunRow(supabase, offerType, body.trigger_source)
      if (lock.blocked) { console.warn('[chunk] aborting: another run active'); return }
      runId = lock.id ?? undefined
      if (!runId) { console.error('[chunk] aborting: run lock not acquired (no run id)'); return }
      sliceIdx = 0
      console.log(`[chunk] first invocation: offer=${offerType} slices=${worklist.length} total=${totalExpected} runId=${runId}`)
    }

    // Compteur cumulé sur TOUTE la chaîne de handoffs (reconduit dans le body), sinon il
    // se remettrait à zéro toutes les ~4 slices et ne protégerait de rien.
    let sliceFailures = body.slice_failures ?? 0
    // Reconduit lui aussi : une invocation ne traite que ~4 slices, donc un compteur local
    // ne pourrait jamais atteindre le seuil — le garde-fou serait du code mort.
    let consecutiveFailures = body.consecutive_slice_failures ?? 0

    while (sliceIdx < worklist.length) {
      // Budget testé AVANT de démarrer : sinon un slice lancé à t=99 s peut courir jusqu'à
      // SLICE_MAX_MS et faire dépasser la tolérance de l'isolate. Borne le pire cas.
      if (Date.now() - startedAtMs > TIME_BUDGET_MS) {
        console.log(`[chunk] budget atteint avant slice ${sliceIdx}/${worklist.length} — handoff`)
        await selfInvoke({ ...body, slice_index: sliceIdx, sync_start_at: syncStartAt, stats, total_expected: totalExpected, run_id: runId, handoff_count: handoffCount + 1, slice_failures: sliceFailures, consecutive_slice_failures: consecutiveFailures })
        return
      }
      // Un slice qui échoue ne doit plus emporter les 800 suivants. L'insert du reçu de
      // couverture est en fin de processSlice : un slice qui lève n'en produit AUCUN, donc
      // il reste invisible au sweep ENUM — jamais un reçu faussement complet.
      try {
        await processSlice(supabase, offerType, worklist[sliceIdx], nowIso, stats, ident, syncStartAt)
        consecutiveFailures = 0
      } catch (err) {
        sliceFailures += 1
        consecutiveFailures += 1
        const s = worklist[sliceIdx]
        console.error(`[slice] échec ${s.canton} ${s.gte ?? ''}-${s.lte ?? ''} (${consecutiveFailures} d'affilée):`, err)
        if (consecutiveFailures >= MAX_CONSECUTIVE_SLICE_FAILURES) {
          await finalizeRun(supabase, runId, {
            status: 'throttled',
            totalSeen: stats.fetched,
            errorMessage: `abandon: ${consecutiveFailures} slices consécutifs en échec au slice ${sliceIdx}/${worklist.length} — ${String(err).slice(0, 300)}`,
          })
          return
        }
      }
      sliceIdx++
      await updateRunChunk(supabase, runId, stats, totalExpected)
      if (Date.now() - startedAtMs > TIME_BUDGET_MS && sliceIdx < worklist.length) {
        console.log(`[chunk] budget atteint — handoff slice ${sliceIdx}/${worklist.length} (upserted=${stats.upserted})`)
        await selfInvoke({ ...body, slice_index: sliceIdx, sync_start_at: syncStartAt, stats, total_expected: totalExpected, run_id: runId, handoff_count: handoffCount + 1, slice_failures: sliceFailures, consecutive_slice_failures: consecutiveFailures })
        return
      }
      if (sliceIdx < worklist.length) await sleep(PACE_MS)
    }

    // Work-list épuisée. Une énumération n'enchaîne PLUS de retrait, quel qu'il soit.
    //
    // `runSweep` (mode 'sweep') retire tout ce qui a last_seen_at < syncStartAt, SANS plafond
    // de volume, SANS kill-switch app_config, et sans jamais lire les reçus de couverture —
    // contrairement à runSweepEnum, qui a les deux plafonds et le flag realadvisor_sweep_enabled.
    // Son unique filet est un ratio vus/attendus >= 80 % calculé sur un count ESTIMÉ.
    //
    // Compter les slices en échec ne suffisait PAS à s'en protéger : une slice tronquée par la
    // deadline, plafonnée par le cap d'API, ou terminée sur une page vide après retries ne lève
    // pas — elle n'incrémente donc aucun compteur d'échec. Un cycle largement incomplet pouvait
    // sortir avec sliceFailures === 0 et armer le sweep. Pire, le ratio des 80 % ne nous protège
    // aujourd'hui QUE parce que la couverture est mauvaise (~0,66) : il cesserait de mordre
    // précisément le jour où l'énumération devient complète.
    //
    // Le retrait reste assuré par les deux chemins BORNÉS : realadvisor_probe_sweep (plafond
    // min(1200, 3 % du live), gated realadvisor_probe_apply) et runSweepEnum (piloté par les
    // reçus fully_enumerated, double plafond, gated realadvisor_sweep_enabled).
    console.log(`[chunk] worklist done — upserted=${stats.upserted} slices=${stats.slices} capped=${stats.capped} failures=${sliceFailures}`)
    await finalizeRun(supabase, runId, {
      status: sliceFailures > 0 ? 'partial' : 'completed',
      totalSeen: stats.fetched,
      removed: 0,
      ...(sliceFailures > 0 ? { errorMessage: `${sliceFailures} slice(s) en échec — cycle incomplet` } : {}),
    })
  } catch (err) {
    console.error('realadvisor-sync background error:', err)
    await finalizeRun(supabase, runId, { status: 'failed', errorMessage: String(err).slice(0, 500) })
  }
}

// ─── Mode SWEEP_ENUM : suppression destructive SÛRE, scopée aux slices énumérés ───
// Délègue à la RPC realadvisor_sweep_enum (atomique). Tant que
// app_config.realadvisor_sweep_enabled ≠ 'true' → DRY-RUN (compte les candidats, ne
// supprime RIEN) : on calibre la vraie volumétrie de churn avant d'armer. La RPC
// applique le double plafond (anti-anomalie). On NE prend PAS le verrou singleton :
// on insère une ligne de run à statut TERMINAL (jamais 'running'), donc un crawl long
// ne peut ni bloquer le sweep ni le faire reaper.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runSweepEnum(body: SyncRequest, supabase: any): Promise<void> {
  const offerType = body.offer_type || 'buy'
  const triggerSource = body.trigger_source || 'cron-sweep'
  const apply = (await getConfigValue(supabase, 'realadvisor_sweep_enabled')) === 'true'
  try {
    const { data, error } = await supabase.rpc('realadvisor_sweep_enum', {
      p_offer_type: offerType,
      p_window_days: SWEEP_WINDOW_DAYS,
      p_cap_abs: SWEEP_CAP_ABS,
      p_cap_pct: SWEEP_CAP_PCT,
      p_apply: apply,
    })
    if (error) throw error
    const r = (data ?? {}) as { status?: string; candidates?: number; live?: number; removed?: number }
    const status = r.status === 'completed' ? 'completed'
      : r.status === 'safety_skipped' ? 'safety_skipped'
      : 'dry_run'
    await supabase.from('realadvisor_sync_runs').insert({
      offer_type: offerType,
      trigger_source: triggerSource,
      status,
      ended_at: new Date().toISOString(),
      total_removed: r.removed ?? 0,
      total_seen: r.live ?? 0,
      error_message: `sweep_enum apply=${apply} candidates=${r.candidates ?? 0} live=${r.live ?? 0} removed=${r.removed ?? 0} rpc=${r.status}`,
    })
    console.log(`[sweep_enum] apply=${apply}`, r)
  } catch (err) {
    console.error('[sweep_enum] error:', err)
    try {
      await supabase.from('realadvisor_sync_runs').insert({
        offer_type: offerType, trigger_source: triggerSource, status: 'failed',
        ended_at: new Date().toISOString(), error_message: String(err).slice(0, 500),
      })
    } catch { /* noop */ }
  }
}

// ─── Oracle id_in : « sur ces ids, lesquels existent encore ? » ────
// 1 requête légère pour jusqu'à 36 ids. Renvoie ok=false sur throttle (non-JSON/5xx)
// → le batch est SAUTÉ (jamais compté comme absent). total_count = nb encore en ligne ;
// presentIds = ids renvoyés (première page, non tronquée tant que batch ≤ 36).
async function fetchIdIn(offerType: string, ids: string[], ident: Identity): Promise<{ ok: boolean; total_count: number; presentIds: string[] }> {
  const sp = new URLSearchParams()
  sp.set('offerType_eq', offerType)
  sp.set('id_in', ids.join(','))
  // ⚠ Pagination RA indexée à 0 : la première page est `0`. Avec `page=1` sur un lot de
  // ≤ 36 ids, RA renvoie une liste VIDE ⇒ TOUS les ids du lot seraient comptés absents.
  // Ce chemin est dormant (la sonde vivante est realadvisor_probe_fire, en SQL/pg_net,
  // qui n'envoie aucun `page` et tombe donc sur 0 par défaut) — corrigé pour qu'une
  // réactivation ne déclenche pas un retrait de masse.
  sp.set('page', '0')
  const url = `${RA_BASE}/api/listings?${sp.toString()}`
  let attempt = 0
  while (true) {
    let res: Response
    try {
      res = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json', 'User-Agent': ident.ua, 'Accept-Language': 'fr-CH,fr;q=0.9,en;q=0.8', ...(ident.from ? { From: ident.from } : {}) },
      })
    } catch { return { ok: false, total_count: -1, presentIds: [] } }
    if (res.ok) {
      const text = await res.text()
      try {
        const body = JSON.parse(text)
        const listings = (body.listings ?? []) as Array<{ id: number | string }>
        return { ok: true, total_count: body.total_count ?? 0, presentIds: listings.map((l) => String(l.id)) }
      } catch {
        if (attempt < BACKOFF_RETRIES) { await sleep(BACKOFF_BASE_MS * 2 ** attempt); attempt++; continue }
        return { ok: false, total_count: -1, presentIds: [] } // 200 non-JSON = throttle silencieux
      }
    }
    await res.text().catch(() => {})
    if (BACKOFF_ON.has(res.status) && attempt < BACKOFF_RETRIES) { await sleep(BACKOFF_BASE_MS * 2 ** attempt); attempt++; continue }
    return { ok: false, total_count: -1, presentIds: [] }
  }
}

// ─── Mode PROBE : bookkeeping de disparition par oracle id_in ──────────────────
// Sonde les biens DUS (last_probe_at NULL ou > 20h, absents prioritaires), par batchs
// de 36. présent → RPC refresh + reset compteur ; absent → RPC incrément espacé. Garde
// dure : un batch dont l'array et total_count ne concordent PAS (throttle/troncature)
// est 'ambigu' → AUCUNE écriture (jamais compté absent). Ne supprime RIEN (cf
// runProbeSweep). Kill-switch realadvisor_probe_enabled.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runProbe(body: SyncRequest, supabase: any): Promise<void> {
  const offerType = body.offer_type || 'buy'
  const maxBatches = body.max_batches ?? 40
  const triggerSource = body.trigger_source || 'cron-probe'
  if ((await getConfigValue(supabase, 'realadvisor_probe_enabled')) === 'false') {
    console.warn('[probe] kill-switch off (realadvisor_probe_enabled=false) — abort'); return
  }
  const ident = await loadIdentity(supabase)
  const startedMs = Date.now()
  // Cutoff sans millisecondes (les '.' casseraient le filtre .or() PostgREST).
  const gapCutoff = new Date(Date.now() - 20 * 3600 * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z')
  try {
    const { data: rows } = await supabase.from('market_listings')
      .select('source_id')
      .eq('source_portal', 'realadvisor').eq('transaction_type', offerType)
      .in('status', ['active', 'price_reduced'])
      .or(`last_probe_at.is.null,last_probe_at.lt.${gapCutoff}`)
      .order('absent_probe_count', { ascending: false })
      .order('last_probe_at', { ascending: true, nullsFirst: true })
      .limit(maxBatches * PROBE_BATCH)
    const allIds = (rows || []).map((r: { source_id: string }) => String(r.source_id))

    let batches = 0, ok = 0, ambiguous = 0, present = 0, absent = 0
    for (let i = 0; i < allIds.length; i += PROBE_BATCH) {
      if (Date.now() - startedMs > TIME_BUDGET_MS) break
      if (i > 0) await sleep(PACE_MS)
      const batch = allIds.slice(i, i + PROBE_BATCH)
      const res = await fetchIdIn(offerType, batch, ident)
      batches++
      if (!res.ok || res.total_count < 0 || res.total_count > batch.length) { ambiguous++; continue }
      const presentSet = new Set(res.presentIds)
      const absentIds = batch.filter((id: string) => !presentSet.has(id))
      if (absentIds.length !== (batch.length - res.total_count)) { ambiguous++; continue }
      const presentIds = batch.filter((id: string) => presentSet.has(id))
      ok++; present += presentIds.length; absent += absentIds.length
      const { error } = await supabase.rpc('realadvisor_probe_bookkeep', {
        p_present: presentIds, p_absent: absentIds, p_min_gap_hours: 20,
      })
      if (error) console.error('[probe] bookkeep error:', error.message)
    }
    const summary = `probe batches=${batches} ok=${ok} ambiguous=${ambiguous} present=${present} absent=${absent} secs=${Math.round((Date.now() - startedMs) / 1000)}`
    console.log('[probe]', summary)
    await supabase.from('realadvisor_sync_runs').insert({
      offer_type: offerType, trigger_source: triggerSource,
      status: (batches > 0 && ambiguous >= batches) ? 'throttled' : 'completed',
      ended_at: new Date().toISOString(),
      total_seen: present + absent, total_updated: present, total_errors: ambiguous, pages_fetched: batches,
      error_message: summary,
    })
  } catch (err) {
    console.error('[probe] error:', err)
    try {
      await supabase.from('realadvisor_sync_runs').insert({
        offer_type: offerType, trigger_source: triggerSource, status: 'failed',
        ended_at: new Date().toISOString(), error_message: String(err).slice(0, 500),
      })
    } catch { /* noop */ }
  }
}

// ─── Mode PROBE_SWEEP : retrait des absents CONFIRMÉS (délègue à la RPC) ────────
// Retire (status='removed') les biens absent_probe_count≥3 ET absent≥48h, plafonds
// 1200/3%. DRY-RUN tant que realadvisor_probe_apply ≠ 'true'. Pas de verrou singleton.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runProbeSweep(body: SyncRequest, supabase: any): Promise<void> {
  const offerType = body.offer_type || 'buy'
  const triggerSource = body.trigger_source || 'cron-probe-sweep'
  const apply = (await getConfigValue(supabase, 'realadvisor_probe_apply')) === 'true'
  try {
    const { data, error } = await supabase.rpc('realadvisor_probe_sweep', { p_offer_type: offerType, p_apply: apply })
    if (error) throw error
    const r = (data ?? {}) as { status?: string; candidates?: number; live?: number; removed?: number }
    const status = r.status === 'completed' ? 'completed' : r.status === 'safety_skipped' ? 'safety_skipped' : 'dry_run'
    await supabase.from('realadvisor_sync_runs').insert({
      offer_type: offerType, trigger_source: triggerSource, status,
      ended_at: new Date().toISOString(),
      total_removed: r.removed ?? 0, total_seen: r.live ?? 0,
      error_message: `probe_sweep apply=${apply} candidates=${r.candidates ?? 0} live=${r.live ?? 0} removed=${r.removed ?? 0} rpc=${r.status}`,
    })
    console.log(`[probe_sweep] apply=${apply}`, r)
  } catch (err) {
    console.error('[probe_sweep] error:', err)
    try {
      await supabase.from('realadvisor_sync_runs').insert({
        offer_type: offerType, trigger_source: triggerSource, status: 'failed',
        ended_at: new Date().toISOString(), error_message: String(err).slice(0, 500),
      })
    } catch { /* noop */ }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const body: SyncRequest = req.method === 'POST' ? await req.json().catch(() => ({})) : {}

    const work = body.mode === 'fresh' ? runFresh(body, supabase)
      : body.mode === 'sweep_enum' ? runSweepEnum(body, supabase)
      : body.mode === 'probe' ? runProbe(body, supabase)
      : body.mode === 'probe_sweep' ? runProbeSweep(body, supabase)
      : runBackground(body, supabase)
    // @ts-expect-error EdgeRuntime is a Supabase-specific Deno global
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      // @ts-expect-error keep the isolate alive until the work resolves
      EdgeRuntime.waitUntil(work)
    }

    return new Response(
      JSON.stringify({ ok: true, accepted: true, offer_type: body.offer_type || 'buy', mode: body.mode ?? 'chunk', slice_index: body.slice_index ?? 0 }),
      { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('realadvisor-sync error:', err)
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
