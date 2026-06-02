// Couche d'abstraction provider WhatsApp. Le code applicatif (edge function,
// futur envoi) parle à cette interface, jamais directement à OpenWA ni Meta.
// Phase 1 : entrant seulement (parseInbound + verifyHmac). L'envoi (send) sera
// ajouté en Phase 2.
// N'utilise que la Web Crypto API → testable Vitest (Node) ET exécutable Deno.

export interface NormalizedInboundMessage {
  providerMessageId: string
  sessionId: string | null
  fromPhone: string
  toPhone: string | null
  body: string | null
  mediaType: NormalizedMediaType | null
  mediaUrl: string | null
  mediaId: string | null
  mediaMime: string | null
  timestamp: string | null
  raw: unknown
}

export type NormalizedMediaType =
  | 'image' | 'audio' | 'video' | 'document' | 'location' | 'contact' | 'sticker'

export interface OutboundTextMessage {
  toPhone: string   // digits only, international without +
  body: string
}

export interface SendConfig {
  // Meta Cloud API
  metaToken?: string
  metaPhoneNumberId?: string
  metaApiVersion?: string        // default 'v22.0'
  // OpenWA
  openwaBaseUrl?: string          // e.g. http://localhost:2785
  openwaApiKey?: string
  openwaSessionId?: string
}

export interface SendHttpRequest {
  url: string
  method: 'POST'
  headers: Record<string, string>
  body: string                    // JSON string
}

export interface SendResult {
  ok: boolean
  providerMessageId: string | null
  error?: string
}

export interface WhatsAppProvider {
  readonly name: 'openwa' | 'meta'
  parseInbound(payload: unknown): NormalizedInboundMessage | null
  buildSendTextRequest(msg: OutboundTextMessage, config: SendConfig): SendHttpRequest
  parseSendResult(status: number, responseBody: unknown): SendResult
}

export function normalizePhone(jid: string): string {
  return (jid || '').split('@')[0].replace(/\D/g, '')
}

const OPENWA_TYPE_TO_MEDIA: Record<string, NormalizedMediaType> = {
  image: 'image', audio: 'audio', ptt: 'audio', video: 'video',
  document: 'document', location: 'location', vcard: 'contact', sticker: 'sticker',
}

export async function verifyHmac(rawBody: string, signatureHeader: string, secret: string): Promise<boolean> {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false
  const provided = signatureHeader.slice('sha256='.length)
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody))
  const expected = [...new Uint8Array(sigBuf)].map(b => b.toString(16).padStart(2, '0')).join('')
  if (provided.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i)
  return diff === 0
}

class OpenWAProvider implements WhatsAppProvider {
  readonly name = 'openwa' as const

  parseInbound(payload: unknown): NormalizedInboundMessage | null {
    const p = payload as Record<string, unknown>
    if (!p || p.event !== 'message.received') return null
    const data = (p.data ?? {}) as Record<string, unknown>
    const id = data.id as string | undefined
    const from = data.from as string | undefined
    if (!id || !from) return null
    const type = (data.type as string) || 'chat'
    const mediaType = OPENWA_TYPE_TO_MEDIA[type] ?? null
    const ts = data.timestamp as number | undefined
    return {
      providerMessageId: id,
      sessionId: (p.sessionId as string) ?? null,
      fromPhone: normalizePhone(from),
      toPhone: data.to ? normalizePhone(data.to as string) : null,
      body: (data.body as string) || (data.caption as string) || null,
      mediaType,
      mediaUrl: (data.mediaUrl as string) ?? null,
      mediaId: null,
      mediaMime: null,
      timestamp: ts ? new Date(ts * 1000).toISOString() : null,
      raw: payload,
    }
  }

  buildSendTextRequest(msg: OutboundTextMessage, config: SendConfig): SendHttpRequest {
    return {
      url: `${config.openwaBaseUrl}/api/sessions/${config.openwaSessionId}/messages/send-text`,
      method: 'POST',
      headers: {
        'X-API-Key': config.openwaApiKey ?? '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to: msg.toPhone, message: msg.body }),
    }
  }

  parseSendResult(status: number, responseBody: unknown): SendResult {
    const body = responseBody as Record<string, unknown>
    if (status >= 200 && status < 300) {
      const id =
        (body.id as string) ??
        ((body.data as Record<string, unknown>)?.id as string) ??
        null
      return { ok: true, providerMessageId: id }
    }
    return { ok: false, providerMessageId: null, error: 'HTTP ' + status }
  }
}

// ── Meta Cloud API provider ──────────────────────────────────────
// Payload Meta : { object:'whatsapp_business_account', entry:[{ changes:[{
//   field:'messages', value:{ messages:[...], metadata:{...} } }] }] }
// Signature : header X-Hub-Signature-256 = sha256=HMAC-SHA256(app_secret, rawBody)
// → on réutilise verifyHmac() tel quel (même schéma que OpenWA).

const META_TYPE_TO_MEDIA: Record<string, NormalizedMediaType> = {
  image: 'image', audio: 'audio', voice: 'audio', video: 'video',
  document: 'document', location: 'location', contacts: 'contact', sticker: 'sticker',
}

class MetaProvider implements WhatsAppProvider {
  readonly name = 'meta' as const

  parseInbound(payload: unknown): NormalizedInboundMessage | null {
    const p = payload as Record<string, unknown>
    if (!p || p.object !== 'whatsapp_business_account') return null
    const entry = (p.entry as Record<string, unknown>[] | undefined)?.[0]
    const changes = entry?.changes as Record<string, unknown>[] | undefined
    const change = changes?.find((c) => c.field === 'messages') ?? changes?.[0]
    const value = change?.value as Record<string, unknown> | undefined
    const message = (value?.messages as Record<string, unknown>[] | undefined)?.[0]
    if (!message) return null // statuses-only / events non-message → ignorer
    const metadata = value?.metadata as Record<string, unknown> | undefined
    const type = (message.type as string) || 'text'
    const text = message.text as { body?: string } | undefined
    const mediaObj = message[type] as { id?: string; mime_type?: string; caption?: string } | undefined
    const tsRaw = message.timestamp as string | number | undefined
    const ts = tsRaw != null ? Number(tsRaw) : undefined
    return {
      providerMessageId: message.id as string,
      sessionId: (metadata?.phone_number_id as string) ?? null,
      fromPhone: normalizePhone(message.from as string),
      toPhone: metadata?.display_phone_number
        ? normalizePhone(metadata.display_phone_number as string)
        : ((metadata?.phone_number_id as string) ?? null),
      body: text?.body ?? mediaObj?.caption ?? null,
      mediaType: META_TYPE_TO_MEDIA[type] ?? null,
      mediaUrl: null, // bytes récupérés en différé via Graph API (whatsapp-media)
      mediaId: mediaObj?.id ?? null,
      mediaMime: mediaObj?.mime_type ?? null,
      timestamp: ts ? new Date(ts * 1000).toISOString() : null,
      raw: payload,
    }
  }

  buildSendTextRequest(msg: OutboundTextMessage, config: SendConfig): SendHttpRequest {
    const apiVersion = config.metaApiVersion ?? 'v22.0'
    return {
      url: `https://graph.facebook.com/${apiVersion}/${config.metaPhoneNumberId}/messages`,
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + config.metaToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: msg.toPhone,
        type: 'text',
        text: { body: msg.body },
      }),
    }
  }

  parseSendResult(status: number, responseBody: unknown): SendResult {
    const body = responseBody as Record<string, unknown>
    if (status >= 200 && status < 300) {
      const id = (body.messages as Array<{ id?: string }>)?.[0]?.id ?? null
      return { ok: true, providerMessageId: id }
    }
    const err =
      ((body.error as Record<string, unknown>)?.message as string) ?? `HTTP ${status}`
    return { ok: false, providerMessageId: null, error: err }
  }
}

const PROVIDERS: Record<string, WhatsAppProvider> = {
  openwa: new OpenWAProvider(),
  meta: new MetaProvider(),
}

export function getProvider(name = 'openwa'): WhatsAppProvider {
  const p = PROVIDERS[name]
  if (!p) throw new Error(`Unknown WhatsApp provider: ${name}`)
  return p
}
