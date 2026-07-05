// src/hooks/useFollowupSuggestions.ts
// Suivis suggérés par MEGGA depuis WhatsApp (engagements actionnables). Lecture +
// accept (RPC → crée un vrai rappel) + dismiss. RLS par agence
// (wa_followups_agency_select / _update). Human-in-the-loop : rien n'est créé sans
// le clic de l'agent.
//
// La table whatsapp_followup_suggestions n'est pas encore dans les types générés
// (database.ts est en retard sur la prod) → on cible la table via un client non
// typé (cast localisé) tout en typant fortement les entrées/sorties.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

const db = supabase as unknown as SupabaseClient

export type FollowupKind = 'commitment' | 'next_action' | 'client_availability'

export interface FollowupSuggestionRow {
  id: string
  contact_id: string
  action: string
  due_at: string | null
  kind: FollowupKind
  status: 'suggested' | 'accepted' | 'dismissed'
  created_at: string
}

const KEY = (contactId?: string) => ['whatsapp-followups', contactId]

export function useFollowupSuggestions(contactId: string | undefined) {
  return useQuery({
    queryKey: KEY(contactId),
    enabled: !!contactId,
    staleTime: 30_000,
    queryFn: async (): Promise<FollowupSuggestionRow[]> => {
      const res = await db
        .from('whatsapp_followup_suggestions')
        .select('id, contact_id, action, due_at, kind, status, created_at')
        .eq('contact_id', contactId!)
        .eq('status', 'suggested')
        .order('due_at', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
      const { data, error } = res as unknown as { data: FollowupSuggestionRow[] | null; error: { message: string } | null }
      if (error) throw new Error(error.message)
      return data ?? []
    },
  })
}

/** Accept (→ rappel) et dismiss, avec invalidation de la liste du contact. */
export function useFollowupActions(contactId: string | undefined) {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: KEY(contactId) })
    // La surface cockpit agrège les suivis de toute l'agence (useAgencyFollowupSuggestions,
    // clé ['wa-agency-followups', …]) : accepter/écarter ici doit la rafraîchir aussi,
    // sinon le bandeau « Aujourd'hui » ré-affiche un suivi déjà traité (préfixe = toutes limites).
    qc.invalidateQueries({ queryKey: ['wa-agency-followups'] })
  }

  const accept = useMutation({
    mutationFn: async (id: string) => {
      const res = await db.rpc('accept_followup_suggestion', { p_id: id })
      const { error } = res as unknown as { error: { message: string } | null }
      if (error) throw new Error(error.message)
    },
    onSuccess: invalidate,
  })

  const dismiss = useMutation({
    mutationFn: async (id: string) => {
      const res = await db
        .from('whatsapp_followup_suggestions')
        .update({ status: 'dismissed' })
        .eq('id', id)
      const { error } = res as unknown as { error: { message: string } | null }
      if (error) throw new Error(error.message)
    },
    onSuccess: invalidate,
  })

  return { accept, dismiss }
}
