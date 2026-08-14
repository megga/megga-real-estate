import { describe, it, expect } from 'vitest'
import { getProvider, verifyHmac, constantTimeEqual, allowedPriorStatuses, isDialablePhone, PHONE_MIN_DIGITS, PHONE_MAX_DIGITS, type NormalizedInboundMessage } from './whatsapp-gateway'

// Régression de l'audit du 03.08.2026 §4.2. Le webhook choisissait sa branche de
// vérification d'après l'en-tête envoyé par l'APPELANT : sans
// `x-hub-signature-256`, il retombait sur OpenWA et sa propre clé. L'attaquant
// choisissait donc lequel des deux secrets forger. Ces tests garantissent que le
// second chemin ne peut pas revenir par inadvertance.
describe('whatsapp-gateway — OpenWA est retiré, pas désactivé', () => {
  it('getProvider("openwa") lève — le provider n’existe plus dans le registre', () => {
    expect(() => getProvider('openwa')).toThrow(/Unknown WhatsApp provider/)
  })

  it('un nom absent lève au lieu de retomber silencieusement sur un provider', () => {
    // Le défaut valait 'openwa' : un appelant distrait obtenait le prototype
    // sans le savoir. Il n'y a plus de défaut — l'absence de nom échoue fort.
    //
    // Assertion d'EXÉCUTION seulement, à dessein : `tsc` ne couvre pas
    // supabase/functions (tsconfig.app/node ne l'incluent pas), donc un
    // `@ts-expect-error` n'y serait vérifié par personne et donnerait une
    // fausse impression de garde statique.
    expect(() => getProvider(undefined as unknown as string)).toThrow(/Unknown WhatsApp provider/)
    expect(() => getProvider('')).toThrow(/Unknown WhatsApp provider/)
  })

  it('meta reste le seul provider résolvable', () => {
    expect(getProvider('meta').name).toBe('meta')
  })
})

describe('constantTimeEqual', () => {
  it('vrai sur égalité, faux sur différence', () => {
    expect(constantTimeEqual('abc123', 'abc123')).toBe(true)
    expect(constantTimeEqual('abc123', 'abc124')).toBe(false)
  })

  it('faux sur longueurs différentes, y compris préfixe commun', () => {
    expect(constantTimeEqual('abc', 'abcd')).toBe(false)
    expect(constantTimeEqual('', 'a')).toBe(false)
  })

  it('vrai sur deux chaînes vides', () => {
    expect(constantTimeEqual('', '')).toBe(true)
  })
})

describe('whatsapp-gateway — signature entrante', () => {
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
    // Sécurité attribution : sans display_phone_number, toPhone doit être NULL — JAMAIS le
    // phone_number_id (ID de compte ~15 chiffres) qui collisionnerait au routage wa_to→agence.
    expect(m.toPhone).toBeNull()
    expect(m.sessionId).toBe('123') // le phone_number_id reste en sessionId (usage légitime)
  })

  it('toPhone = display_phone_number quand présent (numéro Business réel)', () => {
    const m = meta.parseInbound({
      object: 'whatsapp_business_account',
      entry: [{ changes: [{ field: 'messages', value: {
        metadata: { display_phone_number: '41 79 874 94 84', phone_number_id: '123' },
        messages: [{ from: '41780001122', id: 'wamid.TXT2', timestamp: '1717000000', type: 'text', text: { body: 'salut' } }],
      } }] }],
    }) as NormalizedInboundMessage
    expect(m.toPhone).toBe('41798749484') // digits-only du vrai numéro Business
  })
})

// Le bouton d'opt-out que Meta attache lui-même aux templates marketing arrive en
// `type:'button'` ou `type:'interactive'` : ni `text.body` ni `caption`. `body` valait donc
// null, et le seul chemin de désinscription que Meta met en avant était invisible côté MEGGA.
describe('whatsapp-gateway — réponses à un bouton (opt-out Meta)', () => {
  const meta = getProvider('meta')
  const inbound = (message: Record<string, unknown>) => meta.parseInbound({
    object: 'whatsapp_business_account',
    entry: [{ changes: [{ field: 'messages', value: {
      metadata: { display_phone_number: '41225670075', phone_number_id: '123' },
      messages: [{ from: '41780001122', id: 'wamid.B1', timestamp: '1717000000', ...message }],
    } }] }],
  }) as NormalizedInboundMessage | null

  it('type:button → le libellé du bouton devient le corps', () => {
    const m = inbound({ type: 'button', button: { text: 'Stop promotions', payload: 'STOP_PROMO' } })
    expect(m?.body).toBe('Stop promotions')
    expect(m?.mediaType).toBeNull()   // 'button' n'est pas un média
    expect(m?.mediaId).toBeNull()
  })

  it('type:button sans libellé → repli sur le payload', () => {
    expect(inbound({ type: 'button', button: { payload: 'STOP_PROMO' } })?.body).toBe('STOP_PROMO')
  })

  it('interactive/button_reply → le TITRE, jamais l’id technique', () => {
    const m = inbound({ type: 'interactive', interactive: {
      type: 'button_reply', button_reply: { id: 'wa_optout_v2', title: 'Ne plus recevoir' },
    } })
    expect(m?.body).toBe('Ne plus recevoir')
    expect(m?.body).not.toContain('wa_optout_v2')
  })

  it('interactive/list_reply → le titre de l’entrée choisie', () => {
    const m = inbound({ type: 'interactive', interactive: {
      type: 'list_reply', list_reply: { id: 'row_3', title: 'Me désinscrire' },
    } })
    expect(m?.body).toBe('Me désinscrire')
  })

  it('un texte l’emporte toujours sur un bouton présent dans le même message', () => {
    const m = inbound({ type: 'text', text: { body: 'bonjour' }, button: { text: 'Stop promotions' } })
    expect(m?.body).toBe('bonjour')
  })

  it('aucun corps exploitable → body reste null (pas de chaîne vide fabriquée)', () => {
    expect(inbound({ type: 'button', button: {} })?.body).toBeNull()
    expect(inbound({ type: 'interactive', interactive: {} })?.body).toBeNull()
  })
})

describe('isDialablePhone — bornage 6–15 chiffres', () => {
  it('accepte un numéro suisse et un E.164 de longueur maximale', () => {
    expect(isDialablePhone('41791112233')).toBe(true)
    expect(isDialablePhone('079 111 22 33')).toBe(true)   // séparateurs ignorés
    expect(isDialablePhone('1'.repeat(PHONE_MAX_DIGITS))).toBe(true)
    expect(isDialablePhone('1'.repeat(PHONE_MIN_DIGITS))).toBe(true)
  })

  it('refuse trop court, trop long, vide et absent', () => {
    expect(isDialablePhone('1'.repeat(PHONE_MIN_DIGITS - 1))).toBe(false)
    expect(isDialablePhone('1'.repeat(PHONE_MAX_DIGITS + 1))).toBe(false)
    expect(isDialablePhone('')).toBe(false)
    expect(isDialablePhone(null)).toBe(false)
    expect(isDialablePhone(undefined)).toBe(false)
    expect(isDialablePhone('bonjour')).toBe(false)        // 0 chiffre
  })

  it('refuse un JID de groupe (18 chiffres) — le cas qui motive la borne haute', () => {
    expect(isDialablePhone('120363123456789012@g.us')).toBe(false)
  })
})

describe('parseInbound — un expéditeur hors bornes est ignoré, pas inséré', () => {
  const meta = getProvider('meta')
  const from = (value: unknown) => meta.parseInbound({
    object: 'whatsapp_business_account',
    entry: [{ changes: [{ field: 'messages', value: {
      metadata: { phone_number_id: '123' },
      messages: [{ from: value, id: 'wamid.G1', timestamp: '1717000000', type: 'text', text: { body: 'salut' } }],
    } }] }],
  })

  it('un JID de groupe rend null — sinon insert en échec → 500 → rejeu Meta en boucle', () => {
    expect(from('120363123456789012@g.us')).toBeNull()
  })

  it('un expéditeur absent rend null au lieu d’un numéro vide', () => {
    expect(from(undefined)).toBeNull()
    expect(from('')).toBeNull()
  })

  it('un numéro normal reste parsé', () => {
    expect((from('41780001122') as NormalizedInboundMessage).fromPhone).toBe('41780001122')
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
})
