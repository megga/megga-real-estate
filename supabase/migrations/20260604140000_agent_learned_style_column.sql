-- Apprentissage T1 : profil de style appris par agent (jsonb), sur la table Day-0 agent_ai_profiles.
-- Additif + idempotent. NULL = pas encore de style appris (whatsapp-agent garde son prompt figé).
BEGIN;
ALTER TABLE public.agent_ai_profiles
  ADD COLUMN IF NOT EXISTS learned_style jsonb NULL;
COMMENT ON COLUMN public.agent_ai_profiles.learned_style IS
  'Apprentissage T1 : style de comm appris par agent { language, formality, emoji, traits, status(suggested|active|off), updated_at, sample_count }. Injecté dans whatsapp-agent UNIQUEMENT si status=active (human-in-the-loop). Distillé par learn-agent-style (DeepSeek), jamais de PII.';
COMMIT;
