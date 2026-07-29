// Phase A · batch 2 — durcissement sécurité (migration 20260717190000).
//
//  1. notify_new_seller_lead : un lead source='website' génère bien un
//     activity_event 'seller_lead_received' (avant : seul 'marketplace' fiait).
//  2. get_admin_* / get_agency_stats : un agent simple (authenticated) est
//     refusé (42501) ; service_role et super_admin passent.
//
// Les cas seller_portals sont partis le 2026-07-26 avec la fonctionnalité : la
// table a été droppée (0 ligne depuis sa création), il n'y a plus de policy
// publique à garder ni de token à ne pas fuiter.
//
// Runs live in CI (SUPABASE_TEST_* keys présentes). Skip local sans clés.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('Phase A batch 2 — durcissement sécurité', () => {
  let setup: TwoAgenciesSetup
  let leadId: string | null = null
  let mktLeadId: string | null = null
  let mnlLeadId: string | null = null

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const svc = serviceRoleClient()

    // Lead vendeur du funnel React /vendre (source='website').
    const { data: lead, error: leadErr } = await svc
      .from('seller_leads')
      .insert({
        contact_name: `WebLead ${setup.stamp}`,
        contact_email: `weblead-${setup.stamp}@megga-test.local`,
        source: 'website',
        status: 'new',
        assigned_agency_id: setup.agencyAId,
        property_data: { city: 'Genève', type: 'apartment' },
      })
      .select('id')
      .single()
    if (leadErr) console.warn('seed seller_lead (website) failed:', leadErr.message)
    else leadId = lead.id

    // Non-régression : le funnel storefront (source='marketplace') doit TOUJOURS notifier.
    const { data: mkt } = await svc
      .from('seller_leads')
      .insert({
        contact_name: `MktLead ${setup.stamp}`, contact_email: `mkt-${setup.stamp}@megga-test.local`,
        source: 'marketplace', status: 'new', assigned_agency_id: setup.agencyAId,
        property_data: { city: 'Lausanne', type: 'house' },
      })
      .select('id').single()
    mktLeadId = mkt?.id ?? null

    // Cas négatif : une source agent-créée (hors funnel web) NE doit PAS notifier.
    const { data: mnl } = await svc
      .from('seller_leads')
      .insert({
        contact_name: `MnlLead ${setup.stamp}`, contact_email: `mnl-${setup.stamp}@megga-test.local`,
        source: 'manual', status: 'new', assigned_agency_id: setup.agencyAId,
        property_data: { city: 'Sion', type: 'apartment' },
      })
      .select('id').single()
    mnlLeadId = mnl?.id ?? null

  })

  afterAll(async () => {
    const svc = serviceRoleClient()
    for (const id of [leadId, mktLeadId, mnlLeadId]) {
      if (id) await svc.from('seller_leads').delete().eq('id', id).then(() => {}, () => {})
    }
    await svc.from('profiles').update({ role: 'agent' }).eq('id', setup.agentAId).then(() => {}, () => {})
    await setup.cleanup()
  })

  // ── 1. Notification lead vendeur ───────────────────────────────────────────
  it('notify_new_seller_lead : un lead source=website génère un activity_event', async () => {
    expect(leadId).toBeTruthy()
    const svc = serviceRoleClient()
    const { data, error } = await svc
      .from('activity_events')
      .select('id, action, entity_id, entity_type')
      .eq('entity_id', leadId)
      .eq('action', 'seller_lead_received')
    expect(error).toBeNull()
    expect((data ?? []).length).toBeGreaterThan(0)
  })

  it('notify_new_seller_lead : un lead source=marketplace notifie toujours (non-régression)', async () => {
    expect(mktLeadId).toBeTruthy()
    const svc = serviceRoleClient()
    const { data } = await svc
      .from('activity_events')
      .select('id')
      .eq('entity_id', mktLeadId)
      .eq('action', 'seller_lead_received')
    expect((data ?? []).length).toBeGreaterThan(0)
  })

  it('notify_new_seller_lead : une source agent-créée (manual) ne notifie PAS', async () => {
    expect(mnlLeadId).toBeTruthy()
    const svc = serviceRoleClient()
    const { data } = await svc
      .from('activity_events')
      .select('id')
      .eq('entity_id', mnlLeadId)
      .eq('action', 'seller_lead_received')
    expect(data ?? []).toHaveLength(0)
  })

  // ── 2. Fuite de tokens de portail ──────────────────────────────────────────
  // ── 2. Gardes RPC admin (avant promotion : agent simple) ───────────────────
  // Les 5 RPC durcies : un agent simple (authenticated non super-admin) doit être
  // refusé en 42501 sur CHACUNE (une garde manquante/typotée passerait sinon).
  const GUARDED_RPCS = [
    'get_admin_dashboard_stats',
    'get_admin_compliance_stats',
    'get_admin_moderation_stats',
    'get_admin_monitoring_health',
    'get_agency_stats',
  ] as const
  for (const rpc of GUARDED_RPCS) {
    it(`${rpc} : un agent simple est refusé (42501)`, async () => {
      const args = rpc === 'get_agency_stats' ? { agency_ids: [setup.agencyAId] } : undefined
      const { error } = await setup.clientA.rpc(rpc, args)
      expect(error).toBeTruthy()
      expect(error?.code).toBe('42501')
    })
  }

  it('service_role : accès autorisé (is_service_role)', async () => {
    const svc = serviceRoleClient()
    const { data, error } = await svc.rpc('get_admin_dashboard_stats')
    expect(error).toBeNull()
    expect(data).toBeTruthy()
  })

  // Promotion en dernier (mute l'état partagé profiles.role, remis par afterAll).
  it('super_admin : accès autorisé après promotion', async () => {
    const svc = serviceRoleClient()
    const { error: promoteErr } = await svc
      .from('profiles')
      .update({ role: 'super_admin' })
      .eq('id', setup.agentAId)
    expect(promoteErr).toBeNull()
    const { data, error } = await setup.clientA.rpc('get_admin_dashboard_stats')
    expect(error).toBeNull()
    expect(data).toBeTruthy()
  })
})
