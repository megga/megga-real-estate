import { describe, it, expect, vi } from 'vitest'
import {
  sendWithRetry,
  classifySendOutcome,
  metaErrorCode,
  NEVER_RETRY_META_CODES,
  RETRYABLE_META_CODES,
} from './whatsapp-retry'
import { getProvider, type SendHttpRequest } from './whatsapp-gateway'

const provider = getProvider('meta')
const parse = (s: number, b: unknown) => provider.parseSendResult(s, b)

const REQ: SendHttpRequest = {
  url: 'https://graph.facebook.com/v22.0/PNID/messages',
  method: 'POST',
  headers: { Authorization: 'Bearer x', 'Content-Type': 'application/json' },
  body: JSON.stringify({ to: '41790000000', type: 'text' }),
}

// Réponse fetch factice : statut + corps JSON. Pas de réseau.
function res(status: number, body: unknown): Response {
  return { status, json: async () => body } as unknown as Response
}

// Options communes : pas d'attente réelle, pas de timer réel.
const FAST = { sleep: async () => {}, makeSignal: () => undefined, baseDelayMs: 1 }

describe('classifySendOutcome', () => {
  it('null (exception réseau/timeout) = retryable', () => {
    expect(classifySendOutcome(null)).toBe('retryable')
  })
  it('2xx = ok', () => {
    expect(classifySendOutcome(200)).toBe('ok')
    expect(classifySendOutcome(201)).toBe('ok')
  })
  it('429 et 5xx = retryable', () => {
    expect(classifySendOutcome(429)).toBe('retryable')
    expect(classifySendOutcome(500)).toBe('retryable')
    expect(classifySendOutcome(503)).toBe('retryable')
  })
  it('autres 4xx = permanent', () => {
    expect(classifySendOutcome(400)).toBe('permanent')
    expect(classifySendOutcome(401)).toBe('permanent')
    expect(classifySendOutcome(404)).toBe('permanent')
  })
})

describe('metaErrorCode', () => {
  it('extrait le code d’erreur Meta', () => {
    expect(metaErrorCode({ error: { code: 131047, message: 'x' } })).toBe(131047)
  })
  it('null si absent / illisible', () => {
    expect(metaErrorCode({})).toBeNull()
    expect(metaErrorCode(null)).toBeNull()
    expect(metaErrorCode({ error: { code: 'nope' } })).toBeNull()
  })
  it('131047 est banni de retry', () => {
    expect(NEVER_RETRY_META_CODES.has(131047)).toBe(true)
  })
  it('throttles de débit rejouables (130429, 80007), pas les rate-limits par-paire/spam', () => {
    expect(RETRYABLE_META_CODES.has(130429)).toBe(true)
    expect(RETRYABLE_META_CODES.has(80007)).toBe(true)
    expect(RETRYABLE_META_CODES.has(131048)).toBe(false) // spam rate limit
    expect(RETRYABLE_META_CODES.has(131056)).toBe(false) // pair rate limit
    expect(RETRYABLE_META_CODES.has(131047)).toBe(false) // fenêtre 24h
  })
})

describe('sendWithRetry', () => {
  it('succès du premier coup → 1 seule tentative', async () => {
    const fetchImpl = vi.fn(async () => res(200, { messages: [{ id: 'wamid.OK' }] }))
    const out = await sendWithRetry(REQ, parse, { ...FAST, fetchImpl })
    expect(out.ok).toBe(true)
    expect(out.providerMessageId).toBe('wamid.OK')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('5xx puis 200 → rejoue puis réussit', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(res(503, { error: { message: 'busy' } }))
      .mockResolvedValueOnce(res(200, { messages: [{ id: 'wamid.R' }] }))
    const out = await sendWithRetry(REQ, parse, { ...FAST, fetchImpl })
    expect(out.ok).toBe(true)
    expect(out.providerMessageId).toBe('wamid.R')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('429 (rate-limit) → rejoue', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(res(429, { error: { message: 'rate' } }))
      .mockResolvedValueOnce(res(200, { messages: [{ id: 'wamid.T' }] }))
    const out = await sendWithRetry(REQ, parse, { ...FAST, fetchImpl })
    expect(out.ok).toBe(true)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('exception réseau puis succès → rejoue', async () => {
    const fetchImpl = vi.fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce(res(200, { messages: [{ id: 'wamid.N' }] }))
    const out = await sendWithRetry(REQ, parse, { ...FAST, fetchImpl })
    expect(out.ok).toBe(true)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('131047 (fenêtre 24h) → JAMAIS de retry, échec en 1 tentative', async () => {
    const fetchImpl = vi.fn(async () =>
      res(400, { error: { code: 131047, message: 'Re-engagement message' } }))
    const out = await sendWithRetry(REQ, parse, { ...FAST, fetchImpl, maxAttempts: 5 })
    expect(out.ok).toBe(false)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('autre 4xx permanent (ex. 400 recipient invalide) → pas de retry', async () => {
    const fetchImpl = vi.fn(async () =>
      res(400, { error: { code: 131000, message: 'invalid' } }))
    const out = await sendWithRetry(REQ, parse, { ...FAST, fetchImpl, maxAttempts: 5 })
    expect(out.ok).toBe(false)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('throttle de débit Meta en HTTP 400 (130429) → rejoue (transitoire, sûr)', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(res(400, { error: { code: 130429, message: 'Rate limit hit' } }))
      .mockResolvedValueOnce(res(200, { messages: [{ id: 'wamid.RL' }] }))
    const out = await sendWithRetry(REQ, parse, { ...FAST, fetchImpl, maxAttempts: 3 })
    expect(out.ok).toBe(true)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('rate-limit par-paire/spam en 400 (131056) → PAS de retry (dénouement en minutes)', async () => {
    const fetchImpl = vi.fn(async () =>
      res(400, { error: { code: 131056, message: 'pair rate limit' } }))
    const out = await sendWithRetry(REQ, parse, { ...FAST, fetchImpl, maxAttempts: 3 })
    expect(out.ok).toBe(false)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('retryNetworkError:false → n’essaie PAS le timeout ambigu (anti-doublon client)', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('AbortError'))
    const out = await sendWithRetry(REQ, parse, { ...FAST, fetchImpl, maxAttempts: 3, retryNetworkError: false })
    expect(out.ok).toBe(false)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('retryNetworkError:false → rejoue quand même un refus EXPLICITE (5xx)', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(res(503, { error: { message: 'busy' } }))
      .mockResolvedValueOnce(res(200, { messages: [{ id: 'wamid.OK' }] }))
    const out = await sendWithRetry(REQ, parse, { ...FAST, fetchImpl, maxAttempts: 3, retryNetworkError: false })
    expect(out.ok).toBe(true)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('5xx persistant → s’arrête à maxAttempts et renvoie le dernier échec', async () => {
    const fetchImpl = vi.fn(async () => res(500, { error: { message: 'down' } }))
    const out = await sendWithRetry(REQ, parse, { ...FAST, fetchImpl, maxAttempts: 3 })
    expect(out.ok).toBe(false)
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it('maxAttempts=1 → tentative unique même sur transitoire', async () => {
    const fetchImpl = vi.fn(async () => res(503, { error: { message: 'busy' } }))
    const out = await sendWithRetry(REQ, parse, { ...FAST, fetchImpl, maxAttempts: 1 })
    expect(out.ok).toBe(false)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('applique un backoff croissant entre tentatives', async () => {
    const delays: number[] = []
    const fetchImpl = vi.fn(async () => res(500, {}))
    await sendWithRetry(REQ, parse, {
      makeSignal: () => undefined,
      fetchImpl,
      maxAttempts: 3,
      baseDelayMs: 10,
      sleep: async (ms: number) => { delays.push(ms) },
    })
    // 2 attentes (avant tentative 2 et 3), croissantes : 10, 20.
    expect(delays).toEqual([10, 20])
  })

  it('signale chaque retry via onRetry avec la raison', async () => {
    const reasons: string[] = []
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(res(500, {}))
      .mockRejectedValueOnce(new Error('net'))
      .mockResolvedValueOnce(res(200, { messages: [{ id: 'ok' }] }))
    await sendWithRetry(REQ, parse, {
      ...FAST, fetchImpl, maxAttempts: 3,
      onRetry: (_a, reason) => reasons.push(reason),
    })
    expect(reasons).toEqual(['http-500', 'network'])
  })
})
