-- ════════════════════════════════════════════════════════════════════════════
-- S11 — crm_tabs_save refuse une pile adressée à un AUTRE compte (p_owner) ou
-- chargée sous une AUTRE agence que celle du compte (p_agency).
--
-- POURQUOI. La pile d'onglets porte des noms de clients. Deux fenêtres de temps
-- la faisaient atterrir au mauvais endroit :
--   • un autre onglet connecte B : supabase-js relit le jeton dans le stockage
--     PARTAGÉ à chaque appel, donc la sauvegarde différée de la page de A partait
--     sous l'identité de B — la pile de A s'écrivait dans la ligne de B ;
--   • le même compte change d'agence : team_remove_member et accept-team-invite
--     purgent sa ligne (ses libellés nomment les clients de l'ancienne agence),
--     mais sa page ouverte la RÉÉCRIVAIT à la sauvegarde suivante.
-- Le client envoie désormais p_owner (son compte) et p_agency (l'agence sous
-- laquelle sa pile a été chargée). Les deux paramètres valent NULL par défaut :
-- un client antérieur reste compatible.
--
-- ⚠ Ce n'est pas une frontière de sécurité : les politiques crm_open_tabs_*_own
-- laissent déjà chaque compte écrire SA ligne sans passer par ici. C'est une
-- garde de COHÉRENCE contre une page restée sur un état périmé.
--
-- REJOUABLE (deploy.yml réapplique toute migration du jour à chaque push) :
-- `drop … if exists` de l'ANCIENNE signature (sans effet au rejeu), puis
-- `create OR REPLACE` de la nouvelle — un `create` nu lèverait 42723 au second
-- passage. Deux signatures ne doivent pas coexister : PostgREST ne saurait plus
-- laquelle appeler (PGRST203).
--
-- Corps repris de 20260904121500 (comparé à prosrc en production le 13.09.2026 :
-- mêmes instructions, aux commentaires près).
-- ════════════════════════════════════════════════════════════════════════════

drop function if exists public.crm_tabs_save(jsonb, integer, bigint);

create or replace function public.crm_tabs_save(
  p_tabs jsonb,
  p_active integer,
  p_revision bigint default null,
  p_owner uuid default null,
  p_agency uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_cur  public.crm_open_tabs%rowtype;
  v_n    integer;
begin
  if v_uid is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- S11 — une pile ne s'écrit que dans la ligne de SON compte, sous SON agence.
  -- p_owner : la page qui sauvegarde est restée sur A alors que le jeton du
  -- stockage est déjà celui de B (connexion dans un autre onglet).
  if p_owner is not null and p_owner <> v_uid then
    raise exception 'crm_tabs_save: pile d''un autre compte' using errcode = '42501';
  end if;
  -- p_agency : le même compte a changé d'agence (team_remove_member,
  -- accept-team-invite viennent de purger sa ligne) ; sa page ouverte garde une
  -- pile qui nomme les clients de l'ancienne — elle ne doit pas la réécrire.
  if p_agency is not null and p_agency is distinct from public.get_user_agency_id() then
    raise exception 'crm_tabs_save: pile d''une autre agence' using errcode = '42501';
  end if;

  if p_tabs is null or jsonb_typeof(p_tabs) <> 'array' then
    raise exception 'crm_tabs_save: p_tabs doit etre un tableau jsonb'
      using errcode = '22023';
  end if;

  -- ⚠ `for update` : verrouille la ligne AVANT le test de révision.
  select * into v_cur from public.crm_open_tabs where user_id = v_uid for update;

  if not found then
    -- ⚠ Deux premières écritures concurrentes visent la même clé primaire : la perdante
    -- lève 23505. Sans ce rattrapage, la barre d'un agent qui ouvre deux fenêtres en même
    -- temps échouerait à sa toute première sauvegarde. On relit et on repart en `stale`.
    begin
      insert into public.crm_open_tabs (user_id, tabs, active_index, revision, updated_at)
      values (v_uid, p_tabs, greatest(coalesce(p_active, 0), 0), 1, now())
      returning * into v_cur;
      return jsonb_build_object(
        'tabs', v_cur.tabs, 'active_index', v_cur.active_index,
        'revision', v_cur.revision, 'stale', false);
    exception when unique_violation then
      select * into v_cur from public.crm_open_tabs where user_id = v_uid;
      return jsonb_build_object(
        'tabs', v_cur.tabs, 'active_index', v_cur.active_index,
        'revision', v_cur.revision, 'stale', true);
    end;
  end if;

  if p_revision is not null and p_revision <> v_cur.revision then
    return jsonb_build_object(
      'tabs', v_cur.tabs, 'active_index', v_cur.active_index,
      'revision', v_cur.revision, 'stale', true);
  end if;

  update public.crm_open_tabs
     set tabs = p_tabs,
         active_index = greatest(coalesce(p_active, 0), 0),
         revision = v_cur.revision + 1,
         updated_at = now()
   where user_id = v_uid
     -- Ceinture : la révision est réaffirmée dans le WHERE, pas seulement testée plus haut.
     and revision = v_cur.revision
  returning * into v_cur;

  get diagnostics v_n = row_count;
  if v_n = 0 then
    select * into v_cur from public.crm_open_tabs where user_id = v_uid;
    return jsonb_build_object(
      'tabs', v_cur.tabs, 'active_index', v_cur.active_index,
      'revision', v_cur.revision, 'stale', true);
  end if;

  return jsonb_build_object(
    'tabs', v_cur.tabs, 'active_index', v_cur.active_index,
    'revision', v_cur.revision, 'stale', false);
end;
$$;

revoke all on function public.crm_tabs_save(jsonb, integer, bigint, uuid, uuid) from public, anon;
grant execute on function public.crm_tabs_save(jsonb, integer, bigint, uuid, uuid) to authenticated;

comment on function public.crm_tabs_save(jsonb, integer, bigint, uuid, uuid) is
  'Écrit la pile d''onglets du compte courant (révision optimiste). S11 : refuse (42501) '
  'une pile adressée à un autre compte (p_owner) ou chargée sous une autre agence (p_agency). '
  'Paramètres optionnels : un client antérieur reste compatible.';

do $$
declare
  v_n integer;
begin
  select count(*) into v_n from pg_proc
   where pronamespace = 'public'::regnamespace and proname = 'crm_tabs_save';
  if v_n <> 1 then
    raise exception 'S11 : % signature(s) de crm_tabs_save — PostgREST ne saurait plus laquelle appeler', v_n;
  end if;
  if not has_function_privilege('authenticated', 'public.crm_tabs_save(jsonb, integer, bigint, uuid, uuid)', 'EXECUTE') then
    raise exception 'S11 : authenticated a perdu crm_tabs_save — la persistance des onglets est coupée';
  end if;
  if has_function_privilege('anon', 'public.crm_tabs_save(jsonb, integer, bigint, uuid, uuid)', 'EXECUTE') then
    raise exception 'S11 : anon peut appeler crm_tabs_save';
  end if;
end $$;
