-- L1 : capture média + transcription. Le message porte son propre état de
-- traitement ("le message est le job"). claim_whatsapp_jobs() réclame un lot de
-- façon atomique (FOR UPDATE SKIP LOCKED) pour le cron whatsapp-process.

BEGIN;

ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS processing_status     text NOT NULL DEFAULT 'done'
    CHECK (processing_status IN ('pending','processing','done','failed','skipped')),
  ADD COLUMN IF NOT EXISTS claimed_at            timestamptz NULL,
  ADD COLUMN IF NOT EXISTS retry_count           smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error            text NULL,
  ADD COLUMN IF NOT EXISTS media_r2_key          text NULL,
  ADD COLUMN IF NOT EXISTS media_id              text NULL,  -- jeton Meta (~30 j) relu par le cron
  ADD COLUMN IF NOT EXISTS media_mime            text NULL,
  ADD COLUMN IF NOT EXISTS transcript            text NULL,
  ADD COLUMN IF NOT EXISTS transcript_lang       text NULL,
  ADD COLUMN IF NOT EXISTS transcript_confidence real NULL;

-- File de travail : index partiel sur ce que le cron réclame.
CREATE INDEX IF NOT EXISTS idx_wa_messages_pending
  ON public.whatsapp_messages (created_at)
  WHERE processing_status IN ('pending','processing','failed');

-- Réclamation atomique d'un lot. SECURITY DEFINER : seul le service_role
-- l'appelle (aucun GRANT client). SKIP LOCKED => pas de double-traitement.
CREATE OR REPLACE FUNCTION public.claim_whatsapp_jobs(p_batch int DEFAULT 25)
RETURNS SETOF public.whatsapp_messages
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.whatsapp_messages m
  SET processing_status = 'processing', claimed_at = now()
  WHERE m.id IN (
    SELECT id FROM public.whatsapp_messages
    WHERE processing_status = 'pending'
       OR (processing_status = 'processing' AND claimed_at < now() - interval '5 minutes')
       OR (processing_status = 'failed' AND retry_count < 3)
    ORDER BY created_at
    LIMIT GREATEST(p_batch, 1)
    FOR UPDATE SKIP LOCKED
  )
  RETURNING m.*;
$$;

REVOKE ALL ON FUNCTION public.claim_whatsapp_jobs(int) FROM public, anon, authenticated;

COMMIT;
