-- Étend contacts.source pour autoriser les leads créés via WhatsApp / MEGGA AI.
-- Le tool create_contact de whatsapp-agent (et la future création autonome de lead)
-- insère source='whatsapp_ai' ; sans ça → viole contacts_source_check → création KO.
-- Additif : aucune ligne existante ne viole la nouvelle contrainte.

BEGIN;

ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS contacts_source_check;
ALTER TABLE public.contacts ADD CONSTRAINT contacts_source_check
  CHECK (source IN ('onboarding','manual','import','website','referral','whatsapp','whatsapp_ai'));

COMMIT;
