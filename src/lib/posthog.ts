/**
 * Wrapper PostHog — analytics produit gated par le consentement cookies (LPD).
 *
 * Rien ne part tant que l'utilisateur n'a pas opté pour les cookies analytics
 * (`initPostHogIfConsented`) ou que `VITE_POSTHOG_KEY` n'est pas défini. Hébergement
 * EU par défaut ; session recording désactivé. Miroir fonctionnel de `intercom.ts`.
 *
 * Le SDK est chargé À LA DEMANDE (`import()`), jamais dans le bundle initial : il y pesait
 * 275 Ko gzip depuis sa montée de version (audit S16, 13.09.2026) pour un outil DORMANT en
 * production — sans `VITE_POSTHOG_KEY`, le morceau n'est même jamais téléchargé. Chaque appel
 * passe par `sdk()` : la promesse unique garde l'ordre (init avant identify, capture, reset).
 */
import type { PostHog } from 'posthog-js'
import { isTokenBearingPath } from '@/lib/sentry'

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
let chargement: Promise<PostHog> | null = null

/** Le SDK, chargé une seule fois ; toute action s'enchaîne sur la même promesse. */
function sdk(): Promise<PostHog> {
  chargement ??= import('posthog-js').then((m) => m.default)
  return chargement
}

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

/** Initialise le SDK (idempotent). No-op sans clé ; à réserver au cas consenti. */
export function initPostHog() {
  if (!POSTHOG_KEY || posthogInitialized) return
  // Même règle que Sentry et Intercom : rien sur une route à lien tokenisé.
  // `capture_pageview` enverrait `$current_url` — le jeton compris — et
  // `autocapture` le renverrait à chaque clic. Le garde-fou est posé maintenant
  // parce que la clé est aujourd'hui absente du déploiement : le jour où on
  // l'ajoutera, la fuite partirait sans que rien ne la signale.
  if (typeof window !== 'undefined' && isTokenBearingPath(window.location.pathname)) return

  const cle = POSTHOG_KEY
  posthogInitialized = true
  void sdk().then((posthog) => posthog.init(cle, {
    api_host: POSTHOG_HOST,
    autocapture: true,
    capture_pageview: true,
    capture_pageleave: true,
    persistence: 'localStorage+cookie',
    // Respect user privacy — no session recording by default
    disable_session_recording: true,
    // EU hosting for Swiss data compliance
    request_batching: true,
  }))
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
        void sdk().then((posthog) => {
          try {
            posthog.opt_in_capturing()
          } catch {
            // noop
          }
        })
      }
    } else {
      if (posthogInitialized) {
        void sdk().then((posthog) => {
          try {
            posthog.opt_out_capturing()
          } catch {
            // noop
          }
        })
      }
    }
  }) as EventListener)
}

/** Associe les events suivants à un utilisateur identifié. No-op si non initialisé. */
export function identifyUser(userId: string, properties?: Record<string, string>) {
  if (!POSTHOG_KEY || !posthogInitialized) return
  void sdk().then((posthog) => posthog.identify(userId, properties))
}

/** Capture un event produit. No-op si non consenti/initialisé. */
export function trackEvent(event: string, properties?: Record<string, unknown>) {
  if (!POSTHOG_KEY || !posthogInitialized) return
  void sdk().then((posthog) => posthog.capture(event, properties))
}

/** Réinitialise l'identité (au logout) pour repartir en anonyme. */
export function resetPostHog() {
  if (!POSTHOG_KEY || !posthogInitialized) return
  void sdk().then((posthog) => posthog.reset())
}
