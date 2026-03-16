import type { ContactScore } from '@/lib/constants'

export type ContactType = 'buyer' | 'seller' | 'both' | 'lead'

export interface Contact {
  id: string
  agency_id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  type: ContactType
  source: string | null
  score: ContactScore | null
  tags: string[]
  notes: string | null
  created_at: string
}
