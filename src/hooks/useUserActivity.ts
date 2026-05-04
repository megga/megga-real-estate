import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { useFavorites } from '@/hooks/useFavorites'
import { useSavedSearches } from '@/hooks/useSavedSearches'
import { supabase } from '@/lib/supabase'
import type { ActivityEvent } from '@/components/account/profile/ActivityTimeline'

// Synthesize an activity feed from existing user data.
//
// The design's `activity_events` table is agent-side only (audit log scoped by
// agency). For the public-side dashboard we construct events from what the
// user actually does:
//   - saved_searches  → "search-saved"
//   - market_favorites→ "favorite-added"
//   - properties      → "listing-published" (if they own any)
//   - message_threads → "agent-replied" (latest reply per thread)
//
// When real activity_events for users land later, this hook is the swap point.

export function useUserActivity(): { events: ActivityEvent[]; loading: boolean } {
  const { user } = useAuth()
  const { favoriteIds } = useFavorites()
  const { searches } = useSavedSearches()

  // Recent threads where the user is contact (gives "agent-replied" events)
  const { data: threadEvents = [], isLoading: threadsLoading } = useQuery({
    queryKey: ['account-activity-threads', user?.id],
    queryFn: async () => {
      if (!user) return [] as ActivityEvent[]
      const { data, error } = await supabase
        .from('message_threads')
        .select('id, contact_name, last_message, last_message_at, property_title')
        .eq('contact_email', user.email ?? '')
        .order('last_message_at', { ascending: false })
        .limit(5)
      if (error) return []
      return (data ?? []).map(
        (t): ActivityEvent => ({
          id: `thread-${t.id}`,
          kind: 'agent-replied',
          at: t.last_message_at,
          title: `${t.contact_name} a répondu`,
          sub: t.last_message ? `« ${t.last_message.slice(0, 80)} »` : t.property_title || undefined,
          deepLink: '/compte#messages',
        })
      )
    },
    enabled: !!user,
  })

  // Recent properties (user as owner) → published events
  const { data: ownedListings = [], isLoading: listingsLoading } = useQuery({
    queryKey: ['account-activity-listings', user?.id],
    queryFn: async () => {
      if (!user) return [] as ActivityEvent[]
      const { data, error } = await supabase
        .from('properties')
        .select('id, title, published_at, status')
        .eq('owner_id', user.id)
        .not('published_at', 'is', null)
        .order('published_at', { ascending: false })
        .limit(5)
      if (error) return []
      return (data ?? []).map(
        (p): ActivityEvent => ({
          id: `prop-${p.id}`,
          kind: 'listing-published',
          at: p.published_at as string,
          title: 'Annonce mise en ligne',
          sub: p.title || undefined,
          deepLink: '/compte#listings',
        })
      )
    },
    enabled: !!user,
  })

  // Saved searches as events
  const searchEvents: ActivityEvent[] = useMemo(
    () =>
      searches.slice(0, 5).map((s) => ({
        id: `search-${s.id}`,
        kind: 'search-saved',
        at: s.createdAt,
        title: `Recherche : ${s.name}`,
        sub: s.alertEnabled ? `Alerte ${s.alertFrequency === 'daily' ? 'quotidienne' : 'hebdomadaire'} activée` : 'Sans alerte',
        deepLink: '/compte#searches',
      })),
    [searches]
  )

  // Favorites count event (single rolling event when count > 0)
  const favoriteEvent: ActivityEvent[] = useMemo(() => {
    if (favoriteIds.length === 0) return []
    return [
      {
        id: 'favs-count',
        kind: 'favorite-added',
        at: new Date().toISOString(),
        title: `${favoriteIds.length} bien${favoriteIds.length > 1 ? 's' : ''} en favoris`,
        sub: 'Synchronisés sur tous vos appareils',
        deepLink: '/compte#favorites',
      },
    ]
  }, [favoriteIds])

  const events = useMemo(() => {
    const all = [...threadEvents, ...ownedListings, ...searchEvents, ...favoriteEvent]
    return all.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  }, [threadEvents, ownedListings, searchEvents, favoriteEvent])

  return { events, loading: threadsLoading || listingsLoading }
}
