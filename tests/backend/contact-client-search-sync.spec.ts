// Regression — matching bridge: contacts.search_criteria → client_searches.
//
// The CRM writes buyer search criteria into `contacts.search_criteria`, but the
// matching-engine reads ONLY `client_searches`. Migration
// 20260621120000_contacts_client_search_bridge adds a SECURITY DEFINER trigger
// (`trg_sync_contact_client_search`) that materialises / updates / deactivates a
// `client_searches` row from the contact. Without it, a hand-entered buyer never
// produces a match (dead loop). This test pins that behaviour end-to-end against
// the live seeded DB so any regression (trigger dropped, column renamed, RLS
// tightened) breaks CI before it ships.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('regression — contacts.search_criteria → client_searches bridge', () => {
  let setup: TwoAgenciesSetup
  const createdContactIds: string[] = []

  beforeAll(async () => {
    setup = await setupTwoAgencies()
  })

  afterAll(async () => {
    const svc = serviceRoleClient()
    // client_searches rows cascade-delete via contact_id FK; deleting the
    // contacts is enough, and setup.cleanup() drops the agencies after.
    for (const id of createdContactIds) {
      await svc.from('contacts').delete().eq('id', id).then(() => {}, () => {})
    }
    await setup.cleanup()
  })

  async function insertBuyer(criteria: Record<string, unknown> | null): Promise<string> {
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const { data, error } = await setup.clientA
      .from('contacts')
      .insert({
        first_name: 'Buyer',
        last_name: `Bridge ${stamp}`,
        email: `buyer-bridge-${stamp}@megga-test.local`,
        type: 'buyer',
        source: 'manual',
        agency_id: setup.agencyAId,
        search_criteria: criteria,
      })
      .select('id')
      .single()
    expect(error, `insert buyer: ${error?.message}`).toBeNull()
    const id = data!.id as string
    createdContactIds.push(id)
    return id
  }

  it('inserting a buyer with search_criteria materialises an ACTIVE client_search', async () => {
    const id = await insertBuyer({
      type: 'apartment',
      zones: ['Genève', 'GE'],
      budget_max: 900000,
      rooms_min: 3,
      transaction_type: 'buy',
    })

    const svc = serviceRoleClient()
    const { data, error } = await svc
      .from('client_searches')
      .select('id, agency_id, contact_id, is_active, criteria, label')
      .eq('contact_id', id)

    expect(error).toBeNull()
    expect(data, 'exactly one client_search materialised').toHaveLength(1)
    const cs = data![0]
    expect(cs.is_active).toBe(true)
    expect(cs.agency_id).toBe(setup.agencyAId)
    expect(cs.criteria).toMatchObject({ type: 'apartment', budget_max: 900000, transaction_type: 'buy' })
    expect(cs.label).toContain('Buyer')
  })

  it('updating search_criteria updates the SAME client_search (no duplicate)', async () => {
    const id = await insertBuyer({ type: 'apartment', budget_max: 800000 })

    const { error: upErr } = await setup.clientA
      .from('contacts')
      .update({ search_criteria: { type: 'house', budget_max: 1500000, transaction_type: 'buy' } })
      .eq('id', id)
    expect(upErr, `update criteria: ${upErr?.message}`).toBeNull()

    const svc = serviceRoleClient()
    const { data } = await svc
      .from('client_searches')
      .select('is_active, criteria')
      .eq('contact_id', id)
    expect(data, 'still exactly one search after update').toHaveLength(1)
    expect(data![0].is_active).toBe(true)
    expect(data![0].criteria).toMatchObject({ type: 'house', budget_max: 1500000 })
  })

  it('clearing search_criteria DEACTIVATES the client_search (kept, not deleted)', async () => {
    const id = await insertBuyer({ type: 'apartment', budget_max: 700000 })

    const { error: upErr } = await setup.clientA
      .from('contacts')
      .update({ search_criteria: {} })
      .eq('id', id)
    expect(upErr, `clear criteria: ${upErr?.message}`).toBeNull()

    const svc = serviceRoleClient()
    const { data } = await svc
      .from('client_searches')
      .select('is_active')
      .eq('contact_id', id)
    expect(data, 'row preserved (history)').toHaveLength(1)
    expect(data![0].is_active).toBe(false)
  })

  it('a contact WITHOUT search_criteria materialises no client_search', async () => {
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const { data, error } = await setup.clientA
      .from('contacts')
      .insert({
        first_name: 'Seller',
        last_name: `NoCrit ${stamp}`,
        email: `seller-nocrit-${stamp}@megga-test.local`,
        type: 'seller',
        source: 'manual',
        agency_id: setup.agencyAId,
        search_criteria: null,
      })
      .select('id')
      .single()
    expect(error).toBeNull()
    const id = data!.id as string
    createdContactIds.push(id)

    const svc = serviceRoleClient()
    const { data: searches } = await svc
      .from('client_searches')
      .select('id')
      .eq('contact_id', id)
    expect(searches).toHaveLength(0)
  })

  it('the materialised client_search is agency-scoped (agent B cannot see it)', async () => {
    const id = await insertBuyer({ type: 'apartment', budget_max: 650000 })

    const { data: seenFromB } = await setup.clientB
      .from('client_searches')
      .select('id')
      .eq('contact_id', id)
    expect(seenFromB, 'agent B leaked agent A search').toEqual([])
  })
})
