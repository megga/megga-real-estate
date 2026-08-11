// MEGGA CRM — Wizard « Créer un bien » — jetons de palette.
// Port d'origine : le bundle Claude Design (crm-wizard-sugar-v2.jsx).
import i18nSg from '@/i18n' // labels d'étapes i18n (getters SG_STEPS)
import { MXC_COLOR, mxCrmPalette } from '@/components/megga-x-crm/tokens'
import { sgMix } from '@/components/crm-sugar/tokens'
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
// ─── Direction ───────────────────────────────────────────────────────────
// Les DEUX thèmes descendent de `mxCrmPalette()`. Avant le 11 août 2026 ce
// fichier était le dernier jeu de jetons AUTONOME du CRM : le clair rendait le
// gris bleuté de Sugar et un accent NOIR — `#424bfb` n'apparaissait pas une
// fois dans les 4 832 lignes du wizard —, et le sombre ne dérivait que ses
// SURFACES, ses quatre encres restant bleutées hors échelle.
//
// ⚠ `black` est un nom HISTORIQUE. Sous Sugar Pure l'accent ÉTAIT l'encre : noir
// le jour, near-white la nuit. Il vaut désormais `#424bfb` dans les deux thèmes
// (règle du 10 août 2026, cf. `CLAUDE.md` §3). Ce qui est posé dessus est donc
// TOUJOURS blanc — d'où `sgOn()` devenue constante, plus bas.
//
// Garde-fou : `tests/unit/wizard-palette.spec.ts`.

const MX_LIGHT = mxCrmPalette(false)
const MX_DARK = mxCrmPalette(true)

// Survol de l'accent : la vitrine n'en publie aucun barreau — son
// `.primary-button:hover` ne change pas de teinte, il grandit
// (`transform: scale3d(1.04…)`). On le dérive donc de l'accent lui-même, comme
// les Réglages (`settings/data.ts`), plutôt que d'inventer une couleur.
//
// ⚠ En sombre on éclaircit de 0,12 et non de 0,16 comme les Réglages : tout
// éclaircissement de l'accent coûte du contraste à l'encre BLANCHE posée dessus.
// Mesuré — 0,16 rend 4,30:1, sous l'AA ; 0,12 rend 4,64:1. Le plafond est
// intrinsèque (l'accent nu est déjà à 5,78:1), pas un réglage libre.
const ACCENT_HOVER_LIGHT = sgMix(MXC_COLOR.accent, '#000000', 0.14)
const ACCENT_HOVER_DARK = sgMix(MXC_COLOR.accent, '#FFFFFF', 0.12)

const SUGARV2_LIGHT = {
  // Fond — radial doux, même géométrie qu'avant, sur les barreaux de la vitrine
  bg: MX_LIGHT.pageBg,
  bgGradient: `radial-gradient(ellipse 120% 80% at 50% 100%, ${MXC_COLOR.n700} 0%, ${MXC_COLOR.n800} 50%, ${MXC_COLOR.n900} 100%)`,

  // Surfaces
  card: MX_LIGHT.cardBg,
  cardSubtle: MX_LIGHT.cardSubBg,
  rail: MX_LIGHT.frameBg,
  railHover: MX_LIGHT.focusSurface,

  // Accent unique
  black: MX_LIGHT.accent,
  blackHover: ACCENT_HOVER_LIGHT,
  onBlack: MX_LIGHT.accentInk,  // texte / icône POSÉ SUR l'accent

  // Texte
  ink: MX_LIGHT.ink,
  inkSoft: MX_LIGHT.soft,
  muted: MX_LIGHT.sub,
  // `ghost` = trait ou encre FAIBLE (filet, bordure pointillée, piste de
  // spinner, libellé désactivé). ⚠ Il ne sert PAS de remplissage : voir
  // `ghostSolid`, qui doit porter une encre blanche.
  //
  // `as string` élargit : `MXC_COLOR` est `as const`, donc sans lui le type de
  // la palette serait le LITTÉRAL `'#a3a3a3'` et la branche sombre ne pourrait
  // pas prendre un autre barreau. Les autres jetons passent par `mxCrmPalette()`,
  // dont le retour est déjà élargi.
  ghost: MXC_COLOR.n600 as string,
  // Remplissage d'un contrôle DÉSACTIVÉ, sous encre blanche (5,57:1). Avant le
  // 11 août 2026 les trois boutons concernés reprenaient `ghost` : blanc sur
  // `#B5BAC2`, soit 2,0:1. Un barreau ne peut pas servir les deux rôles.
  ghostSolid: MXC_COLOR.n500 as string,

  // Hairline / divider structurel
  line: 'rgba(3,3,3,0.08)',

  // Ombres — la profondeur relève de la GRAMMAIRE, portée par le lot suivant.
  shadowSm: '0 4px 16px rgba(15, 23, 42, 0.04)',
  shadow:   '0 12px 40px rgba(15, 23, 42, 0.06), 0 2px 8px rgba(15, 23, 42, 0.03)',
  shadowLg: '0 24px 60px rgba(15, 23, 42, 0.08), 0 4px 16px rgba(15, 23, 42, 0.04)',
  shadowHover: '0 32px 70px rgba(15, 23, 42, 0.10), 0 6px 20px rgba(15, 23, 42, 0.05)',
  pillShadow: '0 6px 16px rgba(11,12,14,0.18)',
  pillShadowHover: '0 12px 30px rgba(11,12,14,0.25)',
  footerFade: `linear-gradient(180deg, transparent 0%, ${MXC_COLOR.n900}E6 60%, ${MXC_COLOR.n900} 100%)`,

  // États — employés en ENCRE sur surface claire. Les teintes de `MXC_SYSTEM`
  // sont réglées pour le canvas `#030303` de la vitrine et n'y répondent pas.
  ok:   '#10B981',
  warn: '#F59E0B',
  err:  '#EF4444',

  // Avatars / pastilles d'équipe — `pop1` est écrit dans la DONNÉE du contact
  // (`avatarBg`) : il encode une identité, il ne décore pas.
  pop1: '#3B82F6',
  pop2: '#EF4444',
  pop3: '#FBBF24',
  pop4: '#10B981',

  isDark: false,
}

export type SugarV2Palette = typeof SUGARV2_LIGHT

const SUGARV2_DARK: SugarV2Palette = {
  bg: MX_DARK.pageBg,
  bgGradient: `radial-gradient(ellipse 130% 95% at 50% -12%, ${MXC_COLOR.n400} 0%, ${MXC_COLOR.n200} 48%, ${MXC_COLOR.n100} 100%)`,

  card: MX_DARK.cardBg,
  cardSubtle: MX_DARK.cardSubBg,
  rail: MX_DARK.frameBg,
  railHover: MX_DARK.focusSurface,

  black: MX_DARK.accent,
  blackHover: ACCENT_HOVER_DARK,
  onBlack: MX_DARK.accentInk,

  ink: MX_DARK.ink,
  inkSoft: MX_DARK.soft,
  muted: MX_DARK.sub,
  ghost: MXC_COLOR.n500,
  ghostSolid: MXC_COLOR.n500,

  line: 'rgba(255,255,255,0.09)',

  // Ombres noires profondes + liseré supérieur clair (relief en dark)
  shadowSm: '0 1px 2px rgba(0,0,0,.45), 0 6px 18px -10px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.05)',
  shadow:   '0 1px 2px rgba(0,0,0,.5), 0 16px 40px -16px rgba(0,0,0,.7), inset 0 1px 0 rgba(255,255,255,.06)',
  shadowLg: '0 30px 70px -18px rgba(0,0,0,.75), 0 8px 24px -12px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.07)',
  shadowHover: '0 36px 84px -18px rgba(0,0,0,.8), 0 10px 28px -12px rgba(0,0,0,.65), inset 0 1px 0 rgba(255,255,255,.08)',
  pillShadow: '0 8px 20px -6px rgba(0,0,0,0.6)',
  pillShadowHover: '0 14px 34px -8px rgba(0,0,0,0.72)',
  footerFade: `linear-gradient(180deg, transparent 0%, ${MXC_COLOR.n100}D1 55%, ${MXC_COLOR.n100} 100%)`,

  ok:   '#34C796',
  warn: '#F2B855',
  err:  '#F26B65',

  pop1: '#6F8CFF', pop2: '#F26B65', pop3: '#F2B855', pop4: '#34C796',

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

// ─── Helpers : ce qu'on pose SUR l'accent, et ce qu'on pose SUR une surface ──
//
// Ces deux-là s'inversaient avec le thème tant que l'accent s'inversait lui-même
// (noir le jour, near-white la nuit). L'accent vaut `#424bfb` dans les deux
// thèmes depuis le 10 août 2026 : ce qui repose dessus ne bascule plus.

/**
 * Couleur d'un texte / d'une icône POSÉ SUR l'accent — jamais `#fff` en dur.
 *
 * ⛔ Constante, et c'est délibéré. La fonction reste parce qu'elle nomme une
 * RELATION — « l'encre posée sur l'accent » — et que c'est ce que veulent dire
 * ses 45 appels ; qu'elle se résolve aujourd'hui en une seule valeur est une
 * conséquence MESURÉE de l'invariance de l'accent (blanc sur `#424bfb` = 5,78:1),
 * pas une raison d'effacer leur intention. Si l'accent sombre devait un jour
 * passer à `MXC_SYSTEM.blue300` — le seul barreau qui tienne en encre sur fond
 * sombre —, la question redeviendrait vivante ici, en un seul point.
 *
 * Elle lisait `document.documentElement[data-theme]` à chaque appel : la rendre
 * constante retire 45 lectures du DOM par render.
 */
export const sgOn = (): string => MXC_COLOR.n1000

/** Voile translucide POSÉ SUR l'accent — blanc, pour la raison ci-dessus. */
export const sgAcc = (a: number): string => `rgba(255,255,255,${a})`

/**
 * Voile translucide POSÉ SUR UNE SURFACE (carte, canvas, tuile de carte
 * géographique) — celui-là suit le thème, parce que la surface le suit.
 *
 * ⚠ Séparé de `sgAcc` le 11 août 2026. Les deux coïncidaient tant que l'accent
 * s'inversait : en clair « voile sur l'accent noir » et « voile sur le canvas
 * clair » valaient tous deux du blanc, en sombre tous deux du sombre. L'accent
 * devenu invariant, la coïncidence tombe — et les deux pastilles posées sur la
 * carte de l'étape Adresse, qui portent `SugarV2.muted` en encre, seraient
 * devenues du gris sur du blanc au milieu d'une carte sombre.
 */
export const sgVeil = (a: number): string =>
  sgActive().isDark ? `rgba(3,3,3,${a})` : `rgba(255,255,255,${a})`

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
  // Vraie photo ajoutée par l'agent (dropzone PC). `file` est consommé à la
  // publication (upload bucket + miroir R2) ; `previewUrl` (object URL) sert
  // à l'aperçu dans le wizard ; `url` = URL persistée après upload réel. Une
  // tuile sans `file` ni `url` (placeholder mobile/drive) n'est JAMAIS
  // persistée — aucune photo fabriquée sur l'annonce.
  file?: File
  previewUrl?: string
  url?: string
}

export interface WizardOptions {
  featured: boolean
  videoTour: boolean
}

// Détails du bien — Q7 « Les détails du bien » (accordéon Step 3b). Sections
// STRICTEMENT conditionnelles au type (familles apt/house/terrain/commerce). Tous
// les champs sauf `ref`/`ext`/`equip`/`lux` sont optionnels (remplis au fil de l'eau).
// `ref` (MEG-2026-XXXX) est un IDENTIFIANT D'AFFICHAGE, pas la référence réelle du bien.
export interface WizardDetails {
  ref: string
  // Surfaces (m²), par famille
  sPPE?: number | null
  sHab?: number | null
  sUtile?: number | null
  sPond?: number | null
  sBalc?: number | null
  sTerr?: number | null
  sJard?: number | null
  sTerrain?: number | null
  // Informations générales
  standing?: string | null
  dispo?: string | null           // date « JJ.MM.AAAA » ou « À convenir »
  renovYear?: number | null
  charges?: number | null         // house / commerce
  // Pièces
  chambres?: number | null
  sdb?: number | null
  wc?: number | null
  // Extérieurs
  ext: string[]
  expo?: string | null
  // Stationnement
  pInt?: number | null
  pExt?: number | null
  pGarage?: number | null
  pBox?: number | null
  pVisit?: number | null
  borne?: boolean
  // Équipements
  equip: string[]
  // Immeuble (apt)
  etage?: number | null
  floors?: number | null
  chargesPPE?: number | null
  fondsReno?: number | null
  // Chauffage & énergie
  heat?: string | null
  floorHeat?: boolean
  pv?: boolean
  solarTherm?: boolean
  glazing?: string | null
  // Prestations de luxe (standing Luxe/Ultra-luxe)
  lux: string[]
}

export interface WizardData {
  source: 'manual' | 'import' | 'submission' | null
  fromSubmissionId: string | null
  importUrl: string
  importFile: File | null
  ownerContactId: string | null
  _newContact: { id: string; firstName: string; lastName: string; email: string; phone: string; type: string; kyc: { status: string }; avatarBg: string } | null
  // Snapshot d'affichage du vendeur EXISTANT sélectionné (nom/avatar/kyc), figé
  // au moment du choix. Indispensable car les étapes aval (Mandat/Adresse/
  // Publication) ne peuvent PAS re-résoudre le contact par id : le registry
  // runtime (useContactsSugar) est vidé au démontage de Step1Vendor. Distinct
  // de _newContact (brouillon à créer) : ici le contact existe déjà (UUID réel).
  _ownerContact: { id: string; firstName: string; lastName: string; email: string; phone: string; type: string; kyc: { status: string }; avatarBg: string } | null
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
  // 10 types (liste Gregory) regroupés en familles apt/house/terrain/commerce par
  // sp4bFamily (Step 3b). Le mapping vers l'enum DB `property_type` vit dans
  // TYPE_TO_ENUM (WizardShell) — étendre les DEUX ensemble.
  type: 'appartement' | 'attique' | 'duplex' | 'triplex' | 'loft' | 'maison' | 'villa' | 'chalet' | 'terrain' | 'commerce'
  area: number | null
  rooms: number | null
  bedrooms: number | null
  bathrooms: number | null
  year: number | null
  energy: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | null
  features: string[]
  /** Sous-parcours guidé de l'étape Caractéristiques (0→6 ; Q7 = accordéon détails). */
  specsQ?: number
  /** Détails du bien (Q7) — conditionnels au type, initialisés au montage du Step 3b. */
  det?: WizardDetails
  photos: WizardPhoto[]
  description: string
  aiAssist: boolean
  descTone?: 'neutre' | 'premium' | 'famille' | 'invest'
  transaction: 'vente' | 'location'
  /** Phase de l'étape Prix & Description (0 = prix en grand, 1 = description). */
  priceStep?: number
  price: number | null
  rent: number | null
  charges: number | null
  options: WizardOptions
  visibility: 'public' | 'network' | 'private'
  /**
   * Id de la ligne `properties` créée par le brouillon automatique
   * (`useWizardDraft`), posé dès la première adresse saisie. La publication met
   * cette ligne à jour au lieu d'en créer une seconde.
   *
   * ⚠ Remplace `publishMode` ('now' | 'schedule' | 'draft'), retiré le 11 août
   * 2026. Deux de ses trois valeurs écrivaient le MÊME `status: 'draft'` :
   * « Programmer » promettait une mise en ligne différée qu'aucun cron n'a
   * jamais assurée, et « Brouillon » demandait à l'agent de choisir, à la
   * dernière étape, l'état dans lequel son travail se trouvait déjà.
   */
  _draftId?: string
}

export const EMPTY_WIZARD: WizardData = {
  source: null, fromSubmissionId: null, importUrl: '', importFile: null,
  ownerContactId: null, _newContact: null, _ownerContact: null,
  mandate: { type: 'exclusive', duration: 6, commission: 3.5, signed: false, fees: 'owner' },
  addr: '', canton: 'Vaud', postCode: '', country: 'Suisse',
  type: 'appartement', area: null, rooms: null, bedrooms: null, bathrooms: null,
  year: null, energy: null, features: [],
  photos: [], description: '', aiAssist: false,
  transaction: 'vente', price: null, rent: null, charges: null,
  options: { featured: false, videoTour: false },
  visibility: 'public',
}

// ─── Wizard steps definition ────────────────────────────────────────────
// label en getter (i18n singleton) : traduit + réactif, sans changer les
// appelants `step.label`. Cf docs/i18n-conventions §6. (i18nSg importé ci-dessous.)
export const SG_STEPS = [
  { id: 'start',    get label() { return i18nSg.t('listings:wizard.steps.start') } },
  { id: 'mandate',  get label() { return i18nSg.t('listings:wizard.steps.mandate') } },
  { id: 'address',  get label() { return i18nSg.t('listings:wizard.steps.address') } },
  { id: 'specs',    get label() { return i18nSg.t('listings:wizard.steps.specs') } },
  { id: 'photos',   get label() { return i18nSg.t('listings:wizard.steps.photos') } },
  { id: 'desc',     get label() { return i18nSg.t('listings:wizard.steps.desc') } },
  { id: 'publish',  get label() { return i18nSg.t('listings:wizard.steps.publish') } },
] as const

// ─── Sugar wizard global keyframes ─────────────────────────────────────
export const SG_KEYFRAMES = `
  @keyframes sgFadeUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes sgPage {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes sgSavePop { 0% { transform: scale(.4); opacity: 0 } 60% { transform: scale(1.15) } 100% { transform: scale(1); opacity: 1 } }
  @media (prefers-reduced-motion: reduce) {
    [style*="sgPage"] { animation: none !important; opacity: 1 !important; transform: none !important; }
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
    background: var(--sg-accent, #424bfb); cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    transition: transform .15s ease;
  }
  .sg-range::-webkit-slider-thumb:hover { transform: scale(1.15); }
  .sg-range::-moz-range-thumb {
    width: 24px; height: 24px; border-radius: 999px;
    background: var(--sg-accent, #424bfb); cursor: pointer; border: 0;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  }
`
