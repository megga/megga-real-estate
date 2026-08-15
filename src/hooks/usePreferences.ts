/**
 * Application des préférences d'apparence aux variables CSS de `:root`.
 *
 * ⚠ Ce module portait aussi le hook `usePreferences` (lecture/écriture
 * localStorage + `profiles.preferences`). Il est parti avec la coquille legacy
 * `AgentLayout`, seule à le consommer : les surfaces Sugar tiennent leur
 * apparence de `tokens.ts`, pas de préférences par agent. Il ne reste donc que
 * l'application au DOM, encore utilisée par `useTheme`.
 *
 * ⛔ ET IL RÉÉCRIVAIT L'ACCENT, CE QUI ANNULAIT LA DIRECTION AU RENDU (retiré le
 * 15 août 2026). Sept `setProperty` posaient la rampe d'un preset en style EN
 * LIGNE sur `<html>` — et un style en ligne bat la feuille. `globals.css`
 * déclarait `#424bfb`, `bg-accent` sortait en `#3461D1` (preset « sapphire »),
 * pendant que `bg-accent-solid`, non réécrit, restait `#424bfb` : deux bleus à
 * 1,04:1 sur la même page. Aucune spec ne pouvait le voir — les six clauses
 * d'`accent-ramp.spec.ts` lisent la FEUILLE, et les dix specs de contraste ne
 * regardent que l'AA, que le sapphire passe (5,56:1 et 6,38:1). Le défaut était
 * d'IDENTITÉ, pas de lisibilité.
 *
 * ⚠ POURQUOI LE RETRAIT PLUTÔT QU'UN PRESET RÉALIGNÉ — la raison est
 * structurelle, pas cosmétique. Un preset porte UNE valeur par thème ; la
 * direction porte DEUX RÔLES (l'aplat `#424bfb` dans les deux thèmes, l'encre
 * `#8dc1ff` en sombre, parce que l'accent rend 2,95:1 sur la page sombre et
 * ferait tomber l'anneau de focus avec lui). Donner les bonnes valeurs au preset
 * aurait corrigé le clair et cassé le sombre. S'ajoute qu'aucun ÉCRIVAIN de
 * préférences n'existe depuis le retrait d'`AgentLayout` : le preset ne pouvait
 * être que son défaut. L'accent est une décision de DIRECTION (`CLAUDE.md` §3 :
 * « il n'y a plus de choix »), et la feuille la porte déjà entière.
 *
 * Gardé par la clause « aucun code ne réécrit la rampe d'accent au RENDU »
 * (`tests/unit/accent-ramp.spec.ts`), qui balaye tout `src/` — le geste, pas ce
 * fichier.
 *
 * ⚠ CE QUI RESTE EST DE L'ERGONOMIE, PAS DE LA DIRECTION : densité, corps de
 * texte et style de rail sont des réglages de CONFORT, sans opinion sur la
 * couleur. Ils restent posés ici.
 */
import {
  BORDER_RADIUS_PRESETS,
  type DashboardPreferences,
  type BorderRadiusTheme,
  type DensityLevel,
  type SidebarStyle,
  type FontSizeLevel,
} from '@/lib/accentPresets'

/* ─── Apply preferences to CSS variables (batched DOM writes) ─── */

/**
 * Applique les préférences de CONFORT aux variables CSS de `:root` (arrondis,
 * zoom densité×police, attributs `data-*`). Tous les writes DOM sont groupés
 * dans un seul `requestAnimationFrame` pour éviter les reflows multiples.
 *
 * ⛔ N'Y REMETTEZ PAS L'ACCENT. La rampe d'accent est tranchée par rôle dans
 * `globals.css` et un `setProperty` sur `<html>` la remplacerait en silence —
 * voir l'en-tête de ce fichier. Le thème n'est donc plus un paramètre : rien
 * ici ne dépend plus de lui.
 */
export function applyPreferences(prefs: DashboardPreferences) {
  const root = document.documentElement

  // Batch all style changes in a single rAF to avoid multiple reflows
  requestAnimationFrame(() => {
    // 1. Border radius
    const radius = BORDER_RADIUS_PRESETS[prefs.borderRadius] ?? BORDER_RADIUS_PRESETS.default
    root.style.setProperty('--radius-card', radius.card)
    root.style.setProperty('--radius-button', radius.button)
    root.style.setProperty('--radius-input', radius.input)
    root.style.setProperty('--radius-badge', radius.badge)

    // 2. Density + Font size → combined zoom
    const densityZoom: Record<string, number> = { compact: 0.92, comfortable: 1, spacious: 1.06 }
    const fontZoom: Record<string, number> = { small: 0.95, medium: 1, large: 1.04 }
    const dz = densityZoom[prefs.density] ?? 1
    const fz = fontZoom[prefs.fontSize] ?? 1
    root.style.setProperty('--content-zoom', String(dz * fz))

    // 3. Data attributes (batched)
    root.setAttribute('data-density', prefs.density)
    root.setAttribute('data-font-size', prefs.fontSize)
    root.setAttribute('data-sidebar-style', prefs.sidebarStyle)
  })
}

/* ─── Hook ─── */

// Re-export types for convenience
export type { BorderRadiusTheme, DensityLevel, SidebarStyle, FontSizeLevel, DashboardPreferences }
