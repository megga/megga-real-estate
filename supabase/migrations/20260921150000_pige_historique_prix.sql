-- ══════════════════════════════════════════════════════════════════════════════
-- Pige lisible et historique des prix (étape 1b de la feuille de route, 21.09.2026)
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Plan : docs/superpowers/plans/2026-09-21-pige-lisible.md. Cahier des charges de Gregory, modules
-- « Pige lisible » et « Historique des prix » (P0).
--
-- Mesuré en production le 21.09.2026, en lecture seule :
--   · market_price_history : 0 ligne ; son seul écrivain était `market-scraper`, dormant.
--   · Flatfox : price_at_first_seen = current_price sur 48 406 actives sur 48 406 — l'upsert réécrit le
--     « premier prix » à chaque passage, aucune baisse n'est détectable ; trg_ra_price_status
--     (20260619160000) ne visait que RealAdvisor.
--   · Retrait sans date ; updated_at n'en tient pas lieu : la sonde de résurrection RealAdvisor
--     (02:45 UTC) le repousse chaque nuit sur les retirées (4 060 touchées en 24 h).
--   · Un flux lu sur market_listings expire à froid (11,5 s pour une ville rare sur 30 jours) : le flux
--     lit donc CETTE table, qui porte le contexte de l'annonce à l'instant de l'événement.
--
-- DEUX TRANSACTIONS, DANS CET ORDRE :
--   A. Le schéma, courte :
--      1. market_listings.removed_at.
--      2. market_price_history ouverte aux relevés, apparitions et statuts ; seul le déclencheur y écrit.
--      3. Le premier prix gelé et la baisse détectée aussi sur Flatfox (trg_ra_price_status).
--      4. removed_at posé par déclencheur.
--      5. Une ligne d'historique à l'insertion et à chaque changement RÉEL de prix ou de statut.
--      6. pige_mouvements() : « Ce qui a bougé » (SECURITY INVOKER, paginé par clé, sans comptage).
--   B. Les données :
--      7. Relevé initial `suivi` de chaque annonce vivante : l'historique commence ICI, on ne reconstitue
--         pas le passé. Les annonces déjà retirées gardent removed_at NULL.
--      8. L'index du flux, bâti UNE fois sur la table remplie, puis ses statistiques.
--
-- ⚠ POURQUOI DEUX. L'ALTER de A prend un verrou exclusif sur market_listings, que tout le CRM lit ; tenu
-- pendant le relevé (~95 000 lignes), il aurait bloqué la Recherche, le matching et la collecte pour toute
-- sa durée. Entre A et B, les déclencheurs écrivent déjà : une annonce qui bouge dans l'intervalle a sa
-- ligne, que le relevé saute (`not exists`) — sa série commence par cet événement.
-- ⚠ lock_timeout de 5 s dans chacune (précédent : 20260910200728) : un verrou qui attend en file fait
-- attendre derrière lui chaque requête suivante sur market_listings. Mieux vaut échouer vite, et être
-- rejouée au push suivant du jour. Si B échoue, A reste acquis (tout y est rejouable) et le rejeu refait B.
--
-- ⚠ DATE-GUARD (`deploy.yml`) : appliquée seulement si son horodatage est ≥ au jour UTC de la fusion,
-- et rejouée à chaque push de ce jour-là. Tout est rejouable (le relevé ne se fait qu'une fois). Renommer
-- au jour de la fusion si elle a lieu plus tard, APRÈS 20260921145000.
-- ⚠ Pas de CONCURRENTLY : deploy.yml envoie le fichier en UNE requête, où chaque instruction tombe dans
-- un bloc transactionnel (explicite ou implicite) — ce que CONCURRENTLY refuse.

-- ══ A. Le schéma ═══════════════════════════════════════════════════════════════
begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- ─── 1. La date du retrait ────────────────────────────────────────────────────
alter table public.market_listings add column if not exists removed_at timestamptz;

comment on column public.market_listings.removed_at is
  'Date à laquelle le CRM a CONSTATÉ le retrait (passage à status = ''removed''), posée par trg_ml_date_retrait et effacée au retour. NULL pour une annonce vivante, et pour toute annonce retirée avant la mise en service de la pige (21.09.2026) : on ne reconstitue pas le passé. RealAdvisor confirme un retrait jusqu''à ~3 jours après la première absence (absent_first_at).';

-- ─── 2. L'historique : relevés, apparitions, statuts ──────────────────────────
alter table public.market_price_history alter column old_price drop not null;
alter table public.market_price_history alter column new_price drop not null;
alter table public.market_price_history
  add column if not exists kind text,
  add column if not exists old_status text,
  add column if not exists new_status text,
  add column if not exists transaction_type text,
  add column if not exists canton text,
  add column if not exists type text,
  add column if not exists city text;

-- Lignes éventuelles de l'ancien `market-scraper` (0 en production le 21.09.2026) : rangées, pas perdues.
update public.market_price_history
   set kind = case when new_price < old_price then 'baisse' when new_price > old_price then 'hausse' else 'prix' end
 where kind is null;

alter table public.market_price_history alter column kind set not null;
alter table public.market_price_history drop constraint if exists market_price_history_kind_check;
alter table public.market_price_history add constraint market_price_history_kind_check
  check (kind in ('suivi', 'apparition', 'baisse', 'hausse', 'prix', 'retrait', 'retour', 'statut'));

comment on table public.market_price_history is
  'Historique des prix et des statuts des annonces du marché, écrit par déclencheur sur market_listings (ml_historique_prix) et par lui seul. Commence à la mise en service de la pige (21.09.2026) : relevé `suivi` de chaque annonce vivante ce jour-là, puis `apparition` de chaque annonce insérée. Chaque ligne porte le contexte de l''annonce à l''instant (transaction_type, canton, type, city) : le flux pige_mouvements filtre dessus.';
comment on column public.market_price_history.kind is
  'suivi : relevé initial · apparition : insertion, datée à la DÉTECTION par la collecte (pas à la publication) · baisse / hausse : prix changé (deux prix > 0) · prix : prix affiché ou retiré (0 ↔ X) · retrait : passage à removed · retour : sortie de removed au même prix · statut : autre changement de statut.';

-- Aucun client n'y écrit : le déclencheur (SECURITY DEFINER) est l'écrivain unique.
revoke insert, update, delete, truncate on table public.market_price_history from authenticated;

-- ─── 3. Le premier prix gelé et la baisse, aussi sur Flatfox ───────────────────
-- Même fonction que RealAdvisor (20260619160000) : le premier prix réel se gèle, first_seen_at aussi,
-- et un passage de la collecte (status 'active') bascule en price_reduced sous ce premier prix. Pour les
-- annonces Flatfox déjà en ligne, le premier prix gelé est celui de la veille du premier passage.
drop trigger if exists trg_ra_price_status on public.market_listings;
create trigger trg_ra_price_status
  before update on public.market_listings
  for each row
  when (new.source_portal in ('realadvisor', 'flatfox'))
  execute function public.ra_price_status();

comment on function public.ra_price_status() is
  'Gèle le premier prix (price_at_first_seen) et first_seen_at, et passe une annonce en price_reduced quand son prix courant descend sous ce premier prix, sur un passage de la collecte (status = active). RealAdvisor depuis le 19.06.2026, Flatfox aussi depuis le 21.09.2026 (le nom est resté). Un UPDATE qui pose explicitement un autre statut (retrait) n''est pas touché.';

-- ─── 4. removed_at posé par déclencheur ───────────────────────────────────────
-- ⚠ L'ordre des BEFORE (alphabétique) n'importe pas ici : trg_ra_price_status ne pose ni ne retire
-- jamais `removed`, il choisit seulement entre active et price_reduced.
create or replace function public.ml_date_retrait()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'removed' then
    if tg_op = 'UPDATE' then
      if old.status = 'removed' then
        -- Déjà retirée : la date ne bouge pas (NULL si retirée avant la pige).
        new.removed_at := old.removed_at;
        return new;
      end if;
    end if;
    new.removed_at := now();
  else
    new.removed_at := null;
  end if;
  return new;
end $$;

comment on function public.ml_date_retrait() is
  'Pose market_listings.removed_at au passage à removed, le garde tant que l''annonce reste retirée, l''efface à son retour. Date de CONSTAT, pas de disparition (pige, 21.09.2026).';

drop trigger if exists trg_ml_date_retrait on public.market_listings;
create trigger trg_ml_date_retrait
  before insert or update on public.market_listings
  for each row
  when (new.status = 'removed' or new.removed_at is not null)
  execute function public.ml_date_retrait();

-- ─── 5. L'historique, écrit à chaque changement réel ──────────────────────────
-- AFTER : la ligne voit le statut FINAL, après trg_ra_price_status. SECURITY DEFINER : l'historique se
-- doit à tout écrivain de market_listings (edges en service_role, crons en postgres), quels que soient
-- ses droits sur cette table. change_pct est borné à ±999,99 (numeric(5,2)) : un déclencheur qui lève
-- ferait échouer l'upsert de la collecte.
create or replace function public.ml_historique_prix()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ancien numeric;
  v_nouveau numeric := coalesce(new.current_price, new.price);
  v_ancien_statut text;
  v_kind text;
begin
  if tg_op = 'INSERT' then
    v_kind := 'apparition';
  else
    v_ancien := coalesce(old.current_price, old.price);
    v_ancien_statut := old.status;
    if new.status = 'removed' and old.status is distinct from 'removed' then
      v_kind := 'retrait';
    elsif v_ancien is distinct from v_nouveau then
      v_kind := case
        when v_ancien > 0 and v_nouveau > 0 and v_nouveau < v_ancien then 'baisse'
        when v_ancien > 0 and v_nouveau > 0 and v_nouveau > v_ancien then 'hausse'
        else 'prix'
      end;
    elsif old.status = 'removed' and new.status <> 'removed' then
      v_kind := 'retour';
    elsif old.status is distinct from new.status then
      v_kind := 'statut';
    else
      -- `price` a bougé sans changer le prix effectif (current_price ?? price) : rien à dire.
      return null;
    end if;
  end if;

  insert into public.market_price_history (
    market_listing_id, kind, old_price, new_price, change_pct,
    old_status, new_status, transaction_type, canton, type, city, detected_at
  ) values (
    new.id, v_kind, v_ancien, v_nouveau,
    case when v_ancien > 0 and v_nouveau > 0
         then greatest(-999.99, least(999.99, round((v_nouveau - v_ancien) / v_ancien * 100, 2)))
    end,
    v_ancien_statut, new.status, new.transaction_type, new.canton, new.type, new.city, now()
  );
  return null;
end $$;

comment on function public.ml_historique_prix() is
  'Écrivain unique de market_price_history : apparition à l''insertion, puis retrait, baisse / hausse / prix, retour ou statut à chaque changement RÉEL (clause WHEN du déclencheur de mise à jour). Pige, 21.09.2026.';

-- SECURITY DEFINER : personne ne l'appelle, elle ne sert qu'aux déclencheurs (qui ne vérifient pas ce
-- droit). Comme les déclencheurs du lot B (20260921140000).
revoke all on function public.ml_historique_prix() from public, anon, authenticated;

drop trigger if exists trg_ml_historique_ins on public.market_listings;
create trigger trg_ml_historique_ins
  after insert on public.market_listings
  for each row
  execute function public.ml_historique_prix();

-- ⚠ Pas de `UPDATE OF current_price, price, status` : trg_ra_price_status (BEFORE) peut changer le
-- statut d'un UPDATE qui ne le nomme pas. La clause WHEN, évaluée sans appel de fonction, suffit à
-- rendre gratuit le passage nocturne qui ne change rien (~76 000 UPDATE par jour en moyenne).
drop trigger if exists trg_ml_historique_maj on public.market_listings;
create trigger trg_ml_historique_maj
  after update on public.market_listings
  for each row
  when (old.current_price is distinct from new.current_price
        or old.price is distinct from new.price
        or old.status is distinct from new.status)
  execute function public.ml_historique_prix();

-- ─── 6. « Ce qui a bougé » ────────────────────────────────────────────────────
-- Mêmes filtres durs que search_market_listings (20260720150000) — marge sur le budget, prix > 0,
-- qualité — pour que le flux décrive la population que la grille montre. Seules les ≤ p_limit lignes
-- retenues sont jointes à market_listings, par clé primaire.
-- ⚠ Deux bornes que l'écran ne suffit pas à tenir : `p_since` recule de 31 jours au plus (l'écran en
-- demande 30 au maximum ; sans borne, un appelant lirait toute la table, ~2 M lignes par an), et un
-- retrait ne sort que pour le retrait EN COURS de son annonce — retirée, revenue puis retirée de nouveau
-- sur la période, elle a deux lignes `retrait` et figurerait deux fois dans « Retirés ». Le retrait en
-- cours est celui qui porte la date de removed_at : même transaction, donc même now().
drop function if exists public.pige_mouvements(text, timestamptz, text, text[], text[], text, numeric, numeric, numeric, integer, timestamptz, uuid, integer);

create function public.pige_mouvements(
  p_kind text,
  p_since timestamptz,
  p_tx text default null,
  p_cantons text[] default null,
  p_types text[] default null,
  p_city text default null,
  p_budget_min numeric default null,
  p_budget_max numeric default null,
  p_margin numeric default 0.15,
  p_min_quality integer default 50,
  p_before_at timestamptz default null,
  p_before_id uuid default null,
  p_limit integer default 30
)
returns table (
  event_id uuid,
  detected_at timestamptz,
  kind text,
  market_listing_id uuid,
  old_price numeric,
  new_price numeric,
  change_pct numeric,
  first_seen_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select h.id, h.detected_at, h.kind, h.market_listing_id,
         h.old_price, h.new_price, h.change_pct, ml.first_seen_at
    from public.market_price_history h
    join public.market_listings ml on ml.id = h.market_listing_id
   where p_kind in ('apparition', 'baisse', 'retrait')
     and h.kind = p_kind
     and h.detected_at >= greatest(p_since, now() - interval '31 days')
     and (h.detected_at, h.id) < (coalesce(p_before_at, 'infinity'::timestamptz),
                                  coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
     and h.new_price > 0
     and (p_tx is null or h.transaction_type = p_tx)
     and (p_cantons is null or h.canton = any (p_cantons))
     and (p_types is null or h.type = any (p_types))
     and (p_city is null or public.unaccent(lower(h.city)) = public.unaccent(lower(p_city)))
     and (p_budget_max is null or h.new_price <= p_budget_max * (1 + p_margin))
     and (p_budget_min is null or h.new_price >= p_budget_min * (1 - p_margin))
     and ml.quality_score >= p_min_quality
     and case when h.kind = 'retrait' then ml.status = 'removed' and h.detected_at >= ml.removed_at
              else ml.status in ('active', 'price_reduced') end
   order by h.detected_at desc, h.id desc
   limit least(greatest(coalesce(p_limit, 30), 1), 100);
$$;

comment on function public.pige_mouvements(text, timestamptz, text, text[], text[], text, numeric, numeric, numeric, integer, timestamptz, uuid, integer) is
  'Pige, « Ce qui a bougé » : apparitions et baisses d''annonces encore vivantes, retrait EN COURS d''annonces encore retirées (une ligne par annonce), depuis p_since borné à 31 jours, sur les filtres durs de la Recherche. Pagination par clé (p_before_at, p_before_id), p_limit ≤ 100, jamais de comptage (CLAUDE.md §7). SECURITY INVOKER : la RLS de l''appelant s''applique.';

revoke all on function public.pige_mouvements(text, timestamptz, text, text[], text[], text, numeric, numeric, numeric, integer, timestamptz, uuid, integer) from public, anon;
grant execute on function public.pige_mouvements(text, timestamptz, text, text[], text[], text, numeric, numeric, numeric, integer, timestamptz, uuid, integer) to authenticated, service_role;

commit;

-- ══ B. Les données ═════════════════════════════════════════════════════════════
begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- ─── 7. Le relevé initial : l'historique commence ici ─────────────────────────
-- UNE fois : après le premier relevé, toute annonce vivante a sa ligne (son relevé, ou l'événement que
-- les déclencheurs ont écrit), et relire les ~95 000 vivantes à chaque rejeu du jour ferait attendre la
-- collecte pour rien. Le relevé est atomique : aucun `suivi` en base ⟺ il n'a pas eu lieu.
-- ⚠ SHARE sur market_listings pendant la lecture : les ÉCRIVAINS attendent, les lecteurs non. Sans lui,
-- une écriture commencée avant le relevé et validée pendant sa lecture laisserait à son annonce un
-- relevé à l'ANCIEN prix, daté après sa baisse — une série qui remonterait au prix d'avant.
do $$
begin
  if exists (select 1 from public.market_price_history where kind = 'suivi') then
    raise notice 'relevé initial : déjà fait';
    return;
  end if;
  lock table public.market_listings in share mode;
  insert into public.market_price_history
    (market_listing_id, kind, old_price, new_price, old_status, new_status,
     transaction_type, canton, type, city, detected_at)
  select ml.id, 'suivi', null, coalesce(ml.current_price, ml.price), null, ml.status,
         ml.transaction_type, ml.canton, ml.type, ml.city, now()
    from public.market_listings ml
   where ml.status in ('active', 'price_reduced')
     -- Une annonce qui a bougé entre A et B a déjà sa ligne : sa série commence par cet événement.
     and not exists (select 1 from public.market_price_history h where h.market_listing_id = ml.id);
end $$;

-- ─── 8. Index du flux, puis ses statistiques ──────────────────────────────────
-- Non partiel : le genre est un PARAMÈTRE de pige_mouvements, un index partiel sur `kind` ne se
-- prouverait pas dans un plan générique. La fiche lit idx_market_price_history_listing (existant).
-- Bâti APRÈS le relevé (une construction au lieu de ~95 000 insertions indexées), puis ANALYZE : la table
-- passe de 0 à ~95 000 lignes d'un coup, et le premier flux ne doit pas se planifier sur une table vide.
create index if not exists idx_mph_evenements
  on public.market_price_history (kind, detected_at desc, id desc);

analyze public.market_price_history;

commit;
