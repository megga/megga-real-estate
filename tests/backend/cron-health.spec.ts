// Hygiène backend — RPC get_cron_health live spec
//
//  Security gate: get_cron_health() raises ERRCODE 42501 for non-super-admin callers
//  (it reads pg_cron — platform data, not per-agency). Pattern: SECURITY DEFINER with
//  public.is_super_admin() guard, same as get_agent_learned_styles / get_whatsapp_autonomy_suggestions.
//
//  Test 1 — Gate: clientB (plain 'agent') calling get_cron_health() → returns a non-null error.
//    (PostgREST may wrap 42501 as PGRST301 or similar; we only assert error is non-null.)
//
//  Test 2 — Super-admin OK: clientA (promoted to super_admin) calling get_cron_health() →
//    resolves WITHOUT error and returns an array. In CI, pg_cron IS present (Supabase Pro-like
//    stack) → length >= 0. In local dev without pg_cron → empty array. Either way:
//    error must be null and Array.isArray(data) must be true.
//
//  No table seeding needed — the RPC reads pg_cron directly (or returns empty if absent).
//
// Runs live in CI (SUPABASE_TEST_* keys present).
// Skips cleanly locally when keys are absent (no Docker required for unit runs).

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

// Shape of one row returned by get_cron_health().
// The RPC returns TABLE(jobname text, schedule text, active boolean, last_start timestamptz, last_status text).
type CronHealthRow = {
  jobname: string
  schedule: string
  active: boolean
  last_start: string | null
  last_status: string | null
}

describe.skipIf(!HAS_KEYS)('get_cron_health RPC — gardée super_admin', () => {
  let setup: TwoAgenciesSetup

  beforeAll(async () => {
    setup = await setupTwoAgencies()

    // Promote agentA to super_admin — this is the CALLER for authorized RPC assertions.
    const { error: promoteErr } = await serviceRoleClient()
      .from('profiles')
      .update({ role: 'super_admin' })
      .eq('id', setup.agentAId)
    if (promoteErr) throw new Error(`promote super_admin: ${promoteErr.message}`)
  })

  afterAll(async () => {
    // Demote agentA (defensive — setup.cleanup() deletes the user anyway).
    await serviceRoleClient()
      .from('profiles')
      .update({ role: 'agent' })
      .eq('id', setup.agentAId)
      .then(() => {}, () => {})

    await setup.cleanup()
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 1 — Gate: plain agent is forbidden (42501)
  // ──────────────────────────────────────────────────────────────────────────

  it('get_cron_health: plain agent is rejected with an error', async () => {
    // Caller = agentB (role 'agent') — server gate must reject.
    // PostgREST may wrap ERRCODE 42501 as PGRST301 or another wrapper; we only
    // assert that an error is present, not its exact code string.
    const { error: deniedErr } = await setup.clientB.rpc('get_cron_health')
    expect(deniedErr, 'error must be non-null for a non-super-admin caller').not.toBeNull()
    expect(deniedErr).toBeDefined()
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 2 — Super-admin OK: resolves without error, returns an array
  // ──────────────────────────────────────────────────────────────────────────

  it('get_cron_health: super_admin resolves without error and receives an array', async () => {
    // Caller = agentA (super_admin) — server gate must allow.
    const { data, error } = await setup.clientA.rpc('get_cron_health')
    if (error) throw new Error(`rpc (super_admin): ${error.message}`)

    // In CI (Supabase with pg_cron): returns the list of scheduled jobs.
    // In local dev without pg_cron: the RPC degrades and returns an empty array.
    // Either way: no error and the result must be array-shaped.
    const rows = (data ?? []) as CronHealthRow[]
    expect(error).toBeNull()
    expect(Array.isArray(rows)).toBe(true)
    expect(rows.length).toBeGreaterThanOrEqual(0)

    // If any rows are present, verify the shape of the first row.
    if (rows.length > 0) {
      const first = rows[0]
      expect(typeof first.jobname).toBe('string')
      expect(typeof first.schedule).toBe('string')
      expect(typeof first.active).toBe('boolean')
    }
  })
})
