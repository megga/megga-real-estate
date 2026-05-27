// Regression — DocumentsSugarV2Page handleCreateDoc (real insert + RLS).
// Wired in PR audit Calendar/Documents/Parcours: was a silent toast before,
// now writes a row to `documents` with the agent's own auth client.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('regression — documents insert via agent auth client', () => {
  let setup: TwoAgenciesSetup
  let txAId: string
  let insertedDocId: string | null = null

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const svc = serviceRoleClient()

    // Seed a transaction in agency A — that's the "folder" the agent uploads into.
    const { data: tx, error: txErr } = await svc
      .from('transactions')
      .insert({ agency_id: setup.agencyAId, stage: 'active_search' })
      .select('id')
      .single()
    if (txErr) throw new Error(`tx: ${txErr.message}`)
    txAId = tx.id
  })

  afterAll(async () => {
    const svc = serviceRoleClient()
    if (insertedDocId) await svc.from('documents').delete().eq('id', insertedDocId).then(() => {}, () => {})
    if (txAId) await svc.from('transactions').delete().eq('id', txAId).then(() => {}, () => {})
    await setup.cleanup()
  })

  it('agent A inserts a document into their own transaction (mirrors page upload flow)', async () => {
    const { data, error } = await setup.clientA
      .from('documents')
      .insert({
        agency_id: setup.agencyAId,
        transaction_id: txAId,
        name: `Test upload ${setup.stamp}`,
        type: 'import',
        storage_path: `${setup.agencyAId}/${txAId}/${setup.stamp}-test.pdf`,
        size_bytes: 4096,
        status: 'pending',
      })
      .select('id')
      .single()

    expect(error, `agent A insert blocked: ${error?.message}`).toBeNull()
    expect(data?.id).toBeTruthy()
    insertedDocId = data!.id
  })

  it('agent B CANNOT insert a document with agency A id (RLS isolation)', async () => {
    const { data, error } = await setup.clientB
      .from('documents')
      .insert({
        agency_id: setup.agencyAId, // <-- cross-tenant attempt
        transaction_id: txAId,
        name: `Leak attempt ${setup.stamp}`,
        type: 'import',
        storage_path: `leak/${setup.stamp}.pdf`,
        size_bytes: 1,
        status: 'pending',
      })
      .select('id')

    // RLS: either an explicit error OR an empty returned set (depends on policy shape).
    const blocked = !!error || (data?.length ?? 0) === 0
    expect(blocked, `agent B leaked a write to agency A documents`).toBe(true)
  })
})
