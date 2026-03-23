import type { KycRiskLevel, PepStatus, SanctionsStatus } from '@/lib/constants'

export type KycType = 'buyer_pp' | 'buyer_pm' | 'seller_pp' | 'seller_pm'
export type KycStatus = 'pending' | 'in_progress' | 'review' | 'validated' | 'rejected'
export type DocumentCategory = 'identity' | 'domicile' | 'financial' | 'compliance' | 'other'

export interface KycCase {
  id: string
  agency_id: string
  transaction_id: string
  contact_id: string
  type: KycType
  risk_level: KycRiskLevel
  status: KycStatus
  completion_pct: number
  validated_by: string | null
  validated_at: string | null
  created_at: string
  // Screening fields
  pep_status: PepStatus
  pep_details: Record<string, unknown> | null
  sanctions_status: SanctionsStatus
  sanctions_details: Record<string, unknown> | null
  last_screening_at: string | null
  contact_nationality: string | null
  transaction_amount: number | null
  risk_score: number | null
  risk_factors: Record<string, unknown>[] | null
  notes: string | null
  // Joined relations (optional)
  contact?: {
    first_name: string
    last_name: string
    nationality?: string
  }
  transaction?: {
    id: string
    stage: string
    property_id?: string
  }
}

export interface KycCaseWithChecklist extends KycCase {
  checklist: KycChecklistItem[]
}

export interface KycChecklistItem {
  id: string
  kyc_case_id: string
  label: string
  category: string
  is_required: boolean
  is_completed: boolean
  document_id: string | null
  notes: string | null
  completed_at: string | null
  completed_by: string | null
}

export interface KycDocument {
  id: string
  agency_id: string
  kyc_case_id: string | null
  transaction_id: string | null
  contact_id: string | null
  property_id: string | null
  name: string
  type: string
  storage_path: string
  size_bytes: number | null
  uploaded_by: string | null
  status: 'pending' | 'validated' | 'rejected'
  created_at: string
  // Expiration fields
  issued_at: string | null
  expires_at: string | null
  document_category: DocumentCategory
}

export interface KycAuditEvent {
  id: string
  agency_id: string
  actor_id: string
  action: string
  entity_type: string
  entity_id: string
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface ScreeningResult {
  pep_status: PepStatus
  pep_hits: number
  sanctions_status: SanctionsStatus
  sanctions_hits: number
  total_hits: number
  risk_score: number
  risk_level: KycRiskLevel
}
