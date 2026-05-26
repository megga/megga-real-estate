-- Migration : cross-device favorites for public marketplace buyers.
--
-- The existing `favorites` table references CRM `listings` — not
-- marketplace biens. This new table is keyed by auth.users + listing_id
-- as TEXT (no FK) so it works for any listing source (market_listings
-- UUIDs today, potentially other portals tomorrow).
--
-- The client (useFavorites hook) keeps localStorage as a fast offline
-- cache and merges with this table when the user logs in.

CREATE TABLE IF NOT EXISTS market_favorites (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, listing_id)
);

CREATE INDEX IF NOT EXISTS idx_market_favorites_user
  ON market_favorites (user_id, created_at DESC);

ALTER TABLE market_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read their market favorites" ON market_favorites;
CREATE POLICY "Users read their market favorites"
  ON market_favorites FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users insert their market favorites" ON market_favorites;
CREATE POLICY "Users insert their market favorites"
  ON market_favorites FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users delete their market favorites" ON market_favorites;
CREATE POLICY "Users delete their market favorites"
  ON market_favorites FOR DELETE
  USING (user_id = auth.uid());
