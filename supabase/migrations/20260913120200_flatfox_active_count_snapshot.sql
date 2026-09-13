-- Le compte des annonces Flatfox actives se MESURE une fois par heure, hors timeout.
--
-- ⛔ CONSTAT DE L'AUDIT DU 13.09.2026. `count: 'exact'` sur `market_listings` filtré
-- `source_portal = 'flatfox' AND status = 'active'` expirait 23 fois par 24 h : une fois par
-- heure depuis `admin-monitoring/index.ts` (job `platform-metrics-hourly`), plus les
-- ouvertures de la page de monitoring (`AdminMonitoringPage.tsx`). Les deux appels passent
-- par PostgREST, donc sous le statement_timeout de 8 s du rôle `authenticator` — et un
-- bitmap heap scan de 253 000 lignes prend ~18 s à froid (mesure du 03.09.2026, écrite dans
-- le commentaire d'admin-monitoring avec les trois pistes ESSAYÉES ET ÉCARTÉES : `estimated`
-- ment de 10 000, l'index partiel n'est pas choisi, l'ancien index ne l'est plus).
--
-- La quatrième piste, qui n'y figurait pas : ne plus compter DANS la requête qui affiche.
-- `flatfox_active_count_refresh()` fait le compte exact sous pg_cron (rôle postgres, sans
-- statement_timeout — 18 s une fois par heure sont sans conséquence) et le range dans
-- `app_config.flatfox_active_count` avec son horodatage. Les deux lecteurs lisent ce chiffre :
-- exact, daté, jamais expiré. Le compte ne bouge de toute façon qu'au passage de
-- `flatfox-sync-daily` (04:00 UTC) ; une heure de décalage ne change pas ce que la carte
-- doit dire — « la synchro a-t-elle tourné ? ».
--
-- ⚠ C'est la règle §7 de CLAUDE.md (« JAMAIS count: 'exact' sur tables > 5K rows ») que ces
-- deux sites violaient, en le sachant et en l'écrivant. L'exception cesse d'exister.

create or replace function public.flatfox_active_count_refresh()
returns integer
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_n integer;
begin
  if not (public.is_service_role() or session_user in ('postgres', 'supabase_admin')) then
    raise exception 'forbidden: service or postgres only' using errcode = '42501';
  end if;

  select count(*) into v_n
    from public.market_listings
   where source_portal = 'flatfox' and status = 'active';

  insert into public.app_config (key, value)
  values ('flatfox_active_count', jsonb_build_object('count', v_n, 'measured_at', now())::text)
  on conflict (key) do update set value = excluded.value;

  return v_n;
end $$;

comment on function public.flatfox_active_count_refresh() is
  'Compte exact des annonces Flatfox actives, écrit dans app_config.flatfox_active_count '
  '({count, measured_at}). Tourne sous pg_cron toutes les heures : le count direct expirait '
  'sous le statement_timeout de PostgREST (20260913120200). Service_role ou postgres seuls.';

revoke all on function public.flatfox_active_count_refresh() from public, anon, authenticated;
grant execute on function public.flatfox_active_count_refresh() to service_role;

-- Ce que la page de monitoring lit. `app_config` est RLS sans policy (elle porte la clé de
-- service) : le super-admin n'y accède que par cette porte, qui ne rend que CETTE clé.
create or replace function public.admin_flatfox_active_count()
returns jsonb
language plpgsql stable security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;
  return coalesce(
    (select nullif(value, '')::jsonb from public.app_config where key = 'flatfox_active_count'),
    jsonb_build_object('count', null, 'measured_at', null));
end $$;

comment on function public.admin_flatfox_active_count() is
  'Dernier compte Flatfox mesuré par flatfox_active_count_refresh() : {count, measured_at}, '
  'ou {null, null} si jamais mesuré. Super-admin ou service_role.';

revoke all on function public.admin_flatfox_active_count() from public, anon;
grant execute on function public.admin_flatfox_active_count() to authenticated, service_role;

-- Première mesure tout de suite, puis toutes les heures à :05 — dix minutes AVANT
-- platform-metrics-hourly (:15), qui lit le chiffre.
do $$ begin perform public.flatfox_active_count_refresh(); end $$;

do $$ begin perform cron.unschedule('flatfox-active-count-hourly'); exception when others then null; end $$;
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.schedule('flatfox-active-count-hourly', '5 * * * *',
      'select public.flatfox_active_count_refresh();');
  end if;
end $$;
