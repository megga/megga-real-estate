// MEGGA CRM Sugar v3 — Types partagés du wizard KYC

import type { KycVigilance } from '@/types/kyc'
import type { KycRiskLevel } from '@/lib/constants'

export type WizardSource = 'existing' | 'import' | 'magic'

export interface WizardData {
  source: WizardSource | null
  contactId: string | null
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
