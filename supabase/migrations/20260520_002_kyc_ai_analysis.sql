-- ============================================================================
-- Migration: KYC AI Analysis Column — Claude Sonnet 4 contextual layer
-- Date: 2026-05-20 (Sprint 4.5)
--
-- Sprint 4.5 — Ajoute une couche d'analyse contextuelle IA (Claude Sonnet 4)
-- en complément du screening factuel Dilisense :
--
--  - Dilisense (factuel) : interroge listes officielles OFAC/SECO/UE/ONU.
--    Retourne match clear/match avec source_id traçable. C'est la couche
--    obligatoire FINMA — preuve réglementaire.
--
--  - Claude Sonnet 4 (contextuel) : analyse les facteurs au-delà des
--    listes — patterns suspects (structuring, smurfing), cohérence
--    profil/montant, recommandations de vigilance, justifications
--    texte pour le compliance officer. Couche d'assistance MLRO.
--
-- L'analyse Sonnet est OPTIONNELLE (graceful degradation) :
--  - Si ANTHROPIC_API_KEY absent → on skip et ai_analysis reste NULL
--  - Si l'API plante → on continue avec Dilisense seul
--
-- Format JSONB stocké (cf. supabase/functions/kyc-screening/index.ts) :
--   {
--     provider: 'claude-sonnet-4-6',
--     analyzed_at: '2026-05-20T...',
--     qualitative_risk: 'low' | 'medium' | 'high' | 'critical',
--     vigilance_recommendation: 'standard' | 'renforced' | 'escalation_mlro',
--     patterns_detected: ['unusual_pattern_X', ...],
--     justification: 'Texte 2-3 phrases en français',
--     additional_checks_suggested: ['...'],
--     confidence: 0.85,
--     prompt_tokens: 1234,
--     completion_tokens: 567
--   }
-- ============================================================================

ALTER TABLE kyc_cases ADD COLUMN IF NOT EXISTS ai_analysis JSONB;

COMMENT ON COLUMN kyc_cases.ai_analysis IS
  'Sprint 4.5 — Analyse contextuelle Claude Sonnet 4 (couche assistance MLRO). Complète le screening Dilisense factuel. Format JSONB : { provider, analyzed_at, qualitative_risk, vigilance_recommendation, patterns_detected[], justification, additional_checks_suggested[], confidence }.';

-- Index partiel pour filtrer rapidement les dossiers à risque élevé selon l'IA
-- (dashboard MLRO : SELECT WHERE ai_analysis->>'qualitative_risk' IN ('high','critical'))
CREATE INDEX IF NOT EXISTS idx_kyc_cases_ai_qualitative_risk
  ON kyc_cases ((ai_analysis->>'qualitative_risk'))
  WHERE ai_analysis IS NOT NULL;
