-- Restore columns added to prod after the 2026-05-26 baseline dump.
-- All ADD COLUMN IF NOT EXISTS — idempotent, no-op on prod where these
-- columns already exist.
--
-- Types inferred from call-sites in the codebase (price columns → NUMERIC,
-- counters → INTEGER, foreign keys → UUID, free-form data → JSONB, etc.).
-- If prod uses a stricter type, the local will still accept it via implicit
-- cast for most cases (TEXT vs VARCHAR, NUMERIC vs INTEGER for counts).

-- ── contacts ──────────────────────────────────────────────────────────
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS last_interaction_at TIMESTAMPTZ;
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS search_criteria JSONB;

-- ── contact_scores ────────────────────────────────────────────────────
ALTER TABLE public.contact_scores
  ADD COLUMN IF NOT EXISTS overall_score NUMERIC;

-- ── crm_offers ────────────────────────────────────────────────────────
ALTER TABLE public.crm_offers
  ADD COLUMN IF NOT EXISTS transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL;

-- ── documents ─────────────────────────────────────────────────────────
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL;

-- ── kyc_cases ─────────────────────────────────────────────────────────
ALTER TABLE public.kyc_cases
  ADD COLUMN IF NOT EXISTS screening_status TEXT;

-- ── market_listings ───────────────────────────────────────────────────
ALTER TABLE public.market_listings
  ADD COLUMN IF NOT EXISTS rent NUMERIC;
ALTER TABLE public.market_listings
  ADD COLUMN IF NOT EXISTS rent_chf NUMERIC;

-- ── message_threads ───────────────────────────────────────────────────
ALTER TABLE public.message_threads
  ADD COLUMN IF NOT EXISTS channel TEXT;

-- ── profiles ──────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferences JSONB;

-- ── properties ────────────────────────────────────────────────────────
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0;

-- ── subscriptions ─────────────────────────────────────────────────────
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS price NUMERIC;

-- ── Round 2 (after first rebuild revealed more) ──────────────────────
ALTER TABLE public.contact_scores
  ADD COLUMN IF NOT EXISTS conversion_score NUMERIC;
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS favorites_count INTEGER DEFAULT 0;
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS "interval" TEXT;

-- ── Round 3 ─────────────────────────────────────────────────────────
ALTER TABLE public.contact_scores
  ADD COLUMN IF NOT EXISTS estimated_budget NUMERIC;
