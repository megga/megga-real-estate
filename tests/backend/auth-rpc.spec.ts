// Backend test — authenticated RPC behavior.
//
// Demonstrates the full pattern for testing as an authenticated user:
//   1. service_role : seed an agency + create a user via auth.admin
//   2. user client  : sign in with the user's credentials
//   3. assert       : RPC called as user returns expected data
//   4. cleanup      : delete the user (cascades profile via FK)
//
// This pattern unblocks all future RLS tests that need a real authenticated
// session (e.g. "agent can read contacts of their own agency but not others").

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'

describe.skipIf(!HAS_KEYS)('authenticated RPC — get_user_agency_id', () => {
  // Unique per run to avoid clashes on reruns without DB reset.
  const TEST_EMAIL = `test-agent-${Date.now()}@megga-test.local`
  const TEST_PASSWORD = 'Test-Password-123!'
  const TEST_AGENCY_NAME = `Test Agency ${Date.now()}`

  let userId: string
  let agencyId: string
  let userClient: SupabaseClient

  beforeAll(async () => {
    const service = serviceRoleClient()

    // 1. Create an agency (slug is required NOT NULL)
    const { data: agencyData, error: agencyErr } = await service
      .from('agencies')
      .insert({
        name: TEST_AGENCY_NAME,
        slug: `test-agency-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      })
      .select('id')
      .single()
    if (agencyErr) throw new Error(`Failed to create agency: ${agencyErr.message}`)
    agencyId = agencyData.id

    // 2. Create a user via auth.admin (Supabase admin API)
    const { data: userData, error: userErr } = await service.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: 'Test Agent', role: 'agent' },
    })
    if (userErr) throw new Error(`Failed to create user: ${userErr.message}`)
    userId = userData.user!.id

    // 3. Attach the user to the agency via the profile row.
    // The handle_new_user trigger should have auto-created the profile;
    // we just set its agency_id. If the trigger didn't fire (schema drift),
    // upsert covers both cases.
    const { error: profileErr } = await service
      .from('profiles')
      .upsert(
        {
          id: userId,
          email: TEST_EMAIL,
          full_name: 'Test Agent',
          role: 'agent',
          agency_id: agencyId,
        },
        { onConflict: 'id' }
      )
    if (profileErr) throw new Error(`Failed to upsert profile: ${profileErr.message}`)

    // 4. Sign in as the user to get an authenticated client
    userClient = createClient(URL, process.env.SUPABASE_TEST_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { error: signInErr } = await userClient.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    })
    if (signInErr) throw new Error(`Failed to sign in: ${signInErr.message}`)
  })

  afterAll(async () => {
    if (!userId) return
    const service = serviceRoleClient()
    // Delete the user — cascades the profile via ON DELETE CASCADE.
    // (Agency leak is acceptable for now — adds a few rows over many test runs;
    // a DB reset wipes them all.)
    await service.auth.admin.deleteUser(userId)
  })

  it('returns the agency_id of the authenticated agent', async () => {
    const { data, error } = await userClient.rpc('get_user_agency_id')

    expect(error, `RPC error: ${error?.message}`).toBeNull()
    expect(data, 'RPC should return the agency_id of the signed-in user').toBe(agencyId)
  })
})
