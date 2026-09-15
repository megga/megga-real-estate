// supabase/functions/_shared/mail/ingest.test.ts
import { describe, it, expect } from 'vitest'
import { deriveThreadPatch, externalParticipants, ingestMessages, linkThreadToContact, mailAuditEvent, pickContact, capHtml, recomputeThread, recordPendingSend, type ThreadRow } from './ingest.ts'
import type { MailAccountRow, NormalizedMessage, OutgoingMessage } from './types.ts'

const BOX = 'g@agence.ch'
const msg = (over: Partial<NormalizedMessage> = {}): NormalizedMessage => ({
  providerMessageId: 'm1', providerThreadId: 't1', rfc822MessageId: '<m1@ex>', inReplyTo: null, references: [],
  direction: 'inbound', from: { name: 'Zoé', email: 'zoe@ex.ch' }, to: [{ name: null, email: BOX }], cc: [], bcc: [],
  replyTo: null, subject: 'Visite', snippet: 'Bonjour', bodyText: 'Bonjour', bodyHtml: null,
  sentAt: '2026-09-03T08:00:00.000Z', isRead: false, isStarred: false, inInbox: true, isTrashed: false, isSpam: false, isDraft: false,
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

  // ⛔ Le fil archivé dont le DERNIER mot est celui de l'agent. La passe initiale de
  // Gmail liste du plus récent au plus ancien : le premier message ingéré est le
  // sortant, et l'ancienne condition (`inbound && plus récent`) ne laissait plus
  // AUCUN message décider ensuite — `is_archived` restait à `false` et le fil clos
  // remontait dans la Réception du CRM. Ce test rejoue exactement cet ordre.
  it('import initial, dernier mot à l agent : le fil suit son message ENTRANT le plus récent', () => {
    const sortant = msg({
      providerMessageId: 'm2', direction: 'outbound', from: { name: 'G', email: BOX },
      to: [{ name: 'Zoé', email: 'zoe@ex.ch' }], sentAt: '2026-09-03T09:00:00.000Z',
      isRead: true, inInbox: false,
    })
    const semis = { ...(deriveThreadPatch(null, sortant, BOX, true) as ThreadRow), id: 'T', account_id: 'A', label_id: null, contact_id: null }
    expect(semis.is_archived).toBe(false) // rien ne le sait encore : aucun entrant lu
    // Message suivant de la MÊME passe : l'entrant, plus ancien, sans libellé INBOX.
    const entrant = msg({ providerMessageId: 'm1', inInbox: false, isRead: true, sentAt: '2026-09-03T08:00:00.000Z' })
    expect(deriveThreadPatch(semis, entrant, BOX, true).is_archived).toBe(true)
  })
  it('un entrant PLUS ANCIEN que le dernier entrant connu ne décide plus de l archivage', () => {
    const recent = { ...(deriveThreadPatch(null, msg(), BOX, true) as ThreadRow), id: 'T', account_id: 'A', label_id: null, contact_id: null }
    expect(recent.is_archived).toBe(false) // le plus récent est en Réception
    const vieux = msg({ providerMessageId: 'm0', inInbox: false, sentAt: '2026-09-01T08:00:00.000Z' })
    expect(deriveThreadPatch(recent, vieux, BOX, true).is_archived).toBe(false)
  })
  it('un message SORTANT ne peut ni archiver ni désarchiver le fil', () => {
    const archive = { ...(deriveThreadPatch(null, msg({ inInbox: false }), BOX, true) as ThreadRow), id: 'T', account_id: 'A', label_id: null, contact_id: null }
    expect(archive.is_archived).toBe(true)
    const reponse = msg({ providerMessageId: 'm3', direction: 'outbound', from: { name: 'G', email: BOX }, sentAt: '2026-09-04T08:00:00.000Z', inInbox: false, isRead: true })
    expect(deriveThreadPatch(archive, reponse, BOX, true).is_archived).toBe(true)
  })

  // ⛔ LE PIÈGE QUE LES FIXTURES CI-DESSUS NE POUVAIENT PAS VOIR : elles écrivent la forme
  // `Z` des DEUX côtés. En vrai, `m.sentAt` vient de `toISOString()`
  // (`…T08:00:00.000Z`) et `existing.last_*_at` vient de PostgREST, qui rend un
  // `timestamptz` en `…T08:00:00+00:00`. Comparées en CHAÎNES, les deux divergent à
  // l'index 19 — c'est le préfixe date-heure qui décidait, et à la seconde près
  // `'.' > '+'` faisait toujours gagner l'entrant. Ces trois cas comparent des INSTANTS.
  describe('les dates du fil viennent de PostgREST, pas de toISOString', () => {
    const enBase = (m: NormalizedMessage): ThreadRow => {
      const p = deriveThreadPatch(null, m, BOX, true) as ThreadRow
      // Ce que PostgREST rend RÉELLEMENT pour un timestamptz sous une session UTC.
      const pg = (iso: string | null) => (iso ? iso.replace(/\.\d{3}Z$/, '+00:00') : iso)
      return { ...p, id: 'T', account_id: 'A', label_id: null, contact_id: null,
        last_message_at: pg(p.last_message_at)!, last_inbound_at: pg(p.last_inbound_at), last_outbound_at: pg(p.last_outbound_at) }
    }
    it('à la seconde PRÈS, un message plus ancien ne devient pas le dernier du fil', () => {
      const existing = enBase(msg({ snippet: 'Le vrai dernier' }))
      expect(existing.last_message_at).toBe('2026-09-03T08:00:00+00:00')
      // MÊME seconde, mais c'est déjà connu : rien ne doit rétrograder.
      const jumeau = msg({ providerMessageId: 'm9', snippet: 'Jumeau', sentAt: '2026-09-03T08:00:00.000Z' })
      expect(deriveThreadPatch(existing, jumeau, BOX, false).last_message_at).toBe('2026-09-03T08:00:00.000Z')
      // Plus ANCIEN d'une seconde : le fil garde sa date et son extrait.
      const vieux = msg({ providerMessageId: 'm0', snippet: 'Vieux', sentAt: '2026-09-03T07:59:59.000Z' })
      const p = deriveThreadPatch(existing, vieux, BOX, true)
      expect(p.last_message_at).toBe('2026-09-03T08:00:00+00:00')
      expect(p.snippet).toBe('Le vrai dernier')
    })
    it('last_inbound_at et last_outbound_at gardent le plus récent des deux formes', () => {
      const existing = enBase(msg())
      const vieuxEntrant = msg({ providerMessageId: 'm0', sentAt: '2026-09-02T08:00:00.000Z' })
      expect(deriveThreadPatch(existing, vieuxEntrant, BOX, true).last_inbound_at).toBe('2026-09-03T08:00:00+00:00')
      const sortantRecent = msg({ providerMessageId: 'm2', direction: 'outbound', from: { name: 'G', email: BOX }, sentAt: '2026-09-04T08:00:00.000Z' })
      expect(deriveThreadPatch(existing, sortantRecent, BOX, true).last_outbound_at).toBe('2026-09-04T08:00:00.000Z')
    })
    it('un entrant plus ancien ne décide toujours pas de l archivage sous la forme PostgREST', () => {
      const existing = enBase(msg()) // le plus récent est en Réception
      const vieux = msg({ providerMessageId: 'm0', inInbox: false, sentAt: '2026-09-01T08:00:00.000Z' })
      expect(deriveThreadPatch(existing, vieux, BOX, true).is_archived).toBe(false)
    })

    // ⛔ LE CAS QUI SÉPARE VRAIMENT LES DEUX IMPLÉMENTATIONS. Sous une session non UTC,
    // PostgREST rend le MÊME instant en `+02:00`. Comparé en chaînes,
    // `'2026-09-03T09:00:00.000Z' >= '2026-09-03T10:00:00+02:00'` est FAUX (divergence dès
    // l'heure) : un message POSTÉRIEUR d'une heure cessait de mettre le fil à jour — ni sa
    // date, ni son extrait, ni son état d'archivage. Comparés en instants, 09:00Z suit bien
    // 10:00+02:00 (soit 08:00Z).
    it('un fuseau de session non UTC ne renverse pas l ordre du fil', () => {
      const existing: ThreadRow = {
        ...(deriveThreadPatch(null, msg(), BOX, true) as ThreadRow),
        id: 'T', account_id: 'A', label_id: null, contact_id: null,
        last_message_at: '2026-09-03T10:00:00+02:00', // = 08:00Z, le même instant qu'au-dessus
        last_inbound_at: '2026-09-03T10:00:00+02:00',
      }
      const suivant = msg({ providerMessageId: 'm2', snippet: 'Le plus récent', inInbox: false, sentAt: '2026-09-03T09:00:00.000Z' })
      const p = deriveThreadPatch(existing, suivant, BOX, true)
      expect(p.last_message_at).toBe('2026-09-03T09:00:00.000Z')
      expect(p.last_inbound_at).toBe('2026-09-03T09:00:00.000Z')
      expect(p.snippet).toBe('Le plus récent')
      expect(p.is_archived).toBe(true)
    })
  })
})

describe('le spam (14.09.2026)', () => {
  it('le dernier entrant au spam met le fil au SPAM — plus en Archivé', () => {
    const p = deriveThreadPatch(null, msg({ inInbox: false, isSpam: true }), BOX, true)
    expect(p.is_spam).toBe(true)
    // Sorti de la Réception par le filtre du fournisseur, il se lisait « archivé ».
    expect(p.is_archived).toBe(false)
  })
  it('remis en Réception, le dernier entrant sort le fil du spam', () => {
    const p = deriveThreadPatch({ ...fil('T1', null), last_inbound_at: '2026-09-01T00:00:00.000Z', is_spam: true }, msg({ inInbox: true, isSpam: false }), BOX, false)
    expect(p.is_spam).toBe(false)
    expect(p.is_archived).toBe(false)
  })
  it('⛔ un courrier au spam n est rattaché à PERSONNE et n entre pas au journal', async () => {
    const { admin, calls, rpcCalls } = fakeAdmin(vide, () => ({ data: ['c1'], error: null }))
    await ingestMessages(admin, account, [msg({ isSpam: true, inInbox: false })])
    expect(rpcCalls.filter((r) => r.fn === 'mail_match_contact_by_emails')).toHaveLength(0)
    expect(calls.find((c) => c.table === 'mail_messages' && c.op === 'insert')?.payload).toMatchObject({ is_spam: true, contact_id: null })
    expect(calls.find((c) => c.table === 'mail_threads' && c.op === 'insert')?.payload).toMatchObject({ is_spam: true, contact_id: null })
    expect(calls.filter((c) => c.table === 'activity_events')).toHaveLength(0)
  })
  it('contrôle positif : le même courrier hors spam est rattaché ET journalisé', async () => {
    const { admin, calls, rpcCalls } = fakeAdmin(vide, () => ({ data: ['c1'], error: null }))
    await ingestMessages(admin, account, [msg()])
    expect(rpcCalls.filter((r) => r.fn === 'mail_match_contact_by_emails')).toHaveLength(1)
    expect(calls.find((c) => c.table === 'mail_messages' && c.op === 'insert')?.payload).toMatchObject({ is_spam: false, contact_id: 'c1' })
    expect(calls.filter((c) => c.table === 'activity_events' && c.op === 'insert')).toHaveLength(1)
  })

  // ⛔ Un hameconnage qui cite l'échange agent ↔ notaire rejoignait le vrai fil (Gmail et Graph
  // par leur regroupement, IMAP par `References`) et l'emportait ENTIER au Spam.
  it('⛔ un spam ne rejoint JAMAIS la conversation que le fournisseur lui prête', async () => {
    const conversation = { ...fil('T1', 'c1'), last_inbound_at: '2026-09-01T00:00:00.000Z' }
    const { admin, calls } = fakeAdmin((c) =>
      c.table === 'mail_threads' && c.op === 'select' && c.filters.some(([k, v]) => k === 'eq:provider_thread_id' && v === 't1')
        ? { data: conversation, error: null } : vide(c))
    await ingestMessages(admin, account, [msg({ providerMessageId: 'gm-9', providerThreadId: 't1', isSpam: true, inInbox: false })])
    const lecture = calls.find((c) => c.table === 'mail_threads' && c.op === 'select')
    expect(lecture?.filters).toContainEqual(['eq:provider_thread_id', 'spam:gm-9'])
    expect(calls.find((c) => c.table === 'mail_threads' && c.op === 'insert')?.payload).toMatchObject({ provider_thread_id: 'spam:gm-9', is_spam: true, contact_id: null })
    expect(calls.some((c) => c.table === 'mail_threads' && c.op === 'update'), 'la conversation n est pas touchée').toBe(false)
    // Témoin : le même courrier hors spam rejoint bien la conversation.
    const temoin = fakeAdmin((c) =>
      c.table === 'mail_threads' && c.op === 'select' && c.filters.some(([k, v]) => k === 'eq:provider_thread_id' && v === 't1')
        ? { data: conversation, error: null } : vide(c))
    await ingestMessages(temoin.admin, account, [msg({ providerMessageId: 'gm-9', providerThreadId: 't1' })])
    expect(temoin.calls.find((c) => c.table === 'mail_threads' && c.op === 'update')?.filters).toEqual([['eq:id', 'T1']])
  })

  it('un fil NÉ d un sortant au spam (l adresse de la boîte usurpée) est au spam — pas dans « Envoyés »', () => {
    const usurpe = msg({ direction: 'outbound', from: { name: 'G', email: BOX }, isSpam: true, inInbox: false })
    expect(deriveThreadPatch(null, usurpe, BOX, true).is_spam).toBe(true)
    expect(deriveThreadPatch(null, { ...usurpe, isSpam: false }, BOX, true).is_spam).toBe(false)
  })

  // ⛔ Rattaché et journalisé, puis passé au spam : son contact effacé, il se rejournalisait à sa
  // sortie du spam — une seconde ligne dans un journal append-only.
  it('rattaché PUIS passé au spam : il garde son contact, et sa sortie ne rejournalise rien', async () => {
    const connu = (spam: boolean) => (c: FakeCall): Reply =>
      c.table === 'mail_messages' && c.op === 'select'
        ? { data: { id: 'M1', thread_id: 'T1', provider_message_id: 'm1', is_spam: spam, contact_id: 'c1' }, error: null }
        : c.table === 'mail_threads' && c.op === 'select' ? { data: fil('T1', spam ? null : 'c1'), error: null } : vide(c)
    const aller = fakeAdmin(connu(false))
    await ingestMessages(aller.admin, account, [msg({ isSpam: true, inInbox: false })])
    expect(aller.calls.find((c) => c.table === 'mail_messages' && c.op === 'update')?.payload).toMatchObject({ is_spam: true, contact_id: 'c1' })
    const retour = fakeAdmin(connu(true), () => ({ data: ['c1'], error: null }))
    await ingestMessages(retour.admin, account, [msg()])
    expect(retour.calls.filter((c) => c.table === 'activity_events')).toHaveLength(0)
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
    // `html` est `string | null` : l'affirmer non nul AVANT d'en lire la longueur, sinon
    // `deno check` refuse la ligne (TS18047). La CI ne type-vérifie pas les *.test.ts —
    // raison de plus pour que le fichier passe quand on l'y soumet à la main.
    expect(big.html).not.toBeNull()
    expect(big.html?.length).toBe(512 * 1024)
  })
})

// ── Faux client PostgREST : on veut voir les REQUÊTES, pas simuler une base ────
// Chaque appel est enregistré sous la forme (table, opération, filtres) ; un
// « or » y apparaîtrait sous ce nom, ce qui rend le défaut d'injection visible
// depuis un test au lieu d'être une lecture de code. Le CORPS d'une insertion est
// gardé aussi (`payload`) : sans lui, ce qu'on écrit au journal restait invisible.
interface FakeCall { table: string; op: string; filters: [string, unknown][]; payload?: unknown }
interface FakeRpc { fn: string; args: unknown }
type Reply = { data: unknown; error: { message: string } | null }

function fakeAdmin(reply: (c: FakeCall) => Reply, rpcReply: () => Reply = () => ({ data: [], error: null })) {
  const calls: FakeCall[] = []
  const rpcCalls: FakeRpc[] = []
  const from = (table: string) => {
    const rec: FakeCall = { table, op: '', filters: [] }
    const settle = () => { calls.push(rec); return reply(rec) }
    const b = {
      select: () => { if (!rec.op) rec.op = 'select'; return b },
      insert: (row: unknown) => { rec.op = 'insert'; rec.payload = row; return b },
      update: (row: unknown) => { rec.op = 'update'; rec.payload = row; return b },
      upsert: (row: unknown) => { rec.op = 'upsert'; rec.payload = row; return b },
      delete: () => { rec.op = 'delete'; return b },
      eq: (col: string, val: unknown) => { rec.filters.push([`eq:${col}`, val]); return b },
      neq: (col: string, val: unknown) => { rec.filters.push([`neq:${col}`, val]); return b },
      like: (col: string, val: unknown) => { rec.filters.push([`like:${col}`, val]); return b },
      in: (col: string, val: unknown) => { rec.filters.push([`in:${col}`, val]); return b },
      is: (col: string, val: unknown) => { rec.filters.push([`is:${col}`, val]); return b },
      or: (f: string) => { rec.filters.push(['or', f]); return b },
      order: () => b,
      limit: () => b,
      maybeSingle: async () => settle(),
      single: async () => settle(),
      then: (res: (v: Reply) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve().then(settle).then(res, rej),
    }
    return b
  }
  const rpc = async (fn: string, args: unknown) => { rpcCalls.push({ fn, args }); return rpcReply() }
  return { admin: { from, rpc } as never, calls, rpcCalls }
}

const account: MailAccountRow = {
  id: 'acc-1', agency_id: 'ag-1', owner_id: 'u-1', provider: 'gmail', email: BOX,
  display_name: null, visibility: 'owner', status: 'active', vault_secret_id: 'v-1',
  sync_cursor: {}, next_sync_at: '', last_sync_at: null, last_error: null, imap_config: null,
}
const vide = (c: FakeCall): Reply =>
  c.op === 'insert' ? { data: { id: `${c.table}-1` }, error: null }
    : c.op === 'select' && c.table === 'mail_contact_aliases' ? { data: [], error: null }
      : { data: null, error: null }
/** Un fil tel que `mail_threads` le rend à la lecture `select('*')`. */
const fil = (id: string, contact: string | null): ThreadRow => ({
  id, account_id: 'acc-1', subject: 'Visite', snippet: 's', participants: [{ name: 'Zoé', email: 'zoe@ex.ch' }],
  from_name: null, from_email: null, last_message_at: '2026-09-13T08:00:00.000Z', last_inbound_at: null,
  last_outbound_at: '2026-09-13T08:00:00.000Z', message_count: 1, has_attachments: false, is_read: true,
  is_starred: false, is_archived: false, is_trashed: false, is_spam: false, label_id: null, contact_id: contact,
})

describe('ingestMessages : recherche du message déjà connu', () => {
  // ⛔ Le filtre était construit par concaténation dans `.or()`, que postgrest-js
  // recopie tel quel dans l'URL (aucun échappement, contrairement à `.in()`). Le
  // `Message-ID` d'un e-mail entrant est du texte d'ATTAQUANT : une virgule y
  // ajoutait un terme au OU, `provider_message_id.not.is.null` rendait un message
  // quelconque de la boîte, et la suite l'écrasait avec le contenu de l'attaquant.
  const PIEGE = '<a),provider_message_id.not.is.null,and(id.not.is.null'

  // Un SORTANT : seul lui peut être la copie d'un envoi en attente (`pending:`), donc lui seul
  // fait la seconde lecture — celle qui porte le texte de l'expéditeur.
  const sortant = (over: Partial<NormalizedMessage> = {}) => msg({ direction: 'outbound', from: { name: 'G', email: BOX }, to: [{ name: 'Zoé', email: 'zoe@ex.ch' }], ...over })

  it('un Message-ID piégé ne peut désigner aucune autre ligne : deux .eq(), jamais de .or()', async () => {
    const { admin, calls } = fakeAdmin(vide)
    await ingestMessages(admin, account, [sortant({ providerMessageId: 'm-neuf', rfc822MessageId: PIEGE })])

    expect(calls.some((c) => c.filters.some(([k]) => k === 'or'))).toBe(false)
    const lookups = calls.filter((c) => c.table === 'mail_messages' && c.op === 'select' && c.filters.some(([k]) => k === 'eq:provider_message_id'))
    expect(lookups).toHaveLength(2)
    // Le texte de l'attaquant reste UNE valeur, dans un paramètre à lui.
    expect(lookups[0].filters).toEqual([['eq:account_id', 'acc-1'], ['eq:provider_message_id', 'm-neuf']])
    expect(lookups[1].filters).toEqual([['eq:account_id', 'acc-1'], ['eq:provider_message_id', `pending:${PIEGE}`]])
    // Et il ne s'échappe nulle part ailleurs : aucune requête ne le porte comme filtre
    // structurel, seulement comme la valeur d'un `.eq()`.
    for (const c of calls) {
      for (const [cle, val] of c.filters) {
        if (typeof val === 'string' && val.includes(PIEGE)) expect(['eq:provider_message_id', 'eq:rfc822_message_id']).toContain(cle)
      }
    }
  })

  // ⛔ Un destinataire connaît le Message-ID de ce qu'on lui a écrit : sa réponse qui le
  // reprenait, lue avant la copie « Envoyés », prenait la ligne de l'envoi et la réécrivait.
  it('un ENTRANT ne peut pas prendre la ligne pending: d un envoi du CRM — un spam non plus', async () => {
    const MID = '<crm-1@agence.ch>'
    const pendingRow = { id: 'M', thread_id: 'P', provider_message_id: `pending:${MID}`, is_spam: false, contact_id: 'c1' }
    const repond = (c: FakeCall): Reply =>
      c.table === 'mail_messages' && c.op === 'select' && c.filters.some(([k, v]) => k === 'eq:provider_message_id' && v === `pending:${MID}`)
        ? { data: pendingRow, error: null }
        // Le recalcul des fils quand la copie change de fil (provisoire → vrai).
        : c.table === 'mail_messages' && c.op === 'select' && c.filters.some(([k]) => k === 'eq:thread_id') ? { data: [], error: null }
          : vide(c)
    for (const m of [msg({ rfc822MessageId: MID }), sortant({ rfc822MessageId: MID, isSpam: true, inInbox: false })]) {
      const { admin, calls } = fakeAdmin(repond)
      const r = await ingestMessages(admin, account, [m])
      expect(r).toMatchObject({ inserted: 1, updated: 0 })
      expect(calls.some((c) => c.filters.some(([, v]) => v === `pending:${MID}`))).toBe(false)
      expect(calls.some((c) => c.table === 'mail_messages' && c.op === 'update')).toBe(false)
    }
    // Témoin : la vraie copie « Envoyés » la trouve, et la reprend.
    const { admin } = fakeAdmin(repond)
    expect(await ingestMessages(admin, account, [sortant({ rfc822MessageId: MID })])).toMatchObject({ inserted: 0, updated: 1 })
  })

  it('la boîte est TOUJOURS dans le filtre : un message piégé ne sort pas du compte', async () => {
    const { admin, calls } = fakeAdmin(vide)
    await ingestMessages(admin, account, [msg({ rfc822MessageId: PIEGE })])
    for (const c of calls.filter((x) => x.table === 'mail_messages' && x.op === 'select')) {
      expect(c.filters[0]).toEqual(['eq:account_id', 'acc-1'])
    }
  })

  it('sans rfc822MessageId, une seule lecture', async () => {
    const { admin, calls } = fakeAdmin(vide)
    await ingestMessages(admin, account, [msg({ rfc822MessageId: null })])
    expect(calls.filter((c) => c.table === 'mail_messages' && c.op === 'select')).toHaveLength(1)
  })

  it('un message déjà connu arrête la recherche à la première lecture', async () => {
    const { admin, calls } = fakeAdmin((c) =>
      c.table === 'mail_messages' && c.op === 'select'
        ? { data: { id: 'M1', thread_id: 'T1', provider_message_id: 'm1' }, error: null }
        : c.table === 'mail_threads' && c.op === 'select' ? { data: fil('T1', null), error: null }
          : vide(c))
    await ingestMessages(admin, account, [msg()])
    expect(calls.filter((c) => c.table === 'mail_messages' && c.op === 'select')).toHaveLength(1)
  })

  it('une erreur PostgREST est LEVÉE, jamais lue comme « message inconnu »', async () => {
    // Avaler l'erreur menait à une insertion, donc au 23505 de l'index unique, donc à
    // une passe qui mourait à chaque tick : la boîte ne se synchronisait plus jamais.
    const { admin } = fakeAdmin((c) =>
      c.table === 'mail_messages' && c.op === 'select' ? { data: null, error: { message: 'boom' } } : vide(c))
    await expect(ingestMessages(admin, account, [msg()])).rejects.toThrow(/message lookup: boom/)
  })
})

describe('recomputeThread', () => {
  it('une lecture en échec ne supprime RIEN — elle lève', async () => {
    // `!msgs` valait « fil vide » : un timeout ou un cache de schéma périmé suffisait à
    // effacer le fil, et les deux `on delete cascade` emportaient corps et pièces.
    const { admin, calls } = fakeAdmin((c) =>
      c.table === 'mail_messages' ? { data: null, error: { message: 'timeout' } } : vide(c))
    await expect(recomputeThread(admin, 'T1')).rejects.toThrow(/recompute select: timeout/)
    expect(calls.some((c) => c.op === 'delete')).toBe(false)
  })

  it('zéro message POSITIVEMENT constaté : là, le fil est supprimé', async () => {
    const { admin, calls } = fakeAdmin((c) =>
      c.table === 'mail_messages' ? { data: [], error: null } : { data: null, error: null })
    await recomputeThread(admin, 'T1')
    expect(calls.filter((c) => c.table === 'mail_threads' && c.op === 'delete')).toHaveLength(1)
  })

  it('des messages : agrégats recalculés, aucune suppression', async () => {
    const { admin, calls } = fakeAdmin((c) =>
      c.table === 'mail_messages'
        ? { data: [{ sent_at: '2026-09-03T08:00:00.000Z', direction: 'inbound', is_read: true, has_attachments: false, snippet: 'a' }], error: null }
        : { data: null, error: null })
    await recomputeThread(admin, 'T1')
    expect(calls.some((c) => c.op === 'delete')).toBe(false)
    expect(calls.filter((c) => c.table === 'mail_threads' && c.op === 'update')).toHaveLength(1)
  })

  // Un message signalé au milieu d'une conversation : la lecture le tient à part, la liste ne
  // doit ni compter le fil « non lu » pour lui, ni lui prêter sa pièce jointe.
  it('un fil HORS spam se résume par ses messages hors spam', async () => {
    const m = (h: string, o: Record<string, unknown>) => ({ sent_at: `2026-09-03T${h}:00:00.000Z`, direction: 'inbound', is_read: true, has_attachments: false, snippet: h, is_spam: false, ...o })
    const recalcul = async (msgs: unknown[]) => {
      const { admin, calls } = fakeAdmin((c) => c.table === 'mail_messages' ? { data: msgs, error: null } : { data: null, error: null })
      await recomputeThread(admin, 'T1')
      return calls.find((c) => c.table === 'mail_threads' && c.op === 'update')?.payload
    }
    const hamecon = m('09', { is_read: false, has_attachments: true, is_spam: true })
    expect(await recalcul([m('08', {}), hamecon, m('10', {})])).toMatchObject({ is_spam: false, is_read: true, has_attachments: false, message_count: 3, snippet: '10' })
    // Au spam, le fil se résume par TOUS ses messages.
    expect(await recalcul([m('08', {}), { ...hamecon, sent_at: '2026-09-03T11:00:00.000Z' }])).toMatchObject({ is_spam: true, is_read: false, has_attachments: true })
    // Sans entrant, le fil est au spam si tous ses messages le sont.
    expect(await recalcul([m('08', { direction: 'outbound', is_spam: true })])).toMatchObject({ is_spam: true })
    expect(await recalcul([m('08', { direction: 'outbound' })])).toMatchObject({ is_spam: false })
  })
})


// ⛔ « Je n'ai pas pu chercher » n'est pas « il n'y a personne ». Une erreur avalée
// écrivait `contact_id: null` sur le fil ET sur le message, et sautait l'événement
// d'audit (gardé par `&& contactId`) : une trace append-only à laquelle il manque une
// entrée ne se rattrape pas, même quand la passe suivante rattache enfin le fil.
describe('matchContact : une recherche en échec est LEVÉE', () => {
  it('RPC de rapprochement en erreur', async () => {
    const { admin } = fakeAdmin(vide, () => ({ data: null, error: { message: 'rpc down' } }))
    await expect(ingestMessages(admin, account, [msg()])).rejects.toThrow(/contact match: rpc down/)
  })
  it('lecture des alias appris en erreur', async () => {
    const { admin } = fakeAdmin((c) =>
      c.table === 'mail_contact_aliases' ? { data: null, error: { message: 'alias down' } } : vide(c))
    await expect(ingestMessages(admin, account, [msg()])).rejects.toThrow(/contact alias match: alias down/)
  })
})

// ⛔ Le journal reçoit le FAIT d'un courrier, jamais son CONTENU (`mailAuditEvent`). Aucun
// test n'atteignait l'écriture : la RPC du faux rendait `[]`, donc aucun contact, donc
// aucune ligne — le site qui recopiait objet et adresses dans `activity_events`, lisible
// de toute l'agence et du super-admin, n'avait aucune couverture.
describe('journal : le fait d un courrier, jamais son contenu', () => {
  const rattache = (): Reply => ({ data: ['c1'], error: null })
  const OBJET = 'Offre confidentielle — Villa Cologny'
  const TIERS = 'notaire@etude.ch'
  const auJournal = (calls: FakeCall[]) => calls.filter((c) => c.table === 'activity_events' && c.op === 'insert')
  const ligneAttendue = (action: 'email_received' | 'email_sent') => ({
    agency_id: 'ag-1', actor_id: null, actor_kind: 'system', action,
    category: 'messaging', severity: 'info', entity_type: 'contact', entity_id: 'c1',
    object_label: null,
    metadata: { thread_id: 'mail_threads-1', message_id: 'mail_messages-1', account_id: 'acc-1', sent_at: '2026-09-03T08:00:00.000Z' },
  })
  const sansContenu = (payload: unknown, fuites: string[]) => {
    const brut = JSON.stringify(payload)
    for (const f of fuites) expect(brut, `« ${f} » a atteint le journal`).not.toContain(f)
  }

  // Les DEUX visibilités : le super-admin ne doit lire le courrier d'aucune boîte (D14),
  // et une boîte partagée aujourd'hui peut devenir personnelle demain (`mail-oauth` update).
  for (const visibility of ['owner', 'agency'] as const) {
    it(`boîte ${visibility} : un courrier reçu écrit une ligne sans objet ni adresse`, async () => {
      const { admin, calls } = fakeAdmin(vide, rattache)
      await ingestMessages(admin, { ...account, visibility }, [msg({ subject: OBJET, to: [{ name: null, email: BOX }, { name: 'Me Tiers', email: TIERS }] })])
      const lignes = auJournal(calls)
      expect(lignes, 'l écriture au journal doit être ATTEINTE — sinon ce test ne prouve rien').toHaveLength(1)
      expect(lignes[0].payload).toEqual(ligneAttendue('email_received'))
      sansContenu(lignes[0].payload, [OBJET, 'zoe@ex.ch', 'Zoé', TIERS, 'Me Tiers', BOX])
    })
  }

  it('un courrier envoyé hors du CRM (synchro des Envoyés) : email_sent, même neutralité', async () => {
    const { admin, calls } = fakeAdmin(vide, rattache)
    await ingestMessages(admin, account, [msg({
      direction: 'outbound', subject: `Re: ${OBJET}`, from: { name: 'G', email: BOX }, to: [{ name: 'Zoé', email: 'zoe@ex.ch' }], cc: [{ name: null, email: TIERS }],
    })])
    const lignes = auJournal(calls)
    expect(lignes).toHaveLength(1)
    expect(lignes[0].payload).toEqual(ligneAttendue('email_sent'))
    sansContenu(lignes[0].payload, [OBJET, 'zoe@ex.ch', TIERS, BOX])
  })

  it('contrôle positif : le contenu reste là où la RLS de la boîte le garde', async () => {
    // Le faux voit bien les corps d'insertion : le message, lui, porte son objet et ses
    // adresses. Sans ce témoin, « aucune fuite » pourrait venir d'un faux aveugle.
    const { admin, calls } = fakeAdmin(vide, rattache)
    await ingestMessages(admin, account, [msg({ subject: OBJET })])
    const message = calls.find((c) => c.table === 'mail_messages' && c.op === 'insert')
    expect(message?.payload).toMatchObject({ subject: OBJET, from_email: 'zoe@ex.ch' })
  })

  it('un message déjà connu n écrit rien au journal', async () => {
    const { admin, calls } = fakeAdmin((c) =>
      c.table === 'mail_messages' && c.op === 'select'
        ? { data: { id: 'M1', thread_id: 'T1', provider_message_id: 'm1' }, error: null }
        : c.table === 'mail_threads' && c.op === 'select' ? { data: fil('T1', 'c1'), error: null }
          : vide(c), rattache)
    await ingestMessages(admin, account, [msg({ subject: OBJET })])
    expect(auJournal(calls)).toHaveLength(0)
  })

  it('mailAuditEvent — l envoi depuis le CRM porte l agent et le geste, rien d autre', () => {
    // La forme de `mail-send` : acteur humain, `kind`, et un message local qui peut
    // manquer (envoi parti, comptabilité locale en échec).
    expect(mailAuditEvent({
      agencyId: 'ag-1', contactId: 'c1', action: 'email_sent', accountId: 'acc-1', threadId: 'T1', messageId: null, actorId: 'u-1', kind: 'reply',
      sentAt: '2026-09-13T09:00:00.000Z',
    })).toEqual({
      agency_id: 'ag-1', actor_id: 'u-1', actor_kind: 'user', action: 'email_sent',
      category: 'messaging', severity: 'info', entity_type: 'contact', entity_id: 'c1',
      object_label: null,
      metadata: { thread_id: 'T1', message_id: null, account_id: 'acc-1', sent_at: '2026-09-13T09:00:00.000Z', kind: 'reply' },
    })
  })

  // ⛔ La passe initiale journalise 90 jours de courrier en quelques heures : sans l'instant
  // du COURRIER, chaque ligne portait le jour de la connexion, dans l'ordre INVERSE (Gmail
  // liste du plus récent au plus ancien), et la timeline du contact gardait les 50 plus VIEUX.
  describe('la date du fait : metadata.sent_at, jamais un created_at posé à la main', () => {
    const ligneDe = async (sentAt: string) => {
      const { admin, calls } = fakeAdmin(vide, rattache)
      await ingestMessages(admin, account, [msg({ sentAt })])
      const [ligne] = auJournal(calls)
      return ligne.payload as { metadata: { sent_at: string | null } }
    }

    it('un courrier de juin, synchronisé en septembre, garde sa date de juin', async () => {
      const ligne = await ligneDe('2026-06-15T08:00:00.000Z')
      expect(ligne.metadata.sent_at).toBe('2026-06-15T08:00:00.000Z')
      // `created_at` est l'horloge de l'audit (garde des 10 ans, purge, fenêtres) : l'antidater
      // la livrerait à une date externe. Le contrat ne le pose JAMAIS.
      expect(ligne).not.toHaveProperty('created_at')
    })

    it('forme canonique Z : le tri serveur porte sur le TEXTE de metadata->>sent_at', async () => {
      expect((await ligneDe('2026-06-15T10:00:00+02:00')).metadata.sent_at).toBe('2026-06-15T08:00:00.000Z')
    })

    it('un fait ne peut pas avoir eu lieu après son enregistrement : borné à maintenant', async () => {
      const avant = Date.now()
      const futur = (await ligneDe('2100-01-01T00:00:00.000Z')).metadata.sent_at
      expect(Date.parse(futur!)).toBeGreaterThanOrEqual(avant)
      expect(Date.parse(futur!)).toBeLessThanOrEqual(Date.now())
    })

    it('une date illisible ne lève pas (l audit s écrit APRÈS le message) : elle vaut maintenant', async () => {
      const avant = Date.now()
      const illisible = (await ligneDe('pas une date')).metadata.sent_at
      expect(Date.parse(illisible!)).toBeGreaterThanOrEqual(avant)
      expect(Date.parse(illisible!)).toBeLessThanOrEqual(Date.now())
    })
  })
})

describe('linkThreadToContact : « Rapprocher l adresse » ne dit plus ok sur un travail non fait', () => {
  // Le fil T1 : un entrant de Zoé, adressé à la boîte, le notaire en copie.
  const adressesDuFil = [{ from_email: 'Zoe@Ex.ch', to: [{ name: null, email: BOX }], cc: [{ name: 'Me', email: 'notaire@etude.ch' }] }]
  const ok = (c: FakeCall): Reply =>
    c.table === 'contacts' ? { data: { id: 'c1' }, error: null }
      : c.table === 'mail_messages' && c.op === 'select' ? { data: adressesDuFil, error: null }
        : (c.table === 'mail_accounts' || c.table === 'profiles') && c.op === 'select' ? { data: [], error: null }
          : c.table === 'mail_threads' && c.op === 'update' ? { data: [{ id: 'T1' }], error: null }
            : { data: null, error: null }

  it('le chemin nominal apprend l alias, rattache le fil et complète les messages', async () => {
    const { admin, calls } = fakeAdmin(ok)
    await linkThreadToContact(admin, account, 'T1', 'c1', 'Zoe@Ex.ch', 'u-1')
    expect(calls.map((c) => `${c.table}:${c.op}`)).toEqual([
      'contacts:select', 'mail_messages:select', 'mail_accounts:select', 'profiles:select',
      'mail_contact_aliases:upsert', 'mail_threads:update', 'mail_messages:update',
    ])
    expect(calls.find((c) => c.op === 'upsert')?.payload).toEqual({ agency_id: 'ag-1', email: 'zoe@ex.ch', contact_id: 'c1', learned_by: 'u-1' })
  })

  // ⛔ mail-actions ne vérifiait qu'un « @ » : sur n'importe quel fil visible, un agent
  // réaffectait l'alias d'une adresse qu'il n'a jamais lue (l'upsert réécrit contact_id et
  // learned_by sur conflit) et détournait le rattachement du courrier d'un collègue.
  it('une adresse ABSENTE du fil est refusée, et aucun alias n est écrit', async () => {
    const { admin, calls } = fakeAdmin(ok)
    await expect(linkThreadToContact(admin, account, 'T1', 'c2', 'victime@ex.ch', 'u-1')).rejects.toThrow(/email_not_in_thread/)
    expect(calls.map((c) => `${c.table}:${c.op}`)).toEqual(['contacts:select', 'mail_messages:select'])
  })
  it('l adresse de la boîte elle-même est refusée', async () => {
    const { admin, calls } = fakeAdmin(ok)
    await expect(linkThreadToContact(admin, account, 'T1', 'c1', BOX.toUpperCase(), 'u-1')).rejects.toThrow(/email_not_in_thread/)
    expect(calls.some((c) => c.op === 'upsert')).toBe(false)
  })
  it('un correspondant en copie est accepté', async () => {
    const { admin, calls } = fakeAdmin(ok)
    await linkThreadToContact(admin, account, 'T1', 'c1', 'notaire@etude.ch', 'u-1')
    expect(calls.find((c) => c.op === 'upsert')?.payload).toMatchObject({ email: 'notaire@etude.ch' })
  })
  it('les adresses sont lues dans les messages de CE fil de CE compte', async () => {
    const { admin, calls } = fakeAdmin(ok)
    await linkThreadToContact(admin, account, 'T1', 'c1', 'zoe@ex.ch', 'u-1')
    expect(calls.find((c) => c.table === 'mail_messages' && c.op === 'select')?.filters).toEqual([['eq:thread_id', 'T1'], ['eq:account_id', 'acc-1']])
  })
  it('la lecture des adresses du fil en erreur est LEVÉE, aucun alias n est écrit', async () => {
    const { admin, calls } = fakeAdmin((c) =>
      c.table === 'mail_messages' && c.op === 'select' ? { data: null, error: { message: 'boom' } } : ok(c))
    await expect(linkThreadToContact(admin, account, 'T1', 'c1', 'zoe@ex.ch', 'u-1')).rejects.toThrow(/thread addresses: boom/)
    expect(calls.some((c) => c.op === 'upsert')).toBe(false)
  })

  // ⛔ L'adresse d'une AUTRE boîte de l'agence, ou d'un collègue, est un correspondant du fil
  // (un transfert « Fwd: » d'un collègue) — mais la rapprocher d'un client rattachait à ce
  // client TOUT le courrier interne venant d'elle, dans chaque boîte, en append-only.
  it('une adresse INTERNE (une boîte de l agence) est refusée', async () => {
    const { admin, calls } = fakeAdmin((c) =>
      c.table === 'mail_accounts' && c.op === 'select' ? { data: [{ id: 'acc-2' }], error: null } : ok(c))
    await expect(linkThreadToContact(admin, account, 'T1', 'c1', 'zoe@ex.ch', 'u-1')).rejects.toThrow(/email_is_internal/)
    expect(calls.find((c) => c.table === 'mail_accounts')?.filters).toEqual([['eq:agency_id', 'ag-1'], ['eq:email', 'zoe@ex.ch']])
    expect(calls.some((c) => c.op === 'upsert')).toBe(false)
  })
  it('une adresse INTERNE (un membre de l agence) est refusée', async () => {
    const { admin, calls } = fakeAdmin((c) =>
      c.table === 'profiles' && c.op === 'select' ? { data: [{ id: 'u-2' }], error: null } : ok(c))
    await expect(linkThreadToContact(admin, account, 'T1', 'c1', 'zoe@ex.ch', 'u-1')).rejects.toThrow(/email_is_internal/)
    expect(calls.find((c) => c.table === 'profiles')?.filters).toEqual([['eq:agency_id', 'ag-1'], ['eq:email', 'zoe@ex.ch']])
  })
  // ⛔ Un alias d'envoi (« envoyer en tant que ») n'est ni une boîte ni un profil : il passait
  // pour externe, et rapproché d'un client il lui rattachait le courrier écrit sous cet alias.
  it('l expéditeur d un SORTANT du fil (alias d envoi) est une adresse interne', async () => {
    const avecAlias = [...adressesDuFil, { direction: 'outbound', from_email: 'Info@Agence.ch', to: [{ name: null, email: 'zoe@ex.ch' }], cc: [] }]
    const { admin, calls } = fakeAdmin((c) =>
      c.table === 'mail_messages' && c.op === 'select' ? { data: avecAlias, error: null } : ok(c))
    await expect(linkThreadToContact(admin, account, 'T1', 'c1', 'info@agence.ch', 'u-1')).rejects.toThrow(/email_is_internal/)
    expect(calls.some((c) => c.op === 'upsert')).toBe(false)
    // Le destinataire de ce même sortant, lui, reste un correspondant.
    const { admin: admin2, calls: calls2 } = fakeAdmin((c) =>
      c.table === 'mail_messages' && c.op === 'select' ? { data: avecAlias, error: null } : ok(c))
    await linkThreadToContact(admin2, account, 'T1', 'c1', 'zoe@ex.ch', 'u-1')
    expect(calls2.find((c) => c.op === 'upsert')?.payload).toMatchObject({ email: 'zoe@ex.ch' })
  })
  it('la lecture des adresses internes en erreur est LEVÉE', async () => {
    const { admin } = fakeAdmin((c) =>
      c.table === 'mail_accounts' && c.op === 'select' ? { data: null, error: { message: 'boom' } } : ok(c))
    await expect(linkThreadToContact(admin, account, 'T1', 'c1', 'zoe@ex.ch', 'u-1')).rejects.toThrow(/internal addresses: boom/)
  })
  it('un contact hors agence est refusé avant toute lecture du fil', async () => {
    const { admin, calls } = fakeAdmin((c) => c.table === 'contacts' ? { data: null, error: null } : ok(c))
    await expect(linkThreadToContact(admin, account, 'T1', 'c-autre', 'zoe@ex.ch', 'u-1')).rejects.toThrow(/contact_not_in_agency/)
    expect(calls.map((c) => `${c.table}:${c.op}`)).toEqual(['contacts:select'])
  })
  it('alias refusé : levée — sinon le PROCHAIN courrier de l adresse repart non apparié', async () => {
    const { admin } = fakeAdmin((c) =>
      c.table === 'mail_contact_aliases' ? { data: null, error: { message: 'duplicate key' } } : ok(c))
    await expect(linkThreadToContact(admin, account, 'T1', 'c1', 'zoe@ex.ch', 'u-1')).rejects.toThrow(/alias upsert: duplicate key/)
  })
  it('aucun fil apparié (fil d un autre compte) : levée, jamais un ok:true', async () => {
    const { admin } = fakeAdmin((c) =>
      c.table === 'mail_threads' && c.op === 'update' ? { data: [], error: null } : ok(c))
    await expect(linkThreadToContact(admin, account, 'T-autre', 'c1', 'zoe@ex.ch', 'u-1')).rejects.toThrow(/thread_not_in_account/)
  })
  it('complément des messages en erreur : levée', async () => {
    const { admin } = fakeAdmin((c) =>
      c.table === 'mail_messages' && c.op === 'update' ? { data: null, error: { message: 'boom' } } : ok(c))
    await expect(linkThreadToContact(admin, account, 'T1', 'c1', 'zoe@ex.ch', 'u-1')).rejects.toThrow(/messages backfill: boom/)
  })
  it('lecture du contact en erreur : ce n est PAS « hors agence »', async () => {
    const { admin } = fakeAdmin((c) =>
      c.table === 'contacts' ? { data: null, error: { message: 'timeout' } } : ok(c))
    await expect(linkThreadToContact(admin, account, 'T1', 'c1', 'zoe@ex.ch', 'u-1')).rejects.toThrow(/contact lookup: timeout/)
  })
})

// ⛔ Un NOUVEAU courrier Outlook envoyé depuis le CRM n'entrait jamais au journal : le fil
// provisoire naissait sans contact (donc pas d'`email_sent` dans mail-send), et la synchro
// retrouvait ensuite la ligne `pending:` — un message CONNU — sans rien écrire non plus.
describe('recordPendingSend : la copie provisoire d un envoi Outlook naît rattachée (D11)', () => {
  const MID = '<crm-1@agence.ch>'
  const rattache = (): Reply => ({ data: ['c1'], error: null })
  const sortant = (over: Partial<OutgoingMessage> = {}): OutgoingMessage => ({
    from: { name: 'G', email: BOX }, to: [{ name: 'Zoé', email: 'zoe@ex.ch' }], cc: [{ name: null, email: 'notaire@etude.ch' }],
    bcc: [{ name: null, email: 'cci@ex.ch' }], subject: 'Visite samedi', text: 'Bonjour', html: '<p>Bonjour</p>',
    inReplyTo: null, references: [], messageId: MID, attachments: [], ...over,
  })
  const envoi = (over: Partial<Parameters<typeof recordPendingSend>[2]> = {}) =>
    ({ threadId: null, outgoing: sortant(), snippet: 'Bonjour', hasAttachments: false, ...over })
  const ecrits = (calls: FakeCall[], t: string, op: string) => calls.filter((c) => c.table === t && c.op === op)

  it('nouveau message : le fil ET le message portent le contact, rien n est écrit au journal ici', async () => {
    const { admin, calls, rpcCalls } = fakeAdmin(vide, rattache)
    const r = await recordPendingSend(admin, { ...account, provider: 'outlook' }, envoi())
    expect(r).toEqual({ threadId: 'mail_threads-1', messageId: 'mail_messages-1', contactId: 'c1' })
    expect(ecrits(calls, 'mail_threads', 'insert')[0].payload).toMatchObject({ provider_thread_id: `pending-thread:${MID}`, contact_id: 'c1' })
    expect(ecrits(calls, 'mail_messages', 'insert')[0].payload).toMatchObject({
      provider_message_id: `pending:${MID}`, rfc822_message_id: MID, direction: 'outbound', contact_id: 'c1',
    })
    expect(rpcCalls).toEqual([{ fn: 'mail_match_contact_by_emails', args: { p_agency_id: 'ag-1', p_emails: ['zoe@ex.ch', 'notaire@etude.ch'] } }])
    // Le journal reste à mail-send, seul à connaître l'agent.
    expect(calls.filter((c) => c.table === 'activity_events')).toEqual([])
  })

  it('même règle que l ingestion : À et Cc, la boîte exclue, jamais la Cci', async () => {
    const { admin, rpcCalls } = fakeAdmin(vide, rattache)
    await recordPendingSend(admin, account, envoi({ outgoing: sortant({ to: [{ name: null, email: BOX }, { name: 'Zoé', email: 'zoe@ex.ch' }], cc: [] }) }))
    expect(rpcCalls).toEqual([{ fn: 'mail_match_contact_by_emails', args: { p_agency_id: 'ag-1', p_emails: ['zoe@ex.ch'] } }])
  })

  it('aucun contact : le fil naît sans contact', async () => {
    const { admin, calls } = fakeAdmin(vide)
    const r = await recordPendingSend(admin, account, envoi())
    expect(r.contactId).toBeNull()
    expect(ecrits(calls, 'mail_threads', 'insert')[0].payload).toMatchObject({ contact_id: null })
  })

  it('la recherche lève AVANT toute écriture : la copie « Envoyés » arrivera neuve, et sera journalisée', async () => {
    const { admin, calls } = fakeAdmin(vide, () => ({ data: null, error: { message: 'rpc down' } }))
    await expect(recordPendingSend(admin, account, envoi())).rejects.toThrow(/contact match: rpc down/)
    expect(calls.filter((c) => c.op !== 'select')).toEqual([])
  })

  it('réponse sur un fil déjà rattaché : aucune recherche, le message suit le contact du fil', async () => {
    const { admin, calls, rpcCalls } = fakeAdmin((c) =>
      c.table === 'mail_threads' && c.op === 'select' ? { data: { contact_id: 'c9' }, error: null } : vide(c), rattache)
    const r = await recordPendingSend(admin, account, envoi({ threadId: 'T0', outgoing: sortant({ inReplyTo: '<orig@ex.ch>' }) }))
    expect(r).toEqual({ threadId: 'T0', messageId: 'mail_messages-1', contactId: 'c9' })
    expect(rpcCalls).toEqual([])
    expect(ecrits(calls, 'mail_threads', 'insert')).toEqual([])
    expect(ecrits(calls, 'mail_threads', 'update')).toEqual([])
    expect(ecrits(calls, 'mail_messages', 'insert')[0].payload).toMatchObject({ thread_id: 'T0', contact_id: 'c9', in_reply_to: '<orig@ex.ch>' })
  })

  it('réponse sur un fil NON rattaché : le fil est rattaché dès l envoi', async () => {
    const { admin, calls } = fakeAdmin((c) =>
      c.table === 'mail_threads' && c.op === 'select' ? { data: { contact_id: null }, error: null } : vide(c), rattache)
    await recordPendingSend(admin, account, envoi({ threadId: 'T0' }))
    const maj = ecrits(calls, 'mail_threads', 'update')
    expect(maj).toHaveLength(1)
    expect(maj[0].payload).toEqual({ contact_id: 'c1' })
    expect(maj[0].filters).toEqual([['eq:id', 'T0'], ['eq:account_id', 'acc-1']])
  })

  it('un fil d un autre compte est refusé', async () => {
    const { admin } = fakeAdmin(vide, rattache)
    await expect(recordPendingSend(admin, account, envoi({ threadId: 'T-autre' }))).rejects.toThrow(/thread_not_in_account/)
  })

  it('message provisoire refusé : le fil né de cet envoi est retiré (il traînerait vide dans « Envoyés »)', async () => {
    const { admin, calls } = fakeAdmin((c) =>
      c.table === 'mail_messages' && c.op === 'insert' ? { data: null, error: { message: 'boom' } } : vide(c), rattache)
    await expect(recordPendingSend(admin, account, envoi())).rejects.toThrow(/message provisoire: boom/)
    expect(ecrits(calls, 'mail_threads', 'delete').map((c) => c.filters)).toEqual([[['eq:id', 'mail_threads-1']]])
  })
})

// La synchro qui rapproche la copie « Envoyés » d'un envoi CRM : UNE ligne au journal, jamais
// deux — et les fils restent justes.
describe('copie « Envoyés » d un envoi Outlook rapprochée par la synchro', () => {
  const MID = '<crm-1@agence.ch>'
  const rattache = (): Reply => ({ data: ['c1'], error: null })
  const outlook: MailAccountRow = { ...account, provider: 'outlook' }
  const copie =(id: string, inInbox: boolean) => msg({
    providerMessageId: id, providerThreadId: 'conv-1', rfc822MessageId: MID, direction: 'outbound',
    from: { name: 'G', email: BOX }, to: [{ name: 'Zoé', email: 'zoe@ex.ch' }], cc: [{ name: 'G', email: BOX }], isRead: true, inInbox,
  })
  const filtres = (c: FakeCall) => Object.fromEntries(c.filters) as Record<string, unknown>
  const auJournal = (calls: FakeCall[]) => calls.filter((c) => c.table === 'activity_events')

  it('la ligne pending: rapprochée n écrit pas de seconde ligne (mail-send a déjà journalisé l envoi)', async () => {
    let renomme = false
    const { admin, calls, rpcCalls } = fakeAdmin((c) => {
      const f = filtres(c)
      if (c.table === 'mail_messages' && c.op === 'select' && f['eq:provider_message_id'] === `pending:${MID}`) {
        return { data: { id: 'M', thread_id: 'P', provider_message_id: `pending:${MID}` }, error: null }
      }
      if (c.table === 'mail_threads' && c.op === 'update' && (c.payload as { provider_thread_id?: string }).provider_thread_id === 'conv-1') renomme = true
      if (c.table === 'mail_threads' && c.op === 'select') return { data: renomme ? fil('P', 'c1') : null, error: null }
      return vide(c)
    }, rattache)
    expect(await ingestMessages(admin, outlook, [copie('AAMk-1', false)])).toEqual({ inserted: 0, updated: 1, auditFailures: 0 })
    expect(renomme).toBe(true)
    expect(rpcCalls).toEqual([])
    expect(auJournal(calls)).toEqual([])
  })

  it('copie à soi-même (sa propre boîte en Cc) : la copie « Envoyés » ne journalise pas une 2e fois', async () => {
    // Exchange dépose en Réception une copie au MÊME Message-ID, lue AVANT « Envoyés » :
    // elle prend la ligne pending:, et la copie « Envoyés » arrive comme un message NEUF.
    let renomme = false
    const { admin, calls } = fakeAdmin((c) => {
      const f = filtres(c)
      if (c.table === 'mail_messages' && c.op === 'select') {
        if (f['eq:rfc822_message_id'] === MID) return { data: [{ id: 'M' }], error: null }
        if (f['eq:provider_message_id'] === `pending:${MID}`) return { data: renomme ? null : { id: 'M', thread_id: 'P', provider_message_id: `pending:${MID}` }, error: null }
        return { data: null, error: null }
      }
      if (c.table === 'mail_messages' && c.op === 'update') renomme = true
      if (c.table === 'mail_threads' && c.op === 'select') return { data: fil('P', 'c1'), error: null }
      return vide(c)
    }, rattache)
    expect(await ingestMessages(admin, outlook, [copie('inbox-1', true)])).toEqual({ inserted: 0, updated: 1, auditFailures: 0 })
    const r = await ingestMessages(admin, outlook, [copie('sent-1', false)])
    expect(r.inserted, 'le doublon de MESSAGE est un défaut préexistant, hors de ce test').toBe(1)
    expect(auJournal(calls), 'un seul envoi, et mail-send l a déjà journalisé').toEqual([])
  })

  it('la même dédup vaut pour un envoi fait DEPUIS Outlook : la 2e copie sortante ne rejournalise pas', async () => {
    const { admin, calls } = fakeAdmin((c) => {
      const f = filtres(c)
      if (c.table === 'mail_messages' && c.op === 'select' && f['eq:rfc822_message_id'] === MID) {
        expect(f['eq:direction']).toBe('outbound')
        return { data: [{ id: 'M-inbox' }], error: null }
      }
      return vide(c)
    }, rattache)
    await ingestMessages(admin, outlook, [copie('sent-1', false)])
    expect(auJournal(calls)).toEqual([])
  })

  // Évaluée APRÈS l'insertion, une dédup qui levait laissait un message CONNU sans sa ligne :
  // la passe suivante ne la réécrivait jamais.
  it('la dédup précède toute écriture : la copie courante n existe pas encore', async () => {
    const { admin, calls } = fakeAdmin(vide, rattache)
    await ingestMessages(admin, outlook, [copie('sent-1', false)])
    const dedup = calls.findIndex((c) => c.table === 'mail_messages' && filtres(c)['eq:rfc822_message_id'] === MID)
    const premiereEcriture = calls.findIndex((c) => c.op !== 'select')
    expect(dedup, 'la dédup n a pas été consultée').toBeGreaterThan(-1)
    expect(dedup).toBeLessThan(premiereEcriture)
    expect(calls[dedup].filters.some(([k]) => k.startsWith('neq:'))).toBe(false)
  })

  it('la dédup ne vise que le sortant : un courrier reçu se journalise sans la consulter', async () => {
    const { admin, calls } = fakeAdmin(vide, rattache)
    await ingestMessages(admin, outlook, [msg({ rfc822MessageId: MID })])
    expect(calls.filter((c) => c.table === 'mail_messages' && filtres(c)['eq:rfc822_message_id'])).toEqual([])
    expect(auJournal(calls)).toHaveLength(1)
  })

  it('une dédup en erreur est LEVÉE, jamais lue comme « première copie » — et rien n est écrit', async () => {
    const { admin, calls } = fakeAdmin((c) =>
      c.table === 'mail_messages' && c.op === 'select' && filtres(c)['eq:rfc822_message_id'] ? { data: null, error: { message: 'boom' } } : vide(c), rattache)
    await expect(ingestMessages(admin, outlook, [copie('sent-1', false)])).rejects.toThrow(/copie sortante: boom/)
    expect(calls.filter((c) => c.op !== 'select'), 'la passe suivante doit trouver le message INCONNU').toEqual([])
  })

  it('fil fantôme : la copie rejoint un vrai fil déjà là — le provisoire vide disparaît, le vrai est recompté', async () => {
    const { admin, calls } = fakeAdmin((c) => {
      const f = filtres(c)
      if (c.table === 'mail_messages' && c.op === 'select') {
        if (f['eq:provider_message_id'] === `pending:${MID}`) return { data: { id: 'M', thread_id: 'P', provider_message_id: `pending:${MID}` }, error: null }
        if (f['eq:thread_id'] === 'P') return { data: [], error: null }
        if (f['eq:thread_id'] === 'R') return { data: [{ sent_at: '2026-09-13T08:00:00.000Z', direction: 'outbound', is_read: true, has_attachments: false, snippet: 's' }], error: null }
        return { data: null, error: null }
      }
      if (c.table === 'mail_threads' && c.op === 'select') return { data: fil('R', 'c1'), error: null }
      return vide(c)
    }, rattache)
    await ingestMessages(admin, outlook, [copie('AAMk-1', false)])
    expect(calls.filter((c) => c.table === 'mail_threads' && c.op === 'delete').map((c) => c.filters)).toEqual([[['eq:id', 'P']]])
    expect(calls.some((c) => c.table === 'mail_threads' && c.op === 'update' && filtres(c)['eq:id'] === 'R' && 'message_count' in (c.payload as object)), 'le vrai fil est recompté').toBe(true)
    // Les agrégats se lisent sur un message COMPLET : les recalculs viennent après ses pièces.
    const pieces = calls.findIndex((c) => c.table === 'mail_attachments')
    const recalcul = calls.findIndex((c) => c.table === 'mail_messages' && c.op === 'select' && filtres(c)['eq:thread_id'])
    expect(pieces).toBeGreaterThan(-1)
    expect(recalcul).toBeGreaterThan(pieces)
  })

  it('ne renomme que le fil PROVISOIRE : la copie d une réponse ne rebaptise jamais le fil d origine', async () => {
    const { admin, calls } = fakeAdmin((c) => {
      const f = filtres(c)
      if (c.table === 'mail_messages' && c.op === 'select') {
        if (f['eq:provider_message_id'] === `pending:${MID}`) return { data: { id: 'M', thread_id: 'O', provider_message_id: `pending:${MID}` }, error: null }
        if (f['eq:thread_id']) return { data: [], error: null }
      }
      return vide(c)
    }, rattache)
    await ingestMessages(admin, outlook, [copie('AAMk-1', false)])
    const renommages = calls.filter((c) => c.table === 'mail_threads' && c.op === 'update' && (c.payload as { provider_thread_id?: string }).provider_thread_id === 'conv-1')
    expect(renommages).toHaveLength(1)
    expect(renommages[0].filters).toEqual([['eq:id', 'O'], ['like:provider_thread_id', 'pending-thread:%']])
  })
})
