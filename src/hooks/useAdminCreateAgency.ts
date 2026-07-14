// P8b — Création d'agence depuis l'admin (RPC admin_create_agency, auditée).
// N'attache PAS l'appelant ; le propriétaire est invité séparément.

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface CreateAgencyInput {
  name: string
  city?: string
  canton?: string
  plan?: string
  solo?: boolean
  note?: string
}

export function useAdminCreateAgency() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateAgencyInput): Promise<string> => {
      const { data, error } = await supabase.rpc('admin_create_agency', {
        p_name: input.name,
        p_city: input.city || undefined,
        p_canton: input.canton || undefined,
        p_plan: input.plan || 'starter',
        p_solo: input.solo ?? false,
        p_note: input.note || undefined,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-agencies'] }),
  })
}
