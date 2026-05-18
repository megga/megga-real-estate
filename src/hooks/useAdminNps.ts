// MEGGA CRM Sugar v2 — NPS responses admin.
// Source de vérité : table `admin_nps_responses` (migration 20260518_001).
// Remplace le hack JSON dans `admin_notes` identifié dans l'audit red-team.

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface NpsResponse {
  id: string
  rating: number
  comment: string
  user_email: string | null
  user_name: string | null
  agency_id: string | null
  role: string | null
  submitted_at: string
}

export interface NpsStats {
  totalResponses: number
  averageRating: number
  npsScore: number // -100 to 100
  distribution: Record<number, number> // { 1: count, 2: count, ... 5: count }
  promoters: number  // 4-5
  passives: number   // 3
  detractors: number // 1-2
}

interface NpsRow {
  id: string
  rating: number
  comment: string
  user_email: string | null
  user_name: string | null
  agency_id: string | null
  role: string | null
  submitted_at: string
}

export function useAdminNps() {
  return useQuery({
    queryKey: ['admin-nps'],
    queryFn: async (): Promise<{ responses: NpsResponse[]; stats: NpsStats }> => {
      const { data, error } = await supabase
        .from('admin_nps_responses')
        .select('id, rating, comment, user_email, user_name, agency_id, role, submitted_at')
        .order('submitted_at', { ascending: false })
      if (error) throw error

      const responses = (data ?? []) as NpsRow[]

      // Distribution + stats
      const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
      for (const r of responses) {
        distribution[r.rating] = (distribution[r.rating] ?? 0) + 1
      }

      const total = responses.length
      const avg = total > 0 ? responses.reduce((sum, r) => sum + r.rating, 0) / total : 0
      const promoters = (distribution[4] ?? 0) + (distribution[5] ?? 0)
      const detractors = (distribution[1] ?? 0) + (distribution[2] ?? 0)
      const passives = distribution[3] ?? 0
      const npsScore = total > 0 ? Math.round(((promoters - detractors) / total) * 100) : 0

      return {
        responses,
        stats: {
          totalResponses: total,
          averageRating: Math.round(avg * 10) / 10,
          npsScore,
          distribution,
          promoters,
          passives,
          detractors,
        },
      }
    },
    staleTime: 60_000,
  })
}
