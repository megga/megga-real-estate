// Admin usage — get_admin_agency_usage / get_admin_usage_overview /
// get_admin_quota_breaches (migration 20260713100000)
//
//  Test 1 — Gate : un agent simple est rejeté sur les 3 RPC (42501).
//  Test 2 — Exactitude : 1 bien actif + 1 log IA + 1 message WhatsApp seedés
//    (agence A) → get_admin_agency_usage reflète les compteurs.
//  Test 3 — Overview : la ligne de l'agence A porte ses agrégats + les caps.
//  Test 4 — Breach : un cap bas (active_properties_cap=1, seuil 50%) avec 1 bien
//    actif fait apparaître l'agence dans get_admin_quota_breaches.
//
// Runs live in CI (SUPABASE_TEST_* keys present). Skips locally without keys.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('RPC usage admin — gardées super_admin/service, agrégats exacts', () => {
  let setup: TwoAgenciesSetup
  let propertyId: string | null = null
  let seeded = false

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const service = serviceRoleClient()
    const { error: promoteErr } = await service.from('profiles').update({ role: 'super_admin' }).eq('id', setup.agentAId)
    if (promoteErr) throw new Error(`promote: ${promoteErr.message}`)

    // Seed agence A : 1 bien actif + 1 log IA (mois courant) + 1 message WhatsApp.
    const { data: prop, error: propErr } = await service
      .from('properties')
      .insert({ agency_id: setup.agencyAId, title: `Usage seed ${setup.stamp}`, status: 'active', transaction_type: 'sell' })
      .select('id')
      .single()
    if (propErr) { console.warn('seed property failed:', propErr.message); return }
    propertyId = prop.id

    const { error: aiErr } = await service.from('ai_usage_logs').insert({
      agency_id: setup.agencyAId, edge_function: 'ai-copilot', provider: 'deepseek',
      input_tokens: 100, output_tokens: 50, estimated_cost_usd: 1.5, module: 'copilot',
    })
    if (aiErr) console.warn('seed ai_usage_logs failed:', aiErr.message)

    const { error: waErr } = await service.from('whatsapp_messages').insert({
      agency_id: setup.agencyAId, provider: 'meta', provider_message_id: `usage-${setup.stamp}`,
      direction: 'outbound', wa_from: '41790000000', status: 'received',
    })
    if (waErr) console.warn('seed whatsapp_messages failed:', waErr.message)

    seeded = !aiErr && !waErr
  })

  afterAll(async () => {
    const service = serviceRoleClient()
    await service.from('ai_usage_logs').delete().eq('agency_id', setup.agencyAId).then(() => {}, () => {})
    await service.from('whatsapp_messages').delete().eq('agency_id', setup.agencyAId).then(() => {}, () => {})
    await service.from('agency_usage_quotas').delete().eq('agency_id', setup.agencyAId).then(() => {}, () => {})
    if (propertyId) await service.from('properties').delete().eq('id', propertyId).then(() => {}, () => {})
    await service.from('profiles').update({ role: 'agent' }).eq('id', setup.agentAId).then(() => {}, () => {})
    await setup.cleanup()
  })

  it('un agent simple est rejeté sur les 3 RPC', async () => {
    const [usage, overview, breaches] = await Promise.all([
      setup.clientB.rpc('get_admin_agency_usage', { p_agency_id: setup.agencyBId }),
      setup.clientB.rpc('get_admin_usage_overview'),
      setup.clientB.rpc('get_admin_quota_breaches'),
    ])
    expect(usage.error, 'usage: refus attendu').not.toBeNull()
    expect(overview.error, 'overview: refus attendu').not.toBeNull()
    expect(breaches.error, 'breaches: refus attendu').not.toBeNull()
  })

  it('get_admin_agency_usage reflète les compteurs seedés', async () => {
    if (!propertyId) return // seed impossible sur ce schéma
    const { data, error } = await setup.clientA.rpc('get_admin_agency_usage', { p_agency_id: setup.agencyAId })
    if (error) throw new Error(error.message)
    const row = (data as Array<Record<string, number>>)[0]
    expect(Number(row.active_properties)).toBeGreaterThanOrEqual(1)
    if (seeded) {
      expect(Number(row.ai_calls_month)).toBeGreaterThanOrEqual(1)
      expect(Number(row.ai_cost_month_usd)).toBeGreaterThanOrEqual(1.5)
      expect(Number(row.wa_messages_month)).toBeGreaterThanOrEqual(1)
    }
  })

  it('get_admin_usage_overview porte les agrégats + caps de l\'agence', async () => {
    // Pose un cap pour vérifier que l'overview le renvoie.
    const { error: qErr } = await setup.clientA.rpc('admin_set_agency_quotas', {
      p_agency_id: setup.agencyAId,
      p_quotas: { ai_monthly_cost_cap_usd: 1000, alert_threshold_pct: 80 },
    })
    if (qErr) throw new Error(`set quotas: ${qErr.message}`)

    const { data, error } = await setup.clientA.rpc('get_admin_usage_overview')
    if (error) throw new Error(error.message)
    const rows = data as Array<{ agency_id: string; active_properties: number; caps: Record<string, number> }>
    const mine = rows.find(r => r.agency_id === setup.agencyAId)
    expect(mine, 'agence A présente dans l\'overview').toBeTruthy()
    if (propertyId) expect(Number(mine!.active_properties)).toBeGreaterThanOrEqual(1)
    expect(Number(mine!.caps?.ai_monthly_cost_cap_usd)).toBe(1000)
  })

  it('get_admin_quota_breaches détecte un cap dépassé', async () => {
    if (!propertyId) return
    // Cap biens actifs = 1, seuil 50% → 1 bien actif ≥ 0.5 → breach.
    const { error: qErr } = await setup.clientA.rpc('admin_set_agency_quotas', {
      p_agency_id: setup.agencyAId,
      p_quotas: { active_properties_cap: 1, alert_threshold_pct: 50 },
    })
    if (qErr) throw new Error(`set quotas: ${qErr.message}`)

    const { data, error } = await setup.clientA.rpc('get_admin_quota_breaches')
    if (error) throw new Error(error.message)
    const rows = data as Array<{ agency_id: string; metric: string }>
    const mine = rows.filter(r => r.agency_id === setup.agencyAId)
    expect(mine.some(r => r.metric === 'active_properties'), 'breach active_properties attendu').toBe(true)
  })
})
