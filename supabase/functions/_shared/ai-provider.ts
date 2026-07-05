// supabase/functions/_shared/ai-provider.ts
// Shared AI provider for Edge Functions.
//
// Three call sites:
//   - callClaude()    — agent-side features (copilote, matching, KYC)
//   - callDeepSeek()  — public-side features (marketplace, help center)
//   - callPublicAI()  — DeepSeek with automatic Claude Haiku fallback
//
// All calls log to ai_usage_logs (fire-and-forget). Fallbacks also emit an
// activity_events row so super_admin sees DeepSeek outages.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
}

export interface AIResponse {
  text: string
  provider: 'deepseek' | 'claude-sonnet' | 'claude-haiku'
  input_tokens: number
  output_tokens: number
  estimated_cost_usd: number
  was_fallback: boolean
}

// USD per 1M tokens. Update if provider pricing changes.
const PRICING = {
  'deepseek':       { input: 0.27, output: 1.10 },
  'claude-sonnet':  { input: 3.00, output: 15.00 },
  'claude-haiku':   { input: 1.00, output: 5.00 },
} as const

const CLAUDE_MODELS = {
  sonnet: 'claude-sonnet-4-20250514',
  haiku:  'claude-haiku-4-5-20251001',
} as const

const DEEPSEEK_TIMEOUT_MS = 8000

function computeCost(
  provider: keyof typeof PRICING,
  inputTokens: number,
  outputTokens: number,
): number {
  const p = PRICING[provider]
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000
}

function supabaseAdmin() {
  const url = Deno.env.get('SUPABASE_URL')!
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  return createClient(url, key, { auth: { persistSession: false } })
}

// Fire-and-forget insert. Never await — UX latency must not depend on logging.
function logUsage(row: {
  edge_function: string
  provider: string
  input_tokens: number
  output_tokens: number
  estimated_cost_usd: number
  was_fallback: boolean
  agency_id?: string | null
  module?: string | null
}) {
  try {
    supabaseAdmin()
      .from('ai_usage_logs')
      .insert(row)
      .then(({ error }) => {
        if (error) console.error('[ai-provider] log insert failed:', error.message)
      })
  } catch (err) {
    console.error('[ai-provider] log threw:', err)
  }
}

// Edge Function name for logging. Infers from stack or falls back to env.
function currentFunctionName(): string {
  return Deno.env.get('SUPABASE_FUNCTION_NAME') || 'unknown'
}

// ── Claude ──────────────────────────────────────────────────────────────────

export async function callClaude(
  messages: AIMessage[],
  systemPrompt: string,
  options: AIOptions & { model?: 'sonnet' | 'haiku' } = {},
): Promise<AIResponse> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')

  const modelKey = options.model ?? 'sonnet'
  const model = CLAUDE_MODELS[modelKey]
  const providerKey = modelKey === 'sonnet' ? 'claude-sonnet' : 'claude-haiku'

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: options.maxTokens ?? 1024,
      temperature: options.temperature,
      system: systemPrompt,
      messages,
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Claude API ${res.status}: ${body.slice(0, 200)}`)
  }

  const data = await res.json()
  const text = data.content?.[0]?.text ?? ''
  const input_tokens = data.usage?.input_tokens ?? 0
  const output_tokens = data.usage?.output_tokens ?? 0
  const cost = computeCost(providerKey, input_tokens, output_tokens)

  logUsage({
    edge_function: currentFunctionName(),
    provider: providerKey,
    input_tokens,
    output_tokens,
    estimated_cost_usd: cost,
    was_fallback: false,
    agency_id: options.agencyId ?? null,
    module: options.module ?? null,
  })

  return {
    text,
    provider: providerKey,
    input_tokens,
    output_tokens,
    estimated_cost_usd: cost,
    was_fallback: false,
  }
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
  const timeout = setTimeout(() => controller.abort(), DEEPSEEK_TIMEOUT_MS)

  try {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        max_tokens: options.maxTokens ?? 1024,
        temperature: options.temperature,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
      }),
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

    logUsage({
      edge_function: currentFunctionName(),
      provider: 'deepseek',
      input_tokens,
      output_tokens,
      estimated_cost_usd: cost,
      was_fallback: false,
      agency_id: options.agencyId ?? null,
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
