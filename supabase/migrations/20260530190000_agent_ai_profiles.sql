-- agent_ai_profiles — contexte IA personnalisé par agent, provisionné au Day 0.
--
-- Phase 2+4 de l'écran d'activation « atterrissage » : quand l'agent atteint
-- l'écran d'activation (après le calibrage Premier jour), l'edge function
-- `day0-activation-setup` lance un VRAI setup en arrière-plan :
--   1. persiste les réponses (profiles.day0_payload),
--   2. dérive les préférences déterministes (compute_agent_preferences — déjà
--      consommées par score-engine / matching-engine / automation-engine),
--   3. génère via LLM un BRIEF de personnalisation (system_addendum + 3 priorités
--      du jour + axes de focus) pour adapter MEGGA AI au besoin de l'agent,
--   4. stocke le tout ici (status 'ready'), ce qui débloque l'écran (signal prêt).
--
-- Ce n'est pas « fake » : les préférences pilotent réellement les moteurs, et le
-- brief est destiné à être injecté dans le system prompt du copilote.
--
-- RLS :
--   - authenticated : l'agent lit SON profil (+ super_admin lit tout).
--   - service_role  : l'edge function écrit (bypass RLS).
-- Aucune policy INSERT/UPDATE pour authenticated → écriture réservée au backend.

BEGIN;

CREATE TABLE IF NOT EXISTS public.agent_ai_profiles (
  agent_id        uuid        PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  agency_id       uuid        NULL REFERENCES public.agencies(id) ON DELETE SET NULL,

  -- 'ready'        : provisioning terminé (prefs + brief disponibles)
  -- 'error'        : le setup a échoué (l'agent n'est jamais bloqué côté UI)
  -- 'provisioning' : réservé pour un mode asynchrone futur
  status          text        NOT NULL DEFAULT 'ready',

  -- Snapshot de compute_agent_preferences() (SLA window, autonomy gate, poids
  -- priorité). Source dérivée du calibrage, dupliquée ici pour traçabilité.
  preferences     jsonb       NOT NULL DEFAULT '{}'::jsonb,

  -- Brief de personnalisation généré par LLM :
  --   { summary, focus[], tone, priorities:[{title,why}], system_addendum }
  -- `system_addendum` est le bloc injecté dans le system prompt du copilote.
  brief           jsonb       NOT NULL DEFAULT '{}'::jsonb,

  -- Provider qui a généré le brief ('claude-sonnet' | 'claude-haiku' | 'fallback').
  model           text        NULL,

  -- Snapshot des réponses du calibrage au moment du setup (audit / re-génération).
  source_answers  jsonb       NULL,

  generated_at    timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT agent_ai_profiles_status_check
    CHECK (status IN ('ready', 'error', 'provisioning'))
);

-- Vue agence (super-admin monitoring / audit).
CREATE INDEX IF NOT EXISTS idx_agent_ai_profiles_agency
  ON public.agent_ai_profiles (agency_id, generated_at DESC);

ALTER TABLE public.agent_ai_profiles ENABLE ROW LEVEL SECURITY;

-- L'agent lit son propre profil IA ; le super-admin lit tout (debug/monitoring).
DROP POLICY IF EXISTS agent_ai_profiles_select_own ON public.agent_ai_profiles;
CREATE POLICY agent_ai_profiles_select_own
  ON public.agent_ai_profiles
  FOR SELECT
  TO authenticated
  USING (
    agent_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

-- Pas de policy INSERT/UPDATE/DELETE pour authenticated : seul service_role écrit
-- (RLS activé sans policy = refus par défaut pour les end-users).

COMMENT ON TABLE public.agent_ai_profiles IS
  'Contexte IA personnalisé par agent, provisionné au Day 0 (edge day0-activation-setup). preferences = compute_agent_preferences snapshot ; brief = personnalisation LLM (system_addendum injecté dans le copilote). Écrit par service_role uniquement.';

COMMIT;
