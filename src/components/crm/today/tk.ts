// MEGGA CRM — Refonte « Aujourd'hui » · TOKENS (port fidèle du prototype)
// ----------------------------------------------------------------------------
// Port 1:1 de `today-redesign-kit.jsx` (handoff Claude Design, juin 2026).
// `TK` est un singleton muté EN PLACE par `applyTK(dark)` : sombre immersif
// (défaut) ↔ clair Sugar. Tous les composants lisent `TK` au rendu, donc
// basculer l'ambiance « allume » l'ensemble du cockpit (et la modale Détail
// du match), pas seulement la chrome.
//
// Le pager appelle `applyTK(dark)` en tête de render ; le sous-arbre se
// re-render sur le changement de `dark`, donc lire le singleton muté au render
// renvoie toujours l'ambiance courante (comportement identique au proto).

import { crmVoileEncre } from '@/components/crm/tokens'
import { MXC_CARD_SHADOW, MXC_COLOR, MXC_DARK_SURFACE } from '@/components/megga-x-crm/tokens'

export interface TkTone {
  bg: string
  fg: string
  dot: string
}

export interface Tk {
  bg: string
  bgGrad: string
  frame: string
  frameSolid: string
  frameHi: string
  border: string
  borderHi: string
  card: string
  cardHi: string
  cardBorder: string
  ink: string
  /**
   * Accent UI unique (CTA pleins, pilules actives, toast) — le bleu MEGGA.
   *
   * ⚠ Il ne s'inverse PAS entre les thèmes : il portait l'encre de Sugar Pure
   * (noir en clair, off-white en sombre), ce qui faisait de « l'élément actif »
   * une non-couleur. Sous MEGGA X l'actif porte la marque, dans les deux modes.
   */
  accent: string
  /** Texte posé sur `accent`. */
  accentInk: string
  inkDim: string
  sub: string
  faint: string
  primary: string
  primarySoft: string
  shadow: string
  shadowLg: string
  ok: TkTone
  warn: TkTone
  danger: TkTone
  info: TkTone
  neutral: TkTone
  mode: 'dark' | 'light'
}

// Surfaces en GETTERS : `applyTK` les recopie par `Object.assign` à chaque
// rendu du cockpit, donc elles sont relues — la palette suit la teinte active
// sans figer sa valeur au chargement du module.
const TK_DARK: Omit<Tk, 'mode'> = {
  // ⛔ LES SURFACES NE SORTENT PLUS DE `MXC_COLOR` — elles viennent de
  // `MXC_DARK_SURFACE`, l'échelle propre au CRM (cf. son bloc dans
  // `megga-x-crm/tokens.ts`). Le cockpit lisait les barreaux n100..n400 EN
  // DIRECT, sans passer par `mxCrmPalette` : changer la palette ne le
  // repeignait donc pas, et il porte la plus grande surface de l'écran.
  // ⛔ UNE SEULE SURFACE (20.09.2026) : le cadre et la carte rendent le gris du
  // canvas. Ce qui les sépare est `border` / `cardBorder`, les deux voiles
  // ci-dessous — pas un écart de clarté.
  bg: MXC_DARK_SURFACE.s0,
  bgGrad: MXC_DARK_SURFACE.s0,
  frame: MXC_DARK_SURFACE.s0,
  frameSolid: MXC_DARK_SURFACE.s0,
  frameHi: MXC_DARK_SURFACE.s0,
  // ⚠ UNE SEULE FORCE DE FILET (20.09.2026) : 0,09 rend ΔL* 10,13 sur le
  // canvas, soit exactement le jeton `MXC_DARK_SURFACE.line`. `borderHi`
  // valait 0,14 — une seconde force héritée, sans motif écrit. Un filet
  // d'emphase se DÉCIDE ; les états forts portent déjà l'accent ou la teinte.
  border: 'rgba(255,255,255,0.09)',
  borderHi: 'rgba(255,255,255,0.09)',
  card: MXC_DARK_SURFACE.s0,
  // Survol : un ÉTAT, donc le premier barreau.
  cardHi: MXC_DARK_SURFACE.s1,
  cardBorder: 'rgba(255,255,255,0.09)',
  ink: '#ECEDF3',
  accent: MXC_COLOR.accent,
  accentInk: MXC_COLOR.n1000,
  inkDim: '#B5B7C4',
  sub: '#797D90',
  faint: '#54576A',
  primary: '#6F8CFF',
  primarySoft: 'rgba(111,140,255,0.14)',
  /**
   * ⛔ TROIS OMBRES PORTÉES NOIRES VIVAIENT ICI, et c'est le PAGER qui les
   * portait le plus visiblement — `shadowLg` peignait un halo de 70 px de flou
   * à 75 % de noir sous un panneau de 1128×822 (relevé par Julien au rendu, le
   * 20.09.2026, après la même trouvaille sur le dock MEGGA AI).
   *
   * Elles ne se voyaient pas tant que le canvas valait `#030303` : du noir sur
   * du noir. Le plancher monté à `#16181c`, chacune ASSOMBRIT le canvas autour
   * de ce qu'elle borde — la surface ne se pose plus sur l'app, elle y creuse.
   *
   * `CLAUDE.md` §3 l'écrit depuis toujours : en sombre on sépare par la
   * BORDURE, et `mxCrmPalette(true).shadow` vaut `'none'`. Le cockpit
   * dérogeait, seul, sans motif écrit. Ses surfaces portent déjà `border` et
   * `cardBorder` — elles ne perdent rien.
   *
   * ⚠ `TK_LIGHT` garde les siennes : ce sont des voiles d'ENCRE
   * (`crmVoileEncre(false, …)`), ce que la grammaire claire autorise.
   */
  shadow: 'none',
  shadowLg: 'none',
  ok: { bg: '#15643F', fg: '#DBF4E6', dot: '#34C796' },
  warn: { bg: '#7A3F12', fg: '#F7DDBE', dot: '#F2B855' },
  danger: { bg: '#7E1C36', fg: '#F6CBD6', dot: '#F26B65' },
  info: { bg: '#1B3A6E', fg: '#C7D9F6', dot: '#6F8CFF' },
  neutral: { bg: '#23232F', fg: '#C8C9D2', dot: '#797D90' },
}

// Ambiance claire — Sugar Pure neutre (gris, aucun bleu de fond).
const TK_LIGHT: Omit<Tk, 'mode'> = {
  // ⛛ DEUX BLANCS SE DISPUTAIENT LE CLAIR, et ça se voyait — « le blanc n'est
  // pas le même blanc » (Julien, 20.09.2026). Mesuré au rendu : ce canvas à
  // `#EBEDF1` (L* 93,70) sur 2 219k px², contre le `pageBg` de la palette à
  // `#f9f9f9` (L* 97,93) sur 1 298k px². ΔL* 4,23 d'écart, côte à côte.
  //
  // `#EBEDF1` n'était un barreau de RIEN — ni la vitrine, ni l'échelle du CRM.
  // `n900` en est un, et c'est déjà ce que rend `mxCrmPalette(false).pageBg`.
  // C'est aussi la « plaque » que trois fichiers décrivent déjà en commentaire
  // (`AgentLayout`, `CrmTabsBar`, `usePousseeDock`) : elle disparaît avec.
  //
  // ⚠ La carte blanche perd de la séparation de fond (ΔL* 6,30 → 2,07) : c'est
  // son FILET qui la porte, comme en sombre. Ne pas réassombrir le canvas
  // pour « faire ressortir » les cartes — ce serait revenir à deux blancs.
  bg: MXC_COLOR.n900,
  bgGrad: MXC_COLOR.n900,
  frame: '#FFFFFF',
  frameSolid: '#FFFFFF',
  frameHi: '#F5F6F8',
  border: crmVoileEncre(false, 0.09),
  borderHi: crmVoileEncre(false, 0.16),
  card: crmVoileEncre(false, 0.028),
  cardHi: crmVoileEncre(false, 0.055),
  cardBorder: crmVoileEncre(false, 0.08),
  ink: MXC_COLOR.n100,
  accent: MXC_COLOR.accent,
  accentInk: MXC_COLOR.n1000,
  inkDim: '#3A3D44',
  sub: '#6B7079',
  faint: '#9CA1AB',
  primary: '#2A2D34',
  primarySoft: 'rgba(42,45,52,0.10)',
  // ⛛ TROIS OMBRES SUR MESURE, DE 22 À 70 px DE FLOU, là où la direction
  // n'en connaît QU'UNE : `MXC_CARD_SHADOW` (`0 2px 6px`), l'ombre de carte
  // de la vitrine — celle que rend déjà la carte latérale.
  //
  // ⚠ Le défaut se voyait dans la GOUTTIÈRE : 12 px entre le pager et le
  // dock MEGGA AI, pour des halos de 70 et 80 px de flou. Ils se
  // recouvraient et peignaient une bande sombre entre les deux panneaux
  // (relevé par Julien le 20.09.2026). Une ombre plus large que l'espace
  // qui la reçoit ne sépare plus rien : elle salit.
  //
  // ⚠ Le CLAIR garde une ombre, contrairement au sombre — c'est sa
  // grammaire, qui sépare par un palier ET une ombre courte. Ce qui est
  // retiré, ce sont les valeurs SUR MESURE, pas l'ombre elle-même.
  shadow: MXC_CARD_SHADOW,
  shadowLg: MXC_CARD_SHADOW,
  ok: { bg: '#DBF2E6', fg: '#15643F', dot: '#15923F' },
  warn: { bg: '#FBE8D0', fg: '#8A4B12', dot: '#D98A2B' },
  danger: { bg: '#FADBE2', fg: '#8E1F3D', dot: '#D7475F' },
  info: { bg: '#DEE8FA', fg: '#1E4B8E', dot: '#3A6FD0' },
  neutral: { bg: '#E9EBEF', fg: '#3A3D44', dot: '#6B7079' },
}

// Palette vivante : démarre en sombre, mutée en place par applyTK.
export const TK: Tk = { ...TK_DARK, mode: 'dark' }

export function applyTK(dark: boolean): void {
  Object.assign(TK, dark === false ? TK_LIGHT : TK_DARK)
  TK.mode = dark === false ? 'light' : 'dark'
}
