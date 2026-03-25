/* ─── Dashboard Preferences Types ─── */

export type AccentColor = 'sapphire' | 'graphite' | 'burgundy' | 'forest' | 'ocean' | 'mauve' | 'bronze' | 'custom'
export type BorderRadiusTheme = 'sharp' | 'default' | 'pill'
export type DensityLevel = 'compact' | 'comfortable' | 'spacious'
export type SidebarStyle = 'default' | 'colored' | 'minimal'
export type FontSizeLevel = 'small' | 'medium' | 'large'

export interface DashboardPreferences {
  accentColor: AccentColor
  customAccentHex?: string  // hex color for custom preset
  borderRadius: BorderRadiusTheme
  density: DensityLevel
  sidebarStyle: SidebarStyle
  fontSize: FontSizeLevel
}

export const DEFAULT_PREFERENCES: DashboardPreferences = {
  accentColor: 'sapphire',
  borderRadius: 'default',
  density: 'comfortable',
  sidebarStyle: 'default',
  fontSize: 'medium',
}

/* ─── Accent Color Presets ─── */

interface AccentVariants {
  DEFAULT: string
  hover: string
  light: string
  dark: string
}

export interface AccentPreset {
  label: string
  hex: string          // display color (light mode)
  hexDark: string      // display color (dark mode)
  light: AccentVariants
  dark: AccentVariants
  fg: string           // foreground on accent bg
}

export const ACCENT_PRESETS: Record<Exclude<AccentColor, 'custom'>, AccentPreset> = {
  sapphire: {
    label: 'Sapphire',
    hex: '#3461D1',
    hexDark: '#5B8DEF',
    light: { DEFAULT: '52 97 209', hover: '41 78 178', light: '237 242 253', dark: '32 62 140' },
    dark: { DEFAULT: '91 141 239', hover: '130 170 247', light: '18 30 66', dark: '52 97 209' },
    fg: '255 255 255',
  },
  graphite: {
    label: 'Graphite',
    hex: '#4A4A55',
    hexDark: '#8B8B99',
    light: { DEFAULT: '74 74 85', hover: '55 55 65', light: '244 244 246', dark: '40 40 48' },
    dark: { DEFAULT: '139 139 153', hover: '170 170 182', light: '28 28 34', dark: '74 74 85' },
    fg: '255 255 255',
  },
  burgundy: {
    label: 'Burgundy',
    hex: '#8B2252',
    hexDark: '#C44B7A',
    light: { DEFAULT: '139 34 82', hover: '115 24 66', light: '251 238 244', dark: '92 18 54' },
    dark: { DEFAULT: '196 75 122', hover: '218 120 156', light: '52 12 30', dark: '139 34 82' },
    fg: '255 255 255',
  },
  forest: {
    label: 'Forest',
    hex: '#2D6A4F',
    hexDark: '#52B788',
    light: { DEFAULT: '45 106 79', hover: '34 87 63', light: '235 249 242', dark: '27 72 52' },
    dark: { DEFAULT: '82 183 136', hover: '116 206 163', light: '10 40 28', dark: '45 106 79' },
    fg: '255 255 255',
  },
  ocean: {
    label: 'Ocean',
    hex: '#1B6B8A',
    hexDark: '#3BA5CC',
    light: { DEFAULT: '27 107 138', hover: '20 86 113', light: '234 247 252', dark: '15 70 92' },
    dark: { DEFAULT: '59 165 204', hover: '100 190 218', light: '8 36 50', dark: '27 107 138' },
    fg: '255 255 255',
  },
  mauve: {
    label: 'Mauve',
    hex: '#6B4C8A',
    hexDark: '#9B7BBF',
    light: { DEFAULT: '107 76 138', hover: '88 60 116', light: '245 240 251', dark: '70 46 96' },
    dark: { DEFAULT: '155 123 191', hover: '181 158 210', light: '32 20 48', dark: '107 76 138' },
    fg: '255 255 255',
  },
  bronze: {
    label: 'Bronze',
    hex: '#8B6F47',
    hexDark: '#C4A06E',
    light: { DEFAULT: '139 111 71', hover: '116 90 54', light: '250 246 238', dark: '92 72 42' },
    dark: { DEFAULT: '196 160 110', hover: '216 186 144', light: '40 32 18', dark: '139 111 71' },
    fg: '255 255 255',
  },
}

/* ─── Custom color helpers ─── */

/** Convert hex to RGB string "R G B" */
export function hexToRgbString(hex: string): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16)
  const g = parseInt(clean.substring(2, 4), 16)
  const b = parseInt(clean.substring(4, 6), 16)
  if (isNaN(r) || isNaN(g) || isNaN(b)) return '52 97 209' // fallback sapphire
  return `${r} ${g} ${b}`
}

/** Darken a hex color by percentage (0-1) */
function adjustBrightness(hex: string, amount: number): string {
  const clean = hex.replace('#', '')
  let r = parseInt(clean.substring(0, 2), 16)
  let g = parseInt(clean.substring(2, 4), 16)
  let b = parseInt(clean.substring(4, 6), 16)
  if (amount < 0) {
    // darken
    r = Math.max(0, Math.round(r * (1 + amount)))
    g = Math.max(0, Math.round(g * (1 + amount)))
    b = Math.max(0, Math.round(b * (1 + amount)))
  } else {
    // lighten
    r = Math.min(255, Math.round(r + (255 - r) * amount))
    g = Math.min(255, Math.round(g + (255 - g) * amount))
    b = Math.min(255, Math.round(b + (255 - b) * amount))
  }
  return `${r} ${g} ${b}`
}

/** Generate a full AccentPreset from a single hex color */
export function generatePresetFromHex(hex: string): AccentPreset {
  const rgb = hexToRgbString(hex)
  return {
    label: 'Custom',
    hex,
    hexDark: hex,
    light: {
      DEFAULT: rgb,
      hover: adjustBrightness(hex, -0.18),
      light: adjustBrightness(hex, 0.92),
      dark: adjustBrightness(hex, -0.35),
    },
    dark: {
      DEFAULT: adjustBrightness(hex, 0.25),
      hover: adjustBrightness(hex, 0.45),
      light: adjustBrightness(hex, -0.82),
      dark: rgb,
    },
    fg: '255 255 255',
  }
}

/* ─── Border Radius Presets ─── */

export const BORDER_RADIUS_PRESETS: Record<BorderRadiusTheme, { card: string; button: string; input: string; badge: string }> = {
  sharp: { card: '4px', button: '4px', input: '4px', badge: '3px' },
  default: { card: '12px', button: '8px', input: '10px', badge: '6px' },
  pill: { card: '20px', button: '12px', input: '16px', badge: '10px' },
}

/* ─── Density Presets ─── */

export const DENSITY_PRESETS: Record<DensityLevel, { cardPadding: string; gap: string; fontSize: string }> = {
  compact: { cardPadding: '16px', gap: '12px', fontSize: '13px' },
  comfortable: { cardPadding: '20px', gap: '16px', fontSize: '14px' },
  spacious: { cardPadding: '24px', gap: '20px', fontSize: '15px' },
}

/* ─── Font Size Presets ─── */

export const FONT_SIZE_PRESETS: Record<FontSizeLevel, string> = {
  small: '13px',
  medium: '14px',
  large: '15px',
}
