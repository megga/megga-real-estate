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

export const CRM_TOKENS: { light: CrmTheme; dark: CrmTheme; noir: CrmTheme } = {
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
  // Dark mode — cohérence avec MEGGA AI : quasi-noir NEUTRE, aligné sur le
  // cockpit Today (#0A0B0D). Fond unifié (handoff « Unification du fond sombre »)
  // pour que Today, Pipeline, fiche Deal et modale offre partagent EXACTEMENT le
  // même noir. Ne pas réintroduire de teinte bleue (#0A0A0F portait un B=15).
  dark: {
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
  },
  // Teinte « noir » — noir pur #000000 (handoff Pipeline v2 « Sugar Pure »,
  // juillet 2026, crm-tokens.jsx §CRM_TOKENS.noir). DÉFAUT du CRM agent depuis
  // le pivot Sugar Pure (cf. SUGAR_DARK_TONE). Seules bg/surface/surface2/
  // border/section divergent de `dark` ; le reste est hérité à l'identique.
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
// Dark themes (marine / meggaAi / noir) flip to deep surfaces, translucent frames,
// and a bright ink/sub for legibility on glass.
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
}

export type DarkTone = 'marine' | 'meggaAi' | 'noir'

/** Teinte sombre par défaut du CRM agent — « noir » depuis le handoff Pipeline v2
 *  (juillet 2026). Point unique de bascule : toutes les pages Sugar la consomment. */
export const SUGAR_DARK_TONE: DarkTone = 'noir'

/** Thème CrmTheme actif pour les pages Sugar : clair, sinon le thème porté par
 *  SUGAR_DARK_TONE (marine/meggaAi partagent CRM_TOKENS.dark ; noir a le sien). */
export function sugarThemeTokens(dark: boolean): CrmTheme {
  if (!dark) return CRM_TOKENS.light
  return SUGAR_DARK_TONE === 'noir' ? CRM_TOKENS.noir : CRM_TOKENS.dark
}

export function crmSugarPalette(t: CrmTheme, dark: boolean, tone: DarkTone = 'marine'): SugarPalette {
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
