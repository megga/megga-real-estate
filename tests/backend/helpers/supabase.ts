// Shared Supabase clients for backend integration tests.
//
// Two flavours:
//   - anonClient()        — anon key, hits RLS like a public visitor
//   - serviceRoleClient() — bypasses RLS, for seeding & teardown
//
// Both target the LOCAL Supabase instance (from `supabase start`), never prod.
// Hard-failing if URL points anywhere but localhost is a safety net to avoid
// accidentally hitting production data.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'
const ANON = process.env.SUPABASE_TEST_ANON_KEY
const SERVICE = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY

function assertLocal(url: string): void {
  if (!url.startsWith('http://127.0.0.1') && !url.startsWith('http://localhost')) {
    throw new Error(
      `[backend tests] refusing to connect to non-local URL: ${url}. ` +
      `Backend tests must hit a local Supabase instance only. ` +
      `Run \`supabase start\` and set SUPABASE_TEST_URL=http://127.0.0.1:54321.`
    )
  }
}

export function anonClient(): SupabaseClient {
  assertLocal(URL)
  if (!ANON) {
    throw new Error(
      '[backend tests] SUPABASE_TEST_ANON_KEY is not set. ' +
      'Run `supabase status` to get the local anon key.'
    )
  }
  return createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function serviceRoleClient(): SupabaseClient {
  assertLocal(URL)
  if (!SERVICE) {
    throw new Error(
      '[backend tests] SUPABASE_TEST_SERVICE_ROLE_KEY is not set. ' +
      'Run `supabase status` to get the local service_role key.'
    )
  }
  return createClient(URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
