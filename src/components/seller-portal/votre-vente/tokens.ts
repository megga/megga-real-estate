// MEGGA — Espace vendeur « Votre vente » — tokens Sugar Pure
// Porté de la maquette handoff (seller-sugar-tokens.jsx). Deux palettes (claire/sombre),
// strictement alignées sur SugarV3 / DB_SP du CRM. Accent unique = noir pur #0B0C0E
// (inversé en presque-blanc #ECEDF3 en dark). Aucune bordure 1px décorative : la
// séparation se fait à l'ombre douce.

// i18n : le parcours vendeur (étapes, phrases, prochaine étape) est traduit au
// render (clés common:portal.*). SELLER_STEPS devient la fonction sellerSteps() ;
// SELLER_STEP_SENTENCES / SELLER_NEXT gardent leur forme mais via getters.
import i18n from '@/i18n'

export interface SellerSP {
  bg: string
  bgGradient: string
  card: string
  cardSubtle: string
  accent: string
  accentHover: string
  onAccent: string
  black: string
  blackHover: string
  ink: string
  inkSoft: string
  muted: string
  ghost: string
  line: string
  lineStrong: string
  hairline: string
  disabledBg: string
  closeHover: string
  shadowSm: string
  shadow: string
  shadowLg: string
  shadowHover: string
  ok: string
  warn: string
  err: string
  forestGreen: string
  burntOrange: string
  bordeaux: string
}

export const SELLER_SP_LIGHT: SellerSP = {
  bg: '#EDEFF3',
  bgGradient: 'radial-gradient(ellipse 120% 80% at 50% 100%, #C8D5E0 0%, #E2E5EB 50%, #EDEFF3 100%)',

  card: '#FFFFFF',
  cardSubtle: '#F7F8FA',

  accent: '#0B0C0E',
  accentHover: '#1F2024',
  onAccent: '#FFFFFF',
  black: '#0B0C0E',
  blackHover: '#1F2024',

  ink: '#0B0C0E',
  inkSoft: '#3A3D44',
  muted: '#7A8088',
  ghost: '#B5BAC2',

  line: 'rgba(11,12,14,0.10)',
  lineStrong: 'rgba(11,12,14,0.16)',
  hairline: 'rgba(11,12,14,0.07)',
  disabledBg: '#C9CDD3',
  closeHover: '#ECEEF1',

  shadowSm: '0 4px 16px rgba(15, 23, 42, 0.04)',
  shadow: '0 12px 40px rgba(15, 23, 42, 0.06), 0 2px 8px rgba(15, 23, 42, 0.03)',
  shadowLg: '0 24px 60px rgba(15, 23, 42, 0.08), 0 4px 16px rgba(15, 23, 42, 0.04)',
  shadowHover: '0 32px 70px rgba(15, 23, 42, 0.10), 0 6px 20px rgba(15, 23, 42, 0.05)',

  ok: '#10B981',
  warn: '#F59E0B',
  err: '#EF4444',
  forestGreen: '#15643F',
  burntOrange: '#A0521E',
  bordeaux: '#8E1F3D',
}

export const SELLER_SP_DARK: SellerSP = {
  // Aligné sur le dark mode du CRM : quasi-noir, voile bleuté discret.
  bg: '#0A0A0F',
  bgGradient: 'radial-gradient(ellipse 120% 80% at 50% 100%, #15151F 0%, #0E0E16 55%, #0A0A0F 100%)',

  card: '#101019',
  cardSubtle: '#171724',

  // Accent inversé : presque-blanc, texte foncé dessus.
  accent: '#ECEDF3',
  accentHover: '#FFFFFF',
  onAccent: '#0A0A0F',
  black: '#ECEDF3',
  blackHover: '#FFFFFF',

  ink: '#ECEDF3',
  inkSoft: '#B5B7C4',
  muted: '#797D90',
  ghost: '#454960',

  line: 'rgba(255,255,255,0.10)',
  lineStrong: 'rgba(255,255,255,0.20)',
  hairline: 'rgba(255,255,255,0.07)',
  disabledBg: '#2E2E42',
  closeHover: '#1F1F2E',

  shadowSm: '0 4px 16px rgba(0,0,0,0.35)',
  shadow: '0 12px 40px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.30)',
  shadowLg: '0 24px 60px rgba(0,0,0,0.55), 0 4px 16px rgba(0,0,0,0.35)',
  shadowHover: '0 32px 70px rgba(0,0,0,0.6), 0 6px 20px rgba(0,0,0,0.4)',

  ok: '#34D399',
  warn: '#FBBF24',
  err: '#F87171',
  forestGreen: '#1C7A4E',
  burntOrange: '#B86329',
  bordeaux: '#A8395A',
}

// ── Formatage CHF suisse → CHF 1'250'000 ─────────────────────────────────
export const sellerFmtCHF = (n: number): string =>
  'CHF ' + Math.round(n).toLocaleString('fr-CH').replace(/[\s.,]/g, "'")
// ── Parcours de vente — 6 étapes, vocabulaire VENDEUR ────────────────────
// (relabellé depuis le pipeline agent ; cf. viewModel.mandateStepToIndex)
export function sellerSteps(): string[] {
  return [
    i18n.t('common:portal.step.mandateSigned'),
    i18n.t('common:portal.step.online'),
    i18n.t('common:portal.step.visits'),
    i18n.t('common:portal.step.offers'),
    i18n.t('common:portal.step.negotiation'),
    i18n.t('common:portal.step.signed'),
  ]
}

// Un concept = une couleur (data-viz uniquement, alignée DB_SP du CRM).
export const SELLER_STEP_COLORS = ['#1E5BC6', '#0891B2', '#0E9F6E', '#C45A00', '#A0521E', '#059669']

export const SELLER_STEP_SENTENCES: Record<number, string> = {
  get 0() { return i18n.t('common:portal.stepSentence.0') },
  get 1() { return i18n.t('common:portal.stepSentence.1') },
  get 2() { return i18n.t('common:portal.stepSentence.2') },
  get 3() { return i18n.t('common:portal.stepSentence.3') },
  get 4() { return i18n.t('common:portal.stepSentence.4') },
  get 5() { return i18n.t('common:portal.stepSentence.5') },
}

export interface SellerNextStep {
  eta: string
  hint: string
}

// Prochaine étape + délai estimé selon l'étape courante.
export const SELLER_NEXT: Record<number, SellerNextStep | null> = {
  0: { get eta() { return i18n.t('common:portal.next.0.eta') }, get hint() { return i18n.t('common:portal.next.0.hint') } },
  1: { get eta() { return i18n.t('common:portal.next.1.eta') }, get hint() { return i18n.t('common:portal.next.1.hint') } },
  2: { get eta() { return i18n.t('common:portal.next.2.eta') }, get hint() { return i18n.t('common:portal.next.2.hint') } },
  3: { get eta() { return i18n.t('common:portal.next.3.eta') }, get hint() { return i18n.t('common:portal.next.3.hint') } },
  4: { get eta() { return i18n.t('common:portal.next.4.eta') }, get hint() { return i18n.t('common:portal.next.4.hint') } },
  5: null,
}

// ── Animations + responsive (injecté une fois via <style>) ───────────────
export const SELLER_CSS = `
  @keyframes sgFadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes sgScaleIn { from { opacity: 0; transform: scale(.97); } to { opacity: 1; transform: scale(1); } }
  .sg-enter { animation: sgFadeUp .55s cubic-bezier(.2,.8,.2,1) both; }
  .sg-tnum { font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1; }

  /* ─── Responsive : tablette ─────────────────────────────────────── */
  @media (max-width: 960px) {
    .sv-twocol { grid-template-columns: minmax(0, 1fr) !important; gap: 22px !important; }
    .sv-aside { position: static !important; top: auto !important; }
    .sv-page { padding: 32px 28px 44px !important; }
  }

  /* ─── Responsive : mobile ───────────────────────────────────────── */
  @media (max-width: 680px) {
    .sv-page { padding: 22px 16px 40px !important; }
    .sv-propcard { grid-template-columns: minmax(0, 1fr) !important; gap: 16px !important; }
    .sv-propinfo { padding: 4px 6px 10px !important; }
    .sv-journey { padding: 24px 20px 26px !important; }
    .sv-journeyrow { gap: 24px !important; }
    .sv-arc { width: 100% !important; max-width: 340px !important; margin: 0 auto !important; }
    .sv-arc svg { width: 100% !important; height: auto !important; }
    .sv-stats { flex-wrap: wrap !important; gap: 20px !important; padding: 26px 20px 22px !important; }
  }
`
