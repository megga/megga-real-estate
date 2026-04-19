-- ═══════════════════════════════════════════════════════════════════════════
-- Cloudflare Images migration
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Goal: decouple MEGGA from Flatfox CDN for photo delivery. Photos are now
-- uploaded to Cloudflare Images at sync time, which gives us:
--   - Independence (Flatfox can kill hotlinking, we don't care)
--   - Automatic WebP/AVIF negotiation
--   - 4 pre-configured variants (thumb/detail/hero/og) served from CF edge
--   - C2PA-ready delivery (Content Credentials preserved on transforms)
--
-- Column structure: photos_cf is an array of variant objects, one per photo.
--   [
--     { "id": "listing-abc-0", "thumb": "https://img.megga.ch/.../thumb",
--       "detail": "...", "hero": "...", "og": "..." },
--     ...
--   ]
--
-- We keep the existing `photos` column (Flatfox URLs) as a fallback during
-- backfill. Once `photos_cf` is 100 % populated we can drop `photos`.
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
  'Cloudflare Images variants per photo. Array of {id, thumb, detail, hero, og}. NULL = not yet processed, fall back to `photos` (Flatfox URLs).';

COMMENT ON COLUMN market_listings.photos_cf_processed_at IS
  'Timestamp of last successful CF Images upload. NULL = pending backfill.';
