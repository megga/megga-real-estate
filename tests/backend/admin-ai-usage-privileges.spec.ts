// Backend integration spec (live CI) — droits et policies des tables d'instrumentation IA.
//
// Mesuré en PRODUCTION le 03.08.2026 (audit console) : `ai_usage_logs` et
// `ai_balance_snapshots` portaient encore les droits PAR DÉFAUT de Supabase — `anon` y
// détenait SELECT/INSERT/UPDATE/DELETE/TRUNCATE — et leurs policies testaient
// `profiles.role` EN DUR, ratant la moitié allowlist du mur réel (`is_super_admin()`).
// Même défaut que celui corrigé sur `admin_changelog` à l'étape 21. La RLS bloquait
// `anon` en pratique : pas une fuite, mais un verrou unique là où le dépôt en veut deux.
// Corrigé par 20260803010000 ; la porte `check-privilege-drift.mjs` (qui, elle,
// interroge la PRODUCTION — une base fraîche de CI ne peut pas voir une dérive de prod)
// porte désormais les deux tables.
//
// Ce fichier est le CLIQUET côté base fraîche : si une migration future recrée ces
// tables ou leurs policies sans reconduire le durcissement, la CI rougit ici.
//
// skipIf(!HAS_KEYS) ne SKIP PAS en CI — lire le compte de tests, jamais le code de sortie.

import { describe, it, expect } from 'vitest'
import { execSql } from './helpers/local-sql'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

/** Lève si l'assertion SQL échoue : `execSql` ne rend rien, c'est le SQL qui juge. */
const runSql = (body: string) => {
  execSql(`do $$\n${body}\nend $$;`)
}
const assertSql = (body: string) => expect(() => runSql(body), 'assertion SQL').not.toThrow()

describe.skipIf(!HAS_KEYS)('instrumentation IA — droits anon révoqués, policies sur le mur réel', () => {
  it('anon ne détient plus AUCUN droit sur ai_usage_logs ni ai_balance_snapshots', () => {
    assertSql(`
declare
  v_droits text;
begin
  select string_agg(table_name || ':' || privilege_type, ', ' order by table_name, privilege_type)
    into v_droits
    from information_schema.role_table_grants
   where table_schema = 'public'
     and table_name in ('ai_usage_logs', 'ai_balance_snapshots')
     and grantee = 'anon';
  if v_droits is not null then
    raise exception 'droits anon encore presents : %', v_droits;
  end if;
`)
  })

  it('authenticated est en lecture seule (les écritures viennent des edges en service_role)', () => {
    assertSql(`
declare
  v_droits text;
begin
  select string_agg(table_name || ':' || privilege_type, ', ' order by table_name, privilege_type)
    into v_droits
    from information_schema.role_table_grants
   where table_schema = 'public'
     and table_name in ('ai_usage_logs', 'ai_balance_snapshots')
     and grantee = 'authenticated'
     and privilege_type <> 'SELECT';
  if v_droits is not null then
    raise exception 'droits d''ecriture authenticated encore presents : %', v_droits;
  end if;
`)
  })

  it('les policies de lecture passent par is_super_admin(), jamais profiles.role en dur', () => {
    assertSql(`
declare
  v_defauts text;
  v_n integer;
begin
  select string_agg(c.relname || ' [' || pg_get_expr(p.polqual, p.polrelid) || ']', ' | ')
    into v_defauts
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname in ('ai_usage_logs', 'ai_balance_snapshots')
     and pg_get_expr(p.polqual, p.polrelid) !~ 'is_super_admin';
  if v_defauts is not null then
    raise exception 'policy hors mur reel : %', v_defauts;
  end if;

  -- Garde anti-contrôle creux : un périmètre qui ne matche plus rien rendrait le test
  -- vert sans assertion. Les deux tables doivent porter au moins une policy chacune.
  select count(distinct c.relname) into v_n
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname in ('ai_usage_logs', 'ai_balance_snapshots');
  if v_n < 2 then
    raise exception 'moins de 2 tables avec policy : le perimetre du test ne matche plus';
  end if;
`)
  })
})
