// ═══════════════════════════════════════════════════════════════════════════
// photo-processor — Mirror listing photos to Cloudflare R2
// ═══════════════════════════════════════════════════════════════════════════
//
// Downloads a batch of external photo URLs (Flatfox CDN), decodes them,
// generates 3 resized JPEG variants (thumb/detail/hero) and uploads them to
// Cloudflare R2. Returns the public URLs so the caller can persist them on
// `market_listings.photos_cf`.
//
// Why R2 and not Cloudflare Images:
//   - Free tier covers MEGGA's entire volume (10 GB storage, 1M writes/mo)
//   - Egress is free forever on R2 (no per-delivery cost unlike CF Images)
//   - Total cost at MEGGA scale: ~$0.50/mo vs. $15-20/mo for CF Images
//   - C2PA: signatures are embedded in the image bytes by our existing
//     c2pa-sign EF — R2 preserves them transparently, no need for CF Images
//
// This function is called by:
//   1. `backfill-cf-images` — to catch up on the 33K historical listings
//   2. `flatfox-sync` (via pg_cron stamping photos_cf = NULL → backfill picks up)
//
// Auth: service_role only — the R2 credentials must never leak.
//
// Input (POST JSON):
//   { listingId: string, photoUrls: string[] }   // max 10 photos
//
// Output:
//   { success: true, photos_cf: [{id, thumb, detail, hero}, ...], ... }
//   { success: false, error: string }
//
// Idempotency: R2 keys are deterministic (`listings/<uuid>/<i>-variant.jpg`).
// Re-running overwrites in place — no duplicates, no extra cost.
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { Image } from 'https://deno.land/x/imagescript@1.2.17/mod.ts'
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.17'

const CF_ACCOUNT_ID = Deno.env.get('CF_ACCOUNT_ID') ?? ''
const R2_ACCESS_KEY_ID = Deno.env.get('R2_ACCESS_KEY_ID') ?? ''
const R2_SECRET_ACCESS_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY') ?? ''
// Public delivery base — either a custom domain (img.megga.ch) or the
// Cloudflare r2.dev subdomain. Must NOT include a trailing slash.
// e.g. R2_PUBLIC_BASE=https://img.megga.ch
//      R2_PUBLIC_BASE=https://pub-xxxxxx.r2.dev
const R2_PUBLIC_BASE = (Deno.env.get('R2_PUBLIC_BASE') ?? '').replace(/\/$/, '')
const R2_BUCKET = Deno.env.get('R2_BUCKET') ?? 'megga-market'
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

// Pre-generated variants (stored in R2 as separate files, served from edge
// with free egress and long cache headers).
const VARIANTS = [
  { name: 'thumb',  width:  400, quality: 80 },  // listing cards
  { name: 'detail', width: 1200, quality: 85 },  // listing detail / modal hero
  { name: 'hero',   width: 1600, quality: 90 },  // fullscreen / carousel
] as const

const MAX_PHOTOS_PER_LISTING = 10
const DOWNLOAD_TIMEOUT_MS = 15_000

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ProcessRequest {
  listingId: string
  photoUrls: string[]
}

interface PhotoVariants {
  id: string
  thumb?: string
  detail?: string
  hero?: string
}

// aws4fetch signs requests with AWS SigV4, which R2 accepts on its
// S3-compatible endpoint. Lightweight vs the full AWS SDK (~1KB vs ~100KB).
const r2 = new AwsClient({
  accessKeyId: R2_ACCESS_KEY_ID,
  secretAccessKey: R2_SECRET_ACCESS_KEY,
  service: 's3',
  region: 'auto',
})

const r2Endpoint = `https://${CF_ACCOUNT_ID}.r2.cloudflarestorage.com`

async function r2Put(key: string, body: Uint8Array, contentType: string): Promise<boolean> {
  const url = `${r2Endpoint}/${R2_BUCKET}/${key}`
  const res = await r2.fetch(url, {
    method: 'PUT',
    body,
    headers: {
      'Content-Type': contentType,
      // Long cache — images are immutable (deterministic key). Cloudflare edge
      // + browser cache for a year. Re-uploads are fine since key stays the
      // same (CF cache gets invalidated on write by R2).
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    // eslint-disable-next-line no-console
    console.error('[photo-processor] R2 PUT failed', key, res.status, txt.slice(0, 200))
    return false
  }
  return true
}

async function fetchPhotoBytes(url: string): Promise<Uint8Array | null> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), DOWNLOAD_TIMEOUT_MS)
    const res = await fetch(url, { signal: ctrl.signal })
    clearTimeout(timer)
    if (!res.ok) return null
    return new Uint8Array(await res.arrayBuffer())
  } catch {
    return null
  }
}

// Process one photo: download → decode → resize × 3 → upload × 3 → return URLs.
async function processOne(sourceUrl: string, listingId: string, index: number): Promise<PhotoVariants | null> {
  const bytes = await fetchPhotoBytes(sourceUrl)
  if (!bytes) return null

  let decoded: Image
  try {
    decoded = await Image.decode(bytes) as Image
  } catch {
    // Unsupported format (rare — Flatfox is all JPEG). Skip the photo.
    return null
  }

  const result: PhotoVariants = { id: `listing-${listingId}-${index}` }
  const baseKey = `listings/${listingId}/${index}`

  for (const v of VARIANTS) {
    // Only downscale — never upscale. `Math.min` guards against tiny sources
    // (Flatfox thumbnails are already 1200px wide at source).
    const targetW = Math.min(v.width, decoded.width)
    let variant: Image
    try {
      variant = decoded.clone().resize(targetW, Image.RESIZE_AUTO) as Image
    } catch {
      continue
    }
    const encoded = await variant.encodeJPEG(v.quality)
    const key = `${baseKey}-${v.name}.jpg`
    const ok = await r2Put(key, encoded, 'image/jpeg')
    if (ok) {
      result[v.name] = `${R2_PUBLIC_BASE}/${key}`
    }
  }

  // Bail out if nothing uploaded successfully — caller treats as "not processed".
  if (!result.thumb && !result.detail && !result.hero) return null
  return result
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // ── Auth: service_role only ────────────────────────────────────────
  const authHeader = req.headers.get('Authorization')
  if (!authHeader || authHeader !== `Bearer ${SERVICE_ROLE_KEY}`) {
    return new Response(
      JSON.stringify({ success: false, error: 'service_role required' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (!CF_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_PUBLIC_BASE) {
    return new Response(
      JSON.stringify({ success: false, error: 'R2 secrets not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  let body: ProcessRequest
  try { body = await req.json() } catch {
    return new Response(
      JSON.stringify({ success: false, error: 'invalid JSON body' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const { listingId, photoUrls } = body
  if (!listingId || !Array.isArray(photoUrls) || photoUrls.length === 0) {
    return new Response(
      JSON.stringify({ success: false, error: 'listingId and non-empty photoUrls[] required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const toProcess = photoUrls.slice(0, MAX_PHOTOS_PER_LISTING)

  // Sequential to be kind to Flatfox's CDN and to keep peak memory bounded
  // (imagescript holds the decoded RGBA in memory — 1200×800 = ~3.8 MB per
  // photo). Processing 10 in parallel would peak at ~40 MB which is fine,
  // but sequential is simpler to reason about under timeouts.
  const photos_cf: PhotoVariants[] = []
  for (let i = 0; i < toProcess.length; i++) {
    const res = await processOne(toProcess[i], listingId, i)
    if (res) photos_cf.push(res)
  }

  return new Response(
    JSON.stringify({
      success: true,
      photos_cf,
      attempted: toProcess.length,
      succeeded: photos_cf.length,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
