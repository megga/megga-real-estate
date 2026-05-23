// MEGGA Onboarding — Tokens Sugar Pure (light + dark)
// Source : handoff-onboarding/onboarding/megga-onboarding-palette.jsx

export type ObTheme = {
  bg: string
  bgGradient: string
  card: string
  cardSubtle: string
  cardBorder: string
  black: string
  blackHover: string
  ink: string
  inkSoft: string
  muted: string
  ghost: string
  divider: string
  shadowSm: string
  shadow: string
  shadowLg: string
  shadowHov: string
  ok: string
  warn: string
  err: string
  blue: string
}

export const OB_LIGHT: ObTheme = {
  bg: '#EDEFF3',
  bgGradient:
    'radial-gradient(ellipse 120% 80% at 50% 100%, #C8D5E0 0%, #E2E5EB 50%, #EDEFF3 100%)',
  card: '#FFFFFF',
  cardSubtle: '#FAFAFB',
  cardBorder: 'rgba(11,12,14,0.08)',
  black: '#0B0C0E',
  blackHover: '#1F2024',
  ink: '#0B0C0E',
  inkSoft: '#3A3D44',
  muted: '#7A8088',
  ghost: '#B5BAC2',
  divider: 'rgba(11,12,14,0.06)',
  shadowSm: '0 4px 16px rgba(20,22,28,0.04)',
  shadow: '0 12px 40px rgba(20,22,28,0.06), 0 2px 8px rgba(20,22,28,0.03)',
  shadowLg: '0 24px 60px rgba(20,22,28,0.10), 0 4px 16px rgba(20,22,28,0.05)',
  shadowHov: '0 32px 70px rgba(20,22,28,0.12), 0 6px 20px rgba(20,22,28,0.05)',
  ok: '#059669',
  warn: '#C45A00',
  err: '#BE3434',
  blue: '#1E5BC6',
}

export const OB_DARK: ObTheme = {
  bg: '#0E0E14',
  bgGradient:
    'radial-gradient(ellipse 120% 80% at 50% 100%, #1F2030 0%, #161722 50%, #0E0E14 100%)',
  card: '#1B1D24',
  cardSubtle: '#22252D',
  cardBorder: '#2A2D36',
  black: '#ECEDF3',
  blackHover: '#FFFFFF',
  ink: '#ECEDF3',
  inkSoft: '#B5B7C4',
  muted: '#797D90',
  ghost: '#3F4252',
  divider: 'rgba(236,237,243,0.08)',
  shadowSm: '0 4px 16px rgba(0,0,0,0.30)',
  shadow: '0 24px 60px rgba(0,0,0,0.45), 0 1px 0 rgba(255,255,255,0.04) inset',
  shadowLg: '0 32px 80px rgba(0,0,0,0.55), 0 4px 16px rgba(0,0,0,0.30)',
  shadowHov: '0 40px 90px rgba(0,0,0,0.60), 0 6px 20px rgba(0,0,0,0.30)',
  ok: '#10B981',
  warn: '#F59E0B',
  err: '#EF4444',
  blue: '#5B8DF0',
}

export const obPalette = (dark?: boolean): ObTheme => (dark ? OB_DARK : OB_LIGHT)

export const OB_GLOBAL_CSS = `
  @keyframes obFadeUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes obFadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes obScaleIn {
    from { opacity: 0; transform: scale(.94); }
    to   { opacity: 1; transform: scale(1); }
  }
  @keyframes obPulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50%      { transform: scale(1.06); opacity: 0.85; }
  }
  @keyframes obSpin {
    to { transform: rotate(360deg); }
  }
  @keyframes obRingPulse {
    0%   { box-shadow: 0 0 0 0 rgba(11,12,14,0.18); }
    70%  { box-shadow: 0 0 0 14px rgba(11,12,14,0); }
    100% { box-shadow: 0 0 0 0 rgba(11,12,14,0); }
  }
  @keyframes obScanSlide {
    0%   { top: 0;    opacity: 0; }
    15%  {            opacity: 1; }
    85%  {            opacity: 1; }
    100% { top: 100%; opacity: 0; }
  }
  @keyframes obCaret {
    0%, 49%   { opacity: 1; }
    50%, 100% { opacity: 0; }
  }
`
