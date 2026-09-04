/**
 * Surfaces de l'écran Messagerie dérivées de la palette MEGGA X (plan maître §1,
 * table « Report vers MEGGA X »). Une seule source : `sp`. Aucun littéral ici,
 * aucun dans les composants — les gardes `couleur-barreaux` et
 * `megga-x-crm-tokens` balaient `src/**`.
 *
 * ⚠ `MAIL_TRANSITION` et `PILL`, que le plan posait ici dès la tâche 2.1,
 * arrivent avec leur PREMIER consommateur (T2.4) : `lint:deadcode` refuse un
 * export que rien ne lit, et il a raison — une constante sans lecteur ne se
 * périme pas, elle se contredit en silence.
 */
import type { CrmPalette } from '@/components/crm/tokens'
import { crmVoileEncre } from '@/components/crm/tokens'
import { MXC_SYSTEM, encreSur } from '@/components/megga-x-crm/tokens'

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
