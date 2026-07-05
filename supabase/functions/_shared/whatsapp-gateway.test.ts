import { describe, it, expect } from 'vitest'
import { getProvider, verifyHmac, allowedPriorStatuses, type NormalizedInboundMessage } from './whatsapp-gateway'

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

describe('Meta buildSendDocumentRequest', () => {
  it('construit une requête document Meta valide', () => {
    const meta = getProvider('meta')
    expect(meta.buildSendDocumentRequest).toBeDefined()
    const req = meta.buildSendDocumentRequest!(
      { toPhone: '41791112233', mediaId: 'MEDIA_42', filename: 'Rapport-KYC-2026-AB3F.pdf', caption: 'KYC-2026-AB3F' },
      { metaToken: 'TOK', metaPhoneNumberId: 'PNID', metaApiVersion: 'v22.0' },
    )
    expect(req.url).toBe('https://graph.facebook.com/v22.0/PNID/messages')
    expect(req.headers.Authorization).toBe('Bearer TOK')
    const body = JSON.parse(req.body)
    expect(body).toMatchObject({
      messaging_product: 'whatsapp',
      to: '41791112233',
      type: 'document',
      document: { id: 'MEDIA_42', filename: 'Rapport-KYC-2026-AB3F.pdf', caption: 'KYC-2026-AB3F' },
    })
  })

  it('omet caption du body quand non fourni', () => {
    const meta = getProvider('meta')
    const req = meta.buildSendDocumentRequest!(
      { toPhone: '41791112233', mediaId: 'M1', filename: 'r.pdf' },
      { metaToken: 'TOK', metaPhoneNumberId: 'PNID', metaApiVersion: 'v22.0' },
    )
    const body = JSON.parse(req.body)
    expect('caption' in body.document).toBe(false)
    expect(body.document).toEqual({ id: 'M1', filename: 'r.pdf' })
  })
})

describe('Meta buildSendImageRequest', () => {
  it('construit une requête image par lien (pas d’upload média)', () => {
    const meta = getProvider('meta')
    expect(meta.buildSendImageRequest).toBeDefined()
    const req = meta.buildSendImageRequest!(
      { toPhone: '41791112233', link: 'https://img.megga.ch/l/abc/0-detail.jpg', caption: 'Appartement 3,5 p. — CHF 2\'450/mois' },
      { metaToken: 'TOK', metaPhoneNumberId: 'PNID', metaApiVersion: 'v22.0' },
    )
    expect(req.url).toBe('https://graph.facebook.com/v22.0/PNID/messages')
    expect(req.headers.Authorization).toBe('Bearer TOK')
    const body = JSON.parse(req.body)
    expect(body).toMatchObject({
      messaging_product: 'whatsapp',
      to: '41791112233',
      type: 'image',
      image: { link: 'https://img.megga.ch/l/abc/0-detail.jpg', caption: 'Appartement 3,5 p. — CHF 2\'450/mois' },
    })
  })

  it('omet caption du body quand non fournie', () => {
    const meta = getProvider('meta')
    const req = meta.buildSendImageRequest!(
      { toPhone: '41791112233', link: 'https://img.megga.ch/x.jpg' },
      { metaToken: 'TOK', metaPhoneNumberId: 'PNID', metaApiVersion: 'v22.0' },
    )
    const body = JSON.parse(req.body)
    expect('caption' in body.image).toBe(false)
    expect(body.image).toEqual({ link: 'https://img.megga.ch/x.jpg' })
  })

  it('absent chez OpenWA (prototype legacy)', () => {
    expect(getProvider('openwa').buildSendImageRequest).toBeUndefined()
  })
})

describe('whatsapp-gateway — statuts de livraison Meta', () => {
  const meta = getProvider('meta')
  const statusPayload = (statuses: unknown[]) => ({
    object: 'whatsapp_business_account',
    entry: [{ changes: [{ field: 'messages', value: { metadata: { phone_number_id: '123' }, statuses } }] }],
  })

  it('parse un event delivered', () => {
    const ups = meta.parseStatusUpdates!(statusPayload([
      { id: 'wamid.OUT1', status: 'delivered', timestamp: '1717000000', recipient_id: '41791112233' },
    ]))
    expect(ups).toHaveLength(1)
    expect(ups[0]).toMatchObject({
      providerMessageId: 'wamid.OUT1', status: 'delivered',
      recipientPhone: '41791112233', errorCode: null, errorDetail: null,
    })
    expect(ups[0].timestamp).toBe(new Date(1717000000 * 1000).toISOString())
  })

  it('parse un failed avec erreur 131047 (code + détail)', () => {
    const ups = meta.parseStatusUpdates!(statusPayload([
      { id: 'wamid.OUT2', status: 'failed', timestamp: '1717000001', recipient_id: '41791112233',
        errors: [{ code: 131047, title: 'Re-engagement message', error_data: { details: 'Message failed to send because more than 24 hours have passed' } }] },
    ]))
    expect(ups[0].status).toBe('failed')
    expect(ups[0].errorCode).toBe(131047)
    expect(ups[0].errorDetail).toContain('24 hours')
  })

  it('parse plusieurs statuses d\'un coup et ignore les statuts inconnus', () => {
    const ups = meta.parseStatusUpdates!(statusPayload([
      { id: 'a', status: 'sent', timestamp: '1' },
      { id: 'b', status: 'read', timestamp: '2' },
      { id: 'c', status: 'warmup' }, // hors contrat → ignoré
    ]))
    expect(ups.map(u => u.status)).toEqual(['sent', 'read'])
  })

  it('renvoie [] pour un payload message entrant (pas de statuses)', () => {
    const inbound = {
      object: 'whatsapp_business_account',
      entry: [{ changes: [{ field: 'messages', value: {
        messages: [{ id: 'wamid.IN', from: '41780001122', type: 'text', text: { body: 'salut' } }],
      } }] }],
    }
    expect(meta.parseStatusUpdates!(inbound)).toEqual([])
  })

  it('OpenWA n\'expose pas parseStatusUpdates (méthode absente)', () => {
    expect(getProvider('openwa').parseStatusUpdates).toBeUndefined()
  })
})

describe('allowedPriorStatuses — progression monotone', () => {
  it('chaque statut n\'avance que depuis un statut antérieur', () => {
    expect(allowedPriorStatuses('sent')).toEqual(['received'])
    expect(allowedPriorStatuses('delivered')).toEqual(['received', 'sent'])
    expect(allowedPriorStatuses('read')).toEqual(['received', 'sent', 'delivered'])
    expect(allowedPriorStatuses('failed')).toEqual(['received', 'sent', 'delivered'])
  })
  it('read n\'est jamais rétrogradé (delivered/failed en retard → no-op)', () => {
    expect(allowedPriorStatuses('delivered')).not.toContain('read')
    expect(allowedPriorStatuses('failed')).not.toContain('read')
  })
  it('failed est terminal (absent de toutes les listes)', () => {
    for (const s of ['sent', 'delivered', 'read', 'failed'] as const) {
      expect(allowedPriorStatuses(s)).not.toContain('failed')
    }
  })
})

describe('buildMarkReadRequest (Meta)', () => {
  const meta = getProvider('meta')
  const config = { metaToken: 'TK', metaPhoneNumberId: '123', metaApiVersion: 'v22.0' }

  it('construit la requête accusé de lecture (coches bleues)', () => {
    const req = meta.buildMarkReadRequest!('wamid.XYZ', config)
    expect(req.url).toBe('https://graph.facebook.com/v22.0/123/messages')
    expect(req.method).toBe('POST')
    const body = JSON.parse(req.body)
    expect(body).toMatchObject({ messaging_product: 'whatsapp', status: 'read', message_id: 'wamid.XYZ' })
    expect(body.typing_indicator).toBeUndefined()
  })
  it('ajoute l’indicateur typing si demandé', () => {
    const body = JSON.parse(meta.buildMarkReadRequest!('wamid.XYZ', config, { typing: true }).body)
    expect(body.typing_indicator).toEqual({ type: 'text' })
  })
  it('OpenWA ne supporte pas le mark-read (méthode absente)', () => {
    expect(getProvider('openwa').buildMarkReadRequest).toBeUndefined()
  })
})
