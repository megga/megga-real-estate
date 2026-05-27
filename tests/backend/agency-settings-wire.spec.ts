// Regression — AgencySection (Settings) wire to agencies table.
// Wired via useAgencySettings hook : read row of profile.agency_id, update
// name/address/city/canton/phone/email/website/logo_url.
//
// RLS isolation : agent A peut update SA propre agence, agent B ne peut pas
// toucher agence A.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('regression — agencies settings wire (RLS)', () => {
  let setup: TwoAgenciesSetup

  beforeAll(async () => {
    setup = await setupTwoAgencies()
  })

  afterAll(async () => {
    await setup.cleanup()
  })

  it('agent A reads their own agency row', async () => {
    const { data, error } = await setup.clientA
      .from('agencies')
      .select('id, name')
      .eq('id', setup.agencyAId)
      .single()
    expect(error).toBeNull()
    expect(data?.id).toBe(setup.agencyAId)
  })

  it('agent A updates their own agency (name/address/city)', async () => {
    const newName = `Agence A ${setup.stamp}`
    const { error } = await setup.clientA
      .from('agencies')
      .update({
        name: newName,
        address: '14 rue du Rhône',
        city: 'Genève',
        canton: 'GE',
      })
      .eq('id', setup.agencyAId)
    expect(error).toBeNull()

    // Verify via service role
    const svc = serviceRoleClient()
    const { data } = await svc
      .from('agencies')
      .select('name, address, city, canton')
      .eq('id', setup.agencyAId)
      .single()
    expect(data?.name).toBe(newName)
    expect(data?.address).toBe('14 rue du Rhône')
    expect(data?.city).toBe('Genève')
    expect(data?.canton).toBe('GE')
  })

  it('agent B CANNOT update agency A (RLS isolation)', async () => {
    const before = await serviceRoleClient()
      .from('agencies')
      .select('name')
      .eq('id', setup.agencyAId)
      .single()
    const originalName = before.data?.name

    const { data: returned } = await setup.clientB
      .from('agencies')
      .update({ name: `LEAK ${setup.stamp}` })
      .eq('id', setup.agencyAId)
      .select('id')
    expect(returned, 'agent B leaked update to agency A').toEqual([])

    // Verify name unchanged
    const after = await serviceRoleClient()
      .from('agencies')
      .select('name')
      .eq('id', setup.agencyAId)
      .single()
    expect(after.data?.name).toBe(originalName)
  })
})
