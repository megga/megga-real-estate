-- ══════════════════════════════════════════════════════════════════════════════
-- Flatfox : le balayage des retraits repart, par lots (pige, étape 1b, 21.09.2026)
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Plan : docs/superpowers/plans/2026-09-21-pige-lisible.md, Task 2 (Question 1, tranchée OUI par Julien le
-- 21.09.2026 : le balayage et son rattrapage font partie de l'étape 1b).
--
-- ⛔ LE BALAYAGE FLATFOX EST EN PANNE MUETTE DEPUIS LE 05.09.2026. Mesuré en production le 21.09 :
--   · `flatfox_sync_runs.total_removed` = 0 à chaque passage depuis le 05.09, runs pourtant `completed` ;
--   · journal de l'edge : « sweep error: canceling statement due to statement timeout » (04:17:23 UTC) —
--     l'UPDATE unique de retrait dépasse les 8 s de PostgREST ;
--   · 12 492 annonces Flatfox « actives » non vues au passage du 21.09, dont 7 882 depuis plus de sept
--     jours : un quart des locations servies au matching n'existent plus.
--
-- 1. Un index partiel des Flatfox vivantes par dernière vue : le balayage n'y lit que les candidates, au
--    lieu de traverser les ~94 000 retirées de `idx_ml_flatfox_sync` avec un accès au tas chacune.
-- 2. Rattrapage : ces annonces passent `removed`, UNE fois, AVANT que la migration de la pige
--    (20260930150000) ne pose ses déclencheurs. Disparues avant la mise en service, elles gardent
--    removed_at NULL et n'écrivent aucun historique, comme toute annonce retirée avant elle ; sans cet
--    ordre, « Retirés » les daterait toutes du jour de la fusion.
-- 3. flatfox_balayer_retraits() : un lot borné par appel ; `flatfox-sync` rappelle tant qu'un lot revient
--    plein. Au premier lot, un plafond RELATIF au vivier (`p_plafond`) : au-delà, rien n'est retiré.
--
-- ⚠ DATE-GUARD : horodatage ≥ au jour UTC de la fusion, sinon `deploy.yml` la saute ; la renommer au jour
-- de la fusion en gardant un horodatage ANTÉRIEUR à celui de la migration de la pige.
-- Rejouable : le rattrapage se tait dès que le déclencheur de la pige existe (rejeu du même jour).
-- ⚠ Pas de CONCURRENTLY : deploy.yml envoie le fichier en un seul bloc transactionnel.

begin;

-- L'index et le rattrapage verrouillent `market_listings`, où la collecte et les sondes écrivent et que
-- tout le CRM lit : un verrou qui attend en file fait attendre derrière lui chaque requête suivante. Mieux
-- vaut échouer vite, et être rejouée au push suivant du jour (précédent : 20260910200728).
set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- ─── 1. Index (posé d'abord : le rattrapage s'en sert) ─────────────────────────
create index if not exists idx_ml_flatfox_vivantes_vues
  on public.market_listings (last_seen_at)
  where source_portal = 'flatfox' and status in ('active', 'price_reduced');

-- ─── 2. Rattrapage, une seule fois ────────────────────────────────────────────
do $$
declare
  v_depart timestamptz;
  v_vivantes integer;
  v_candidates integer;
begin
  -- Rejeu du même jour : la pige est posée, ce qui reste appartient au balayage par lots.
  if exists (
    select 1 from pg_trigger
     where tgrelid = 'public.market_listings'::regclass and tgname = 'trg_ml_historique_maj'
  ) then
    raise notice 'rattrapage Flatfox : déjà fait (la pige est en service)';
    return;
  end if;

  -- Le dernier passage COMPLET qui a vu au moins 80 % de ce qu'il attendait (la garde de l'edge).
  select r.started_at into v_depart
    from public.flatfox_sync_runs r
   where r.status = 'completed'
     and r.total_expected > 0
     and r.total_seen >= 0.8 * r.total_expected
   order by r.started_at desc
   limit 1;
  if v_depart is null then
    raise notice 'rattrapage Flatfox : aucun passage complet, rien à faire';
    return;
  end if;

  select count(*) into v_vivantes
    from public.market_listings
   where source_portal = 'flatfox' and status in ('active', 'price_reduced');

  -- ⚠ Dix minutes de marge : la première invocation de l'edge fixe l'horodatage qu'elle écrit dans
  -- `last_seen_at` (`nowIso`) quelques secondes AVANT d'insérer la ligne de run (`started_at`).
  select count(*) into v_candidates
    from public.market_listings
   where source_portal = 'flatfox' and status in ('active', 'price_reduced')
     and last_seen_at < v_depart - interval '10 minutes';

  -- Au-delà de 40 % du vivier, c'est un incident, pas un rattrapage : on ne retire rien.
  if v_candidates > 0.4 * v_vivantes then
    raise notice 'rattrapage Flatfox : % candidates sur % vivantes, au-delà de 40 %% — rien n''est retiré', v_candidates, v_vivantes;
    return;
  end if;

  update public.market_listings
     set status = 'removed'
   where source_portal = 'flatfox' and status in ('active', 'price_reduced')
     and last_seen_at < v_depart - interval '10 minutes';
  raise notice 'rattrapage Flatfox : % annonces retirées (dernier passage complet : %)', v_candidates, v_depart;
end $$;

-- ─── 3. Le balayage par lots ──────────────────────────────────────────────────
-- ⚠ Une base de travail a pu garder la signature à deux arguments : deux surcharges rendraient l'appel
-- nommé de l'edge ambigu pour PostgREST (PGRST203).
drop function if exists public.flatfox_balayer_retraits(timestamptz, integer);

create or replace function public.flatfox_balayer_retraits(
  p_sync_start timestamptz,
  p_limit integer default 500,
  p_plafond integer default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
  v_candidates integer;
begin
  if not (public.is_service_role() or session_user in ('postgres', 'supabase_admin')) then
    raise exception 'forbidden: service or postgres only' using errcode = '42501';
  end if;

  -- Le plafond RELATIF, vérifié au premier lot (`p_plafond` posé par l'edge) : au-delà, c'est un incident
  -- (catalogue servi en partie, `last_seen_at` non écrit), pas un balayage, et comme le rattrapage
  -- ci-dessus on ne retire RIEN. Compte BORNÉ à p_plafond + 1 : l'index partiel ne lit que les
  -- candidates, et jamais plus qu'il n'en faut pour trancher.
  if p_plafond is not null then
    select count(*) into v_candidates
      from (select 1
              from public.market_listings c
             where c.source_portal = 'flatfox'
               and c.status in ('active', 'price_reduced')
               and c.last_seen_at < p_sync_start
             limit greatest(p_plafond, 0) + 1) s;
    if v_candidates > p_plafond then
      raise exception 'balayage refusé : plus de % annonces Flatfox non revues, au-delà du plafond relatif ; rien n''est retiré',
        greatest(p_plafond, 0);
    end if;
  end if;

  update public.market_listings ml
     set status = 'removed'
   where ml.id in (
     select c.id
       from public.market_listings c
      where c.source_portal = 'flatfox'
        and c.status in ('active', 'price_reduced')
        and c.last_seen_at < p_sync_start
      order by c.last_seen_at desc
      limit greatest(1, least(coalesce(p_limit, 500), 2000))
   );
  get diagnostics v_n = row_count;
  return v_n;
end $$;

comment on function public.flatfox_balayer_retraits(timestamptz, integer, integer) is
  'Retire (status = removed) au plus p_limit annonces Flatfox vivantes non revues depuis p_sync_start. Appelée en boucle par flatfox-sync tant qu''un lot revient plein : l''UPDATE unique d''avant dépassait le statement_timeout de 8 s (panne muette du 05.09 au 21.09.2026). p_plafond (premier lot) : au-delà de ce nombre de candidates, rien n''est retiré et la fonction lève. Service_role ou postgres seuls.';

revoke all on function public.flatfox_balayer_retraits(timestamptz, integer, integer) from public, anon, authenticated;
grant execute on function public.flatfox_balayer_retraits(timestamptz, integer, integer) to service_role;

commit;
