-- Un profil ne naît plus super_admin, ni rattaché à une agence, de la main de son titulaire
-- (audit du 13.09.2026, point S8 — la moitié INSERT du verrou de 20260627120000).
--
-- ⛔ LE TROU. Le verrou anti-escalade de 20260627120000 a figé `role` et `agency_id` sur
-- l'UPDATE (policy, privilèges de colonne, trigger) et bridé l'inscription
-- (`handle_new_user` ramène tout rôle hors liste à 'buyer'). Il n'a pas couvert l'INSERT
-- direct : les policies `profiles_insert` et « Users can insert own profile » ne vérifient
-- que `id = auth.uid()`, `authenticated` détient INSERT sur toutes les colonnes, et
-- `trg_profiles_guard_role_agency` ne se déclenchait que BEFORE UPDATE (tgtype 19, relu en
-- production le 13.09.2026). Un compte SANS profil pouvait donc insérer le sien avec
-- role = 'super_admin' et n'importe quel agency_id — prouvé en production dans une
-- transaction annulée (critique S8) : le profil auto-inséré passait les policies qui
-- testaient le rôle seul. Seul le fait que tout compte ait aujourd'hui un profil tenait la
-- porte fermée, et aucune contrainte ne le garantit.
--
-- LA RÈGLE — sous `authenticated` / `anon`, un INSERT dans profiles est refusé (42501) si :
--   · le rôle n'est pas l'un des sept que l'inscription laisse choisir. Cela refuse
--     'super_admin', seul autre rôle que permet `profiles_role_check` (mesuré le
--     13.09.2026 : les deux formulations sont équivalentes aujourd'hui). La liste échoue
--     FERMÉE le jour où un rôle privilégié s'ajouterait à la contrainte ;
--   · agency_id n'est pas nul. Le rattachement passe par les RPC SECURITY DEFINER
--     (create_agency_and_join, join_agency, provision_solo_agency) ou par service_role.
-- Un rôle NULL n'est pas traité ici : la contrainte NOT NULL le refuse, comme avant.
--
-- CE QUI NE CHANGE PAS :
--   · la branche UPDATE, recopiée à l'identique — messages anglais et code 42501 compris,
--     tels que les journaux et les tests les connaissent ;
--   · l'inscription : `handle_new_user` est SECURITY DEFINER détenue par postgres, donc
--     `current_user` y vaut postgres et l'INSERT du profil franchit la garde — le bloc final
--     le prouve ;
--   · service_role (edge functions, specs backend) et postgres (migrations, RPC DEFINER).
-- ⚠ SECURITY INVOKER, jamais DEFINER : la garde lit `current_user`, qui vaudrait toujours
-- postgres dans une fonction DEFINER (même piège que 20260913130100).
--
-- Relu avant d'écrire, le 13.09.2026 : aucun INSERT ni upsert de profil depuis le navigateur
-- ni depuis une edge function sous JWT utilisateur — les seuls INSERT sont dans
-- `handle_new_user`. ⚠ Un upsert client sur SON profil portant un agency_id serait
-- désormais refusé dès la phase INSERT, même si la ligne existe (le BEFORE INSERT se
-- déclenche avant l'ON CONFLICT) : il n'en existe aucun.
--
-- Idempotente : CREATE OR REPLACE pour la fonction, DROP TRIGGER IF EXISTS avant le CREATE.
-- Le bloc final vérifie la forme du trigger et ÉPROUVE la garde, sondes annulées.

create or replace function public.tg_profiles_guard_role_agency()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      if new.role not in ('agent', 'manager', 'admin', 'assistant', 'seller', 'buyer', 'particulier') then
        raise exception 'profiles.role % ne peut pas être posé à la création par % — passer par une RPC SECURITY DEFINER / service_role', new.role, current_user
          using errcode = '42501';
      end if;
      if new.agency_id is not null then
        raise exception 'profiles.agency_id ne peut pas être posé à la création par % — passer par une RPC SECURITY DEFINER / service_role', current_user
          using errcode = '42501';
      end if;
    else
      -- UPDATE : inchangé depuis 20260627120000.
      if new.role is distinct from old.role then
        raise exception 'profiles.role is read-only for % — use a SECURITY DEFINER RPC / service_role', current_user
          using errcode = '42501';
      end if;
      if new.agency_id is distinct from old.agency_id then
        raise exception 'profiles.agency_id is read-only for % — use a SECURITY DEFINER RPC / service_role', current_user
          using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end;
$$;

comment on function public.tg_profiles_guard_role_agency() is
  'Backstop privilege-escalation (BEFORE INSERT OR UPDATE sur profiles) : sous '
  'authenticated/anon, un INSERT ne pose ni un rôle hors des sept auto-attribuables '
  '(donc jamais super_admin) ni un agency_id, et un UPDATE ne modifie ni role ni agency_id. '
  'service_role et les fonctions SECURITY DEFINER (handle_new_user, RPC d''équipe) passent. '
  'Voir 20260627120000 (UPDATE) et 20260913160100 (INSERT, audit S8).';

drop trigger if exists trg_profiles_guard_role_agency on public.profiles;
create trigger trg_profiles_guard_role_agency
  before insert or update on public.profiles
  for each row
  execute function public.tg_profiles_guard_role_agency();

-- ═══════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION — la forme du trigger, puis la garde ÉPROUVÉE
-- ═══════════════════════════════════════════════════════════════════════════
-- Chaque sonde insère un profil sur un identifiant aléatoire, SANS compte auth.users, puis
-- lève d'elle-même : le sous-bloc est toujours annulé, rien ne subsiste. Quand la garde
-- laisse passer, l'INSERT bute sur la clé étrangère vers auth.users (ou sur la levée
-- finale) — c'est la preuve qu'elle n'a pas refusé. Quand elle refuse, c'est avant la RLS et
-- avant toute clé étrangère (trigger BEFORE ROW), et le MESSAGE dit que c'est elle : un
-- refus de RLS porte le même code 42501, d'où la lecture du texte.
do $$
declare
  v_type    int;
  v_actif   "char";
  v_definer boolean;
  v_id      uuid;
  v_etat    text;
  r         record;
begin
  -- 1. Forme : BEFORE, FOR EACH ROW, INSERT ET UPDATE, activé. Fonction INVOKER.
  select t.tgtype, t.tgenabled into v_type, v_actif
    from pg_trigger t
   where t.tgrelid = 'public.profiles'::regclass
     and t.tgname = 'trg_profiles_guard_role_agency'
     and not t.tgisinternal;
  if v_type is null then
    raise exception 'S8 : trg_profiles_guard_role_agency absent de public.profiles';
  end if;
  -- Bits de tgtype : 1 = ROW, 2 = BEFORE, 4 = INSERT, 16 = UPDATE.
  if (v_type & 1) = 0 or (v_type & 2) = 0 or (v_type & 4) = 0 or (v_type & 16) = 0 then
    raise exception 'S8 : trg_profiles_guard_role_agency n''est pas BEFORE INSERT OR UPDATE FOR EACH ROW (tgtype %)', v_type;
  end if;
  if v_actif = 'D' then
    raise exception 'S8 : trg_profiles_guard_role_agency est désactivé';
  end if;
  select p.prosecdef into v_definer
    from pg_proc p
   where p.oid = 'public.tg_profiles_guard_role_agency()'::regprocedure;
  if v_definer then
    raise exception 'S8 : tg_profiles_guard_role_agency est SECURITY DEFINER — current_user y vaudrait toujours postgres';
  end if;

  -- 2. Sondes. Deux refus attendus, et deux passages : sans les passages (contrôles
  --    positifs), une garde qui refuserait TOUT — ou un refus venu de la RLS — rendrait les
  --    deux premières lignes vertes pour la mauvaise raison.
  for r in
    select *
      from (values
        ('authenticated', 'super_admin', false, 'refus_role'),
        ('authenticated', 'buyer',       true,  'refus_agence'),
        ('authenticated', 'buyer',       false, 'franchit'),
        -- Le contexte de handle_new_user (SECURITY DEFINER détenue par postgres).
        ('postgres',      'agent',       false, 'franchit')
      ) as t(role_sql, role_profil, avec_agence, attendu)
  loop
    v_id := gen_random_uuid();
    v_etat := null;
    begin
      if r.role_sql = 'authenticated' then
        -- `sub` = l'identifiant inséré : la policy `id = auth.uid()` est satisfaite, seule
        -- la garde peut refuser.
        perform set_config('request.jwt.claims',
          json_build_object('sub', v_id, 'role', 'authenticated')::text, true);
        set local role authenticated;
      end if;
      -- `full_name` est NOT NULL sans défaut : l'omettre ferait échouer les passages sur
      -- une contrainte, non sur la clé étrangère — et la sonde lirait mal leur verdict.
      insert into public.profiles (id, email, full_name, role, agency_id)
      values (v_id, 'sonde-s8@example.invalid', 'Sonde S8', r.role_profil,
              case when r.avec_agence then gen_random_uuid() end);
      raise exception using errcode = 'P0001', message = 'sonde_s8_annulee';
    exception
      when insufficient_privilege then
        v_etat := case
          when sqlerrm like 'profiles.role %' then 'refus_role'
          when sqlerrm like 'profiles.agency_id %' then 'refus_agence'
          else 'refus_autre : ' || sqlerrm
        end;
      when foreign_key_violation or raise_exception then
        v_etat := 'franchit';
    end;
    if v_etat is distinct from r.attendu then
      raise exception 'S8 : INSERT profiles sous %, role=%, agency_id % → % (attendu : %)',
        r.role_sql, r.role_profil, case when r.avec_agence then 'posé' else 'nul' end,
        coalesce(v_etat, 'aucune erreur'), r.attendu;
    end if;
  end loop;
end $$;
