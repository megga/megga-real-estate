-- Transport FTP (push) pour la syndication IDX — bâti AVANT d'avoir les accès FTP
-- d'immobilier.ch. À l'arrivée des accès, il ne manquera que : (1) le secret Edge
-- IDX_FTP_PASSWORD, (2) remplir les coordonnées FTP de l'agence dans cette table.
--
-- Modèle : on génère le feed IDX de l'agence (CSV) et on le DÉPOSE sur le FTP du
-- portail (push), à intervalle régulier (pg_cron → edge idx-syndicate).

alter table public.agency_syndication_config
  add column if not exists transport text not null default 'ftp'
    check (transport in ('pull', 'ftp')),
  add column if not exists ftp_host text,
  add column if not exists ftp_port integer not null default 21,
  add column if not exists ftp_secure boolean not null default false, -- true = FTPS explicite (AUTH TLS)
  add column if not exists ftp_username text,
  add column if not exists ftp_remote_dir text not null default '/',
  add column if not exists ftp_remote_filename text not null default 'megga.idx';

comment on column public.agency_syndication_config.transport is
  'Canal de livraison du feed IDX : ''ftp'' (push, immobilier.ch) ou ''pull'' (le portail va chercher idx-feed).';
comment on column public.agency_syndication_config.ftp_host is
  'Hôte FTP du portail. Le mot de passe N''est JAMAIS stocké ici : secret Edge IDX_FTP_PASSWORD (pilote mono-agence).';

-- Cron quotidien : pousse le feed IDX des agences configurées (transport=ftp +
-- ftp_host non nul + idx_enabled) vers leur FTP. Guardé par la présence de pg_cron
-- (sauté en local/CI). Tant qu'aucune agence n'a de ftp_host, idx-syndicate no-op.
do $do$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.schedule(
      'idx-syndicate-daily',
      '30 5 * * *',
      $cron$
      select net.http_post(
        url := public.get_app_config('supabase_url') || '/functions/v1/idx-syndicate',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || public.get_app_config('service_role_key')
        ),
        body := '{}'::jsonb
      );
      $cron$
    );
  else
    raise notice 'pg_cron absent (local/CI) — idx-syndicate-daily non planifié';
  end if;
end
$do$;
