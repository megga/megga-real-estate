-- ══════════════════════════════════════════════════════════════════════════════
-- Pige (étape 1b, 21.09.2026) : une annonce EN BAISSE reste vivante pour ses lecteurs SQL
-- ══════════════════════════════════════════════════════════════════════════════
--
-- La pige (20260930150000) étend `trg_ra_price_status` à Flatfox : une location dont le loyer descend
-- sous son premier loyer passe `price_reduced`, comme une vente RealAdvisor depuis le 19.06.2026. Deux
-- lecteurs SQL ne lisaient que `status = 'active'` et perdaient ces locations :
--   · `market_rent_stats` (référence de loyer du matching) : chaque location en baisse sortait des
--     comparables, et la référence aurait glissé vers les loyers qui ne baissent pas ;
--   · `flatfox_active_count_refresh()` (carte Flatfox de la console) : chaque baisse aurait fait baisser
--     le compte, comme une collecte qui perd des annonces.
-- Le troisième lecteur, la recherche des copilotes (`execSearchListings`), se corrige dans son edge.
--
-- Index (CLAUDE.md §7) : le prédicat `status in ('active', 'price_reduced')` est, au mot près, celui des
-- index partiels `idx_ml_active_tx_canton_type` (locations) et `idx_ml_flatfox_vivantes_vues`
-- (20260930145000, Flatfox). Les deux lecteurs tournent sous pg_cron, sans statement_timeout.
--
-- ⚠ DATE-GUARD : horodatage ≥ au jour UTC de la fusion, APRÈS 20260930150000. Rejouable : CREATE OR
-- REPLACE pour la fonction, DROP … IF EXISTS puis CREATE pour la vue (une vue matérialisée ne se remplace
-- pas), index en IF NOT EXISTS.

begin;

-- La vue est lue par le moteur de matching à chaque notation, et le DROP la verrouille : mieux vaut
-- échouer vite, et être rejouée au push suivant du jour, que la faire attendre derrière un verrou en file.
set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- ─── 1. Le compte Flatfox de la console ───────────────────────────────────────
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
   where source_portal = 'flatfox' and status in ('active', 'price_reduced');

  insert into public.app_config (key, value)
  values ('flatfox_active_count', jsonb_build_object('count', v_n, 'measured_at', now())::text)
  on conflict (key) do update set value = excluded.value;

  return v_n;
end $$;

comment on function public.flatfox_active_count_refresh() is
  'Compte exact des annonces Flatfox VIVANTES (active ou price_reduced : une location en baisse reste en ligne, 20260930151000), écrit dans app_config.flatfox_active_count ({count, measured_at}). Tourne sous pg_cron toutes les heures : le count direct expirait sous le statement_timeout de PostgREST (20260913120200). Service_role ou postgres seuls.';

-- ─── 2. La référence de loyer ─────────────────────────────────────────────────
-- Même définition que 20260618210000 (niveaux, bornes, winsorisation, seg_key) ; seul le prédicat de
-- statut change.
drop materialized view if exists public.market_rent_stats;

create materialized view public.market_rent_stats as
with base as (
  select
    ml.canton,
    ml.type,
    ml.postal_code,
    ml.city,
    case
      when ml.surface_m2 < 50  then '<50'
      when ml.surface_m2 < 80  then '50-80'
      when ml.surface_m2 < 120 then '80-120'
      else '120+'
    end as surface_band,
    (coalesce(ml.current_price, ml.price)::numeric / nullif(ml.surface_m2, 0)) as loyer_m2
  from public.market_listings ml
  where ml.transaction_type = 'rent'
    and ml.status in ('active', 'price_reduced')
    and ml.type in ('apartment','house','villa')
    and ml.canton is not null
    and ml.surface_m2 between 8 and 1000
    and coalesce(ml.current_price, ml.price) between 200 and 20000
),
bounds as (
  select
    percentile_cont(0.025) within group (order by loyer_m2) as lo,
    percentile_cont(0.975) within group (order by loyer_m2) as hi
  from base
),
wins as (
  select
    b.canton, b.type, b.postal_code, b.city, b.surface_band,
    greatest(bo.lo, least(bo.hi, b.loyer_m2)) as loyer_m2
  from base b cross join bounds bo
),
seg as (
select
  'canton_surf'::text as level,
  w.canton,
  w.type,
  w.surface_band,
  null::text as postal_code,
  null::text as city,
  percentile_cont(0.5)  within group (order by w.loyer_m2)::numeric(10,2) as median_loyer_m2,
  percentile_cont(0.25) within group (order by w.loyer_m2)::numeric(10,2) as p25_loyer_m2,
  percentile_cont(0.75) within group (order by w.loyer_m2)::numeric(10,2) as p75_loyer_m2,
  count(*)::int as n_comparables
from wins w
group by w.canton, w.type, w.surface_band
having count(*) >= 20  -- DOIT égaler app_config.market_rent_reference_v1.min_comparables — bouger les DEUX ensemble

union all
select
  'city_surf'::text,
  w.canton,
  w.type,
  w.surface_band,
  null::text as postal_code,
  w.city,
  percentile_cont(0.5)  within group (order by w.loyer_m2)::numeric(10,2),
  percentile_cont(0.25) within group (order by w.loyer_m2)::numeric(10,2),
  percentile_cont(0.75) within group (order by w.loyer_m2)::numeric(10,2),
  count(*)::int
from wins w
where w.city is not null
group by w.canton, w.type, w.surface_band, w.city
having count(*) >= 20  -- idem : lié à min_comparables

union all
select
  'npa_surf'::text,
  w.canton,
  w.type,
  w.surface_band,
  w.postal_code,
  null::text as city,
  percentile_cont(0.5)  within group (order by w.loyer_m2)::numeric(10,2),
  percentile_cont(0.25) within group (order by w.loyer_m2)::numeric(10,2),
  percentile_cont(0.75) within group (order by w.loyer_m2)::numeric(10,2),
  count(*)::int
from wins w
where w.postal_code is not null
group by w.canton, w.type, w.surface_band, w.postal_code
having count(*) >= 20  -- idem : lié à min_comparables
)
select
  s.*,
  (s.level || '|' || s.canton || '|' || s.type || '|' || s.surface_band
    || '|' || coalesce(s.postal_code, '') || '|' || coalesce(s.city, '')) as seg_key
from seg s
with no data;

-- Les deux index de 20260618210000 : l'unique sur seg_key, requis par le REFRESH … CONCURRENTLY du cron
-- `market-rent-stats-refresh` (qui vise la vue par son nom, et la retrouve), et celui de lecture L1.
create unique index if not exists uq_market_rent_stats
  on public.market_rent_stats (seg_key);
create index if not exists idx_market_rent_stats_l1
  on public.market_rent_stats (canton, type, surface_band)
  where level = 'canton_surf';

refresh materialized view public.market_rent_stats;

-- Mêmes droits qu'avant (20260618210000 puis 20260628120000) : service_role seul. Les privilèges par
-- défaut du schéma en donneraient à anon et authenticated, d'où le REVOKE explicite.
revoke all on public.market_rent_stats from public, anon, authenticated;
grant select on public.market_rent_stats to service_role;

comment on materialized view public.market_rent_stats is
  'Loyers demandés par segment (canton, ville, NPA × type × surface), n ≥ 20. Comparables : les locations VIVANTES, active ou price_reduced (une location en baisse reste en ligne, 20260930151000). Rafraîchie chaque jour par pg_cron (market-rent-stats-refresh).';

commit;
