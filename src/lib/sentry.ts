/**
 * Initialisation Sentry (monitoring erreurs + session replay) du frontend.
 *
 * Scrub obligatoire des tokens secrets (/kyc/<token>, /portail/<token>) et query
 * strings avant tout envoi au tiers Sentry (cf. audit S27) ; PII désactivée,
 * replay masqué. `initSentry()` est idempotent (appelé une fois au boot).
 */
import * as Sentry from '@sentry/react'

// Sentry DSN is public by design — it identifies the project to send events to
// but grants no read access. Hardcoded as fallback so error reporting works
// without env var configuration (same pattern as src/lib/supabase.ts).
const DEFAULT_DSN =
  'https://d2ecb5623db9c5e3368ac048ef345fcd@o4511407781707776.ingest.de.sentry.io/4511407787933776'

const SENTRY_DSN = (import.meta.env.VITE_SENTRY_DSN as string | undefined) || DEFAULT_DSN

let sentryInitialized = false

// Retire les tokens secrets des URLs (KYC / portail vendeur) + query strings,
// avant tout envoi à Sentry (tiers). cf. audit S27.
function scrubSecretUrl(u: string): string {
  return u.replace(/\/(kyc|portail)\/[^/?#]+/gi, '/$1/[redacted]').replace(/[?#].*$/, '')
}

/** Surface d'où part l'événement. Une seule application, deux publics. */
export type MeggaSurface = 'console' | 'crm'

/**
 * Adresse de la console super-admin. Recopiée de `@/lib/adminEntry` À DESSEIN : ce module
 * est chargé au tout premier tick du boot, avant le routeur, et il ne doit rien tirer
 * d'autre derrière lui. La valeur est figée depuis le retrait d'`admin.megga.ch` et
 * `tests/unit/admin-console-paths.spec.ts` garde déjà la constante d'origine.
 */
const CONSOLE_PATH = '/dashboard/admin'

/**
 * Chemin → surface. C'est ce tag qui rend mesurable le critère G4 « 48 h sans erreur
 * Sentry console » : sans lui, rien ne distingue une erreur de la console d'une erreur
 * du CRM dans le même projet Sentry.
 *
 * ⚠ Le test porte sur un SEGMENT, pas sur un préfixe : un `startsWith` nu rangerait
 * `/dashboard/administration` dans la console et ferait échouer un gate que rien ne
 * devrait bloquer.
 */
export function surfaceFromPath(pathname: string): MeggaSurface {
  return pathname === CONSOLE_PATH || pathname.startsWith(`${CONSOLE_PATH}/`) ? 'console' : 'crm'
}

/**
 * Chemin d'une URL d'événement Sentry, absolue ou déjà relative ; `null` si rien
 * d'exploitable — l'appelant retombe alors sur `window.location`.
 */
export function pathnameOfEventUrl(url: string | undefined): string | null {
  if (!url) return null
  if (url.startsWith('/')) return url.replace(/[?#].*$/, '')
  try {
    return new URL(url).pathname
  } catch {
    return null
  }
}

/**
 * Tag `surface` posé sur chaque événement.
 *
 * Dérivé de l'URL de l'ÉVÉNEMENT plutôt que d'un `Sentry.setTag()` posé à l'entrée de la
 * console : un tag global est collant, et un seul chemin de sortie oublié taguerait
 * `console` des erreurs du CRM — un faux positif sur un critère de go-live vaut moins que
 * pas de tag du tout. Ici il n'y a aucun état à remettre à zéro.
 *
 * ⚠ Limite connue : une erreur asynchrone qui remonte APRÈS avoir quitté la console, et
 * dont l'événement ne porte pas d'URL, tombe sur `window.location` et sera donc taguée
 * `crm`. Le repli reste le meilleur signal disponible. ⚠ Les événements de Session Replay
 * ne passent pas par `beforeSend` : on ne peut pas filtrer les replays sur ce tag.
 */
export function tagEventSurface<T extends Sentry.Event>(event: T): T {
  const chemin = pathnameOfEventUrl(event.request?.url)
    ?? (typeof window !== 'undefined' ? window.location.pathname : '')
  event.tags = { ...event.tags, surface: surfaceFromPath(chemin) }
  return event
}

/** Configure et démarre Sentry (idempotent). No-op si déjà initialisé ou DSN absent. */
export function initSentry() {
  if (sentryInitialized || !SENTRY_DSN) return

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    sendDefaultPii: false,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: true, maskAllInputs: true, blockAllMedia: true }),
    ],
    // Tracing — échantillon réduit (limite la captation d'URLs).
    tracesSampleRate: 0.2,
    // Distributed tracing — propagate trace headers to our own backends only.
    tracePropagationTargets: [
      'localhost',
      /^https:\/\/(.*\.)?megga\.ch\//,
      /^https:\/\/eayczugyrvmtqnnmvjod\.supabase\.co\//,
    ],
    // Session Replay — 10% of all sessions, 100% of sessions that hit an error.
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    // Ne plus forwarder les console logs (peuvent contenir des fragments de données).
    enableLogs: false,
    // Don't spam Sentry from local dev unless explicitly opted in.
    enabled: import.meta.env.PROD || import.meta.env.VITE_SENTRY_FORCE_DEV === 'true',
    // Filter noisy errors that aren't actionable.
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      'Non-Error promise rejection captured',
    ],
    // Scrub des tokens secrets (/kyc/<token>, /portail/<token>) dans les URLs des
    // événements, breadcrumbs et transactions avant envoi au tiers.
    beforeSend(event) {
      // Taguer AVANT d'expurger : la dérivation tient sur les deux formes (un test le
      // prouve), mais partir de l'URL brute évite de dépendre de l'ordre des traitements.
      tagEventSurface(event)
      if (event.request?.url) event.request.url = scrubSecretUrl(event.request.url)
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((b) =>
          b.data && typeof b.data.url === 'string'
            ? { ...b, data: { ...b.data, url: scrubSecretUrl(b.data.url) } }
            : b,
        )
      }
      return event
    },
    beforeSendTransaction(event) {
      // Même tag sur les transactions : sans lui, la performance de la console serait
      // noyée dans celle du CRM, et le tag ne servirait qu'à moitié.
      tagEventSurface(event)
      if (event.transaction) event.transaction = scrubSecretUrl(event.transaction)
      if (event.request?.url) event.request.url = scrubSecretUrl(event.request.url)
      return event
    },
  })

  sentryInitialized = true
}

/** Associe l'utilisateur courant aux événements Sentry (id + email optionnel). */
export function identifySentryUser(userId: string, email?: string) {
  if (!sentryInitialized) return
  Sentry.setUser({ id: userId, ...(email ? { email } : {}) })
}

/** Dissocie l'utilisateur des événements Sentry (à la déconnexion). */
export function clearSentryUser() {
  if (!sentryInitialized) return
  Sentry.setUser(null)
}

export { Sentry }
