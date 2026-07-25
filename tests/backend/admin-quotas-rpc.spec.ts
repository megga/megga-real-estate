// Admin quotas — admin_set_agency_quotas (migration 20260713100000)
//
//  Test 1 — Gate : un agent simple est rejeté (42501).
//  Test 2 — Upsert + audit : un super_admin pose des caps → agency_usage_quotas
//    reflète les valeurs + un activity_events quota_changed est journalisé.
//  Test 3 — Seuil invalide (< 50) refusé.
//  Test 4 — Idempotence : un second upsert écrase (pas de doublon PK).
//
// Runs live in CI (SUPABASE_TEST_* keys present). Skips locally without keys.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('admin_set_agency_quotas — gardée super_admin, auditée', () => {
  let setup: TwoAgenciesSetup

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const service = serviceRoleClient()
    const { error } = await service.from('profiles').update({ role: 'super_admin' }).eq('id', setup.agentAId)
    if (error) throw new Error(`promote: ${error.message}`)
  })

  afterAll(async () => {
    const service = serviceRoleClient()
    await service.from('agency_usage_quotas').delete().eq('agency_id', setup.agencyAId).then(() => {}, () => {})
    await service.from('profiles').update({ role: 'agent' }).eq('id', setup.agentAId).then(() => {}, () => {})
    await setup.cleanup()
  })

  it('un agent simple ne peut pas poser de quotas', async () => {
    const { error } = await setup.clientB.rpc('admin_set_agency_quotas', {
      p_agency_id: setup.agencyBId,
      p_quotas: { ai_monthly_cost_cap_usd: 100 },
    })
    expect(error, 'refus attendu').not.toBeNull()
  })

  it('un super_admin pose des caps : table + audit quota_changed', async () => {
    const service = serviceRoleClient()
    const { error } = await setup.clientA.rpc('admin_set_agency_quotas', {
      p_agency_id: setup.agencyAId,
      p_quotas: {
        ai_monthly_cost_cap_usd: 250,
        active_properties_cap: 40,
        whatsapp_monthly_cap: 500,
        alert_threshold_pct: 75,
      },
      p_note: 'plan pro comp',
    })
    if (error) throw new Error(`set quotas: ${error.message}`)

    const { data: row } = await service
      .from('agency_usage_quotas')
      .select('ai_monthly_cost_cap_usd, active_properties_cap, whatsapp_monthly_cap, alert_threshold_pct, storage_cap_mb')
      .eq('agency_id', setup.agencyAId)
      .single()
    expect(Number(row?.ai_monthly_cost_cap_usd)).toBe(250)
    expect(row?.active_properties_cap).toBe(40)
    expect(row?.whatsapp_monthly_cap).toBe(500)
    expect(row?.alert_threshold_pct).toBe(75)
    expect(row?.storage_cap_mb).toBeNull() // non fourni → NULL (illimité)

    const { data: events } = await service
      .from('activity_events')
      .select('action, metadata, category')
      .eq('action', 'quota_changed')
      .eq('entity_id', setup.agencyAId)
      .order('created_at', { ascending: false })
      .limit(1)
    expect(events?.length).toBe(1)
    expect((events![0].metadata as { note?: string })?.note).toBe('plan pro comp')
  })

  it('un seuil d\'alerte hors bornes (< 50) est refusé', async () => {
    const { error } = await setup.clientA.rpc('admin_set_agency_quotas', {
      p_agency_id: setup.agencyAId,
      p_quotas: { alert_threshold_pct: 10 },
    })
    expect(error, 'seuil hors bornes → erreur').not.toBeNull()
  })

  it('un second upsert écrase sans violer la PK', async () => {
    const service = serviceRoleClient()
    const { error } = await setup.clientA.rpc('admin_set_agency_quotas', {
      p_agency_id: setup.agencyAId,
      p_quotas: { ai_monthly_cost_cap_usd: 999, alert_threshold_pct: 90 },
    })
    if (error) throw new Error(`re-upsert: ${error.message}`)
    const { data: rows } = await service
      .from('agency_usage_quotas')
      .select('ai_monthly_cost_cap_usd, alert_threshold_pct')
      .eq('agency_id', setup.agencyAId)
    expect(rows?.length).toBe(1)
    expect(Number(rows![0].ai_monthly_cost_cap_usd)).toBe(999)
    expect(rows![0].alert_threshold_pct).toBe(90)
  })
})
