// RLS isolation — property_syndications (syndication sortante IDX).
// Les inscriptions de syndication d'une agence ne doivent jamais fuiter, ni être
// modifiables, par une autre agence. Policies : select/insert/update/delete
// gardées par agency_id = public.get_my_agency_id().

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, findLeakedRows, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient, anonClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('RLS isolation — property_syndications', () => {
  let setup: TwoAgenciesSetup
  let propAId: string
  let propBId: string
  let syndAId: string
  let syndBId: string

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const service = serviceRoleClient()

    const { data: pa, error: ea } = await service.from('properties')
      .insert({ agency_id: setup.agencyAId, title: `Synd Prop A ${setup.stamp}`, status: 'active' })
      .select('id').single()
    if (ea) throw new Error(`propA: ${ea.message}`)
    propAId = pa.id

    const { data: pb, error: eb } = await service.from('properties')
      .insert({ agency_id: setup.agencyBId, title: `Synd Prop B ${setup.stamp}`, status: 'active' })
      .select('id').single()
    if (eb) throw new Error(`propB: ${eb.message}`)
    propBId = pb.id

    const { data: sa, error: esa } = await service.from('property_syndications')
      .insert({ property_id: propAId, agency_id: setup.agencyAId, portal: 'immobilier_ch', status: 'queued' })
      .select('id').single()
    if (esa) throw new Error(`syndA: ${esa.message}`)
    syndAId = sa.id

    const { data: sb, error: esb } = await service.from('property_syndications')
      .insert({ property_id: propBId, agency_id: setup.agencyBId, portal: 'immobilier_ch', status: 'queued' })
      .select('id').single()
    if (esb) throw new Error(`syndB: ${esb.message}`)
    syndBId = sb.id
  })

  afterAll(async () => {
    const service = serviceRoleClient()
    for (const id of [syndAId, syndBId]) if (id) await service.from('property_syndications').delete().eq('id', id)
    for (const id of [propAId, propBId]) if (id) await service.from('properties').delete().eq('id', id)
    await setup.cleanup()
  })

  it('agent A ne voit que les syndications de SON agence (0 fuite)', async () => {
    const leaked = await findLeakedRows(setup.clientA, 'property_syndications', setup.agencyAId)
    expect(leaked).toEqual([])
    // La ligne de B est carrément invisible pour A.
    const { data } = await setup.clientA.from('property_syndications').select('id').eq('id', syndBId)
    expect(data ?? []).toEqual([])
  })

  it('agent B ne voit que les syndications de SON agence (0 fuite)', async () => {
    const leaked = await findLeakedRows(setup.clientB, 'property_syndications', setup.agencyBId)
    expect(leaked).toEqual([])
  })

  it('anon ne voit aucune syndication', async () => {
    const { data } = await anonClient().from('property_syndications').select('id').in('id', [syndAId, syndBId])
    expect(data ?? []).toEqual([])
  })

  it('agent A peut insérer une syndication pour SA propre agence', async () => {
    const { data, error } = await setup.clientA.from('property_syndications')
      .insert({ property_id: propAId, agency_id: setup.agencyAId, portal: 'test_portal', status: 'queued' })
      .select('id').single()
    expect(error).toBeNull()
    expect(data?.id).toBeTruthy()
    if (data?.id) await serviceRoleClient().from('property_syndications').delete().eq('id', data.id)
  })

  it('agent A NE PEUT PAS insérer pour une autre agence (with check)', async () => {
    const { error } = await setup.clientA.from('property_syndications')
      .insert({ property_id: propBId, agency_id: setup.agencyBId, portal: 'leak_portal', status: 'queued' })
      .select('id').single()
    expect(error).not.toBeNull()
  })

  it("agent A ne peut pas modifier la syndication de B (invisible)", async () => {
    const { data } = await setup.clientA.from('property_syndications')
      .update({ status: 'withdrawn' }).eq('id', syndBId).select('id')
    expect(data ?? []).toEqual([])
    const { data: still } = await serviceRoleClient().from('property_syndications').select('status').eq('id', syndBId).single()
    expect(still?.status).toBe('queued')
  })

  it('agent A peut supprimer SA propre syndication', async () => {
    const svc = serviceRoleClient()
    const { data: tmp, error: et } = await svc.from('property_syndications')
      .insert({ property_id: propAId, agency_id: setup.agencyAId, portal: 'tmp_del', status: 'queued' })
      .select('id').single()
    if (et) throw new Error(`tmp: ${et.message}`)
    const { error } = await setup.clientA.from('property_syndications').delete().eq('id', tmp.id)
    expect(error).toBeNull()
    const { data: gone } = await svc.from('property_syndications').select('id').eq('id', tmp.id)
    expect(gone ?? []).toEqual([])
  })
})
