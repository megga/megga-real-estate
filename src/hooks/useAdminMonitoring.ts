import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

interface PlatformHealth {
  dbSizeMb: number
  dbLimitMb: number
  totalEdgeFunctions: number
  errorsLast24h: number
  emailsSentToday: number
  lastScrapingRun: string | null
}

interface ErrorLog {
  id: string
  action: string
  entity_type: string
  metadata: Record<string, unknown>
  created_at: string
}

export function useAdminMonitoring() {
  const health = useQuery({
    queryKey: ['admin-monitoring-health'],
    queryFn: async (): Promise<PlatformHealth> => {
      const now = new Date()
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()

      const [errors, emails, lastScraping] = await Promise.all([
        supabase.from('activity_events').select('id', { count: 'exact', head: true })
          .eq('action', 'edge_function_error').gte('created_at', dayAgo),
        supabase.from('activity_events').select('id', { count: 'exact', head: true })
          .eq('action', 'email_sent').gte('created_at', todayStart),
        supabase.from('activity_events').select('created_at')
          .eq('action', 'scraping_completed').order('created_at', { ascending: false }).limit(1),
      ])

      return {
        dbSizeMb: 160,
        dbLimitMb: 500,
        totalEdgeFunctions: 28,
        errorsLast24h: errors.count ?? 0,
        emailsSentToday: emails.count ?? 0,
        lastScrapingRun: lastScraping.data?.[0]?.created_at ?? null,
      }
    },
    staleTime: 60_000,
  })

  const errorLogs = useQuery({
    queryKey: ['admin-monitoring-errors'],
    queryFn: async (): Promise<ErrorLog[]> => {
      const { data, error } = await supabase
        .from('activity_events')
        .select('id, action, entity_type, metadata, created_at')
        .eq('action', 'edge_function_error')
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return (data ?? []) as ErrorLog[]
    },
    staleTime: 30_000,
  })

  return {
    health: health.data,
    healthLoading: health.isLoading,
    errorLogs: errorLogs.data ?? [],
    errorLogsLoading: errorLogs.isLoading,
  }
}
