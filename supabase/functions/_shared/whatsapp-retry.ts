// Retry court des envois sortants Meta (Cloud API). Le code applicatif construit la requête
// via la couche gateway (buildSend*Request), puis l'exécute ICI plutôt que par un fetch nu :
// un envoi en tentative UNIQUE (réponse agent, résultat KYC, avis LPD) est perdu au moindre
// aléa transitoire (coupure réseau, 5xx Meta, throttle de débit). sendWithRetry rejoue jusqu'à
// `maxAttempts` fois sur ces seules erreurs TRANSITOIRES, avec un backoff borné.
//
// Ne DOIT jamais rejouer une erreur PERMANENTE — en particulier 131047 (fenêtre de service
// 24h fermée / re-engagement) : rejouer est inutile (le refus est déterministe) ET dangereux
// (si la fenêtre se rouvrait entre deux tentatives, on doublonnerait l'envoi côté client).
//
// IDEMPOTENCE : l'API Meta /messages n'a pas de clé d'idempotence → rejouer un envoi qui a
// PEUT-ÊTRE abouti (timeout après livraison) doublonne côté destinataire. Les envois AGENT
// tolèrent ce doublon (inoffensif) → retry réseau/5xx/429 plein. Les envois CLIENT non
// idempotents (fil conversationnel) restent en tentative UNIQUE. Cas intermédiaire, l'avis
// LPD (client, mais courtoisie de conformité où « deux fois » vaut mieux que « zéro ») :
// retryNetworkError=false → on ne rejoue que les refus de QUOTA (429 + throttle de débit),
// rejetés avant mise en file donc sûrs ; JAMAIS un 5xx ni un timeout (ambigus : une passerelle
// peut renvoyer 502/504 après que Meta a accepté le message → rejouer doublonnerait).
//
// N'utilise que fetch + AbortSignal.timeout + setTimeout (standard Deno ET Node) et injecte
// ses dépendances d'I/O (fetchImpl, sleep, makeSignal) → testable en Vitest sans réseau.

import type { SendHttpRequest, SendResult } from './whatsapp-gateway.ts'

// Classement de l'issue d'un envoi. `retryable` = transitoire (rejouer a du sens),
// `permanent` = déterministe (rejouer est inutile), `ok` = accepté par le provider.
export type SendOutcome = 'ok' | 'retryable' | 'permanent'

// Codes d'erreur Meta qu'on ne rejoue JAMAIS, quel que soit le statut HTTP. 131047 =
// « Re-engagement message » : hors de la fenêtre de service 24h, l'API refuse tout texte
// libre. Garde explicite (défense en profondeur) : le check du code passe AVANT toute
// décision de retry, donc 131047 reste exclu même si la politique s'élargit.
export const NEVER_RETRY_META_CODES = new Set<number>([131047])

// Throttles de DÉBIT côté API (app/business) que Meta renvoie en HTTP 400 + code (PAS en
// 429 : le Cloud API n'utilise pas 429 pour ça). Transitoires et sûrs à rejouer — la requête
// est refusée AVANT d'être mise en file, donc aucun risque de double-livraison.
//   130429 = « Rate limit hit » (débit API)   ·   80007 = « Rate limit issues » (business API)
// On EXCLUT volontairement 131048 (spam rate limit) et 131056 (pair rate limit) : ceux-là se
// dénouent en minutes, pas en millisecondes → un retry court est inutile, on les laisse
// permanents (échec propre, re-tentable au prochain tick pour les envois cron).
export const RETRYABLE_META_CODES = new Set<number>([130429, 80007])

// Extrait le code d'erreur Meta du corps de réponse ({ error: { code } }). null si absent
// (succès, provider OpenWA, ou corps illisible).
export function metaErrorCode(body: unknown): number | null {
  const err = (body as { error?: { code?: unknown } } | null | undefined)?.error
  return typeof err?.code === 'number' ? err.code : null
}

// Classe l'issue d'une tentative sur le SEUL statut HTTP. `status === null` = le fetch a levé
// (réseau / timeout AbortSignal) → transitoire. 2xx = ok. 5xx (erreur serveur Meta) =
// transitoire ; 429 aussi (rare depuis le Cloud API mais possible via proxy/gateway). Tout
// autre 4xx = permanent au niveau statut — les throttles Meta transitoires (HTTP 400 + code)
// sont rattrapés séparément par RETRYABLE_META_CODES dans sendWithRetry.
export function classifySendOutcome(status: number | null): SendOutcome {
  if (status === null) return 'retryable'
  if (status >= 200 && status < 300) return 'ok'
  if (status === 429) return 'retryable'
  if (status >= 500) return 'retryable'
  return 'permanent'
}

export interface SendWithRetryOpts {
  /** Nombre TOTAL de tentatives (1 = pas de retry). Défaut 3. */
  maxAttempts?: number
  /** Base du backoff linéaire : attente = baseDelayMs × numéro de tentative. Défaut 300 ms. */
  baseDelayMs?: number
  /** Timeout par tentative (AbortSignal). Défaut 8000 ms — aligné sur les envois existants. */
  timeoutMs?: number
  /** fetch injectable (tests). */
  fetchImpl?: typeof fetch
  /** Attente injectable (tests → no-op pour éliminer les délais réels). */
  sleep?: (ms: number) => Promise<void>
  /** Fabrique de signal injectable (tests → pas de timer réel). */
  makeSignal?: (ms: number) => AbortSignal | undefined
  /** Hook d'observabilité appelé AVANT chaque nouvelle tentative (logging côté appelant). */
  onRetry?: (attempt: number, reason: string) => void
  /**
   * Rejouer une exception réseau / timeout (status === null). Défaut true (envois AGENT :
   * un doublon est inoffensif). À passer FALSE pour un envoi CLIENT non idempotent : un
   * timeout est ambigu (Meta a PEUT-ÊTRE livré avant que la réponse se perde), donc rejouer
   * risquerait un doublon côté client. Avec false, on ne rejoue que les refus de QUOTA
   * (429 + throttle de débit Meta en 400) — rejetés avant mise en file, donc sûrs. Un 5xx et
   * un timeout réseau sont ambigus (livraison peut-être déjà faite) → jamais rejoués.
   */
  retryNetworkError?: boolean
}

/**
 * Exécute un `SendHttpRequest` avec retry court sur erreur transitoire : exception
 * réseau/timeout (sauf si retryNetworkError=false), HTTP 5xx, HTTP 429, et throttles de
 * débit Meta en 400 (RETRYABLE_META_CODES). Ne rejoue JAMAIS un code banni (131047) ni une
 * erreur permanente. Ne lève jamais : renvoie toujours un `SendResult` (échec → ok:false).
 *
 * @param req    requête construite par le provider (buildSend*Request)
 * @param parse  parseur du provider (parseSendResult) — status + corps → SendResult
 */
export async function sendWithRetry(
  req: SendHttpRequest,
  parse: (status: number, body: unknown) => SendResult,
  opts: SendWithRetryOpts = {},
): Promise<SendResult> {
  const maxAttempts = Math.max(1, opts.maxAttempts ?? 3)
  const baseDelayMs = opts.baseDelayMs ?? 300
  const timeoutMs = opts.timeoutMs ?? 8000
  const doFetch = opts.fetchImpl ?? fetch
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  const makeSignal = opts.makeSignal ?? ((ms: number) => AbortSignal.timeout(ms))

  let last: SendResult = { ok: false, providerMessageId: null, error: 'not attempted' }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let status: number | null = null
    let body: unknown = {}
    try {
      const res = await doFetch(req.url, {
        method: req.method,
        headers: req.headers,
        body: req.body,
        signal: makeSignal(timeoutMs),
      })
      status = res.status
      body = await res.json().catch(() => ({}))
    } catch {
      status = null // réseau / timeout → transitoire
    }

    last = status !== null
      ? parse(status, body)
      : { ok: false, providerMessageId: null, error: 'network' }
    if (last.ok) return last

    // Décision de retry. Le code banni (131047) l'emporte TOUJOURS. Ensuite, deux modes :
    //  · Mode plein (défaut, envoi AGENT — un doublon est inoffensif) : rejoue le réseau/
    //    timeout, les 5xx, les 429 et les throttles de débit Meta en 400 (RETRYABLE_META_CODES).
    //  · Mode « zéro doublon » (retryNetworkError=false, envoi CLIENT non idempotent) : on ne
    //    rejoue QUE les refus de QUOTA (429 + throttle Meta 400) — rejetés AVANT toute mise en
    //    file, donc sûrs. Le timeout réseau (null) ET les 5xx sont AMBIGUS (une passerelle peut
    //    renvoyer 502/504 APRÈS que Meta a accepté le message) → jamais rejoués (sinon doublon).
    const code = metaErrorCode(body)
    if (code !== null && NEVER_RETRY_META_CODES.has(code)) return last
    // Refus de quota : rejouable même en mode « zéro doublon » (pré-file → aucun doublon possible).
    const quotaRefusal = status === 429 || (code !== null && RETRYABLE_META_CODES.has(code))
    const retryable = opts.retryNetworkError === false
      ? quotaRefusal
      : status === null || classifySendOutcome(status) === 'retryable' || quotaRefusal
    if (!retryable || attempt === maxAttempts) return last

    opts.onRetry?.(attempt, status === null ? 'network' : `http-${status}`)
    await sleep(baseDelayMs * attempt)
  }

  return last
}
