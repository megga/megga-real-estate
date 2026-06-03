// Palier 3b — RPC get_whatsapp_autonomy_suggestions live spec
//
//  Three proofs against a live Supabase:
//
//  Test 1 — 10 yes / 0 no on update_pipeline → suggest_resume = true
//    Proves the aggregation and the suggestion gate fire for the sole elevable tool.
//
//  Test 2 — a single 'no' kills the suggestion
//    Proves that even one rejection resets suggest_resume to false (conservatism by design).
//
//  Test 3 — legal foundation (send_client_message) NEVER suggested
//    Proves the immutability constraint: 10 yes / 0 no on a legal-foundation tool still
//    yields suggest_resume = false. The socle légal cannot become autonomous.
//
// Runs live in CI (SUPABASE_TEST_* keys present).
// Skips cleanly locally when keys are absent (no Docker required for unit runs).

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('get_whatsapp_autonomy_suggestions — socle légal jamais suggéré', () => {
  let setup: TwoAgenciesSetup

  // ─── Helper: set profiles.day0_payload for agentA ──────────────────────────
  const setAutonomy = async (mode: 'suggest' | 'notify' | 'resume') => {
    const { error } = await serviceRoleClient()
      .from('profiles')
      .update({
        day0_payload: {
          autonomy: mode,
          dispo: 'office',
          priorite: 'closing',
          specialite: 'x',
          zone: [],
        },
      })
      .eq('id', setup.agentAId)
    if (error) throw new Error(`setAutonomy(${mode}): ${error.message}`)
  }

  // ─── Helper: insert confirmation log rows ──────────────────────────────────
  const insertLogs = async (tool: string, outcome: 'yes' | 'no', count: number) => {
    const svc = serviceRoleClient()
    const rows = Array.from({ length: count }, () => ({
      profile_id: setup.agentAId,
      agency_id: setup.agencyAId,
      tool,
      outcome,
    }))
    const { error } = await svc.from('whatsapp_confirmation_log').insert(rows)
    if (error) throw new Error(`insertLogs(${tool}, ${outcome}, ${count}): ${error.message}`)
  }

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    // Set autonomy to 'notify' (≠ 'resume') so suggest_resume can fire for update_pipeline.
    await setAutonomy('notify')
  })

  afterAll(async () => {
    // Clean up ALL seeded whatsapp_confirmation_log rows for agentA before removing users/agencies.
    await serviceRoleClient()
      .from('whatsapp_confirmation_log')
      .delete()
      .eq('profile_id', setup.agentAId)
      .then(() => {}, () => {})

    await setup.cleanup()
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 1 — 10 yes / 0 no on update_pipeline → suggest_resume = true
  // ──────────────────────────────────────────────────────────────────────────

  it('update_pipeline 10 yes / 0 no → suggest_resume = true', async () => {
    await insertLogs('update_pipeline', 'yes', 10)

    const { data, error } = await serviceRoleClient().rpc('get_whatsapp_autonomy_suggestions')
    if (error) throw new Error(`rpc: ${error.message}`)

    const row = (data ?? []).find(
      (r: { profile_id: string; tool: string }) =>
        r.profile_id === setup.agentAId && r.tool === 'update_pipeline',
    )
    expect(row, 'row for update_pipeline must exist').toBeDefined()
    expect(row.yes_count).toBe(10)
    expect(row.no_count).toBe(0)
    expect(row.suggest_resume).toBe(true)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 2 — a single 'no' kills the suggestion
  // ──────────────────────────────────────────────────────────────────────────

  it('update_pipeline: a single no resets suggest_resume to false', async () => {
    const svc = serviceRoleClient()
    // Test autonome : on repart d'un état connu (pas de dépendance à l'ordre des tests).
    await svc.from('whatsapp_confirmation_log').delete().eq('profile_id', setup.agentAId).eq('tool', 'update_pipeline')
    const rows = Array.from({ length: 10 }, () => ({ profile_id: setup.agentAId, agency_id: setup.agencyAId, tool: 'update_pipeline', outcome: 'yes' as const }))
    rows.push({ profile_id: setup.agentAId, agency_id: setup.agencyAId, tool: 'update_pipeline', outcome: 'no' as const })
    await svc.from('whatsapp_confirmation_log').insert(rows)

    const { data, error } = await serviceRoleClient().rpc('get_whatsapp_autonomy_suggestions')
    if (error) throw new Error(`rpc: ${error.message}`)

    const row = (data ?? []).find(
      (r: { profile_id: string; tool: string }) =>
        r.profile_id === setup.agentAId && r.tool === 'update_pipeline',
    )
    expect(row, 'row for update_pipeline must exist').toBeDefined()
    expect(row.yes_count).toBe(10)
    expect(row.no_count).toBe(1)
    expect(row.suggest_resume).toBe(false)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 3 — legal foundation (send_client_message) NEVER suggested
  // ──────────────────────────────────────────────────────────────────────────

  it('send_client_message 10 yes / 0 no → suggest_resume = false (socle légal immutable)', async () => {
    await insertLogs('send_client_message', 'yes', 10)

    const { data, error } = await serviceRoleClient().rpc('get_whatsapp_autonomy_suggestions')
    if (error) throw new Error(`rpc: ${error.message}`)

    const row = (data ?? []).find(
      (r: { profile_id: string; tool: string }) =>
        r.profile_id === setup.agentAId && r.tool === 'send_client_message',
    )
    expect(row, 'row for send_client_message must exist').toBeDefined()
    expect(row.yes_count).toBe(10)
    expect(row.no_count).toBe(0)
    // Core invariant: suggest_resume must be false regardless of the yes ratio.
    expect(row.suggest_resume).toBe(false)
  })
})
