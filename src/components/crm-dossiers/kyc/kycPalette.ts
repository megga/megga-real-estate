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
import { CRM_TOKENS, type CrmPalette, crmVoileEncre } from '@/components/crm/tokens'
import { MXC_COLOR } from '@/components/megga-x-crm/tokens'

/**
 * ⛔ DIX CLÉS ONT ÉTÉ RETIRÉES le 16 août 2026 (lot 3), et pas parce qu'elles
 * étaient hors direction : elles n'avaient AUCUN LECTEUR. Mesuré sur les onze
 * fichiers qui montent cette palette — `bg`, `ringTrack`, `stepLine`, et toute la
 * famille d'état (`ok`, `warn`, `err`, `okSoft`, `warnSoft`, `okDark`,
 * `errDark`) : zéro usage, dans les deux thèmes.
 *
 * ⚠ C'EST CE QUI TRANCHE LA QUESTION « jusqu'où la palette descend ». On croyait
 * devoir arbitrer entre l'échelle et des tons SÉMANTIQUES ; la mesure dit qu'il
 * n'y avait rien à arbitrer, parce que ces tons-là ne peignaient plus rien. Les
 * teintes qui ENCODENT réellement le KYC vivent ailleurs — `kypStatusMeta` et
 * `kypRiskMeta` (`kypTokens.ts`), le statut de dossier et le niveau de risque —
 * et ce lot n'y touche pas. Une palette parallèle finit toujours par accumuler
 * des clés que plus personne ne lit : elles ne se voient qu'en comptant.
 *
 * `blackHover` part avec elles, pour une raison de DIRECTION celle-là : la
 * vitrine ne donne à `.primary-button:hover` qu'un `scale3d(1.04)`, aucun
 * changement de couleur — et `KycBlackPill` porte déjà sa réponse géométrique
 * (`translateY(-1px)` + ombre renforcée). `DossierTokens` avait retiré la sienne pour
 * ce motif exact.
 */
export interface KycPalette {
  // Fond
  bgGradient: string
  // Surfaces
  card: string
  cardSubtle: string
  cardBorder: string
  // Accent CTA — l'élément ACTIF le porte, dans les DEUX thèmes
  black: string
  onAccent: string
  // Texte
  ink: string
  inkSoft: string
  muted: string
  ghost: string
  // Ombres
  shadowSm: string
  shadow: string
  shadowLg: string
  shadowHover: string
  // ⚠ Les deux SEULS tons d'état qui restent : ils ont des lecteurs, et leur
  // teinte porte l'information « erreur ». L'échelle ne sait pas la porter.
  errSoft: string
  errDarker: string
  // Chrome du wizard — posés SUR l'accent, donc de sens constant d'un thème à
  // l'autre (l'accent, lui, ne change pas).
  onAccentSoft: string
  onAccentMid: string
  onAccentFaint: string
  divider: string
  footerFade: string
  logoInvert: boolean
  scrollThumb: string
  scrollThumbHover: string
}

// Tons de risque — FIXES dans les 2 thèmes (le risque doit se repérer d'un
// coup d'œil, comme les couleurs d'étapes du pipeline). Handoff §4.
export const KYC_LIGHT: KycPalette = {
  // ⛔ PLAT, plus un dégradé radial bleu-gris. MEGGA X ne pratique pas le fond
  // décoratif : la branche SOMBRE rendait déjà `sp.pageBg` nu, et le clair
  // gardait seul un `radial-gradient(#C8D5E0 → #E2E5EB → #EDEFF3)` qui ne
  // descendait d'aucun barreau. Les trois teintes étaient les seules de leur
  // espèce dans tout le KYC.
  bgGradient: MXC_COLOR.n900,
  card: MXC_COLOR.n1000,
  cardSubtle: MXC_COLOR.n900,
  // ⚠ HORS DIRECTION, et c'est un IDIOME, pas un oubli : en clair le KYC sépare
  // par l'OMBRE, pas par la bordure. Ça n'a de sens que depuis que les ombres
  // existent réellement (lot 1bis) — avant, « ombres seules » et « rien du tout »
  // se ressemblaient beaucoup.
  cardBorder: 'transparent',
  // ⛔ L'ACCENT, pas l'encre. Les douze lecteurs de `black` sont TOUS des états
  // actifs ou des affordances primaires — pilule d'étape sélectionnée, carte de
  // porte choisie, CTA du wizard, onglet courant. Le peindre en encre appliquait
  // la règle de Sugar Pure (« l'accent EST l'encre ») avec les jetons de MEGGA X.
  black: MXC_COLOR.accent,
  onAccent: MXC_COLOR.n1000,
  ink: MXC_COLOR.n100,
  // L'échelle d'encre claire de MEGGA X, du plein au secondaire :
  // n100 (#030303) · n400 (#181818) · n500 (#686868).
  inkSoft: MXC_COLOR.n400,
  // ⛔ `#7A8088` ne passait PAS l'AA en clair — 3,98:1 sur sa propre carte, sur
  // 14 sites en `color:`. Le défaut était MONO-THÈME (en sombre `muted` vaut
  // `sp.sub`, donc 7,89:1), donc invisible à toute garde d'un seul thème.
  // `n500` est le barreau que MEGGA X donne à l'encre secondaire claire :
  // 5,57 sur la carte, 5,24 sur la sous-carte, 4,84 sur le canvas.
  muted: MXC_COLOR.n500,
  // Aplat d'un CTA désactivé. WCAG exempte l'élément désactivé de tout seuil —
  // ce qui ne dispense pas de le prendre sur l'échelle.
  ghost: MXC_COLOR.n700,
  shadowSm: `0 4px 16px ${crmVoileEncre(false, 0.04)}`,
  // ⛔ BACKTICKS, pas des guillemets simples. Ces trois lignes ont vécu en
  // chaînes littérales contenant `${…}` : du TEXTE, donc une déclaration CSS
  // invalide que le navigateur écarte — `box-shadow: none`. Avec
  // `cardBorder: 'transparent'` juste au-dessus, les cartes claires du KYC
  // sortaient sans ombre NI bordure. Gardé par `interpolation-morte.spec.ts`.
  shadow: `0 12px 40px ${crmVoileEncre(false, 0.06)}, 0 2px 8px ${crmVoileEncre(false, 0.03)}`,
  shadowLg: `0 24px 60px ${crmVoileEncre(false, 0.08)}, 0 4px 16px ${crmVoileEncre(false, 0.04)}`,
  shadowHover: `0 32px 70px ${crmVoileEncre(false, 0.10)}, 0 6px 20px ${crmVoileEncre(false, 0.05)}`,
  errSoft: 'rgba(239,68,68,0.10)',
  errDarker: '#B91C1C',
  // ⚠ 0,75 rendait 3,95:1 sur l'accent — sous l'AA. 0,85 rend 4,63:1. Les deux
  // autres sont des APLATS (fond de pastille, fond de vignette), pas des encres :
  // ils ne portent aucun seuil de texte et ne bougent pas.
  // ⚠ `crmVoileEncre(true, …)` rend exactement `rgba(255,255,255,…)`. Le voile
  // est BLANC dans les deux thèmes parce qu'il se pose sur l'ACCENT, qui ne
  // change pas — le paramètre nomme la couleur du voile, pas le thème de l'écran.
  onAccentSoft: crmVoileEncre(true, 0.85),
  onAccentMid: crmVoileEncre(true, 0.18),
  onAccentFaint: crmVoileEncre(true, 0.10),
  divider: crmVoileEncre(false, 0.10),
  footerFade: `linear-gradient(180deg, transparent 0%, ${MXC_COLOR.n900} 62%, ${MXC_COLOR.n900} 100%)`,
  logoInvert: false,
  scrollThumb: crmVoileEncre(false, 0.18),
  scrollThumbHover: crmVoileEncre(false, 0.32),
}

/**
 * Construit la palette KYC pour le thème courant.
 *
 * En sombre, on ne garde AUCUNE carte blanche : verre translucide + tour blanc
 * (immersif), accent inversé en pilule claire, encarts d'alerte sur fonds
 * sombres lisibles. Dérivé du `sp` (crmPalette) déjà
 * calculés par la page, pour rester cohérent avec le reste du shell CRM.
 */
export function buildKycPalette(
  dark: boolean,
  sp: CrmPalette,
): KycPalette {
  // Les fonds d'ÉTAT (succès, alerte, erreur) n'ont pas d'équivalent MEGGA X en
  // version « douce » : ils restent lus sur le thème legacy, seul endroit qui
  // les porte. Tout le reste vient de `sp`.
  const t = CRM_TOKENS.graphite
  if (!dark) return KYC_LIGHT
  return {
    bgGradient: sp.pageBg,
    card: MXC_COLOR.n300,
    cardSubtle: MXC_COLOR.n200,
    // En graphite la card est OPAQUE : le « tour blanc » redescend au filet,
    // sinon la bordure devient le seul relief visible et durcit le bento.
    cardBorder: 'rgba(255,255,255,0.06)',
    black: sp.accent, // l'actif porte l'accent dans les DEUX thèmes
    // ⛔ BLANC, PAS LE CANVAS — et ce n'était pas une étourderie mais un
    // commentaire PÉRIMÉ. « texte sombre posé sur la pilule claire » disait vrai
    // quand la branche sombre rendait une pilule CLAIRE ; le lot A2 a fait passer
    // `black` à l'accent sans suivre `onAccent`. Résultat mesuré au rendu :
    // `#030303` sur `#424bfb` = 3,57:1 sur les 12 sites en `color:` (pilule
    // d'étape active du wizard, badge « Recommandé », CTA primaire).
    // `CLAUDE.md` §3 dit que l'accent ne tient en aplat (5,78:1) que parce que
    // c'est l'ENCRE BLANCHE qui porte le contraste — la branche sombre cassait
    // exactement la propriété sur laquelle la règle s'appuie.
    onAccent: MXC_COLOR.n1000,
    ink: sp.ink,
    inkSoft: sp.soft,
    muted: sp.sub,
    // ⚠ OPAQUE, plus un voile blanc à 20 %. En sombre MEGGA X sépare par la
    // bordure et n'empile pas de voiles sur une surface neutre — et un voile ne
    // se mesure qu'après composition, ce qui masque son vrai palier.
    ghost: MXC_COLOR.n400,
    // ⛔ AUCUNE OMBRE EN SOMBRE, et la palette le dit déjà : `mxCrmPalette(true)`
    // rend `shadow` et `shadowSm` à `'none'`, comme la vitrine. `CLAUDE.md` §3 :
    // « la séparation vient de la BORDURE, pas de l'écart de luminance » — et la
    // branche sombre du KYC porte justement `cardBorder` à
    // `rgba(255,255,255,0.06)`. Les quatre ombres noires qui vivaient ici
    // faisaient donc double emploi avec le filet, sur un canvas déjà à `#030303`
    // où une ombre noire ne peut rien assombrir.
    shadowSm: sp.shadowSm,
    shadow: sp.shadow,
    // ⚠ `shadowLg` et `shadowHover` n'ont pas de jumeau dans `sp` : ils prennent
    // la même valeur, donc `'none'` ici. Une surface flottante en sombre est
    // ancrée par son voile de fond et son filet, pas par une ombre.
    shadowLg: sp.shadow,
    shadowHover: sp.shadow,
    // Encart d'alerte adapté au sombre (fond profond, encre claire lisible).
    errSoft: t.dangerSoft,
    errDarker: '#FCA5A5',
    // ⚠ MÊME SENS QU'EN CLAIR, pour la même raison : ils se posent sur l'accent,
    // qui ne change pas d'un thème à l'autre. Ils s'inversaient (voile d'encre
    // SOMBRE) du temps de la pilule claire — sur l'accent, ça donnait 2,58:1.
    onAccentSoft: crmVoileEncre(true, 0.85),
    onAccentMid: crmVoileEncre(true, 0.18),
    onAccentFaint: crmVoileEncre(true, 0.10),
    divider: crmVoileEncre(true, 0.12),
    footerFade: `linear-gradient(180deg, transparent 0%, ${sp.pageBg} 62%, ${sp.pageBg} 100%)`,
    logoInvert: true,
    scrollThumb: crmVoileEncre(true, 0.22),
    scrollThumbHover: crmVoileEncre(true, 0.40),
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
