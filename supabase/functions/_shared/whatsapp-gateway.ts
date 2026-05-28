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
  timestamp: string | null
  raw: unknown
}

export type NormalizedMediaType =
  | 'image' | 'audio' | 'video' | 'document' | 'location' | 'contact' | 'sticker'

export interface WhatsAppProvider {
  readonly name: 'openwa' | 'meta'
  parseInbound(payload: unknown): NormalizedInboundMessage | null
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
      timestamp: ts ? new Date(ts * 1000).toISOString() : null,
      raw: payload,
    }
  }
}

const PROVIDERS: Record<string, WhatsAppProvider> = {
  openwa: new OpenWAProvider(),
}

export function getProvider(name = 'openwa'): WhatsAppProvider {
  const p = PROVIDERS[name]
  if (!p) throw new Error(`Unknown WhatsApp provider: ${name}`)
  return p
}
