// GRANTS — `anon` n'écrit nulle part dans `public`, sauf l'INSERT de `seller_leads`,
// et une table créée demain naît fermée (20260913140000, audit du 13.09.2026, point S5).
//
// Ce fichier ne teste PAS la RLS : il teste la couche EN DESSOUS. En production, `anon`
// détenait INSERT/UPDATE/DELETE sur 69 tables par les droits par défaut de Supabase — la
// RLS était le seul verrou. Les assertions portent donc sur le CATALOGUE
// (`has_table_privilege`), qui dit ce que le rôle peut tenter, et non sur une tentative,
// qui échouerait de toute façon sur la RLS et ne prouverait rien du GRANT.
//
// Deux contrôles positifs empêchent ce fichier d'être creux : la table `seller_leads` DOIT
// rester ouverte à l'INSERT anonyme (sinon on aurait fermé l'entonnoir public avec le
// reste), et `authenticated` DOIT garder INSERT/UPDATE/DELETE (sinon le CRM ne marche plus).

import { describe, it, expect } from 'vitest'
import { execSql } from './helpers/local-sql'

/** Lève (via ON_ERROR_STOP) si l'assertion SQL est fausse, en nommant les coupables. */
function assertSql(sql: string): void {
  // ⚠ Variables préfixées `v_` : un alias de table `n` (pg_namespace) entrerait en conflit
  // avec une variable plpgsql `n` (variable_conflict = error).
  execSql(`do $$ declare v_list text; v_n int; begin ${sql} end $$;`)
}

describe('GRANTS — écriture anonyme fermée sur public', () => {
  it('anon n’a INSERT/UPDATE/DELETE/TRUNCATE sur AUCUNE table de public sauf l’INSERT de seller_leads', () => {
    expect(() =>
      assertSql(`
        select string_agg(c.relname || ':' || p.priv, ', ' order by c.relname) into v_list
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
          cross join (values ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')) as p(priv)
         where n.nspname = 'public'
           and c.relkind in ('r', 'p')
           and pg_get_userbyid(c.relowner) <> 'supabase_admin'
           and has_table_privilege('anon', c.oid, p.priv)
           and not (c.relname = 'seller_leads' and p.priv = 'INSERT');
        if v_list is not null then
          raise exception 'anon garde des droits d''écriture : %', v_list;
        end if;
        -- Garde anti-vacuité : si les tables n'appartenaient plus à postgres (exécutant des
        -- migrations changé), le filtre de propriétaire viderait le périmètre en silence.
        select count(*) into v_n from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
         where ns.nspname = 'public' and c.relkind in ('r', 'p')
           and pg_get_userbyid(c.relowner) <> 'supabase_admin';
        if v_n < 50 then
          raise exception 'périmètre suspect : % table(s) inspectée(s), 50 attendues au moins', v_n;
        end if;`),
    ).not.toThrow()
  })

  it('CONTRÔLE POSITIF — l’entonnoir public reste ouvert : anon peut INSERT seller_leads', () => {
    expect(() =>
      assertSql(`
        if not has_table_privilege('anon', 'public.seller_leads', 'INSERT') then
          raise exception 'seller_leads a perdu son INSERT anonyme — l''entonnoir public est fermé';
        end if;`),
    ).not.toThrow()
  })

  it('CONTRÔLE POSITIF — authenticated garde INSERT/UPDATE/DELETE (la RLS les borne), perd TRUNCATE', () => {
    expect(() =>
      assertSql(`
        if not (has_table_privilege('authenticated', 'public.contacts', 'INSERT')
            and has_table_privilege('authenticated', 'public.contacts', 'UPDATE')
            and has_table_privilege('authenticated', 'public.contacts', 'DELETE')) then
          raise exception 'authenticated a perdu ses droits d''écriture sur contacts';
        end if;
        select string_agg(c.relname, ', ') into v_list
          from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relkind in ('r', 'p')
           and pg_get_userbyid(c.relowner) <> 'supabase_admin'
           and has_table_privilege('authenticated', c.oid, 'TRUNCATE');
        if v_list is not null then
          raise exception 'authenticated garde TRUNCATE sur : %', v_list;
        end if;`),
    ).not.toThrow()
  })

  it('une table créée APRÈS la migration naît fermée à l’écriture anonyme (droits par défaut)', () => {
    // En transaction annulée : la table n'existe que le temps de lire son ACL.
    expect(() =>
      execSql(`
        begin;
        create table public.__probe_default_privileges (id int primary key);
        do $$
        begin
          if has_table_privilege('anon', 'public.__probe_default_privileges', 'INSERT')
             or has_table_privilege('anon', 'public.__probe_default_privileges', 'UPDATE')
             or has_table_privilege('anon', 'public.__probe_default_privileges', 'DELETE')
             or has_table_privilege('anon', 'public.__probe_default_privileges', 'TRUNCATE')
             or has_table_privilege('authenticated', 'public.__probe_default_privileges', 'TRUNCATE') then
            raise exception 'une table neuve naît encore ouverte à l''écriture anonyme';
          end if;
          -- Et elle reste LISIBLE/écrivable comme avant pour authenticated : les droits par
          -- défaut ne sont pas vidés, ils sont resserrés.
          if not has_table_privilege('authenticated', 'public.__probe_default_privileges', 'INSERT') then
            raise exception 'les droits par défaut d''authenticated ont été retirés en trop';
          end if;
        end $$;
        rollback;`),
    ).not.toThrow()
  })

  it('CAPACITÉ RÉELLE — anon ne peut pas écrire dans transactions, même sans passer par la RLS', () => {
    // `permission denied` (privilège) et non `violates row-level security policy` : la
    // commande est refusée AVANT toute policy.
    expect(() =>
      execSql(`begin; set local role anon; delete from public.transactions; rollback;`),
    ).toThrow(/permission denied/)
  })
})
