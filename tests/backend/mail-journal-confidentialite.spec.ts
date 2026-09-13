// Le journal d'un courrier : le FAIT, jamais le CONTENU (13.09.2026). Rejoue la vraie
// écriture — `ingestMessages` en service-role sur la vraie base, comme la synchro — puis
// relit comme les lecteurs réels : la base, un COLLÈGUE de l'agence (`events_select`), un
// SUPER-ADMIN (`super_admin_read_all_events`). Contre `supabase start` (SUPABASE_TEST_*),
// jamais la prod. skipIf sans clés.
//
// ⚠ Deux témoins positifs, sans lesquels « aucune fuite » serait vrai pour une mauvaise
// raison : la ligne de journal EXISTE (sans contact de l'agence portant l'adresse de
// l'expéditeur, l'audit est sauté et il n'y a rien à lire), et le message, lui, porte
// bien son objet dans `mail_messages`.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { anonClient, serviceRoleClient } from './helpers/supabase'
import { ingestMessages } from '../../supabase/functions/_shared/mail/ingest'
import type { MailAccountRow, NormalizedMessage } from '../../supabase/functions/_shared/mail/types'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'
const ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY ?? ''
const PASSWORD = 'Test-Password-123!'

describe.skipIf(!HAS_KEYS)('Messagerie — le journal ne reçoit pas le contenu d’un courrier', () => {
  let s: TwoAgenciesSetup
  let service: SupabaseClient
  let clientA2: SupabaseClient
  let superClient: SupabaseClient
  let agentA2Id: string
  let superAdminId: string
  let contactId: string
  const comptes: string[] = []

  // Tout ce qui ne doit JAMAIS atteindre le journal, horodaté pour ne rien lire d'un autre passage.
  const stamp = `${Date.now()}`
  const OBJET = `Offre confidentielle Villa Cologny ${stamp}`
  const EXPEDITEUR = `zoe-${stamp}@ex.ch`
  const TIERS = `notaire-${stamp}@etude.ch`

  const courrier = (box: string, id: string): NormalizedMessage => ({
    providerMessageId: `m-${id}`, providerThreadId: `t-${id}`, rfc822MessageId: `<${id}@ex.ch>`, inReplyTo: null, references: [],
    direction: 'inbound', from: { name: 'Zoé Témoin', email: EXPEDITEUR },
    to: [{ name: null, email: box }, { name: 'Me Tiers', email: TIERS }], cc: [], bcc: [],
    replyTo: null, subject: OBJET, snippet: 'Voici notre offre', bodyText: 'Voici notre offre', bodyHtml: null,
    sentAt: new Date().toISOString(), isRead: false, isStarred: false, inInbox: true, isTrashed: false, isDraft: false,
    providerLabels: ['INBOX'], attachments: [],
  })

  /** Une boîte relue en `select('*')` : c'est la forme que la synchro passe à `ingestMessages`. */
  const mkBoite = async (visibility: 'owner' | 'agency'): Promise<MailAccountRow> => {
    const email = `${visibility}-${stamp}@a.test`
    const { data: ins, error } = await service.from('mail_accounts').insert({
      agency_id: s.agencyAId, owner_id: s.agentAId, provider: 'gmail', email, visibility,
    }).select('id').single()
    if (error) throw new Error(`mail_accounts ${email}: ${error.message}`)
    comptes.push(ins.id as string)
    const { data: row, error: eRow } = await service.from('mail_accounts').select('*').eq('id', ins.id).single()
    if (eRow) throw new Error(`mail_accounts relu: ${eRow.message}`)
    return row as MailAccountRow
  }

  const sansContenu = (lignes: unknown[]) => {
    const brut = JSON.stringify(lignes)
    for (const f of [OBJET, EXPEDITEUR, TIERS, 'Zoé Témoin', 'Me Tiers']) expect(brut, `« ${f} » a atteint le journal`).not.toContain(f)
  }

  beforeAll(async () => {
    s = await setupTwoAgencies()
    service = serviceRoleClient()

    const { data: c, error: cErr } = await service.from('contacts').insert({
      agency_id: s.agencyAId, first_name: 'Zoé', last_name: 'Témoin', email: EXPEDITEUR, type: 'buyer',
    }).select('id').single()
    if (cErr) throw new Error(`contacts: ${cErr.message}`)
    contactId = c.id as string

    // Un collègue DANS l'agence A : lit le journal de l'agence, pas la boîte perso de A.
    const emailA2 = `journal-a2-${s.stamp}@megga-test.local`
    const { data: u, error: uErr } = await service.auth.admin.createUser({
      email: emailA2, password: PASSWORD, email_confirm: true, user_metadata: { full_name: 'Agent A2', role: 'agent' },
    })
    if (uErr) throw new Error(uErr.message)
    agentA2Id = u!.user!.id
    await service.from('profiles').upsert(
      { id: agentA2Id, email: emailA2, full_name: 'Agent A2', role: 'agent', agency_id: s.agencyAId }, { onConflict: 'id' },
    )
    clientA2 = createClient(URL, ANON_KEY)
    const { error: sErr } = await clientA2.auth.signInWithPassword({ email: emailA2, password: PASSWORD })
    if (sErr) throw new Error(sErr.message)

    // Super-admin : agency_id NULL, domaine allowlisté par setupTwoAgencies.
    const emailSu = `journal-super-${s.stamp}@megga-test.local`
    const { data: su, error: suErr } = await service.auth.admin.createUser({
      email: emailSu, password: PASSWORD, email_confirm: true, user_metadata: { full_name: 'Super Journal', role: 'agent' },
    })
    if (suErr) throw new Error(suErr.message)
    superAdminId = su!.user!.id
    const { error: spErr } = await service.from('profiles').upsert(
      { id: superAdminId, email: emailSu, full_name: 'Super Journal', role: 'super_admin', agency_id: null }, { onConflict: 'id' },
    )
    if (spErr) throw new Error(spErr.message)
    superClient = anonClient()
    const { error: ssErr } = await superClient.auth.signInWithPassword({ email: emailSu, password: PASSWORD })
    if (ssErr) throw new Error(ssErr.message)
  }, 60_000)

  afterAll(async () => {
    if (!s) return
    // Les fils et messages suivent en cascade ; les lignes du journal restent (append-only,
    // 10 ans) — d'où les lectures bornées au contact et aux boîtes de CE passage.
    if (comptes.length) await service.from('mail_accounts').delete().in('id', comptes)
    if (contactId) await service.from('contacts').delete().eq('id', contactId)
    if (agentA2Id) await service.auth.admin.deleteUser(agentA2Id)
    if (superAdminId) await service.auth.admin.deleteUser(superAdminId)
    await s.cleanup()
  })

  for (const visibility of ['owner', 'agency'] as const) {
    it(`boîte ${visibility} : la ligne existe, elle ne porte ni objet ni adresse`, async () => {
      const boite = await mkBoite(visibility)
      const r = await ingestMessages(service, boite, [courrier(boite.email, `${visibility}-${stamp}`)])
      expect(r).toEqual({ inserted: 1, updated: 0, auditFailures: 0 })

      // Témoin 1 : le contenu est bien écrit — là où la RLS de la boîte le garde.
      const { data: msgs } = await service.from('mail_messages').select('subject, from_email').eq('account_id', boite.id)
      expect(msgs).toEqual([{ subject: OBJET, from_email: EXPEDITEUR }])

      // Témoin 2 : l'audit a été ATTEINT — une ligne, sur le contact rattaché.
      const { data: lignes, error } = await service.from('activity_events')
        .select('action, actor_id, actor_kind, category, entity_type, entity_id, object_label, metadata')
        .eq('entity_id', contactId).eq('metadata->>account_id', boite.id)
      expect(error).toBeNull()
      expect(lignes, 'l’audit n’a pas été atteint : ce test ne prouverait rien').toHaveLength(1)
      const [ligne] = lignes!
      expect(ligne).toMatchObject({
        action: 'email_received', actor_id: null, actor_kind: 'system', category: 'messaging',
        entity_type: 'contact', entity_id: contactId, object_label: null,
      })
      expect(Object.keys(ligne.metadata as Record<string, unknown>).sort()).toEqual(['account_id', 'message_id', 'thread_id'])
      sansContenu(lignes!)
    })
  }

  it('un collègue de l’agence et le super-admin lisent le FAIT, jamais le contenu', async () => {
    for (const [qui, client] of [['collègue', clientA2], ['super-admin', superClient]] as const) {
      const { data, error } = await client.from('activity_events').select('action, object_label, metadata').eq('entity_id', contactId)
      expect(error, qui).toBeNull()
      // Témoin : ces deux lecteurs VOIENT bien les lignes — sinon « rien lu » passerait pour « rien fui ».
      expect(data!.length, `${qui} ne lit aucune ligne : la garde ne mesure rien`).toBeGreaterThanOrEqual(2)
      sansContenu(data!)
    }
    // Contraste : le contenu reste derrière la RLS de la boîte perso.
    const perso = comptes[0]
    const { data: fils } = await clientA2.from('mail_messages').select('id').eq('account_id', perso)
    expect(fils, 'le collègue ne lit pas les messages de la boîte perso').toEqual([])
  })
})
