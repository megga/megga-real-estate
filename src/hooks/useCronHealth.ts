import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { CronHealthRow } from '@/lib/cronHealth'

export function useCronHealth() {
  return useQuery({
    queryKey: ['admin', 'cron-health'],
    staleTime: 60_000,
    queryFn: async (): Promise<CronHealthRow[]> => {
      const { data, error } = await (supabase.rpc as unknown as
        (fn: string) => Promise<{ data: unknown; error: Error | null }>)('get_cron_health')
      if (error) throw error
      return (data ?? []) as CronHealthRow[]
    },
  })
}
