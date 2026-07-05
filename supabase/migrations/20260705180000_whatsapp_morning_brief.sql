-- Morning brief WhatsApp proactif (07h30 Europe/Zurich) — cf. edge function
-- whatsapp-morning-brief. Inverse le pull (outil get_daily_brief) en push quotidien :
-- visites du jour + relances dues + offres qui expirent + nouveaux leads vendeurs.
--
-- Trois schedules UTC : 05:30 + 06:30 encadrent le DST (07h30 CH été/hiver), 07:30
-- est le tick FILET (audit : un tick primaire manqué — restart DB, backlog pg_net —
-- ne doit pas coûter la journée). La fonction ne traite que si l'heure LOCALE Zurich
-- est 07h (primaire) ou 08h (filet) et déduplique par (profile_id, date locale) via
-- la table ci-dessous → les ticks redondants sont des no-ops toute l'année ; pire
-- cas un brief vers 08h30, jamais de doublon.
--
-- Opt-in : flag app_config.whatsapp_morning_brief_enabled seedé à 'false'
-- (fail-closed côté fonction). Activer = UPDATE à 'true', 0 redéploiement.

BEGIN;

-- Dédup + trace d'envoi : une ligne par agent et par jour local. sent_at = heure du
-- claim ; confirmed_at = envoi accepté par Meta (NULL + sent_at vieux de >10 min =
-- claim orphelin, re-claimable par le tick filet — worker tué entre claim et envoi).
-- Service-role only (RLS activée sans policy), pattern whatsapp_cron_locks.
CREATE TABLE IF NOT EXISTS public.whatsapp_daily_briefs (
  profile_id   uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  brief_date   date        NOT NULL,
  sent_at      timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz NULL,
  PRIMARY KEY (profile_id, brief_date)
);

ALTER TABLE public.whatsapp_daily_briefs ENABLE ROW LEVEL SECURITY;

-- Opt-out PAR AGENT (audit LPD proportionnalité : l'appairage a été consenti pour un
-- copilote réactif ; le push quotidien doit être débrayable sans désappairer). Défaut
-- ON ; la policy RLS "self" existante (FOR ALL) permet déjà à l'agent de l'éteindre.
ALTER TABLE public.whatsapp_agent_links
  ADD COLUMN IF NOT EXISTS morning_brief_enabled boolean NOT NULL DEFAULT true;

INSERT INTO public.app_config (key, value)
VALUES ('whatsapp_morning_brief_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    -- 05:30 UTC = 07:30 Zurich en été (le gate applicatif ignore ce tick en hiver).
    PERFORM cron.schedule(
      'whatsapp-morning-brief-0530utc',
      '30 5 * * *',
      $cron$
      SELECT net.http_post(
        url := public.get_app_config('supabase_url') || '/functions/v1/whatsapp-morning-brief',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || public.get_app_config('service_role_key')
        ),
        body := '{}'::jsonb
      );
      $cron$
    );
    -- 06:30 UTC = 07:30 Zurich en hiver (été : 08:30 local = tick filet, dédup no-op).
    PERFORM cron.schedule(
      'whatsapp-morning-brief-0630utc',
      '30 6 * * *',
      $cron$
      SELECT net.http_post(
        url := public.get_app_config('supabase_url') || '/functions/v1/whatsapp-morning-brief',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || public.get_app_config('service_role_key')
        ),
        body := '{}'::jsonb
      );
      $cron$
    );
    -- 07:30 UTC = tick filet d'hiver (08:30 local ; été : 09:30 local, gated).
    PERFORM cron.schedule(
      'whatsapp-morning-brief-0730utc',
      '30 7 * * *',
      $cron$
      SELECT net.http_post(
        url := public.get_app_config('supabase_url') || '/functions/v1/whatsapp-morning-brief',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || public.get_app_config('service_role_key')
        ),
        body := '{}'::jsonb
      );
      $cron$
    );
    -- Rétention : la table de dédup n'a de valeur que récente (1 ligne/agent/jour).
    PERFORM cron.schedule(
      'whatsapp-daily-briefs-purge',
      '15 3 * * *',
      $cron$
      DELETE FROM public.whatsapp_daily_briefs WHERE brief_date < current_date - 90;
      $cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron absent (local/CI) — whatsapp-morning-brief non planifié';
  END IF;
END
$do$;

COMMIT;
