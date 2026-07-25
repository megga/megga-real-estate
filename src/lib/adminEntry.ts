/**
 * Adresses des deux applications MEGGA, et porte d'entrée vers la console.
 *
 * Le back-office vit sur SA PROPRE origine (admin.megga.ch, projet Cloudflare
 * Pages `megga-admin`, build `npm run build:admin`) : son bundle n'est pas servi
 * aux agents, et une faille XSS dans le CRM ne donne pas la main sur la console.
 * Toutes les surfaces qui traversent la frontière — bouton du dropdown profil,
 * recherche ⌘K, retour console → CRM, passage d'impersonation — passent par ici.
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

/**
 * Ouvre la console admin. Origine dédiée → nouvel onglet (`noopener` : la page
 * ouverte ne garde aucune référence sur le CRM), sinon navigation React Router.
 */
export function openAdminConsole(navigate: (to: string) => void): void {
  if (ADMIN_IS_EXTERNAL) {
    window.open(ADMIN_ENTRY_URL, '_blank', 'noopener,noreferrer')
    return
  }
  navigate(ADMIN_ENTRY_URL)
}

/**
 * Ouvre le CRM en vue impersonée depuis la console.
 *
 * Les deux applications ne partagent NI localStorage NI cookies (c'est tout
 * l'intérêt de la séparation d'origine) : la console ne peut donc pas armer
 * elle-même la vue impersonée du CRM. Elle passe l'id cible en paramètre, et
 * c'est le CRM qui journalise (RPC `admin_log_impersonation`, gardée
 * `is_super_admin`) avant d'activer quoi que ce soit. Un id dans une URL ne
 * donne aucun droit : c'est la RPC qui décide.
 */
export function openImpersonationInCrm(targetUserId: string): void {
  const url = `${CRM_APP_URL}/dashboard?impersonate=${encodeURIComponent(targetUserId)}`
  window.open(url, '_blank', 'noopener,noreferrer')
}
