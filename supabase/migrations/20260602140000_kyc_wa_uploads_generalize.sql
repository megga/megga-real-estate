-- KYC par WhatsApp — généralise kyc_magic_link_uploads pour accueillir le canal WhatsApp.
-- D3 : réutilise la table (déjà ocr_fields/ocr_provider/storage_path/sha256/document_id)
-- au lieu d'en créer une dédiée. magic_link_id devient nullable ; +source/kyc_case_id/wa_message_id.

BEGIN;

-- 1. magic_link_id nullable (uploads WhatsApp n'ont pas de magic link)
ALTER TABLE public.kyc_magic_link_uploads ALTER COLUMN magic_link_id DROP NOT NULL;

-- 2. Provenance du canal.
-- ON DELETE CASCADE (et non SET NULL) : une pièce WhatsApp a magic_link_id NULL ; nullifier
-- kyc_case_id à la suppression du dossier violerait origin_check. La rétention LBA 10 ans
-- (trg_enforce_kyc_cases_retention) bloque la suppression pendant la fenêtre ; passé celle-ci,
-- la pièce suit le dossier.
ALTER TABLE public.kyc_magic_link_uploads
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'magic_link',
  ADD COLUMN IF NOT EXISTS kyc_case_id uuid REFERENCES public.kyc_cases(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS wa_message_id text;

-- 3. Contraintes (idempotent : DROP IF EXISTS avant ADD — Postgres n'a pas ADD IF NOT EXISTS)
ALTER TABLE public.kyc_magic_link_uploads
  DROP CONSTRAINT IF EXISTS kyc_magic_link_uploads_source_check;
ALTER TABLE public.kyc_magic_link_uploads
  ADD CONSTRAINT kyc_magic_link_uploads_source_check
  CHECK (source IN ('magic_link', 'whatsapp'));

ALTER TABLE public.kyc_magic_link_uploads
  DROP CONSTRAINT IF EXISTS kyc_magic_link_uploads_origin_check;
ALTER TABLE public.kyc_magic_link_uploads
  ADD CONSTRAINT kyc_magic_link_uploads_origin_check
  CHECK (magic_link_id IS NOT NULL OR kyc_case_id IS NOT NULL);

-- 4. Index pour lister les pièces d'un dossier
CREATE INDEX IF NOT EXISTS idx_kyc_ml_uploads_case
  ON public.kyc_magic_link_uploads (kyc_case_id, uploaded_at)
  WHERE kyc_case_id IS NOT NULL;

-- 5. RLS : policies SELECT/UPDATE existantes scopent déjà sur agency_id = get_my_agency_id() → inchangées.
COMMENT ON COLUMN public.kyc_magic_link_uploads.source IS 'Canal : magic_link (client) ou whatsapp (agent transfère la pièce).';
COMMENT ON COLUMN public.kyc_magic_link_uploads.kyc_case_id IS 'FK directe au dossier (canal whatsapp). NULL pour magic_link (lien via magic_link_id).';

COMMIT;
