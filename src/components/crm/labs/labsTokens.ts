/**
 * Les surfaces du studio Labs, dérivées de la palette MEGGA X — sur le précédent de
 * `mailSurfaces` : aucune teinte n'est écrite ici, chaque rôle descend d'un jeton.
 *
 * ⚠ La barre de prompt et la visionneuse FLOTTENT : elles prennent la surface OPAQUE
 * (`sp.solidBg`, bordure et ombre renforcées), pas la carte, sans quoi la galerie
 * transparaît derrière le texte qu'on tape.
 *
 * ⛔ **EN SOMBRE, `elev` N'EST PLUS UNE SURFACE CREUSÉE** (PR #1335, 20.09.2026 :
 * « une seule surface, un seul filet, aucune ombre portée »). `sp.cardSubBg` rend le
 * MÊME gris que la carte — mesuré à l'écran, `rgb(22,24,28)` des deux côtés. Un
 * élément qui n'avait qu'un fond `elev` y devient donc INVISIBLE : le bouton
 * d'attache de la barre l'était, sans bordure ni ombre.
 *
 * La règle du merge est explicite — « ce qui doit ressortir prend une BORDURE, pas un
 * fond ». D'où `bordDouce` : le filet des affordances qui, en clair, se contentaient
 * de leur fond. Ne pas « réparer » en redonnant un palier à `elev` — c'est la pile
 * qu'on vient de retirer.
 */
import type { CrmPalette } from '@/components/crm/tokens'
import { crmVoileAssombrissant, crmVoileEncre } from '@/components/crm/tokens'
import { MXC_COLOR, MXC_SYSTEM, encreSur } from '@/components/megga-x-crm/tokens'
import { STATUT_CLAIR } from '@/components/megga-x-crm/statut'

export const LABS_PILL = 'var(--crm-radius-pill)'
export const LABS_TRANSITION = 'background .12s, color .12s, border-color .12s, opacity .12s'

export interface LabsSurfaces {
  side: string
  card: string
  elev: string
  hover: string
  bord: string
  bord2: string
  ink: string
  sub: string
  soft: string
  accent: string
  accentInk: string
  /** Encre teintée lisible sur la surface du thème (bleu clair en sombre). */
  accentText: string
  danger: string
  dangerInk: string
  dangerText: string
  okText: string
  warnText: string
  shadow: string
  solid: string
  solidBorder: string
  solidShadow: string
  /** Voile qui ASSOMBRIT une photo (bas de vignette) — jamais le voile d'encre. */
  photoVeil: (alpha: number) => string
  /** L'encre posée SUR ce voile : blanche dans les deux thèmes, le voile étant toujours sombre. */
  onPhoto: string
  /** Voile d'interaction sur la surface du thème (survol, filet). */
  inkVeil: (alpha: number) => string
  /**
   * Le filet d'une affordance qui, en CLAIR, se lit par son seul fond `elev`.
   * En SOMBRE ce fond vaut la carte : sans lui, l'élément disparaît.
   */
  bordDouce: string
}

export function labsSurfaces(sp: CrmPalette, dark: boolean): LabsSurfaces {
  return {
    side: sp.pageBg,
    card: sp.cardBg,
    elev: sp.cardSubBg,
    hover: sp.focusSurface,
    bord: sp.cardBorder,
    bord2: sp.frameBorder,
    ink: sp.ink,
    sub: sp.sub,
    soft: sp.soft,
    accent: sp.accent,
    accentInk: sp.accentInk,
    accentText: dark ? MXC_SYSTEM.blue300 : sp.accent,
    danger: MXC_SYSTEM.red400,
    dangerInk: encreSur(MXC_SYSTEM.red400),
    dangerText: dark ? MXC_SYSTEM.red400 : STATUT_CLAIR.errInk,
    okText: dark ? MXC_SYSTEM.green300 : STATUT_CLAIR.okInk,
    warnText: dark ? MXC_SYSTEM.yellow400 : STATUT_CLAIR.warnInk,
    shadow: sp.shadow,
    solid: sp.solidBg,
    solidBorder: sp.solidBorder,
    solidShadow: sp.solidShadow,
    photoVeil: (alpha) => crmVoileAssombrissant(alpha),
    onPhoto: MXC_COLOR.n1000,
    // ⚠ En clair, le fond `elev` suffit — pas de filet, pas de bruit ajouté.
    bordDouce: dark ? sp.cardBorder : 'transparent',
    inkVeil: (alpha) => crmVoileEncre(dark, alpha),
  }
}
