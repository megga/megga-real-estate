-- Observabilité de l'usage des outils du copilote WhatsApp (MVP — cerveau
-- megga/whatsapp-observability-backlog). Capture CHAQUE appel d'outil de la boucle DeepSeek de
-- whatsapp-agent : QUEL outil, QUEL tier, QUEL outcome (executed / confirm_pending / async_queued /
-- busy / error). Métalevier pour décider quoi améliorer (outils jamais utilisés, taux d'erreur).
--
-- PII-SAFE par construction : on ne stocke QUE tool / tier / outcome (+ agency_id / profile_id pour
-- le scope RLS). JAMAIS les arguments d'outil ni le contenu du message — garde dure.
--
-- Le log est fire-and-forget côté edge (jamais await) : l'UX du copilote ne dépend pas de cette table.
-- Pas de FK (comme whatsapp_confirmation_log) : un insert ne doit JAMAIS échouer sur une course de
-- suppression de profil/agence et bloquer la boucle d'outils.
--
-- RLS : super_admin (ALL) — données CROSS-AGENCE sensibles ; agence (SELECT own) ; écriture =
-- service_role (le edge), qui bypass la RLS. Additif + idempotent.

BEGIN;

CREATE TABLE IF NOT EXISTS public.whatsapp_tool_usage (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  agency_id   uuid        NULL,
  profile_id  uuid        NOT NULL,
  tool        text        NOT NULL,
  tier        text        NOT NULL CHECK (tier IN ('read','auto','confirm','slow_async')),
  outcome     text        NOT NULL CHECK (outcome IN ('executed','confirm_pending','async_queued','busy','error'))
);

ALTER TABLE public.whatsapp_tool_usage ENABLE ROW LEVEL SECURITY;

-- authenticated : voit l'usage de SON agence (miroir des autres tables WhatsApp).
DROP POLICY IF EXISTS "wa_tool_usage_agency_select" ON public.whatsapp_tool_usage;
CREATE POLICY "wa_tool_usage_agency_select"
  ON public.whatsapp_tool_usage
  FOR SELECT TO authenticated
  USING (agency_id = public.get_my_agency_id());

-- super_admin : tout (lecture cross-agence pour l'observabilité).
DROP POLICY IF EXISTS "wa_tool_usage_super_admin_all" ON public.whatsapp_tool_usage;
CREATE POLICY "wa_tool_usage_super_admin_all"
  ON public.whatsapp_tool_usage
  FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
-- Écriture : service_role uniquement (le edge whatsapp-agent), bypass RLS — pas de policy INSERT.

-- Index aligné sur la récence (cerveau : « created_at desc, tool »).
CREATE INDEX IF NOT EXISTS idx_wa_tool_usage_created_tool
  ON public.whatsapp_tool_usage (created_at DESC, tool);

COMMIT;
