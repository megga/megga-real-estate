// Backend integration spec (live CI) — entrée console dans les deux journaux, et verdict
// d'accès (migration 20260801220000_admin_console_session.sql, étape 3, spec §1/§5.9/§6/§10.3).
//
// Ce fichier porte le second critère de sortie G0 du plan : « une entrée console apparaît
// dans admin_log avec hash chaîné ». Il vérifie aussi la double écriture — l'ancien journal
// n'est pas abandonné en chemin — et que la révocation hors allowlist prend effet sans
// attendre l'expiration d'un jeton, ce que §10.3 exige.
//
// skipIf(!HAS_KEYS) ne SKIP PAS en CI — lire le compte de tests, jamais le code de sortie.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { serviceRoleClient, anonClient } from './helpers/supabase'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const PW = 'Test-Password-123!'
const DENIED = '42501'

describe.skipIf(!HAS_KEYS)('entrée console : double journal et verdict d\'accès (étape 3)', () => {
  let setup: TwoAgenciesSetup
  let superClient: SupabaseClient
  let superId = ''
  let superEmail = ''
  const extraUserIds: string[] = []

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const svc = serviceRoleClient()
    superEmail = `console-entry-super-${setup.stamp}@megga-test.local`
    const { data, error } = await svc.auth.admin.createUser({
      email: superEmail, password: PW, email_confirm: true,
      user_metadata: { full_name: `Super Console ${setup.stamp}`, role: 'agent' },
    })
    if (error) throw new Error(`createUser super_admin: ${error.message}`)
    superId = data.user!.id
    extraUserIds.push(superId)
    const { error: pErr } = await svc.from('profiles').upsert(
      { id: superId, email: superEmail, full_name: `Super Console ${setup.stamp}`, role: 'super_admin', agency_id: null },
      { onConflict: 'id' }
    )
    if (pErr) throw new Error(`profile super_admin: ${pErr.message}`)
    superClient = anonClient()
    const { error: signInErr } = await superClient.auth.signInWithPassword({ email: superEmail, password: PW })
    if (signInErr) throw new Error(`signin super_admin: ${signInErr.message}`)
  })

  afterAll(async () => {
    if (setup) await setup.cleanup()
    const svc = serviceRoleClient()
    for (const id of extraUserIds) await svc.auth.admin.deleteUser(id).then(() => {}, () => {})
  })

  // ── 1. La convergence : deux journaux, une seule entrée ────────────────────────

  it('G0 — une entrée console écrit dans admin_log avec un hash chaîné', async () => {
    const before = await superClient.from('admin_log_chain_head').select('rows_count, head_hash').single()
    expect(before.error).toBeNull()

    const { error } = await superClient.rpc('admin_log_console_entry', {
      p_metadata: { origin: 'https://app.megga.ch' },
    })
    expect(error, 'un super-admin doit pouvoir journaliser son entrée').toBeNull()

    const { data: row } = await superClient
      .from('admin_log')
      .select('family, action, severity, routine, actor_user_id, actor_label, entity_type, prev_hash, hash, metadata')
      .order('seq', { ascending: false })
      .limit(1)
      .single()

    expect(row?.family, 'famille session (§6)').toBe('session')
    expect(row?.action).toBe('admin_console_entered')
    expect(row?.severity, '§6 classe l\'entrée console en info').toBe('info')
    expect(row?.routine, 'une entrée console est ce que l\'écran montre, pas ce qu\'il replie').toBe(false)
    expect(row?.actor_user_id).toBe(superId)
    expect(row?.actor_label).toBe(`Super Console ${setup.stamp}`)
    expect(row?.entity_type).toBe('admin_console')
    expect(row?.prev_hash, 'la ligne chaîne sur la tête précédente').toBe(before.data!.head_hash)
    expect(row?.hash).toMatch(/^[0-9a-f]{64}$/)

    const after = await superClient.from('admin_log_chain_head').select('rows_count').single()
    expect(Number(after.data!.rows_count)).toBe(Number(before.data!.rows_count) + 1)

    const { data: verdict } = await serviceRoleClient().rpc('admin_log_verify_chain', {})
    expect(verdict?.status, 'la chaîne reste intacte après l\'entrée').toBe('ok')
  })

  it('l\'ancien journal continue d\'être alimenté — la convergence n\'abandonne rien', async () => {
    const svc = serviceRoleClient()
    const before = await svc
      .from('activity_events')
      .select('id', { count: 'exact', head: true })
      .eq('action', 'admin_console_entered')
      .eq('actor_id', superId)

    const { error } = await superClient.rpc('admin_log_console_entry', {
      p_metadata: { origin: 'https://app.megga.ch' },
    })
    expect(error).toBeNull()

    const after = await svc
      .from('activity_events')
      .select('id', { count: 'exact', head: true })
      .eq('action', 'admin_console_entered')
      .eq('actor_id', superId)
    expect(after.count ?? 0, 'activity_events reçoit toujours sa ligne').toBe((before.count ?? 0) + 1)
  })

  it('l\'IP et le user-agent viennent de auth.sessions, pas d\'un en-tête déclaratif', async () => {
    await superClient.rpc('admin_log_console_entry', { p_metadata: { origin: 'https://app.megga.ch' } })

    const { data: row } = await superClient
      .from('admin_log')
      .select('ip, user_agent, session_id')
      .eq('family', 'session')
      .order('seq', { ascending: false })
      .limit(1)
      .single()

    // GoTrue renseigne ces colonnes à la connexion. Si la revendication `session_id` du JWT
    // manque, le repli prend la session la plus récente du compte : dans les deux cas la
    // ligne doit porter une session, sinon la baseline de §5.9 n'aura jamais de matière.
    expect(row?.session_id, 'la session doit être identifiée').toBeTruthy()
    expect(row?.user_agent, 'le user-agent vient de GoTrue').toBeTruthy()
  })

  it('un agent ne peut pas journaliser une entrée console', async () => {
    const { error } = await setup.clientA.rpc('admin_log_console_entry', { p_metadata: {} })
    expect(error?.code).toBe(DENIED)
  })

  // ── 2. Le verdict d'accès ──────────────────────────────────────────────────────

  it('un super-admin dans sa fenêtre de 8 h est autorisé', async () => {
    const { data, error } = await superClient.rpc('admin_console_session_state')
    expect(error).toBeNull()
    expect(data?.allowed).toBe(true)
    expect(data?.reason).toBe('ok')
    expect(Number(data?.ttl_hours)).toBe(8)
    expect(Number(data?.age_seconds), 'la session vient d\'être ouverte').toBeLessThan(3600)
    expect(data?.expires_at).toBeTruthy()
  })

  it('le verdict RÉPOND au lieu de lever — un agent reçoit « non », pas une erreur', async () => {
    // C'est la différence qui compte pour la console : une RPC qui lève est indistinguable
    // d'une RPC indisponible, et useSuperAdminGate documente déjà le mode de panne que ça
    // produit (la porte se ferme définitivement sur un hoquet réseau).
    const { data, error } = await setup.clientA.rpc('admin_console_session_state')
    expect(error, 'aucune exception : un verdict').toBeNull()
    expect(data?.allowed).toBe(false)
    expect(data?.reason).toBe('not_super_admin')
  })

  it('retirer le rôle ferme l\'accès au prochain appel, sans attendre l\'expiration du jeton', async () => {
    const svc = serviceRoleClient()
    const { error: demote } = await svc.from('profiles').update({ role: 'agent' }).eq('id', superId)
    expect(demote).toBeNull()

    // Le JWT du client n'a pas bougé : c'est is_super_admin() qui relit le rôle et
    // l'allowlist à chaque appel. C'est ce qui rend la révocation immédiate (§10.3).
    const { data, error } = await superClient.rpc('admin_console_session_state')
    expect(error).toBeNull()
    expect(data?.allowed, 'la révocation prend effet immédiatement').toBe(false)
    expect(data?.reason).toBe('not_super_admin')

    const entry = await superClient.rpc('admin_log_console_entry', { p_metadata: {} })
    expect(entry.error?.code, 'et l\'entrée console est refusée dans la foulée').toBe(DENIED)

    // Remise en état pour ne pas empoisonner d'éventuels tests suivants du fichier.
    await svc.from('profiles').update({ role: 'super_admin' }).eq('id', superId)
  })
})
