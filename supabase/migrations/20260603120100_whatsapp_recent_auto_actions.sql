-- Filet d'undo des actions auto WhatsApp (Palier 3). Après une action réversible exécutée
-- en auto (ex. déplacement pipeline en mode resume), on enregistre de quoi la DÉFAIRE et
-- jusqu'à quand (undo_until). La commande « /annuler » de l'agent, dans la fenêtre, rejoue
-- le payload_undo. Additif + idempotent. RLS ON sans policy (service_role only — back-office).

BEGIN;

CREATE TABLE IF NOT EXISTS public.whatsapp_recent_auto_actions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id    uuid NOT NULL,
  agency_id     uuid NULL,
  tool          text NOT NULL                  -- seul outil auto-annulable en P3 ; Palier 3b élargira ce CHECK (DROP+ADD) aux autres outils auto
                  CHECK (tool IN ('update_pipeline')),
  payload_undo  jsonb NOT NULL,                -- de quoi défaire (ex. {transaction_id, old_stage})
  created_at    timestamptz NOT NULL DEFAULT now(),
  undo_until    timestamptz NOT NULL,          -- fin de la fenêtre d'undo
  undone_at     timestamptz NULL               -- posé quand l'undo est consommé (anti-rejeu)
);

ALTER TABLE public.whatsapp_recent_auto_actions ENABLE ROW LEVEL SECURITY;

-- Le handler /annuler cherche la dernière action encore annulable d'un agent.
CREATE INDEX IF NOT EXISTS idx_wa_recent_auto_undoable
  ON public.whatsapp_recent_auto_actions (profile_id, created_at DESC)
  WHERE undone_at IS NULL;

COMMIT;
