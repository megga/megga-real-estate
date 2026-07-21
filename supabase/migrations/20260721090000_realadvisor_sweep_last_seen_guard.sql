-- RealAdvisor — un bien re-vu vivant ne doit plus être retiré sur la foi de sondes périmées.
--
-- Constat (20/07/2026) : sur 858 candidats au retrait d'une nuit, 162 avaient été re-vus dans
-- les 12 heures. Test direct sur les 5 plus anciens : l'oracle id_in de RealAdvisor les rendait
-- TOUS LES CINQ présents à l'instant, alors que leur absent_probe_count (3-4) datait des
-- 10-11 juillet. Le retrait se serait appuyé sur une preuve vieille de dix jours, contredite
-- par notre propre crawl du jour.
--
-- Cause : realadvisor_probe_sweep ne consulte jamais last_seen_at. Or les deux chemins qui
-- constatent la présence d'un bien ne se comportent pas pareil :
--   · realadvisor_probe_bookkeep, branche « présent » : remet DÉJÀ absent_probe_count = 0 et
--     absent_first_at = null. Rien à corriger de ce côté.
--   · le crawl (edge fn realadvisor-sync, mapHit) : estampille last_seen_at mais laisse les
--     compteurs d'absence intacts. Un bien que le crawl vient de récupérer depuis RA restait
--     donc candidat au retrait.
--
-- Ce correctif ne vaut qu'en DEUX MOITIÉS INDISSOCIABLES :
--   A. ici : amnistie des lignes déjà incohérentes + garde last_seen_at dans le prédicat ;
--   B. dans l'edge function : mapHit remet les compteurs à zéro à chaque observation
--      (même PR — sans elle, la garde ci-dessous protégerait des lignes à vie, puisque
--      seul le passage à null de absent_first_at permet au coalesce de bookkeep de re-dater).

-- ── A1. Amnistie ponctuelle des lignes déjà incohérentes ──────────────────────────────
-- Un last_seen_at postérieur à la première absence signifie qu'on a constaté la présence
-- APRÈS coup : l'historique d'absence est caduc. Remettre absent_first_at à NULL est ce qui
-- permet à bookkeep (absent_first_at = coalesce(absent_first_at, now())) de repartir d'une
-- date fraîche si le bien redisparaît — sans ça la ligne deviendrait insupprimable à vie.
update market_listings
set absent_probe_count = 0,
    absent_first_at = null
where source_portal = 'realadvisor'
  and status in ('active', 'price_reduced')
  and absent_first_at is not null
  and last_seen_at is not null
  and last_seen_at >= absent_first_at;

-- ── A2. Garde last_seen_at dans le prédicat de retrait ────────────────────────────────
-- Seule différence avec la version précédente : la clause last_seen_at, présente à
-- l'identique dans le comptage des candidats ET dans l'UPDATE (sinon le compteur et le
-- retrait divergent, et le statut 'capped' devient faux).
create or replace function public.realadvisor_probe_sweep(
  p_offer_type text default 'buy',
  p_threshold integer default 3,
  p_min_age_hours integer default 48,
  p_cap_abs integer default 1200,
  p_cap_pct numeric default 0.03,
  p_apply boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_live bigint := 0; v_candidates bigint := 0; v_removed bigint := 0;
  v_limit bigint; v_status text;
begin
  select count(*) into v_live from market_listings
   where source_portal = 'realadvisor' and transaction_type = p_offer_type
     and status in ('active', 'price_reduced');

  select count(*) into v_candidates from market_listings
   where source_portal = 'realadvisor' and transaction_type = p_offer_type
     and status in ('active', 'price_reduced')
     and absent_probe_count >= p_threshold
     and absent_first_at is not null
     and absent_first_at < now() - make_interval(hours => p_min_age_hours)
     -- Re-vu vivant depuis sa première absence ⇒ la preuve d'absence est périmée.
     -- L'égalité protège aussi : « vu » et « absent » au même instant est contradictoire.
     and (last_seen_at is null or last_seen_at < absent_first_at);

  -- Plafond effectif = min(cap absolu, cap relatif). live=0 ⇒ limit=0 ⇒ 0 retrait.
  v_limit := least(p_cap_abs::bigint, floor(v_live * p_cap_pct)::bigint);

  if p_apply then
    update market_listings set status = 'removed', updated_at = now()
     where id in (
       select id from market_listings
        where source_portal = 'realadvisor' and transaction_type = p_offer_type
          and status in ('active', 'price_reduced')
          and absent_probe_count >= p_threshold
          and absent_first_at is not null
          and absent_first_at < now() - make_interval(hours => p_min_age_hours)
          and (last_seen_at is null or last_seen_at < absent_first_at)
        order by absent_first_at asc
        limit v_limit
     );
    get diagnostics v_removed = row_count;
    v_status := case when v_candidates > v_limit then 'capped' else 'completed' end;
  else
    v_status := 'dry_run';
  end if;

  return jsonb_build_object(
    'status', v_status, 'candidates', v_candidates, 'live', v_live,
    'removed', v_removed, 'limit', v_limit, 'capped', v_candidates > v_limit);
end $function$;
