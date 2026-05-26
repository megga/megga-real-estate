-- ============================================
-- Stripe Subscriptions
-- Table subscriptions pour stocker les abonnements Stripe
-- + colonne stripe_customer_id sur agencies
-- ============================================

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL,
  stripe_subscription_id TEXT,
  stripe_price_id TEXT,
  plan TEXT NOT NULL DEFAULT 'starter'
    CHECK (plan IN ('starter', 'pro', 'entreprise')),
  billing_period TEXT DEFAULT 'monthly'
    CHECK (billing_period IN ('monthly', 'yearly')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'unpaid', 'incomplete')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agency_id)
);

-- RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agents_own_agency" ON subscriptions
  FOR ALL USING (
    agency_id = (
      SELECT agency_id FROM profiles
      WHERE id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_agency ON subscriptions(agency_id);

-- Colonne stripe_customer_id sur agencies (si pas déjà présente)
ALTER TABLE agencies
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
