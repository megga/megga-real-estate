// First backend integration test — verifies the local Supabase instance is
// reachable and that the anon client can query a public marketplace view.
// If this fails, the rest of the backend suite won't make sense — that's why
// it lives in its own file with a descriptive name.

import { describe, it, expect, beforeAll } from 'vitest'
import { anonClient, serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('backend smoke — local Supabase is reachable', () => {
  beforeAll(() => {
    // Visible reminder if the run is gated — easier than digging in skip logs.
    if (!HAS_KEYS) {
      // eslint-disable-next-line no-console
      console.log('[backend smoke] skipped: SUPABASE_TEST_*_KEY env vars not set. Run `supabase status` and fill .env.test.local.')
    }
  })


  it('anon client can SELECT from market_listings (no RLS-sensitive columns)', async () => {
    const supabase = anonClient()
    const { data, error } = await supabase
      .from('market_listings')
      .select('id')
      .limit(1)

    expect(error, `query error: ${error?.message ?? 'none'}`).toBeNull()
    expect(Array.isArray(data)).toBe(true)
  })

  it('service-role client can list tables via SQL', async () => {
    const supabase = serviceRoleClient()
    // information_schema is always readable with service_role.
    const { data, error } = await supabase
      .rpc('version')
      .single()
      .throwOnError()
    // version() is a Postgres built-in; if Supabase isn't up, this throws.
    expect(error).toBeNull()
    expect(data).toBeDefined()
  })
})
