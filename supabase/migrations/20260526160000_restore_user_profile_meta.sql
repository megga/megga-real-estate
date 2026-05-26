-- Restore `user_profile_meta` table absent from the baseline schema dump.
-- Used by src/hooks/useProfileMeta.ts as cross-device persistence for the
-- /compte page (mode toggle, verifications, notif/security/privacy prefs).
--
-- Originals: supabase/migrations/_archived/20260504_002_user_profile_meta.sql

CREATE TABLE IF NOT EXISTS public.user_profile_meta (
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

ALTER TABLE public.user_profile_meta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own profile meta" ON public.user_profile_meta;
CREATE POLICY "Users can manage their own profile meta"
  ON public.user_profile_meta FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.update_user_profile_meta_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_profile_meta_updated_at ON public.user_profile_meta;
CREATE TRIGGER trg_user_profile_meta_updated_at
  BEFORE UPDATE ON public.user_profile_meta
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_profile_meta_updated_at();
