// RLS isolation — seller_leads (leads vendeurs captés par l'entonnoir public).
//
// Régression de la seule fuite de lecture MESURÉE de l'audit RLS du 03.08.2026
// (docs/audits/2026-08-03-rls-isolation-multi-agence.md §4) : `seller_leads_agents_all`
// était `FOR ALL` avec `assigned_agency_id IS NULL` dans le USING *et* le WITH CHECK,
// donc toute agence pouvait modifier et SUPPRIMER les leads entrants du pot commun.
//
// Ce que ces tests verrouillent, et la distinction est le cœur du correctif :
//   · la LECTURE du pot commun reste partagée — c'est une décision produit assumée ;
//   · l'ÉCRITURE sur le pot commun est fermée — aucune décision produit ne l'a voulue.
//
// Corrigé par 20260803130000_seller_leads_pot_commun_lecture_seule.sql.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('RLS isolation — seller_leads', () => {
  let setup: TwoAgenciesSetup
  let poolLeadId: string
  let leadAId: string
  let leadBId: string

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const service = serviceRoleClient()

    const seed = async (assignedAgencyId: string | null, label: string) => {
      const { data, error } = await service
        .from('seller_leads')
        .insert({
          contact_name: `${label} ${setup.stamp}`,
          contact_email: `${label}-${setup.stamp}@megga-test.local`,
          contact_phone: '+41 22 000 00 00',
          // CHECK seller_leads_motivation_check : immediate | 3months | 6months | exploring
          motivation: 'exploring',
          assigned_agency_id: assignedAgencyId,
          status: 'new',
        })
        .select('id')
        .single()
      if (error) throw new Error(`seed ${label}: ${error.message}`)
      return data.id as string
    }

    // Reproduit l'état réel : l'entonnoir public (policy anon) FORCE assigned_agency_id
    // à NULL, donc tout lead naît dans le pot commun avant attribution super-admin.
    poolLeadId = await seed(null, 'pool')
    leadAId = await seed(setup.agencyAId, 'lead-a')
    leadBId = await seed(setup.agencyBId, 'lead-b')
  })

  afterAll(async () => {
    const service = serviceRoleClient()
    for (const id of [poolLeadId, leadAId, leadBId]) {
      if (id) await service.from('seller_leads').delete().eq('id', id)
    }
    await setup.cleanup()
  })

  // --- Lecture : périmètre volontairement partagé, à ne PAS resserrer par accident ---

  it('agent A sees the unassigned pool lead (shared-pool read is a product decision)', async () => {
    const { data, error } = await setup.clientA
      .from('seller_leads')
      .select('id')
      .eq('id', poolLeadId)
    expect(error).toBeNull()
    expect(data, 'pool visibility is intentional — do not tighten without a product call').toHaveLength(1)
  })

  it('agent A sees its own agency lead', async () => {
    const { data, error } = await setup.clientA
      .from('seller_leads')
      .select('id')
      .eq('id', leadAId)
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })

  it('agent A does NOT see a lead assigned to agency B', async () => {
    const { data, error } = await setup.clientA
      .from('seller_leads')
      .select('id')
      .eq('id', leadBId)
    expect(error).toBeNull()
    expect(data, 'assigned leads must stay private to their agency').toHaveLength(0)
  })

  // --- Écriture : c'est ici que se jouait la faille ---

  it('agent A CANNOT update a pool lead (was: any agency could rewrite inbound PII)', async () => {
    await setup.clientA
      .from('seller_leads')
      .update({ contact_email: 'hijacked@example.com', status: 'lost' })
      .eq('id', poolLeadId)

    const { data: after } = await serviceRoleClient()
      .from('seller_leads')
      .select('contact_email, status')
      .eq('id', poolLeadId)
      .single()
    expect(after?.contact_email, 'pool lead PII must be untouched').not.toBe('hijacked@example.com')
    expect(after?.status).toBe('new')
  })

  it('agent A CANNOT claim a pool lead by assigning it to itself', async () => {
    await setup.clientA
      .from('seller_leads')
      .update({ assigned_agency_id: setup.agencyAId })
      .eq('id', poolLeadId)

    const { data: after } = await serviceRoleClient()
      .from('seller_leads')
      .select('assigned_agency_id')
      .eq('id', poolLeadId)
      .single()
    expect(after?.assigned_agency_id, 'assignment is a super-admin gesture, not a self-serve claim').toBeNull()
  })

  it('agent A CANNOT delete a pool lead (was: silent destruction of inbound leads)', async () => {
    await setup.clientA.from('seller_leads').delete().eq('id', poolLeadId)

    const { data: after } = await serviceRoleClient()
      .from('seller_leads')
      .select('id')
      .eq('id', poolLeadId)
    expect(after, 'pool lead must survive a delete attempt from a non-owning agency').toHaveLength(1)
  })

  it('agent B CANNOT update a lead assigned to agency A', async () => {
    await setup.clientB
      .from('seller_leads')
      .update({ status: 'lost' })
      .eq('id', leadAId)

    const { data: after } = await serviceRoleClient()
      .from('seller_leads')
      .select('status')
      .eq('id', leadAId)
      .single()
    expect(after?.status, 'cross-agency write must not land').toBe('new')
  })

  // --- Ce qui doit continuer de marcher ---

  it('agent A CAN update its own assigned lead', async () => {
    const { data, error } = await setup.clientA
      .from('seller_leads')
      .update({ status: 'contacted' })
      .eq('id', leadAId)
      .select('id')
    expect(error, 'working an own lead is legitimate').toBeNull()
    expect(data).toHaveLength(1)
  })

  it('agent A CANNOT push its own lead to another agency (WITH CHECK blocks)', async () => {
    const { error } = await setup.clientA
      .from('seller_leads')
      .update({ assigned_agency_id: setup.agencyBId })
      .eq('id', leadAId)
    expect(error, 'WITH CHECK should reject a cross-agency move').not.toBeNull()

    const { data: after } = await serviceRoleClient()
      .from('seller_leads')
      .select('assigned_agency_id')
      .eq('id', leadAId)
      .single()
    expect(after?.assigned_agency_id).toBe(setup.agencyAId)
  })

  it('agent A CANNOT release its own lead back into the pool', async () => {
    const { error } = await setup.clientA
      .from('seller_leads')
      .update({ assigned_agency_id: null })
      .eq('id', leadAId)
    expect(error, 'WITH CHECK should reject dropping a lead back to the shared pool').not.toBeNull()

    const { data: after } = await serviceRoleClient()
      .from('seller_leads')
      .select('assigned_agency_id')
      .eq('id', leadAId)
      .single()
    expect(after?.assigned_agency_id).toBe(setup.agencyAId)
  })
})
