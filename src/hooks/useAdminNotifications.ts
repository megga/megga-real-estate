import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useId } from 'react'
import { supabase } from '@/lib/supabase'

interface AdminNotification {
  id: string
  action: string
  entity_type: string
  entity_id: string
  metadata: Record<string, unknown>
  created_at: string
  read: boolean
}

const READ_IDS_KEY = 'megga-admin-read-notifications'

/**
 * Safely read the persisted list of read notification IDs from localStorage.
 * Returns [] if the value is missing, malformed JSON, or not an array of
 * strings — which can happen if the user manually edited localStorage or if
 * a previous version wrote a different shape.
 */
function readReadIds(): string[] {
  try {
    const raw = localStorage.getItem(READ_IDS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((x): x is string => typeof x === 'string')
  } catch {
    return []
  }
}

function writeReadIds(ids: string[]): void {
  try {
    localStorage.setItem(READ_IDS_KEY, JSON.stringify(ids))
  } catch {
    // Quota exceeded or storage disabled — fail silently. Read state is
    // best-effort and not worth crashing the admin panel over.
  }
}

export function useAdminNotifications() {
  const queryClient = useQueryClient()
  // Unique channel name per hook instance to avoid Supabase Realtime channel
  // name collisions across re-mounts (StrictMode dev OR client-side navigation).
  // Without this, the second mount throws:
  //   "cannot add postgres_changes callbacks for realtime:admin-notifications
  //    after subscribe()"
  // and crashes every page that uses this hook (audit bug A1).
  const channelId = useId()

  const notifications = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: async (): Promise<AdminNotification[]> => {
      const { data, error } = await supabase
        .from('activity_events')
        .select('id, action, entity_type, entity_id, metadata, created_at')
        .order('created_at', { ascending: false })
        .limit(30)
      if (error) throw error

      // Mark read status from localStorage (defensive against corrupted
      // values — see readReadIds).
      const readIds = readReadIds()
      return (data ?? []).map(n => ({
        ...n,
        entity_id: n.entity_id ?? '',
        metadata: (n.metadata ?? {}) as Record<string, unknown>,
        read: readIds.includes(n.id),
      }))
    },
    staleTime: 30_000,
    refetchInterval: 60_000, // Poll every 60s
  })

  // Supabase Realtime subscription for instant updates
  useEffect(() => {
    const channel = supabase
      .channel(`admin-notifications-${channelId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'activity_events',
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['admin-notifications'] })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [queryClient, channelId])

  const unreadCount = (notifications.data ?? []).filter(n => !n.read).length

  const markAsRead = (id: string) => {
    const readIds = readReadIds()
    if (!readIds.includes(id)) {
      writeReadIds([...readIds, id])
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] })
    }
  }

  const markAllAsRead = () => {
    const allIds = (notifications.data ?? []).map(n => n.id)
    writeReadIds(allIds)
    queryClient.invalidateQueries({ queryKey: ['admin-notifications'] })
  }

  return {
    notifications: notifications.data ?? [],
    unreadCount,
    isLoading: notifications.isLoading,
    markAsRead,
    markAllAsRead,
  }
}
