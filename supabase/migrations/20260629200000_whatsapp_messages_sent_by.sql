-- Apprentissage T2 « par l'exemple + par agent » : tracer l'AGENT qui a fait
-- envoyer un message client via le copilote (MEGGA envoie au nom de l'agent).
-- Permet le mimétisme de voix PAR AGENT (corrige la limite v1 « agence-scopée »
-- de fetchClientVoiceSamples) — la directive Gregory « un vrai cerveau par agent ».
-- Le message client réellement envoyé EST la version corrigée/validée par l'agent :
-- apprendre par l'exemple ses propres messages = apprendre ses corrections.
--
-- Additif + idempotent. Seul send_client_message (prose) sera tagué → le corpus de
-- voix par agent reste de la prose (send_listings/blocs formatés restent NULL).

alter table public.whatsapp_messages
  add column if not exists sent_by_profile_id uuid null
    references public.profiles (id) on delete set null;

comment on column public.whatsapp_messages.sent_by_profile_id is
  'Agent (profiles.id) qui a fait envoyer ce message client via le copilote. NULL pour l''inbound et les sorties non-prose. Sert au mimétisme de voix PAR AGENT (agent-style.ts fetchClientVoiceSamples).';

-- Échantillons de voix par agent : sortants prose vers un client, par agent, récents.
create index if not exists idx_wa_messages_sent_by_voice
  on public.whatsapp_messages (sent_by_profile_id, created_at desc)
  where direction = 'outbound' and sent_by_profile_id is not null and contact_id is not null;
