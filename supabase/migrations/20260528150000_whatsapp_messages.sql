-- whatsapp_messages — miroir des messages WhatsApp (Phase 1 : entrant seulement).
--
-- Alimentée par l'edge function whatsapp-webhook (service role). Chaque message
-- entrant OpenWA y est inséré, mappé au contact par numéro quand c'est possible.
--
-- RLS :
--   - service_role : insert (le webhook ; bypass RLS de toute façon)
--   - authenticated : SELECT uniquement les messages de SON agence (agency_id),
--     via public.get_my_agency_id() — le MÊME helper que la policy contacts_select
--     (cf. baseline_remote_schema.sql:7554). PAS current_agency_id (inexistant).
--   - super_admin : tout (y compris messages non mappés, agency_id NULL)
--
-- Idempotence : UNIQUE(provider, provider_message_id) — OpenWA peut retenter
-- la livraison d'un même event (X-OpenWA-Retry-Count).

BEGIN;

CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          timestamptz NOT NULL    DEFAULT now(),

  -- Provenance / provider-agnostic
  provider            text        NOT NULL    DEFAULT 'openwa' CHECK (provider IN ('openwa', 'meta')),
  provider_message_id text        NOT NULL,
  session_id          text        NULL,
  direction           text        NOT NULL    DEFAULT 'inbound' CHECK (direction IN ('inbound', 'outbound')),

  -- Adresses (chiffres only, format international sans +)
  wa_from             text        NOT NULL,
  wa_to               text        NULL,

  -- Mapping CRM (best-effort par numéro)
  contact_id          uuid        NULL        REFERENCES public.contacts(id)  ON DELETE SET NULL,
  agency_id           uuid        NULL        REFERENCES public.agencies(id)  ON DELETE SET NULL,

  -- Contenu
  body                text        NULL,
  media_type          text        NULL        CHECK (media_type IS NULL OR media_type IN ('image','audio','video','document','location','contact','sticker')),
  media_url           text        NULL,

  status              text        NOT NULL    DEFAULT 'received' CHECK (status IN ('received','read','failed')),
  wa_timestamp        timestamptz NULL,
  raw                 jsonb       NULL,

  CONSTRAINT whatsapp_messages_provider_msgid_uniq UNIQUE (provider, provider_message_id)
);

-- Lecture fiche contact : messages d'un contact, triés par date.
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_contact_created
  ON public.whatsapp_messages (contact_id, created_at DESC)
  WHERE contact_id IS NOT NULL;

-- Filtre tenant.
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_agency_created
  ON public.whatsapp_messages (agency_id, created_at DESC)
  WHERE agency_id IS NOT NULL;

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- authenticated : voit les messages de son agence uniquement.
-- get_my_agency_id() = helper utilisé par contacts_select (baseline:7554).
DROP POLICY IF EXISTS "whatsapp_messages_agency_select" ON public.whatsapp_messages;
CREATE POLICY "whatsapp_messages_agency_select"
  ON public.whatsapp_messages
  FOR SELECT
  TO authenticated
  USING (agency_id IS NOT NULL AND agency_id = public.get_my_agency_id());

-- super_admin : tout (gestion + messages non mappés).
DROP POLICY IF EXISTS "whatsapp_messages_super_admin_all" ON public.whatsapp_messages;
CREATE POLICY "whatsapp_messages_super_admin_all"
  ON public.whatsapp_messages
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Pas de policy INSERT pour anon/authenticated : seul le service_role écrit
-- (l'edge function), et le service_role bypass la RLS.

COMMIT;
