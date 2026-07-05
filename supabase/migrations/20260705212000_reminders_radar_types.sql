-- Radar de signaux (fin de Phase 3) : deux nouveaux TYPES de rappel produits par
-- des détecteurs déterministes de automation-engine (gated automation_radar_enabled).
--   deal_stagnant  : dossier actif sans avancement depuis N jours
--   match_ignored  : correspondance forte (score élevé) jamais envoyée depuis N jours
-- Des types DISTINCTS (et non 'custom') pour une DÉDUP propre par (contact, type).
-- Ces rappels nourrissent la file Focus ET le copilote (suggest_priorities_today).

BEGIN;

ALTER TABLE public.reminders DROP CONSTRAINT IF EXISTS reminders_type_check;
ALTER TABLE public.reminders ADD CONSTRAINT reminders_type_check CHECK (
  type = ANY (ARRAY[
    'follow_up_sent_property'::text,
    'post_visit_feedback'::text,
    'dormant_lead'::text,
    'missing_document'::text,
    'price_change'::text,
    'custom'::text,
    'deal_stagnant'::text,
    'match_ignored'::text
  ])
);

-- Kill-switch du radar (défaut OFF). Les 6 détecteurs historiques ne sont PAS
-- affectés ; seuls les 2 nouveaux détecteurs sont gardés par ce flag.
INSERT INTO public.app_config (key, value)
VALUES ('automation_radar_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

COMMIT;
