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

export interface AgentLoopDeps {
  /** Un appel modèle. `withTools=false` force la passe finale (tool_choice none). */
  callModel: (messages: LoopMessage[], withTools: boolean) => Promise<ModelTurn | null>
  /** Exécute un outil read ; renvoie le texte role:'tool'. Ne jette jamais (géré ici en défense). */
  runTool: (name: string, args: Record<string, unknown>) => Promise<string>
  /** Tier de l'outil ('read' attendu ; tout autre tier est refusé en v1 web). */
  tierOf: (name: string) => string
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
}

const REFUSED_TOOL_MSG =
  "Outil non disponible dans le copilote web (lecture seule en v1). Réponds avec ce que tu as, ou explique à l'agent comment faire l'action dans le CRM."

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

  const addUsage = (u?: { prompt_tokens?: number; completion_tokens?: number }) => {
    usage.input += u?.prompt_tokens ?? 0
    usage.output += u?.completion_tokens ?? 0
  }

  const finalPass = async (reason: 'budget' | 'exhausted'): Promise<AgentLoopResult> => {
    // Passe finale SANS outils (F9 WhatsApp) : rédiger avec ce qui a été récolté.
    const forced = await deps.callModel(messages, false)
    addUsage(forced?.usage)
    if (forced?.content) {
      return { text: forced.content, emitted: forced.emitted, toolsUsed, usage, degraded: reason }
    }
    return { text: '', emitted: false, toolsUsed, usage, degraded: reason }
  }

  for (let turn = 0; turn < maxTurns; turn++) {
    if (overBudget()) return finalPass('budget')

    const resp = await deps.callModel(messages, true)
    if (!resp) return { text: '', emitted: false, toolsUsed, usage, degraded: 'model_error' }
    addUsage(resp.usage)

    if (!resp.toolCalls.length) {
      return { text: resp.content, emitted: resp.emitted, toolsUsed, usage }
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
      // v1 web : LECTURE SEULE. Tout tier ≠ read (fail-safe : inconnu = confirm)
      // est refusé dans la boucle — jamais exécuté, jamais silencieux.
      if (tier !== 'read') {
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
