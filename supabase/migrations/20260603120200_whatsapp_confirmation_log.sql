-- Journal des confirmations agent (oui/non) par outil — PREMIÈRE BRIQUE de « MEGGA apprend
-- l'agent » (cerveau megga-ai-agent-learning). Sert plus tard à SUGGÉRER (à un humain, UI
-- super-admin) de monter l'autonomie après N « oui » sans « non ». MEGGA observe, n'élève
-- rien toute seule. Additif + idempotent. RLS ON sans policy (service_role only).

BEGIN;

CREATE TABLE IF NOT EXISTS public.whatsapp_confirmation_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  uuid NOT NULL,
  agency_id   uuid NULL,
  tool        text NOT NULL,
  outcome     text NOT NULL CHECK (outcome IN ('yes','no')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_confirmation_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_wa_confirmation_log_profile_tool
  ON public.whatsapp_confirmation_log (profile_id, tool, created_at DESC);

COMMIT;
