// MEGGA Premier jour — Tokens Sugar Pure
// Réutilise obPalette de l'onboarding (même grammaire visuelle), ajoute le CSS
// spécifique au Day 0 (animations IA badge, slide horizontal, check pop,
// ghost pulse pour les aperçus "vides").
//
// Source : handoff-premier-jour/premier-jour/crm-day0-tokens.jsx → D0_CSS

export { OB_LIGHT, OB_DARK, obPalette, OB_GLOBAL_CSS } from '@/components/onboarding-sugar/tokens'
export type { ObTheme } from '@/components/onboarding-sugar/tokens'

export const D0_CSS = `
  @keyframes d0AiPulse {
    0%   { box-shadow: 0 0 0 0 rgba(11,12,14,0.30); }
    70%  { box-shadow: 0 0 0 12px rgba(11,12,14,0); }
    100% { box-shadow: 0 0 0 0 rgba(11,12,14,0); }
  }
  @keyframes d0SlideIn {
    from { opacity: 0; transform: translateX(20px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes d0SlideUp {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes d0FadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes d0CheckPop {
    0%   { transform: scale(0); opacity: 0; }
    60%  { transform: scale(1.12); opacity: 1; }
    100% { transform: scale(1); opacity: 1; }
  }
  @keyframes d0GhostPulse {
    0%, 100% { opacity: 0.55; }
    50%      { opacity: 0.78; }
  }
`
