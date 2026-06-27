// RLS isolation — crm_offers (offres & contre-offres par deal).
// Un agent ne doit pouvoir modifier QUE les offres de son agence, et ne JAMAIS
// déplacer une offre vers une autre agence (régression du WITH CHECK manquant,
// corrigé en 20260627140000).

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('RLS isolation — crm_offers', () => {
  let setup: TwoAgenciesSetup
  let offerAId: string

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const service = serviceRoleClient()

    const { data: offerA, error } = await service
      .from('crm_offers')
      .insert({
        agency_id: setup.agencyAId,
        kind: 'offer',
        from_party: 'buyer',
        by_label: `Test Buyer ${setup.stamp}`,
        amount: 500000,
        expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      })
      .select('id')
      .single()
    if (error) throw new Error(`offerA: ${error.message}`)
    offerAId = offerA.id
  })

  afterAll(async () => {
    const service = serviceRoleClient()
    if (offerAId) await service.from('crm_offers').delete().eq('id', offerAId)
    await setup.cleanup()
  })

  it('agent A can update its own offer status (same-agency, WITH CHECK passes)', async () => {
    const { data, error } = await setup.clientA
      .from('crm_offers')
      .update({ status: 'withdrawn' })
      .eq('id', offerAId)
      .select('id')
    expect(error, `legitimate same-agency update should succeed`).toBeNull()
    expect(data).toHaveLength(1)
  })

  it('agent A CANNOT move its offer to another agency (WITH CHECK blocks)', async () => {
    const { error } = await setup.clientA
      .from('crm_offers')
      .update({ agency_id: setup.agencyBId })
      .eq('id', offerAId)
    expect(error, `WITH CHECK should reject cross-agency move`).not.toBeNull()

    const { data: after } = await serviceRoleClient()
      .from('crm_offers')
      .select('agency_id')
      .eq('id', offerAId)
      .single()
    expect(after?.agency_id, `offer agency_id must be unchanged`).toBe(setup.agencyAId)
  })

  it('agent B CANNOT update agency A offer (USING blocks)', async () => {
    await setup.clientB
      .from('crm_offers')
      .update({ status: 'rejected' })
      .eq('id', offerAId)

    const { data: after } = await serviceRoleClient()
      .from('crm_offers')
      .select('status')
      .eq('id', offerAId)
      .single()
    expect(after?.status, `agent B must not mutate agency A offer`).not.toBe('rejected')
  })
})
