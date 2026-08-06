-- RGPD, tâches 2 et 3 : la purge des pièces d'identité KYB entre en service.
--
-- Tâche 1 (`20260806184824`) a rendu le fichier TROUVABLE — `kyb_identity_files()` dit
-- quelles pièces existent, à qui, et lesquelles sont exigibles. Elle ne supprimait rien.
-- Ce job ferme la boucle.
--
-- UN SEUL BALAYAGE POUR DEUX MOTIFS. Le plan séparait « purge au verdict » (tâche 2) et
-- « filet d'échéance » (tâche 3). À l'écriture, la séparation s'est révélée artificielle :
-- `kyb_identity_files()` calcule DÉJÀ `purge_reason` ('verdict' ou 'expiry') à la lecture.
-- Deux jobs auraient lu la même vue pour appliquer le même geste, avec deux planifications
-- à garder d'accord. Un seul passage traite les deux, et le motif reste distingué dans le
-- journal.
--
-- POURQUOI PAS UN APPEL DEPUIS `admin_resolve_agency_id_document`. Le verdict est posé par
-- une fonction SQL, qui ne peut pas appeler l'API Storage — et supprimer la ligne
-- `storage.objects` en SQL laisserait l'objet S3 orphelin (injoignable, mais conservé),
-- ce qui ne vaut pas effacement pour un scan de passeport. Le détail est en tête de
-- `supabase/functions/kyb-identity-purge/index.ts`.
--
-- ⚠ Le job est identifié par son JOBNAME, jamais par son jobid : celui-ci change à chaque
-- recréation (§7 de CLAUDE.md).
--
-- 05:20 UTC : créneau libre entre `realadvisor-fresh-daily` (03:30) et `flatfox-sync-daily`
-- (04:00) d'un côté, `onboarding-call-reminders` (07:00) de l'autre.
--
-- Idempotente : `unschedule` avant `schedule`, et sans échec si pg_cron est absent (base
-- locale de test).

do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron absent (base locale) : planification ignoree';
    return;
  end if;

  if exists (select 1 from cron.job where jobname = 'kyb-identity-purge-daily') then
    perform cron.unschedule('kyb-identity-purge-daily');
  end if;

  perform cron.schedule(
    'kyb-identity-purge-daily',
    '20 5 * * *',
    $cmd$
    select net.http_post(
      url := 'https://eayczugyrvmtqnnmvjod.supabase.co/functions/v1/kyb-identity-purge',
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
