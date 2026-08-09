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

/** Direction artistique active du CRM. `sugar` reste le défaut tant que la
 *  direction n'est pas tranchée. */
export type CrmDa = 'sugar' | 'meggax'

/** Clé de persistance, calquée sur `megga.darkTone`. */
export const DA_KEY = 'megga.da'

export const DEFAULT_DA: CrmDa = 'sugar'

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
 * Couleurs système de la vitrine (`--system-colors--*`) — sémantique d'état, pas
 * de marque. Elles existent bel et bien dans la source : la direction sait dire
 * « en retard », il n'y a rien à emprunter à Sugar ni à inventer.
 *
 * ⚠ Toujours en APLAT avec `systemInk`, jamais en texte sur la surface. Mesuré :
 * `red-400` en texte donne 6,4:1 sur une carte sombre mais **3,1:1 sur blanc** —
 * échec AA. La pilule pleine porte son propre fond, donc le même 6,6:1 dans les
 * deux modes. Les trois autres montent de 8,4 à 12,4.
 */
export const MXC_SYSTEM = {
  danger: '#fe566b',
  success: '#74d184',
  warning: '#efc42c',
  info: '#64a7ff',
  /** Encre posée sur ces aplats. Le blanc échoue sur `danger` (3,1:1). */
  systemInk: '#030303',
} as const

/**
 * Tailles de texte. Toutes présentes dans la feuille : 12 px est celle de `h6`
 * et de `.badge-light.small`, 14 celle de `.paragraph-small`, 18 celle des
 * boutons pleins. La vitrine descend jusqu'à 6 px — le plancher n'est donc pas
 * 14, contrairement à ce que `.paragraph-small` laisse croire.
 */
export const MXC_TYPE = { xs: 12, sm: 14, md: 16, lg: 18, xl: 20 } as const

/** Rayons — barreaux `--main-border-radius--br-*`, de `2x-extra-small` à `medium`, plus la pilule. */
export const MXC_RADIUS = { xs: 8, sm: 12, md: 16, lg: 20, pill: 200 } as const

/** Espacements — barreaux `--main-spacers--*`, de `5x-extra-small` à `small`. */
export const MXC_SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 } as const

/** Police de la vitrine. */
export const MXC_FONT = "'Inter Tight', system-ui, sans-serif"

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
