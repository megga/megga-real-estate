-- Verrou anti-double-screening WhatsApp (anti double-crédit Dilisense).
--
-- (1) screening_status (TEXT, ajouté par 20260526120000, SANS contrainte et SANS
--     writer aujourd'hui) est repris comme ÉTAT du verrou : running/done/failed.
--     Le RÉSULTAT du screening reste dans pep_status/sanctions_status (c'est là que
--     l'edge kyc-screening écrit). On fige le vocabulaire par un CHECK.
--     NOT VALID : la contrainte s'applique aux écritures FUTURES sans scanner ni
--     échouer sur d'éventuelles lignes héritées (la colonne est non-écrite à ce jour).
-- (2) screening_started_at : horodatage d'ACQUISITION du verrou, DISTINCT de
--     last_screening_at. On NE réutilise PAS last_screening_at pour le verrou : l'edge
--     kyc-screening renvoie 429 si last_screening_at < 60s (kyc-screening/index.ts:443),
--     donc l'écrire avant l'appel edge ferait s'auto-bloquer chaque screening.
-- Additif + idempotent.

BEGIN;

ALTER TABLE public.kyc_cases DROP CONSTRAINT IF EXISTS kyc_cases_screening_status_check;
ALTER TABLE public.kyc_cases ADD CONSTRAINT kyc_cases_screening_status_check
  CHECK (screening_status IS NULL OR screening_status IN ('running','done','failed')) NOT VALID;

ALTER TABLE public.kyc_cases
  ADD COLUMN IF NOT EXISTS screening_started_at timestamptz;

COMMENT ON COLUMN public.kyc_cases.screening_status IS
  'État du verrou de screening WhatsApp (running/done/failed). Le RÉSULTAT est dans pep_status/sanctions_status.';
COMMENT ON COLUMN public.kyc_cases.screening_started_at IS
  'Horodatage d''acquisition du verrou anti-double-screening (distinct de last_screening_at).';

COMMIT;
