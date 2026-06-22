import { useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { FunctionsHttpError } from '@supabase/supabase-js'

type CopilotAction = 'chat' | 'summarize_contact' | 'suggest_next_action' | 'draft_email' | 'draft_description' | 'analyze_kyc' | 'score_lead' | 'analyze_market' | 'detect_intent'

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

interface CopilotApiResult {
  result: string
  conversationId: string | null
}

async function callCopilotApi(
  message: string,
  action: CopilotAction,
  context: Record<string, unknown> | undefined,
  history: ChatMessage[] | undefined,
  conversationId: string | null
): Promise<CopilotApiResult> {
  // invoke() attache automatiquement le JWT de session (Authorization) + l'apikey
  // anon — indispensable pour que l'edge function résolve l'agent (persistance des
  // conversations + personnalisation Day 0). `persist:true` : seul le chat copilote
  // demande la persistance ; les actions one-shot appellent l'edge function direct.
  const { data, error } = await supabase.functions.invoke<{
    result?: string
    conversation_id?: string | null
  }>('ai-copilot', {
    body: {
      action,
      message,
      context,
      history: history?.slice(-10),
      language: 'fr',
      conversation_id: conversationId,
      persist: true,
    },
  })

  if (error) {
    let detail = error.message
    if (error instanceof FunctionsHttpError) {
      try {
        const body = await error.context.json()
        if (body?.error) detail = body.error as string
      } catch {
        // garde le message générique
      }
    }
    throw new Error(detail)
  }

  return { result: data?.result ?? '', conversationId: data?.conversation_id ?? null }
}

/* ─── Hook ─── */

export function useCopilot() {
  const [isLoading, setIsLoading] = useState(false)
  const historyRef = useRef<ChatMessage[]>([])
  // Conversation copilote persistée (chantier B · phase 2) : id créé au 1er tour
  // par l'edge function (si le flag app_config est ON), réutilisé ensuite. null =
  // volatile (flag OFF) — la conversation reste alors en mémoire seule comme avant.
  const conversationIdRef = useRef<string | null>(null)

  const sendMessage = useCallback(async (
    message: string,
    context?: Record<string, unknown>
  ): Promise<string> => {
    const action = detectAction(message)

    setIsLoading(true)
    try {
      const { result, conversationId } = await callCopilotApi(message, action, context, historyRef.current, conversationIdRef.current)
      if (conversationId) conversationIdRef.current = conversationId

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
      const { result, conversationId } = await callCopilotApi(message, action, context, historyRef.current, conversationIdRef.current)
      if (conversationId) conversationIdRef.current = conversationId

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
    conversationIdRef.current = null
  }, [])

  // Reprendre une conversation persistée (chantier B · phase 4) : seed l'id + le
  // contexte LLM pour que les tours suivants s'ajoutent à la bonne conversation.
  const resumeConversation = useCallback((id: string, history: ChatMessage[]) => {
    conversationIdRef.current = id
    historyRef.current = history.slice(-20)
  }, [])

  return { sendMessage, sendMessageStream, isLoading, detectAction, clearHistory, resumeConversation }
}
