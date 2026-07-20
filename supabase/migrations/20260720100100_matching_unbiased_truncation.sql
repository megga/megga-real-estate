-- match_candidate_listings : troncature NEUTRE en prix (retrait de `prix ASC`).
--
-- Le tri était `quality_score DESC NULLS LAST, COALESCE(current_price, price) ASC`.
-- L'intention affichée était « les meilleures annonces d'abord ». En pratique la
-- quasi-totalité des annonces actives partagent le MÊME quality_score : la 1re
-- clé ne départage rien, et `prix ASC` décide seul. Dès que la population filtrée
-- dépasse p_limit, les consommateurs ne voient donc QUE les annonces les moins
-- chères — une troncature silencieuse et corrélée au prix.
--
-- Trois consommateurs, tous affectés :
--   · useMatchingRecherche (p_limit 60)  — l'agent voit les 60 moins chères
--   · matching-engine      (p_limit 400) — candidats proposés à un acheteur
--   · copilot get_market_stats           — corrigé séparément (market_sale_stats,
--                                          agrégat SQL sur toute la population)
--
-- Pour le matching, le biais joue À CONTRESENS du scoring : la fourchette SQL est
-- [budget_min * (1 - marge) ; budget_max * (1 + marge)], et scorePrice pénalise
-- explicitement le bas de cette fourchette (« Sous le budget minimum »). Garder
-- les moins chères revient donc à conserver en priorité les biens qui perdront
-- des points, et à jeter ceux qui tombent en plein dans le budget (frac = 1).
-- Quand budget_min est absent — cas fréquent — la borne basse est 0 et la
-- troncature ne remonte que des biens très en dessous du budget de l'acheteur.
--
-- MESURE prod (20/07/2026), acheteur VD budget 900k-1,2M → fourchette
-- [765k ; 1,38M] : 1 311 candidats éligibles dont 617 strictement dans le budget.
--   ancien tri : 400 candidats rendus, dont  82 dans le budget (20 %), prix médian  850 000
--   nouveau    : 400 candidats rendus, dont 400 dans le budget,        prix médian 1 070 000
-- L'ancien tri rendait donc 318 candidats sur 400 SOUS le budget minimum de
-- l'acheteur, tout en laissant 535 biens en plein budget hors du scoring.
--
-- Nouveau tri, en trois crans :
--   1. quality_score DESC     — conservé (discrimine quand il n'est PAS saturé)
--   2. dans le budget STRICT avant la zone de marge — aligné sur scorePrice
--   3. id                     — départage stable et NON corrélé au prix
--
-- Le WHERE est inchangé : la population candidate est identique, seule change
-- l'identité des p_limit lignes qui survivent à la troncature. RETURNS TABLE
-- identique → CREATE OR REPLACE suffit (pas de DROP, les GRANT sont préservés).

CREATE OR REPLACE FUNCTION public.match_candidate_listings(
  p_tx text,
  p_budget_min numeric DEFAULT NULL,
  p_budget_max numeric DEFAULT NULL,
  p_margin numeric DEFAULT 0.15,
  p_cantons text[] DEFAULT NULL,
  p_types text[] DEFAULT NULL,
  p_min_quality integer DEFAULT 50,
  p_limit integer DEFAULT 400,
  p_city text DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  price numeric,
  current_price numeric,
  type text,
  canton text,
  city text,
  rooms numeric,
  surface_m2 numeric,
  features jsonb,
  lat double precision,
  lng double precision,
  transaction_type text,
  status text,
  price_at_first_seen numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '15s'
AS $$
  SELECT ml.id, ml.price, ml.current_price, ml.type, ml.canton, ml.city,
         ml.rooms, ml.surface_m2, ml.features, ml.lat, ml.lng, ml.transaction_type,
         ml.status, ml.price_at_first_seen
  FROM public.market_listings ml
  WHERE ml.status IN ('active', 'price_reduced')
    AND ml.transaction_type = p_tx
    AND ml.quality_score >= p_min_quality
    AND COALESCE(ml.current_price, ml.price) > 0
    AND (p_budget_max IS NULL OR COALESCE(ml.current_price, ml.price) <= p_budget_max * (1 + p_margin))
    AND (p_budget_min IS NULL OR COALESCE(ml.current_price, ml.price) >= p_budget_min * (1 - p_margin))
    AND (p_cantons IS NULL OR ml.canton = ANY (p_cantons))
    AND (p_types IS NULL OR ml.type = ANY (p_types))
    AND (p_city IS NULL OR public.unaccent(lower(ml.city)) = public.unaccent(lower(p_city)))
  ORDER BY
    ml.quality_score DESC NULLS LAST,
    (CASE
       WHEN (p_budget_min IS NULL OR COALESCE(ml.current_price, ml.price) >= p_budget_min)
        AND (p_budget_max IS NULL OR COALESCE(ml.current_price, ml.price) <= p_budget_max)
       THEN 0 ELSE 1
     END),
    ml.id
  LIMIT GREATEST(COALESCE(p_limit, 400), 1);
$$;

REVOKE ALL ON FUNCTION public.match_candidate_listings(text, numeric, numeric, numeric, text[], text[], integer, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_candidate_listings(text, numeric, numeric, numeric, text[], text[], integer, integer, text) TO authenticated, service_role;
