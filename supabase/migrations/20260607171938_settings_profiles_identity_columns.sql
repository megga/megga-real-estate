-- Settings « Mon profil » — champs identité sans colonne dédiée (frontend déjà prêt).
-- title → réutilise agent_role (existant) ; signature plain → email_signature (existant) ;
-- avatar → avatar_url (existant). Ici on ajoute les 4 restants, additif/nullable.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS rcc                  text,
  ADD COLUMN IF NOT EXISTS mobile_phone         text,
  ADD COLUMN IF NOT EXISTS signature_mode       text DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS email_signature_html text;

-- signature_mode ne peut valoir que 'text' ou 'html' (NULL toléré).
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_signature_mode_chk
  CHECK (signature_mode IS NULL OR signature_mode IN ('text','html'));

COMMENT ON COLUMN public.profiles.rcc                  IS 'Numéro RCC (registre suisse des courtiers) — settings Profil';
COMMENT ON COLUMN public.profiles.mobile_phone         IS 'Téléphone mobile (phone = ligne fixe)';
COMMENT ON COLUMN public.profiles.signature_mode       IS 'text | html : représentation active de la signature email';
COMMENT ON COLUMN public.profiles.email_signature_html IS 'Signature email — version HTML';
