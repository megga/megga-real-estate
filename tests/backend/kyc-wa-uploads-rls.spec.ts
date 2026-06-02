import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('kyc_magic_link_uploads — canal whatsapp', () => {
  let setup: TwoAgenciesSetup
  let contactId: string
  let caseId: string

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const service = serviceRoleClient()
    const { data: contact, error: cErr } = await service.from('contacts').insert({
      agency_id: setup.agencyAId, first_name: 'Wa', last_name: `Up ${setup.stamp}`,
      email: `wa-up-${setup.stamp}@megga-test.local`,
      entity_type: 'pp', type: 'buyer', source: 'manual',
    }).select('id').single()
    if (cErr) throw new Error(`contact insert: ${cErr.message}`)
    contactId = contact!.id
    const { data: kc, error: kErr } = await service.from('kyc_cases').insert({
      agency_id: setup.agencyAId, contact_id: contact!.id, type: 'buyer_pp', vigilance: 'standard',
    }).select('id').single()
    if (kErr) throw new Error(`kyc_cases insert: ${kErr.message}`)
    caseId = kc!.id
  })

  afterAll(async () => {
    const service = serviceRoleClient()
    // Best-effort : la rétention LBA peut bloquer la suppression du dossier ; on ne fait pas
    // échouer la teardown pour autant. L'upload est supprimé d'abord (CASCADE le couvrirait aussi).
    await service.from('kyc_magic_link_uploads').delete().eq('kyc_case_id', caseId).then(() => {}, () => {})
    await service.from('kyc_cases').delete().eq('id', caseId).then(() => {}, () => {})
    await service.from('contacts').delete().eq('id', contactId).then(() => {}, () => {})
    await setup.cleanup()
  })

  it('accepte un upload whatsapp sans magic_link_id', async () => {
    const service = serviceRoleClient()
    const { error } = await service.from('kyc_magic_link_uploads').insert({
      agency_id: setup.agencyAId, kyc_case_id: caseId, source: 'whatsapp',
      wa_message_id: 'wamid.TEST', type: 'identity', filename: 'cni.jpg',
      size_bytes: 1234, mime_type: 'image/jpeg', storage_path: `${setup.agencyAId}/${caseId}/cni.jpg`,
    })
    expect(error).toBeNull()
  })

  it('rejette un upload sans magic_link NI kyc_case (origin_check)', async () => {
    const service = serviceRoleClient()
    const { error } = await service.from('kyc_magic_link_uploads').insert({
      agency_id: setup.agencyAId, source: 'whatsapp', type: 'other', filename: 'x.pdf',
      size_bytes: 1, storage_path: 'x',
    })
    expect(error).not.toBeNull()
  })

  it("l'agence B ne voit pas l'upload de l'agence A (RLS)", async () => {
    const { data } = await setup.clientB.from('kyc_magic_link_uploads').select('id').eq('kyc_case_id', caseId)
    expect(data ?? []).toEqual([])
  })
})
