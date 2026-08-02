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

describe('magic-link-token: discriminant k (nature du lien)', () => {
  it('round-trip un jeton de rendez-vous', async () => {
    const exp = Math.floor(Date.now() / 1000) + 300
    const token = await signMagicLinkToken({ id: 'appt-1', exp, k: 'appt' })
    const res = await verifyMagicLinkToken(token)
    expect(res.valid).toBe(true)
    expect(res.payload?.k).toBe('appt')
  })

  it('laisse k absent sur un lien magique KYC — les jetons en circulation restent valides', async () => {
    const exp = Math.floor(Date.now() / 1000) + 300
    const token = await signMagicLinkToken({ id: 'm-link-2', exp })
    const res = await verifyMagicLinkToken(token)
    expect(res.valid).toBe(true)
    expect(res.payload?.k).toBeUndefined()
  })

  it('le discriminant est couvert par la signature — le modifier invalide le jeton', async () => {
    const exp = Math.floor(Date.now() / 1000) + 300
    const token = await signMagicLinkToken({ id: 'appt-2', exp, k: 'appt' })
    const [payloadB64, sig] = token.split('.')
    // Réécrit le payload sans `k` en conservant la signature d'origine : c'est
    // exactement ce que tenterait un porteur voulant faire passer un jeton de
    // rendez-vous pour un lien KYC.
    const tampered = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')))
    delete tampered.k
    const forged = btoa(JSON.stringify(tampered)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    const res = await verifyMagicLinkToken(`${forged}.${sig}`)
    expect(res.valid).toBe(false)
    expect(res.reason).toBe('invalid_signature')
  })
})
