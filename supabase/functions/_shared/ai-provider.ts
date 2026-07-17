// supabase/functions/_shared/ai-provider.ts
// Shared AI provider for Edge Functions. Toute l'inférence texte = DeepSeek
// (deepseek-chat). La vision/OCR passe par _shared/vision.ts (Gemini). AUCUN
// appel Claude/Anthropic (décision « DeepSeek/Gemini de bout en bout »).
//
//   - callDeepSeek() / callPublicAI() — DeepSeek
//
// Tous les appels journalisent dans ai_usage_logs (fire-and-forget).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { computeCost, logAIUsageWith } from './ai-usage.ts'

export interface AIMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AIOptions {
  maxTokens?: number
  temperature?: number
  /** Attribution du coût (ai_usage_logs, 20260705172000) — agence à l'origine de l'appel. */
  agencyId?: string
  /** Module fonctionnel (copilot, whatsapp-agent, extract-lead…), plus fin que edge_function. */
  module?: string
  /** Timeout de l'appel en ms. Défaut 8s ; monter pour l'extraction (gros output tardif). */
  timeoutMs?: number
  /** Force une sortie JSON stricte (response_format DeepSeek). */
  responseFormat?: 'json_object'
}

export interface AIResponse {
  text: string
  provider: 'deepseek' | 'claude-sonnet' | 'claude-haiku'
  input_tokens: number
  output_tokens: number
  estimated_cost_usd: number
  was_fallback: boolean
}

// Tarification (PRICING) et calcul de coût vivent dans ./ai-usage.ts (partagé
// avec les appelants DeepSeek directs, et importable sous Node/Vitest).

const DEEPSEEK_TIMEOUT_MS = 8000

function supabaseAdmin() {
  const url = Deno.env.get('SUPABASE_URL')!
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  return createClient(url, key, { auth: { persistSession: false } })
}

// Edge Function name for logging. Infers from stack or falls back to env.
function currentFunctionName(): string {
  return Deno.env.get('SUPABASE_FUNCTION_NAME') || 'unknown'
}

// ── DeepSeek ────────────────────────────────────────────────────────────────

export async function callDeepSeek(
  messages: AIMessage[],
  systemPrompt: string,
  options: AIOptions = {},
): Promise<AIResponse> {
  const apiKey = Deno.env.get('DEEPSEEK_API_KEY')
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY not set')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEEPSEEK_TIMEOUT_MS)

  try {
    const started = Date.now()
    const body: Record<string, unknown> = {
      model: 'deepseek-chat',
      max_tokens: options.maxTokens ?? 1024,
      temperature: options.temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    }
    if (options.responseFormat) body.response_format = { type: options.responseFormat }
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`DeepSeek API ${res.status}: ${body.slice(0, 200)}`)
    }

    const data = await res.json()
    const text = data.choices?.[0]?.message?.content ?? ''
    const input_tokens = data.usage?.prompt_tokens ?? 0
    const output_tokens = data.usage?.completion_tokens ?? 0
    const cost = computeCost('deepseek', input_tokens, output_tokens)

    logAIUsageWith(supabaseAdmin(), {
      edgeFunction: currentFunctionName(),
      provider: 'deepseek',
      inputTokens: input_tokens,
      outputTokens: output_tokens,
      latencyMs: Date.now() - started,
      agencyId: options.agencyId ?? null,
      module: options.module ?? null,
    })

    return {
      text,
      provider: 'deepseek',
      input_tokens,
      output_tokens,
      estimated_cost_usd: cost,
      was_fallback: false,
    }
  } finally {
    clearTimeout(timeout)
  }
}

// ── Public AI (DeepSeek only — no Claude fallback) ──────────────────────────
//
// Decision 2026-04-17: we keep public-side AI strictly on DeepSeek to cap
// Claude token spend. If DeepSeek is unavailable, the caller surfaces a
// "service temporarily unavailable" error to the user instead of silently
// degrading to Claude.

export async function callPublicAI(
  messages: AIMessage[],
  systemPrompt: string,
  options: AIOptions = {},
): Promise<AIResponse> {
  return await callDeepSeek(messages, systemPrompt, options)
}
