-- Marque les réponses outbound de l'agent qui sont des ÉCHECS (IA indispo, "je n'ai
-- pas compris", boucle épuisée, occupé…). La mémoire conversationnelle C1 (24h) les
-- EXCLUT, sinon MEGGA relit ses propres erreurs comme du contexte valide et les
-- ré-écho (cf. brain whatsapp-copilot-lessons, leçon 5). Additif, défaut false :
-- aucune ligne existante n'est affectée. RLS inchangée (service_role écrit, policy
-- whatsapp_messages_agency_select lit — 20260528150000).

BEGIN;

ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS is_agent_error boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.whatsapp_messages.is_agent_error IS
  'true = réponse agent en échec/dégradée, exclue de la mémoire conversationnelle C1';

COMMIT;
