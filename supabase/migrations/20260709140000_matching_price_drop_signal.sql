-- Signal « prix baissé » dans le matching (consommateur du trigger ra_price_status).
--
-- Le producteur existe depuis le 19 juin (trigger ra_price_status : baisses de
-- prix RealAdvisor → status='price_reduced', price_at_first_seen figé) mais
-- aucun consommateur : la RPC match_candidate_listings INCLUT les biens
-- price_reduced dans le WHERE, sans renvoyer ni status ni price_at_first_seen
-- → le scorer (calculateScoreV2) ne peut pas voir le signal.
--
-- Changement : la RPC renvoie 2 colonnes de plus (status, price_at_first_seen).
-- Additif — les consommateurs existants (useMatchingRecherche ne lit que id,
-- matching-engine passe la row entière au scorer) ne cassent pas. Le bonus
-- lui-même vit dans _shared/matching-normalize.ts (même PR), design red-team
-- 19/06 : bonus borné additif façon pricePosition + suffixe budget.detail,
-- JAMAIS une 6e clé reasons.
--
-- DROP requis : changer le RETURNS TABLE d'une fonction existante n'est pas
-- permis via CREATE OR REPLACE.

DROP FUNCTION IF EXISTS public.match_candidate_listings(text, numeric, numeric, numeric, text[], text[], integer, integer, text);

CREATE FUNCTION public.match_candidate_listings(
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
  ORDER BY ml.quality_score DESC NULLS LAST, COALESCE(ml.current_price, ml.price) ASC
  LIMIT GREATEST(COALESCE(p_limit, 400), 1);
$$;

REVOKE ALL ON FUNCTION public.match_candidate_listings(text, numeric, numeric, numeric, text[], text[], integer, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_candidate_listings(text, numeric, numeric, numeric, text[], text[], integer, integer, text) TO authenticated, service_role;
