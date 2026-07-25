/**
 * Hook super-admin — monitoring santé plateforme.
 * Agrège quatre requêtes : santé globale (RPC), statuts par Edge Function (24 h),
 * journal d'erreurs (100 dernières) et historique de métriques (sparklines). Le roster des
 * fonctions est PASSIF (aucun ping) — voir la note sur EDGE_FUNCTION_NAMES.
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { EDGE_FUNCTION_ROSTER } from '@/lib/edgeFunctionRoster'

interface PlatformHealth {
  dbSizeMb: number
  dbLimitMb: number
  totalEdgeFunctions: number
  errorsLast24h: number
  emailsSentToday: number
  lastScrapingRun: string | null
  apiRequestsToday: number
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

// Roster = constante GÉNÉRÉE depuis supabase/functions/ (source unique, dérive
// bloquée par `npm run lint:roster` en CI). L'ancienne liste manuelle était
// tombée à 22 entrées sur ~69 fonctions (constat élagage juil. 2026).
//
// SÉMANTIQUE (honnêteté) : ce tableau est PASSIF — aucune fonction n'est
// pingée. Les statuts agrègent les activity_events `edge_function_invoked` /
// `edge_function_error` sur 24 h ; aujourd'hui AUCUNE fonction n'émet ces
// événements (0 ligne en prod) → tout affiche « sans télémétrie » (unknown),
// ce qui est la vérité. Brancher une vraie télémétrie (logs plateforme via
// Management API, ou émission par les fns) = chantier produit séparé.
const EDGE_FUNCTION_NAMES: readonly string[] = EDGE_FUNCTION_ROSTER

/** Santé plateforme, statuts Edge Functions, logs d'erreurs et historique de métriques pour le dashboard monitoring. */
export function useAdminMonitoring() {
  // RPC unique (migration 20260518_004) — remplace 6 queries parallèles
  // (4 count:'exact' sur activity_events + 2 SELECT metric_value sur
  // platform_metrics). Voir red-team CLAUDE.md §7.
  const health = useQuery({
    queryKey: ['admin-monitoring-health'],
    queryFn: async (): Promise<PlatformHealth> => {
      // Les limites DB/storage viennent de la RPC v2 (app_config.
      // admin_platform_limits) — plus de plafond codé en dur côté client.
      const { data, error } = await supabase.rpc('get_admin_monitoring_health')
      if (error) throw error
      const row = ((data as Array<{
        errors_last_24h: number
        emails_sent_today: number
        api_requests_today: number
        last_scraping_at: string | null
        db_size_mb: number
        storage_used_mb: number
        db_limit_mb: number
        storage_limit_mb: number
      }> | null) ?? [])[0]
      return {
        dbSizeMb: Number(row?.db_size_mb ?? 0),
        dbLimitMb: Number(row?.db_limit_mb ?? 8000),
        totalEdgeFunctions: EDGE_FUNCTION_NAMES.length,
        errorsLast24h: Number(row?.errors_last_24h ?? 0),
        emailsSentToday: Number(row?.emails_sent_today ?? 0),
        lastScrapingRun: row?.last_scraping_at ?? null,
        apiRequestsToday: Number(row?.api_requests_today ?? 0),
        storageUsedMb: Number(row?.storage_used_mb ?? 0),
        storageLimitMb: Number(row?.storage_limit_mb ?? 100000),
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

      const rows = EDGE_FUNCTION_NAMES.map(name => {
        const stat = statsMap.get(name) ?? { invocations: 0, errors: 0, lastAt: null }
        return {
          name,
          status: stat.errors > 0 ? 'error' as const : stat.invocations > 0 ? 'healthy' as const : 'unknown' as const,
          lastInvocation: stat.lastAt,
          errorsLast24h: stat.errors,
          invocationsLast24h: stat.invocations + stat.errors,
        }
      })
      // Signal d'abord : erreurs, puis actives, puis sans télémétrie (A→Z).
      const weight = { error: 0, healthy: 1, unknown: 2 } as const
      return rows.sort((a, b) =>
        weight[a.status] - weight[b.status] ||
        b.invocationsLast24h - a.invocationsLast24h ||
        a.name.localeCompare(b.name)
      )
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
