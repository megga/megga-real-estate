-- `anon` n'a plus AUCUN droit sur les tables internes de la console.
--
-- MESURÉ EN PRODUCTION le 01.08.2026, et ce n'est pas ce que j'attendais : six tables
-- internes accordent des droits à `anon`, et cinq d'entre elles lui accordent
-- `DELETE, INSERT, UPDATE, TRUNCATE` — pas seulement la lecture.
--
--   admin_changelog         REFERENCES, SELECT, TRIGGER
--   admin_feature_flags     DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
--   admin_nps_responses     idem
--   app_config              idem   ← porte `service_role_key`
--   platform_announcements  idem
--   platform_metrics        idem
--
-- Ces droits ne viennent d'AUCUNE migration : Supabase les accorde d'office à la création
-- d'une table, et rien ne les a révoqués. C'est le « footgun » des privilèges par défaut,
-- déjà connu du dépôt.
--
-- CE QUI TIENT AUJOURD'HUI, ET POURQUOI ÇA NE SUFFIT PAS. La RLS est le seul verrou, et elle
-- tient : `app_config` n'a AUCUNE policy (donc deny-all), `platform_metrics` exige
-- `is_super_admin()`, `admin_feature_flags` exige `auth.uid() IS NOT NULL`,
-- `admin_nps_responses` exige un profil super_admin, `platform_announcements` scope ses
-- policies `TO authenticated`. Une seule fuyait vraiment — `admin_changelog`, dont la policy
-- n'avait pas de clause `TO` et dont la première branche `published = true` est vraie sans
-- identité (fermée par 20260801380000).
--
-- Mais « la RLS tient » est une phrase au présent. Un `create policy` trop permissif écrit
-- dans six mois, sur une table où `anon` a INSERT et TRUNCATE, ne demande aucune autre
-- erreur pour devenir grave. Retirer le GRANT met le verrou un cran plus haut : sans lui,
-- aucune policy, si permissive soit-elle, ne peut laisser passer `anon`.
--
-- ⚠ VÉRIFIÉ AVANT, parce que révoquer n'est pas neutre : une lecture bloquée par la RLS rend
-- `{ data: [], error: null }`, une lecture bloquée par le GRANT rend une ERREUR. Révoquer
-- transforme donc un silence en erreur visible. Les cinq tables ne sont lues que depuis des
-- surfaces AUTHENTIFIÉES — `useFeatureFlags` n'est monté que par `AdminFeatureFlagsPage`
-- (derrière la garde super-admin), `useAdminNps`, `MrrSparkline` et `useAnnouncementsAdmin`
-- sont des surfaces de console, et `app_config` n'a aucun lecteur dans `src/`. Aucune ne
-- s'exécute sans session : le changement est inerte côté comportement.
--
-- La porte qui empêche la récidive : `scripts/check-privilege-drift.mjs`, branché sur le
-- workflow `migration-drift.yml` — il interroge la PRODUCTION, ce qu'une suite de tests sur
-- base fraîche ne peut pas faire.

revoke all on table public.admin_changelog        from anon;
revoke all on table public.admin_feature_flags    from anon;
revoke all on table public.admin_nps_responses    from anon;
revoke all on table public.app_config             from anon;
revoke all on table public.platform_announcements from anon;
revoke all on table public.platform_metrics       from anon;
