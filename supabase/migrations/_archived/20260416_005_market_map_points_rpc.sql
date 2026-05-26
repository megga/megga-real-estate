-- RPC function to fetch all map points in a single query
-- Bypasses the 1000-row Supabase REST limit by using a SECURITY DEFINER function
-- with SET LOCAL statement_timeout to handle the ~33K rows safely.

CREATE OR REPLACE FUNCTION get_market_map_points(
  p_context TEXT DEFAULT 'buy',
  p_types TEXT[] DEFAULT NULL,
  p_canton TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_min_price NUMERIC DEFAULT NULL,
  p_max_price NUMERIC DEFAULT NULL,
  p_min_rooms NUMERIC DEFAULT NULL,
  p_min_surface NUMERIC DEFAULT NULL
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
  -- Allow longer statement time for this specific function
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
    AND (p_min_surface IS NULL OR m.surface_m2 >= p_min_surface);
END;
$$;

-- Public access via RLS (the function uses SECURITY DEFINER so it bypasses RLS on market_listings)
GRANT EXECUTE ON FUNCTION get_market_map_points TO anon, authenticated;

COMMENT ON FUNCTION get_market_map_points IS
  'Returns all map points matching filters in a single query. Replaces ~33 parallel REST batches.';
