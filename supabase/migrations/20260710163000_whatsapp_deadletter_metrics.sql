-- =====================================================================
-- WhatsApp — métriques dead-letters au tick horaire (admin-monitoring)
--
-- Constat (audit WhatsApp) : tous les signaux d'échec des files WhatsApp
-- existent en base, mais RIEN ne les enregistre ni ne les surveille —
--   * whatsapp_messages.processing_status = 'failed'  → pipeline média/transcription (cron whatsapp-process)
--   * ... AND retry_count >= 3                         → dead-letter vrai : claim_whatsapp_jobs ne le re-réclame plus
--   * whatsapp_messages.is_agent_error = true          → le copilote a répondu une erreur
--   * whatsapp_messages.status = 'failed'              → échec de livraison Meta (delivery_error)
--   * whatsapp_async_jobs.status = 'failed'            → job outil KYC en échec terminal
-- get_admin_whatsapp_health() ne regarde que 'failed' (livraison), et seulement
-- quand un super_admin ouvre le dashboard : aucune tendance, aucune alerte.
--
-- Cette migration ajoute la primitive de mesure : un RPC unique qui compte les
-- 5 signaux, chacun via son index partiel (règles perf §7 : agrégation serveur,
-- pas de count exact côté client, pas de scan complet). admin-monitoring (cron
-- horaire) l'appelle, persiste 5 lignes platform_metrics et alerte sur le
-- backlog bloqué (_shared/admin-alerts.ts). get_admin_whatsapp_health() fusionne
-- le même objet pour l'afficher au dashboard (une seule source de calcul).
--
-- Choix des fenêtres :
--   * files qui se vident (pipeline média retenté par claim_whatsapp_jobs)
--     → backlog COURANT (un système sain draine vers ~0).
--   * signaux-événements jamais « nettoyés » (is_agent_error, échecs de
--     livraison, jobs async terminaux purgés à 7j) → fenêtre 24h (un backlog
--     cumulatif croîtrait sans borne et n'aurait pas de sens de tendance).
-- =====================================================================

BEGIN;

-- Index partiel pour compter is_agent_error = true (rare). Les index hot-path
-- existants (20260705100000) sont WHERE is_agent_error = false → inutiles ici.
-- processing_status = 'failed' réutilise idx_wa_messages_pending (prédicat IN
-- pending/processing/failed) ; status = 'failed' réutilise idx_wa_messages_failed_created.
-- whatsapp_async_jobs est petite (purge 7j, faible volume) → count sans index dédié.
CREATE INDEX IF NOT EXISTS idx_wa_messages_agent_error
  ON public.whatsapp_messages (created_at DESC)
  WHERE is_agent_error = true;

-- ── Primitive de mesure : les 5 compteurs dead-letters ───────────────────────
CREATE OR REPLACE FUNCTION public.get_whatsapp_deadletter_metrics()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT (public.is_super_admin() OR public.is_service_role()) THEN
    RAISE EXCEPTION 'forbidden: super_admin only' USING errcode = '42501';
  END IF;

  -- 5 sous-requêtes scalaires : chacune frappe SON index partiel. NE PAS
  -- fusionner en un seul SELECT ... FILTER (cela forcerait un scan complet de
  -- whatsapp_messages ; l'intérêt des index partiels serait perdu).
  SELECT jsonb_build_object(
    'processing_failed', (
      SELECT count(*)::int FROM public.whatsapp_messages
      WHERE processing_status = 'failed'
    ),
    'processing_deadletter', (
      SELECT count(*)::int FROM public.whatsapp_messages
      WHERE processing_status = 'failed' AND retry_count >= 3
    ),
    -- Variante fenêtrée : dead-letters APPARUS dans les 24h (les retries
    -- s'épuisent en minutes après l'arrivée, donc created_at ≈ moment de mort).
    -- Sert l'alerting (taux actionnable qui s'auto-résout), pas la tendance ; le
    -- cumul 'processing_deadletter' ci-dessus ne décroît jamais (aucune purge)
    -- et alerterait à vie une fois franchi le seuil.
    -- Angle mort assumé : une panne whatsapp-process > 24h ferait mourir un
    -- message > 24h après created_at → hors fenêtre. Couvert par l'alerte
    -- cron-stale (admin-alerts #1, seuil 25h) qui détecte la panne elle-même.
    'processing_deadletter_24h', (
      SELECT count(*)::int FROM public.whatsapp_messages
      WHERE processing_status = 'failed' AND retry_count >= 3
        AND created_at > now() - interval '24 hours'
    ),
    'agent_errors_24h', (
      SELECT count(*)::int FROM public.whatsapp_messages
      WHERE is_agent_error = true AND created_at > now() - interval '24 hours'
    ),
    'delivery_failed_24h', (
      SELECT count(*)::int FROM public.whatsapp_messages
      WHERE status = 'failed' AND created_at > now() - interval '24 hours'
    ),
    'async_jobs_failed_24h', (
      SELECT count(*)::int FROM public.whatsapp_async_jobs
      WHERE status = 'failed' AND created_at > now() - interval '24 hours'
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_whatsapp_deadletter_metrics() IS
  'Compteurs dead-letters WhatsApp : 5 signaux persistés (pipeline média failed + dead-letter cumulatif, is_agent_error 24h, échecs de livraison 24h, jobs async échoués 24h) + processing_deadletter_24h (fenêtré, pour l''alerting auto-résolvant). Alimente le tick horaire admin-monitoring et le panneau ops WhatsApp. Garde super_admin/service (42501).';

REVOKE ALL ON FUNCTION public.get_whatsapp_deadletter_metrics() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_whatsapp_deadletter_metrics() TO authenticated;

-- ── get_admin_whatsapp_health : fusionner les compteurs dead-letters ─────────
-- Recréée à l'identique (source : 20260705172000) + une ligne de fusion, pour
-- que le panneau ops WhatsApp affiche les dead-letters sans second aller-retour.
-- L'appel interne re-vérifie la garde dans le MÊME contexte (auth.uid préservé
-- sous SECURITY DEFINER) → aucun contournement.
CREATE OR REPLACE FUNCTION public.get_admin_whatsapp_health()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT (public.is_super_admin() OR public.is_service_role()) THEN
    RAISE EXCEPTION 'forbidden: super_admin only' USING errcode = '42501';
  END IF;

  -- Une seule passe 7 jours (FILTER) — pas de N counts séparés.
  SELECT jsonb_build_object(
    'sent_24h',   count(*) FILTER (WHERE direction = 'outbound' AND created_at > now() - interval '24 hours'),
    'failed_24h', count(*) FILTER (WHERE status = 'failed' AND created_at > now() - interval '24 hours'),
    'sent_7d',    count(*) FILTER (WHERE direction = 'outbound'),
    'failed_7d',  count(*) FILTER (WHERE status = 'failed'),
    'last_inbound_at', max(created_at) FILTER (WHERE direction = 'inbound'),
    'last_status_update_at', max(status_updated_at)
  ) INTO v_result
  FROM public.whatsapp_messages
  WHERE created_at > now() - interval '7 days';

  v_result := v_result || jsonb_build_object(
    'top_errors', coalesce((
      SELECT jsonb_agg(jsonb_build_object('error', t.delivery_error, 'count', t.cnt) ORDER BY t.cnt DESC)
      FROM (
        SELECT delivery_error, count(*)::int AS cnt
        FROM public.whatsapp_messages
        WHERE status = 'failed'
          AND delivery_error IS NOT NULL
          AND created_at > now() - interval '7 days'
        GROUP BY delivery_error
        ORDER BY cnt DESC
        LIMIT 5
      ) t
    ), '[]'::jsonb),
    'unmapped_inbound_7d', (
      SELECT count(*)::int FROM public.whatsapp_messages
      WHERE direction = 'inbound' AND agency_id IS NULL
        AND created_at > now() - interval '7 days'
    ),
    'cron_locks', coalesce((
      SELECT jsonb_agg(jsonb_build_object('job', job, 'locked_until', locked_until) ORDER BY job)
      FROM public.whatsapp_cron_locks
    ), '[]'::jsonb)
  );

  -- Fusion des dead-letters (même primitive que le cron).
  v_result := v_result || public.get_whatsapp_deadletter_metrics();

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_admin_whatsapp_health() IS
  'Ops WhatsApp (envois/échecs 24h+7j, top delivery_error, récence webhook, inbound non mappés, cron locks, dead-letters) pour AdminMonitoringPage. Garde super_admin/service (42501).';

REVOKE ALL ON FUNCTION public.get_admin_whatsapp_health() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_whatsapp_health() TO authenticated;

COMMIT;
