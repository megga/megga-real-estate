import { useState, useCallback, useRef } from 'react'

type CopilotAction = 'chat' | 'summarize_contact' | 'suggest_next_action' | 'draft_email' | 'draft_description' | 'analyze_kyc' | 'score_lead' | 'analyze_market' | 'detect_intent'

interface CopilotResponse {
  result: string
  action: string
  usage?: { input_tokens: number; output_tokens: number }
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/* ─── Action detection from natural language ─── */

function detectAction(message: string): CopilotAction {
  const lower = message.toLowerCase()
  if (/résumé|résume|profil|qui est|fiche/.test(lower)) return 'summarize_contact'
  if (/relance|rédige.*email|rédige.*message|écrire|mail/.test(lower)) return 'draft_email'
  if (/annonce|description|listing|rédige.*annonce/.test(lower)) return 'draft_description'
  if (/kyc|conformité|dossier|lab|blanchiment/.test(lower)) return 'analyze_kyc'
  if (/score|qualif|lead|chaud|froid|sérieux/.test(lower)) return 'score_lead'
  if (/actions|prochaines|priorité|que faire|next/.test(lower)) return 'suggest_next_action'
  if (/marché|positionnement|comparable|prix.*m2|prix.*m²|concurrence|stagnation/.test(lower)) return 'analyze_market'
  return 'chat'
}

/* ─── Call Edge Function ─── */

async function callCopilotApi(
  message: string,
  action: CopilotAction,
  context?: Record<string, unknown>,
  history?: ChatMessage[]
): Promise<string> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

  const response = await fetch(`${supabaseUrl}/functions/v1/ai-copilot`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({
      action,
      message,
      context,
      history: history?.slice(-10),
      language: 'fr',
    }),
  })

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}))
    throw new Error(errData.error || `Erreur ${response.status}`)
  }

  const data: CopilotResponse = await response.json()
  return data.result
}

/* ─── Hook ─── */

export function useCopilot() {
  const [isLoading, setIsLoading] = useState(false)
  const historyRef = useRef<ChatMessage[]>([])

  const sendMessage = useCallback(async (
    message: string,
    context?: Record<string, unknown>
  ): Promise<string> => {
    const action = detectAction(message)

    setIsLoading(true)
    try {
      const result = await callCopilotApi(message, action, context, historyRef.current)

      // Update history
      const userMsg: ChatMessage = { role: 'user', content: message }
      const assistantMsg: ChatMessage = { role: 'assistant', content: result }
      historyRef.current = [...historyRef.current, userMsg, assistantMsg].slice(-20)

      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue'
      return `⚠️ ${errorMessage}\n\n*Vérifiez la connexion ou réessayez.*`
    } finally {
      setIsLoading(false)
    }
  }, [])

  const sendMessageStream = useCallback(async (
    message: string,
    context: Record<string, unknown> | undefined,
    onChunk: (chunk: string) => void
  ): Promise<void> => {
    const action = detectAction(message)

    setIsLoading(true)
    try {
      const result = await callCopilotApi(message, action, context, historyRef.current)

      // Update history
      const userMsg: ChatMessage = { role: 'user', content: message }
      const assistantMsg: ChatMessage = { role: 'assistant', content: result }
      historyRef.current = [...historyRef.current, userMsg, assistantMsg].slice(-20)

      // Stream word by word — natural typing rhythm
      const words = result.split(' ')
      for (let i = 0; i < words.length; i++) {
        const word = (i === 0 ? '' : ' ') + words[i]
        onChunk(word)

        // Variable delay for natural feel
        let delay = 30 + Math.random() * 25 // base: 30-55ms per word
        // Longer pause after punctuation (sentence ends)
        if (/[.!?:]\s*$/.test(word)) delay += 120 + Math.random() * 80
        // Medium pause after commas
        else if (/,\s*$/.test(word)) delay += 40 + Math.random() * 30
        // Slight pause after line breaks
        else if (word.includes('\n')) delay += 60
        // Faster for short common words
        else if (word.trim().length <= 2) delay = 20 + Math.random() * 15

        await new Promise(resolve => setTimeout(resolve, delay))
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue'
      onChunk(`⚠️ ${errorMessage}`)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const clearHistory = useCallback(() => {
    historyRef.current = []
  }, [])

  return { sendMessage, sendMessageStream, isLoading, detectAction, clearHistory }
}
