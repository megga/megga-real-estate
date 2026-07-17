// MEGGA CRM — WhatsApp tool-usage stats admin hook.
// Lit la RPC `get_whatsapp_tool_usage_stats` (migration 20260605060100) en mode OBSERVÉ (sans
// p_known_tools) : renvoie chaque outil RÉELLEMENT appelé — catalogué OU NON. La page complète
// ensuite avec les outils jamais utilisés du catalogue frontend. Ainsi un outil utilisé mais absent
// du catalogue (dérive : nouvel outil agent pas encore miroité, ou nom halluciné) reste VISIBLE au
// lieu d'être silencieusement masqué — c'est tout l'intérêt d'une page d'observabilité.
// Read-only: MEGGA observe. Garde serveur is_super_admin() (la RPC lève 42501 sinon).

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface ToolUsageRow {
  tool: string
  total_calls: number          // bigint → number (PostgREST)
  error_count: number          // bigint → number
  error_rate: number | string  // numeric → string (PostgREST)
  last_used_at: string | null
}

/** Stats d'usage des outils WhatsApp en mode observé (tout outil réellement appelé, catalogué ou non). */
export function useAdminToolUsage() {
  return useQuery({
    queryKey: ['admin', 'tool-usage-stats'],
    queryFn: async (): Promise<ToolUsageRow[]> => {
      // Sans argument → p_known_tools NULL côté SQL → agrégation des seuls outils observés.
      const { data, error } = await (supabase.rpc as unknown as
        (fn: string) => Promise<{ data: unknown; error: Error | null }>
      )('get_whatsapp_tool_usage_stats')
      if (error) throw error
      return (data ?? []) as ToolUsageRow[]
    },
    staleTime: 60_000,
  })
}
