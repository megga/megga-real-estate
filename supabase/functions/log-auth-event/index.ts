// supabase/functions/log-auth-event/index.ts
//
// Logs an auth event with a server-side hashed IP for nLPD-friendly audit.
//
// Why server-side ?
//   • The browser cannot see its own public IP — only the server reading the
//     request headers can. So IP must be hashed here, not in the client.
//   • Hash = SHA-256(ip + dailySalt) where dailySalt = SHA-256(masterSecret +
//     UTC date "YYYY-MM-DD"). The salt rotates implicitly at UTC midnight,
//     preventing long-term tracking while still allowing 24h correlation
//     (rate limit per IP, brute-force detection, new-device alerts).
//   • No raw IP is ever persisted. Only the (short-lived) hash.
//
// Body :
//   {
//     action: string,                  // ex. "signin.failure"
//     user_id?: string | null,         // if known
//     detail?: string,                 // free text, truncated 512
//     severity?: 'info' | 'warn' | 'error'
//   }
//
// Returns : { ok: true } on success, { ok: false, error } on failure.
//
// DEPLOYMENT :
//   supabase functions deploy log-auth-event --no-verify-jwt
//   supabase secrets set AUTH_EVENT_SALT_SECRET="<random 32+ char string>"
//
// Auth : --no-verify-jwt because we accept anonymous calls too
//        (signin.failure happens BEFORE the user is authenticated).
//        We still write via service_role so RLS doesn't get in the way.
//
//        Ce point d'entrée doit donc rester ANONYME — un secret expédié au
//        navigateur pour le signer serait un secret public. Ce qui le borne est
//        une limitation de débit par IP, appliquée dans log_auth_event_limited
//        (migration 20260804101347). Voir docs/audits/2026-08-03-signatures-webhooks.md §4.1.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { trustedClientIp } from '../_shared/client-ip.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ─── Crypto helpers ──────────────────────────────────────────────────────

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Daily salt derived from a master secret + the current UTC date.
 * Rotates implicitly at UTC midnight. Same IP same day → same hash → 24h
 * correlation possible (rate-limit / new-device detection). Across days the
 * hash changes, so a single IP cannot be tracked long-term.
 */
async function dailySalt(masterSecret: string): Promise<string> {
  const today = new Date().toISOString().slice(0, 10) // "YYYY-MM-DD" UTC
  return await sha256Hex(`${masterSecret}|${today}`)
}

async function hashIp(ip: string, masterSecret: string): Promise<string> {
  const salt = await dailySalt(masterSecret)
  return await sha256Hex(`${ip}|${salt}`)
}

// ─── Client IP ───────────────────────────────────────────────────────────
// La résolution vit dans _shared/client-ip.ts (testée) ; il ne reste ici que
// le repli.

/**
 * Sceau appliqué quand aucune IP n'est attribuable (voir `trustedClientIp`).
 *
 * Ces appels partagent alors UN SEUL budget de débit. C'est délibéré : laisser
 * passer l'inattribuable rouvrirait le trou (il suffirait de ne rien envoyer),
 * et refuser sec perdrait des événements légitimes si la chaîne de proxys
 * changeait un jour. Un budget commun borne l'abus tout en rendant la panne
 * bruyante — une pile de lignes sous ce hash veut dire « la résolution d'IP ne
 * marche plus », pas « un attaquant ».
 */
const UNATTRIBUTED_IP = 'unattributed'

// ─── Validation ──────────────────────────────────────────────────────────

const ACTION_REGEX = /^(signin|signup|magic_link|password|oauth|signout)\.[a-z_]+$/
const SEVERITIES = new Set(['info', 'warn', 'error'])
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Body = {
  action?: unknown
  user_id?: unknown
  detail?: unknown
  severity?: unknown
}

function validate(body: Body): { ok: true; data: { action: string; user_id: string | null; detail: string | null; severity: 'info' | 'warn' | 'error' } } | { ok: false; error: string } {
  if (typeof body.action !== 'string' || !ACTION_REGEX.test(body.action)) {
    return { ok: false, error: 'invalid_action' }
  }
  const user_id =
    // Vraie forme d'UUID, et pas « 36 caractères pris dans [0-9a-f-] » : la
    // version large laissait passer 36 tirets, que la colonne `uuid` rejetait
    // ensuite en 500. Un corps malformé mérite un 400, pas une erreur serveur.
    typeof body.user_id === 'string' && UUID_REGEX.test(body.user_id)
      ? body.user_id
      : null
  const detail =
    typeof body.detail === 'string' ? body.detail.slice(0, 512) : null
  const severity =
    typeof body.severity === 'string' && SEVERITIES.has(body.severity)
      ? (body.severity as 'info' | 'warn' | 'error')
      : 'info'
  return { ok: true, data: { action: body.action, user_id, detail, severity } }
}

// ─── Handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'method_not_allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const masterSecret = Deno.env.get('AUTH_EVENT_SALT_SECRET')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!masterSecret || !supabaseUrl || !serviceKey) {
    return new Response(
      JSON.stringify({ ok: false, error: 'server_not_configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  let body: Body = {}
  try {
    body = (await req.json()) as Body
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'invalid_json' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const v = validate(body)
  if (!v.ok) {
    return new Response(JSON.stringify({ ok: false, error: v.error }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const ip = trustedClientIp(req) ?? UNATTRIBUTED_IP
  const ipHash = await hashIp(ip, masterSecret)
  const userAgent = (req.headers.get('user-agent') ?? '').slice(0, 256)

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Le comptage et l'insertion sont faits en UN aller (migration 20260804101347) :
  // pas de fenêtre entre la décision et l'écriture, et un échec ne peut pas
  // laisser passer la ligne — il n'y a donc pas de fail-open à arbitrer.
  const { data: outcome, error } = await supabase.rpc('log_auth_event_limited', {
    p_ip_hash: ipHash,
    p_action: v.data.action,
    p_severity: v.data.severity,
    p_user_id: v.data.user_id,
    p_user_agent: userAgent,
    p_detail: v.data.detail,
  })

  if (error) {
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  if (outcome === 'throttled') {
    // L'ip_hash n'est PAS journalisé : c'est une donnée personnelle pseudonymisée,
    // et le motif suffit à diagnostiquer. Les lignes déjà écrites dans la fenêtre
    // sont la trace de l'abus.
    console.warn('[log-auth-event] rate limit atteint pour une IP')
    return new Response(
      JSON.stringify({ ok: false, error: 'rate_limited' }),
      {
        status: 429,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          // La fenêtre courte est la minute ; inutile d'envoyer le client
          // attendre une heure alors que le budget se rouvre bien avant.
          'Retry-After': '60',
        },
      },
    )
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
