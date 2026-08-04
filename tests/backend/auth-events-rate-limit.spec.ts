// log_auth_event_limited — la limite de débit qui borne l'écriture anonyme dans
// auth_events.
//
// Régression du §4.1 de l'audit des signatures de webhooks du 03.08.2026.
// `log-auth-event` est publique et ne porte aucun contrôle d'appelant : ni
// signature, ni jeton, ni clé — parce qu'elle DOIT rester anonyme (son appelant
// légitime est le navigateur avant authentification). Ce qui la borne n'est donc
// pas une authentification mais ce RPC, et c'est lui qu'il faut protéger d'une
// régression.
//
// Deux propriétés distinctes, souvent confondues :
//   · CAPACITÉ — qui a le droit d'appeler. Testée par SET ROLE + tentative
//     réelle, avec contrôle positif : sans lui, un refus pourrait venir d'une
//     erreur de syntaxe plutôt que du privilège.
//   · COMPTAGE — ce que la fonction fait une fois appelée. Testé en transaction
//     annulée, pour ne rien laisser derrière.
//
// Corrigé par 20260804101347_auth_events_rate_limit.sql.

import { describe, it, expect } from 'vitest'
import { execSql } from './helpers/local-sql'

const SIG = 'public.log_auth_event_limited(text,text,text,uuid,text,text)'
const CALL = (hash: string) =>
  `select public.log_auth_event_limited('${hash}','signin.failure','info',null,'ua',null)`

/** Tente une commande sous un rôle donné, toujours annulée. */
function attemptAs(role: string, sql: string): void {
  execSql(`begin; set local role ${role}; ${sql}; rollback;`)
}

/** Assertion de catalogue : le GRANT lui-même, indépendamment de ce qui suit. */
function expectNoExecute(role: string): void {
  expect(() =>
    execSql(`
      do $$
      begin
        if has_function_privilege('${role}', '${SIG}', 'EXECUTE') then
          raise exception '${role} a EXECUTE sur log_auth_event_limited';
        end if;
      end $$;
    `),
  ).not.toThrow()
}

describe('log_auth_event_limited — capacité', () => {
  // ⚠ CES DEUX TESTS SONT DES ASSERTIONS DE CATALOGUE, DÉLIBÉRÉMENT.
  //
  // La version « capacité » de ce test (SET ROLE puis appel réel) passait pour
  // la MAUVAISE raison, vérifié par mutation le 04.08.2026 : en redonnant
  // EXECUTE à authenticated, l'appel lève quand même — non pas sur le grant de
  // la fonction, mais sur l'INSERT dans auth_events, que 20260719150000 a
  // révoqué. La tentative réelle ne peut donc PAS distinguer les deux couches,
  // et un REVOKE oublié sur la fonction serait passé inaperçu.
  //
  // Les deux verrous sont bien là (défense en profondeur) ; c'est chacun
  // séparément qu'il faut tenir, d'où l'assertion directe sur le privilège.
  it('anon n’a PAS EXECUTE sur le RPC', () => {
    expectNoExecute('anon')
  })

  it('authenticated n’a PAS EXECUTE sur le RPC', () => {
    // Sans ce REVOKE, le RPC rouvrirait EN RPC l'écriture d'audit que
    // 20260719150000 a fermée EN TABLE. Le grant par défaut de CREATE FUNCTION
    // est EXECUTE à PUBLIC — l'oubli est silencieux et total.
    expectNoExecute('authenticated')
  })

  it('service_role PEUT appeler — contrôle positif, l’appel est valide en soi', () => {
    expect(() => attemptAs('service_role', CALL('spec_cap'))).not.toThrow()
  })

  it('ni anon ni authenticated ne peuvent écrire, les deux couches confondues', () => {
    // Le pendant « capacité » du duo ci-dessus : moins précis (il ne dit pas
    // LAQUELLE des deux couches a refusé) mais il couvre le résultat qui compte.
    expect(() => attemptAs('anon', CALL('spec_cap'))).toThrow()
    expect(() => attemptAs('authenticated', CALL('spec_cap'))).toThrow()
  })

  it('reste SECURITY INVOKER — un DEFINER n’apporterait rien et allongerait la liste des advisors', () => {
    expect(() =>
      execSql(`
        do $$
        begin
          if (select prosecdef from pg_proc p
              join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'log_auth_event_limited') then
            raise exception 'log_auth_event_limited est devenue SECURITY DEFINER';
          end if;
        end $$;
      `),
    ).not.toThrow()
  })

  it('garde son index de support — sans lui le comptage scanne la table', () => {
    expect(() =>
      execSql(`
        do $$
        begin
          if not exists (
            select 1 from pg_indexes
            where tablename = 'auth_events'
              and indexname = 'idx_auth_events_ip_hash_created_at'
          ) then
            raise exception 'index idx_auth_events_ip_hash_created_at absent';
          end if;
        end $$;
      `),
    ).not.toThrow()
  })
})

describe('log_auth_event_limited — comptage', () => {
  it('laisse passer 60 appels dans la minute, puis refuse', () => {
    expect(() =>
      execSql(`
        begin;
        do $$
        declare v_ins int; v_thr int;
        begin
          select count(*) filter (where r = 'inserted'),
                 count(*) filter (where r = 'throttled')
            into v_ins, v_thr
            from (select public.log_auth_event_limited('spec_burst','signin.failure','info',null,'ua',null) as r
                  from generate_series(1, 65)) t;
          if v_ins <> 60 or v_thr <> 5 then
            raise exception 'attendu 60 inserted / 5 throttled, obtenu % / %', v_ins, v_thr;
          end if;
          if (select count(*) from public.auth_events where ip_hash = 'spec_burst') <> 60 then
            raise exception 'lignes ecrites != 60 — le refus doit empecher l ecriture';
          end if;
        end $$;
        rollback;
      `),
    ).not.toThrow()
  })

  it('refuse sur la fenêtre HORAIRE même quand la minute est vide', () => {
    // La fenêtre courte seule laisserait un attaquant écrire 60 lignes par
    // minute indéfiniment, soit 86 400 par jour.
    expect(() =>
      execSql(`
        begin;
        insert into public.auth_events (action, severity, ip_hash, created_at)
        select 'signin.failure','info','spec_sustained', now() - interval '5 minutes'
        from generate_series(1, 600);
        do $$
        begin
          if public.log_auth_event_limited('spec_sustained','signin.failure','info',null,'ua',null) <> 'throttled' then
            raise exception 'la fenetre horaire ne refuse pas alors que la minute est vide';
          end if;
        end $$;
        rollback;
      `),
    ).not.toThrow()
  })

  it('la fenêtre glisse — des lignes vieilles de 2 h ne comptent plus', () => {
    expect(() =>
      execSql(`
        begin;
        insert into public.auth_events (action, severity, ip_hash, created_at)
        select 'signin.failure','info','spec_slide', now() - interval '2 hours'
        from generate_series(1, 600);
        do $$
        begin
          if public.log_auth_event_limited('spec_slide','signin.failure','info',null,'ua',null) <> 'inserted' then
            raise exception 'la fenetre ne glisse pas — un pic ancien bloque indefiniment';
          end if;
        end $$;
        rollback;
      `),
    ).not.toThrow()
  })

  it('compte par IP — une IP saturée n’en bloque pas une autre', () => {
    // Sinon le premier attaquant venu couperait le journal d'authentification de
    // tout le monde : la protection deviendrait le déni de service.
    expect(() =>
      execSql(`
        begin;
        insert into public.auth_events (action, severity, ip_hash, created_at)
        select 'signin.failure','info','spec_noisy', now()
        from generate_series(1, 600);
        do $$
        begin
          if public.log_auth_event_limited('spec_quiet','signin.failure','info',null,'ua',null) <> 'inserted' then
            raise exception 'une IP saturee en bloque une autre';
          end if;
        end $$;
        rollback;
      `),
    ).not.toThrow()
  })
})
