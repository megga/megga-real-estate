import posthog from 'posthog-js'

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined
const POSTHOG_HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? 'https://eu.posthog.com'

export function initPostHog() {
  if (!POSTHOG_KEY) return

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
}

export function identifyUser(userId: string, properties?: Record<string, string>) {
  if (!POSTHOG_KEY) return
  posthog.identify(userId, properties)
}

export function trackEvent(event: string, properties?: Record<string, unknown>) {
  if (!POSTHOG_KEY) return
  posthog.capture(event, properties)
}

export function resetPostHog() {
  if (!POSTHOG_KEY) return
  posthog.reset()
}

export { posthog }
