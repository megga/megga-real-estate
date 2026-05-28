import { describe, it, expect } from 'vitest'
import { getProvider, verifyHmac, type NormalizedInboundMessage } from './whatsapp-gateway'

describe('whatsapp-gateway — OpenWA provider', () => {
  const provider = getProvider('openwa')

  it('parse un event message.received en message normalisé', () => {
    const payload = {
      event: 'message.received',
      sessionId: 'sess_123',
      data: {
        id: 'wamid.ABC',
        from: '41791112233@c.us',
        to: '41220000000@c.us',
        body: 'Bonjour, je veux visiter',
        type: 'chat',
        timestamp: 1716900000,
      },
    }
    const msg = provider.parseInbound(payload) as NormalizedInboundMessage
    expect(msg).not.toBeNull()
    expect(msg.providerMessageId).toBe('wamid.ABC')
    expect(msg.fromPhone).toBe('41791112233')
    expect(msg.toPhone).toBe('41220000000')
    expect(msg.body).toBe('Bonjour, je veux visiter')
    expect(msg.mediaType).toBeNull()
    expect(msg.sessionId).toBe('sess_123')
  })

  it('mappe un type média', () => {
    const msg = provider.parseInbound({
      event: 'message.received',
      sessionId: 's',
      data: { id: 'm2', from: '41790000000@c.us', type: 'image', body: '', caption: 'photo', timestamp: 1 },
    })
    expect(msg?.mediaType).toBe('image')
  })

  it('ignore les events non pertinents (message.sent, status)', () => {
    expect(provider.parseInbound({ event: 'message.sent', data: { id: 'x' } })).toBeNull()
    expect(provider.parseInbound({ event: 'session.connected', data: {} })).toBeNull()
  })

  it('verifyHmac valide une signature correcte et rejette une mauvaise', async () => {
    const secret = 'topsecret'
    const raw = '{"event":"message.received","data":{"id":"m"}}'
    const enc = new TextEncoder()
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(raw))
    const hex = [...new Uint8Array(sigBuf)].map(b => b.toString(16).padStart(2, '0')).join('')
    const good = `sha256=${hex}`
    expect(await verifyHmac(raw, good, secret)).toBe(true)
    expect(await verifyHmac(raw, 'sha256=deadbeef', secret)).toBe(false)
    expect(await verifyHmac(raw, '', secret)).toBe(false)
  })
})
