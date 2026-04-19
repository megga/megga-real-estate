// Google One Tap — floating "Continue as <name>" card from Google, shown on
// the login page when the user has an active Google session in the browser.
//
// Flow:
//   1. Lazy-load the Google Identity Services script (once per page)
//   2. Generate a random nonce, hash it with SHA-256 (hex) → pass the HASH to Google
//   3. When Google returns a credential, call supabase.auth.signInWithIdToken
//      with the ORIGINAL raw nonce — Supabase rehashes and compares.
//
// Important:
//   - One Tap does not render on Safari iOS (ITP blocks third-party cookies)
//   - Google auto-hides the prompt after the user dismisses it twice
//   - GOOGLE_CLIENT_ID must match what's configured in Supabase Auth
//   - Origin (megga.ch) must be whitelisted in the Google Cloud Console

import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

// This is the same OAuth client ID Supabase uses for "Sign in with Google".
// Public by design (identifies the app to Google, not a secret).
const GOOGLE_CLIENT_ID = '178156637080-1d7r3cmb0kqokcv3sfg09ogosdphsgen.apps.googleusercontent.com'

const GSI_SRC = 'https://accounts.google.com/gsi/client'

interface CredentialResponse {
  credential: string
  select_by: string
}

// Global Google Identity Services typing — injected by the GSI script
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (resp: CredentialResponse) => void
            nonce?: string
            auto_select?: boolean
            cancel_on_tap_outside?: boolean
            use_fedcm_for_prompt?: boolean
          }) => void
          prompt: () => void
          cancel: () => void
        }
      }
    }
  }
}

// ─── Nonce helpers ───────────────────────────────────────────────────────

function randomNonce(bytes = 16): string {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ─── GSI script loader (idempotent) ──────────────────────────────────────

let gsiPromise: Promise<void> | null = null
function loadGsi(): Promise<void> {
  if (gsiPromise) return gsiPromise
  gsiPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GSI_SRC}"]`)
    if (existing) { resolve(); return }
    const s = document.createElement('script')
    s.src = GSI_SRC
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('gsi load failed'))
    document.head.appendChild(s)
  })
  return gsiPromise
}

// ─── Component ───────────────────────────────────────────────────────────

interface Props {
  /** If true, skip mounting (e.g. when user is already signed in). */
  disabled?: boolean
}

export default function GoogleOneTap({ disabled }: Props) {
  // Ensure we initialize once per mount — React 18 StrictMode fires effects twice in dev
  const initialized = useRef(false)

  useEffect(() => {
    if (disabled || initialized.current) return
    let cancelled = false

    async function setup() {
      try {
        await loadGsi()
        if (cancelled || !window.google) return

        // Nonce — raw value stored for Supabase, hashed value passed to Google
        const rawNonce = randomNonce()
        const hashedNonce = await sha256Hex(rawNonce)

        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          nonce: hashedNonce,
          auto_select: false,
          cancel_on_tap_outside: false,
          use_fedcm_for_prompt: true, // required since Oct 2024 (FedCM migration)
          callback: async (resp: CredentialResponse) => {
            if (!resp.credential) return
            const { error } = await supabase.auth.signInWithIdToken({
              provider: 'google',
              token: resp.credential,
              nonce: rawNonce,
            })
            if (error) {
              // eslint-disable-next-line no-console
              console.error('[google-one-tap] supabase signIn failed:', error.message)
              return
            }
            // Session is live — onAuthStateChange in useAuth picks it up and
            // LoginPage's <Navigate /> fires based on role.
          },
        })

        if (!cancelled) {
          initialized.current = true
          window.google.accounts.id.prompt()
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[google-one-tap] init failed:', (e as Error).message)
      }
    }

    setup()

    return () => {
      cancelled = true
      // Cancel the prompt if the user navigates away mid-setup
      try { window.google?.accounts.id.cancel() } catch { /* no-op */ }
    }
  }, [disabled])

  // No UI — Google renders the prompt itself
  return null
}
