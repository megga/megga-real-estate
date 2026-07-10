// src/hooks/useConversationInsight.ts
// Lecture seule de l'insight MEGGA d'un contact (L2). RLS par agence
// (policy wa_insights_agency_select). Contrat de données pour la carte
// « Compréhension MEGGA » côté front (Julien).

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface ConversationInsightRow {
  contact_id: string
  summary: string | null
  intent: string | null
  entities: Record<string, unknown>
  commitments: string[]
  objections: string[]
  sentiment: 'positif' | 'neutre' | 'tendu' | null
  urgency: 'haute' | 'moyenne' | 'faible' | null
  language: 'fr' | 'de' | 'en' | 'it' | null
  next_action: { type: string; label: string } | null
  source_message_count: number
  generated_at: string
}

export function useConversationInsight(contactId: string | undefined) {
  return useQuery({
    queryKey: ['whatsapp-insight', contactId],
    enabled: !!contactId,
    staleTime: 30_000,
    queryFn: async (): Promise<ConversationInsightRow | null> => {
      const { data, error } = await supabase
        .from('whatsapp_conversation_insights')
        .select('contact_id, summary, intent, entities, commitments, objections, sentiment, urgency, language, next_action, source_message_count, generated_at')
        .eq('contact_id', contactId!)
        .maybeSingle()
      if (error) throw error
      // jsonb (entities/commitments/next_action) typés Json en base → cast au contrat.
      return (data as unknown as ConversationInsightRow | null) ?? null
    },
  })
}
