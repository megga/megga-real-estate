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

describe('whatsapp-gateway — outbound send', () => {
  it('Meta: build request targets Graph API with token + text body', () => {
    const p = getProvider('meta')
    const req = p.buildSendTextRequest({ toPhone: '41791112233', body: 'Bonjour' }, { metaToken: 'TKN', metaPhoneNumberId: '123' })
    expect(req.url).toBe('https://graph.facebook.com/v22.0/123/messages')
    expect(req.headers.Authorization).toBe('Bearer TKN')
    const body = JSON.parse(req.body)
    expect(body).toMatchObject({ messaging_product: 'whatsapp', to: '41791112233', type: 'text', text: { body: 'Bonjour' } })
  })
  it('Meta: parseSendResult extracts message id on success / error on failure', () => {
    const p = getProvider('meta')
    expect(p.parseSendResult(200, { messages: [{ id: 'wamid.X' }] })).toEqual({ ok: true, providerMessageId: 'wamid.X' })
    expect(p.parseSendResult(400, { error: { message: 'Bad' } })).toEqual({ ok: false, providerMessageId: null, error: 'Bad' })
  })
  it('OpenWA: build request targets local send-text endpoint', () => {
    const p = getProvider('openwa')
    const req = p.buildSendTextRequest({ toPhone: '41790000000', body: 'Hi' }, { openwaBaseUrl: 'http://localhost:2785', openwaApiKey: 'k', openwaSessionId: 's1' })
    expect(req.url).toBe('http://localhost:2785/api/sessions/s1/messages/send-text')
    expect(req.headers['X-API-Key']).toBe('k')
    expect(JSON.parse(req.body)).toEqual({ to: '41790000000', message: 'Hi' })
  })
})

describe('whatsapp-gateway — Meta média entrant', () => {
  const meta = getProvider('meta')
  const audioPayload = {
    object: 'whatsapp_business_account',
    entry: [{ changes: [{ field: 'messages', value: {
      metadata: { display_phone_number: '41791112233', phone_number_id: '123' },
      messages: [{
        from: '41780001122', id: 'wamid.AUDIO1', timestamp: '1717000000',
        type: 'audio', audio: { id: 'MEDIA_AUDIO_42', mime_type: 'audio/ogg; codecs=opus', voice: true },
      }],
    } }] }],
  }

  it('extrait mediaId + mediaMime pour un vocal', () => {
    const m = meta.parseInbound(audioPayload) as NormalizedInboundMessage
    expect(m.mediaType).toBe('audio')
    expect(m.mediaId).toBe('MEDIA_AUDIO_42')
    expect(m.mediaMime).toBe('audio/ogg; codecs=opus')
  })

  it('mediaId = null pour un texte', () => {
    const textPayload = {
      object: 'whatsapp_business_account',
      entry: [{ changes: [{ field: 'messages', value: {
        metadata: { phone_number_id: '123' },
        messages: [{ from: '41780001122', id: 'wamid.TXT1', timestamp: '1717000000', type: 'text', text: { body: 'bonjour' } }],
      } }] }],
    }
    const m = meta.parseInbound(textPayload) as NormalizedInboundMessage
    expect(m.mediaId).toBeNull()
  })
})
