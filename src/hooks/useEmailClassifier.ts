// MEGGA Tier 3 mail — Hook pour classifier un email via Claude API.
// Appelle l'Edge Function email-classifier qui :
//  - Vérifie le cache 24h (évite re-spending tokens)
//  - Sinon classifie via Claude et persiste dans email_messages_cache
//
// Coût indicatif par classification : ~1200 tokens (Sonnet 4.7) ≈ $0.005

import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type EmailClassification =
  | 'lead_chaud'
  | 'lead_tiede'
  | 'question_simple'
  | 'spam'
  | 'interne'

export interface SuggestedReply {
  label: string
  body: string
}

export interface ClassifierResult {
  classification: EmailClassification
  priority: number
  intents: string[]
  suggested_replies: SuggestedReply[]
  cached: boolean
}

interface ClassifyParams {
  provider: 'gmail' | 'outlook'
  external_message_id: string
  from_address: string
  from_name?: string
  subject: string
  snippet: string
  body_text?: string
}

export function useEmailClassifier() {
  const mutation = useMutation({
    mutationFn: async (params: ClassifyParams): Promise<ClassifierResult> => {
      const res = await supabase.functions.invoke('email-classifier', {
        body: params,
      })
      if (res.error) throw new Error(res.error.message)
      return res.data as ClassifierResult
    },
  })

  return {
    classify: mutation.mutateAsync,
    isClassifying: mutation.isPending,
    error: mutation.error,
  }
}

// Helpers UI partagés pour le rendu des classifications

export function classificationLabel(c: EmailClassification): string {
  switch (c) {
    case 'lead_chaud': return 'Lead chaud'
    case 'lead_tiede': return 'Lead tiède'
    case 'question_simple': return 'Question simple'
    case 'spam': return 'Spam'
    case 'interne': return 'Interne'
  }
}

export function classificationColor(c: EmailClassification): { bg: string; ink: string } {
  switch (c) {
    case 'lead_chaud': return { bg: '#FEE2E2', ink: '#B91C1C' }
    case 'lead_tiede': return { bg: '#FEF3C7', ink: '#92400E' }
    case 'question_simple': return { bg: '#DBEAFE', ink: '#1E40AF' }
    case 'spam': return { bg: '#E5E7EB', ink: '#6B7280' }
    case 'interne': return { bg: '#E0F2FE', ink: '#075985' }
  }
}

const INTENT_LABELS: Record<string, string> = {
  request_visit: 'Demande de visite',
  ask_price: 'Question prix',
  ask_documents: 'Demande de documents',
  negative_signal: 'Signal négatif',
  reschedule: 'Re-planification',
  accept_offer: 'Acceptation offre',
  decline_offer: 'Refus offre',
  propose_counter_offer: 'Contre-offre',
  ask_features: 'Question caractéristiques',
  general_inquiry: 'Demande générale',
}

export function intentLabel(intent: string): string {
  return INTENT_LABELS[intent] ?? intent
}
