-- =====================================================================
-- Rétention activity_events — politique HYBRIDE documentée (nLPD × LBA)
--
-- Constat : activity_events est append-only sans politique de rétention →
-- croissance non bornée, et sur-rétention de télémétrie comportementale sans
-- valeur LBA (contraire au principe de minimisation nLPD).
--
-- Politique retenue :
--   * CONSERVÉ 10 ans (LBA art. 7 + forensique sécurité) : catégories 'kyc',
--     'deal', 'auth' (toutes sévérités) + TOUT événement warn/critical quelle
--     que soit la catégorie.
--   * PURGÉ après 3 ans : les événements 'info' des catégories 'ai',
--     'settings', 'contact', 'bien', 'doc' (télémétrie produit, aucune
--     obligation de conservation).
--
-- Mécanique :
--   * L'immuabilité d'activity_events vient de l'ABSENCE de policies
--     UPDATE/DELETE (pas de trigger, pas de FORCE ROW LEVEL SECURITY —
--     vérifié) → le cron, qui tourne en postgres (owner), peut DELETE ;
--     les rôles applicatifs, jamais.
--   * Chaque purge se journalise elle-même (action 'retention_purge',
--     actor_kind 'system') — la politique laisse une trace auditable.
--   * Cron mensuel : 1er du mois à 03:15 UTC.
-- =====================================================================

create or replace function public.purge_activity_events_retention()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_deleted integer;
begin
  -- super-admin (exécution manuelle depuis la page admin), service key
  -- (edge/cron HTTP), ou rôle DB du job pg_cron (postgres/supabase_admin).
  if not (
    public.is_super_admin()
    or public.is_service_role()
    or current_user in ('postgres', 'supabase_admin')
  ) then
    raise exception 'forbidden: super_admin or service only' using errcode = '42501';
  end if;

  delete from public.activity_events
  where severity = 'info'
    and category in ('ai', 'settings', 'contact', 'bien', 'doc')
    and created_at < now() - interval '3 years';

  get diagnostics v_deleted = row_count;

  -- La purge se journalise (trace auditable de l'application de la politique).
  if v_deleted > 0 then
    insert into public.activity_events
      (agency_id, actor_id, actor_kind, action, entity_type, entity_id,
       category, severity, object_label, metadata)
    values (
      null, null, 'system', 'retention_purge', 'activity_events', null,
      'settings', 'info', 'Purge rétention nLPD',
      jsonb_build_object('deleted_count', v_deleted, 'policy', 'info>3y hors kyc/deal/auth')
    );
  end if;

  return v_deleted;
end;
$$;
comment on function public.purge_activity_events_retention() is
  'Purge de rétention activity_events (politique hybride LBA 10 ans / nLPD 3 ans pour la télémétrie info). Auto-journalisée. Voir 20260705171000.';

revoke all on function public.purge_activity_events_retention() from public, anon;
grant execute on function public.purge_activity_events_retention() to authenticated;

-- Cron mensuel (1er du mois, 03:15 UTC). cron.schedule(name, …) = upsert.
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    PERFORM cron.schedule(
      'activity-events-retention',
      '15 3 1 * *',
      $cron$ SELECT public.purge_activity_events_retention(); $cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron absent (local/CI) — activity-events-retention non planifié';
  END IF;
END
$do$;
