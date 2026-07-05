// Boucle agentique DeepSeek partagée (web) — logique PURE, zéro I/O, zéro Deno.
// Extraction canal-agnostique de la mécanique éprouvée de whatsapp-agent/index.ts
// (MAX_TURNS, budget d'outils, dédup, passe finale forcée sans outils), plus
// l'assemblage des réponses STREAMÉES (deltas OpenAI/DeepSeek → texte + tool_calls).
//
// Les effets (fetch DeepSeek, exécution SQL des outils, émission SSE) sont
// INJECTÉS par l'appelant : ce module reste testable en vitest (Node).

// ─── Événements émis vers le client (SSE) ────────────────────────────────────
// PII-safe par construction : jamais d'arguments d'outil ni de données CRM,
// seulement le NOM de l'outil (même règle que whatsapp_tool_usage).
export type StreamEvent =
  | { type: 'token'; t: string }
  | { type: 'reset' } // du texte a été émis puis le tour s'est révélé être un appel d'outils → le client efface
export type LoopEvent =
  | StreamEvent
  | { type: 'tool_start'; name: string; tier: string }
  | { type: 'tool_end'; name: string; ok: boolean }

// ─── Décodage du flux SSE DeepSeek (transport) ───────────────────────────────
// Reçoit des morceaux de texte arbitraires (frontières de chunks quelconques),
// rend les payloads `data:` complets. '[DONE]' est traduit en null final.
export class SseDecoder {
  private buffer = ''

  /** Pousse un chunk de texte ; renvoie les payloads JSON complets extraits. */
  push(chunkText: string): string[] {
    this.buffer += chunkText
    const out: string[] = []
    let idx: number
    while ((idx = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, idx).replace(/\r$/, '')
      this.buffer = this.buffer.slice(idx + 1)
      if (!line.startsWith('data:')) continue
      const payload = line.slice(5).trim()
      if (!payload || payload === '[DONE]') continue
      out.push(payload)
    }
    return out
  }
}

// ─── Assemblage des deltas d'un tour streamé ─────────────────────────────────
// Difficulté : on ne sait qu'en FIN de flux si le tour est une réponse texte ou
// un appel d'outils. On retient donc les premiers deltas de texte (HOLD_DELTAS) ;
// si aucun tool_call n'apparaît, on lâche le texte en continu (vrai streaming) ;
// si un tool_call apparaît APRÈS coup (rare), on émet 'reset' pour que le client
// efface le texte partiel (honnêteté > fluidité).
export interface DeltaToolCall {
  index?: number
  id?: string | null
  function?: { name?: string | null; arguments?: string | null }
}
export interface StreamDelta {
  content?: string | null
  tool_calls?: DeltaToolCall[]
}
export interface AssembledToolCall { id: string; name: string; arguments: string }

const HOLD_DELTAS = 12

export class StreamAssembler {
  private content = ''
  private held = ''
  private flushed = false
  private resetSent = false
  private deltaCount = 0
  private hasToolCalls = false
  private calls = new Map<number, { id: string; name: string; arguments: string }>()

  constructor(private holdDeltas = HOLD_DELTAS) {}

  /** Ingère un delta ; renvoie les événements à émettre immédiatement. */
  feed(delta: StreamDelta | null | undefined): StreamEvent[] {
    if (!delta) return []
    const events: StreamEvent[] = []

    if (delta.tool_calls?.length) {
      this.hasToolCalls = true
      for (const tc of delta.tool_calls) {
        const i = tc.index ?? 0
        const cur = this.calls.get(i) ?? { id: '', name: '', arguments: '' }
        if (tc.id) cur.id = tc.id
        if (tc.function?.name) cur.name += tc.function.name
        if (tc.function?.arguments) cur.arguments += tc.function.arguments
        this.calls.set(i, cur)
      }
      if (this.flushed && !this.resetSent) {
        this.resetSent = true
        events.push({ type: 'reset' })
      }
    }

    if (delta.content) {
      this.content += delta.content
      if (!this.hasToolCalls) {
        this.deltaCount++
        if (this.flushed) {
          events.push({ type: 'token', t: delta.content })
        } else {
          this.held += delta.content
          if (this.deltaCount >= this.holdDeltas) {
            this.flushed = true
            events.push({ type: 'token', t: this.held })
            this.held = ''
          }
        }
      }
    }

    return events
  }

  /** Clôt le tour : vide la retenue si c'était bien une réponse texte. */
  finish(): { events: StreamEvent[]; content: string; toolCalls: AssembledToolCall[]; emitted: boolean } {
    const events: StreamEvent[] = []
    if (!this.hasToolCalls && this.held) {
      events.push({ type: 'token', t: this.held })
      this.held = ''
      this.flushed = true
    }
    const toolCalls: AssembledToolCall[] = [...this.calls.entries()]
      .sort(([a], [b]) => a - b)
      .map(([i, c]) => ({ id: c.id || `call_${i}`, name: c.name, arguments: c.arguments || '{}' }))
    return { events, content: this.content, toolCalls, emitted: this.flushed && !this.resetSent }
  }
}

// ─── Boucle agentique ────────────────────────────────────────────────────────
export interface ModelTurn {
  content: string
  toolCalls: AssembledToolCall[]
  /** true si des tokens de ce tour ont DÉJÀ été émis au client (streaming). */
  emitted: boolean
  usage?: { prompt_tokens?: number; completion_tokens?: number }
}

export type LoopMessage = Record<string, unknown>

/** Action confirm-tier PRÉPARÉE, en attente de validation humaine (carte HITL web). */
export interface PendingAction {
  tool: string
  kind: string   // 'publish' | 'withdraw'
  payload: Record<string, unknown>
  preview: string
  title?: string | null
}

/** Résultat de la préparation d'une action confirm : aperçu déterministe + charge figée. */
export interface PrepareConfirmResult {
  ok: boolean
  kind?: string
  payload?: Record<string, unknown>
  preview?: string
  title?: string | null
  /** Message role:'tool' réinjecté au modèle après la préparation (sinon défaut). */
  toolMessage?: string
  error?: string
}

export interface AgentLoopDeps {
  /** Un appel modèle. `withTools=false` force la passe finale (tool_choice none). */
  callModel: (messages: LoopMessage[], withTools: boolean) => Promise<ModelTurn | null>
  /** Exécute un outil autorisé ; renvoie le texte role:'tool'. Ne jette jamais (géré ici en défense). */
  runTool: (name: string, args: Record<string, unknown>) => Promise<string>
  /** Tier de l'outil ('read' toujours OK ; 'auto' OK si allowWrites ; le reste refusé). */
  tierOf: (name: string) => string
  /** Autorise l'exécution du tier 'auto' (écritures internes réversibles). Défaut false
   *  = lecture seule stricte. Les tiers 'confirm'/'slow_async'/inconnu sont TOUJOURS refusés. */
  allowWrites?: boolean
  /** Si fourni, un tier 'confirm' n'est plus refusé sèchement : il est PRÉPARÉ (aperçu +
   *  charge figée) et renvoyé comme action EN ATTENTE (carte de validation web) — jamais
   *  exécuté dans la boucle. UNE seule action confirm par tour est stashée ; les suivantes
   *  sont refusées. Sans ce dep, le tier confirm reste refusé (comportement historique). */
  prepareConfirm?: (name: string, args: Record<string, unknown>) => Promise<PrepareConfirmResult>
  emit: (ev: LoopEvent) => void
  maxTurns?: number
  maxToolCalls?: number
  budgetMs?: number
  now?: () => number
}

export interface AgentLoopResult {
  text: string
  /** true si le texte final a déjà été streamé en tokens au client. */
  emitted: boolean
  toolsUsed: Array<{ name: string; ok: boolean }>
  usage: { input: number; output: number }
  /** Renseigné si la boucle a dégradé (budget/tours épuisés, erreur modèle). */
  degraded?: 'model_error' | 'budget' | 'exhausted'
  /** Action confirm préparée en attente de validation de l'agent (0 ou 1 par tour). */
  pending?: PendingAction
}

const REFUSED_TOOL_MSG =
  "Cet outil n'est pas exécutable ici (envoi client ou action sensible réservée à une validation). Réponds avec ce que tu as, ou explique à l'agent comment le faire dans le CRM."

const PENDING_PREPARED_MSG =
  "Action préparée : une carte de validation vient d'être affichée à l'agent. Ne prétends PAS que c'est fait — invite-le à valider (ou annuler) dans le panneau. N'appelle pas d'autre outil de publication ce tour-ci."

export async function runAgentLoop(deps: AgentLoopDeps, baseMessages: LoopMessage[]): Promise<AgentLoopResult> {
  const maxTurns = deps.maxTurns ?? 5
  const maxToolCalls = deps.maxToolCalls ?? 8
  const budgetMs = deps.budgetMs ?? 55_000
  const now = deps.now ?? (() => Date.now())
  const t0 = now()
  const overBudget = () => now() - t0 > budgetMs

  const messages: LoopMessage[] = [...baseMessages]
  const toolsUsed: Array<{ name: string; ok: boolean }> = []
  const usage = { input: 0, output: 0 }
  const resultCache = new Map<string, string>() // dédup outil identique (F4 WhatsApp)
  let toolCallsUsed = 0
  // Action confirm préparée ce tour (0 ou 1) : surfacée au HITL web, jamais exécutée ici.
  let pending: PendingAction | undefined

  const addUsage = (u?: { prompt_tokens?: number; completion_tokens?: number }) => {
    usage.input += u?.prompt_tokens ?? 0
    usage.output += u?.completion_tokens ?? 0
  }

  const finalPass = async (reason: 'budget' | 'exhausted'): Promise<AgentLoopResult> => {
    // Passe finale SANS outils (F9 WhatsApp) : rédiger avec ce qui a été récolté.
    const forced = await deps.callModel(messages, false)
    addUsage(forced?.usage)
    if (forced?.content) {
      return { text: forced.content, emitted: forced.emitted, toolsUsed, usage, degraded: reason, pending }
    }
    return { text: '', emitted: false, toolsUsed, usage, degraded: reason, pending }
  }

  for (let turn = 0; turn < maxTurns; turn++) {
    if (overBudget()) return finalPass('budget')

    const resp = await deps.callModel(messages, true)
    if (!resp) return { text: '', emitted: false, toolsUsed, usage, degraded: 'model_error' }
    addUsage(resp.usage)

    if (!resp.toolCalls.length) {
      return { text: resp.content, emitted: resp.emitted, toolsUsed, usage, pending }
    }

    // Ré-empile le message assistant AVEC ses tool_calls (ids garantis — F11).
    messages.push({
      role: 'assistant',
      content: resp.content || null,
      tool_calls: resp.toolCalls.map((c) => ({
        id: c.id, type: 'function', function: { name: c.name, arguments: c.arguments },
      })),
    })

    for (const call of resp.toolCalls) {
      if (overBudget()) return finalPass('budget')
      if (toolCallsUsed >= maxToolCalls) return finalPass('exhausted')
      toolCallsUsed++

      let args: Record<string, unknown> = {}
      try { args = JSON.parse(call.arguments || '{}') } catch { /* args vides */ }

      const tier = deps.tierOf(call.name)
      // Tier 'confirm' + prepareConfirm fourni → on PRÉPARE l'action (aperçu + charge
      // figée) et on la surface au HITL, au lieu de l'exécuter (jamais dans la boucle)
      // ou de la refuser sèchement. UNE seule par tour : la 2e est refusée.
      if (tier === 'confirm' && deps.prepareConfirm) {
        if (pending) {
          toolsUsed.push({ name: call.name, ok: false })
          messages.push({ role: 'tool', tool_call_id: call.id, content: PENDING_PREPARED_MSG })
          continue
        }
        let prep: PrepareConfirmResult
        try {
          prep = await deps.prepareConfirm(call.name, args)
        } catch (e) {
          prep = { ok: false, error: `Erreur préparation: ${(e as Error)?.message ?? 'inconnue'}` }
        }
        if (prep.ok && prep.preview) {
          pending = {
            tool: call.name,
            kind: prep.kind ?? 'confirm',
            payload: prep.payload ?? {},
            preview: prep.preview,
            title: prep.title ?? null,
          }
          toolsUsed.push({ name: call.name, ok: true })
          messages.push({ role: 'tool', tool_call_id: call.id, content: prep.toolMessage ?? PENDING_PREPARED_MSG })
        } else {
          toolsUsed.push({ name: call.name, ok: false })
          messages.push({ role: 'tool', tool_call_id: call.id, content: prep.error ?? REFUSED_TOOL_MSG })
        }
        continue
      }
      // Périmètre d'exécution : 'read' toujours ; 'auto' si allowWrites (écritures
      // internes réversibles). 'confirm'/'slow_async'/inconnu (fail-safe) TOUJOURS
      // refusés — un envoi client n'est JAMAIS exécuté dans la boucle.
      const allowed = tier === 'read' || (tier === 'auto' && deps.allowWrites === true)
      if (!allowed) {
        toolsUsed.push({ name: call.name, ok: false })
        messages.push({ role: 'tool', tool_call_id: call.id, content: REFUSED_TOOL_MSG })
        continue
      }

      deps.emit({ type: 'tool_start', name: call.name, tier })
      const key = `${call.name}:${call.arguments}`
      let result = resultCache.get(key)
      let ok = true
      if (result === undefined) {
        try {
          result = await deps.runTool(call.name, args)
        } catch (e) {
          ok = false
          result = `Erreur outil: ${(e as Error)?.message ?? 'inconnue'}`
        }
        resultCache.set(key, result)
      }
      deps.emit({ type: 'tool_end', name: call.name, ok })
      toolsUsed.push({ name: call.name, ok })
      messages.push({ role: 'tool', tool_call_id: call.id, content: result })
    }
  }

  return finalPass('exhausted')
}
