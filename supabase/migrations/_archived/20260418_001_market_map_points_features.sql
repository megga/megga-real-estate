-- Extend get_market_map_points with a features filter so the smart-input
-- parser can surface listings matching extracted amenities (balcony, pool,
-- view, garage, elevator, furnished, pets, fireplace, new_building,
-- minergie, parking). Terrace deferred to v2 (JSONB column, FR slugs).
--
-- Each code maps to one column on market_listings. Unknown codes are
-- silently ignored (no predicate added).

DROP FUNCTION IF EXISTS get_market_map_points(TEXT, TEXT[], TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC);

CREATE OR REPLACE FUNCTION get_market_map_points(
  p_context TEXT DEFAULT 'buy',
  p_types TEXT[] DEFAULT NULL,
  p_canton TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_min_price NUMERIC DEFAULT NULL,
  p_max_price NUMERIC DEFAULT NULL,
  p_min_rooms NUMERIC DEFAULT NULL,
  p_min_surface NUMERIC DEFAULT NULL,
  p_features TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  price NUMERIC,
  current_price NUMERIC,
  type TEXT,
  rooms NUMERIC,
  transaction_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('statement_timeout', '30s', true);

  RETURN QUERY
  SELECT
    m.id,
    m.lat,
    m.lng,
    m.price,
    m.current_price,
    m.type,
    m.rooms,
    m.transaction_type
  FROM market_listings m
  WHERE m.status = 'active'
    AND m.quality_score >= 50
    AND m.lat IS NOT NULL
    AND m.lng IS NOT NULL
    AND m.price > 0
    AND m.transaction_type = p_context
    AND (p_types IS NULL OR m.type = ANY(p_types))
    AND (p_canton IS NULL OR m.canton = p_canton)
    AND (p_city IS NULL OR m.city ILIKE '%' || p_city || '%')
    AND (p_min_price IS NULL OR m.price >= p_min_price)
    AND (p_max_price IS NULL OR m.price <= p_max_price)
    AND (p_min_rooms IS NULL OR m.rooms >= p_min_rooms)
    AND (p_min_surface IS NULL OR m.surface_m2 >= p_min_surface)
    AND (
      p_features IS NULL OR (
        ('balcony'      <> ALL(p_features) OR m.has_balcony = true) AND
        ('pool'         <> ALL(p_features) OR m.has_swimming_pool = true) AND
        ('view'         <> ALL(p_features) OR m.has_nice_view = true) AND
        ('garage'       <> ALL(p_features) OR m.has_garage = true) AND
        ('parking'      <> ALL(p_features) OR m.has_parking = true) AND
        ('elevator'     <> ALL(p_features) OR m.has_elevator = true) AND
        ('furnished'    <> ALL(p_features) OR m.is_furnished = true) AND
        ('pets_allowed' <> ALL(p_features) OR m.pets_allowed = true) AND
        ('fireplace'    <> ALL(p_features) OR m.has_fireplace = true) AND
        ('new_building' <> ALL(p_features) OR m.is_new_building = true) AND
        ('minergie'     <> ALL(p_features) OR m.is_minergie = true)
      )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION get_market_map_points(
  TEXT, TEXT[], TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT[]
) TO anon, authenticated;

COMMENT ON FUNCTION get_market_map_points IS
  'Returns all map points matching filters (incl. features) in a single query.';
