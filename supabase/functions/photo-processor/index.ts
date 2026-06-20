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

// .trim() is defensive: copy-paste from dashboards often adds trailing newlines
// or zero-width spaces that break SigV4 silently.
const CF_ACCOUNT_ID = (Deno.env.get('CF_ACCOUNT_ID') ?? '').trim()
const R2_ACCESS_KEY_ID = (Deno.env.get('R2_ACCESS_KEY_ID') ?? '').trim()
const R2_SECRET_ACCESS_KEY = (Deno.env.get('R2_SECRET_ACCESS_KEY') ?? '').trim()
// Public delivery base — either a custom domain (img.megga.ch) or the
// Cloudflare r2.dev subdomain. Must NOT include a trailing slash.
// e.g. R2_PUBLIC_BASE=https://img.megga.ch
//      R2_PUBLIC_BASE=https://pub-xxxxxx.r2.dev
const R2_PUBLIC_BASE = (Deno.env.get('R2_PUBLIC_BASE') ?? '').replace(/\/$/, '')
const R2_BUCKET = Deno.env.get('R2_BUCKET') ?? 'megga-market'
// Current sb_secret_ service key — used by the token-equality auth branch below.
// Was REFERENCED but never declared (latent ReferenceError); only masked because
// pg_cron callers forward a legacy service_role JWT (role-claim branch). The new
// property-photo-r2 broker forwards app_config.service_role_key (sb_secret_), so
// the equality branch fires and this must exist.
const SERVICE_ROLE_KEY = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '').trim()

// Service key for string-equality auth (line ~197). With the sb_secret_ key
// roll-out, callers forward get_app_config('service_role_key') — a raw token,
// not a JWT — so the role-claim decode returns null and we fall back to
// comparing it against this env var. May be empty if the EF runtime doesn't
// inject it; the comparison short-circuits on '' so that's safe.
const SERVICE_ROLE_KEY = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '').trim()

// Decode a Supabase JWT payload without verifying the signature. We only
// use this to check the `role` claim; write operations still go through
// Supabase's own RLS on any table access. This is robust to the secret-key
// roll-out where SUPABASE_SERVICE_ROLE_KEY isn't auto-injected in EFs.
function decodeJwtRole(token: string): string | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    return (JSON.parse(json) as { role?: string }).role ?? null
  } catch {
    return null
  }
}

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
  /** R2 key prefix (e.g. "properties/<uuid>"). DÉRIVÉ SERVER-SIDE par l'appelant
   *  (broker) à partir d'un id vérifié — jamais une valeur fournie par un client.
   *  Absent ⇒ défaut "listings/<listingId>" (backfill marketplace inchangé). */
  keyPrefix?: string
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

async function r2Put(key: string, body: Uint8Array, contentType: string): Promise<{ ok: boolean; err?: string }> {
  const url = `${r2Endpoint}/${R2_BUCKET}/${key}`
  try {
    const res = await r2.fetch(url, {
      method: 'PUT',
      body,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      return { ok: false, err: `${res.status} ${txt.slice(0, 120)}` }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, err: (e as Error).message?.slice(0, 120) }
  }
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
// Returns `{ ok: PhotoVariants }` or `{ err: string }` so the caller can
// surface the specific failure reason in the response (debugging aid).
async function processOne(sourceUrl: string, listingId: string, index: number, keyPrefix?: string): Promise<{ ok?: PhotoVariants; err?: string }> {
  const bytes = await fetchPhotoBytes(sourceUrl)
  if (!bytes) return { err: `fetch failed: ${sourceUrl.slice(0, 80)}` }

  let decoded: Image
  try {
    decoded = await Image.decode(bytes) as Image
  } catch (e) {
    return { err: `decode failed: ${(e as Error).message?.slice(0, 100)}` }
  }

  const result: PhotoVariants = { id: `listing-${listingId}-${index}` }
  // keyPrefix (server-derived) permet de ranger les photos de biens agence sous
  // `properties/<uuid>/…` ; sans lui, comportement marketplace inchangé.
  const baseKey = `${keyPrefix ?? `listings/${listingId}`}/${index}`
  const errors: string[] = []

  for (const v of VARIANTS) {
    const targetW = Math.min(v.width, decoded.width)
    let variant: Image
    try {
      variant = decoded.clone().resize(targetW, Image.RESIZE_AUTO) as Image
    } catch (e) {
      errors.push(`resize ${v.name}: ${(e as Error).message?.slice(0, 80)}`)
      continue
    }
    const encoded = await variant.encodeJPEG(v.quality)
    const key = `${baseKey}-${v.name}.jpg`
    const putRes = await r2Put(key, encoded, 'image/jpeg')
    if (putRes.ok) {
      result[v.name] = `${R2_PUBLIC_BASE}/${key}`
    } else {
      errors.push(`R2 PUT ${v.name}: ${putRes.err}`)
    }
  }

  if (!result.thumb && !result.detail && !result.hero) {
    return { err: errors.join(' | ') || 'all variants failed silently' }
  }
  return { ok: result }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // ── Auth: service_role only ────────────────────────────────────────
  // We decode the JWT claim instead of string-comparing to a local env var
  // because SUPABASE_SERVICE_ROLE_KEY isn't always auto-injected (especially
  // with the new sb_secret_ key rollout). Decoding verifies the JWT shape
  // and the role claim; signature forgery is prevented by the Supabase
  // gateway which refuses unsigned tokens upstream.
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  const role = decodeJwtRole(token)
  // Accept the current sb_secret_ service key (string-equality) in addition to
  // the legacy service_role JWT, so callers (backfill-cf-images via pg_cron) that
  // forward get_app_config('service_role_key') authenticate.
  const isServiceRole = role === 'service_role' || (SERVICE_ROLE_KEY !== '' && token === SERVICE_ROLE_KEY)
  if (!isServiceRole) {
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

  // Diagnostic endpoint: GET /functions/v1/photo-processor?diag=1 verifies that
  // the R2 credentials work by calling ListBuckets (no body-signing involved).
  // Helps isolate credential errors from body-related signature mismatches.
  // Diagnostic endpoint — POST ?diag=1 returns bucket reachability +
  // credential shape (no secrets leaked). Service-role-only. Handy when
  // rotating tokens or investigating SigV4 mismatches.
  const diagReq = new URL(req.url).searchParams.get('diag')
  if (diagReq === '1') {
    const headRes = await r2.fetch(`${r2Endpoint}/${R2_BUCKET}`, { method: 'HEAD' })
    return new Response(
      JSON.stringify({
        diag: true,
        bucket: R2_BUCKET,
        bucketReachable: headRes.status === 200,
        keyLen: R2_ACCESS_KEY_ID.length,
        secretLen: R2_SECRET_ACCESS_KEY.length,
        publicBase: R2_PUBLIC_BASE,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  let body: ProcessRequest
  try { body = await req.json() } catch {
    return new Response(
      JSON.stringify({ success: false, error: 'invalid JSON body' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const { listingId, photoUrls, keyPrefix } = body
  if (!listingId || !Array.isArray(photoUrls) || photoUrls.length === 0) {
    return new Response(
      JSON.stringify({ success: false, error: 'listingId and non-empty photoUrls[] required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
  // Défense en profondeur : même si keyPrefix est dérivé server-side par le broker,
  // on refuse tout ce qui n'est pas un chemin sûr (anti path-traversal R2).
  if (keyPrefix !== undefined && !/^[a-z0-9][a-z0-9/_-]{0,128}$/.test(keyPrefix)) {
    return new Response(
      JSON.stringify({ success: false, error: 'invalid keyPrefix' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const toProcess = photoUrls.slice(0, MAX_PHOTOS_PER_LISTING)

  // Sequential to be kind to Flatfox's CDN and to keep peak memory bounded
  // (imagescript holds the decoded RGBA in memory — 1200×800 = ~3.8 MB per
  // photo). Processing 10 in parallel would peak at ~40 MB which is fine,
  // but sequential is simpler to reason about under timeouts.
  const photos_cf: PhotoVariants[] = []
  const errors: string[] = []
  for (let i = 0; i < toProcess.length; i++) {
    const res = await processOne(toProcess[i], listingId, i, keyPrefix)
    if (res.ok) photos_cf.push(res.ok)
    else if (res.err) errors.push(`photo ${i}: ${res.err}`)
  }

  return new Response(
    JSON.stringify({
      success: true,
      photos_cf,
      attempted: toProcess.length,
      succeeded: photos_cf.length,
      errors: errors.length > 0 ? errors : undefined,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
