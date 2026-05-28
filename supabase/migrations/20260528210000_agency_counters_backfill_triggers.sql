-- Backfill + auto-maintain agency_profiles.active_listings_count and agent_count.
--
-- Pourquoi : la grille /agencies affiche ces compteurs sur chaque card mais
-- l'import scrapé les a laissés à 0, alors que 1088 agences ont des biens
-- actifs (22'970 listings) et 918 ont des agents (1050). Backfill one-shot
-- + triggers pour garder en sync.

-- ── Backfill active_listings_count ─────────────────────────────────────
UPDATE agency_profiles ap
SET active_listings_count = sub.cnt
FROM (
  SELECT agency_profile_id, COUNT(*)::int AS cnt
  FROM market_listings
  WHERE agency_profile_id IS NOT NULL AND status = 'active'
  GROUP BY agency_profile_id
) sub
WHERE ap.id = sub.agency_profile_id
  AND ap.active_listings_count IS DISTINCT FROM sub.cnt;

-- Reset to 0 pour les agences qui n'ont plus de bien actif (sweep)
UPDATE agency_profiles
SET active_listings_count = 0
WHERE active_listings_count IS DISTINCT FROM 0
  AND id NOT IN (
    SELECT agency_profile_id FROM market_listings
    WHERE agency_profile_id IS NOT NULL AND status = 'active'
  );

-- ── Backfill agent_count ───────────────────────────────────────────────
UPDATE agency_profiles ap
SET agent_count = sub.cnt
FROM (
  SELECT agency_profile_id, COUNT(*)::int AS cnt
  FROM agent_profiles
  WHERE agency_profile_id IS NOT NULL
  GROUP BY agency_profile_id
) sub
WHERE ap.id = sub.agency_profile_id
  AND ap.agent_count IS DISTINCT FROM sub.cnt;

UPDATE agency_profiles
SET agent_count = 0
WHERE agent_count IS DISTINCT FROM 0
  AND id NOT IN (
    SELECT agency_profile_id FROM agent_profiles
    WHERE agency_profile_id IS NOT NULL
  );

-- ── Trigger maintenance pour active_listings_count ─────────────────────
CREATE OR REPLACE FUNCTION refresh_agency_active_listings_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- INSERT / UPDATE : si la new row a une agence + status='active'
  IF (TG_OP IN ('INSERT', 'UPDATE')) AND NEW.agency_profile_id IS NOT NULL THEN
    UPDATE agency_profiles
    SET active_listings_count = (
      SELECT COUNT(*)::int FROM market_listings
      WHERE agency_profile_id = NEW.agency_profile_id AND status = 'active'
    )
    WHERE id = NEW.agency_profile_id;
  END IF;

  -- UPDATE / DELETE : si l'old row pointait sur une AUTRE agence, recompute aussi
  IF (TG_OP IN ('UPDATE', 'DELETE')) AND OLD.agency_profile_id IS NOT NULL
     AND (TG_OP = 'DELETE' OR OLD.agency_profile_id IS DISTINCT FROM NEW.agency_profile_id
          OR OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE agency_profiles
    SET active_listings_count = (
      SELECT COUNT(*)::int FROM market_listings
      WHERE agency_profile_id = OLD.agency_profile_id AND status = 'active'
    )
    WHERE id = OLD.agency_profile_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_agency_active_listings_count ON market_listings;
CREATE TRIGGER trg_refresh_agency_active_listings_count
AFTER INSERT OR UPDATE OF agency_profile_id, status OR DELETE
ON market_listings
FOR EACH ROW
EXECUTE FUNCTION refresh_agency_active_listings_count();

-- ── Trigger maintenance pour agent_count ───────────────────────────────
CREATE OR REPLACE FUNCTION refresh_agency_agent_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP IN ('INSERT', 'UPDATE')) AND NEW.agency_profile_id IS NOT NULL THEN
    UPDATE agency_profiles
    SET agent_count = (
      SELECT COUNT(*)::int FROM agent_profiles WHERE agency_profile_id = NEW.agency_profile_id
    )
    WHERE id = NEW.agency_profile_id;
  END IF;

  IF (TG_OP IN ('UPDATE', 'DELETE')) AND OLD.agency_profile_id IS NOT NULL
     AND (TG_OP = 'DELETE' OR OLD.agency_profile_id IS DISTINCT FROM NEW.agency_profile_id) THEN
    UPDATE agency_profiles
    SET agent_count = (
      SELECT COUNT(*)::int FROM agent_profiles WHERE agency_profile_id = OLD.agency_profile_id
    )
    WHERE id = OLD.agency_profile_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_agency_agent_count ON agent_profiles;
CREATE TRIGGER trg_refresh_agency_agent_count
AFTER INSERT OR UPDATE OF agency_profile_id OR DELETE
ON agent_profiles
FOR EACH ROW
EXECUTE FUNCTION refresh_agency_agent_count();
