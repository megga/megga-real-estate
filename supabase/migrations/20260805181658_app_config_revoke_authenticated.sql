-- `app_config` cesse d'être joignable par `authenticated`, et le magasin de
-- secret cesse de dépendre d'une policy absente.
--
-- Constat : docs/audits/2026-08-04-blast-radius-service-role.md §4.1.
--
-- ⚠ POURQUOI L'HORODATAGE (05.08) EST POSTÉRIEUR À L'APPLICATION (04.08).
-- Le fichier a d'abord porté `20260804180831`. Il n'a pas été fusionné ce
-- jour-là, et le garde-date de `deploy.yml` est sans appel : il n'applique que
-- `stamp_date >= TODAY`, donc une migration du 04 fusionnée le 05 est sautée
-- DÉFINITIVEMENT — aucun déploiement ultérieur ne la rattrape. Ré-horodater est
-- la seule façon de la faire appliquer par la CI ; `REVOKE` étant idempotent, la
-- rejouer sur une base qui la porte déjà ne coûte rien.
--
-- ⚠ HISTORIQUE, pour que la piste soit honnête : ces deux REVOKE ont été
-- appliqués à la production le 04.08.2026 vers 18:10 UTC, AVANT cette PR et hors
-- du flux habituel — une sonde qui devait être annulée s'est retrouvée validée
-- (l'outil d'exécution SQL confirme chaque instruction ; il n'y avait pas de
-- transaction à annuler). L'état obtenu est exactement celui que ce fichier
-- décrit, et il a été vérifié sain juste après : `service_role` intact,
-- `get_today_focus_config()` toujours fonctionnelle sous `authenticated`, ligne
-- `service_role_key` inchangée. Ce fichier reste nécessaire — sans lui, toute
-- base reconstruite depuis les migrations (branche de preview, shadow DB,
-- futur environnement) repartirait du baseline, qui ré-accorde `ALL` aux deux
-- rôles. `REVOKE` étant idempotent, le rejouer sur la production est sans effet.
--
-- CE QUE CETTE TABLE CONTIENT. La ligne `service_role_key` est une clé de
-- service VIVANTE : les 15 tâches pg_cron qui appellent une edge function
-- rejouent sa valeur en `Bearer` (`get_app_config('service_role_key')`), et huit
-- fonctions la comparent pour s'authentifier. Ce n'est pas un réglage, c'est un
-- identifiant.
--
-- CE QUI LA PROTÉGEAIT, ET POURQUOI CE N'EST PAS ASSEZ. Mesuré en production le
-- 04.08.2026 : `authenticated` détient SELECT, INSERT, UPDATE et DELETE sur
-- cette table. La lecture ne renvoie rien — mais pas parce que le privilège
-- manque : parce que la RLS est activée SANS AUCUNE POLICY, donc refuse par
-- défaut. Vérifié en base, `SET ROLE authenticated` : la lecture rend « 0 ligne,
-- aucune erreur » (filtrée par la RLS) là où `get_app_config()` rend « 42501 »
-- (refusée par le privilège). Les deux se ressemblent de l'extérieur ; ce sont
-- deux verrous très différents.
--
-- Le verrou en place est donc l'ABSENCE de quelque chose. Une seule policy
-- `FOR ALL` écrite un jour sur cette table — à la main, ou par un script qui
-- « harmonise » la RLS du schéma — rend la clé lisible à tout compte connecté.
-- Ce dépôt connaît déjà ce raisonnement et l'a écrit pour une autre table
-- (20260802210000_team_invitations_rls_role_gate.sql) :
--
--     « la première policy `FOR ALL` écrite un jour ici le rouvrirait sans que
--       personne ne le remarque »
--
-- C'est le même piège, sur une table dont le contenu est une clé.
--
-- ⚠ POURQUOI CE N'EST PAS UN CHANGEMENT DE COMPORTEMENT — et pourquoi la
-- question méritait d'être posée. Révoquer n'est pas neutre en général : une
-- lecture bloquée par la RLS rend `{data: [], error: null}`, bloquée par le
-- GRANT elle rend une ERREUR. Un appelant réel passerait donc d'un silence à un
-- échec visible. Vérifié avant d'écrire, sur les trois chemins possibles :
--   1. le FRONT ne touche jamais cette table — aucune occurrence de
--      `.from('app_config')` dans `src/` (les mentions y sont des commentaires,
--      et `useFocusConfig.ts` dit déjà « le client ne peut pas lire app_config
--      directement ») ;
--   2. les 33 fonctions qui lisent `app_config` sont TOUTES `SECURITY DEFINER`
--      (relevé en base) — elles s'exécutent donc sous leur propriétaire et sont
--      insensibles à ce REVOKE. Les wrappers exposés au client
--      (`get_today_focus_config`, `get_contact_score_config`,
--      `get_property_score_config`, `get_market_rent_reference_config`,
--      `get_admin_plans_board`…) continuent de fonctionner à l'identique ;
--      c'est précisément pour cela qu'ils existent — n'exposer qu'une clé, jamais
--      toute la table ;
--   3. les tests backend qui écrivent dans `app_config` passent tous par un
--      client service_role (`svc`), que ce REVOKE n'affecte pas.
-- Aucun appelant ne change d'issue.
--
-- PORTÉE : cette table seulement. `get_app_config(text)` a déjà été refermée le
-- 05.07.2026 (20260705190000) et le contrôle ci-dessous ne la retouche pas ;
-- `TRUNCATE` a déjà quitté les deux rôles le 03.08.2026 (20260803200312). Ce
-- fichier ne fait que retirer les quatre verbes restants, qui n'ont pas d'usage.

BEGIN;

-- `anon` n'a déjà plus rien ici (vérifié en base) : la ligne est écrite pour que
-- l'état reste vrai après une reconstruction depuis les migrations, où le
-- baseline (l.8565) ré-accorderait `ALL` aux deux rôles.
REVOKE ALL ON TABLE public.app_config FROM anon;

-- `authenticated` n'a aucun usage de cette table : tout passe par des wrappers
-- SECURITY DEFINER qui n'exposent qu'une clé nommée.
REVOKE ALL ON TABLE public.app_config FROM authenticated;

COMMENT ON TABLE public.app_config IS
  'Configuration serveur ET magasin de secret : la ligne `service_role_key` est '
  'une clé de service vivante, rejouée en Bearer par les tâches pg_cron. '
  'Lecture réservée à service_role. Le client passe par un wrapper SECURITY '
  'DEFINER par clé (get_today_focus_config, get_contact_score_config, …) — '
  'ne JAMAIS accorder de privilège de table ni écrire de policy `FOR ALL` ici : '
  'ce serait exposer la clé à tout compte connecté. '
  'Voir docs/audits/2026-08-04-blast-radius-service-role.md §4.1.';

COMMIT;
