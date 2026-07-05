// src/hooks/useWhatsAppMessages.ts
// Lecture seule (Phase 1) des messages WhatsApp d'un contact. La RLS garantit
// le cloisonnement par agence — le hook ne fait aucun filtre tenant côté client.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
  delivery_error: string | null
  wa_timestamp: string | null
  transcript: string | null
  transcript_lang: string | null
  processing_status: 'pending' | 'processing' | 'done' | 'failed' | 'skipped'
}

export function useWhatsAppMessages(contactId: string | undefined) {
  return useQuery({
    queryKey: ['whatsapp-messages', contactId],
    enabled: !!contactId,
    staleTime: 30_000,
    queryFn: async (): Promise<WhatsAppMessageRow[]> => {
      // Les 50 messages les PLUS RÉCENTS (index contact_id, created_at DESC), pas tout le fil :
      // un contact actif peut avoir des centaines de messages, transcript OCR jusqu'à 6 Ko/ligne.
      // On ré-ordonne ensuite du plus ancien au plus récent pour l'affichage timeline.
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('id, created_at, direction, wa_from, wa_to, body, media_type, media_url, status, delivery_error, wa_timestamp, transcript, transcript_lang, processing_status')
        .eq('contact_id', contactId!)
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return ((data ?? []) as WhatsAppMessageRow[]).reverse()
    },
  })
}

export function useSendWhatsAppMessage(contactId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: string) => {
      const { data, error } = await supabase.functions.invoke('whatsapp-send', {
        body: { contactId, body },
      })
      if (error) throw error
      if (data && (data as { error?: string }).error) throw new Error((data as { error: string }).error)
      return data as { ok: boolean; providerMessageId: string | null }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['whatsapp-messages', contactId] })
    },
  })
}
