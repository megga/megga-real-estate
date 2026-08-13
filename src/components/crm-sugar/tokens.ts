// MEGGA CRM Sugar v2 — Design tokens + sugar palette derivation
// 1:1 port from the Claude Design bundle (crm-tokens.jsx).
// Cohérent avec le site public MEGGA, étendu pour outil pro.

import { mxCrmPalette } from '@/components/megga-x-crm/tokens'

export interface CrmTheme {
  bg: string
  surface: string
  surface2: string
  border: string
  borderStrong: string
  ink: string
  soft: string
  muted: string
  primary: string
  primarySoft: string
  primaryHover: string
  danger: string
  dangerSoft: string
  warn: string
  warnSoft: string
  ok: string
  okSoft: string
  section: string
  overlay: string
  shadow1: string
  shadow2: string
}

/**
 * Échelle sombre « Graphite » — dernier vestige de la direction Sugar.
 *
 * ⚠ Elle ne sert PLUS de surface au CRM : les 110 appels à `crmStep` ont été
 * repris écran par écran sur les neutres MEGGA X, et `crmStep` a été supprimée
 * avec son dernier lecteur. Ces 5 valeurs n'alimentent que `CRM_TOKENS.graphite`,
 * dont il ne reste qu'UN lecteur : `kycPalette`, pour trois fonds d'état
 * (`okSoft`, `warnSoft`, `dangerSoft`) que MEGGA X ne publie pas en version
 * douce. Tout le reste de ce bloc est inerte — le retirer demande de décider
 * où vivent ces trois valeurs, pas de migrer une surface.
 */
export const CRM_GRAPHITE = {
  s0: '#12161C', // canvas — fond de toutes les pages, pagers, fiches
  s1: '#161A21', // cadre bento, rail d'icônes, top nav
  s2: '#1A1D26', // cards, colonnes kanban, lignes de liste
  s3: '#1D212A', // sous-cards, inputs, chips, hover de card
  s4: '#21242F', // plafond — modales, popovers, menus, palette de commandes
} as const

// Dark mode — cohérence avec MEGGA AI : quasi-noir NEUTRE, aligné sur le
// cockpit Today (#0A0B0D). Fond unifié (handoff « Unification du fond sombre »)
// pour que Today, Pipeline, fiche Deal et modale offre partagent EXACTEMENT le
// même noir. Ne pas réintroduire de teinte bleue (#0A0A0F portait un B=15).
// Hoisté hors de CRM_TOKENS : `graphite` en dérive par spread (cf. le proto, où
// CRM_TOKENS.graphite = { ...CRM_TOKENS.dark, … }).
const CRM_DARK_BASE: CrmTheme = {
  bg:           '#0A0B0D',
  surface:      '#101019',
  surface2:     '#171724',
  border:       '#1F1F2E',
  borderStrong: '#2E2E42',
  ink:          '#ECEDF3',
  soft:         '#B5B7C4',
  muted:        '#797D90',
  primary:      '#6F8CFF',
  primarySoft:  '#1A1E3A',
  primaryHover: '#8DA4FF',
  danger:       '#F26B65',
  dangerSoft:   '#341B1F',
  warn:         '#F2B855',
  warnSoft:     '#332811',
  ok:           '#34C796',
  okSoft:       '#0F2620',
  section:      '#0D0D14',
  overlay:      'rgba(0,0,4,.68)',
  shadow1:      '0 1px 2px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.04)',
  shadow2:      '0 14px 36px -10px rgba(0,0,0,.7), 0 0 0 1px rgba(255,255,255,.045)',
}

export const CRM_TOKENS: { light: CrmTheme; dark: CrmTheme; noir: CrmTheme; graphite: CrmTheme } = {
  light: {
    bg:           '#FAFBFD',
    surface:      '#FFFFFF',
    surface2:     '#F5F7FA',
    border:       '#E2E6EC',
    borderStrong: '#CDD3DB',
    ink:          '#0E1410',
    soft:         '#3F4640',
    muted:        '#7A8079',
    primary:      '#0041D9',
    primarySoft:  '#E8EFFE',
    primaryHover: '#0033AC',
    danger:       '#E53935',
    dangerSoft:   '#FDECEA',
    warn:         '#F59E0B',
    warnSoft:     '#FEF3DB',
    ok:           '#0E9F6E',
    okSoft:       '#E1F5EC',
    section:      '#F6F8F4',
    overlay:      'rgba(14,20,16,.42)',
    shadow1:      '0 1px 2px rgba(14,20,16,.04), 0 0 0 1px rgba(14,20,16,.04)',
    shadow2:      '0 8px 24px -8px rgba(14,20,16,.12), 0 0 0 1px rgba(14,20,16,.05)',
  },
  dark: CRM_DARK_BASE,
  // Teinte « noir » — noir pur #000000 (handoff Pipeline v2 « Sugar Pure »,
  // juillet 2026, crm-tokens.jsx §CRM_TOKENS.noir). Reste offerte à l'agent
  // (contraste maximal, OLED) mais n'est plus le défaut depuis Graphite.
  // Seules bg/surface/surface2/border/section divergent de `dark` ; le reste
  // est hérité à l'identique.
  noir: {
    bg:           '#000000',
    surface:      '#0C0C10',
    surface2:     '#131319',
    border:       '#1A1A22',
    borderStrong: '#2E2E42',
    ink:          '#ECEDF3',
    soft:         '#B5B7C4',
    muted:        '#797D90',
    primary:      '#6F8CFF',
    primarySoft:  '#1A1E3A',
    primaryHover: '#8DA4FF',
    danger:       '#F26B65',
    dangerSoft:   '#341B1F',
    warn:         '#F2B855',
    warnSoft:     '#332811',
    ok:           '#34C796',
    okSoft:       '#0F2620',
    section:      '#060608',
    overlay:      'rgba(0,0,4,.68)',
    shadow1:      '0 1px 2px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.04)',
    shadow2:      '0 14px 36px -10px rgba(0,0,0,.7), 0 0 0 1px rgba(255,255,255,.045)',
  },
  // Teinte « Graphite » — DÉFAUT PRODUIT (handoff du 29 juil. 2026). Échelle
  // opaque CRM_GRAPHITE : bg = s0, section = s1, surface = s2, surface2 = s3.
  // `border` est hors plage par nature — c'est un trait, pas une surface.
  // `muted` remonte à #868A9C : #797D90 tombait à 4,45:1 sur s0 (sous AA).
  graphite: {
    ...CRM_DARK_BASE,
    bg:           CRM_GRAPHITE.s0,
    section:      CRM_GRAPHITE.s1,
    surface:      CRM_GRAPHITE.s2,
    surface2:     CRM_GRAPHITE.s3,
    border:       '#252A36',
    borderStrong: '#333949',
    muted:        '#868A9C',
    overlay:      'rgba(6,8,11,.66)',
  },
}

// Stage colors (deal pipeline) — same across themes for recognition.
// Rampe grise héritée (handoff Pipeline v2) : le kanban n'utilise PLUS ces
// couleurs — il est piloté par SG_STAGE_HUE (balayage de teinte continu).
// `color` ne sert que de repli hors board (mobile, pastille modale).
export const CRM_STAGES = {
  'new-lead':           { label: 'Nouveau lead',      color: '#9AA0A6' },
  'to-qualify':         { label: 'À qualifier',       color: '#7A8088' },
  'searching':          { label: 'Recherche active',  color: '#5A616B' },
  'visit-scheduled':    { label: 'Visite planifiée',  color: '#4B5563' },
  'visit-done':         { label: 'Visite effectuée',  color: '#0891B2' },
  'interest-confirmed': { label: 'Intérêt confirmé',  color: '#475569' },
  'offer':              { label: 'Offre déposée',     color: '#C45A00' },
  'signed':             { label: 'Signé',             color: '#059669' },
  'lost':               { label: 'Perdu',             color: '#8E1F3D' },
} as const
export type StageId = keyof typeof CRM_STAGES

export const CRM_STAGE_ORDER: StageId[] = [
  'new-lead', 'to-qualify', 'searching', 'visit-scheduled',
  'visit-done', 'interest-confirmed', 'offer', 'signed',
]

// ─── Teintes d'étape — Pipeline v2 « Sugar Pure » ───────────────────────
// Balayage de teinte CONTINU le long du funnel (froid → chaud) : chaque étape
// suit chromatiquement la précédente. Ce sont CES valeurs (pas les gris de
// CRM_STAGES) qui pilotent le kanban, les pilules, les pastilles et les barres.
// Source : handoff crm-screen-pipeline-sugar.jsx §SG_STAGE_HUE.
export const SG_STAGE_HUE: Record<StageId, string> = {
  'new-lead':           '#5B6BE6', // indigo
  'to-qualify':         '#3E86E4', // bleu
  'searching':          '#1FA3D6', // azur
  'visit-scheduled':    '#0FB9C2', // cyan
  'visit-done':         '#14BE93', // teal
  'interest-confirmed': '#46C05F', // vert
  'offer':              '#C9A31C', // or
  'signed':             '#E8892A', // orange chaud
  'lost':               '#C2607E', // rose sombre (hors funnel)
}

/** Mélange un hex vers une cible (#000/#fff) d'un facteur `amt` — dérive des
 *  tons lisibles depuis les teintes d'étape saturées. Facteurs figés par le
 *  handoff : ne pas les changer.
 *
 * ⛔ REND UN `#rrggbb`, ET C'EST UN CORRECTIF, PAS UN GOÛT. Cette fonction
 * rendait `rgb(r, g, b)`. Les deux notations sont valides en CSS, donc rien ne
 * cassait à l'écran — mais `encreSur()`, qui DÉRIVE une encre lisible d'un
 * aplat, ne lit que l'hexadécimal : nourrie d'un `rgb()`, sa luminance vaut
 * `NaN` et elle rend l'encre INVERSE sans erreur ni type faux. Mesuré :
 * `encreSur('#414da1')` → `#ffffff`, `encreSur('rgb(65, 77, 161)')` → `#030303`,
 * pour la MÊME couleur.
 *
 * Le défaut ne pouvait donc apparaître qu'au moment où l'on branche `encreSur`
 * sur une teinte d'étape — c'est-à-dire dans le correctif de contraste. Il
 * aurait inversé l'encre des pilules en clair, toutes portes vertes. Uniformiser
 * la notation ici est ce qui rend le reste mesurable ; `encreSur` a par ailleurs
 * appris les deux notations, ceinture et bretelles. */
export function sgMix(hex: string, target: string, amt: number): string {
  const h = (hex || '#000000').replace('#', '')
  const t = (target || '#000000').replace('#', '')
  if (h.length < 6) return hex
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  const tr = parseInt(t.slice(0, 2), 16), tg = parseInt(t.slice(2, 4), 16), tb = parseInt(t.slice(4, 6), 16)
  const m = (a: number, bb: number) => Math.round(a + (bb - a) * amt)
  return '#' + [m(r, tr), m(g, tg), m(b, tb)].map((v) => v.toString(16).padStart(2, '0')).join('')
}

/** Teinte dérivée d'une colonne kanban : fond pastel (`panel`) + libellé de
 *  compteur teinté (`tintInk`) + teinte vive (`hue`). */
export function sgStageTint(stage: StageId, dark: boolean): { hue: string; panel: string; tintInk: string } {
  const hue = SG_STAGE_HUE[stage] || '#8A93A5'
  return {
    hue,
    panel: dark ? sgMix(hue, '#141517', 0.85) : sgMix(hue, '#FFFFFF', 0.81),
    tintInk: dark ? sgMix(hue, '#FFFFFF', 0.35) : sgMix(hue, '#0B0C0E', 0.45),
  }
}

/** Fond des pilules d'étape à texte blanc : teinte assombrie en clair
 *  (contraste ≥ 4.5:1), teinte vive inchangée en sombre. Réservé aux aplats
 *  portant du texte — pastilles 8-9 px et barres restent en SG_STAGE_HUE pur. */
export function sgStagePillBg(stage: StageId, dark: boolean): string {
  const h = SG_STAGE_HUE[stage] || '#8A93A5'
  return dark ? h : sgMix(h, '#0B0C0E', 0.32)
}
// ─── Formatters ─────────────────────────────────────────────────────────
export function crmFmtCHF(n: number | null | undefined): string {
  if (n == null) return '—'
  return 'CHF ' + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'")
}

export function crmInitials(name: string): string {
  return name.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()
}

// ─── Sugar palette (derived from the active theme) ──────────────────────
// Light theme keeps the original cool grey-blue page bg + white floating cards.
// Graphite (défaut) pose une échelle de surfaces OPAQUES ; les teintes
// historiques (marine / meggaAi / noir) gardent leurs cadres translucides et
// une encre claire pour rester lisibles sur le verre.
export interface SugarPalette {
  /**
   * Le thème que cette palette rend, pour les rares jetons qu'elle ne peut PAS
   * porter : les couleurs SÉMANTIQUES d'un composant, qui disent un état que la
   * palette ne connaît pas et dont la valeur lisible diffère selon le fond —
   * les teintes d'événement du calendrier, par exemple.
   *
   * ⚠ Ce n'est pas une invitation à brancher du style sur un booléen : tout ce
   * qui peut descendre d'un jeton doit en descendre. Il existe parce que la
   * seule alternative était de deviner le thème depuis la luminance de
   * `cardBg`, ou de laisser chaque composant importer le proxy `SugarV2` du
   * wizard — qui n'est pas monté hors du wizard.
   *
   * `MobileTokens.mode` joue le même rôle côté mobile.
   */
  isDark: boolean
  pageBg: string
  frameBg: string
  frameBorder: string
  cardBg: string
  cardBorder: string
  cardSubBg: string
  ink: string
  sub: string
  soft: string
  /** Accent UI unique Sugar Pure : noir franc en clair, encre claire en sombre
   *  (CTA, sélection, pilules actives). Jamais une couleur vive. */
  accent: string
  /** Texte posé sur `accent` (blanc en clair, quasi-noir en sombre). */
  accentInk: string
  focusBg: string
  focusInk: string
  focusSurface: string
  focusShadow: string
  shadow: string
  shadowSm: string
  shadowHover?: string
  tableHeadBg: string
  avatarBorder: string
  iconBtnBg: string
  iconRailBg: string
  dotBorder: string
  kbdBg: string
  // Surfaces OPAQUES (popovers denses type dropdown profil). La couleur vient
  // des tokens (pas du prop `dark`, souvent non transmis) → correcte en clair
  // ET sombre. La surface s'élève nettement du fond + ombre/bordure renforcées.
  solidBg: string
  solidBgSub: string
  solidBgSub2: string
  solidBorder: string
  solidShadow: string
}

/**
 * Palette du CRM — MEGGA X, unique direction depuis la suppression de Sugar.
 *
 * Le nom survit à la direction qu'il servait : 33 points de construction
 * l'appellent et transmettent ensuite la palette en prop, sous le type
 * `SugarPalette`. Renommer les deux est un geste à part, purement lexical.
 *
 * ⚠ Elle prenait un premier argument `t: CrmTheme` qu'elle n'a plus lu depuis
 * la suppression de Sugar. Ses 28 appelants le construisaient uniquement pour
 * le lui passer : le retirer a donc emporté `sugarThemeTokens` et `CrmTheme`
 * avec lui.
 *
 * ⚠ L'import de `megga-x-crm/tokens` ne boucle pas : ce module ne remonte vers
 * celui-ci qu'en `import type`, effacé à la compilation.
 */
export function crmSugarPalette(dark: boolean): SugarPalette {
  return mxCrmPalette(dark)
}
