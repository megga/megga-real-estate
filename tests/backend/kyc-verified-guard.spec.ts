import { describe, it, expect, beforeAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('KYC — guard_manual_kyc_verified', () => {
  let setup: TwoAgenciesSetup
  let caseId: string

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const service = serviceRoleClient()
    const { data: contact, error: cErr } = await service.from('contacts').insert({
      agency_id: setup.agencyAId, first_name: 'Guard', last_name: `Test ${setup.stamp}`,
      email: `guard-${setup.stamp}@megga-test.local`,
      entity_type: 'pp', type: 'buyer', source: 'manual',
    }).select('id').single()
    if (cErr) throw new Error(`contact insert: ${cErr.message}`)
    const { data: kc, error } = await service.from('kyc_cases').insert({
      agency_id: setup.agencyAId, contact_id: contact!.id, type: 'buyer_pp', vigilance: 'standard',
    }).select('id').single()
    if (error) throw new Error(`kyc_cases insert: ${error.message}`)
    caseId = kc!.id
  })

  it("refuse un UPDATE direct dossier_status='verified' (check_violation)", async () => {
    const service = serviceRoleClient()
    const { error } = await service.from('kyc_cases')
      .update({ dossier_status: 'verified' }).eq('id', caseId)
    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/Bypass manuel refusé|check/i)
  })

  it('a écrit un activity_events critical (tentative bloquée)', async () => {
    const service = serviceRoleClient()
    const { data } = await service.from('activity_events')
      .select('severity, metadata').eq('entity_id', caseId).eq('severity', 'critical')
    const blocked = (data ?? []).some(
      (e) => (e.metadata as Record<string, unknown>)?.reason === 'manual_verified_bypass_blocked',
    )
    expect(blocked).toBe(true)
  })
})
