// Santé ops admin (P3) — wrappers React Query des 3 RPC serveur
// (migration 20260705172000) : syndication IDX, WhatsApp ops, coûts IA.
// Agrégation côté DB (règles perf §7) — le client ne scanne rien.

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface SyndicationHealth {
  by_status: Array<{ portal: string; status: string; count: number }>
  recent_errors: Array<{ property_id: string; agency_name: string | null; error: string | null; updated_at: string }>
  agencies: Array<{ agency_name: string; idx_enabled: boolean; transport: string; ftp_configured: boolean }>
  last_push_at: string | null
}

export function useSyndicationHealth() {
  return useQuery({
    queryKey: ['admin-syndication-health'],
    queryFn: async (): Promise<SyndicationHealth> => {
      const { data, error } = await supabase.rpc('get_admin_syndication_health')
      if (error) throw error
      return data as unknown as SyndicationHealth
    },
    staleTime: 60_000,
  })
}

export interface WhatsAppHealth {
  sent_24h: number
  failed_24h: number
  sent_7d: number
  failed_7d: number
  last_inbound_at: string | null
  last_status_update_at: string | null
  top_errors: Array<{ error: string; count: number }>
  unmapped_inbound_7d: number
  cron_locks: Array<{ job: string; locked_until: string }>
  /** Calculé au fetch (pas au render — react-hooks/purity) : webhook muet >24h. */
  webhook_stale: boolean
}

export function useWhatsAppHealth() {
  return useQuery({
    queryKey: ['admin-whatsapp-health'],
    queryFn: async (): Promise<WhatsAppHealth> => {
      const { data, error } = await supabase.rpc('get_admin_whatsapp_health')
      if (error) throw error
      const health = data as unknown as Omit<WhatsAppHealth, 'webhook_stale'>
      const webhook_stale =
        !!health.last_status_update_at &&
        Date.now() - new Date(health.last_status_update_at).getTime() > 24 * 60 * 60 * 1000
      return { ...health, webhook_stale }
    },
    staleTime: 60_000,
  })
}

export interface AiCostRow {
  month: string
  agency_id: string | null
  agency_name: string
  provider: string
  module: string
  calls: number
  tokens_in: number
  tokens_out: number
  cost_usd: number
}

export function useAiCosts(months = 6) {
  return useQuery({
    queryKey: ['admin-ai-costs', months],
    queryFn: async (): Promise<AiCostRow[]> => {
      const { data, error } = await supabase.rpc('get_admin_ai_costs', { p_months: months })
      if (error) throw error
      return (data ?? []) as AiCostRow[]
    },
    staleTime: 60_000,
  })
}
