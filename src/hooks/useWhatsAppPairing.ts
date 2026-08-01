// src/hooks/useWhatsAppPairing.ts
// Statut du lien WhatsApp de l'agent courant + génération d'un code d'appairage.
// RLS : l'agent ne voit que sa propre ligne (policy wa_agent_links_self).

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface WhatsAppLinkStatus {
  verified: boolean
  wa_number: string | null
  pairing_code: string | null
  pairing_expires_at: string | null
}

/**
 * Statut du lien WhatsApp de l'agent (`status`) + génération d'un code d'appairage
 * (`generateCode`, RPC `generate_whatsapp_pairing_code`). Un succès invalide le statut.
 */
export function useWhatsAppPairing() {
  const qc = useQueryClient()

  const status = useQuery({
    queryKey: ['whatsapp-agent-link'],
    staleTime: 10_000,
    queryFn: async (): Promise<WhatsAppLinkStatus | null> => {
      const { data, error } = await supabase
        .from('whatsapp_agent_links')
        .select('verified, wa_number, pairing_code, pairing_expires_at')
        .maybeSingle()
      if (error) throw error
      return (data as WhatsAppLinkStatus | null) ?? null
    },
  })

  const generateCode = useMutation({
    mutationFn: async (): Promise<string> => {
      const { data, error } = await supabase.rpc('generate_whatsapp_pairing_code')
      if (error) throw error
      return (data as string) ?? ''
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['whatsapp-agent-link'] }) },
  })

  return { status, generateCode }
}
