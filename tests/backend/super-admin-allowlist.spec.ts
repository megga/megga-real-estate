// Sécurité — allowlist en dur des super-admins (migration 20260705160000)
//
//  L'identité super-admin = rôle 'super_admin' ET email allowlisté :
//    * prod : hello@juarts.com / ttaillefer.dev@gmail.com (en dur dans
//      public.super_admin_allowlist()) ;
//    * CI : domaine app_config.super_admin_test_domain ('@megga-test.local',
//      posé par tests/backend/helpers/two-agencies.ts).
//
//  Test 1 — Rôle sans allowlist : un user promu super_admin avec un email
//    HORS allowlist (@evil-example.com) est rejeté par les surfaces gardées
//    is_super_admin() (RPC get_cron_health → erreur).
//  Test 2 — Rôle + domaine de test : un super_admin @megga-test.local passe
//    (échappatoire CI) — c'est aussi le test d'acceptation qui garantit que
//    les specs super-admin préexistantes restent vertes.
//  Test 3 — admin_set_user_role refuse de poser 'super_admin' sur un email
//    hors allowlist (ERRCODE 42501, wrappé par PostgREST).
//  Test 4 — admin_set_user_role accepte 'super_admin' sur un email du domaine
//    de test ET journalise role_changed dans activity_events.
//
// Runs live in CI (SUPABASE_TEST_* keys present). Skips locally without keys.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'
const ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY ?? ''
const PASSWORD = 'Test-Password-123!'

describe.skipIf(!HAS_KEYS)('super_admin allowlist — rôle seul ne suffit plus', () => {
  let setup: TwoAgenciesSetup
  let evilUserId: string
  let evilClient: SupabaseClient

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const service = serviceRoleClient()

    // agentA = super_admin légitime CI (email @megga-test.local → passe
    // l'échappatoire super_admin_test_domain posée par le helper).
    const { error: promoteErr } = await service
      .from('profiles')
      .update({ role: 'super_admin' })
      .eq('id', setup.agentAId)
    if (promoteErr) throw new Error(`promote agentA: ${promoteErr.message}`)

    // Utilisateur « evil » : rôle super_admin posé en DB (simule une élévation
    // réussie), mais email HORS allowlist → ne doit RIEN débloquer.
    const evilEmail = `evil-${setup.stamp}@evil-example.com`
    const { data: evilUser, error: evilErr } = await service.auth.admin.createUser({
      email: evilEmail,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: 'Evil User', role: 'agent' },
    })
    if (evilErr) throw new Error(`create evil user: ${evilErr.message}`)
    evilUserId = evilUser.user!.id

    const { error: evilProfileErr } = await service
      .from('profiles')
      .upsert(
        { id: evilUserId, email: evilEmail, full_name: 'Evil User', role: 'super_admin', agency_id: setup.agencyBId },
        { onConflict: 'id' },
      )
    if (evilProfileErr) throw new Error(`evil profile: ${evilProfileErr.message}`)

    evilClient = createClient(URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { error: evilSignInErr } = await evilClient.auth.signInWithPassword({
      email: evilEmail,
      password: PASSWORD,
    })
    if (evilSignInErr) throw new Error(`evil signin: ${evilSignInErr.message}`)
  })

  afterAll(async () => {
    const service = serviceRoleClient()
    await service.auth.admin.deleteUser(evilUserId).catch(() => {})
    await service.from('profiles').update({ role: 'agent' }).eq('id', setup.agentBId).then(() => {}, () => {})
    await setup.cleanup()
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 1 — rôle super_admin + email hors allowlist → refusé
  // ──────────────────────────────────────────────────────────────────────────

  it('un super_admin hors allowlist est rejeté par les RPC gardées is_super_admin', async () => {
    const { error } = await evilClient.rpc('get_cron_health')
    expect(error, 'email hors allowlist : le rôle seul ne doit rien débloquer').not.toBeNull()
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 2 — rôle super_admin + domaine de test CI → accepté
  // ──────────────────────────────────────────────────────────────────────────

  it('un super_admin @megga-test.local passe (échappatoire CI)', async () => {
    const { data, error } = await setup.clientA.rpc('get_cron_health')
    if (error) throw new Error(`rpc (test-domain super_admin): ${error.message}`)
    expect(Array.isArray(data ?? [])).toBe(true)
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 3 — admin_set_user_role refuse super_admin sur email hors allowlist
  // ──────────────────────────────────────────────────────────────────────────

  it('admin_set_user_role refuse de nommer super_admin un email hors allowlist', async () => {
    // Cible = evil user (email @evil-example.com). Appelant = agentA (légitime).
    // On remet d'abord evil en 'agent' pour tester la voie de nomination.
    const service = serviceRoleClient()
    const { error: resetErr } = await service.from('profiles').update({ role: 'agent' }).eq('id', evilUserId)
    if (resetErr) throw new Error(`reset evil role: ${resetErr.message}`)

    const { error } = await setup.clientA.rpc('admin_set_user_role', {
      p_user_id: evilUserId,
      p_role: 'super_admin',
    })
    expect(error, 'nommer super_admin hors allowlist doit échouer').not.toBeNull()

    const { data: evilProfile } = await service.from('profiles').select('role').eq('id', evilUserId).single()
    expect(evilProfile?.role).toBe('agent')
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 4 — admin_set_user_role accepte le domaine de test + audite
  // ──────────────────────────────────────────────────────────────────────────

  it('admin_set_user_role accepte super_admin sur le domaine de test et journalise role_changed', async () => {
    const service = serviceRoleClient()

    const { error } = await setup.clientA.rpc('admin_set_user_role', {
      p_user_id: setup.agentBId,
      p_role: 'super_admin',
    })
    if (error) throw new Error(`admin_set_user_role (test-domain): ${error.message}`)

    const { data: profileB } = await service.from('profiles').select('role').eq('id', setup.agentBId).single()
    expect(profileB?.role).toBe('super_admin')

    // Audit : un activity_events role_changed doit exister pour cette cible.
    const { data: events, error: eventsErr } = await service
      .from('activity_events')
      .select('id, action, actor_id, entity_id, severity, category, metadata')
      .eq('action', 'role_changed')
      .eq('entity_id', setup.agentBId)
      .order('created_at', { ascending: false })
      .limit(1)
    if (eventsErr) throw new Error(`activity_events: ${eventsErr.message}`)
    expect(events?.length).toBe(1)
    expect(events![0].actor_id).toBe(setup.agentAId)
    expect(events![0].category).toBe('auth')
    expect(events![0].severity).toBe('warn')
    expect((events![0].metadata as { new_role?: string })?.new_role).toBe('super_admin')

    // Retour à l'état initial (defensive — cleanup supprime l'utilisateur).
    await service.from('profiles').update({ role: 'agent' }).eq('id', setup.agentBId)
  })
})
