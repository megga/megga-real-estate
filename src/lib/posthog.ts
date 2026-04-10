import posthog from 'posthog-js'

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined
const POSTHOG_HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? 'https://eu.posthog.com'

const CONSENT_KEY = 'megga-cookie-consent'

export interface CookieConsent {
  essential: true
  analytics: boolean
  timestamp: string
  version: string
}

let posthogInitialized = false

function readConsent(): CookieConsent | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CookieConsent
    return parsed
  } catch {
    return null
  }
}

export function initPostHog() {
  if (!POSTHOG_KEY || posthogInitialized) return

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    autocapture: true,
    capture_pageview: true,
    capture_pageleave: true,
    persistence: 'localStorage+cookie',
    // Respect user privacy — no session recording by default
    disable_session_recording: true,
    // EU hosting for Swiss data compliance
    request_batching: true,
  })
  posthogInitialized = true
}

/**
 * Initialise PostHog only if the user has consented to analytics cookies.
 * Also attaches a listener so consent changes during the session take effect
 * immediately (init on opt-in, opt_out_capturing on opt-out).
 */
export function initPostHogIfConsented() {
  if (typeof window === 'undefined') return

  const consent = readConsent()
  if (consent?.analytics === true) {
    initPostHog()
  }

  window.addEventListener('cookie-consent-changed', ((event: Event) => {
    const detail = (event as CustomEvent<CookieConsent>).detail
    if (!POSTHOG_KEY) return

    if (detail?.analytics === true) {
      if (!posthogInitialized) {
        initPostHog()
      } else {
        try {
          posthog.opt_in_capturing()
        } catch {
          // noop
        }
      }
    } else {
      if (posthogInitialized) {
        try {
          posthog.opt_out_capturing()
        } catch {
          // noop
        }
      }
    }
  }) as EventListener)
}

export function identifyUser(userId: string, properties?: Record<string, string>) {
  if (!POSTHOG_KEY || !posthogInitialized) return
  posthog.identify(userId, properties)
}

export function trackEvent(event: string, properties?: Record<string, unknown>) {
  if (!POSTHOG_KEY || !posthogInitialized) return
  posthog.capture(event, properties)
}

export function resetPostHog() {
  if (!POSTHOG_KEY || !posthogInitialized) return
  posthog.reset()
}

export { posthog }
