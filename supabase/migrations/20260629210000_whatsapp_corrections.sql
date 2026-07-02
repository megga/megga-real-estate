-- Apprentissage T2 (par l'exemple) : capter les CORRECTIONS de l'agent sur ses
-- messages clients, SANS toucher le flux de confirmation. Quand l'agent REJETTE un
-- brouillon send_client_message puis fait envoyer autre chose au même contact, on
-- apparie (brouillon rejeté → version envoyée) = exemple contrastif « tu proposais
-- X, l'agent a préféré Y », réinjecté (par agent) dans la rédaction.
-- Additif + idempotent.

-- Brouillon rejeté en attente d'appariement (au plus 1 par agent×contact ; upsert).
create table if not exists public.whatsapp_rejected_drafts (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  agency_id  uuid references public.agencies (id) on delete set null,
  draft      text not null,
  created_at timestamptz not null default now(),
  primary key (profile_id, contact_id)
);

comment on table public.whatsapp_rejected_drafts is
  'Éphémère : dernier brouillon send_client_message REJETÉ par l''agent, en attente d''appariement au prochain message envoyé à ce contact. Écrit/lu par le webhook (service_role) uniquement.';

alter table public.whatsapp_rejected_drafts enable row level security;
-- Pas de policy : aucun accès anon/authenticated. Le service-role bypasse la RLS.

-- Corpus de corrections appris (paire contrastive), par agent.
create table if not exists public.whatsapp_message_corrections (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  agency_id   uuid references public.agencies (id) on delete set null,
  contact_id  uuid references public.contacts (id) on delete set null,
  megga_draft text not null,   -- ce que MEGGA avait proposé (rejeté)
  agent_final text not null,   -- ce que l'agent a finalement fait envoyer
  created_at  timestamptz not null default now()
);

comment on table public.whatsapp_message_corrections is
  'Apprentissage T2 par l''exemple : paires (brouillon rejeté → message envoyé) par agent. Réinjecté en bloc contrastif dans la rédaction client (agent-style.ts). 0 PII supplémentaire (mêmes messages que whatsapp_messages).';

create index if not exists idx_wa_corrections_profile
  on public.whatsapp_message_corrections (profile_id, created_at desc);

alter table public.whatsapp_message_corrections enable row level security;

-- Lecture par les membres de l'agence (si un client user lit ; le webhook/agent
-- passe en service_role) ; écriture réservée au service_role.
drop policy if exists "wamc_select_own_agency" on public.whatsapp_message_corrections;
create policy "wamc_select_own_agency" on public.whatsapp_message_corrections
  for select to authenticated
  using (agency_id = public.get_my_agency_id());
