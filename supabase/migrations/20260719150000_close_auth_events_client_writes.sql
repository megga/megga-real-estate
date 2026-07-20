-- Ferme les écritures client sur le journal d'audit auth (auth_events).
--
-- Constat (investigation signup du 19.07.2026) : le fallback client de
-- auditLog.ts (INSERT direct anon/authenticated quand l'edge function
-- log-auth-event ne répond pas) était DÉJÀ silencieusement bloqué — RLS actif
-- avec une seule policy (auth_events_select_super_admin, SELECT). Le grant
-- INSERT hérité laissait pourtant croire le chemin ouvert (footgun « GRANT ALL
-- à anon » des privilèges par défaut).
--
-- Décision : le SEUL producteur est l'edge function log-auth-event
-- (service_role, hash IP côté serveur, user-agent lu des en-têtes). Rouvrir une
-- écriture anon sur une table d'audit serait un vecteur de spam avec la clé
-- anon publique — même classe de piège que celle fermée par #889/#896. On
-- aligne donc les GRANTS sur la réalité :
--   · anon : plus aucun privilège (la policy SELECT super_admin ne peut de
--     toute façon jamais passer pour anon) ;
--   · authenticated : SELECT seul (support de la policy super_admin), tous les
--     privilèges d'écriture révoqués.
-- service_role contourne la RLS : l'edge function n'est pas affectée. Le
-- fallback client est retiré de auditLog.ts dans le même changement.
--
-- REVOKE est naturellement idempotent → migration rejouable le jour même
-- (deploy.yml rejoue tout stamp >= aujourd'hui, leçon #894).

REVOKE ALL ON TABLE public.auth_events FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.auth_events FROM authenticated;
