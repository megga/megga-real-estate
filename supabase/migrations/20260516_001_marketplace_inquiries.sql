-- ============================================================
-- Marketplace Inquiries — public buyer/renter contact requests
-- ============================================================
-- A visitor on /propriete/:id fills the contact form. We capture
-- the request anonymously (no auth required) and route it to the
-- agency owning the listing (or MEGGA Platform for Flatfox-sourced
-- listings).
--
-- Differs from seller_leads (vendor estimation) and message_threads
-- (authenticated buyer chat) — this is the lightweight first-touch
-- before any account creation.

CREATE TABLE IF NOT EXISTS marketplace_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Listing context
  listing_prefixed_id TEXT,                              -- ex. "market-<uuid>" or "internal-<uuid>"
  market_listing_id UUID REFERENCES market_listings(id) ON DELETE SET NULL,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  listing_title TEXT,
  listing_city TEXT,
  listing_canton TEXT,
  listing_transaction_type TEXT,                         -- 'buy' | 'rent'
  -- Captured contact info
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT,
  -- Routing
  agency_name TEXT,                                       -- snapshot at submit time (Flatfox source)
  source_portal TEXT,                                     -- 'flatfox' | 'internal' | etc.
  source_url TEXT,
  -- Lifecycle
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'archived', 'spam')),
  -- Diagnostics
  ip_address INET,
  user_agent TEXT,
  referer TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_marketplace_inquiries_created
  ON marketplace_inquiries (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_inquiries_status
  ON marketplace_inquiries (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_inquiries_market_listing
  ON marketplace_inquiries (market_listing_id) WHERE market_listing_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_marketplace_inquiries_property
  ON marketplace_inquiries (property_id) WHERE property_id IS NOT NULL;

-- RLS
ALTER TABLE marketplace_inquiries ENABLE ROW LEVEL SECURITY;

-- Anonymous + authenticated visitors can submit an inquiry
CREATE POLICY "public_can_insert_marketplace_inquiries"
  ON marketplace_inquiries FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Super admins read all inquiries
CREATE POLICY "super_admin_read_marketplace_inquiries"
  ON marketplace_inquiries FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_super_admin = TRUE)
  );

-- Super admins update inquiries (status changes)
CREATE POLICY "super_admin_update_marketplace_inquiries"
  ON marketplace_inquiries FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_super_admin = TRUE)
  );

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_marketplace_inquiries_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_marketplace_inquiries_updated_at ON marketplace_inquiries;
CREATE TRIGGER trg_marketplace_inquiries_updated_at
  BEFORE UPDATE ON marketplace_inquiries
  FOR EACH ROW
  EXECUTE FUNCTION update_marketplace_inquiries_updated_at();

COMMENT ON TABLE marketplace_inquiries IS
  'Public contact requests submitted from /propriete/:id detail page. Captures buyer/renter intent before account creation, routes to agency for follow-up.';
