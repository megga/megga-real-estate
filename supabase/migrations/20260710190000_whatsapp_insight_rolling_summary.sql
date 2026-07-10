-- Mémoire longue de la compréhension WhatsApp (L2).
-- Le digest ne voit plus que les N DERNIERS messages (fix : il prenait les 30 plus
-- ANCIENS → l'insight se figeait sur le début du fil). Pour ne pas perdre le contexte
-- plus ancien, le cron réinjecte un résumé progressif BORNÉ à chaque tick.
-- Colonne nullable : aucune RLS ni consommateur impacté (les selects sont explicites).

BEGIN;

ALTER TABLE public.whatsapp_conversation_insights
  ADD COLUMN IF NOT EXISTS rolling_summary text NULL;

COMMENT ON COLUMN public.whatsapp_conversation_insights.rolling_summary IS
  'Mémoire longue bornée : résumé progressif de la conversation, réinjecté au prompt à chaque tick '
  '(le digest ne montre que les N derniers messages). Actualisé et borné (~800 car.) par whatsapp-process.';

COMMIT;
