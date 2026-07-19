-- Ferme le vecteur d'écriture anon sur public.contacts.
--
-- CONTEXTE
-- La policy `contacts_anon_onboarding_insert` autorisait le rôle `anon` à
-- INSÉRER dans contacts, avec pour seule contrainte `source = 'onboarding'` :
--
--   CREATE POLICY contacts_anon_onboarding_insert ON contacts
--     FOR INSERT TO anon WITH CHECK (source = 'onboarding');
--
-- Le WITH CHECK ne contraignait QUE `source`. Rien sur `agency_id`. La clé anon
-- étant publique par conception (hardcodée dans src/lib/supabase.ts — la sécurité
-- repose sur la RLS, pas sur l'obscurité), n'importe qui pouvait écrire un contact
-- dans le carnet de N'IMPORTE QUELLE agence en choisissant librement agency_id,
-- identité LBA comprise (birth_date, nationality, residence_country, home_address).
--
-- Écriture seule : la lecture était déjà fermée (aucune policy SELECT pour anon),
-- vérifié empiriquement — anon reçoit 0 ligne.
--
-- POURQUOI ON PEUT LA SUPPRIMER
-- Le flux d'onboarding post-login qui écrivait `source='onboarding'` a été retiré
-- en #876 (« agence solo auto au signup ») : la provision d'agence passe désormais
-- par la RPC `create_agency_and_join`, appelée par un utilisateur AUTHENTIFIÉ.
-- Plus aucun écrivain applicatif n'insère en tant qu'anon — vérifié sur src/,
-- supabase/functions/, sites/ (vitrine) et scripts/ :
--   · src/         → un seul insert (useCreateContact), derrière useAuth()
--   · edge fns     → service_role, ou clé anon + JWT de l'appelant (donc `authenticated`)
--   · sites/       → la vitrine ne fait que du client.auth.* (signUp/signIn), aucune écriture table
-- En base, `source='onboarding'` compte 5 contacts, le plus récent du 2026-05-18,
-- soit antérieur au retrait du flux. La porte était morte.
--
-- DONNÉES : aucune. On retire une permission d'écriture, pas des lignes.
-- Les 5 contacts existants restent intacts.

BEGIN;

DROP POLICY IF EXISTS contacts_anon_onboarding_insert ON public.contacts;

-- Défense en profondeur : le baseline porte `GRANT ALL ON TABLE public.contacts
-- TO anon`, donc anon conserve les privilèges table (INSERT/UPDATE/DELETE/SELECT)
-- et seule la RLS l'arrête. Sans policy permissive la table est déjà fermée, mais
-- garder le GRANT laisse contacts à une policy distraite près d'être exposée —
-- exactement la classe de bug qu'on corrige ici (une policy qui oublie de
-- contraindre). On retire le privilège : plus rien côté anon ne doit toucher
-- contacts, ni en lecture ni en écriture.
REVOKE ALL ON TABLE public.contacts FROM anon;

COMMIT;
