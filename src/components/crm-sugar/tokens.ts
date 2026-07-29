// MEGGA CRM Sugar v2 — Design tokens + sugar palette derivation
// 1:1 port from the Claude Design bundle (crm-tokens.jsx).
// Cohérent avec le site public MEGGA, étendu pour outil pro.

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
 * Échelle sombre « Graphite » — source unique (handoff Teinte sombre Graphite,
 * 29 juil. 2026). 5 paliers OPAQUES entre le canvas et le plafond, d'écart de
 * luminance constant (~1,04) : l'élévation se lit sans bordure décorative.
 *
 * Lue aussi hors palette par `crmStep()`. Ne jamais monter au-dessus de `s4` :
 * une sous-surface de modale se CREUSE (`solidBgSub` = s3) au lieu de monter.
 */
export const CRM_GRAPHITE = {
  s0: '#12161C', // canvas — fond de toutes les pages, pagers, fiches
  s1: '#161A21', // cadre bento, rail d'icônes, top nav
  s2: '#1A1D26', // cards, colonnes kanban, lignes de liste
  s3: '#1D212A', // sous-cards, inputs, chips, hover de card
  s4: '#21242F', // plafond — modales, popovers, menus, palette de commandes
} as const

export type GraphiteStep = keyof typeof CRM_GRAPHITE

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
 *  handoff : ne pas les changer. */
export function sgMix(hex: string, target: string, amt: number): string {
  const h = (hex || '#000000').replace('#', '')
  const t = (target || '#000000').replace('#', '')
  if (h.length < 6) return hex
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  const tr = parseInt(t.slice(0, 2), 16), tg = parseInt(t.slice(2, 4), 16), tb = parseInt(t.slice(4, 6), 16)
  const m = (a: number, bb: number) => Math.round(a + (bb - a) * amt)
  return `rgb(${m(r, tr)}, ${m(g, tg)}, ${m(b, tb)})`
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
  /** Échelle sombre active, exposée uniquement par la teinte Graphite. Sa
   *  présence est LE test « suis-je en graphite ? » pour les composants qui
   *  reçoivent `sp` sans connaître la teinte (cf. `crmStep(sp, …)`). */
  ramp?: typeof CRM_GRAPHITE
}

export type DarkTone = 'marine' | 'meggaAi' | 'noir' | 'graphite'

/** Teinte sombre par défaut du CRM agent — « graphite » depuis le handoff
 *  Teinte sombre Graphite (29 juil. 2026). Sert de repli à `crmDarkTone()`
 *  quand rien n'est stocké. */
export const DEFAULT_DARK_TONE: DarkTone = 'graphite'

/** Clé de persistance du choix de teinte (calquée sur `megga.accent` du proto). */
export const DARK_TONE_KEY = 'megga.darkTone'

/**
 * Teinte sombre active — `window.__meggaDarkTone` d'abord (posé par le hook à
 * chaque changement, donc lu à chaud), puis localStorage, sinon Graphite.
 *
 * Lecture PONCTUELLE : elle ne déclenche aucun rendu. Un composant qui doit se
 * re-teinter sans rechargement passe par `useDarkTone()`.
 */
export function crmDarkTone(): DarkTone {
  if (typeof window === 'undefined') return DEFAULT_DARK_TONE
  const live = (window as Window & { __meggaDarkTone?: DarkTone }).__meggaDarkTone
  if (live) return live
  try {
    return (window.localStorage.getItem(DARK_TONE_KEY) as DarkTone | null) || DEFAULT_DARK_TONE
  } catch {
    return DEFAULT_DARK_TONE
  }
}

/**
 * Palier de l'échelle sombre active, sinon la valeur historique du littéral.
 *
 * Deux signatures, au choix selon ce qu'on a sous la main :
 * - `crmStep('s3', 'rgba(255,255,255,.08)')` — lit la teinte active, aucune
 *   dépendance de scope ;
 * - `crmStep(sp, 's3', 'rgba(255,255,255,.08)')` — lit `sp.ramp`.
 *
 * ⚠️ À n'utiliser QUE dans une branche déjà gardée par `dark ? … : …` : la
 * fonction ne teste pas le mode clair, seulement la teinte.
 */
export function crmStep(step: GraphiteStep, fallback: string): string
export function crmStep(sp: SugarPalette | undefined, step: GraphiteStep, fallback: string): string
export function crmStep(
  a: GraphiteStep | SugarPalette | undefined,
  b: string,
  c?: string,
): string {
  if (typeof a === 'string') return crmDarkTone() === 'graphite' ? CRM_GRAPHITE[a] : b
  return a?.ramp?.[b as GraphiteStep] ?? (c as string)
}

/**
 * Thème CrmTheme actif pour les pages Sugar : clair, sinon le thème de la teinte
 * demandée (par défaut la teinte active).
 *
 * `marine` et `meggaAi` n'ont pas d'entrée dans `CRM_TOKENS` : ils retombent sur
 * Graphite, comme le repli `CRM_TOKENS[darkTone] || CRM_TOKENS.graphite` du
 * proto — un réglage déjà stocké sur ces teintes continue donc de résoudre.
 */
export function sugarThemeTokens(dark: boolean, tone: DarkTone = crmDarkTone()): CrmTheme {
  if (!dark) return CRM_TOKENS.light
  return (CRM_TOKENS as Partial<Record<DarkTone, CrmTheme>>)[tone] ?? CRM_TOKENS.graphite
}

export function crmSugarPalette(t: CrmTheme, dark: boolean, tone: DarkTone = crmDarkTone()): SugarPalette {
  if (!dark) {
    return {
      pageBg:        '#EEF1F5',
      frameBg:       'rgba(255,255,255,0.35)',
      frameBorder:   'rgba(255,255,255,0.55)',
      cardBg:        'rgba(255,255,255,0.55)',
      cardBorder:    'rgba(255,255,255,0.7)',
      cardSubBg:     'rgba(245,247,250,0.6)',
      ink:           '#0E1410',
      sub:           '#7A8079',
      soft:          '#3F4640',
      accent:        '#0B0C0E',
      accentInk:     '#FFFFFF',
      focusBg:       '#0E1410',
      focusInk:      '#FFFFFF',
      focusSurface:  'rgba(255,255,255,.10)',
      focusShadow:   '0 6px 24px -6px rgba(14,20,16,.45)',
      shadow:        '0 1px 2px rgba(14,20,16,.04), 0 8px 24px -10px rgba(60,80,120,.18)',
      shadowSm:      '0 1px 2px rgba(14,20,16,.04), 0 6px 18px -10px rgba(60,80,120,.18)',
      tableHeadBg:   '#FAFBFD',
      avatarBorder:  '#FFFFFF',
      iconBtnBg:     'rgba(255,255,255,0.55)',
      iconRailBg:    'rgba(255,255,255,0.7)',
      dotBorder:     '#EEF1F5',
      kbdBg:         '#F5F7FA',
      solidBg:       '#FFFFFF',
      solidBgSub:    '#F1F4F8',
      solidBgSub2:   '#E6EAF0',
      solidBorder:   'rgba(15,23,42,0.10)',
      solidShadow:   '0 1px 2px rgba(14,20,16,.05), 0 18px 48px -12px rgba(40,55,90,.30)',
    }
  }
  // ── Teinte Graphite : échelle OPAQUE, jamais de blanc translucide en
  // remplissage. Les rgba blancs ne servent plus que de FILETS (α ≤ .06). Les
  // sous-surfaces d'une modale se CREUSENT (solidBgSub < solidBg) au lieu de
  // monter : la plage reste étanche entre s0 et s4.
  if (tone === 'graphite') {
    const G = CRM_GRAPHITE
    return {
      ramp:          G,
      pageBg:        G.s0,
      frameBg:       G.s1,
      frameBorder:   'rgba(255,255,255,0.05)',
      cardBg:        G.s2,
      cardBorder:    'rgba(255,255,255,0.06)',
      cardSubBg:     G.s3,
      ink:           t.ink,
      sub:           t.muted,
      soft:          t.soft,
      // Le proto lit ces 4 slots dans son sélecteur d'accent (`crmAccent(true)` /
      // `crmAccentInk(true)`), jamais porté ici. Valeurs résolues à l'accent
      // « black » — le défaut du proto, seul accent que ce dépôt connaisse.
      accent:        t.ink,     // #ECEDF3
      accentInk:     '#0B0C0E',
      focusBg:       t.ink,
      focusInk:      '#0B0C0E',
      focusSurface:  'rgba(255,255,255,.10)',
      focusShadow:   '0 8px 28px -8px rgba(0,0,0,.7)',
      shadow:        '0 1px 2px rgba(0,0,0,.45), 0 10px 28px -12px rgba(0,0,0,.65)',
      shadowSm:      '0 1px 2px rgba(0,0,0,.4), 0 6px 18px -10px rgba(0,0,0,.6)',
      tableHeadBg:   G.s1,
      avatarBorder:  G.s2,
      iconBtnBg:     G.s3,
      iconRailBg:    G.s1,
      dotBorder:     G.s2,
      kbdBg:         G.s3,
      solidBg:       G.s4,
      solidBgSub:    G.s3,
      solidBgSub2:   G.s2,
      solidBorder:   'rgba(255,255,255,0.08)',
      solidShadow:   '0 28px 64px -14px rgba(0,0,0,.72), 0 8px 22px -10px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.05)',
    }
  }
  return {
    pageBg:        t.bg,
    frameBg:       tone === 'noir' ? 'rgba(18,18,22,0.45)'
                   : tone === 'meggaAi' ? 'rgba(23,23,36,0.30)' : 'rgba(23,34,56,0.30)',
    frameBorder:   'rgba(255,255,255,0.08)',
    cardBg:        'rgba(255,255,255,0.05)',
    cardBorder:    'rgba(255,255,255,0.08)',
    cardSubBg:     'rgba(255,255,255,0.04)',
    ink:           t.ink,
    sub:           t.muted,
    soft:          t.soft,
    accent:        t.ink,
    accentInk:     '#0A0A0F',
    focusBg:       t.primary,
    focusInk:      '#FFFFFF',
    focusSurface:  'rgba(255,255,255,.12)',
    focusShadow:   '0 8px 28px -8px rgba(0,0,0,.65)',
    shadow:        '0 1px 2px rgba(0,0,0,.4), 0 10px 28px -12px rgba(0,0,0,.6)',
    shadowSm:      '0 1px 2px rgba(0,0,0,.35), 0 6px 18px -10px rgba(0,0,0,.55)',
    tableHeadBg:   t.section,
    avatarBorder:  t.surface,
    iconBtnBg:     'rgba(255,255,255,0.06)',
    iconRailBg:    'rgba(255,255,255,0.04)',
    dotBorder:     t.surface,
    kbdBg:         t.surface2,
    // Surface volontairement claire pour s'élever du fond quasi-noir : sur fond
    // sombre l'ombre noire est invisible, le relief vient de la clarté + bordure
    // lumineuse + liseré haut interne.
    solidBg:       '#22242F',
    solidBgSub:    '#2C2F3B',
    solidBgSub2:   '#373B49',
    solidBorder:   'rgba(255,255,255,0.14)',
    solidShadow:   '0 24px 60px -12px rgba(0,0,0,.65), 0 8px 22px -10px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.07)',
  }
}
