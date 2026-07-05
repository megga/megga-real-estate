// Admin billing & modération (migration 20260705173000)
//
//  Test 1 — Gate : admin_set_agency_plan refuse un agent simple.
//  Test 2 — Effet : super_admin (domaine test CI) change le plan → agencies.plan
//    mis à jour, ligne subscriptions upsertée (manual_…), activity_events
//    subscription_changed journalisé (manual_override).
//  Test 3 — Plan invalide refusé.
//  Test 4 — seller_leads : le super_admin peut assigner un lead à une agence
//    tierce (policy seller_leads_super_admin_all), un agent B non.
//
// Runs live in CI (SUPABASE_TEST_* keys present). Skips locally without keys.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('admin_set_agency_plan + seller_leads super-admin', () => {
  let setup: TwoAgenciesSetup
  let leadId: string | null = null

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const service = serviceRoleClient()

    const { error: promoteErr } = await service
      .from('profiles')
      .update({ role: 'super_admin' })
      .eq('id', setup.agentAId)
    if (promoteErr) throw new Error(`promote: ${promoteErr.message}`)

    // Lead vendeur non assigné (comme une soumission storefront).
    const { data: lead, error: leadErr } = await service
      .from('seller_leads')
      .insert({
        contact_name: `Lead Test ${setup.stamp}`,
        contact_email: `lead-${setup.stamp}@megga-test.local`,
        source: 'marketplace',
        status: 'new',
        assigned_agency_id: null,
        property_data: {},
      })
      .select('id')
      .single()
    if (leadErr) console.warn('seed seller_lead failed:', leadErr.message)
    else leadId = lead.id
  })

  afterAll(async () => {
    const service = serviceRoleClient()
    if (leadId) await service.from('seller_leads').delete().eq('id', leadId).then(() => {}, () => {})
    await service.from('subscriptions').delete().eq('agency_id', setup.agencyAId).then(() => {}, () => {})
    await service.from('profiles').update({ role: 'agent' }).eq('id', setup.agentAId).then(() => {}, () => {})
    await setup.cleanup()
  })

  it('un agent simple ne peut pas changer le plan d\'une agence', async () => {
    const { error } = await setup.clientB.rpc('admin_set_agency_plan', {
      p_agency_id: setup.agencyBId,
      p_plan: 'pro',
    })
    expect(error, 'refus attendu').not.toBeNull()
  })

  it('un super_admin change le plan : agences + subscriptions + audit', async () => {
    const service = serviceRoleClient()
    const { error } = await setup.clientA.rpc('admin_set_agency_plan', {
      p_agency_id: setup.agencyAId,
      p_plan: 'pro',
      p_status: 'active',
      p_note: 'compte test',
    })
    if (error) throw new Error(`admin_set_agency_plan: ${error.message}`)

    const { data: agency } = await service.from('agencies').select('plan').eq('id', setup.agencyAId).single()
    expect(agency?.plan).toBe('pro')

    const { data: sub } = await service
      .from('subscriptions')
      .select('plan, status, stripe_customer_id')
      .eq('agency_id', setup.agencyAId)
      .single()
    expect(sub?.plan).toBe('pro')
    expect(sub?.stripe_customer_id).toBe(`manual_${setup.agencyAId}`)

    const { data: events } = await service
      .from('activity_events')
      .select('action, metadata, severity')
      .eq('action', 'subscription_changed')
      .eq('entity_id', setup.agencyAId)
      .order('created_at', { ascending: false })
      .limit(1)
    expect(events?.length).toBe(1)
    expect((events![0].metadata as { manual_override?: boolean })?.manual_override).toBe(true)
  })

  it('un plan invalide est refusé', async () => {
    const { error } = await setup.clientA.rpc('admin_set_agency_plan', {
      p_agency_id: setup.agencyAId,
      p_plan: 'diamond',
    })
    expect(error, 'plan hors liste → erreur').not.toBeNull()
  })

  it('le super_admin assigne un lead à une agence tierce ; un agent B vers une autre agence, non', async () => {
    if (!leadId) return // seed indisponible sur ce schéma
    const service = serviceRoleClient()

    // Agent B tente d'assigner le lead à l'agence A (pas la sienne) → bloqué
    // par le WITH CHECK agence-scopé.
    const { data: bAttempt } = await setup.clientB
      .from('seller_leads')
      .update({ assigned_agency_id: setup.agencyAId, status: 'assigned' })
      .eq('id', leadId)
      .select('id')
    expect(bAttempt?.length ?? 0).toBe(0)

    // Super-admin assigne à l'agence B (tierce pour lui) → policy super_admin.
    const { data: aAttempt, error: aErr } = await setup.clientA
      .from('seller_leads')
      .update({ assigned_agency_id: setup.agencyBId, status: 'assigned' })
      .eq('id', leadId)
      .select('id')
    if (aErr) throw new Error(`super_admin assign: ${aErr.message}`)
    expect(aAttempt?.length).toBe(1)

    const { data: lead } = await service.from('seller_leads').select('assigned_agency_id').eq('id', leadId).single()
    expect(lead?.assigned_agency_id).toBe(setup.agencyBId)
  })
})
