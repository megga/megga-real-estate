// MEGGA — Hooks React Query pour le module KYC Magic Link (Sprint 4.7)

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type {
  CreateMagicLinkInput,
  CreateMagicLinkResponse,
  KycMagicLinkSummary,
  RegenerateMagicLinkInput,
} from '@/types/magicLink'

// ─── Liste des liens magiques d'un dossier KYC (vue agent) ─────────────────

export function useKycMagicLinks(kycCaseId: string | undefined) {
  return useQuery({
    queryKey: ['kyc-magic-links', kycCaseId],
    queryFn: async () => {
      if (!kycCaseId) return []
      const { data, error } = await supabase.rpc('kyc_magic_link_summary', {
        p_kyc_case_id: kycCaseId,
      })
      if (error) throw error
      return (data ?? []) as KycMagicLinkSummary[]
    },
    enabled: !!kycCaseId,
    staleTime: 30_000, // 30s — pas besoin de re-fetch trop souvent
  })
}

// ─── Créer un lien magique (auth agent → Edge function) ────────────────────

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

export function useRegenerateMagicLink(kycCaseId?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: RegenerateMagicLinkInput) => {
      const { data, error } = await supabase.functions.invoke('magic-link-regenerate', {
        body: input,
      })
      if (error) throw error
      return data as CreateMagicLinkResponse
    },
    onSuccess: () => {
      if (kycCaseId) {
        queryClient.invalidateQueries({ queryKey: ['kyc-magic-links', kycCaseId] })
        queryClient.invalidateQueries({ queryKey: ['kyc-audit', kycCaseId] })
      }
    },
  })
}
