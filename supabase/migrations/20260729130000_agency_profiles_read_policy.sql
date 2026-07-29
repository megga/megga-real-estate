-- Lecture de l'annuaire d'agences pour les utilisateurs connectés.
--
-- POURQUOI. `agency_profiles` portait RLS activée avec DEUX policies seulement,
-- `owner_update_agency_profiles` (UPDATE) et `admin_insert_agency_profiles`
-- (INSERT) — et AUCUNE policy SELECT. Le rôle `authenticated` avait pourtant le
-- GRANT SELECT sur la table : c'est la RLS qui était le seul verrou, et elle
-- rendait la table illisible. Toute lecture renvoyait 0 ligne, sans erreur.
--
-- Conséquence pour la jointure de Matching · Recherche (migration précédente
-- 20260729120000) : l'embed PostgREST `agency_profiles(logo_url)` aurait
-- renvoyé `null` sur CHAQUE annonce, en silence — le repli sur le nom aurait
-- masqué la panne et le rattachement aurait paru sans effet.
--
-- ⚠ `claim_token` EST UN SECRET. C'est le jeton qui permet de revendiquer un
-- profil d'agence. Ouvrir la lecture sans le retirer laisserait n'importe quel
-- compte connecté lire le jeton de n'importe quelle régie et s'approprier son
-- profil. Il n'est lu nulle part dans src/ ni dans les edge functions
-- (seulement présent dans les types générés), la révocation ne casse rien.
--
-- ⚠⚠ UN REVOKE DE COLONNE NE SUFFIT PAS. `authenticated` détenait le SELECT au
-- niveau TABLE : en PostgreSQL, ce privilège autorise toutes les colonnes, et
-- un `REVOKE SELECT (claim_token)` ne le rogne pas — il ne retire qu'un
-- privilège de colonne accordé séparément. Vérifié en conditions réelles : la
-- première forme de cette migration révoquait la colonne, et `set role
-- authenticated; select claim_token …` renvoyait toujours le jeton. Il faut
-- révoquer le privilège de TABLE puis re-granter colonne par colonne.
--
-- ⚠ CONSÉQUENCE À CONNAÎTRE : avec des privilèges de COLONNE, un `SELECT *`
-- échoue (il faut le SELECT sur la table, ou sur TOUTES les colonnes). Côté
-- client, écrire `.from('agency_profiles').select()` ou `.select('*')` renverra
-- donc un 42501 — il faut énumérer les colonnes voulues. Idem pour toute
-- colonne ajoutée plus tard à la table : elle devra être ajoutée au GRANT
-- ci-dessous, sinon elle sera invisible (et cassera les `select *`).
--
-- Portée volontairement limitée à `authenticated` : `anon` n'a aucun SELECT sur
-- cette table (vérifié dans information_schema.table_privileges) et n'en reçoit
-- pas ici. L'écran Matching est derrière login.

-- ─── 1. Reprendre le privilège de table, re-granter sans le secret ──

REVOKE SELECT ON public.agency_profiles FROM authenticated;

GRANT SELECT (
  id, agency_id, name, slug, logo_url, canton, city, address, description,
  founded_year, specialties, languages, certifications, website_url, phone,
  email, zones_covered, status, claimed_at, verified_at, agent_count,
  active_listings_count, rating_avg, rating_count, source, source_id,
  created_at, updated_at, uid_che, lookmove_agency_id, enriched_at
) ON public.agency_profiles TO authenticated;

-- ─── 2. Lecture de l'annuaire pour les comptes connectés ──────────
--
-- `USING (true)` : l'annuaire est un répertoire de régies constitué à partir de
-- données publiques de portails (nom, logo, téléphone, ville, n° CHE Zefix).
-- Il n'est pas cloisonné par tenant — c'est un référentiel partagé, comme
-- `market_listings`.

DROP POLICY IF EXISTS read_agency_profiles ON public.agency_profiles;
CREATE POLICY read_agency_profiles
  ON public.agency_profiles
  FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON POLICY read_agency_profiles ON public.agency_profiles IS
  'Annuaire d''agences lisible par tout compte connecté (référentiel partagé, non cloisonné par tenant). claim_token est HORS du GRANT de colonnes — ne jamais re-granter SELECT au niveau table, ça le ré-exposerait.';
