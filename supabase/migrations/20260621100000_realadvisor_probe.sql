-- realadvisor : détecteur de disparition par oracle id_in (remplace le sweep par
-- énumération, throttlé). Pivot validé empiriquement (id_in non throttlé, 30/30).
--
-- Principe : on ne supprime un bien QUE s'il a été confirmé ABSENT par id_in
-- N=3 fois espacées (absent_probe_count) ET absent depuis ≥48h (absent_first_at).
-- Une seule sonde 'présent' réinitialise le compteur. Throttle/ambiguïté ne comptent
-- jamais comme absent (géré côté edge). Plafonds 1200/3% + dry-run (probe_apply).

-- 1) Colonnes de suivi par bien.
alter table public.market_listings
  add column if not exists absent_probe_count int not null default 0,
  add column if not exists absent_first_at timestamptz,
  add column if not exists last_probe_at timestamptz;

-- 2) Index pour la sélection rolling (biens dus à re-sonder).
create index if not exists idx_ml_ra_probe
  on public.market_listings (last_probe_at nulls first)
  where source_portal = 'realadvisor' and status in ('active', 'price_reduced');

-- 3) Flags. probe_apply='false' ⇒ DRY-RUN (bookkeeping oui, retrait non).
insert into public.app_config (key, value) values
  ('realadvisor_probe_enabled', 'true'),
  ('realadvisor_probe_apply', 'false')
on conflict (key) do nothing;

-- 4) RPC bookkeeping : présent (refresh + reset) / absent (incrément espacé ≥20h).
create or replace function public.realadvisor_probe_bookkeep(
  p_present text[], p_absent text[], p_min_gap_hours int default 20
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_present is not null and array_length(p_present, 1) > 0 then
    update market_listings set
      last_seen_at = now(), last_probe_at = now(),
      absent_probe_count = 0, absent_first_at = null
    where source_portal = 'realadvisor' and source_id = any(p_present)
      and status in ('active', 'price_reduced');
  end if;
  if p_absent is not null and array_length(p_absent, 1) > 0 then
    update market_listings set
      absent_probe_count = case
        when last_probe_at is null or last_probe_at < now() - make_interval(hours => p_min_gap_hours)
        then absent_probe_count + 1 else absent_probe_count end,
      absent_first_at = coalesce(absent_first_at, now()),
      last_probe_at = now()
    where source_portal = 'realadvisor' and source_id = any(p_absent)
      and status in ('active', 'price_reduced');
  end if;
end $$;
revoke all on function public.realadvisor_probe_bookkeep(text[], text[], int) from public;
grant execute on function public.realadvisor_probe_bookkeep(text[], text[], int) to service_role;

-- 5) RPC removal : retire les absents CONFIRMÉS (count≥N ET ≥48h), plafonds, dry-run.
create or replace function public.realadvisor_probe_sweep(
  p_offer_type text default 'buy',
  p_threshold int default 3,
  p_min_age_hours int default 48,
  p_cap_abs int default 1200,
  p_cap_pct numeric default 0.03,
  p_apply boolean default false
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_live bigint := 0; v_candidates bigint := 0; v_removed bigint := 0; v_status text;
begin
  select count(*) into v_live from market_listings
   where source_portal = 'realadvisor' and transaction_type = p_offer_type
     and status in ('active', 'price_reduced');
  select count(*) into v_candidates from market_listings
   where source_portal = 'realadvisor' and transaction_type = p_offer_type
     and status in ('active', 'price_reduced')
     and absent_probe_count >= p_threshold
     and absent_first_at is not null
     and absent_first_at < now() - make_interval(hours => p_min_age_hours);
  if v_candidates > p_cap_abs or (v_live > 0 and v_candidates::numeric / v_live::numeric > p_cap_pct) then
    return jsonb_build_object('status', 'safety_skipped', 'candidates', v_candidates, 'live', v_live, 'removed', 0);
  end if;
  if p_apply then
    update market_listings set status = 'removed', updated_at = now()
     where source_portal = 'realadvisor' and transaction_type = p_offer_type
       and status in ('active', 'price_reduced')
       and absent_probe_count >= p_threshold
       and absent_first_at is not null
       and absent_first_at < now() - make_interval(hours => p_min_age_hours);
    get diagnostics v_removed = row_count;
    v_status := 'completed';
  else v_status := 'dry_run'; end if;
  return jsonb_build_object('status', v_status, 'candidates', v_candidates, 'live', v_live, 'removed', v_removed);
end $$;
revoke all on function public.realadvisor_probe_sweep(text, int, int, int, numeric, boolean) from public;
grant execute on function public.realadvisor_probe_sweep(text, int, int, int, numeric, boolean) to service_role;

-- 6) Crons. Probe horaire (couverture ~quotidienne du catalogue) ; removal 01:30.
do $$ begin perform cron.unschedule('realadvisor-probe-hourly'); exception when others then null; end $$;
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.schedule('realadvisor-probe-hourly', '0 * * * *', $cron$
  select net.http_post(
    url := 'https://eayczugyrvmtqnnmvjod.supabase.co/functions/v1/realadvisor-sync',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'Authorization', 'Bearer ' || public.get_app_config('service_role_key')),
    body := jsonb_build_object('mode', 'probe', 'offer_type', 'buy', 'trigger_source', 'cron-probe', 'max_batches', 40)
  ) $cron$);
  end if;
end $$;

do $$ begin perform cron.unschedule('realadvisor-probe-sweep-daily'); exception when others then null; end $$;
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.schedule('realadvisor-probe-sweep-daily', '30 1 * * *', $cron$
  select net.http_post(
    url := 'https://eayczugyrvmtqnnmvjod.supabase.co/functions/v1/realadvisor-sync',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'Authorization', 'Bearer ' || public.get_app_config('service_role_key')),
    body := jsonb_build_object('mode', 'probe_sweep', 'offer_type', 'buy', 'trigger_source', 'cron-probe-sweep')
  ) $cron$);
  end if;
end $$;
