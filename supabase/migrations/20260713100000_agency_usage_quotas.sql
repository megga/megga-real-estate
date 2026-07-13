-- =====================================================================
-- P6a — Pilotage clients 360° : usage consolidé + quotas par agence
--
-- Donne au super-admin (1) une vue d'usage par agence agrégée côté serveur
-- (biens + contacts + coût/appels IA + WhatsApp + storage estimé + portails)
-- et (2) des plafonds configurables avec alerte à l'approche. AUCUN blocage
-- automatique — les quotas alimentent l'alerting (_shared/admin-alerts.ts),
-- la décision reste humaine (human-in-the-loop).
--
-- Modèle : 1 table + 4 RPC sur le patron P3 (20260705172000) — STABLE/VOLATILE
-- SECURITY DEFINER, garde is_super_admin() OR is_service_role() (42501, le
-- sweep quotas du cron admin-monitoring les lit avec la service key),
-- agrégation CÔTÉ SERVEUR (règles perf §7 : pas de count exact client).
--
-- Index déjà présents et réutilisés : idx_ai_usage_logs_agency_created
-- (20260705172000), idx_whatsapp_messages_agency_created (20260528150000) —
-- aucun nouvel index requis (properties/contacts/activity_events portent déjà
-- agency_id indexé).
--
-- Storage = ESTIMATION applicative (documents + kyc_magic_link_uploads, tous
-- deux avec size_bytes + agency_id). Les photos de biens vivent sur R2 sans
-- colonne de taille attribuable par agence → hors périmètre v1, libellé
-- « estimation » dans l'UI.
-- =====================================================================

-- ── Table des quotas (1 ligne par agence, caps nullables = illimité) ─────────
create table if not exists public.agency_usage_quotas (
  agency_id uuid primary key references public.agencies (id) on delete cascade,
  ai_monthly_cost_cap_usd numeric(10,2),
  active_properties_cap integer,
  whatsapp_monthly_cap integer,
  storage_cap_mb integer,
  alert_threshold_pct integer not null default 80 check (alert_threshold_pct between 50 and 100),
  note text,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

comment on table public.agency_usage_quotas is
  'Plafonds d''usage configurables par agence (P6a). Caps NULL = illimité. Alerte à alert_threshold_pct % (jamais de blocage auto). Silo super-admin.';

alter table public.agency_usage_quotas enable row level security;

drop policy if exists "agency_usage_quotas_super_admin_all" on public.agency_usage_quotas;
create policy "agency_usage_quotas_super_admin_all" on public.agency_usage_quotas
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ── Upsert des quotas (audité quota_changed) ─────────────────────────────────
create or replace function public.admin_set_agency_quotas(
  p_agency_id uuid,
  p_quotas jsonb,
  p_note text default null
)
returns void
language plpgsql
volatile
security definer
set search_path to 'public'
as $$
declare
  v_old jsonb;
  v_threshold integer;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden: super_admin required' using errcode = '42501';
  end if;

  if not exists (select 1 from public.agencies where id = p_agency_id) then
    raise exception 'agency not found';
  end if;

  -- Seuil : 80 par défaut, borné 50-100 (le CHECK protège aussi, mais on
  -- veut un message clair plutôt qu'une violation de contrainte).
  v_threshold := coalesce((p_quotas->>'alert_threshold_pct')::integer, 80);
  if v_threshold < 50 or v_threshold > 100 then
    raise exception 'alert_threshold_pct must be between 50 and 100';
  end if;

  select to_jsonb(q) - 'updated_at' - 'updated_by'
    into v_old
  from public.agency_usage_quotas q
  where q.agency_id = p_agency_id;

  insert into public.agency_usage_quotas (
    agency_id, ai_monthly_cost_cap_usd, active_properties_cap,
    whatsapp_monthly_cap, storage_cap_mb, alert_threshold_pct, note,
    updated_by, updated_at
  )
  values (
    p_agency_id,
    nullif(p_quotas->>'ai_monthly_cost_cap_usd', '')::numeric,
    nullif(p_quotas->>'active_properties_cap', '')::integer,
    nullif(p_quotas->>'whatsapp_monthly_cap', '')::integer,
    nullif(p_quotas->>'storage_cap_mb', '')::integer,
    v_threshold,
    nullif(p_note, ''),
    auth.uid(),
    now()
  )
  on conflict (agency_id) do update
    set ai_monthly_cost_cap_usd = excluded.ai_monthly_cost_cap_usd,
        active_properties_cap   = excluded.active_properties_cap,
        whatsapp_monthly_cap    = excluded.whatsapp_monthly_cap,
        storage_cap_mb          = excluded.storage_cap_mb,
        alert_threshold_pct     = excluded.alert_threshold_pct,
        note                    = excluded.note,
        updated_by              = excluded.updated_by,
        updated_at              = now();

  insert into activity_events
    (agency_id, actor_id, actor_kind, action, entity_type, entity_id,
     category, severity, object_label, metadata)
  values (
    p_agency_id, auth.uid(), 'user', 'quota_changed', 'agency', p_agency_id,
    'settings', 'info', 'usage_quotas',
    jsonb_build_object('old', v_old, 'new', p_quotas, 'note', p_note)
  );
end;
$$;

comment on function public.admin_set_agency_quotas(uuid, jsonb, text) is
  'Upsert des quotas d''usage d''une agence (super-admin, audité quota_changed). p_quotas : ai_monthly_cost_cap_usd, active_properties_cap, whatsapp_monthly_cap, storage_cap_mb, alert_threshold_pct. Voir 20260713100000.';

-- ── Usage d'une agence (mois courant) ────────────────────────────────────────
create or replace function public.get_admin_agency_usage(p_agency_id uuid)
returns table (
  active_properties bigint,
  contacts_count bigint,
  ai_cost_month_usd numeric,
  ai_calls_month bigint,
  wa_messages_month bigint,
  storage_est_mb numeric,
  portals_active bigint,
  last_activity_at timestamptz
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_month_start timestamptz := date_trunc('month', now());
begin
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;

  return query
  select
    (select count(*) from properties p
       where p.agency_id = p_agency_id and p.status = 'active'),
    (select count(*) from contacts c where c.agency_id = p_agency_id),
    (select round(coalesce(sum(l.estimated_cost_usd), 0)::numeric, 4)
       from ai_usage_logs l
       where l.agency_id = p_agency_id and l.created_at >= v_month_start),
    (select count(*) from ai_usage_logs l
       where l.agency_id = p_agency_id and l.created_at >= v_month_start),
    (select count(*) from whatsapp_messages m
       where m.agency_id = p_agency_id and m.created_at >= v_month_start),
    (select round((
        coalesce((select sum(size_bytes) from documents d where d.agency_id = p_agency_id), 0)
      + coalesce((select sum(size_bytes) from kyc_magic_link_uploads u where u.agency_id = p_agency_id), 0)
     )::numeric / (1024 * 1024), 2)),
    (select count(*) from seller_portals s
       where s.agency_id = p_agency_id and s.status = 'active'),
    (select max(e.created_at) from activity_events e where e.agency_id = p_agency_id);
end;
$$;

comment on function public.get_admin_agency_usage(uuid) is
  'Usage consolidé d''une agence sur le mois courant (biens actifs, contacts, coût/appels IA, WhatsApp, storage estimé, portails actifs, dernière activité). Super-admin. Voir 20260713100000.';

-- ── Vue comparative : 1 ligne par agence + caps ─────────────────────────────
create or replace function public.get_admin_usage_overview()
returns table (
  agency_id uuid,
  agency_name text,
  plan text,
  status text,
  active_properties bigint,
  contacts_count bigint,
  ai_cost_month_usd numeric,
  wa_messages_month bigint,
  storage_est_mb numeric,
  portals_active bigint,
  last_activity_at timestamptz,
  caps jsonb
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_month_start timestamptz := date_trunc('month', now());
begin
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;

  return query
  select
    a.id,
    a.name,
    a.plan::text,
    coalesce(a.status, 'active'),
    (select count(*) from properties p where p.agency_id = a.id and p.status = 'active'),
    (select count(*) from contacts c where c.agency_id = a.id),
    (select round(coalesce(sum(l.estimated_cost_usd), 0)::numeric, 2)
       from ai_usage_logs l where l.agency_id = a.id and l.created_at >= v_month_start),
    (select count(*) from whatsapp_messages m where m.agency_id = a.id and m.created_at >= v_month_start),
    (select round((
        coalesce((select sum(size_bytes) from documents d where d.agency_id = a.id), 0)
      + coalesce((select sum(size_bytes) from kyc_magic_link_uploads u where u.agency_id = a.id), 0)
     )::numeric / (1024 * 1024), 2)),
    (select count(*) from seller_portals s where s.agency_id = a.id and s.status = 'active'),
    (select max(e.created_at) from activity_events e where e.agency_id = a.id),
    coalesce(
      (select to_jsonb(q) - 'agency_id' - 'updated_by' - 'updated_at'
         from agency_usage_quotas q where q.agency_id = a.id),
      '{}'::jsonb)
  from agencies a
  order by 7 desc; -- coût IA du mois décroissant
end;
$$;

comment on function public.get_admin_usage_overview() is
  'Vue comparative usage par agence (1 ligne/agence + caps configurés). Super-admin. Tri coût IA décroissant. Voir 20260713100000.';

-- ── Dépassements de quotas (alimente l'alerting cron, pas de blocage) ────────
create or replace function public.get_admin_quota_breaches()
returns table (
  agency_id uuid,
  agency_name text,
  metric text,
  usage numeric,
  cap numeric,
  threshold_pct integer
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_month_start timestamptz := date_trunc('month', now());
begin
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;

  return query
  with usage as (
    select
      q.agency_id,
      a.name as agency_name,
      q.alert_threshold_pct,
      q.ai_monthly_cost_cap_usd,
      q.active_properties_cap,
      q.whatsapp_monthly_cap,
      q.storage_cap_mb,
      (select coalesce(sum(l.estimated_cost_usd), 0)::numeric
         from ai_usage_logs l where l.agency_id = q.agency_id and l.created_at >= v_month_start) as ai_cost,
      (select count(*)::numeric from properties p where p.agency_id = q.agency_id and p.status = 'active') as props,
      (select count(*)::numeric from whatsapp_messages m where m.agency_id = q.agency_id and m.created_at >= v_month_start) as wa,
      (select round((
          coalesce((select sum(size_bytes) from documents d where d.agency_id = q.agency_id), 0)
        + coalesce((select sum(size_bytes) from kyc_magic_link_uploads u where u.agency_id = q.agency_id), 0)
       )::numeric / (1024 * 1024), 2)) as storage_mb
    from agency_usage_quotas q
    join agencies a on a.id = q.agency_id
  )
  select u.agency_id, u.agency_name, m.metric, m.usage, m.cap, u.alert_threshold_pct
  from usage u
  cross join lateral (
    values
      ('ai_cost_usd', u.ai_cost, u.ai_monthly_cost_cap_usd::numeric),
      ('active_properties', u.props, u.active_properties_cap::numeric),
      ('whatsapp_messages', u.wa, u.whatsapp_monthly_cap::numeric),
      ('storage_mb', u.storage_mb, u.storage_cap_mb::numeric)
  ) as m(metric, usage, cap)
  where m.cap is not null
    and m.cap > 0
    and m.usage >= m.cap * u.alert_threshold_pct / 100.0;
end;
$$;

comment on function public.get_admin_quota_breaches() is
  'Agences dépassant le seuil d''alerte (usage >= cap × threshold%) sur un métrique. Lu par le sweep de _shared/admin-alerts.ts (cron). Super-admin/service. Voir 20260713100000.';

-- ── Grants (patron P3 : EXECUTE authenticated, la garde interne filtre) ──────
revoke all on function public.admin_set_agency_quotas(uuid, jsonb, text) from public, anon;
revoke all on function public.get_admin_agency_usage(uuid) from public, anon;
revoke all on function public.get_admin_usage_overview() from public, anon;
revoke all on function public.get_admin_quota_breaches() from public, anon;
grant execute on function public.admin_set_agency_quotas(uuid, jsonb, text) to authenticated;
grant execute on function public.get_admin_agency_usage(uuid) to authenticated, service_role;
grant execute on function public.get_admin_usage_overview() to authenticated, service_role;
grant execute on function public.get_admin_quota_breaches() to authenticated, service_role;
