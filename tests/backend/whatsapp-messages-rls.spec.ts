// RLS isolation — whatsapp_messages. Un agent ne doit voir que les messages
// de SON agence ; les messages non mappés (agency_id NULL) ne fuitent pas.
//
// Comme les autres specs RLS du repo, ce test tourne contre un projet de TEST
// (SUPABASE_TEST_*), pas la prod — setupTwoAgencies crée de vraies agences.
// skipIf saute proprement si les clés de test ne sont pas fournies.
//
// La policy testée (whatsapp_messages_agency_select) est un miroir exact de
// contacts_select (USING agency_id = get_my_agency_id()).

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('RLS isolation — whatsapp_messages', () => {
  let setup: TwoAgenciesSetup
  let msgAId: string
  let msgBId: string
  let msgOrphanId: string

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const service = serviceRoleClient()

    const mk = async (agencyId: string | null, pmid: string) => {
      const { data, error } = await service.from('whatsapp_messages').insert({
        provider: 'openwa', provider_message_id: pmid, wa_from: '41790000000',
        direction: 'inbound', agency_id: agencyId, body: 'test', status: 'received',
      }).select('id').single()
      if (error) throw new Error(`${pmid}: ${error.message}`)
      return data.id as string
    }
    msgAId = await mk(setup.agencyAId, `pmid-A-${Date.now()}`)
    msgBId = await mk(setup.agencyBId, `pmid-B-${Date.now()}`)
    msgOrphanId = await mk(null, `pmid-orphan-${Date.now()}`)
  })

  afterAll(async () => {
    const service = serviceRoleClient()
    for (const id of [msgAId, msgBId, msgOrphanId]) {
      if (id) await service.from('whatsapp_messages').delete().eq('id', id)
    }
    await setup.cleanup()
  })

  it('agent A voit le message de son agence', async () => {
    const { data } = await setup.clientA.from('whatsapp_messages').select('id').eq('id', msgAId)
    expect(data).toHaveLength(1)
  })

  it("agent A NE voit PAS le message de l'agence B", async () => {
    const { data } = await setup.clientA.from('whatsapp_messages').select('id').eq('id', msgBId)
    expect(data ?? []).toHaveLength(0)
  })

  it('agent A NE voit PAS un message non mappé (agency_id NULL)', async () => {
    const { data } = await setup.clientA.from('whatsapp_messages').select('id').eq('id', msgOrphanId)
    expect(data ?? []).toHaveLength(0)
  })
})
