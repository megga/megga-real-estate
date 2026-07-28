/**
 * Hook super-admin — modération des annonces publiées.
 * Liste les biens actifs/réservés (+ agence résolue), stats agrégées via RPC, et
 * mutation `moderate` (approve/flag/remove) qui journalise dans `moderation_actions`.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export interface ModerationListing {
  id: string
  title: string
  price: number
  city: string | null
  canton: string | null
  photos: string[]
  published_at: string | null
  moderation_status: string
  moderation_reason: string | null
  agency_id: string
  agency_name: string | null
}

export interface ModerationStats {
  totalPublished: number
  flaggedThisMonth: number
  removedThisMonth: number
}

/** Annonces à modérer (biens actifs/réservés), stats agrégées et action de modération (approve/flag/remove + audit). */
export function useAdminModeration() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()

  const listings = useQuery({
    queryKey: ['admin-moderation'],
    queryFn: async (): Promise<ModerationListing[]> => {
      const { data, error } = await supabase
        .from('properties')
        .select('id, title, price, city, canton, photos, published_at, moderation_status, moderation_reason, agency_id')
        .in('status', ['active', 'reserved'])
        .order('published_at', { ascending: false })
        // Plafond très au-delà de ce que la pagination (15/page) atteint : la
        // requête n'était pas bornée du tout, ce qui la faisait grossir avec le
        // portefeuille de TOUTES les agences.
        .limit(500)
      if (error) throw error

      const agencyIds = [...new Set((data ?? []).map(p => p.agency_id).filter(Boolean))]
      let agencyMap: Record<string, string> = {}
      if (agencyIds.length > 0) {
        const { data: agencies } = await supabase.from('agencies').select('id, name').in('id', agencyIds)
        agencyMap = Object.fromEntries((agencies ?? []).map(a => [a.id, a.name]))
      }

      return (data ?? []).map(p => ({
        ...p,
        photos: p.photos ?? [],
        moderation_status: p.moderation_status ?? 'published',
        agency_name: p.agency_id ? agencyMap[p.agency_id] ?? null : null,
      })) as unknown as ModerationListing[]
    },
    staleTime: 30_000,
  })

  // RPC unique (migration 20260518_004) — remplace 3 count:'exact' parallèles
  // sur properties + moderation_actions (red-team CLAUDE.md §7).
  const stats = useQuery({
    queryKey: ['admin-moderation-stats'],
    queryFn: async (): Promise<ModerationStats> => {
      const { data, error } = await supabase.rpc('get_admin_moderation_stats')
      if (error) throw error
      const row = ((data as Array<{
        published_count: number
        flags_this_month: number
        removes_this_month: number
      }> | null) ?? [])[0]
      return {
        totalPublished: Number(row?.published_count ?? 0),
        flaggedThisMonth: Number(row?.flags_this_month ?? 0),
        removedThisMonth: Number(row?.removes_this_month ?? 0),
      }
    },
    staleTime: 60_000,
  })

  const moderate = useMutation({
    mutationFn: async ({ propertyId, action, reason }: { propertyId: string; action: 'approve' | 'flag' | 'remove'; reason?: string }) => {
      const newStatus = action === 'remove' ? 'removed' : action === 'flag' ? 'flagged' : 'published'
      const { error: updateError } = await supabase
        .from('properties')
        .update({ moderation_status: newStatus, moderation_reason: reason ?? null })
        .eq('id', propertyId)
      if (updateError) throw updateError

      const { error: actionError } = await supabase
        .from('moderation_actions')
        .insert({ property_id: propertyId, action, reason: reason ?? null, actor_id: profile?.id })
      if (actionError) throw actionError
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-moderation'] })
      queryClient.invalidateQueries({ queryKey: ['admin-moderation-stats'] })
    },
  })

  return {
    listings: listings.data ?? [],
    isLoading: listings.isLoading,
    isError: listings.isError,
    refetch: listings.refetch,
    stats: stats.data,
    statsLoading: stats.isLoading,
    moderate,
  }
}
