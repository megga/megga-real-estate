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
import { MLK_STATUT } from '@/components/kyc-magic-link/mlkTokens'

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
 * Les deux encres sémantiques du thème CLAIR, IMPORTÉES et non recopiées.
 *
 * ⛔ AUCUN BARREAU DE MEGGA X NE PORTE DU TEXTE ROUGE OU VERT SUR BLANC, et ce
 * n'est pas un oubli : la vitrine est mono-thème sombre, ses couleurs de système
 * sont réglées pour un canvas `#030303` (CLAUDE.md §3). Balayé le 05.09.2026 sur
 * les **96 barreaux** dérivés de `megga-x-crm/tokens.ts` et de la feuille de la
 * vitrine — le rouge le plus foncé rend **4,09:1** sur blanc, le vert le plus
 * foncé **1,89:1**. Aucun n'atteint l'AA.
 *
 * ⛔ ET ON NE PEUT PAS NON PLUS ÉCRIRE DEUX LITTÉRAUX ICI : le cliquet
 * `couleur-barreaux` plafonne `src/components/crm` à un inventaire qui « ne peut
 * que RÉTRÉCIR ». Deux valeurs neuves l'ont fait rougir (540 > 538).
 *
 * `MLK_STATUT` est la sortie de ce faux dilemme, et ce n'est pas un détour :
 * c'est la famille que le dépôt s'est déjà donnée pour ce rôle exact — « la
 * famille qui ENCODE, tenue SÉPARÉE parce que la direction ne la gouverne pas »
 * —, mesurée en août (6,47:1 et 5,48:1 sur carte blanche) et **déjà consommée
 * hors de sa zone** par `crm-identity/IdentityVerificationReturnScreen`. Une
 * encre d'alerte qui diffère d'un écran à l'autre coûte plus que deux points de
 * contraste (CLAUDE.md §3) : elle doit être la MÊME, donc importée.
 *
 * ⚠ Son module porte encore le nom de sa première zone (`kyc-magic-link`). Au
 * troisième consommateur hors zone, elle mérite un domicile neutre — le
 * déplacer maintenant toucherait la face publique pour un gain de lecture.
 */
const ALERTE_CLAIR = MLK_STATUT.errInk
const SUCCES_CLAIR = MLK_STATUT.okInk

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
  /**
   * ── LES TROIS ENCRES SÉMANTIQUES, ET POURQUOI ELLES NE SONT PAS LES APLATS ──
   *
   * ⛔ Mesuré le 05.09.2026 en écrivant `messagerie-contraste.spec.ts` : les
   * couples APLAT + `encreSur` passaient tous, et les mêmes jetons employés en
   * ENCRE échouaient — la forme n° 37 de `megga/gardes-vacuites`, un jeton qui
   * sert de fond ET d'encre et n'est mesuré que d'un côté.
   *
   *   · `accent` en texte sur carte SOMBRE  : 3,44:1  ⛔ (le cas nommé CLAUDE.md §3)
   *   · `danger` en texte sur carte CLAIRE  : 3,11:1  ⛔ (message d'erreur `role="alert"`)
   *   · `success` en glyphe sur carte CLAIRE: 1,35:1  ⛔ (la coche « déjà classée »)
   *
   * Les remplaçantes ne sont pas choisies, elles sont REPRISES : `blue300` est le
   * barreau que CLAUDE.md §3 nomme déjà pour l'encre teintée sur sombre, et
   * `#B91C1C` / `#047857` sont les deux valeurs que la face publique a mesurées
   * en août (`MLK_STATUT`). Une encre d'alerte qui diffère d'un écran à l'autre
   * coûte plus que deux points de contraste.
   */
  accentText: string
  dangerText: string
  successText: string
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
    accentText: dark ? MXC_SYSTEM.blue300 : sp.accent,
    dangerText: dark ? MXC_SYSTEM.red400 : ALERTE_CLAIR,
    successText: dark ? MXC_SYSTEM.green300 : SUCCES_CLAIR,
    shadow: sp.shadow,
    solid: sp.solidBg,
    solidBorder: sp.solidBorder,
    solidShadow: sp.solidShadow,
  }
}
