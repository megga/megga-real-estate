// Backend test (live CI) — bareme reglable du moteur de verification KYB :
// get_agency_verification_config() (etape 3, tache 1 — migration
// 20260728120000_agency_verification_config.sql).
//
// Jumeau de get_property_score_config / get_contact_score_config pour le
// mecanisme app_config (cle JSON versionnee, wrapper SECURITY DEFINER), mais
// GRANTS plus stricts : ces deux seuils pilotent l'auto-validation KYB/LAB
// (docs/agency-kyb-verification.md §2). Les exposer a un dirigeant en cours de
// verification l'inviterait a calibrer sa saisie pour juste franchir le seuil —
// meme raisonnement que verification_check_config (20260728103000), deja
// verrouille a is_super_admin(). service_role SEUL pour l'instant (contrainte
// globale du plan etape 3, docs/superpowers/plans/2026-07-28-onboarding-kyb-etape-3.md).
//
// skipIf(!HAS_KEYS) ne SKIP PAS en CI : ces tests tournent contre un Supabase
// local seede et DOIVENT reellement passer. Le bareme vient de la migration
// (app_config.agency_verification_v1) → les valeurs sont deterministes.

import { describe, it, expect, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { serviceRoleClient, anonClient } from './helpers/supabase'

const PW = 'Test-Password-123!'
const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const DENIED = '42501'
const CONFIG_KEY = 'agency_verification_v1'

interface VerificationConfig {
  auto_validate_min?: number
  review_priority_min?: number
}

describe.skipIf(!HAS_KEYS)('get_agency_verification_config — bareme reglable KYB', () => {
  const userIds: string[] = []

  afterAll(async () => {
    const svc = serviceRoleClient()
    for (const id of userIds) {
      const { data: prof } = await svc.from('profiles').select('agency_id').eq('id', id).maybeSingle()
      await svc.auth.admin.deleteUser(id).then(() => {}, () => {})
      if (prof?.agency_id) await svc.from('agencies').delete().eq('id', prof.agency_id).then(() => {}, () => {})
    }
  })

  // Inscrit un utilisateur authentifie quelconque — seul le role Postgres
  // 'authenticated' importe ici (l'agence solo provisionnee par le trigger
  // handle_new_user n'est pas utilisee par ces tests). Motif de creation repris
  // de agency-identity-submit.spec.ts (signUpFounder).
  async function signUpUser(): Promise<{ id: string; client: SupabaseClient }> {
    const svc = serviceRoleClient()
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const email = `verif-cfg-${stamp}@megga-test.local`
    const { data, error } = await svc.auth.admin.createUser({
      email,
      password: PW,
      email_confirm: true,
      user_metadata: { full_name: `Testeur ${stamp}`, role: 'agent' },
    })
    if (error) throw new Error(`createUser: ${error.message}`)
    const id = data.user!.id
    userIds.push(id)

    const client = anonClient()
    const { error: signInErr } = await client.auth.signInWithPassword({ email, password: PW })
    if (signInErr) throw new Error(`signin: ${signInErr.message}`)

    return { id, client }
  }

  it('renvoie les deux seuils poses par la migration (auto_validate_min 0.85, review_priority_min 0.5)', async () => {
    const svc = serviceRoleClient()
    const { data, error } = await svc.rpc('get_agency_verification_config', {})
    expect(error, `rpc: ${error?.message}`).toBeNull()
    const cfg = data as VerificationConfig
    expect(cfg.auto_validate_min).toBe(0.85)
    expect(cfg.review_priority_min).toBe(0.5)
  })

  it('n\'expose aucune autre cle d\'app_config que les deux seuils attendus', async () => {
    const svc = serviceRoleClient()
    const { data, error } = await svc.rpc('get_agency_verification_config', {})
    expect(error, `rpc: ${error?.message}`).toBeNull()
    expect(Object.keys(data as Record<string, unknown>).sort()).toEqual(
      ['auto_validate_min', 'review_priority_min'].sort()
    )
  })

  it('retombe sur les defauts durs (0.85 / 0.5) quand la cle agency_verification_v1 est absente', async () => {
    const svc = serviceRoleClient()
    const { data: row } = await svc.from('app_config').select('value').eq('key', CONFIG_KEY).maybeSingle()
    const original = row?.value as string | undefined
    await svc.from('app_config').delete().eq('key', CONFIG_KEY)
    try {
      const { data, error } = await svc.rpc('get_agency_verification_config', {})
      expect(error, `rpc sans cle: ${error?.message}`).toBeNull()
      const cfg = data as VerificationConfig
      expect(cfg.auto_validate_min).toBe(0.85)
      expect(cfg.review_priority_min).toBe(0.5)
    } finally {
      // restaure la cle telle qu'avant le test (jamais laisser app_config muet
      // pour les autres fichiers de specs, qui tournent en serie sur la meme base).
      if (original !== undefined) {
        await svc.from('app_config').upsert({ key: CONFIG_KEY, value: original }, { onConflict: 'key' })
      }
    }
  })

  it('est refusee a anon', async () => {
    const { error } = await anonClient().rpc('get_agency_verification_config', {})
    expect(error?.code).toBe(DENIED)
  })

  it('est refusee a authenticated (seuils sensibles KYB/LAB : service_role uniquement)', async () => {
    const user = await signUpUser()
    const { error } = await user.client.rpc('get_agency_verification_config', {})
    expect(error?.code).toBe(DENIED)
  })
})
