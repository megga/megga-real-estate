// supabase/functions/_shared/mail/ingest.test.ts
import { describe, it, expect } from 'vitest'
import { deriveThreadPatch, externalParticipants, pickContact, capHtml, type ThreadRow } from './ingest.ts'
import type { NormalizedMessage } from './types.ts'

const BOX = 'g@agence.ch'
const msg = (over: Partial<NormalizedMessage> = {}): NormalizedMessage => ({
  providerMessageId: 'm1', providerThreadId: 't1', rfc822MessageId: '<m1@ex>', inReplyTo: null, references: [],
  direction: 'inbound', from: { name: 'Zoé', email: 'zoe@ex.ch' }, to: [{ name: null, email: BOX }], cc: [], bcc: [],
  replyTo: null, subject: 'Visite', snippet: 'Bonjour', bodyText: 'Bonjour', bodyHtml: null,
  sentAt: '2026-09-03T08:00:00.000Z', isRead: false, isStarred: false, inInbox: true, isTrashed: false, isDraft: false,
  providerLabels: [], attachments: [], ...over,
})

describe('externalParticipants', () => {
  it('exclut la boîte, dédoublonne, garde l ordre', () => {
    const m = msg({ to: [{ name: 'G', email: BOX }, { name: 'Bob', email: 'bob@ex.ch' }], cc: [{ name: null, email: 'ZOE@ex.ch' }] })
    expect(externalParticipants(m, BOX)).toEqual([{ name: 'Zoé', email: 'zoe@ex.ch' }, { name: 'Bob', email: 'bob@ex.ch' }])
  })
})

describe('deriveThreadPatch', () => {
  it('nouveau fil entrant : non lu, en réception, expéditeur = premier externe', () => {
    const p = deriveThreadPatch(null, msg(), BOX, true)
    expect(p).toMatchObject({
      subject: 'Visite', snippet: 'Bonjour', from_name: 'Zoé', from_email: 'zoe@ex.ch',
      last_message_at: '2026-09-03T08:00:00.000Z', last_inbound_at: '2026-09-03T08:00:00.000Z', last_outbound_at: null,
      message_count: 1, has_attachments: false, is_read: false, is_starred: false, is_archived: false, is_trashed: false,
    })
    expect(p.participants).toEqual([{ name: 'Zoé', email: 'zoe@ex.ch' }])
  })
  it('réponse sortante plus récente : le fil devient lu-inchangé, last_outbound posé, extrait mis à jour', () => {
    const existing: ThreadRow = {
      id: 'T', account_id: 'A', subject: 'Visite', snippet: 'Bonjour', participants: [{ name: 'Zoé', email: 'zoe@ex.ch' }],
      from_name: 'Zoé', from_email: 'zoe@ex.ch', last_message_at: '2026-09-03T08:00:00.000Z', last_inbound_at: '2026-09-03T08:00:00.000Z',
      last_outbound_at: null, message_count: 1, has_attachments: false, is_read: true, is_starred: false, is_archived: false, is_trashed: false,
      label_id: null, contact_id: null,
    }
    const out = msg({ providerMessageId: 'm2', direction: 'outbound', from: { name: 'G', email: BOX }, to: [{ name: 'Zoé', email: 'zoe@ex.ch' }], snippet: 'À demain', sentAt: '2026-09-03T09:00:00.000Z', isRead: true, inInbox: false })
    const p = deriveThreadPatch(existing, out, BOX, true)
    expect(p).toMatchObject({ snippet: 'À demain', last_message_at: '2026-09-03T09:00:00.000Z', last_outbound_at: '2026-09-03T09:00:00.000Z', message_count: 2, is_read: true, from_email: 'zoe@ex.ch' })
  })
  it('un message archivé côté fournisseur archive le fil ; un déjà connu ne recompte pas', () => {
    const existing = { ...(deriveThreadPatch(null, msg(), BOX, true) as ThreadRow), id: 'T', account_id: 'A', label_id: null, contact_id: null }
    const p = deriveThreadPatch(existing, msg({ inInbox: false, isRead: true }), BOX, false)
    expect(p.is_archived).toBe(true)
    expect(p.message_count).toBe(1)
  })
  it('un message plus ancien n écrase ni l extrait ni la date', () => {
    const existing = { ...(deriveThreadPatch(null, msg(), BOX, true) as ThreadRow), id: 'T', account_id: 'A', label_id: null, contact_id: null }
    const p = deriveThreadPatch(existing, msg({ providerMessageId: 'm0', snippet: 'Ancien', sentAt: '2026-09-01T08:00:00.000Z' }), BOX, true)
    expect(p.snippet).toBe('Bonjour')
    expect(p.last_message_at).toBe('2026-09-03T08:00:00.000Z')
    expect(p.message_count).toBe(2)
  })
})

describe('pickContact', () => {
  it('un seul contact distinct = match ; plusieurs = null', () => {
    expect(pickContact([{ contact_id: 'c1' }, { contact_id: 'c1' }])).toBe('c1')
    expect(pickContact([{ contact_id: 'c1' }, { contact_id: 'c2' }])).toBeNull()
    expect(pickContact([])).toBeNull()
  })
})

describe('capHtml', () => {
  it('plafonne à 512 Kio et le dit', () => {
    expect(capHtml('x'.repeat(10))).toEqual({ html: 'x'.repeat(10), truncated: false })
    const big = capHtml('y'.repeat(600 * 1024))
    expect(big.truncated).toBe(true)
    expect(big.html.length).toBe(512 * 1024)
  })
})
