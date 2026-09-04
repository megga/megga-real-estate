// supabase/functions/_shared/mail/ingest.test.ts
import { describe, it, expect } from 'vitest'
import { deriveThreadPatch, externalParticipants, ingestMessages, linkThreadToContact, pickContact, capHtml, recomputeThread, type ThreadRow } from './ingest.ts'
import type { MailAccountRow, NormalizedMessage } from './types.ts'

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

// ── Faux client PostgREST : on veut voir les REQUÊTES, pas simuler une base ────
// Chaque appel est enregistré sous la forme (table, opération, filtres) ; un
// « or » y apparaîtrait sous ce nom, ce qui rend le défaut d'injection visible
// depuis un test au lieu d'être une lecture de code.
interface FakeCall { table: string; op: string; filters: [string, unknown][] }
type Reply = { data: unknown; error: { message: string } | null }

function fakeAdmin(reply: (c: FakeCall) => Reply, rpcReply: () => Reply = () => ({ data: [], error: null })) {
  const calls: FakeCall[] = []
  const from = (table: string) => {
    const rec: FakeCall = { table, op: '', filters: [] }
    const settle = () => { calls.push(rec); return reply(rec) }
    const b = {
      select: () => { if (!rec.op) rec.op = 'select'; return b },
      insert: () => { rec.op = 'insert'; return b },
      update: () => { rec.op = 'update'; return b },
      upsert: () => { rec.op = 'upsert'; return b },
      delete: () => { rec.op = 'delete'; return b },
      eq: (col: string, val: unknown) => { rec.filters.push([`eq:${col}`, val]); return b },
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
  const rpc = async () => rpcReply()
  return { admin: { from, rpc } as never, calls }
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

describe('ingestMessages : recherche du message déjà connu', () => {
  // ⛔ Le filtre était construit par concaténation dans `.or()`, que postgrest-js
  // recopie tel quel dans l'URL (aucun échappement, contrairement à `.in()`). Le
  // `Message-ID` d'un e-mail entrant est du texte d'ATTAQUANT : une virgule y
  // ajoutait un terme au OU, `provider_message_id.not.is.null` rendait un message
  // quelconque de la boîte, et la suite l'écrasait avec le contenu de l'attaquant.
  const PIEGE = '<a),provider_message_id.not.is.null,and(id.not.is.null'

  it('un Message-ID piégé ne peut désigner aucune autre ligne : deux .eq(), jamais de .or()', async () => {
    const { admin, calls } = fakeAdmin(vide)
    await ingestMessages(admin, account, [msg({ providerMessageId: 'm-neuf', rfc822MessageId: PIEGE })])

    expect(calls.some((c) => c.filters.some(([k]) => k === 'or'))).toBe(false)
    const lookups = calls.filter((c) => c.table === 'mail_messages' && c.op === 'select')
    expect(lookups).toHaveLength(2)
    // Le texte de l'attaquant reste UNE valeur, dans un paramètre à lui.
    expect(lookups[0].filters).toEqual([['eq:account_id', 'acc-1'], ['eq:provider_message_id', 'm-neuf']])
    expect(lookups[1].filters).toEqual([['eq:account_id', 'acc-1'], ['eq:provider_message_id', `pending:${PIEGE}`]])
    // Et il ne s'échappe nulle part ailleurs : aucune requête ne le porte comme filtre
    // structurel, seulement comme valeur de `provider_message_id`.
    for (const c of calls) {
      for (const [cle, val] of c.filters) {
        if (typeof val === 'string' && val.includes(PIEGE)) expect(cle).toBe('eq:provider_message_id')
      }
    }
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

describe('linkThreadToContact : « Rapprocher l adresse » ne dit plus ok sur un travail non fait', () => {
  const ok = (c: FakeCall): Reply =>
    c.table === 'contacts' ? { data: { id: 'c1' }, error: null }
      : c.table === 'mail_threads' && c.op === 'update' ? { data: [{ id: 'T1' }], error: null }
        : { data: null, error: null }

  it('le chemin nominal apprend l alias, rattache le fil et complète les messages', async () => {
    const { admin, calls } = fakeAdmin(ok)
    await linkThreadToContact(admin, account, 'T1', 'c1', 'Zoe@Ex.ch', 'u-1')
    expect(calls.map((c) => `${c.table}:${c.op}`)).toEqual([
      'contacts:select', 'mail_contact_aliases:upsert', 'mail_threads:update', 'mail_messages:update',
    ])
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
