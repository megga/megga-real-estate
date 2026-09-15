// Un envoi Outlook depuis le CRM entre au journal UNE fois (13.09.2026). Contre `supabase
// start` (SUPABASE_TEST_*), jamais la prod. skipIf sans clés.
//
// ⛔ Le défaut : `mail-send` insérait le fil provisoire SANS contact, donc n'écrivait aucun
// `email_sent` ; la synchro retrouvait ensuite la ligne `pending:` — un message CONNU — et
// n'écrivait rien non plus. Un courrier envoyé à un client depuis le CRM n'entrait jamais
// dans sa timeline. Le chemin Graph réel (POST /me/messages puis send) n'est pas éprouvable
// ici — ni Microsoft ni secret : on rejoue ce qui l'entoure, sur la vraie base (vraie RPC de
// rapprochement, vrais CHECK et triggers, append-only compris).
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'
import { ingestMessages, mailAuditEvent, recordPendingSend } from '../../supabase/functions/_shared/mail/ingest'
import type { MailAccountRow, NormalizedMessage, OutgoingMessage } from '../../supabase/functions/_shared/mail/types'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('Messagerie — un envoi Outlook depuis le CRM entre au journal, une fois', () => {
  let s: TwoAgenciesSetup
  let service: SupabaseClient
  let contactId: string
  const comptes: string[] = []
  const stamp = `${Date.now()}`
  // Casse MIXTE sur la fiche : seule la vraie RPC (lower()) le rapproche — le faux ne le peut pas.
  const EMAIL_FICHE = `Zoe.Envoi-${stamp}@Ex.CH`
  const DEST = EMAIL_FICHE.toLowerCase()

  const mkBoite = async (): Promise<MailAccountRow> => {
    const { data: ins, error } = await service.from('mail_accounts').insert({
      agency_id: s.agencyAId, owner_id: s.agentAId, provider: 'outlook', email: `envoi-${comptes.length}-${stamp}@a.test`, visibility: 'agency',
    }).select('id').single()
    if (error) throw new Error(`mail_accounts: ${error.message}`)
    comptes.push(ins.id as string)
    const { data: row } = await service.from('mail_accounts').select('*').eq('id', ins.id).single()
    return row as MailAccountRow
  }
  const sortant = (boite: MailAccountRow, mid: string, to: string): OutgoingMessage => ({
    from: { name: 'Agent', email: boite.email }, to: [{ name: 'Zoé', email: to }], cc: [], bcc: [],
    subject: 'Visite samedi', text: 'Bonjour', html: '<p>Bonjour</p>', inReplyTo: null, references: [], messageId: mid, attachments: [],
  })
  /** La copie « Envoyés » telle que Graph la rendra à la synchro. */
  const copieEnvoyes = (boite: MailAccountRow, mid: string, to: string): NormalizedMessage => ({
    providerMessageId: `AAMk-${mid}`, providerThreadId: `conv-${mid}`, rfc822MessageId: mid, inReplyTo: null, references: [],
    direction: 'outbound', inSent: true, from: { name: 'Agent', email: boite.email }, to: [{ name: 'Zoé', email: to }], cc: [], bcc: [],
    replyTo: null, subject: 'Visite samedi', snippet: 'Bonjour', bodyText: 'Bonjour', bodyHtml: null,
    sentAt: new Date().toISOString(), isRead: true, isStarred: false, inInbox: false, isTrashed: false, isSpam: false, isDraft: false,
    providerLabels: [], attachments: [],
  })
  const journal = async (boite: MailAccountRow) =>
    (await service.from('activity_events').select('action, actor_id, actor_kind, object_label').eq('metadata->>account_id', boite.id)).data ?? []

  beforeAll(async () => {
    s = await setupTwoAgencies()
    service = serviceRoleClient()
    const { data: c, error } = await service.from('contacts').insert({
      agency_id: s.agencyAId, first_name: 'Zoé', last_name: 'Envoi', email: EMAIL_FICHE, type: 'buyer',
    }).select('id').single()
    if (error) throw new Error(`contacts: ${error.message}`)
    contactId = c.id as string
  }, 60_000)

  afterAll(async () => {
    if (!s) return
    if (comptes.length) await service.from('mail_accounts').delete().in('id', comptes)
    if (contactId) await service.from('contacts').delete().eq('id', contactId)
    await s.cleanup()
  })

  it('la copie provisoire naît rattachée — la vraie RPC compare en minuscules', async () => {
    const boite = await mkBoite()
    const mid = `<crm-a-${stamp}@agence.ch>`
    const p = await recordPendingSend(service, boite, { threadId: null, outgoing: sortant(boite, mid, DEST), snippet: 'Bonjour', hasAttachments: false })
    expect(p.contactId).toBe(contactId)
    const { data: fil } = await service.from('mail_threads').select('contact_id, provider_thread_id').eq('id', p.threadId).single()
    expect(fil).toEqual({ contact_id: contactId, provider_thread_id: `pending-thread:${mid}` })
    const { data: msg } = await service.from('mail_messages').select('contact_id, provider_message_id').eq('id', p.messageId).single()
    expect(msg).toEqual({ contact_id: contactId, provider_message_id: `pending:${mid}` })
  })

  // ⚠ La ligne de l'agent est posée ICI, à la main, comme mail-send la pose : ce test n'appelle
  // pas l'edge (ni Microsoft ni secret). Il prouve le contrat accepté par la vraie base et le
  // silence de la synchro — la condition d'écriture de mail-send est gardée par
  // tests/unit/messagerie-journal.spec.ts.
  it('la ligne de mail-send passe les CHECK, et la synchro qui rapproche la copie n’en écrit PAS de seconde', async () => {
    const boite = await mkBoite()
    const mid = `<crm-b-${stamp}@agence.ch>`
    const p = await recordPendingSend(service, boite, { threadId: null, outgoing: sortant(boite, mid, DEST), snippet: 'Bonjour', hasAttachments: false })
    // Ce qu'écrit mail-send juste après (la copie locale existe, le fil porte le contact).
    const { error: eAudit } = await service.from('activity_events').insert(mailAuditEvent({
      agencyId: boite.agency_id, contactId, action: 'email_sent', accountId: boite.id,
      threadId: p.threadId, messageId: p.messageId, actorId: s.agentAId, kind: 'new', sentAt: new Date().toISOString(),
    }))
    expect(eAudit).toBeNull()

    const r = await ingestMessages(service, boite, [copieEnvoyes(boite, mid, DEST)])
    expect(r).toEqual({ inserted: 0, updated: 1, auditFailures: 0 })
    const { data: fil } = await service.from('mail_threads').select('contact_id, provider_thread_id').eq('id', p.threadId).single()
    expect(fil).toEqual({ contact_id: contactId, provider_thread_id: `conv-${mid}` })
    expect(await journal(boite), 'une ligne, celle de l’agent').toEqual([{ action: 'email_sent', actor_id: s.agentAId, actor_kind: 'user', object_label: null }])
  })

  it('aucun contact : rien n’est rattaché, rien n’est journalisé, même après la synchro', async () => {
    const boite = await mkBoite()
    const mid = `<crm-c-${stamp}@agence.ch>`
    const inconnu = `personne-${stamp}@nulle-part.ch`
    const p = await recordPendingSend(service, boite, { threadId: null, outgoing: sortant(boite, mid, inconnu), snippet: 'Bonjour', hasAttachments: false })
    expect(p.contactId).toBeNull()
    await ingestMessages(service, boite, [copieEnvoyes(boite, mid, inconnu)])
    expect(await journal(boite)).toEqual([])
  })
})
