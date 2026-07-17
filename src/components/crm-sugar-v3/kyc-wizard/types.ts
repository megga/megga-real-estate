// MEGGA CRM Sugar v3 — Types partagés du wizard KYC

import type { KycVigilance } from '@/types/kyc'
import type { KycRiskLevel } from '@/lib/constants'

export type WizardSource = 'existing' | 'import' | 'magic'

/** Type d'entité LBA : personne physique vs personne morale. */
export type WizardEntityType = 'pp' | 'pm'

/** Un contrôle extrait d'un rapport externe (voie import). */
export interface KycImportExtractedCheck {
  key: string
  result: string
}

/** Résultat de l'extraction d'un rapport KYC externe (EF kyc-report-import). */
export interface KycImportParsed {
  provider?: string | null
  reportDate?: string | null
  checks: KycImportExtractedCheck[]
  missing: string[]
}

export interface WizardData {
  source: WizardSource | null
  contactId: string | null
  /** Personne physique ou personne morale — détermine le KycType (buyer_pp / buyer_pm / ...). */
  entityType: WizardEntityType
  vigilance: KycVigilance | null
  riskLevel: KycRiskLevel
  /** Reco IA calculée à partir du contact (handoff KwStepVigilance). */
  smartReco: KycVigilance
  /** Voie import — fichier déposé + extraction (laissée à valider par l'agent). */
  importFile?: File | null
  importParsed?: KycImportParsed | null
}

// i18n : libellés d'étapes via clé (traduits chez le consommateur avec t()),
// même grammaire que KYC_UI_STEPS (kycStepper.ts). Cf docs/i18n-conventions §5.
export const WIZARD_STEPS = [
  { id: 'start', labelKey: 'kyc:wizard.steps.start' },
  { id: 'contact', labelKey: 'kyc:wizard.steps.contact' },
  { id: 'vigilance', labelKey: 'kyc:wizard.steps.vigilance' },
] as const
