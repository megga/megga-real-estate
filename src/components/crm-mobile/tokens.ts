// MEGGA CRM — Jetons du CRM mobile (clair + sombre).
//
// Point UNIQUE de la couleur mobile : seize dossiers d'écrans en dépendent —
// Today, Pipeline, Contacts, Agenda, Matching, KYC, Réglages, « Mes biens »…
// Aucune dérivation locale ailleurs.
//
// ── Direction ────────────────────────────────────────────────────────────
// Les DEUX thèmes descendent de `mxCrmPalette()` depuis le 11 août 2026. Avant,
// ce fichier était le dernier reste de Sugar Pure du CRM : en clair, tout y
// était Sugar — canvas `#EEF1F5` en dégradé radial, encre `#0B0C0E`, et surtout
// `accent: '#0B0C0E'`, l'accent qui EST l'encre ; en sombre, un hybride dont
// les sept surfaces venaient déjà de `MXC_COLOR` mais dont les encres restaient
// bleutées et l'accent s'inversait en near-white `#F2F2F6`.
//
// ⚠ Une note d'origine interdisait ici de prendre l'accent du desktop. Elle
// datait de l'époque où cet accent était le NOIR de Sugar et où le mobile
// aurait pu se retrouver sur une autre échelle sombre. Les deux raisons ont
// disparu : l'accent est `#424bfb` partout, et les surfaces sombres sont déjà
// celles de MEGGA X.
//
// Garde-fou : `tests/unit/mobile-palette.spec.ts`.

import { MXC_COLOR, mxCrmPalette } from '@/components/megga-x-crm/tokens'

const MX_LIGHT = mxCrmPalette(false)
const MX_DARK = mxCrmPalette(true)

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
  // Fond PLAT : le dégradé radial hérité de Sugar posait une seconde source de
  // lumière que la direction ne connaît pas. Retiré le même jour que celui du
  // wizard, pour la même raison.
  canvas: MX_LIGHT.pageBg,
  pageBg: MX_LIGHT.pageBg,
  card: MX_LIGHT.cardBg,
  cardSubtle: MX_LIGHT.cardSubBg,
  ink: MX_LIGHT.ink,
  inkSoft: MX_LIGHT.soft,
  muted: MX_LIGHT.sub,
  ghost: MXC_COLOR.n600,
  hair: MXC_COLOR.n800,
  accent: MX_LIGHT.accent,
  accentInk: MX_LIGHT.accentInk,
  headerBg: 'rgba(255,255,255,0.92)',
  tabBg: 'rgba(255,255,255,0.92)',
  overlay: 'rgba(3,3,3,0.32)',
  sheetBg: MX_LIGHT.cardSubBg,
  tabBarBg: MX_LIGHT.cardBg,
  tabBarShadow: '0 18px 44px rgba(15,23,42,0.16), 0 4px 14px rgba(15,23,42,0.07)',
  pillBg: MX_LIGHT.accent,
  pillInk: MX_LIGHT.accentInk,
  shadowSm: '0 4px 16px rgba(15,23,42,0.05)',
  shadow: '0 12px 34px rgba(15,23,42,0.07), 0 2px 8px rgba(15,23,42,0.04)',
  shadowLg: '0 22px 50px rgba(15,23,42,0.12), 0 6px 18px rgba(15,23,42,0.06)',
  // Bloc de relance : bento IMMERSIF sombre dans les DEUX thèmes — idiome
  // accepté (cf. le bento Facturation gardé aux Réglages). Il descend de
  // l'échelle sans cesser d'être sombre.
  relanceBg: MXC_COLOR.n100,
  relanceBorder: 'transparent',
  relanceInk: MXC_COLOR.n1000,
  relanceMuted: MXC_COLOR.n600,
  ctaBg: MXC_COLOR.n1000,
  ctaInk: MXC_COLOR.n100,
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

/** Voile de chrome (en-tête, barre d'onglets) : la teinte du CADRE à l'alpha
 *  demandé, pas un quasi-noir figé — sinon il se verrait comme une bande posée
 *  sur la surface au lieu de la prolonger. */
function mtFrameVeil(alpha: number): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(MXC_COLOR.n200.slice(i, i + 2), 16))
  return `rgba(${r},${g},${b},${alpha})`
}

// Surfaces en GETTERS : le CRM mobile suit la teinte sombre active comme le
// desktop (aligné à la demande, hors périmètre du handoff qui ne touchait pas
// cette échelle). Le littéral de repli est la valeur historique du site.
export const MT_DARK: MobileTokens = {
  mode: 'dark',
  canvas: MX_DARK.pageBg,
  pageBg: MX_DARK.pageBg,
  card: MX_DARK.cardBg,
  cardSubtle: MX_DARK.cardSubBg,
  ink: MX_DARK.ink,
  inkSoft: MX_DARK.soft,
  muted: MX_DARK.sub,
  ghost: MXC_COLOR.n500,
  hair: 'rgba(255,255,255,0.08)',
  accent: MX_DARK.accent,
  accentInk: MX_DARK.accentInk,
  get headerBg() { return mtFrameVeil(0.82) },
  get tabBg() { return mtFrameVeil(0.86) },
  overlay: 'rgba(0,0,4,0.5)',
  // Feuille du bas et barre d'onglets = surfaces FLOTTANTES → palier haut.
  sheetBg: MX_DARK.cardBg,
  tabBarBg: MX_DARK.cardBg,
  tabBarShadow: '0 18px 44px rgba(0,0,0,0.5), 0 4px 14px rgba(0,0,0,0.4)',
  pillBg: MX_DARK.accent,
  pillInk: MX_DARK.accentInk,
  shadowSm: '0 2px 10px rgba(0,0,0,0.4)',
  shadow: '0 12px 34px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.4)',
  shadowLg: '0 24px 56px rgba(0,0,0,0.62), 0 6px 18px rgba(0,0,0,0.5)',
  relanceBg: MXC_COLOR.n200,
  relanceBorder: 'rgba(255,255,255,0.08)',
  relanceInk: MXC_COLOR.n1000,
  relanceMuted: MXC_COLOR.n600,
  ctaBg: MXC_COLOR.n1000,
  ctaInk: MXC_COLOR.n100,
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
