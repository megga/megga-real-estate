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

      // Mark read status from localStorage
      const readIds: string[] = JSON.parse(localStorage.getItem('megga-admin-read-notifications') ?? '[]')
      return (data ?? []).map(n => ({
        ...n,
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
    const readIds: string[] = JSON.parse(localStorage.getItem('megga-admin-read-notifications') ?? '[]')
    if (!readIds.includes(id)) {
      readIds.push(id)
      localStorage.setItem('megga-admin-read-notifications', JSON.stringify(readIds))
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] })
    }
  }

  const markAllAsRead = () => {
    const allIds = (notifications.data ?? []).map(n => n.id)
    localStorage.setItem('megga-admin-read-notifications', JSON.stringify(allIds))
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
