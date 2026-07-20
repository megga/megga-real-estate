-- Matching · Recherche — sélection par FRAÎCHEUR + total honnête du marché filtré.
--
-- POURQUOI CETTE MIGRATION
--
-- L'écran Recherche servait ses candidats via `match_candidate_listings`, dont
-- l'ORDER BY est `quality_score DESC NULLS LAST, COALESCE(current_price, price) ASC`.
-- Or 36 222 annonces actives sont à égalité parfaite sur quality_score = 100 : la
-- première clé ne départage rien, et `prix ASC` décide seul. L'écran affichait donc
-- « les 120 annonces les moins chères de Suisse » — mesuré : vente de CHF 30 000 à
-- 148 700, location de CHF 200 à 410/mois, et ZÉRO annonce genevoise sur les 3 667
-- disponibles. Pour un agent genevois, ce n'était pas un écran pauvre, c'était un
-- écran trompeur.
--
-- POURQUOI UNE NOUVELLE RPC PLUTÔT QUE MODIFIER L'EXISTANTE
--
-- `match_candidate_listings` a TROIS consommateurs, pas un :
--   1. src/hooks/useMatchingRecherche.ts        (cet écran)
--   2. supabase/functions/matching-engine/index.ts:194   (moteur de matching)
--   3. supabase/functions/_shared/copilot-actions.ts:268 (stats de vente du copilote)
-- Changer son ORDER BY aurait modifié en silence la sélection de candidats du moteur
-- ET l'échantillon statistique du copilote. Elle reste donc intacte ; l'écran reçoit
-- sa propre RPC.
--
-- Le WHERE de `search_market_listings` et celui de `count_market_listings` sont
-- COPIÉS À L'IDENTIQUE de `match_candidate_listings` (migration 20260709140000).
-- Toute divergence entre les deux produirait un total qui ne décrit pas la liste
-- affichée — c'est-à-dire le mensonge qu'on est en train de corriger.
--
-- `created_at DESC, id DESC` est aussi la future clé de pagination keyset : `id`
-- est indispensable, `created_at` n'est pas unique.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Index de tri par fraîcheur
-- ─────────────────────────────────────────────────────────────────────────────
-- Sans lui : Parallel Seq Scan, 503 ms mesurées. La forme est validée par mesure
-- sur l'index équivalent existant `idx_ml_rent_active_created` (même colonne de
-- tri, même prédicat partiel) : Index Scan, 5,1 ms.
--
-- Le prédicat reprend `status IN ('active','price_reduced')` — surtout PAS
-- `status = 'active'`, qui exclurait les biens à prix baissé (feature #822).
-- Pas de CONCURRENTLY : deploy.yml envoie le fichier entier dans un seul bloc
-- transactionnel, ce qui ferait échouer la migration.
CREATE INDEX IF NOT EXISTS idx_ml_search_recent
  ON public.market_listings (transaction_type, created_at DESC, id DESC)
  WHERE status IN ('active', 'price_reduced') AND quality_score >= 50;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. search_market_listings — candidats de l'écran Recherche, les plus récents
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.search_market_listings(text, numeric, numeric, numeric, text[], text[], integer, integer, text);

CREATE FUNCTION public.search_market_listings(
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
RETURNS TABLE (
  id uuid,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '15s'
AS $$
  SELECT ml.id, ml.created_at
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
  ORDER BY ml.created_at DESC, ml.id DESC
  LIMIT GREATEST(COALESCE(p_limit, 400), 1);
$$;

REVOKE ALL ON FUNCTION public.search_market_listings(text, numeric, numeric, numeric, text[], text[], integer, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_market_listings(text, numeric, numeric, numeric, text[], text[], integer, integer, text) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. count_market_listings — total EXACT du marché filtré
-- ─────────────────────────────────────────────────────────────────────────────
-- Pourquoi un count exact malgré la règle « JAMAIS count exact » (CLAUDE.md §7) :
-- cette règle vise le count SANS prédicat indexable. Ici le prédicat est toujours
-- au moins scopé par transaction, donc servi en Bitmap Index Scan — mesuré 74,8 ms
-- (transaction seule) et 10,6 ms (transaction + canton). C'est précisément ce
-- chiffre qui permet à l'écran d'arrêter de présenter la taille d'une tranche
-- comme un nombre de marché.
DROP FUNCTION IF EXISTS public.count_market_listings(text, numeric, numeric, numeric, text[], text[], integer, text);

CREATE FUNCTION public.count_market_listings(
  p_tx text,
  p_budget_min numeric DEFAULT NULL,
  p_budget_max numeric DEFAULT NULL,
  p_margin numeric DEFAULT 0.15,
  p_cantons text[] DEFAULT NULL,
  p_types text[] DEFAULT NULL,
  p_min_quality integer DEFAULT 50,
  p_city text DEFAULT NULL
)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '5s'
AS $$
  SELECT count(*)
  FROM public.market_listings ml
  WHERE ml.status IN ('active', 'price_reduced')
    AND ml.transaction_type = p_tx
    AND ml.quality_score >= p_min_quality
    AND COALESCE(ml.current_price, ml.price) > 0
    AND (p_budget_max IS NULL OR COALESCE(ml.current_price, ml.price) <= p_budget_max * (1 + p_margin))
    AND (p_budget_min IS NULL OR COALESCE(ml.current_price, ml.price) >= p_budget_min * (1 - p_margin))
    AND (p_cantons IS NULL OR ml.canton = ANY (p_cantons))
    AND (p_types IS NULL OR ml.type = ANY (p_types))
    AND (p_city IS NULL OR public.unaccent(lower(ml.city)) = public.unaccent(lower(p_city)));
$$;

REVOKE ALL ON FUNCTION public.count_market_listings(text, numeric, numeric, numeric, text[], text[], integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.count_market_listings(text, numeric, numeric, numeric, text[], text[], integer, text) TO authenticated, service_role;
