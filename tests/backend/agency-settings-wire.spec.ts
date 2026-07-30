// Regression — AgencySection (Settings) wire to agencies table.
// Wired via useAgencySettings hook : read row of profile.agency_id, update
// name/address/city/canton/phone/email/website/logo_url.
//
// RLS : seul un dirigeant (role admin|manager) de l'agence peut écrire sa ligne — depuis
// l'étape 7/tâche 3/écart 1 (migration 20260730170000_agencies_members_update_rbac.sql),
// agencies_members_update exige is_agency_admin(). setupTwoAgencies() attache les deux
// agents avec role='agent' par défaut : la promotion en admin est donc explicite ci-dessous,
// là où l'ancienne version de ce fichier écrivait avec le rôle par défaut. Isolation
// inter-agences inchangée : agent B ne peut pas toucher agence A, MÊME dirigeant de sa
// propre agence B (pour ne pas confondre la preuve d'isolation avec la preuve de RBAC).

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

  // Étape 7, tâche 3, écart 1 : setupTwoAgencies() attache agent A avec role='agent' — la
  // policy exige désormais is_agency_admin(), donc cette écriture doit être un no-op.
  it('agent A (role agent, par défaut) ne peut plus mettre à jour sa propre agence — RBAC', async () => {
    const before = await serviceRoleClient()
      .from('agencies')
      .select('name, address, city, canton')
      .eq('id', setup.agencyAId)
      .single()

    const { error } = await setup.clientA
      .from('agencies')
      .update({ name: `LEAK AGENT ${setup.stamp}`, address: 'Fraud St', city: 'Nowhere', canton: 'GE' })
      .eq('id', setup.agencyAId)
    // USING exclut la ligne (is_agency_admin() faux) : 0 ligne touchée, pas de refus explicite.
    expect(error).toBeNull()

    const { data } = await serviceRoleClient()
      .from('agencies')
      .select('name, address, city, canton')
      .eq('id', setup.agencyAId)
      .single()
    expect(data, 'un agent simple ne dirige pas l\'agence : rien n\'a dû bouger').toEqual(before.data)
  })

  it('un dirigeant (role admin) de l\'agence A met à jour sa propre agence (name/address/city)', async () => {
    const { error: promoteErr } = await serviceRoleClient()
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', setup.agentAId)
    expect(promoteErr, 'promotion role=admin (fixture)').toBeNull()

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

  it('agent B (dirigeant de SA PROPRE agence) CANNOT update agency A (RLS isolation)', async () => {
    // Promu admin lui aussi : la preuve d'isolation ne doit rien devoir au RBAC de l'écart 1,
    // sans quoi ce test échouerait pour la mauvaise raison (B pas dirigeant) plutôt que pour
    // la bonne (B dirigeant, mais d'une AUTRE agence).
    const { error: promoteErr } = await serviceRoleClient()
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', setup.agentBId)
    expect(promoteErr, 'promotion role=admin (fixture)').toBeNull()

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
