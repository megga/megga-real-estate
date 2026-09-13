// S8 — un profil ne naît plus super_admin, ni rattaché à une agence, de la main de son
// titulaire (migration 20260913160100_profiles_insert_role_guard.sql).
//
// Le verrou de 20260627120000 figeait role et agency_id sur l'UPDATE ; l'INSERT restait
// ouvert : un compte SANS profil pouvait créer le sien avec role = 'super_admin' et
// n'importe quel agency_id (prouvé en production dans une transaction annulée). Le trigger
// `trg_profiles_guard_role_agency` couvre désormais BEFORE INSERT OR UPDATE.
//
// Le banc attaque par le vrai chemin — PostgREST, avec le JWT du compte orphelin — et non en
// SQL sous postgres : c'est par là que le trou s'exploitait. Trois contrôles positifs le
// rendent lisible : le même compte crée un profil ordinaire (la garde ne refuse pas tout),
// l'inscription par GoTrue crée toujours le sien (handle_new_user, SECURITY DEFINER, franchit
// la garde), et la branche UPDATE n'a pas bougé.
//
//  @sql-blocks-check — le seul corps SQL (la forme du trigger) porte son propre `begin … end`.
//
// ⚠ ÉCRIT SANS PILE LOCALE (pas de Docker sur le poste de rédaction, 13.09.2026) : relu et
// type-vérifié, jamais exécuté avant son premier passage dans backend.yml. skipIf(!HAS_KEYS)
// ne SKIP PAS en CI — lire le NOMBRE de tests exécutés, jamais le code de sortie.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { execSql } from './helpers/local-sql'
import { serviceRoleClient } from './helpers/supabase'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'
const ANON = process.env.SUPABASE_TEST_ANON_KEY ?? ''
const PASSWORD = 'Test-Password-123!'

/** Le corps porte son bloc complet (`begin … end`) — le wrapper ne ferme rien pour lui. */
const runSql = (body: string) => execSql(`do $$\n${body}\n$$;`)
const assertSql = (body: string) => expect(() => runSql(body), 'assertion SQL').not.toThrow()

describe.skipIf(!HAS_KEYS)('S8 — profiles : un INSERT client ne pose ni super_admin ni agency_id', () => {
  let setup: TwoAgenciesSetup
  let orphelinId = ''
  let orphelinEmail = ''
  let orphelin: SupabaseClient
  const aSupprimer: string[] = []

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const service = serviceRoleClient()

    // Rôle 'buyer' à l'inscription : aucune agence n'est provisionnée, le profil peut être
    // retiré sans rien laisser derrière lui.
    orphelinEmail = `orphelin-${setup.stamp}@megga-test.local`
    const { data, error } = await service.auth.admin.createUser({
      email: orphelinEmail,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: 'Orphelin', role: 'buyer' },
    })
    if (error || !data.user) throw new Error(`orphelin: ${error?.message ?? 'aucun utilisateur rendu'}`)
    orphelinId = data.user.id
    aSupprimer.push(orphelinId)

    // La prémisse du trou : un compte authentifié SANS ligne dans profiles.
    const { error: delErr } = await service.from('profiles').delete().eq('id', orphelinId)
    if (delErr) throw new Error(`retrait du profil de l'orphelin: ${delErr.message}`)

    orphelin = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
    const { error: signErr } = await orphelin.auth.signInWithPassword({ email: orphelinEmail, password: PASSWORD })
    if (signErr) throw new Error(`connexion de l'orphelin: ${signErr.message}`)
  })

  afterAll(async () => {
    const service = serviceRoleClient()
    for (const id of aSupprimer) await service.auth.admin.deleteUser(id).catch(() => {})
    if (setup) await setup.cleanup()
  })

  it('refuse role = super_admin — code 42501, message de la GARDE, et aucune ligne écrite', async () => {
    const { error } = await orphelin
      .from('profiles')
      .insert({ id: orphelinId, email: orphelinEmail, full_name: 'Orphelin', role: 'super_admin' })
    expect(error, 'l’auto-promotion aurait dû être refusée').not.toBeNull()
    expect(error?.code).toBe('42501')
    // 42501 est aussi le code d'un refus de RLS : le message dit que c'est bien la garde.
    expect(error?.message).toContain('profiles.role')

    const { data } = await serviceRoleClient().from('profiles').select('id').eq('id', orphelinId)
    expect(data ?? [], 'aucun profil ne doit subsister').toHaveLength(0)
  })

  it('refuse un agency_id posé à la création — le rattachement passe par les RPC DEFINER', async () => {
    const { error } = await orphelin
      .from('profiles')
      .insert({ id: orphelinId, email: orphelinEmail, full_name: 'Orphelin', agency_id: setup.agencyAId })
    expect(error, 'le rattachement direct aurait dû être refusé').not.toBeNull()
    expect(error?.code).toBe('42501')
    expect(error?.message).toContain('profiles.agency_id')
  })

  it('CONTRÔLE POSITIF — le même compte crée un profil ordinaire (rôle par défaut, sans agence)', async () => {
    const { error } = await orphelin
      .from('profiles')
      .insert({ id: orphelinId, email: orphelinEmail, full_name: 'Orphelin' })
    expect(error, `insert légitime refusé : ${error?.message}`).toBeNull()

    const { data } = await serviceRoleClient().from('profiles').select('role, agency_id').eq('id', orphelinId).single()
    expect(data?.role).toBe('buyer')
    expect(data?.agency_id).toBeNull()
  })

  it('NON-RÉGRESSION — la branche UPDATE est inchangée : rôle figé, colonne sûre éditable', async () => {
    // Autonome : le profil est (re)posé par service_role, qui franchit la garde.
    const service = serviceRoleClient()
    const { error: seedErr } = await service
      .from('profiles')
      .upsert({ id: orphelinId, email: orphelinEmail, full_name: 'Orphelin', role: 'buyer', agency_id: null }, { onConflict: 'id' })
    if (seedErr) throw new Error(`profil de l'orphelin: ${seedErr.message}`)

    const { error: refus } = await orphelin.from('profiles').update({ role: 'super_admin' }).eq('id', orphelinId)
    expect(refus, 'l’escalade par UPDATE aurait dû être refusée').not.toBeNull()

    const { error: ok } = await orphelin.from('profiles').update({ full_name: 'Orphelin Renommé' }).eq('id', orphelinId)
    expect(ok, `édition d'une colonne sûre refusée : ${ok?.message}`).toBeNull()

    const { data } = await service.from('profiles').select('role, full_name').eq('id', orphelinId).single()
    expect(data?.role).toBe('buyer')
    expect(data?.full_name).toBe('Orphelin Renommé')
  })

  it('CONTRÔLE POSITIF — l’inscription par GoTrue crée toujours le profil (handle_new_user franchit la garde)', async () => {
    const service = serviceRoleClient()
    const email = `inscrit-${setup.stamp}@megga-test.local`
    const { data, error } = await service.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: 'Inscrit', role: 'seller' },
    })
    if (error || !data.user) throw new Error(`inscription: ${error?.message ?? 'aucun utilisateur rendu'}`)
    aSupprimer.push(data.user.id)

    const { data: profil, error: lectureErr } = await service
      .from('profiles')
      .select('role, agency_id')
      .eq('id', data.user.id)
      .single()
    expect(lectureErr, `profil introuvable après inscription : ${lectureErr?.message}`).toBeNull()
    expect(profil?.role).toBe('seller')
    expect(profil?.agency_id).toBeNull()
  })

  it('le trigger est BEFORE INSERT OR UPDATE FOR EACH ROW, et sa fonction INVOKER', () => {
    assertSql(`
    declare v_type int; v_definer boolean;
    begin
      select t.tgtype into v_type
        from pg_trigger t
       where t.tgrelid = 'public.profiles'::regclass
         and t.tgname = 'trg_profiles_guard_role_agency'
         and not t.tgisinternal;
      if v_type is null then
        raise exception 'trg_profiles_guard_role_agency absent';
      end if;
      -- 1 = ROW, 2 = BEFORE, 4 = INSERT, 16 = UPDATE
      if (v_type & 23) <> 23 then
        raise exception 'tgtype % : BEFORE INSERT OR UPDATE FOR EACH ROW attendu', v_type;
      end if;
      select prosecdef into v_definer from pg_proc
       where oid = 'public.tg_profiles_guard_role_agency()'::regprocedure;
      if v_definer then
        raise exception 'la garde est SECURITY DEFINER : current_user y vaudrait toujours postgres';
      end if;
    end;`)
  })
})
