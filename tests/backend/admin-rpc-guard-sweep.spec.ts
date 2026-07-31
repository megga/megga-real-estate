// Backend integration spec (live CI) — balayage systématique des RPC admin sous JWT agent.
//
// Troisième critère de sortie du gate G0 : « un JWT agent reçoit `unauthorized` sur toute
// route admin ». Le vérifier RPC par RPC à la main ne prouve rien de durable — la surface
// bouge, et c'est précisément une RPC oubliée qui produit le défaut. Ce fichier DÉCOUVRE
// les fonctions au lieu de les lister : toute RPC admin ajoutée demain entre
// automatiquement dans le balayage, et y échoue si elle est nue.
//
// Ce n'est pas un exercice théorique. L'inventaire du socle a mesuré deux fonctions
// SECURITY DEFINER, accordées à `authenticated`, SANS aucune garde ni filtre d'agence —
// `get_onboarding_milestones` et `get_agency_activity_summary` — que la remédiation du
// 17.07 avait manquées et que la spec citait comme sources de la console. Elles sont
// fermées depuis (20260731190000). Ce test est ce qui empêche la troisième.
//
// DEUX MESURES, parce qu'aucune ne suffit seule :
//   1. STATIQUE, exhaustive — toute fonction admin joignable par `authenticated` porte une
//      garde dans son corps. Couvre celles qu'on ne peut pas appeler sans effet de bord.
//   2. COMPORTEMENTALE — la garde se DÉCLENCHE réellement sous un rôle sans JWT. Une garde
//      présente dans le source n'est pas une garde qui refuse : le dépôt porte justement un
//      cas de garde vacuous (`current_user` dans une SECURITY DEFINER détenue par postgres,
//      où il vaut toujours postgres).
//
// skipIf(!HAS_KEYS) ne SKIP PAS en CI — lire le compte de tests, jamais le code de sortie.

import { describe, it, expect } from 'vitest'
import { execSql } from './helpers/local-sql'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

/** Le périmètre : préfixes admin + les quatre surfaces admin sans préfixe (inventaire §3). */
const SCOPE = `(
  p.proname ~ '^(admin_|get_admin)'
  or p.proname in ('get_agency_stats', 'get_onboarding_milestones',
                   'get_agency_activity_summary', 'get_cron_health',
                   'compute_platform_mrr_estimate')
)`

/** Ce qui compte comme garde : l'un des deux prédicats du patron maison. */
const GUARDED = `(p.prosrc ilike '%is_super_admin%' or p.prosrc ilike '%is_service_role%')`

/** Lève si l'assertion SQL échoue : `execSql` ne rend rien, c'est le SQL qui juge. */
function runSql(body: string): void {
  execSql(`do $$\n${body}\nend $$;`)
}

/** Enveloppe pour que l'échec passe par vitest plutôt que par une exception nue. */
const assertSql = (body: string) => expect(() => runSql(body), 'assertion SQL').not.toThrow()

describe.skipIf(!HAS_KEYS)('G0 — aucune RPC admin n\'est joignable par un agent', () => {
  it('le balayage porte sur un périmètre non vide (garde anti-test creux)', () => {
    // Sans cette assertion, un `SCOPE` qui ne matcherait plus rien rendrait tous les
    // tests suivants verts sur zéro fonction — le motif exact du vert sans assertion.
    assertSql(`
    declare v_n int;
    begin
      select count(*) into v_n from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and ${SCOPE};
      if v_n < 25 then
        raise exception 'perimetre suspect : % fonctions admin trouvees (>= 25 attendues)', v_n;
      end if;
    `)
  })

  it('toute fonction admin joignable par `authenticated` porte une garde', () => {
    assertSql(`
    declare v_nues text;
    begin
      select string_agg(p.oid::regprocedure::text, ', ' order by p.proname)
        into v_nues
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
         and ${SCOPE}
         and p.prokind = 'f'
         and p.prosecdef                                        -- DEFINER : elle franchit la RLS
         and has_function_privilege('authenticated', p.oid, 'EXECUTE')
         and not ${GUARDED};
      if v_nues is not null then
        raise exception 'RPC admin SECURITY DEFINER sans garde, joignables par authenticated : %', v_nues;
      end if;
    `)
  })

  it('les gardes se DÉCLENCHENT : chaque RPC refuse un rôle sans JWT', () => {
    // Rôle `authenticated` sans JWT : auth.uid() est NULL, donc is_super_admin() et
    // is_service_role() sont faux — la position exacte d'un agent qui appellerait la RPC
    // d'une console à laquelle il n'a pas droit.
    //
    // Les arguments sont passés à NULL, typés : la garde étant la première instruction,
    // elle doit lever AVANT que le corps ne regarde ses paramètres. Une RPC qui répond
    // quand même est le défaut qu'on cherche.
    //
    // ⚠ LIMITE STRUCTURELLE DU HARNAIS, mesurée en CI plutôt que devinée. `execSql` passe
    // par psql EN TANT QUE postgres : `set local role authenticated` change `current_user`,
    // jamais `session_user`, qui reste `postgres`. Une garde qui admet délibérément
    // `session_user in ('postgres','supabase_admin')` — celle qui laisse pg_cron écrire —
    // passe donc, et le harnais la signale à tort. Ces fonctions sont écartées par
    // PRÉDICAT sur leur corps, jamais par une liste de noms qu'on allongerait à chaque
    // gêne. Leur refus d'un vrai JWT agent est prouvé ailleurs, par un client
    // authentifié : admin-log-chain.spec.ts et secdef-agency-readers-guard.spec.ts.
    assertSql(`
    declare
      r          record;
      v_args     text;
      v_repondu  text := '';
      v_ecartees int;
      v_sqlstate text;
    begin
      -- L'écart doit rester une exception. S'il s'élargit, c'est que le harnais ne
      -- prouve plus grand-chose et il faut le dire, pas l'accommoder.
      select count(*) into v_ecartees
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and ${SCOPE} and p.prosecdef
         and (p.prosrc ilike '%session_user%' or p.proname = 'admin_console_session_state');
      if v_ecartees > 4 then
        raise exception '% fonctions ecartees du balayage comportemental : le harnais ne prouve plus rien', v_ecartees;
      end if;

      for r in
        select p.oid, p.oid::regprocedure::text as sig,
               pg_get_function_identity_arguments(p.oid) as ident
          from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public'
           and ${SCOPE}
           and p.prokind = 'f'
           and p.prosecdef
           and has_function_privilege('authenticated', p.oid, 'EXECUTE')
           -- Gardes que le harnais ne peut pas éprouver (voir ci-dessus).
           and p.prosrc not ilike '%session_user%'
           -- Rend un verdict au lieu de lever, par conception : la console doit pouvoir
           -- distinguer « refusé » de « indisponible ».
           and p.proname <> 'admin_console_session_state'
         order by p.proname
      loop
        -- « nom type, nom type » → « null::type, null::type »
        select coalesce(string_agg('null::' || split_part(btrim(a), ' ', 2), ', '), '')
          into v_args
          from unnest(string_to_array(nullif(r.ident, ''), ',')) a;

        begin
          set local role authenticated;
          execute format('select %s(%s)', r.oid::regproc::text, v_args);
          reset role;
          v_repondu := v_repondu || r.sig || ' ; ';
        exception
          when insufficient_privilege then
            reset role;                       -- 42501 : le refus attendu
          when others then
            reset role;
            get stacked diagnostics v_sqlstate = returned_sqlstate;
            -- Un autre code veut dire que le corps s'est exécuté avant de refuser :
            -- la garde n'est pas la première instruction, ou il n'y en a pas.
            v_repondu := v_repondu || r.sig || ' [' || v_sqlstate || '] ; ';
        end;
      end loop;

      if v_repondu <> '' then
        raise exception 'RPC admin n ayant pas refuse un role sans JWT : %', v_repondu;
      end if;
    `)
  })

  it('aucune fonction SECURITY DEFINER du schéma public n\'est exécutable par anon', () => {
    // Le volet `anon` du bloquant 0.2, en test permanent plutôt qu'en audit ponctuel :
    // rien en CI ne détectait jusqu'ici une nouvelle SECURITY DEFINER exposée. Les
    // exceptions connues sont nommées, pour qu'en ajouter une soit un geste conscient.
    assertSql(`
    declare v_exposees text;
    begin
      select string_agg(distinct p.proname, ', ' order by p.proname)
        into v_exposees
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace,
             lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
       where n.nspname = 'public'
         and p.prosecdef
         and p.prokind = 'f'
         and a.privilege_type = 'EXECUTE'
         and a.grantee::regrole::text in ('-', 'anon')
         and ${SCOPE};
      if v_exposees is not null then
        raise exception 'RPC admin SECURITY DEFINER exposees a anon/PUBLIC : %', v_exposees;
      end if;
    `)
  })
})
