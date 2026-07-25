-- Convergence mémoire cross-canal WhatsApp ⇄ MEGGA AI (chantier A2+A3 de l'éval 10 juil.).
--
-- (1) « Contact chaud » par agent : posé fire-and-forget quand un exécuteur (partagé
--     par les DEUX canaux) résout un contact ; relu au tour suivant par whatsapp-agent
--     ET ai-copilot (agent_ai_profiles est déjà fetchée à chaque tour → 0 lecture ajoutée).
--     FK ON DELETE SET NULL : un contact supprimé (delete_contact) ne laisse pas de
--     pointeur pendouillant.
-- (2) Mémoire CRM par contact : le copilote distille ses tours « contact » dans le
--     dossier par-contact EXISTANT (whatsapp_conversation_insights, clé contact_id
--     UNIQUE). Colonnes ADDITIVES : le cron whatsapp-process et le write-back CRM ne
--     fournissent jamais les colonnes de l'autre → aucun écrasement croisé possible
--     (upsert PostgREST n'UPDATE que les colonnes fournies).
BEGIN;

ALTER TABLE public.agent_ai_profiles
  ADD COLUMN IF NOT EXISTS hot_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hot_contact_at timestamptz;

ALTER TABLE public.whatsapp_conversation_insights
  ADD COLUMN IF NOT EXISTS crm_summary text,
  ADD COLUMN IF NOT EXISTS crm_summary_updated_at timestamptz;

-- Garde-fou taille (même discipline que rolling_summary : borné côté code à 800c,
-- le CHECK est le filet si un appelant contourne le clamp). DROP IF EXISTS des DEUX
-- noms avant le ADD : la CI rejoue les migrations datées du jour à chaque push sur
-- main, et l'ancien nom wci_crm_summary_len a déjà tourné en live.
ALTER TABLE public.whatsapp_conversation_insights DROP CONSTRAINT IF EXISTS wci_crm_summary_len;
ALTER TABLE public.whatsapp_conversation_insights DROP CONSTRAINT IF EXISTS whatsapp_conversation_insights_crm_summary_check;
ALTER TABLE public.whatsapp_conversation_insights
  ADD CONSTRAINT whatsapp_conversation_insights_crm_summary_check CHECK (crm_summary IS NULL OR char_length(crm_summary) <= 1200);

COMMENT ON COLUMN public.agent_ai_profiles.hot_contact_id IS 'Dernier contact résolu par un exécuteur IA (WhatsApp OU copilote) — mémoire cross-canal, TTL logique 6h côté code.';
COMMENT ON COLUMN public.agent_ai_profiles.hot_contact_at IS 'Horodatage de la dernière résolution du contact chaud.';
COMMENT ON COLUMN public.whatsapp_conversation_insights.crm_summary IS 'Résumé distillé des tours copilote CRM sur ce contact (≤800c côté code) — pendant du rolling_summary WhatsApp.';
COMMENT ON COLUMN public.whatsapp_conversation_insights.crm_summary_updated_at IS 'Dernière mise à jour du résumé CRM par le distillateur.';

COMMIT;
