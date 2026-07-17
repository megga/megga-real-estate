/**
 * Hooks C2PA — provenance/authenticité des photos de biens.
 *
 * `useSignPhotos` appose les Content Credentials (C2PA) sur les photos d'un bien
 * via l'Edge Function `c2pa-sign` (signature = action agent explicite).
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// ── Sign photos (agent action) ─────────────────────────────────────────────

interface SignResult {
  success: boolean
  propertyId: string
  results: Array<{ url: string; signed: boolean; method: string }>
  method: string
  verifiedAt: string | null
}

/** Signe les photos d'un bien (Content Credentials C2PA) ; invalide le bien et la liste d'agence au succès. */
export function useSignPhotos() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ propertyId, photoUrls }: { propertyId: string; photoUrls: string[] }) => {
      const { data, error } = await supabase.functions.invoke<SignResult>('c2pa-sign', {
        body: { propertyId, photoUrls },
      })
      if (error) throw error
      if (data && 'error' in data) throw new Error((data as unknown as { error: string }).error)
      return data as SignResult
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['property', variables.propertyId] })
      queryClient.invalidateQueries({ queryKey: ['agency-properties'] })
    },
  })
}


// ── Property C2PA status (simple DB query) ──────────────────────────────────
