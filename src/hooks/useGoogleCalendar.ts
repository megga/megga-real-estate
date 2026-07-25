/**
 * Hook de synchronisation Google Calendar pour l'agent (calendrier V3).
 * Statut de connexion + événements (via l'Edge Function `google-calendar-sync`),
 * connexion OAuth, et synchro visite→Google (create/update/delete + sync complet).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { CalendarEvent } from '@/components/calendar/week-view-types'

// ── Types ──

interface GoogleCalendarToken {
  id: string
  user_id: string
  google_email: string | null
  sync_enabled: boolean
  last_sync_at: string | null
}

interface GoogleCalendarEventRaw {
  id: string
  summary?: string
  description?: string
  location?: string
  start?: { dateTime?: string; date?: string }
  end?: { dateTime?: string; date?: string }
  extendedProperties?: { private?: Record<string, string> }
}

// ── Convert Google event to CalendarEvent ──

/** Normalise un événement brut de l'API Google en `CalendarEvent` (id préfixé `gcal_`). */
function googleEventToCalendarEvent(ge: GoogleCalendarEventRaw): CalendarEvent {
  const startStr = ge.start?.dateTime ?? ge.start?.date ?? ''
  const endStr = ge.end?.dateTime ?? ge.end?.date ?? ''
  const isAllDay = !ge.start?.dateTime

  return {
    id: `gcal_${ge.id}`,
    title: ge.summary ?? '(Sans titre)',
    start: new Date(startStr),
    end: new Date(endStr),
    isAllDay,
    color: 'purple',
    calendarId: 'google',
    description: ge.description,
    location: ge.location,
  }
}

// ── Hook ──

/**
 * Connexion Google Calendar + synchro des visites de l'agent. `dateRange` borne
 * la requête d'événements ; toutes les mutations passent par l'Edge Function
 * `google-calendar-sync`. Aucun fetch tant que le compte n'est pas connecté.
 */
export function useGoogleCalendar(dateRange?: { start: Date; end: Date }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const userId = user?.id

  // Check connection status
  const { data: tokenData, isLoading: statusLoading } = useQuery({
    queryKey: ['google-calendar-status', userId],
    queryFn: async (): Promise<GoogleCalendarToken | null> => {
      const { data, error } = await supabase
        .from('google_calendar_tokens')
        .select('id, user_id, google_email, sync_enabled, last_sync_at')
        .eq('user_id', userId!)
        .single()
      if (error || !data) return null
      return data as unknown as GoogleCalendarToken
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  })

  const isConnected = !!tokenData?.sync_enabled

  // Fetch Google Calendar events
  const { data: googleEvents = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['google-calendar-events', userId, dateRange?.start?.toISOString(), dateRange?.end?.toISOString()],
    queryFn: async (): Promise<CalendarEvent[]> => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return []

      const res = await supabase.functions.invoke('google-calendar-sync', {
        body: {
          action: 'list_events',
          time_min: dateRange?.start?.toISOString(),
          time_max: dateRange?.end?.toISOString(),
        },
      })

      if (res.error || !res.data?.events) return []
      return (res.data.events as GoogleCalendarEventRaw[]).map(googleEventToCalendarEvent)
    },
    enabled: !!userId && isConnected && !!dateRange,
    staleTime: 2 * 60 * 1000,
  })

  // Connect Google Calendar (initiates OAuth)
  // `from` désigne l'écran d'où part la connexion : /auth/callback s'en sert
  // pour y ramener l'agent au lieu de le déposer dans Réglages. C'est une
  // énumération et non une URL — une URL de retour libre dans le callback
  // serait une redirection ouverte. Un handler passé en référence
  // (`onClick={connectGoogleCalendar}`) reçoit un MouseEvent : `opts.from` y
  // est absent, donc le comportement par défaut est conservé.
  function connectGoogleCalendar(opts?: { from?: 'calendar' }) {
    const from = opts?.from === 'calendar' ? '&from=calendar' : ''
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: 'https://www.googleapis.com/auth/calendar',
        redirectTo: `${window.location.origin}/auth/callback?gcal=1${from}`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })
  }

  // Disconnect Google Calendar
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke('google-calendar-sync', {
        body: { action: 'disconnect' },
      })
      if (res.error) throw new Error(res.error.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-calendar-status'] })
      queryClient.invalidateQueries({ queryKey: ['google-calendar-events'] })
    },
  })

  // Sync a single visit to Google
  const syncVisitMutation = useMutation({
    mutationFn: async (visitId: string) => {
      const res = await supabase.functions.invoke('google-calendar-sync', {
        body: { action: 'create_event', visit_id: visitId },
      })
      if (res.error) throw new Error(res.error.message)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-calendar-events'] })
    },
  })

  // Update a visit in Google
  const updateVisitMutation = useMutation({
    mutationFn: async (visitId: string) => {
      const res = await supabase.functions.invoke('google-calendar-sync', {
        body: { action: 'update_event', visit_id: visitId },
      })
      if (res.error) throw new Error(res.error.message)
      // If not synced yet, create instead
      if (res.data?.not_synced) {
        const createRes = await supabase.functions.invoke('google-calendar-sync', {
          body: { action: 'create_event', visit_id: visitId },
        })
        if (createRes.error) throw new Error(createRes.error.message)
      }
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-calendar-events'] })
    },
  })

  // Remove a visit from Google
  const removeFromGoogleMutation = useMutation({
    mutationFn: async (visitId: string) => {
      const res = await supabase.functions.invoke('google-calendar-sync', {
        body: { action: 'delete_event', visit_id: visitId },
      })
      if (res.error) throw new Error(res.error.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-calendar-events'] })
    },
  })

  // Full sync
  const syncAllMutation = useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke('google-calendar-sync', {
        body: { action: 'sync_all' },
      })
      if (res.error) throw new Error(res.error.message)
      return res.data as { synced: number; total: number }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-calendar-events'] })
      queryClient.invalidateQueries({ queryKey: ['google-calendar-status'] })
    },
  })

  // Save tokens (called from auth callback)
  async function saveTokens(params: {
    access_token: string
    refresh_token: string
    expires_in: number
    google_email?: string
  }) {
    const res = await supabase.functions.invoke('google-calendar-sync', {
      body: { action: 'save_tokens', ...params },
    })
    if (res.error) throw new Error(res.error.message)
    queryClient.invalidateQueries({ queryKey: ['google-calendar-status'] })
  }

  return {
    // Status
    isConnected,
    isLoading: statusLoading,
    googleEmail: tokenData?.google_email ?? null,
    lastSyncAt: tokenData?.last_sync_at ?? null,

    // Events
    googleEvents,
    eventsLoading,

    // Actions
    connectGoogleCalendar,
    disconnectGoogleCalendar: disconnectMutation.mutateAsync,
    isDisconnecting: disconnectMutation.isPending,

    syncVisitToGoogle: syncVisitMutation.mutateAsync,
    updateVisitInGoogle: updateVisitMutation.mutateAsync,
    removeFromGoogle: removeFromGoogleMutation.mutateAsync,

    syncAll: syncAllMutation.mutateAsync,
    isSyncing: syncAllMutation.isPending,
    lastSyncResult: syncAllMutation.data,

    saveTokens,
  }
}
