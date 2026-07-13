-- =====================================================================
-- P5 fiabilisation admin — get_admin_monitoring_health v2
--
-- 1) Le retour gagne db_limit_mb / storage_limit_mb, lus depuis
--    app_config.admin_platform_limits (JSON texte) : les plafonds ne sont
--    plus codés en dur dans useAdminMonitoring (8000/100000). app_config
--    n'étant pas lisible client (grants verrouillés 20260705190000), ils
--    transitent par la RPC.
-- 2) Hardening : la v1 (baseline / 20260518_004) n'avait AUCUN guard
--    interne alors que l'EXECUTE est accordé à authenticated — n'importe
--    quel agent connecté pouvait lire les métriques plateforme. La v2
--    adopte le pattern P3 (20260705172000) : is_super_admin() OR
--    is_service_role(), ERRCODE 42501.
--
-- DROP obligatoire : le type de retour change (RETURNS TABLE).
-- =====================================================================

insert into public.app_config (key, value)
values ('admin_platform_limits', '{"db_limit_mb": 8000, "storage_limit_mb": 100000}')
on conflict (key) do nothing;

drop function if exists public.get_admin_monitoring_health();

create function public.get_admin_monitoring_health()
returns table (
  errors_last_24h bigint,
  emails_sent_today bigint,
  api_requests_today bigint,
  last_scraping_at timestamptz,
  db_size_mb numeric,
  storage_used_mb numeric,
  db_limit_mb numeric,
  storage_limit_mb numeric
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_limits jsonb;
begin
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;

  select nullif(value, '')::jsonb into v_limits
  from public.app_config where key = 'admin_platform_limits';

  return query
  select
    (select count(*) from activity_events
      where action = 'edge_function_error'
        and created_at >= now() - interval '24 hours'),
    (select count(*) from activity_events
      where action = 'email_sent'
        and created_at >= date_trunc('day', now())),
    (select count(*) from activity_events
      where created_at >= date_trunc('day', now())),
    (select max(created_at) from activity_events where action = 'scraping_completed'),
    coalesce((select metric_value from platform_metrics
      where metric_type = 'db_size_mb'
      order by recorded_at desc limit 1), 0),
    coalesce((select metric_value from platform_metrics
      where metric_type = 'storage_used_mb'
      order by recorded_at desc limit 1), 0),
    coalesce((v_limits->>'db_limit_mb')::numeric, 8000),
    coalesce((v_limits->>'storage_limit_mb')::numeric, 100000);
end;
$$;

comment on function public.get_admin_monitoring_health() is
  'Santé plateforme pour AdminMonitoringPage. v2 : + limites DB/storage depuis app_config.admin_platform_limits, guard super_admin/service_role (la v1 était lisible par tout authenticated). Voir 20260712120000.';

revoke all on function public.get_admin_monitoring_health() from public, anon;
grant execute on function public.get_admin_monitoring_health() to authenticated, service_role;
