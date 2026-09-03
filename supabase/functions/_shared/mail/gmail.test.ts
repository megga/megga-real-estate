// supabase/functions/_shared/mail/gmail.test.ts
import { describe, it, expect, vi } from 'vitest'
import { normalizeGmailMessage, historyToChanges, gmailListInitial, gmailHistory, type GmailMessage, type GmailHistoryPage } from './gmail.ts'
import { base64UrlEncodeString } from './mime.ts'

const F = (fn: (url: string, init?: RequestInit) => Promise<Response>) => fn as unknown as typeof globalThis.fetch

const MSG: GmailMessage = {
  id: 'm1', threadId: 't1', labelIds: ['INBOX', 'UNREAD'], snippet: 'Bonjour &amp; bienvenue',
  internalDate: '1756857600000',
  payload: {
    mimeType: 'multipart/mixed',
    headers: [
      { name: 'From', value: '=?UTF-8?B?Wm/DqSBSb2NoYXQ=?= <zoe@ex.ch>' },
      { name: 'To', value: 'Gregory <g@agence.ch>, bob@ex.ch' },
      { name: 'Cc', value: '' },
      { name: 'Subject', value: 'Visite' },
      { name: 'Message-ID', value: '<abc@ex.ch>' },
      { name: 'In-Reply-To', value: '<root@agence.ch>' },
      { name: 'References', value: '<root@agence.ch>  <mid@ex.ch>' },
      { name: 'Reply-To', value: 'Zoé <reply@ex.ch>' },
    ],
    parts: [
      {
        mimeType: 'multipart/alternative',
        parts: [
          { mimeType: 'text/plain', body: { data: base64UrlEncodeString('Bonjour & bienvenue') } },
          { mimeType: 'text/html', body: { data: base64UrlEncodeString('<p>Bonjour &amp; bienvenue</p>') } },
        ],
      },
      { mimeType: 'application/pdf', filename: 'plan.pdf', body: { attachmentId: 'att-1', size: 1234 } },
      { mimeType: 'image/png', filename: 'logo.png', headers: [{ name: 'Content-ID', value: '<logo@cid>' }, { name: 'Content-Disposition', value: 'inline; filename="logo.png"' }], body: { attachmentId: 'att-2', size: 99 } },
    ],
  },
}

describe('normalizeGmailMessage', () => {
  it('lit en-têtes, corps, pièces, drapeaux', () => {
    const n = normalizeGmailMessage(MSG, 'g@agence.ch')
    expect(n.providerMessageId).toBe('m1')
    expect(n.providerThreadId).toBe('t1')
    expect(n.from).toEqual({ name: 'Zoé Rochat', email: 'zoe@ex.ch' })
    expect(n.to).toEqual([{ name: 'Gregory', email: 'g@agence.ch' }, { name: null, email: 'bob@ex.ch' }])
    expect(n.cc).toEqual([])
    expect(n.replyTo).toBe('reply@ex.ch')
    expect(n.subject).toBe('Visite')
    expect(n.snippet).toBe('Bonjour & bienvenue')
    expect(n.rfc822MessageId).toBe('<abc@ex.ch>')
    expect(n.inReplyTo).toBe('<root@agence.ch>')
    expect(n.references).toEqual(['<root@agence.ch>', '<mid@ex.ch>'])
    expect(n.bodyText).toBe('Bonjour & bienvenue')
    expect(n.bodyHtml).toBe('<p>Bonjour &amp; bienvenue</p>')
    expect(n.sentAt).toBe('2025-09-03T00:00:00.000Z')
    expect(n.direction).toBe('inbound')
    expect(n).toMatchObject({ isRead: false, isStarred: false, inInbox: true, isTrashed: false, isDraft: false })
    expect(n.attachments).toEqual([
      { providerAttachmentId: 'att-1', filename: 'plan.pdf', mimeType: 'application/pdf', sizeBytes: 1234, isInline: false, contentId: null },
      { providerAttachmentId: 'att-2', filename: 'logo.png', mimeType: 'image/png', sizeBytes: 99, isInline: true, contentId: '<logo@cid>' },
    ])
  })
  it('un message envoyé par la boîte est sortant, lu', () => {
    const sent: GmailMessage = { ...MSG, labelIds: ['SENT'], payload: { ...MSG.payload, headers: [...MSG.payload.headers!.filter((h) => h.name !== 'From'), { name: 'From', value: 'g@agence.ch' }] } }
    const n = normalizeGmailMessage(sent, 'g@agence.ch')
    expect(n.direction).toBe('outbound')
    expect(n.isRead).toBe(true)
    expect(n.inInbox).toBe(false)
  })
  it('corps HTML seul → texte dérivé ; sans corps → snippet', () => {
    const htmlOnly: GmailMessage = { ...MSG, payload: { mimeType: 'text/html', headers: MSG.payload.headers, body: { data: base64UrlEncodeString('<p>Seul</p>') } } }
    expect(normalizeGmailMessage(htmlOnly, 'g@agence.ch').bodyText).toBe('Seul')
  })
})

describe('historyToChanges', () => {
  it('traduit ajouts, suppressions et libellés en opérations', () => {
    const page: GmailHistoryPage = {
      historyId: '999',
      history: [
        { id: '1', messagesAdded: [{ message: { id: 'new1', threadId: 't9', labelIds: ['INBOX', 'UNREAD'] } }] },
        { id: '2', messagesDeleted: [{ message: { id: 'gone1', threadId: 't1' } }] },
        { id: '3', labelsAdded: [{ message: { id: 'm1', threadId: 't1' }, labelIds: ['STARRED'] }], labelsRemoved: [{ message: { id: 'm1', threadId: 't1' }, labelIds: ['UNREAD', 'INBOX'] }] },
        { id: '4', labelsAdded: [{ message: { id: 'm2', threadId: 't2' }, labelIds: ['TRASH'] }] },
      ],
    }
    const r = historyToChanges(page)
    expect(r.added).toEqual(['new1'])
    expect(r.changes).toEqual([
      { kind: 'message_deleted', providerMessageId: 'gone1' },
      { kind: 'flags', providerMessageId: 'm1', isStarred: true, isRead: true, inInbox: false },
      { kind: 'flags', providerMessageId: 'm2', isTrashed: true },
    ])
  })
})

describe('appels HTTP', () => {
  it('gmailListInitial borne à 90 jours hors spam/corbeille', async () => {
    const fetch = vi.fn(async (u: string) => {
      const url = new URL(u)
      expect(url.searchParams.get('q')).toBe('newer_than:90d -in:spam -in:trash -in:chats')
      expect(url.searchParams.get('maxResults')).toBe('50')
      return new Response(JSON.stringify({ messages: [{ id: 'a' }, { id: 'b' }], nextPageToken: 'p2' }), { status: 200 })
    })
    expect(await gmailListInitial('tok', null, { fetch: F(fetch) })).toEqual({ ids: ['a', 'b'], nextPageToken: 'p2' })
  })
  it('gmailHistory : 404 = historique expiré (resynchro complète)', async () => {
    const fetch = vi.fn(async () => new Response('{}', { status: 404 }))
    expect(await gmailHistory('tok', '1', null, { fetch: F(fetch) })).toEqual({ expired: true, page: null })
  })
})
