// MEGGA CRM Sugar v3 — Palette KYC dynamique (clair ↔ sombre)
// Port propre du pattern `buildKycPalette` du handoff Claude Design
// (crm-screen-kyc-sugar.jsx §Palette KYC dynamique, juin 2026).
//
// Le prototype réassignait un `let KycSP` de module au début de chaque render.
// Ici on rend la même idée idiomatique React : un Context fournit la palette
// courante, les composants Kyc* lisent `useKycPalette()`. Hors provider, la
// valeur par défaut `KYC_LIGHT` s'applique → aucun composant ne casse.
//
// Clés sémantiques (handoff §3) :
//   card / cardSubtle  → surfaces. Clair : blanc plein. Sombre : verre
//                        translucide + bord blanc subtil `cardBorder`.
//   cardBorder         → contour des bento. Clair : transparent (ombres only).
//                        Sombre : rgba(255,255,255,.12) = le « tour blanc ».
//   black / blackHover → accent CTA. Clair : noir pur. Sombre : encre claire
//                        (pilule claire) pour rester lisible.
//   onAccent           → texte / icône POSÉ sur l'accent (inverse de `black`).
//   ringTrack          → piste de l'anneau de progression.

import { createContext, useContext } from 'react'
import type { CrmTheme, SugarPalette } from '@/components/crm-sugar/tokens'

export interface KycPalette {
  // Fond
  bg: string
  bgGradient: string
  // Surfaces
  card: string
  cardSubtle: string
  cardBorder: string
  // Accent CTA (flip en sombre)
  black: string
  blackHover: string
  onAccent: string
  // Texte
  ink: string
  inkSoft: string
  muted: string
  ghost: string
  // Anneau / jauge
  ringTrack: string
  // Ombres
  shadowSm: string
  shadow: string
  shadowLg: string
  shadowHover: string
  // États (tons vifs constants — sémantique reconnaissable dans les 2 thèmes)
  ok: string
  warn: string
  err: string
  // États « soft » (bg + texte) — adaptés au thème pour les encarts d'alerte
  okSoft: string
  warnSoft: string
  errSoft: string
  okDark: string
  errDark: string
  errDarker: string
  // Wizard KYC (handoff refonte) — tokens posés SUR l'accent (s'inversent en
  // sombre) + chrome (séparateurs, fondu footer, logo, scrollbar).
  onAccentSoft: string
  onAccentMid: string
  onAccentFaint: string
  divider: string
  stepLine: string
  footerFade: string
  logoInvert: boolean
  scrollThumb: string
  scrollThumbHover: string
}

// Tons de risque — FIXES dans les 2 thèmes (le risque doit se repérer d'un
// coup d'œil, comme les couleurs d'étapes du pipeline). Handoff §4.
export const KYC_RISK_TONE = {
  low: '#10B981',
  medium: '#F59E0B',
  high: '#EF4444',
  unassessed: '#7A8088',
} as const

export const KYC_LIGHT: KycPalette = {
  bg: '#EDEFF3',
  bgGradient:
    'radial-gradient(ellipse 120% 80% at 50% 100%, #C8D5E0 0%, #E2E5EB 50%, #EDEFF3 100%)',
  card: '#FFFFFF',
  cardSubtle: '#F7F8FA',
  cardBorder: 'transparent',
  black: '#0B0C0E',
  blackHover: '#1F2024',
  onAccent: '#FFFFFF',
  ink: '#0B0C0E',
  inkSoft: '#3A3D44',
  muted: '#7A8088',
  ghost: '#B5BAC2',
  ringTrack: 'rgba(11,12,14,0.08)',
  shadowSm: '0 4px 16px rgba(15, 23, 42, 0.04)',
  shadow: '0 12px 40px rgba(15, 23, 42, 0.06), 0 2px 8px rgba(15, 23, 42, 0.03)',
  shadowLg: '0 24px 60px rgba(15, 23, 42, 0.08), 0 4px 16px rgba(15, 23, 42, 0.04)',
  shadowHover: '0 32px 70px rgba(15, 23, 42, 0.10), 0 6px 20px rgba(15, 23, 42, 0.05)',
  ok: '#10B981',
  warn: '#F59E0B',
  err: '#EF4444',
  okSoft: '#E5F4EC',
  warnSoft: '#FFF4E0',
  errSoft: 'rgba(239,68,68,0.10)',
  okDark: '#0E9F6E',
  errDark: '#E53935',
  errDarker: '#B91C1C',
  onAccentSoft: 'rgba(255,255,255,0.75)',
  onAccentMid: 'rgba(255,255,255,0.18)',
  onAccentFaint: 'rgba(255,255,255,0.10)',
  divider: 'rgba(11,12,14,0.10)',
  stepLine: 'rgba(11,12,14,0.08)',
  footerFade:
    'linear-gradient(180deg, transparent 0%, rgba(237,239,243,0.9) 60%, rgba(237,239,243,1) 100%)',
  logoInvert: false,
  scrollThumb: 'rgba(11,12,14,0.18)',
  scrollThumbHover: 'rgba(11,12,14,0.32)',
}

/**
 * Construit la palette KYC pour le thème courant.
 *
 * En sombre, on ne garde AUCUNE carte blanche : verre translucide + tour blanc
 * (immersif), accent inversé en pilule claire, encarts d'alerte sur fonds
 * sombres lisibles. Dérivé du `sp` (crmSugarPalette) + `t` (CrmTheme) déjà
 * calculés par la page, pour rester cohérent avec le reste du shell CRM.
 */
export function buildKycPalette(
  dark: boolean,
  sp: SugarPalette,
  t: CrmTheme,
): KycPalette {
  if (!dark) return KYC_LIGHT
  return {
    bg: t.bg,
    bgGradient: t.bg,
    card: 'rgba(255,255,255,0.04)',
    cardSubtle: 'rgba(255,255,255,0.06)',
    cardBorder: 'rgba(255,255,255,0.12)',
    black: sp.ink, // pilule claire en sombre
    blackHover: '#FFFFFF',
    onAccent: sp.pageBg, // texte sombre posé sur la pilule claire
    ink: sp.ink,
    inkSoft: sp.soft,
    muted: sp.sub,
    ghost: 'rgba(255,255,255,0.20)',
    ringTrack: 'rgba(255,255,255,0.14)',
    shadowSm: '0 2px 8px rgba(0,0,0,0.30)',
    shadow: '0 1px 2px rgba(0,0,0,0.40), 0 12px 32px -12px rgba(0,0,0,0.65)',
    shadowLg: '0 1px 2px rgba(0,0,0,0.45), 0 24px 60px -16px rgba(0,0,0,0.75)',
    shadowHover: '0 1px 2px rgba(0,0,0,0.50), 0 30px 70px -16px rgba(0,0,0,0.80)',
    ok: '#10B981',
    warn: '#F59E0B',
    err: '#EF4444',
    // Encarts d'alerte adaptés au sombre (fonds profonds, texte clair lisible)
    okSoft: t.okSoft,
    warnSoft: t.warnSoft,
    errSoft: t.dangerSoft,
    okDark: '#6EE7B7',
    errDark: '#F8B4B0',
    errDarker: '#FCA5A5',
    onAccentSoft: 'rgba(11,12,14,0.62)',
    onAccentMid: 'rgba(11,12,14,0.14)',
    onAccentFaint: 'rgba(11,12,14,0.08)',
    divider: 'rgba(255,255,255,0.12)',
    stepLine: 'rgba(255,255,255,0.16)',
    footerFade: `linear-gradient(180deg, transparent 0%, ${t.bg} 62%, ${t.bg} 100%)`,
    logoInvert: true,
    scrollThumb: 'rgba(255,255,255,0.22)',
    scrollThumbHover: 'rgba(255,255,255,0.40)',
  }
}

// ─── Context + hook ─────────────────────────────────────────────────────
// Valeur par défaut = palette claire : tout composant Kyc* lisant le hook
// hors d'un provider (tests, Storybook, anciennes pages) reste fonctionnel.
export const KycPaletteContext = createContext<KycPalette>(KYC_LIGHT)

export function useKycPalette(): KycPalette {
  return useContext(KycPaletteContext)
}

// ─── Keyframes spécifiques KYC (halo risque + spin actions) ─────────────
// `.kyc-halo-high` = halo rouge STATIQUE (décision produit : pas de pulse).
export const KYC_KEYFRAMES = `
.kyc-halo-high { box-shadow: 0 0 16px 1px rgba(239,68,68,0.50); }
@keyframes kycSpin { to { transform: rotate(360deg); } }
`
