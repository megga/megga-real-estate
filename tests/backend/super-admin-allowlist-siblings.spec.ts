// S8, volet SQL — le rôle super_admin ne suffit plus nulle part en base
// (migration 20260913160000_super_admin_allowlist_siblings.sql).
//
// Cinq objets de production testaient `profiles.role = 'super_admin'` SANS l'allowlist
// d'e-mail : trois policies (agent_ai_profiles_select_own, admin_feature_flags_write,
// admin_nps_select_admin) et les deux triggers de rétention KYC (enforce_kyc_cases_retention,
// enforce_kyc_magic_links_retention). Ils passent tous par `is_super_admin()` — rôle ET
// e-mail d'authentification allowlisté.
//
// DEUX MESURES, parce qu'aucune ne suffit seule (même raisonnement que
// admin-rpc-guard-sweep.spec.ts) :
//   1. STATIQUE, exhaustive — aucune policy ni fonction de `public` ne compare le rôle au
//      littéral 'super_admin' sans appeler is_super_admin() ou super_admin_allowlist_match.
//      Couvre l'objet de demain, qu'aucune liste ne nommerait.
//   2. COMPORTEMENTALE — un titulaire du rôle HORS allowlist (domaine @megga-cible.local,
//      que `super_admin_test_domain` ne couvre pas) est refusé, et un super-admin allowlisté
//      (@megga-test.local) passe. Sans le second, un refus universel rendrait le premier vert.
//      Chaque sonde tourne dans une transaction annulée : rien ne subsiste.
//
//  @sql-blocks-check — ce fichier est analysé par scripts/check-spec-sql-blocks.mjs : chaque
//  corps porte son propre `begin … end`, le wrapper n'en ferme aucun.
//
// ⚠ ÉCRIT SANS PILE LOCALE (pas de Docker sur le poste de rédaction, 13.09.2026) : relu et
// type-vérifié, jamais exécuté avant son premier passage dans backend.yml. skipIf(!HAS_KEYS)
// ne SKIP PAS en CI — lire le NOMBRE de tests exécutés, jamais le code de sortie.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execSql } from './helpers/local-sql'
import { serviceRoleClient } from './helpers/supabase'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const PASSWORD = 'Test-Password-123!'

/**
 * Le corps porte son bloc complet (`begin … end`). Il s'exécute dans une transaction
 * ANNULÉE : les semis, les changements de rôle et les suppressions disparaissent avec elle.
 * Une assertion fausse lève dans le DO, psql s'arrête (ON_ERROR_STOP) et le test échoue.
 */
const runSql = (body: string) => execSql(`begin;\ndo $$\n${body}\n$$;\nrollback;`)
const assertSql = (body: string) => expect(() => runSql(body), 'assertion SQL').not.toThrow()

/** Même motif que le balayage qui a trouvé les cinq objets le 13.09.2026. */
const MOTIF_ROLE = `role[^;]{0,40}''super_admin''|''super_admin''[^;]{0,40}role`

/** Pose l'appelant vu par auth.uid() (le GUC traverse les changements de rôle). */
const appelant = (id: string) =>
  `perform set_config('request.jwt.claims', json_build_object('sub', '${id}', 'role', 'authenticated')::text, true);`

describe.skipIf(!HAS_KEYS)('S8 — le rôle super_admin seul n’ouvre plus rien en base', () => {
  let setup: TwoAgenciesSetup
  let imposteurId = ''

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const service = serviceRoleClient()

    // agentB = super-admin LÉGITIME de la CI : e-mail @megga-test.local, couvert par
    // super_admin_test_domain (posé par setupTwoAgencies).
    const { error: promoteErr } = await service.from('profiles').update({ role: 'super_admin' }).eq('id', setup.agentBId)
    if (promoteErr) throw new Error(`promotion agentB: ${promoteErr.message}`)

    // L'imposteur : rôle super_admin posé en base — ce que l'INSERT client permettait —,
    // e-mail HORS allowlist.
    const email = `imposteur-${setup.stamp}@megga-cible.local`
    const { data, error } = await service.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: 'Imposteur', role: 'buyer' },
    })
    if (error || !data.user) throw new Error(`imposteur: ${error?.message ?? 'aucun utilisateur rendu'}`)
    imposteurId = data.user.id
    const { error: roleErr } = await service.from('profiles').update({ role: 'super_admin' }).eq('id', imposteurId)
    if (roleErr) throw new Error(`rôle de l'imposteur: ${roleErr.message}`)
  })

  afterAll(async () => {
    const service = serviceRoleClient()
    if (imposteurId) await service.auth.admin.deleteUser(imposteurId).catch(() => {})
    if (setup) {
      await service.from('profiles').update({ role: 'agent' }).eq('id', setup.agentBId).then(() => {}, () => {})
      await setup.cleanup()
    }
  })

  it('STATIQUE — aucune policy ni fonction de public ne teste le rôle super_admin seul', () => {
    assertSql(`
    declare v_pol text; v_fn text; v_n int;
    begin
      select string_agg(tablename || '.' || policyname, ', ') into v_pol
        from pg_policies
       where schemaname = 'public'
         and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) like '%''super_admin''%'
         and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) not like '%is_super_admin%';
      if v_pol is not null then
        raise exception 'policies sur le rôle seul : %', v_pol;
      end if;

      select string_agg(p.proname, ', ') into v_fn
        from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public'
         and p.prosrc ~* '${MOTIF_ROLE}'
         and p.prosrc not ilike '%is_super_admin%'
         and p.prosrc not ilike '%super_admin_allowlist_match%';
      if v_fn is not null then
        raise exception 'fonctions sur le rôle seul : %', v_fn;
      end if;

      -- Anti-vacuité : le catalogue porte bien des policies sur is_super_admin() (au moins
      -- les trois de 20260913160000), et le motif reconnaît la forme antérieure.
      -- (Aucune apostrophe dans ces commentaires : scripts/check-spec-sql-blocks.mjs retire
      -- les chaînes AVANT les commentaires, et une apostrophe y ouvrirait une chaîne.)
      select count(*) into v_n from pg_policies
       where schemaname = 'public'
         and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) like '%is_super_admin()%';
      if v_n < 3 then
        raise exception 'périmètre suspect : % policies sur is_super_admin(), 3 au moins attendues', v_n;
      end if;
      if not ('COALESCE(v_user_role, '''') <> ''super_admin''' ~* '${MOTIF_ROLE}') then
        raise exception 'le motif ne reconnaît plus un contournement par rôle seul';
      end if;
    end;`)
  })

  it('agent_ai_profiles — l’imposteur ne lit plus le profil IA d’un autre agent ; le super-admin allowlisté, si', () => {
    assertSql(`
    declare v_n int;
    begin
      insert into public.agent_ai_profiles (agent_id, agency_id)
      values ('${setup.agentAId}', '${setup.agencyAId}')
      on conflict (agent_id) do nothing;

      ${appelant(imposteurId)}
      set local role authenticated;
      select count(*) into v_n from public.agent_ai_profiles where agent_id = '${setup.agentAId}';
      reset role;
      if v_n <> 0 then
        raise exception 'super_admin hors allowlist : % profil(s) IA d''un autre agent visible(s)', v_n;
      end if;

      -- Contrôle positif : la policy reste ouverte au super-admin allowlisté.
      ${appelant(setup.agentBId)}
      set local role authenticated;
      select count(*) into v_n from public.agent_ai_profiles where agent_id = '${setup.agentAId}';
      reset role;
      if v_n <> 1 then
        raise exception 'super-admin allowlisté : % profil(s) IA visible(s), 1 attendu', v_n;
      end if;
    end;`)
  })

  it('admin_feature_flags — l’imposteur n’écrit pas un drapeau de plateforme ; le super-admin allowlisté, si', () => {
    assertSql(`
    declare v_ecrit boolean;
    begin
      ${appelant(imposteurId)}
      set local role authenticated;
      begin
        insert into public.admin_feature_flags (key, label) values ('s8-sonde-imposteur', 'Sonde S8');
        v_ecrit := true;
      exception when insufficient_privilege then
        v_ecrit := false;
      end;
      reset role;
      if v_ecrit then
        raise exception 'super_admin hors allowlist a écrit un drapeau de plateforme';
      end if;

      -- Contrôle positif : un refus universel rendrait la ligne ci-dessus verte pour rien.
      ${appelant(setup.agentBId)}
      set local role authenticated;
      insert into public.admin_feature_flags (key, label) values ('s8-sonde-console', 'Sonde S8');
      reset role;
    end;`)
  })

  it('admin_nps_responses — l’imposteur ne lit aucune réponse ; le super-admin allowlisté les lit', () => {
    assertSql(`
    declare v_n int;
    begin
      insert into public.admin_nps_responses (rating, comment) values (5, 'sonde S8');

      ${appelant(imposteurId)}
      set local role authenticated;
      select count(*) into v_n from public.admin_nps_responses where comment = 'sonde S8';
      reset role;
      if v_n <> 0 then
        raise exception 'super_admin hors allowlist : % réponse(s) NPS visible(s)', v_n;
      end if;

      ${appelant(setup.agentBId)}
      set local role authenticated;
      select count(*) into v_n from public.admin_nps_responses where comment = 'sonde S8';
      reset role;
      if v_n < 1 then
        raise exception 'super-admin allowlisté : la réponse NPS semée est invisible';
      end if;
    end;`)
  })

  it('rétention KYC — l’imposteur ne contourne plus le verrou LBA ; le super-admin allowlisté, si (et c’est journalisé)', () => {
    // Suppression sous postgres (la RLS ne s'interpose pas) avec l'appelant posé dans le GUC :
    // c'est le TRIGGER seul qui décide, et c'est lui qu'on éprouve.
    assertSql(`
    declare v_case uuid; v_msg text; v_n int;
    begin
      insert into public.kyc_cases (agency_id, type) values ('${setup.agencyAId}', 'buyer_pp')
      returning id into v_case;

      ${appelant(imposteurId)}
      begin
        delete from public.kyc_cases where id = v_case;
        v_msg := 'supprimé';
      exception when others then
        v_msg := sqlerrm;
      end;
      if v_msg not like '%interdite avant%' then
        raise exception 'super_admin hors allowlist : suppression d''un dossier KYC récent → % (refus LBA attendu)', v_msg;
      end if;

      -- Contrôle positif : le contournement légitime existe toujours, et laisse sa trace.
      ${appelant(setup.agentBId)}
      delete from public.kyc_cases where id = v_case;
      select count(*) into v_n from public.kyc_cases where id = v_case;
      if v_n <> 0 then
        raise exception 'super-admin allowlisté : le dossier KYC n''a pas été supprimé';
      end if;
      select count(*) into v_n from public.activity_events
       where entity_id = v_case and metadata->>'reason' = 'super_admin_override';
      if v_n <> 1 then
        raise exception 'contournement de rétention non journalisé (% ligne(s))', v_n;
      end if;
    end;`)
  })
})
