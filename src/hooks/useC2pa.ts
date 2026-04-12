import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// ── Sign photos (agent action) ─────────────────────────────────────────────

interface SignResult {
  success: boolean
  propertyId: string
  results: Array<{ url: string; signed: boolean; method: string }>
  method: string
  verifiedAt: string | null
}

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

// ── Verify a single photo (public, no auth) ────────────────────────────────

interface VerifyResult {
  verified: boolean
  manifest: {
    signer: string
    signedAt: string
    claimGenerator: string
    assertions: Array<{ label: string; data: unknown }>
  } | null
  photoUrl: string
  verifiedAt: string | null
}

export function useVerifyPhoto(photoUrl: string | undefined) {
  return useQuery({
    queryKey: ['c2pa-verify', photoUrl],
    queryFn: async () => {
      if (!photoUrl) return null
      const { data, error } = await supabase.functions.invoke<VerifyResult>('c2pa-verify', {
        body: { photoUrl },
      })
      if (error) throw error
      return data as VerifyResult
    },
    enabled: !!photoUrl,
    staleTime: 1000 * 60 * 30, // Cache 30 min — la vérification ne change pas souvent
    retry: false,
  })
}

// ── Property C2PA status (simple DB query) ──────────────────────────────────

export function usePropertyC2paStatus(propertyId: string | undefined) {
  return useQuery({
    queryKey: ['c2pa-status', propertyId],
    queryFn: async () => {
      if (!propertyId) return null
      const { data, error } = await supabase
        .from('properties')
        .select('c2pa_verified, c2pa_verified_at')
        .eq('id', propertyId)
        .single()
      if (error) throw error
      return data as { c2pa_verified: boolean; c2pa_verified_at: string | null }
    },
    enabled: !!propertyId,
  })
}
