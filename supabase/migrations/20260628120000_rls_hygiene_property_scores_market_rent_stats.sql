-- =====================================================================
-- HYGIÈNE RLS / moindre privilège — property_scores + market_rent_stats
-- (non bloquant V1, propreté multi-tenant ; relevé par le re-tally du 27 juin)
-- =====================================================================

-- ── 1. property_scores : retirer la branche « OR agency_id IS NULL » ─────────
-- La policy de lecture autorisait
--   USING (agency_id = get_my_agency_id() OR agency_id IS NULL)
-- → toute ligne property_scores avec agency_id NULL aurait été lisible par
-- TOUTES les agences (et anon) : chemin de lecture cross-tenant latent.
-- Vérifié LIVE : 0 ligne à agency_id NULL aujourd'hui, et le RPC
-- calculate_property_scores(uuid) pose TOUJOURS agency_id à l'insert → la branche
-- NULL est inutile. On la retire, puis on rend la colonne NOT NULL pour qu'aucune
-- ligne orpheline (= vecteur de fuite) ne puisse plus être créée.
DROP POLICY IF EXISTS "Users can read own agency property scores" ON public.property_scores;
CREATE POLICY "Users can read own agency property scores" ON public.property_scores
  FOR SELECT
  USING (agency_id = get_my_agency_id());

ALTER TABLE public.property_scores ALTER COLUMN agency_id SET NOT NULL;

-- ── 2. market_rent_stats : verrouiller l'accès API au seul service_role ──────
-- Vue MATÉRIALISÉE → RLS impossible (Postgres n'autorise ENABLE ROW LEVEL
-- SECURITY que sur des tables). Contenu = agrégats loyer/m² par zone
-- (déterministe, 0 PII, 0 donnée d'agence). anon est déjà révoqué (migration
-- 20260618210000). authenticated détenait SELECT mais AUCUN lecteur : le seul
-- consommateur est l'edge matching-engine, qui lit TOUJOURS en service-role
-- (le client de requireAgentAuth est lui-même service-role, donc agent ET cron
-- passent en service-role) ; aucun hook front ne lit cette MV.
-- Moindre privilège : on révoque authenticated → service_role seul. Silence
-- aussi l'advisor « materialized view exposée à l'API ».
REVOKE SELECT ON public.market_rent_stats FROM authenticated;
