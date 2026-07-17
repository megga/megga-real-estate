// Phase A · batch 2 — durcissement sécurité (migration 20260717190000).
//
//  1. notify_new_seller_lead : un lead source='website' génère bien un
//     activity_event 'seller_lead_received' (avant : seul 'marketplace' fiait).
//  2. seller_portals : un client ANON ne lit plus aucun token, même sur un
//     portail actif non expiré (policy public_read_active_portals retirée).
//  3. get_admin_* / get_agency_stats : un agent simple (authenticated) est
//     refusé (42501) ; service_role et super_admin passent.
//
// Runs live in CI (SUPABASE_TEST_* keys présentes). Skip local sans clés.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient, anonClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('Phase A batch 2 — durcissement sécurité', () => {
  let setup: TwoAgenciesSetup
  let leadId: string | null = null
  let contactId: string | null = null
  let propertyId: string | null = null
  let portalId: string | null = null

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

    // Contact + bien + portail actif (FK NOT NULL) pour le test anon.
    const { data: contact } = await svc
      .from('contacts')
      .insert({ agency_id: setup.agencyAId, first_name: 'Portal', last_name: `Seller ${setup.stamp}`, type: 'seller' })
      .select('id')
      .single()
    contactId = contact?.id ?? null

    const { data: prop } = await svc
      .from('properties')
      .insert({ agency_id: setup.agencyAId, title: `Portal Prop ${setup.stamp}` })
      .select('id')
      .single()
    propertyId = prop?.id ?? null

    if (contactId && propertyId) {
      const { data: portal, error: portalErr } = await svc
        .from('seller_portals')
        .insert({
          token: `tok-${setup.stamp}`,
          agency_id: setup.agencyAId,
          contact_id: contactId,
          property_id: propertyId,
          agent_id: setup.agentAId,
          status: 'active',
          expires_at: new Date(Date.now() + 30 * 864e5).toISOString(),
        })
        .select('id')
        .single()
      if (portalErr) console.warn('seed seller_portal failed:', portalErr.message)
      else portalId = portal.id
    }
  })

  afterAll(async () => {
    const svc = serviceRoleClient()
    if (portalId) await svc.from('seller_portals').delete().eq('id', portalId).then(() => {}, () => {})
    if (propertyId) await svc.from('properties').delete().eq('id', propertyId).then(() => {}, () => {})
    if (contactId) await svc.from('contacts').delete().eq('id', contactId).then(() => {}, () => {})
    if (leadId) await svc.from('seller_leads').delete().eq('id', leadId).then(() => {}, () => {})
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

  // ── 2. Fuite de tokens de portail ──────────────────────────────────────────
  it('seller_portals : un client anon ne lit aucun token (policy publique retirée)', async () => {
    expect(portalId).toBeTruthy()
    // Le portail est actif + non expiré → il aurait matché l'ancienne policy
    // public_read_active_portals. Un anon ne doit plus rien voir.
    const anon = anonClient()
    const { data } = await anon.from('seller_portals').select('token').eq('id', portalId)
    expect(data ?? []).toHaveLength(0)
  })

  it('seller_portals : l\'agent propriétaire lit toujours son portail (policy agence intacte)', async () => {
    expect(portalId).toBeTruthy()
    // Le DROP de la policy publique + REVOKE anon ne doivent PAS toucher l'accès
    // agent (policy agents_own_agency, authenticated, agency-scopée).
    const { data, error } = await setup.clientA
      .from('seller_portals')
      .select('id, token')
      .eq('id', portalId)
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(1)
  })

  // ── 3. Gardes RPC admin (avant promotion : agent simple) ───────────────────
  it('get_admin_dashboard_stats : un agent simple est refusé (42501)', async () => {
    const { data, error } = await setup.clientA.rpc('get_admin_dashboard_stats')
    expect(data).toBeNull()
    expect(error).toBeTruthy()
    expect(error?.code).toBe('42501')
  })

  it('get_agency_stats : un agent simple est refusé (42501)', async () => {
    const { error } = await setup.clientA.rpc('get_agency_stats', { agency_ids: [setup.agencyAId] })
    expect(error).toBeTruthy()
    expect(error?.code).toBe('42501')
  })

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
