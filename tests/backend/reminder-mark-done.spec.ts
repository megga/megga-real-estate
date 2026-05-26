// Regression — "Marquer fait" on DealDetailDrawer next-action card.
// The button used to have no onClick. PR #443 wires it via
// useReminders.markAsDone(id) which updates `reminders.status='done'`
// and stamps completed_at. This test asserts the mutation is RLS-scoped
// (agent A can flip own-agency reminders, agent B cannot).

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('regression — reminders.markAsDone (Marquer fait)', () => {
  let setup: TwoAgenciesSetup
  let reminderAId: string
  let contactAId: string

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const svc = serviceRoleClient()

    // A contact in agency A — reminders need a contact_id (NOT NULL).
    const { data: contact, error: cErr } = await svc
      .from('contacts')
      .insert({
        agency_id: setup.agencyAId,
        first_name: 'Sample',
        last_name: `Reminder ${setup.stamp}`,
        email: `reminder-${setup.stamp}@megga-test.local`,
        entity_type: 'pp',
        type: 'buyer',
        source: 'manual',
      })
      .select('id')
      .single()
    if (cErr) throw new Error(`contact: ${cErr.message}`)
    contactAId = contact.id

    // Seed a pending reminder in agency A.
    const { data: rem, error: rErr } = await svc
      .from('reminders')
      .insert({
        agency_id: setup.agencyAId,
        contact_id: contactAId,
        type: 'custom',
        status: 'pending',
        trigger_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        trigger_rule: 'manual', // NOT NULL — manual reminders set by the agent
      })
      .select('id')
      .single()
    if (rErr) throw new Error(`reminder: ${rErr.message}`)
    reminderAId = rem.id
  })

  afterAll(async () => {
    const svc = serviceRoleClient()
    if (reminderAId) await svc.from('reminders').delete().eq('id', reminderAId).then(() => {}, () => {})
    if (contactAId) await svc.from('contacts').delete().eq('id', contactAId).then(() => {}, () => {})
    await setup.cleanup()
  })

  it('agent A marks their own reminder as done (status=done + completed_at)', async () => {
    const completedAt = new Date().toISOString()
    const { error } = await setup.clientA
      .from('reminders')
      .update({ status: 'done', completed_at: completedAt })
      .eq('id', reminderAId)
    expect(error).toBeNull()

    const svc = serviceRoleClient()
    const { data: row } = await svc
      .from('reminders')
      .select('status, completed_at')
      .eq('id', reminderAId)
      .single()
    expect(row?.status).toBe('done')
    expect(row?.completed_at).toBeTruthy()
  })

  it('agent B CANNOT mark agency A reminder as done (RLS isolation)', async () => {
    // Reset to pending via service_role so we can verify B's attempt no-ops.
    const svc = serviceRoleClient()
    await svc.from('reminders').update({ status: 'pending', completed_at: null }).eq('id', reminderAId)

    const { data: returned } = await setup.clientB
      .from('reminders')
      .update({ status: 'done', completed_at: new Date().toISOString() })
      .eq('id', reminderAId)
      .select('id')
    expect(returned, `agent B leaked update to agency A reminder`).toEqual([])

    const { data: row } = await svc
      .from('reminders')
      .select('status, completed_at')
      .eq('id', reminderAId)
      .single()
    expect(row?.status).toBe('pending')
    expect(row?.completed_at).toBeNull()
  })
})
