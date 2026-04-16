import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useId } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * Lightweight hook that returns the count of open/new support tickets.
 * Subscribes to Supabase Realtime so the badge updates instantly when
 * a new ticket arrives (no polling delay). Uses the useId() pattern
 * established in the supabase.channel() audit to avoid channel name
 * collisions on re-mount.
 */
export function useOpenTicketCount() {
  const queryClient = useQueryClient()
  const channelId = useId()

  const { data: count = 0 } = useQuery({
    queryKey: ['admin-open-ticket-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('support_tickets')
        .select('id', { count: 'exact', head: true })
        .in('status', ['new', 'open'])
      if (error) throw error
      return count ?? 0
    },
    staleTime: 30_000,
    refetchInterval: 120_000, // Fallback polling every 2 min
  })

  // Realtime: instant badge update when a ticket is created or status changes
  useEffect(() => {
    const channel = supabase
      .channel(`admin-ticket-count-${channelId}`)
      .on('postgres_changes', {
        event: '*', // INSERT (new ticket) + UPDATE (status change)
        schema: 'public',
        table: 'support_tickets',
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['admin-open-ticket-count'] })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [queryClient, channelId])

  return count
}
