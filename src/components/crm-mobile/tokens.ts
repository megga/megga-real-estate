// MEGGA CRM — Tokens « Sugar Pure » mobile (clair + sombre).
//
// Source de vérité : MT_LIGHT/MT_DARK promus depuis la maquette
// docs/handoff/crm-mobile/crm-mobile-today.jsx (déjà Sugar Pure : accent noir
// #0B0C0E, surfaces blanches pures, ombres douces seules, zéro bordure déco).
// Consolidations vs maquettes : un seul jeu de phases pipeline (MT_PHASES),
// tokens destructifs (danger), sceau KYC (kycSeal). Ce module est le point
// UNIQUE — aucune dérivation locale de tokens ailleurs.
//
// ⚠ Ne PAS baser les COULEURS D'ACCENT sur src/components/crm-sugar/tokens.ts
// (accent bleu desktop). Seule l'échelle sombre y est empruntée, via `crmStep` :
// sans elle le mobile resterait quasi-noir pendant que le desktop passe en
// Graphite. L'accent mobile reste défini ici.

import { crmStep } from '@/components/crm-sugar/tokens'

export interface MobileTokens {
  mode: 'light' | 'dark'
  /** Fond de page (gradient radial en clair, quasi-noir en sombre). */
  canvas: string
  /** Fond aplati (surfaces solides qui ne veulent pas du gradient). */
  pageBg: string
  card: string
  cardSubtle: string
  ink: string
  inkSoft: string
  muted: string
  ghost: string
  hair: string
  /** Accent unique Sugar Pure : noir en clair, blanc cassé en sombre. */
  accent: string
  accentInk: string
  headerBg: string
  tabBg: string
  /** Voile des overlays (feuilles, menus, confirmations). */
  overlay: string
  /** Fond des feuilles groupées (notifications) — surface sur laquelle flottent les cartes. */
  sheetBg: string
  tabBarBg: string
  tabBarShadow: string
  pillBg: string
  pillInk: string
  shadowSm: string
  shadow: string
  shadowLg: string
  relanceBg: string
  relanceBorder: string
  relanceInk: string
  relanceMuted: string
  ctaBg: string
  ctaInk: string
  riskBg: string
  riskFg: string
  goal: string
  cardBorder: string
  /** CTA / confirmation destructive (rouge foncé opaque, texte blanc). */
  danger: string
  dangerInk: string
  /** Pastille de STATUT « en retard » — tint doux (paire bg/fg), jamais le CTA solide. */
  dangerBg: string
  dangerFg: string
  /** Sceau KYC vérifié (bluecheck). */
  kycSeal: string
}

export const MT_LIGHT: MobileTokens = {
  mode: 'light',
  canvas: 'radial-gradient(ellipse 120% 65% at 50% 0%, #CFDAE4 0%, #DFE3EA 46%, #EEF0F3 100%)',
  pageBg: '#EEF1F5',
  card: '#FFFFFF',
  cardSubtle: '#F6F7F9',
  ink: '#0B0C0E',
  inkSoft: '#3A3D44',
  muted: '#7A8088',
  ghost: '#AEB3BC',
  hair: '#ECEEF1',
  accent: '#0B0C0E',
  accentInk: '#FFFFFF',
  headerBg: 'rgba(255,255,255,0.92)',
  tabBg: 'rgba(255,255,255,0.92)',
  overlay: 'rgba(11,12,14,0.32)',
  sheetBg: '#EDEFF2',
  tabBarBg: '#FFFFFF',
  tabBarShadow: '0 18px 44px rgba(15,23,42,0.16), 0 4px 14px rgba(15,23,42,0.07)',
  pillBg: '#0B0C0E',
  pillInk: '#FFFFFF',
  shadowSm: '0 4px 16px rgba(15,23,42,0.05)',
  shadow: '0 12px 34px rgba(15,23,42,0.07), 0 2px 8px rgba(15,23,42,0.04)',
  shadowLg: '0 22px 50px rgba(15,23,42,0.12), 0 6px 18px rgba(15,23,42,0.06)',
  relanceBg: '#0B0C0E',
  relanceBorder: 'transparent',
  relanceInk: '#FFFFFF',
  relanceMuted: '#9CA0AC',
  ctaBg: '#FFFFFF',
  ctaInk: '#0B0C0E',
  riskBg: '#FAEAD7',
  riskFg: '#B4570A',
  goal: '#059669',
  cardBorder: 'transparent',
  danger: '#8E1F3D',
  dangerInk: '#FFFFFF',
  dangerBg: '#FADBE2',
  dangerFg: '#8E1F3D',
  kycSeal: '#0041D9',
}

/** Voile de chrome (en-tête, barre d'onglets) : la teinte du cadre à l'alpha
 *  demandé. Un voile quasi-noir figé se verrait comme une bande sombre posée
 *  sur le graphite ; il doit suivre l'échelle comme le reste. */
function mtFrameVeil(alpha: number, legacy: string): string {
  const s1 = crmStep('s1', '')
  if (!s1) return legacy
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(s1.slice(i, i + 2), 16))
  return `rgba(${r},${g},${b},${alpha})`
}

// Surfaces en GETTERS : le CRM mobile suit la teinte sombre active comme le
// desktop (aligné à la demande, hors périmètre du handoff qui ne touchait pas
// cette échelle). Le littéral de repli est la valeur historique du site.
export const MT_DARK: MobileTokens = {
  mode: 'dark',
  get canvas() { return crmStep('s0', '#030303') },
  get pageBg() { return crmStep('s0', '#030303') },
  get card() { return crmStep('s2', '#17181A') },
  get cardSubtle() { return crmStep('s3', '#1F2023') },
  ink: '#ECEDF3',
  inkSoft: '#B5B7C4',
  muted: '#878B99',
  ghost: '#54576A',
  hair: 'rgba(255,255,255,0.08)',
  accent: '#F2F2F6',
  accentInk: '#0B0C0E',
  get headerBg() { return mtFrameVeil(0.82, 'rgba(15,15,16,0.82)') },
  get tabBg() { return mtFrameVeil(0.86, 'rgba(17,17,18,0.86)') },
  overlay: 'rgba(0,0,4,0.5)',
  // Feuille du bas et barre d'onglets = surfaces FLOTTANTES → palier haut.
  get sheetBg() { return crmStep('s4', '#0E0F11') },
  get tabBarBg() { return crmStep('s4', '#17181A') },
  tabBarShadow: '0 18px 44px rgba(0,0,0,0.5), 0 4px 14px rgba(0,0,0,0.4)',
  pillBg: '#F2F2F6',
  pillInk: '#0B0C0E',
  shadowSm: '0 2px 10px rgba(0,0,0,0.4)',
  shadow: '0 12px 34px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.4)',
  shadowLg: '0 24px 56px rgba(0,0,0,0.62), 0 6px 18px rgba(0,0,0,0.5)',
  get relanceBg() { return crmStep('s3', '#1F2023') },
  relanceBorder: 'rgba(255,255,255,0.08)',
  relanceInk: '#ECEDF3',
  relanceMuted: '#878B99',
  ctaBg: '#F2F2F6',
  ctaInk: '#0B0C0E',
  riskBg: 'rgba(180,87,10,0.20)',
  riskFg: '#F0B27A',
  goal: '#34C796',
  cardBorder: 'rgba(255,255,255,0.07)',
  danger: '#E0738C',
  dangerInk: '#FFFFFF',
  dangerBg: 'rgba(224,115,140,0.20)',
  dangerFg: '#F0A6B6',
  kycSeal: '#6F8CFF',
}

// Couleurs fonctionnelles métier — pilules/pastilles UNIQUEMENT, jamais accent
// UI. Identiques clair/sombre (reconnaissance). Canoniques : résout les
// divergences Offre (#C45A00) / Compromis (#059669) des maquettes.
// Manrope chargé globalement (index.html). Fallback système si indisponible.
export const MOBILE_FONT =
  "'Manrope', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
