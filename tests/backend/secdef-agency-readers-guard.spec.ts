// Backend integration spec (live CI) — garde super-admin sur les deux lectures
// d'agrégats par agence (migration 20260731190000_secdef_guard_agency_readers.sql,
// bloquant pré-lancement 0.2 / finding S2-S10-S17).
//
// Avant cette migration, `get_onboarding_milestones(uuid[])` et
// `get_agency_activity_summary(uuid[], integer)` étaient SECURITY DEFINER, EXECUTE
// accordé à `authenticated`, sans garde ni filtre d'agence : elles prennent un tableau
// d'agency_id et répondaient pour n'importe lequel. Tout agent connecté apprenait donc,
// agence par agence, si elle a des contacts, des biens, des dossiers KYC, des
// transactions, des matchs, son volume d'événements et sa dernière activité.
//
// Ce fichier prouve : (1) qu'un agent est refusé sur une agence TIERCE ; (2) qu'il l'est
// aussi sur SA PROPRE agence — la garde est super-admin, pas « ma propre agence », et un
// test qui n'exercerait que le cas tiers laisserait passer une garde écrite en filtre ;
// (3) qu'un visiteur anonyme est refusé ; (4) que le super-admin et le service_role
// continuent de recevoir des données, faute de quoi la console serait murée avec l'agent.
// Il vérifie enfin (5) la fermeture des deux RPC de logos à anon et authenticated.
//
// skipIf(!HAS_KEYS) ne SKIP PAS en CI : ces tests tournent contre un Supabase local
// seedé et DOIVENT réellement passer — lire le compte de tests, jamais le code de sortie.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { serviceRoleClient, anonClient } from './helpers/supabase'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { execSql } from './helpers/local-sql'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const PW = 'Test-Password-123!'
const DENIED = '42501'

describe.skipIf(!HAS_KEYS)('garde super-admin sur les lectures d\'agrégats par agence (bloquant 0.2)', () => {
  let setup: TwoAgenciesSetup
  let superClient: SupabaseClient
  const extraUserIds: string[] = []

  beforeAll(async () => {
    setup = await setupTwoAgencies()

    // role super_admin non attribuable via user_metadata (à raison) → upsert manuel par
    // le service_role, même motif que agency-review-queue.spec.ts. Le domaine
    // @megga-test.local passe super_admin_allowlist_match via la clé app_config posée par
    // setupTwoAgencies().
    const svc = serviceRoleClient()
    const email = `secdef-guard-super-${setup.stamp}@megga-test.local`
    const { data, error } = await svc.auth.admin.createUser({
      email, password: PW, email_confirm: true,
      user_metadata: { full_name: `Super ${setup.stamp}`, role: 'agent' },
    })
    if (error) throw new Error(`createUser super_admin: ${error.message}`)
    extraUserIds.push(data.user!.id)
    const { error: pErr } = await svc
      .from('profiles')
      .upsert(
        { id: data.user!.id, email, full_name: `Super ${setup.stamp}`, role: 'super_admin', agency_id: null },
        { onConflict: 'id' }
      )
    if (pErr) throw new Error(`profile super_admin: ${pErr.message}`)
    superClient = anonClient()
    const { error: signInErr } = await superClient.auth.signInWithPassword({ email, password: PW })
    if (signInErr) throw new Error(`signin super_admin: ${signInErr.message}`)
  })

  afterAll(async () => {
    if (setup) await setup.cleanup()
    const svc = serviceRoleClient()
    for (const id of extraUserIds) await svc.auth.admin.deleteUser(id).then(() => {}, () => {})
  })

  // ── 1. Un agent est refusé, y compris sur sa propre agence ──────────────────────

  it('un agent ne peut pas lire les jalons d\'activation d\'une agence tierce', async () => {
    const { error } = await setup.clientA.rpc('get_onboarding_milestones', { agency_ids: [setup.agencyBId] })
    expect(error, 'la fuite inter-tenant doit être fermée').not.toBeNull()
    expect(error?.code, 'refus attendu = 42501, posé par la garde interne').toBe(DENIED)
  })

  it('un agent ne peut pas lire les jalons d\'activation de SA PROPRE agence non plus', async () => {
    // La garde est « super-admin », pas « ma propre agence » : cette RPC n'a jamais été
    // destinée à un agent. Si un jour quelqu'un la « corrige » en filtre d'agence, ce test
    // tombe et signale le changement de contrat.
    const { error } = await setup.clientA.rpc('get_onboarding_milestones', { agency_ids: [setup.agencyAId] })
    expect(error?.code).toBe(DENIED)
  })

  it('un agent ne peut pas lire le résumé d\'activité d\'une agence tierce', async () => {
    const { error } = await setup.clientA.rpc('get_agency_activity_summary', {
      agency_ids: [setup.agencyBId], since_days: 30,
    })
    expect(error?.code).toBe(DENIED)
  })

  it('un agent ne peut pas lire le résumé d\'activité de SA PROPRE agence non plus', async () => {
    const { error } = await setup.clientA.rpc('get_agency_activity_summary', { agency_ids: [setup.agencyAId] })
    expect(error?.code).toBe(DENIED)
  })

  // ── 2. Un visiteur anonyme est refusé ───────────────────────────────────────────

  it('un visiteur anonyme est refusé sur les deux RPC', async () => {
    const anon = anonClient()
    const milestones = await anon.rpc('get_onboarding_milestones', { agency_ids: [setup.agencyAId] })
    expect(milestones.error, 'anon ne doit rien obtenir').not.toBeNull()
    const summary = await anon.rpc('get_agency_activity_summary', { agency_ids: [setup.agencyAId] })
    expect(summary.error).not.toBeNull()
  })

  // ── 3. Les deux chemins légitimes restent ouverts ───────────────────────────────
  //
  // Sans ces deux tests, la migration pourrait murer la console avec l'agent et la suite
  // resterait verte : un refus est facile à obtenir, c'est la sélectivité de la garde qui
  // doit être prouvée.

  it('un super-admin lit les jalons et le résumé', async () => {
    const milestones = await superClient.rpc('get_onboarding_milestones', {
      agency_ids: [setup.agencyAId, setup.agencyBId],
    })
    expect(milestones.error, 'le super-admin ne doit pas être gêné par la garde').toBeNull()
    expect(Array.isArray(milestones.data) ? milestones.data.length : 0).toBe(2)

    const summary = await superClient.rpc('get_agency_activity_summary', {
      agency_ids: [setup.agencyAId], since_days: 30,
    })
    expect(summary.error).toBeNull()
  })

  it('le service_role lit les jalons (chemin cron/edge)', async () => {
    const { data, error } = await serviceRoleClient().rpc('get_onboarding_milestones', {
      agency_ids: [setup.agencyAId],
    })
    expect(error, 'is_service_role() est le second terme de la garde').toBeNull()
    expect(Array.isArray(data) ? data.length : 0).toBe(1)
  })

  // ── 4. Résidu S17 : les deux écritures de masse ne sont plus ouvertes ───────────
  //
  // Mesuré par has_function_privilege plutôt qu'en appelant les fonctions : les appeler
  // déclencherait un UPDATE de masse sur agency_profiles, et suppress_agency_logo_collisions
  // dépend de pg_trgm — deux façons de rendre le test fragile pour une preuve plus faible.
  // execSql ne rend pas de résultat : on lève côté SQL, l'absence d'exception EST l'assertion.

  it('realadvisor_fill_agency_logos n\'est plus exécutable par anon ni authenticated', () => {
    expect(() => execSql(`
      do $$
      begin
        if has_function_privilege('anon', 'public.realadvisor_fill_agency_logos()', 'EXECUTE') then
          raise exception 'anon a encore EXECUTE sur realadvisor_fill_agency_logos()';
        end if;
        if has_function_privilege('authenticated', 'public.realadvisor_fill_agency_logos()', 'EXECUTE') then
          raise exception 'authenticated a encore EXECUTE sur realadvisor_fill_agency_logos()';
        end if;
        if not has_function_privilege('service_role', 'public.realadvisor_fill_agency_logos()', 'EXECUTE') then
          raise exception 'service_role a perdu EXECUTE : le cron RealAdvisor est cassé';
        end if;
      end $$;
    `)).not.toThrow()
  })

  it('suppress_agency_logo_collisions n\'est plus exécutable par anon ni authenticated', () => {
    expect(() => execSql(`
      do $$
      begin
        if has_function_privilege('anon', 'public.suppress_agency_logo_collisions(real)', 'EXECUTE') then
          raise exception 'anon a encore EXECUTE sur suppress_agency_logo_collisions(real)';
        end if;
        if has_function_privilege('authenticated', 'public.suppress_agency_logo_collisions(real)', 'EXECUTE') then
          raise exception 'authenticated a encore EXECUTE sur suppress_agency_logo_collisions(real)';
        end if;
        if not has_function_privilege('service_role', 'public.suppress_agency_logo_collisions(real)', 'EXECUTE') then
          raise exception 'service_role a perdu EXECUTE : le sweep de logos est cassé';
        end if;
      end $$;
    `)).not.toThrow()
  })
})
