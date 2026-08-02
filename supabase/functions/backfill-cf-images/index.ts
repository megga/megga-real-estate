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
import { isServiceSecret } from '../_shared/require-service-secret.ts'
import { requireSuperAdmin } from '../_shared/require-super-admin.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

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
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  // Garde service-role : comparaison constant-time au secret partagé
  // app_config.service_role_key (repli env). Plus de décodage de rôle JWT
  // (forgeable sous --no-verify-jwt, S22). Le chemin super_admin ci-dessous est inchangé.
  const isServiceRole = await isServiceSecret(supabase, req)
  if (!isServiceRole) {
    // Appel interactif — super_admin : rôle + allowlist email
    // (voir _shared/require-super-admin.ts, migration 20260705160000)
    const auth = await requireSuperAdmin(req, corsHeaders)
    if (auth instanceof Response) return auth
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
  // Le secret que `photo-processor` attend — PAS l'en-tête entrant.
  //
  // L'ancien code réexpédiait `authHeader` en affirmant en commentaire qu'il
  // avait « déjà validé un JWT service_role ». C'était vrai sur le chemin cron,
  // faux sur le chemin super-admin, où l'en-tête porte le JWT d'un UTILISATEUR.
  // `photo-processor` ne connaît que `isServiceSecret` : il répondait donc 401,
  // et chaque annonce du lot tombait dans la branche d'échec ci-dessous, qui
  // estampille `photos_cf: []` + `photos_cf_processed_at` — c'est-à-dire
  // « traitée, aucune photo », définitivement et sans reprise. Un clic depuis la
  // console détruisait ainsi le travail en attente de tout le lot, en répondant
  // `{succeeded: 0, failed: N}`, ce qui se lit comme une panne passagère.
  //
  // Même ordre de préférence que `isServiceSecret` côté receveur : `app_config`
  // d'abord (la valeur que pg_cron forwarde), l'env en repli.
  const { data: cfg } = await supabase
    .from('app_config').select('value').eq('key', 'service_role_key').maybeSingle()
  const serviceCredential = ((cfg?.value as string | undefined) ?? '').trim() || SERVICE_ROLE_KEY
  if (!serviceCredential) {
    return new Response(
      JSON.stringify({ error: 'service credential unavailable (app_config.service_role_key et env vides)' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  let succeeded = 0
  let failed = 0
  /** Panne SYSTÉMIQUE (auth, fonction absente) : elle frappera chaque annonce à
   *  l'identique. On arrête le lot au lieu de brûler les lignes une à une. */
  let aborted: string | null = null
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
      const procRes = await fetch(`${SUPABASE_URL}/functions/v1/photo-processor`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceCredential}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ listingId: row.id, photoUrls: photos }),
      })

      // Un statut d'erreur HTTP ne dit RIEN sur les photos de cette annonce : il
      // dit que l'appel n'aboutit pas. L'estampiller reviendrait à effacer du
      // travail en attente à cause d'un problème d'installation.
      if (!procRes.ok) {
        aborted = `photo-processor a répondu ${procRes.status}`
        break
      }

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
    } catch (err) {
      // Same — stamp with [] so we don't spin forever on a bad photo.
      await supabase
        .from('market_listings')
        .update({ photos_cf: [], photos_cf_processed_at: new Date().toISOString() })
        .eq('id', row.id)
      failed++
      console.error('[backfill-cf-images] annonce', row.id, (err as Error)?.message ?? err)
    }
  }

  // ── Compute remaining for the shell loop ────────────────────────────
  const { count: remaining } = await supabase
    .from('market_listings')
    .select('id', { count: 'estimated', head: true })
    .is('photos_cf_processed_at', null)
    .not('photos', 'is', null)

  // Un arrêt systémique se répond en 502 : `{succeeded: 0}` en 200 se lit comme
  // « rien à faire » et la boucle shell d'ops enchaîne les lots dans le vide.
  return new Response(
    JSON.stringify({
      processed: aborted ? succeeded + failed : listings.length,
      succeeded,
      failed,
      remaining: remaining ?? null,
      ...(aborted ? { aborted, hint: 'lot interrompu — aucune annonce estampillée sur cette panne' } : {}),
    }),
    { status: aborted ? 502 : 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
