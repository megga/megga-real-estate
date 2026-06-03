// Apprentissage T1 — RPC get_agent_learned_styles / set_agent_learned_style live spec
//
//  Security gate: both RPCs raise ERRCODE 42501 for non-super-admin callers (they expose
//  per-agent, CROSS-AGENCE learned-style data, and activation injects the style into the
//  target agent's WhatsApp prompt). Same pattern as get_whatsapp_autonomy_suggestions (P3b).
//  Spec calls via clientA (promoted to super_admin); agentB is the SUBJECT agent.
//
//  agent_ai_profiles is RLS-protected and only service_role writes the seed row, so the
//  learned_style fixture is inserted via serviceRoleClient().
//
//  Test 1 — RPC guarded (read): clientA (super_admin) sees agentB's seeded row;
//    clientB (plain 'agent') gets the 42501 forbidden error.
//
//  Test 2 — Activation (write): clientA → set_agent_learned_style(agentB, 'active') flips
//    learned_style.status to 'active' (verified via serviceRoleClient); clientB is rejected.
//
//  Conditional injection (the style block is appended to the whatsapp-agent prompt ONLY when
//  status==='active', and degrades to '' otherwise) is covered by the formatStyleBlock unit
//  test — see supabase/functions/_shared/agent-style.test.ts (Task 2). Not duplicated here.
//
// Runs live in CI (SUPABASE_TEST_* keys present).
// Skips cleanly locally when keys are absent (no Docker required for unit runs).

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

// Shape of one row returned by get_agent_learned_styles().
type LearnedStyleRow = {
  agent_id: string
  agent_name: string | null
  agency_id: string | null
  learned_style: { status?: string; traits?: string } | null
}

describe.skipIf(!HAS_KEYS)('agent learned-style RPC — gardée super_admin + activation', () => {
  let setup: TwoAgenciesSetup

  beforeAll(async () => {
    setup = await setupTwoAgencies()

    // Promote agentA to super_admin — this is the CALLER for all authorized RPC assertions.
    const { error: promoteErr } = await serviceRoleClient()
      .from('profiles')
      .update({ role: 'super_admin' })
      .eq('id', setup.agentAId)
    if (promoteErr) throw new Error(`promote super_admin: ${promoteErr.message}`)

    // Seed agentB's agent_ai_profiles row with a 'suggested' learned_style (agentB is the
    // SUBJECT agent). RLS-protected table → only service_role writes. The cron would normally
    // distill this; here we seed it directly so the super-admin can review/activate it.
    const { error: seedErr } = await serviceRoleClient()
      .from('agent_ai_profiles')
      .upsert(
        {
          agent_id: setup.agentBId,
          agency_id: setup.agencyBId,
          learned_style: {
            language: 'fr',
            formality: 'vous',
            emoji: false,
            traits: 'phrases courtes, ton chaleureux',
            status: 'suggested',
            updated_at: new Date().toISOString(),
            sample_count: 12,
          },
        },
        { onConflict: 'agent_id' },
      )
    if (seedErr) throw new Error(`seed agent_ai_profiles(agentB): ${seedErr.message}`)
  })

  afterAll(async () => {
    // Remove the seeded agent_ai_profiles row for agentB before tearing down users/agencies.
    // (The agencies/users cascade is handled by setup.cleanup().)
    await serviceRoleClient()
      .from('agent_ai_profiles')
      .delete()
      .eq('agent_id', setup.agentBId)
      .then(() => {}, () => {})

    // Demote agentA (defensive — setup.cleanup() deletes the user anyway).
    await serviceRoleClient()
      .from('profiles')
      .update({ role: 'agent' })
      .eq('id', setup.agentAId)
      .then(() => {}, () => {})

    await setup.cleanup()
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 1 — get RPC: super_admin reads the row, plain agent is forbidden (42501)
  // ──────────────────────────────────────────────────────────────────────────

  it('get_agent_learned_styles: super_admin sees agentB; plain agent is rejected', async () => {
    // Caller = agentA (super_admin) — server gate must allow.
    const { data, error } = await setup.clientA.rpc('get_agent_learned_styles')
    if (error) throw new Error(`rpc (super_admin): ${error.message}`)

    const rows = (data ?? []) as LearnedStyleRow[]
    const row = rows.find((r) => r.agent_id === setup.agentBId)
    expect(row, 'agentB learned-style row must be visible to the super_admin').toBeDefined()
    expect(row?.learned_style?.status).toBe('suggested')

    // Caller = agentB (role 'agent') — server gate must reject with ERRCODE 42501.
    const { error: deniedErr } = await setup.clientB.rpc('get_agent_learned_styles')
    expect(deniedErr, 'error must be non-null for a non-super-admin caller').not.toBeNull()
    expect(deniedErr).toBeDefined()
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 2 — set RPC: super_admin activates the style; plain agent is forbidden (42501)
  // ──────────────────────────────────────────────────────────────────────────

  it('set_agent_learned_style: super_admin activates agentB; plain agent is rejected', async () => {
    // Caller = agentA (super_admin) → activation succeeds.
    const { error } = await setup.clientA.rpc('set_agent_learned_style', {
      p_agent_id: setup.agentBId,
      p_status: 'active',
    })
    if (error) throw new Error(`rpc set (super_admin): ${error.message}`)

    // Verify the status flipped to 'active' via service_role (bypasses RLS).
    const { data: after, error: readErr } = await serviceRoleClient()
      .from('agent_ai_profiles')
      .select('learned_style')
      .eq('agent_id', setup.agentBId)
      .single()
    if (readErr) throw new Error(`re-read agent_ai_profiles: ${readErr.message}`)
    const learned = (after?.learned_style ?? null) as { status?: string } | null
    expect(learned?.status, 'status must become active after the super_admin activates it').toBe('active')

    // Caller = agentB (role 'agent') → activation rejected with ERRCODE 42501.
    const { error: deniedErr } = await setup.clientB.rpc('set_agent_learned_style', {
      p_agent_id: setup.agentBId,
      p_status: 'off',
    })
    expect(deniedErr, 'error must be non-null for a non-super-admin caller').not.toBeNull()
    expect(deniedErr).toBeDefined()

    // And the plain agent's rejected call must NOT have mutated the row (still 'active').
    const { data: stillActive } = await serviceRoleClient()
      .from('agent_ai_profiles')
      .select('learned_style')
      .eq('agent_id', setup.agentBId)
      .single()
    const unchanged = (stillActive?.learned_style ?? null) as { status?: string } | null
    expect(unchanged?.status, 'a rejected non-admin call must not change the status').toBe('active')
  })
})
