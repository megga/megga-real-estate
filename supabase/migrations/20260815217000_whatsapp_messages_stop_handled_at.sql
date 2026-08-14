-- Marqueur d'idempotence de l'interception du STOP.
--
-- POURQUOI IL FAUT UNE COLONNE, alors que le webhook a déjà son gate. Les deux points
-- d'interception n'ont pas la même protection :
--   · dans le webhook, le gate est l'INSERT (`on conflict do nothing` sur
--     provider_message_id) : un rejeu Meta ne remporte pas la ligne et s'arrête ;
--   · dans le cron whatsapp-process, il n'y en a AUCUN. Un message déjà transcrit est
--     re-réclamé par `claim_whatsapp_jobs` dès qu'il retombe en 'failed' (retry_count < 3)
--     ou qu'un 'processing' dépasse 5 minutes. Sans marqueur, chaque reprise réécrirait une
--     déclaration de consentement — le registre est append-only, elles s'empileraient.
--
-- Le STOP oral n'a pas d'autre chemin : `parseInbound` rend `body = null` pour un audio
-- (ni `text.body`, ni `caption`), donc `detectStopRequest(null)` est faux au webhook. La
-- transcription Deepgram n'arrive qu'une minute plus tard, dans le cron.
begin;
alter table public.whatsapp_messages
  add column if not exists stop_handled_at timestamptz null;

comment on column public.whatsapp_messages.stop_handled_at is
  'Horodatage de l''interception d''une demande de désinscription portée par ce message. '
  'Écrit par les points B (webhook, texte) et C (whatsapp-process, transcription d''une '
  'note vocale ou d''une image). NULL = jamais traité comme un STOP. Sert l''idempotence '
  'du cron, qui re-réclame un job en échec sans que rien d''autre ne l''en empêche.';
commit;
