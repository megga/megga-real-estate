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

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

// ─── Extract IP from request headers ─────────────────────────────────────

function extractClientIp(req: Request): string {
  // Order matters: Cloudflare → Supabase Edge → fallback xff
  const cfIp = req.headers.get('cf-connecting-ip')
  if (cfIp) return cfIp.trim()
  const realIp = req.headers.get('x-real-ip')
  if (realIp) return realIp.trim()
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return 'unknown'
}

// ─── Validation ──────────────────────────────────────────────────────────

const ACTION_REGEX = /^(signin|signup|magic_link|password|oauth|signout)\.[a-z_]+$/
const SEVERITIES = new Set(['info', 'warn', 'error'])

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
    typeof body.user_id === 'string' && /^[0-9a-f-]{36}$/i.test(body.user_id)
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

  const ip = extractClientIp(req)
  const ipHash = await hashIp(ip, masterSecret)
  const userAgent = (req.headers.get('user-agent') ?? '').slice(0, 256)

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { error } = await supabase.from('auth_events').insert({
    user_id: v.data.user_id,
    action: v.data.action,
    severity: v.data.severity,
    ip_hash: ipHash,
    user_agent: userAgent,
    detail: v.data.detail,
  })

  if (error) {
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
