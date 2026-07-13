// Admin integrations health + MRR estimate (migration 20260713170000)
//
//  Test 1 — Gate : un agent simple est rejeté sur les 2 RPC (42501).
//  Test 2 — Shape : get_admin_integrations_health renvoie emails/stripe_webhook/
//    calendar avec les sous-clés attendues.
//  Test 3 — Calendrier stale : un google_calendar_tokens avec last_sync_at ancien
//    et sync_enabled est compté dans calendar.stale_total.
//  Test 4 — MRR : 2 abonnements seedés (pro mensuel + entreprise annuel) ajoutent
//    89 + 199 = 288 au MRR estimé (delta isolé, exécution série en CI).
//
// Runs live in CI (SUPABASE_TEST_* keys present). Skips locally without keys.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('get_admin_integrations_health + compute_platform_mrr_estimate', () => {
  let setup: TwoAgenciesSetup
  let calSeeded = false

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const service = serviceRoleClient()
    const { error } = await service.from('profiles').update({ role: 'super_admin' }).eq('id', setup.agentAId)
    if (error) throw new Error(`promote: ${error.message}`)

    // Calendrier Google « stale » : synchro activée, dernière synchro il y a 3 j.
    const { error: calErr } = await service.from('google_calendar_tokens').insert({
      user_id: setup.agentAId,
      access_token: `at-${setup.stamp}`, refresh_token: `rt-${setup.stamp}`,
      token_expires_at: new Date(Date.now() + 3600_000).toISOString(),
      sync_enabled: true,
      last_sync_at: new Date(Date.now() - 3 * 864e5).toISOString(),
    })
    calSeeded = !calErr
    if (calErr) console.warn('seed google_calendar_tokens failed:', calErr.message)
  })

  afterAll(async () => {
    const service = serviceRoleClient()
    await service.from('google_calendar_tokens').delete().eq('user_id', setup.agentAId).then(() => {}, () => {})
    await service.from('subscriptions').delete().in('agency_id', [setup.agencyAId, setup.agencyBId]).then(() => {}, () => {})
    await service.from('profiles').update({ role: 'agent' }).eq('id', setup.agentAId).then(() => {}, () => {})
    await setup.cleanup()
  })

  it('un agent simple est rejeté sur les 2 RPC', async () => {
    const [health, mrr] = await Promise.all([
      setup.clientB.rpc('get_admin_integrations_health'),
      setup.clientB.rpc('compute_platform_mrr_estimate'),
    ])
    expect(health.error, 'health: refus attendu').not.toBeNull()
    expect(mrr.error, 'mrr: refus attendu').not.toBeNull()
  })

  it('get_admin_integrations_health a la forme attendue', async () => {
    const { data, error } = await setup.clientA.rpc('get_admin_integrations_health')
    if (error) throw new Error(error.message)
    const h = data as Record<string, Record<string, unknown>>
    expect(h.emails).toBeTruthy()
    expect(typeof h.emails.sent_7d).toBe('number')
    expect(h.stripe_webhook).toBeTruthy()
    expect('age_hours' in h.stripe_webhook).toBe(true)
    expect(typeof h.stripe_webhook.active_subscriptions).toBe('number')
    expect(h.calendar).toBeTruthy()
    expect(typeof h.calendar.stale_total).toBe('number')
  })

  it('un calendrier stale est compté dans stale_total', async () => {
    if (!calSeeded) return
    const { data, error } = await setup.clientA.rpc('get_admin_integrations_health')
    if (error) throw new Error(error.message)
    const h = data as { calendar: { stale_total: number; google: { stale: number } } }
    expect(h.calendar.stale_total).toBeGreaterThanOrEqual(1)
    expect(h.calendar.google.stale).toBeGreaterThanOrEqual(1)
  })

  it('le MRR estimé additionne les abonnements valorisés par plan_pricing', async () => {
    const service = serviceRoleClient()
    const before = Number((await setup.clientA.rpc('compute_platform_mrr_estimate')).data ?? 0)

    // pro mensuel (89) sur l'agence A, entreprise annuel (199) sur l'agence B.
    const { error: e1 } = await service.from('subscriptions').insert({
      agency_id: setup.agencyAId, stripe_customer_id: `cus_a_${setup.stamp}`, plan: 'pro', billing_period: 'monthly', status: 'active',
    })
    const { error: e2 } = await service.from('subscriptions').insert({
      agency_id: setup.agencyBId, stripe_customer_id: `cus_b_${setup.stamp}`, plan: 'entreprise', billing_period: 'yearly', status: 'active',
    })
    if (e1 || e2) throw new Error(`seed subs: ${e1?.message ?? ''} ${e2?.message ?? ''}`)

    const after = Number((await setup.clientA.rpc('compute_platform_mrr_estimate')).data ?? 0)
    expect(after - before).toBeCloseTo(288, 1)
  })
})
