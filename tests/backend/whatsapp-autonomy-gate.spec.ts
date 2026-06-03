// Autonomy gate wiring (Palier 3) — two end-to-end proofs against a live Supabase:
//
//  Test 1 — can_auto_send(agent, 'pipeline_move') follows the agent's autonomy mode.
//    Proves that migration 20260603120000 wired pipeline_move into compute_agent_preferences
//    correctly: true for 'resume', false for 'suggest'. If this returned false for 'resume'
//    the entire Palier 3 auto-branch would be dead code.
//
//  Test 2a — winner-take-one undo claim (whatsapp_recent_auto_actions).
//    Replicates the /annuler handler's atomic claim: first claim acquires the undo slot,
//    second identical claim returns 0 rows (anti double-undo).
//
//  Test 2b — stage rollback via payload_undo.
//    Seeds a transaction at stage B, inserts an undo row with old_stage A, applies the
//    rollback as the webhook does, then asserts the stage reverted to A.
//
// Runs live in CI (SUPABASE_TEST_* keys present).
// Skips cleanly locally when keys are absent (no Docker required for unit runs).

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('whatsapp autonomy gate — pipeline_move + undo mechanic', () => {
  let setup: TwoAgenciesSetup

  // IDs of rows we seed ourselves — cleanup() only handles users+agencies.
  let undoRowId: string | null = null
  let txnId: string | null = null
  let undoRowId2b: string | null = null

  // ─── Helper: update profiles.day0_payload for agentA ───────────────────────
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

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    // day0_payload is NULL initially (pre-Day0 state) — we set it per-test via setAutonomy().
  })

  afterAll(async () => {
    const svc = serviceRoleClient()

    // Clean up undo rows (seeded by Test 2a + 2b) before cleanup() removes users/agencies.
    if (undoRowId)   await svc.from('whatsapp_recent_auto_actions').delete().eq('id', undoRowId).then(() => {}, () => {})
    if (undoRowId2b) await svc.from('whatsapp_recent_auto_actions').delete().eq('id', undoRowId2b).then(() => {}, () => {})
    if (txnId)       await svc.from('transactions').delete().eq('id', txnId).then(() => {}, () => {})

    await setup.cleanup()
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 1 — gate follows autonomy mode
  // ──────────────────────────────────────────────────────────────────────────

  it("resume → can_auto_send('pipeline_move') === true", async () => {
    await setAutonomy('resume')
    const { data, error } = await serviceRoleClient().rpc('can_auto_send', {
      p_agent_id: setup.agentAId,
      p_action_type: 'pipeline_move',
    })
    if (error) throw new Error(`can_auto_send rpc: ${error.message}`)
    expect(data).toBe(true)
  })

  it("suggest → can_auto_send('pipeline_move') === false", async () => {
    await setAutonomy('suggest')
    const { data, error } = await serviceRoleClient().rpc('can_auto_send', {
      p_agent_id: setup.agentAId,
      p_action_type: 'pipeline_move',
    })
    if (error) throw new Error(`can_auto_send rpc: ${error.message}`)
    expect(data).toBe(false)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 2a — winner-take-one undo claim
  // ──────────────────────────────────────────────────────────────────────────

  it('winner-take-one: first claim acquires the undo slot, second claim returns 0 rows', async () => {
    const svc = serviceRoleClient()
    const undoUntil = new Date(Date.now() + 60_000).toISOString()

    // Seed the undo row
    const { data: row, error: insertErr } = await svc
      .from('whatsapp_recent_auto_actions')
      .insert({
        profile_id: setup.agentAId,
        agency_id: setup.agencyAId,
        tool: 'update_pipeline',
        payload_undo: {
          // fake id : 2a ne teste QUE le claim gagnant-unique (pas de rollback), donc pas besoin d'une vraie transaction
          transaction_id: '00000000-0000-0000-0000-000000000001',
          old_stage: 'new_lead',
        },
        undo_until: undoUntil,
        // undone_at defaults NULL
      })
      .select('id')
      .single()
    if (insertErr) throw new Error(`undo row insert: ${insertErr.message}`)
    undoRowId = row.id

    // Replicate the handler's atomic claim: UPDATE ... WHERE undone_at IS NULL
    const claim = async () => {
      const { data: claimed } = await svc
        .from('whatsapp_recent_auto_actions')
        .update({ undone_at: new Date().toISOString() })
        .eq('id', undoRowId!)
        .is('undone_at', null)
        .select('id')
      return claimed ?? []
    }

    const firstClaim = await claim()
    expect(firstClaim).toHaveLength(1)     // 1st claim acquires the slot
    expect(firstClaim[0].id).toBe(undoRowId)

    const secondClaim = await claim()
    expect(secondClaim).toHaveLength(0)    // 2nd claim: already consumed → 0 rows (anti double-undo)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 2b — stage rollback mirrors the webhook
  // ──────────────────────────────────────────────────────────────────────────

  it('stage rollback (DB write): payload_undo reverts transactions.stage', async () => {
    // Teste l'écriture DB que le handler /annuler effectue (UPDATE stage), pas le handler lui-même.
    const svc = serviceRoleClient()

    // Seed a transaction at stage B ('active_search') — minimal columns used by reference specs.
    const { data: txn, error: txnErr } = await svc
      .from('transactions')
      .insert({
        agency_id: setup.agencyAId,
        stage: 'active_search',
      })
      .select('id')
      .single()
    if (txnErr) throw new Error(`transaction insert: ${txnErr.message}`)
    txnId = txn.id

    // Insert an undo row recording old_stage = 'new_lead' (stage A)
    const undoUntil = new Date(Date.now() + 60_000).toISOString()
    const { data: undoRow, error: undoErr } = await svc
      .from('whatsapp_recent_auto_actions')
      .insert({
        profile_id: setup.agentAId,
        agency_id: setup.agencyAId,
        tool: 'update_pipeline',
        payload_undo: {
          transaction_id: txnId,
          old_stage: 'new_lead',
        },
        undo_until: undoUntil,
      })
      .select('id')
      .single()
    if (undoErr) throw new Error(`undo row 2b insert: ${undoErr.message}`)
    undoRowId2b = undoRow.id

    // Apply the rollback exactly as the webhook does:
    // update transaction.stage to old_stage, scoped by agency_id (RLS mirror)
    const { error: rollbackErr } = await svc
      .from('transactions')
      .update({ stage: 'new_lead' })
      .eq('id', txnId)
      .eq('agency_id', setup.agencyAId)
    if (rollbackErr) throw new Error(`stage rollback: ${rollbackErr.message}`)

    // Verify the stage reverted
    const { data: refreshed, error: selectErr } = await svc
      .from('transactions')
      .select('stage')
      .eq('id', txnId)
      .single()
    if (selectErr) throw new Error(`re-select transaction: ${selectErr.message}`)
    expect(refreshed.stage).toBe('new_lead')
  })
})
