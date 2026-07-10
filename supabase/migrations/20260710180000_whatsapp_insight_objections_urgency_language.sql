-- Enrichissement de l'insight de conversation (L2, DeepSeek) : 3 signaux de plus
-- extraits du même fil, consommés par get_contact_brief / prepare_meeting.
--   objections : freins EXPLICITES du client (prix, emplacement, timing, financement…)
--   urgency    : niveau d'urgence du besoin (haute | moyenne | faible)
--   language   : langue principale du client dans le fil (fr | de | en | it)
-- Whitelist défensive côté app (parseInsight) — la DB reste permissive (texte/jsonb).
-- Additif : colonnes nullable / défaut [] → aucun impact sur les lignes existantes.

BEGIN;

ALTER TABLE public.whatsapp_conversation_insights
  ADD COLUMN IF NOT EXISTS objections jsonb NOT NULL DEFAULT '[]'::jsonb,  -- freins exprimés
  ADD COLUMN IF NOT EXISTS urgency    text  NULL,                          -- haute | moyenne | faible
  ADD COLUMN IF NOT EXISTS language   text  NULL;                          -- fr | de | en | it

COMMIT;
