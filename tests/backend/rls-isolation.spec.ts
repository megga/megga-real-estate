// THE compliance-critical test: verify that RLS policies isolate data between
// agencies. An agent of agency A must NEVER see contacts, deals, properties,
// etc. belonging to agency B. This is the cornerstone of Swiss LPD compliance
// (data tenancy isolation between professional users).
//
// Setup:
//   - 2 agencies (A, B), each with 1 agent + 1 contact
// Tests:
//   - Agent A sees their own contact, NOT agency B's
//   - Agent B sees their own contact, NOT agency A's
//   - Symmetry verified both ways
//
// If any of these tests fail, RLS is broken — production data could leak
// across tenants. Highest priority bug class.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'

describe.skipIf(!HAS_KEYS)('RLS isolation — agents only see their own agency data', () => {
  const STAMP = `${Date.now()}-${Math.floor(Math.random() * 10000)}`

  const EMAIL_A = `agent-a-${STAMP}@megga-test.local`
  const EMAIL_B = `agent-b-${STAMP}@megga-test.local`
  const PASSWORD = 'Test-Password-123!'

  let agencyAId: string
  let agencyBId: string
  let agentAId: string
  let agentBId: string
  let contactAId: string
  let contactBId: string

  let clientA: SupabaseClient
  let clientB: SupabaseClient

  beforeAll(async () => {
    const service = serviceRoleClient()

    // ── 1. Seed 2 agencies ────────────────────────────────────────────
    const { data: agencyA, error: errA } = await service
      .from('agencies')
      .insert({ name: `Agency A ${STAMP}`, slug: `agency-a-${STAMP}` })
      .select('id')
      .single()
    if (errA) throw new Error(`agencyA: ${errA.message}`)
    agencyAId = agencyA.id

    const { data: agencyB, error: errB } = await service
      .from('agencies')
      .insert({ name: `Agency B ${STAMP}`, slug: `agency-b-${STAMP}` })
      .select('id')
      .single()
    if (errB) throw new Error(`agencyB: ${errB.message}`)
    agencyBId = agencyB.id

    // ── 2. Seed 2 agents (1 per agency) ───────────────────────────────
    const { data: userA, error: userAErr } = await service.auth.admin.createUser({
      email: EMAIL_A,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: 'Agent A', role: 'agent' },
    })
    if (userAErr) throw new Error(`userA: ${userAErr.message}`)
    agentAId = userA.user!.id

    const { data: userB, error: userBErr } = await service.auth.admin.createUser({
      email: EMAIL_B,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: 'Agent B', role: 'agent' },
    })
    if (userBErr) throw new Error(`userB: ${userBErr.message}`)
    agentBId = userB.user!.id

    // ── 3. Attach agents to their agencies via profiles ───────────────
    const { error: profileAErr } = await service.from('profiles').upsert(
      {
        id: agentAId,
        email: EMAIL_A,
        full_name: 'Agent A',
        role: 'agent',
        agency_id: agencyAId,
      },
      { onConflict: 'id' }
    )
    if (profileAErr) throw new Error(`profileA: ${profileAErr.message}`)

    const { error: profileBErr } = await service.from('profiles').upsert(
      {
        id: agentBId,
        email: EMAIL_B,
        full_name: 'Agent B',
        role: 'agent',
        agency_id: agencyBId,
      },
      { onConflict: 'id' }
    )
    if (profileBErr) throw new Error(`profileB: ${profileBErr.message}`)

    // ── 4. Seed 2 contacts (1 per agency) ─────────────────────────────
    const { data: contactA, error: contactAErr } = await service
      .from('contacts')
      .insert({
        agency_id: agencyAId,
        first_name: 'Contact',
        last_name: `A-${STAMP}`,
        email: `contact-a-${STAMP}@example.local`,
        type: 'buyer',
      })
      .select('id')
      .single()
    if (contactAErr) throw new Error(`contactA: ${contactAErr.message}`)
    contactAId = contactA.id

    const { data: contactB, error: contactBErr } = await service
      .from('contacts')
      .insert({
        agency_id: agencyBId,
        first_name: 'Contact',
        last_name: `B-${STAMP}`,
        email: `contact-b-${STAMP}@example.local`,
        type: 'buyer',
      })
      .select('id')
      .single()
    if (contactBErr) throw new Error(`contactB: ${contactBErr.message}`)
    contactBId = contactB.id

    // ── 5. Sign in each agent ─────────────────────────────────────────
    clientA = createClient(URL, process.env.SUPABASE_TEST_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { error: signA } = await clientA.auth.signInWithPassword({
      email: EMAIL_A,
      password: PASSWORD,
    })
    if (signA) throw new Error(`signin A: ${signA.message}`)

    clientB = createClient(URL, process.env.SUPABASE_TEST_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { error: signB } = await clientB.auth.signInWithPassword({
      email: EMAIL_B,
      password: PASSWORD,
    })
    if (signB) throw new Error(`signin B: ${signB.message}`)
  })

  afterAll(async () => {
    const service = serviceRoleClient()
    // Deleting users cascades to profiles via FK. Contacts and agencies leak,
    // but a `supabase db reset` clears them between major test campaigns.
    if (agentAId) await service.auth.admin.deleteUser(agentAId)
    if (agentBId) await service.auth.admin.deleteUser(agentBId)
    // Clean up our seeded data explicitly
    if (contactAId) await service.from('contacts').delete().eq('id', contactAId)
    if (contactBId) await service.from('contacts').delete().eq('id', contactBId)
    if (agencyAId) await service.from('agencies').delete().eq('id', agencyAId)
    if (agencyBId) await service.from('agencies').delete().eq('id', agencyBId)
  })

  // ─── Symmetric tests for both directions ──────────────────────────────

  it('agent A can SELECT their own contact', async () => {
    const { data, error } = await clientA
      .from('contacts')
      .select('id')
      .eq('id', contactAId)
    expect(error, `query error: ${error?.message}`).toBeNull()
    expect(data).toHaveLength(1)
    expect(data![0].id).toBe(contactAId)
  })

  it('agent A CANNOT see agency B\'s contact (RLS blocks)', async () => {
    const { data, error } = await clientA
      .from('contacts')
      .select('id')
      .eq('id', contactBId)
    // RLS filters silently — no error, just an empty result.
    expect(error, `query error: ${error?.message}`).toBeNull()
    expect(data, `agent A leaked agency B contact ${contactBId}`).toEqual([])
  })

  it('agent B can SELECT their own contact', async () => {
    const { data, error } = await clientB
      .from('contacts')
      .select('id')
      .eq('id', contactBId)
    expect(error, `query error: ${error?.message}`).toBeNull()
    expect(data).toHaveLength(1)
    expect(data![0].id).toBe(contactBId)
  })

  it('agent B CANNOT see agency A\'s contact (RLS blocks)', async () => {
    const { data, error } = await clientB
      .from('contacts')
      .select('id')
      .eq('id', contactAId)
    expect(error, `query error: ${error?.message}`).toBeNull()
    expect(data, `agent B leaked agency A contact ${contactAId}`).toEqual([])
  })

  it('agent A list query never returns rows from agency B', async () => {
    // Broader assertion: any unfiltered list query must never leak cross-agency.
    const { data, error } = await clientA
      .from('contacts')
      .select('id, agency_id')
      .limit(100)
    expect(error, `query error: ${error?.message}`).toBeNull()
    const leakedRows = (data ?? []).filter(c => c.agency_id !== agencyAId)
    expect(
      leakedRows,
      `agent A saw ${leakedRows.length} rows from other agencies: ${JSON.stringify(leakedRows.slice(0, 3))}`
    ).toEqual([])
  })

  it('agent B list query never returns rows from agency A', async () => {
    const { data, error } = await clientB
      .from('contacts')
      .select('id, agency_id')
      .limit(100)
    expect(error, `query error: ${error?.message}`).toBeNull()
    const leakedRows = (data ?? []).filter(c => c.agency_id !== agencyBId)
    expect(
      leakedRows,
      `agent B saw ${leakedRows.length} rows from other agencies: ${JSON.stringify(leakedRows.slice(0, 3))}`
    ).toEqual([])
  })
})
