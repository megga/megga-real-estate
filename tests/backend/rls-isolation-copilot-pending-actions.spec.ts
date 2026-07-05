// RLS isolation — copilot_pending_actions.
// Actions de publication en attente (tier confirm) préparées par le copilote web et
// validées par carte HITL. RLS ACTIVÉE SANS POLICY → aucun accès anon/authenticated,
// même à sa PROPRE ligne : seul le service-role (l'edge ai-copilot) lit/écrit, en
// scopant à l'agent du JWT (jamais depuis un paramètre client). Ce test verrouille cet
// invariant : un client authentifié ne peut ni lire, ni insérer, ni modifier, ni
// supprimer une carte de publication.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('RLS isolation — copilot_pending_actions (service-role only)', () => {
  let setup: TwoAgenciesSetup
  let rowAId: string

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const service = serviceRoleClient()
    const { data, error } = await service
      .from('copilot_pending_actions')
      .insert({
        user_id: setup.agentAId,
        agency_id: setup.agencyAId,
        kind: 'publish',
        tool: 'publish_to_portals',
        payload: { property_id: '00000000-0000-0000-0000-000000000000', portals: ['immobilier_ch'], __lang: 'fr' },
        preview: `Aperçu A ${setup.stamp}`,
        title: 'Bien A',
      })
      .select('id')
      .single()
    if (error) throw new Error(`insert pending A: ${error.message}`)
    rowAId = data.id
  })

  afterAll(async () => {
    const service = serviceRoleClient()
    if (rowAId) await service.from('copilot_pending_actions').delete().eq('id', rowAId)
    await setup.cleanup()
  })

  it('service-role lit la ligne (chemin de l\'edge)', async () => {
    const service = serviceRoleClient()
    const { data } = await service.from('copilot_pending_actions').select('id').eq('id', rowAId)
    expect(data).toHaveLength(1)
  })

  it('un agent authentifié NE PEUT PAS lire, même sa PROPRE carte (aucune policy)', async () => {
    const { data } = await setup.clientA.from('copilot_pending_actions').select('id').eq('id', rowAId)
    expect(data ?? [], 'authenticated leaked a pending action').toEqual([])
  })

  it('un agent authentifié NE PEUT PAS insérer une carte', async () => {
    const { data, error } = await setup.clientA
      .from('copilot_pending_actions')
      .insert({ user_id: setup.agentAId, agency_id: setup.agencyAId, kind: 'publish', tool: 'publish_to_portals', preview: 'x' })
      .select('id')
    expect(!!error || !(data && data.length), 'authenticated should not be able to insert').toBe(true)
  })

  it('un agent authentifié NE PEUT PAS modifier la carte', async () => {
    await setup.clientA.from('copilot_pending_actions').update({ preview: 'HACKED' }).eq('id', rowAId)
    const service = serviceRoleClient()
    const { data: after } = await service.from('copilot_pending_actions').select('preview').eq('id', rowAId).single()
    expect(after?.preview, 'authenticated must not mutate the pending payload').not.toBe('HACKED')
  })

  it('un agent authentifié NE PEUT PAS supprimer la carte', async () => {
    await setup.clientA.from('copilot_pending_actions').delete().eq('id', rowAId)
    const service = serviceRoleClient()
    const { data: still } = await service.from('copilot_pending_actions').select('id').eq('id', rowAId)
    expect(still, 'row should survive an unauthorized delete').toHaveLength(1)
  })
})
