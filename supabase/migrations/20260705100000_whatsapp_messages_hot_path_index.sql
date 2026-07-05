-- Index du chemin chaud C1 (mémoire conversationnelle de l'agent WhatsApp).
--
-- À CHAQUE message d'un agent, whatsapp-agent charge l'historique 24h via :
--   .or('wa_from.eq.X,wa_to.eq.X')
--   .eq('is_agent_error', false)
--   .gt('created_at', since)
--   .order('created_at', { ascending: false }).limit(12)
-- (supabase/functions/whatsapp-agent/index.ts). Aucun index existant ne couvre ce
-- prédicat : les index actuels portent sur (contact_id, created_at) et
-- (agency_id, created_at). Résultat = seq scan + tri en mémoire, qui grossit
-- linéairement avec le trafic → viole la règle « jamais d'ORDER BY sans index
-- couvrant le WHERE » (CLAUDE.md §7) et s'approche du statement timeout à l'échelle.
--
-- Deux index partiels (un par branche du OR) : le planner les combine en BitmapOr.
-- Chacun couvre l'égalité sur wa_from/wa_to, la borne + le tri DESC sur created_at,
-- et exclut les réponses d'échec de l'agent via le prédicat partiel (colonne
-- is_agent_error NOT NULL DEFAULT false, migration 20260603100000).
--
-- Additif, IF NOT EXISTS, aucune donnée touchée. Posé maintenant, tant que la table
-- est petite (pré-pilote) : la pose est immédiate et le pilote ne dégrade plus la
-- latence de réponse du copilote.

BEGIN;

CREATE INDEX IF NOT EXISTS idx_wa_messages_wafrom_created
  ON public.whatsapp_messages (wa_from, created_at DESC)
  WHERE wa_from IS NOT NULL AND is_agent_error = false;

CREATE INDEX IF NOT EXISTS idx_wa_messages_wato_created
  ON public.whatsapp_messages (wa_to, created_at DESC)
  WHERE wa_to IS NOT NULL AND is_agent_error = false;

COMMIT;
