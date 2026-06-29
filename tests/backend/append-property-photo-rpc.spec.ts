// RPC append_property_photo — append ATOMIQUE d'une URL photo à properties.photos
// (utilisé par l'attache de photos WhatsApp, robuste à une rafale concurrente).
// SECURITY DEFINER, GRANT EXECUTE service_role uniquement. Scopé par agency_id,
// dédupe, renvoie le nouveau compte (ou NULL si bien introuvable / mauvaise agence).

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('RPC append_property_photo', () => {
  let setup: TwoAgenciesSetup
  let propAId: string

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const service = serviceRoleClient()
    const { data, error } = await service.from('properties')
      .insert({ agency_id: setup.agencyAId, title: `Photo RPC ${setup.stamp}`, photos: [] })
      .select('id').single()
    if (error) throw new Error(`prop: ${error.message}`)
    propAId = data.id
  })

  afterAll(async () => {
    if (propAId) await serviceRoleClient().from('properties').delete().eq('id', propAId)
    await setup.cleanup()
  })

  it('append une URL et renvoie le nouveau compte', async () => {
    const svc = serviceRoleClient()
    const { data, error } = await svc.rpc('append_property_photo', {
      p_property_id: propAId, p_agency_id: setup.agencyAId, p_url: 'https://r2/1.jpg',
    })
    expect(error).toBeNull()
    expect(data).toBe(1)
    const { data: prop } = await svc.from('properties').select('photos').eq('id', propAId).single()
    expect(prop?.photos).toEqual(['https://r2/1.jpg'])
  })

  it('dédupe la même URL (compte inchangé) et append une nouvelle', async () => {
    const svc = serviceRoleClient()
    const { data: same } = await svc.rpc('append_property_photo', {
      p_property_id: propAId, p_agency_id: setup.agencyAId, p_url: 'https://r2/1.jpg',
    })
    expect(same).toBe(1)
    const { data: next } = await svc.rpc('append_property_photo', {
      p_property_id: propAId, p_agency_id: setup.agencyAId, p_url: 'https://r2/2.jpg',
    })
    expect(next).toBe(2)
  })

  it('mauvaise agence → NULL, rien appendé', async () => {
    const svc = serviceRoleClient()
    const { data } = await svc.rpc('append_property_photo', {
      p_property_id: propAId, p_agency_id: setup.agencyBId, p_url: 'https://r2/leak.jpg',
    })
    expect(data).toBeNull()
    const { data: prop } = await svc.from('properties').select('photos').eq('id', propAId).single()
    expect((prop?.photos as string[]).includes('https://r2/leak.jpg')).toBe(false)
  })

  it('bien inexistant → NULL', async () => {
    const { data } = await serviceRoleClient().rpc('append_property_photo', {
      p_property_id: '00000000-0000-0000-0000-000000000000', p_agency_id: setup.agencyAId, p_url: 'https://r2/x.jpg',
    })
    expect(data).toBeNull()
  })

  it('inaccessible à un client authentifié (GRANT service_role uniquement)', async () => {
    const { error } = await setup.clientA.rpc('append_property_photo', {
      p_property_id: propAId, p_agency_id: setup.agencyAId, p_url: 'https://r2/z.jpg',
    })
    expect(error).not.toBeNull()
  })
})
