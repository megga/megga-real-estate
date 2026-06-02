// RLS isolation — whatsapp_conversation_insights. Un agent ne voit que les
// insights de SON agence (miroir exact de whatsapp_messages_agency_select).
// Tourne contre un projet de TEST (SUPABASE_TEST_*) ; skip propre sinon.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('RLS isolation — whatsapp_conversation_insights', () => {
  let setup: TwoAgenciesSetup
  let contactAId: string
  let contactBId: string

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const service = serviceRoleClient()

    const mkContact = async (agencyId: string, name: string) => {
      const { data, error } = await service
        .from('contacts').insert({ agency_id: agencyId, first_name: name }).select('id').single()
      if (error) throw new Error(`contact ${name}: ${error.message}`)
      return data.id as string
    }
    contactAId = await mkContact(setup.agencyAId, `CIA-${setup.stamp}`)
    contactBId = await mkContact(setup.agencyBId, `CIB-${setup.stamp}`)

    const mkInsight = async (contactId: string, agencyId: string) => {
      const { error } = await service.from('whatsapp_conversation_insights')
        .insert({ contact_id: contactId, agency_id: agencyId, summary: 'test' })
      if (error) throw new Error(`insight: ${error.message}`)
    }
    await mkInsight(contactAId, setup.agencyAId)
    await mkInsight(contactBId, setup.agencyBId)
  })

  afterAll(async () => {
    const service = serviceRoleClient()
    // les insights partent en cascade (ON DELETE CASCADE) avec les contacts.
    for (const id of [contactAId, contactBId]) {
      if (id) await service.from('contacts').delete().eq('id', id)
    }
    await setup.cleanup()
  })

  it('agent A voit l’insight de son agence', async () => {
    const { data } = await setup.clientA
      .from('whatsapp_conversation_insights').select('contact_id').eq('contact_id', contactAId)
    expect(data).toHaveLength(1)
  })

  it('agent A NE voit PAS l’insight de l’agence B', async () => {
    const { data } = await setup.clientA
      .from('whatsapp_conversation_insights').select('contact_id').eq('contact_id', contactBId)
    expect(data ?? []).toHaveLength(0)
  })
})
