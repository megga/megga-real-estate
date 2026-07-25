-- Phase A · batch 2 — durcissement sécurité & notifications (pré-vol pilote).
-- Trois correctifs P0 issus de l'audit backend du 17 juillet 2026 :
--   1. notify_new_seller_lead : la garde source='marketplace' ratait les leads
--      réels du funnel React (source='website') → aucune notification depuis le
--      pivot. Élargie aux deux funnels web entrants.
--   2. seller_portals : la policy `public_read_active_portals` (rôle PUBLIC,
--      sans contrainte de token) laissait n'importe quel anon ÉNUMÉRER tous les
--      tokens de portails actifs → accès aux données de tous les vendeurs.
--      Retirée : les lectures du portail passent par l'edge seller-portal-action
--      (service_role), l'anon n'a jamais besoin de lire la table.
--   3. get_admin_* / get_agency_stats : 5 RPC SECURITY DEFINER sans garde,
--      EXECUTE ouvert à `authenticated` → tout agent connecté récupérait des
--      agrégats CROSS-AGENCES. Converties en plpgsql avec garde
--      is_super_admin() OR is_service_role() (idiome get_cron_health), erreur
--      42501 sinon. Le grant reste inchangé (la garde fait l'autorisation).

-- ─── 1. Notification des leads vendeurs : inclure le funnel « website » ──────
CREATE OR REPLACE FUNCTION public.notify_new_seller_lead()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_city  text := nullif(new.property_data->>'city', '');
  v_type  text := nullif(new.property_data->>'type', '');
  v_label text;
begin
  -- Funnels web entrants qui doivent alerter l'agent : storefront
  -- (source='marketplace') ET funnel React /vendre (source='website').
  -- Un lead sans source, ou d'une source agent-créée, ne notifie pas.
  if new.source is null or new.source not in ('marketplace', 'website') then
    return new;
  end if;

  v_label := 'Nouvelle annonce vendeur'
    || case when coalesce(new.contact_name, '') <> '' then ' · ' || new.contact_name else '' end
    || case when v_city is not null then ' · ' || v_city else '' end;

  insert into public.activity_events (
    agency_id, actor_id, actor_kind, action, entity_type, entity_id,
    category, severity, object_label, metadata
  ) values (
    new.assigned_agency_id, null, 'system', 'seller_lead_received', 'seller_lead', new.id,
    'deal', 'info', v_label,
    jsonb_build_object('source', new.source, 'city', v_city, 'type', v_type, 'contact_name', new.contact_name)
  );
  return new;
end;
$function$;

-- ─── 2. Fuite de tokens de portail vendeur : retirer la lecture publique ─────
DROP POLICY IF EXISTS public_read_active_portals ON public.seller_portals;
-- Défense en profondeur : l'anon n'a aucun besoin sur ces tables (tout passe
-- par l'edge service_role). REVOKE idempotent (no-op si le grant est absent).
REVOKE ALL ON public.seller_portals FROM anon;
REVOKE ALL ON public.seller_preferences FROM anon;

-- ─── 3. RPC admin : garde super_admin (ou service_role) + 42501 ──────────────
-- Converties de LANGUAGE sql → plpgsql pour porter la garde (idiome identique à
-- get_cron_health, 20260705160000). Corps SELECT inchangé, colonnes/retours
-- préservés. is_service_role() garde ouverts d'éventuels appelants cron/edge.

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats()
 RETURNS TABLE(active_agencies bigint, total_users bigint, active_properties bigint, active_transactions bigint, high_risk_kyc bigint, new_agencies_this_month bigint, new_users_this_month bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT (public.is_super_admin() OR public.is_service_role()) THEN
    RAISE EXCEPTION 'forbidden: super_admin only' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM agencies),
    (SELECT COUNT(*) FROM profiles),
    (SELECT COUNT(*) FROM properties WHERE status = 'active'),
    (SELECT COUNT(*) FROM transactions WHERE status = 'active'),
    (SELECT COUNT(*) FROM kyc_cases WHERE risk_level = 'high'),
    (SELECT COUNT(*) FROM agencies WHERE created_at >= date_trunc('month', now())),
    (SELECT COUNT(*) FROM profiles WHERE created_at >= date_trunc('month', now()));
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_admin_compliance_stats()
 RETURNS TABLE(total bigint, pending bigint, screening_match bigint, avg_completion numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT (public.is_super_admin() OR public.is_service_role()) THEN
    RAISE EXCEPTION 'forbidden: super_admin only' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM kyc_cases),
    (SELECT COUNT(*) FROM kyc_cases WHERE status IN ('pending', 'in_progress')),
    -- "screening match" agrège PEP + sanctions (cf. idx_kyc_cases_screening_match)
    (SELECT COUNT(*) FROM kyc_cases WHERE pep_status = 'match' OR sanctions_status = 'match'),
    COALESCE((SELECT ROUND(AVG(completion_pct)::numeric, 1) FROM kyc_cases), 0);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_admin_moderation_stats()
 RETURNS TABLE(published_count bigint, flags_this_month bigint, removes_this_month bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT (public.is_super_admin() OR public.is_service_role()) THEN
    RAISE EXCEPTION 'forbidden: super_admin only' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM properties WHERE moderation_status = 'published'),
    (SELECT COUNT(*) FROM moderation_actions
      WHERE action = 'flag'
        AND created_at >= date_trunc('month', now())),
    (SELECT COUNT(*) FROM moderation_actions
      WHERE action = 'remove'
        AND created_at >= date_trunc('month', now()));
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_admin_monitoring_health()
 RETURNS TABLE(errors_last_24h bigint, emails_sent_today bigint, api_requests_today bigint, last_scraping_at timestamp with time zone, db_size_mb numeric, storage_used_mb numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT (public.is_super_admin() OR public.is_service_role()) THEN
    RAISE EXCEPTION 'forbidden: super_admin only' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM activity_events
      WHERE action = 'edge_function_error'
        AND created_at >= now() - INTERVAL '24 hours'),
    (SELECT COUNT(*) FROM activity_events
      WHERE action = 'email_sent'
        AND created_at >= date_trunc('day', now())),
    (SELECT COUNT(*) FROM activity_events
      WHERE created_at >= date_trunc('day', now())),
    (SELECT MAX(created_at) FROM activity_events WHERE action = 'scraping_completed'),
    COALESCE((SELECT metric_value FROM platform_metrics
      WHERE metric_type = 'db_size_mb'
      ORDER BY recorded_at DESC LIMIT 1), 0),
    COALESCE((SELECT metric_value FROM platform_metrics
      WHERE metric_type = 'storage_used_mb'
      ORDER BY recorded_at DESC LIMIT 1), 0);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_agency_stats(agency_ids uuid[])
 RETURNS TABLE(agency_id uuid, agent_count bigint, property_count bigint, transaction_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT (public.is_super_admin() OR public.is_service_role()) THEN
    RAISE EXCEPTION 'forbidden: super_admin only' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT a.id AS agency_id,
    COALESCE(p.cnt, 0) AS agent_count,
    COALESCE(pr.cnt, 0) AS property_count,
    COALESCE(t.cnt, 0) AS transaction_count
  FROM unnest(agency_ids) AS a(id)
  LEFT JOIN LATERAL (SELECT count(*) AS cnt FROM public.profiles WHERE profiles.agency_id = a.id) p ON true
  LEFT JOIN LATERAL (SELECT count(*) AS cnt FROM public.properties WHERE properties.agency_id = a.id AND properties.status = 'active') pr ON true
  LEFT JOIN LATERAL (SELECT count(*) AS cnt FROM public.transactions WHERE transactions.agency_id = a.id AND transactions.status = 'active') t ON true
  WHERE a.id = ANY(agency_ids);
END;
$function$;

COMMENT ON FUNCTION public.get_admin_dashboard_stats() IS
  'Agrégats plateforme super-admin. Garde is_super_admin() OR is_service_role() (42501 sinon) — 20260717190000.';
COMMENT ON FUNCTION public.get_agency_stats(uuid[]) IS
  'Compteurs par agence (super-admin). Garde is_super_admin() OR is_service_role() (42501 sinon) — 20260717190000.';
