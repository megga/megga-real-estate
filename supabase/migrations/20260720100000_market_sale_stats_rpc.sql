-- market_sale_stats : médiane / quartiles de prix au m2 (VENTE) calculés EN SQL
-- sur TOUTE la population filtrée, jamais sur un échantillon.
--
-- Bug corrigé : execGetMarketStats (copilot-actions.ts) calculait ses stats de
-- vente à partir de match_candidate_listings avec p_limit 400. Cette RPC trie
-- par `quality_score DESC NULLS LAST, COALESCE(current_price, price) ASC`.
-- Or 36 222 annonces actives partagent le MÊME quality_score (100, le plus gros
-- bucket) : sur les segments logés dans ce bucket, la 1re clé ne départage rien
-- et `prix ASC` décide seul. Au-delà de 400 annonces, la « médiane de marché »
-- citée aux agents était donc celle des 400 annonces LES MOINS CHÈRES.
--
-- Ampleur MESURÉE en prod le 20/07/2026 (18 segments canton×type dépassent 400 ;
-- écart entre la médiane tronquée et la médiane vraie, en CHF/m²) :
--   TI house      1841 annonces   3 415 vs  5 642   −39,5 %
--   TI apartment  2674            5 588 vs  7 435   −24,8 %
--   VD apartment  1801            6 490 vs  8 475   −23,4 %
--   VD house      1460            6 217 vs  8 083   −23,1 %
--   VS apartment  2267            4 941 vs  6 333   −22,0 %
--   ZH apartment   683            9 548 vs 11 250   −15,1 %
--   GE apartment   514           12 785 vs 12 814    −0,2 %
--
-- ⚠️ Genève est le segment le MOINS touché, pas le plus : l'ampleur dépend de la
-- part de population tronquée (GE ne dépasse 400 que de 22 %, TI de 78 %) ET de
-- la corrélation entre prix TOTAL (la clé tronquée) et prix/m² (la grandeur
-- mesurée) — un petit logement cher au m² a un prix total bas. Ne pas
-- diagnostiquer ce genre de biais sur un seul segment.
--
-- Ici : percentile_cont sur l'ensemble de la population. Aucun LIMIT, aucun
-- échantillon, donc aucun biais de troncature possible par construction.
--
-- Parité avec l'ancien calcul TS (copilot-market.ts) — les gardes anti-aberration
-- sont reproduites À L'IDENTIQUE pour que seul l'échantillonnage change :
--   prix   = COALESCE(current_price, price), dans [50 000 ; 100 000 000]
--   surface dans [8 ; 2000] m2
--   prix/m2 dans [500 ; 60 000] (fenêtre de plausibilité suisse)
-- percentile_cont = interpolation linéaire, exactement comme percentile() en TS.
--
-- Les deux crans géographiques (ville demandée + canton) sont renvoyés dans le
-- MÊME appel : l'appelant choisit la ville si n >= MIN_COMPARABLES, sinon
-- retombe au canton. Un seul aller-retour, les deux crans agrégés en plein.
--
-- Perf (§7 CLAUDE.md) : aucun `count(*)` non prédicaté — le count est porté par
-- l'agrégat lui-même, sur un ensemble déjà réduit par l'index partiel ci-dessous
-- (canton + type + transaction_type). GE/apartment ≈ 1146 lignes : trivial.

-- Index partiel dédié : couvre le WHERE exact de la RPC. Sans lui, l'agrégat
-- ferait un scan de la table complète (§7 : « toujours un partial index pour
-- les filtres fréquents »).
CREATE INDEX IF NOT EXISTS idx_ml_sale_stats
  ON public.market_listings (canton, type, quality_score)
  INCLUDE (price, current_price, surface_m2, city)
  WHERE transaction_type = 'buy' AND status IN ('active', 'price_reduced');

DROP FUNCTION IF EXISTS public.market_sale_stats(text, text, text, integer);

CREATE FUNCTION public.market_sale_stats(
  p_canton text,
  p_type text,
  p_city text DEFAULT NULL,
  p_min_quality integer DEFAULT 50
)
RETURNS TABLE(
  level text,
  n integer,
  median_price_m2 numeric,
  p25_price_m2 numeric,
  p75_price_m2 numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '15s'
AS $$
  WITH population AS (
    -- NULLIF sur la surface : le garde-fou `surface_m2 >= 8` vit dans le MÊME
    -- niveau de qual une fois la CTE aplatie, et rien ne garantit qu'il soit
    -- évalué AVANT la division (order_qual_clauses trie par coût, pas par
    -- dépendance). Une seule ligne à surface 0 suffirait sinon à faire tomber
    -- toute la RPC en division_by_zero. Même ceinture-et-bretelles que
    -- 20260618210000_market_rent_stats.sql.
    SELECT ml.city AS city,
           COALESCE(ml.current_price, ml.price) / NULLIF(ml.surface_m2, 0) AS price_m2
    FROM public.market_listings ml
    WHERE ml.transaction_type = 'buy'
      AND ml.status IN ('active', 'price_reduced')
      AND ml.canton = p_canton
      AND ml.type = p_type
      AND ml.quality_score >= p_min_quality
      AND ml.surface_m2 IS NOT NULL
      AND ml.surface_m2 >= 8 AND ml.surface_m2 <= 2000
      AND COALESCE(ml.current_price, ml.price) BETWEEN 50000 AND 100000000
  ), kept AS (
    -- Fenêtre de plausibilité : écarte les erreurs de saisie (mêmes bornes qu'en TS).
    SELECT city, price_m2 FROM population
    WHERE price_m2 >= 500 AND price_m2 <= 60000
  )
  -- percentile_cont n'existe QU'EN double precision (pas de variante numeric) :
  -- price_m2 y est implicitement converti et le résultat revient en float8. Le
  -- `::numeric` explicite aligne donc le type sur le RETURNS TABLE au lieu de
  -- s'en remettre au cast d'affectation implicite. Arrondi à l'unité (CHF/m²) :
  -- absorbe au passage le bruit binaire du float. Cf. le même motif, en
  -- production depuis juin, dans 20260618210000_market_rent_stats.sql.
  SELECT 'city'::text,
         count(*)::int,
         round((percentile_cont(0.5)  WITHIN GROUP (ORDER BY price_m2))::numeric),
         round((percentile_cont(0.25) WITHIN GROUP (ORDER BY price_m2))::numeric),
         round((percentile_cont(0.75) WITHIN GROUP (ORDER BY price_m2))::numeric)
  FROM kept
  WHERE p_city IS NOT NULL
    AND public.unaccent(lower(city)) = public.unaccent(lower(p_city))

  UNION ALL

  SELECT 'canton'::text,
         count(*)::int,
         round((percentile_cont(0.5)  WITHIN GROUP (ORDER BY price_m2))::numeric),
         round((percentile_cont(0.25) WITHIN GROUP (ORDER BY price_m2))::numeric),
         round((percentile_cont(0.75) WITHIN GROUP (ORDER BY price_m2))::numeric)
  FROM kept;
$$;

-- anon n'a AUCUN accès aux données de marché (cf. 20260719110000).
REVOKE ALL ON FUNCTION public.market_sale_stats(text, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.market_sale_stats(text, text, text, integer) TO authenticated, service_role;
