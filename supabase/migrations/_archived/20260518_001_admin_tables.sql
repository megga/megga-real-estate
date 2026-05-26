-- ============================================================================
-- MEGGA Real Estate — Migration : tables admin dédiées
-- ============================================================================
-- Remplace les hacks `admin_notes` JSON par 3 tables dédiées :
--   1. admin_changelog      — entrées de changelog publiées
--   2. admin_feature_flags  — flags fonctionnels (anciennement init lazy)
--   3. admin_nps_responses  — réponses NPS collectées via NpsSurvey
--
-- Identifiés dans le rapport red-team de l'audit Supabase comme "hacks design".
-- ============================================================================

-- ============================================================================
-- 1. admin_changelog
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_changelog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  version text,
  published boolean NOT NULL DEFAULT true,
  author_id uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_changelog_created_at
  ON admin_changelog (created_at DESC);

ALTER TABLE admin_changelog ENABLE ROW LEVEL SECURITY;

-- Lecture : tout le monde voit les entrées publiées ; super_admin voit tout
DROP POLICY IF EXISTS admin_changelog_select ON admin_changelog;
CREATE POLICY admin_changelog_select ON admin_changelog
  FOR SELECT
  USING (
    published = true
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- Écriture : super_admin uniquement
DROP POLICY IF EXISTS admin_changelog_write ON admin_changelog;
CREATE POLICY admin_changelog_write ON admin_changelog
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- ============================================================================
-- 2. admin_feature_flags
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  label text NOT NULL,
  description text NOT NULL DEFAULT '',
  enabled_globally boolean NOT NULL DEFAULT false,
  enabled_plans text[] NOT NULL DEFAULT '{}',
  enabled_agencies uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_feature_flags_key
  ON admin_feature_flags (key);

ALTER TABLE admin_feature_flags ENABLE ROW LEVEL SECURITY;

-- Lecture : auth users peuvent vérifier si un flag est activé (côté front)
DROP POLICY IF EXISTS admin_feature_flags_select ON admin_feature_flags;
CREATE POLICY admin_feature_flags_select ON admin_feature_flags
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Écriture : super_admin uniquement
DROP POLICY IF EXISTS admin_feature_flags_write ON admin_feature_flags;
CREATE POLICY admin_feature_flags_write ON admin_feature_flags
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- Seed initial : les 8 flags actuellement maintenus en mémoire dans useFeatureFlags.ts
INSERT INTO admin_feature_flags (key, label, description, enabled_globally, enabled_plans, enabled_agencies) VALUES
  ('virtual_staging', 'Virtual Staging IA', 'Meubler virtuellement les photos de biens', false, ARRAY['pro','agency'], '{}'),
  ('ai_copilot', 'MEGGA AI Copilot', 'Copilote IA pour les agents', true, '{}', '{}'),
  ('floor_plan', 'Plan interactif', 'Floor plan cliquable avec hotspots', false, ARRAY['pro','agency'], '{}'),
  ('kyc_screening', 'Screening PEP/Sanctions', 'Verification automatique PEP et sanctions', true, '{}', '{}'),
  ('matching_engine', 'Matching acheteurs', 'Matching automatique acheteurs et biens', true, '{}', '{}'),
  ('calendar_sync', 'Sync calendrier', 'Synchronisation Google/Outlook Calendar', false, ARRAY['pro','agency'], '{}'),
  ('csv_import', 'Import CSV contacts', 'Import de contacts via CSV/vCard', true, '{}', '{}'),
  ('seller_portal', 'Portail vendeur', 'Portail de suivi pour les vendeurs', false, ARRAY['agency'], '{}')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 3. admin_nps_responses
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_nps_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text NOT NULL DEFAULT '',
  user_id uuid REFERENCES profiles(id),
  user_email text,
  user_name text,
  agency_id uuid REFERENCES agencies(id),
  role text,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_nps_submitted_at
  ON admin_nps_responses (submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_nps_rating
  ON admin_nps_responses (rating);

ALTER TABLE admin_nps_responses ENABLE ROW LEVEL SECURITY;

-- INSERT : auth user soumet sa propre réponse
DROP POLICY IF EXISTS admin_nps_insert_own ON admin_nps_responses;
CREATE POLICY admin_nps_insert_own ON admin_nps_responses
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND (user_id IS NULL OR user_id = auth.uid()));

-- SELECT : super_admin uniquement (data agrégée sensible)
DROP POLICY IF EXISTS admin_nps_select_admin ON admin_nps_responses;
CREATE POLICY admin_nps_select_admin ON admin_nps_responses
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));
