// supabase/functions/_shared/mail/mime.test.ts
import { describe, it, expect } from 'vitest'
import {
  parseAddress, parseAddressList, decodeRfc2047, htmlToText, textToHtml, snippetOf,
  base64UrlDecodeToString, base64UrlEncodeString, buildMime, makeMessageId, encodeHeaderWord,
  attachmentServing, base64ByteLength, nettoyerMessageId, nettoyerReferences,
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
  // ⛔ Le `mime_type` d'une pièce vient du CORPS de la requête mail-send : c'est du texte
  // d'appelant, posé dans un en-tête de partie. Sans validation, un CRLF y ouvrait un
  // en-tête à soi.
  it('un type de pièce ne peut pas ouvrir un en-tête de partie', () => {
    const raw = buildMime({
      ...base,
      attachments: [{ filename: 'f.txt', mimeType: 'text/plain\r\nX-Injected: yes', base64: 'QQ==' }],
    })
    expect(raw).not.toContain('X-Injected')
    expect(raw).toContain('Content-Type: application/octet-stream; name="f.txt"')
  })
  it('un type valide passe, ses paramètres sont jetés, tout le reste retombe sur octet-stream', () => {
    const of = (mimeType: string) =>
      buildMime({ ...base, attachments: [{ filename: 'f', mimeType, base64: 'QQ==' }] })
        .split('\r\n').find((l) => l.startsWith('Content-Type:') && l.includes('name='))
    expect(of('application/pdf')).toBe('Content-Type: application/pdf; name="f"')
    expect(of('APPLICATION/PDF')).toBe('Content-Type: application/pdf; name="f"')
    // Le paramètre est jeté : c'est là qu'on cacherait un guillemet ou un point-virgule.
    expect(of('text/plain; charset=utf-8')).toBe('Content-Type: text/plain; name="f"')
    for (const nawak of ['', 'nawak', 'text/', '/plain', 'text/plain"; x="y', 'text/pl ain']) {
      expect(of(nawak), nawak).toBe('Content-Type: application/octet-stream; name="f"')
    }
  })
  it('Message-ID et mot d en-tête', () => {
    expect(makeMessageId('agence.ch')).toMatch(/^<[0-9a-f-]{36}@agence\.ch>$/)
    expect(encodeHeaderWord('ascii only')).toBe('ascii only')
    expect(encodeHeaderWord('Zoé')).toBe('=?UTF-8?B?Wm/DqQ==?=')
  })
})

describe('attachmentServing — le type déclaré par l expéditeur ne traverse pas', () => {
  it('rend en ligne les six essences de la liste blanche, et elles seules', () => {
    expect(attachmentServing('application/pdf')).toEqual({ contentType: 'application/pdf', disposition: 'inline' })
    expect(attachmentServing('image/png')).toEqual({ contentType: 'image/png', disposition: 'inline' })
    expect(attachmentServing('image/jpeg')).toEqual({ contentType: 'image/jpeg', disposition: 'inline' })
    expect(attachmentServing('image/webp')).toEqual({ contentType: 'image/webp', disposition: 'inline' })
    expect(attachmentServing('image/gif')).toEqual({ contentType: 'image/gif', disposition: 'inline' })
    // Le jeu de caractères est imposé, il ne vient pas de l'expéditeur.
    expect(attachmentServing('text/plain; charset=utf-7')).toEqual({ contentType: 'text/plain; charset=utf-8', disposition: 'inline' })
  })
  it('force le téléchargement de TOUT ce qui pourrait s exécuter dans la session de l agent', () => {
    // Les trois essences par lesquelles un expéditeur obtiendrait un XSS stocké.
    for (const evil of ['text/html', 'image/svg+xml', 'application/xhtml+xml', 'TEXT/HTML', ' text/html ; charset=utf-8']) {
      expect(attachmentServing(evil), evil).toEqual({ contentType: 'application/octet-stream', disposition: 'attachment' })
    }
  })
  it('un type absent, vide ou inconnu se télécharge, il ne se devine pas', () => {
    for (const v of [null, undefined, '', 'application/zip', 'application/vnd.ms-excel', 'nawak']) {
      expect(attachmentServing(v).disposition).toBe('attachment')
      expect(attachmentServing(v).contentType).toBe('application/octet-stream')
    }
  })
})

describe('base64ByteLength', () => {
  it('compte les octets réels, bourrage et repli compris', () => {
    expect(base64ByteLength('')).toBe(0)
    expect(base64ByteLength('QQ==')).toBe(1)
    expect(base64ByteLength('QUI=')).toBe(2)
    expect(base64ByteLength('QUJD')).toBe(3)
    // Replié à 76 colonnes par le fournisseur : les CRLF ne sont pas des octets.
    expect(base64ByteLength('QUJD\r\nQUJD')).toBe(6)
  })
  it('ne surestime plus : 3 Mo pile ne dépassent pas le plafond de 3 Mo', () => {
    const exactly3MB = 'A'.repeat((3 * 1024 * 1024 * 4) / 3)
    expect(base64ByteLength(exactly3MB)).toBe(3 * 1024 * 1024)
    expect(Math.ceil(exactly3MB.length * 0.75)).toBe(3 * 1024 * 1024) // l'ancienne formule, ici d'accord
    expect(base64ByteLength('QQ==')).toBeLessThan(Math.ceil('QQ=='.length * 0.75)) // et là non : 1 contre 3
  })
})

/**
 * Les identifiants de message sont du TEXTE D'EXPÉDITEUR, que les décodeurs RFC 2047 peuvent
 * rendre sur plusieurs lignes : ils ne doivent rouvrir ni une commande IMAP, ni un en-tête.
 */
describe('identifiants de message', () => {
  it('⛔ nettoyerMessageId garde le premier <…> et jette CR, LF, NUL et espaces', () => {
    expect(nettoyerMessageId('<x@y>\r\nZ1 SELECT INBOX\r\nZ2 DELETE Trash')).toBe('<x@y>')
    expect(nettoyerMessageId('\r\nReply-To: a@evil.com\r\nX: <y@evil.com>')).toBe('<y@evil.com>')
    expect(nettoyerMessageId('  <abc@ex.ch>  ')).toBe('<abc@ex.ch>')
    expect(nettoyerMessageId('abc@def')).toBe('abc@def')
    expect(nettoyerMessageId('a b\u0000c')).toBe('abc')
    expect(nettoyerMessageId(' \r\n ')).toBeNull()
    expect(nettoyerMessageId(null)).toBeNull()
  })

  it('nettoyerReferences rend chaque <…> dans l’ordre, repliés ou non', () => {
    expect(nettoyerReferences('<a@x>\r\n <b@y>\t<c@z>')).toEqual(['<a@x>', '<b@y>', '<c@z>'])
    expect(nettoyerReferences('a@x b@y')).toEqual(['a@x', 'b@y'])
    expect(nettoyerReferences(undefined)).toEqual([])
  })

  it('⛔ buildMime n’écrit ni en-tête ni corps injectés par In-Reply-To ou References', () => {
    const raw = buildMime({
      from: { name: 'Gregory', email: 'g@agence.ch' }, to: [{ name: null, email: 'zoe@ex.ch' }], cc: [], bcc: [],
      subject: 'Re: Acte', text: 'Bonjour', html: '<p>Bonjour</p>', messageId: '<m1@agence.ch>', attachments: [],
      inReplyTo: '<x@y>\r\nReply-To: attaquant@evil.com',
      references: ['<r@y>\r\n\r\n<p>Nouvel IBAN CH00</p>'],
    })
    const entetes = raw.slice(0, raw.indexOf('\r\n\r\n'))
    expect(entetes).toContain('\r\nIn-Reply-To: <x@y>\r\n')
    expect(entetes).toContain('\r\nReferences: <r@y>\r\n')
    expect(entetes).not.toMatch(/^Reply-To:/m)
    // Le corps n'a pas commencé plus tôt : le type du message est encore dans les en-têtes.
    expect(entetes).toContain('Content-Type: multipart/alternative')
    expect(raw).not.toContain('Nouvel IBAN')
  })
})

describe('htmlToText — les entités numériques hors Unicode', () => {
  it('⛔ &#1114112; et &#0; ne font plus lever : U+FFFD à leur place, jamais un NUL', () => {
    const t = htmlToText('<p>&#1114112; &#0; &#x110000; &#xD800; &#65;&#x42;</p>')
    expect(t).toContain('AB')
    expect(t).not.toContain(String.fromCharCode(0))
    expect(t.split(String.fromCharCode(0xfffd))).toHaveLength(5)
  })
})
