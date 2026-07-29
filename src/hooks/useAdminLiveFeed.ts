/**
 * Hook super-admin — flux d'activité temps réel de la plateforme.
 * Lit les derniers `activity_events` (toutes agences) et s'abonne au Realtime
 * Supabase pour invalider la liste à chaque INSERT.
 */
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

/** Derniers événements d'activité (défaut 50) rafraîchis en direct via Supabase Realtime. */
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

  // Supabase Realtime — mise à jour immédiate, mais groupée.
  //
  // Un INSERT déclenchait un refetch, donc une rafale d'événements déclenchait
  // une rafale de requêtes sur `activity_events` — et le matching en produit des
  // centaines d'affilée (4 435 `match_suggested` à ce jour). Le délai de 400 ms
  // laisse la rafale retomber avant de recharger : l'écran reste vivant, la base
  // ne subit qu'une requête.
  useEffect(() => {
    let pending: ReturnType<typeof setTimeout> | undefined
    const channel = supabase
      .channel(`admin-live-feed-${channelId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'activity_events',
      }, () => {
        clearTimeout(pending)
        pending = setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['admin-live-feed'] })
        }, 400)
      })
      .subscribe()

    return () => {
      clearTimeout(pending)
      supabase.removeChannel(channel)
    }
  }, [queryClient, channelId])

  return {
    events: events.data ?? [],
    isLoading: events.isLoading,
    isError: events.isError,
    refetch: events.refetch,
  }
}
