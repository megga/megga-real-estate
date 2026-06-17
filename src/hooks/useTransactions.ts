// Migrated to @supabase-cache-helpers/postgrest-react-query (partial).
//
// Migrated:
//   - useTransactions (list)
//   - useTransaction (single)
//   - useContactTransactions (list filtered by contact)
//   - useCreateTransaction
//   - useUpdateTransactionNotes (simple field update)
//
// Stayed on classic React Query (with reason):
//   - useUpdateTransactionStage: fetches the old transaction, applies the
//     stage update, then logs an activity_event. The activity log writes to
//     a different table than the update target, so Cache Helpers'
//     auto-invalidation alone wouldn't cover the dependent caches.
//
// Auto-invalidation now covers consumers reading transactions (Pipeline,
// DealDetail) without manual queryClient.invalidateQueries calls.

import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  useQuery,
  useInsertMutation,
  useUpdateMutation,
} from '@supabase-cache-helpers/postgrest-react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { trackIntercomEvent, INTERCOM_EVENTS } from '@/lib/intercom'
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

  let baseQuery = supabase
    .from('transactions')
    .select('*, property:properties(title, address, city, price, photos), buyer:contacts!contact_buyer_id(first_name, last_name), seller:contacts!contact_seller_id(first_name, last_name), agent:profiles!assigned_to(full_name, avatar_url)')

  if (filters?.stage) baseQuery = baseQuery.eq('stage', filters.stage)
  if (filters?.status) baseQuery = baseQuery.eq('status', filters.status)
  if (filters?.assigned_to) baseQuery = baseQuery.eq('assigned_to', filters.assigned_to)

  const result = useQuery(
    baseQuery.order('updated_at', { ascending: false }),
    { enabled: !!user }
  )
  return {
    ...result,
    data: result.data as unknown as Transaction[] | undefined,
  }
}

export function useTransaction(id: string | undefined) {
  const result = useQuery(
    supabase
      .from('transactions')
      .select('*, property:properties(*), buyer:contacts!contact_buyer_id(*), seller:contacts!contact_seller_id(*), agent:profiles!assigned_to(full_name, avatar_url)')
      .eq('id', id ?? '00000000-0000-0000-0000-000000000000')
      .single(),
    { enabled: !!id }
  )
  return {
    ...result,
    data: result.data as unknown as Transaction | undefined,
  }
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
  const insert = useInsertMutation(supabase.from('transactions'), ['id'])
  return {
    mutateAsync: async (input: CreateTransactionInput) => {
      const rows = await insert.mutateAsync([
        input as unknown as Parameters<typeof insert.mutateAsync>[0][number],
      ])
      // Signal produit → Intercom : moment de valeur "affaire créée" (Series, ciblage).
      trackIntercomEvent(INTERCOM_EVENTS.DEAL_CREATED)
      return Array.isArray(rows) ? rows[0] : rows
    },
    isPending: insert.isPending,
  }
}

// Kept on raw useMutation: updates the transaction stage; the stage_change /
// status_change audit events are now written by the DB trigger
// trg_transaction_lifecycle (single source of truth, path-independent). The
// hook only adds the contextual 'deal_lost' event (agent-entered reason). The
// side-effect write to a different table means Cache Helpers' auto-invalidation
// wouldn't cover the activity-log caches; explicit invalidate keeps the contract.
export function useUpdateTransactionStage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, stage, notes, lostReason }: {
      id: string
      stage: TransactionStage
      notes?: string
      lostReason?: string
    }) => {
      const updatePayload: Record<string, unknown> = { stage }
      if (notes !== undefined) updatePayload.notes = notes

      const { data, error } = await supabase
        .from('transactions')
        .update(updatePayload as TablesUpdate<'transactions'>)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error

      // stage_change/status_change captured by the DB trigger. Here we add ONLY
      // the context the database can't derive: the agent-entered loss reason.
      if (lostReason && data) {
        const row = data as { agency_id: string; contact_buyer_id: string | null; contact_seller_id: string | null }
        const { data: { user } } = await supabase.auth.getUser()
        await supabase.from('activity_events').insert({
          agency_id: row.agency_id,
          actor_id: user?.id ?? null,
          action: 'deal_lost',
          entity_type: 'transaction',
          entity_id: id,
          category: 'deal',
          metadata: {
            lost_reason: lostReason,
            contact_id: row.contact_buyer_id || row.contact_seller_id,
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
  const update = useUpdateMutation(supabase.from('transactions'), ['id'])
  return {
    mutateAsync: async ({ id, notes }: { id: string; notes: string }) => {
      await update.mutateAsync({
        id,
        notes: notes || null,
      } as unknown as Parameters<typeof update.mutateAsync>[0])
    },
    isPending: update.isPending,
  }
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
  const result = useQuery(
    supabase
      .from('transactions')
      .select('id, stage, status, price_offered, price_final, updated_at, property:properties(title, address, city, price, photos)')
      .or(`contact_buyer_id.eq.${contactId ?? '00000000-0000-0000-0000-000000000000'},contact_seller_id.eq.${contactId ?? '00000000-0000-0000-0000-000000000000'}`)
      .order('updated_at', { ascending: false }),
    { enabled: !!contactId, staleTime: 30_000 }
  )
  const data = ((result.data ?? []) as unknown as Array<{
    id: string
    stage: string
    status: string
    price_offered: number | null
    price_final: number | null
    updated_at: string
    property:
      | { title: string; address: string; city: string; price: number; photos: string[] }
      | { title: string; address: string; city: string; price: number; photos: string[] }[]
      | null
  }>).map((row) => {
    const prop = Array.isArray(row.property) ? row.property[0] ?? null : row.property ?? null
    return {
      id: row.id,
      stage: row.stage,
      status: row.status,
      price_offered: row.price_offered,
      price_final: row.price_final,
      updated_at: row.updated_at,
      property: prop,
    } satisfies ContactTransaction
  })
  return {
    ...result,
    data,
  }
}
