-- Hygiène de reconstruction (relevé par l'audit du morning brief, pré-existant).
--
-- Le baseline (l.8251-8252) GRANT encore get_app_config à anon/authenticated. En prod
-- LIVE c'est déjà révoqué (EXECUTE limité à postgres/service_role, vérifié), mais
-- toute base RECONSTRUITE depuis les migrations (branche Supabase de preview, shadow
-- DB, futur environnement) ré-exposerait app_config.service_role_key à n'importe quel
-- client anon — la clé même que comparent les gardes des edge functions cron
-- (whatsapp-process, whatsapp-agent-async, whatsapp-morning-brief…).
--
-- Idempotent : aligne le repo sur l'état live sans toucher la prod.

BEGIN;

REVOKE ALL ON FUNCTION public.get_app_config(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_app_config(text) TO service_role;

COMMIT;
