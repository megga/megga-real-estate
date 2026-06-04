-- File de jobs des outils KYC lents (run_kyc_screening, send_kyc_report) sortis de la
-- boucle DeepSeek. Jumeau de la file de whatsapp-process (le message est le job), mais
-- ici une table dédiée car le job n'est pas un message. claim_whatsapp_async_jobs()
-- réclame un lot atomiquement (FOR UPDATE SKIP LOCKED) pour le cron whatsapp-agent-async.
-- Additif + idempotent.

BEGIN;

CREATE TABLE IF NOT EXISTS public.whatsapp_async_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      uuid NOT NULL,
  agency_id       uuid NULL,
  wa_agent_phone  text NOT NULL,              -- numéro de l'AGENT : où livrer le résultat
  tool            text NOT NULL CHECK (tool IN ('run_kyc_screening','send_kyc_report')),
  args            jsonb NOT NULL DEFAULT '{}'::jsonb,
  contact_id      uuid NULL,
  lang            text NOT NULL DEFAULT 'fr' CHECK (lang IN ('fr','en')),
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','processing','done','failed')),
  claimed_at      timestamptz NULL,
  retry_count     smallint NOT NULL DEFAULT 0,
  last_error      text NULL,
  result_summary  text NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  -- expires_at : métadonnée pour une future purge des vieux jobs ; NON forcée par le RPC
  -- de claim aujourd'hui (le worker traite vite ; la péremption viendra avec un purge cron).
  expires_at      timestamptz NOT NULL DEFAULT now() + interval '15 minutes'
);

-- RLS : table de back-office, jamais lue côté client. service_role écrit (bypass RLS) ;
-- on active RLS sans policy SELECT (aucun accès anon/authenticated). Défense en profondeur.
ALTER TABLE public.whatsapp_async_jobs ENABLE ROW LEVEL SECURITY;

-- Dédup à l'enqueue : un seul job vivant par (profile, outil, contact). COALESCE car
-- UNIQUE(...) laisserait passer deux contact_id NULL (NULL <> NULL). Le WHERE partiel
-- permet de re-créer un job une fois l'ancien terminé (done/failed).
CREATE UNIQUE INDEX IF NOT EXISTS uq_whatsapp_async_dedup
  ON public.whatsapp_async_jobs (profile_id, tool, COALESCE(contact_id::text, '∅'))
  WHERE status IN ('pending','processing');

-- Index de réclamation (ce que le cron balaie). Le prédicat colle EXACTEMENT à la
-- condition de claim du RPC : on exclut les 'failed' épuisés (retry_count >= 3, jamais
-- ré-réclamés) pour que l'index ne se charge pas de lignes mortes au fil des échecs.
CREATE INDEX IF NOT EXISTS idx_whatsapp_async_claim
  ON public.whatsapp_async_jobs (created_at)
  WHERE status IN ('pending','processing') OR (status = 'failed' AND retry_count < 3);

-- Réclamation atomique d'un lot. SECURITY DEFINER : seul service_role l'appelle
-- (REVOKE plus bas). SKIP LOCKED => pas de double-traitement entre deux ticks cron.
-- Reprend les 'processing' bloqués > 5 min (worker tué) et retente les 'failed' < 3.
CREATE OR REPLACE FUNCTION public.claim_whatsapp_async_jobs(p_batch int DEFAULT 5)
RETURNS SETOF public.whatsapp_async_jobs
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.whatsapp_async_jobs j
  SET status = 'processing', claimed_at = now()
  WHERE j.id IN (
    SELECT id FROM public.whatsapp_async_jobs
    WHERE status = 'pending'
       OR (status = 'processing' AND claimed_at < now() - interval '5 minutes')
       OR (status = 'failed' AND retry_count < 3)
    ORDER BY created_at
    LIMIT GREATEST(p_batch, 1)
    FOR UPDATE SKIP LOCKED
  )
  RETURNING j.*;
$$;

REVOKE ALL ON FUNCTION public.claim_whatsapp_async_jobs(int) FROM public, anon, authenticated;

COMMIT;
