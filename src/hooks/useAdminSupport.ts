import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export interface SupportTicket {
  id: string
  subject: string
  description: string | null
  priority: string
  status: string
  created_at: string
  updated_at: string
  agency_id: string | null
  agency_name: string | null
  last_message_at: string | null
  message_count: number
}

export interface TicketMessage {
  id: string
  content: string
  sender_id: string
  sender_type: string
  created_at: string
}

export interface SupportStats {
  openCount: number
  resolvedThisWeek: number
}

export function useAdminSupport() {
  const queryClient = useQueryClient()

  const tickets = useQuery({
    queryKey: ['admin-support'],
    queryFn: async (): Promise<SupportTicket[]> => {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('id, subject, description, priority, status, created_at, updated_at, agency_id')
        .order('updated_at', { ascending: false })
      if (error) throw error

      const agencyIds = [...new Set((data ?? []).map(t => t.agency_id).filter(Boolean))]
      let agencyMap: Record<string, string> = {}
      if (agencyIds.length > 0) {
        const { data: agencies } = await supabase
          .from('agencies')
          .select('id, name')
          .in('id', agencyIds as string[])
        agencyMap = Object.fromEntries((agencies ?? []).map(a => [a.id, a.name]))
      }

      const ticketIds = (data ?? []).map(t => t.id)
      let messageCounts: Record<string, { count: number; lastAt: string | null }> = {}
      if (ticketIds.length > 0) {
        const { data: messages } = await supabase
          .from('ticket_messages')
          .select('ticket_id, created_at')
          .in('ticket_id', ticketIds)
          .order('created_at', { ascending: false })
        for (const msg of messages ?? []) {
          if (!messageCounts[msg.ticket_id]) {
            messageCounts[msg.ticket_id] = { count: 0, lastAt: msg.created_at }
          }
          messageCounts[msg.ticket_id].count++
        }
      }

      return (data ?? []).map(t => ({
        ...t,
        agency_name: t.agency_id ? agencyMap[t.agency_id] ?? null : null,
        last_message_at: messageCounts[t.id]?.lastAt ?? null,
        message_count: messageCounts[t.id]?.count ?? 0,
      }))
    },
    staleTime: 30_000,
  })

  const stats = useQuery({
    queryKey: ['admin-support-stats'],
    queryFn: async (): Promise<SupportStats> => {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const [open, resolved] = await Promise.all([
        supabase.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'resolved').gte('updated_at', weekAgo),
      ])
      return {
        openCount: open.count ?? 0,
        resolvedThisWeek: resolved.count ?? 0,
      }
    },
    staleTime: 30_000,
  })

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('support_tickets').update({ status }).eq('id', id)
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

  return {
    tickets: tickets.data ?? [],
    isLoading: tickets.isLoading,
    stats: stats.data,
    statsLoading: stats.isLoading,
    updateStatus,
    updatePriority,
  }
}

export function useTicketMessages(ticketId: string) {
  return useQuery({
    queryKey: ['admin-support', ticketId, 'messages'],
    queryFn: async (): Promise<TicketMessage[]> => {
      const { data, error } = await supabase
        .from('ticket_messages')
        .select('id, content, sender_id, sender_type, created_at')
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
    mutationFn: async ({ ticketId, content }: { ticketId: string; content: string }) => {
      const { error } = await supabase.from('ticket_messages').insert({
        ticket_id: ticketId,
        content,
        sender_id: profile?.id,
        sender_type: 'admin',
      })
      if (error) throw error
    },
    onSuccess: (_, { ticketId }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-support', ticketId, 'messages'] })
      queryClient.invalidateQueries({ queryKey: ['admin-support'] })
    },
  })
}
