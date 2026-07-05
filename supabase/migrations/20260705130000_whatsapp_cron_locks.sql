-- Anti-chevauchement des exécutions de whatsapp-process (P2).
--
-- Le cron whatsapp-process-minute tire la fonction toutes les 60 s (net.http_post,
-- fire-and-forget), mais BUDGET_MS = 90 s : le code lui-même prévoit de dépasser la
-- minute. Deux instances peuvent donc tourner en parallèle. La Phase 1 (média) est
-- protégée (claim_whatsapp_jobs, FOR UPDATE SKIP LOCKED), mais la Phase 2 (insights
-- DeepSeek) et la Phase 3 (avis LPD) ne le sont pas → double coût DeepSeek et, pire,
-- avis LPD envoyé DEUX FOIS au même client.
--
-- Solution : un « lease » atomique en base (pas un advisory lock de session, non fiable
-- via le pooler transaction-mode de Supabase). whatsapp-process ne traite que s'il
-- décroche le verrou par un UPDATE conditionnel (locked_until < now()), et le relâche à
-- la fin. Le TTL (côté app, 120 s > budget) sert de filet en cas de crash.
--
-- Service-role only (RLS activée sans policy). La ligne est seedée avec un locked_until
-- passé pour que le premier claim réussisse.

BEGIN;

CREATE TABLE IF NOT EXISTS public.whatsapp_cron_locks (
  job          text        PRIMARY KEY,
  locked_until timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_cron_locks ENABLE ROW LEVEL SECURITY;

INSERT INTO public.whatsapp_cron_locks (job, locked_until)
  VALUES ('whatsapp-process', now() - interval '1 hour')
  ON CONFLICT (job) DO NOTHING;

COMMIT;
