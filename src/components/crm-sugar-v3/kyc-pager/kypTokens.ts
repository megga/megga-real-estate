// MEGGA CRM — KYC Pager · tokens & helpers
// ─────────────────────────────────────────────────────────────────────────
// Port fidèle des constantes du prototype `kyc-pager-proto.jsx` (handoff KYC).
// Les tons fonctionnels (statut / risque / retard) suivent EXACTEMENT la
// palette du design (README §6) : vert #059669 · orange #C45A00 · rouge
// #8E1F3D / #E0738C · muted #7A8088. Pilules pleines + texte blanc, jamais de
// fond teinté clair, jamais de dot. Le chrome (fond, cartes, encre, ombres,
// accent noir) dérive de `crmSugarPalette` (SugarPalette) comme le reste du CRM.

import { SugarV3 } from '../tokens'
import { KYC_STATUS_LABELS, KYC_RISK_LABELS } from '../tokens'
import { crmStep } from '@/components/crm-sugar/tokens'
import type { KycCheckCategory, KycDossierStatus } from '@/types/kyc'
import type { KycRiskLevel } from '@/lib/constants'

/** Police du pager / fiche / wizard (déjà en usage côté KYC). */
export const KYP_FONT = SugarV3.font

/** Tons de risque — fixes dans les 2 thèmes (repère immédiat). README §6. */
export const KYP_RISK: Record<KycRiskLevel, string> = {
  low: '#059669',
  medium: '#C45A00',
  high: '#8E1F3D',
  unassessed: '#7A8088',
}

/** Tons de statut dossier — pilules pleines opaques. */
export const KYP_STATUS_TONE: Record<KycDossierStatus, string> = {
  none: '#7A8088',
  pending: '#C45A00',
  verified: '#059669',
  failed: '#8E1F3D',
  stale: '#C45A00',
}

/** Métadonnées pilule statut (libellé i18n existant + ton design). */
export function kypStatusMeta(status: KycDossierStatus): { label: string; tone: string } {
  return {
    label: KYC_STATUS_LABELS[status]?.label ?? status,
    tone: KYP_STATUS_TONE[status] ?? '#7A8088',
  }
}

/** Métadonnées pilule risque (libellé i18n existant + ton design). */
export function kypRiskMeta(risk: KycRiskLevel): { label: string; tone: string } {
  return {
    label: KYC_RISK_LABELS[risk]?.label ?? risk,
    tone: KYP_RISK[risk] ?? '#7A8088',
  }
}

/** Surfaces locales KYC (handoff §6 `kypSurf`). */
export interface KypSurf {
  card: string
  cardSub: string
  hairline: string
  ghost: string
  late: string
  ringAvatar: string
  destructive: string
  dark: boolean
}

export function kypSurf(dark: boolean): KypSurf {
  return {
    card: dark ? crmStep('s2', '#1C1C1F') : '#FFFFFF',
    cardSub: dark ? crmStep('s3', 'rgba(255,255,255,0.05)') : '#F7F8FA',
    hairline: dark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)',
    ghost: dark ? 'rgba(255,255,255,0.28)' : '#B5BAC2',
    late: dark ? '#E08A2E' : '#C45A00',
    ringAvatar: dark ? crmStep('s2', '#1C1C1F') : '#FFFFFF',
    destructive: dark ? '#E0738C' : '#8E1F3D',
    dark,
  }
}

/** Ordre canonique des 5 contrôles LBA art. 3-7. */
export const KYP_CHECK_ORDER: KycCheckCategory[] = ['id', 'address', 'pep', 'sanctions', 'funds']

/** Contrôles validés à la main par téléversement d'une pièce. */
export const KYP_MANUAL_CHECKS: KycCheckCategory[] = ['id', 'address']

/** Keyframes propres au pager (entrée fiche, spin, pop, liseuse, dots). */
export const KYP_KEYFRAMES = `
@keyframes kypFiche { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: none; } }
@keyframes kypSpin { to { transform: rotate(360deg); } }
@keyframes kypPop { from { opacity: 0; transform: scale(.86); } to { opacity: 1; transform: none; } }
@keyframes kypDocFade { from { opacity: 0; } to { opacity: 1; } }
@keyframes kypDocUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
.kyp-scroll-hint { opacity: .55; transition: opacity .35s ease; outline: none !important; }
.kyp-scroll-hint:hover, .kyp-scroll-hint:focus-visible { opacity: 1; }
.kyp-scroll-hint:hover .kyp-hint-label, .kyp-scroll-hint:focus-visible .kyp-hint-label { max-width: 220px !important; opacity: 1 !important; transform: translateX(0) !important; }
`
