import * as Sentry from '@sentry/react'

// Sentry DSN is public by design — it identifies the project to send events to
// but grants no read access. Hardcoded as fallback so error reporting works
// without env var configuration (same pattern as src/lib/supabase.ts).
const DEFAULT_DSN =
  'https://d2ecb5623db9c5e3368ac048ef345fcd@o4511407781707776.ingest.de.sentry.io/4511407787933776'

const SENTRY_DSN = (import.meta.env.VITE_SENTRY_DSN as string | undefined) || DEFAULT_DSN

let sentryInitialized = false

export function initSentry() {
  if (sentryInitialized || !SENTRY_DSN) return

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    sendDefaultPii: true,
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
    // Tracing — 100% of transactions captured.
    tracesSampleRate: 1.0,
    // Distributed tracing — propagate trace headers to our own backends only.
    tracePropagationTargets: [
      'localhost',
      /^https:\/\/(.*\.)?megga\.ch\//,
      /^https:\/\/eayczugyrvmtqnnmvjod\.supabase\.co\//,
    ],
    // Session Replay — 10% of all sessions, 100% of sessions that hit an error.
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    // Forward console logs to Sentry.
    enableLogs: true,
    // Don't spam Sentry from local dev unless explicitly opted in.
    enabled: import.meta.env.PROD || import.meta.env.VITE_SENTRY_FORCE_DEV === 'true',
    // Filter noisy errors that aren't actionable.
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      'Non-Error promise rejection captured',
    ],
  })

  sentryInitialized = true
}

export function identifySentryUser(userId: string, email?: string) {
  if (!sentryInitialized) return
  Sentry.setUser({ id: userId, ...(email ? { email } : {}) })
}

export function clearSentryUser() {
  if (!sentryInitialized) return
  Sentry.setUser(null)
}

export { Sentry }
