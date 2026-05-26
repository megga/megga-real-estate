// Migrated to @supabase-cache-helpers/postgrest-react-query (partial).
//
// Migrated:
//   - useTickets (list)
//   - useCannedResponses (list)
//   - useUpdateTicket
//   - useSubmitCsat (token-based — kept on raw mutation, see below)
//
// Stayed on classic React Query (with reason):
//   - useTicket / useTicketByToken: return composite { ticket, messages }
//     assembled from two queries. Cache Helpers' useQuery operates on a
//     single PostgrestBuilder; can't express a join across two SELECTs.
//     Would need to be split into two hooks, but consumers expect the
//     composite — out of scope for this migration.
//   - useCreateTicket: chains insert → insert (messages) → 2 edge functions
//     → admin lookup. Multi-step orchestration, not a pure cache mutation.
//   - useAddMessage: insert + conditional update of parent ticket. Mixed
//     table writes; raw mutation keeps the logic local.
//   - useSubmitCsat: updates by (ticket_number, access_token) — not by PK.

import { useMutation, useQuery as useRqQuery, useQueryClient } from '@tanstack/react-query'
import {
  useQuery,
  useUpdateMutation,
} from '@supabase-cache-helpers/postgrest-react-query'
import { supabase } from '@/lib/supabase'

export interface TicketRow {
  id: string
  ticket_number: string
  submitter_email: string
  submitter_name: string
  contact_id: string | null
  subject: string
  category: string
  priority: string
  status: string
  assigned_to: string | null
  sla_first_response_due: string | null
  sla_resolution_due: string | null
  first_responded_at: string | null
  resolved_at: string | null
  sla_breached: boolean
  access_token: string
  csat_rating: number | null
  csat_comment: string | null
  created_at: string
  updated_at: string
}

export interface TicketMessageRow {
  id: string
  ticket_id: string
  author_type: 'customer' | 'agent' | 'system'
  author_id: string | null
  author_name: string
  body: string
  is_internal_note: boolean
  created_at: string
}

// ── Agent-side: list tickets ─────────────────────────────────────

export function useTickets(filters?: { status?: string; priority?: string; category?: string }) {
  let baseQuery = supabase.from('support_tickets').select('*')
  if (filters?.status) baseQuery = baseQuery.eq('status', filters.status)
  if (filters?.priority) baseQuery = baseQuery.eq('priority', filters.priority)
  if (filters?.category) baseQuery = baseQuery.eq('category', filters.category)

  const result = useQuery(
    baseQuery.order('created_at', { ascending: false }),
    { staleTime: 30_000 }
  )
  return {
    ...result,
    data: (result.data ?? []) as unknown as TicketRow[],
  }
}

// ── Agent-side: single ticket with messages ──────────────────────
// Kept on raw useQuery — returns composite { ticket, messages } from two
// separate SELECTs. Cache Helpers' useQuery takes a single query expression.

export function useTicket(id: string | undefined) {
  return useRqQuery({
    queryKey: ['ticket', id],
    queryFn: async () => {
      if (!id) return null
      const [ticketRes, messagesRes] = await Promise.all([
        supabase.from('support_tickets').select('*').eq('id', id).single(),
        supabase.from('ticket_messages').select('*').eq('ticket_id', id).order('created_at', { ascending: true }),
      ])
      if (ticketRes.error) throw ticketRes.error
      return {
        ticket: ticketRes.data as TicketRow,
        messages: (messagesRes.data || []) as TicketMessageRow[],
      }
    },
    enabled: !!id,
    staleTime: 15_000,
  })
}

// ── Public: ticket by number + access token ──────────────────────
// Same composite shape as useTicket; kept on raw useQuery.

export function useTicketByToken(ticketNumber: string | undefined, token: string | null) {
  return useRqQuery({
    queryKey: ['ticket-public', ticketNumber, token],
    queryFn: async () => {
      if (!ticketNumber || !token) return null
      const { data: ticket, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('ticket_number', ticketNumber)
        .eq('access_token', token)
        .single()
      if (error || !ticket) return null

      const { data: messages } = await supabase
        .from('ticket_messages')
        .select('*')
        .eq('ticket_id', ticket.id)
        .eq('is_internal_note', false)
        .order('created_at', { ascending: true })

      return {
        ticket: ticket as TicketRow,
        messages: (messages || []) as TicketMessageRow[],
      }
    },
    enabled: !!ticketNumber && !!token,
    staleTime: 30_000,
  })
}

// ── Create ticket (public) ───────────────────────────────────────
// Multi-step orchestration (insert ticket → insert first message → 2 email
// edge functions). Kept on raw useMutation.

export function useCreateTicket() {
  return useMutation({
    mutationFn: async (input: {
      name: string
      email: string
      subject: string
      category: string
      message: string
    }) => {
      // 1. Create ticket — ticket_number is auto-generated by DB trigger
      const { data: ticket, error } = await supabase
        .from('support_tickets')
        .insert({
          submitter_name: input.name,
          submitter_email: input.email,
          subject: input.subject,
          category: input.category,
          priority: 'medium',
          status: 'new',
        } as unknown as import('@/types/database').TablesInsert<'support_tickets'>)
        .select('id, ticket_number, access_token')
        .single()

      if (error) throw error

      // 2. Create first message
      await supabase.from('ticket_messages').insert({
        ticket_id: ticket.id,
        author_type: 'customer',
        author_name: input.name,
        body: input.message,
      })

      // 3. Send confirmation email (fire & forget)
      const trackingUrl = `${window.location.origin}/support/${ticket.ticket_number}?token=${ticket.access_token}`
      try {
        await supabase.functions.invoke('send-email', {
          body: {
            to: input.email,
            template: 'ticket_confirmation',
            data: {
              name: input.name,
              ticket_number: ticket.ticket_number,
              subject: input.subject,
              tracking_url: trackingUrl,
            },
          },
        })
      } catch { /* email failure non-blocking */ }

      // 4. Notify admin (fire & forget)
      try {
        const { data: admin } = await supabase
          .from('profiles')
          .select('email')
          .in('role', ['admin', 'manager'])
          .limit(1)
          .single()

        if (admin?.email) {
          await supabase.functions.invoke('send-email', {
            body: {
              to: admin.email,
              template: 'ticket_notification_admin',
              data: {
                ticket_number: ticket.ticket_number,
                subject: input.subject,
                submitter_name: input.name,
                submitter_email: input.email,
                category: input.category,
                message: input.message,
                dashboard_url: `${window.location.origin}/dashboard/support`,
              },
            },
          })
        }
      } catch { /* admin email failure non-blocking */ }

      return { ticketNumber: ticket.ticket_number, accessToken: ticket.access_token }
    },
  })
}

// ── Update ticket (agent) ────────────────────────────────────────
// Migrated. Cache Helpers auto-invalidates the useTickets list query.
// useTicket() (composite) is on a separate query-key and isn't auto-
// invalidated, so we still call queryClient.invalidate for that one.

export function useUpdateTicket() {
  const qc = useQueryClient()
  const update = useUpdateMutation(supabase.from('support_tickets'), ['id'])
  return {
    mutateAsync: async ({ id, ...updates }: { id: string; status?: string; priority?: string; assigned_to?: string }) => {
      await update.mutateAsync({
        id,
        ...updates,
        updated_at: new Date().toISOString(),
      } as unknown as Parameters<typeof update.mutateAsync>[0])
      // useTicket() composes ticket+messages on a manual queryKey; Cache
      // Helpers can't observe it.
      qc.invalidateQueries({ queryKey: ['ticket'] })
    },
    isPending: update.isPending,
    // Compatibility: SupportTicketDetailPage uses both .mutateAsync and
    // .mutate (via tanstack defaults). Provide a no-op fallback so the
    // common destructure pattern keeps compiling.
    mutate: (input: { id: string; status?: string; priority?: string; assigned_to?: string }) => {
      void update.mutateAsync({
        ...input,
        updated_at: new Date().toISOString(),
      } as unknown as Parameters<typeof update.mutateAsync>[0])
    },
  }
}

// ── Add message (agent or customer) ──────────────────────────────
// Insert into ticket_messages + conditional update of parent ticket.
// Mixed-table write; raw mutation keeps the logic local.

export function useAddMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      ticketId: string
      authorType: 'customer' | 'agent'
      authorName: string
      authorId?: string
      body: string
      isInternalNote?: boolean
    }) => {
      const { error } = await supabase.from('ticket_messages').insert({
        ticket_id: input.ticketId,
        author_type: input.authorType,
        author_id: input.authorId || null,
        author_name: input.authorName,
        body: input.body,
        is_internal_note: input.isInternalNote || false,
      })
      if (error) throw error

      // Auto-open if new
      if (input.authorType === 'agent' && !input.isInternalNote) {
        await supabase
          .from('support_tickets')
          .update({ status: 'open', updated_at: new Date().toISOString() })
          .eq('id', input.ticketId)
          .eq('status', 'new')
      }

      // Auto-reopen if customer replies to resolved
      if (input.authorType === 'customer') {
        await supabase
          .from('support_tickets')
          .update({ status: 'open', updated_at: new Date().toISOString() })
          .eq('id', input.ticketId)
          .eq('status', 'resolved')
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticket'] })
      qc.invalidateQueries({ queryKey: ['ticket-public'] })
    },
  })
}

// ── Submit CSAT ──────────────────────────────────────────────────
// Update by (ticket_number, access_token) — not by primary key. Cache
// Helpers' useUpdateMutation requires the PK in the input; raw stays.

export function useSubmitCsat() {
  return useMutation({
    mutationFn: async ({ ticketNumber, token, rating, comment }: {
      ticketNumber: string
      token: string
      rating: number
      comment?: string
    }) => {
      const { error } = await supabase
        .from('support_tickets')
        .update({ csat_rating: rating, csat_comment: comment || null })
        .eq('ticket_number', ticketNumber)
        .eq('access_token', token)
      if (error) throw error
    },
  })
}

// ── Canned responses ─────────────────────────────────────────────

export function useCannedResponses() {
  const result = useQuery(
    supabase
      .from('ticket_canned_responses')
      .select('*')
      .eq('is_active', true)
      .order('title'),
    { staleTime: 300_000 }
  )
  return {
    ...result,
    data: (result.data ?? []) as unknown as { id: string; title: string; body: string; shortcut: string | null }[],
  }
}
