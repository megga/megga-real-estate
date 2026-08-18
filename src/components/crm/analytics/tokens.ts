// MEGGA CRM — Dashboard Analytics « Le Cockpit Commission ».
// Jetons AX/AX_DARK, formatters CHF, modèle de données des 3 périodes, helper
// d'objectif. Route /dashboard/analytics → AnalyticsPage → AxDashboard.
//
// ⛔ DIRECTION : MEGGA X, dans les DEUX thèmes (17 août 2026).
// L'en-tête annonçait jusqu'ici « Grammaire Sugar Pure : surfaces blanches,
// accent ink #0B0C0E, ombres douces » — une direction RETIRÉE le 10 août, alors
// qu'`accent` valait déjà `MXC_COLOR.accent` depuis le lot A4. Un fichier aligné
// sur une norme périmée se relit MOINS qu'un fichier négligé : il a l'air
// documenté. Ce qu'il faut savoir maintenant :
//
//  · les surfaces, les encres et l'accent DESCENDENT de `MXC_COLOR` ; ce qui
//    reste écrit à la main est nommé, avec la mesure qui le justifie ;
//  · en SOMBRE la carte est `n300` et la séparation vient d'un FILET, pas d'une
//    ombre — `mxCrmPalette(true)` rend `shadow: 'none'` ;
//  · l'accent de la DATAVIZ (`AXF_ACCENTS`) vit ici depuis la nappe. Il vivait
//    dans `AxDashboard`, où la règle `react-refresh/only-export-components`
//    interdit d'exporter autre chose qu'un composant — et sans export, ni
//    `AxFirstRun` ni la garde de contraste ne pouvaient le lire. Une rampe que
//    personne ne peut mesurer est exactement ce qui avait laissé survivre le
//    périwinkle à la direction qui le justifiait.
//
// ⚠ Ce fichier portait TREIZE clés sans aucun lecteur, dont `secured`,
// `probable` et `possible` — qui ressemblaient à la décomposition de la
// commission, donc à une famille qui ENCODE, donc intouchable. Mesuré, elles ne
// peignaient RIEN depuis la refonte fusion. Une clé sans lecteur n'est pas
// « hors direction », elle est MORTE. Gardé par `tests/unit/analytics-contraste.spec.ts`.
//
// ── NAPPE FUSIONNÉE (handoff du 18 août 2026) ────────────────────────────────
// Les cinq cartes du cockpit deviennent UNE surface continue : une grille au
// `gap: 1px` posée sur `border`, dont chaque cellule est un aplat opaque `card`.
// Les filets SONT les gouttières. Trois conséquences pour cette palette :
//
//  · `border` naît ici, et il est le MÊME jeton que la bordure du cadre
//    (`mxCrmPalette().frameBorder`) : le filet interne et le contour du bento
//    doivent être une seule ligne, pas deux valeurs qui se ressemblent ;
//  · les ombres quittent les cellules. En CLAIR il ne reste que
//    `MXC_CARD_SHADOW` — celle de la vitrine, portée par le CADRE et par les
//    deux surfaces flottantes (popover de drill, champ de la porte) ; en SOMBRE
//    elles valent `'none'`, sans exception, comme le reste de MEGGA X ;
//  · les chips du graphe s'inversent : leur fond est l'encre du thème OPPOSÉ,
//    donc leurs encres ne se mesurent pas contre la carte mais contre `chipBg`.

import { MXC_CARD_SHADOW, MXC_COLOR, MXC_SYSTEM } from '@/components/megga-x-crm/tokens'
import { createContext, useContext } from 'react'

/**
 * LE FILET DE LA NAPPE, en pixels — la gouttière qui sépare deux cellules du
 * cockpit fusionné.
 *
 * ⚠ Une constante, et pas un `1` répété douze fois : c'est UNE ligne, tracée
 * par six grilles imbriquées (nappe, colonne gauche, colonne droite, bandeau,
 * tuiles KPI, et les mêmes côté compte neuf). Écrite en clair elle se lirait
 * comme un espacement — elle n'en est pas un, l'échelle `--crm-space-*`
 * commence à 4 px — et rien ne dirait que les douze sites bougent ensemble.
 *
 * Elle vit ici plutôt que dans `AxDashboard` pour que `AxFirstRun`, qui rend la
 * MÊME nappe, la lise sans créer d'import circulaire entre les deux écrans.
 */
export const AX_FILET = 1

export interface AxPill { bg: string; fg: string; sh: string }

/**
 * L'ACCENT DE LA DATAVIZ, décliné — les valeurs de `AXF_ACCENTS` de la maquette
 * font foi, et chacune est un barreau de MEGGA X.
 *
 * · `solid` — l'APLAT, `#424bfb` dans les deux thèmes (thumb du segment,
 *   pace-bar, colonnes de canal, bloc « Sécurisé ») ;
 * · `accent` — l'ENCRE et le TRAIT : `blue300` en sombre, où l'aplat tomberait
 *   à 3,44:1 (courbe, cône, sparklines) ;
 * · `soft` — la part PROJETÉE de la pace-bar, posée en voile sous la réalisée ;
 * · `area` — le remplissage sous la courbe, voile du trait qui le borde ;
 * · `rampA/B/C` — la rampe du treemap. Famille qui ENCODE (trois parts d'une
 *   même grandeur), d'où l'ordre imposé : plein accent → `blue300` → neutre.
 *   L'encre de chaque bloc se dérive par `encreSur`, jamais posée à la main.
 *
 * ⛔ LE PÉRIWINKLE #6F8CFF EST SUPPRIMÉ. C'était l'exception dataviz de Sugar,
 * dont le motif — « l'accent de l'UI est l'encre noire, il faut donc une autre
 * teinte pour les graphiques » — a disparu le jour où l'accent de la direction
 * est lui-même devenu bleu. Il a survécu un mois à sa raison d'être.
 */
export interface AxfAccent { solid: string; accent: string; soft: string; area: string; rampA: string; rampB: string; rampC: string }
export const AXF_ACCENTS: { light: AxfAccent; dark: AxfAccent } = {
  light: { solid: '#424bfb', accent: '#424bfb', soft: '#8dc1ff', area: 'rgba(66,75,251,0.12)', rampA: '#424bfb', rampB: '#8dc1ff', rampC: '#ededed' },
  dark: { solid: '#424bfb', accent: '#8dc1ff', soft: '#8dc1ff', area: 'rgba(141,193,255,0.14)', rampA: '#424bfb', rampB: '#8dc1ff', rampC: '#181818' },
}

export interface AxTheme {
  card: string
  cardSubtle: string
  ink: string
  /**
   * ⚠ IL DESCEND DE L'ÉCHELLE DEPUIS LA NAPPE (18 août 2026), et c'est un
   * ARBITRAGE, pas une correction. Il valait `#3A3D44` / `#B4B9C2`, écrits à la
   * main parce que le cran intermédiaire n'existe pas : en clair `n400`
   * (#181818) sort à **1,16:1** de `n100`, en sombre `n800` à **1,17:1** du
   * blanc — un DOUBLON de l'encre plutôt qu'un cran sous elle.
   *
   * Le handoff de la nappe tranche l'autre sens : il inscrit `n400` / `n800` au
   * tableau des encres, et la hiérarchie passe alors par la GRAISSE et la
   * TAILLE, pas par un demi-ton. Deux valeurs écrites à la main en moins ; le
   * doublon assumé est le prix, et il est écrit ici pour qu'on ne le
   * « corrige » pas en le rendant à nouveau unique.
   */
  inkSoft: string
  muted: string
  ghost: string
  hairline: string
  /**
   * LE FILET — celui qui sépare les cellules de la nappe, et le même que la
   * bordure du cadre. C'est un jeton d'APLAT autant que de bordure : la grille
   * pose `background: border` et laisse ses gouttières de 1 px le montrer.
   */
  border: string
  /** La surface de SURVOL d'une ligne (un cran au-dessus de la carte). */
  focus: string
  /**
   * ⛔ `'none'` EN SOMBRE, SANS EXCEPTION — et `MXC_CARD_SHADOW` en clair.
   *
   * Les trois valeurs étaient un ANNEAU INSET en sombre (`inset 0 0 0 1px n400`)
   * : la carte s'y séparait toute seule, faute de mieux. La nappe rend cet
   * anneau nuisible — un filet posé sur chaque cellule DOUBLERAIT la gouttière
   * qui les sépare déjà, et le popover flottant en hériterait sans le vouloir.
   * La séparation vient désormais de la GRILLE (et d'une `border` explicite sur
   * les deux surfaces flottantes), donc l'ombre n'a plus rien à porter.
   */
  shadow: string
  goal: string
  pillAhead: AxPill
  pillBehind: AxPill
  /**
   * L'encre d'un message d'ERREUR — une teinte qui ENCODE, donc hors direction,
   * mais pas hors lisibilité.
   *
   * ⛔ AJOUTÉE PARCE QUE `AxGate` VOLAIT UN APLAT. Son message d'erreur peignait
   * son texte avec `pillBehind.bg` — le FOND de la pilule « en retard », une
   * teinte VIVE réglée pour porter du blanc : **3,05:1** sur la carte sombre.
   * C'est la forme n° 37 de `megga/gardes-vacuites` prise par l'autre bout — là
   * un jeton d'encre servait d'aplat, ici un jeton d'aplat sert d'encre.
   *
   * ⚠ Les deux valeurs EXISTAIENT DÉJÀ dans le dépôt, il ne s'agissait pas d'en
   * inventer : `#B45309` est l'orangé foncé de `DossierTokens.warnDarker`, d'`EtatVide`
   * et du rapport PDF ; `#F0A05A` est la teinte d'écart NÉGATIF du survol de
   * cette trajectoire même (`AxDashboard`). La règle est celle de
   * `megga/da-meggax-crm` : la teinte VIVE va sur l'aplat, la FONCÉE sur le texte.
   */
  errInk: string
  /**
   * L'ACCENT MEGGA X et l'encre qu'on pose DESSUS — ajoutés au lot A4.
   *
   * ⚠ Ils remplacent `onAccent`, dont le sens CHANGEAIT avec le thème : il valait
   * `#030303` en sombre, soit **3,57:1** posé sur l'accent — le défaut EXACT que
   * le chantier KYC a corrigé sur `kycPalette.onAccent`. Ici il ne s'est jamais
   * VU, parce que personne ne le lisait ; il n'attendait qu'un lecteur. Retiré
   * avec les douze autres clés mortes plutôt que réparé. L'accent de MEGGA X est
   * `#424bfb` dans les deux thèmes, et l'encre qui tient dessus est le BLANC
   * (5,78:1) — c'est elle qui porte le contraste, jamais l'inverse.
   */
  accent: string
  accentInk: string
  /**
   * L'ACCENT EN ENCRE — l'autre moitié de la règle des deux jetons (`CLAUDE.md`
   * §3). `accent` est l'APLAT, `#424bfb` dans les deux thèmes, et c'est l'encre
   * blanche posée dessus qui porte le contraste (5,78:1). Posé en TEXTE ou en
   * TRAIT sur une surface sombre, le même bleu rend **3,44:1** — sous l'AA et
   * sous le seuil des filets. `MXC_SYSTEM.blue300` est le barreau que la
   * direction nomme pour ce cas exact (10,6:1).
   *
   * Il peint : le « Reste » du héro, les liens « Modifier » et « Ouvrir dans le
   * Pipeline », la courbe et le cône de la trajectoire, les sparklines.
   */
  accText: string
  /**
   * LES CHIPS DU GRAPHE — étiquettes « aujourd'hui », « projeté » et infobulle
   * de survol.
   *
   * ⛔ LEUR FOND EST L'ENCRE DU THÈME OPPOSÉ : noir en clair, blanc en sombre.
   * C'est ce qui les détache d'un tracé qu'elles chevauchent, et c'est aussi ce
   * qui INVERSE tout ce qui se pose dessus — l'accent y prend la valeur de
   * l'autre thème (`chipAcc`), et le vert/orangé d'écart aussi (`chipOk`,
   * `chipWarn`, à ne pas confondre avec `okInk`/`warnInk`, qui se posent sur la
   * CARTE). Une chip qui reprendrait les encres de la carte serait illisible :
   * `accText` sombre (#8dc1ff) sur une chip blanche rend 1,79:1.
   */
  chipBg: string
  chipInk: string
  chipAcc: string
  chipOk: string
  chipWarn: string
  /**
   * L'ÉCART À L'OBJECTIF au survol de la trajectoire — un segment de 2,5 px
   * entre la courbe et la ligne d'objectif. Famille qui ENCODE (au-dessus /
   * en dessous), donc hors direction, mais tenue au seuil des formes (3:1).
   */
  okInk: string
  warnInk: string
  /**
   * ⚠ ÉCRITS À LA MAIN EN SOMBRE, pour la même raison que `inkSoft` : un
   * chatoiement demande deux paliers ADJACENTS. En clair `n800 → n900` rend
   * 1,11:1, exactement la douceur d'origine. En sombre l'échelle saute de `n400`
   * à `n500`, soit **3,19:1** — un éclair, pas un chatoiement.
   */
  skBase: string
  skShine: string
}

export const AX: AxTheme = {
  card: MXC_COLOR.n1000,
  // La gouttière de jauge en clair : la carte étant le blanc pur, la
  // sous-surface ne peut que DESCENDRE. `n900` est le barreau de
  // `mxCrmPalette(false).cardSubBg`, et il rend 1,05:1 — la douceur qu'elle
  // avait déjà (1,07). En sombre le raisonnement s'inverse : voir `AX_DARK`.
  cardSubtle: MXC_COLOR.n900,
  ink: MXC_COLOR.n100,
  inkSoft: MXC_COLOR.n400,
  /**
   * ⛔ `muted` et `ghost` PRENNENT LES BARREAUX DU SYSTÈME (lot 1, 17 août 2026).
   *
   * `muted` valait `#80858E` : **3,71:1** sur sa propre carte blanche, sur
   * quinze emplois en `color:`. `ghost` valait `#B5BAC2` — **1,95:1** — et son
   * unique site est le `::placeholder` du champ d'objectif, c'est-à-dire le mot
   * qui dit quoi taper. Aucune des sept specs de contraste du dépôt ne regardait
   * cet objet ; le cliquet de grammaire le balaie mais ne mesure que la
   * composition.
   *
   * ⚠ Les deux prennent `n500`, et donc la MÊME valeur. Ce n'est pas une
   * fusion par paresse : un placeholder EST du texte secondaire, il porte le
   * seuil de texte, et le barreau plus clair qui les distinguait était
   * précisément le défaut. La clé reste séparée parce que son RÔLE l'est.
   */
  muted: MXC_COLOR.n500,
  /**
   * ⚠ `ghost` GARDE `n500` ALORS QUE LE HANDOFF ÉCRIT `n600`, et la raison est
   * une mesure, pas une préférence : son unique site est le `::placeholder` du
   * champ d'objectif — le mot qui dit quoi taper. `n600` (#a3a3a3) rend
   * **2,52:1** sur la carte blanche, très en dessous de l'AA. Le lot « encres
   * AA » du plan du 17 août, que le handoff déclare toujours valide, l'avait
   * précisément descendu pour cette raison.
   */
  ghost: MXC_COLOR.n500,
  hairline: MXC_COLOR.n800,
  border: MXC_COLOR.n700,
  focus: MXC_COLOR.n800,
  // ⚠ UNE SEULE OMBRE, ET UNE SEULE CLÉ. Elles étaient trois (`sm`, nu, `lg`)
  // du temps où chaque carte choisissait sa profondeur ; la nappe n'en peint
  // plus aucune, et les deux surfaces qui FLOTTENT — popover de drill, champ de
  // la porte — portent la même. Garder trois noms pour une valeur et deux
  // lecteurs, c'était fabriquer une clé morte à chaque relecture.
  shadow: MXC_CARD_SHADOW,
  /**
   * La LIGNE D'OBJECTIF de la trajectoire — un tracé, donc le seuil non textuel
   * (WCAG 1.4.11, 3:1), pas l'AA.
   *
   * ⚠ Elle valait `#C2C6CD` : **1,71:1** en clair, 2,49:1 en sombre. Ce n'est pas
   * du chrome de graphique — sur un cockpit de commission, l'objectif est la
   * référence que tout le reste sert à situer, et elle était un fantôme. `n500`
   * dans les DEUX thèmes : 5,57 en clair, 3,57 sur la carte sombre.
   */
  goal: MXC_COLOR.n500,
  /**
   * ⛔ LES DEUX PILULES ENCODENT — « en avance » / « en retard » sur l'objectif —
   * et restent donc hors direction, comme les teintes d'étape du pipeline.
   * L'arbitrage a été rendu quatre fois ; ce lot ne le rouvre pas.
   *
   * ⚠ Hors direction ne veut pas dire hors lisibilité, et elles y sont : la
   * teinte VIVE porte l'aplat, le BLANC porte le texte (7,18:1 et 5,64:1). C'est
   * exactement le motif que `AxGate` violait en peignant du TEXTE avec
   * `pillBehind.bg` — voir `errInk`.
   *
   * `pillNeutral` a été retirée avec les clés mortes : zéro lecteur.
   */
  pillAhead: { bg: '#15643F', fg: '#FFFFFF', sh: '0 1px 2px rgba(21,100,63,0.32), inset 0 -1px 0 rgba(0,0,0,0.10)' },
  pillBehind: { bg: '#A0521E', fg: '#FFFFFF', sh: '0 1px 2px rgba(160,82,30,0.32), inset 0 -1px 0 rgba(0,0,0,0.10)' },
  errInk: '#B45309',
  accent: MXC_COLOR.accent,
  accentInk: MXC_COLOR.n1000,
  accText: MXC_COLOR.accent,
  // La chip est NOIRE en clair : ce qui se pose dessus prend les valeurs du
  // thème sombre — l'accent-encre y est `blue300`, l'écart y est vert/jaune vifs.
  chipBg: MXC_COLOR.n100,
  chipInk: MXC_COLOR.n1000,
  chipAcc: MXC_SYSTEM.blue300,
  chipOk: MXC_SYSTEM.green400,
  chipWarn: MXC_SYSTEM.yellow400,
  okInk: '#15643F',
  warnInk: '#A0521E',
  skBase: MXC_COLOR.n800,
  skShine: MXC_COLOR.n900,
}

/**
 * ⛔ LE SOMBRE REJOINT L'ÉCHELLE MEGGA X (17 août 2026, décision Julien).
 *
 * Analytics portait une TROISIÈME échelle sombre — `#191B1F / #23262B / #1F2126`
 * — ni MEGGA X ni Graphite, ce qui explique que `graphite-scale` la déclarait
 * « propre » : il cherche les barreaux de Graphite, et ceux-là n'en sont pas.
 *
 * ⚠ LE GESTE EST INDIVISIBLE, et c'est une mesure qui le dit. Relevé au rendu :
 * la carte sortait à `rgb(25,27,31)` avec `borderWidth: 0px` sur un cadre bento
 * `#030303` — l'écart de luminance de **1,13:1 était le SEUL séparateur**, une
 * ombre noire sur un canvas quasi noir ne dessinant rien. Descendre à `n300`
 * seul donnerait 1,04:1 : les cartes disparaîtraient. La bordure doit tomber
 * dans le même mouvement.
 */
export const AX_DARK: AxTheme = {
  ...AX,
  card: MXC_COLOR.n300,
  /**
   * ⛔ CREUSÉE (`n200`) DEPUIS LA NAPPE, alors qu'elle était ÉLEVÉE (`n400`) —
   * et le renversement se lit dans ce qui BORDE, pas dans la teinte.
   *
   * Les emplois de `cardSubtle` sont des GOUTTIÈRES DE JAUGE : le rail de la
   * pace-bar, la piste du sélecteur de période, la colonne de fond des barres
   * « Commission par canal ». Une gouttière porte l'ÉCHELLE — elle dit jusqu'où
   * va le 100 %. `n200` rend **1,02:1** sur une carte `n300` : seule, elle
   * disparaît, et c'est ce qui avait fait remonter le jeton à `n400`.
   *
   * La nappe change la donnée du problème : les deux premières gouttières
   * portent désormais une `border` de 1 px (`hairline` pour la pace-bar,
   * `border` pour le segment), donc leur contour ne dépend plus de la
   * luminance. La troisième — la piste des barres de canal — reste sans filet,
   * et c'est l'écart assumé du handoff : sa référence est la colonne PLEINE,
   * pas son fond.
   *
   * Mesuré sur `n200` : `muted` 8,20 · `goal` 3,66 · l'aplat d'accent 3,58.
   */
  cardSubtle: MXC_COLOR.n200,
  // ⚠ `ink` valait `#F3F4F6` — attrapé par la clause « chaque couleur descend »,
  // pas à l'œil : l'écart avec le blanc pur est de 1,04:1, invisible. C'est
  // précisément ce qu'une garde voit et qu'une relecture ne voit pas.
  ink: MXC_COLOR.n1000, inkSoft: MXC_COLOR.n800,
  // `muted` sortait à 4,41:1 sur la carte et 3,88 sur la gouttière ; `ghost`,
  // le placeholder, à 1,91. Le plan ne les avait relevés qu'en CLAIR — une
  // garde d'un seul thème serait passée au vert dans les deux sens.
  // ⚠ `ghost` garde `n600` là où le handoff écrit `n500` : sur la carte sombre,
  // `n500` rend 3,58:1 — sous l'AA pour le mot qui dit quoi taper.
  muted: MXC_COLOR.n600, ghost: MXC_COLOR.n600,
  hairline: MXC_COLOR.n400,
  border: MXC_COLOR.n400,
  focus: MXC_COLOR.n400,
  /**
   * ⛔ AUCUNE OMBRE EN SOMBRE, ET PLUS D'ANNEAU NON PLUS.
   *
   * Ces trois clés portaient un filet `inset 0 0 0 1px n400` : c'est ainsi que
   * les quatorze cartes se séparaient du cadre quand elles flottaient encore.
   * La nappe leur retire ce travail — la gouttière de 1 px les sépare déjà — et
   * un anneau conservé DOUBLERAIT chaque filet, en épaississant les croisements.
   *
   * Ce qui reste à border est ce qui FLOTTE (popover, champ de la porte), et
   * ces deux-là portent une `border` explicite, visible à la lecture de leur
   * propre style plutôt que déduite d'un jeton d'ombre.
   */
  shadow: 'none',
  goal: MXC_COLOR.n500,
  errInk: '#F0A05A',
  accent: MXC_COLOR.accent,
  accentInk: MXC_COLOR.n1000,
  accText: MXC_SYSTEM.blue300,
  // La chip est BLANCHE en sombre : l'accent y reprend l'aplat `#424bfb`
  // (5,78:1) et l'écart, les teintes foncées des pilules.
  chipBg: MXC_COLOR.n1000,
  chipInk: MXC_COLOR.n100,
  chipAcc: MXC_COLOR.accent,
  chipOk: '#15643F',
  chipWarn: '#A0521E',
  okInk: MXC_SYSTEM.green400,
  warnInk: MXC_SYSTEM.yellow400,
  skBase: '#23262B', skShine: '#2F333A',
}

// Contexte de thème — le composant lit useAX() (provider posé par la page).
export const AXCtx = createContext<AxTheme>(AX)
export const useAX = (): AxTheme => useContext(AXCtx)

/**
 * Le THÈME de la palette Analytics, qu'elle ne publiait pas — dérivé, pas
 * deviné : la branche claire est la seule dont la carte est le blanc pur. Un
 * composant qui a besoin du THÈME (et non d'une couleur) le relisait sinon
 * ailleurs, ce qui fait deux sources pour un seul fait.
 */
export const useAxDark = (): boolean => useContext(AXCtx).card !== AX.card

// ── Formatters ───────────────────────────────────────────────────────────────
// fr-CH sépare les milliers par U+202F (espace fine insécable) : \s le couvre
// déjà. Ne pas réintroduire le caractère en clair — invisible en relecture.
export const axCHF = (n: number): string =>
  'CHF ' + Math.round(n).toLocaleString('fr-CH').replace(/\s/g, "'")

export const axShort = (n: number): string => {
  const a = Math.abs(n)
  if (a >= 1e6) return (n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 2).replace(/\.?0+$/, '') + 'M'
  if (a >= 1e3) return Math.round(n / 1e3) + 'k'
  return String(Math.round(n))
}
// ── Générateur de séries temporelles ─────────────────────────────────────────
export interface AxSeries { real: number[]; proj: number[]; goal: number[]; yMax: number; n: number; elapsed: number }

// (axBuildSeries — générateur de série décoratif — retiré : les séries sont
//  désormais construites en live par buildSeriesLive dans buildAxData.ts.)

// ── Deals « ce qui se signe bientôt » ────────────────────────────────────────
// gmv/when/days = champs décoratifs de la maquette ; en live ils sont vides
// (masqués si vides). comm/prob/stage sont alimentés depuis les contributeurs.
export interface AxDeal { prop: string; loc: string; gmv: number; comm: number; prob: number; stage: string; when: string; days: number }

// ── Dossiers derrière chaque bucket de composition (cible du drill) ──────────
// Le drill-down par bucket est différé V1 (records=null → « détails indisponibles »).
export interface AxRecord { prop: string; loc: string; gmv: number; comm: number; prob: number; state: string }
export interface AxBucket { label: string; hint: string; items: AxRecord[] }
export type AxBucketId = 'secured' | 'probable' | 'possible'

// ── Modèle de période ────────────────────────────────────────────────────────
export type AxPeriodId = 'month' | 'quarter' | 'year'

export interface AxKpi { label: string; value: string; delta: number; spark: number[]; pts?: boolean; abs?: boolean }
export interface AxCompositionItem { k: AxBucketId; label: string; hint: string; v: number }
export interface AxSource { label: string; sub: string; deals: number; comm: number; pct: number; delta: number; won?: number }

export interface AxPeriodData {
  key: AxPeriodId
  label: string
  scopeLabel: string
  period: string
  granularity: string
  pointWord: string
  target: number
  realizedNow: number
  projectedEnd: number
  paceFrac: number
  series: AxSeries
  axisLabels: string[]
  composition: AxCompositionItem[]
  kpis: AxKpi[]
  sources: AxSource[]
  // ── Extensions live (couche d'honnêteté A+C), optionnelles ────────────────
  /** L'agence a-t-elle saisi un objectif ? (false → CTA Réglages, masque pace-bar) */
  targetIsSet?: boolean
  /** Compteurs de fallback commission (taux 3% par défaut / prix manquant) */
  commissionFlags?: { nDefaultPct: number; nMissingPrice: number }
  /** Deals « ce qui se signe bientôt » (live, en prop au lieu de fixture) */
  closing?: AxDeal[]
  /** Dossiers par bucket pour le Drawer ; null = drill-down dégradé V1 */
  records?: Record<AxBucketId, AxBucket> | null
}

// ── Pace helper → objet verdict ──────────────────────────────────────────────
export interface AxPaceVerdict { paceNow: number; diff: number; ahead: boolean; projPct: number }
export const axPace = (d: AxPeriodData): AxPaceVerdict => {
  const paceNow = Math.round(d.target * d.paceFrac)
  const diff = d.realizedNow - paceNow
  const ahead = diff >= 0
  const projPct = Math.round((d.projectedEnd / d.target) * 100)
  return { paceNow, diff, ahead, projPct }
}

