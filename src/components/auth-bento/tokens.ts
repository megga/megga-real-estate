// MEGGA Auth — Bento tokens (Property X strict, light + dark Option A "Pure Ink")
// Source : handoff-auth/auth/megga-auth-bento.jsx → bentoTokens()

export type BentoTokens = {
  kind: 'propertyx'
  dark: boolean
  canvasBg: string
  cardBg: string
  cardRadius: number
  cardShadow: string
  cardBorder: string
  font: string
  titleColor: string
  bodyColor: string
  mutedColor: string
  inkColor: string
  ghostColor: string
  subtleBg: string
  ctaBg: string
  ctaBgHover: string
  ctaFg: string
  ctaCircleBg: string
  ctaCircleFg: string
  inputBorder: string
  logoInvert: boolean
  letterSpacing: string
  titleLetterSpacing: string
}

const PX_NEUTRAL = {
  n100: '#FFFFFF',
  n200: '#FAFAFB',
  n300: '#EEEFF1',
  n400: '#A4A6B0',
  n500: '#464851',
  n700: '#14161C',
} as const

const PX_FONT_SANS =
  '"Objectivity", "Plus Jakarta Sans", "DM Sans", sans-serif'

export function bentoTokens(dark: boolean): BentoTokens {
  if (dark) {
    return {
      kind: 'propertyx',
      dark: true,
      canvasBg: PX_NEUTRAL.n700,
      cardBg: '#1B1D24',
      cardRadius: 24,
      cardShadow:
        '0 24px 60px rgba(0, 0, 0, 0.45), 0 1px 0 rgba(255,255,255,0.04) inset',
      cardBorder: '1px solid #2A2D36',
      font: PX_FONT_SANS,
      titleColor: '#FFFFFF',
      bodyColor: PX_NEUTRAL.n400,
      mutedColor: '#6F727B',
      inkColor: '#FFFFFF',
      ghostColor: '#3A3D46',
      subtleBg: '#22252D',
      ctaBg: '#FFFFFF',
      ctaBgHover: '#EBECEF',
      ctaFg: PX_NEUTRAL.n700,
      ctaCircleBg: PX_NEUTRAL.n700,
      ctaCircleFg: '#FFFFFF',
      inputBorder: '#2A2D36',
      logoInvert: true,
      letterSpacing: '-0.03em',
      titleLetterSpacing: '-0.035em',
    }
  }
  return {
    kind: 'propertyx',
    dark: false,
    canvasBg: PX_NEUTRAL.n200,
    cardBg: PX_NEUTRAL.n100,
    cardRadius: 24,
    cardShadow:
      '0 12px 40px rgba(20, 22, 28, 0.06), 0 2px 8px rgba(20, 22, 28, 0.03)',
    cardBorder: `1px solid ${PX_NEUTRAL.n300}`,
    font: PX_FONT_SANS,
    titleColor: PX_NEUTRAL.n700,
    bodyColor: PX_NEUTRAL.n500,
    mutedColor: PX_NEUTRAL.n400,
    inkColor: PX_NEUTRAL.n700,
    ghostColor: PX_NEUTRAL.n400,
    subtleBg: PX_NEUTRAL.n200,
    ctaBg: PX_NEUTRAL.n700,
    ctaBgHover: '#0A0B0F',
    ctaFg: '#FFFFFF',
    ctaCircleBg: '#FFFFFF',
    ctaCircleFg: PX_NEUTRAL.n700,
    inputBorder: PX_NEUTRAL.n300,
    logoInvert: false,
    letterSpacing: '-0.03em',
    titleLetterSpacing: '-0.035em',
  }
}

export const ERROR_COLOR = '#B8412A'

/**
 * Transition unique pour TOUS les changements de thème (light ↔ dark).
 * Couvre background, color, border, shadow, filter. À composer avec les
 * transitions hover spécifiques (transform 0.18s, opacity 0.22s, etc.).
 *
 * Référence via `var(--bento-tx)` côté inline-style → permet à
 * `prefers-reduced-motion: reduce` de désactiver toutes les transitions
 * en surchargeant la variable à 'none' (inline-styles ne peuvent pas être
 * overridés par les media queries autrement).
 *
 * Timing 0.32s cubic-bezier(.22,1,.36,1) = compromis entre la canvas
 * (0.4s ease) et le hover (0.18s) → sensation cohérente.
 */
export const BENTO_THEME_TRANSITION =
  'background-color 0.32s cubic-bezier(.22,1,.36,1), background 0.32s cubic-bezier(.22,1,.36,1), color 0.32s cubic-bezier(.22,1,.36,1), border-color 0.32s cubic-bezier(.22,1,.36,1), box-shadow 0.32s cubic-bezier(.22,1,.36,1), filter 0.32s cubic-bezier(.22,1,.36,1)'

export const BENTO_GLOBAL_CSS = `
  :root {
    --bento-tx: ${BENTO_THEME_TRANSITION};
  }
  @media (prefers-reduced-motion: reduce) {
    :root {
      --bento-tx: none;
    }
  }
  @keyframes megga-auth-fade-up {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes megga-auth-shake {
    10%, 90%  { transform: translateX(-1px); }
    20%, 80%  { transform: translateX(2px); }
    30%, 50%, 70% { transform: translateX(-4px); }
    40%, 60%      { transform: translateX(4px); }
  }
  @keyframes megga-auth-spin {
    to { transform: rotate(360deg); }
  }
`
