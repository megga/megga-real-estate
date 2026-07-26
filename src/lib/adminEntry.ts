/**
 * Adresses des deux applications MEGGA, et passage du CRM vers la console.
 *
 * Le back-office vit sur SA PROPRE origine (admin.megga.ch, projet Cloudflare
 * Pages `megga-admin`, build `npm run build:admin`) : son bundle n'est pas servi
 * aux agents, et une faille XSS dans le CRM ne donne pas la main sur la console.
 *
 * ⚠️ La console n'est PAS une porte d'entrée : elle ne porte aucun formulaire de
 * connexion. On n'y accède qu'en venant du CRM, qui lui transmet la session de
 * l'appelant. Taper `admin.megga.ch` à froid n'ouvre rien — juste un écran qui
 * renvoie au CRM. Décision produit : il ne doit exister qu'UN endroit où l'on
 * s'authentifie.
 *
 * `VITE_ADMIN_URL` / `VITE_APP_URL` permettent de viser des serveurs locaux en
 * dev (ex. `VITE_ADMIN_URL=http://localhost:5174`).
 */

/** Origine de la console super-admin. */
export const ADMIN_ENTRY_URL =
  (import.meta.env.VITE_ADMIN_URL as string | undefined)?.trim() || 'https://admin.megga.ch'

/** Origine du CRM agent (retour depuis la console, passage d'impersonation). */
export const CRM_APP_URL =
  (import.meta.env.VITE_APP_URL as string | undefined)?.trim() || 'https://app.megga.ch'

/** Vrai quand la console est servie par une autre origine (donc hors React Router). */
export const ADMIN_IS_EXTERNAL = /^https?:\/\//i.test(ADMIN_ENTRY_URL)

/** Noms des paramètres de passage, lus par `main.admin.tsx`. */
export const HANDOVER_ACCESS = 'at'
export const HANDOVER_REFRESH = 'rt'

/** Le minimum dont la console a besoin pour reprendre la session de l'appelant. */
export interface HandoverSession {
  access_token: string
  refresh_token: string
}

/**
 * Ouvre la console en lui passant la session courante.
 *
 * Les deux origines ne partagent ni localStorage ni cookies — c'est tout
 * l'intérêt de la séparation — donc la console ne peut pas voir la session du
 * CRM. Elle la reçoit dans le FRAGMENT de l'URL : contrairement à la query
 * string, un fragment n'est jamais envoyé au serveur, n'apparaît ni dans les
 * journaux d'accès ni dans l'en-tête Referer. C'est le mécanisme qu'utilise
 * Supabase lui-même pour ses retours OAuth. La console l'efface de l'historique
 * dès qu'elle l'a lu, et ne conserve la session que le temps de l'onglet.
 *
 * `session` est passée par l'appelant (elle vient de `useAuth()`), et non lue
 * ici : `window.open` doit être appelé DANS le geste utilisateur, sans `await`
 * intercalé, sinon le navigateur bloque la fenêtre.
 */
export function openAdminConsole(session: HandoverSession | null | undefined): void {
  const url = adminConsoleUrl(session)
  if (!url) return
  window.open(url, '_blank', 'noopener,noreferrer')
}

/**
 * URL d'ouverture de la console, jetons en fragment. `null` si la session est
 * inutilisable — dans ce cas on n'ouvre rien plutôt que d'exposer un écran mort.
 * Séparée d'`openAdminConsole` pour être testable sans `window`.
 */
export function adminConsoleUrl(session: HandoverSession | null | undefined): string | null {
  if (!session?.access_token || !session?.refresh_token) return null
  const fragment = new URLSearchParams({
    [HANDOVER_ACCESS]: session.access_token,
    [HANDOVER_REFRESH]: session.refresh_token,
  })
  return `${ADMIN_ENTRY_URL}/#${fragment.toString()}`
}

/**
 * Lit les jetons d'un fragment d'URL. `null` si le fragment n'en porte pas —
 * cas normal d'une visite directe, qui doit aboutir à l'écran « depuis le CRM »
 * et non à une erreur.
 */
export function readHandoverFromHash(hash: string): HandoverSession | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  if (!raw) return null
  const params = new URLSearchParams(raw)
  const access_token = params.get(HANDOVER_ACCESS)
  const refresh_token = params.get(HANDOVER_REFRESH)
  if (!access_token || !refresh_token) return null
  return { access_token, refresh_token }
}

/**
 * Ouvre le CRM en vue impersonée depuis la console.
 *
 * Les deux applications ne partagent NI localStorage NI cookies : la console ne
 * peut pas armer elle-même la vue impersonée du CRM. Elle passe l'id cible en
 * paramètre, et c'est le CRM qui journalise (RPC `admin_log_impersonation`,
 * gardée `is_super_admin`) avant d'activer quoi que ce soit. Un id dans une URL
 * ne donne aucun droit : c'est la RPC qui décide.
 */
export function openImpersonationInCrm(targetUserId: string): void {
  const url = `${CRM_APP_URL}/dashboard?impersonate=${encodeURIComponent(targetUserId)}`
  window.open(url, '_blank', 'noopener,noreferrer')
}
