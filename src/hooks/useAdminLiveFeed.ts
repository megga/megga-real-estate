import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useId } from 'react'
import { supabase } from '@/lib/supabase'

export interface LiveEvent {
  id: string
  action: string
  entity_type: string
  entity_id: string
  metadata: Record<string, unknown>
  created_at: string
  agency_id: string | null
  actor_id: string | null
}

export function useAdminLiveFeed(limit = 50) {
  const queryClient = useQueryClient()
  // Unique channel name per hook instance — see useAdminNotifications for
  // the same pattern. Without useId(), a re-mount (StrictMode dev OR
  // client-side navigation) crashes with:
  //   "cannot add postgres_changes callbacks for realtime:admin-live-feed
  //    after subscribe()"
  const channelId = useId()

  const events = useQuery({
    queryKey: ['admin-live-feed', limit],
    queryFn: async (): Promise<LiveEvent[]> => {
      const { data, error } = await supabase
        .from('activity_events')
        .select('id, action, entity_type, entity_id, metadata, created_at, agency_id, actor_id')
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return (data ?? []) as LiveEvent[]
    },
    staleTime: 10_000,
  })

  // Supabase Realtime — instant updates
  useEffect(() => {
    const channel = supabase
      .channel(`admin-live-feed-${channelId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'activity_events',
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['admin-live-feed'] })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [queryClient, channelId])

  return {
    events: events.data ?? [],
    isLoading: events.isLoading,
  }
}
