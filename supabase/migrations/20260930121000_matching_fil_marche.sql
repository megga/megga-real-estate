-- ══════════════════════════════════════════════════════════════════════════════
-- Le fil de matchs, lot 2 : une ligne « Marché » par acheteur (17.09.2026)
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Conception : docs/superpowers/specs/2026-09-17-matching-fil-design.md, §3.2 et §8.
--
-- POURQUOI UNE RPC. Mesuré en production le 17.09.2026 : 1 612 matchs à traiter sur des annonces du
-- marché pour 4 acheteurs (40, 133, 406 et 1 033), contre 10 sur les biens en mandat. Le fil n'en
-- montre qu'UNE ligne par acheteur — leur nombre, le meilleur score et trois vignettes. Les biens
-- eux-mêmes ne descendent au navigateur qu'à l'ouverture d'une sélection, vingt à la fois.
--
-- ── Ce qu'une ligne compte ──
-- `suggested`, non reporté (`snoozed_until` nul ou échu), sur une annonce non `removed` : la purge
-- nocturne (`purge_stale_market_matches`) ne passe qu'une fois par nuit.
--
-- ── Vignettes ──
-- `photos_cf` (jsonb) porte des URL en chaîne OU des objets `{thumb, …}` (3 annonces sur 1 618 le
-- 17.09.2026) ; `photos` (text[]) sinon. Une chaîne vide n'est pas une photo : sans `nullif`,
-- `coalesce` la retiendrait (elle n'est pas nulle) sans essayer la source suivante, et la ligne
-- rendrait une vignette cassée.
-- Les trois vignettes sont les trois premières NON nulles dans l'ordre du rang : un bien de tête sans
-- photo ne prend pas de place, la ligne en montre trois tant que trois biens en ont une.
--
-- ── Ordre ──
-- Score décroissant, puis le plus récent, puis l'id — le même que `useSelectionMarche`, pour que les
-- vignettes de la ligne soient les premiers biens de la sélection ouverte. `nulls last` : en `desc`,
-- Postgres range les NULL EN TÊTE, et une date absente passerait devant toutes les autres.
--
-- ── Sécurité et index ──
-- SECURITY INVOKER : la RLS de `matches` (par agence) s'applique. Le filtre explicite sur
-- `get_user_agency_id()` sert `idx_matches_agency_focus (agency_id, contact_id, score desc)
-- where status = 'suggested'`.
--
-- ⚠ DATE-GUARD (`deploy.yml`) : une migration n'est appliquée que si son horodatage est ≥ au jour UTC
-- de la fusion. Renommer ce fichier au jour de la fusion si elle a lieu après le 21.09.2026.

begin;

create or replace function public.matching_fil_marche()
returns table (
  contact_id uuid,
  nombre integer,
  meilleur_score integer,
  vignettes text[]
)
language sql
stable
security invoker
set search_path to 'public', 'pg_temp'
as $$
  with retenus as (
    select m.contact_id,
           m.score,
           coalesce(
             nullif(case when jsonb_typeof(ml.photos_cf -> 0) = 'string' then ml.photos_cf ->> 0 end, ''),
             nullif(ml.photos_cf -> 0 ->> 'thumb', ''),
             nullif(ml.photos[1], '')
           ) as vignette,
           row_number() over (
             partition by m.contact_id order by m.score desc, m.created_at desc nulls last, m.id
           ) as rang
      from public.matches m
      join public.market_listings ml on ml.id = m.market_listing_id
     where m.agency_id = public.get_user_agency_id()
       and m.status = 'suggested'
       and m.market_listing_id is not null
       and (m.snoozed_until is null or m.snoozed_until <= now())
       and ml.status is distinct from 'removed'
  )
  select r.contact_id,
         count(*)::integer,
         max(r.score)::integer,
         coalesce((array_agg(r.vignette order by r.rang) filter (where r.vignette is not null))[1:3], '{}'::text[])
    from retenus r
   group by r.contact_id
   order by max(r.score) desc, count(*) desc;
$$;

comment on function public.matching_fil_marche() is
  'Fil de matchs (lot 2) : une ligne « Marché » par acheteur — nombre de matchs du marché à traiter, meilleur score, trois vignettes.';

revoke all on function public.matching_fil_marche() from public, anon;
grant execute on function public.matching_fil_marche() to authenticated;

commit;
