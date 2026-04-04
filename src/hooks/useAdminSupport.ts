import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export interface SupportTicket {
  id: string
  ticket_number: string
  subject: string
  description: string | null
  category: string
  priority: string
  status: string
  submitter_name: string
  submitter_email: string
  assigned_to: string | null
  sla_breached: boolean
  created_at: string
  updated_at: string
  agency_id: string | null
  agency_name: string | null
  last_message_at: string | null
  message_count: number
}

export interface TicketMessage {
  id: string
  body: string
  author_type: string
  author_id: string | null
  author_name: string
  is_internal_note: boolean
  created_at: string
}

export interface SupportStats {
  openCount: number
  newCount: number
  resolvedThisWeek: number
  slaBreach: number
}

export function useAdminSupport() {
  const queryClient = useQueryClient()

  const tickets = useQuery({
    queryKey: ['admin-support'],
    queryFn: async (): Promise<SupportTicket[]> => {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('id, ticket_number, subject, description, category, priority, status, submitter_name, submitter_email, assigned_to, sla_breached, created_at, updated_at, agency_id')
        .order('updated_at', { ascending: false })
      if (error) throw error

      const tickets = data ?? []
      if (tickets.length === 0) return []

      // Batch resolve agency names
      const agencyIds = [...new Set(tickets.map(t => t.agency_id).filter(Boolean))]
      let agencyMap: Record<string, string> = {}
      if (agencyIds.length > 0) {
        const { data: agencies } = await supabase
          .from('agencies')
          .select('id, name')
          .in('id', agencyIds as string[])
        agencyMap = Object.fromEntries((agencies ?? []).map(a => [a.id, a.name]))
      }

      // Batch get message counts + last message date via single query
      const ticketIds = tickets.map(t => t.id)
      const { data: messages } = await supabase
        .from('ticket_messages')
        .select('ticket_id, created_at')
        .in('ticket_id', ticketIds)
        .eq('is_internal_note', false)
        .order('created_at', { ascending: false })

      const msgStats: Record<string, { count: number; lastAt: string | null }> = {}
      for (const msg of messages ?? []) {
        if (!msgStats[msg.ticket_id]) {
          msgStats[msg.ticket_id] = { count: 0, lastAt: msg.created_at }
        }
        msgStats[msg.ticket_id].count++
      }

      return tickets.map(t => ({
        ...t,
        agency_name: t.agency_id ? agencyMap[t.agency_id] ?? null : null,
        last_message_at: msgStats[t.id]?.lastAt ?? null,
        message_count: msgStats[t.id]?.count ?? 0,
      }))
    },
    staleTime: 30_000,
  })

  const stats = useQuery({
    queryKey: ['admin-support-stats'],
    queryFn: async (): Promise<SupportStats> => {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const [open, newTickets, resolved, breached] = await Promise.all([
        supabase.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'new'),
        supabase.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'resolved').gte('updated_at', weekAgo),
        supabase.from('support_tickets').select('id', { count: 'exact', head: true }).eq('sla_breached', true).in('status', ['new', 'open', 'pending']),
      ])
      return {
        openCount: open.count ?? 0,
        newCount: newTickets.count ?? 0,
        resolvedThisWeek: resolved.count ?? 0,
        slaBreach: breached.count ?? 0,
      }
    },
    staleTime: 30_000,
  })

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: Record<string, unknown> = { status }
      if (status === 'resolved') updates.resolved_at = new Date().toISOString()
      if (status === 'closed') updates.closed_at = new Date().toISOString()
      const { error } = await supabase.from('support_tickets').update(updates).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-support'] })
      queryClient.invalidateQueries({ queryKey: ['admin-support-stats'] })
    },
  })

  const updatePriority = useMutation({
    mutationFn: async ({ id, priority }: { id: string; priority: string }) => {
      const { error } = await supabase.from('support_tickets').update({ priority }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-support'] }),
  })

  const assignTicket = useMutation({
    mutationFn: async ({ id, assignedTo }: { id: string; assignedTo: string | null }) => {
      const { error } = await supabase.from('support_tickets').update({ assigned_to: assignedTo }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-support'] }),
  })

  return {
    tickets: tickets.data ?? [],
    isLoading: tickets.isLoading,
    stats: stats.data,
    statsLoading: stats.isLoading,
    updateStatus,
    updatePriority,
    assignTicket,
  }
}

export function useTicketMessages(ticketId: string) {
  return useQuery({
    queryKey: ['admin-support', ticketId, 'messages'],
    queryFn: async (): Promise<TicketMessage[]> => {
      const { data, error } = await supabase
        .from('ticket_messages')
        .select('id, body, author_type, author_id, author_name, is_internal_note, created_at')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as TicketMessage[]
    },
    enabled: !!ticketId,
  })
}

export function useSendTicketReply() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ ticketId, content, isInternal }: { ticketId: string; content: string; isInternal?: boolean }) => {
      // Insert message with correct field names
      const { error: msgError } = await supabase.from('ticket_messages').insert({
        ticket_id: ticketId,
        body: content,
        author_type: 'agent',
        author_id: profile?.id,
        author_name: profile?.full_name ?? 'Admin MEGGA',
        is_internal_note: isInternal ?? false,
      })
      if (msgError) throw msgError

      // Update first_responded_at if this is the first agent response
      const { data: ticket } = await supabase
        .from('support_tickets')
        .select('first_responded_at, status')
        .eq('id', ticketId)
        .single()

      const updates: Record<string, unknown> = {}
      if (!ticket?.first_responded_at) updates.first_responded_at = new Date().toISOString()
      if (ticket?.status === 'new') updates.status = 'open'
      if (Object.keys(updates).length > 0) {
        await supabase.from('support_tickets').update(updates).eq('id', ticketId)
      }

      // Send email notification to customer (non-internal only)
      if (!isInternal) {
        const { data: ticketData } = await supabase
          .from('support_tickets')
          .select('submitter_email, submitter_name, subject, ticket_number, access_token')
          .eq('id', ticketId)
          .single()

        if (ticketData?.submitter_email) {
          await supabase.functions.invoke('send-email', {
            body: {
              to: ticketData.submitter_email,
              template: 'ticket_reply',
              data: {
                name: ticketData.submitter_name,
                ticket_number: ticketData.ticket_number,
                subject: ticketData.subject,
                reply_text: content,
                agent_name: profile?.full_name ?? 'Support MEGGA',
                tracking_url: `${window.location.origin}/support/ticket?number=${ticketData.ticket_number}&token=${ticketData.access_token}`,
              },
            },
          }).catch(() => { /* silently fail */ })
        }
      }
    },
    onSuccess: (_, { ticketId }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-support', ticketId, 'messages'] })
      queryClient.invalidateQueries({ queryKey: ['admin-support'] })
      queryClient.invalidateQueries({ queryKey: ['admin-support-stats'] })
    },
  })
}
