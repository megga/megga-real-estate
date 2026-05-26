-- ============================================================================
-- MEGGA Real Estate — Migration : targets de revenu par agence
-- ============================================================================
-- Sprint B Dashboard Analytics : remplace le calcul heuristique
-- `target = projected * 1.15` par une vraie cible saisie par l'agence.
-- ============================================================================

ALTER TABLE agencies
  ADD COLUMN IF NOT EXISTS monthly_target NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quarterly_target NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS yearly_target NUMERIC(12,2) DEFAULT 0;

COMMENT ON COLUMN agencies.monthly_target IS
  'Objectif de revenu mensuel (commission projetée) — affiché dans le Dashboard Cockpit.';
COMMENT ON COLUMN agencies.quarterly_target IS
  'Objectif de revenu trimestriel — affiché dans le Dashboard Cockpit (toggle period=quarter).';
COMMENT ON COLUMN agencies.yearly_target IS
  'Objectif de revenu annuel — affiché dans le Dashboard Cockpit (toggle period=year).';
