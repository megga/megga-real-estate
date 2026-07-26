-- Retrait du portail vendeur — DB.
--
-- La fonctionnalité n'a JAMAIS servi : `seller_portals` comptait 0 ligne depuis
-- sa création (aucun `created_at`, 0 vue cumulée) et `seller_preferences` 0
-- également. Aucun lien personnel n'a donc jamais été envoyé à un vendeur, et
-- l'UI de création avait déjà disparu de la fiche contact. Le frontend, l'edge
-- function `seller-portal-action` et la section « Portails vendeurs » de la
-- console admin partent dans le même commit.
--
-- Trois des quatre fonctions qui citaient `seller_portals` servent AUSSI autre
-- chose (leads, KYC, contacts, biens) : elles sont RÉÉCRITES sans leur bloc
-- portail, pas droppées. Les deux qui exposaient `portals_active` dans leur
-- RETURNS TABLE changent de signature, ce qui impose un DROP + CREATE — un
-- CREATE OR REPLACE refuserait le changement de type de retour.
--
-- Rejouabilité : `deploy.yml` rejoue les migrations datées du jour au merge,
-- donc chaque ordre est idempotent (IF EXISTS / OR REPLACE).

-- ── 1. La RPC 100 % portail ───────────────────────────────────────────────────
drop function if exists public.get_admin_seller_portals(text, integer, integer);

-- ── 2. Les deux tables (0 ligne ; seller_preferences porte la FK vers l'autre) ─
drop table if exists public.seller_preferences;
drop table if exists public.seller_portals;

-- ── 3. get_admin_end_user_stats — le bloc 'portals' du jsonb disparaît ────────
create or replace function public.get_admin_end_user_stats()
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_result jsonb;
  v_month_start timestamptz := now() - interval '30 days';
begin
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;

  select jsonb_build_object(
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
$function$;

-- ── 4. get_admin_agency_usage — la colonne portals_active sort du RETURNS ─────
drop function if exists public.get_admin_agency_usage(uuid);
create function public.get_admin_agency_usage(p_agency_id uuid)
returns table(
  active_properties bigint, contacts_count bigint,
  ai_cost_month_usd numeric, ai_calls_month bigint,
  wa_messages_month bigint, storage_est_mb numeric,
  last_activity_at timestamp with time zone
)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
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
    (select max(e.created_at) from activity_events e where e.agency_id = p_agency_id);
end;
$function$;

-- ── 5. get_admin_usage_overview — idem ────────────────────────────────────────
-- ⚠ Le `order by 7 desc` est POSITIONNEL et vise `ai_cost_month_usd`.
-- `portals_active` était la 10e colonne : retirer une colonne APRÈS la 7e ne
-- déplace pas le tri. Vérifié plutôt que supposé.
drop function if exists public.get_admin_usage_overview();
create function public.get_admin_usage_overview()
returns table(
  agency_id uuid, agency_name text, plan text, status text,
  active_properties bigint, contacts_count bigint,
  ai_cost_month_usd numeric, wa_messages_month bigint, storage_est_mb numeric,
  last_activity_at timestamp with time zone, caps jsonb
)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
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
    (select max(e.created_at) from activity_events e where e.agency_id = a.id),
    coalesce(
      (select to_jsonb(q) - 'agency_id' - 'updated_by' - 'updated_at'
         from agency_usage_quotas q where q.agency_id = a.id),
      '{}'::jsonb)
  from agencies a
  order by 7 desc; -- coût IA du mois décroissant
end;
$function$;

-- ── 6. Privilèges des deux fonctions RECRÉÉES ─────────────────────────────────
-- Un DROP emporte les GRANT, et une fonction recréée dans `public` récupère
-- EXECUTE pour `anon` via les DEFAULT PRIVILEGES de Supabase. Les grants
-- d'origine étaient limités à `authenticated` + `service_role` : un DROP +
-- CREATE nu ÉLARGIT donc les privilèges. La garde `is_super_admin()` du corps
-- refuserait l'appel, mais on ne laisse pas le verrou reposer sur elle seule.
--
-- ⚠ `revoke ... from public` NE SUFFIT PAS : le grant à `anon` est EXPLICITE
-- (posé par les default privileges), pas hérité de PUBLIC. Il faut le révoquer
-- nommément — vérifié sur pg_proc.proacl après application, pas supposé.
--
-- `get_admin_end_user_stats` n'est pas concernée : CREATE OR REPLACE conserve
-- les grants existants.
revoke all on function public.get_admin_agency_usage(uuid) from public, anon;
revoke all on function public.get_admin_usage_overview() from public, anon;
grant execute on function public.get_admin_agency_usage(uuid) to authenticated, service_role;
grant execute on function public.get_admin_usage_overview() to authenticated, service_role;
