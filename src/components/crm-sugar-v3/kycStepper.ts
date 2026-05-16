// MEGGA CRM Sugar v3 — Projection 5 checks LBA → 6 étapes UI
// Arbitrage #1 du README handoff : DB reste à 5 checks (id/address/pep/sanctions/funds),
// UI projette à 6 étapes pour la card CtKyc + diverses surfaces.
//
// Mapping canonique :
//   0 — Identité            ← checks.id
//   1 — Béné. effectif      ← sous-section de id (LBA art. 4, dérivé)
//   2 — Fonds               ← checks.funds
//   3 — Screening           ← checks.pep + checks.sanctions (combinés)
//   4 — Risque              ← dossier.riskLevel calculé
//   5 — Validation          ← dossier_status === 'verified'

import type { KycDossierStatus, KycDossierSummary } from '@/types/kyc'

/** 6 étapes UI (handoff KYC_ENRICHISSEMENTS §1). */
export const KYC_UI_STEPS = [
  { id: 'identity', label: 'Identité' },
  { id: 'beneficiary', label: 'Béné.' },
  { id: 'funds', label: 'Fonds' },
  { id: 'screening', label: 'Screening' },
  { id: 'risk', label: 'Risque' },
  { id: 'validation', label: 'Validation' },
] as const

/**
 * Inférence par défaut depuis dossier_status quand pas de données détaillées.
 * Référence : KYC_ENRICHISSEMENTS §1 `stepByStatus`.
 */
export const STEP_BY_STATUS: Record<KycDossierStatus, number> = {
  none: 0,
  pending: 3,
  stale: 5,
  verified: 6,
  failed: 3, // failed = bloqué au screening → step screening actif
}

export interface CheckMap {
  id?: boolean
  address?: boolean
  pep?: boolean
  sanctions?: boolean
  funds?: boolean
}

/**
 * Calcule l'étape active du stepper UI à partir des 5 checks réels.
 * Une étape est "done" si la projection des checks DB qui la composent est complète.
 *
 * @param checks — map des 5 checks LBA (true = is_completed)
 * @param dossierStatus — statut du dossier (impacte étape Validation finale)
 * @returns indice 0..6 (0 = rien démarré, 6 = tout fait)
 */
export function computeActiveStep(
  checks: CheckMap,
  dossierStatus: KycDossierStatus,
): number {
  // 6 = entièrement validé
  if (dossierStatus === 'verified') return 6

  // 0 — Identité
  if (!checks.id) return 0
  // 1 — Béné. effectif (dérivé de id avec address comme proxy : si adresse fournie,
  //     on considère le bénéficiaire effectif déclaré)
  if (!checks.address) return 1
  // 2 — Fonds
  if (!checks.funds) return 2
  // 3 — Screening (pep + sanctions combinés)
  if (!checks.pep || !checks.sanctions) return 3
  // 4 — Risque (tout est validé mais pas encore "verified" → en attente de validation finale)
  if (dossierStatus === 'pending') return 4
  // 5 — Validation
  return 5
}

/**
 * Calcule le % de complétion (verified+na sur total).
 * Reproduit `window.kycCompletionPct` du JSX handoff.
 */
export function kycCompletionPct(checks: CheckMap): number {
  const values = [
    checks.id,
    checks.address,
    checks.pep,
    checks.sanctions,
    checks.funds,
  ]
  const done = values.filter(Boolean).length
  return Math.round((done / values.length) * 100)
}

/**
 * Calcule la complétion depuis un KycDossierSummary (sortie de la RPC).
 * Utilise checks_total/checks_completed retournés par le SQL.
 */
export function kycCompletionPctFromSummary(d: KycDossierSummary | null): number {
  if (!d || d.checks_total === 0) return 0
  return Math.round((d.checks_completed / d.checks_total) * 100)
}

/**
 * Indique si un dossier est "bloquant" pour le pipeline.
 * Spec §5.5 CRM_ARCHITECTURE : `interest-confirmed`/`offer`/`signed` exigent verified.
 */
export function isKycBlocking(status: KycDossierStatus | null | undefined): boolean {
  if (!status) return true
  return status !== 'verified'
}

/**
 * Renvoie le couple { tone, label } pour la couleur du score risque.
 * Référence : CtKyc lignes 627-628 du JSX handoff.
 */
export function getRiskScoreColor(score: number | null | undefined): string {
  if (score == null) return '#7A8088'
  if (score < 25) return '#0E9F6E'
  if (score < 60) return '#F59E0B'
  return '#E53935'
}

export function getRiskScoreLabel(score: number | null | undefined): string {
  if (score == null) return '—'
  if (score < 25) return 'Faible'
  if (score < 60) return 'Modéré'
  return 'Élevé'
}
