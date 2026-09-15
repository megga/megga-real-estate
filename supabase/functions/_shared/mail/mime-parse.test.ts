/**
 * Un message RFC 822 réel → la forme de l'ingestion. Le message de test porte ce qui
 * casse un analyseur naïf : un nom en RFC 2047, un objet en ISO-8859-1 quoted-printable,
 * un groupe d'adresses, un corps HTML seul, une pièce jointe et une image intégrée.
 */
import { describe, it, expect } from 'vitest'
import { attachmentFromRaw, internalDateIso, parseEntetesSeuls, parseRfc822, type ParseCtx } from './mime-parse.ts'

const RAW = [
  'From: =?UTF-8?B?Wm/DqSBSb2NoYXQ=?= <Zoe@Ex.ch>',
  'To: Gregory <g@agence.ch>, Equipe: a@b.ch, c@d.ch;',
  'Cc: undisclosed-recipients:;',
  'Reply-To: Zoé <zoe.perso@ex.ch>',
  'Subject: =?ISO-8859-1?Q?Visite_=E0_Gen=E8ve?=',
  'Message-ID: <abc@ex.ch>',
  'In-Reply-To: <root@agence.ch>',
  'References: <root@agence.ch>',
  ' <mid@ex.ch>',
  'Date: Thu, 03 Sep 2026 10:00:00 +0200',
  'MIME-Version: 1.0',
  'Content-Type: multipart/mixed; boundary="B"',
  '',
  '--B',
  'Content-Type: text/html; charset=iso-8859-1',
  'Content-Transfer-Encoding: quoted-printable',
  '',
  '<p>Bonjour &amp; bienvenue =E0 tous</p>',
  '--B',
  'Content-Type: application/pdf; name="plan.pdf"',
  'Content-Disposition: attachment; filename="plan.pdf"',
  'Content-Transfer-Encoding: base64',
  '',
  'JVBERi0xLjQK',
  '--B',
  'Content-Type: image/png',
  'Content-ID: <logo@ex>',
  'Content-Disposition: inline',
  'Content-Transfer-Encoding: base64',
  '',
  'iVBORw0KGgo=',
  '--B--',
  '',
].join('\r\n')
const octets = new TextEncoder().encode(RAW)
const ctx = (over: Partial<ParseCtx> = {}): ParseCtx => ({
  providerMessageId: 'INBOX:42:7', boxEmail: 'g@agence.ch', dossier: 'inbox', flags: [], internalDate: null, ...over,
})

describe('parseRfc822', () => {
  it('produit un message normalisé complet', async () => {
    const n = await parseRfc822(octets, ctx({ flags: ['\\Seen'] }))
    expect(n.providerMessageId).toBe('INBOX:42:7')
    expect(n.from).toEqual({ name: 'Zoé Rochat', email: 'zoe@ex.ch' })
    // Le groupe est déplié, le groupe vide des « destinataires non divulgués » écarté.
    expect(n.to).toEqual([{ name: 'Gregory', email: 'g@agence.ch' }, { name: null, email: 'a@b.ch' }, { name: null, email: 'c@d.ch' }])
    expect(n.cc).toEqual([])
    expect(n.replyTo).toBe('zoe.perso@ex.ch')
    expect(n.subject).toBe('Visite à Genève')
    expect(n.rfc822MessageId).toBe('<abc@ex.ch>')
    expect(n.inReplyTo).toBe('<root@agence.ch>')
    expect(n.references).toEqual(['<root@agence.ch>', '<mid@ex.ch>'])
    expect(n.bodyHtml).toContain('bienvenue à tous')
    expect(n.bodyText).toContain('Bonjour & bienvenue à tous')
    expect(n.direction).toBe('inbound')
    expect(n.inSent).toBe(false)
    expect(n.isRead).toBe(true)
    expect(n.inInbox).toBe(true)
    expect(n.sentAt).toBe('2026-09-03T08:00:00.000Z')
    expect(n.attachments).toEqual([
      { providerAttachmentId: '0', filename: 'plan.pdf', mimeType: 'application/pdf', sizeBytes: 9, isInline: false, contentId: null },
      { providerAttachmentId: '1', filename: 'piece-2', mimeType: 'image/png', sizeBytes: 8, isInline: true, contentId: '<logo@ex>' },
    ])
  })

  // ⛔ Le sens se décidait sur `From`, que l'expéditeur écrit : l'arnaque qui usurpe l'adresse
  // de la boîte, rangée au Spam, sortait « envoyée par l'agent » (revue du 15.09.2026).
  it('le rangement fait le sens : « Envoyés » est sortant, le Spam entrant, quel que soit `From`', async () => {
    expect(await parseRfc822(octets, ctx({ dossier: 'sent' }))).toMatchObject({ direction: 'outbound', inSent: true })
    expect(await parseRfc822(octets, ctx({ dossier: 'junk', boxEmail: 'ZOE@ex.ch' }))).toMatchObject({ direction: 'inbound', inSent: false, isSpam: true })
  })

  it('hors « Envoyés », `From` = la boîte reste sortant — sauf un `Reply-To` qui renvoie ailleurs', async () => {
    // La copie qu'un serveur dépose en Réception quand l'agent se met en copie : sortante, mais
    // pas « Envoyés » — ni journal `email_sent`, ni ligne `pending:` reprise (`inSent`).
    const copie = new TextEncoder().encode(RAW.replace(/^Reply-To:.*\r\n/m, ''))
    expect(await parseRfc822(copie, ctx({ boxEmail: 'ZOE@ex.ch' }))).toMatchObject({ direction: 'outbound', inSent: false, replyTo: null })
    // RAW répond à `zoe.perso@ex.ch` : le formulaire d'un site qui écrit au nom de la boîte.
    expect(await parseRfc822(octets, ctx({ boxEmail: 'ZOE@ex.ch' }))).toMatchObject({ direction: 'inbound', inSent: false })
  })

  it('la date d’ARRIVÉE (INTERNALDATE) prime sur l’en-tête Date, comme chez Gmail', async () => {
    const n = await parseRfc822(octets, ctx({ internalDate: '05-Sep-2026 10:30:00 +0200', flags: ['\\Flagged', '\\Draft'] }))
    expect(n.sentAt).toBe('2026-09-05T08:30:00.000Z')
    expect(n.isStarred).toBe(true)
    expect(n.isDraft).toBe(true)
  })

  it('un message trop lourd garde ses en-têtes et dit pourquoi son corps manque', async () => {
    const entetes = new TextEncoder().encode(RAW.split('\r\n\r\n')[0] + '\r\n\r\n')
    const n = await parseEntetesSeuls(entetes, ctx(), 'Message trop volumineux')
    expect(n.subject).toBe('Visite à Genève')
    expect(n.bodyText).toBe('Message trop volumineux')
    expect(n.attachments).toEqual([])
  })
})

describe('attachmentFromRaw', () => {
  it('rend les octets d’une pièce par son rang', async () => {
    const a = await attachmentFromRaw(octets, 0)
    expect(a?.filename).toBe('plan.pdf')
    expect(new TextDecoder().decode(a?.bytes)).toBe('%PDF-1.4\n')
    expect(await attachmentFromRaw(octets, 9)).toBeNull()
  })
})

describe('internalDateIso', () => {
  it('lit le format de la RFC 3501, jour à un chiffre compris', () => {
    expect(internalDateIso(' 5-Sep-2026 10:00:00 +0200')).toBe('2026-09-05T08:00:00.000Z')
    expect(internalDateIso('17-Jul-1996 02:44:25 -0700')).toBe('1996-07-17T09:44:25.000Z')
    expect(internalDateIso('n’importe quoi')).toBeNull()
  })
})

/**
 * ⛔ postal-mime DÉCODE les mots RFC 2047 des en-têtes d'identifiant : un expéditeur y cache
 * des CR/LF, qui partaient ensuite dans une commande IMAP et dans les en-têtes d'une réponse.
 */
describe('les identifiants de message, texte d’expéditeur', () => {
  it('un Message-ID encodé qui cache des lignes ressort réduit à son <…>', async () => {
    const mot = (s: string) => `=?utf-8?B?${btoa(s)}?=`
    const raw = new TextEncoder().encode([
      'From: Mallory <m@evil.com>',
      'To: g@agence.ch',
      'Subject: Re: Acte',
      `Message-ID: ${mot('<x@y>\r\nZ1 SELECT INBOX\r\nZ2 UID MOVE 1:* Trash\r\nZ3 DELETE Trash')}`,
      `In-Reply-To: ${mot('<a@b>\r\nReply-To: m@evil.com')}`,
      `References: ${mot('<r@y>\r\n\r\n<p>Nouvel IBAN</p>')}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      'corps',
      '',
    ].join('\r\n'))
    const m = await parseRfc822(raw, ctx())
    expect(m.rfc822MessageId).toBe('<x@y>')
    expect(m.providerThreadId).not.toMatch(/[\r\n\0 ]/)
    for (const v of [m.rfc822MessageId, m.inReplyTo, ...m.references]) expect(v).not.toMatch(/[\r\n\0 ]/)
  })
})
