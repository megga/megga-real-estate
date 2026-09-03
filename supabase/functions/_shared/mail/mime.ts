// supabase/functions/_shared/mail/mime.ts
// Adresses, RFC 2047, base64url, HTML↔texte, construction d'un message RFC 5322.
// PUR (aucun import runtime) : testé sous Node, exécuté sous Deno.
import type { MailAddress, OutgoingMessage } from './types.ts'

const CRLF = '\r\n'

// ── base64 / base64url ────────────────────────────────────────────────────────
function bytesToBinary(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return s
}
function binaryToBytes(bin: string): Uint8Array {
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
export function base64Encode(bytes: Uint8Array): string {
  return btoa(bytesToBinary(bytes))
}
export function base64Decode(b64: string): Uint8Array {
  return binaryToBytes(atob(b64.replace(/\s+/g, '')))
}
export function base64UrlEncode(bytes: Uint8Array): string {
  return base64Encode(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
export function base64UrlEncodeString(s: string): string {
  return base64UrlEncode(new TextEncoder().encode(s))
}
export function base64UrlDecodeToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4))
  return base64Decode(b64 + pad)
}
export function base64UrlDecodeToString(s: string): string {
  return new TextDecoder().decode(base64UrlDecodeToBytes(s))
}
/** Plie une chaîne base64 à 76 colonnes (RFC 2045). */
export function foldBase64(b64: string): string {
  return (b64.match(/.{1,76}/g) ?? []).join(CRLF)
}

// ── RFC 2047 ──────────────────────────────────────────────────────────────────
/** Décode les mots encodés `=?charset?B|Q?…?=` d'un en-tête. */
export function decodeRfc2047(s: string): string {
  if (!s || !s.includes('=?')) return s
  return s.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=(\s*(?==\?))?/g, (_m, charset: string, enc: string, text: string) => {
    let bytes: Uint8Array
    if (enc.toUpperCase() === 'B') {
      bytes = base64Decode(text)
    } else {
      const bin = text.replace(/_/g, ' ').replace(/=([0-9A-Fa-f]{2})/g, (_x, h: string) => String.fromCharCode(parseInt(h, 16)))
      bytes = binaryToBytes(bin)
    }
    try {
      return new TextDecoder(charset.toLowerCase()).decode(bytes)
    } catch {
      return new TextDecoder('utf-8').decode(bytes)
    }
  })
}

/** Encode un mot d'en-tête si non ASCII (`=?UTF-8?B?…?=`), sinon tel quel. */
export function encodeHeaderWord(s: string): string {
  if (!/[^\x20-\x7e]/.test(s)) return s
  return `=?UTF-8?B?${base64Encode(new TextEncoder().encode(s))}?=`
}

// ── Adresses ─────────────────────────────────────────────────────────────────
export function parseAddress(raw: string): MailAddress | null {
  const s = decodeRfc2047((raw ?? '').trim())
  if (!s) return null
  const m = s.match(/^(?:"?([^"<]*)"?\s*)?<([^>]+)>$/)
  if (m) {
    const name = (m[1] ?? '').trim()
    return { name: name || null, email: m[2].trim().toLowerCase() }
  }
  const bare = s.replace(/^<|>$/g, '').trim()
  if (!bare.includes('@')) return null
  return { name: null, email: bare.toLowerCase() }
}

/** Sépare sur les virgules qui ne sont ni entre guillemets ni entre chevrons. */
export function parseAddressList(raw: string): MailAddress[] {
  const out: MailAddress[] = []
  let cur = ''
  let quoted = false
  let angle = 0
  for (const ch of raw ?? '') {
    if (ch === '"') quoted = !quoted
    else if (ch === '<' && !quoted) angle++
    else if (ch === '>' && !quoted) angle = Math.max(0, angle - 1)
    if (ch === ',' && !quoted && angle === 0) {
      const a = parseAddress(cur)
      if (a) out.push(a)
      cur = ''
    } else {
      cur += ch
    }
  }
  const last = parseAddress(cur)
  if (last) out.push(last)
  return out
}

export function formatAddress(a: MailAddress): string {
  return a.name ? `${encodeHeaderWord(a.name)} <${a.email}>` : a.email
}

// ── Corps ─────────────────────────────────────────────────────────────────────
const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  eacute: 'é', egrave: 'è', ecirc: 'ê', agrave: 'à', acirc: 'â', ccedil: 'ç',
  ocirc: 'ô', ucirc: 'û', ugrave: 'ù', icirc: 'î', iuml: 'ï', euml: 'ë', uuml: 'ü', ouml: 'ö', auml: 'ä',
}
function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_m, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d: string) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n: string) => ENTITIES[n.toLowerCase()] ?? m)
}

/** HTML → texte lisible : scripts/styles retirés, blocs en lignes, entités décodées. */
export function htmlToText(html: string): string {
  return decodeEntities(
    (html ?? '')
      .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|tr|li|h[1-6]|blockquote|pre|table)>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Texte → HTML : un `<p>` par paragraphe (ligne vide), `<br>` pour les retours simples. */
export function textToHtml(text: string): string {
  return (text ?? '')
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

export function snippetOf(text: string, max = 160): string {
  const s = (text ?? '').replace(/\s+/g, ' ').trim()
  return s.length > max ? s.slice(0, max) : s
}

export function makeMessageId(domain: string): string {
  return `<${crypto.randomUUID()}@${domain}>`
}

// ── Construction RFC 5322 ─────────────────────────────────────────────────────
function boundary(tag: string): string {
  return `=_megga_${tag}_${crypto.randomUUID().replace(/-/g, '')}`
}

/**
 * Construit le message brut (CRLF) : multipart/alternative texte+HTML, enveloppé
 * dans multipart/mixed s'il y a des pièces. Tout corps en base64 : aucune
 * ambiguïté d'encodage, aucune ligne trop longue.
 */
export function buildMime(m: OutgoingMessage): string {
  const alt = boundary('alt')
  const utf8 = (s: string) => foldBase64(base64Encode(new TextEncoder().encode(s)))
  const altPart = [
    `--${alt}`,
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    utf8(m.text),
    `--${alt}`,
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    utf8(m.html),
    `--${alt}--`,
  ].join(CRLF)

  const headers: string[] = [
    `From: ${formatAddress(m.from)}`,
    `To: ${m.to.map(formatAddress).join(', ')}`,
  ]
  if (m.cc.length) headers.push(`Cc: ${m.cc.map(formatAddress).join(', ')}`)
  if (m.bcc.length) headers.push(`Bcc: ${m.bcc.map(formatAddress).join(', ')}`)
  headers.push(`Subject: ${encodeHeaderWord(m.subject)}`)
  headers.push(`Date: ${new Date().toUTCString()}`)
  headers.push(`Message-ID: ${m.messageId}`)
  if (m.inReplyTo) headers.push(`In-Reply-To: ${m.inReplyTo}`)
  if (m.references.length) headers.push(`References: ${m.references.join(' ')}`)
  headers.push('MIME-Version: 1.0')

  if (m.attachments.length === 0) {
    headers.push(`Content-Type: multipart/alternative; boundary="${alt}"`)
    return headers.join(CRLF) + CRLF + CRLF + altPart + CRLF
  }

  const mixed = boundary('mix')
  headers.push(`Content-Type: multipart/mixed; boundary="${mixed}"`)
  const parts: string[] = [
    `--${mixed}`,
    `Content-Type: multipart/alternative; boundary="${alt}"`,
    '',
    altPart,
  ]
  for (const a of m.attachments) {
    const name = a.filename.replace(/["\r\n]/g, '')
    parts.push(
      `--${mixed}`,
      `Content-Type: ${a.mimeType}; name="${name}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${name}"`,
      '',
      foldBase64(a.base64.replace(/\s+/g, '')),
    )
  }
  parts.push(`--${mixed}--`)
  return headers.join(CRLF) + CRLF + CRLF + parts.join(CRLF) + CRLF
}
