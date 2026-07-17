// MEGGA CRM — Learned communication styles admin hook (Learning Slice 1, Task 7).
// Reads from RPC `get_agent_learned_styles` (returns only rows WHERE learned_style IS NOT NULL).
// Mutates via RPC `set_agent_learned_style` — both RPCs are is_super_admin()-guarded server-side.
// MEGGA observes & distils a style; the super-admin reviews and explicitly activates it.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface LearnedStyleRow {
  agent_id: string
  agent_name: string | null
  agency_id: string | null
  learned_style: {
    language: string
    formality: string
    emoji: boolean
    traits: string
    status: string
    updated_at: string
    sample_count: number
  } | null
}

/** File les styles de communication appris par agent (RPC `get_agent_learned_styles`, lignes non-nulles seulement). */
export function useAdminLearning() {
  return useQuery({
    queryKey: ['admin', 'learned-styles'],
    queryFn: async (): Promise<LearnedStyleRow[]> => {
      const { data, error } = await (supabase.rpc as unknown as
        (fn: string) => Promise<{ data: unknown; error: Error | null }>)('get_agent_learned_styles')
      if (error) throw error
      return (data ?? []) as LearnedStyleRow[]
    },
    staleTime: 60_000,
  })
}

/** Active ou révise un style appris (RPC `set_agent_learned_style`) ; le super-admin valide explicitement avant mise en production. */
export function useSetLearnedStyle() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { agent_id: string; status: string; traits?: string }) => {
      const { error } = await (supabase.rpc as unknown as
        (fn: string, args: unknown) => Promise<{ error: Error | null }>)('set_agent_learned_style', {
          p_agent_id: v.agent_id,
          p_status: v.status,
          p_traits: v.traits ?? null,
        })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'learned-styles'] }) },
  })
}
