/**
 * Adresses des applications MEGGA et vestiges du passage de session.
 *
 * ⚠️ ÉTAT (juillet 2026) : la console est une SURFACE DU CRM
 * (`ADMIN_CONSOLE_PATH`). Plus rien ne fabrique le passage par fragment — le
 * producteur `openAdminConsole` a été retiré avec les deux points d'entrée qui
 * l'appelaient. Conséquence à connaître : l'app autonome `admin.megga.ch` reste
 * DÉPLOYÉE mais n'a plus aucun moyen de recevoir une session. Ce n'est donc plus
 * un repli utilisable, seulement du code en sursis.
 *
 * `readHandoverFromHash` survit le temps du retrait de cette app :
 * `main.admin.tsx` lit encore le fragment, et son contrat est couvert par
 * `tests/unit/admin-entry-handover.spec.ts`. Le producteur est parti avec ses
 * appelants.
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

/** Noms des paramètres de passage, lus par `main.admin.tsx`. */
export const HANDOVER_ACCESS = 'at'
export const HANDOVER_REFRESH = 'rt'

/** Le minimum dont la console a besoin pour reprendre la session de l'appelant. */
export interface HandoverSession {
  access_token: string
  refresh_token: string
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
