// Regression — `documents.contact_id` query used by ContactDetailPage.
//
// The page was flagged with a chip "documents.contact_id investigation" back
// when the column had been silently dropped from the local baseline
// (relative to prod). Migration 20260526120000_restore_missing_columns.sql
// restored the column. This test exercises the exact query the page runs so
// we'd catch any future regression before it ships.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('regression — documents.contact_id query', () => {
  let setup: TwoAgenciesSetup
  let contactAId: string
  let contactBId: string
  let docAId: string
  let docBId: string
  let docNoContactId: string

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const service = serviceRoleClient()

    // 1 contact per agency
    const { data: contactA, error: cAErr } = await service
      .from('contacts')
      .insert({
        agency_id: setup.agencyAId,
        first_name: 'Alice',
        last_name: `Doc ${setup.stamp}`,
        email: `alice-${setup.stamp}@megga-test.local`,
        entity_type: 'pp',
        type: 'buyer',
        source: 'manual',
      })
      .select('id')
      .single()
    if (cAErr) throw new Error(`contactA: ${cAErr.message}`)
    contactAId = contactA.id

    const { data: contactB, error: cBErr } = await service
      .from('contacts')
      .insert({
        agency_id: setup.agencyBId,
        first_name: 'Bob',
        last_name: `Doc ${setup.stamp}`,
        email: `bob-${setup.stamp}@megga-test.local`,
        entity_type: 'pp',
        type: 'buyer',
        source: 'manual',
      })
      .select('id')
      .single()
    if (cBErr) throw new Error(`contactB: ${cBErr.message}`)
    contactBId = contactB.id

    // 1 doc attached to each contact + 1 doc with no contact (control)
    const { data: docA, error: dAErr } = await service
      .from('documents')
      .insert({
        agency_id: setup.agencyAId,
        contact_id: contactAId,
        name: 'Alice-passport.pdf',
        size_bytes: 12345,
        storage_path: `agency-${setup.agencyAId}/alice-passport.pdf`,
        type: 'identity',
        status: 'available',
      })
      .select('id')
      .single()
    if (dAErr) throw new Error(`docA: ${dAErr.message}`)
    docAId = docA.id

    const { data: docB, error: dBErr } = await service
      .from('documents')
      .insert({
        agency_id: setup.agencyBId,
        contact_id: contactBId,
        name: 'Bob-passport.pdf',
        size_bytes: 23456,
        storage_path: `agency-${setup.agencyBId}/bob-passport.pdf`,
        type: 'identity',
        status: 'available',
      })
      .select('id')
      .single()
    if (dBErr) throw new Error(`docB: ${dBErr.message}`)
    docBId = docB.id

    const { data: docNone, error: dNErr } = await service
      .from('documents')
      .insert({
        agency_id: setup.agencyAId,
        contact_id: null,
        name: 'orphan.pdf',
        size_bytes: 999,
        storage_path: `agency-${setup.agencyAId}/orphan.pdf`,
        type: 'identity',
        status: 'available',
      })
      .select('id')
      .single()
    if (dNErr) throw new Error(`docNone: ${dNErr.message}`)
    docNoContactId = docNone.id
  })

  afterAll(async () => {
    const svc = serviceRoleClient()
    for (const id of [docAId, docBId, docNoContactId]) {
      if (id) await svc.from('documents').delete().eq('id', id).then(() => {}, () => {})
    }
    for (const id of [contactAId, contactBId]) {
      if (id) await svc.from('contacts').delete().eq('id', id).then(() => {}, () => {})
    }
    await setup.cleanup()
  })

  it('agent A sees document attached to contact A via .eq("contact_id", id)', async () => {
    // Exact shape of the query in src/pages/agent/ContactDetailPage.tsx
    const { data, error } = await setup.clientA
      .from('documents')
      .select('id, name, created_at')
      .eq('contact_id', contactAId)
      .order('created_at', { ascending: false })
      .limit(20)
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(data?.[0]?.id).toBe(docAId)
    expect(data?.[0]?.name).toBe('Alice-passport.pdf')
  })

  it('agent A CANNOT see contact B documents (RLS isolation)', async () => {
    const { data, error } = await setup.clientA
      .from('documents')
      .select('id')
      .eq('contact_id', contactBId)
    expect(error).toBeNull()
    expect(data, `agent A leaked agency B doc`).toEqual([])
  })

  it('document with null contact_id is not returned by the page query', async () => {
    // The page query specifically filters on a non-null id — the orphan must
    // never appear in any contact's document list.
    const { data, error } = await setup.clientA
      .from('documents')
      .select('id')
      .eq('contact_id', contactAId)
    expect(error).toBeNull()
    expect(data?.find(d => d.id === docNoContactId)).toBeUndefined()
  })
})
