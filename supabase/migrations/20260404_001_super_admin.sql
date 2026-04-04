-- ============================================
-- Super-Admin MEGGA — Migration
-- ============================================

-- 1. Add super_admin to role constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('super_admin', 'admin', 'manager', 'agent', 'assistant', 'seller', 'buyer', 'particulier'));

-- 2. Add status to agencies
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
DO $$ BEGIN
  ALTER TABLE agencies ADD CONSTRAINT agencies_status_check CHECK (status IN ('active', 'suspended'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Add moderation columns to properties
ALTER TABLE properties ADD COLUMN IF NOT EXISTS moderation_status TEXT DEFAULT 'published';
DO $$ BEGIN
  ALTER TABLE properties ADD CONSTRAINT properties_moderation_status_check
    CHECK (moderation_status IN ('pending', 'published', 'flagged', 'removed'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS moderation_reason TEXT;

-- 4. is_super_admin() function
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'super_admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 5. platform_metrics table
CREATE TABLE IF NOT EXISTS platform_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  metadata JSONB DEFAULT '{}',
  recorded_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE platform_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_read_metrics" ON platform_metrics;
CREATE POLICY "super_admin_read_metrics"
  ON platform_metrics FOR SELECT
  USING (is_super_admin());

DROP POLICY IF EXISTS "super_admin_insert_metrics" ON platform_metrics;
CREATE POLICY "super_admin_insert_metrics"
  ON platform_metrics FOR INSERT
  WITH CHECK (is_super_admin());

-- 6. moderation_actions table
CREATE TABLE IF NOT EXISTS moderation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('approve', 'flag', 'remove')),
  reason TEXT,
  actor_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE moderation_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_read_moderation" ON moderation_actions;
CREATE POLICY "super_admin_read_moderation"
  ON moderation_actions FOR SELECT
  USING (is_super_admin());

DROP POLICY IF EXISTS "super_admin_insert_moderation" ON moderation_actions;
CREATE POLICY "super_admin_insert_moderation"
  ON moderation_actions FOR INSERT
  WITH CHECK (is_super_admin());

-- 7. admin_notes table
CREATE TABLE IF NOT EXISTS admin_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('agency', 'user', 'kyc_case', 'ticket', 'property')),
  entity_id UUID NOT NULL,
  content TEXT NOT NULL,
  author_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE admin_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_read_notes" ON admin_notes;
CREATE POLICY "super_admin_read_notes"
  ON admin_notes FOR SELECT
  USING (is_super_admin());

DROP POLICY IF EXISTS "super_admin_insert_notes" ON admin_notes;
CREATE POLICY "super_admin_insert_notes"
  ON admin_notes FOR INSERT
  WITH CHECK (is_super_admin());

-- 8. Super-admin bypass policies on existing tables
DO $$ BEGIN
  -- agencies
  DROP POLICY IF EXISTS "super_admin_read_all_agencies" ON agencies;
  CREATE POLICY "super_admin_read_all_agencies" ON agencies FOR SELECT USING (is_super_admin());
  DROP POLICY IF EXISTS "super_admin_update_agencies" ON agencies;
  CREATE POLICY "super_admin_update_agencies" ON agencies FOR UPDATE USING (is_super_admin());

  -- profiles
  DROP POLICY IF EXISTS "super_admin_read_all_profiles" ON profiles;
  CREATE POLICY "super_admin_read_all_profiles" ON profiles FOR SELECT USING (is_super_admin());
  DROP POLICY IF EXISTS "super_admin_update_profiles" ON profiles;
  CREATE POLICY "super_admin_update_profiles" ON profiles FOR UPDATE USING (is_super_admin());

  -- properties
  DROP POLICY IF EXISTS "super_admin_read_all_properties" ON properties;
  CREATE POLICY "super_admin_read_all_properties" ON properties FOR SELECT USING (is_super_admin());
  DROP POLICY IF EXISTS "super_admin_update_properties" ON properties;
  CREATE POLICY "super_admin_update_properties" ON properties FOR UPDATE USING (is_super_admin());

  -- transactions
  DROP POLICY IF EXISTS "super_admin_read_all_transactions" ON transactions;
  CREATE POLICY "super_admin_read_all_transactions" ON transactions FOR SELECT USING (is_super_admin());

  -- kyc_cases
  DROP POLICY IF EXISTS "super_admin_read_all_kyc" ON kyc_cases;
  CREATE POLICY "super_admin_read_all_kyc" ON kyc_cases FOR SELECT USING (is_super_admin());
  DROP POLICY IF EXISTS "super_admin_update_kyc" ON kyc_cases;
  CREATE POLICY "super_admin_update_kyc" ON kyc_cases FOR UPDATE USING (is_super_admin());

  -- activity_events
  DROP POLICY IF EXISTS "super_admin_read_all_events" ON activity_events;
  CREATE POLICY "super_admin_read_all_events" ON activity_events FOR SELECT USING (is_super_admin());
  DROP POLICY IF EXISTS "super_admin_insert_events" ON activity_events;
  CREATE POLICY "super_admin_insert_events" ON activity_events FOR INSERT WITH CHECK (is_super_admin());

  -- support_tickets
  DROP POLICY IF EXISTS "super_admin_read_all_tickets" ON support_tickets;
  CREATE POLICY "super_admin_read_all_tickets" ON support_tickets FOR SELECT USING (is_super_admin());
  DROP POLICY IF EXISTS "super_admin_update_tickets" ON support_tickets;
  CREATE POLICY "super_admin_update_tickets" ON support_tickets FOR UPDATE USING (is_super_admin());

  -- ticket_messages
  DROP POLICY IF EXISTS "super_admin_read_all_ticket_messages" ON ticket_messages;
  CREATE POLICY "super_admin_read_all_ticket_messages" ON ticket_messages FOR SELECT USING (is_super_admin());
  DROP POLICY IF EXISTS "super_admin_insert_ticket_messages" ON ticket_messages;
  CREATE POLICY "super_admin_insert_ticket_messages" ON ticket_messages FOR INSERT WITH CHECK (is_super_admin());

  -- subscriptions
  DROP POLICY IF EXISTS "super_admin_read_all_subscriptions" ON subscriptions;
  CREATE POLICY "super_admin_read_all_subscriptions" ON subscriptions FOR SELECT USING (is_super_admin());
END $$;

-- 9. Indexes
CREATE INDEX IF NOT EXISTS idx_platform_metrics_type_date ON platform_metrics(metric_type, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderation_actions_property ON moderation_actions(property_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_notes_entity ON admin_notes(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agencies_status ON agencies(status);
CREATE INDEX IF NOT EXISTS idx_properties_moderation ON properties(moderation_status);
