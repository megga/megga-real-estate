/**
 * État de santé des jobs pg_cron pour le monitoring super-admin, via la RPC
 * `get_cron_health`. `staleTime` de 60s pour éviter de repoller à chaque montage.
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { CronHealthRow } from '@/lib/cronHealth'

/** Retourne les lignes de santé cron (dernière exécution, statut) pour l'admin. */
export function useCronHealth() {
  return useQuery({
    queryKey: ['admin', 'cron-health'],
    staleTime: 60_000,
    queryFn: async (): Promise<CronHealthRow[]> => {
      const { data, error } = await supabase.rpc('get_cron_health')
      if (error) throw error
      return (data ?? []) as CronHealthRow[]
    },
  })
}
