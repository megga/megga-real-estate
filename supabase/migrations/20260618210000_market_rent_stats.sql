-- ════════════════════════════════════════════════════════════════════════════
-- MEGGA — Référence de loyer marché v1 : MV market_rent_stats (Composant A)
-- ════════════════════════════════════════════════════════════════════════════
-- Signal BACKEND déterministe (0 LLM) : comparables de LOYERS DEMANDÉS par
-- segment, pré-calculés. Mesure une POSITION vs marché, jamais une valeur
-- garantie ni un estimateur public (compliance-enabling, comme le KYC).
--
-- Jumeau structurel de cantonal_price_medians (_archived), mais AVEUGLE AU LOYER
-- là-bas (price_per_m2 75% NULL sur le rent). Ici loyer/m² =
-- COALESCE(current_price,price)/surface_m2 calculé LIVE sur le pré-filtre de
-- plausibilité résidentiel.
--
-- Multi-niveaux (UNION ALL) :
--   L1 canton_surf  : canton×type×surface_band (dorsale, toujours si n≥20)
--   +  city_surf     : city×type×surface_band   (raffinement, n≥20)
--   +  npa_surf      : NPA ×type×surface_band    (raffinement, n≥20)
-- Un segment n'existe QUE si n_comparables >= 20 (honnêteté par construction).
--
-- Validé live (eayczugyrvmtqnnmvjod, 2026-06-18) : 285 lignes
-- (83 canton_surf + 80 city_surf + 122 npa_surf), EXPLAIN ANALYZE = 245 ms,
-- 285 clés distinctes pour 285 lignes (CONCURRENTLY sûr).

-- ── (0) Idempotence. DROP MATERIALIZED VIEW ne supporte pas OR REPLACE. ──────
DROP MATERIALIZED VIEW IF EXISTS public.market_rent_stats CASCADE;

-- ── (1) MV : UNION ALL des 3 niveaux. ───────────────────────────────────────
-- Pré-filtre de plausibilité DUR puis winsorisation loyer/m² aux p2.5/p97.5 du
-- pool plausible (bornes recalculées à CHAQUE refresh, auto-adaptatives).
CREATE MATERIALIZED VIEW public.market_rent_stats AS
WITH base AS (
  SELECT
    ml.canton,
    ml.type,
    ml.postal_code,
    ml.city,
    CASE
      WHEN ml.surface_m2 < 50  THEN '<50'
      WHEN ml.surface_m2 < 80  THEN '50-80'
      WHEN ml.surface_m2 < 120 THEN '80-120'
      ELSE '120+'
    END AS surface_band,
    (COALESCE(ml.current_price, ml.price)::numeric / NULLIF(ml.surface_m2, 0)) AS loyer_m2
  FROM public.market_listings ml
  WHERE ml.transaction_type = 'rent'
    AND ml.status = 'active'
    AND ml.type IN ('apartment','house','villa')
    AND ml.canton IS NOT NULL          -- défensif (canton NOT NULL au schéma) : coût nul
    AND ml.surface_m2 BETWEEN 8 AND 1000
    AND COALESCE(ml.current_price, ml.price) BETWEEN 200 AND 20000
),
bounds AS (
  SELECT
    percentile_cont(0.025) WITHIN GROUP (ORDER BY loyer_m2) AS lo,
    percentile_cont(0.975) WITHIN GROUP (ORDER BY loyer_m2) AS hi
  FROM base
),
wins AS (
  SELECT
    b.canton, b.type, b.postal_code, b.city, b.surface_band,
    GREATEST(bo.lo, LEAST(bo.hi, b.loyer_m2)) AS loyer_m2
  FROM base b CROSS JOIN bounds bo
),
seg AS (
-- L1 : canton × type × surface_band (dorsale)
SELECT
  'canton_surf'::text AS level,
  w.canton,
  w.type,
  w.surface_band,
  NULL::text AS postal_code,
  NULL::text AS city,
  percentile_cont(0.5)  WITHIN GROUP (ORDER BY w.loyer_m2)::numeric(10,2) AS median_loyer_m2,
  percentile_cont(0.25) WITHIN GROUP (ORDER BY w.loyer_m2)::numeric(10,2) AS p25_loyer_m2,
  percentile_cont(0.75) WITHIN GROUP (ORDER BY w.loyer_m2)::numeric(10,2) AS p75_loyer_m2,
  count(*)::int AS n_comparables
FROM wins w
GROUP BY w.canton, w.type, w.surface_band
HAVING count(*) >= 20  -- DOIT égaler app_config.market_rent_reference_v1.min_comparables — bouger les DEUX ensemble (une MV ne lit pas app_config au refresh)

UNION ALL
-- city × type × surface_band (raffinement)
SELECT
  'city_surf'::text,
  w.canton,
  w.type,
  w.surface_band,
  NULL::text AS postal_code,
  w.city,
  percentile_cont(0.5)  WITHIN GROUP (ORDER BY w.loyer_m2)::numeric(10,2),
  percentile_cont(0.25) WITHIN GROUP (ORDER BY w.loyer_m2)::numeric(10,2),
  percentile_cont(0.75) WITHIN GROUP (ORDER BY w.loyer_m2)::numeric(10,2),
  count(*)::int
FROM wins w
WHERE w.city IS NOT NULL
GROUP BY w.canton, w.type, w.surface_band, w.city
HAVING count(*) >= 20  -- idem : lié à min_comparables, bouger les DEUX ensemble

UNION ALL
-- NPA (postal_code) × type × surface_band (raffinement le plus fin)
SELECT
  'npa_surf'::text,
  w.canton,
  w.type,
  w.surface_band,
  w.postal_code,
  NULL::text AS city,
  percentile_cont(0.5)  WITHIN GROUP (ORDER BY w.loyer_m2)::numeric(10,2),
  percentile_cont(0.25) WITHIN GROUP (ORDER BY w.loyer_m2)::numeric(10,2),
  percentile_cont(0.75) WITHIN GROUP (ORDER BY w.loyer_m2)::numeric(10,2),
  count(*)::int
FROM wins w
WHERE w.postal_code IS NOT NULL
GROUP BY w.canton, w.type, w.surface_band, w.postal_code
HAVING count(*) >= 20  -- idem : lié à min_comparables, bouger les DEUX ensemble
)
-- seg_key = clé de segment matérialisée (texte non-null). REQUISE pour REFRESH …
-- CONCURRENTLY : Postgres exige un index unique colonne-pure (NI expression NI
-- partiel). Un index sur COALESCE(postal_code,'') serait un index d'EXPRESSION,
-- rejeté par CONCURRENTLY (« cannot refresh … concurrently »). On matérialise
-- donc la clé en colonne et on l'indexe directement.
SELECT
  s.*,
  (s.level || '|' || s.canton || '|' || s.type || '|' || s.surface_band
    || '|' || COALESCE(s.postal_code, '') || '|' || COALESCE(s.city, '')) AS seg_key
FROM seg s
WITH NO DATA;

-- ── (2) Index UNIQUE sur seg_key (requis pour REFRESH … CONCURRENTLY). ───────
-- CONCURRENTLY exige un index UNIQUE colonne-pure (NI expression NI partiel)
-- couvrant toutes les lignes. La clé de segment a des colonnes nullables
-- (postal_code/city NULL selon le niveau) → seg_key (texte non-null) est
-- matérialisée en colonne (3) et indexée ici directement. Unicité prouvée par la
-- DONNÉE : 285 lignes = 285 seg_key distincts (vérifié live). Une dérive scraper
-- vers '' produirait une clé dégénérée (captée par la spec §5.2 #6).
CREATE UNIQUE INDEX uq_market_rent_stats
  ON public.market_rent_stats (seg_key);

-- ── (2bis) Index de lecture L1 — PROVISIONING pour le score-de-bien différé
-- (§4, LEFT JOIN LATERAL mono-segment). NON utilisé par le hot-path matching
-- v1 (l'edge fait .eq('level','canton_surf').select('*') sans prédicat
-- canton/type → seqscan trivial d'une MV de 285 lignes). Gardé volontairement
-- comme forward-provisioning ; coût = un build d'index au refresh. ───────────
CREATE INDEX idx_market_rent_stats_l1
  ON public.market_rent_stats (canton, type, surface_band)
  WHERE level = 'canton_surf';

-- ── (3) Premier peuplement (non-CONCURRENT ; MV créée WITH NO DATA). ─────────
REFRESH MATERIALIZED VIEW public.market_rent_stats;

-- ── (4) GRANTS. Pas de RLS sur les MV en Postgres. Donnée agrégée non-sensible
-- MAIS lue server-side (edge matching sous service_role) ⇒ EXPOSE
-- authenticated+service_role, REVOKE anon. ──────────────────────────────────
REVOKE ALL ON public.market_rent_stats FROM PUBLIC, anon;
GRANT SELECT ON public.market_rent_stats TO authenticated, service_role;

-- ── (5) Tunables app_config (value = TEXT JSON, comme property_scoring_v1). ──
INSERT INTO public.app_config (key, value)
VALUES (
  'market_rent_reference_v1',
  '{"min_comparables":20,"surface_band_edges":[50,80,120],"plausibility":{"amount_min":200,"amount_max":20000,"surface_min":8,"surface_max":1000},"winsor":{"p_lo":0.025,"p_hi":0.975},"residential_types":["apartment","house","villa"],"position_curve":{"matching":{"r_floor":0.70,"r_under":0.85,"r_market_lo":0.97,"r_market_hi":1.05,"r_over":1.25,"frac_floor":0.62,"frac_under":0.92,"frac_market":0.50,"frac_over":0.05},"property_score":{"breakpoints":[{"r_max":0.70,"score":60},{"r_max":0.80,"score":85},{"r_max":0.90,"score":95},{"r_max":1.05,"score":100},{"r_max":1.20,"score":60},{"r_max":1.30,"score":40},{"r_max":999,"score":25}],"floor":20,"low_taper_floor":50}},"version":1}'
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ── (6) RPC de lecture du barème (calque get_property_score_config). ─────────
CREATE OR REPLACE FUNCTION public.get_market_rent_reference_config()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT value::jsonb FROM app_config WHERE key = 'market_rent_reference_v1'),
    '{}'::jsonb
  );
$$;

REVOKE ALL ON FUNCTION public.get_market_rent_reference_config() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_market_rent_reference_config() TO authenticated, service_role;

-- ── (7) CRON refresh quotidien. Clock-offset 45 4 UTC (15 min après
-- cantonal-medians-refresh @ 30 4). PAS dans l'edge flatfox-sync
-- (fire-and-forget, self-chunking, pas de hook "terminé"). Gardé par présence
-- du schéma cron (sauté en local/CI). Idempotent (cron.schedule = upsert par nom).
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    PERFORM cron.schedule(
      'market-rent-stats-refresh',
      '45 4 * * *',
      'REFRESH MATERIALIZED VIEW CONCURRENTLY public.market_rent_stats'
    );
  ELSE
    RAISE NOTICE 'pg_cron absent (local/CI) — market-rent-stats-refresh non planifié';
  END IF;
END
$do$;
