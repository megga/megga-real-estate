// Tests unitaires du helper de journalisation coût + latence (pur, sans I/O).
// Tourne sous Node/Vitest : ai-usage.ts n'a QUE `import type` d'esm.sh (effacé).
import { describe, it, expect } from 'vitest'
import {
  PRICING,
  computeCost,
  buildAIUsageRow,
  logDeepSeekUsageWith,
} from './ai-usage.ts'

describe('computeCost', () => {
  it('applique la tarification DeepSeek (USD / 1M tokens)', () => {
    // 1000 in * 0.27 + 500 out * 1.10 = 270 + 550 = 820 → /1e6
    expect(computeCost('deepseek', 1000, 500)).toBeCloseTo(0.00082, 10)
  })

  it('applique la tarification Claude Sonnet', () => {
    // 1000 in * 3.00 + 1000 out * 15.00 = 3000 + 15000 = 18000 → /1e6 = 0.018
    expect(computeCost('claude-sonnet', 1000, 1000)).toBeCloseTo(0.018, 6)
  })

  it('coerce les tokens invalides (négatif / NaN / non entier) à 0', () => {
    expect(computeCost('deepseek', -5, 10)).toBeCloseTo(10 * PRICING.deepseek.output / 1_000_000, 12)
    expect(computeCost('deepseek', Number.NaN, Number.NaN)).toBe(0)
    expect(computeCost('deepseek', 10.9, 0)).toBeCloseTo(10 * PRICING.deepseek.input / 1_000_000, 12)
  })
})

describe('buildAIUsageRow', () => {
  it('mappe une utilisation complète en ligne DB', () => {
    const row = buildAIUsageRow({
      edgeFunction: 'whatsapp-agent',
      provider: 'deepseek',
      inputTokens: 1200,
      outputTokens: 340,
      latencyMs: 1873.6,
      agencyId: 'agency-1',
      module: 'whatsapp-agent',
    })
    expect(row).toEqual({
      edge_function: 'whatsapp-agent',
      provider: 'deepseek',
      input_tokens: 1200,
      output_tokens: 340,
      estimated_cost_usd: computeCost('deepseek', 1200, 340),
      was_fallback: false,
      latency_ms: 1874, // arrondi
      agency_id: 'agency-1',
      module: 'whatsapp-agent',
    })
  })

  it('latency_ms = null si absente, négative ou non finie', () => {
    expect(buildAIUsageRow({ edgeFunction: 'x', provider: 'deepseek', inputTokens: 1, outputTokens: 1 }).latency_ms).toBeNull()
    expect(buildAIUsageRow({ edgeFunction: 'x', provider: 'deepseek', inputTokens: 1, outputTokens: 1, latencyMs: -3 }).latency_ms).toBeNull()
    expect(buildAIUsageRow({ edgeFunction: 'x', provider: 'deepseek', inputTokens: 1, outputTokens: 1, latencyMs: Number.POSITIVE_INFINITY }).latency_ms).toBeNull()
  })

  it('agency_id et module null par défaut', () => {
    const row = buildAIUsageRow({ edgeFunction: 'x', provider: 'deepseek', inputTokens: 0, outputTokens: 0 })
    expect(row.agency_id).toBeNull()
    expect(row.module).toBeNull()
    expect(row.was_fallback).toBe(false)
  })
})

describe('logDeepSeekUsageWith', () => {
  // Faux client : capture la ligne passée à insert(), thenable pour le fire-and-forget.
  function fakeClient() {
    const inserted: unknown[] = []
    const client = {
      from(table: string) {
        expect(table).toBe('ai_usage_logs')
        return {
          insert(row: unknown) {
            inserted.push(row)
            return { then: (ok: (r: { error: null }) => void) => { ok({ error: null }); return { catch() {} } } }
          },
        }
      },
    }
    return { client, inserted }
  }

  it('extrait prompt_tokens/completion_tokens et insère la ligne', () => {
    const { client, inserted } = fakeClient()
    // deno-lint-ignore no-explicit-any
    logDeepSeekUsageWith(client as any, { prompt_tokens: 900, completion_tokens: 120 }, {
      edgeFunction: 'whatsapp-agent', module: 'whatsapp-agent', latencyMs: 500, agencyId: 'a1',
    })
    expect(inserted).toHaveLength(1)
    expect(inserted[0]).toMatchObject({
      edge_function: 'whatsapp-agent',
      provider: 'deepseek',
      input_tokens: 900,
      output_tokens: 120,
      latency_ms: 500,
      agency_id: 'a1',
      module: 'whatsapp-agent',
    })
  })

  it('usage absent → 0 tokens, ne lève pas', () => {
    const { client, inserted } = fakeClient()
    expect(() =>
      // deno-lint-ignore no-explicit-any
      logDeepSeekUsageWith(client as any, undefined, { edgeFunction: 'ai-copilot', module: 'copilot' })
    ).not.toThrow()
    expect(inserted[0]).toMatchObject({ input_tokens: 0, output_tokens: 0, latency_ms: null, agency_id: null })
  })
})
