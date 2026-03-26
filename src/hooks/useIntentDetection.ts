import { useMutation } from '@tanstack/react-query'

// ── Types ──

export type MessageIntent = 'strong_interest' | 'objection' | 'urgency' | 'disinterest' | 'question' | 'neutral'

export interface IntentResult {
  intent: MessageIntent
  confidence: number
  summary: string
  suggested_action: string
  keywords: string[]
}

// ── Intent labels and colors ──

export const INTENT_CONFIG: Record<MessageIntent, { label: string; color: string; emoji: string }> = {
  strong_interest: { label: 'Intérêt fort', color: 'text-emerald-500', emoji: '🔥' },
  objection: { label: 'Objection', color: 'text-amber-500', emoji: '⚠️' },
  urgency: { label: 'Urgence', color: 'text-red-500', emoji: '⏰' },
  disinterest: { label: 'Désintérêt', color: 'text-theme-muted', emoji: '💤' },
  question: { label: 'Question', color: 'text-blue-500', emoji: '❓' },
  neutral: { label: 'Neutre', color: 'text-theme-tertiary', emoji: '—' },
}

// ── Hook ──

export function useIntentDetection() {
  const mutation = useMutation({
    mutationFn: async (messageContent: string): Promise<IntentResult> => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

      const response = await fetch(`${supabaseUrl}/functions/v1/ai-copilot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          action: 'detect_intent',
          message: messageContent,
          language: 'fr',
        }),
      })

      if (!response.ok) {
        throw new Error('Intent detection failed')
      }

      const data = await response.json()

      // Parse JSON from the AI response
      try {
        const result = typeof data.result === 'string' ? JSON.parse(data.result) : data.result
        return result as IntentResult
      } catch {
        // If parsing fails, return a neutral intent
        return {
          intent: 'neutral',
          confidence: 0,
          summary: data.result || 'Analyse impossible',
          suggested_action: 'Lire le message',
          keywords: [],
        }
      }
    },
  })

  return {
    detectIntent: mutation.mutateAsync,
    isDetecting: mutation.isPending,
    lastResult: mutation.data ?? null,
  }
}

/**
 * Quick local intent detection (no API call).
 * Used for instant badge display before AI confirmation.
 */
export function detectIntentLocal(message: string): { intent: MessageIntent; confidence: number } {
  const lower = message.toLowerCase()

  // Strong interest patterns
  if (/quand.*visit|j'aimerais.*voir|très.*intéress|je.*prends|on signe|parfait|exactement.*cherch/i.test(lower)) {
    return { intent: 'strong_interest', confidence: 75 }
  }

  // Objection patterns
  if (/trop.*cher|trop.*petit|bruit|sombre|pas.*convain|hésit|réfléchir|pas sûr/i.test(lower)) {
    return { intent: 'objection', confidence: 70 }
  }

  // Urgency patterns
  if (/urgent|vite|rapidement|bail.*termine|deadline|dès que possible|asap/i.test(lower)) {
    return { intent: 'urgency', confidence: 80 }
  }

  // Disinterest patterns
  if (/pas.*intéress|plus.*besoin|trouvé.*autre|annuler|on.*arrête|non merci/i.test(lower)) {
    return { intent: 'disinterest', confidence: 75 }
  }

  // Question patterns
  if (/\?|combien|quel|comment|pourquoi|quand|où|est-ce que/i.test(lower)) {
    return { intent: 'question', confidence: 60 }
  }

  return { intent: 'neutral', confidence: 50 }
}
