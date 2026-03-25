-- Google Calendar sync: tokens storage + visit-event mapping
-- Requires: visits table, auth.users

-- Store Google OAuth tokens with calendar scope per user
CREATE TABLE google_calendar_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  calendar_id TEXT DEFAULT 'primary',
  sync_enabled BOOLEAN DEFAULT true,
  google_email TEXT,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Map MEGGA visits to Google Calendar events
CREATE TABLE calendar_sync (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  visit_id UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
  google_event_id TEXT NOT NULL,
  google_calendar_id TEXT DEFAULT 'primary',
  last_synced_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, visit_id),
  UNIQUE (user_id, google_event_id)
);

-- Indexes
CREATE INDEX idx_calendar_sync_user_visit ON calendar_sync(user_id, visit_id);
CREATE INDEX idx_calendar_sync_user_event ON calendar_sync(user_id, google_event_id);
CREATE INDEX idx_gcal_tokens_user ON google_calendar_tokens(user_id);

-- RLS
ALTER TABLE google_calendar_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_sync ENABLE ROW LEVEL SECURITY;

-- google_calendar_tokens: users can only access their own row
CREATE POLICY "Users can read own calendar tokens"
  ON google_calendar_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own calendar tokens"
  ON google_calendar_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own calendar tokens"
  ON google_calendar_tokens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own calendar tokens"
  ON google_calendar_tokens FOR DELETE
  USING (auth.uid() = user_id);

-- calendar_sync: users can only access their own mappings
CREATE POLICY "Users can read own calendar sync"
  ON calendar_sync FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own calendar sync"
  ON calendar_sync FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own calendar sync"
  ON calendar_sync FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own calendar sync"
  ON calendar_sync FOR DELETE
  USING (auth.uid() = user_id);

-- Service role access for Edge Functions
CREATE POLICY "Service role full access tokens"
  ON google_calendar_tokens FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access sync"
  ON calendar_sync FOR ALL
  USING (auth.role() = 'service_role');
