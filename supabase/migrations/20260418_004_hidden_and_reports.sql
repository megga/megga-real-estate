-- Migration : hide listings + report problems
--
-- Two tables:
-- 1. market_hidden — same shape as market_favorites. Users can hide
--    listings from their own feed. Sync between devices.
-- 2. listing_reports — user-submitted reports of stale data, wrong
--    price, inappropriate content, etc. Super-admin side will consume.

-- ─── market_hidden ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS market_hidden (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, listing_id)
);

CREATE INDEX IF NOT EXISTS idx_market_hidden_user
  ON market_hidden (user_id, created_at DESC);

ALTER TABLE market_hidden ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read their hidden" ON market_hidden;
CREATE POLICY "Users read their hidden"
  ON market_hidden FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users insert their hidden" ON market_hidden;
CREATE POLICY "Users insert their hidden"
  ON market_hidden FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users delete their hidden" ON market_hidden;
CREATE POLICY "Users delete their hidden"
  ON market_hidden FOR DELETE
  USING (user_id = auth.uid());

-- ─── listing_reports ────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE listing_report_reason AS ENUM (
    'wrong_price',
    'already_taken',
    'wrong_photos',
    'inaccurate_description',
    'spam_fraud',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE listing_report_status AS ENUM ('open', 'reviewing', 'resolved', 'dismissed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS listing_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason listing_report_reason NOT NULL,
  comment TEXT,
  status listing_report_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listing_reports_status_created
  ON listing_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listing_reports_listing
  ON listing_reports (listing_id);

ALTER TABLE listing_reports ENABLE ROW LEVEL SECURITY;

-- Anyone (anonymous included) can submit a report. user_id stays NULL
-- when they're not logged in — we still want the signal.
DROP POLICY IF EXISTS "Anyone can submit listing reports" ON listing_reports;
CREATE POLICY "Anyone can submit listing reports"
  ON listing_reports FOR INSERT
  WITH CHECK (
    -- If authenticated, enforce user_id = auth.uid(); else allow NULL
    (auth.uid() IS NULL AND user_id IS NULL)
    OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
  );

-- Authenticated users can read their own past reports (transparency).
DROP POLICY IF EXISTS "Users read their own reports" ON listing_reports;
CREATE POLICY "Users read their own reports"
  ON listing_reports FOR SELECT
  USING (user_id = auth.uid());
