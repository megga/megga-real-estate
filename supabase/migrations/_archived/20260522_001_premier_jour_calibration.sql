-- Premier jour (Day 0 calibration) — persistance one-shot sur profiles.
--
-- Ajoute trois colonnes :
--   - first_day_done             : flag idempotence (l'écran ne se rejoue jamais)
--   - day0_payload               : snapshot des 4 réponses + autonomy
--   - first_day_completed_at     : horodatage pour analytics / nLPD
--   - activation_checklist       : JSONB persistant pour la pastille
--                                  "Activation" (5 items) bas-droite du Today
--
-- Voir handoff-premier-jour/HANDOFF_PREMIER_JOUR_CLAUDE_CODE.md §"Modèle de données".

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS first_day_done           BOOLEAN     DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS day0_payload             JSONB,
  ADD COLUMN IF NOT EXISTS first_day_completed_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS activation_checklist     JSONB;

-- Backfill : tous les profils dont l'onboarding est déjà complété avant cette
-- migration sont marqués first_day_done = TRUE pour ne pas leur rejouer le sas
-- (utilisateurs existants en bêta).
UPDATE profiles
   SET first_day_done = TRUE
 WHERE onboarding_completed = TRUE
   AND first_day_done IS DISTINCT FROM TRUE;

COMMENT ON COLUMN profiles.first_day_done IS
  'Premier jour (Day 0 calibration) joué — one-shot. Voir handoff-premier-jour.';
COMMENT ON COLUMN profiles.day0_payload IS
  'Snapshot du calibrage : { specialite, zone[], dispo, priorite, autonomy }.';
COMMENT ON COLUMN profiles.first_day_completed_at IS
  'Horodatage de complétion du Premier jour (UTC).';
COMMENT ON COLUMN profiles.activation_checklist IS
  'Checklist d''activation 5 items (Premier jour Today + persistance dashboard).';
