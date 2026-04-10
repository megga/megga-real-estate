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

export function useAdminNps() {
  return useQuery({
    queryKey: ['admin-nps'],
    queryFn: async (): Promise<{ responses: NpsResponse[]; stats: NpsStats }> => {
      const { data, error } = await supabase
        .from('admin_notes')
        .select('id, content, created_at')
        .eq('entity_type', 'nps_response')
        .order('created_at', { ascending: false })
      if (error) throw error

      // Parse chaque réponse avec try/catch — un enregistrement corrompu ne doit pas crasher toute la page
      const responses: NpsResponse[] = (data ?? []).flatMap(n => {
        try {
          const parsed = JSON.parse(n.content)
          return [{
            id: n.id,
            rating: parsed.rating ?? 0,
            comment: parsed.comment ?? '',
            user_email: parsed.user_email ?? null,
            user_name: parsed.user_name ?? null,
            agency_id: parsed.agency_id ?? null,
            role: parsed.role ?? null,
            submitted_at: parsed.submitted_at ?? n.created_at,
          }]
        } catch {
          return []
        }
      })

      // Calculate stats
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
