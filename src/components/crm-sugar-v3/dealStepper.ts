// MEGGA CRM Sugar v3 — Logique stepper Deal (Sprint 2)
// Mapping 14 TransactionStage DB → 8 cercles UI Sugar Pure (handoff §2 fiche Deal).
//
// La spec handoff utilise 8 étapes — on aggrège les sous-étapes de négociation
// (offer, negotiation, reserved, financing, notary) dans le cercle 'offer'
// pour rester lisible. La liste exhaustive reste visible dans le drawer Activité.

import type { TransactionStage } from '@/lib/constants'

/** Étape canonique stepper Sprint 2 (8 cercles). */
export type DealStepperStage =
  | 'new-lead'
  | 'to-qualify'
  | 'searching'
  | 'visit-scheduled'
  | 'visit-done'
  | 'interest-confirmed'
  | 'offer'
  | 'signed'

/** Ordre canonique 8 étapes (handoff §Stepper pipeline). */
export const DEAL_STEPPER_ORDER: readonly DealStepperStage[] = [
  'new-lead',
  'to-qualify',
  'searching',
  'visit-scheduled',
  'visit-done',
  'interest-confirmed',
  'offer',
  'signed',
] as const

/** Mapping DB TransactionStage → stepper UI (handoff §Stepper). */
export function mapTransactionStageToStepper(
  stage: TransactionStage | string | null | undefined,
): DealStepperStage {
  switch (stage) {
    case 'new_lead':
      return 'new-lead'
    case 'to_qualify':
      return 'to-qualify'
    case 'active_search':
    case 'to_recontact':
      return 'searching'
    case 'visit_planned':
      return 'visit-scheduled'
    case 'visit_done':
      return 'visit-done'
    case 'interest_confirmed':
      return 'interest-confirmed'
    case 'offer':
    case 'negotiation':
    case 'reserved':
    case 'financing':
    case 'notary':
      return 'offer'
    case 'signed':
      return 'signed'
    case 'lost':
    default:
      // 'lost' n'a pas de représentation stepper — on retombe sur new-lead
      // par défaut, l'UI affiche un état spécial "lost" en dehors du stepper.
      return 'new-lead'
  }
}

/** Index 0-7 de l'étape (utilisé par DdStageStepper pour rendre done/active/todo). */
export function dealStepperIndex(
  stage: TransactionStage | string | null | undefined,
): number {
  return DEAL_STEPPER_ORDER.indexOf(mapTransactionStageToStepper(stage))
}

/**
 * Le KYC est-il bloquant pour cette étape ?
 * Handoff §3 : "indicatif, pas bloquant — la négociation continue, seule la signature
 * est bloquée". On affiche la bannière noire dès que le deal entre en zone à risque.
 */
export function isStageKycBlocking(
  stage: TransactionStage | string | null | undefined,
): boolean {
  const ui = mapTransactionStageToStepper(stage)
  return ui === 'interest-confirmed' || ui === 'offer' || ui === 'signed'
}
