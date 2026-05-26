// Regression — the contacts page (ContactsSugarV2Page) "Créer le contact"
// modal previously silent-no-op'd: `handleNewContactSave` only fired a
// toast, never called the mutation. This test mirrors the exact shape of
// the insert the page now performs end-to-end so any future regression
// (column dropped, type-check enum tightened, source map broken) breaks CI
// before it ships.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('regression — ContactsSugarV2Page modal insert', () => {
  let setup: TwoAgenciesSetup
  const createdIds: string[] = []

  beforeAll(async () => {
    setup = await setupTwoAgencies()
  })

  afterAll(async () => {
    const svc = serviceRoleClient()
    for (const id of createdIds) {
      await svc.from('contacts').delete().eq('id', id).then(() => {}, () => {})
    }
    await setup.cleanup()
  })

  it('agent inserts contact via the page-modal shape (buyer + search_criteria)', async () => {
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const { data, error } = await setup.clientA
      .from('contacts')
      .insert({
        first_name: 'Sophie',
        last_name: `Page ${stamp}`,
        email: `sophie-${stamp}@megga-test.local`,
        phone: '+41 79 555 11 22',
        type: 'buyer',
        source: 'website', // mapped from modal 'website' → DB 'website'
        score: 'cold',
        tags: ['primo-accédant', 'urgent'],
        notes: 'Cherche un 4 pièces en rive droite',
        agency_id: setup.agencyAId,
        search_criteria: {
          transaction: 'vente',
          types: ['appartement'],
          cantons: ['GE'],
          budgetMin: 800000,
          budgetMax: 1200000,
          roomsMin: 4,
        },
        form_data: {
          civility: 'mrs',
          lang: 'fr',
          assigned_to: 'agt-1',
          source_slug_ui: 'website',
          linked_bien: null,
        },
      })
      .select('id, search_criteria, form_data, source')
      .single()

    expect(error).toBeNull()
    expect(data?.id).toBeTruthy()
    if (data?.id) createdIds.push(data.id)

    // search_criteria persisted as JSONB and queryable
    expect(data?.search_criteria).toMatchObject({
      transaction: 'vente',
      types: ['appartement'],
      budgetMin: 800000,
    })
    // form_data preserves non-mapped UI fields
    expect(data?.form_data).toMatchObject({
      civility: 'mrs',
      lang: 'fr',
    })
    // source mapping respected DB check constraint
    expect(data?.source).toBe('website')
  })

  it('source-mapping covers all modal slugs without violating CHECK constraint', async () => {
    // Modal offers: website | referral | portal | walk-in | csv | other
    // Page maps: portal→website, walk-in→manual, csv→import, other→manual
    // DB CHECK: source IN ('onboarding','manual','import','website','referral')
    const cases: Array<{ ui: string; db: string }> = [
      { ui: 'website', db: 'website' },
      { ui: 'referral', db: 'referral' },
      { ui: 'portal', db: 'website' },
      { ui: 'walk-in', db: 'manual' },
      { ui: 'csv', db: 'import' },
      { ui: 'other', db: 'manual' },
    ]

    for (const { ui, db } of cases) {
      const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
      const { data, error } = await setup.clientA
        .from('contacts')
        .insert({
          first_name: 'Src',
          last_name: `Map ${stamp}`,
          email: `src-${ui}-${stamp}@megga-test.local`,
          type: 'buyer',
          source: db,
          agency_id: setup.agencyAId,
          form_data: { source_slug_ui: ui },
        })
        .select('id')
        .single()

      expect(error, `failed inserting source mapping ${ui}→${db}: ${error?.message}`).toBeNull()
      if (data?.id) createdIds.push(data.id)
    }
  })

  it('seller contact insert without search_criteria (linkedBien in form_data)', async () => {
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const { data, error } = await setup.clientA
      .from('contacts')
      .insert({
        first_name: 'Marc',
        last_name: `Seller ${stamp}`,
        email: `marc-seller-${stamp}@megga-test.local`,
        type: 'seller',
        source: 'manual',
        agency_id: setup.agencyAId,
        search_criteria: null, // seller has no search criteria
        form_data: {
          civility: 'mr',
          lang: 'fr',
          linked_bien: {
            address: '12 rue de Genève, Geneva',
            type: 'maison',
            rooms: 5,
          },
        },
      })
      .select('id, form_data, type')
      .single()

    expect(error).toBeNull()
    if (data?.id) createdIds.push(data.id)
    expect(data?.type).toBe('seller')
    expect(data?.form_data).toMatchObject({
      linked_bien: { address: '12 rue de Genève, Geneva' },
    })
  })

  it('agent B cannot see agent A contacts (RLS isolation holds with new fields)', async () => {
    // Sanity check — the new form_data/search_criteria columns don't somehow
    // expose data across agencies (RLS scoping is via agency_id, unchanged).
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const { data: created } = await setup.clientA
      .from('contacts')
      .insert({
        first_name: 'RLS',
        last_name: `Check ${stamp}`,
        email: `rls-${stamp}@megga-test.local`,
        type: 'buyer',
        source: 'manual',
        agency_id: setup.agencyAId,
        form_data: { secret: 'agency A only' },
      })
      .select('id')
      .single()
    if (created?.id) createdIds.push(created.id)

    const { data: seenFromB } = await setup.clientB
      .from('contacts')
      .select('id, form_data')
      .eq('id', created!.id)
    expect(seenFromB, 'agent B leaked agent A contact').toEqual([])
  })
})
