-- ============================================================================
-- Tier 3 mail/calendar : enrichissement IA sur email_messages_cache
-- Created: 2026-05-18
--
-- Colonnes ajoutées :
--   - ai_classification : enum textuel
--   - ai_priority : score 0-100 (importance perçue par l'IA)
--   - ai_intents : tableau d'intentions détectées (jsonb)
--   - ai_suggested_replies : 2-3 réponses pré-rédigées par l'IA (jsonb)
--   - ai_classified_at : timestamp du dernier traitement IA
--
-- Le check constraint sur ai_classification accepte 5 valeurs métier.
-- Tout est optionnel : un message peut exister sans classification (cache brut),
-- la classification est appliquée à la demande de l'agent (UI button) pour
-- contrôler la consommation de tokens Claude.
-- ============================================================================

BEGIN;

ALTER TABLE email_messages_cache
  ADD COLUMN IF NOT EXISTS ai_classification TEXT
    CHECK (ai_classification IS NULL OR ai_classification IN (
      'lead_chaud', 'lead_tiede', 'question_simple', 'spam', 'interne'
    )),
  ADD COLUMN IF NOT EXISTS ai_priority SMALLINT
    CHECK (ai_priority IS NULL OR (ai_priority >= 0 AND ai_priority <= 100)),
  ADD COLUMN IF NOT EXISTS ai_intents JSONB,
  ADD COLUMN IF NOT EXISTS ai_suggested_replies JSONB,
  ADD COLUMN IF NOT EXISTS ai_classified_at TIMESTAMPTZ;

-- Index pour requêter rapidement les leads chauds non traités
CREATE INDEX IF NOT EXISTS idx_email_cache_hot_leads
  ON email_messages_cache(user_id, ai_priority DESC, sent_at DESC)
  WHERE ai_classification = 'lead_chaud';

COMMENT ON COLUMN email_messages_cache.ai_classification IS
  'Classification IA du message — lead_chaud, lead_tiede, question_simple, spam, interne. NULL si pas encore traité.';
COMMENT ON COLUMN email_messages_cache.ai_priority IS
  'Score 0-100 — importance perçue (urgence, valeur business). NULL si pas classifié.';
COMMENT ON COLUMN email_messages_cache.ai_intents IS
  'Array d''intentions détectées : ["request_visit", "ask_price", "negative_signal", ...]';
COMMENT ON COLUMN email_messages_cache.ai_suggested_replies IS
  'Array d''objets {label, body} — 2-3 brouillons de réponse que l''agent peut envoyer en 1 click.';

COMMIT;
