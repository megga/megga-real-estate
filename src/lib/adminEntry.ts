/**
 * Adresse de la console super-admin dans le CRM.
 *
 * Une seule application, une seule origine : la console est une SURFACE du CRM.
 * L'application autonome `admin.megga.ch`, son écran d'accès et son passage de
 * session par fragment d'URL ont été retirés en juillet 2026.
 */

/**
 * Route de la console.
 *
 * On y entre par le routeur, sans onglet ni transfert de session : l'URL est
 * rechargeable, partageable et mémorisable.
 *
 * ⚠️ Toute cible de navigation de la console DOIT être préfixée par cette
 * constante. Les routes ont vécu à la racine (`/agencies/:id`, `/users`) le
 * temps de l'isolation, et une cible restée nue ne lève aucune erreur : elle
 * tombe sur le 404 du CRM, voire sur une route publique — `/agencies` est une
 * redirection marketplace, qui éjecte hors de l'application. Garde-fou :
 * `tests/unit/admin-console-paths.spec.ts`.
 */
export const ADMIN_CONSOLE_PATH = '/dashboard/admin'

/**
 * Ouvre le CRM en vue impersonée, dans un nouvel onglet.
 *
 * L'onglet séparé est délibéré : la console reste ouverte à côté, on garde sa
 * place dans la liste d'utilisateurs pendant qu'on regarde ce que voit la
 * personne.
 *
 * L'URL est RELATIVE. Elle a longtemps visé un hôte en dur, du temps où la
 * console vivait sur une autre origine et ne pouvait pas armer elle-même la vue
 * du CRM ; depuis la refusion, ce même code ouvrait la PRODUCTION depuis un
 * poste de développement.
 *
 * L'identifiant ne donne aucun droit par lui-même : côté CRM,
 * `ImpersonationHandoff` n'active la vue qu'une fois l'audit écrit (RPC
 * `admin_log_impersonation`, gardée `is_super_admin`).
 */
export function openImpersonation(targetUserId: string): void {
  const url = `/dashboard?impersonate=${encodeURIComponent(targetUserId)}`
  window.open(url, '_blank', 'noopener,noreferrer')
}
