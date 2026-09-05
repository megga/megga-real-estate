/**
 * Surfaces de l'écran Messagerie dérivées de la palette MEGGA X (plan maître §1,
 * table « Report vers MEGGA X »). Une seule source : `sp`. Aucun littéral ici,
 * aucun dans les composants — les gardes `couleur-barreaux` et
 * `megga-x-crm-tokens` balaient `src/**`.
 *
 * ⚠ `MAIL_TRANSITION` et `PILL` arrivent ICI, à la tâche 2.4, avec leur PREMIER
 * consommateur — et non dès 2.1 comme le plan les posait : `lint:deadcode`
 * refuse un export que rien ne lit, et il a raison. Une constante sans lecteur
 * ne se périme pas, elle se contredit en silence.
 */
import type { CrmPalette } from '@/components/crm/tokens'
import { crmVoileEncre } from '@/components/crm/tokens'
import { MXC_SYSTEM, encreSur } from '@/components/megga-x-crm/tokens'

/**
 * La transition unique de l'écran. Une seule durée pour tout ce qui réagit au
 * survol — rail, lignes, pastilles : deux durées voisines sur une même surface
 * se lisent comme un défaut de rendu, pas comme une intention.
 */
export const MAIL_TRANSITION = 'background .12s, color .12s, border-color .12s, opacity .12s'

/**
 * Le rayon des pilules (rayon 999 de la maquette).
 *
 * ⚠ C'est une CONSTANTE et non le littéral `'var(--crm-radius-pill)'` recopié :
 * le jeton est cité dix-neuf fois sur cet écran, et une faute de frappe dans un
 * `var()` ne casse rien de visible — la déclaration est simplement écartée et
 * le coin redevient carré, sans qu'aucune garde ne le dise (clause « chaque
 * barreau cité existe vraiment » de `megga-x-grammar` ne couvre que le texte).
 */
export const PILL = 'var(--crm-radius-pill)'

/**
 * `hsl` → `#rrggbb`, pour la teinte libre du créateur de libellé.
 *
 * ⚠ Elle vit ICI et non dans `MailLabelCreator.tsx`, où le plan l'écrivait :
 * `react-refresh/only-export-components` est une ERREUR dans ce dépôt, et un
 * fichier de composant qui exporte aussi une fonction la déclenche. La garder
 * exportée compte : c'est la seule partie calculée de la couleur d'un libellé,
 * donc la seule qui puisse mentir en silence.
 */
export function hslToHex(h: number, s: number, l: number): string {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100)
  const canal = (n: number) => {
    const k = (n + h / 30) % 12
    const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(255 * c).toString(16).padStart(2, '0')
  }
  return `#${canal(0)}${canal(8)}${canal(4)}`
}

export interface MailSurfaces {
  /** fond du bento (`--side`) */ side: string
  /** carte (`--card`) */ card: string
  /** surface creusée : champs, pilules, ligne active (`--elev`) */ elev: string
  /** survol (`--hover` / `--hover2`) */ hover: string
  hover2: string
  /** bordures (`--bord`, `--bord2`, `--bord3`) */ bord: string
  bord2: string
  bord3: string
  ink: string
  txt2: string
  txt3: string
  mut: string
  dim: string
  accent: string
  accentInk: string
  /** étoile suivie */ star: string
  /** encre des libellés « À traiter » etc. sur leur aplat */ pillInk: (bg: string) => string
  danger: string
  dangerInk: string
  success: string
  successInk: string
  shadow: string
  solid: string
  solidBorder: string
  solidShadow: string
}

/** Les surfaces de l'écran pour un thème donné. Mémoïser chez l'appelant. */
export function mailSurfaces(sp: CrmPalette, dark: boolean): MailSurfaces {
  return {
    side: sp.pageBg,
    card: sp.cardBg,
    elev: sp.cardSubBg,
    hover: sp.focusSurface,
    hover2: crmVoileEncre(dark, 0.06),
    bord: sp.cardBorder,
    bord2: sp.frameBorder,
    bord3: sp.solidBorder,
    ink: sp.ink,
    txt2: sp.ink,
    txt3: sp.sub,
    mut: sp.soft,
    dim: crmVoileEncre(dark, 0.25),
    accent: sp.accent,
    accentInk: sp.accentInk,
    star: MXC_SYSTEM.yellow400,
    pillInk: (bg) => encreSur(bg),
    danger: MXC_SYSTEM.red400,
    dangerInk: encreSur(MXC_SYSTEM.red400),
    success: MXC_SYSTEM.green300,
    successInk: encreSur(MXC_SYSTEM.green300),
    shadow: sp.shadow,
    solid: sp.solidBg,
    solidBorder: sp.solidBorder,
    solidShadow: sp.solidShadow,
  }
}
