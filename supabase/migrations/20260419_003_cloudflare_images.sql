-- ═══════════════════════════════════════════════════════════════════════════
-- Cloudflare R2 photo hosting migration
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Goal: decouple MEGGA from Flatfox CDN for photo delivery. Photos are
-- downloaded at sync time, resized into 3 JPEG variants, and uploaded to
-- Cloudflare R2 (bucket megga-market). Delivery goes through a custom
-- domain (img.megga.ch) served from CF edge with free egress.
--
-- Why R2 instead of Cloudflare Images:
--   - Free tier covers MEGGA's entire volume (~$0.50/mo vs $15-20/mo for Images)
--   - Free egress for life — no per-delivery billing
--   - C2PA signatures embedded in image bytes travel with R2 transparently
--
-- Column structure: photos_cf is an array of variant objects per photo.
--   [
--     { "id": "listing-abc-0",
--       "thumb":  "https://img.megga.ch/listings/abc/0-thumb.jpg",
--       "detail": "https://img.megga.ch/listings/abc/0-detail.jpg",
--       "hero":   "https://img.megga.ch/listings/abc/0-hero.jpg" },
--     ...
--   ]
--
-- We keep the existing `photos` column (Flatfox URLs) as a fallback during
-- the backfill ramp (~9 days). Once `photos_cf` is 100 % populated, we can
-- drop `photos`.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE market_listings
  ADD COLUMN IF NOT EXISTS photos_cf JSONB,
  ADD COLUMN IF NOT EXISTS photos_cf_processed_at TIMESTAMPTZ;

-- Partial index for the backfill — lets the EF efficiently find
-- listings that still need processing without scanning all 33K rows.
CREATE INDEX IF NOT EXISTS idx_ml_cf_pending
  ON market_listings (created_at DESC)
  WHERE photos_cf_processed_at IS NULL
    AND photos IS NOT NULL
    AND jsonb_array_length(photos) > 0;

COMMENT ON COLUMN market_listings.photos_cf IS
  'Cloudflare R2 variants per photo. Array of {id, thumb, detail, hero} URLs under img.megga.ch. NULL = not yet processed, fall back to `photos` (Flatfox URLs).';

COMMENT ON COLUMN market_listings.photos_cf_processed_at IS
  'Timestamp of last successful R2 upload. NULL = pending backfill.';
