import { describe, it, expect, beforeAll } from 'vitest'
import { signMagicLinkToken, verifyMagicLinkToken } from './magic-link-token.ts'

beforeAll(() => {
  // Secret de test (>= 32 chars). Deno.env est lu par le module ; en Node/Vitest
  // on l'injecte via globalThis.Deno shim.
  ;(globalThis as unknown as { Deno: { env: { get: (k: string) => string | undefined } } }).Deno = {
    env: { get: (k: string) => (k === 'MEGGA_MAGIC_LINK_HMAC_SECRET' ? 'x'.repeat(40) : undefined) },
  }
})

describe('magic-link-token: champ p (profile id)', () => {
  it('round-trip un token avec p et le restitue', async () => {
    const exp = Math.floor(Date.now() / 1000) + 300
    const token = await signMagicLinkToken({ id: 'dossier-123', exp, p: 'profile-abc' })
    const res = await verifyMagicLinkToken(token)
    expect(res.valid).toBe(true)
    expect(res.payload?.id).toBe('dossier-123')
    expect(res.payload?.p).toBe('profile-abc')
  })

  it('reste compatible avec un token sans p', async () => {
    const exp = Math.floor(Date.now() / 1000) + 300
    const token = await signMagicLinkToken({ id: 'm-link-1', exp })
    const res = await verifyMagicLinkToken(token)
    expect(res.valid).toBe(true)
    expect(res.payload?.p).toBeUndefined()
  })
})
