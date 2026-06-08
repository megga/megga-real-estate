import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

interface PlatformHealth {
  dbSizeMb: number
  dbLimitMb: number
  totalEdgeFunctions: number
  errorsLast24h: number
  emailsSentToday: number
  lastScrapingRun: string | null
  apiRequestsToday: number
  realtimeConnections: number
  storageUsedMb: number
  storageLimitMb: number
}

interface EdgeFunctionStatus {
  name: string
  status: 'healthy' | 'error' | 'unknown'
  lastInvocation: string | null
  errorsLast24h: number
  invocationsLast24h: number
}

interface ErrorLog {
  id: string
  action: string
  entity_type: string
  metadata: Record<string, unknown>
  created_at: string
  function_name?: string
  error_message?: string
  duration_ms?: number
}

const EDGE_FUNCTION_NAMES = [
  'ai-copilot', 'ai-search', 'external-matching', 'send-email', 'send-property-email',
  'send-reminder-email', 'send-team-invite', 'send-visit-email',
  'extract-property-pdf', 'extract-property-url', 'kyc-screening', 'photo-labeler',
  'virtual-staging', 'public-staging', 'google-calendar-sync', 'outlook-calendar-sync',
  'stripe-checkout', 'stripe-portal', 'stripe-webhook', 'score-engine', 'search-alert',
  'market-scraper', 'market-scraper-batch', 'automation-engine', 'accept-team-invite',
  'webhooks', 'admin-monitoring', 'ai-billing-monitor', 'translate-on-demand',
]

export function useAdminMonitoring() {
  // RPC unique (migration 20260518_004) — remplace 6 queries parallèles
  // (4 count:'exact' sur activity_events + 2 SELECT metric_value sur
  // platform_metrics). Voir red-team CLAUDE.md §7.
  const health = useQuery({
    queryKey: ['admin-monitoring-health'],
    queryFn: async (): Promise<PlatformHealth> => {
      const { data, error } = await supabase.rpc('get_admin_monitoring_health')
      if (error) throw error
      const row = ((data as Array<{
        errors_last_24h: number
        emails_sent_today: number
        api_requests_today: number
        last_scraping_at: string | null
        db_size_mb: number
        storage_used_mb: number
      }> | null) ?? [])[0]
      return {
        dbSizeMb: Number(row?.db_size_mb ?? 160),
        dbLimitMb: 8000, // Pro plan = 8 GB
        totalEdgeFunctions: EDGE_FUNCTION_NAMES.length,
        errorsLast24h: Number(row?.errors_last_24h ?? 0),
        emailsSentToday: Number(row?.emails_sent_today ?? 0),
        lastScrapingRun: row?.last_scraping_at ?? null,
        apiRequestsToday: Number(row?.api_requests_today ?? 0),
        realtimeConnections: 0, // Updated via Edge Function
        storageUsedMb: Number(row?.storage_used_mb ?? 0),
        storageLimitMb: 100000, // Pro = 100 GB
      }
    },
    staleTime: 60_000,
  })

  // Edge Function statuses — per-function error/invocation counts
  const edgeFunctions = useQuery({
    queryKey: ['admin-monitoring-functions'],
    queryFn: async (): Promise<EdgeFunctionStatus[]> => {
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

      // Get all edge function events in last 24h
      const { data: events } = await supabase
        .from('activity_events')
        .select('action, entity_type, metadata, created_at')
        .in('action', ['edge_function_invoked', 'edge_function_error'])
        .gte('created_at', dayAgo)

      // Build per-function stats
      const statsMap = new Map<string, { invocations: number; errors: number; lastAt: string | null }>()
      for (const fn of EDGE_FUNCTION_NAMES) {
        statsMap.set(fn, { invocations: 0, errors: 0, lastAt: null })
      }

      for (const evt of events ?? []) {
        const fnName = (evt.metadata as Record<string, unknown>)?.function_name as string ?? evt.entity_type
        const stat = statsMap.get(fnName)
        if (stat) {
          if (evt.action === 'edge_function_error') stat.errors++
          else stat.invocations++
          if (!stat.lastAt || evt.created_at > stat.lastAt) stat.lastAt = evt.created_at
        }
      }

      return EDGE_FUNCTION_NAMES.map(name => {
        const stat = statsMap.get(name) ?? { invocations: 0, errors: 0, lastAt: null }
        return {
          name,
          status: stat.errors > 0 ? 'error' as const : stat.invocations > 0 ? 'healthy' as const : 'unknown' as const,
          lastInvocation: stat.lastAt,
          errorsLast24h: stat.errors,
          invocationsLast24h: stat.invocations + stat.errors,
        }
      })
    },
    staleTime: 30_000,
  })

  const errorLogs = useQuery({
    queryKey: ['admin-monitoring-errors'],
    queryFn: async (): Promise<ErrorLog[]> => {
      const { data, error } = await supabase
        .from('activity_events')
        .select('id, action, entity_type, metadata, created_at')
        .eq('action', 'edge_function_error')
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      return (data ?? []).map(e => ({
        ...e,
        metadata: (e.metadata ?? {}) as Record<string, unknown>,
        function_name: ((e.metadata as Record<string, unknown>)?.function_name as string) ?? e.entity_type,
        error_message: ((e.metadata as Record<string, unknown>)?.error as string) ?? ((e.metadata as Record<string, unknown>)?.message as string) ?? '',
        duration_ms: ((e.metadata as Record<string, unknown>)?.duration_ms as number) ?? undefined,
      }))
    },
    staleTime: 15_000,
  })

  // Metrics history for sparklines
  const metricsHistory = useQuery({
    queryKey: ['admin-monitoring-history'],
    queryFn: async () => {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const { data, error } = await supabase
        .from('platform_metrics')
        .select('metric_type, metric_value, recorded_at')
        .gte('recorded_at', weekAgo)
        .order('recorded_at', { ascending: true })
      if (error) throw error
      return data ?? []
    },
    staleTime: 300_000, // 5 min
  })

  return {
    health: health.data,
    healthLoading: health.isLoading,
    healthError: health.isError,
    edgeFunctions: edgeFunctions.data ?? [],
    edgeFunctionsLoading: edgeFunctions.isLoading,
    errorLogs: errorLogs.data ?? [],
    errorLogsLoading: errorLogs.isLoading,
    metricsHistory: metricsHistory.data ?? [],
  }
}
