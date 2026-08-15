-- Les échecs de remise cessent d'être invisibles.
--
-- CE QUE CETTE TABLE RÉPARE. Le 15.08.2026, `hello@juarts.com` s'est révélé être sur la
-- liste de suppression Resend depuis le 05.08 (rebond dur) : DIX JOURS d'alertes
-- plateforme refusées au départ, statut `suppressed`, jamais remises. Personne ne l'a su,
-- parce que le seul signal que le code observait était le code de retour de l'API, qui
-- vaut 200 quand Resend ACCEPTE la requête — pas quand le message arrive. Le canal
-- d'alerte a donc échoué en affichant une santé parfaite, et l'incident n'a été trouvé
-- qu'en interrogeant Resend à la main.
--
-- La même cécité couvre les e-mails CLIENT : si la confirmation d'un rendez-vous rebondit
-- chez une agence, ni elle ni MEGGA ne l'apprennent aujourd'hui.
--
-- Le webhook `resend-webhook` écrit ici, et la règle 13 d'`admin-alerts` le lit.

create table if not exists public.email_delivery_events (
  id                uuid primary key default gen_random_uuid(),
  provider          text not null default 'resend',
  -- Identifiant du MESSAGE DE WEBHOOK (svix-id), pas de l'e-mail : c'est lui qui rend la
  -- réception idempotente. Svix REJOUE en cas de non-2xx, et un rejeu ne doit pas
  -- produire une seconde ligne, sans quoi le compte de rebonds de l'alerte serait faux.
  provider_event_id text not null,
  event_type        text not null,
  -- Identifiant Resend de l'e-mail concerné : c'est la clé de jointure vers leur tableau
  -- de bord (`get-email`) quand on veut relire le message lui-même.
  email_id          text,
  recipient         text,
  subject           text,
  -- « Permanent » / « Transient » chez SES : un permanent condamne l'adresse (elle part en
  -- liste de suppression), un transitoire non. La distinction décide s'il faut agir.
  bounce_type       text,
  reason            text,
  occurred_at       timestamptz not null default now(),
  -- Charge utile complète, pour ne pas avoir à redemander à Resend. ⚠ Contient
  -- l'adresse du destinataire et le sujet : c'est notre propre journal d'envoi, pas une
  -- donnée de tiers, mais la table reste fermée au client (voir RLS).
  payload           jsonb,
  created_at        timestamptz not null default now()
);

create unique index if not exists email_delivery_events_provider_event_uidx
  on public.email_delivery_events (provider, provider_event_id);

-- L'alerte ne regarde qu'une fenêtre récente et ne compte jamais toute la table
-- (CLAUDE.md §7) : c'est cet index qui rend sa lecture bornée.
create index if not exists email_delivery_events_occurred_idx
  on public.email_delivery_events (occurred_at desc);

comment on table public.email_delivery_events is
  'Échecs et événements de remise rapportés par le webhook Resend (rebond, plainte, retard). Écrite par le service seul ; lue par la console super-admin et par la règle 13 d''admin-alerts. Voir supabase/functions/resend-webhook.';

alter table public.email_delivery_events enable row level security;

-- Lecture super-admin SEULE. Aucune policy d'écriture : le webhook passe en service_role,
-- qui contourne RLS — donc aucun client authentifié ne peut fabriquer un faux rebond, ce
-- qui reviendrait à faire taire ou crier l'alerte à volonté.
drop policy if exists ede_select_super_admin on public.email_delivery_events;
create policy ede_select_super_admin on public.email_delivery_events
  for select to authenticated
  using (public.is_super_admin());

revoke all on public.email_delivery_events from anon;
grant select on public.email_delivery_events to authenticated;
