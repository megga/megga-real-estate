-- Rappel J-1 des appels d'accueil : le cron.
--
-- Séparé de `20260803214105_onboarding_calls.sql` à dessein : ce fichier ne décrit pas
-- un schéma mais une planification, et les deux ne se corrigent pas au même rythme.
--
-- L'edge function balaie elle-même les appels dus (12 à 36 h, `reminder_sent_at` nul),
-- donc le cron n'a qu'un seul appel à passer, sans corps. Le patron opposé, une requête
-- SQL qui fait un `net.http_post` PAR LIGNE (ce que fait `visit-reminders-j1`), envoie
-- autant de requêtes que de rendez-vous et perd silencieusement celles que pg_net
-- n'arrive pas à émettre.
--
-- 07:00 UTC : le rappel arrive le matin en Suisse, la veille du rendez-vous. Un tick
-- quotidien suffit puisque la fenêtre balayée fait 24 h de large.
--
-- ⚠ Identifier un job par son `jobname`, jamais par son `jobid` : il change à chaque
-- recréation.

do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron absent (base locale) : planification ignoree';
    return;
  end if;

  -- Rejouable : on retire l'éventuel job existant avant de le reposer.
  if exists (select 1 from cron.job where jobname = 'onboarding-call-reminders') then
    perform cron.unschedule('onboarding-call-reminders');
  end if;

  perform cron.schedule(
    'onboarding-call-reminders',
    '0 7 * * *',
    $cmd$
    select net.http_post(
      url := 'https://eayczugyrvmtqnnmvjod.supabase.co/functions/v1/onboarding-call-reminder',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || public.get_app_config('service_role_key')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
    $cmd$
  );
end $$;
