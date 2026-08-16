// MEGGA CRM — Kit « Focus » des Réglages : constantes, palette dérivée et types.
// Séparé de pfKit.tsx (composants) pour respecter react-refresh/only-export-components
// (un fichier ne mélange pas exports composants et non-composants). Idem galHelpers.ts.

import { crmVoileEncre } from '@/components/crm/tokens'
import type { CrmPalette } from '../../tokens'
import type { GalSurfaces } from '../../biens/gallery/galHelpers'
import { MXC_COLOR, MXC_SYSTEM } from '@/components/megga-x-crm/tokens'

/** Props communes aux sections « Focus » (rendues dans le bento des Réglages). */
export interface FocusSectionProps {
  sp: CrmPalette
  surf: GalSurfaces
  dark: boolean
  setDark?: (v: boolean) => void
}

/* ─── Icônes (SVG stroke line 1.7) ─────────────────────────────────────────── */
export const PF_ICONS = {
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  smartphone: <><rect x="7" y="3" width="10" height="18" rx="2.2" /><path d="M11 18h2" /></>,
  phone: <path d="M4 4h4l2 5-3 2a12 12 0 0 0 6 6l2-3 5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 3 5a1 1 0 0 1 1-1Z" />,
  building: <><path d="M3 21V7l9-4 9 4v14" /><path d="M9 21V12h6v9" /><path d="M9 8h.01M15 8h.01" /></>,
  briefcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" /></>,
  camera: <><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" /><circle cx="12" cy="13" r="3.4" /></>,
  check: <path d="m5 12 5 5L20 7" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11.5v5M12 7.75h.01" /></>,
  bell: <><path d="M6 8a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9Z" /><path d="M10 21a2 2 0 0 0 4 0" /></>,
  chat: <path d="M20 4H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h4v4l5-4h7a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1Z" />,
  seal: <><path d="m12 2 2.5 1.9 3.1-.2 1 3 2.7 1.6-.9 3 .9 3-2.7 1.6-1 3-3.1-.2L12 22l-2.5-1.9-3.1.2-1-3L2.7 16l.9-3-.9-3 2.7-1.6 1-3 3.1.2Z" /><path d="m9 12 2 2 4-4" /></>,
  lock: <><rect x="4" y="10" width="16" height="11" rx="2.2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  link: <><path d="M9.5 14.5 14.5 9.5" /><path d="M12 6.5 13.6 4.9a3.6 3.6 0 0 1 5.5 5.5l-2 2" /><path d="M12 17.5 10.4 19.1a3.6 3.6 0 0 1-5.5-5.5l2-2" /></>,
  linkedin: <path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2ZM8.3 18.3H5.7V10h2.6v8.3ZM7 8.8a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm11.3 9.5h-2.6v-4c0-1 0-2.2-1.3-2.2s-1.5 1-1.5 2.2v4H10.3V10h2.5v1.1c.4-.6 1.2-1.3 2.5-1.3 2.6 0 3.1 1.7 3.1 4v4.5Z" />,
  lang: <><path d="M4 6h9M8.5 4v2c0 5-3 8.5-6.5 9.5" /><path d="M5.5 10.5c1.5 2.7 4 4.5 7 5.5" /><path d="m12.5 20 4.2-9 4.2 9M14 17h6" /></>,
  star: <path d="m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.9 6.6 19.5l1.2-6-4.5-4.2 6.1-.7Z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  mapPin: <><path d="M12 21s-7-6.3-7-11a7 7 0 0 1 14 0c0 4.7-7 11-7 11Z" /><circle cx="12" cy="10" r="2.6" /></>,
  hash: <path d="M5 9h14M5 15h14M10 4 8 20M16 4l-2 16" />,
  receipt: <><path d="M6 2h12v20l-2-1.4L14 22l-2-1.4L10 22l-2-1.4L6 22Z" /><path d="M9 8h6M9 12h5" /></>,
  scale: <><path d="M12 4v17" /><path d="M8 21h8" /><path d="M4 7h16" /><path d="M4 7l-2.4 5.4a2.5 2.5 0 0 0 4.8 0Z" /><path d="M20 7l-2.4 5.4a2.5 2.5 0 0 0 4.8 0Z" /><circle cx="12" cy="4" r="1.3" /></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2.4" /><circle cx="8.5" cy="9.5" r="1.8" /><path d="m5 18 5-5 4 4 2-2 3 3" /></>,
} as const

export type PfIconName = keyof typeof PF_ICONS

/* ─── Palette dérivée de la palette CRM Sugar ───────────────────────────────── */

/** Élément à REMPLISSAGE plein : la couleur du fond et l'encre qui tient dessus. */
export interface PfFill { bg: string; ink: string }

export interface PfColors {
  dark: boolean
  card: string; cardSub: string
  /** Surface FLOTTANTE (menu déroulant, popover) — elle se pose SUR la carte. */
  solid: string
  editBg: string; inputBg: string
  ink: string; soft: string; sub: string
  ghost: string
  hair: string; hairSoft: string
  shadow: string; shadowSm: string
  onInk: string
  /**
   * Vert de CONFIRMATION — la mention « Enregistré » des lignes de Notifications
   * et de Préférences, en TEXTE (les pilules, elles, passent par `saved`).
   *
   * ⚠ Il restait ici trois voisines — `blue`, `cyan`, `orange` — qui teintaient
   * une pastille de 8 px par groupe de champs, au motif qu'elles « encodaient »
   * le groupe. Elles ne l'encodaient pas : le titre posé juste à côté nommait
   * déjà le groupe, et MEGGA X n'a aucun idiome de pastille catégorielle.
   * Retirées avec la refonte du 10 août 2026.
   */
  green: string
  /** Badge affirmatif « vérifié ». Sous MEGGA X c'est `.badge-light` de la vitrine. */
  seal: PfFill
  /** Pilule de confirmation « enregistré ». */
  saved: PfFill
  /** Pastille d'action sur l'avatar (changer la photo) — affordance, pas alerte. */
  affordance: PfFill
}

/**
 * Remplissages pleins de la direction MEGGA X.
 *
 * ⚠ Les couleurs de système de la vitrine sont PÂLES — elles sont réglées pour
 * un canvas `#030303`. Mesuré : `yellow-400` ou `green-400` avec une encre
 * blanche tombent à **1,7–1,9:1**, illisible ; avec l'encre `neutral-100` elles
 * montent à **11–12:1**. Un remplissage pâle prend donc TOUJOURS l'encre
 * sombre. Seul l'accent `#424bfb` se porte avec du blanc (5,78:1) — et c'est
 * exactement ce que fait `.badge-light` dans la feuille de la vitrine.
 *
 * Le gain n'est pas que stylistique : les pilules de Sugar Pure passaient sous
 * l'AA (orange + blanc = 4,37:1, vert + blanc = 3,77:1) alors que le texte y est
 * petit et gras.
 */
function mxFills(dark: boolean): Pick<PfColors, 'seal' | 'saved' | 'affordance'> {
  const accent: PfFill = { bg: MXC_COLOR.accent, ink: MXC_COLOR.n1000 }
  return {
    seal: accent,
    affordance: accent,
    saved: { bg: dark ? MXC_SYSTEM.green400 : MXC_SYSTEM.green300, ink: MXC_COLOR.n100 },
  }
}

export function pfColors(sp: CrmPalette, surf: GalSurfaces, dark: boolean): PfColors {
  return {
    green: dark ? '#12A574' : '#059669',
    dark,
    card: surf.card, cardSub: surf.cardSub,
    solid: sp.solidBg,
    editBg: dark ? 'rgba(255,255,255,0.05)' : '#EDEFF3',
    inputBg: dark ? 'rgba(0,0,0,0.22)' : '#FFFFFF',
    ink: sp.ink, soft: sp.soft, sub: sp.sub,
    ghost: dark ? 'rgba(230,235,240,0.32)' : '#B5BAC2',
    hair: surf.hairline, hairSoft: dark ? 'rgba(255,255,255,0.07)' : crmVoileEncre(false, 0.05),
    shadow: surf.shadow, shadowSm: sp.shadowSm,
    onInk: dark ? MXC_COLOR.n100 : '#FFFFFF',
    ...mxFills(dark),
  }
}

/* ─── Nuancier « Couleur d'accent » (Réglages › Préférences) ───────────────── */

/**
 * Une pastille du nuancier.
 *
 * `ink` est l'encre qui tient SUR la pastille, pas à côté : les teintes de la
 * vitrine sont pâles et ne supportent pas le blanc (1,7:1), cf. `mxFills`.
 */
export interface PfAccent { id: string; hex: string; darkHex: string; ink: string; darkInk: string }

/**
 * Nuancier de la direction MEGGA X — tiré de la vitrine, rien d'inventé.
 *
 * En tête, `direction` : l'accent de la marque. C'est LE défaut, et c'est
 * voulu. Un réglage hérité de Sugar (`black`, `periwinkle`, `orange`…) n'existe
 * pas dans cette liste, donc le `find(…) ?? [0]` de la section y retombe :
 * l'agent qui avait choisi le noir sous Sugar récupère le bleu de la marque en
 * passant à MEGGA X. C'est la direction qui décide de l'accent ; ce nuancier ne
 * propose que des écarts.
 *
 * Les alternatives sortent des `--primary-colors--*` (le triptyque de marque)
 * et des `--system-colors--*`. Elles n'ont pas de variante sombre : ce sont des
 * couleurs de marque, pas des surfaces — seule `encre` s'inverse.
 */
const MX_ACCENTS: PfAccent[] = [
  { id: 'direction', hex: MXC_COLOR.accent, darkHex: MXC_COLOR.accent, ink: MXC_COLOR.n1000, darkInk: MXC_COLOR.n1000 },
  { id: 'cyan', hex: MXC_COLOR.accentCyan, darkHex: MXC_COLOR.accentCyan, ink: MXC_COLOR.n100, darkInk: MXC_COLOR.n100 },
  { id: 'green', hex: MXC_COLOR.accentGreen, darkHex: MXC_COLOR.accentGreen, ink: MXC_COLOR.n100, darkInk: MXC_COLOR.n100 },
  { id: 'yellow', hex: MXC_SYSTEM.yellow400, darkHex: MXC_SYSTEM.yellow400, ink: MXC_COLOR.n100, darkInk: MXC_COLOR.n100 },
  { id: 'red', hex: MXC_SYSTEM.red400, darkHex: MXC_SYSTEM.red400, ink: MXC_COLOR.n100, darkInk: MXC_COLOR.n100 },
  { id: 'encre', hex: MXC_COLOR.n100, darkHex: MXC_COLOR.n1000, ink: MXC_COLOR.n1000, darkInk: MXC_COLOR.n100 },
]

/** Pastilles offertes à l'agent. La première EST le défaut. */
export function pfAccents(): PfAccent[] {
  return MX_ACCENTS
}

/* ─── Types de ligne éditable + libellés kit (fournis traduits par la section) ─ */
export interface PfRow {
  key: string
  icon: PfIconName
  label: string
  multiline?: boolean
  chips?: string[]
  /**
   * Choix UNIQUE : la valeur persistée est un `id` opaque (typiquement une FK), pas
   * le libellé — l'affichage hors édition résout donc l'id via cette liste. À ne pas
   * confondre avec `chips`, qui est un choix multiple stockant les libellés eux-mêmes.
   */
  options?: { id: string; label: string }[]
  locked?: boolean
  hint?: string
  placeholder?: string
  verified?: boolean
  verifiedLabel?: string
}

export interface PfEditLabels {
  saved: string; add: string; edit: string; cancel: string; save: string
}

export interface PfPhotoLabels { title: string; choose: string; change: string; cancel: string; save: string }

/* Keyframes partagées (injectées une fois par section). */
export const PF_KEYFRAMES = `
@media (prefers-reduced-motion: no-preference) {
  @keyframes pfxEditIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  @keyframes pfxCtrlIn { from { opacity: 0; transform: scale(.86); } to { opacity: 1; transform: none; } }
  @keyframes pfxInfoIn { from { opacity: 0; transform: translateY(-4px) scale(.98); } to { opacity: 1; transform: none; } }
  .pfx-edit-in { animation: pfxEditIn .26s cubic-bezier(.2,.8,.2,1) both; }
  .pfx-ctrl-in { animation: pfxCtrlIn .26s cubic-bezier(.2,.9,.3,1) .04s both; }
  .pfx-info-in { animation: pfxInfoIn .18s cubic-bezier(.2,.8,.2,1) both; }
}
`
