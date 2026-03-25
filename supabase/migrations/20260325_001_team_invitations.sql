-- Team Invitations table + RLS
-- Manages team member invitations per agency with token-based acceptance

-- Enum for invitation status
DO $$ BEGIN
  CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'cancelled', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Team invitations table
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

-- Unique constraint: one pending invite per email per agency
CREATE UNIQUE INDEX IF NOT EXISTS team_invitations_unique_pending
  ON team_invitations (agency_id, email)
  WHERE status = 'pending';

-- Index for token lookups (accept flow)
CREATE INDEX IF NOT EXISTS team_invitations_token_idx ON team_invitations (token);

-- Index for agency listing
CREATE INDEX IF NOT EXISTS team_invitations_agency_status_idx ON team_invitations (agency_id, status);

-- RLS
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;

-- Agency members can read their invitations
CREATE POLICY team_invitations_select ON team_invitations
  FOR SELECT USING (agency_id = get_user_agency_id());

-- Admin/manager can insert invitations
CREATE POLICY team_invitations_insert ON team_invitations
  FOR INSERT WITH CHECK (agency_id = get_user_agency_id());

-- Admin/manager can update invitations (cancel, resend)
CREATE POLICY team_invitations_update ON team_invitations
  FOR UPDATE USING (agency_id = get_user_agency_id());

-- RPC: count active members + pending invitations for plan limit check
CREATE OR REPLACE FUNCTION get_agency_member_count(p_agency_id UUID)
RETURNS INTEGER AS $$
  SELECT (
    (SELECT count(*)::int FROM profiles WHERE agency_id = p_agency_id) +
    (SELECT count(*)::int FROM team_invitations WHERE agency_id = p_agency_id AND status = 'pending')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;
