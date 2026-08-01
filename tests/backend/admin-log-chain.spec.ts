// Backend integration spec (live CI) — registre `admin_log` : chaîne de hash, append-only,
// privilèges (migration 20260801210500_admin_log.sql, étape 2 du plan, spec §4.2/§5.9/§10.2).
//
// Ce fichier porte le critère de sortie G0 du plan : « ligne altérée en SQL brut → la
// vérification échoue ». Il porte aussi son pendant, plus important encore : la vérification
// ne doit JAMAIS rendre « intacte » sur un ensemble vide — c'est le motif de vert creux qui a
// déjà mordu ce dépôt (fiche `project_silent_seed_vacuous_tests`).
//
// La chaîne est GLOBALE : toutes les assertions de compte sont relatives (avant/après),
// jamais absolues, parce que les fichiers de specs tournent en parallèle contre la même base.
//
// Le test d'altération répare ce qu'il casse, et re-vérifie que la chaîne redevient `ok` :
// sans cette remise en état, il empoisonnerait tous les autres fichiers de la suite, et un
// vert n'y prouverait plus rien.
//
// skipIf(!HAS_KEYS) ne SKIP PAS en CI — lire le compte de tests, jamais le code de sortie.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { serviceRoleClient, anonClient } from './helpers/supabase'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { execSql } from './helpers/local-sql'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const PW = 'Test-Password-123!'
const DENIED = '42501'

/** execSql ne rend pas de résultat : on lève côté SQL, l'absence d'exception EST l'assertion. */
function assertSql(body: string): void {
  execSql(`do $$\nbegin\n${body}\nend $$;`)
}

describe.skipIf(!HAS_KEYS)('admin_log — registre chaîné append-only (étape 2)', () => {
  let setup: TwoAgenciesSetup
  let superClient: SupabaseClient
  const extraUserIds: string[] = []

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const svc = serviceRoleClient()
    const email = `admin-log-super-${setup.stamp}@megga-test.local`
    const { data, error } = await svc.auth.admin.createUser({
      email, password: PW, email_confirm: true,
      user_metadata: { full_name: `Super ${setup.stamp}`, role: 'agent' },
    })
    if (error) throw new Error(`createUser super_admin: ${error.message}`)
    extraUserIds.push(data.user!.id)
    const { error: pErr } = await svc.from('profiles').upsert(
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

  // ── 1. Écriture et chaînage ────────────────────────────────────────────────────

  it('un super-admin écrit une ligne, chaînée sur la tête précédente', async () => {
    // Lecture par `superClient`, jamais par le service_role : celui-ci s'est vu révoquer
    // SELECT sur les quatre tables du registre. `rolbypassrls` ne contourne que la RLS,
    // jamais un GRANT — c'est délibéré, la console lit en authenticated sous RLS.
    const before = await superClient.from('admin_log_chain_head').select('seq_max, rows_count, head_hash').single()
    expect(before.error, 'un super-admin lit la tête de chaîne').toBeNull()

    const { data: id, error } = await superClient.rpc('admin_log_write', {
      p_family: 'ops', p_action: 'test_write', p_severity: 'info',
      p_entity_type: 'test', p_entity_label: `spec ${setup.stamp}`,
      p_metadata: [{ l: 'Motif', v: 'spec' }, { l: 'Portée', v: 'test' }],
    })
    expect(error, 'un super-admin doit pouvoir écrire').toBeNull()
    expect(id).toBeTruthy()

    const { data: row } = await superClient.from('admin_log').select('*').eq('id', id).single()
    expect(row?.seq, 'le rang suit la tête précédente').toBe(Number(before.data!.seq_max) + 1)
    expect(row?.prev_hash, 'la ligne chaîne sur le hash de tête').toBe(before.data!.head_hash)
    expect(row?.hash).toMatch(/^[0-9a-f]{64}$/)
    expect(row?.actor_label, 'le libellé est un nom, jamais un e-mail brut').toBe(`Super ${setup.stamp}`)

    const after = await superClient.from('admin_log_chain_head').select('seq_max, rows_count, head_hash, last_event_ts').single()
    expect(after.data!.head_hash, 'la tête avance').toBe(row?.hash)
    expect(Number(after.data!.rows_count)).toBe(Number(before.data!.rows_count) + 1)
  })

  it('l\'ordre des paires de metadata est conservé — un objet jsonb le perdrait', async () => {
    // Ordre volontairement contraire au tri jsonb (longueur puis octets) : un objet
    // rendrait « Conséquence » avant « Champ modifié », donc la conséquence avant le fait.
    const pairs = [
      { l: 'Champ modifié', v: 'a' },
      { l: 'Conséquence', v: 'b' },
      { l: 'Agence prévenue', v: 'c' },
      { l: 'Confirmation', v: 'd' },
    ]
    const { data: id, error } = await superClient.rpc('admin_log_write', {
      p_family: 'ops', p_action: 'test_metadata_order', p_metadata: pairs,
    })
    expect(error).toBeNull()
    const { data: row } = await superClient.from('admin_log').select('metadata').eq('id', id).single()
    expect(row?.metadata, 'l\'ordre écrit est l\'ordre relu').toEqual(pairs)
  })

  it('un metadata en OBJET est refusé — l\'écran consomme un tableau ordonné', async () => {
    const { error } = await superClient.rpc('admin_log_write', {
      p_family: 'ops', p_action: 'test_metadata_object', p_metadata: { Motif: 'x' },
    })
    expect(error, 'jsonb objet doit être refusé').not.toBeNull()
  })

  // ── 2. Gardes d'accès ──────────────────────────────────────────────────────────

  it('un agent ne peut ni écrire ni lire le registre', async () => {
    const { error } = await setup.clientA.rpc('admin_log_write', {
      p_family: 'ops', p_action: 'test_agent',
    })
    expect(error?.code, 'la garde doit refuser un JWT agent').toBe(DENIED)

    const { data } = await setup.clientA.from('admin_log').select('id').limit(1)
    expect(data ?? [], 'la RLS ne laisse rien voir à un agent').toHaveLength(0)
  })

  it('la vérification n\'est pas exposée à la console (grant service_role seul)', async () => {
    const { error } = await superClient.rpc('admin_log_verify_chain', {})
    expect(error, 'un JWT super-admin ne doit pas pouvoir appeler verify_chain').not.toBeNull()
  })

  it('les privilèges par défaut de Supabase sont bien révoqués', () => {
    assertSql(`
      if has_table_privilege('service_role', 'public.admin_log', 'INSERT') then
        raise exception 'service_role conserve INSERT : une ligne forgee hors RPC serait chainee';
      end if;
      if has_table_privilege('authenticated', 'public.admin_log', 'INSERT')
         or has_table_privilege('anon', 'public.admin_log', 'INSERT') then
        raise exception 'INSERT direct encore ouvert';
      end if;
      if has_table_privilege('anon', 'public.admin_log', 'SELECT') then
        raise exception 'anon peut lire le registre';
      end if;
      if not has_table_privilege('authenticated', 'public.admin_log', 'SELECT') then
        raise exception 'authenticated a perdu SELECT : la RLS ne peut plus filtrer';
      end if;
      if has_function_privilege('anon', 'public.admin_log_write(text,text,text,text,text,uuid,text,uuid,jsonb,jsonb,boolean,inet,text,text)', 'EXECUTE') then
        raise exception 'admin_log_write est appelable sans authentification';
      end if;
      if has_function_privilege('authenticated', 'public.admin_log_verify_chain(bigint, bigint)', 'EXECUTE') then
        raise exception 'verify_chain est exposee a la console';
      end if;
    `)
  })

  // ── 3. Append-only : les trois portes ──────────────────────────────────────────

  it('UPDATE, DELETE et TRUNCATE sont refusés en 42501', () => {
    assertSql(`
      declare v_sqlstate text;
      begin
        begin
          update public.admin_log set action = 'altere' where seq = (select max(seq) from public.admin_log);
          raise exception 'UPDATE a ete accepte';
        exception when others then
          get stacked diagnostics v_sqlstate = returned_sqlstate;
          if v_sqlstate <> '${DENIED}' then raise exception 'UPDATE: attendu ${DENIED}, recu %', v_sqlstate; end if;
        end;
        begin
          delete from public.admin_log where seq = (select max(seq) from public.admin_log);
          raise exception 'DELETE a ete accepte';
        exception when others then
          get stacked diagnostics v_sqlstate = returned_sqlstate;
          if v_sqlstate <> '${DENIED}' then raise exception 'DELETE: attendu ${DENIED}, recu %', v_sqlstate; end if;
        end;
        begin
          truncate public.admin_log;
          raise exception 'TRUNCATE a ete accepte (activity_events n a pas ce filet)';
        exception when others then
          get stacked diagnostics v_sqlstate = returned_sqlstate;
          if v_sqlstate <> '${DENIED}' then raise exception 'TRUNCATE: attendu ${DENIED}, recu %', v_sqlstate; end if;
        end;
      end;
    `)
  })

  it('une ligne pré-hachée par l\'appelant est refusée', () => {
    assertSql(`
      declare v_sqlstate text;
      begin
        begin
          insert into public.admin_log (seq, severity, family, action, actor_label, prev_hash, hash)
            values (999999, 'info', 'ops', 'forge', 'Système', repeat('0',64), repeat('a',64));
          raise exception 'une ligne pre-hachee a ete acceptee';
        exception when others then
          get stacked diagnostics v_sqlstate = returned_sqlstate;
          if v_sqlstate <> '${DENIED}' then raise exception 'attendu ${DENIED}, recu %', v_sqlstate; end if;
        end;
      end;
    `)
  })

  it('deux lignes dans une seule INSTRUCTION se chaînent correctement, sans fourche', () => {
    // Le rétro-branchement des gestes existants s'écrit naturellement `insert … select`, et
    // les lignes d'une même instruction ne se voient pas : avec une tête lue par
    // `order by seq desc limit 1` sur la table, elles hériteraient TOUTES du même prev_hash.
    // Ici la tête vit dans admin_log_chain_head, que le trigger de la première ligne a déjà
    // avancée quand la seconde le lit — la fourche n'existe pas par construction. Ce test
    // prouve la propriété plutôt que le garde-fou, et `unique(prev_hash)` reste le filet
    // qui la ferait échouer bruyamment si quelqu'un revenait un jour à la lecture sur table.
    assertSql(`
      declare
        v_a record;
        v_b record;
      begin
        insert into public.admin_log (severity, family, action, actor_label)
          select 'info', 'ops', a, 'Système' from (values ('fork_probe_a'), ('fork_probe_b')) t(a);

        select seq, prev_hash, hash into v_a from public.admin_log where action = 'fork_probe_a';
        select seq, prev_hash, hash into v_b from public.admin_log where action = 'fork_probe_b';

        if v_a.prev_hash = v_b.prev_hash then
          raise exception 'FOURCHE : deux lignes d une meme instruction partagent prev_hash';
        end if;
        if v_b.seq <> v_a.seq + 1 then
          raise exception 'rangs non consecutifs : % puis %', v_a.seq, v_b.seq;
        end if;
        if v_b.prev_hash <> v_a.hash then
          raise exception 'la seconde ligne ne chaine pas sur la premiere';
        end if;
        if public.admin_log_verify_chain()->>'status' <> 'ok' then
          raise exception 'la chaine est rompue apres un insert multi-lignes';
        end if;
      end;
    `)
  })

  // ── 4. Vérification ────────────────────────────────────────────────────────────

  it('la chaîne est intacte, et le verdict porte son compte de lignes', async () => {
    const { data, error } = await serviceRoleClient().rpc('admin_log_verify_chain', {})
    expect(error).toBeNull()
    expect(data?.status).toBe('ok')
    expect(Number(data?.rows_checked), 'un verdict sans lignes relues ne prouve rien').toBeGreaterThan(0)
    expect(data?.rls, 'RLS activée').toBe(true)
    expect(data?.forced_rls, 'FORCE RLS casserait l\'écriture et la vérification').toBe(false)
    expect(Number(data?.triggers), '4 triggers actifs : chaînage + update + delete + truncate').toBe(4)
    expect(Number(data?.policies)).toBe(1)
  })

  it('le hash ne dépend pas du fuseau ni du format de date de la session', () => {
    // Sans le to_char explicite en UTC, un timestamptz se rend dans le fuseau de la session :
    // la vérification recalculerait un hash différent et crierait à la falsification.
    assertSql(`
      declare v_res jsonb;
      begin
        set local time zone 'Pacific/Kiritimati';
        set local datestyle to 'SQL, DMY';
        v_res := public.admin_log_verify_chain();
        if v_res->>'status' <> 'ok' then
          raise exception 'chaine declaree % sous un fuseau hostile', v_res->>'status';
        end if;
      end;
    `)
  })

  it('G0 — une ligne altérée en SQL brut casse la vérification, puis la réparation la restaure', () => {
    // UPDATE étant refusé, la seule altération possible passe par une désactivation
    // explicite du trigger : sans elle, ce test ne prouverait rien.
    assertSql(`
      declare
        v_seq bigint;
        v_old text;
        v_res jsonb;
      begin
        select seq, action into v_seq, v_old from public.admin_log order by seq desc limit 1;

        alter table public.admin_log disable trigger admin_log_no_update;
        update public.admin_log set action = 'altere_par_le_test' where seq = v_seq;
        alter table public.admin_log enable trigger admin_log_no_update;

        v_res := public.admin_log_verify_chain();
        if v_res->>'status' <> 'broken' then
          raise exception 'une ligne alteree n a pas casse la verification (statut %)', v_res->>'status';
        end if;
        if (v_res->>'break_at')::bigint <> v_seq then
          raise exception 'rupture signalee au rang % au lieu de %', v_res->>'break_at', v_seq;
        end if;

        -- Remise en état : sans elle, tout le reste de la suite hériterait d'une chaîne rompue.
        alter table public.admin_log disable trigger admin_log_no_update;
        update public.admin_log set action = v_old where seq = v_seq;
        alter table public.admin_log enable trigger admin_log_no_update;

        v_res := public.admin_log_verify_chain();
        if v_res->>'status' <> 'ok' then
          raise exception 'la chaine n a pas ete restauree (statut %)', v_res->>'status';
        end if;
      end;
    `)
  })

  it('une vérification sur zéro ligne rend « no_rows », jamais « ok »', async () => {
    // Une marche de chaîne sur un ensemble vide ne rencontre aucune rupture : sans ce
    // verdict distinct, le vert quotidien serait décoratif.
    const { data, error } = await serviceRoleClient().rpc('admin_log_verify_chain', {
      p_from: 9_000_000_000,
    })
    expect(error).toBeNull()
    expect(data?.status).toBe('no_rows')
    expect(Number(data?.rows_checked)).toBe(0)
  })

  // ── 5. Contrat d'écran ─────────────────────────────────────────────────────────

  it('la vérification planifiée ne devient pas « le dernier événement »', async () => {
    const before = await superClient.from('admin_log_chain_head').select('last_event_ts, rows_count').single()
    expect(before.error).toBeNull()

    // Le job tourne en session_user = postgres sans JWT : c'est le contexte de pg_cron,
    // celui qu'une garde is_super_admin() OR is_service_role() refuserait.
    execSql('select public.admin_log_chain_verify_job();')

    const after = await superClient.from('admin_log_chain_head').select('last_event_ts, rows_count').single()
    expect(Number(after.data!.rows_count), 'la ligne ops a bien été écrite').toBe(Number(before.data!.rows_count) + 1)
    expect(after.data!.last_event_ts, '`last` doit rester le dernier GESTE, pas la vérification')
      .toBe(before.data!.last_event_ts)

    const { data: row } = await superClient
      .from('admin_log')
      .select('family, action, routine, severity')
      .order('seq', { ascending: false })
      .limit(1)
      .single()
    expect(row?.action).toBe('admin_log_chain_verified')
    expect(row?.routine, 'une vérification saine est de la routine — elle se replie en pied').toBe(true)
    expect(row?.severity, 'et elle n\'est pas critique').toBe('info')
  })

  it('UN REGISTRE VIDE N\'EST PAS UNE RUPTURE — sauf s\'il attendait des lignes', () => {
    // MESURÉ EN PRODUCTION : `admin_log` porte 7 lignes de contrôle, dont exactement une en
    // `crit` — la PREMIÈRE, écrite quand le registre était encore vide
    // (`{Statut: no_rows, Lignes relues: 0, Rupture: aucune}`). La chaîne n'a jamais été
    // rompue ; c'est le job qui traduisait mal, avec
    //     case when status = 'ok' then 'info' else 'crit' end
    // — donc TOUT ce qui n'est pas `ok` devient critique. Or le vérificateur rend TROIS
    // statuts, et le troisième est délibéré : « une marche sur zéro ligne ne rencontre
    // aucune rupture : ne JAMAIS rendre ok ». Cette prudence est juste chez lui ; le job la
    // lisait comme un aveu. « Rien à vérifier » n'est pas « quelqu'un a touché au registre ».
    //
    // ⚠ POURQUOI CE TEST EST STATIQUE, et c'est assumé : éprouver le chemin `no_rows`
    // demanderait un `admin_log` VIDE, impossible en CI — les autres specs y écrivent, et la
    // table est append-only (UPDATE/DELETE/TRUNCATE refusés en 42501, cf. plus haut). Le
    // chemin NOMINAL, lui, est éprouvé pour de bon par le test juste au-dessus, qui appelle
    // réellement le job et vérifie `routine`/`severity`.
    //
    // Les commentaires sont retirés avant la recherche : un contrôle de position ou de
    // présence sur `prosrc` lit aussi la prose du correctif, qui décrit forcément le défaut
    // avec les mots du défaut (piège n°10 du §6, payé une passe de CI).
    execSql(`do $$
    declare v_src text;
    begin
      select regexp_replace(p.prosrc, '--[^\\n]*', '', 'g') into v_src
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'admin_log_chain_verify_job';
      if v_src is null then
        raise exception 'admin_log_chain_verify_job introuvable : test creux';
      end if;

      if position('no_rows' in v_src) = 0 then
        raise exception E'Le job ne distingue pas le statut no_rows.\\n'
          '  Tout ce qui n est pas ok devient alors critique, et un registre NEUF est\\n'
          '  signale comme une rupture. Une alerte qui part pour rien finit par ne plus\\n'
          '  etre lue, ce qui coute plus cher que de n en avoir aucune.';
      end if;

      -- La distinction ne vaut que si elle s'appuie sur le compte ATTENDU : sans lui, on ne
      -- peut pas separer « registre neuf » de « registre VIDE », qui est un effacement.
      if position('rows_count' in v_src) = 0 then
        raise exception E'Le job ignore le compte attendu (head_row.rows_count).\\n'
          '  Sans lui, un registre EFFACE se lit comme un registre neuf : le cas le plus\\n'
          '  grave que ce controle existe pour attraper deviendrait le plus silencieux.';
      end if;
    end $$;`)
  })

  it('le service_role ne lit PAS le registre — posture délibérée', () => {
    // rolbypassrls ne contourne que la RLS, jamais un GRANT. Les edges qui auraient besoin
    // du registre passent par une fonction SECURITY DEFINER, jamais par un SELECT direct.
    assertSql(`
      if has_table_privilege('service_role', 'public.admin_log', 'SELECT') then
        raise exception 'service_role a retrouve SELECT sur le registre';
      end if;
      if has_table_privilege('service_role', 'public.admin_log_chain_head', 'SELECT') then
        raise exception 'service_role a retrouve SELECT sur la tete de chaine';
      end if;
    `)
  })

  it('les vocabulaires sévérité et famille sont disjoints — l\'écran n\'a qu\'un filtre', () => {
    assertSql(`
      if exists (select 1 from public.admin_log_severity s join public.admin_log_family f on f.code = s.code) then
        raise exception 'un code est a la fois une severite et une famille : le filtre unique de l ecran serait ambigu';
      end if;
      if (select count(*) from public.admin_log_family) <> 12 then
        raise exception '12 familles attendues (spec 4.2), impers exclue (retiree de la V1)';
      end if;
      if exists (select 1 from public.admin_log_family where code = 'impers') then
        raise exception 'impers est retiree de la V1 (spec 1)';
      end if;
    `)
  })

  it('une famille inconnue est refusée par la clé étrangère', async () => {
    const { error } = await superClient.rpc('admin_log_write', {
      p_family: 'impers', p_action: 'test_famille_inconnue',
    })
    expect(error, 'la famille doit être contrainte').not.toBeNull()
  })
})
