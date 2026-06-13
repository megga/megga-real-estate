// MEGGA CRM Sugar v2 Wizard — Design tokens (palette unique, distinct from Today).
// 1:1 port from the Claude Design bundle (crm-wizard-sugar-v2.jsx).
//
// Deux thèmes (light + dark). `SugarV2` n'est PAS un objet figé : c'est un Proxy
// qui lit le thème actif (`__sgActive`) au moment de l'accès. Le shell réassigne
// le thème via `setSugarV2Dark(dark)` au tout début de son render, et comme tous
// les step files lisent `SugarV2.foo` AU RENDER, ils suivent automatiquement le
// thème — zéro threading de prop vers chacun.
//
// Pourquoi un Proxy et pas un simple `let` réassigné ? Identité stable : un import
// `{ SugarV2 }` garde la même référence quel que soit le thème actif, donc aucune
// capture (`const SP = SugarV2`) ne se retrouve figée sur l'ancien objet.
//
// Light : fond gris radial → bleu pâle, cards blanches, ombres douces, accent NOIR pur.
// Dark  : fond plat #0A0A0F (= bg du CRM), surfaces #15151F, accent NEAR-WHITE #ECEDF3.
//   ⚠ Inversion clé : en dark l'accent `black` devient near-white, donc tout ce qui
//   est « posé sur l'accent » (texte d'un CTA, ✓ d'une case) passe en `onBlack` sombre.
//   Ne jamais hardcoder `#fff` sur l'accent → utiliser `sgOn()` / `onBlack`.

const SUGARV2_LIGHT = {
  // Fond — radial doux du clair vers bleu-gris pâle
  bg: '#EDEFF3',
  bgGradient: 'radial-gradient(ellipse 120% 80% at 50% 100%, #C8D5E0 0%, #E2E5EB 50%, #EDEFF3 100%)',

  // Surfaces
  card: '#FFFFFF',
  cardSubtle: '#F7F8FA',
  rail: '#FFFFFF',
  railHover: '#F0F2F6',

  // Accent unique
  black: '#0B0C0E',
  blackHover: '#1F2024',
  onBlack: '#FFFFFF',           // texte / icône POSÉ SUR l'accent

  // Texte
  ink: '#0B0C0E',
  inkSoft: '#3A3D44',
  muted: '#7A8088',
  ghost: '#B5BAC2',

  // Hairline / divider structurel
  line: 'rgba(11,12,14,0.08)',

  // Ombres signature Sugar
  shadowSm: '0 4px 16px rgba(15, 23, 42, 0.04)',
  shadow:   '0 12px 40px rgba(15, 23, 42, 0.06), 0 2px 8px rgba(15, 23, 42, 0.03)',
  shadowLg: '0 24px 60px rgba(15, 23, 42, 0.08), 0 4px 16px rgba(15, 23, 42, 0.04)',
  shadowHover: '0 32px 70px rgba(15, 23, 42, 0.10), 0 6px 20px rgba(15, 23, 42, 0.05)',
  pillShadow: '0 6px 16px rgba(11,12,14,0.18)',
  pillShadowHover: '0 12px 30px rgba(11,12,14,0.25)',
  ringSoft: 'rgba(11,12,14,0.06)',
  footerFade: 'linear-gradient(180deg, transparent 0%, rgba(237,239,243,0.9) 60%, rgba(237,239,243,1) 100%)',

  // États (utilitaires uniquement, jamais décoratifs)
  ok:   '#10B981',
  warn: '#F59E0B',
  err:  '#EF4444',

  // Avatars / pastilles d'équipe
  pop1: '#3B82F6',
  pop2: '#EF4444',
  pop3: '#FBBF24',
  pop4: '#10B981',

  // Voiles translucides POSÉS SUR l'accent (light : l'accent est noir → voile blanc)
  onAcc04: 'rgba(255,255,255,0.04)', onAcc08: 'rgba(255,255,255,0.08)', onAcc10: 'rgba(255,255,255,0.10)',
  onAcc12: 'rgba(255,255,255,0.12)', onAcc15: 'rgba(255,255,255,0.15)', onAcc16: 'rgba(255,255,255,0.16)',
  onAcc18: 'rgba(255,255,255,0.18)', onAcc30: 'rgba(255,255,255,0.30)', onAcc40: 'rgba(255,255,255,0.40)',
  onAcc55: 'rgba(255,255,255,0.55)', onAcc65: 'rgba(255,255,255,0.65)', onAcc70: 'rgba(255,255,255,0.70)',
  onAcc75: 'rgba(255,255,255,0.75)', onAcc80: 'rgba(255,255,255,0.80)',

  isDark: false,
}

export type SugarV2Palette = typeof SUGARV2_LIGHT

const SUGARV2_DARK: SugarV2Palette = {
  bg: '#0A0A0F',
  bgGradient: 'radial-gradient(ellipse 130% 95% at 50% -12%, #1B1C28 0%, #10111B 48%, #08080C 100%)',

  card: '#15151F',
  cardSubtle: '#212233',
  rail: '#15151F',
  railHover: '#1C1D29',

  black: '#ECEDF3',             // accent → near-white en dark
  blackHover: '#FFFFFF',
  onBlack: '#0A0A0F',           // texte / icône SUR l'accent near-white → sombre

  ink: '#ECEDF3',
  inkSoft: '#B7B9C6',
  muted: '#7C8094',
  ghost: '#3A3B4A',

  line: 'rgba(255,255,255,0.09)',

  // Ombres noires profondes + liseré supérieur clair (relief en dark)
  shadowSm: '0 1px 2px rgba(0,0,0,.45), 0 6px 18px -10px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.05)',
  shadow:   '0 1px 2px rgba(0,0,0,.5), 0 16px 40px -16px rgba(0,0,0,.7), inset 0 1px 0 rgba(255,255,255,.06)',
  shadowLg: '0 30px 70px -18px rgba(0,0,0,.75), 0 8px 24px -12px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.07)',
  shadowHover: '0 36px 84px -18px rgba(0,0,0,.8), 0 10px 28px -12px rgba(0,0,0,.65), inset 0 1px 0 rgba(255,255,255,.08)',
  pillShadow: '0 8px 20px -6px rgba(0,0,0,0.6)',
  pillShadowHover: '0 14px 34px -8px rgba(0,0,0,0.72)',
  ringSoft: 'rgba(255,255,255,0.10)',
  footerFade: 'linear-gradient(180deg, transparent 0%, rgba(10,10,15,0.82) 55%, rgba(8,8,12,1) 100%)',

  ok:   '#34C796',
  warn: '#F2B855',
  err:  '#F26B65',

  pop1: '#6F8CFF', pop2: '#F26B65', pop3: '#F2B855', pop4: '#34C796',

  // Voiles translucides SUR l'accent (dark : l'accent est near-white → voile sombre)
  onAcc04: 'rgba(11,12,14,0.05)', onAcc08: 'rgba(11,12,14,0.08)', onAcc10: 'rgba(11,12,14,0.10)',
  onAcc12: 'rgba(11,12,14,0.12)', onAcc15: 'rgba(11,12,14,0.16)', onAcc16: 'rgba(11,12,14,0.16)',
  onAcc18: 'rgba(11,12,14,0.18)', onAcc30: 'rgba(11,12,14,0.32)', onAcc40: 'rgba(11,12,14,0.42)',
  onAcc55: 'rgba(11,12,14,0.55)', onAcc65: 'rgba(11,12,14,0.62)', onAcc70: 'rgba(11,12,14,0.66)',
  onAcc75: 'rgba(11,12,14,0.72)', onAcc80: 'rgba(11,12,14,0.78)',

  isDark: true,
}

// Override explicite du thème (null = suivre le thème de l'app via `data-theme`).
let __forceDark: boolean | null = null

/**
 * Pilote le thème du wizard : `true`/`false` force dark/light, `null` rend la main
 * au thème de l'app. Le shell l'appelle au render pour coller à `useTheme()`, et son
 * cleanup repasse à `null`.
 *
 * IMPORTANT — pourquoi on lit `data-theme` quand l'override est `null` : sous React 18
 * (StrictMode / rendu concurrent), un enfant peut se re-render INDÉPENDAMMENT du shell.
 * S'il lisait un global muté au render du parent, il pourrait tomber sur une valeur
 * périmée (header en dark, corps en light). En résolvant depuis `document.documentElement
 * [data-theme]` — la source de vérité posée par `ThemeProvider` — chaque lecture de
 * `SugarV2.*` est correcte quel que soit le timing de render. Le Proxy garde une identité
 * stable (aucune capture `const SP = SugarV2` ne se fige).
 */
export function setSugarV2Dark(dark: boolean | null): void {
  __forceDark = dark
}

function sgIsDarkActive(): boolean {
  if (__forceDark !== null) return __forceDark
  if (typeof document !== 'undefined') {
    return document.documentElement.getAttribute('data-theme') === 'dark'
  }
  return false
}

function sgActive(): SugarV2Palette {
  return sgIsDarkActive() ? SUGARV2_DARK : SUGARV2_LIGHT
}

// `SugarV2` = Proxy à identité stable qui résout le thème actif à chaque lecture.
export const SugarV2: SugarV2Palette = new Proxy({} as SugarV2Palette, {
  get: (_t, k) => (sgActive() as Record<PropertyKey, unknown>)[k],
  has: (_t, k) => k in SUGARV2_LIGHT,
  ownKeys: () => Reflect.ownKeys(SUGARV2_LIGHT),
  getOwnPropertyDescriptor: (_t, k) => ({
    enumerable: true,
    configurable: true,
    value: (sgActive() as Record<PropertyKey, unknown>)[k],
  }),
})

// ─── Helpers thème-aware pour les littéraux qui étaient codés en dur ───────
// `sgOn()`  : couleur d'un texte / icône POSÉ SUR l'accent (jamais `#fff` en dur).
// `sgAcc(a)`: voile translucide POSÉ SUR l'accent (blanc en light, sombre en dark).
export const sgOn = (): string => sgActive().onBlack
export const sgAcc = (a: number): string =>
  sgActive().isDark ? `rgba(11,12,14,${a})` : `rgba(255,255,255,${a})`

// ─── Helpers ─────────────────────────────────────────────────────────────
export function fmtCHF(n: number | string | null | undefined): string {
  if (n == null || n === '') return ''
  const num = typeof n === 'number' ? n : parseInt(String(n).replace(/\D/g, ''), 10)
  if (Number.isNaN(num)) return ''
  return num.toLocaleString('fr-CH').replace(/[\u00A0\u202F,]/g, "'")
}

export function shade(hex: string, amt: number): string {
  const c = hex.replace('#', '')
  const r = parseInt(c.slice(0, 2), 16)
  const g = parseInt(c.slice(2, 4), 16)
  const b = parseInt(c.slice(4, 6), 16)
  const adj = (v: number) => Math.max(0, Math.min(255, Math.round(v + 255 * amt)))
  return `rgb(${adj(r)}, ${adj(g)}, ${adj(b)})`
}

export function cantonShortFromName(name: string): string {
  const map: Record<string, string> = {
    'Genève': 'GE', 'Vaud': 'VD', 'Fribourg': 'FR', 'Valais': 'VS', 'Neuchâtel': 'NE',
    'Jura': 'JU', 'Berne': 'BE', 'Bern': 'BE', 'Soleure': 'SO', 'Solothurn': 'SO',
    'Bâle-Ville': 'BS', 'Basel-Stadt': 'BS', 'Bâle-Campagne': 'BL',
    'Argovie': 'AG', 'Aargau': 'AG', 'Lucerne': 'LU', 'Luzern': 'LU',
    'Zurich': 'ZH', 'Zürich': 'ZH', 'Zoug': 'ZG', 'Zug': 'ZG',
    'Schwyz': 'SZ', 'Schaffhouse': 'SH', 'Schaffhausen': 'SH',
    'Thurgovie': 'TG', 'Thurgau': 'TG', 'Tessin': 'TI', 'Ticino': 'TI',
    'Grisons': 'GR', 'Graubünden': 'GR', 'Saint-Gall': 'SG', 'St. Gallen': 'SG',
    'Appenzell Rhodes-Extérieures': 'AR', 'Appenzell Rhodes-Intérieures': 'AI',
    'Glaris': 'GL', 'Glarus': 'GL', 'Nidwald': 'NW', 'Nidwalden': 'NW',
    'Obwald': 'OW', 'Obwalden': 'OW', 'Uri': 'UR',
  }
  return map[name] || ''
}

// ─── Wizard data shape ──────────────────────────────────────────────────
export interface WizardMandate {
  type: 'exclusive' | 'simple' | 'co'
  duration: number
  commission: number
  signed: boolean
  signedAt?: string
  fees: 'owner' | 'buyer'
  importedFile?: string | null
  extractedFields?: { key: string; label: string; value: string }[] | null
}

export interface WizardPhoto {
  id: string
  label: string
  kind: 'interior' | 'exterior' | 'plan'
  tone: string
  uploadedAt?: string
  variantOf?: string
  style?: string
  prompt?: string
  model?: string
  provenance?: string
  seed?: string
}

export interface WizardOptions {
  virtualStagingUser: boolean
  virtualStagingAgent: string[]
  featured: boolean
  videoTour: boolean
}

export interface WizardData {
  source: 'manual' | 'import' | 'submission' | null
  fromSubmissionId: string | null
  importUrl: string
  importFile: File | null
  ownerContactId: string | null
  _newContact: { id: string; firstName: string; lastName: string; email: string; phone: string; type: string; kyc: { status: string }; avatarBg: string } | null
  mandate: WizardMandate
  addr: string
  addrConfirmed?: boolean
  addrStreet?: string
  addrHouseNumber?: string
  postCode: string
  city?: string
  canton: string
  cantonShort?: string
  country: string
  coords?: [number, number] | null
  unit?: string
  floor?: number | null
  floorsTotal?: number | null
  cadastralId?: string
  type: 'appartement' | 'maison' | 'villa' | 'terrain'
  area: number | null
  rooms: number | null
  bedrooms: number | null
  bathrooms: number | null
  year: number | null
  energy: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | null
  features: string[]
  photos: WizardPhoto[]
  description: string
  aiAssist: boolean
  descTone?: 'neutre' | 'premium' | 'famille' | 'invest'
  transaction: 'vente' | 'location'
  price: number | null
  rent: number | null
  charges: number | null
  options: WizardOptions
  visibility: 'public' | 'network' | 'private'
  publishMode: 'now' | 'schedule' | 'draft'
  scheduledAt?: string
}

export const EMPTY_WIZARD: WizardData = {
  source: null, fromSubmissionId: null, importUrl: '', importFile: null,
  ownerContactId: null, _newContact: null,
  mandate: { type: 'exclusive', duration: 6, commission: 3.5, signed: false, fees: 'owner' },
  addr: '', canton: 'Vaud', postCode: '', country: 'Suisse',
  type: 'appartement', area: null, rooms: null, bedrooms: null, bathrooms: null,
  year: null, energy: null, features: [],
  photos: [], description: '', aiAssist: false,
  transaction: 'vente', price: null, rent: null, charges: null,
  options: { virtualStagingUser: false, virtualStagingAgent: [], featured: false, videoTour: false },
  visibility: 'public', publishMode: 'now',
}

// ─── Wizard steps definition ────────────────────────────────────────────
export const SG_STEPS = [
  { id: 'start',    label: 'Démarrer' },
  { id: 'mandate',  label: 'Vendeur' },
  { id: 'address',  label: 'Adresse' },
  { id: 'specs',    label: 'Caractéristiques' },
  { id: 'photos',   label: 'Photos' },
  { id: 'desc',     label: 'Description' },
  { id: 'options',  label: 'Options' },
  { id: 'publish',  label: 'Publication' },
] as const

// ─── Sugar wizard global keyframes ─────────────────────────────────────
export const SG_KEYFRAMES = `
  @keyframes sgFadeUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes sgScaleIn {
    from { opacity: 0; transform: scale(.96); }
    to   { opacity: 1; transform: scale(1); }
  }
  @keyframes sgSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes sgPulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50%     { transform: scale(0.92); opacity: 0.85; }
  }
  @keyframes sgPinPulse {
    0%, 100% { transform: scale(1); box-shadow: 0 8px 24px rgba(11,12,14,0.4), 0 0 0 0 rgba(11,12,14,0.4); }
    50%      { transform: scale(1.06); box-shadow: 0 8px 24px rgba(11,12,14,0.4), 0 0 0 12px rgba(11,12,14,0); }
  }
  @keyframes sgRingPulse {
    0%   { transform: scale(1); opacity: 0.5; }
    100% { transform: scale(1.7); opacity: 0; }
  }
  @keyframes sgLivePulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.55); }
    50%      { box-shadow: 0 0 0 6px rgba(16,185,129,0); }
  }
  @keyframes sgCount {
    from { transform: translateY(8px); opacity: 0; }
    to   { transform: translateY(0); opacity: 1; }
  }
  @keyframes sgConfettiFall {
    0%   { transform: translate3d(0, -20px, 0) rotate(0deg);   opacity: 0; }
    10%  { opacity: 1; }
    100% { transform: translate3d(var(--dx), 700px, 0) rotate(var(--rot)); opacity: 0; }
  }
  .sg-range::-webkit-slider-thumb {
    -webkit-appearance: none; appearance: none;
    width: 24px; height: 24px; border-radius: 999px;
    background: var(--sg-accent, #0B0C0E); cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    transition: transform .15s ease;
  }
  .sg-range::-webkit-slider-thumb:hover { transform: scale(1.15); }
  .sg-range::-moz-range-thumb {
    width: 24px; height: 24px; border-radius: 999px;
    background: var(--sg-accent, #0B0C0E); cursor: pointer; border: 0;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  }
`
