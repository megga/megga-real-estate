-- WhatsApp « outbound fiable » — statuts de livraison Meta (sent/delivered/read/failed).
-- NOTE : re-datée de 20260614120000 → 20260628150000 au merge (28.06). L'ancien
-- timestamp collisionnait avec 20260614120000_property_private_notes ET aurait été
-- sauté par le date-guard du deploy.yml (qui n'applique que les migrations du jour).
-- Le webhook ingère désormais les events `statuses` et fait progresser
-- whatsapp_messages.status de façon monotone : received < sent < delivered < read ;
-- failed est terminal (et n'écrase jamais read).
-- Idempotente (la CI ne rejoue que les migrations datées du jour) :
-- DROP CONSTRAINT IF EXISTS + ADD COLUMN IF NOT EXISTS.

-- 1. Étendre la contrainte status (avant : received | read | failed).
ALTER TABLE public.whatsapp_messages
  DROP CONSTRAINT IF EXISTS whatsapp_messages_status_check;

ALTER TABLE public.whatsapp_messages
  ADD CONSTRAINT whatsapp_messages_status_check
  CHECK (status = ANY (ARRAY['received'::text, 'sent'::text, 'delivered'::text, 'read'::text, 'failed'::text]));

-- 2. Horodatage du dernier event de statut reçu (audit + debug fenêtre 24h).
ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS status_updated_at timestamptz;

-- 3. Erreur de livraison lisible (ex. « 131047 — fenêtre 24h fermée »).
--    Renseignée uniquement quand status = 'failed'.
ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS delivery_error text;

-- Pas de nouvel index : la mise à jour cible l'UNIQUE existant
-- (provider, provider_message_id). RLS inchangée (politiques existantes).
