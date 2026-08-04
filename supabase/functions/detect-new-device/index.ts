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

function deviceAlertHtml(args: { name: string; browser: string; os: string; city: string | null; country: string | null; ip: string; when: string }): string {
  const location = [args.city, args.country].filter(Boolean).join(', ') || 'Localisation inconnue'
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#f5f5f5;margin:0;padding:40px 20px">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.05)">
    <tr><td style="padding:32px 32px 0 32px">
      <div style="width:44px;height:44px;border-radius:999px;background:#FEF3C7;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
      </div>
      <h1 style="font-size:20px;color:#111827;margin:0 0 6px 0;font-weight:600">Nouvelle connexion détectée</h1>
      <p style="font-size:14px;color:#6B7280;margin:0 0 24px 0;line-height:1.55">
        Bonjour${args.name ? ' ' + args.name : ''}, une connexion vient d'être effectuée sur ton compte MEGGA depuis un appareil que nous ne reconnaissons pas.
      </p>
    </td></tr>
    <tr><td style="padding:0 32px">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;border-radius:12px;padding:4px">
        <tr><td style="padding:14px 16px">
          <div style="display:flex;justify-content:space-between;padding:6px 0"><span style="font-size:12px;color:#6B7280">Navigateur</span><span style="font-size:13px;color:#111827;font-weight:600">${args.browser}</span></div>
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-top:1px solid #F3F4F6"><span style="font-size:12px;color:#6B7280">Système</span><span style="font-size:13px;color:#111827;font-weight:600">${args.os}</span></div>
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-top:1px solid #F3F4F6"><span style="font-size:12px;color:#6B7280">Localisation</span><span style="font-size:13px;color:#111827;font-weight:600">${location}</span></div>
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-top:1px solid #F3F4F6"><span style="font-size:12px;color:#6B7280">Adresse IP</span><span style="font-size:13px;color:#111827;font-family:monospace">${args.ip || '—'}</span></div>
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-top:1px solid #F3F4F6"><span style="font-size:12px;color:#6B7280">Date</span><span style="font-size:13px;color:#111827;font-weight:600">${args.when}</span></div>
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:24px 32px">
      <p style="font-size:13px;color:#6B7280;margin:0 0 16px 0;line-height:1.55">
        Si tu reconnais cette connexion, tu peux ignorer ce message.<br>
        Sinon, change ton mot de passe immédiatement :
      </p>
      <a href="https://megga.ch/security/sessions" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:11px 22px;border-radius:999px;font-size:13px;font-weight:600">Sécuriser mon compte</a>
    </td></tr>
    <tr><td style="padding:24px 32px 32px 32px;border-top:1px solid #F3F4F6">
      <p style="font-size:11px;color:#9CA3AF;margin:0;line-height:1.55">
        MEGGA Real Estate · Suisse<br>
        Tu reçois cet email parce que la détection d'appareils est activée sur ton compte.
      </p>
    </td></tr>
  </table>
</body></html>`
}

async function sendDeviceAlert(to: string, html: string) {
  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) { console.error('RESEND_API_KEY missing'); return }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'MEGGA Security <security@megga.ch>',
      to: [to],
      subject: 'Nouvelle connexion sur ton compte MEGGA',
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
      await sendDeviceAlert(user.email, deviceAlertHtml({
        name, browser, os, city, country, ip, when,
      }))
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
