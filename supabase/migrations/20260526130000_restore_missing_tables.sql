-- Restore 2 tables present in prod but absent from the 2026-05-26 baseline
-- dump (both originally created via archived migrations that the dump skipped).
-- Idempotent (CREATE TABLE IF NOT EXISTS / DO BEGIN EXCEPTION blocks).
--
-- The 3rd missing table — property_visits — is NOT in prod either; the code
-- in src/components/account/profile/VisitsRow.tsx targets a table that
-- never existed. The real table is `visits` with different column names.
-- A TODO + cast was added to the call-site; the proper refactor is a
-- separate chip.

-- ── team_invitations ──────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'cancelled', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS team_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'agent',
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  status invitation_status NOT NULL DEFAULT 'pending',
  invited_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  claimed_at TIMESTAMPTZ,
  claimed_by UUID REFERENCES profiles(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS team_invitations_unique_pending
  ON team_invitations (agency_id, email)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS team_invitations_token_idx ON team_invitations (token);
CREATE INDEX IF NOT EXISTS team_invitations_agency_status_idx ON team_invitations (agency_id, status);

ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS team_invitations_select ON team_invitations;
CREATE POLICY team_invitations_select ON team_invitations
  FOR SELECT USING (agency_id = get_user_agency_id());

DROP POLICY IF EXISTS team_invitations_insert ON team_invitations;
CREATE POLICY team_invitations_insert ON team_invitations
  FOR INSERT WITH CHECK (agency_id = get_user_agency_id());

DROP POLICY IF EXISTS team_invitations_update ON team_invitations;
CREATE POLICY team_invitations_update ON team_invitations
  FOR UPDATE USING (agency_id = get_user_agency_id());

-- ── vendor_dossiers ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vendor_dossiers (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  transaction TEXT NOT NULL CHECK (transaction IN ('vente', 'location')),
  property_type TEXT NOT NULL CHECK (property_type IN ('appartement', 'maison', 'terrain', 'commercial')),
  address TEXT NOT NULL,
  surface TEXT,
  rooms NUMERIC,
  photos_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'reviewing', 'estimated', 'mandate', 'live', 'visits', 'sold')),
  status_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  agent JSONB NOT NULL,
  estimation JSONB,
  publication JSONB,
  next_action JSONB,
  msg_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE vendor_dossiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own vendor dossiers" ON vendor_dossiers;
CREATE POLICY "Users can manage their own vendor dossiers"
  ON vendor_dossiers FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_vendor_dossiers_user
  ON vendor_dossiers (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vendor_dossiers_status
  ON vendor_dossiers (user_id, status)
  WHERE status NOT IN ('sold', 'archived');
