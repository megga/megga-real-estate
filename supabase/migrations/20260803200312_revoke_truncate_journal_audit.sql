-- `TRUNCATE` sort des mains d'`anon` et d'`authenticated`, et le journal d'audit
-- devient réellement inaltérable.
--
-- Constat : docs/audits/2026-08-03-rls-isolation-multi-agence.md §7.
--
-- POURQUOI `TRUNCATE` EST À PART, ET POURQUOI AUCUN GARDE EXISTANT NE L'ARRÊTE.
-- La RLS filtre des LIGNES : elle s'applique à SELECT, INSERT, UPDATE, DELETE.
-- `TRUNCATE` n'est pas une opération ligne-à-ligne — aucune policy ne le voit
-- passer. Le trigger `enforce_activity_events_immutability()` ne le voit pas non
-- plus : c'est un trigger FOR EACH ROW, et `TRUNCATE` ne déclenche pas les
-- triggers ligne-à-ligne. Les deux verrous qui protègent ce journal sont donc
-- aveugles à la seule commande capable de le vider d'un coup.
--
-- Le COMMENT de la fonction affirme « journal append-only (LBA art. 7) » et la
-- migration 20260801420000 raisonne sur l'art. 7 al. 3 (conservation dix ans).
-- Tant qu'`anon` et `authenticated` détiennent `TRUNCATE`, cette affirmation est
-- fausse : c'est un écart de CONFORMITÉ autant que de sécurité.
--
-- CE QUE CE CORRECTIF NE PRÉTEND PAS ÊTRE. `TRUNCATE` n'est aujourd'hui joignable
-- par AUCUN chemin applicatif : PostgREST ne l'expose pas, et ni `anon` ni
-- `authenticated` ne sont des identifiants de connexion — ce sont les rôles que
-- PostgREST endosse. Le risque n'est donc pas ouvert : il le deviendrait à la
-- première fonction `SECURITY INVOKER` faisant du SQL dynamique. C'est de la
-- défense en profondeur, et le raisonnement de 20260801410000 s'applique mot pour
-- mot : « la RLS tient » est une phrase au présent.
--
-- ⚠ POURQUOI CE N'EST PAS UN CHANGEMENT DE COMPORTEMENT — révoquer n'est pas
-- neutre en général (une lecture bloquée par la RLS rend `{data: [], error: null}`,
-- bloquée par le GRANT elle rend une ERREUR). Ici la question ne se pose pas pour
-- `TRUNCATE`, qu'aucun client ne peut émettre. Elle se poserait pour `UPDATE` et
-- `DELETE` sur activity_events, révoqués plus bas — vérifié : la table n'a AUCUNE
-- policy UPDATE ni DELETE, ces deux verbes sont donc déjà refusés par la RLS pour
-- `authenticated`. Le seul écrivain réel est `service_role` (hors RLS), et les
-- UPDATE légitimes émis par les FK `ON DELETE SET NULL` tournent sous le rôle qui
-- supprime le profil ou l'agence — jamais `authenticated`. Aucun appelant ne
-- change d'issue : il passe d'un refus RLS à un refus de privilège.
--
-- PORTÉE : le schéma entier pour `TRUNCATE`, parce que le trou est partout (~70
-- tables l'accordent aux deux rôles) et que la révocation est sans effet
-- fonctionnel. `SELECT`, `INSERT`, `UPDATE` et `DELETE` ne sont PAS touchés
-- ailleurs : ceux-là servent réellement, et la RLS est leur garde légitime.
--
-- ⚠ RÉSIDUEL ASSUMÉ : `revoke ... on all tables` ne vaut que pour les tables
-- EXISTANTES. Supabase accorde ses droits par défaut à la création, donc une table
-- créée par une migration ultérieure naîtra de nouveau avec `TRUNCATE`. On ne
-- touche pas aux `default privileges` de la plateforme (ils sont gérés par
-- Supabase, les écraser créerait une dérive plus difficile à lire que le problème
-- résolu). Le filet est `scripts/check-privilege-drift.mjs`, qui interroge la
-- PRODUCTION — seul endroit où une dérive de privilège se constate.

revoke truncate on all tables in schema public from anon;
revoke truncate on all tables in schema public from authenticated;

-- Le journal d'audit, un cran plus loin que le reste du schéma.
-- `anon` n'a aucune raison de toucher la piste d'audit LAB/KYC, sous aucun verbe :
-- ses deux policies de lecture et d'écriture sont `TO authenticated`, et les deux
-- policies super-admin exigent `is_super_admin()`, donc une identité.
revoke all on table public.activity_events from anon;

-- `authenticated` garde exactement ce dont ses policies ont besoin — `SELECT`
-- (events_select) et `INSERT` (events_insert) — et rien de plus.
revoke update, delete on table public.activity_events from authenticated;
