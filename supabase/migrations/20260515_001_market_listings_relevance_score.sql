-- ===========================================================================
-- Phase 1 — Real "Recommandés" sort + "Bon prix" badge
--
-- Source : audit comparatif Airbnb / Zillow / Booking / Idealista — un score
-- additif heuristique en SQL pur reproduit 80% de la valeur d'un best-match
-- sans ML pipeline. Le tri "recommended" actuel est aliasé sur created_at
-- (mensonge UI). Ici on le rend honnête + on ajoute un signal "bon prix" via
-- les médianes cantonales (Comparis-style, inédit en CH hors Comparis).
-- ===========================================================================

-- ─── 1. relevance_score (STORED GENERATED column) ───────────────────────────
--
-- Score 0-1 combinant 5 signaux statiques (IMMUTABLE, recalculé à chaque
-- write — pas besoin de batch quotidien) :
--   - 30%  quality_score (existant, 0-100)
--   - 25%  photos count (capé à 8)
--   - 15%  complétude (rooms + surface + bedrooms)
--   - 20%  price valid (current_price > 0)
--   - 10%  description (> 100 caractères)
--
-- Total max : 1.000. La recency est volontairement exclue (sort=newest la
-- couvre déjà) : ça évite un UPDATE quotidien sur 33K rows et garde
-- l'expression IMMUTABLE.

ALTER TABLE market_listings ADD COLUMN IF NOT EXISTS relevance_score numeric(4,3)
  GENERATED ALWAYS AS (
    (LEAST(GREATEST(COALESCE(quality_score, 0), 0), 100) / 100.0 * 0.30)
    + (LEAST(COALESCE(array_length(photos, 1), 0), 8) / 8.0 * 0.25)
    + (
        (CASE WHEN rooms IS NOT NULL AND rooms > 0 THEN 0.05 ELSE 0 END)
      + (CASE WHEN surface_m2 IS NOT NULL AND surface_m2 > 0 THEN 0.05 ELSE 0 END)
      + (CASE WHEN bedrooms IS NOT NULL AND bedrooms > 0 THEN 0.05 ELSE 0 END)
    )
    + (CASE WHEN current_price IS NOT NULL AND current_price > 0 THEN 0.20 ELSE 0 END)
    + (CASE WHEN description IS NOT NULL AND length(description) > 100 THEN 0.10 ELSE 0 END)
  ) STORED;

COMMENT ON COLUMN market_listings.relevance_score IS
  'Static quality blend 0-1. 30% quality + 25% photos + 15% completeness + 20% price valid + 10% description. STORED (recalculated on write, no batch needed). Used by sort=recommended in useMarketListings.';

-- Partial index : couvre exactement le pattern de query (eq on tx_type, sort
-- DESC by relevance + recency as tiebreaker). Le WHERE matche les filtres
-- standards du hook (status='active' + quality_score>=50).
CREATE INDEX IF NOT EXISTS idx_ml_relevance
  ON market_listings (transaction_type, relevance_score DESC, created_at DESC)
  WHERE status = 'active' AND quality_score >= 50;

-- ─── 2. Cantonal price medians (materialized view) ──────────────────────────
--
-- Médiane prix/m² par (canton, transaction_type, type). Permet le badge
-- "Bon prix" (prix/m² < 85% de la médiane = sous le marché).
--
-- Refresh quotidien après flatfox-sync (04:00 UTC) via pg_cron. Une seule
-- requête publique côté client (26 cantons × 2 tx × 8 types ≈ 416 rows max)
-- qui s'applique à toutes les cartes — staleTime 24h côté React Query.

CREATE MATERIALIZED VIEW IF NOT EXISTS cantonal_price_medians AS
SELECT
  canton,
  transaction_type,
  type,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY price_per_m2)::numeric(10, 2) AS median_price_per_m2,
  COUNT(*)::integer AS sample_size
FROM market_listings
WHERE status = 'active'
  AND quality_score >= 50
  AND price_per_m2 IS NOT NULL
  AND price_per_m2 > 0
  AND price_per_m2 < 50000  -- exclude obvious data errors (>50K CHF/m² is unrealistic in CH)
  AND canton IS NOT NULL
GROUP BY canton, transaction_type, type
HAVING COUNT(*) >= 5;  -- min 5 listings/bucket for a stable median

CREATE UNIQUE INDEX IF NOT EXISTS uq_cantonal_medians
  ON cantonal_price_medians (canton, transaction_type, type);

COMMENT ON MATERIALIZED VIEW cantonal_price_medians IS
  'Median price/m² by (canton, transaction_type, type). Refreshed daily by pg_cron 04:30 UTC. Public read for the "Bon prix" badge on listing cards (Comparis-style).';

-- Lecture publique — c'est de la donnée agrégée non-sensible. Pas de RLS sur
-- les materialized views en Postgres native, on grant directement.
GRANT SELECT ON cantonal_price_medians TO anon, authenticated;

-- Premier refresh non-CONCURRENT (la vue doit être populée pour pouvoir
-- ensuite refresh CONCURRENTLY).
REFRESH MATERIALIZED VIEW public.cantonal_price_medians;

-- ─── 3. pg_cron — refresh quotidien ─────────────────────────────────────────
--
-- 04:30 UTC = 30 min après flatfox-sync-daily (qui tourne à 04:00 UTC).
-- Idempotent : on skip si le job existe déjà (cas re-run de la migration).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
    AND NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cantonal-medians-refresh')
  THEN
    PERFORM cron.schedule(
      'cantonal-medians-refresh',
      '30 4 * * *',
      'REFRESH MATERIALIZED VIEW CONCURRENTLY public.cantonal_price_medians'
    );
  END IF;
END;
$$;
