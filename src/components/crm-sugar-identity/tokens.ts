/**
 * Wizard « Identité légale » (KYB, route /dashboard/identite) — jetons de design.
 *
 * Reprend TEL QUEL le mécanisme de thème de crm-sugar-wizard/tokens.ts (Proxy
 * `SugarV2` qui résout le thème actif à chaque lecture, piloté par
 * `setSugarV2Dark`) : même palette Sugar v2, même contrat. Fichier séparé plutôt
 * qu'import croisé du module du wizard « Créer un bien » — c'est la convention du
 * dépôt (chaque sous-arbre crm-sugar-* porte son propre tokens.ts : crm-sugar,
 * crm-sugar-v3, crm-sugar-wizard, seller-portal/votre-vente…), qui évite de coupler
 * deux parcours indépendants à un seul singleton de thème.
 *
 * Étapes du wizard (SG_IDENTITY_STEPS) et keyframes partagées vivent aussi ici.
 * Fichier créé à la tâche 3 du plan étape 2 et volontairement stable ensuite : les
 * tâches 4 à 7 étendent IdentityShell.tsx et useAgencyIdentity.ts, jamais ce fichier.
 */
import i18nIdentity from '@/i18n' // labels d'étapes i18n (getters SG_IDENTITY_STEPS)

// ─── Palette Sugar v2 (identique à crm-sugar-wizard/tokens.ts) ─────────────
const SUGARV2_LIGHT = {
  bg: '#EDEFF3',
  bgGradient: 'radial-gradient(ellipse 120% 80% at 50% 100%, #C8D5E0 0%, #E2E5EB 50%, #EDEFF3 100%)',

  card: '#FFFFFF',
  cardSubtle: '#F7F8FA',
  rail: '#FFFFFF',
  railHover: '#F0F2F6',

  black: '#0B0C0E',
  blackHover: '#1F2024',
  onBlack: '#FFFFFF',

  ink: '#0B0C0E',
  inkSoft: '#3A3D44',
  muted: '#7A8088',
  ghost: '#B5BAC2',

  line: 'rgba(11,12,14,0.08)',

  shadowSm: '0 4px 16px rgba(15, 23, 42, 0.04)',
  shadow: '0 12px 40px rgba(15, 23, 42, 0.06), 0 2px 8px rgba(15, 23, 42, 0.03)',
  shadowLg: '0 24px 60px rgba(15, 23, 42, 0.08), 0 4px 16px rgba(15, 23, 42, 0.04)',
  shadowHover: '0 32px 70px rgba(15, 23, 42, 0.10), 0 6px 20px rgba(15, 23, 42, 0.05)',
  pillShadow: '0 6px 16px rgba(11,12,14,0.18)',
  pillShadowHover: '0 12px 30px rgba(11,12,14,0.25)',
  ringSoft: 'rgba(11,12,14,0.06)',
  footerFade: 'linear-gradient(180deg, transparent 0%, rgba(237,239,243,0.9) 60%, rgba(237,239,243,1) 100%)',

  ok: '#10B981',
  warn: '#F59E0B',
  err: '#EF4444',

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

  black: '#ECEDF3',
  blackHover: '#FFFFFF',
  onBlack: '#0A0A0F',

  ink: '#ECEDF3',
  inkSoft: '#B7B9C6',
  muted: '#7C8094',
  ghost: '#3A3B4A',

  line: 'rgba(255,255,255,0.09)',

  shadowSm: '0 1px 2px rgba(0,0,0,.45), 0 6px 18px -10px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.05)',
  shadow: '0 1px 2px rgba(0,0,0,.5), 0 16px 40px -16px rgba(0,0,0,.7), inset 0 1px 0 rgba(255,255,255,.06)',
  shadowLg: '0 30px 70px -18px rgba(0,0,0,.75), 0 8px 24px -12px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.07)',
  shadowHover: '0 36px 84px -18px rgba(0,0,0,.8), 0 10px 28px -12px rgba(0,0,0,.65), inset 0 1px 0 rgba(255,255,255,.08)',
  pillShadow: '0 8px 20px -6px rgba(0,0,0,0.6)',
  pillShadowHover: '0 14px 34px -8px rgba(0,0,0,0.72)',
  ringSoft: 'rgba(255,255,255,0.10)',
  footerFade: 'linear-gradient(180deg, transparent 0%, rgba(10,10,15,0.82) 55%, rgba(8,8,12,1) 100%)',

  ok: '#34C796',
  warn: '#F2B855',
  err: '#F26B65',

  onAcc04: 'rgba(11,12,14,0.05)', onAcc08: 'rgba(11,12,14,0.08)', onAcc10: 'rgba(11,12,14,0.10)',
  onAcc12: 'rgba(11,12,14,0.12)', onAcc15: 'rgba(11,12,14,0.16)', onAcc16: 'rgba(11,12,14,0.16)',
  onAcc18: 'rgba(11,12,14,0.18)', onAcc30: 'rgba(11,12,14,0.32)', onAcc40: 'rgba(11,12,14,0.42)',
  onAcc55: 'rgba(11,12,14,0.55)', onAcc65: 'rgba(11,12,14,0.62)', onAcc70: 'rgba(11,12,14,0.66)',
  onAcc75: 'rgba(11,12,14,0.72)', onAcc80: 'rgba(11,12,14,0.78)',

  isDark: true,
}

// Override explicite (null = suit le thème de l'app via `data-theme`). Portée à ce
// SEUL module (cf. en-tête) : IdentityShell l'appelle sur CE `setSugarV2Dark`, pas
// celui du wizard « Créer un bien ».
let __forceDark: boolean | null = null

/**
 * Pilote le thème du wizard identité : `true`/`false` force dark/light, `null` rend
 * la main au thème de l'app (`data-theme`, posé par ThemeProvider). Voir le
 * commentaire jumeau dans crm-sugar-wizard/tokens.ts pour le détail de la garde
 * anti-render-périmé (React 18 concurrent) — même raisonnement ici à l'identique.
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

/** Proxy à identité stable : `SugarV2.foo` résout le thème actif à CHAQUE lecture. */
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

// ─── Étapes du wizard ───────────────────────────────────────────────────
// Cinq étapes fixées par le plan (§ Parcours cible de la spec de conception) :
// signataire → agence → bénéficiaires effectifs → pièce d'identité → récapitulatif.
// Seule la première a un écran réel à la tâche 3 ; IdentityShell rend un palier
// « à venir » honnête pour les autres jusqu'à ce que les tâches 4 à 7 les livrent.
// label en getter (i18n singleton) : traduit + réactif au changement de langue,
// même motif que SG_STEPS dans crm-sugar-wizard/tokens.ts.
export const SG_IDENTITY_STEPS = [
  { id: 'signataire', get label() { return i18nIdentity.t('onboarding:wizard.steps.signataire') } },
  { id: 'agence', get label() { return i18nIdentity.t('onboarding:wizard.steps.agence') } },
  { id: 'beneficiaires', get label() { return i18nIdentity.t('onboarding:wizard.steps.beneficiaires') } },
  { id: 'pieceIdentite', get label() { return i18nIdentity.t('onboarding:wizard.steps.pieceIdentite') } },
  { id: 'recapitulatif', get label() { return i18nIdentity.t('onboarding:wizard.steps.recapitulatif') } },
] as const

// ─── Keyframes partagées ────────────────────────────────────────────────
// Sous-ensemble de SG_KEYFRAMES (crm-sugar-wizard/tokens.ts) : uniquement ce
// qu'un wizard de formulaire de conformité utilise réellement (entrée de page,
// indicateur de sauvegarde, spinner). Pas de pin de carte / confetti / thumb de
// slider — hors sujet ici, et un token mort n'a pas sa place (règle « 0 export
// mort » du projet).
export const SG_IDENTITY_KEYFRAMES = `
  @keyframes sgPage {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes sgSavePop { 0% { transform: scale(.4); opacity: 0 } 60% { transform: scale(1.15) } 100% { transform: scale(1); opacity: 1 } }
  @keyframes sgSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) {
    [style*="sgPage"] { animation: none !important; opacity: 1 !important; transform: none !important; }
  }
`
