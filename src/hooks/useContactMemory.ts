import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// ── Types ──

export interface ContactMemoryData {
  contact: ContactRecord | null
  interactions: InteractionRecord[]
  matchesSent: MatchRecord[]
  visits: VisitRecord[]
  transactions: TransactionRecord[]
}

interface ContactRecord {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  type: string
  source: string | null
  score: string | null
  tags: string[]
  notes: string | null
  language: string | null
  nationality: string | null
  budget_announced: number | null
  budget_estimated_ai: number | null
  search_zones: string[]
  search_criteria: Record<string, unknown> | null
  ai_seriousness_score: number | null
  ai_purchase_probability: number | null
  ai_timing: string | null
  ai_engagement_level: string | null
  ai_tension_level: string | null
  ai_price_reduction_probability: number | null
  last_interaction_at: string | null
  created_at: string
}

interface InteractionRecord {
  id: string
  action: string
  metadata: Record<string, unknown> | null
  created_at: string
}

interface MatchRecord {
  id: string
  score: number
  status: string
  sent_at: string | null
  created_at: string
  property: { title: string; address: string; city: string; price: number } | null
}

interface VisitRecord {
  id: string
  scheduled_at: string
  completed_at: string | null
  status: string
  feedback_buyer: string | null
  feedback_agent: string | null
  rating: number | null
  property: { title: string; address: string; city: string } | null
}

interface TransactionRecord {
  id: string
  stage: string
  status: string
  price_offered: number | null
  price_final: number | null
  notes: string | null
  created_at: string
  property: { title: string; address: string; city: string; price: number } | null
}

// ── Hook ──

export function useContactMemory(contactId: string | undefined) {
  // Contact complet
  const { data: contact } = useQuery({
    queryKey: ['contact-memory-contact', contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', contactId!)
        .single()
      if (error) return null
      return data as ContactRecord
    },
    enabled: !!contactId,
    staleTime: 5 * 60 * 1000,
  })

  // Dernières interactions (activity_events)
  const { data: interactions = [] } = useQuery({
    queryKey: ['contact-memory-interactions', contactId],
    queryFn: async () => {
      const { data } = await supabase
        .from('activity_events')
        .select('id, action, metadata, created_at')
        .eq('entity_id', contactId!)
        .eq('entity_type', 'contact')
        .order('created_at', { ascending: false })
        .limit(20)
      return (data ?? []) as InteractionRecord[]
    },
    enabled: !!contactId,
    staleTime: 2 * 60 * 1000,
  })

  // Biens envoyés/proposés (matches)
  const { data: matchesSent = [] } = useQuery({
    queryKey: ['contact-memory-matches', contactId],
    queryFn: async () => {
      const { data } = await supabase
        .from('matches')
        .select('id, score, status, sent_at, created_at, property:properties(title, address, city, price)')
        .eq('contact_id', contactId!)
        .neq('status', 'ignored')
        .order('created_at', { ascending: false })
        .limit(10)
      return (data ?? []) as unknown as MatchRecord[]
    },
    enabled: !!contactId,
    staleTime: 5 * 60 * 1000,
  })

  // Visites
  const { data: visits = [] } = useQuery({
    queryKey: ['contact-memory-visits', contactId],
    queryFn: async () => {
      const { data } = await supabase
        .from('visits')
        .select('id, scheduled_at, completed_at, status, feedback_buyer, feedback_agent, rating, property:properties(title, address, city)')
        .eq('contact_id', contactId!)
        .order('scheduled_at', { ascending: false })
        .limit(10)
      return (data ?? []) as unknown as VisitRecord[]
    },
    enabled: !!contactId,
    staleTime: 5 * 60 * 1000,
  })

  // Transactions actives
  const { data: transactions = [] } = useQuery({
    queryKey: ['contact-memory-transactions', contactId],
    queryFn: async () => {
      const { data } = await supabase
        .from('transactions')
        .select('id, stage, status, price_offered, price_final, notes, created_at, property:properties(title, address, city, price)')
        .or(`contact_buyer_id.eq.${contactId},contact_seller_id.eq.${contactId}`)
        .in('status', ['active', 'on_hold'])
        .order('created_at', { ascending: false })
        .limit(5)
      return (data ?? []) as unknown as TransactionRecord[]
    },
    enabled: !!contactId,
    staleTime: 5 * 60 * 1000,
  })

  const isLoading = !contact && !!contactId

  return {
    contact,
    interactions,
    matchesSent,
    visits,
    transactions,
    isLoading,
    memory: {
      contact: contact ?? null,
      interactions,
      matchesSent,
      visits,
      transactions,
    } as ContactMemoryData,
  }
}

/**
 * Direct (non-hook) fetch of contact memory.
 * Used in callbacks where hooks can't be called.
 */
export async function fetchContactMemory(contactId: string): Promise<ContactMemoryData> {
  const [contactRes, interactionsRes, matchesRes, visitsRes, transactionsRes] = await Promise.all([
    supabase.from('contacts').select('*').eq('id', contactId).single(),
    supabase.from('activity_events').select('id, action, metadata, created_at').eq('entity_id', contactId).eq('entity_type', 'contact').order('created_at', { ascending: false }).limit(20),
    supabase.from('matches').select('id, score, status, sent_at, created_at, property:properties(title, address, city, price)').eq('contact_id', contactId).neq('status', 'ignored').order('created_at', { ascending: false }).limit(10),
    supabase.from('visits').select('id, scheduled_at, completed_at, status, feedback_buyer, feedback_agent, rating, property:properties(title, address, city)').eq('contact_id', contactId).order('scheduled_at', { ascending: false }).limit(10),
    supabase.from('transactions').select('id, stage, status, price_offered, price_final, notes, created_at, property:properties(title, address, city, price)').or(`contact_buyer_id.eq.${contactId},contact_seller_id.eq.${contactId}`).in('status', ['active', 'on_hold']).order('created_at', { ascending: false }).limit(5),
  ])

  return {
    contact: (contactRes.data as ContactRecord) ?? null,
    interactions: (interactionsRes.data ?? []) as InteractionRecord[],
    matchesSent: (matchesRes.data ?? []) as unknown as MatchRecord[],
    visits: (visitsRes.data ?? []) as unknown as VisitRecord[],
    transactions: (transactionsRes.data ?? []) as unknown as TransactionRecord[],
  }
}
