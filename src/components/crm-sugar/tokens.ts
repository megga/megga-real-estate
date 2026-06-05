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

export const CRM_TOKENS: { light: CrmTheme; dark: CrmTheme } = {
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
  // Dark mode — cohérence avec MEGGA AI : quasi-noir, voile bleuté discret.
  dark: {
    bg:           '#0A0A0F',
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
}

// Stage colors (deal pipeline) — same across themes for recognition
export const CRM_STAGES = {
  'new-lead':           { label: 'Nouveau lead',      color: '#64748B' },
  'to-qualify':         { label: 'À qualifier',       color: '#B7791F' },
  'searching':          { label: 'Recherche active',  color: '#1E5BC6' },
  'visit-scheduled':    { label: 'Visite planifiée',  color: '#0E7490' },
  'visit-done':         { label: 'Visite effectuée',  color: '#0891B2' },
  'interest-confirmed': { label: 'Intérêt confirmé',  color: '#059669' },
  'offer':              { label: 'Offre déposée',     color: '#C45A00' },
  'signed':             { label: 'Signé',             color: '#0B0C0E' },
  'lost':               { label: 'Perdu',             color: '#8E1F3D' },
} as const
export type StageId = keyof typeof CRM_STAGES

export const CRM_STAGE_ORDER: StageId[] = [
  'new-lead', 'to-qualify', 'searching', 'visit-scheduled',
  'visit-done', 'interest-confirmed', 'offer', 'signed',
]

export const CRM_DENSITY = {
  comfortable: { rowH: 56, gap: 14, padX: 18, padY: 14, fontBody: 14, fontDense: 13 },
  compact:     { rowH: 40, gap:  8, padX: 12, padY:  8, fontBody: 13, fontDense: 12 },
}
export type DensityKey = keyof typeof CRM_DENSITY

// ─── Formatters ─────────────────────────────────────────────────────────
export function crmFmtCHF(n: number | null | undefined): string {
  if (n == null) return '—'
  return 'CHF ' + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'")
}
export function crmFmtNum(n: number | null | undefined): string {
  if (n == null) return '—'
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'")
}
export function crmRelative(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const ms = Date.now() - d.getTime()
  const m = Math.round(ms / 60000)
  if (m < 1) return "À l'instant"
  if (m < 60) return `il y a ${m} min`
  const h = Math.round(m / 60)
  if (h < 24) return `il y a ${h} h`
  const j = Math.round(h / 24)
  if (j < 7) return `il y a ${j} j`
  if (j < 30) return `il y a ${Math.round(j / 7)} sem`
  return `il y a ${Math.round(j / 30)} mois`
}
export function crmInitials(name: string): string {
  return name.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase()
}

// ─── Sugar palette (derived from the active theme) ──────────────────────
// Light theme keeps the original cool grey-blue page bg + white floating cards.
// Dark themes (marine / meggaAi) flip to deep surfaces, translucent frames,
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

export type DarkTone = 'marine' | 'meggaAi'

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
    frameBg:       tone === 'meggaAi' ? 'rgba(23,23,36,0.30)' : 'rgba(23,34,56,0.30)',
    frameBorder:   'rgba(255,255,255,0.08)',
    cardBg:        'rgba(255,255,255,0.05)',
    cardBorder:    'rgba(255,255,255,0.08)',
    cardSubBg:     'rgba(255,255,255,0.04)',
    ink:           t.ink,
    sub:           t.muted,
    soft:          t.soft,
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
