// supabase/functions/_shared/mail/mime.test.ts
import { describe, it, expect } from 'vitest'
import {
  parseAddress, parseAddressList, decodeRfc2047, htmlToText, textToHtml, snippetOf,
  base64UrlDecodeToString, base64UrlEncodeString, buildMime, makeMessageId, encodeHeaderWord,
} from './mime.ts'

describe('adresses', () => {
  it('lit les trois formes', () => {
    expect(parseAddress('"Alice Martin" <alice@ex.ch>')).toEqual({ name: 'Alice Martin', email: 'alice@ex.ch' })
    expect(parseAddress('Alice Martin <alice@ex.ch>')).toEqual({ name: 'Alice Martin', email: 'alice@ex.ch' })
    expect(parseAddress('alice@ex.ch')).toEqual({ name: null, email: 'alice@ex.ch' })
    expect(parseAddress('')).toBeNull()
  })
  it('sépare une liste sur les virgules hors guillemets', () => {
    const l = parseAddressList('"Martin, Alice" <alice@ex.ch>, bob@ex.ch')
    expect(l).toEqual([{ name: 'Martin, Alice', email: 'alice@ex.ch' }, { name: null, email: 'bob@ex.ch' }])
  })
  it('décode un nom RFC 2047 en B et en Q', () => {
    expect(decodeRfc2047('=?UTF-8?B?Wm/DqSBSb2NoYXQ=?= <zoe@ex.ch>')).toBe('Zoé Rochat <zoe@ex.ch>')
    expect(decodeRfc2047('=?utf-8?Q?Zo=C3=A9_Rochat?=')).toBe('Zoé Rochat')
    expect(decodeRfc2047('plain')).toBe('plain')
  })
})

describe('corps', () => {
  it('HTML → texte : scripts retirés, blocs en lignes, entités décodées', () => {
    const t = htmlToText('<style>p{}</style><p>Bonjour&nbsp;<b>Zo&eacute;</b></p><script>x()</script><div>2<sup>e</sup> ligne &amp; fin</div>')
    expect(t).toBe('Bonjour Zoé\n2e ligne & fin')
  })
  it('texte → HTML échappe et conserve les paragraphes', () => {
    expect(textToHtml('a < b\n\nc & d')).toBe('<p>a &lt; b</p><p>c &amp; d</p>')
  })
  it('extrait borné', () => {
    expect(snippetOf('  a   b\nc  ', 3)).toBe('a b')
  })
  it('base64url aller-retour', () => {
    expect(base64UrlDecodeToString(base64UrlEncodeString('Zoé ✓'))).toBe('Zoé ✓')
  })
})

describe('buildMime', () => {
  const base = {
    from: { name: 'Gregory Lyonnet', email: 'g@agence.ch' },
    to: [{ name: 'Zoé Rochat', email: 'zoe@ex.ch' }],
    cc: [], bcc: [],
    subject: 'Visite rue du Rhône',
    text: 'Bonjour Zoé,\nà demain.',
    html: '<p>Bonjour Zoé,<br>à demain.</p>',
    inReplyTo: '<abc@ex.ch>',
    references: ['<root@ex.ch>', '<abc@ex.ch>'],
    messageId: '<m1@agence.ch>',
    attachments: [] as { filename: string; mimeType: string; base64: string }[],
  }
  it('pose les en-têtes de fil et encode les mots non ASCII', () => {
    const raw = buildMime(base)
    expect(raw).toContain('\r\nIn-Reply-To: <abc@ex.ch>\r\n')
    expect(raw).toContain('\r\nReferences: <root@ex.ch> <abc@ex.ch>\r\n')
    expect(raw).toContain('\r\nMessage-ID: <m1@agence.ch>\r\n')
    expect(raw).toContain('Subject: =?UTF-8?B?')
    expect(raw).toContain('To: =?UTF-8?B?Wm/DqSBSb2NoYXQ=?= <zoe@ex.ch>')
    expect(raw).toContain('Content-Type: multipart/alternative; boundary=')
    expect(raw).toMatch(/Content-Type: text\/plain; charset=utf-8\r\nContent-Transfer-Encoding: base64/)
  })
  it('enveloppe les pièces dans multipart/mixed', () => {
    const raw = buildMime({ ...base, attachments: [{ filename: 'plan.pdf', mimeType: 'application/pdf', base64: 'JVBERi0=' }] })
    expect(raw).toContain('Content-Type: multipart/mixed; boundary=')
    expect(raw).toContain('Content-Disposition: attachment; filename="plan.pdf"')
    expect(raw).toContain('\r\nJVBERi0=\r\n')
  })
  it('Message-ID et mot d en-tête', () => {
    expect(makeMessageId('agence.ch')).toMatch(/^<[0-9a-f-]{36}@agence\.ch>$/)
    expect(encodeHeaderWord('ascii only')).toBe('ascii only')
    expect(encodeHeaderWord('Zoé')).toBe('=?UTF-8?B?Wm/DqQ==?=')
  })
})
