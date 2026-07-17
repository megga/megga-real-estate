/**
 * Type d'une transaction (`Transaction`) — un deal du pipeline reliant un bien,
 * un acheteur et un vendeur, positionné sur un `stage` (14 stades DB → 8 colonnes UI).
 */
import type { TransactionStage } from '@/lib/constants'

export type TransactionStatus = 'active' | 'on_hold' | 'cancelled' | 'completed'
export type MandateType = 'simple' | 'exclusive' | 'semi_exclusive'

export interface Transaction {
  id: string
  agency_id: string
  property_id: string
  contact_buyer_id: string | null
  contact_seller_id: string | null
  assigned_to: string
  stage: TransactionStage
  status: TransactionStatus
  price_offered: number | null
  price_final: number | null
  mandate_type: MandateType | null
  notes: string | null
  created_at: string
  updated_at: string
}
