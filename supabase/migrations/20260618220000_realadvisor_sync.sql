-- realadvisor-sync : surface d'ingestion RealAdvisor INDÉPENDANTE.
--
-- 1) Table de tracking des runs, calquée sur flatfox_sync_runs (verrou singleton
--    anti fan-out, observabilité). Séparée de flatfox_sync_runs pour que les deux
--    syncs soient totalement indépendants.
-- 2) Colonne source_payload sur market_listings : conserve le hit brut RealAdvisor
--    dans sa TOTALITÉ — y compris les champs sans colonne typée (sub_locality,
--    agency_rating, agency_portal_id, clickout_url, blurhash photos, etc.).

create table if not exists public.realadvisor_sync_runs (
  id               uuid primary key default gen_random_uuid(),
  started_at       timestamptz not null default now(),
  ended_at         timestamptz,
  status           text not null default 'running',
  offer_type       text,
  total_expected   integer,
  total_seen       integer default 0,
  total_upserted   integer default 0,
  total_inserted   integer default 0,
  total_updated    integer default 0,
  total_errors     integer default 0,
  total_removed    integer default 0,
  chunks_completed integer default 0,
  pages_fetched    integer default 0,
  last_chunk_at    timestamptz,
  error_message    text,
  trigger_source   text default 'cron'
);

-- Au plus un run 'running' à la fois — l'INSERT concurrent échoue en 23505,
-- ce qui sérialise les déclenchements (cron qui se superpose, double-fire).
create unique index if not exists realadvisor_sync_runs_one_running
  on public.realadvisor_sync_runs ((true)) where (status = 'running');

create index if not exists idx_realadvisor_sync_runs_started_at
  on public.realadvisor_sync_runs (started_at desc);

create index if not exists idx_realadvisor_sync_runs_running
  on public.realadvisor_sync_runs (started_at desc) where (status = 'running');

-- RLS activé sans policy : accès réservé au service_role (l'edge function).
alter table public.realadvisor_sync_runs enable row level security;

-- Totalité du listing : rien n'est perdu, même les champs non typés.
alter table public.market_listings add column if not exists source_payload jsonb;
