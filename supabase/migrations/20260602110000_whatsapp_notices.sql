-- L3 (compliance LPD) : avis de traitement envoyé une fois par numéro client +
-- purge quotidienne du payload brut (raw = PII) après rétention.

BEGIN;

-- Avis envoyés (un par numéro et par agence). Interne : RLS activée SANS policy
-- => aucun accès anon/authenticated ; seul le service_role (cron) écrit/lit.
CREATE TABLE IF NOT EXISTS public.whatsapp_notices (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id  uuid        NULL REFERENCES public.agencies(id) ON DELETE SET NULL,
  wa_phone   text        NOT NULL,
  sent_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agency_id, wa_phone)
);
ALTER TABLE public.whatsapp_notices ENABLE ROW LEVEL SECURITY;

-- Numéros clients à notifier : message entrant récent (<24h → fenêtre Meta ouverte,
-- avis envoyable en texte libre) d'une agence, sans avis déjà enregistré.
CREATE OR REPLACE FUNCTION public.whatsapp_pending_notices(p_limit int DEFAULT 10)
RETURNS TABLE(agency_id uuid, wa_phone text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT m.agency_id, m.wa_from
  FROM public.whatsapp_messages m
  WHERE m.direction = 'inbound'
    AND m.agency_id IS NOT NULL
    AND m.created_at > now() - interval '24 hours'
    AND NOT EXISTS (
      SELECT 1 FROM public.whatsapp_notices n
      WHERE n.agency_id = m.agency_id AND n.wa_phone = m.wa_from
    )
  LIMIT GREATEST(p_limit, 1);
$$;

REVOKE ALL ON FUNCTION public.whatsapp_pending_notices(int) FROM public, anon, authenticated;

-- Purge quotidienne du champ raw (PII brute, dette signalée à l'audit) après 30 j.
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    PERFORM cron.schedule(
      'whatsapp-purge-raw-daily',
      '30 3 * * *',
      $cron$ UPDATE public.whatsapp_messages SET raw = NULL
             WHERE raw IS NOT NULL AND created_at < now() - interval '30 days'; $cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron absent (local/CI) — whatsapp-purge-raw-daily non planifié';
  END IF;
END
$do$;

COMMIT;
