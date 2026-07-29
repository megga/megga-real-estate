-- Le trigger d'inscription entre au contrôle de version.
--
-- public.handle_new_user() existe depuis la baseline et a été modifiée deux fois
-- (20260627120000 lockdown du rôle, 20260718130000 provisioning d'agence), mais le
-- TRIGGER qui l'appelle n'a jamais figuré dans aucune migration. Conséquences : en
-- local l'inscription ne crée ni profil ni agence (les tests backend contournaient en
-- posant le profil à la main), et en production le comportement de chaque signup
-- dépend d'un objet que personne ne peut relire ni restaurer.
--
-- Aucune précondition humaine requise : le bloc DO ci-dessous supprime TOUS les
-- triggers non-internes de auth.users dont la fonction appelée est
-- public.handle_new_user, quel que soit leur nom, avant de reposer le canonique.
-- Un DROP nommé (uniquement 'on_auth_user_created') aurait laissé survivre un
-- trigger de production portant un autre nom : les deux se seraient déclenchés sur
-- chaque inscription, le second réexécutant le même INSERT dans profiles avec le
-- même NEW.id → violation de clé primaire → 500 sur TOUTE inscription (voir
-- docs/runbooks/trigger-inscription-duplique.md, désormais historique).
--
-- Idempotente : le DO retrouve et supprime tout trigger d'un AUTRE nom appelant
-- handle_new_user, puis CREATE OR REPLACE TRIGGER (PG14+) repose le canonique quel
-- que soit son état — absent, ou déjà présent sur un rejeu.

do $$
declare
  v_trigger record;
begin
  for v_trigger in
    select t.tgname
    from pg_trigger t
    join pg_proc      p  on p.oid = t.tgfoid
    join pg_namespace pn on pn.oid = p.pronamespace
    where t.tgrelid = 'auth.users'::regclass
      and not t.tgisinternal          -- exclut les triggers internes (contraintes FK…)
      and pn.nspname = 'public'
      and p.proname = 'handle_new_user'
      and t.tgname <> 'on_auth_user_created'   -- celui-ci : CREATE OR REPLACE s'en charge juste après
  loop
    execute format('drop trigger %I on auth.users', v_trigger.tgname);
  end loop;
end $$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

comment on function public.handle_new_user() is
  'Trigger AFTER INSERT sur auth.users (on_auth_user_created, versionné par 20260728104000) : crée le profil et provisionne l''agence des rôles agence. Best-effort sur l''agence, un échec ne bloque jamais l''inscription.';

-- ── Vérification (tests) : exactement 1 trigger doit appeler handle_new_user ────
-- Les tests backend passent uniquement par supabase-js (aucun accès SQL direct) :
-- sans cette fonction, l'invariant posé ci-dessus (un seul trigger, quel que soit son
-- nom) serait invérifiable depuis tests/backend/signup-provisioning.spec.ts. Même
-- filtre que le DO ci-dessus, exposé en lecture seule et fermé aux rôles API.
create or replace function public.get_signup_trigger_count()
returns integer
language sql
stable
security definer
set search_path to 'public'
as $$
  select count(*)::integer
  from pg_trigger t
  join pg_proc      p  on p.oid = t.tgfoid
  join pg_namespace pn on pn.oid = p.pronamespace
  where t.tgrelid = 'auth.users'::regclass
    and not t.tgisinternal
    and pn.nspname = 'public'
    and p.proname = 'handle_new_user'
$$;

revoke all on function public.get_signup_trigger_count() from public, anon, authenticated;
grant execute on function public.get_signup_trigger_count() to service_role;

comment on function public.get_signup_trigger_count() is
  'Interne (tests) : nombre de triggers non-internes sur auth.users dont la fonction est handle_new_user. Doit valoir 1 — au-delà, incident double-insert (docs/runbooks/trigger-inscription-duplique.md). Voir tests/backend/signup-provisioning.spec.ts.';
