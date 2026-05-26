-- Migration : extended user profile metadata pour la page /compte.
--
-- Le hook useProfileMeta utilisait localStorage. Cette migration crée la
-- table de persistance cross-device pour les champs riches du dashboard
-- profil (mode toggle, vérifications, préférences notifications/sécurité/
-- privacy, sessions actives).
--
-- Une seule ligne par user (PK = user_id). Le hook crée la ligne au premier
-- update.

CREATE TABLE IF NOT EXISTS user_profile_meta (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  mode TEXT NOT NULL DEFAULT 'mixed' CHECK (mode IN ('buyer', 'seller', 'mixed')),
  bio TEXT NOT NULL DEFAULT '',

  -- Vérifications (email derived from auth.users, phone/id custom)
  verifications JSONB NOT NULL DEFAULT
    '{"email": false, "phone": false, "id": false}'::jsonb,

  -- Préférences canal de notif + fréquence alertes recherche
  notifications JSONB NOT NULL DEFAULT
    '{"email": true, "push": true, "sms": false, "searchFreq": "daily"}'::jsonb,

  -- Sécurité (2FA, passkeys, login alerts)
  security JSONB NOT NULL DEFAULT
    '{"twoFactor": false, "passkeys": false, "loginAlerts": true, "passwordAgeDays": 0}'::jsonb,

  -- Privacy (visibility, analytics, marketing)
  privacy JSONB NOT NULL DEFAULT
    '{"profilePublic": false, "analytics": true, "marketing": false}'::jsonb,

  -- Préférences d'affichage (langues, devise, surface, tri)
  preferences JSONB NOT NULL DEFAULT
    '{"languages": ["FR"], "currency": "CHF", "areaUnit": "m2", "defaultSort": "relevance"}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_profile_meta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own profile meta"
  ON user_profile_meta FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_user_profile_meta_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_profile_meta_updated_at
  BEFORE UPDATE ON user_profile_meta
  FOR EACH ROW
  EXECUTE FUNCTION update_user_profile_meta_updated_at();
