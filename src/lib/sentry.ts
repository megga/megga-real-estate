/**
 * Initialisation Sentry (monitoring erreurs + session replay) du frontend.
 *
 * Scrub obligatoire des capability tokens (/kyc/, /kyc-report/, /reception/) et des
 * query strings — c'est la query qui porte le `?token=` des pages de visite — avant
 * tout envoi au tiers Sentry (cf. audit S27) ; PII désactivée, replay masqué ET non
 * embarqué sur les routes tokenisées. `initSentry()` est idempotent (appelé une fois
 * au boot).
 */
import * as Sentry from '@sentry/react'

// Sentry DSN is public by design — it identifies the project to send events to
// but grants no read access. Hardcoded as fallback so error reporting works
// without env var configuration (same pattern as src/lib/supabase.ts).
const DEFAULT_DSN =
  'https://d2ecb5623db9c5e3368ac048ef345fcd@o4511407781707776.ingest.de.sentry.io/4511407787933776'

const SENTRY_DSN = (import.meta.env.VITE_SENTRY_DSN as string | undefined) || DEFAULT_DSN

let sentryInitialized = false

/**
 * Retire les capability tokens des URLs avant tout envoi à Sentry (tiers). cf. audit S27.
 *
 * Le segment qui suit `/kyc`, `/kyc-report`, `/reception`, `/rendez-vous` ou
 * `/accept-invite` est le token lui-même. Les
 * pages de visite, elles, portent le leur en query : c'est le strip `[?#].*$` qui les
 * couvre — ne pas le retirer en croyant qu'il ne sert qu'à raccourcir.
 *
 * ⚠ `kyc-report` est listé À PART : l'alternation impose un `/` immédiatement après le
 * mot, donc une branche `kyc` seule ne couvre pas `/kyc-report/<token>`.
 * `/portail/` a été retiré — le portail vendeur n'existe plus depuis juillet 2026.
 */
export function scrubSecretUrl(u: string): string {
  return u
    .replace(/\/(kyc-report|kyc|reception|rendez-vous-accueil|rendez-vous|accept-invite)\/[^/?#]+/gi, '/$1/[redacted]')
    .replace(/[?#].*$/, '')
}

/**
 * Routes publiques porteuses d'un capability token : `/kyc/<token>`,
 * `/kyc-report/<token>`, `/reception/<token>`, `/rendez-vous/<token>` (gestion d'un RDV
 * KYC, émis par `appointment-book`), `/accept-invite/<token>` (token dans le
 * CHEMIN) et `/visit/:id/edit|feedback` (token dans la QUERY). `visite` = alias FR,
 * normalement redirigé au bord, gardé ici parce que le SPA sert aussi ces chemins hors
 * Cloudflare.
 *
 * `/auth` couvre le sous-arbre ENTIER : sans `flowType` explicite, le client Supabase
 * reste en flux implicite et dépose la session dans le fragment
 * (`#access_token=…&refresh_token=…`). Le Session Replay n'étant pas filtré par
 * `beforeSend`, une session enregistrée sur ces pages livrerait un `refresh_token` de
 * longue durée à un tiers — le pire des secrets de l'application, devant tout jeton
 * de visite.
 *
 * ⚠ Jumelle de la garde de `index.html` (autre runtime, aucun import possible) —
 * `tests/unit/token-routes.spec.ts` compare les deux sources.
 */
export function isTokenBearingPath(pathname: string): boolean {
  return /^\/(kyc-report|kyc|reception|rendez-vous-accueil|rendez-vous|visit|visite|accept-invite|auth)(\/|$)/i.test(pathname)
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
 * ne passent pas par `beforeSend` : on ne peut pas filtrer les replays sur ce tag — d'où
 * le retrait pur et simple de l'intégration sur les routes tokenisées (cf. `initSentry`).
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

  // Le Session Replay ne passe NI par `beforeSend` NI par `beforeSendTransaction` : ses
  // enregistrements partent avec les URLs BRUTES, donc `scrubSecretUrl` ne le protège
  // pas. Sur une route tokenisée on ne l'embarque donc pas du tout — masquer le texte ne
  // masque pas la barre d'adresse. Décidé à l'entrée : ces pages sont des points
  // d'arrivée (lien e-mail / WhatsApp), on n'y navigue jamais depuis le CRM.
  const routeTokenisee =
    typeof window !== 'undefined' && isTokenBearingPath(window.location.pathname)

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    sendDefaultPii: false,
    integrations: routeTokenisee
      ? [Sentry.browserTracingIntegration()]
      : [
          Sentry.browserTracingIntegration(),
          Sentry.replayIntegration({ maskAllText: true, maskAllInputs: true, blockAllMedia: true }),
        ],
    // Tracing — échantillon réduit (limite la captation d'URLs).
    tracesSampleRate: 0.2,
    // Distributed tracing — en-têtes de trace vers nos propres pages SEULEMENT.
    //
    // ⛔ NE JAMAIS remettre supabase.co dans cette liste sans avoir d'abord ajouté
    // `sentry-trace, baggage` aux Access-Control-Allow-Headers de TOUTES les edge
    // functions. Incident du 04.08.2026 : avec supabase.co ciblé, Sentry attache
    // `baggage` + `sentry-trace` à chaque appel — la passerelle REST reflète les
    // en-têtes demandés et survit, mais les FONCTIONS répondent une liste figée qui
    // ne les contient pas : Chrome refuse alors le préflight (cors-error 20,
    // failed-parameter: baggage) et AUCUN appel de fonction ne part de AUCUN
    // navigateur en production. Symptôme vécu : « Failed to fetch » silencieux,
    // Intercom qui ne boote pas, zéro appareil enregistré, vérification Stripe
    // inaccessible — pendant que curl (sans Sentry) passait, ce qui a orienté le
    // diagnostic vers tout sauf notre propre bundle. Preuve : netlog Chrome,
    // CORS_PREFLIGHT_ERROR {"cors-error": 20, "failed-parameter": "baggage"}.
    tracePropagationTargets: [
      'localhost',
      /^https:\/\/(.*\.)?megga\.ch\//,
    ],
    // Session Replay — 10% of all sessions, 100% of sessions that hit an error.
    // Ramenés à 0 sur route tokenisée : redondant avec l'intégration non embarquée,
    // mais c'est ce qui tient si quelqu'un la rebranche un jour sans relire ci-dessus.
    replaysSessionSampleRate: routeTokenisee ? 0 : 0.1,
    replaysOnErrorSampleRate: routeTokenisee ? 0 : 1.0,
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
    // Scrub des capability tokens (cf. `scrubSecretUrl` : segment de chemin pour /kyc/,
    // /kyc-report/, /reception/, /accept-invite/ ; query et fragment pour les pages de
    // visite et /auth/callback) dans les URLs des événements, breadcrumbs et transactions
    // avant envoi au tiers.
    beforeSend(event) {
      // Taguer AVANT d'expurger : la dérivation tient sur les deux formes (un test le
      // prouve), mais partir de l'URL brute évite de dépendre de l'ordre des traitements.
      tagEventSurface(event)
      if (event.request?.url) event.request.url = scrubSecretUrl(event.request.url)
      if (event.breadcrumbs) {
        // `url` ne suffit pas : un breadcrumb de navigation ne porte pas cette clé, il
        // porte `from`/`to` (chemin + query + fragment). Une navigation partie d'une page
        // tokenisée y inscrivait donc le token, dans un champ que ce filtre ne touchait
        // pas, et le breadcrumb repart avec l'exception suivante.
        event.breadcrumbs = event.breadcrumbs.map((b) => {
          if (!b.data) return b
          const data = { ...b.data }
          for (const cle of ['url', 'from', 'to'] as const) {
            if (typeof data[cle] === 'string') data[cle] = scrubSecretUrl(data[cle] as string)
          }
          return { ...b, data }
        })
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
