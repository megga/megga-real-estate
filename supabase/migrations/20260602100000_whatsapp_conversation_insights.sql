-- L2 : compréhension de conversation par MEGGA (DeepSeek). Un insight COURANT par
-- contact (UNIQUE), recalculé par le cron whatsapp-process quand un nouveau message
-- entrant arrive. La "péremption" est dérivée (whatsapp_stale_insight_contacts) :
-- pas de couplage au statut de traitement des messages.

BEGIN;

CREATE TABLE IF NOT EXISTS public.whatsapp_conversation_insights (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id             uuid        NOT NULL UNIQUE REFERENCES public.contacts(id)  ON DELETE CASCADE,
  agency_id              uuid        NOT NULL        REFERENCES public.agencies(id)  ON DELETE CASCADE,
  summary                text        NULL,
  intent                 text        NULL,
  entities               jsonb       NOT NULL DEFAULT '{}'::jsonb,   -- budget, zones, type, pièces, dates…
  commitments            jsonb       NOT NULL DEFAULT '[]'::jsonb,   -- engagements pris (agent/client)
  sentiment              text        NULL,                           -- positif | neutre | tendu
  next_action            jsonb       NULL,                           -- { type, label } — proposé, jamais exécuté
  model                  text        NULL,                           -- traçabilité (ex 'deepseek-chat')
  source_message_count   int         NOT NULL DEFAULT 0,
  source_last_message_at timestamptz NULL,                           -- debounce : dernier message vu
  generated_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_conversation_insights ENABLE ROW LEVEL SECURITY;

-- authenticated : voit les insights de SON agence (miroir de whatsapp_messages).
DROP POLICY IF EXISTS "wa_insights_agency_select" ON public.whatsapp_conversation_insights;
CREATE POLICY "wa_insights_agency_select"
  ON public.whatsapp_conversation_insights
  FOR SELECT TO authenticated
  USING (agency_id = public.get_my_agency_id());

-- super_admin : tout.
DROP POLICY IF EXISTS "wa_insights_super_admin_all" ON public.whatsapp_conversation_insights;
CREATE POLICY "wa_insights_super_admin_all"
  ON public.whatsapp_conversation_insights
  FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
-- Écriture : service_role uniquement (le cron whatsapp-process), bypass RLS.

-- Contacts dont l'insight est périmé : un message entrant plus récent que le dernier
-- insight (ou aucun insight). Fenêtre 7 jours = on ne (re)calcule que l'activité récente.
-- SECURITY DEFINER, service_role uniquement (aucun GRANT client).
CREATE OR REPLACE FUNCTION public.whatsapp_stale_insight_contacts(p_limit int DEFAULT 5)
RETURNS TABLE(contact_id uuid, agency_id uuid, last_message_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.contact_id, m.agency_id, max(m.created_at) AS last_message_at
  FROM public.whatsapp_messages m
  WHERE m.contact_id IS NOT NULL
    AND m.agency_id IS NOT NULL
    AND m.direction = 'inbound'
    AND m.created_at > now() - interval '7 days'
  GROUP BY m.contact_id, m.agency_id
  HAVING max(m.created_at) > COALESCE(
    (SELECT i.source_last_message_at
       FROM public.whatsapp_conversation_insights i
      WHERE i.contact_id = m.contact_id),
    'epoch'::timestamptz)
  ORDER BY max(m.created_at) DESC
  LIMIT GREATEST(p_limit, 1);
$$;

REVOKE ALL ON FUNCTION public.whatsapp_stale_insight_contacts(int) FROM public, anon, authenticated;

COMMIT;
