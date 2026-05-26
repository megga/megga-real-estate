-- ============================================================================
-- DeepSeek V3 integration — schema
--
-- Creates three tables to support the public-side AI migration:
--   1. ai_usage_logs          — one row per AI call (tokens, cost, provider)
--   2. ai_balance_snapshots   — hourly snapshots of DeepSeek account balance
--   3. translation_cache      — lazy translation cache keyed by content hash
--
-- The multilingual columns originally considered on market_listings
-- (title_de/en/it, description_de/en/it) are intentionally NOT created.
-- We use on-demand translation keyed by sha256(content) instead — see
-- docs/superpowers/plans/2026-04-16-deepseek-integration.md §6–§7.
--
-- Idempotent: safe to re-run.
-- ============================================================================

BEGIN;

-- ── ai_usage_logs ───────────────────────────────────────────────────────────
-- One row per AI call. Inserted fire-and-forget from _shared/ai-provider.ts.
-- Read-only for super_admin (monitoring widgets); writes via service_role.

CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edge_function TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('deepseek', 'claude-sonnet', 'claude-haiku')),
  input_tokens INT NOT NULL,
  output_tokens INT NOT NULL,
  estimated_cost_usd NUMERIC(10, 6) NOT NULL,
  was_fallback BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created
  ON public.ai_usage_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_provider
  ON public.ai_usage_logs (provider, created_at DESC);

ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_read_ai_usage" ON public.ai_usage_logs;
CREATE POLICY "super_admin_read_ai_usage" ON public.ai_usage_logs
  FOR SELECT
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

-- ── ai_balance_snapshots ────────────────────────────────────────────────────
-- Hourly snapshots from ai-billing-monitor EF. Anthropic has no public
-- balance endpoint, so only DeepSeek is populated here.

CREATE TABLE IF NOT EXISTS public.ai_balance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  provider TEXT NOT NULL,
  total_balance_usd NUMERIC(10, 2),
  topped_up_balance_usd NUMERIC(10, 2),
  granted_balance_usd NUMERIC(10, 2)
);

CREATE INDEX IF NOT EXISTS idx_ai_balance_captured
  ON public.ai_balance_snapshots (provider, captured_at DESC);

ALTER TABLE public.ai_balance_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_read_ai_balance" ON public.ai_balance_snapshots;
CREATE POLICY "super_admin_read_ai_balance" ON public.ai_balance_snapshots
  FOR SELECT
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
  );

-- ── translation_cache ───────────────────────────────────────────────────────
-- Lazy translation cache. Populated by translate-on-demand EF on cache miss.
-- PK (content_hash, lang) enables ON CONFLICT DO NOTHING for concurrent
-- requests on the same content.
--
-- Public SELECT: frontend can check the cache client-side to skip the EF
-- round-trip on hits. No PII — only translated listing text.
-- INSERT restricted to service_role via default RLS (no INSERT policy).

CREATE TABLE IF NOT EXISTS public.translation_cache (
  content_hash TEXT NOT NULL,
  lang TEXT NOT NULL CHECK (lang IN ('de', 'en', 'it')),
  translated_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (content_hash, lang)
);

ALTER TABLE public.translation_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_translation_cache" ON public.translation_cache;
CREATE POLICY "public_read_translation_cache" ON public.translation_cache
  FOR SELECT
  USING (TRUE);

COMMIT;
