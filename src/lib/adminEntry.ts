/**
 * Adresses des surfaces MEGGA.
 *
 * La console est une SURFACE DU CRM (`ADMIN_CONSOLE_PATH`) depuis juillet 2026.
 * L'application autonome `admin.megga.ch` et tout son passage de session par
 * fragment ont été retirés : il n'y a plus qu'une origine, donc plus rien à se
 * transmettre.
 *
 * `VITE_APP_URL` permet de viser un CRM local en dev.
 */

/**
 * Route de la console DANS le CRM.
 *
 * Depuis juillet 2026 la console est une surface du CRM et non plus une
 * application à part : on y va par le routeur, sans onglet ni passage de
 * session. L'URL redevient rechargeable, partageable et mémorisable — ce que le
 * passage par fragment interdisait par construction.
 *
 * Le passage de session ci-dessous ne sert plus qu'à l'app autonome, en sursis.
 */
export const ADMIN_CONSOLE_PATH = '/dashboard/admin'

/** Origine du CRM agent (retour depuis la console, passage d'impersonation). */
export const CRM_APP_URL =
  (import.meta.env.VITE_APP_URL as string | undefined)?.trim() || 'https://app.megga.ch'

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
