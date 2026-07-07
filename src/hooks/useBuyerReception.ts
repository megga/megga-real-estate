// Réception acheteur — accès données (page publique par token, sans compte).
// Appelle les edge functions buyer-reception-get / -react (token strict, service_role).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type ReceptionTx = 'vente' | 'location'

export interface ReceptionBien {
  match_id: string
  status: string           // 'sent' | 'interested' | 'rejected' | …
  reaction_motif: string | null
  title: string
  quartier: string | null
  addr: string
  transaction: ReceptionTx
  price: number | null
  rent: number | null
  rooms: number | null
  area: number | null
  floor: number | null
  year: number | null
  charges: number | null
  price_per_m2: number | null
  features: string[]
  desc: string | null
  photos: string[]
}

export interface ReceptionData {
  ok: boolean
  reason?: 'invalid' | 'expired'
  status?: string
  contact: { firstName: string }
  agent: { name: string; phone: string | null; avatar: string | null; agency: string | null } | null
  items: ReceptionBien[]
}

/** Charge la sélection transmise à l'acheteur (edge buyer-reception-get). */
export function useBuyerReception(token: string | undefined) {
  return useQuery<ReceptionData>({
    queryKey: ['buyer-reception', token],
    enabled: !!token,
    retry: false,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('buyer-reception-get', { body: { token } })
      if (error) throw error
      return data as ReceptionData
    },
  })
}

export interface ReactInput {
  token: string
  matchId: string
  reaction: 'interested' | 'rejected'
  motif?: string | null
  note?: string | null
}

/** Enregistre une réaction acheteur (edge buyer-reception-react) + invalide le cache. */
export function useBuyerReactionMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ token, matchId, reaction, motif, note }: ReactInput) => {
      const { data, error } = await supabase.functions.invoke('buyer-reception-react', {
        body: { token, match_id: matchId, reaction, motif: motif ?? null, note: note ?? null },
      })
      if (error) throw error
      return data as { ok: boolean }
    },
    onSuccess: (_d, vars) => { qc.invalidateQueries({ queryKey: ['buyer-reception', vars.token] }) },
  })
}
