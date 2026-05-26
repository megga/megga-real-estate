-- Coming Soon waitlist : emails collectés via le splash public Property X
-- avant le lancement officiel du site.
--
-- Insert ouvert à anon (visiteurs du splash), select réservé aux admins.
-- L'unique constraint sur email empêche les doublons.

CREATE TABLE IF NOT EXISTS coming_soon_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  locale text NOT NULL DEFAULT 'fr',
  source text NOT NULL DEFAULT 'coming_soon_splash',
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coming_soon_subscribers_created_at
  ON coming_soon_subscribers (created_at DESC);

ALTER TABLE coming_soon_subscribers ENABLE ROW LEVEL SECURITY;

-- Anon (visiteurs publics du splash) : INSERT only, jamais SELECT.
DROP POLICY IF EXISTS "anon_insert_email" ON coming_soon_subscribers;
CREATE POLICY "anon_insert_email"
  ON coming_soon_subscribers
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Admin authentifié : SELECT pour exporter la liste (CRM/CSV plus tard).
DROP POLICY IF EXISTS "admin_select_all" ON coming_soon_subscribers;
CREATE POLICY "admin_select_all"
  ON coming_soon_subscribers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Admin authentifié : DELETE pour purger (RGPD / nettoyage manuel).
DROP POLICY IF EXISTS "admin_delete" ON coming_soon_subscribers;
CREATE POLICY "admin_delete"
  ON coming_soon_subscribers
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'super_admin')
    )
  );

COMMENT ON TABLE coming_soon_subscribers IS
  'Waitlist publique collectée via le splash Coming Soon avant lancement du site.';
COMMENT ON COLUMN coming_soon_subscribers.email IS
  'Email du visiteur (unique). Utilisé pour notifier le lancement.';
COMMENT ON COLUMN coming_soon_subscribers.locale IS
  'Langue du visiteur au moment de l''inscription (fr/de/en/it).';
COMMENT ON COLUMN coming_soon_subscribers.source IS
  'Origine de l''inscription (default: coming_soon_splash, sinon /coming-soon page).';
COMMENT ON COLUMN coming_soon_subscribers.user_agent IS
  'User-agent du navigateur (audit léger anti-spam).';
