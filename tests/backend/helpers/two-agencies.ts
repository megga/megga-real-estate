// Shared seed helper for RLS isolation tests across all multi-tenant tables.
// Creates 2 agencies + 2 authenticated agents, returns clients + cleanup fn.
// Each test file calls setupTwoAgencies() in beforeAll and setup.cleanup()
// in afterAll, then seeds its own table rows between.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { serviceRoleClient } from './supabase'

const URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'
const ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY ?? ''
const PASSWORD = 'Test-Password-123!'

export interface TwoAgenciesSetup {
  /** Unique per setup() call — use in slugs/emails/values to avoid clashes */
  stamp: string
  agencyAId: string
  agencyBId: string
  agentAId: string
  agentBId: string
  /** Authenticated Supabase client for agent A */
  clientA: SupabaseClient
  /** Authenticated Supabase client for agent B */
  clientB: SupabaseClient
  /** Tears down users + agencies (rows seeded by callers must be cleaned by them) */
  cleanup: () => Promise<void>
}

export async function setupTwoAgencies(): Promise<TwoAgenciesSetup> {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
  const emailA = `agent-a-${stamp}@megga-test.local`
  const emailB = `agent-b-${stamp}@megga-test.local`
  const service = serviceRoleClient()

  // Allowlist super-admin (migration 20260705160000) : les specs promeuvent des
  // users @megga-test.local en super_admin. La clé super_admin_test_domain
  // (écrivable par service_role seulement ; domaine .local non routable) fait
  // passer ces comptes par super_admin_allowlist_match. Idempotent, jamais
  // nettoyée (partagée entre fichiers de specs qui tournent en parallèle).
  const { error: cfgErr } = await service
    .from('app_config')
    .upsert({ key: 'super_admin_test_domain', value: '@megga-test.local' }, { onConflict: 'key' })
  if (cfgErr) throw new Error(`app_config super_admin_test_domain: ${cfgErr.message}`)

  // 2 agencies
  const { data: agencyA, error: errA } = await service
    .from('agencies')
    .insert({ name: `Agency A ${stamp}`, slug: `agency-a-${stamp}` })
    .select('id')
    .single()
  if (errA) throw new Error(`agencyA: ${errA.message}`)

  const { data: agencyB, error: errB } = await service
    .from('agencies')
    .insert({ name: `Agency B ${stamp}`, slug: `agency-b-${stamp}` })
    .select('id')
    .single()
  if (errB) throw new Error(`agencyB: ${errB.message}`)

  // 2 users via auth.admin
  const { data: userA, error: userAErr } = await service.auth.admin.createUser({
    email: emailA,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: 'Agent A', role: 'agent' },
  })
  if (userAErr) throw new Error(`userA: ${userAErr.message}`)

  const { data: userB, error: userBErr } = await service.auth.admin.createUser({
    email: emailB,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: 'Agent B', role: 'agent' },
  })
  if (userBErr) throw new Error(`userB: ${userBErr.message}`)

  // Attach to agencies
  const profileUpsert = async (id: string, email: string, full_name: string, agency_id: string) => {
    const { error } = await service
      .from('profiles')
      .upsert({ id, email, full_name, role: 'agent', agency_id }, { onConflict: 'id' })
    if (error) throw new Error(`profile ${email}: ${error.message}`)
  }
  await profileUpsert(userA.user!.id, emailA, 'Agent A', agencyA.id)
  await profileUpsert(userB.user!.id, emailB, 'Agent B', agencyB.id)

  // Sign in each
  const signIn = async (email: string): Promise<SupabaseClient> => {
    const client = createClient(URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD })
    if (error) throw new Error(`signin ${email}: ${error.message}`)
    return client
  }
  const clientA = await signIn(emailA)
  const clientB = await signIn(emailB)

  return {
    stamp,
    agencyAId: agencyA.id,
    agencyBId: agencyB.id,
    agentAId: userA.user!.id,
    agentBId: userB.user!.id,
    clientA,
    clientB,
    cleanup: async () => {
      const svc = serviceRoleClient()
      await svc.auth.admin.deleteUser(userA.user!.id).catch(() => {})
      await svc.auth.admin.deleteUser(userB.user!.id).catch(() => {})
      await svc.from('agencies').delete().eq('id', agencyA.id).then(() => {}, () => {})
      await svc.from('agencies').delete().eq('id', agencyB.id).then(() => {}, () => {})
    },
  }
}

/**
 * Helper to assert that an authenticated client only sees rows from their
 * own agency, given a table that has an `agency_id` column.
 * Returns the list of leaked rows (should be empty).
 */
export async function findLeakedRows(
  client: SupabaseClient,
  table: string,
  ownAgencyId: string,
  limit = 100
): Promise<Array<{ id: string; agency_id: string | null }>> {
  const { data, error } = await client
    .from(table)
    .select('id, agency_id')
    .limit(limit)
  if (error) throw new Error(`list ${table}: ${error.message}`)
  return (data ?? []).filter(row => row.agency_id !== ownAgencyId) as Array<{ id: string; agency_id: string | null }>
}
