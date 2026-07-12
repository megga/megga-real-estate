-- Refonte Réglages « Focus » — 2 champs du design sans colonne dédiée.
-- Additif, nullable, non destructif (couvert par les RLS row-level existantes).
--   • agent_profiles.linkedin_url : lien LinkedIn du profil agent (groupe « Liens »,
--     à côté de website_url déjà présent).
--   • agencies.legal_form         : forme juridique de l'agence (SA, Sàrl…), groupe
--     « Identité légale » de la section Agence.
ALTER TABLE public.agent_profiles
  ADD COLUMN IF NOT EXISTS linkedin_url text;

ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS legal_form text;

COMMENT ON COLUMN public.agent_profiles.linkedin_url IS 'Profil LinkedIn (settings Profil, groupe Liens)';
COMMENT ON COLUMN public.agencies.legal_form         IS 'Forme juridique (SA, Sàrl…) — settings Agence, Identité légale';
