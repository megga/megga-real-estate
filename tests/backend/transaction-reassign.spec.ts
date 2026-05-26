// Regression — reassigning a deal to another agent (transactions.assigned_to).
// The "Réassigner" menu item on Pipeline kanban cards used to alert.
// Now it opens a picker and updates the column via the agency-scoped
// transactions_update RLS policy (added in #434).
//
// This test asserts:
//   - agent A can reassign their own deal to agent A2 (same agency)
//   - agent B's reassign attempt on agent A's deal silently no-ops (RLS)

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('regression — transactions reassign (assigned_to)', () => {
  let setup: TwoAgenciesSetup
  let dealAId: string
  let agentA2Id: string

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const svc = serviceRoleClient()

    // Seed a deal in agency A, owned by agent A initially.
    const { data: deal, error: dealErr } = await svc
      .from('transactions')
      .insert({
        agency_id: setup.agencyAId,
        stage: 'active_search',
        assigned_to: setup.agentAId,
      })
      .select('id')
      .single()
    if (dealErr) throw new Error(`deal: ${dealErr.message}`)
    dealAId = deal.id

    // Seed a SECOND agent in agency A (the picker would list this person).
    const stamp = setup.stamp
    const { data: a2, error: a2Err } = await svc.auth.admin.createUser({
      email: `agent-a2-${stamp}@megga-test.local`,
      password: 'Test-Password-123!',
      email_confirm: true,
    })
    if (a2Err) throw new Error(`agent A2: ${a2Err.message}`)
    agentA2Id = a2.user!.id
    await svc.from('profiles').upsert(
      { id: agentA2Id, email: `agent-a2-${stamp}@megga-test.local`, full_name: 'Agent A2', role: 'agent', agency_id: setup.agencyAId },
      { onConflict: 'id' }
    )
  })

  afterAll(async () => {
    const svc = serviceRoleClient()
    if (dealAId) await svc.from('transactions').delete().eq('id', dealAId).then(() => {}, () => {})
    if (agentA2Id) await svc.auth.admin.deleteUser(agentA2Id).catch(() => {})
    await setup.cleanup()
  })

  it('agent A can reassign their own deal to a teammate (agent A2)', async () => {
    const { error } = await setup.clientA
      .from('transactions')
      .update({ assigned_to: agentA2Id })
      .eq('id', dealAId)
    expect(error).toBeNull()

    // Verify via service role (bypasses RLS) that the change persisted.
    const svc = serviceRoleClient()
    const { data: row } = await svc
      .from('transactions')
      .select('assigned_to')
      .eq('id', dealAId)
      .single()
    expect(row?.assigned_to).toBe(agentA2Id)
  })

  it('agent B CANNOT reassign agent A\'s deal (RLS isolation)', async () => {
    const { data: returned } = await setup.clientB
      .from('transactions')
      .update({ assigned_to: setup.agentBId })
      .eq('id', dealAId)
      .select('id')
    // RLS hides the row from agent B → update affects 0 rows.
    expect(returned, `agent B leaked update to agency A deal`).toEqual([])

    // Sanity: assigned_to didn't flip.
    const svc = serviceRoleClient()
    const { data: row } = await svc
      .from('transactions')
      .select('assigned_to')
      .eq('id', dealAId)
      .single()
    expect(row?.assigned_to).toBe(agentA2Id)
  })
})
