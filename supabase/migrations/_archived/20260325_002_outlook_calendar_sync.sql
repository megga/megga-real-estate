-- Outlook Calendar sync: tokens storage + visit-event mapping
-- Requires: visits table, auth.users
-- Pattern: identical to google_calendar_tokens / calendar_sync but for Microsoft Graph API

-- Store Microsoft OAuth tokens with calendar scope per user
CREATE TABLE outlook_calendar_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  sync_enabled BOOLEAN DEFAULT true,
  outlook_email TEXT,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Map MEGGA visits to Outlook Calendar events
CREATE TABLE outlook_calendar_sync (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  visit_id UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  outlook_event_id TEXT NOT NULL,
  last_synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, visit_id),
  UNIQUE (user_id, outlook_event_id)
);

-- Indexes
CREATE INDEX idx_outlook_sync_user_visit ON outlook_calendar_sync(user_id, visit_id);
CREATE INDEX idx_outlook_sync_user_event ON outlook_calendar_sync(user_id, outlook_event_id);
CREATE INDEX idx_outlook_tokens_user ON outlook_calendar_tokens(user_id);

-- RLS
ALTER TABLE outlook_calendar_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE outlook_calendar_sync ENABLE ROW LEVEL SECURITY;

-- outlook_calendar_tokens: users can only access their own row
CREATE POLICY "Users can read own outlook tokens"
  ON outlook_calendar_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own outlook tokens"
  ON outlook_calendar_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own outlook tokens"
  ON outlook_calendar_tokens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own outlook tokens"
  ON outlook_calendar_tokens FOR DELETE
  USING (auth.uid() = user_id);

-- outlook_calendar_sync: users can only access their own mappings
CREATE POLICY "Users can read own outlook sync"
  ON outlook_calendar_sync FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own outlook sync"
  ON outlook_calendar_sync FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own outlook sync"
  ON outlook_calendar_sync FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own outlook sync"
  ON outlook_calendar_sync FOR DELETE
  USING (auth.uid() = user_id);

-- Service role access for Edge Functions
CREATE POLICY "Service role full access outlook tokens"
  ON outlook_calendar_tokens FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access outlook sync"
  ON outlook_calendar_sync FOR ALL
  USING (auth.role() = 'service_role');
