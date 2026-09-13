// Les compteurs « e-mails » de la console ne bougent pas quand une boîte synchronise ses
// Envoyés, et la carte Resend compte les échecs de remise (13.09.2026, 20260913150100).
// Contre `supabase start` (SUPABASE_TEST_*), jamais la prod. skipIf sans clés.
//
// ⚠ Mesures par DELTA : activity_events est append-only (les lignes d'autres passages
// restent), et d'autres specs écrivent peut-être dans email_delivery_events.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'
import { ingestMessages } from '../../supabase/functions/_shared/mail/ingest'
import type { MailAccountRow, NormalizedMessage } from '../../supabase/functions/_shared/mail/types'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('Console — les compteurs « e-mails » hors du courrier des boîtes', () => {
  let s: TwoAgenciesSetup
  let service: SupabaseClient
  let contactId: string
  let boite: MailAccountRow
  const stamp = `${Date.now()}`
  const DEST = `dest-${stamp}@ex.ch`
  const EVT = `test-compteurs-${stamp}`

  const lire = async () => {
    const [integ, moni] = await Promise.all([
      s.clientA.rpc('get_admin_integrations_health'),
      s.clientA.rpc('get_admin_monitoring_health'),
    ])
    if (integ.error) throw new Error(integ.error.message)
    if (moni.error) throw new Error(moni.error.message)
    const emails = (integ.data as { emails: Record<string, unknown> }).emails
    const today = ((moni.data as Array<Record<string, unknown>> | null) ?? [])[0]?.emails_sent_today
    return { emails, today }
  }

  beforeAll(async () => {
    s = await setupTwoAgencies()
    service = serviceRoleClient()
    const { error: pErr } = await service.from('profiles').update({ role: 'super_admin' }).eq('id', s.agentAId)
    if (pErr) throw new Error(`promote: ${pErr.message}`)
    const { data: c, error: cErr } = await service.from('contacts').insert({
      agency_id: s.agencyAId, first_name: 'Dest', last_name: 'Compteurs', email: DEST, type: 'buyer',
    }).select('id').single()
    if (cErr) throw new Error(`contacts: ${cErr.message}`)
    contactId = c.id as string
    const { data: ins, error: bErr } = await service.from('mail_accounts').insert({
      agency_id: s.agencyAId, owner_id: s.agentAId, provider: 'gmail', email: `compteurs-${stamp}@a.test`, visibility: 'owner',
    }).select('id').single()
    if (bErr) throw new Error(`mail_accounts: ${bErr.message}`)
    boite = (await service.from('mail_accounts').select('*').eq('id', ins.id).single()).data as MailAccountRow
  }, 60_000)

  afterAll(async () => {
    if (!s) return
    if (boite) await service.from('mail_accounts').delete().eq('id', boite.id)
    if (contactId) await service.from('contacts').delete().eq('id', contactId)
    await service.from('email_delivery_events').delete().eq('provider_event_id', EVT)
    await service.from('profiles').update({ role: 'agent' }).eq('id', s.agentAId)
    await s.cleanup()
  })

  it('une copie des Envoyés synchronisée ne bouge aucun compteur « e-mails », et l’envoyé du jour reste NON MESURÉ', async () => {
    const avant = await lire()
    const envoye: NormalizedMessage = {
      providerMessageId: `sent-${stamp}`, providerThreadId: `t-${stamp}`, rfc822MessageId: `<${stamp}@a.test>`, inReplyTo: null, references: [],
      direction: 'outbound', from: { name: 'Agent', email: boite.email }, to: [{ name: null, email: DEST }], cc: [], bcc: [],
      replyTo: null, subject: 'Offre', snippet: 'Voici', bodyText: 'Voici', bodyHtml: null, sentAt: new Date().toISOString(),
      isRead: true, isStarred: false, inInbox: false, isTrashed: false, isDraft: false, providerLabels: ['SENT'], attachments: [],
    }
    expect(await ingestMessages(service, boite, [envoye])).toEqual({ inserted: 1, updated: 0, auditFailures: 0 })
    // Témoin : la synchro a bien écrit un `email_sent` — l'ancien compteur l'aurait compté.
    const { data: lignes } = await service.from('activity_events').select('action, category').eq('entity_id', contactId).eq('metadata->>account_id', boite.id)
    expect(lignes).toEqual([{ action: 'email_sent', category: 'messaging' }])

    const apres = await lire()
    expect(apres.emails).toEqual(avant.emails)
    expect(apres.emails).not.toHaveProperty('sent_24h')
    expect(apres.today, 'non mesuré : NULL, jamais un compte').toBeNull()
  })

  it('un échec de remise Resend compte dans delivery_incidents_7d', async () => {
    const avant = await lire()
    const { error } = await service.from('email_delivery_events').insert({
      provider: 'resend', provider_event_id: EVT, event_type: 'email.bounced', occurred_at: new Date().toISOString(),
    })
    if (error) throw new Error(`email_delivery_events: ${error.message}`)
    const apres = await lire()
    expect(Number(apres.emails.delivery_incidents_7d) - Number(avant.emails.delivery_incidents_7d)).toBe(1)
  })
})
