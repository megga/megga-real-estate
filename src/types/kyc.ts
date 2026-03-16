import type { KycRiskLevel } from '@/lib/constants'

export type KycType = 'buyer_pp' | 'buyer_pm' | 'seller_pp' | 'seller_pm'
export type KycStatus = 'pending' | 'in_progress' | 'review' | 'validated' | 'rejected'

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
