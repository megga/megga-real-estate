-- RPC: get_price_hexagons
-- Aggregates market_listings.price_per_m2 into PostGIS hexagons within a bbox.
-- Replaces the client-side Mapbox heatmap (which was biased by absolute price × density)
-- with a choropleth of median CHF/m² per hex — true market signal.
--
-- The hex size is passed in 3857 meters (client picks by zoom level).
-- At Switzerland latitude (~47°), real ground size ≈ size_3857 × 0.68.

CREATE OR REPLACE FUNCTION get_price_hexagons(
  p_min_lng DOUBLE PRECISION,
  p_min_lat DOUBLE PRECISION,
  p_max_lng DOUBLE PRECISION,
  p_max_lat DOUBLE PRECISION,
  p_hex_size_m INTEGER,
  p_transaction_type TEXT DEFAULT 'rent',
  p_types TEXT[] DEFAULT NULL,
  p_min_count INTEGER DEFAULT 3
)
RETURNS TABLE (
  hex_id TEXT,
  geom JSONB,
  median_price_m2 NUMERIC,
  listing_count INTEGER,
  p25_price_m2 NUMERIC,
  p75_price_m2 NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bbox_3857 geometry;
BEGIN
  PERFORM set_config('statement_timeout', '15s', true);

  -- Guard against huge bboxes with tiny hex sizes
  IF p_hex_size_m < 100 THEN
    p_hex_size_m := 100;
  END IF;

  bbox_3857 := ST_Transform(
    ST_MakeEnvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326),
    3857
  );

  RETURN QUERY
  WITH hexes AS (
    SELECT
      h.i::text || '_' || h.j::text AS hex_id,
      h.geom AS geom_3857
    FROM ST_HexagonGrid(p_hex_size_m::float, bbox_3857) AS h
  ),
  listing_points AS (
    SELECT
      m.price_per_m2,
      ST_Transform(ST_SetSRID(ST_MakePoint(m.lng, m.lat), 4326), 3857) AS pt
    FROM market_listings m
    WHERE m.status = 'active'
      AND m.quality_score >= 50
      AND m.lat IS NOT NULL AND m.lng IS NOT NULL
      AND m.price_per_m2 IS NOT NULL
      AND m.price_per_m2 > 0
      AND m.transaction_type = p_transaction_type
      AND (p_types IS NULL OR m.type = ANY(p_types))
      AND m.lng BETWEEN p_min_lng AND p_max_lng
      AND m.lat BETWEEN p_min_lat AND p_max_lat
  ),
  agg AS (
    SELECT
      hx.hex_id,
      hx.geom_3857,
      COUNT(*)::int AS cnt,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY lp.price_per_m2) AS med,
      percentile_cont(0.25) WITHIN GROUP (ORDER BY lp.price_per_m2) AS q25,
      percentile_cont(0.75) WITHIN GROUP (ORDER BY lp.price_per_m2) AS q75
    FROM hexes hx
    JOIN listing_points lp ON ST_Contains(hx.geom_3857, lp.pt)
    GROUP BY hx.hex_id, hx.geom_3857
    HAVING COUNT(*) >= p_min_count
  )
  SELECT
    agg.hex_id,
    ST_AsGeoJSON(ST_Transform(agg.geom_3857, 4326))::jsonb,
    agg.med::numeric,
    agg.cnt,
    agg.q25::numeric,
    agg.q75::numeric
  FROM agg
  ORDER BY agg.cnt DESC
  LIMIT 5000;
END;
$$;

GRANT EXECUTE ON FUNCTION get_price_hexagons(
  DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION,
  INTEGER, TEXT, TEXT[], INTEGER
) TO anon, authenticated;

COMMENT ON FUNCTION get_price_hexagons IS
  'Returns PostGIS hexagons colored by median CHF/m² for listings in the bbox. Replaces Mapbox heatmap layer.';
