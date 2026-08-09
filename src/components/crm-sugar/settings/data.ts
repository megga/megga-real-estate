// MEGGA CRM Sugar v2 — Settings data + palette
// 1:1 port from `crm-screen-settings-sugar.jsx`.
// i18n : labels de nav (sections/groupes) via getters singleton — cf §6 conventions.
import i18n from '@/i18n'
import { sgMix } from '@/components/crm-sugar/tokens'
import { mxCrmPalette, MXC_CARD_SHADOW, MXC_COLOR } from '@/components/megga-x-crm/tokens'

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
  /**
   * Surface INVERSÉE du héros de Sécurité — volontairement sombre dans les deux
   * thèmes. Jeton plutôt que littéral : c'est une surface, elle doit sortir de
   * la palette comme les autres.
   */
  heroBg: string
  /** Accent de la direction — le bleu `#424bfb`. */
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

/**
 * Palette des Réglages, dérivée de `mxCrmPalette()`.
 *
 * Elle est construite ICI, au point unique, et non aux ~280 lectures de `SET.*`
 * réparties dans Intégrations, Sécurité, les atomes et les modales — c'est ce
 * qui a permis de rebrancher tout l'écran sans toucher un composant.
 *
 * Trois correspondances méritent d'être justifiées, les autres sont des
 * synonymes directs :
 *
 * 1. **`black` → `sp.accent`.** Le nom vient de Sugar Pure, où l'accent EST le
 *    noir de Sugar Pure ; il vaut désormais le bleu `#424bfb`. C'était sûr
 *    parce que les
 *    15 lectures de `SET.black` sont toutes des emplois d'ACCENT (remplissage
 *    de bouton, pilule active, interrupteur, anneau de focus) — aucune ne s'en
 *    sert comme d'une surface sombre. La seule surface volontairement noire de
 *    l'écran, le héros de Sécurité, ne passe pas par ce jeton.
 *
 * 2. **Les ombres portent la BORDURE.** La vitrine sépare ses cartes par un
 *    filet `#cccccc` en clair et par la bordure seule en sombre, là où Sugar
 *    Pure sépare par une ombre douce sans bordure. Les cartes montent toutes
 *    `background: SET.card` + `boxShadow: SET.shadow` avec `border: 0` : passer
 *    le filet en anneau `inset` le fait donc voyager sans toucher un seul
 *    appelant. L'anneau est déjà l'idiome du dépôt (rail des Réglages, focus
 *    des champs) et rend la même chose qu'une bordure sur une surface pleine.
 *
 * 3. **`ok` / `warn` / `err` / `bad` ne bougent pas.** Ce sont des couleurs
 *    SÉMANTIQUES (47 lectures), pas des couleurs de direction : la vitrine n'en
 *    propose aucune, et les repeindre en bleu supprimerait le signal.
 *
 * `bgGradient` est déclaré par le type mais lu nulle part ; il reçoit le canvas
 * plat, MEGGA X n'ayant pas de dégradé.
 */
function settingsPalette(dark: boolean): SettingsPalette {
  const sp = mxCrmPalette(dark)
  // Survol de l'accent : la vitrine n'en publie pas (ses `--primary-colors--*`
  // sont trois teintes de marque distinctes, pas une rampe). On dérive donc,
  // avec le mélangeur du dépôt — assombri en clair, éclairci en sombre.
  const accentHover = dark ? sgMix(sp.accent, '#FFFFFF', 0.16) : sgMix(sp.accent, '#000000', 0.14)
  const ring = `inset 0 0 0 1px ${sp.cardBorder}`
  const card = dark ? ring : `${ring}, ${MXC_CARD_SHADOW}`

  return {
    bg: sp.pageBg,
    bgGradient: sp.pageBg,
    card: sp.cardBg,
    cardSubtle: sp.cardSubBg,
    // Un champ au focus se DÉTACHE de sa carte : blanc en clair (la carte l'est
    // déjà, c'est le filet qui le signale), palier au-dessus en sombre.
    inputFocusBg: dark ? sp.focusSurface : sp.cardBg,
    // Même intention que Sugar : noir de la direction en clair, surface de card
    // en sombre — sur un canvas déjà à `#030303`, un héros plus noir n'existe pas.
    heroBg: dark ? sp.cardBg : MXC_COLOR.n100,
    black: sp.accent,
    blackHover: accentHover,
    blackInk: sp.accentInk,
    ink: sp.ink,
    inkSoft: sp.soft,
    muted: sp.sub,
    // Remplissage d'un contrôle désactivé — le neutre de bordure fait l'affaire.
    ghost: sp.cardBorder,
    line: sp.cardBorder,
    shadowSm: card,
    shadow: card,
    shadowLg: card,
    shadowHover: card,
    ok: dark ? '#34C796' : '#10B981',
    warn: dark ? '#F2B855' : '#F59E0B',
    err: dark ? '#F26B65' : '#EF4444',
    bad: dark ? '#F26B65' : '#EF4444',
  }
}

// Objet VIVANT : identité stable, valeurs mutables. atoms.tsx fait `const SET =
// SET_PALETTE` une seule fois et lit `SET.*` au render ; applySetTheme(dark)
// réécrit ces valeurs AVANT le rendu de la page → tout l'écran suit le thème
// sans threading de props. (Pattern fidèle à la maquette `applySetTheme`.)
export const SET_PALETTE: SettingsPalette = settingsPalette(false)

/** Recharge `SET_PALETTE` pour le thème actif, avant chaque rendu de la page. */
export function applySetTheme(dark: boolean): void {
  setThemeDark = dark
  Object.assign(SET_PALETTE, settingsPalette(dark))
}

let setThemeDark = false

/**
 * Le thème du dernier `applySetTheme`.
 *
 * ⚠ Ne PAS revenir à un test d'identité du genre `SET.card === SET_DARK.card` :
 * il ne marchait que tant que les palettes possibles étaient exactement deux.
 * MEGGA X en construit une troisième, dont aucune valeur ne coïncide avec
 * `SET_DARK` — le test rendait donc `false` en sombre, et le héros de Sécurité
 * repassait au noir clair sur un canvas déjà noir.
 */
export function isSetDark(): boolean {
  return setThemeDark
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
