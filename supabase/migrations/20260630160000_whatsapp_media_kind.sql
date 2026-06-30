-- Lecture des images/documents ENTRANTS (WhatsApp Conversation Intelligence).
-- L'audio est déjà transcrit (Deepgram → transcript) ; on étend la compréhension aux
-- images/PDF via Gemini Vision. La classification du média (photo de bien, annonce,
-- document, pièce d'identité, autre) est rangée ici ; le résumé/texte va dans
-- `transcript` (déjà lu par le digest → l'insight « voit » l'image). Idempotent.

alter table public.whatsapp_messages
  add column if not exists media_kind text null;
