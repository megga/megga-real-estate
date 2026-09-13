/**
 * Chemin de retour INTERNE — le seul filtre à poser entre une valeur lue dans
 * une URL (ou tout autre canal forgeable) et `navigate()`.
 *
 * POURQUOI UN FILTRE, alors que `navigate()` « reste dans l'app » :
 *
 * (a) `navigate()` n'est PAS confiné à l'origine. `@remix-run/router` (1.23.2)
 *     laissait passer telle quelle toute valeur absolue (`isAbsoluteUrl`), puis
 *     `push()` appelle `history.pushState` ; quand celui-ci jette (valeur
 *     d'une autre origine, `javascript:`…), le routeur RETOMBE sur
 *     `window.location.assign(url)`. Une valeur `//hote`, `/\hote` ou
 *     `javascript:…` passée brute devenait donc une redirection hors du CRM, voire
 *     une exécution de script (mesuré dans Chromium le 13.09.2026). Depuis 1.23.4
 *     (montée S16, même jour) le routeur résout lui-même `//hote` et `javascript:`
 *     en chemins internes, mais `/\hote` et les caractères de contrôle quittent
 *     ENCORE l'origine (GHSA-wrjc-x8rr-h8h6, corrigé en v7 seulement) : le filtre
 *     reste la barrière, le routeur n'en est pas une.
 *
 * (b) `startsWith('/') && !startsWith('//')` ne suffit pas : l'analyseur d'URL
 *     du navigateur lit `\` comme `/` et SUPPRIME tabulation, saut de ligne et
 *     retour chariot. `/\hote` et `/<TAB>/hote` passent ce test naïf et quittent
 *     pourtant l'origine.
 *
 * (c) On rend la valeur BRUTE, jamais une resérialisation : `new URL('/.//x')`
 *     normalise le chemin en `//x`, qui redevient une URL d'une autre origine si
 *     on la renvoie telle quelle au routeur. D'où le refus explicite d'un chemin
 *     normalisé qui commence par `//`.
 *
 * (d) L'origine sentinelle est sûre : une référence absolue par le chemin garde
 *     l'origine de sa base, quelle que soit cette base — la tester contre
 *     `megga.invalid` (domaine réservé, jamais résolu) garde la fonction pure.
 *
 * Le préfixe est un choix PAR POINT D'APPEL : ImportLead ne ramène que dans le
 * CRM (`/dashboard`), mais un futur `?redirect=` d'AcceptInvite viserait
 * `/accept-invite/…`. Ne pas recopier le préfixe d'un appel à l'autre.
 */

const ORIGINE_SENTINELLE = 'https://megga.invalid'
const LONGUEUR_MAX = 2048

/** Options du filtre. */
export interface InternalPathOptions {
  /** Le chemin normalisé doit valoir ce préfixe, ou commencer par `préfixe/`. */
  prefix?: string
}

/**
 * Vrai si `raw` est un chemin interne sûr à passer à `navigate()`.
 *
 * Refuse : non-chaîne, vide, plus de 2048 caractères, tout caractère de
 * contrôle C0 ou DEL, un `\` avant la query, tout ce qui ne commence pas par
 * un `/` unique, tout ce qui quitte l'origine une fois résolu, et — si un
 * préfixe est donné — tout chemin hors de ce préfixe.
 */
export function isSafeInternalPath(raw: unknown, opts: InternalPathOptions = {}): raw is string {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > LONGUEUR_MAX) return false
  // Boucle sur les codes plutôt qu'une regex : la règle ESLint `no-control-regex`
  // est une erreur dans ce dépôt, et la boucle couvre DEL (0x7f), qu'une classe
  // [\x00-\x1f] oublierait.
  for (let i = 0; i < raw.length; i++) {
    const c = raw.charCodeAt(i)
    if (c < 0x20 || c === 0x7f) return false
  }
  // Le `\` n'est dangereux que dans la partie chemin : dans la query, il reste
  // une donnée (encodée par le navigateur), jamais un séparateur.
  if (raw.split(/[?#]/, 1)[0].includes('\\')) return false
  if (raw[0] !== '/' || raw[1] === '/') return false
  let u: URL
  try {
    u = new URL(raw, ORIGINE_SENTINELLE)
  } catch {
    return false
  }
  if (u.origin !== ORIGINE_SENTINELLE || u.pathname.startsWith('//')) return false
  const p = opts.prefix
  if (p && u.pathname !== p && !u.pathname.startsWith(`${p}/`)) return false
  return true
}

/**
 * `raw` tel quel s'il est un chemin interne sûr (cf. {@link isSafeInternalPath}),
 * sinon `fallback`. La valeur rendue est BRUTE, octet pour octet.
 */
export function safeInternalPath(raw: unknown, fallback: string, opts?: InternalPathOptions): string {
  return isSafeInternalPath(raw, opts) ? raw : fallback
}
