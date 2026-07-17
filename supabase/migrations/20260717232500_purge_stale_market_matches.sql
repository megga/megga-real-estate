-- Phase A · batch 3 — purge des matchs sur annonces retirées du marché.
--
-- Constat (audit 17 juil.) : ~51 % de la file de l'Atelier (1966/3818 matchs
-- 'suggested') pointait une market_listing 'removed' → l'agent se voyait
-- proposer des biens DISPARUS. Casse-confiance direct pour le pilote.
--
-- Fix : on SUPPRIME les matchs 'suggested' (jamais envoyés, aucune valeur
-- d'historique) dont la market_listing est 'removed'. Self-healing : si
-- l'annonce redevient 'active' (revive RealAdvisor) et matche toujours, le
-- daily_matching_scan (05:00) re-crée le match. Les matchs 'sent'/'interested'/
-- 'visit_planned' (historique d'un envoi réel) sont TOUJOURS préservés.
-- focus_top_matches (Focus/cockpit) et l'Atelier ne lisent que du 'suggested'
-- vivant → tous deux assainis par cette seule purge (0 réécriture de RPC).

CREATE OR REPLACE FUNCTION public.purge_stale_market_matches()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_deleted integer;
BEGIN
  WITH del AS (
    DELETE FROM matches m
    USING market_listings ml
    WHERE ml.id = m.market_listing_id
      AND m.status = 'suggested'      -- jamais envoyé → pas d'historique, pas de reminder
      AND ml.status = 'removed'       -- annonce disparue du marché
    RETURNING m.id
  )
  SELECT count(*) INTO v_deleted FROM del;
  RETURN v_deleted;
END;
$function$;

COMMENT ON FUNCTION public.purge_stale_market_matches() IS
  'Supprime les matchs SUGGESTED dont la market_listing est removed (biens disparus). Self-healing via daily_matching_scan. Cron purge-stale-matches 04:50 + one-shot 20260717. Ne touche jamais un match sent/actionné. Voir 20260717232500.';

-- Appelée uniquement par le cron (postgres, owner) et le service_role : jamais
-- par un client. Les default privileges Supabase accordent EXECUTE à anon ET
-- authenticated EXPLICITEMENT (pas seulement via PUBLIC) → il faut révoquer les
-- trois, sinon un agent peut déclencher la purge (gotcha #844/#845). service_role
-- garde son grant.
REVOKE EXECUTE ON FUNCTION public.purge_stale_market_matches() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_stale_market_matches() TO service_role;

-- One-shot : nettoie l'accumulation existante DÈS le déploiement (les ~1966).
SELECT public.purge_stale_market_matches();

-- Cron nocturne : après les syncs (flatfox 04:00, RealAdvisor sweep 01:30),
-- avant le daily_matching_scan (05:00). Gardé par la présence de pg_cron :
-- planifié en prod, sauté en local/CI (schema "cron" absent). Idempotent
-- (unschedule si déjà présent avant re-schedule).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-stale-matches') THEN
      PERFORM cron.unschedule('purge-stale-matches');
    END IF;
    PERFORM cron.schedule('purge-stale-matches', '50 4 * * *', 'SELECT public.purge_stale_market_matches()');
  ELSE
    RAISE NOTICE 'pg_cron absent (local/CI) — purge-stale-matches non planifié';
  END IF;
END $$;
