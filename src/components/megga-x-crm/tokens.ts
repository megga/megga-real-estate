/**
 * MEGGA X CRM — jeu de tokens (proposition, non adoptée).
 *
 * L'ADN de la vitrine porté à la densité du CRM. Le principe tient en une
 * phrase : **on descend d'un cran sur les échelles de la vitrine, on n'en sort
 * pas**. Chaque valeur ci-dessous est un barreau existant de
 * `src/styles/megga-x.generated.css` — simplement plus bas que celui que les
 * pages marketing emploient. `tests/unit/megga-x-crm-tokens.spec.ts` le vérifie
 * mécaniquement : c'est ce qui rend l'affirmation « zéro valeur inventée »
 * contrôlable plutôt que déclarative.
 *
 * Pourquoi des littéraux et non `var(--main-spacers--…)` : les variables de la
 * vitrine ne sont déclarées que sous le scope `.megga-x`, qui impose son canvas
 * sombre, le reset Webflow complet et ~260 Ko de feuille. Le CRM ne peut pas
 * vivre dedans. On recopie donc les valeurs, et le test garde la copie honnête.
 *
 * Ce module ne remplace rien tant qu'il n'est pas adopté : `mxCrmPalette()` rend
 * une `SugarPalette`, donc il se substitue à `crmSugarPalette()` sans toucher
 * aux composants qui la reçoivent en prop.
 */

import type { SugarPalette } from '@/components/crm-sugar/tokens'

/** Direction artistique du CRM. */
export type CrmDa = 'sugar' | 'meggax'

/** Clé de persistance, calquée sur `megga.darkTone`. */
export const DA_KEY = 'megga.da'

/**
 * Direction par défaut — **MEGGA X depuis le 9 août 2026**.
 *
 * Le CRM s'aligne sur la vitrine et l'onboarding : un agent qui s'inscrit ne
 * traverse plus une rupture visuelle à la porte d'entrée. Sugar reste
 * entièrement résolvable — un réglage stocké sur `sugar` continue de rendre
 * l'ancienne direction, et le comparateur s'en sert pour sa colonne de
 * référence.
 */
export const DEFAULT_DA: CrmDa = 'meggax'

/**
 * Direction active — `window.__meggaDa` d'abord (posé à chaque bascule, donc lu
 * à chaud), puis localStorage, sinon Sugar.
 *
 * Lecture PONCTUELLE : ne déclenche aucun rendu. Un composant qui doit se
 * re-teinter sans rechargement passe par `useCrmDa()`.
 */
export function crmDa(): CrmDa {
  if (typeof window === 'undefined') return DEFAULT_DA
  const live = (window as Window & { __meggaDa?: CrmDa }).__meggaDa
  if (live) return live
  try {
    return (window.localStorage.getItem(DA_KEY) as CrmDa | null) || DEFAULT_DA
  } catch {
    return DEFAULT_DA
  }
}

/** Neutres et accents, verbatim des variables de la vitrine. */
export const MXC_COLOR = {
  n100: '#030303',
  n200: '#050505',
  n300: '#090909',
  n400: '#181818',
  n500: '#686868',
  n600: '#a3a3a3',
  n700: '#cccccc',
  n800: '#ededed',
  n900: '#f9f9f9',
  n1000: '#ffffff',
  /** `--primary-colors--100` — le bleu MEGGA. */
  accent: '#424bfb',
} as const

/**
 * ⚠ La GRAMMAIRE (tailles de texte, rayons, espacements) et la police ne vivent
 * PAS ici. Elles sont des variables CSS — `[data-crm-da="meggax"]` dans
 * `src/styles/globals.css` — parce qu'elles doivent pouvoir basculer sur un
 * conteneur, ce qu'un objet JS ne sait pas faire.
 *
 * Elles ont transité par ce module tant que les pages de comparaison les
 * consommaient ; ces pages retirées, les garder ici aurait produit une seconde
 * déclaration de la même échelle, libre de diverger de celle qui rend. C'est le
 * bloc CSS que `tests/unit/megga-x-crm-tokens.spec.ts` vérifie désormais.
 *
 * Ce module ne garde donc que ce qui alimente `mxCrmPalette()` — la couleur.
 */

/**
 * L'unique ombre que la vitrine pose sur une carte, et seulement en clair
 * (`.card-light-mode`). En sombre elle sépare par une BORDURE, jamais par une
 * ombre — d'où `shadow: 'none'` plus bas. C'est un trait de la direction, pas
 * un oubli : ne pas « réparer » en ajoutant une ombre sombre.
 */
export const MXC_CARD_SHADOW = '0 2px 6px #15086b21'

/**
 * Palette CRM dérivée de la vitrine, compatible `SugarPalette`.
 *
 * Les encres suivent l'ordre de Sugar — `ink` le plus fort, puis `soft`, puis
 * `sub`. Le choix des barreaux n'est pas libre : `n600` (#a3a3a3) tombe à
 * 2,5:1 sur blanc, très en dessous de l'AA, donc il ne sert de texte
 * secondaire qu'en SOMBRE, où il donne 7,9:1. En clair c'est `n500` (5,3:1).
 * Le test verrouille ces seuils.
 */
export function mxCrmPalette(dark: boolean): SugarPalette {
  const C = MXC_COLOR

  if (!dark) {
    return {
      pageBg: C.n900,
      frameBg: C.n1000,
      frameBorder: C.n700,
      cardBg: C.n1000,
      cardBorder: C.n700,
      cardSubBg: C.n900,
      ink: C.n100,
      sub: C.n500,
      soft: C.n400,
      accent: C.accent,
      accentInk: C.n1000,
      focusBg: C.accent,
      focusInk: C.n1000,
      focusSurface: C.n800,
      focusShadow: MXC_CARD_SHADOW,
      shadow: MXC_CARD_SHADOW,
      shadowSm: MXC_CARD_SHADOW,
      tableHeadBg: C.n900,
      avatarBorder: C.n1000,
      iconBtnBg: C.n900,
      iconRailBg: C.n1000,
      dotBorder: C.n1000,
      kbdBg: C.n900,
      solidBg: C.n1000,
      solidBgSub: C.n900,
      solidBgSub2: C.n800,
      solidBorder: C.n700,
      solidShadow: MXC_CARD_SHADOW,
    }
  }

  return {
    pageBg: C.n100,
    frameBg: C.n200,
    frameBorder: C.n400,
    cardBg: C.n300,
    cardBorder: C.n400,
    cardSubBg: C.n200,
    ink: C.n1000,
    sub: C.n600,
    soft: C.n800,
    accent: C.accent,
    accentInk: C.n1000,
    focusBg: C.accent,
    focusInk: C.n1000,
    focusSurface: C.n400,
    // En sombre la vitrine sépare par la bordure : pas d'ombre à imiter.
    focusShadow: 'none',
    shadow: 'none',
    shadowSm: 'none',
    tableHeadBg: C.n200,
    avatarBorder: C.n400,
    iconBtnBg: C.n400,
    iconRailBg: C.n200,
    dotBorder: C.n300,
    kbdBg: C.n400,
    solidBg: C.n300,
    solidBgSub: C.n200,
    solidBgSub2: C.n100,
    solidBorder: C.n400,
    solidShadow: 'none',
  }
}
