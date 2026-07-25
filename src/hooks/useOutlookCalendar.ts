/**
 * Intégration calendrier Outlook (Microsoft Graph) via OAuth Azure.
 * Statut de connexion + événements + mutations de synchro (connect/disconnect,
 * push/update/remove d'une visite, sync complète) déléguées à l'Edge Function
 * `outlook-calendar-sync`. Pendant de `useGoogleCalendar` pour le calendrier V3.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { CalendarEvent } from '@/components/calendar/week-view-types'

// ── Types ──

interface OutlookCalendarToken {
  id: string
  user_id: string
  outlook_email: string | null
  sync_enabled: boolean
  last_sync_at: string | null
}

interface OutlookCalendarEventRaw {
  id: string
  subject?: string
  bodyPreview?: string
  location?: { displayName?: string }
  start?: { dateTime?: string; timeZone?: string }
  end?: { dateTime?: string; timeZone?: string }
  isAllDay?: boolean
}

/** Mappe un événement Microsoft Graph brut vers le `CalendarEvent` interne (normalise le fuseau). */
function outlookEventToCalendarEvent(oe: OutlookCalendarEventRaw): CalendarEvent {
  // Microsoft Graph returns dateTime without Z suffix for timezone-aware events
  const startStr = oe.start?.dateTime ?? ''
  const endStr = oe.end?.dateTime ?? ''

  return {
    id: `ocal_${oe.id}`,
    title: oe.subject ?? '(Sans titre)',
    start: new Date(startStr.endsWith('Z') ? startStr : `${startStr}Z`),
    end: new Date(endStr.endsWith('Z') ? endStr : `${endStr}Z`),
    isAllDay: oe.isAllDay ?? false,
    color: 'blue',
    calendarId: 'outlook',
    description: oe.bodyPreview,
    location: oe.location?.displayName,
  }
}

/**
 * Expose l'état de connexion Outlook, les événements du calendrier sur `dateRange`,
 * et les actions de synchro (connect/disconnect, push d'une visite, sync complète).
 * Toutes les mutations passent par l'Edge Function `outlook-calendar-sync`.
 */
export function useOutlookCalendar(dateRange?: { start: Date; end: Date }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const userId = user?.id

  // Check connection status
  const { data: tokenData, isLoading: statusLoading } = useQuery({
    queryKey: ['outlook-calendar-status', userId],
    queryFn: async (): Promise<OutlookCalendarToken | null> => {
      const { data, error } = await supabase
        .from('outlook_calendar_tokens')
        .select('id, user_id, outlook_email, sync_enabled, last_sync_at')
        .eq('user_id', userId!)
        .single()
      if (error || !data) return null
      return data as unknown as OutlookCalendarToken
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  })

  const isConnected = !!tokenData?.sync_enabled

  // Fetch Outlook Calendar events
  const { data: outlookEvents = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['outlook-calendar-events', userId, dateRange?.start?.toISOString(), dateRange?.end?.toISOString()],
    queryFn: async (): Promise<CalendarEvent[]> => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return []

      const res = await supabase.functions.invoke('outlook-calendar-sync', {
        body: {
          action: 'list_events',
          time_min: dateRange?.start?.toISOString(),
          time_max: dateRange?.end?.toISOString(),
        },
      })

      if (res.error || !res.data?.events) return []
      return (res.data.events as OutlookCalendarEventRaw[]).map(outlookEventToCalendarEvent)
    },
    enabled: !!userId && isConnected && !!dateRange,
    staleTime: 2 * 60 * 1000,
  })

  // Connect Outlook Calendar (initiates OAuth via Azure provider)
  //
  // Même règle que useGoogleCalendar : on lie l'identité au compte connecté
  // (`linkIdentity`) au lieu de ré-authentifier la session, sauf si l'identité
  // Azure est déjà celle du compte courant — auquel cas `signInWithOAuth` est
  // sans risque de bascule et permet de re-consentir aux scopes Calendars.
  // `from` = énumération d'écrans de retour, pas une URL (cf. useGoogleCalendar).
  // Ne jette jamais ; exige « Manual linking » activé côté projet Supabase.
  async function connectOutlookCalendar(opts?: { from?: 'calendar' }): Promise<{ error: string | null }> {
    const from = opts?.from === 'calendar' ? '&from=calendar' : ''
    const options = {
      scopes: 'https://graph.microsoft.com/Calendars.ReadWrite offline_access User.Read',
      redirectTo: `${window.location.origin}/auth/callback?outlook=1${from}`,
      queryParams: {
        prompt: 'consent',
      },
    }
    const { data: idData } = await supabase.auth.getUserIdentities()
    const alreadyMine = idData?.identities?.some(i => i.provider === 'azure') ?? false
    const { error } = alreadyMine
      ? await supabase.auth.signInWithOAuth({ provider: 'azure', options })
      : await supabase.auth.linkIdentity({ provider: 'azure', options })
    return { error: error ? error.message : null }
  }

  // Disconnect Outlook Calendar
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke('outlook-calendar-sync', {
        body: { action: 'disconnect' },
      })
      if (res.error) throw new Error(res.error.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outlook-calendar-status'] })
      queryClient.invalidateQueries({ queryKey: ['outlook-calendar-events'] })
    },
  })

  // Sync a single visit to Outlook
  const syncVisitMutation = useMutation({
    mutationFn: async (visitId: string) => {
      const res = await supabase.functions.invoke('outlook-calendar-sync', {
        body: { action: 'create_event', visit_id: visitId },
      })
      if (res.error) throw new Error(res.error.message)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outlook-calendar-events'] })
    },
  })

  // Update a visit in Outlook
  const updateVisitMutation = useMutation({
    mutationFn: async (visitId: string) => {
      const res = await supabase.functions.invoke('outlook-calendar-sync', {
        body: { action: 'update_event', visit_id: visitId },
      })
      if (res.error) throw new Error(res.error.message)
      // If not synced yet, create instead
      if (res.data?.not_synced) {
        const createRes = await supabase.functions.invoke('outlook-calendar-sync', {
          body: { action: 'create_event', visit_id: visitId },
        })
        if (createRes.error) throw new Error(createRes.error.message)
      }
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outlook-calendar-events'] })
    },
  })

  // Remove a visit from Outlook
  const removeFromOutlookMutation = useMutation({
    mutationFn: async (visitId: string) => {
      const res = await supabase.functions.invoke('outlook-calendar-sync', {
        body: { action: 'delete_event', visit_id: visitId },
      })
      if (res.error) throw new Error(res.error.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outlook-calendar-events'] })
    },
  })

  // Full sync
  const syncAllMutation = useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke('outlook-calendar-sync', {
        body: { action: 'sync_all' },
      })
      if (res.error) throw new Error(res.error.message)
      return res.data as { synced: number; total: number }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outlook-calendar-events'] })
      queryClient.invalidateQueries({ queryKey: ['outlook-calendar-status'] })
    },
  })

  // Save tokens (called from auth callback)
  async function saveTokens(params: {
    access_token: string
    refresh_token: string
    expires_in: number
    outlook_email?: string
  }) {
    const res = await supabase.functions.invoke('outlook-calendar-sync', {
      body: { action: 'save_tokens', ...params },
    })
    if (res.error) throw new Error(res.error.message)
    queryClient.invalidateQueries({ queryKey: ['outlook-calendar-status'] })
  }

  return {
    // Status
    isConnected,
    isLoading: statusLoading,
    outlookEmail: tokenData?.outlook_email ?? null,
    lastSyncAt: tokenData?.last_sync_at ?? null,

    // Events
    outlookEvents,
    eventsLoading,

    // Actions
    connectOutlookCalendar,
    disconnectOutlookCalendar: disconnectMutation.mutateAsync,
    isDisconnecting: disconnectMutation.isPending,

    syncVisitToOutlook: syncVisitMutation.mutateAsync,
    updateVisitInOutlook: updateVisitMutation.mutateAsync,
    removeFromOutlook: removeFromOutlookMutation.mutateAsync,

    syncAll: syncAllMutation.mutateAsync,
    isSyncing: syncAllMutation.isPending,
    lastSyncResult: syncAllMutation.data,

    saveTokens,
  }
}
