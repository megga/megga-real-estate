-- whatsapp_pending_actions — une action sensible en attente de confirmation « oui »
-- par agent (Phase 4A, tier confirm). Une ligne max par agent (UNIQUE profile_id).
--
-- Table ISOLÉE volontairement : on NE réutilise PAS ai_actions_queue (infra vivante
-- avec processeur d'autonomie L1/L2/L3) pour éviter qu'une action parte sans le « oui »
-- de l'agent. Écrite/lue UNIQUEMENT par le service-role (whatsapp-agent / webhook).
-- RLS activée SANS policy => aucun accès anon/authenticated ; le service-role bypass la RLS.

BEGIN;

CREATE TABLE IF NOT EXISTS public.whatsapp_pending_actions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  uuid        NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  agency_id   uuid        NULL REFERENCES public.agencies(id) ON DELETE SET NULL,
  wa_number   text        NOT NULL,
  tool        text        NOT NULL,           -- ex 'send_client_message'
  args        jsonb       NOT NULL DEFAULT '{}'::jsonb,
  summary     text        NOT NULL,           -- phrase montrée à l'agent
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL DEFAULT now() + interval '15 minutes'
);

ALTER TABLE public.whatsapp_pending_actions ENABLE ROW LEVEL SECURITY;
-- Pas de policy = aucun accès via anon/authenticated. Le service-role bypass la RLS.

COMMIT;
