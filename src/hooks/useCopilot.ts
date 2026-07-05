import { useState, useCallback, useRef } from 'react'
import { supabase, SUPABASE_FUNCTIONS_URL, SUPABASE_PUBLIC_ANON_KEY } from '@/lib/supabase'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { toolPhaseLabel } from '@/components/ai-copilot/panel/aiPanel'

type CopilotAction = 'chat' | 'summarize_contact' | 'suggest_next_action' | 'draft_email' | 'draft_description' | 'analyze_kyc' | 'score_lead' | 'analyze_market' | 'detect_intent'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/** Callbacks du streaming copilote. `onDelta` reçoit un fragment de texte à
 *  APPENDRE ; `onReset` vide le texte accumulé (rare : des tokens ont été émis
 *  puis un appel d'outil est survenu) ; `onPhase` reçoit le libellé humain de
 *  l'outil en cours (null = plus d'outil en cours) ; `onFinal` remplace le texte
 *  accumulé par la version normalisée finale (meggaProse côté serveur). */
/** Carte de validation d'une action de publication en attente (HITL). Émise par le
 *  serveur quand le modèle a PRÉPARÉ une publication/retrait ; le panneau ouvre une
 *  modale d'aperçu et n'exécute rien tant que l'agent ne valide pas. */
export interface PendingActionCard {
  id: string
  kind: string          // 'publish' | 'withdraw'
  title: string | null
  portals: string[]
  preview: string
}

export interface CopilotStreamHandlers {
  onDelta: (text: string) => void
  onReset?: () => void
  onPhase?: (label: string | null) => void
  onFinal?: (text: string) => void
  /** Carte de publication à valider (0 ou 1 par tour). */
  onPendingAction?: (pending: PendingActionCard) => void
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

/* ─── Call Edge Function (JSON, one-shot) ─── */

interface CopilotApiResult {
  result: string
  conversationId: string | null
  pendingAction: PendingActionCard | null
}

async function callCopilotApi(
  message: string,
  action: CopilotAction,
  context: Record<string, unknown> | undefined,
  history: ChatMessage[] | undefined,
  conversationId: string | null
): Promise<CopilotApiResult> {
  const { data, error } = await supabase.functions.invoke<{
    result?: string
    conversation_id?: string | null
    pending_action?: PendingActionCard | null
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

  return { result: data?.result ?? '', conversationId: data?.conversation_id ?? null, pendingAction: data?.pending_action ?? null }
}

/* ─── SSE stream (real token + tool phase streaming) ─── */

interface StreamOutcome {
  text: string
  conversationId: string | null
}

async function streamCopilotApi(
  message: string,
  action: CopilotAction,
  context: Record<string, unknown> | undefined,
  history: ChatMessage[] | undefined,
  conversationId: string | null,
  handlers: CopilotStreamHandlers,
): Promise<StreamOutcome> {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) throw new Error('Session expirée, reconnectez-vous.')

  // Garde-fous connexion (revue adverse) : AbortController + timeout d'inactivité.
  // Sans ça, une connexion half-open laisse reader.read() pendre indéfiniment →
  // isLoading bloqué à true → composer désactivé pour toujours. Le timer est
  // réarmé à chaque octet reçu (tokens ET événements d'outil), et large (75s)
  // pour tolérer une consultation d'outil + une inférence DeepSeek (cap serveur 60s).
  const ac = new AbortController()
  const INACTIVITY_MS = 75_000
  let idleTimer: ReturnType<typeof setTimeout> | undefined
  const armIdle = () => {
    if (idleTimer) clearTimeout(idleTimer)
    idleTimer = setTimeout(() => ac.abort(), INACTIVITY_MS)
  }

  const resp = await fetch(`${SUPABASE_FUNCTIONS_URL}/ai-copilot`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_PUBLIC_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      action, message, context,
      history: history?.slice(-10),
      language: 'fr',
      conversation_id: conversationId,
      persist: true,
      stream: true,
    }),
    signal: ac.signal,
  })

  if (!resp.ok || !resp.body) {
    let detail = `Erreur ${resp.status}`
    try { const j = await resp.json(); if (j?.error) detail = j.error as string } catch { /* garde */ }
    throw new Error(detail)
  }

  const reader = resp.body.getReader()
  const td = new TextDecoder()
  let buffer = ''
  let acc = ''
  // Boîte mutable (pas un `let`) : `finalText`/`convId` ne sont assignés que dans
  // la closure handleEvent. Sur un `let`, l'analyse de flux TS ne « voit » pas ces
  // assignations et fige le type à `null` (puis `never` après le null-check). Une
  // propriété d'objet, elle, est ré-élargie à son type déclaré après tout appel de
  // fonction → le narrowing du garde `if (box.final == null)` fonctionne ensuite.
  const box: { final: string | null; convId: string | null } = { final: null, convId: null }

  const handleEvent = (ev: Record<string, unknown>) => {
    switch (ev.type) {
      case 'token':
        acc += String(ev.t ?? '')
        handlers.onDelta(String(ev.t ?? ''))
        break
      case 'reset':
        acc = ''
        handlers.onReset?.()
        break
      case 'tool_start':
        handlers.onPhase?.(toolPhaseLabel(String(ev.name ?? '')))
        break
      case 'tool_end':
        handlers.onPhase?.(null)
        break
      case 'pending_action':
        handlers.onPendingAction?.({
          id: String(ev.id ?? ''),
          kind: String(ev.kind ?? 'publish'),
          title: (ev.title as string | null) ?? null,
          portals: Array.isArray(ev.portals) ? (ev.portals as unknown[]).map(String) : [],
          preview: String(ev.preview ?? ''),
        })
        break
      case 'done':
        box.final = typeof ev.final === 'string' ? ev.final : acc
        box.convId = (ev.conversation_id as string | null) ?? null
        break
      case 'error':
        throw new Error(String(ev.message ?? 'Erreur inconnue'))
    }
  }

  armIdle()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      armIdle()
      buffer += td.decode(value, { stream: true })
      let nl: number
      while ((nl = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, nl).replace(/\r$/, '')
        buffer = buffer.slice(nl + 1)
        if (!line.startsWith('data:')) continue
        const payload = line.slice(5).trim()
        if (!payload) continue
        let ev: Record<string, unknown>
        try { ev = JSON.parse(payload) } catch { continue }
        handleEvent(ev)
      }
    }
  } catch (e) {
    // Coupure socket / abort : si `done` était déjà reçu, on a la réponse
    // complète — on la garde (pas de repli qui rejouerait un tour serveur =
    // double audit + double persistance). Sinon, on relance pour déclencher le
    // repli JSON (aucun audit/persist serveur n'a eu lieu avant un `done`).
    if (box.final == null) throw e
  } finally {
    if (idleTimer) clearTimeout(idleTimer)
    try { await reader.cancel() } catch { /* déjà libéré */ }
  }

  // Fin de flux SANS `done` ni `error` (isolate tué, 502 après en-têtes, proxy
  // qui tronque) → anormal : on relance pour engager le repli JSON, plutôt que de
  // laisser la bulle figée en « réflexion » et persister un tour assistant vide.
  const final = box.final
  if (final == null) throw new Error('Flux interrompu')

  // `done` reçu. Le serveur renvoie le texte normalisé (meggaProse) dans `final`.
  // On ne remplace QUE si non vide : un `final` vide (dégradation modèle) effacerait
  // le texte déjà streamé — mieux vaut garder l'accumulation.
  const text = final.length > 0 ? final : acc
  if (final.length > 0) handlers.onFinal?.(final)
  return { text, conversationId: box.convId }
}

/* ─── Hook ─── */

export function useCopilot() {
  const [isLoading, setIsLoading] = useState(false)
  const historyRef = useRef<ChatMessage[]>([])
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
    handlers: CopilotStreamHandlers,
  ): Promise<void> => {
    const action = detectAction(message)

    setIsLoading(true)
    try {
      const { text, conversationId } = await streamCopilotApi(
        message, action, context, historyRef.current, conversationIdRef.current, handlers,
      )
      if (conversationId) conversationIdRef.current = conversationId

      const userMsg: ChatMessage = { role: 'user', content: message }
      const assistantMsg: ChatMessage = { role: 'assistant', content: text }
      historyRef.current = [...historyRef.current, userMsg, assistantMsg].slice(-20)
    } catch (err) {
      // Repli : si le streaming échoue (réseau, proxy sans SSE), on retombe sur
      // l'appel JSON bloquant pour ne pas laisser l'agent sans réponse.
      try {
        const { result, conversationId, pendingAction } = await callCopilotApi(message, action, context, historyRef.current, conversationIdRef.current)
        if (conversationId) conversationIdRef.current = conversationId
        handlers.onReset?.()
        handlers.onPhase?.(null)
        if (handlers.onFinal) handlers.onFinal(result)
        else handlers.onDelta(result)
        if (pendingAction) handlers.onPendingAction?.(pendingAction)
        const userMsg: ChatMessage = { role: 'user', content: message }
        const assistantMsg: ChatMessage = { role: 'assistant', content: result }
        historyRef.current = [...historyRef.current, userMsg, assistantMsg].slice(-20)
      } catch (err2) {
        const errorMessage = err2 instanceof Error ? err2.message : (err instanceof Error ? err.message : 'Erreur inconnue')
        handlers.onPhase?.(null)
        handlers.onDelta(`⚠️ ${errorMessage}`)
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const clearHistory = useCallback(() => {
    historyRef.current = []
    conversationIdRef.current = null
  }, [])

  const resumeConversation = useCallback((id: string, history: ChatMessage[]) => {
    conversationIdRef.current = id
    historyRef.current = history.slice(-20)
  }, [])

  /** Valide (exécute) une action de publication en attente après le clic de l'agent
   *  sur la carte. Consomme la carte côté serveur et renvoie le texte de résultat. */
  const executePending = useCallback(async (pendingId: string): Promise<string> => {
    const { data, error } = await supabase.functions.invoke<{ result?: string; error?: string }>('ai-copilot', {
      body: { action: 'execute_pending', pending_id: pendingId, message: '', language: 'fr' },
    })
    if (error) {
      let detail = error.message
      if (error instanceof FunctionsHttpError) {
        try { const body = await error.context.json(); if (body?.error) detail = body.error as string } catch { /* garde le message générique */ }
      }
      throw new Error(detail)
    }
    return data?.result ?? ''
  }, [])

  return { sendMessage, sendMessageStream, executePending, isLoading, detectAction, clearHistory, resumeConversation }
}
