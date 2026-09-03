// supabase/functions/_shared/mail/graph.test.ts
import { describe, it, expect, vi } from 'vitest'
import { normalizeGraphMessage, deltaToChanges, graphDelta, graphSend, resolveGraphRemoval, GRAPH_ATTACHMENT_MAX_BYTES, IMMUTABLE_ID_PREFER, type GraphMessage } from './graph.ts'

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

  // ⛔ « Updated instances are represented by their id with *at least* the updated
  // properties, but other properties might be included » (delta query overview) : une
  // charge utile PARTIELLE est le cas normal. Ces trois cas rougissent si l'un des
  // drapeaux redevient inconditionnel.
  it('n émet QUE les drapeaux que la charge utile porte', () => {
    const r = deltaToChanges([{ id: 'K1', isRead: true }], new Set(['K1']), FOLDERS)
    expect(r.changes).toEqual([{ kind: 'flags', providerMessageId: 'K1', isRead: true }])
  })
  it('parentFolderId absent : ni inInbox ni isTrashed — sinon poser un drapeau dans Outlook archivait le fil', () => {
    const r = deltaToChanges([{ id: 'K1', flag: { flagStatus: 'flagged' } }], new Set(['K1']), FOLDERS)
    expect(r.changes).toEqual([{ kind: 'flags', providerMessageId: 'K1', isStarred: true }])
    const only = r.changes[0] as { inInbox?: boolean; isTrashed?: boolean; isRead?: boolean }
    expect('inInbox' in only).toBe(false)
    expect('isTrashed' in only).toBe(false)
    expect('isRead' in only).toBe(false) // un isRead absent ne remet pas le message en non-lu
  })
  it('isRead: false EXPLICITE est bien transmis (absence ≠ false)', () => {
    const r = deltaToChanges([{ id: 'K1', isRead: false }], new Set(['K1']), FOLDERS)
    expect(r.changes).toEqual([{ kind: 'flags', providerMessageId: 'K1', isRead: false }])
  })
  it('un item connu SANS aucune propriété suivie ne descend pas jusqu à la base', () => {
    expect(deltaToChanges([{ id: 'K1' }], new Set(['K1']), FOLDERS).changes).toEqual([])
  })
})

describe('graphSend', () => {
  const okJson = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { 'Content-Type': 'application/json' } })
  const OUT = {
    subject: 'Re: Visite', html: '<p>ok</p>',
    to: [{ name: null, email: 'zoe@ex.ch' }], cc: [], bcc: [],
    internetMessageId: '<m1@agence.ch>',
    attachments: [{ filename: 'plan.pdf', mimeType: 'application/pdf', base64: 'JVBERi0=' }],
  }
  const trace = () => {
    const calls: { url: string; method: string; body: string }[] = []
    const fetch = vi.fn(async (u: string, init?: RequestInit) => {
      calls.push({ url: u, method: init?.method ?? 'GET', body: String(init?.body ?? '') })
      if (u.endsWith('/send')) return new Response(null, { status: 202 })
      // Graph rend 200 + l'objet message sur un PATCH, et 201 + la pièce sur un POST
      // dans /attachments : le mock ne doit pas être plus pauvre que le fournisseur.
      return okJson({ id: 'DRAFT1' })
    })
    return { calls, fetch }
  }

  // ⛔ `attachments` est une propriété de NAVIGATION : la référence « Update message »
  // ne la liste pas parmi les modifiables. Envoyée dans le PATCH, la pièce était ou
  // refusée (502 + brouillon orphelin) ou ignorée (client sans pièce jointe).
  it('réponse : le PATCH ne porte AUCUNE pièce, chacune est POSTée dans la collection du brouillon', async () => {
    const { calls, fetch } = trace()
    await graphSend('tok', OUT, { kind: 'reply', providerMessageId: 'AAMk1' }, { fetch: F(fetch) })
    const patch = calls.find((c) => c.method === 'PATCH')!
    expect(patch.body).not.toContain('attachments')
    expect(patch.body).not.toContain('JVBERi0=')
    const post = calls.find((c) => c.url.endsWith('/attachments'))!
    expect(post.method).toBe('POST')
    expect(post.url).toContain('/me/messages/DRAFT1/attachments')
    expect(JSON.parse(post.body)).toMatchObject({ '@odata.type': '#microsoft.graph.fileAttachment', name: 'plan.pdf', contentBytes: 'JVBERi0=' })
    // L'ordre compte : la pièce doit être posée AVANT l'envoi.
    expect(calls.findIndex((c) => c.url.endsWith('/attachments'))).toBeLessThan(calls.findIndex((c) => c.url.endsWith('/send')))
  })
  it('nouveau message : pas de PATCH du tout, et les pièces passent par la collection', async () => {
    const { calls, fetch } = trace()
    await graphSend('tok', OUT, { kind: 'new' }, { fetch: F(fetch) })
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false)
    expect(JSON.parse(calls[0].body).attachments).toBeUndefined()
    expect(calls.some((c) => c.url.endsWith('/attachments') && c.method === 'POST')).toBe(true)
  })
  it('un échec après création SUPPRIME le brouillon — sinon il reste dans les Brouillons de l agent', async () => {
    const calls: { url: string; method: string }[] = []
    const fetch = vi.fn(async (u: string, init?: RequestInit) => {
      calls.push({ url: u, method: init?.method ?? 'GET' })
      if (u.endsWith('/attachments')) return new Response('too big', { status: 413 })
      if (init?.method === 'DELETE') return new Response(null, { status: 204 })
      return okJson({ id: 'DRAFT1' })
    })
    await expect(graphSend('tok', OUT, { kind: 'new' }, { fetch: F(fetch) })).rejects.toThrow(/http 413/)
    expect(calls.some((c) => c.method === 'DELETE' && c.url.includes('/me/messages/DRAFT1'))).toBe(true)
    expect(calls.some((c) => c.url.endsWith('/send'))).toBe(false)
  })
  it('le plafond Graph par pièce est bien « sous 3 Mo »', () => {
    expect(GRAPH_ATTACHMENT_MAX_BYTES).toBe(3 * 1024 * 1024)
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
