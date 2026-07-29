/**
 * Application des préférences d'apparence aux variables CSS de `:root`.
 *
 * ⚠ Ce module portait aussi le hook `usePreferences` (lecture/écriture
 * localStorage + `profiles.preferences`). Il est parti avec la coquille legacy
 * `AgentLayout`, seule à le consommer : les surfaces Sugar tiennent leur
 * apparence de `tokens.ts`, pas de préférences par agent. Il ne reste donc que
 * l'application au DOM, encore utilisée par `useTheme`.
 */
import {
  ACCENT_PRESETS,
  BORDER_RADIUS_PRESETS,
  generatePresetFromHex,
  type DashboardPreferences,
  type AccentColor,
  type BorderRadiusTheme,
  type DensityLevel,
  type SidebarStyle,
  type FontSizeLevel,
} from '@/lib/accentPresets'

/* ─── Memoized preset cache for custom colors ─── */

const customPresetCache = new Map<string, ReturnType<typeof generatePresetFromHex>>()

/** Preset d'accent effectif : `custom` → généré depuis le hex (mémoïsé, cache borné à 20), sinon preset nommé (repli `sapphire`). */
function resolveAccentPreset(prefs: DashboardPreferences) {
  if (prefs.accentColor === 'custom' && prefs.customAccentHex) {
    const hex = prefs.customAccentHex
    let cached = customPresetCache.get(hex)
    if (!cached) {
      cached = generatePresetFromHex(hex)
      customPresetCache.set(hex, cached)
      // Keep cache small
      if (customPresetCache.size > 20) {
        const first = customPresetCache.keys().next().value
        if (first) customPresetCache.delete(first)
      }
    }
    return cached
  }
  return ACCENT_PRESETS[prefs.accentColor as Exclude<AccentColor, 'custom'>] ?? ACCENT_PRESETS.sapphire
}

/* ─── Cached localStorage read (avoid repeated JSON.parse) ─── */

/* ─── Apply preferences to CSS variables (batched DOM writes) ─── */

/**
 * Applique les préférences aux variables CSS de `:root` (accent, arrondis,
 * zoom densité×police, attributs `data-*`). Tous les writes DOM sont groupés
 * dans un seul `requestAnimationFrame` pour éviter les reflows multiples.
 */
export function applyPreferences(prefs: DashboardPreferences, theme: 'light' | 'dark') {
  const root = document.documentElement

  // Batch all style changes in a single rAF to avoid multiple reflows
  requestAnimationFrame(() => {
    // 1. Accent color
    const preset = resolveAccentPreset(prefs)
    const colors = theme === 'dark' ? preset.dark : preset.light
    root.style.setProperty('--color-accent', colors.DEFAULT)
    root.style.setProperty('--color-accent-hover', colors.hover)
    root.style.setProperty('--color-accent-light', colors.light)
    root.style.setProperty('--color-accent-dark', colors.dark)
    root.style.setProperty('--color-accent-fg', preset.fg)
    root.style.setProperty('--color-border-focus', colors.DEFAULT)
    root.style.setProperty('--color-ring', colors.DEFAULT)

    // 2. Border radius
    const radius = BORDER_RADIUS_PRESETS[prefs.borderRadius] ?? BORDER_RADIUS_PRESETS.default
    root.style.setProperty('--radius-card', radius.card)
    root.style.setProperty('--radius-button', radius.button)
    root.style.setProperty('--radius-input', radius.input)
    root.style.setProperty('--radius-badge', radius.badge)

    // 3. Density + Font size → combined zoom
    const densityZoom: Record<string, number> = { compact: 0.92, comfortable: 1, spacious: 1.06 }
    const fontZoom: Record<string, number> = { small: 0.95, medium: 1, large: 1.04 }
    const dz = densityZoom[prefs.density] ?? 1
    const fz = fontZoom[prefs.fontSize] ?? 1
    root.style.setProperty('--content-zoom', String(dz * fz))

    // 4. Data attributes (batched)
    root.setAttribute('data-density', prefs.density)
    root.setAttribute('data-font-size', prefs.fontSize)
    root.setAttribute('data-sidebar-style', prefs.sidebarStyle)
  })
}

/* ─── Hook ─── */

// Re-export types for convenience
export type { AccentColor, BorderRadiusTheme, DensityLevel, SidebarStyle, FontSizeLevel, DashboardPreferences }
