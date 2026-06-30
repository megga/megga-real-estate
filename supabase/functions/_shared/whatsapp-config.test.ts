import { describe, it, expect } from 'vitest'
import { isWhatsAppEnabled } from './whatsapp-config'

// Client Supabase mocké : renvoie la ligne app_config demandée (ou null), ou lève.
function mk(value: string | null | undefined, opts: { throws?: boolean } = {}) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: () => Promise.resolve({ data: value === undefined ? null : { value } }),
  }
  const client = {
    from: () => { if (opts.throws) throw new Error('db down'); return builder },
  }
  return client as unknown as Parameters<typeof isWhatsAppEnabled>[0]
}

describe('isWhatsAppEnabled (kill-switch)', () => {
  it('actif par défaut (ligne absente)', async () => {
    expect(await isWhatsAppEnabled(mk(undefined))).toBe(true)
  })
  it("coupé seulement sur la valeur explicite 'false' (insensible à la casse)", async () => {
    expect(await isWhatsAppEnabled(mk('false'))).toBe(false)
    expect(await isWhatsAppEnabled(mk('FALSE'))).toBe(false)
    expect(await isWhatsAppEnabled(mk(' false '))).toBe(false)
  })
  it("actif sur 'true' ou toute autre valeur", async () => {
    expect(await isWhatsAppEnabled(mk('true'))).toBe(true)
    expect(await isWhatsAppEnabled(mk('1'))).toBe(true)
  })
  it('fail-OPEN : erreur de lecture → actif (ne coupe pas un système sain)', async () => {
    expect(await isWhatsAppEnabled(mk(null, { throws: true }))).toBe(true)
  })
})
