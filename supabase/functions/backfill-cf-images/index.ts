// ═══════════════════════════════════════════════════════════════════════════
// backfill-cf-images — Process existing market_listings into Cloudflare Images
// ═══════════════════════════════════════════════════════════════════════════
//
// Iterates over market_listings rows where photos_cf is NULL and photos is
// non-empty, calls `photo-processor` for each, persists the returned variants
// into `photos_cf` + stamps `photos_cf_processed_at`.
//
// One invocation processes one batch (default 25 listings). A shell loop on
// the dev machine calls this EF until `remaining: 0`, throttled to keep
// CF API load under control.
//
// Auth: super_admin or service_role.
// Endpoint returns { processed, succeeded, failed, remaining, next? }.
//
// Safety:
//   - Batch size bounded (25 default, 50 max) — keep EF under its timeout.
//   - Sequential listing processing, parallel photos per listing — respects
//     Flatfox CDN politeness (no thundering herd).
//   - Any listing whose photo-processor call fails gets `photos_cf_processed_at`
//     set ANYWAY with photos_cf: [] → retry logic is owned by a separate cron,
//     not this backfill (we don't want to hammer a URL that 404s forever).
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

// Decode a Supabase JWT payload without verifying the signature. We only
// use this to check the `role` claim; the signature check is done by the
// Supabase gateway upstream.
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

const DEFAULT_BATCH = 25
const MAX_BATCH = 50

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // ── Auth: super_admin or service_role ──────────────────────────────
  const authHeader = req.headers.get('Authorization') ?? ''
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  // Decode the JWT role — robust to whether SUPABASE_SERVICE_ROLE_KEY is
  // auto-injected in the EF runtime. The signature itself is checked by the
  // Supabase gateway before we get here.
  const bearerToken = authHeader.replace(/^Bearer\s+/i, '')
  const role = decodeJwtRole(bearerToken)
  // Accept the current sb_secret_ service key (string-equality) in addition to
  // the legacy service_role JWT, so pg_cron via get_app_config authenticates.
  const isServiceRole =
    role === 'service_role' || (SERVICE_ROLE_KEY !== '' && bearerToken === SERVICE_ROLE_KEY)
  let isSuperAdmin = false
  if (!isServiceRole && authHeader.startsWith('Bearer ')) {
    const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    })
    const { data: { user } } = await userClient.auth.getUser()
    if (user) {
      const { data: prof } = await userClient
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      isSuperAdmin = prof?.role === 'super_admin'
    }
  }
  if (!isServiceRole && !isSuperAdmin) {
    return new Response(
      JSON.stringify({ error: 'super_admin or service_role required' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // ── Parse batch size ───────────────────────────────────────────────
  let batchSize = DEFAULT_BATCH
  try {
    const body = await req.json() as { batch?: number }
    if (typeof body?.batch === 'number' && body.batch > 0) {
      batchSize = Math.min(body.batch, MAX_BATCH)
    }
  } catch { /* no body = use default */ }

  // ── Fetch pending listings ─────────────────────────────────────────
  // The partial index idx_ml_cf_pending makes this fast even on 33K rows.
  const { data: listings, error: fetchErr } = await supabase
    .from('market_listings')
    .select('id, photos')
    .is('photos_cf_processed_at', null)
    .not('photos', 'is', null)
    .order('created_at', { ascending: false })
    .limit(batchSize)

  if (fetchErr) {
    return new Response(
      JSON.stringify({ error: fetchErr.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (!listings || listings.length === 0) {
    return new Response(
      JSON.stringify({ processed: 0, succeeded: 0, failed: 0, remaining: 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // ── Call photo-processor for each, sequentially ─────────────────────
  // Sequential to be polite to the Flatfox CDN (CF fetches it in the backend,
  // but it's still 10 req/listing at their end). Parallel within each listing
  // via photo-processor's Promise.all.
  let succeeded = 0
  let failed = 0
  for (const row of listings) {
    const photos = (row.photos as string[] | null) ?? []
    if (photos.length === 0) {
      // Still stamp processed_at so we don't revisit — empty photos array.
      await supabase
        .from('market_listings')
        .update({ photos_cf: [], photos_cf_processed_at: new Date().toISOString() })
        .eq('id', row.id)
      failed++
      continue
    }

    try {
      // Forward the incoming auth header — we already validated it's a valid
      // service_role JWT above. This sidesteps the issue where
      // SUPABASE_SERVICE_ROLE_KEY env var isn't reliably auto-injected in the
      // EF runtime (especially under the new sb_secret_ key rollout).
      const procRes = await fetch(`${SUPABASE_URL}/functions/v1/photo-processor`, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ listingId: row.id, photoUrls: photos }),
      })
      const procJson = await procRes.json() as {
        success?: boolean
        photos_cf?: unknown[]
      }
      if (procJson.success && Array.isArray(procJson.photos_cf)) {
        await supabase
          .from('market_listings')
          .update({
            photos_cf: procJson.photos_cf,
            photos_cf_processed_at: new Date().toISOString(),
          })
          .eq('id', row.id)
        succeeded++
      } else {
        // Mark processed with empty array to avoid infinite retry loop.
        await supabase
          .from('market_listings')
          .update({ photos_cf: [], photos_cf_processed_at: new Date().toISOString() })
          .eq('id', row.id)
        failed++
      }
    } catch {
      // Same — stamp with [] so we don't spin forever on a bad photo.
      await supabase
        .from('market_listings')
        .update({ photos_cf: [], photos_cf_processed_at: new Date().toISOString() })
        .eq('id', row.id)
      failed++
    }
  }

  // ── Compute remaining for the shell loop ────────────────────────────
  const { count: remaining } = await supabase
    .from('market_listings')
    .select('id', { count: 'estimated', head: true })
    .is('photos_cf_processed_at', null)
    .not('photos', 'is', null)

  return new Response(
    JSON.stringify({
      processed: listings.length,
      succeeded,
      failed,
      remaining: remaining ?? null,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
