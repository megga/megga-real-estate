/**
 * Aller-retour OAuth de connexion d'agenda (Google / Outlook) — logique pure,
 * partagée par `useGoogleCalendar` / `useOutlookCalendar` (départ) et
 * `AuthCallbackPage` (retour). Isolée ici pour être testable : les hooks ne
 * gardent que l'appel réseau.
 */

/** Providers d'agenda tels que Supabase Auth les nomme (Outlook = `azure`). */
export type CalendarAuthProvider = 'google' | 'azure'

/** Écran d'où part la connexion ; sert à y ramener l'agent au retour. */
export type CalendarConnectOrigin = 'calendar'

/** Marqueur de flux porté par l'URL de callback, par provider. */
const FLOW_FLAG: Record<CalendarAuthProvider, string> = {
  google: 'gcal',
  azure: 'outlook',
}

// Écrans autorisés comme retour d'une connexion d'agenda. Table FERMÉE : le
// paramètre est lu dans l'URL de callback, donc une destination libre en ferait
// une redirection ouverte.
const RETURN_PATHS: Record<string, string> = {
  calendar: '/dashboard/calendar',
}

/**
 * URL de retour passée au provider OAuth. `from` n'est ajouté que pour une
 * origine connue : un handler passé en référence (`onClick={connect}`) reçoit
 * un MouseEvent, dont `from` est absent — le défaut est alors conservé.
 */
export function calendarRedirectTo(
  origin: string,
  provider: CalendarAuthProvider,
  from?: CalendarConnectOrigin,
): string {
  const suffix = from && RETURN_PATHS[from] ? `&from=${from}` : ''
  return `${origin}/auth/callback?${FLOW_FLAG[provider]}=1${suffix}`
}

/**
 * Choisit la méthode d'authentification pour connecter un agenda.
 *
 * `reauth` (`signInWithOAuth`) ré-authentifie la session ENTIÈRE : sur un compte
 * dont l'adresse du provider diffère de l'e-mail CRM, Supabase n'a aucune
 * identité à lier automatiquement et bascule l'agent sur un autre compte. On ne
 * l'utilise donc que si l'identité est DÉJÀ celle du compte courant — cas où
 * `link` échouerait (identité déjà prise) et où aucune bascule n'est possible
 * puisqu'il s'agit du même compte. Partout ailleurs : `link`.
 */
export function calendarAuthMethod(
  provider: CalendarAuthProvider,
  identities: readonly { provider: string }[] | null | undefined,
): 'link' | 'reauth' {
  return identities?.some(i => i.provider === provider) ? 'reauth' : 'link'
}

/** Retour post-OAuth : l'écran d'origine s'il est connu, sinon `fallback`. */
export function calendarReturnPath(params: URLSearchParams, fallback: string): string {
  const from = params.get('from')
  return (from && RETURN_PATHS[from]) || fallback
}
