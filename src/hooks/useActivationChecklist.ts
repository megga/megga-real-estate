// MEGGA — Hook React Query pour la checklist d'activation Premier jour.
//
// Lit / écrit la colonne JSONB `profiles.activation_checklist` ajoutée par
// la migration 20260522_001_premier_jour_calibration.sql. La checklist
// persiste entre les sessions, suit l'agent du sas Premier jour au
// Today permanent, et est invalidée optimistiquement à chaque toggle.
//
// Default = D0_CHECKLIST (5 items, tous done=false) si la colonne est
// encore NULL côté base (agent qui n'a pas encore touché la pastille).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { D0_CHECKLIST } from '@/components/premier-jour-sugar/data'
import type { D0ChecklistItem } from '@/components/premier-jour-sugar/types'

const QUERY_KEY = 'activation-checklist'

/**
 * Lit la checklist d'activation pour l'agent courant.
 * Retourne toujours un tableau de 5 items (les défauts si la colonne
 * est NULL ou si la liste est partielle).
 */
export function useActivationChecklist() {
  const { profile } = useAuth()
  const agentId = profile?.id ?? null
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: [QUERY_KEY, agentId],
    enabled: !!agentId,
    staleTime: 30_000,
    queryFn: async (): Promise<D0ChecklistItem[]> => {
      if (!agentId) return D0_CHECKLIST
      const { data, error } = await supabase
        .from('profiles')
        .select('activation_checklist')
        .eq('id', agentId)
        .maybeSingle()
      if (error) throw error

      const stored = data?.activation_checklist as D0ChecklistItem[] | null
      if (!stored || !Array.isArray(stored) || stored.length === 0) {
        return D0_CHECKLIST
      }

      // Merge avec D0_CHECKLIST pour gérer les ajouts d'items en base
      // (si on étend D0_CHECKLIST plus tard, les anciens profils auront
      // automatiquement les nouveaux items à done=false).
      return D0_CHECKLIST.map((def) => {
        const persisted = stored.find((s) => s.id === def.id)
        return persisted ? { ...def, done: persisted.done } : def
      })
    },
  })

  const toggle = useMutation({
    mutationFn: async (itemId: string) => {
      if (!agentId) return
      const current = query.data ?? D0_CHECKLIST
      const next = current.map((i) =>
        i.id === itemId ? { ...i, done: !i.done } : i,
      )
      const { error } = await supabase
        .from('profiles')
        .update({ activation_checklist: next })
        .eq('id', agentId)
      if (error) throw error
      return next
    },
    onMutate: async (itemId: string) => {
      // Optimistic update — l'UI réagit immédiatement, le serveur suit
      await queryClient.cancelQueries({ queryKey: [QUERY_KEY, agentId] })
      const previous = queryClient.getQueryData<D0ChecklistItem[]>([
        QUERY_KEY,
        agentId,
      ])
      const optimistic = (previous ?? D0_CHECKLIST).map((i) =>
        i.id === itemId ? { ...i, done: !i.done } : i,
      )
      queryClient.setQueryData<D0ChecklistItem[]>(
        [QUERY_KEY, agentId],
        optimistic,
      )
      return { previous }
    },
    onError: (_err, _itemId, context) => {
      // Rollback en cas d'erreur réseau / RLS
      if (context?.previous) {
        queryClient.setQueryData([QUERY_KEY, agentId], context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, agentId] })
    },
  })

  /**
   * Bulk set : marque tous les items à `done` (utilisé pour le mode démo
   * dans le sas Premier jour). N'est PAS exposé en prod : c'est un outil
   * de démo qui ne devrait pas exister côté agent réel.
   */
  const setAll = useMutation({
    mutationFn: async (done: boolean) => {
      if (!agentId) return
      const next = D0_CHECKLIST.map((i) => ({ ...i, done }))
      const { error } = await supabase
        .from('profiles')
        .update({ activation_checklist: next })
        .eq('id', agentId)
      if (error) throw error
      return next
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, agentId] })
    },
  })

  /**
   * Marque un item comme done (idempotent : skip si déjà done). Utilisé
   * au clic sur une carte priorité du Today Premier jour pour cocher
   * l'étape correspondante sans avoir à ouvrir la pastille.
   */
  const markDone = useMutation({
    mutationFn: async (itemId: string) => {
      if (!agentId) return
      const current = query.data ?? D0_CHECKLIST
      const target = current.find((i) => i.id === itemId)
      if (!target || target.done) return current
      const next = current.map((i) =>
        i.id === itemId ? { ...i, done: true } : i,
      )
      const { error } = await supabase
        .from('profiles')
        .update({ activation_checklist: next })
        .eq('id', agentId)
      if (error) throw error
      return next
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, agentId] })
    },
  })

  const items = query.data ?? D0_CHECKLIST
  const doneCount = items.filter((i) => i.done).length
  const total = items.length
  const isComplete = doneCount === total

  return {
    items,
    doneCount,
    total,
    isComplete,
    isLoading: query.isLoading,
    toggle: (id: string) => toggle.mutate(id),
    markDone: (id: string) => markDone.mutate(id),
    setAll: (done: boolean) => setAll.mutate(done),
  }
}
