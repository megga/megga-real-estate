-- Audit DB du 18.07.2026 — P1 intégrité multi-tenant.
-- 9 tables portaient un agency_id SANS FK vers agencies : toute l'isolation RLS
-- repose sur cette colonne, un orphelin y serait silencieux. Vérifié en live le
-- 18.07 : zéro ligne orpheline sur les 9 tables (garde-fou rejoué ci-dessous).
-- ON DELETE : défaut (NO ACTION) pour les tables métier — on ne supprime pas une
-- agence qui a des données vivantes ; CASCADE pour les logs WhatsApp (purgés par
-- cron, aucune valeur après disparition de l'agence).
-- Déjà appliquée en live via MCP le 18.07 ; les ADD CONSTRAINT sont gardés par
-- IF NOT EXISTS car deploy.yml rejoue les fichiers datés du jour au merge.

-- Garde-fou : échoue si des orphelins existent au moment de la pose.
-- Tolérant aux tables absentes : offers et message_threads sont droppées par
-- la 20260718152000 — au REJEU sur une base déjà purgée (deploy.yml rejoue
-- les fichiers du jour), elles n'existent plus et doivent être sautées.
do $$
declare
  t text;
  n bigint;
begin
  foreach t in array array[
    'contacts','profiles','documents','offers','message_threads',
    'whatsapp_async_jobs','whatsapp_confirmation_log',
    'whatsapp_recent_auto_actions','whatsapp_tool_usage']
  loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    execute format(
      'select count(*) from public.%I x where x.agency_id is not null
         and not exists (select 1 from public.agencies a where a.id = x.agency_id)', t)
      into n;
    if n > 0 then
      raise exception 'FK agency_id impossible : % ligne(s) orpheline(s) dans %', n, t;
    end if;
  end loop;
end $$;

-- Pose des FK, idempotente (replay-safe).
do $$
declare
  spec record;
begin
  for spec in
    select * from (values
      ('contacts',                     'contacts_agency_id_fkey',                     false),
      ('profiles',                     'profiles_agency_id_fkey',                     false),
      ('documents',                    'documents_agency_id_fkey',                    false),
      ('offers',                       'offers_agency_id_fkey',                       false),
      ('message_threads',              'message_threads_agency_id_fkey',              false),
      ('whatsapp_async_jobs',          'whatsapp_async_jobs_agency_id_fkey',          true),
      ('whatsapp_confirmation_log',    'whatsapp_confirmation_log_agency_id_fkey',    true),
      ('whatsapp_recent_auto_actions', 'whatsapp_recent_auto_actions_agency_id_fkey', true),
      ('whatsapp_tool_usage',          'whatsapp_tool_usage_agency_id_fkey',          true)
    ) as v(tbl, con, cascade_delete)
  loop
    if to_regclass('public.' || spec.tbl) is null then
      continue; -- table droppée par la 152000 : rien à contraindre au rejeu
    end if;
    if not exists (
      select 1 from pg_constraint
      where conname = spec.con and conrelid = to_regclass('public.' || spec.tbl)
    ) then
      execute format(
        'alter table public.%I add constraint %I foreign key (agency_id) references public.agencies(id)%s',
        spec.tbl, spec.con, case when spec.cascade_delete then ' on delete cascade' else '' end);
    end if;
  end loop;
end $$;

-- Index agency_id des logs WhatsApp (aucun n'existait ; requis par les FK CASCADE).
create index if not exists idx_wa_async_jobs_agency on public.whatsapp_async_jobs (agency_id);
create index if not exists idx_wa_confirmation_log_agency on public.whatsapp_confirmation_log (agency_id);
create index if not exists idx_wa_recent_auto_actions_agency on public.whatsapp_recent_auto_actions (agency_id);
create index if not exists idx_wa_tool_usage_agency on public.whatsapp_tool_usage (agency_id);

-- Enums orphelins : définis mais utilisés par AUCUNE colonne (les tables visées
-- utilisent text + CHECK). DROP TYPE échouerait s'ils étaient encore référencés.
drop type if exists public.contact_score;
drop type if exists public.contact_type;
drop type if exists public.document_status;

-- Backup du sweep RealAdvisor du 09.07 (post-résurrection #821) : vérifié le
-- 18.07 — les 4 527 source_id du backup existent tous encore dans
-- market_listings ; snapshot 100 % redondant, sans PK ni policy RLS.
drop table if exists public._ra_sweep_backup_20260709;
