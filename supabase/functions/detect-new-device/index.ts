// supabase/functions/detect-new-device/index.ts
//
// Called after every successful sign-in (password, OAuth, magic link).
// Computes a device fingerprint from the request headers + client-supplied
// hints, and either:
//   - Bumps last_seen_at on an existing user_devices row (silent)
//   - Inserts a new row AND sends a "new device" alert email via Resend
//
// Auth: Bearer user JWT (client sends supabase access_token).
//
// DEPLOYMENT: must be deployed with `--no-verify-jwt` — the Supabase gateway
// rejects the new ES256 user tokens before they reach the function, so we
// handle the JWT verification ourselves via admin.auth.getUser(token).
//   supabase functions deploy detect-new-device --no-verify-jwt
//
// Body (optional):
//   { screen?: string; tz?: string }   — browser-only hints to differentiate devices
//
// Returns: { ok: true, isNew: boolean }

import { buildDeviceAlertEmail } from '../_shared/device-alert-email.ts'
import { profileLocale } from '../_shared/recipient-language.ts'
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ─── Session id (claim du JWT user, best-effort) ─────────────────────────

// Lie l'appareil à sa session GoTrue pour la révocation réelle (cf.
// revoke-device-session). Null-safe : si le claim est absent, on dégrade vers
// le comportement historique (suivi seulement, pas de kill de session).
function sessionIdFromJwt(jwt: string): string | null {
  try {
    const part = jwt.split('.')[1]
    if (!part) return null
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64.padEnd(Math.ceil(b64.length / 4) * 4, '=')
    const payload = JSON.parse(atob(padded)) as { session_id?: unknown }
    return typeof payload.session_id === 'string' ? payload.session_id : null
  } catch {
    return null
  }
}

// ─── Fingerprint ─────────────────────────────────────────────────────────

async function sha256(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0')).join('')
}

// ─── UA parsing ──────────────────────────────────────────────────────────

function parseUA(ua: string): { browser: string; os: string } {
  let browser = 'Unknown'
  let os = 'Unknown'

  // OS
  if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS'
  else if (/Android/i.test(ua)) os = 'Android'
  else if (/Mac OS X/i.test(ua)) os = 'macOS'
  else if (/Windows/i.test(ua)) os = 'Windows'
  else if (/Linux/i.test(ua)) os = 'Linux'

  // Browser (Edge before Chrome, Chrome before Safari)
  if (/Edg\/([\d.]+)/.exec(ua)) browser = `Edge ${/Edg\/([\d.]+)/.exec(ua)![1].split('.')[0]}`
  else if (/OPR\/([\d.]+)/.exec(ua)) browser = `Opera ${/OPR\/([\d.]+)/.exec(ua)![1].split('.')[0]}`
  else if (/Firefox\/([\d.]+)/.exec(ua)) browser = `Firefox ${/Firefox\/([\d.]+)/.exec(ua)![1].split('.')[0]}`
  else if (/Chrome\/([\d.]+)/.exec(ua)) browser = `Chrome ${/Chrome\/([\d.]+)/.exec(ua)![1].split('.')[0]}`
  else if (/Version\/([\d.]+).*Safari/.exec(ua)) browser = `Safari ${/Version\/([\d.]+).*Safari/.exec(ua)![1].split('.')[0]}`
  else if (/Safari/i.test(ua)) browser = 'Safari'

  return { browser, os }
}

// ─── Geo (best-effort, silent on failure) ────────────────────────────────

async function geolocate(ip: string): Promise<{ country: string | null; city: string | null }> {
  if (!ip || ip === '127.0.0.1' || ip.startsWith('10.') || ip.startsWith('192.168.')) {
    return { country: null, city: null }
  }
  try {
    // ipapi.co — free tier 1k req/day, no key, CORS-enabled
    const resp = await fetch(`https://ipapi.co/${ip}/json/`, {
      headers: { 'User-Agent': 'MEGGA Security' },
      signal: AbortSignal.timeout(3000),
    })
    if (!resp.ok) return { country: null, city: null }
    const j = await resp.json()
    return { country: j.country_code ?? null, city: j.city ?? null }
  } catch {
    return { country: null, city: null }
  }
}

// ─── Email ───────────────────────────────────────────────────────────────

// Le gabarit vit dans `_shared/device-alert-email.ts` depuis le 15.08.2026 : pur, donc
// testable et visible au banc de rendu.

async function sendDeviceAlert(to: string, subject: string, html: string) {
  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) { console.error('RESEND_API_KEY missing'); return }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'MEGGA Security <security@megga.ch>',
      to: [to],
      subject,
      html,
    }),
  })
  if (!r.ok) console.error('Resend error', r.status, await r.text())
}

// ─── Handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (!token) return json({ error: 'unauthorized' }, 401)

    const admin = createClient(supabaseUrl, serviceKey)
    const { data: { user }, error: authError } = await admin.auth.getUser(token)
    if (authError || !user) return json({ error: 'unauthorized' }, 401)

    const sessionId = sessionIdFromJwt(token)

    const ua = req.headers.get('User-Agent') ?? ''
    const acceptLang = req.headers.get('Accept-Language') ?? ''
    const ipFwd = req.headers.get('x-forwarded-for') ?? ''
    const ip = ipFwd.split(',')[0].trim() || req.headers.get('x-real-ip') || ''

    const body = await req.json().catch(() => ({})) as { screen?: string; tz?: string }
    const screen = body.screen ?? ''
    const tz = body.tz ?? ''

    // Fingerprint = stable hash of what we have. UA alone is too broad; we mix
    // in screen + tz + accept-language to distinguish different devices that
    // happen to share a browser version.
    const fingerprint = await sha256([ua, acceptLang, screen, tz].join('||'))

    const { browser, os } = parseUA(ua)

    // Check if this fingerprint is already known
    const { data: existing } = await admin
      .from('user_devices')
      .select('id, trusted')
      .eq('user_id', user.id)
      .eq('fingerprint', fingerprint)
      .maybeSingle()

    if (existing) {
      await admin
        .from('user_devices')
        .update({ last_seen_at: new Date().toISOString(), ip, session_id: sessionId })
        .eq('id', existing.id)
      return json({ ok: true, isNew: false })
    }

    // New device — geolocate, insert, send alert
    const { country, city } = await geolocate(ip)

    await admin.from('user_devices').insert({
      user_id: user.id,
      fingerprint,
      user_agent: ua,
      browser,
      os,
      ip,
      country,
      city,
      trusted: true,
      session_id: sessionId,
    })

    // Skip email on the very first device (user just created the account)
    const { count } = await admin
      .from('user_devices')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
    const isFirstDevice = (count ?? 0) <= 1

    if (!isFirstDevice && user.email) {
      const when = new Date().toLocaleString('fr-CH', { timeZone: 'Europe/Zurich' })
      const nameMeta = user.user_metadata?.full_name
      const name = typeof nameMeta === 'string' ? nameMeta.split(' ')[0] : ''
      // La langue de correspondance du compte concerné. Aucune requête d'où la lire ici
      // — cette fonction réagit à une CONNEXION, pas à un geste dans l'interface — donc
      // c'est profiles.language qui décide, et lui seul.
      const locale = await profileLocale(admin, user.id)
      const { subject, html } = buildDeviceAlertEmail({ name, browser, os, city, country, ip, when, locale })
      await sendDeviceAlert(user.email, subject, html)
    }

    return json({ ok: true, isNew: true, emailSent: !isFirstDevice })
  } catch (e) {
    console.error('detect-new-device error:', (e as Error).message)
    return json({ error: 'internal' }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
