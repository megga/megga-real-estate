// Regression — onboarding agency RPCs (create_agency_and_join / join_agency).
//
// Ces RPC (étape Agence de l'onboarding) étaient CASSÉES en prod : `profiles.role`
// est TEXT mais le CASE de mise à jour castait la branche ELSE vers l'enum user_role
// (`ELSE 'admin'::user_role`) → ERROR 42804 "CASE types user_role and text cannot be
// matched" à chaque appel → aucun agent ne pouvait créer/rejoindre son agence →
// onboarding bloqué. Aucun test n'exerçait ces RPC (lecture-seule de l'audit) → le trou
// est resté invisible >1 mois. Ce test appelle les RPC pour de vrai (session authentifiée)
// et casse la CI si le type error revient. Migration : 20260621130000_fix_agency_join_role_cast.

import { describe, it, expect, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { serviceRoleClient } from './helpers/supabase'

const URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'
const ANON = process.env.SUPABASE_TEST_ANON_KEY ?? ''
const PW = 'Test-Password-123!'
const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('regression — onboarding agency RPCs (create_agency_and_join / join_agency)', () => {
  const userIds: string[] = []
  const agencyIds: string[] = []

  // Crée un agent FRAÎCHEMENT inscrit (handle_new_user → profil agency_id NULL) et
  // retourne un client authentifié pour lui.
  async function freshAgent(label: string): Promise<{ client: SupabaseClient; id: string }> {
    const svc = serviceRoleClient()
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const email = `onb-${label}-${stamp}@megga-test.local`
    const { data, error } = await svc.auth.admin.createUser({
      email,
      password: PW,
      email_confirm: true,
      user_metadata: { full_name: `Onb ${label}`, role: 'agent' },
    })
    if (error) throw new Error(`createUser ${label}: ${error.message}`)
    const id = data.user!.id
    userIds.push(id)
    // Le profil n'est pas garanti auto-créé par handle_new_user dans l'env de test
    // (cf helpers/two-agencies qui upsert explicitement). On le pose en agency_id NULL
    // (état pré-onboarding) pour que create_agency_and_join / join_agency aient bien une
    // ligne à mettre à jour (UPDATE profiles ... WHERE id = auth.uid()).
    const { error: pErr } = await svc.from('profiles').upsert(
      { id, email, full_name: `Onb ${label}`, role: 'agent', agency_id: null },
      { onConflict: 'id' },
    )
    if (pErr) throw new Error(`profile upsert ${label}: ${pErr.message}`)
    const client = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
    const { error: sErr } = await client.auth.signInWithPassword({ email, password: PW })
    if (sErr) throw new Error(`signin ${label}: ${sErr.message}`)
    return { client, id }
  }

  afterAll(async () => {
    const svc = serviceRoleClient()
    for (const id of userIds) await svc.auth.admin.deleteUser(id).then(() => {}, () => {})
    for (const id of agencyIds) await svc.from('agencies').delete().eq('id', id).then(() => {}, () => {})
  })

  it('un agent neuf crée son agence via create_agency_and_join (aucune erreur de type) et reçoit agency_id', async () => {
    const { client, id } = await freshAgent('create')
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`

    const { data, error } = await client.rpc('create_agency_and_join', {
      p_name: `Agence Onb ${stamp}`,
      p_city: 'Genève',
      p_canton: 'GE',
      p_solo: true,
    })
    expect(error, `create_agency_and_join a échoué: ${error?.message}`).toBeNull()
    expect(data, 'retourne un id d’agence').toBeTruthy()
    agencyIds.push(data as string)

    // profile.agency_id posé + rôle préservé (agent reste agent)
    const svc = serviceRoleClient()
    const { data: prof } = await svc
      .from('profiles')
      .select('agency_id, role')
      .eq('id', id)
      .single()
    expect(prof?.agency_id).toBe(data)
    expect(prof?.role).toBe('agent')
  })

  it('l’agent peut ensuite insérer un contact (RLS) — il n’est plus verrouillé', async () => {
    const { client, id } = await freshAgent('insert')
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const { data: agencyId, error: cErr } = await client.rpc('create_agency_and_join', {
      p_name: `Agence Ins ${stamp}`, p_city: 'Genève', p_canton: 'GE', p_solo: true,
    })
    expect(cErr).toBeNull()
    agencyIds.push(agencyId as string)

    const { error: insErr } = await client.from('contacts').insert({
      first_name: 'Test', last_name: `Buyer ${stamp}`, email: `tb-${stamp}@megga-test.local`,
      type: 'buyer', source: 'manual', agency_id: agencyId,
    })
    expect(insErr, `insert contact a échoué: ${insErr?.message}`).toBeNull()

    const svc = serviceRoleClient()
    const { count } = await svc
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('agency_id', agencyId as string)
    expect(count).toBe(1)
    // (id consommé pour le typage strict)
    expect(id).toBeTruthy()
  })

  it('un second agent rejoint une agence existante via join_agency (aucune erreur de type)', async () => {
    const { client: owner } = await freshAgent('owner')
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const { data: agencyId, error: cErr } = await owner.rpc('create_agency_and_join', {
      p_name: `Agence Join ${stamp}`, p_city: 'Lausanne', p_canton: 'VD', p_solo: false,
    })
    expect(cErr).toBeNull()
    agencyIds.push(agencyId as string)

    const { client: joiner, id: joinerId } = await freshAgent('joiner')
    const { error: jErr } = await joiner.rpc('join_agency', { p_agency_id: agencyId })
    expect(jErr, `join_agency a échoué: ${jErr?.message}`).toBeNull()

    const svc = serviceRoleClient()
    const { data: prof } = await svc
      .from('profiles')
      .select('agency_id, role')
      .eq('id', joinerId)
      .single()
    expect(prof?.agency_id).toBe(agencyId)
    expect(prof?.role).toBe('agent')
  })
})
