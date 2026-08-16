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
//  · en CLAIR les cartes gardent leurs ombres douces et n'ont pas de bordure ;
//  · l'accent dataviz (périwinkle) ne vit PAS ici mais dans `AxDashboard`
//    (`AXF_ACCENTS`, `AXF_BUCKET_TONE`) : c'est lui qui peint la décomposition.
//
// ⚠ Ce fichier portait TREIZE clés sans aucun lecteur, dont `secured`,
// `probable` et `possible` — qui ressemblaient à la décomposition de la
// commission, donc à une famille qui ENCODE, donc intouchable. Mesuré, elles ne
// peignaient RIEN depuis la refonte fusion. Une clé sans lecteur n'est pas
// « hors direction », elle est MORTE. Gardé par `tests/unit/analytics-contraste.spec.ts`.

import { sgVoileEncre } from '@/components/crm-sugar/tokens'
import { MXC_COLOR } from '@/components/megga-x-crm/tokens'
import { createContext, useContext } from 'react'

export interface AxPill { bg: string; fg: string; sh: string }

export interface AxTheme {
  card: string
  cardSubtle: string
  ink: string
  /**
   * ⚠ ÉCRIT À LA MAIN, et l'échelle est la raison. Le cran intermédiaire entre
   * l'encre et le texte secondaire n'existe pas dans `MXC_COLOR` : en clair
   * `n400` (#181818) sort à **1,16:1** de `n100`, en sombre `n800` à **1,17:1**
   * du blanc — ils ne feraient pas un cran, ils feraient un DOUBLON. Les valeurs
   * d'ici tiennent 1,90 et 1,97. Le jour où la vitrine gagne ce barreau, ces deux
   * lignes doivent partir.
   */
  inkSoft: string
  muted: string
  ghost: string
  hairline: string
  shadowSm: string
  shadow: string
  shadowLg: string
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
   * inventer : `#B45309` est l'orangé foncé de `SugarV3.warnDarker`, d'`EtatVide`
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
  inkSoft: '#3A3D44',
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
  ghost: MXC_COLOR.n500,
  hairline: `${sgVoileEncre(false, 0.07)}`,
  // ⚠ Les ombres douces RESTENT en clair : c'est l'idiome de cette surface —
  // aucune carte n'y porte de bordure. C'est en SOMBRE qu'elles disparaissent.
  shadowSm: `0 4px 16px ${sgVoileEncre(false, 0.05)}`,
  shadow: `0 14px 44px ${sgVoileEncre(false, 0.07)}, 0 2px 8px ${sgVoileEncre(false, 0.04)}`,
  shadowLg: `0 28px 70px ${sgVoileEncre(false, 0.10)}, 0 6px 18px ${sgVoileEncre(false, 0.05)}`,
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
   * ⛔ ÉLEVÉE, PAS CREUSÉE — et c'est une mesure, pas une préférence.
   *
   * Les TROIS emplois de `cardSubtle` sont des GOUTTIÈRES DE JAUGE : le rail de
   * la pace-bar, celui du sélecteur de période, et la colonne de fond des barres
   * « Commission par canal ». Une gouttière porte l'ÉCHELLE — c'est elle qui dit
   * jusqu'où va le 100 %. La faire disparaître retire la référence, pas un décor.
   *
   * Or `n200` (la sous-surface creusée de `CLAUDE.md`) rend **1,02:1** sur une
   * carte `n300` : l'écart que `CLAUDE.md` §3 cite lui-même comme ne séparant
   * PAS. `n400` rend **1,12:1** — exactement l'écart que cet écran avait avant ce
   * lot (1,14:1), et celui de l'anneau qui borde les cartes. Le mode de
   * conversion mécanique vers le palier creusé est le défaut qu'avait produit la
   * migration Graphite du pipeline ; on ne le rejoue pas.
   *
   * Mesuré dessus : `muted` 7,04 · `goal` 3,19 · l'aplat d'accent du segment 3,07.
   */
  cardSubtle: MXC_COLOR.n400,
  // ⚠ `ink` valait `#F3F4F6` — attrapé par la clause « chaque couleur descend »,
  // pas à l'œil : l'écart avec le blanc pur est de 1,04:1, invisible. C'est
  // précisément ce qu'une garde voit et qu'une relecture ne voit pas.
  ink: MXC_COLOR.n1000, inkSoft: '#B4B9C2',
  // `muted` sortait à 4,41:1 sur la carte et 3,88 sur la gouttière ; `ghost`,
  // le placeholder, à 1,91. Le plan ne les avait relevés qu'en CLAIR — une
  // garde d'un seul thème serait passée au vert dans les deux sens.
  muted: MXC_COLOR.n600, ghost: MXC_COLOR.n600,
  hairline: 'rgba(255,255,255,0.08)',
  /**
   * ⛔ AUCUNE OMBRE EN SOMBRE — `mxCrmPalette(true)` rend `'none'`, et la
   * séparation vient de la BORDURE. Le filet est posé en ANNEAU INSET plutôt
   * qu'en `border`, et ce n'est pas un raccourci :
   *
   * · il suit le JETON. Les quatorze cartes le reçoivent par les `shadow*`
   *   qu'elles portent déjà — trois valeurs à écrire au lieu d'une passe de
   *   substitution sur quinze sites, dont une s'emballe (14 141 lignes ajoutées
   *   à ce fichier lors d'un lot précédent) ;
   * · il exclut la quinzième. Le seul `background: A.card` SANS ombre est la
   *   FLÈCHE du popover de drill — un carré de 14 px pivoté à 45°. Un `border`
   *   y aurait dessiné un losange en travers de la carte ; une passe mécanique
   *   l'aurait touchée, le jeton ne la voit pas ;
   * · il ne coûte aucune boîte, là où un `border` en dépend du `box-sizing`.
   */
  shadowSm: `inset 0 0 0 1px ${MXC_COLOR.n400}`,
  shadow: `inset 0 0 0 1px ${MXC_COLOR.n400}`,
  shadowLg: `inset 0 0 0 1px ${MXC_COLOR.n400}`,
  goal: MXC_COLOR.n500,
  errInk: '#F0A05A',
  accent: MXC_COLOR.accent,
  accentInk: MXC_COLOR.n1000,
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

