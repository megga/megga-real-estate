-- Lecture de l'annuaire d'agences pour les utilisateurs connectés.
--
-- POURQUOI. `agency_profiles` portait RLS activée avec DEUX policies seulement,
-- `owner_update_agency_profiles` (UPDATE) et `admin_insert_agency_profiles`
-- (INSERT) — et AUCUNE policy SELECT. Le rôle `authenticated` avait pourtant le
-- GRANT SELECT sur les 32 colonnes : c'est la RLS qui était le seul verrou, et
-- elle rendait la table illisible. Toute lecture renvoyait 0 ligne, sans erreur.
--
-- Conséquence pour la jointure de Matching · Recherche (migration précédente
-- 20260729120000) : l'embed PostgREST `agency_profiles(logo_url)` aurait
-- renvoyé `null` sur CHAQUE annonce, en silence — le repli sur le nom aurait
-- masqué la panne et le rattachement aurait paru sans effet.
--
-- ⚠ `claim_token` EST UN SECRET. C'est le jeton qui permet de revendiquer un
-- profil d'agence. Ouvrir la lecture sans le retirer laisserait n'importe quel
-- compte connecté lire le jeton de n'importe quelle régie et s'approprier son
-- profil. On révoque donc la colonne AVANT d'ouvrir la policy. Elle n'est lue
-- nulle part dans src/ ni dans les edge functions (seulement présente dans les
-- types générés), la révocation ne casse rien.
--
-- Portée volontairement limitée à `authenticated` : `anon` reste sans lecture.
-- L'écran Matching est derrière login, et la marketplace publique n'a pas
-- besoin de l'annuaire.

-- ─── 1. Retirer le secret AVANT d'ouvrir la lecture ───────────────

REVOKE SELECT (claim_token) ON public.agency_profiles FROM authenticated;
REVOKE SELECT (claim_token) ON public.agency_profiles FROM anon;

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
  'Annuaire d''agences lisible par tout compte connecté (référentiel partagé, non cloisonné par tenant). claim_token est révoqué au niveau colonne — ne jamais le re-granter.';
