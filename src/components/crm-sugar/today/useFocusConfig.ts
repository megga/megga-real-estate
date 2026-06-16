// MEGGA CRM — Cockpit « Aujourd'hui » · Algo Focus · config tunable (DB → client)
// ----------------------------------------------------------------------------
// Lit le barème app_config.today_focus_v1 via le RPC get_today_focus_config()
// (SECURITY DEFINER — le client ne peut pas lire app_config directement). Permet
// de tuner poids/seuils/caps en DB sans redeploy. Parse défensif : toute clé
// manquante/invalide retombe sur FOCUS_DEFAULTS (jamais d'exception).

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { parseFocusConfig, FOCUS_DEFAULTS, type FocusConfig } from './focusScore'

const rpcUntyped = supabase.rpc as unknown as
  (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }>

export function useFocusConfig(): FocusConfig {
  const { profile } = useAuth()
  const agencyId = profile?.agency_id

  const query = useQuery({
    queryKey: ['focus-config', agencyId],
    queryFn: async (): Promise<FocusConfig> => {
      const { data, error } = await rpcUntyped('get_today_focus_config', {})
      if (error) throw error
      return parseFocusConfig(data)
    },
    enabled: !!agencyId,
    staleTime: 5 * 60_000,
  })

  // Toujours une config exploitable (défauts si pas encore chargée / pas d'agence).
  return useMemo(() => query.data ?? FOCUS_DEFAULTS, [query.data])
}
