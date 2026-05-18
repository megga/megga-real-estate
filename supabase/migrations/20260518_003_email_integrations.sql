-- Email integrations: Gmail + Outlook Mail OAuth tokens + message cache
-- Pattern aligné sur 20260326_001_google_calendar_sync + 20260325_002_outlook_calendar_sync.
-- Scope OAuth séparé du calendar (gmail.readonly / Mail.Read) → tables distinctes
-- pour ne pas mélanger les permissions et faciliter la révocation indépendante.

-- ─── GMAIL ───────────────────────────────────────────────────────────────

CREATE TABLE gmail_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  sync_enabled BOOLEAN DEFAULT true,
  gmail_email TEXT,
  scopes TEXT NOT NULL DEFAULT 'https://www.googleapis.com/auth/gmail.readonly',
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_gmail_tokens_user ON gmail_tokens(user_id);

ALTER TABLE gmail_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own gmail tokens"
  ON gmail_tokens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own gmail tokens"
  ON gmail_tokens FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own gmail tokens"
  ON gmail_tokens FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own gmail tokens"
  ON gmail_tokens FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Service role full access gmail tokens"
  ON gmail_tokens FOR ALL USING (auth.role() = 'service_role');

-- ─── OUTLOOK MAIL ────────────────────────────────────────────────────────

CREATE TABLE outlook_mail_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  sync_enabled BOOLEAN DEFAULT true,
  outlook_email TEXT,
  scopes TEXT NOT NULL DEFAULT 'https://graph.microsoft.com/Mail.Read offline_access User.Read',
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_outlook_mail_tokens_user ON outlook_mail_tokens(user_id);

ALTER TABLE outlook_mail_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own outlook mail tokens"
  ON outlook_mail_tokens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own outlook mail tokens"
  ON outlook_mail_tokens FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own outlook mail tokens"
  ON outlook_mail_tokens FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own outlook mail tokens"
  ON outlook_mail_tokens FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Service role full access outlook mail tokens"
  ON outlook_mail_tokens FOR ALL USING (auth.role() = 'service_role');

-- ─── CACHE MESSAGES (optionnel — pour pagination/recherche locale) ───────
-- Cache léger : on stocke le métadata (from, to, subject, snippet, date) mais
-- pas le body complet (récupéré à la demande depuis l'API du provider).
-- TTL implicite : refetch quotidien via pg_cron ou à la demande de l'UI.

CREATE TABLE email_messages_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('gmail', 'outlook')),
  external_message_id TEXT NOT NULL,
  external_thread_id TEXT,
  from_address TEXT,
  from_name TEXT,
  to_addresses TEXT[],
  cc_addresses TEXT[],
  subject TEXT,
  snippet TEXT,
  -- Lien optionnel vers un contact MEGGA (résolu par adresse email)
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ NOT NULL,
  is_unread BOOLEAN DEFAULT false,
  has_attachments BOOLEAN DEFAULT false,
  fetched_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, provider, external_message_id)
);

CREATE INDEX idx_email_cache_user_contact ON email_messages_cache(user_id, contact_id, sent_at DESC)
  WHERE contact_id IS NOT NULL;
CREATE INDEX idx_email_cache_user_sent ON email_messages_cache(user_id, sent_at DESC);
CREATE INDEX idx_email_cache_thread ON email_messages_cache(user_id, external_thread_id);
CREATE INDEX idx_email_cache_from ON email_messages_cache(user_id, from_address);

ALTER TABLE email_messages_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own email cache"
  ON email_messages_cache FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own email cache"
  ON email_messages_cache FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own email cache"
  ON email_messages_cache FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own email cache"
  ON email_messages_cache FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Service role full access email cache"
  ON email_messages_cache FOR ALL USING (auth.role() = 'service_role');

-- ─── HELPERS ─────────────────────────────────────────────────────────────

-- Trigger pour auto-updated_at sur les tokens (cohérence avec calendar_tokens).
CREATE OR REPLACE FUNCTION update_email_token_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER gmail_tokens_updated_at
  BEFORE UPDATE ON gmail_tokens
  FOR EACH ROW EXECUTE FUNCTION update_email_token_timestamp();

CREATE TRIGGER outlook_mail_tokens_updated_at
  BEFORE UPDATE ON outlook_mail_tokens
  FOR EACH ROW EXECUTE FUNCTION update_email_token_timestamp();
