-- =====================================================================
-- Admin ops — RPC de santé pour les surfaces sans miroir admin (P3)
--
-- Constat (gap analysis pré-lancement) : trois features récentes n'ont
-- AUCUNE visibilité admin — syndication IDX (property_syndications),
-- ops WhatsApp (échecs de livraison, webhook, cron locks, inbound non
-- mappés) et coûts IA par agence (ai_usage_logs n'a ni agency_id ni module).
--
-- 3 RPC sur le modèle get_cron_health : STABLE SECURITY DEFINER, garde
-- is_super_admin() OR is_service_role() (l'alerting cron d'admin-monitoring
-- les lit avec la service key), agrégation CÔTÉ SERVEUR (règles perf §7 :
-- pas de count exact côté client, une seule passe par table).
--
-- ai_usage_logs : + agency_id (FK SET NULL) + module, renseignés par
-- _shared/ai-provider.ts (logUsage) — l'historique reste NULL et s'affiche
-- « Plateforme » ; les coûts par agence ne sont exacts qu'à partir du déploiement.
-- =====================================================================

-- ── ai_usage_logs : colonnes d'attribution ───────────────────────────────────
alter table public.ai_usage_logs
  add column if not exists agency_id uuid references public.agencies (id) on delete set null,
  add column if not exists module text;

comment on column public.ai_usage_logs.agency_id is
  'Agence à l''origine de l''appel IA (NULL = plateforme / historique pré-20260705172000).';
comment on column public.ai_usage_logs.module is
  'Module fonctionnel (copilot, whatsapp-agent, extract-lead…) — plus fin que edge_function.';

-- ── Index partiels (filtres fréquents des RPC santé) ─────────────────────────
create index if not exists idx_wa_messages_failed_created
  on public.whatsapp_messages (created_at desc)
  where status = 'failed';

create index if not exists idx_wa_messages_unmapped_inbound
  on public.whatsapp_messages (created_at desc)
  where direction = 'inbound' and agency_id is null;

create index if not exists idx_ai_usage_logs_agency_created
  on public.ai_usage_logs (agency_id, created_at desc)
  where agency_id is not null;

-- ── Santé syndication IDX ─────────────────────────────────────────────────────
create or replace function public.get_admin_syndication_health()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_result jsonb;
begin
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'by_status', coalesce((
      select jsonb_agg(jsonb_build_object('portal', s.portal, 'status', s.status, 'count', s.cnt)
                       order by s.portal, s.status)
      from (
        select portal, status, count(*)::int as cnt
        from property_syndications
        group by portal, status
      ) s
    ), '[]'::jsonb),
    'recent_errors', coalesce((
      select jsonb_agg(jsonb_build_object(
        'property_id', e.property_id,
        'agency_name', e.agency_name,
        'error', e.error,
        'updated_at', e.updated_at
      ) order by e.updated_at desc)
      from (
        select ps.property_id, a.name as agency_name, ps.error, ps.updated_at
        from property_syndications ps
        left join agencies a on a.id = ps.agency_id
        where ps.status = 'error'
        order by ps.updated_at desc
        limit 5
      ) e
    ), '[]'::jsonb),
    'agencies', coalesce((
      select jsonb_agg(jsonb_build_object(
        'agency_name', a.name,
        'idx_enabled', c.idx_enabled,
        'transport', c.transport,
        'ftp_configured', (c.ftp_host is not null and c.ftp_username is not null)
      ) order by a.name)
      from agency_syndication_config c
      join agencies a on a.id = c.agency_id
    ), '[]'::jsonb),
    'last_push_at', (select max(last_pushed_at) from property_syndications)
  ) into v_result;

  return v_result;
end;
$$;
comment on function public.get_admin_syndication_health() is
  'Santé de la syndication IDX (statuts par portail, dernières erreurs, config par agence, dernier push) pour AdminMonitoringPage. Garde super_admin/service (42501).';

revoke all on function public.get_admin_syndication_health() from public, anon;
grant execute on function public.get_admin_syndication_health() to authenticated;

-- ── Santé WhatsApp ops ────────────────────────────────────────────────────────
create or replace function public.get_admin_whatsapp_health()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_result jsonb;
begin
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;

  -- Une seule passe 7 jours (FILTER) — pas de N counts séparés.
  select jsonb_build_object(
    'sent_24h',   count(*) filter (where direction = 'outbound' and created_at > now() - interval '24 hours'),
    'failed_24h', count(*) filter (where status = 'failed' and created_at > now() - interval '24 hours'),
    'sent_7d',    count(*) filter (where direction = 'outbound'),
    'failed_7d',  count(*) filter (where status = 'failed'),
    'last_inbound_at', max(created_at) filter (where direction = 'inbound'),
    'last_status_update_at', max(status_updated_at)
  ) into v_result
  from whatsapp_messages
  where created_at > now() - interval '7 days';

  v_result := v_result || jsonb_build_object(
    'top_errors', coalesce((
      select jsonb_agg(jsonb_build_object('error', t.delivery_error, 'count', t.cnt) order by t.cnt desc)
      from (
        select delivery_error, count(*)::int as cnt
        from whatsapp_messages
        where status = 'failed'
          and delivery_error is not null
          and created_at > now() - interval '7 days'
        group by delivery_error
        order by cnt desc
        limit 5
      ) t
    ), '[]'::jsonb),
    'unmapped_inbound_7d', (
      select count(*)::int from whatsapp_messages
      where direction = 'inbound' and agency_id is null
        and created_at > now() - interval '7 days'
    ),
    'cron_locks', coalesce((
      select jsonb_agg(jsonb_build_object('job', job, 'locked_until', locked_until) order by job)
      from whatsapp_cron_locks
    ), '[]'::jsonb)
  );

  return v_result;
end;
$$;
comment on function public.get_admin_whatsapp_health() is
  'Ops WhatsApp (envois/échecs 24h+7j, top delivery_error, récence webhook, inbound non mappés, cron locks) pour AdminMonitoringPage. Garde super_admin/service (42501).';

revoke all on function public.get_admin_whatsapp_health() from public, anon;
grant execute on function public.get_admin_whatsapp_health() to authenticated;

-- ── Coûts IA par mois × agence × provider × module ───────────────────────────
create or replace function public.get_admin_ai_costs(p_months integer default 6)
returns table (
  month date,
  agency_id uuid,
  agency_name text,
  provider text,
  module text,
  calls bigint,
  tokens_in bigint,
  tokens_out bigint,
  cost_usd numeric
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;

  return query
    select
      date_trunc('month', l.created_at)::date as month,
      l.agency_id,
      coalesce(a.name, 'Plateforme') as agency_name,
      l.provider,
      coalesce(l.module, l.edge_function) as module,
      count(*)::bigint as calls,
      coalesce(sum(l.input_tokens), 0)::bigint as tokens_in,
      coalesce(sum(l.output_tokens), 0)::bigint as tokens_out,
      round(coalesce(sum(l.estimated_cost_usd), 0)::numeric, 4) as cost_usd
    from ai_usage_logs l
    left join agencies a on a.id = l.agency_id
    where l.created_at >= date_trunc('month', now()) - make_interval(months => greatest(p_months, 1) - 1)
    group by 1, 2, 3, 4, 5
    order by 1 desc, 9 desc;
end;
$$;
comment on function public.get_admin_ai_costs(integer) is
  'Agrégation serveur des coûts IA (mois × agence × provider × module) pour AdminToolUsagePage. Historique sans agency_id = « Plateforme ». Garde super_admin/service (42501).';

revoke all on function public.get_admin_ai_costs(integer) from public, anon;
grant execute on function public.get_admin_ai_costs(integer) to authenticated;
