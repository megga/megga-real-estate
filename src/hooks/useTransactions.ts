import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { Transaction, TransactionStatus, MandateType } from '@/types/transaction'
import type { TransactionStage } from '@/lib/constants'
import type { TablesUpdate } from '@/types/database'

interface TransactionFilters {
  stage?: TransactionStage
  status?: TransactionStatus
  assigned_to?: string
}

export function useTransactions(filters?: TransactionFilters) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['transactions', filters],
    enabled: !!user,
    queryFn: async () => {
      let query = supabase
        .from('transactions')
        .select('*, property:properties(title, address, city, price, photos), buyer:contacts!contact_buyer_id(first_name, last_name), seller:contacts!contact_seller_id(first_name, last_name), agent:profiles!assigned_to(full_name, avatar_url)')

      if (filters?.stage) query = query.eq('stage', filters.stage)
      if (filters?.status) query = query.eq('status', filters.status)
      if (filters?.assigned_to) query = query.eq('assigned_to', filters.assigned_to)

      const { data, error } = await query.order('updated_at', { ascending: false })
      if (error) throw error
      return data as Transaction[]
    },
  })
}

export function useTransaction(id: string | undefined) {
  return useQuery({
    queryKey: ['transaction', id],
    queryFn: async () => {
      if (!id) throw new Error('No transaction ID')
      const { data, error } = await supabase
        .from('transactions')
        .select('*, property:properties(*), buyer:contacts!contact_buyer_id(*), seller:contacts!contact_seller_id(*), agent:profiles!assigned_to(full_name, avatar_url)')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as Transaction
    },
    enabled: !!id,
  })
}

interface CreateTransactionInput {
  agency_id: string
  property_id?: string
  contact_buyer_id?: string
  contact_seller_id?: string
  assigned_to?: string
  stage?: TransactionStage
  mandate_type?: MandateType
  notes?: string
}

export function useCreateTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateTransactionInput) => {
      const { data, error } = await supabase
        .from('transactions')
        .insert(input)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
    },
  })
}

export function useUpdateTransactionStage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, stage, notes, lostReason }: {
      id: string
      stage: TransactionStage
      notes?: string
      lostReason?: string
    }) => {
      // Fetch old stage for activity_event metadata
      const { data: old } = await supabase
        .from('transactions')
        .select('stage, agency_id, contact_buyer_id, contact_seller_id')
        .eq('id', id)
        .single()

      const updatePayload: Record<string, unknown> = { stage }
      if (notes !== undefined) updatePayload.notes = notes

      const { data, error } = await supabase
        .from('transactions')
        .update(updatePayload as TablesUpdate<'transactions'>)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error

      // Log activity_event for stage change
      const { data: { user } } = await supabase.auth.getUser()
      if (old) {
        await supabase.from('activity_events').insert({
          agency_id: old.agency_id,
          actor_id: user?.id ?? null,
          action: 'stage_change',
          entity_type: 'transaction',
          entity_id: id,
          metadata: {
            old_stage: old.stage,
            new_stage: stage,
            ...(lostReason ? { lost_reason: lostReason } : {}),
            contact_id: old.contact_buyer_id || old.contact_seller_id,
          },
        })
      }

      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['transaction', variables.id] })
    },
  })
}

// Update privée notes d'une transaction (notes internes équipe agence)
export function useUpdateTransactionNotes() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await supabase
        .from('transactions')
        .update({ notes: notes || null })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['transaction', variables.id] })
    },
  })
}

export interface ContactTransaction {
  id: string
  stage: string
  status: string
  price_offered: number | null
  price_final: number | null
  updated_at: string
  property: { title: string; address: string; city: string; price: number; photos: string[] } | null
}

export function useContactTransactions(contactId: string | undefined) {
  return useQuery({
    queryKey: ['transactions', 'contact', contactId],
    queryFn: async (): Promise<ContactTransaction[]> => {
      if (!contactId) return []
      const { data, error } = await supabase
        .from('transactions')
        .select('id, stage, status, price_offered, price_final, updated_at, property:properties(title, address, city, price, photos)')
        .or(`contact_buyer_id.eq.${contactId},contact_seller_id.eq.${contactId}`)
        .order('updated_at', { ascending: false })
      if (error) throw error
      return (data || []).map((row) => {
        const prop = Array.isArray(row.property) ? row.property[0] ?? null : row.property ?? null
        return {
          id: row.id as string,
          stage: row.stage as string,
          status: row.status as string,
          price_offered: row.price_offered as number | null,
          price_final: row.price_final as number | null,
          updated_at: row.updated_at as string,
          property: prop,
        }
      })
    },
    enabled: !!contactId,
    staleTime: 30_000,
  })
}
