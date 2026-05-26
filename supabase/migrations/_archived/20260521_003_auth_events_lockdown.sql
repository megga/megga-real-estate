-- Auth events lockdown — restreint les inserts à la service_role uniquement,
-- maintenant que l'edge function `log-auth-event` est en place.
--
-- À appliquer APRÈS avoir déployé l'edge function :
--   supabase functions deploy log-auth-event --no-verify-jwt
--   supabase secrets set AUTH_EVENT_SALT_SECRET="<32+ char secret>"
--
-- Pourquoi ?
--   Sans ce lockdown, n'importe quel client (y compris non authentifié) peut
--   spammer auth_events avec des données arbitraires (faux signin.success,
--   etc.) → l'audit devient bruité voire trompeur.
--   Avec ce lockdown, seul l'edge function (qui utilise service_role) peut
--   écrire, ce qui garantit que chaque event passe par la validation regex
--   sur l'action et le hash d'IP serveur.
--
-- Fallback côté client : si l'edge function est down, le `supabase.from(
-- 'auth_events').insert(...)` échouera silencieusement avec cette policy.
-- C'est le comportement voulu : perdre de la télémétrie plutôt que stocker
-- des données non-vérifiées.

DROP POLICY IF EXISTS auth_events_insert_any ON auth_events;

COMMENT ON POLICY auth_events_select_super_admin ON auth_events IS
  'Select restreint à is_super_admin(). Insert restreint à la service_role via la suppression de auth_events_insert_any — seule l''edge function log-auth-event peut écrire.';
