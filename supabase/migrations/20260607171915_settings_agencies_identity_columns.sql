-- Settings « Mon agence » — champs identité légale + présentation (frontend déjà prêt).
-- Additif, nullable, non destructif. Réutilise les colonnes existantes (name, address,
-- city, canton, phone, email, website, logo_url) ; ajoute les 7 manquantes.
ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS legal_name   text,
  ADD COLUMN IF NOT EXISTS ide          text,
  ADD COLUMN IF NOT EXISTS tva          text,
  ADD COLUMN IF NOT EXISTS founded_year integer,
  ADD COLUMN IF NOT EXISTS postal_code  text,
  ADD COLUMN IF NOT EXISTS country      text,
  ADD COLUMN IF NOT EXISTS about_short  text;

COMMENT ON COLUMN public.agencies.legal_name   IS 'Raison sociale (settings Agence)';
COMMENT ON COLUMN public.agencies.ide          IS 'Numéro IDE/UID suisse (CHE-...)';
COMMENT ON COLUMN public.agencies.tva          IS 'Numéro TVA (CHE-... TVA)';
COMMENT ON COLUMN public.agencies.founded_year IS 'Année de création';
COMMENT ON COLUMN public.agencies.postal_code  IS 'NPA (code postal)';
COMMENT ON COLUMN public.agencies.country      IS 'Pays du siège';
COMMENT ON COLUMN public.agencies.about_short  IS 'Présentation publique courte';
