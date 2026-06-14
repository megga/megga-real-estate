-- Matching v2 (Direction A) : RPC de pré-filtre dur + insertions dé-dupliquées.
--
-- match_candidate_listings : pousse le pré-filtre DUR en SQL (transaction_type,
-- fourchette de budget tolérante, canton, type, qualité, prix>0) pour passer de
-- ~34 700 annonces à quelques centaines AVANT le scoring Deno. Lit uniquement des
-- données marché publiques (aucune donnée tenant) -> SECURITY DEFINER OK, et fixe
-- statement_timeout. Le WHERE (transaction_type[,canton,type]) est servi par
-- idx_ml_active_tx_canton_type ; le filtre budget sur COALESCE(current_price,price)
-- s'applique en post-index sur le petit sous-ensemble (acceptable, LIMIT borné).
-- idx_ml_relevance ayant été supprimé, on ne trie PAS par relevance_score : tri
-- par quality_score (idx partiel) puis prix, en mémoire sur le sous-ensemble.
CREATE OR REPLACE FUNCTION public.match_candidate_listings(
  p_tx text,
  p_budget_min numeric DEFAULT NULL,
  p_budget_max numeric DEFAULT NULL,
  p_margin numeric DEFAULT 0.15,
  p_cantons text[] DEFAULT NULL,
  p_types text[] DEFAULT NULL,
  p_min_quality integer DEFAULT 50,
  p_limit integer DEFAULT 400
)
RETURNS TABLE (
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
  transaction_type text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '15s'
AS $$
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
  ORDER BY ml.quality_score DESC NULLS LAST, COALESCE(ml.current_price, ml.price) ASC
  LIMIT GREATEST(COALESCE(p_limit, 400), 1);
$$;

REVOKE ALL ON FUNCTION public.match_candidate_listings(text, numeric, numeric, numeric, text[], text[], integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_candidate_listings(text, numeric, numeric, numeric, text[], text[], integer, integer) TO authenticated, service_role;

-- insert_market_matches / insert_internal_matches : insertion batch dé-dupliquée.
-- SECURITY INVOKER (défaut). NB : l'edge matching-engine appelle ces RPC avec un
-- client service_role (require-agent-auth crée TOUJOURS un client service_role, même
-- pour un JWT agent) -> au runtime la RLS est de toute façon bypassée ; l'isolation
-- tenant vient de agency_id (dérivé du JWT) posé par l'edge, PAS de la RLS. INVOKER
-- borne néanmoins un éventuel appel direct authenticated (matches_insert WITH CHECK).
-- Le prédicat partiel est OBLIGATOIRE dans le conflict_target (index uniques partiels
-- uq_matches_contact_market / uq_matches_contact_property), que supabase-js .upsert()
-- ne sait pas exprimer.
-- RETURNING * ne renvoie QUE les lignes réellement créées -> l'appelant n'audite
-- et ne compte que celles-là.
CREATE OR REPLACE FUNCTION public.insert_market_matches(p_rows jsonb)
RETURNS SETOF public.matches
LANGUAGE sql
SET search_path = public
AS $$
  INSERT INTO public.matches (
    agency_id, contact_id, market_listing_id, client_search_id,
    score, reasons, status, source, score_version
  )
  SELECT
    (r->>'agency_id')::uuid,
    (r->>'contact_id')::uuid,
    (r->>'market_listing_id')::uuid,
    NULLIF(r->>'client_search_id', '')::uuid,
    (r->>'score')::int,
    COALESCE(r->'reasons', '{}'::jsonb),
    COALESCE(NULLIF(r->>'status', ''), 'suggested'),
    'market',
    NULLIF(r->>'score_version', '')::int
  FROM jsonb_array_elements(p_rows) AS r
  ON CONFLICT (contact_id, market_listing_id) WHERE market_listing_id IS NOT NULL DO NOTHING
  RETURNING *;
$$;

CREATE OR REPLACE FUNCTION public.insert_internal_matches(p_rows jsonb)
RETURNS SETOF public.matches
LANGUAGE sql
SET search_path = public
AS $$
  INSERT INTO public.matches (
    agency_id, contact_id, property_id, client_search_id,
    score, reasons, status, source, score_version
  )
  SELECT
    (r->>'agency_id')::uuid,
    (r->>'contact_id')::uuid,
    (r->>'property_id')::uuid,
    NULLIF(r->>'client_search_id', '')::uuid,
    (r->>'score')::int,
    COALESCE(r->'reasons', '{}'::jsonb),
    COALESCE(NULLIF(r->>'status', ''), 'suggested'),
    'internal',
    NULLIF(r->>'score_version', '')::int
  FROM jsonb_array_elements(p_rows) AS r
  ON CONFLICT (contact_id, property_id) WHERE property_id IS NOT NULL DO NOTHING
  RETURNING *;
$$;

REVOKE ALL ON FUNCTION public.insert_market_matches(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.insert_internal_matches(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.insert_market_matches(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.insert_internal_matches(jsonb) TO authenticated, service_role;
