// MEGGA CRM Sugar v3 — Types partagés du wizard KYC

import type { KycVigilance } from '@/types/kyc'
import type { KycRiskLevel } from '@/lib/constants'

export type WizardSource = 'existing' | 'import' | 'magic'

/** Type d'entité LBA : personne physique vs personne morale. */
export type WizardEntityType = 'pp' | 'pm'

export interface WizardData {
  source: WizardSource | null
  contactId: string | null
  /** Personne physique ou personne morale — détermine le KycType (buyer_pp / buyer_pm / ...). */
  entityType: WizardEntityType
  vigilance: KycVigilance | null
  riskLevel: KycRiskLevel
  /** Reco IA calculée à partir du contact (handoff KwStepVigilance). */
  smartReco: KycVigilance
}

export const WIZARD_STEPS = [
  { id: 'start', label: 'Démarrer' },
  { id: 'contact', label: 'Contact' },
  { id: 'vigilance', label: 'Vigilance' },
] as const

export type WizardStepId = (typeof WIZARD_STEPS)[number]['id']
