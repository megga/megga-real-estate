-- Identité LBA sur les contacts — date de naissance, nationalité, pays de résidence, adresse.
--
-- Ces 4 champs viennent du bundle design « Contacts Beta v1 » (modale de création +
-- bloc Coordonnées de la fiche). Ils sont volontairement des COLONNES réelles et non
-- des clés dans `form_data` : ce sont des données d'identification LBA (art. 3 LBA),
-- elles doivent être typées, contraintes et auditables — pas noyées dans un jsonb libre.
--
-- `nationality` / `residence_country` sont stockés en ISO 3166-1 alpha-2 (CH, FR, RU…)
-- et non en libellé français. Raison : `kyc_cases.contact_nationality` utilise déjà ce
-- format, et les listes GAFI/FATF de `src/lib/constants.ts` (FATF_HIGH_RISK_COUNTRIES,
-- FATF_INCREASED_MONITORING) sont indexées sur ces codes. Stocker « Suisse » couperait
-- l'identité du contact de tout le scoring de risque pays. L'UI affiche le libellé FR.
--
-- Idempotent : le fichier peut être rejoué (CI + application manuelle) sans effet de bord.

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS birth_date        date,
  ADD COLUMN IF NOT EXISTS nationality       text,
  ADD COLUMN IF NOT EXISTS residence_country text,
  ADD COLUMN IF NOT EXISTS home_address      text;

COMMENT ON COLUMN public.contacts.birth_date        IS 'Date de naissance (identification LBA art. 3). Saisie UI au format suisse JJ.MM.AAAA.';
COMMENT ON COLUMN public.contacts.nationality       IS 'Nationalité — ISO 3166-1 alpha-2 majuscules. Même format que kyc_cases.contact_nationality.';
COMMENT ON COLUMN public.contacts.residence_country IS 'Pays de résidence — ISO 3166-1 alpha-2 majuscules.';
COMMENT ON COLUMN public.contacts.home_address      IS 'Adresse de domicile (identification LBA art. 3), texte libre.';

-- Contraintes de format. PostgreSQL 15 ne supporte pas ADD CONSTRAINT IF NOT EXISTS,
-- d'où le garde-fou explicite sur pg_constraint.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.contacts'::regclass AND conname = 'contacts_nationality_iso2'
  ) THEN
    ALTER TABLE public.contacts
      ADD CONSTRAINT contacts_nationality_iso2
      CHECK (nationality IS NULL OR nationality ~ '^[A-Z]{2}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.contacts'::regclass AND conname = 'contacts_residence_country_iso2'
  ) THEN
    ALTER TABLE public.contacts
      ADD CONSTRAINT contacts_residence_country_iso2
      CHECK (residence_country IS NULL OR residence_country ~ '^[A-Z]{2}$');
  END IF;

  -- Garde-fou de saisie : une date de naissance dans le futur ou antérieure à 1900
  -- est une faute de frappe, jamais une donnée d'identification valable.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.contacts'::regclass AND conname = 'contacts_birth_date_plausible'
  ) THEN
    ALTER TABLE public.contacts
      ADD CONSTRAINT contacts_birth_date_plausible
      CHECK (birth_date IS NULL OR (birth_date > DATE '1900-01-01' AND birth_date <= CURRENT_DATE));
  END IF;
END $$;
