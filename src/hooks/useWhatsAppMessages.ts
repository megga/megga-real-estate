// src/hooks/useWhatsAppMessages.ts
// Lecture seule (Phase 1) des messages WhatsApp d'un contact. La RLS garantit
// le cloisonnement par agence — le hook ne fait aucun filtre tenant côté client.

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface WhatsAppMessageRow {
  id: string
  created_at: string
  direction: 'inbound' | 'outbound'
  wa_from: string
  wa_to: string | null
  body: string | null
  media_type: string | null
  media_url: string | null
  status: string
  wa_timestamp: string | null
}

export function useWhatsAppMessages(contactId: string | undefined) {
  return useQuery({
    queryKey: ['whatsapp-messages', contactId],
    enabled: !!contactId,
    staleTime: 30_000,
    queryFn: async (): Promise<WhatsAppMessageRow[]> => {
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('id, created_at, direction, wa_from, wa_to, body, media_type, media_url, status, wa_timestamp')
        .eq('contact_id', contactId!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as WhatsAppMessageRow[]
    },
  })
}
