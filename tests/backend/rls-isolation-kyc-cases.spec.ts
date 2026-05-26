// RLS isolation — kyc_cases (dossiers LBA art. 7).
// LE plus compliance-critical : un leak ici = violation LPD + LBA = amende juridique.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, findLeakedRows, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('RLS isolation — kyc_cases (Swiss LBA art. 7)', () => {
  let setup: TwoAgenciesSetup
  let kycAId: string
  let kycBId: string

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const service = serviceRoleClient()

    const { data: kycA, error: errA } = await service
      .from('kyc_cases')
      .insert({ agency_id: setup.agencyAId, type: 'buyer_pp' })
      .select('id')
      .single()
    if (errA) throw new Error(`kycA: ${errA.message}`)
    kycAId = kycA.id

    const { data: kycB, error: errB } = await service
      .from('kyc_cases')
      .insert({ agency_id: setup.agencyBId, type: 'buyer_pp' })
      .select('id')
      .single()
    if (errB) throw new Error(`kycB: ${errB.message}`)
    kycBId = kycB.id
  })

  afterAll(async () => {
    const service = serviceRoleClient()
    if (kycAId) await service.from('kyc_cases').delete().eq('id', kycAId)
    if (kycBId) await service.from('kyc_cases').delete().eq('id', kycBId)
    await setup.cleanup()
  })

  it('agent A sees their KYC case', async () => {
    const { data } = await setup.clientA.from('kyc_cases').select('id').eq('id', kycAId)
    expect(data).toHaveLength(1)
  })

  it('agent A CANNOT see agency B KYC case (LBA leak)', async () => {
    const { data } = await setup.clientA.from('kyc_cases').select('id').eq('id', kycBId)
    expect(data, `LBA art. 7 violation: agent A leaked KYC B`).toEqual([])
  })

  it('agent B sees their KYC case', async () => {
    const { data } = await setup.clientB.from('kyc_cases').select('id').eq('id', kycBId)
    expect(data).toHaveLength(1)
  })

  it('agent B CANNOT see agency A KYC case (LBA leak)', async () => {
    const { data } = await setup.clientB.from('kyc_cases').select('id').eq('id', kycAId)
    expect(data, `LBA art. 7 violation: agent B leaked KYC A`).toEqual([])
  })

  it('agent A list query returns NO KYC cases from other agencies', async () => {
    const leaked = await findLeakedRows(setup.clientA, 'kyc_cases', setup.agencyAId)
    expect(leaked, `LBA violation: agent A leaked ${leaked.length} cross-tenant KYC cases`).toEqual([])
  })

  it('agent B list query returns NO KYC cases from other agencies', async () => {
    const leaked = await findLeakedRows(setup.clientB, 'kyc_cases', setup.agencyBId)
    expect(leaked, `LBA violation: agent B leaked ${leaked.length} cross-tenant KYC cases`).toEqual([])
  })
})
