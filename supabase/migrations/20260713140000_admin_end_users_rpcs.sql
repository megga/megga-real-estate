-- =====================================================================
-- P6b — Supervision des « utilisateurs finaux » (clients sans compte)
--
-- Donne au super-admin une visibilité sur les audiences qui n'ont PAS de
-- compte auth : vendeurs via portail (seller_portals), leads entrants
-- (seller_leads / contact_messages) et clients KYC par lien magique
-- (kyc_magic_links). Objectifs 4 (transparence), 2 (parcours KYC bloqués
-- visibles), 3 (leads non traités visibles).
--
-- Choix : 3 RPC de LECTURE agrégée plutôt qu'ouvrir la RLS de ces tables au
-- super-admin — surface minimale, joins côté serveur, et surtout on NE
-- RENVOIE JAMAIS de secret :
--   * seller_portals.token / kyc_magic_links.token = capability URL
--     (règle d'or #844/#845 : un token ne transite jamais par une lecture).
--   * kyc_magic_links.client_ip / client_user_agent = PII non nécessaire
--     (minimisation nLPD) → exclus des colonnes retournées.
-- Gardées is_super_admin() OR is_service_role() (42501), agrégation §7.
-- =====================================================================

-- ── Stats agrégées des audiences sans compte ─────────────────────────────────
create or replace function public.get_admin_end_user_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_result jsonb;
  v_month_start timestamptz := now() - interval '30 days';
begin
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'portals', (
      select jsonb_build_object(
        'active',      count(*) filter (where status = 'active'),
        'expired',     count(*) filter (where status = 'expired'),
        'revoked',     count(*) filter (where status = 'revoked'),
        'viewed_7d',   count(*) filter (where last_viewed_at is not null and last_viewed_at >= now() - interval '7 days'),
        'total_views', coalesce(sum(view_count), 0)
      )
      from seller_portals
    ),
    'magic_links', (
      select jsonb_build_object(
        'total_30d',      count(*),
        'opened',         count(*) filter (where opened_at is not null),
        'uploaded',       count(*) filter (where uploaded_at is not null),
        'confirmed',      count(*) filter (where confirmed_at is not null),
        'expired',        count(*) filter (where status = 'expired' or expired_at is not null),
        'conversion_pct', case when count(*) > 0
          then round(100.0 * count(*) filter (where confirmed_at is not null) / count(*), 1)
          else 0 end
      )
      from kyc_magic_links
      where sent_at >= v_month_start
    ),
    'leads', (
      select jsonb_build_object(
        'by_status', coalesce((
          select jsonb_agg(jsonb_build_object('status', s.status, 'count', s.cnt) order by s.status)
          from (select status, count(*) as cnt from seller_leads group by status) s), '[]'::jsonb),
        'by_source', coalesce((
          select jsonb_agg(jsonb_build_object('source', s.source, 'count', s.cnt) order by s.source)
          from (select source, count(*) as cnt from seller_leads group by source) s), '[]'::jsonb),
        'total',  (select count(*) from seller_leads),
        'new_30d', (select count(*) from seller_leads where created_at >= v_month_start)
      )
    ),
    'contact_messages', (
      select jsonb_build_object(
        'by_status', coalesce((
          select jsonb_agg(jsonb_build_object('status', s.status, 'count', s.cnt) order by s.status)
          from (select status, count(*) as cnt from contact_messages group by status) s), '[]'::jsonb),
        'total', (select count(*) from contact_messages)
      )
    )
  ) into v_result;

  return v_result;
end;
$$;

comment on function public.get_admin_end_user_stats() is
  'Stats des audiences sans compte (portails vendeurs, funnel magic-link KYC 30j, leads, contact_messages). Super-admin. Voir 20260713140000.';

-- ── Portails vendeurs (liste, JAMAIS le token) ───────────────────────────────
create or replace function public.get_admin_seller_portals(
  p_status text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  status text,
  created_at timestamptz,
  expires_at timestamptz,
  last_viewed_at timestamptz,
  view_count integer,
  agency_name text,
  contact_name text,
  property_title text,
  agent_name text
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
    sp.id, sp.status, sp.created_at, sp.expires_at, sp.last_viewed_at, sp.view_count,
    a.name,
    c.first_name || ' ' || c.last_name,
    p.title,
    pr.full_name
  from seller_portals sp
  left join agencies a on a.id = sp.agency_id
  left join contacts c on c.id = sp.contact_id
  left join properties p on p.id = sp.property_id
  left join profiles pr on pr.id = sp.agent_id
  where p_status is null or sp.status = p_status
  order by sp.created_at desc
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
end;
$$;

comment on function public.get_admin_seller_portals(text, integer, integer) is
  'Liste des portails vendeurs pour l''oversight super-admin. NE RENVOIE JAMAIS seller_portals.token (capability URL). Voir 20260713140000.';

-- ── Parcours KYC publics (liste, sans token ni PII) ─────────────────────────
create or replace function public.get_admin_kyc_magic_links(
  p_status text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  status text,
  mode text,
  sent_at timestamptz,
  opened_at timestamptz,
  uploaded_at timestamptz,
  confirmed_at timestamptz,
  expires_at timestamptz,
  agency_name text,
  contact_name text
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
    ml.id, ml.status::text, ml.mode::text,
    ml.sent_at, ml.opened_at, ml.uploaded_at, ml.confirmed_at, ml.expires_at,
    a.name,
    c.first_name || ' ' || c.last_name
  from kyc_magic_links ml
  left join agencies a on a.id = ml.agency_id
  left join contacts c on c.id = ml.contact_id
  where p_status is null or ml.status::text = p_status
  order by ml.sent_at desc
  limit greatest(p_limit, 1) offset greatest(p_offset, 0);
end;
$$;

comment on function public.get_admin_kyc_magic_links(text, integer, integer) is
  'Liste des parcours KYC publics (funnel) pour l''oversight super-admin. NE RENVOIE JAMAIS token / client_ip / client_user_agent (minimisation nLPD + capability URL). Voir 20260713140000.';

-- ── Grants (patron P3 : EXECUTE authenticated, garde interne) ────────────────
revoke all on function public.get_admin_end_user_stats() from public, anon;
revoke all on function public.get_admin_seller_portals(text, integer, integer) from public, anon;
revoke all on function public.get_admin_kyc_magic_links(text, integer, integer) from public, anon;
grant execute on function public.get_admin_end_user_stats() to authenticated, service_role;
grant execute on function public.get_admin_seller_portals(text, integer, integer) to authenticated, service_role;
grant execute on function public.get_admin_kyc_magic_links(text, integer, integer) to authenticated, service_role;
