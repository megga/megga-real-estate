// ═══════════════════════════════════════════════════════════════════════════
// photo-processor — Upload listing photos to Cloudflare Images
// ═══════════════════════════════════════════════════════════════════════════
//
// Uploads a batch of Flatfox (or any external) photo URLs to Cloudflare
// Images and returns the CF variant URLs so the caller can persist them on
// `market_listings.photos_cf`.
//
// This function is called by:
//   1. `flatfox-sync` — after each new listing is upserted
//   2. `backfill-cf-images` — to catch up on the existing 33K listings
//
// Auth: service_role only (never exposed to the browser — protects the
// CF_IMAGES_TOKEN from being fingerprinted by a malicious caller).
//
// Input (POST JSON):
//   { listingId: string, photoUrls: string[] }   // max 10 photos / listing
//
// Output:
//   { success: true, photos_cf: [{id, thumb, detail, hero, og}, ...] }
//   { success: false, error: string }
//
// Idempotency: CF Images IDs are deterministic (`listing-<uuid>-<idx>`).
// Re-running the function on the same listing overwrites the same IDs in
// place — no duplicates, no extra storage cost.
//
// CF Images variants must be pre-configured at the account level:
//   thumb  — 400px  WebP q80
//   detail — 1200px WebP q85
//   hero   — 1600px WebP q90
//   og     — 1200×630 JPG q85  (social share)
// If a variant is missing, CF returns the original URL instead.
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const CF_ACCOUNT_ID = Deno.env.get('CF_ACCOUNT_ID') ?? ''
const CF_IMAGES_TOKEN = Deno.env.get('CF_IMAGES_TOKEN') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const MAX_PHOTOS_PER_LISTING = 10
const CF_UPLOAD_TIMEOUT_MS = 15_000

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ProcessRequest {
  listingId: string
  photoUrls: string[]
}

interface CFVariants {
  id: string
  thumb?: string
  detail?: string
  hero?: string
  og?: string
}

// Parse the `variants: []` array returned by CF Images and map each URL to
// the variant name it corresponds to (the last path segment).
function mapVariants(variantUrls: string[]): Omit<CFVariants, 'id'> {
  const out: Omit<CFVariants, 'id'> = {}
  for (const url of variantUrls) {
    const variant = url.split('/').pop()?.toLowerCase()
    if (variant === 'thumb') out.thumb = url
    else if (variant === 'detail') out.detail = url
    else if (variant === 'hero') out.hero = url
    else if (variant === 'og') out.og = url
  }
  return out
}

// Upload a single photo URL to CF Images. CF fetches the URL server-side,
// so we don't need to proxy the bytes through our function.
async function uploadOne(flatfoxUrl: string, imageId: string): Promise<CFVariants | null> {
  try {
    const form = new FormData()
    form.append('url', flatfoxUrl)
    form.append('id', imageId)
    // `requireSignedURLs=false` → images are public via the delivery URL
    // (we're not serving sensitive content, just listing photos).
    form.append('requireSignedURLs', 'false')

    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), CF_UPLOAD_TIMEOUT_MS)

    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/images/v1`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${CF_IMAGES_TOKEN}` },
        body: form,
        signal: ctrl.signal,
      }
    )
    clearTimeout(timer)

    const json = await res.json() as {
      success: boolean
      result?: { id: string; variants: string[] }
      errors?: Array<{ code: number; message: string }>
    }

    if (!json.success || !json.result) {
      // CF returns 409 when the ID already exists — we want idempotency,
      // so treat that as "already uploaded" and fetch the existing variants.
      const alreadyExists = json.errors?.some((e) => e.code === 5409)
      if (alreadyExists) {
        return await fetchExisting(imageId)
      }
      // eslint-disable-next-line no-console
      console.error('[photo-processor] CF upload failed', imageId, json.errors)
      return null
    }

    return {
      id: json.result.id,
      ...mapVariants(json.result.variants),
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[photo-processor] upload error', imageId, (err as Error).message)
    return null
  }
}

// When an ID already exists on CF (idempotent re-run), fetch its variants.
async function fetchExisting(imageId: string): Promise<CFVariants | null> {
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/images/v1/${imageId}`,
      { headers: { Authorization: `Bearer ${CF_IMAGES_TOKEN}` } }
    )
    const json = await res.json() as {
      success: boolean
      result?: { id: string; variants: string[] }
    }
    if (!json.success || !json.result) return null
    return { id: json.result.id, ...mapVariants(json.result.variants) }
  } catch {
    return null
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // ── Auth: service_role only ────────────────────────────────────────
  // This EF holds the CF Images token — never expose it to callers that
  // aren't fully trusted. We check the Authorization bearer matches the
  // service_role key (set by pg_cron / other EFs) exactly.
  const authHeader = req.headers.get('Authorization')
  if (!authHeader || authHeader !== `Bearer ${SERVICE_ROLE_KEY}`) {
    return new Response(
      JSON.stringify({ success: false, error: 'service_role required' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (!CF_ACCOUNT_ID || !CF_IMAGES_TOKEN) {
    return new Response(
      JSON.stringify({ success: false, error: 'CF secrets not configured' }),
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

  // Process up to MAX_PHOTOS_PER_LISTING photos — most listings have 3-8.
  // Beyond 10 we drop silently to keep upload cost predictable.
  const toProcess = photoUrls.slice(0, MAX_PHOTOS_PER_LISTING)

  // Parallel upload — CF API comfortably handles 10 parallel requests/listing.
  const results = await Promise.all(
    toProcess.map((url, i) => uploadOne(url, `listing-${listingId}-${i}`))
  )

  // Filter out failures — we persist only the photos that actually uploaded.
  // Partial success is fine; the frontend falls back to `photos[]` for missing
  // indices.
  const photos_cf = results.filter((v): v is CFVariants => v !== null)

  return new Response(
    JSON.stringify({ success: true, photos_cf, attempted: toProcess.length, succeeded: photos_cf.length }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
