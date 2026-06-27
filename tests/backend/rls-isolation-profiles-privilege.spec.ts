// SÉCURITÉ — Élévation de privilège sur public.profiles (confirmée LIVE).
//
// Un agent authentifié pouvait, avec la clé anon publique + son propre JWT,
// `PATCH /profiles?id=eq.<self>` en posant role='super_admin' (→ ouverture de
// TOUTES les agences via super_admin_read_all_profiles) ou en changeant
// agency_id (rattachement cross-tenant). Cause : profiles_update_own sans
// WITH CHECK + GRANT UPDATE colonne sur role/agency_id pour authenticated.
//
// Ce test asserte, contre le schéma LIVE (Supabase local appliqué en CI) :
//   - un agent NE PEUT PAS escalader son propre role,
//   - un agent NE PEUT PAS changer son propre agency_id,
//   - un agent PEUT toujours éditer ses colonnes non sensibles (full_name,
//     preferences — preuve que le re-GRANT dynamique couvre les colonnes
//     post-baseline),
//   - claim_pending_role n'accorde qu'un rôle auto-attribuable, jamais super_admin,
//   - admin_set_user_role refuse un appelant non super_admin,
//   - le chemin légitime onboarding (create_agency_and_join, SECURITY DEFINER)
//     continue de poser agency_id.
//
// Régression du fix 20260627120000_profiles_privilege_escalation_lockdown.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { serviceRoleClient } from './helpers/supabase'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'
const ANON = process.env.SUPABASE_TEST_ANON_KEY ?? ''
const PW = 'Test-Password-123!'

describe.skipIf(!HAS_KEYS)('SÉCURITÉ — profiles : pas d’escalade role/agency_id', () => {
  let setup: TwoAgenciesSetup

  beforeAll(async () => {
    setup = await setupTwoAgencies()
  })

  afterAll(async () => {
    if (setup) await setup.cleanup()
  })

  // ── Le cœur : auto-escalade bloquée ───────────────────────────────────────

  it('un agent NE PEUT PAS se promouvoir super_admin (role figé)', async () => {
    const { error } = await setup.clientA
      .from('profiles')
      .update({ role: 'super_admin' })
      .eq('id', setup.agentAId)

    // Refus : privilège colonne retiré → 42501 (ou, défense en profondeur,
    // trigger/RLS). Dans tous les cas l'update doit échouer.
    expect(error, 'l’update de role aurait dû être REJETÉ').not.toBeNull()

    // Vérité terrain : le role est resté 'agent'.
    const svc = serviceRoleClient()
    const { data } = await svc.from('profiles').select('role').eq('id', setup.agentAId).single()
    expect(data?.role, 'role escaladé en base !').toBe('agent')
  })

  it('un agent NE PEUT PAS changer son agency_id (rattachement cross-tenant bloqué)', async () => {
    const { error } = await setup.clientA
      .from('profiles')
      .update({ agency_id: setup.agencyBId })
      .eq('id', setup.agentAId)

    expect(error, 'l’update d’agency_id aurait dû être REJETÉ').not.toBeNull()

    const svc = serviceRoleClient()
    const { data } = await svc.from('profiles').select('agency_id').eq('id', setup.agentAId).single()
    expect(data?.agency_id, 'agency_id changé en base !').toBe(setup.agencyAId)
  })

  it('un agent NE PEUT PAS escalader via un update mixte (colonne sûre + role)', async () => {
    const { error } = await setup.clientA
      .from('profiles')
      .update({ full_name: 'Legit Name', role: 'super_admin' })
      .eq('id', setup.agentAId)

    expect(error, 'l’update mixte avec role aurait dû être REJETÉ').not.toBeNull()

    const svc = serviceRoleClient()
    const { data } = await svc.from('profiles').select('role').eq('id', setup.agentAId).single()
    expect(data?.role).toBe('agent')
  })

  // ── Les colonnes non sensibles restent éditables ──────────────────────────

  it('un agent PEUT toujours éditer ses colonnes non sensibles (full_name, preferences)', async () => {
    const { error } = await setup.clientA
      .from('profiles')
      .update({ full_name: 'Nom Mis À Jour', preferences: { ui: { language: 'en' } } })
      .eq('id', setup.agentAId)

    expect(error, `update colonne sûre cassé: ${error?.message}`).toBeNull()

    const svc = serviceRoleClient()
    const { data } = await svc
      .from('profiles')
      .select('full_name, preferences')
      .eq('id', setup.agentAId)
      .single()
    expect(data?.full_name).toBe('Nom Mis À Jour')
    expect((data?.preferences as { ui?: { language?: string } })?.ui?.language).toBe('en')
  })

  // ── claim_pending_role : auto-claim borné, jamais super_admin ──────────────

  it('claim_pending_role promeut buyer→agent mais REFUSE super_admin', async () => {
    const svc = serviceRoleClient()

    async function freshBuyer(metaRole: string): Promise<{ client: SupabaseClient; id: string }> {
      const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
      const email = `claim-${stamp}@megga-test.local`
      const { data, error } = await svc.auth.admin.createUser({
        email,
        password: PW,
        email_confirm: true,
        user_metadata: { full_name: 'Claim', role: metaRole },
      })
      if (error) throw new Error(`createUser: ${error.message}`)
      const id = data.user!.id
      // Profil pré-onboarding : role 'buyer' (handle_new_user ne tourne pas en local).
      const { error: pErr } = await svc
        .from('profiles')
        .upsert({ id, email, full_name: 'Claim', role: 'buyer', agency_id: null }, { onConflict: 'id' })
      if (pErr) throw new Error(`profile upsert: ${pErr.message}`)
      const client = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
      const { error: sErr } = await client.auth.signInWithPassword({ email, password: PW })
      if (sErr) throw new Error(`signin: ${sErr.message}`)
      return { client, id }
    }

    // Cas légitime : metadata role 'agent' → claim accordé.
    const agentCase = await freshBuyer('agent')
    const { data: claimed, error: cErr } = await agentCase.client.rpc('claim_pending_role')
    expect(cErr, `claim_pending_role a échoué: ${cErr?.message}`).toBeNull()
    expect(claimed).toBe('agent')
    const { data: a } = await svc.from('profiles').select('role').eq('id', agentCase.id).single()
    expect(a?.role).toBe('agent')

    // Cas d'attaque : metadata role 'super_admin' → reste 'buyer'.
    const adminCase = await freshBuyer('super_admin')
    const { data: notClaimed } = await adminCase.client.rpc('claim_pending_role')
    expect(notClaimed, 'super_admin ne doit jamais être auto-claimé').toBe('buyer')
    const { data: b } = await svc.from('profiles').select('role').eq('id', adminCase.id).single()
    expect(b?.role, 'super_admin escaladé via claim_pending_role !').toBe('buyer')

    await svc.auth.admin.deleteUser(agentCase.id).catch(() => {})
    await svc.auth.admin.deleteUser(adminCase.id).catch(() => {})
  })

  // ── admin_set_user_role : réservé super_admin ─────────────────────────────

  it('admin_set_user_role REFUSE un appelant non super_admin', async () => {
    const { error } = await setup.clientA.rpc('admin_set_user_role', {
      p_user_id: setup.agentBId,
      p_role: 'admin',
    })
    expect(error, 'un non super_admin a pu appeler admin_set_user_role').not.toBeNull()

    const svc = serviceRoleClient()
    const { data } = await svc.from('profiles').select('role').eq('id', setup.agentBId).single()
    expect(data?.role).toBe('agent')
  })

  // ── Chemin légitime : onboarding SECURITY DEFINER non impacté ──────────────

  it('create_agency_and_join (SECURITY DEFINER) pose toujours agency_id après le fix', async () => {
    const svc = serviceRoleClient()
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const email = `onb-fix-${stamp}@megga-test.local`
    const { data: u, error: uErr } = await svc.auth.admin.createUser({
      email,
      password: PW,
      email_confirm: true,
      user_metadata: { full_name: 'Onb Fix', role: 'agent' },
    })
    if (uErr) throw new Error(`createUser: ${uErr.message}`)
    const id = u.user!.id
    await svc
      .from('profiles')
      .upsert({ id, email, full_name: 'Onb Fix', role: 'agent', agency_id: null }, { onConflict: 'id' })

    const client = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
    await client.auth.signInWithPassword({ email, password: PW })

    const { data: agencyId, error: rpcErr } = await client.rpc('create_agency_and_join', {
      p_name: `Agence Fix ${stamp}`,
      p_city: 'Genève',
      p_canton: 'GE',
      p_solo: true,
    })
    expect(rpcErr, `onboarding cassé par le fix: ${rpcErr?.message}`).toBeNull()
    expect(agencyId).toBeTruthy()

    const { data: prof } = await svc.from('profiles').select('agency_id, role').eq('id', id).single()
    expect(prof?.agency_id, 'agency_id non posé par l’onboarding').toBe(agencyId)

    await svc.auth.admin.deleteUser(id).catch(() => {})
    await svc.from('agencies').delete().eq('id', agencyId as string).then(() => {}, () => {})
  })
})

// ─── Chemins légitimes de gestion d'équipe (team_set_member_role / _remove) ───
// Vérifie que les RPC SECURITY DEFINER qui remplacent les updates client directs
// fonctionnent (admin/manager de la même agence) ET refusent les non-autorisés.
describe.skipIf(!HAS_KEYS)('SÉCURITÉ — RPC gestion d’équipe agence', () => {
  let agencyId: string
  let adminId: string
  let memberId: string
  let outsiderId: string
  let adminClient: SupabaseClient
  let memberClient: SupabaseClient
  const ids: string[] = []
  const agencies: string[] = []

  async function seedUser(label: string, role: string, agency: string | null): Promise<{ id: string; client: SupabaseClient }> {
    const svc = serviceRoleClient()
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const email = `team-${label}-${stamp}@megga-test.local`
    const { data, error } = await svc.auth.admin.createUser({
      email, password: PW, email_confirm: true,
      user_metadata: { full_name: `Team ${label}`, role },
    })
    if (error) throw new Error(`createUser ${label}: ${error.message}`)
    const id = data.user!.id
    ids.push(id)
    const { error: pErr } = await svc
      .from('profiles')
      .upsert({ id, email, full_name: `Team ${label}`, role, agency_id: agency }, { onConflict: 'id' })
    if (pErr) throw new Error(`profile ${label}: ${pErr.message}`)
    const client = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
    const { error: sErr } = await client.auth.signInWithPassword({ email, password: PW })
    if (sErr) throw new Error(`signin ${label}: ${sErr.message}`)
    return { id, client }
  }

  beforeAll(async () => {
    const svc = serviceRoleClient()
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const a = await svc.from('agencies').insert({ name: `Team Agency ${stamp}`, slug: `team-agency-${stamp}` }).select('id').single()
    if (a.error) throw new Error(`agency: ${a.error.message}`)
    agencyId = a.data.id
    agencies.push(agencyId)
    const a2 = await svc.from('agencies').insert({ name: `Outsider Agency ${stamp}`, slug: `outsider-agency-${stamp}` }).select('id').single()
    if (a2.error) throw new Error(`agency2: ${a2.error.message}`)
    agencies.push(a2.data.id)

    const admin = await seedUser('admin', 'admin', agencyId)
    adminId = admin.id; adminClient = admin.client
    const member = await seedUser('member', 'agent', agencyId)
    memberId = member.id; memberClient = member.client
    const outsider = await seedUser('outsider', 'agent', a2.data.id)
    outsiderId = outsider.id
  })

  afterAll(async () => {
    const svc = serviceRoleClient()
    for (const id of ids) await svc.auth.admin.deleteUser(id).catch(() => {})
    for (const id of agencies) await svc.from('agencies').delete().eq('id', id).then(() => {}, () => {})
  })

  it('un admin d’agence change le rôle d’un membre de SA propre agence', async () => {
    const { error } = await adminClient.rpc('team_set_member_role', { p_member_id: memberId, p_role: 'manager' })
    expect(error, `team_set_member_role a échoué: ${error?.message}`).toBeNull()
    const svc = serviceRoleClient()
    const { data } = await svc.from('profiles').select('role').eq('id', memberId).single()
    expect(data?.role).toBe('manager')
  })

  it('un admin NE PEUT PAS toucher un membre d’une AUTRE agence', async () => {
    const { error } = await adminClient.rpc('team_set_member_role', { p_member_id: outsiderId, p_role: 'manager' })
    expect(error, 'cross-agency aurait dû être REFUSÉ').not.toBeNull()
    const svc = serviceRoleClient()
    const { data } = await svc.from('profiles').select('role').eq('id', outsiderId).single()
    expect(data?.role).toBe('agent')
  })

  it('un membre simple (agent) NE PEUT PAS changer de rôle dans l’équipe', async () => {
    const { error } = await memberClient.rpc('team_set_member_role', { p_member_id: adminId, p_role: 'agent' })
    expect(error, 'un agent a pu utiliser team_set_member_role').not.toBeNull()
  })

  it('team_remove_member détache l’agence et remet le rôle buyer', async () => {
    const { error } = await adminClient.rpc('team_remove_member', { p_member_id: memberId })
    expect(error, `team_remove_member a échoué: ${error?.message}`).toBeNull()
    const svc = serviceRoleClient()
    const { data } = await svc.from('profiles').select('role, agency_id').eq('id', memberId).single()
    expect(data?.role).toBe('buyer')
    expect(data?.agency_id).toBeNull()
  })
})
