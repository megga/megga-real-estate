-- ─── Onboarding columns on profiles ────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_step      INTEGER  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS canton               TEXT;

-- ─── Onboarding checklist table ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS onboarding_checklist (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agency_id    UUID        REFERENCES agencies(id) ON DELETE CASCADE,
  step_key     TEXT        NOT NULL,
  completed    BOOLEAN     DEFAULT false,
  completed_at TIMESTAMPTZ,
  UNIQUE (user_id, step_key)
);

ALTER TABLE onboarding_checklist ENABLE ROW LEVEL SECURITY;

-- Users can read/write their own checklist rows
CREATE POLICY "onboarding_checklist_self"
  ON onboarding_checklist
  FOR ALL
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Service role can do anything
CREATE POLICY "onboarding_checklist_service"
  ON onboarding_checklist
  FOR ALL
  TO service_role
  USING (true);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_onboarding_checklist_user
  ON onboarding_checklist (user_id);
