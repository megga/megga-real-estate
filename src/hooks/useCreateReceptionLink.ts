// Crée un lien de réception privé pour une sélection de matches (edge
// buyer-reception-create), à partager par WhatsApp / lien copié. Zéro email.

import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface CreateReceptionInput {
  contactId: string
  matchIds: string[]
  channel?: 'whatsapp' | 'link'
}
export interface ReceptionLink {
  token: string
  linkId: string
  expiresAt: string
  /** URL publique (même origine que le CRM) */
  url: string
}

export function useCreateReceptionLink() {
  return useMutation({
    mutationFn: async ({ contactId, matchIds, channel }: CreateReceptionInput): Promise<ReceptionLink> => {
      const { data, error } = await supabase.functions.invoke('buyer-reception-create', {
        body: { contact_id: contactId, match_ids: matchIds, channel: channel ?? 'link' },
      })
      if (error) throw error
      const d = data as { ok?: boolean; token?: string; linkId?: string; expiresAt?: string; error?: string }
      if (!d?.ok || !d.token) throw new Error(d?.error || 'reception_create_failed')
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      return { token: d.token, linkId: d.linkId ?? '', expiresAt: d.expiresAt ?? '', url: `${origin}/reception/${d.token}` }
    },
  })
}
