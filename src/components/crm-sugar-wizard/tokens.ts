// MEGGA CRM Sugar v2 Wizard — Design tokens (palette unique, distinct from Today).
// 1:1 port from the Claude Design bundle (crm-wizard-sugar-v2.jsx).
//
// — Fond gris très clair avec radial gradient vers bleu pâle en bas
// — Cards blanches pures, ombres 40px/5%, coins 24px, AUCUNE bordure
// — Accent unique = NOIR PUR (pas de bleu, pas de violet, pas de gradient)
// — Typo : noir #0B0C0E franc, jamais de gris pour les titres

export const SugarV2 = {
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

  // Texte
  ink: '#0B0C0E',
  inkSoft: '#3A3D44',
  muted: '#7A8088',
  ghost: '#B5BAC2',

  // Ombres signature Sugar
  shadowSm: '0 4px 16px rgba(15, 23, 42, 0.04)',
  shadow:   '0 12px 40px rgba(15, 23, 42, 0.06), 0 2px 8px rgba(15, 23, 42, 0.03)',
  shadowLg: '0 24px 60px rgba(15, 23, 42, 0.08), 0 4px 16px rgba(15, 23, 42, 0.04)',
  shadowHover: '0 32px 70px rgba(15, 23, 42, 0.10), 0 6px 20px rgba(15, 23, 42, 0.05)',

  // États (utilitaires uniquement, jamais décoratifs)
  ok:   '#10B981',
  warn: '#F59E0B',
  err:  '#EF4444',

  // Avatars / pastilles d'équipe
  pop1: '#3B82F6',
  pop2: '#EF4444',
  pop3: '#FBBF24',
  pop4: '#10B981',
} as const

export type SugarV2Palette = typeof SugarV2

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
    background: #0B0C0E; cursor: pointer;
    box-shadow: 0 4px 12px rgba(11,12,14,0.3);
    transition: transform .15s ease;
  }
  .sg-range::-webkit-slider-thumb:hover { transform: scale(1.15); }
  .sg-range::-moz-range-thumb {
    width: 24px; height: 24px; border-radius: 999px;
    background: #0B0C0E; cursor: pointer; border: 0;
    box-shadow: 0 4px 12px rgba(11,12,14,0.3);
  }
`
