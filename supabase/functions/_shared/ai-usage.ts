// supabase/functions/_shared/ai-usage.ts
//
// Journalisation coût + latence des appels IA → table `ai_usage_logs`.
//
// Pourquoi un module SÉPARÉ d'ai-provider.ts : les gros consommateurs DeepSeek
// (whatsapp-agent + sa boucle d'outils, whatsapp-actions, ai-copilot…) sont
// importés par des tests unit/backend qui tournent sous Node. ai-provider.ts
// value-importe `createClient` depuis https://esm.sh → non résoluble par Node,
// donc INIMPORTABLE depuis un module testé. Ici on n'a QUE `import type
// { SupabaseClient }` (effacé au transpile) : le logger reçoit un client DÉJÀ
// instancié (tous les appelants ont ctx.supabase / un client admin en scope),
// donc pas de createClient. Ce module est sûr à importer partout.
//
// Le logger est fire-and-forget : jamais awaité, n'ajoute aucune latence au
// chemin heureux et n'y lève jamais. En Edge Function le client est service-role
// → l'INSERT sur ai_usage_logs contourne la RLS (lecture réservée super_admin).

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export type AIProvider = 'deepseek' | 'claude-sonnet' | 'claude-haiku'

// USD par 1M de tokens. Source de vérité unique (ai-provider.ts l'importe).
// À mettre à jour si la tarification d'un fournisseur change.
export const PRICING: Record<AIProvider, { input: number; output: number }> = {
  'deepseek':      { input: 0.27, output: 1.10 },
  'claude-sonnet': { input: 3.00, output: 15.00 },
  'claude-haiku':  { input: 1.00, output: 5.00 },
}

// Un `usage` renvoyé par un fournisseur peut être absent, négatif ou non entier :
// on coerce à un entier >= 0 pour que le coût et l'INSERT ne soient jamais corrompus.
function coerceTokens(n: unknown): number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0
}

export function computeCost(provider: AIProvider, inputTokens: number, outputTokens: number): number {
  const p = PRICING[provider] ?? PRICING.deepseek
  return (coerceTokens(inputTokens) * p.input + coerceTokens(outputTokens) * p.output) / 1_000_000
}

export interface AIUsageInput {
  edgeFunction: string
  provider: AIProvider
  inputTokens: number
  outputTokens: number
  /** Aller-retour de l'appel (fetch + parse) en ms. null si non mesuré. */
  latencyMs?: number | null
  /** Agence à l'origine de l'appel (attribution des coûts). */
  agencyId?: string | null
  /** Module fonctionnel, plus fin qu'edge_function (whatsapp-agent, copilot…). */
  module?: string | null
  wasFallback?: boolean
}

export interface AIUsageRow {
  edge_function: string
  provider: string
  input_tokens: number
  output_tokens: number
  estimated_cost_usd: number
  was_fallback: boolean
  latency_ms: number | null
  agency_id: string | null
  module: string | null
}

// Mappe une utilisation en ligne `ai_usage_logs` (coût calculé ici). Défensif :
// tokens coercés, latence arrondie et bornée à >= 0 (une horloge qui recule → null).
export function buildAIUsageRow(input: AIUsageInput): AIUsageRow {
  const inputTokens = coerceTokens(input.inputTokens)
  const outputTokens = coerceTokens(input.outputTokens)
  const latency = typeof input.latencyMs === 'number' && Number.isFinite(input.latencyMs) && input.latencyMs >= 0
    ? Math.round(input.latencyMs)
    : null
  return {
    edge_function: input.edgeFunction,
    provider: input.provider,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    estimated_cost_usd: computeCost(input.provider, inputTokens, outputTokens),
    was_fallback: input.wasFallback ?? false,
    latency_ms: latency,
    agency_id: input.agencyId ?? null,
    module: input.module ?? null,
  }
}

// Fire-and-forget : ne jamais awaiter. Avale toute erreur (l'insertion d'un log
// ne doit jamais casser ni ralentir la réponse à l'agent/au client).
export function logAIUsageWith(client: SupabaseClient, input: AIUsageInput): void {
  try {
    const pending = client
      .from('ai_usage_logs')
      .insert(buildAIUsageRow(input))
      .then(
        ({ error }: { error: { message?: string } | null }) => {
          if (error) console.error('[ai-usage] insert failed:', error.message)
        },
        (err: unknown) => console.error('[ai-usage] insert threw:', (err as Error)?.name ?? 'error'),
      )
    // En Edge Function : garder l'isolat vivant jusqu'à la fin de l'INSERT, sinon le
    // DERNIER log d'une requête (chemin mono-tour, le plus fréquent) est perdu quand
    // l'isolat gèle juste après la réponse HTTP. Convention repo (buyer-reception,
    // flatfox-sync…). Inerte sous Node/Vitest → typeof EdgeRuntime === 'undefined'.
    const edge = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime
    // .then() de supabase-js rend un PromiseLike → Promise.resolve pour le type waitUntil.
    edge?.waitUntil(Promise.resolve(pending))
  } catch (err) {
    console.error('[ai-usage] log threw:', (err as Error)?.name ?? 'error')
  }
}

// Raccourci pour les appelants DeepSeek directs : extrait les tokens du `usage`
// brut de l'API (prompt_tokens / completion_tokens).
export function logDeepSeekUsageWith(
  client: SupabaseClient,
  usage: { prompt_tokens?: number; completion_tokens?: number } | null | undefined,
  ctx: { edgeFunction: string; module?: string | null; latencyMs?: number | null; agencyId?: string | null },
): void {
  logAIUsageWith(client, {
    edgeFunction: ctx.edgeFunction,
    provider: 'deepseek',
    inputTokens: usage?.prompt_tokens ?? 0,
    outputTokens: usage?.completion_tokens ?? 0,
    latencyMs: ctx.latencyMs ?? null,
    agencyId: ctx.agencyId ?? null,
    module: ctx.module ?? null,
  })
}
