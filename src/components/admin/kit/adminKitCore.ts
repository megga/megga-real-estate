/**
 * Kit Sugar de la console admin — constantes, types et keyframes.
 *
 * Séparé de `adminKit.tsx` (composants) pour respecter
 * `react-refresh/only-export-components` : un fichier ne mélange pas exports
 * composants et non-composants. Même découpe que `pfKitCore.tsx` / `pfKit.tsx`
 * dans les Réglages du CRM.
 *
 * Rôle : figer les quatre rayons et les tons de pilule de la grammaire Sugar,
 * pour que les 17 pages arrêtent de choisir chacune les leurs (l'audit en
 * relevait cinq rayons différents sur 337 occurrences).
 */

/**
 * Les SEULS rayons de la console.
 *
 * `frame` 26 vient du pager Sugar (`KycPagerFrame`, `BiensPager`,
 * `SettingsSugarV2Page`) ; `card` 18 et `row` 14 de la grammaire des Réglages ;
 * `pill` 999 des pilules de statut. Toute autre valeur est un écart.
 */
export const ADMIN_RADII = {
  frame: 26,
  card: 18,
  row: 14,
  pill: 999,
} as const

/** Largeur du rail de navigation, dans le cadre (les Réglages utilisent 300). */
export const ADMIN_RAIL_WIDTH = 300

/**
 * Tons de pilule disponibles.
 *
 * `neutral` = pas de signal (brouillon, valeur absente). `accent` = le violet
 * de la plateforme, réservé au repère « tu es dans la console », jamais à un
 * statut métier.
 */
export type AdminToneName = 'ok' | 'warn' | 'err' | 'info' | 'cyan' | 'neutral' | 'accent'

/** Taille d'icône par défaut du kit — les Réglages dessinent à 17 px, stroke 1.7. */
export const ADMIN_ICON_SIZE = 17
export const ADMIN_ICON_STROKE = 1.7

/**
 * Keyframes de la console.
 *
 * `admFadeUp` est le pendant de `setFadeUp` des Réglages (l'entrée du bento à
 * chaque changement de page). Injectées une fois par le shell.
 *
 * ⚠ La dernière étape vaut `transform: none`, PAS `translateY(0)` : l'animation
 * tourne en `fill-mode: both`, donc sa valeur finale reste appliquée. Or un
 * `transform`, même identité, fait de l'élément le bloc conteneur de ses
 * descendants `position: fixed` — les voiles « clic dehors » des menus
 * (`position: fixed; inset: 0`) se retrouvaient dimensionnés sur la page au
 * lieu du viewport. `none` n'établit pas de bloc conteneur.
 */
export const ADMIN_KEYFRAMES = `
@keyframes admFadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
@keyframes admFadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes admPulse { 0%, 100% { opacity: 1; } 50% { opacity: .45; } }
@media (prefers-reduced-motion: reduce) {
  .adm-fade-up { animation: none !important; }
}
`
