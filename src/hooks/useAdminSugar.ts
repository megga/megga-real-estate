/**
 * Palette Sugar de la console super-admin, dérivée du thème admin.
 *
 * Les Paramètres du CRM (`SettingsSugarV2Page`) calculent leur palette au
 * render — `crmSugarPalette(dark)` → `adminSurfaces(dark)`
 * — puis la font descendre en props. La console, elle, a 17 pages et 27
 * composants : enfiler `sp`/`surf`/`dark` partout serait un carnage d'imports.
 *
 * Ce hook lit le thème sur `AdminThemeProvider` (déjà branché sur la clé Sugar
 * `megga.sugar.dark`) et rend la MÊME palette que les Paramètres. Les atomes du
 * kit l'appellent eux-mêmes : les pages n'ont donc aucune prop de thème à
 * porter, et pourtant les valeurs viennent de `tokens.ts`, pas d'une copie.
 */
import { useMemo } from 'react'
import { useAdminTheme } from '@/components/admin/AdminThemeProvider'
import { crmSugarPalette, type SugarPalette } from '@/components/crm-sugar/tokens'
import { encreSur, MXC_COLOR } from '@/components/megga-x-crm/tokens'

/**
 * Surfaces Sugar Pure : blanc opaque en clair, verre subtil en sombre.
 *
 * Valeurs recopiées de `galSurfaces` (crm-sugar/biens/gallery/galHelpers.ts).
 * La duplication est VOLONTAIRE : `galHelpers` importe `@/i18n` pour ses
 * libellés de statut, et comme le kit admin est importé par les 42 surfaces de
 * la console, passer par lui traînait tout le bundle i18n dans le chunk partagé
 * du kit (mesuré : 570 kB, chaînes de locale incluses). `galSurfaces` ignore de
 * toute façon son argument de palette — c'est une table de constantes indexée
 * sur `dark`, donc rien de vivant n'est perdu ici. `tokens.ts`, lui, n'importe
 * rien : la palette continue de venir de la source de vérité.
 */
export interface AdminSurfaces {
  card: string
  cardSub: string
  hairline: string
  shadow: string
  shadowHov: string
}

/**
 * Exportée pour que la garde de contraste mesure les VRAIES surfaces.
 *
 * ⚠ Une garde qui recopierait ces cinq valeurs vérifierait sa propre copie —
 * c'est la deuxième forme de `megga/gardes-vacuites` : lier la règle à la
 * SOURCE, pas à une transcription qui se périmera au premier reciblage.
 */
export function adminSurfaces(dark: boolean): AdminSurfaces {
  return {
    card: dark ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
    cardSub: dark ? 'rgba(255,255,255,0.04)' : '#F4F6F9',
    hairline: dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(15,23,42,0.05)',
    shadow: dark
      ? '0 1px 2px rgba(0,0,0,.4), 0 10px 28px -12px rgba(0,0,0,.6)'
      : '0 1px 2px rgba(15,23,42,.04), 0 12px 34px -14px rgba(40,55,90,.20)',
    shadowHov: dark
      ? '0 1px 2px rgba(0,0,0,.5), 0 24px 50px -16px rgba(0,0,0,.7)'
      : '0 2px 6px rgba(15,23,42,.05), 0 26px 52px -18px rgba(40,55,90,.32)',
  }
}

/**
 * Couleurs fonctionnelles de la console (mêmes tons que `pfColors` des Réglages).
 *
 * ⚠ Chaque ton sert DEUX rôles — encre de texte et aplat de pilule — et les
 * contraintes des deux ne sont pas les mêmes. `tests/unit/admin-contraste.spec.ts`
 * les mesure séparément, dans les deux thèmes, et nomme le rôle de chacun.
 */
export interface AdminTones {
  ok: string
  warn: string
  err: string
  info: string
  cyan: string
  /**
   * Accent du KIT — l'accent MEGGA X, pas le violet de la plateforme.
   *
   * ⛔ Il n'est PAS le repère de contexte. Le violet dit « tu es dans la
   * console » et vit aux trois sites du rail (`AdminShell`) ; ce ton-ci est
   * offert à N composants du kit — pilule, icône d'indicateur, pastille de
   * titre — et suit donc la direction comme les autres accents du CRM.
   *
   * ⚠ APLAT et GLYPHE seulement : `#424bfb` rend 3,30:1 en texte sur la carte
   * sombre. La clause « aucun texte peint en accent » d'`admin-contraste`
   * garde cette limite au lieu de compter dessus.
   */
  accent: string
  /** Surface d'une pilule neutre (pas de signal). */
  neutralBg: string
  neutralInk: string
}

export interface AdminSugar {
  sp: SugarPalette
  surf: AdminSurfaces
  dark: boolean
  tones: AdminTones
  /**
   * Encre à poser SUR un aplat de ton — DÉRIVÉE de l'aplat, jamais choisie.
   *
   * ⛔ C'était un blanc constant, et c'est de là que venait le pire défaut du
   * périmètre : les six tons sombres sont réglés CLAIRS pour rester lisibles en
   * encre sur un canvas noir, si bien qu'une pilule pleine portait du blanc sur
   * du clair — 2,38:1 à 3,57:1, les six sous l'AA, dans les six cas.
   *
   * Une encre figée ne peut pas suivre un ton qui change de thème. Celle-ci le
   * suit par construction : changer un ton ne peut plus casser sa lisibilité.
   */
  onTone: (aplat: string) => string
}

/**
 * Palette + surfaces + tons de la console, mémorisés sur `dark`.
 *
 * Les tons clair/sombre suivent la convention `pfColors` : on assombrit en clair
 * pour tenir le contraste sur fond blanc, on éclaircit en sombre. Ne pas les
 * remplacer par les `text-*-500` de Tailwind — c'est précisément l'écart que
 * l'alignement corrige.
 */
/**
 * Tons fonctionnels de la console, purs et exportés — même raison
 * qu'`adminSurfaces` : la garde de contraste doit lire la SOURCE.
 */
export function adminTones(dark: boolean): AdminTones {
  const sp = crmSugarPalette(dark)
  const surf = adminSurfaces(dark)
  return {
    // ⛔ LES QUATRE TONS CLAIRS ONT DESCENDU D'UN BARREAU — mesuré, pas ajusté à
    // l'œil. Employés en ENCRE ils rendaient 3,40:1 à 4,46:1 sur les surfaces de
    // la console, les quatre sous l'AA. Les trois premières valeurs existaient
    // DÉJÀ au dépôt (`--color-success-dark`, `--color-warning-dark`,
    // `--color-danger-dark` de `globals.css`) : rien n'est inventé.
    ok: dark ? '#12A574' : '#047857',
    warn: dark ? '#E08A2E' : '#B45309',
    err: dark ? '#F26B65' : '#B91C1C',
    // `info` tenait déjà — 5,76:1 au pire. On ne recible pas ce qui passe.
    info: dark ? '#4C86E8' : '#1E5BC6',
    // ⚠ SEULE des quatre à n'avoir aucun équivalent au dépôt : il n'existe pas
    // de `--color-cyan-dark`. C'est le barreau SUIVANT de l'échelle dont
    // `#0891B2` est tiré (cyan-600 → cyan-700), pas une teinte choisie.
    cyan: dark ? '#22B8CF' : '#0E7490',
    // ⛔ ET IL ÉTAIT INVISIBLE À TOUTE GARDE STATIQUE. Écrit
    // `rgb(var(--color-admin-accent))`, ce ton n'existait qu'au rendu : aucune
    // lecture de source ne pouvait le mesurer, et la clause qui refuse une
    // couleur illisible est ce qui l'a montré. Il vaut désormais l'accent de la
    // direction — 5,34:1 en encre claire contre 3,91 au violet.
    accent: MXC_COLOR.accent,
    neutralBg: surf.cardSub,
    neutralInk: sp.soft,
  }
}

export function useAdminSugar(): AdminSugar {
  const { dark } = useAdminTheme()

  return useMemo(() => {
    const sp = crmSugarPalette(dark)
    const surf = adminSurfaces(dark)
    const tones = adminTones(dark)

    return { sp, surf, dark, tones, onTone: encreSur }
  }, [dark])
}
