// MEGGA — Hooks React Query pour le module KYC Magic Link (Sprint 4.7)

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type {
  CreateMagicLinkInput,
  CreateMagicLinkResponse,
} from '@/types/magicLink'

// ─── Liste des liens magiques d'un dossier KYC (vue agent) ─────────────────
// ─── Créer un lien magique (auth agent → Edge function) ────────────────────

/**
 * Crée un lien magique KYC via l'Edge function `magic-link-create` (auth agent).
 * Invalide la liste des liens, le dossier et l'audit trail au succès.
 */
export function useCreateMagicLink() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateMagicLinkInput) => {
      const { data, error } = await supabase.functions.invoke('magic-link-create', {
        body: input,
      })
      if (error) throw error
      return data as CreateMagicLinkResponse
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['kyc-magic-links', variables.kyc_case_id] })
      queryClient.invalidateQueries({ queryKey: ['kyc-case', variables.kyc_case_id] })
      queryClient.invalidateQueries({ queryKey: ['kyc-audit', variables.kyc_case_id] })
    },
  })
}

// ─── Régénérer un lien (nouveau token, ancien invalidé) ────────────────────
