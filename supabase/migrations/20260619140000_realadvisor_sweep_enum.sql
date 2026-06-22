-- realadvisor-sync : sweep destructif SÛR (par reçus d'énumération) + crawl rolling
-- de rafraîchissement + UA configurable (rollout whitelist RA). Issu du red-team 19 juin.
--
-- Modèle : on ne supprime un bien QUE s'il tombe dans un slice (canton×bande de prix)
-- RÉELLEMENT énuméré en entier ce cycle (reçu fully_enumerated dans realadvisor_slice_coverage)
-- et qu'il n'a pas été revu (last_seen_at < cycle_id du reçu). Les résidus inatteignables
-- (price=0 hors bandes, bandes plafonnées, cantons throttlés) ne produisent jamais de reçu
-- fully_enumerated → JAMAIS supprimés. Double plafond + fenêtre 8j = garde-fou anti-wipe.
--
-- Appliqué via Supabase MCP (le deploy GitHub Actions est verrouillé facturation).

-- 1) Index partiel couvrant le prédicat du sweep + le rolling refresh.
-- ⚠ market_listings est volumineuse + lue par le CRM live → on le construit CONCURRENTLY
--   HORS transaction (via execute_sql, pas apply_migration) pour ne pas locker la table.
--   Conservé ici comme source de vérité ; ne PAS l'inclure dans l'apply transactionnel.
-- create index concurrently if not exists idx_ml_ra_staleness
--   on public.market_listings (transaction_type, last_seen_at)
--   where source_portal = 'realadvisor' and status in ('active', 'price_reduced');

-- 2) Reçu d'énumération par slice (pilote la suppression scopée + la complétude de cycle).
create table if not exists public.realadvisor_slice_coverage (
  id               bigserial primary key,
  cycle_id         timestamptz not null,            -- = début du run rolling (= last_seen des biens revus)
  canton           text        not null,            -- slug RA (debug)
  canton_code      text,                            -- code 2 lettres = market_listings.canton (matching)
  gte              integer,                         -- borne basse de la bande de prix (null = slice non filtré)
  lte              integer,                         -- borne haute (null = bande ouverte ou slice non filtré)
  seen             integer     not null default 0,
  total            integer     not null default 0,
  fully_enumerated boolean     not null default false, -- (total>0 AND total<=700 AND seen>=total)
  observed_at      timestamptz not null default now()
);
create index if not exists idx_ra_cov_lookup
  on public.realadvisor_slice_coverage (canton_code, observed_at desc)
  where fully_enumerated = true;
alter table public.realadvisor_slice_coverage enable row level security;
-- pas de policy anon → table verrouillée par défaut ; le service_role bypass la RLS.

-- 3) RPC du sweep ENUM (atomique : compte → plafonds → update). p_apply=false ⇒ DRY-RUN.
create or replace function public.realadvisor_sweep_enum(
  p_offer_type text default 'buy',
  p_window_days int default 8,
  p_cap_abs int default 1200,
  p_cap_pct numeric default 0.03,
  p_apply boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_live       bigint := 0;
  v_candidates bigint := 0;
  v_removed    bigint := 0;
  v_status     text;
begin
  select count(*) into v_live
  from market_listings
  where source_portal = 'realadvisor' and transaction_type = p_offer_type
    and status in ('active', 'price_reduced');

  -- Candidats = biens actifs couverts par >=1 reçu fully_enumerated récent (fenêtre p_window_days)
  -- ET non revus depuis le crawl de ce slice (last_seen_at < cycle_id du reçu). Le prix courant
  -- doit tomber dans la bande du reçu (slice non filtré = tout le canton).
  with cand as (
    select distinct m.id
    from market_listings m
    join realadvisor_slice_coverage c
      on c.fully_enumerated = true
     and c.observed_at > now() - (p_window_days::text || ' days')::interval
     and c.canton_code is not null
     and m.canton = c.canton_code
     and m.last_seen_at < c.cycle_id
     and (
          (c.gte is null and c.lte is null)
       or (c.gte is not null and c.lte is not null
           and coalesce(m.current_price, m.price) between c.gte and c.lte)
       or (c.gte is not null and c.lte is null
           and coalesce(m.current_price, m.price) >= c.gte)
     )
    where m.source_portal = 'realadvisor'
      and m.transaction_type = p_offer_type
      and m.status in ('active', 'price_reduced')
  )
  select count(*) into v_candidates from cand;

  -- Double plafond : au-delà = anomalie (cycle throttlé, mauvais mapping) → on ne supprime RIEN.
  if v_candidates > p_cap_abs
     or (v_live > 0 and v_candidates::numeric / v_live::numeric > p_cap_pct) then
    return jsonb_build_object('status', 'safety_skipped',
      'candidates', v_candidates, 'live', v_live, 'removed', 0);
  end if;

  if p_apply then
    with cand as (
      select distinct m.id
      from market_listings m
      join realadvisor_slice_coverage c
        on c.fully_enumerated = true
       and c.observed_at > now() - (p_window_days::text || ' days')::interval
       and c.canton_code is not null
       and m.canton = c.canton_code
       and m.last_seen_at < c.cycle_id
       and (
            (c.gte is null and c.lte is null)
         or (c.gte is not null and c.lte is not null
             and coalesce(m.current_price, m.price) between c.gte and c.lte)
         or (c.gte is not null and c.lte is null
             and coalesce(m.current_price, m.price) >= c.gte)
       )
      where m.source_portal = 'realadvisor'
        and m.transaction_type = p_offer_type
        and m.status in ('active', 'price_reduced')
    )
    update market_listings t
      set status = 'removed', updated_at = now()
    from cand
    where t.id = cand.id;
    get diagnostics v_removed = row_count;
    v_status := 'completed';
  else
    v_status := 'dry_run';
  end if;

  return jsonb_build_object('status', v_status,
    'candidates', v_candidates, 'live', v_live, 'removed', v_removed);
end;
$$;

revoke all on function public.realadvisor_sweep_enum(text, int, int, numeric, boolean) from public;
grant execute on function public.realadvisor_sweep_enum(text, int, int, numeric, boolean) to service_role;

-- 4) Flags app_config. sweep_enabled='false' ⇒ DRY-RUN (calibrage avant d'armer).
--    UA vide ⇒ fallback Chrome (rollback = 1 UPDATE). shard_map = 7 buckets équilibrés par
--    volume (dow 0=dimanche..6=samedi) ; Tessin seul (canton le plus lourd).
insert into public.app_config (key, value) values
  ('realadvisor_user_agent', ''),
  ('realadvisor_contact_email', ''),
  ('realadvisor_sweep_enabled', 'false'),
  ('realadvisor_rolling_enabled', 'true'),
  ('realadvisor_shard_map',
   '[["canton-lucerne","canton-thurgovie","canton-soleure","canton-schaffhouse","canton-zoug","canton-schwyz","canton-bale-ville","canton-appenzell-rhodes-exterieures","canton-appenzell-rhodes-interieures","canton-glaris","canton-nidwald","canton-obwald","canton-uri"],["canton-tessin"],["canton-vaud"],["canton-valais"],["canton-zurich","canton-berne","canton-geneve"],["canton-argovie","canton-bale-campagne","canton-grisons"],["canton-fribourg","canton-saint-gall","canton-jura","canton-neuchatel"]]')
on conflict (key) do nothing;

-- 5) Crons (hors cluster 02:00-05:00 UTC). get_app_config('service_role_key') = clé runtime sb_secret.
--    Rolling 22:00 : crawl scopé du bucket du jour (rafraîchit last_seen + écrit les reçus).
--    Sweep 01:30 : lit les reçus de toutes les nuits du cycle (age-based, ordre intra-nuit indifférent).
do $$ begin perform cron.unschedule('realadvisor-rolling-daily'); exception when others then null; end $$;
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.schedule('realadvisor-rolling-daily', '0 22 * * *', $cron$
  select net.http_post(
    url := 'https://eayczugyrvmtqnnmvjod.supabase.co/functions/v1/realadvisor-sync',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'Authorization', 'Bearer ' || public.get_app_config('service_role_key')),
    body := jsonb_build_object('mode', 'chunk', 'offer_type', 'buy', 'trigger_source', 'cron-rolling',
      'cantons', (public.get_app_config('realadvisor_shard_map')::jsonb)
                   -> (extract(dow from (now() at time zone 'UTC'))::int))
  ) $cron$);
  end if;
end $$;

do $$ begin perform cron.unschedule('realadvisor-sweep-enum-daily'); exception when others then null; end $$;
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.schedule('realadvisor-sweep-enum-daily', '30 1 * * *', $cron$
  select net.http_post(
    url := 'https://eayczugyrvmtqnnmvjod.supabase.co/functions/v1/realadvisor-sync',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'Authorization', 'Bearer ' || public.get_app_config('service_role_key')),
    body := jsonb_build_object('mode', 'sweep_enum', 'offer_type', 'buy', 'trigger_source', 'cron-sweep')
  ) $cron$);
  end if;
end $$;
