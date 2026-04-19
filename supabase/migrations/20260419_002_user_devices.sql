-- Device fingerprint tracking for "unknown device" login alerts.
-- Triggered after each successful signIn (password, OAuth, magic link).
-- If the fingerprint+user_id pair is new, we send an email and store the row.
-- Otherwise we bump last_seen_at.

CREATE TABLE IF NOT EXISTS user_devices (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fingerprint   TEXT NOT NULL,   -- sha256(user_agent | accept-language | screen | tz)
  user_agent    TEXT,
  browser       TEXT,            -- "Chrome 120", "Safari 17", ...
  os            TEXT,            -- "macOS", "iOS", "Windows", ...
  ip            TEXT,
  country       TEXT,            -- ISO-2, from ip geolocation
  city          TEXT,
  trusted       BOOLEAN NOT NULL DEFAULT TRUE,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_user_devices_user_last_seen
  ON user_devices (user_id, last_seen_at DESC);

ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read their devices" ON user_devices;
CREATE POLICY "Users read their devices"
  ON user_devices FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users delete their devices" ON user_devices;
CREATE POLICY "Users delete their devices"
  ON user_devices FOR DELETE
  USING (user_id = auth.uid());
-- INSERT/UPDATE are service_role only (via Edge Function)
