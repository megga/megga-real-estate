/**
 * Adresse de la console super-admin dans le CRM.
 *
 * Une seule application, une seule origine : la console est une SURFACE du CRM.
 * L'application autonome `admin.megga.ch`, son écran d'accès et son passage de
 * session par fragment d'URL ont été retirés en juillet 2026.
 */

import { crmTabsEligible } from '@/lib/crmTabs'

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

// ─── Le va-et-vient CRM ↔ console ──────────────────────────────────────────
// Un super-admin passe d'une fiche du CRM à une fiche d'agence de la console,
// puis revient, plusieurs fois de suite. Chaque sens retrouve donc l'endroit
// qu'il a quitté : la console sa dernière page, le CRM son onglet actif. Sans
// ça, chaque aller-retour repartait d'un accueil — « Vue d'ensemble » d'un côté,
// « Aujourd'hui » de l'autre — et la barre latérale n'aurait fait gagner qu'un
// clic sur les deux qu'on perdait à chaque fois.

/**
 * ⚠ `sessionStorage`, jamais `localStorage` : la query d'une page de console
 * peut porter une recherche (un nom, un e-mail). Même règle que le miroir des
 * onglets du CRM (`megga.crm.tabs`), qui porte des noms de clients.
 */
const CLE_REPRISE_CONSOLE = 'megga.admin.reprise'

/**
 * Un emplacement de la console, et rien d'autre.
 *
 * ⚠ La borne est le SEGMENT, pas le préfixe : `startsWith(ADMIN_CONSOLE_PATH)`
 * accepterait `/dashboard/administration`. La valeur vient d'un stockage que le
 * navigateur laisse réécrire ; on ne navigue pas vers ce qu'on n'a pas reconnu.
 */
function estPageConsole(href: string): boolean {
  const chemin = href.split(/[?#]/)[0]
  return chemin === ADMIN_CONSOLE_PATH || chemin.startsWith(`${ADMIN_CONSOLE_PATH}/`)
}

/** Retient la page de console courante (`pathname + search`) pour y revenir. */
export function memoriserPageConsole(href: string): void {
  if (!estPageConsole(href)) return
  try {
    sessionStorage.setItem(CLE_REPRISE_CONSOLE, href)
  } catch {
    // Stockage refusé (navigation privée stricte) : la console rouvrira sur son
    // accueil, ce qui est le comportement d'avant — pas une panne.
  }
}

/**
 * Où rouvrir la console : la dernière page vue dans CET onglet de navigateur,
 * son accueil sinon. Lue au moment du clic, jamais au rendu : la barre latérale
 * ne se re-rend pas quand la console écrit.
 */
export function consoleAReprendre(): string {
  try {
    const lu = sessionStorage.getItem(CLE_REPRISE_CONSOLE)
    if (lu && estPageConsole(lu)) return lu
  } catch {
    // Même repli que l'écriture.
  }
  return ADMIN_CONSOLE_PATH
}

/**
 * Où « Retour au CRM » ramène : l'onglet actif, celui qu'on a quitté.
 *
 * La console n'ouvre pas d'onglet (`HORS_ONGLETS`), donc y entrer ne déplace pas
 * l'actif — il désigne encore l'écran d'où l'on vient. Y renaviguer le rouvre
 * sans rien réécrire : la réconciliation trouve un onglet déjà sur cette URL.
 *
 * Trois replis sur `/dashboard` :
 *   • pas d'onglet (hors fournisseur, pile vide) ;
 *   • téléphone — la pile n'y suit pas la navigation (le gel est coupé sous
 *     768 px), son actif peut donc être un écran de bureau d'une autre session ;
 *   • onglet inéligible — une pile d'avant le correctif d'hydratation a pu
 *     garder un chemin de console : y « revenir » ne quitterait pas la console.
 */
export function retourAuCrm(
  onglet: { path: string; search: string } | undefined,
  mobile: boolean,
): string {
  if (!onglet || mobile || !crmTabsEligible(onglet.path)) return '/dashboard'
  return `${onglet.path}${onglet.search}`
}

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
