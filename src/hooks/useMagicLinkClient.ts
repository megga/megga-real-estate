// MEGGA — Hooks publics (côté client KYC self-service) pour le lien magique.
// Sprint 4.7.C — Pas d'auth Supabase (le client n'a pas de compte MEGGA).
// On utilise fetch direct vers les Edge functions, qui vérifient HMAC token.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { MagicLinkPublicView } from '@/types/magicLink'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// Toutes les requêtes ont besoin de la clé anon Supabase pour passer
// l'authentification d'infrastructure (avant le check HMAC interne).
const FN_HEADERS = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
}

export interface MagicLinkLoadError {
  status: number
  reason?: string
  message?: string
}

// ─── GET — Vue publique du lien (status, contact, agency, agent, uploads) ──

export function useMagicLinkClient(token: string | undefined) {
  return useQuery({
    queryKey: ['magic-link-client', token],
    queryFn: async (): Promise<MagicLinkPublicView | MagicLinkLoadError> => {
      if (!token) throw new Error('No token')
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/magic-link-get?token=${encodeURIComponent(token)}`,
        { headers: FN_HEADERS },
      )
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          reason?: string
          message?: string
        }
        return { status: res.status, ...body }
      }
      return (await res.json()) as MagicLinkPublicView
    },
    enabled: !!token,
    staleTime: 10_000,
    retry: (failureCount, error) => {
      // Pas de retry sur 401/410 (token invalide ou expiré)
      if (error instanceof Error && /HTTP (401|410|404)/.test(error.message)) return false
      return failureCount < 2
    },
  })
}

// ─── POST upload — Multipart d'une pièce ──────────────────────────────────

export interface UploadInput {
  token: string
  file: File
  type: 'identity' | 'address' | 'funds' | 'other'
}

export interface UploadResponse {
  upload_id: string
  filename: string
  size_bytes: number
  type: string
  sha256_hash: string | null
  uploaded_at: string
  status: 'received'
}

export function useMagicLinkUploadClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: UploadInput): Promise<UploadResponse> => {
      const form = new FormData()
      form.append('file', input.file)
      form.append('type', input.type)
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/magic-link-upload?token=${encodeURIComponent(input.token)}`,
        {
          method: 'POST',
          headers: FN_HEADERS,
          body: form,
        },
      )
      if (!res.ok) {
        const errBody = await res.text()
        throw new Error(`Upload failed: HTTP ${res.status} ${errBody}`)
      }
      return (await res.json()) as UploadResponse
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['magic-link-client', variables.token] })
    },
  })
}

// ─── POST confirm — Soumission finale ──────────────────────────────────────

export interface ConfirmInput {
  token: string
}

export interface ConfirmResponse {
  status: 'submitted'
  magic_link_id: string
  confirmed_at: string
  uploads_confirmed: number
  idempotent?: boolean
}

export function useMagicLinkConfirmClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: ConfirmInput): Promise<ConfirmResponse> => {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/magic-link-confirm?token=${encodeURIComponent(input.token)}`,
        {
          method: 'POST',
          headers: {
            ...FN_HEADERS,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        },
      )
      if (!res.ok) {
        const errBody = await res.text()
        throw new Error(`Confirm failed: HTTP ${res.status} ${errBody}`)
      }
      return (await res.json()) as ConfirmResponse
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['magic-link-client', variables.token] })
    },
  })
}
