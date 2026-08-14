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
import { CRM_TOKENS, type SugarPalette, sgVoileEncre } from '@/components/crm-sugar/tokens'
import { MXC_COLOR } from '@/components/megga-x-crm/tokens'

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
export const KYC_LIGHT: KycPalette = {
  bg: '#EDEFF3',
  bgGradient:
    'radial-gradient(ellipse 120% 80% at 50% 100%, #C8D5E0 0%, #E2E5EB 50%, #EDEFF3 100%)',
  card: '#FFFFFF',
  cardSubtle: '#F7F8FA',
  cardBorder: 'transparent',
  // ⛔ L'ACCENT, pas l'encre. Les douze lecteurs de `black` sont TOUS des états
  // actifs ou des affordances primaires — pilule d'étape sélectionnée, carte de
  // porte choisie, CTA du wizard, onglet courant. Le peindre en encre appliquait
  // la règle de Sugar Pure (« l'accent EST l'encre ») avec les jetons de MEGGA X.
  black: MXC_COLOR.accent,
  blackHover: '#1F2024',
  onAccent: '#FFFFFF',
  ink: MXC_COLOR.n100,
  inkSoft: '#3A3D44',
  // ⛔ `#7A8088` ne passait PAS l'AA en clair — 3,98:1 sur sa propre carte, sur
  // 14 sites en `color:`. Le défaut était MONO-THÈME (en sombre `muted` vaut
  // `sp.sub`, donc 7,89:1), donc invisible à toute garde d'un seul thème.
  // `n500` est le barreau que MEGGA X donne à l'encre secondaire claire :
  // 5,57 sur la carte, 5,24 sur la sous-carte, 4,84 sur le canvas.
  muted: MXC_COLOR.n500,
  ghost: '#B5BAC2',
  ringTrack: `${sgVoileEncre(false, 0.08)}`,
  shadowSm: `0 4px 16px ${sgVoileEncre(false, 0.04)}`,
  // ⛔ BACKTICKS, pas des guillemets simples. Ces trois lignes ont vécu en
  // chaînes littérales contenant `${…}` : du TEXTE, donc une déclaration CSS
  // invalide que le navigateur écarte — `box-shadow: none`. Avec
  // `cardBorder: 'transparent'` juste au-dessus, les cartes claires du KYC
  // sortaient sans ombre NI bordure. Gardé par `interpolation-morte.spec.ts`.
  shadow: `0 12px 40px ${sgVoileEncre(false, 0.06)}, 0 2px 8px ${sgVoileEncre(false, 0.03)}`,
  shadowLg: `0 24px 60px ${sgVoileEncre(false, 0.08)}, 0 4px 16px ${sgVoileEncre(false, 0.04)}`,
  shadowHover: `0 32px 70px ${sgVoileEncre(false, 0.10)}, 0 6px 20px ${sgVoileEncre(false, 0.05)}`,
  ok: '#10B981',
  warn: '#F59E0B',
  err: '#EF4444',
  okSoft: '#E5F4EC',
  warnSoft: '#FFF4E0',
  errSoft: 'rgba(239,68,68,0.10)',
  okDark: '#0E9F6E',
  errDark: '#E53935',
  errDarker: '#B91C1C',
  // ⚠ 0,75 rendait 3,95:1 sur l'accent — sous l'AA. 0,85 rend 4,63:1. Les deux
  // autres sont des APLATS (fond de pastille, fond de vignette), pas des encres :
  // ils ne portent aucun seuil de texte et ne bougent pas.
  onAccentSoft: 'rgba(255,255,255,0.85)',
  onAccentMid: 'rgba(255,255,255,0.18)',
  onAccentFaint: 'rgba(255,255,255,0.10)',
  divider: `${sgVoileEncre(false, 0.10)}`,
  stepLine: `${sgVoileEncre(false, 0.08)}`,
  footerFade:
    'linear-gradient(180deg, transparent 0%, rgba(237,239,243,0.9) 60%, rgba(237,239,243,1) 100%)',
  logoInvert: false,
  scrollThumb: `${sgVoileEncre(false, 0.18)}`,
  scrollThumbHover: `${sgVoileEncre(false, 0.32)}`,
}

/**
 * Construit la palette KYC pour le thème courant.
 *
 * En sombre, on ne garde AUCUNE carte blanche : verre translucide + tour blanc
 * (immersif), accent inversé en pilule claire, encarts d'alerte sur fonds
 * sombres lisibles. Dérivé du `sp` (crmSugarPalette) déjà
 * calculés par la page, pour rester cohérent avec le reste du shell CRM.
 */
export function buildKycPalette(
  dark: boolean,
  sp: SugarPalette,
): KycPalette {
  // Les fonds d'ÉTAT (succès, alerte, erreur) n'ont pas d'équivalent MEGGA X en
  // version « douce » : ils restent lus sur le thème legacy, seul endroit qui
  // les porte. Tout le reste vient de `sp`.
  const t = CRM_TOKENS.graphite
  if (!dark) return KYC_LIGHT
  return {
    bg: sp.pageBg,
    bgGradient: sp.pageBg,
    card: MXC_COLOR.n300,
    cardSubtle: MXC_COLOR.n200,
    // En graphite la card est OPAQUE : le « tour blanc » redescend au filet,
    // sinon la bordure devient le seul relief visible et durcit le bento.
    cardBorder: 'rgba(255,255,255,0.06)',
    black: sp.accent, // l'actif porte l'accent dans les DEUX thèmes
    blackHover: '#FFFFFF',
    // ⛔ BLANC, PAS LE CANVAS — et ce n'était pas une étourderie mais un
    // commentaire PÉRIMÉ. « texte sombre posé sur la pilule claire » disait vrai
    // quand la branche sombre rendait une pilule CLAIRE ; le lot A2 a fait passer
    // `black` à l'accent sans suivre `onAccent`. Résultat mesuré au rendu :
    // `#030303` sur `#424bfb` = 3,57:1 sur les 12 sites en `color:` (pilule
    // d'étape active du wizard, badge « Recommandé », CTA primaire).
    // `CLAUDE.md` §3 dit que l'accent ne tient en aplat (5,78:1) que parce que
    // c'est l'ENCRE BLANCHE qui porte le contraste — la branche sombre cassait
    // exactement la propriété sur laquelle la règle s'appuie.
    onAccent: '#FFFFFF',
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
    // ⚠ MÊME SENS QU'EN CLAIR, pour la même raison : ils se posent sur l'accent,
    // qui ne change pas d'un thème à l'autre. Ils s'inversaient (voile d'encre
    // SOMBRE) du temps de la pilule claire — sur l'accent, ça donnait 2,58:1.
    onAccentSoft: 'rgba(255,255,255,0.85)',
    onAccentMid: 'rgba(255,255,255,0.18)',
    onAccentFaint: 'rgba(255,255,255,0.10)',
    divider: 'rgba(255,255,255,0.12)',
    stepLine: 'rgba(255,255,255,0.16)',
    footerFade: `linear-gradient(180deg, transparent 0%, ${sp.pageBg} 62%, ${sp.pageBg} 100%)`,
    logoInvert: true,
    scrollThumb: 'rgba(255,255,255,0.22)',
    scrollThumbHover: 'rgba(255,255,255,0.40)',
  }
}

// ─── Context + hook ─────────────────────────────────────────────────────
// Valeur par défaut = palette claire : tout composant Kyc* lisant le hook
// hors d'un provider (tests, Storybook, anciennes pages) reste fonctionnel.
export const KycPaletteContext = createContext<KycPalette>(KYC_LIGHT)

/**
 * Le THÈME de la palette KYC, qu'elle ne publiait pas.
 *
 * ⚠ Dérivé, pas deviné : la branche claire est la seule dont la carte est le
 * blanc pur. Un composant qui a besoin du thème (et non d'une couleur) devait
 * jusqu'ici le relire dans le stockage — deux sources pour un seul fait.
 */
export function useKycDark(): boolean {
  return useContext(KycPaletteContext).card !== KYC_LIGHT.card
}

export function useKycPalette(): KycPalette {
  return useContext(KycPaletteContext)
}

// ─── Keyframes spécifiques KYC (halo risque + spin actions) ─────────────
// `.kyc-halo-high` = halo rouge STATIQUE (décision produit : pas de pulse).
export const KYC_KEYFRAMES = `
.kyc-halo-high { box-shadow: 0 0 16px 1px rgba(239,68,68,0.50); }
@keyframes kycSpin { to { transform: rotate(360deg); } }
`
