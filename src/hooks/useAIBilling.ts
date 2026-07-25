/**
 * Hooks React Query du tableau de bord facturation IA (super-admin).
 * Lecture seule des tables d'usage et de solde alimentées par l'instrumentation IA
 * (`ai_usage_logs`, `ai_balance_snapshots`). Agrège tokens/coûts par provider.
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface BalanceSnapshot {
  captured_at: string
  total_balance_usd: number | null
  topped_up_balance_usd: number | null
  granted_balance_usd: number | null
}

export interface AIUsageSummary {
  deepseekTokens: number
  deepseekCostUsd: number
  claudeTokens: number
  claudeCostUsd: number
  fallbackCount: number
}

export interface AIUsageDailyPoint {
  date: string
  deepseek: number
  claude: number
}

/** Dernier instantané de solde DeepSeek (ligne la plus récente de `ai_balance_snapshots`). */
export function useDeepSeekBalance() {
  return useQuery({
    queryKey: ['ai-billing', 'deepseek-balance'],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<BalanceSnapshot | null> => {
      const { data, error } = await supabase
        .from('ai_balance_snapshots')
        .select('captured_at, total_balance_usd, topped_up_balance_usd, granted_balance_usd')
        .eq('provider', 'deepseek')
        .order('captured_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data ?? null
    },
  })
}

/** Agrège tokens et coûts d'usage IA sur la période (`month` = mois courant UTC, `30d` = 30 jours glissants). */
export function useAIUsageSummary(period: 'month' | '30d' = 'month') {
  return useQuery({
    queryKey: ['ai-billing', 'usage-summary', period],
    staleTime: 60_000,
    queryFn: async (): Promise<AIUsageSummary> => {
      const since =
        period === 'month'
          ? startOfMonthISO()
          : new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()

      const { data, error } = await supabase
        .from('ai_usage_logs')
        .select('provider, input_tokens, output_tokens, estimated_cost_usd, was_fallback')
        .gte('created_at', since)
      if (error) throw error

      const summary: AIUsageSummary = {
        deepseekTokens: 0,
        deepseekCostUsd: 0,
        claudeTokens: 0,
        claudeCostUsd: 0,
        fallbackCount: 0,
      }

      for (const row of data ?? []) {
        const tokens = (row.input_tokens ?? 0) + (row.output_tokens ?? 0)
        const cost = Number(row.estimated_cost_usd ?? 0)
        if (row.provider === 'deepseek') {
          summary.deepseekTokens += tokens
          summary.deepseekCostUsd += cost
        } else if (row.provider?.startsWith('claude')) {
          summary.claudeTokens += tokens
          summary.claudeCostUsd += cost
        }
        if (row.was_fallback) summary.fallbackCount++
      }

      return summary
    },
  })
}

/** Série journalière des tokens IA sur `days` jours, jours sans usage inclus à 0 (pour un graphe continu). */
export function useAIUsageTimeseries(days = 30) {
  return useQuery({
    queryKey: ['ai-billing', 'timeseries', days],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<AIUsageDailyPoint[]> => {
      const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString()
      const { data, error } = await supabase
        .from('ai_usage_logs')
        .select('created_at, provider, input_tokens, output_tokens')
        .gte('created_at', since)
      if (error) throw error

      const buckets = new Map<string, { deepseek: number; claude: number }>()
      for (const row of data ?? []) {
        const day = (row.created_at as string).slice(0, 10)
        const bucket = buckets.get(day) ?? { deepseek: 0, claude: 0 }
        const tokens = (row.input_tokens ?? 0) + (row.output_tokens ?? 0)
        if (row.provider === 'deepseek') bucket.deepseek += tokens
        else if (row.provider?.startsWith('claude')) bucket.claude += tokens
        buckets.set(day, bucket)
      }

      const out: AIUsageDailyPoint[] = []
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(Date.now() - i * 24 * 3600 * 1000).toISOString().slice(0, 10)
        const bucket = buckets.get(d) ?? { deepseek: 0, claude: 0 }
        out.push({ date: d, deepseek: bucket.deepseek, claude: bucket.claude })
      }
      return out
    },
  })
}

/** Début du mois courant (jour 1, minuit) en ISO UTC. */
function startOfMonthISO(): string {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
}
