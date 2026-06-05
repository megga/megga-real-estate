// Observabilité outils WhatsApp — RPC get_whatsapp_tool_usage_stats + RLS whatsapp_tool_usage (live).
//
//  Test 1 — agrégation par outil (caller super_admin) : nb appels, nb erreurs, taux, dernière util.
//  Test 2 — p_known_tools révèle un outil jamais utilisé (total_calls=0, last_used_at=null).
//  Test 3 — caller non-super-admin rejeté (garde serveur 42501).
//  Test 4 — RLS agence : clientB ne voit QUE les lignes de son agence.
//
// Runs live in CI (SUPABASE_TEST_* keys present). Skips cleanly locally when keys are absent.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

type UsageRow = { agency_id: string | null; profile_id: string; tool: string; tier: string; outcome: string }

describe.skipIf(!HAS_KEYS)('get_whatsapp_tool_usage_stats — observabilité outils', () => {
  let setup: TwoAgenciesSetup

  const insert = async (rows: UsageRow[]) => {
    const { error } = await serviceRoleClient().from('whatsapp_tool_usage').insert(rows)
    if (error) throw new Error(`insert usage: ${error.message}`)
  }
  // Repart d'un état propre : seules ces deux profils/agences sont touchés par ce spec.
  const wipe = async () => {
    const svc = serviceRoleClient()
    await svc.from('whatsapp_tool_usage').delete().in('profile_id', [setup.agentAId, setup.agentBId]).then(() => {}, () => {})
  }

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    // agentA = CALLER promu super_admin pour toutes les assertions RPC.
    const { error } = await serviceRoleClient().from('profiles').update({ role: 'super_admin' }).eq('id', setup.agentAId)
    if (error) throw new Error(`promote super_admin: ${error.message}`)
    await wipe()
  })

  afterAll(async () => {
    await wipe()
    await setup.cleanup()
  })

  // ── Test 1 — agrégation par outil ──────────────────────────────────────────
  it('agrège par outil : nb appels, erreurs, taux, dernière utilisation', async () => {
    await wipe()
    await insert([
      // search_contacts (read) : 3 executed + 1 error → 4 appels, 1 erreur, taux 0.25
      { agency_id: setup.agencyBId, profile_id: setup.agentBId, tool: 'search_contacts', tier: 'read', outcome: 'executed' },
      { agency_id: setup.agencyBId, profile_id: setup.agentBId, tool: 'search_contacts', tier: 'read', outcome: 'executed' },
      { agency_id: setup.agencyBId, profile_id: setup.agentBId, tool: 'search_contacts', tier: 'read', outcome: 'executed' },
      { agency_id: setup.agencyBId, profile_id: setup.agentBId, tool: 'search_contacts', tier: 'read', outcome: 'error' },
      // update_pipeline (confirm) : 2 confirm_pending → 2 appels, 0 erreur
      { agency_id: setup.agencyBId, profile_id: setup.agentBId, tool: 'update_pipeline', tier: 'confirm', outcome: 'confirm_pending' },
      { agency_id: setup.agencyBId, profile_id: setup.agentBId, tool: 'update_pipeline', tier: 'confirm', outcome: 'confirm_pending' },
      // get_matches (read) : 2 executed + 1 error → ratio non terminant 1/3, exerce round(...,4)
      { agency_id: setup.agencyBId, profile_id: setup.agentBId, tool: 'get_matches', tier: 'read', outcome: 'executed' },
      { agency_id: setup.agencyBId, profile_id: setup.agentBId, tool: 'get_matches', tier: 'read', outcome: 'executed' },
      { agency_id: setup.agencyBId, profile_id: setup.agentBId, tool: 'get_matches', tier: 'read', outcome: 'error' },
    ])

    const { data, error } = await setup.clientA.rpc('get_whatsapp_tool_usage_stats')
    if (error) throw new Error(`rpc: ${error.message}`)

    const sc = (data ?? []).find((r: { tool: string }) => r.tool === 'search_contacts')
    expect(sc, 'search_contacts row').toBeDefined()
    expect(sc.total_calls).toBe(4)
    expect(sc.error_count).toBe(1)
    expect(Number(sc.error_rate)).toBeCloseTo(0.25, 4)
    expect(sc.last_used_at).not.toBeNull()

    const up = (data ?? []).find((r: { tool: string }) => r.tool === 'update_pipeline')
    expect(up, 'update_pipeline row').toBeDefined()
    expect(up.total_calls).toBe(2)
    expect(up.error_count).toBe(0)
    expect(Number(up.error_rate)).toBe(0)

    // Exerce explicitement l'arrondi 4 décimales sur un ratio non terminant (1/3 = 0.3333).
    const gm = (data ?? []).find((r: { tool: string }) => r.tool === 'get_matches')
    expect(gm, 'get_matches row').toBeDefined()
    expect(gm.total_calls).toBe(3)
    expect(gm.error_count).toBe(1)
    expect(Number(gm.error_rate)).toBeCloseTo(0.3333, 4)
  })

  // ── Test 2 — outils jamais utilisés via p_known_tools ───────────────────────
  it('p_known_tools révèle un outil jamais utilisé', async () => {
    await wipe()
    await insert([
      { agency_id: setup.agencyBId, profile_id: setup.agentBId, tool: 'search_contacts', tier: 'read', outcome: 'executed' },
    ])

    const { data, error } = await setup.clientA.rpc('get_whatsapp_tool_usage_stats', {
      p_known_tools: ['search_contacts', 'send_kyc_report'], // send_kyc_report jamais inséré
    })
    if (error) throw new Error(`rpc: ${error.message}`)

    const never = (data ?? []).find((r: { tool: string }) => r.tool === 'send_kyc_report')
    expect(never, 'never-used tool row').toBeDefined()
    expect(never.total_calls).toBe(0)
    expect(never.last_used_at).toBeNull()
  })

  // ── Test 3 — garde serveur ──────────────────────────────────────────────────
  it('caller non-super-admin rejeté (garde serveur)', async () => {
    const { error } = await setup.clientB.rpc('get_whatsapp_tool_usage_stats')
    expect(error, 'error non-null pour un caller non super_admin').not.toBeNull()
  })

  // ── Test 4 — RLS agence read-own ────────────────────────────────────────────
  it('RLS : une agence ne voit que ses propres lignes', async () => {
    await wipe()
    await insert([
      { agency_id: setup.agencyAId, profile_id: setup.agentAId, tool: 'get_daily_brief', tier: 'read', outcome: 'executed' },
      { agency_id: setup.agencyBId, profile_id: setup.agentBId, tool: 'get_daily_brief', tier: 'read', outcome: 'executed' },
    ])

    // clientB = agentB, rôle 'agent', agence B (PAS super_admin).
    const { data, error } = await setup.clientB.from('whatsapp_tool_usage').select('agency_id')
    if (error) throw new Error(`select: ${error.message}`)
    const agencies = new Set((data ?? []).map((r: { agency_id: string | null }) => r.agency_id))
    expect(agencies.has(setup.agencyBId), 'voit son agence').toBe(true)
    expect(agencies.has(setup.agencyAId), 'ne voit pas l’agence A').toBe(false)
  })
})
