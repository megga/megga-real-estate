import { createClient } from '@supabase/supabase-js'

// Real anon key for the MEGGA Supabase project (eayczugyrvmtqnnmvjod).
// anon keys are PUBLIC BY DESIGN — their security relies on Row Level Security (RLS).
// Hardcoded because Cloudflare Pages env vars were previously misconfigured
// (service_role was set where anon was expected → key leaked in the public bundle).
// Having the true anon key in git ensures the frontend can't accidentally ship
// a service_role key even if the env var is misconfigured again.
const DEFAULT_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVheWN6dWd5cnZtdHFubm12am9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MTM4ODgsImV4cCI6MjA4OTE4OTg4OH0.T257g0ws-PmTTBSDBcUQF6WFvVRLmTFHUwIYMgmCrMw'

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || 'https://eayczugyrvmtqnnmvjod.supabase.co'

// SAFETY CHECK — prevent a service_role key from ever being used as the public client key.
// service_role bypasses RLS and must NEVER reach the browser.
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

const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
let supabaseAnonKey = envKey || DEFAULT_ANON_KEY

const role = decodeJwtRole(supabaseAnonKey)
if (role === 'service_role') {
  // Refuse to expose a service_role key in the browser.
  // Fall back to the safe hardcoded anon key and warn loudly.
  // eslint-disable-next-line no-console
  console.error(
    '[supabase] VITE_SUPABASE_ANON_KEY contains a service_role JWT. ' +
      'Refusing to use it — falling back to the hardcoded anon key. ' +
      'Fix your env var configuration IMMEDIATELY and rotate the leaked key.'
  )
  supabaseAnonKey = DEFAULT_ANON_KEY
}

// ─── "Remember me" storage switch ──────────────────────────────────────
// When the user opts out of "Se souvenir de moi" we want the session to die
// with the browser tab. Supabase's JS client only accepts one storage adapter
// at client creation, so we plug in a proxy that reads a flag at each op.
//
//   localStorage.megga_remember === 'false'   → route tokens to sessionStorage
//   otherwise                                 → route tokens to localStorage (default)
//
// The flag is written by the login form BEFORE signIn is called.

export const REMEMBER_KEY = 'megga_remember'

const rememberAwareStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined') return null
    try {
      if (window.localStorage.getItem(REMEMBER_KEY) === 'false') {
        // session-only mode: prefer sessionStorage, fall back to localStorage
        // (handles the first read right after sign-in, before storage swap)
        return window.sessionStorage.getItem(key) ?? window.localStorage.getItem(key)
      }
      return window.localStorage.getItem(key)
    } catch { return null }
  },
  setItem: (key: string, value: string): void => {
    if (typeof window === 'undefined') return
    try {
      if (window.localStorage.getItem(REMEMBER_KEY) === 'false') {
        window.sessionStorage.setItem(key, value)
        window.localStorage.removeItem(key) // make sure nothing persists across restarts
      } else {
        window.localStorage.setItem(key, value)
      }
    } catch { /* quota or private mode — silent */ }
  },
  removeItem: (key: string): void => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.removeItem(key)
      window.sessionStorage.removeItem(key)
    } catch { /* silent */ }
  },
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: rememberAwareStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

// ─── Stale-JWT pre-flight ──────────────────────────────────────────────
// If the user hasn't visited in a while, the access_token cached in
// localStorage may be expired AND the refresh_token may have been revoked
// server-side. The supabase-js client tries to refresh on init, but if the
// refresh fails the stale tokens still live in localStorage long enough
// for in-flight queries to fire with them — those requests come back as
// 401 PGRST301 "JWT cryptographic operation failed" and the marketplace
// page renders with no listings.
//
// We do a synchronous pre-flight pass at module load: decode every
// `sb-<ref>-auth-token` cookie/entry, and if the access_token's `exp` is
// already in the past, wipe the entry. The supabase client will then
// initialise without a session (anonymous reads still work via RLS).
// Login flows are unaffected — they overwrite the cleared key.
function purgeExpiredAuthTokens() {
  if (typeof window === 'undefined') return
  try {
    const stores = [window.localStorage, window.sessionStorage]
    const now = Math.floor(Date.now() / 1000)
    for (const store of stores) {
      for (let i = store.length - 1; i >= 0; i--) {
        const key = store.key(i)
        if (!key || !key.startsWith('sb-') || !key.endsWith('-auth-token')) continue
        const raw = store.getItem(key)
        if (!raw) continue
        try {
          const parsed = JSON.parse(raw) as { access_token?: string; expires_at?: number } | null
          const exp =
            typeof parsed?.expires_at === 'number'
              ? parsed.expires_at
              : (() => {
                  const t = parsed?.access_token
                  if (!t) return 0
                  try {
                    const payload = t.split('.')[1]
                    if (!payload) return 0
                    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
                    return Number((JSON.parse(json) as { exp?: number }).exp ?? 0)
                  } catch { return 0 }
                })()
          // 60s grace window so we don't churn keys that supabase-js is
          // about to refresh on its own.
          if (exp && exp + 60 < now) {
            store.removeItem(key)
            // eslint-disable-next-line no-console
            console.info(`[supabase] purged expired auth token: ${key}`)
          }
        } catch {
          // Malformed JSON in the auth slot — also nuke it, supabase-js
          // can't recover from it either.
          store.removeItem(key)
          // eslint-disable-next-line no-console
          console.info(`[supabase] purged malformed auth token: ${key}`)
        }
      }
    }
  } catch { /* defensive — never block app boot on storage probing */ }
}

purgeExpiredAuthTokens()
