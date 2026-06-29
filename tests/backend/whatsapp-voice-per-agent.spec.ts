// Apprentissage T2 « voix par agent » — chemin DONNÉES : la colonne
// whatsapp_messages.sent_by_profile_id existe, accepte l'agent émetteur, et le
// filtre par agent (.eq sent_by_profile_id) ne renvoie que ses messages prose.
// (La logique de branchement per-agent/repli est testée en unit dans
//  supabase/functions/_shared/agent-style.test.ts.)

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('voix par agent — colonne sent_by_profile_id + filtre', () => {
  let setup: TwoAgenciesSetup
  let contactId = ''
  const msgIds: string[] = []

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const svc = serviceRoleClient()

    const { data: c, error: ec } = await svc.from('contacts')
      .insert({
        agency_id: setup.agencyAId, first_name: 'Client', last_name: `Voice ${setup.stamp}`,
        email: `voice-${Math.random()}@megga-test.local`, type: 'buyer',
      })
      .select('id').single()
    if (ec) throw new Error(`contact: ${ec.message}`)
    contactId = c.id

    const row = (pmid: string, body: string, sentBy: string | null) => ({
      provider: 'meta', provider_message_id: `${pmid}-${setup.stamp}`, direction: 'outbound',
      wa_from: 'megga', wa_to: '41790000000', contact_id: contactId,
      agency_id: setup.agencyAId, body, status: 'received', sent_by_profile_id: sentBy,
    })
    const { data, error } = await svc.from('whatsapp_messages').insert([
      row('voice-a1', 'Bonjour, je confirme la visite de mardi.', setup.agentAId),
      row('voice-a2', 'Parfait, à demain 14h.', setup.agentAId),
      row('voice-a3', 'Je reviens vers vous ce soir.', setup.agentAId),
      row('voice-x1', "Message d'agence non tagué.", null),
    ]).select('id')
    if (error) throw new Error(`messages: ${error.message}`) // attrape une colonne manquante / FK
    for (const r of data ?? []) msgIds.push(r.id)
  })

  afterAll(async () => {
    const svc = serviceRoleClient()
    if (msgIds.length) await svc.from('whatsapp_messages').delete().in('id', msgIds)
    if (contactId) await svc.from('contacts').delete().eq('id', contactId)
    await setup.cleanup()
  })

  it('la colonne sent_by_profile_id existe et accepte l’agent (4 inserts OK)', () => {
    expect(msgIds.length).toBe(4)
  })

  it('le filtre par agent ne renvoie que les messages tagués de cet agent', async () => {
    const svc = serviceRoleClient()
    const { data, error } = await svc.from('whatsapp_messages')
      .select('body, sent_by_profile_id')
      .eq('agency_id', setup.agencyAId)
      .eq('direction', 'outbound')
      .eq('sent_by_profile_id', setup.agentAId)
      .not('contact_id', 'is', null)
    expect(error).toBeNull()
    expect((data ?? []).length).toBe(3)
    expect((data ?? []).every((r) => r.sent_by_profile_id === setup.agentAId)).toBe(true)
  })

  it('le filtre agence (sans agent) renvoie tagués + non tagués', async () => {
    const svc = serviceRoleClient()
    const { data } = await svc.from('whatsapp_messages')
      .select('id')
      .eq('agency_id', setup.agencyAId)
      .eq('direction', 'outbound')
      .not('contact_id', 'is', null)
      .in('id', msgIds)
    expect((data ?? []).length).toBe(4)
  })
})
