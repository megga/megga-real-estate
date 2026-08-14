// MEGGA CRM Sugar v3 — Design tokens (Sugar Pure direction)
// Port pixel-près de docs/handoff/sprint-1-kyc (README + MEGGA-DESIGN-SYSTEM.md).
//
// — Fond gris très clair avec radial gradient vers bleu pâle en bas
// — Cards blanches pures, ombres signature, coins 22-28px, AUCUNE bordure décorative
// — Accent unique = NOIR PUR #0B0C0E (pas de bleu, pas de violet, pas de gradient)
// — Typo Inter Tight avec tabular-nums sur tous les nombres
// — CHF avec apostrophes : CHF 1'250'000

import type { KycCheckCategory, KycDossierStatus } from '@/types/kyc'
import { sgVoileEncre } from '@/components/crm-sugar/tokens'
import { MXC_COLOR } from '@/components/megga-x-crm/tokens'
// i18n : les libellés des maps (contrôles/statuts/risque KYC + catégories audit)
// sont traduits au render via getter singleton (clés kyc:* / common:audit.category.*).
// Les tonalités/icônes restent fixes.
import i18n from '@/i18n'

export const SugarV3 = {
  // Fond — radial doux du clair vers bleu-gris pâle
  bg: '#EDEFF3',
  bgGradient:
    'radial-gradient(ellipse 120% 80% at 50% 100%, #C8D5E0 0%, #E2E5EB 50%, #EDEFF3 100%)',

  // Surfaces
  card: '#FFFFFF',
  cardSubtle: '#F7F8FA',

  // ⛔ ACCENT — la règle du 10 août 2026 : l'élément ACTIF porte `#424bfb`.
  // `black` appliquait l'ancienne règle de Sugar Pure (« l'accent EST l'encre »),
  // qui peint l'actif en non-couleur.
  //
  // ⚠ PAS de variante de survol, et c'est une MESURE, pas un oubli : la feuille
  // de la vitrine ne donne à `.primary-button:hover` qu'un `scale3d(1.04)` —
  // aucun changement de couleur. Le survol de l'accent est GÉOMÉTRIQUE. En
  // inventer une teinte aurait été ajouter un barreau que la direction n'a pas.
  accent: MXC_COLOR.accent,
  /**
   * ⚠ EN SURSIS, et le compte est là pour qu'on le voie descendre. Au 15 août
   * 2026 il reste 13 lecteurs, tous dans des surfaces de la vague A dont le lot
   * n'est pas encore passé : KYC (`MlkAgentModal`), Visites (`VdShared`,
   * `VisitModalSugarV3Page`), Audit (`AudEventRow`, `AuditSugarPage`) et Import
   * lead. Chaque lot remplace les SIENS — par `accent` quand le site est une
   * affordance, par `ink` quand il ne fait qu'écrire.
   *
   * ⛔ C'est aussi pourquoi ce fichier n'est PAS encore dans le cliquet : une
   * zone absente n'est pas déclarée propre, elle est déclarée non traitée.
   */
  black: '#0B0C0E',
  blackHover: '#1F2024',

  // Texte
  ink: MXC_COLOR.n100,
  inkSoft: '#3A3D44',
  muted: '#7A8088',
  ghost: '#B5BAC2',

  // Ombres signature Sugar
  shadowSm: `0 4px 16px ${sgVoileEncre(false, 0.04)}`,
  shadow: `0 12px 40px ${sgVoileEncre(false, 0.06)}, 0 2px 8px ${sgVoileEncre(false, 0.03)}`,
  shadowLg: `0 24px 60px ${sgVoileEncre(false, 0.08)}, 0 4px 16px ${sgVoileEncre(false, 0.04)}`,
  shadowHover: `0 32px 70px ${sgVoileEncre(false, 0.10)}, 0 6px 20px ${sgVoileEncre(false, 0.05)}`,

  // États (utilitaires uniquement, jamais décoratifs — micro-pastilles ≤7×7px)
  ok: '#10B981',
  warn: '#F59E0B',
  err: '#EF4444',
  okDark: '#0E9F6E', // utilisé pour le score risque faible dans CtKyc
  errDark: '#E53935',
  errDarker: '#B91C1C',

  // Backgrounds soft pour pastilles statut (jamais pour cards)
  okSoft: '#E5F4EC',
  warnSoft: '#FFF4E0',
  errSoft: 'rgba(239,68,68,0.10)',

  // Police
  font: '"Inter Tight", system-ui, sans-serif',
} as const
// ─── Animations keyframe (à injecter dans le DOM via <style>) ──────────
// Animation d'entrée signature Sugar : .5s cubic-bezier(.2,.8,.2,1) both
export const SUGAR_V3_KEYFRAMES = `
@keyframes sgFadeUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
`

// ─── Formatters ─────────────────────────────────────────────────────────

/** Formate une date en `12 avr. 2026`. */
export function fmtDateShort(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-CH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/** Formate une date + heure : `12 avr · 14:30`. */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('fr-CH', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ─── Labels canoniques (handoff §Modèle de données) ─────────────────────

/** Les 5 contrôles LBA art. 3-7. */
export const KYC_CHECK_LABELS: Record<
  KycCheckCategory,
  { title: string; sub: string }
> = {
  id: {
    get title() { return i18n.t('kyc:check.id.title') },
    get sub() { return i18n.t('kyc:check.id.sub') },
  },
  address: {
    get title() { return i18n.t('kyc:check.address.title') },
    get sub() { return i18n.t('kyc:check.address.sub') },
  },
  pep: {
    get title() { return i18n.t('kyc:check.pep.title') },
    get sub() { return i18n.t('kyc:check.pep.sub') },
  },
  sanctions: {
    get title() { return i18n.t('kyc:check.sanctions.title') },
    get sub() { return i18n.t('kyc:check.sanctions.sub') },
  },
  funds: {
    get title() { return i18n.t('kyc:check.funds.title') },
    get sub() { return i18n.t('kyc:check.funds.sub') },
  },
}

/** Labels + pastilles colorées pour les 5 statuts dossier (handoff). */
export const KYC_STATUS_LABELS: Record<
  KycDossierStatus,
  { label: string; tone: string }
> = {
  none: { get label() { return i18n.t('kyc:dossierStatus.none') }, tone: SugarV3.muted },
  pending: { get label() { return i18n.t('kyc:dossierStatus.pending') }, tone: SugarV3.warn },
  verified: { get label() { return i18n.t('kyc:dossierStatus.verified') }, tone: SugarV3.ok },
  failed: { get label() { return i18n.t('kyc:dossierStatus.failed') }, tone: SugarV3.err },
  stale: { get label() { return i18n.t('kyc:dossierStatus.stale') }, tone: SugarV3.warn },
}

/** Labels risque 3 niveaux (handoff). */
export const KYC_RISK_LABELS: Record<
  'low' | 'medium' | 'high' | 'unassessed',
  { label: string; tone: string }
> = {
  low: { get label() { return i18n.t('kyc:riskBadge.low') }, tone: SugarV3.ok },
  medium: { get label() { return i18n.t('kyc:riskBadge.medium') }, tone: SugarV3.warn },
  high: { get label() { return i18n.t('kyc:riskBadge.high') }, tone: SugarV3.err },
  unassessed: { get label() { return i18n.t('kyc:riskBadge.unassessed') }, tone: SugarV3.muted },
}

/** Catégories audit nLPD — 8 valeurs (KYC_ENRICHISSEMENTS §7). */
export const AUDIT_CATEGORIES: Record<
  string,
  { label: string; tone: string }
> = {
  kyc: { get label() { return i18n.t('common:audit.category.kyc') }, tone: '#1E5BC6' },
  deal: { get label() { return i18n.t('common:audit.category.deal') }, tone: '#0891B2' },
  contact: { get label() { return i18n.t('common:audit.category.contact') }, tone: SugarV3.muted },
  bien: { get label() { return i18n.t('common:audit.category.bien') }, tone: '#C45A00' },
  doc: { get label() { return i18n.t('common:audit.category.doc') }, tone: SugarV3.okDark },
  auth: { get label() { return i18n.t('common:audit.category.auth') }, tone: SugarV3.black },
  settings: { get label() { return i18n.t('common:audit.category.settings') }, tone: SugarV3.muted },
  ai: { get label() { return i18n.t('common:audit.category.ai') }, tone: '#7A4FD8' },
}

/** Icônes audit par catégorie. */
export const AUDIT_CAT_ICONS: Record<string, string> = {
  kyc: 'shield',
  deal: 'pipeline',
  contact: 'contact',
  bien: 'home',
  doc: 'file',
  auth: 'lock',
  settings: 'cog',
  ai: 'sparkle',
}
