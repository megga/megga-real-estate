// Hook front pour l'edge function `sign-document` (backend e-signature, PR #597).
// Couvre tout le cycle : connexion provider (Skribble/DocuSign), liste des
// connexions, et — pour les phases 2/3 — création/suivi/annulation d'une
// signature. L'auth (Bearer JWT) est portée automatiquement par
// supabase.functions.invoke quand une session existe.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export type EsignProviderId = 'skribble' | 'docusign'
export type SignatureQuality = 'SES' | 'AES' | 'QES'
export type Legislation = 'ZERTES' | 'EIDAS'

export interface EsignConnection {
  id: string
  provider: EsignProviderId
  display_name: string | null
  environment: string
  default_quality: string
  default_legislation: string
  is_active: boolean
  status: 'connected' | 'error' | 'disconnected'
  connected_at: string
}

export interface EsignSignerInput {
  email: string
  first_name?: string
  last_name?: string
  name?: string
  mobile?: string
  language?: string
  sequence?: number
}

export interface ConnectProviderInput {
  provider: EsignProviderId
  credentials: Record<string, unknown>
  config?: Record<string, unknown>
  default_quality?: SignatureQuality
  default_legislation?: Legislation
  environment?: 'sandbox' | 'production'
}

export interface CreateSignatureInput {
  pdf_base64: string
  title: string
  signers: EsignSignerInput[]
  document_id?: string
  context_type?: string
  context_id?: string
  quality?: SignatureQuality
  legislation?: Legislation
  message?: string
  provider?: EsignProviderId
  notify?: boolean
}

export interface CreateSignatureResult {
  signature_request_id: string
  status: string
  signing_url: string | null
  signers: { email: string; signingUrl: string | null; statusCode: string | null }[]
}

// Appel générique de l'edge function. Surface le VRAI message d'erreur métier
// (ex. « Clé Skribble refusée ») même quand la fonction répond en non-2xx :
// supabase.functions.invoke met alors error.message à un texte générique, mais
// le corps JSON {error} reste lisible via error.context.
async function callSignDocument<T = unknown>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await supabase.functions.invoke('sign-document', {
    body: { action, ...payload },
  })
  if (error) {
    let message = error.message
    const ctx = (error as { context?: Response }).context
    if (ctx && typeof ctx.json === 'function') {
      try {
        const body = (await ctx.json()) as { error?: string }
        if (body?.error) message = body.error
      } catch {
        /* corps non-JSON — on garde le message générique */
      }
    }
    throw new Error(message)
  }
  const d = data as { error?: string } | null
  if (d && d.error) throw new Error(d.error)
  return data as T
}

export function useEsignSignature() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const connectionsQuery = useQuery({
    queryKey: ['esign-connections', user?.id],
    queryFn: () =>
      callSignDocument<{ connections: EsignConnection[] }>('list').then((d) => d.connections ?? []),
    enabled: !!user?.id,
    staleTime: 60 * 1000,
  })

  const connectMutation = useMutation({
    mutationFn: (vars: ConnectProviderInput) =>
      callSignDocument('connect_provider', vars as unknown as Record<string, unknown>),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['esign-connections'] }),
  })

  const disconnectMutation = useMutation({
    mutationFn: (vars: { provider: EsignProviderId }) =>
      callSignDocument('disconnect_provider', vars),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['esign-connections'] }),
  })

  const createMutation = useMutation({
    mutationFn: (vars: CreateSignatureInput) =>
      callSignDocument<CreateSignatureResult>('create', vars as unknown as Record<string, unknown>),
  })

  const connections = connectionsQuery.data ?? []
  const getConnection = (provider: EsignProviderId) =>
    connections.find((c) => c.provider === provider && c.status === 'connected')

  return {
    connections,
    isLoading: connectionsQuery.isLoading,
    getConnection,
    hasActiveProvider: connections.some((c) => c.status === 'connected' && c.is_active),

    connect: connectMutation.mutateAsync,
    isConnecting: connectMutation.isPending,
    disconnect: disconnectMutation.mutateAsync,
    isDisconnecting: disconnectMutation.isPending,

    // Phases 2/3 : création + suivi d'une demande de signature.
    createSignature: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    getSignatureStatus: (signatureRequestId: string) =>
      callSignDocument<{ status: string; finalized?: boolean }>('status', {
        signature_request_id: signatureRequestId,
      }),
    cancelSignature: (signatureRequestId: string, reason?: string) =>
      callSignDocument('cancel', { signature_request_id: signatureRequestId, reason }),
  }
}
