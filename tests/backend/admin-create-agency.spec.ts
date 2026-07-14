// Admin création d'agence — admin_create_agency (migration 20260714100000)
//
//  Test 1 — Gate : un agent simple est rejeté (42501).
//  Test 2 — Effet : un super_admin crée une agence → elle existe, et le
//    super_admin N'Y est PAS rattaché (son profile.agency_id est inchangé).
//  Test 3 — Audit : un activity_events agency_created (admin_created=true).
//  Test 4 — Collision de nom refusée.
//
// Runs live in CI (SUPABASE_TEST_* keys present). Skips locally without keys.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('admin_create_agency — gardée super_admin, sans rattachement', () => {
  let setup: TwoAgenciesSetup
  let createdId: string | null = null
  let name = ''

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    name = `Nouvelle Agence ${setup.stamp}`
    const { error } = await serviceRoleClient().from('profiles').update({ role: 'super_admin' }).eq('id', setup.agentAId)
    if (error) throw new Error(`promote: ${error.message}`)
  })

  afterAll(async () => {
    const service = serviceRoleClient()
    if (createdId) await service.from('agencies').delete().eq('id', createdId).then(() => {}, () => {})
    await service.from('profiles').update({ role: 'agent' }).eq('id', setup.agentAId).then(() => {}, () => {})
    await setup.cleanup()
  })

  it('un agent simple ne peut pas créer d\'agence', async () => {
    const { error } = await setup.clientB.rpc('admin_create_agency', { p_name: `Hack ${setup.stamp}` })
    expect(error, 'refus attendu').not.toBeNull()
  })

  it('un super_admin crée une agence sans s\'y rattacher', async () => {
    const service = serviceRoleClient()
    const { data, error } = await setup.clientA.rpc('admin_create_agency', {
      p_name: name, p_city: 'Genève', p_canton: 'GE', p_plan: 'pro', p_note: 'partenaire',
    })
    if (error) throw new Error(`create: ${error.message}`)
    createdId = data as string
    expect(createdId).toBeTruthy()

    const { data: agency } = await service.from('agencies').select('name, plan, city, canton, created_by').eq('id', createdId).single()
    expect(agency?.name).toBe(name)
    expect(agency?.plan).toBe('pro')

    // Le super_admin n'est PAS rattaché : son profil pointe toujours son agence.
    const { data: profile } = await service.from('profiles').select('agency_id').eq('id', setup.agentAId).single()
    expect(profile?.agency_id).toBe(setup.agencyAId)
  })

  it('la création est auditée agency_created (admin_created=true)', async () => {
    if (!createdId) return
    const { data: events } = await serviceRoleClient()
      .from('activity_events')
      .select('action, metadata')
      .eq('action', 'agency_created')
      .eq('entity_id', createdId)
      .limit(1)
    expect(events?.length).toBe(1)
    expect((events![0].metadata as { admin_created?: boolean })?.admin_created).toBe(true)
  })

  it('un nom déjà pris est refusé', async () => {
    const { error } = await setup.clientA.rpc('admin_create_agency', { p_name: name })
    expect(error, 'collision de nom → erreur').not.toBeNull()
  })
})
