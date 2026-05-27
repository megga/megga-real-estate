// MEGGA CRM Sugar v2 — Settings data + palette
// 1:1 port from `crm-screen-settings-sugar.jsx`.

export type SectionId =
  | 'profile' | 'agency' | 'team'
  | 'brand' | 'notifications' | 'integrations'
  | 'billing' | 'security' | 'privacy' | 'preferences'

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
//   - Billing       → reads still partial; chip pour Stripe Checkout
//
// Cachées (chip dédiée par section) :
//   - Team          → query agency_members + invites via Resend
//   - Brand         → upload logo storage + nouvelle table agency_branding
//   - Security      → MFA via supabase.auth.mfa.enroll/unenroll
export const SETTINGS_SECTIONS: SettingsSection[] = [
  { id: 'profile', label: 'Mon profil', short: 'Profil', icon: 'user', group: 'moi' },
  { id: 'agency', label: 'Mon agence', short: 'Agence', icon: 'building', group: 'moi' },
  { id: 'notifications', label: 'Notifications', short: 'Notifications', icon: 'bell', group: 'produit' },
  { id: 'preferences', label: 'Préférences', short: 'Préférences', icon: 'sliders', group: 'compte' },
  { id: 'integrations', label: 'Intégrations', short: 'Intégrations', icon: 'plug', group: 'produit' },
  { id: 'privacy', label: 'Confidentialité', short: 'Confidentialité', icon: 'shield', group: 'compte' },
  { id: 'billing', label: 'Facturation', short: 'Facturation', icon: 'card', group: 'compte' },
]

export const SETTINGS_GROUPS: { id: 'moi' | 'produit' | 'compte'; label: string }[] = [
  { id: 'moi', label: 'Compte' },
  { id: 'produit', label: 'Produit' },
  { id: 'compte', label: 'Facturation & sécurité' },
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
  initials: string
  avatarBg: string
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
  initials: 'GL',
  avatarBg: '#0041D9',
}

export interface SettingsPalette {
  bg: string
  bgGradient: string
  card: string
  cardSubtle: string
  black: string
  blackHover: string
  ink: string
  inkSoft: string
  muted: string
  ghost: string
  line: string
  shadowSm: string
  shadow: string
  shadowLg: string
  ok: string
  warn: string
  err: string
  bad: string
}

export const SET_PALETTE: SettingsPalette = {
  bg: '#EDEFF3',
  bgGradient:
    'radial-gradient(ellipse 120% 80% at 50% 100%, #C8D5E0 0%, #E2E5EB 50%, #EDEFF3 100%)',
  card: '#FFFFFF',
  cardSubtle: '#F7F8FA',
  black: '#0B0C0E',
  blackHover: '#1F2024',
  ink: '#0B0C0E',
  inkSoft: '#3A3D44',
  muted: '#7A8088',
  ghost: '#B5BAC2',
  line: 'rgba(15,23,42,0.06)',
  shadowSm: '0 4px 16px rgba(15, 23, 42, 0.04)',
  shadow: '0 12px 40px rgba(15, 23, 42, 0.06), 0 2px 8px rgba(15, 23, 42, 0.03)',
  shadowLg: '0 24px 60px rgba(15, 23, 42, 0.08), 0 4px 16px rgba(15, 23, 42, 0.04)',
  ok: '#10B981',
  warn: '#F59E0B',
  err: '#EF4444',
  bad: '#EF4444',
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
