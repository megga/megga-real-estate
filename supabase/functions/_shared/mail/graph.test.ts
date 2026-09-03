// supabase/functions/_shared/mail/graph.test.ts
import { describe, it, expect, vi } from 'vitest'
import { normalizeGraphMessage, deltaToChanges, graphDelta, resolveGraphRemoval, IMMUTABLE_ID_PREFER, type GraphMessage } from './graph.ts'

const F = (fn: (url: string, init?: RequestInit) => Promise<Response>) => fn as unknown as typeof globalThis.fetch
const FOLDERS = { inbox: 'F-IN', sentitems: 'F-SENT', archive: 'F-ARC', deleteditems: 'F-DEL' }

const M: GraphMessage = {
  id: 'AAMk1', conversationId: 'CONV1', internetMessageId: '<abc@ex.ch>', subject: 'Visite',
  bodyPreview: 'Bonjour & bienvenue', receivedDateTime: '2026-09-03T08:00:00Z', sentDateTime: '2026-09-03T07:59:00Z',
  isRead: false, isDraft: false, hasAttachments: true, parentFolderId: 'F-IN',
  flag: { flagStatus: 'flagged' },
  from: { emailAddress: { name: 'Zoé Rochat', address: 'Zoe@Ex.ch' } },
  toRecipients: [{ emailAddress: { name: 'Gregory', address: 'g@agence.ch' } }],
  ccRecipients: [], bccRecipients: [],
  replyTo: [{ emailAddress: { name: null, address: 'reply@ex.ch' } }],
}
const BODY = { body: { contentType: 'html', content: '<p>Bonjour &amp; bienvenue</p>' }, internetMessageHeaders: [{ name: 'In-Reply-To', value: '<root@agence.ch>' }, { name: 'References', value: '<root@agence.ch> <mid@ex.ch>' }] }
const ATTS = [{ id: 'A1', name: 'plan.pdf', contentType: 'application/pdf', size: 1234, isInline: false, contentId: null, '@odata.type': '#microsoft.graph.fileAttachment' }]

describe('normalizeGraphMessage', () => {
  it('lit métadonnées, corps, en-têtes de fil et pièces', () => {
    const n = normalizeGraphMessage(M, BODY, ATTS, FOLDERS, 'g@agence.ch')
    expect(n.providerMessageId).toBe('AAMk1')
    expect(n.providerThreadId).toBe('CONV1')
    expect(n.from).toEqual({ name: 'Zoé Rochat', email: 'zoe@ex.ch' })
    expect(n.replyTo).toBe('reply@ex.ch')
    expect(n.inReplyTo).toBe('<root@agence.ch>')
    expect(n.references).toEqual(['<root@agence.ch>', '<mid@ex.ch>'])
    expect(n.bodyHtml).toBe('<p>Bonjour &amp; bienvenue</p>')
    expect(n.bodyText).toBe('Bonjour & bienvenue')
    expect(n.sentAt).toBe('2026-09-03T08:00:00.000Z')
    expect(n).toMatchObject({ direction: 'inbound', isRead: false, isStarred: true, inInbox: true, isTrashed: false, isDraft: false })
    expect(n.attachments).toEqual([{ providerAttachmentId: 'A1', filename: 'plan.pdf', mimeType: 'application/pdf', sizeBytes: 1234, isInline: false, contentId: null }])
  })
  it('un message du dossier Envoyés est sortant ; corbeille = trashed ; archive = hors réception', () => {
    const sent = normalizeGraphMessage({ ...M, parentFolderId: 'F-SENT', from: { emailAddress: { name: 'G', address: 'g@agence.ch' } } }, BODY, [], FOLDERS, 'g@agence.ch')
    expect(sent.direction).toBe('outbound')
    expect(sent.inInbox).toBe(false)
    expect(normalizeGraphMessage({ ...M, parentFolderId: 'F-DEL' }, BODY, [], FOLDERS, 'g@agence.ch').isTrashed).toBe(true)
    expect(normalizeGraphMessage({ ...M, parentFolderId: 'F-ARC' }, BODY, [], FOLDERS, 'g@agence.ch').inInbox).toBe(false)
  })
})

describe('deltaToChanges', () => {
  // ⚠ Test RÉÉCRIT le 04.09.2026 : il figeait le défaut. Il exigeait qu'un `@removed`
  // devienne un `message_deleted`, ce qui faisait disparaître du CRM tout message
  // ARCHIVÉ dans Outlook (le delta est par dossier, archiver = quitter la Réception).
  // Les disparus sortent maintenant dans leur propre panier, que `resolveGraphRemoval`
  // tranche par un GET.
  it('sépare nouveaux, drapeaux et DISPARUS — un @removed n est pas une suppression', () => {
    const r = deltaToChanges([
      { ...M, id: 'N1' },
      { id: 'GONE', '@removed': { reason: 'deleted' } },
      { ...M, id: 'K1', isRead: true, flag: { flagStatus: 'notFlagged' }, parentFolderId: 'F-ARC' },
    ], new Set(['K1']), FOLDERS)
    expect(r.added.map((m) => m.id)).toEqual(['N1'])
    expect(r.removed).toEqual([{ id: 'GONE', reason: 'deleted' }])
    expect(r.changes).toEqual([
      { kind: 'flags', providerMessageId: 'K1', isRead: true, isStarred: false, inInbox: false, isTrashed: false },
    ])
    expect(r.changes.some((c) => c.kind === 'message_deleted')).toBe(false)
  })
})

describe('resolveGraphRemoval', () => {
  it('404 : le message n existe plus ⇒ suppression', async () => {
    const fetch = vi.fn(async () => new Response('not found', { status: 404 }))
    const r = await resolveGraphRemoval('tok', { id: 'X', reason: 'deleted' }, FOLDERS, { fetch: F(fetch) })
    expect(r).toEqual({ kind: 'message_deleted', providerMessageId: 'X' })
  })
  it('200 dans Archive : DÉPLACÉ ⇒ hors réception, jamais supprimé', async () => {
    const fetch = vi.fn(async (u: string) => {
      expect(u).toContain('/me/messages/X')
      return new Response(JSON.stringify({ id: 'X', parentFolderId: 'F-ARC' }), { status: 200 })
    })
    const r = await resolveGraphRemoval('tok', { id: 'X', reason: 'changed' }, FOLDERS, { fetch: F(fetch) })
    expect(r).toEqual({ kind: 'flags', providerMessageId: 'X', inInbox: false, isTrashed: false })
  })
  it('200 dans Éléments supprimés : corbeille, pas destruction', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ id: 'X', parentFolderId: 'F-DEL' }), { status: 200 }))
    const r = await resolveGraphRemoval('tok', { id: 'X', reason: 'changed' }, FOLDERS, { fetch: F(fetch) })
    expect(r).toEqual({ kind: 'flags', providerMessageId: 'X', inInbox: false, isTrashed: true })
  })
  it('erreur autre que 404 : INDÉTERMINÉ, on ne touche à rien', async () => {
    for (const status of [429, 500]) {
      const fetch = vi.fn(async () => new Response('boom', { status }))
      expect(await resolveGraphRemoval('tok', { id: 'X', reason: 'changed' }, FOLDERS, { fetch: F(fetch) })).toBeNull()
    }
  })
  it('401 remonte : c est une reconnexion, pas un doute sur un message', async () => {
    const fetch = vi.fn(async () => new Response('nope', { status: 401 }))
    await expect(resolveGraphRemoval('tok', { id: 'X', reason: 'changed' }, FOLDERS, { fetch: F(fetch) }))
      .rejects.toMatchObject({ code: 'reauth_required' })
  })
})

describe('Prefer: IdType="ImmutableId"', () => {
  // Sans cet en-tête l'id change au déplacement, le GET de `resolveGraphRemoval` sur
  // l'ancien id rend 404, et « archivé » redevient indiscernable de « supprimé ».
  it('part sur CHAQUE appel, et se compose avec odata.maxpagesize', async () => {
    const seen: string[] = []
    const fetch = vi.fn(async (_u: string, init?: RequestInit) => {
      seen.push((init?.headers as Record<string, string>)['Prefer'])
      return new Response(JSON.stringify({ value: [], '@odata.deltaLink': 'https://graph.microsoft.com/v1.0/d?t=1' }), { status: 200 })
    })
    await graphDelta('tok', 'inbox', null, '2026-06-05T00:00:00.000Z', { fetch: F(fetch) })
    expect(seen[0]).toBe(`odata.maxpagesize=50, ${IMMUTABLE_ID_PREFER}`)

    const solo = vi.fn(async (_u: string, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>)['Prefer']).toBe('IdType="ImmutableId"')
      return new Response(JSON.stringify({ id: 'X', parentFolderId: 'F-IN' }), { status: 200 })
    })
    await resolveGraphRemoval('tok', { id: 'X', reason: 'changed' }, FOLDERS, { fetch: F(solo) })
    expect(solo).toHaveBeenCalledOnce()
  })
})

describe('graphDelta', () => {
  it('premier appel : filtre 90 j et taille de page ; suit nextLink ; rend deltaLink', async () => {
    const calls: string[] = []
    const fetch = vi.fn(async (u: string, init?: RequestInit) => {
      calls.push(u)
      expect((init?.headers as Record<string, string>)['Prefer']).toBe(`odata.maxpagesize=50, ${IMMUTABLE_ID_PREFER}`)
      if (calls.length === 1) return new Response(JSON.stringify({ value: [{ id: 'a' }], '@odata.nextLink': 'https://graph.microsoft.com/v1.0/next' }), { status: 200 })
      return new Response(JSON.stringify({ value: [{ id: 'b' }], '@odata.deltaLink': 'https://graph.microsoft.com/v1.0/delta?token=Z' }), { status: 200 })
    })
    const r = await graphDelta('tok', 'inbox', null, '2026-06-05T00:00:00.000Z', { fetch: F(fetch) })
    expect(calls[0]).toContain('/me/mailFolders/inbox/messages/delta?')
    expect(decodeURIComponent(calls[0])).toContain('$filter=receivedDateTime ge 2026-06-05T00:00:00.000Z')
    expect(r.items.map((i) => i.id)).toEqual(['a', 'b'])
    expect(r.deltaLink).toBe('https://graph.microsoft.com/v1.0/delta?token=Z')
  })
})
