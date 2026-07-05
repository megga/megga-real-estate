-- Généralisation de la purge R2 à tous les types de média (P2 rétention / nLPD).
--
-- Avant : la purge L3 (whatsapp-process) et son index ne visaient que media_type='audio'.
-- Or la phase 1 uploade TOUS les médias entrants en R2 (images, PDF — y compris pièces
-- d'identité). Ces objets n'étaient JAMAIS purgés : ils restaient indéfiniment dans R2,
-- hors de toute rétention (non effaçables sur demande nLPD).
--
-- La copie R2 ne sert QU'au traitement (transcription Deepgram / description Gemini) :
-- media_url pointe vers Meta (éphémère), le CRM n'affiche jamais un média depuis R2, et
-- aucun code ne relit media_r2_key après traitement (seul whatsapp-process y touche).
-- Donc purger après traitement ne casse aucun affichage.
--
-- Après : l'index couvre TOUS les médias ayant une clé R2 (pas seulement l'audio), et la
-- purge L3 supprime l'objet R2 30 j après traitement (transcript non vide), quel que soit
-- le type. On remplace l'index audio-only par l'index général.

BEGIN;

DROP INDEX IF EXISTS public.idx_wa_msg_r2_audio_purge;

CREATE INDEX IF NOT EXISTS idx_wa_msg_r2_purge
  ON public.whatsapp_messages (created_at)
  WHERE media_r2_key IS NOT NULL;

COMMIT;
