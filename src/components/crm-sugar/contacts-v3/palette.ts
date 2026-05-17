// MEGGA Contacts V3 — palette Sugar Pure (light + dark).
// Port 1:1 de `refonte-contacts-shared.jsx` (RC_LIGHT / RC_DARK).

export interface RcPalette {
  bgGradient: string
  pageBg: string
  card: string
  cardSubtle: string
  black: string
  blackHover: string
  ink: string
  inkInverse: string
  inkSoft: string
  muted: string
  ghost: string
  line: string
  shadowSm: string
  shadow: string
  shadowLg: string
  ok: string
  warn: string
  accentTint: string
  toneBuyer: string
  toneSeller: string
  toneTenant: string
}

export const RC_LIGHT: RcPalette = {
  bgGradient:
    'radial-gradient(ellipse 120% 80% at 50% 100%, #C8D5E0 0%, #E2E5EB 50%, #EDEFF3 100%)',
  pageBg: '#EDEFF3',
  card: '#FFFFFF',
  cardSubtle: '#F7F8FA',
  black: '#0B0C0E',
  blackHover: '#1F2024',
  ink: '#0B0C0E',
  inkInverse: '#FFFFFF',
  inkSoft: '#3A3D44',
  muted: '#7A8088',
  ghost: '#B5BAC2',
  line: 'rgba(15,23,42,0.06)',
  shadowSm: '0 4px 16px rgba(15,23,42,0.04)',
  shadow:
    '0 12px 40px rgba(15,23,42,0.06), 0 2px 8px rgba(15,23,42,0.03)',
  shadowLg:
    '0 24px 60px rgba(15,23,42,0.08), 0 4px 16px rgba(15,23,42,0.04)',
  ok: '#10B981',
  warn: '#F59E0B',
  accentTint: 'rgba(255,255,255,0.18)',
  toneBuyer: '#1E5BC6',
  toneSeller: '#C45A00',
  toneTenant: '#0891B2',
}

export const RC_DARK: RcPalette = {
  // Fond plat (pas de gradient) — moins de bruit, ancrage plus posé
  bgGradient: '#0E1014',
  pageBg: '#0E1014',
  card: '#1A1C22',
  cardSubtle: '#14171E',
  black: '#F5F6F8',
  blackHover: '#E6E8EC',
  ink: '#FFFFFF',
  inkInverse: '#0B0C0E',
  inkSoft: '#C8CCD2',
  muted: '#7E828A',
  ghost: '#4A4D54',
  line: 'rgba(255,255,255,0.06)',
  shadowSm: '0 4px 16px rgba(0,0,0,0.22)',
  shadow: '0 12px 36px rgba(0,0,0,0.30), 0 2px 8px rgba(0,0,0,0.18)',
  shadowLg: '0 24px 56px rgba(0,0,0,0.38), 0 4px 16px rgba(0,0,0,0.22)',
  ok: '#34D399',
  warn: '#FBBF24',
  accentTint: 'rgba(0,0,0,0.14)',
  toneBuyer: '#3B82F6',
  toneSeller: '#F97316',
  toneTenant: '#22D3EE',
}

export function rcPalette(dark: boolean): RcPalette {
  return dark ? RC_DARK : RC_LIGHT
}

// ─── Pill premium (CRM_PILL) ─────────────────────────────────────────────
// Pattern unifié : fond solide foncé + texte blanc + ombre douce + inset light.
// Source de vérité partagée avec `refs/HANDOFF_PILLS_PREMIUM.md`.
export type RcPillTone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral'

export const RC_PILL: Record<
  RcPillTone,
  { bg: string; fg: string; shadow: string; dot: string }
> = {
  ok: {
    bg: '#15643F',
    fg: '#FFFFFF',
    shadow:
      '0 1px 2px rgba(21,100,63,0.30), inset 0 -1px 0 rgba(0,0,0,0.10)',
    dot: '#7CD8A6',
  },
  warn: {
    bg: '#A0521E',
    fg: '#FFFFFF',
    shadow:
      '0 1px 2px rgba(160,82,30,0.30), inset 0 -1px 0 rgba(0,0,0,0.10)',
    dot: '#F5C58A',
  },
  danger: {
    bg: '#8E1F3D',
    fg: '#FFFFFF',
    shadow:
      '0 1px 2px rgba(142,31,61,0.30), inset 0 -1px 0 rgba(0,0,0,0.10)',
    dot: '#F0A1B5',
  },
  info: {
    bg: '#1B4A8E',
    fg: '#FFFFFF',
    shadow:
      '0 1px 2px rgba(27,74,142,0.30), inset 0 -1px 0 rgba(0,0,0,0.10)',
    dot: '#A3C1EE',
  },
  neutral: {
    bg: '#202127',
    fg: '#FFFFFF',
    shadow:
      '0 1px 2px rgba(32,33,39,0.30), inset 0 -1px 0 rgba(0,0,0,0.10)',
    dot: '#9CA0AC',
  },
}
