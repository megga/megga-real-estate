/**
 * Préférences de CONFORT du dashboard agent — rayon, densité, corps de texte,
 * style de rail. Consommé par `applyPreferences` (`hooks/usePreferences.ts`).
 *
 * ⛔ LE VERSANT « ACCENT » A ÉTÉ RETIRÉ (15 août 2026), et pas parce qu'il ne
 * servait plus : parce qu'il ANNULAIT la direction. Ce module portait sept
 * presets d'accent (`ACCENT_PRESETS`) et un générateur « custom »
 * (`generatePresetFromHex`) dont `applyPreferences` posait la rampe en style EN
 * LIGNE sur `<html>` — donc au-dessus de `globals.css`. Le CRM rendait le bleu
 * du preset « sapphire » (#3461D1) pendant que la feuille déclarait #424bfb.
 *
 * ⚠ ET IL NE POUVAIT PAS ÊTRE SIMPLEMENT RÉALIGNÉ. Un preset porte UNE valeur
 * par thème ; la direction porte DEUX RÔLES — l'aplat #424bfb dans les deux
 * thèmes, l'encre #8dc1ff en sombre. La forme même de `AccentPreset` ne sait pas
 * exprimer cette scission. S'ajoute qu'aucun ÉCRIVAIN de préférences n'existait
 * depuis le retrait d'`AgentLayout` : les sept presets étaient inatteignables et
 * seul le défaut s'appliquait.
 *
 * Sont partis avec lui, tous sans lecteur une fois la rampe retirée :
 * `AccentColor`, `AccentPreset`, `AccentVariants`, `ACCENT_PRESETS`,
 * `hexToRgbString`, `adjustBrightness`, `generatePresetFromHex`, et les champs
 * `accentColor` / `customAccentHex` de `DashboardPreferences`.
 *
 * ⚠ LE NOM DU FICHIER SURVIT À CE QU'IL SERVAIT — il ne contient plus aucun
 * preset d'accent. Le renommer est un geste lexical à part, comme
 * `crmPalette` (`CLAUDE.md` §3).
 */

/* ─── Dashboard Preferences Types ─── */

export type BorderRadiusTheme = 'sharp' | 'default' | 'pill'
export type DensityLevel = 'compact' | 'comfortable' | 'spacious'
export type SidebarStyle = 'default' | 'colored' | 'minimal'
export type FontSizeLevel = 'small' | 'medium' | 'large'

export interface DashboardPreferences {
  borderRadius: BorderRadiusTheme
  density: DensityLevel
  sidebarStyle: SidebarStyle
  fontSize: FontSizeLevel
}

export const DEFAULT_PREFERENCES: DashboardPreferences = {
  borderRadius: 'default',
  density: 'comfortable',
  sidebarStyle: 'default',
  fontSize: 'medium',
}

/* ─── Border Radius Presets ─── */

export const BORDER_RADIUS_PRESETS: Record<BorderRadiusTheme, { card: string; button: string; input: string; badge: string }> = {
  sharp: { card: '4px', button: '4px', input: '4px', badge: '3px' },
  default: { card: '12px', button: '8px', input: '10px', badge: '6px' },
  pill: { card: '20px', button: '12px', input: '16px', badge: '10px' },
}

/* ─── Density Presets ─── */
/* ─── Font Size Presets ─── */
