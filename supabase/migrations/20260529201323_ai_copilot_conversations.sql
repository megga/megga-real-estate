-- AI Copilot conversations (Julien chat history).
--
-- Single-table design : `messages` stocké en JSONB (array de {role, content,
-- created_at}). Le chat charge toujours la conversation complète lors d'un
-- clic dans l'historique — pas de pagination message-level utile.
--
-- RLS : owner-only (user_id = auth.uid()). Pas d'agency scope sur la lecture
-- car une conversation appartient à un seul agent (privé), mais agency_id
-- est conservé pour audit + futures stats par agence.

BEGIN;

CREATE TABLE IF NOT EXISTS public.ai_copilot_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Nouvelle conversation',
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index pour ORDER BY last_message_at DESC (liste History)
CREATE INDEX IF NOT EXISTS idx_ai_copilot_conv_user_recent
  ON public.ai_copilot_conversations (user_id, last_message_at DESC)
  WHERE archived = false;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.ai_copilot_conv_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ai_copilot_conv_touch ON public.ai_copilot_conversations;
CREATE TRIGGER trg_ai_copilot_conv_touch
  BEFORE UPDATE ON public.ai_copilot_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.ai_copilot_conv_touch_updated_at();

ALTER TABLE public.ai_copilot_conversations ENABLE ROW LEVEL SECURITY;

-- Owner-only : un agent voit/édite seulement SES conversations
DROP POLICY IF EXISTS "ai_copilot_conv_owner_select" ON public.ai_copilot_conversations;
CREATE POLICY "ai_copilot_conv_owner_select" ON public.ai_copilot_conversations
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "ai_copilot_conv_owner_insert" ON public.ai_copilot_conversations;
CREATE POLICY "ai_copilot_conv_owner_insert" ON public.ai_copilot_conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND agency_id = public.get_user_agency_id());

DROP POLICY IF EXISTS "ai_copilot_conv_owner_update" ON public.ai_copilot_conversations;
CREATE POLICY "ai_copilot_conv_owner_update" ON public.ai_copilot_conversations
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "ai_copilot_conv_owner_delete" ON public.ai_copilot_conversations;
CREATE POLICY "ai_copilot_conv_owner_delete" ON public.ai_copilot_conversations
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

COMMIT;
