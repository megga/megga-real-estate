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
 * `mxCrmPalette()` rend une `CrmPalette` — le nom du TYPE a survécu à la
 * direction Sugar, parce que 33 points de construction et toute l'arborescence
 * qui la reçoit en prop s'appuient dessus. Le renommer est un nettoyage à part.
 */

import type { CrmPalette } from '@/components/crm/tokens'

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
  /**
   * `--system-colors--blue-400`. Transcrit le 20.09.2026 — et il a fallu EN
   * DÉCIDER, comme le dit l'en-tête de ce bloc. Motif : le plancher sombre
   * relevé à `#16181c`, le ton `info` de la console admin (`#4C86E8`) est tombé
   * à 4,37:1 sur la carte, sous l'AA. `blue400` rend 6,32:1 au pire des trois
   * surfaces, et laisse `blue300` à son rôle d'encre teintée la plus claire —
   * les deux restent distinguables là où un seul barreau les aurait confondus.
   */
  blue400: '#64a7ff',
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
 * Les SURFACES sombres du CRM — seule famille de couleurs qui ne sorte PAS des
 * barreaux de la vitrine, et c'est une décision, pas un oubli.
 *
 * ⛔ **POURQUOI ON EN SORT.** La vitrine descend à `#030303` parce qu'une page
 * marketing se PARCOURT : on y reste une minute, le noir profond y est un effet.
 * Le CRM se HABITE — un agent y lit des listes et des colonnes pendant des
 * heures. Mesuré sur l'échelle de la vitrine : le canvas rend `L* 0,82` et la
 * marche canvas→carte vaut `ΔL* 1,65`, sous le seuil où l'œil voit une marche
 * sur de grandes surfaces. D'où `shadow: 'none'` ET une structure qui reposait
 * en entier sur un filet à `#181818`. Deux coûts qui s'additionnent : l'encre
 * blanche « bave » sur un plancher à 0,09 % de luminance (halation — pire avec
 * un astigmatisme, ~1 personne sur 3), et la page n'offre aucun repère de
 * clarté pour se structurer.
 *
 * ⚠ **CE N'EST PAS UN PROBLÈME DE RATIO DE CONTRASTE, et c'est ce qui trompe.**
 * `#030303` et `#16181c` rendent APCA `Lc -107,9` et `Lc -106,8` sous encre
 * blanche : l'écart est nul. La grandeur qui bouge est le PLANCHER — `Y` passe
 * de 0,091 % à 0,908 %, DIX fois plus haut. Chercher la fatigue dans le ratio
 * ne la trouve jamais.
 *
 * ⛔ **UNE SEULE SURFACE, ET C'EST LE POINT** (décision Julien, 20.09.2026 :
 * « il faut vraiment tout uniformiser, on doit juste voir les filets »). Le
 * canvas, le cadre, le rail, la barre d'onglets, la carte, la sous-carte, la
 * tête de tableau et les surfaces flottantes rendent TOUS `s0`. Ce qui sépare
 * est le FILET, jamais un écart de clarté. Les barreaux au-dessus ne décrivent
 * donc plus une pile de surfaces : ils servent aux ÉTATS (survol, pressé) et
 * au filet lui-même.
 *
 * ⚠ Conséquence à connaître avant d'ajouter une surface : poser un palier pour
 * « faire ressortir » un bloc RÉINTRODUIT la pile qu'on vient de retirer. Ce
 * qui doit ressortir prend une bordure, pas un fond.
 *
 * Les cinq barreaux, et le rôle que chacun tient désormais :
 *
 * | Rôle                              | Jeton  | Valeur    | L*    |
 * |-----------------------------------|--------|-----------|-------|
 * | TOUTE surface : canvas, rail,      | `s0`   | `#16181c` |  8,20 |
 * | carte, sous-carte, modale, popover |        |           |       |
 * | survol, pressé — un ÉTAT           | `s1`   | `#1b1e23` | 11,16 |
 * | état sur une surface déjà survolée | `s2`   | `#20242a` | 14,04 |
 * | (réserve — aucun emploi structurel)| `s3`   | `#2b3038` | 19,69 |
 * | LE FILET                           | `line` | `#353b44` | 24,65 |
 *
 * ⚠ Le survol reste à **ΔL* 2,96** du canvas : assez pour se voir, trop peu
 * pour relire comme une surface. C'est voulu — un état n'est pas un palier.
 *
 * ⛔ **LE FILET EST DIMENSIONNÉ POUR PORTER SEUL** (décision Julien, 20.09.2026 :
 * grammaire LIGNÉE). Le pipeline ne remplit plus ses colonnes — elles sont
 * « limite transparentes », et seuls le contour et les séparateurs se voient.
 * Quand le fond ne sépare plus rien, la question n'est plus « quel gris de
 * carte » mais « le filet se voit-il sur le canvas ». Mesuré : `#353b44` rend
 * **ΔL* 16,45**, contre 13,00 pour un canvas à `#131517` et **7,43** pour
 * l'ancien `#181818` sur `#030303`. C'est ce chiffre, et non le confort du
 * canvas, qui a écarté `#131517` : la grammaire lignée est incompatible avec un
 * filet faible.
 *
 * ⚠ La sous-carte reste CREUSÉE (`cardSubBg` = le barreau du cadre, sous la
 * carte) : MEGGA X creuse ses sous-surfaces, il ne les monte pas.
 *
 * ⚠ Le cast est FROID de 2,35 % (R22 G24 B28), pas neutre. Deux raisons
 * mesurées : un gris mathématiquement neutre vire au tiède sur un panneau dont
 * le point blanc est plus froid que D65, et le balayage de teinte du pipeline
 * (`CRM_STAGE_HUE`, indigo → chaud) perd moins à 1,57 % qu'il ne gagnerait à
 * une neutralité qui laisse le canvas tirer au brun. Au-delà de ~3 % le canvas
 * se met à concurrencer les teintes qui PORTENT l'information : ne pas monter.
 */
export const MXC_DARK_SURFACE = {
  /** Canvas de page. */
  s0: '#16181c',
  /** Cadre bento, rail, top nav, bande d'onglets — et sous-carte creusée. */
  s1: '#1b1e23',
  /** Carte, colonne de kanban, ligne de liste, surface flottante. */
  s2: '#20242a',
  /** Survol et surface élevée. */
  s3: '#2b3038',
  /**
   * LE FILET — un seul, et volontairement DISCRET.
   *
   * ⛔ IL Y EN AVAIT CINQ, DE ΔL* 7,95 À 16,45 — plus du simple au double, sur
   * un seul écran (relevé au rendu le 20.09.2026) : ce jeton à 16,45, deux
   * voiles à 15,43 et 9,04, un anneau à 7,95. Le même rôle, cinq forces. C'est
   * ce désaccord qui se voyait, avant même la question de la discrétion.
   *
   * `#2b2d30` rend **ΔL* 10,13** sur le canvas — 38 % de moins que le `#353b44`
   * d'avant. Le plancher est MESURÉ, pas choisi : à ΔL* 7,95 (un voile de 0,07)
   * la ligne devient limite, en dessous elle s'efface. 10,13 laisse la marge
   * qu'il faut à un filet qui porte SEUL la structure du Pipeline.
   *
   * ⚠ C'est exactement ce que rend `rgba(255,255,255,0.09)` composé sur le
   * canvas. Les deux notations sont donc interchangeables À L'ŒIL : l'opaque
   * pour une surface neutre, le voile pour une surface TEINTÉE — où un aplat
   * ferait une tache (cf. l'avertissement porté par `encreSur`).
   *
   * ⚠ Ne pas le confondre avec `s3` (#2b3038) : proches en valeur, opposés en
   * rôle. `s3` est une SURFACE de réserve, celui-ci est une LIGNE.
   */
  line: '#2b2d30',
} as const

/**
 * Luminance relative WCAG d'un `#rrggbb` OU d'un `rgb(r, g, b)`.
 *
 * ⛔ ELLE NE CONNAISSAIT QU'UNE NOTATION, et le mode d'échec était silencieux :
 * `parseInt('rg', 16)` vaut `NaN`, donc la luminance vaut `NaN`, donc `encreSur`
 * compare deux `NaN` et rend une encre — la mauvaise — sans lever d'erreur.
 * Mesuré : `encreSur('rgb(65, 77, 161)')` rendait l'encre SOMBRE sur un bleu
 * foncé. `crmMix` rendait précisément ce format. Même famille que la n° 1 de
 * `megga/gardes-vacuites` (le motif qui ne connaît qu'une notation), mais côté
 * production : ici ça ne rate pas un défaut, ça en fabrique un.
 */
function luminance(couleur: string): number {
  const rgb = couleur.match(/rgba?\(([^)]+)\)/)
  const p = rgb
    ? rgb[1].split(',').slice(0, 3).map((s) => parseFloat(s.trim()))
    : [0, 2, 4].map((i) => parseInt(couleur.replace('#', '').slice(i, i + 2), 16))
  return p
    .map((v) => {
      const c = v / 255
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    })
    .reduce((acc, c, i) => acc + [0.2126, 0.7152, 0.0722][i] * c, 0)
}

/**
 * Encre lisible SUR un aplat : celle des deux extrémités de l'échelle qui
 * contraste le plus avec lui.
 *
 * ⛔ POURQUOI C'EST CALCULÉ, ET NON CHOISI. Plusieurs composants posaient du
 * blanc sur tous leurs aplats, avec des exceptions écrites à la main quand le
 * résultat devenait invisible. Mesuré le 12 août 2026 : les pilules de statut
 * échouaient l'AA sur SIX des neuf combinaisons (« Réservé » en sombre, 3,11:1
 * pour 12 px), la pilule « urgent » du bloc à-suivre sur les deux thèmes
 * (4,37 / 3,11), et CINQ des huit couleurs d'avatar (`#F59E0B` : 2,15:1).
 *
 * Ajouter une exception de plus aurait reproduit le défaut à la teinte suivante.
 * Dériver l'encre de l'aplat le rend impossible : changer un ton ne peut plus
 * casser sa lisibilité, il déplace l'encre avec lui.
 *
 * C'est la règle que la direction pose déjà — « un remplissage pâle prend
 * TOUJOURS l'encre sombre » (CLAUDE.md §3) — appliquée dans les DEUX sens, et
 * mécaniquement plutôt que de mémoire.
 *
 * ⚠ Vaut pour un aplat OPAQUE. Sur un voile translucide, le fond réel est le
 * MÉLANGE avec la surface au-dessous, et cette fonction s'y tromperait.
 */
export function encreSur(aplat: string): string {
  const t = luminance(aplat)
  const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
  return ratio(luminance(MXC_COLOR.n1000), t) >= ratio(luminance(MXC_COLOR.n100), t)
    ? MXC_COLOR.n1000
    : MXC_COLOR.n100
}

/**
 * Palette CRM dérivée de la vitrine, compatible `CrmPalette`.
 *
 * Les encres suivent l'ordre de Sugar — `ink` le plus fort, puis `soft`, puis
 * `sub`. Le choix des barreaux n'est pas libre : `n600` (#a3a3a3) tombe à
 * 2,5:1 sur blanc, très en dessous de l'AA, donc il ne sert de texte
 * secondaire qu'en SOMBRE, où il donne 7,9:1. En clair c'est `n500` (5,3:1).
 * Le test verrouille ces seuils.
 */
export function mxCrmPalette(dark: boolean): CrmPalette {
  const C = MXC_COLOR

  if (!dark) {
    return {
      isDark: false,
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

  const S = MXC_DARK_SURFACE

  return {
    isDark: true,
    // ⛔ CINQ RÔLES, UNE SEULE VALEUR. Le canvas, le cadre, la carte et la
    // sous-carte rendent le MÊME gris : la séparation est le filet, et lui
    // seul. Ne pas « réparer » en redonnant un palier à l'un des quatre —
    // c'est la pile qu'on a retirée.
    pageBg: S.s0,
    frameBg: S.s0,
    frameBorder: S.line,
    cardBg: S.s0,
    cardBorder: S.line,
    // ⚠ PLUS CREUSÉE : elle ne descend plus sous la carte, elle en est
    // séparée par un filet. Une sous-carte sans bordure devient invisible —
    // c'est la contrepartie à vérifier au rendu, pas à compenser par un fond.
    cardSubBg: S.s0,
    /**
     * ⛔ L'ENCRE COURANTE N'EST PLUS BLANCHE, et c'est la moitié du geste.
     * Le blanc pur est la SOURCE de la bave, pas le fond : sur l'ancien canvas
     * il rendait `Lc -107,9`, très au-dessus du `Lc 90` qui suffit déjà au
     * texte courant. `n800` rend `Lc -95,3` sur le canvas — on reste au-dessus
     * du seuil préféré en retirant douze points de stimulus brut.
     * La rampe descend donc n800 → n700 → n600, en miroir du clair
     * (n100 → n400 → n500). L'ordre de Sugar tient : ink > soft > sub.
     * ⚠ `accentInk` et `focusInk` restent BLANCS : sur l'aplat d'accent c'est
     * le blanc qui porte les 5,78:1, et `n800` les ferait tomber.
     */
    ink: C.n800,
    sub: C.n600,
    soft: C.n700,
    accent: C.accent,
    accentInk: C.n1000,
    focusBg: C.accent,
    focusInk: C.n1000,
    // Le survol est un ÉTAT : il descend au premier barreau, pas au dernier.
    focusSurface: S.s1,
    // En sombre MEGGA X sépare par la bordure : pas d'ombre à imiter.
    focusShadow: 'none',
    shadow: 'none',
    shadowSm: 'none',
    tableHeadBg: S.s0,
    avatarBorder: S.line,
    iconBtnBg: S.s1,
    iconRailBg: S.s0,
    dotBorder: S.s0,
    kbdBg: S.s1,
    // Flottantes : même gris que la page. Le filet ferme la forme, et une
    // modale porte en plus son voile — les deux suffisent à la décoller.
    solidBg: S.s0,
    solidBgSub: S.s0,
    solidBgSub2: S.s0,
    solidBorder: S.line,
    solidShadow: 'none',
  }
}
