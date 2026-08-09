/**
 * MEGGA X CRM — les couleurs du CRM. Direction UNIQUE depuis le 9 août 2026.
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
 * `mxCrmPalette()` rend une `SugarPalette` — le nom du TYPE a survécu à la
 * direction Sugar, parce que 33 points de construction et toute l'arborescence
 * qui la reçoit en prop s'appuient dessus. Le renommer est un nettoyage à part.
 */

import type { SugarPalette } from '@/components/crm-sugar/tokens'

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
  /** `--primary-colors--200` et `--300` : le reste du triptyque de marque.
   *  Pâles — en aplat sous encre sombre uniquement, comme `MXC_SYSTEM`. */
  accentGreen: '#00d95f',
  accentCyan: '#1abcfe',
} as const

/**
 * Couleurs de SYSTÈME de la vitrine — `--system-colors--{teinte}-{100..400}`.
 *
 * Elles disent l'état (succès, avertissement, erreur), ce que les neutres et
 * l'accent ne savent pas dire. Il n'y a donc rien à emprunter à Sugar pour un
 * « à renseigner » ou un « enregistré ».
 *
 * ⛔ **En APLAT seulement, et avec une encre SOMBRE.** Ces teintes sont réglées
 * pour le canvas `#030303` de la vitrine : posées sous une encre blanche elles
 * tombent à 1,7–1,9:1. Sous `n100` elles montent à 11–19:1. Le garde-fou
 * `megga-x-crm-tokens.spec.ts` fige les deux faits.
 *
 * Seuls les barreaux réellement employés sont transcrits — en ajouter un
 * demande de l'écrire, donc d'en décider.
 */
export const MXC_SYSTEM = {
  /**
   * ⛔ L'accent `#424bfb` ne passe PAS l'AA en TEXTE sur une surface sombre :
   * 3,44:1 sur `#090909`. En aplat il tient (c'est l'encre blanche qui porte le
   * contraste, 5,78:1), mais un libellé ou une icône teintée en accent sur fond
   * sombre est illisible. `blue300` est le barreau de la vitrine qui répond —
   * 10,6:1 — et il n'est employé QUE pour ça.
   */
  blue300: '#8dc1ff',
  yellow300: '#fbe080',
  yellow400: '#efc42c',
  green300: '#adecbb',
  green400: '#74d184',
  red400: '#fe566b',
} as const

/**
 * ⚠ La GRAMMAIRE (tailles de texte, rayons, espacements) et la police ne vivent
 * PAS ici mais dans le `:root` de `src/styles/globals.css`. Les garder aussi
 * ici produirait une seconde déclaration de la même échelle, libre de diverger
 * de celle qui rend. C'est ce bloc CSS que `megga-x-crm-tokens.spec.ts` vérifie.
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
