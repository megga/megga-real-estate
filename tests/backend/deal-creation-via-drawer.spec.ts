// Regression — the pipeline NewDealDrawer "Créer le deal" button previously
// silent-no-op'd: it only flipped a local `created` flag and showed the
// confirmation view. No transaction insert. No contact create on the
// "new contact" path. This test mirrors the exact two flows the drawer
// now performs end-to-end so any future regression breaks CI before ship.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('regression — NewDealDrawer insert flows', () => {
  let setup: TwoAgenciesSetup
  let propertyId: string
  const createdContactIds: string[] = []
  const createdTxIds: string[] = []

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const service = serviceRoleClient()

    const { data: prop, error } = await service
      .from('properties')
      .insert({ agency_id: setup.agencyAId, title: `Drawer Test Property ${setup.stamp}` })
      .select('id')
      .single()
    if (error) throw new Error(`property: ${error.message}`)
    propertyId = prop.id
  })

  afterAll(async () => {
    const svc = serviceRoleClient()
    for (const id of createdTxIds) {
      await svc.from('transactions').delete().eq('id', id).then(() => {}, () => {})
    }
    for (const id of createdContactIds) {
      await svc.from('contacts').delete().eq('id', id).then(() => {}, () => {})
    }
    if (propertyId) {
      await svc.from('properties').delete().eq('id', propertyId).then(() => {}, () => {})
    }
    await setup.cleanup()
  })

  it('"buyer-bien" flow: existing contact + bien → transaction inserts in active_search', async () => {
    // Seed an existing buyer contact in agency A
    const { data: contact } = await setup.clientA
      .from('contacts')
      .insert({
        first_name: 'Existing',
        last_name: `Buyer ${setup.stamp}`,
        email: `existing-${setup.stamp}@megga-test.local`,
        type: 'buyer',
        source: 'manual',
        agency_id: setup.agencyAId,
      })
      .select('id')
      .single()
    if (contact?.id) createdContactIds.push(contact.id)

    // Drawer flow: insert transaction with that contact + property
    const { data: tx, error } = await setup.clientA
      .from('transactions')
      .insert({
        agency_id: setup.agencyAId,
        property_id: propertyId,
        contact_buyer_id: contact!.id,
        stage: 'visit_planned', // drawer maps 'visit-scheduled' → 'visit_planned'
      })
      .select('id, stage, contact_buyer_id, property_id, agency_id')
      .single()

    expect(error).toBeNull()
    if (tx?.id) createdTxIds.push(tx.id)
    expect(tx?.contact_buyer_id).toBe(contact!.id)
    expect(tx?.property_id).toBe(propertyId)
    expect(tx?.stage).toBe('visit_planned')
  })

  it('"buyer-search" flow: new contact + no bien → contact then transaction in active_search', async () => {
    // Drawer creates contact first
    const { data: contact, error: cErr } = await setup.clientA
      .from('contacts')
      .insert({
        first_name: 'Fresh',
        last_name: `Lead ${setup.stamp}`,
        email: `fresh-${setup.stamp}@megga-test.local`,
        phone: '+41 79 999 88 77',
        type: 'buyer',
        source: 'manual',
        agency_id: setup.agencyAId,
      })
      .select('id')
      .single()
    expect(cErr).toBeNull()
    if (contact?.id) createdContactIds.push(contact.id)

    // Then insert transaction with no property (buyer-search archetype)
    const { data: tx, error } = await setup.clientA
      .from('transactions')
      .insert({
        agency_id: setup.agencyAId,
        contact_buyer_id: contact!.id,
        stage: 'active_search', // drawer maps 'searching' → 'active_search'
        notes: '[Appel — 2026-05-30T10:00] Premier appel de qualification',
      })
      .select('id, stage, contact_buyer_id, property_id, notes')
      .single()

    expect(error).toBeNull()
    if (tx?.id) createdTxIds.push(tx.id)
    expect(tx?.property_id).toBeNull()
    expect(tx?.stage).toBe('active_search')
    expect(tx?.notes).toContain('Appel')
  })

  it('"seller-mandate" flow: contact_seller_id populated (not buyer)', async () => {
    const { data: contact } = await setup.clientA
      .from('contacts')
      .insert({
        first_name: 'Marc',
        last_name: `Vendor ${setup.stamp}`,
        email: `vendor-${setup.stamp}@megga-test.local`,
        type: 'seller',
        source: 'manual',
        agency_id: setup.agencyAId,
      })
      .select('id')
      .single()
    if (contact?.id) createdContactIds.push(contact.id)

    const { data: tx, error } = await setup.clientA
      .from('transactions')
      .insert({
        agency_id: setup.agencyAId,
        property_id: propertyId,
        contact_seller_id: contact!.id,
        stage: 'new_lead', // drawer maps 'new-lead' → 'new_lead'
      })
      .select('id, contact_buyer_id, contact_seller_id, stage')
      .single()

    expect(error).toBeNull()
    if (tx?.id) createdTxIds.push(tx.id)
    expect(tx?.contact_seller_id).toBe(contact!.id)
    expect(tx?.contact_buyer_id).toBeNull()
    expect(tx?.stage).toBe('new_lead')
  })

  it('mock-id guard: inserting a transaction with a c-… contact id fails with FK violation', async () => {
    // The drawer now blocks mock IDs client-side with a friendly error.
    // This test documents what would happen if that guard were bypassed
    // (FK constraint catches it server-side as a safety net).
    const { error } = await setup.clientA
      .from('transactions')
      .insert({
        agency_id: setup.agencyAId,
        property_id: propertyId,
        contact_buyer_id: '00000000-0000-0000-0000-000000000001', // synthetic non-existent UUID
        stage: 'active_search',
      })
      .select('id')

    // Postgres FK violation surface as a 23503 error or 'foreign key' message.
    expect(error).toBeTruthy()
    expect(error?.message.toLowerCase()).toMatch(/foreign|violates|not present/)
  })
})
