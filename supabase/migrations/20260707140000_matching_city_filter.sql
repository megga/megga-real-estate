-- ============================================================================
-- Recherche Matching — filtre VILLE exact (p_city) + autocomplétion des villes
-- ============================================================================
-- La recherche libre pouvait scoper au canton mais pas à une VILLE précise :
-- « Nyon » ne ramenait que le top-60 du canton VD tamisé côté client. Ici on
-- pousse la ville EN SQL (accent/casse-insensible via unaccent) et on fournit une
-- autocomplétion sur les ~3750 villes du marché connecté. Perf prouvée ~110 ms
-- (index idx_ml_active_tx_canton_type + post-filtre unaccent sur le sous-ensemble
-- transaction) — pas de nouvel index nécessaire.

-- Extension unaccent (accent-insensible). Présente en prod (dans public) → no-op
-- via IF NOT EXISTS ; ABSENTE sur le Supabase local de CI (supabase start) → on
-- l'installe ici dans public pour que public.unaccent() résolve partout.
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;

-- ----------------------------------------------------------------------------
-- 1. match_candidate_listings : + p_city (filtre ville exact, unaccent)
-- ----------------------------------------------------------------------------
-- Ajout d'un paramètre → DROP puis CREATE (CREATE OR REPLACE ne peut pas changer
-- l'arité). Les appels existants (args nommés sans p_city) restent valides (DEFAULT
-- NULL). Idempotent : DROP IF EXISTS de l'ancienne signature 8-args, puis re-CREATE.
DROP FUNCTION IF EXISTS public.match_candidate_listings(text, numeric, numeric, numeric, text[], text[], integer, integer);

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
RETURNS TABLE(id uuid, price numeric, current_price numeric, type text, canton text, city text, rooms numeric, surface_m2 numeric, features jsonb, lat double precision, lng double precision, transaction_type text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '15s'
AS $function$
  SELECT ml.id, ml.price, ml.current_price, ml.type, ml.canton, ml.city,
         ml.rooms, ml.surface_m2, ml.features, ml.lat, ml.lng, ml.transaction_type
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
$function$;

REVOKE ALL ON FUNCTION public.match_candidate_listings(text, numeric, numeric, numeric, text[], text[], integer, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_candidate_listings(text, numeric, numeric, numeric, text[], text[], integer, integer, text) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. search_cities : autocomplétion des villes (préfixe, unaccent, top par volume)
-- ----------------------------------------------------------------------------
-- Alimente l'omnibox : l'agent tape → suggestions de vraies villes (toutes celles
-- qui ont des annonces) → picker pose un jeton ville → p_city ci-dessus. Préfixe
-- >= 2 requis (évite un scan à vide) ; wildcards LIKE neutralisés dans le préfixe.
CREATE OR REPLACE FUNCTION public.search_cities(
  p_prefix text,
  p_tx text DEFAULT NULL,
  p_limit integer DEFAULT 8
)
RETURNS TABLE(city text, canton text, n bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '5s'
AS $function$
  SELECT ml.city, ml.canton, count(*) AS n
  FROM public.market_listings ml
  WHERE ml.status IN ('active', 'price_reduced')
    AND ml.quality_score >= 50
    AND ml.city IS NOT NULL
    AND char_length(btrim(COALESCE(p_prefix, ''))) >= 2
    AND (p_tx IS NULL OR ml.transaction_type = p_tx)
    AND public.unaccent(lower(ml.city)) LIKE
        public.unaccent(lower(replace(replace(btrim(p_prefix), '%', ''), '_', ''))) || '%'
  GROUP BY ml.city, ml.canton
  ORDER BY n DESC, ml.city ASC
  LIMIT GREATEST(COALESCE(p_limit, 8), 1);
$function$;

REVOKE ALL ON FUNCTION public.search_cities(text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_cities(text, text, integer) TO authenticated, service_role;
