-- Hygiène backend : index partiel pour la purge L3 (audios R2 transcrits anciens).
CREATE INDEX IF NOT EXISTS idx_wa_msg_r2_audio_purge
  ON public.whatsapp_messages (created_at)
  WHERE media_r2_key IS NOT NULL AND media_type = 'audio';
