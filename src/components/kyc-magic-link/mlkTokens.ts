// MEGGA — Jetons Sugar Pure du parcours client KYC Magic Link.
//
// Séparés de MlkPrimitives.tsx : un fichier qui exporte des composants ET des
// constantes casse le Fast Refresh de Vite (toute édition recharge la page au
// lieu de préserver l'état). Les jetons vivent donc à part.
//
// Autonomes : ne dépendent ni de SugarV3 ni du layout agent — ils servent
// UNIQUEMENT les écrans publics `/kyc/<token>`, consultés sans compte MEGGA.

// ─── Palette Sugar Pure (subset utilisé par les écrans clients) ───────────

export const MLK = {
  bg: '#EDEFF3',
  bgGradient:
    'radial-gradient(ellipse 120% 80% at 50% 100%, #C8D5E0 0%, #E2E5EB 50%, #EDEFF3 100%)',
  card: '#FFFFFF',
  cardSubtle: '#F7F8FA',
  black: '#0B0C0E',
  blackHover: '#1F2024',
  ink: '#0B0C0E',
  inkSoft: '#3A3D44',
  muted: '#7A8088',
  ghost: '#B5BAC2',
  shadowSm: '0 4px 16px rgba(15,23,42,0.04)',
  shadow: '0 12px 40px rgba(15,23,42,0.06), 0 2px 8px rgba(15,23,42,0.03)',
  shadowLg: '0 24px 60px rgba(15,23,42,0.08), 0 4px 16px rgba(15,23,42,0.04)',
  shadowHover: '0 32px 70px rgba(15,23,42,0.10), 0 6px 20px rgba(15,23,42,0.05)',
  font: 'Manrope, system-ui, sans-serif',
} as const
