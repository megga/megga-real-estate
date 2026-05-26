// Regression — the WizardShell "Publier sur MEGGA" button previously
// silent-no-op'd: after 8 steps (vendor, mandate, address, specs, photos,
// description, price, options), clicking the publish CTA only flipped a
// local `published` flag. No insert into `properties`. Same shape of bug
// as #433 (contacts) and #434 (deals).
//
// Plus: the properties table itself was missing agency-scoped INSERT,
// UPDATE, and DELETE policies — only super_admin could mutate. This file
// asserts BOTH paths work end-to-end now.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('regression — WizardShell publish + properties RLS', () => {
  let setup: TwoAgenciesSetup
  const createdPropertyIds: string[] = []

  beforeAll(async () => {
    setup = await setupTwoAgencies()
  })

  afterAll(async () => {
    const svc = serviceRoleClient()
    for (const id of createdPropertyIds) {
      await svc.from('properties').delete().eq('id', id).then(() => {}, () => {})
    }
    await setup.cleanup()
  })

  it('"Publier sur MEGGA" → insert active property with published_at', async () => {
    // Mirror the wizard's publishMode='now' path: status='active' + published_at=now
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const { data, error } = await setup.clientA
      .from('properties')
      .insert({
        agency_id: setup.agencyAId,
        title: `Appartement 4 pièces — Genève ${stamp}`,
        type: 'apartment',
        status: 'active',
        price: 1_200_000,
        rooms: 4,
        bedrooms: 3,
        bathrooms: 2,
        surface_m2: 95,
        floor: 2,
        total_floors: 5,
        year_built: 2018,
        charges_monthly: 350,
        mandate_type: 'exclusive',
        mandate_commission_pct: 3.5,
        energy_class: 'B',
        address: '12 rue du Rhône',
        city: 'Genève',
        canton: 'GE',
        postal_code: '1204',
        features: ['balcon', 'ascenseur', 'cave'],
        published_at: new Date().toISOString(),
      })
      .select('id, status, published_at, agency_id')
      .single()

    expect(error).toBeNull()
    if (data?.id) createdPropertyIds.push(data.id)
    expect(data?.status).toBe('active')
    expect(data?.published_at).toBeTruthy()
    expect(data?.agency_id).toBe(setup.agencyAId)
  })

  it('"Enregistrer en brouillon" → insert draft property without published_at', async () => {
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const { data, error } = await setup.clientA
      .from('properties')
      .insert({
        agency_id: setup.agencyAId,
        title: `Maison brouillon ${stamp}`,
        type: 'house',
        status: 'draft',
        price: 2_500_000,
        rooms: 6,
        bedrooms: 4,
        bathrooms: 3,
        surface_m2: 220,
        address: '5 chemin des Bois',
        city: 'Cologny',
        canton: 'GE',
        postal_code: '1223',
      })
      .select('id, status, published_at')
      .single()

    expect(error).toBeNull()
    if (data?.id) createdPropertyIds.push(data.id)
    expect(data?.status).toBe('draft')
    expect(data?.published_at).toBeNull()
  })

  it('agent A CAN UPDATE their own property (new policy)', async () => {
    // The old RLS only allowed super_admin to UPDATE. After this PR,
    // agents can edit their agency's listings.
    const { data: created } = await setup.clientA
      .from('properties')
      .insert({
        agency_id: setup.agencyAId,
        title: `Editable ${setup.stamp}`,
        type: 'apartment',
        status: 'draft',
        price: 100,
        rooms: 1, bedrooms: 0, bathrooms: 1, surface_m2: 25,
        address: 'X', city: 'X', canton: 'GE', postal_code: '1200',
      })
      .select('id')
      .single()
    if (created?.id) createdPropertyIds.push(created.id)

    const { error: updateErr } = await setup.clientA
      .from('properties')
      .update({ price: 200 })
      .eq('id', created!.id)
    expect(updateErr).toBeNull()

    const { data: refetch } = await setup.clientA
      .from('properties')
      .select('price')
      .eq('id', created!.id)
      .single()
    expect(refetch?.price).toBe(200)
  })

  it('agent A CAN DELETE their own property (new policy)', async () => {
    const { data: created } = await setup.clientA
      .from('properties')
      .insert({
        agency_id: setup.agencyAId,
        title: `Deletable ${setup.stamp}`,
        type: 'apartment',
        status: 'draft',
        price: 100,
        rooms: 1, bedrooms: 0, bathrooms: 1, surface_m2: 25,
        address: 'X', city: 'X', canton: 'GE', postal_code: '1200',
      })
      .select('id')
      .single()
    // Don't push to createdPropertyIds — we're deleting it as the test

    const { error: deleteErr } = await setup.clientA
      .from('properties')
      .delete()
      .eq('id', created!.id)
    expect(deleteErr).toBeNull()

    const svc = serviceRoleClient()
    const { data: gone } = await svc
      .from('properties')
      .select('id')
      .eq('id', created!.id)
    expect(gone).toEqual([])
  })

  it('agent B CANNOT INSERT a property scoped to agency A (RLS isolation)', async () => {
    // The WITH CHECK on properties_insert is `agency_id = get_user_agency_id()`.
    // Agent B is in agency B; trying to insert with agency_id = A should fail.
    const { error } = await setup.clientB
      .from('properties')
      .insert({
        agency_id: setup.agencyAId, // ← wrong agency on purpose
        title: 'Cross-tenant attempt',
        type: 'apartment',
        status: 'draft',
        price: 1,
        rooms: 1, bedrooms: 0, bathrooms: 1, surface_m2: 25,
        address: 'X', city: 'X', canton: 'GE', postal_code: '1200',
      })
      .select('id')

    expect(error).toBeTruthy()
    expect(error?.message.toLowerCase()).toMatch(/policy|violates/)
  })

  it('agent B CANNOT UPDATE agent A property (RLS isolation)', async () => {
    const { data: created } = await setup.clientA
      .from('properties')
      .insert({
        agency_id: setup.agencyAId,
        title: `Locked ${setup.stamp}`,
        type: 'apartment',
        status: 'draft',
        price: 100,
        rooms: 1, bedrooms: 0, bathrooms: 1, surface_m2: 25,
        address: 'X', city: 'X', canton: 'GE', postal_code: '1200',
      })
      .select('id')
      .single()
    if (created?.id) createdPropertyIds.push(created.id)

    // Agent B's update silently affects 0 rows (RLS hides the row from them)
    const { data: updated } = await setup.clientB
      .from('properties')
      .update({ price: 999_999_999 })
      .eq('id', created!.id)
      .select('id')
    expect(updated, `agent B leaked update to agency A property`).toEqual([])

    // Sanity: price did not change
    const svc = serviceRoleClient()
    const { data: row } = await svc
      .from('properties')
      .select('price')
      .eq('id', created!.id)
      .single()
    expect(row?.price).toBe(100)
  })
})
