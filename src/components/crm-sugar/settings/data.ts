// MEGGA CRM Sugar v2 — Settings data + palette
// 1:1 port from `crm-screen-settings-sugar.jsx`.
// i18n : labels de nav (sections/groupes) via getters singleton — cf §6 conventions.
import i18n from '@/i18n'
import { crmStep } from '@/components/crm-sugar/tokens'

// 'team' + 'brand' supprimés en PR #455 (BrandSection + TeamSection 100% mock,
// pas de tables agency_branding ni agency_members en prod). Suivi via les
// issues GitHub :
//   - #455 Wire BrandSection back: agency_branding table + storage uploads
//   - #456 Wire TeamSection back: agency_members + RBAC + Resend invites
export type SectionId =
  | 'profile' | 'agency'
  | 'notifications' | 'integrations'
  | 'billing' | 'security' | 'preferences'

export interface SettingsSection {
  id: SectionId
  label: string
  short: string
  icon: SettingsIconName
  group: 'moi' | 'produit' | 'compte'
}

export type SettingsIconName =
  | 'user' | 'building' | 'users' | 'palette' | 'bell' | 'plug'
  | 'card' | 'lock' | 'shield' | 'sliders' | 'check' | 'camera'
  | 'pen' | 'arrowR' | 'chevR' | 'x' | 'info'
  | 'mail' | 'sms' | 'app' | 'moon' | 'keyboard' | 'globe' | 'sparkle'
  | 'key' | 'download' | 'help' | 'eye' | 'eyeOff' | 'clock' | 'alert'
  | 'doc' | 'trash' | 'plus' | 'receipt'
  | 'mailSend' | 'crown' | 'more'
  | 'link' | 'external'

// Sections câblées (visibles dans le menu) et sections en attente de wire.
//
// Visible :
//   - Profile       → useAgentProfileSugar (profiles + agent_profiles)
//   - Agency        → useAgencySettings (agencies table)
//   - Notifications → useNotifPreferences (profiles.preferences.notifications)
//   - Preferences   → useUiPreferences (profiles.preferences.ui)
//   - Integrations  → useGoogleCalendar + useOutlookCalendar (real OAuth)
//   - Privacy       → delete-account Edge Function + mailto DSAR (PR #453)
//   - Security      → password change/reset via supabase.auth.updateUser
//                     / resetPasswordForEmail + SSO
//   - Billing       → reads still partial; chip pour Stripe Checkout
//
// Team + Brand : composants supprimés en PR #455 (suivi via issues GitHub
// #455 Brand + #456 Team — réintroduits quand agency_branding /
// agency_members existent en DB).
// Ordre canonique de la maquette « Sugar Pure » (7 sections) :
// profile, agency, notifications, integrations, billing, security, preferences.
// Bandeau pill → 5 premières en pilules, le reste (security, preferences) sous « Plus ».
// (Confidentialité retirée — absente de la maquette Claude Design. Le câblage
//  delete-account + export DSAR/nLPD reste dans PrivacySection.tsx, non monté.)
// i18n : label/short en getters (lus via l'instance i18n singleton à l'accès →
// traduits + réactifs, sans changer les sites d'appel `.label`/`.short`).
// Cf docs/i18n-conventions §6.
export const SETTINGS_SECTIONS: SettingsSection[] = [
  { id: 'profile', get label() { return i18n.t('settings:nav.sections.profile.label') }, get short() { return i18n.t('settings:nav.sections.profile.short') }, icon: 'user', group: 'moi' },
  { id: 'agency', get label() { return i18n.t('settings:nav.sections.agency.label') }, get short() { return i18n.t('settings:nav.sections.agency.short') }, icon: 'building', group: 'moi' },
  { id: 'notifications', get label() { return i18n.t('settings:nav.sections.notifications.label') }, get short() { return i18n.t('settings:nav.sections.notifications.short') }, icon: 'bell', group: 'produit' },
  { id: 'integrations', get label() { return i18n.t('settings:nav.sections.integrations.label') }, get short() { return i18n.t('settings:nav.sections.integrations.short') }, icon: 'plug', group: 'produit' },
  { id: 'preferences', get label() { return i18n.t('settings:nav.sections.preferences.label') }, get short() { return i18n.t('settings:nav.sections.preferences.short') }, icon: 'sliders', group: 'produit' },
  { id: 'billing', get label() { return i18n.t('settings:nav.sections.billing.label') }, get short() { return i18n.t('settings:nav.sections.billing.short') }, icon: 'card', group: 'compte' },
  { id: 'security', get label() { return i18n.t('settings:nav.sections.security.label') }, get short() { return i18n.t('settings:nav.sections.security.short') }, icon: 'lock', group: 'compte' },
]

export interface ProfileData {
  firstName: string
  lastName: string
  title: string
  agency: string
  email: string
  phone: string
  mobile: string
  rcc: string
  languages: string[]
  specialties: string[]
  bio: string
  signature: string
  /** Liens publics (settings Focus « Liens ») — agent_profiles.website_url / linkedin_url. */
  website: string
  linkedin: string
  initials: string
  avatarBg: string
  // Champs maquette « Sugar Pure ». Optionnels : la passe DB (différée) leur
  // donnera de vraies colonnes ; en attendant ils vivent dans le formulaire et
  // (signatureMode/avatarUrl) sur les colonnes existantes quand elles existent.
  signatureMode?: 'text' | 'html'
  signatureHtml?: string
  avatarUrl?: string | null
}

export const DEFAULT_PROFILE: ProfileData = {
  firstName: 'Gregory',
  lastName: 'Lyonnet',
  title: 'Agent principal',
  agency: 'MEGGA Genève',
  email: 'gregory@megga.ch',
  phone: '+41 22 555 01 02',
  mobile: '+41 79 412 88 21',
  rcc: 'RCC-2018-GE-4421',
  languages: ['Français', 'Anglais', 'Italien'],
  specialties: ['Résidentiel haut de gamme', 'Mandats exclusifs', 'Cologny / Champel'],
  bio: "Spécialiste du marché genevois depuis 12 ans. Accompagnement haut de gamme sur Cologny, Champel et la Vieille-Ville. Mandats exclusifs uniquement, conformité C2PA sur l'ensemble du portefeuille.",
  signature: 'Cordialement,\nGregory Lyonnet\nMEGGA Genève · +41 22 555 01 02',
  website: '',
  linkedin: '',
  initials: 'GL',
  avatarBg: '#0041D9',
  signatureMode: 'text',
  signatureHtml: '',
  avatarUrl: null,
}

export interface SettingsPalette {
  bg: string
  bgGradient: string
  card: string
  cardSubtle: string
  /** Fond d'un champ quand il a le focus (blanc en light, sous-surface en dark). */
  inputFocusBg: string
  /** Accent unique : noir pur en light, off-white en dark. */
  black: string
  blackHover: string
  /** Couleur du texte/icône POSÉ sur l'accent — jamais #fff codé en dur. */
  blackInk: string
  ink: string
  inkSoft: string
  muted: string
  ghost: string
  line: string
  shadowSm: string
  shadow: string
  shadowLg: string
  shadowHover: string
  ok: string
  warn: string
  err: string
  bad: string
}

// Palette « Sugar Pure ». RÈGLE D'ACCENT (non négociable) : l'accent est noir pur
// #0B0C0E en light et off-white #ECEDF3 en dark ; le texte posé dessus utilise
// TOUJOURS `blackInk` (#FFFFFF light / #14161C dark) pour rester lisible.
export const SET_LIGHT: SettingsPalette = {
  bg: '#EDEFF3',
  bgGradient:
    'radial-gradient(ellipse 120% 80% at 50% 100%, #C8D5E0 0%, #E2E5EB 50%, #EDEFF3 100%)',
  card: '#FFFFFF',
  cardSubtle: '#F7F8FA',
  inputFocusBg: '#FFFFFF',
  black: '#0B0C0E',
  blackHover: '#1F2024',
  blackInk: '#FFFFFF',
  ink: '#0B0C0E',
  inkSoft: '#3A3D44',
  muted: '#7A8088',
  ghost: '#B5BAC2',
  line: 'rgba(15,23,42,0.06)',
  shadowSm: '0 4px 16px rgba(15, 23, 42, 0.04)',
  shadow: '0 12px 40px rgba(15, 23, 42, 0.06), 0 2px 8px rgba(15, 23, 42, 0.03)',
  shadowLg: '0 24px 60px rgba(15, 23, 42, 0.08), 0 4px 16px rgba(15, 23, 42, 0.04)',
  shadowHover: '0 32px 70px rgba(15, 23, 42, 0.10), 0 6px 20px rgba(15, 23, 42, 0.05)',
  ok: '#10B981',
  warn: '#F59E0B',
  err: '#EF4444',
  bad: '#EF4444',
}

// Surfaces en GETTERS : `applySetTheme` les recopie par `Object.assign` avant
// chaque rendu de la page, donc elles suivent la teinte sombre active.
export const SET_DARK: SettingsPalette = {
  get bg() { return crmStep('s0', '#0A0A0F') },
  get bgGradient() {
    return `radial-gradient(ellipse 120% 80% at 50% 100%, ${crmStep('s3', '#1A1C26')} 0%, ${crmStep('s1', '#101019')} 48%, ${crmStep('s0', '#0A0A0F')} 100%)`
  },
  get card() { return crmStep('s2', '#16171F') },
  get cardSubtle() { return crmStep('s3', '#1E1F2A') },
  get inputFocusBg() { return crmStep('s3', '#1E1F2A') },
  black: '#ECEDF3',
  blackHover: '#FFFFFF',
  blackInk: '#14161C',
  ink: '#ECEDF3',
  inkSoft: '#B5B7C4',
  muted: '#797D90',
  ghost: '#3A3B47',
  line: 'rgba(255,255,255,0.09)',
  shadowSm: '0 1px 2px rgba(0,0,0,.4), 0 6px 18px -10px rgba(0,0,0,.6)',
  shadow: '0 1px 2px rgba(0,0,0,.45), 0 12px 34px -12px rgba(0,0,0,.65)',
  shadowLg: '0 1px 2px rgba(0,0,0,.5), 0 24px 60px -16px rgba(0,0,0,.72)',
  shadowHover: '0 1px 2px rgba(0,0,0,.5), 0 32px 72px -18px rgba(0,0,0,.78)',
  ok: '#34C796',
  warn: '#F2B855',
  err: '#F26B65',
  bad: '#F26B65',
}

// Objet VIVANT : identité stable, valeurs mutables. atoms.tsx fait `const SET =
// SET_PALETTE` une seule fois et lit `SET.*` au render ; applySetTheme(dark)
// réécrit ces valeurs AVANT le rendu de la page → tout l'écran suit le thème
// sans threading de props. (Pattern fidèle à la maquette `applySetTheme`.)
export const SET_PALETTE: SettingsPalette = { ...SET_LIGHT }

export function applySetTheme(dark: boolean): void {
  Object.assign(SET_PALETTE, dark ? SET_DARK : SET_LIGHT)
}

export function profileCompletionScore(p: ProfileData): number {
  const fields: (keyof ProfileData)[] = [
    'firstName', 'lastName', 'title', 'agency',
    'email', 'phone', 'mobile', 'rcc', 'bio', 'signature',
  ]
  const filled = fields.filter(f => {
    const v = p[f]
    return typeof v === 'string' && v.trim().length > 0
  }).length
  return Math.round((filled / fields.length) * 100)
}
