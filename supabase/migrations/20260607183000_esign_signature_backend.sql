-- ============================================================================
-- E-signature backend — connexions provider (Skribble / DocuSign) + demandes
-- de signature qualifiée des documents (mandats / offres / contrats).
--
-- Décision produit (cerveau : signature-qes-planned) : Swisscom QES ABANDONNÉ.
-- Chaque agence connecte SON compte chez le fournisseur (Skribble OU DocuSign),
-- puis signe ses documents en un clic. La clé API / le token OAuth vit CHIFFRÉ
-- dans Supabase Vault — jamais en clair dans une colonne.
--
-- Niveaux ZertES/eIDAS : SES / AES / QES. Skribble = suisse (préféré CH),
-- DocuSign = international. Même abstraction (_shared/esign-gateway.ts).
--
-- IDEMPOTENT : la CI ré-applique les migrations datées du jour à chaque deploy.
-- → IF NOT EXISTS partout ; DROP ... IF EXISTS avant CREATE POLICY / CONSTRAINT
--   / TRIGGER (qui ne sont pas idempotents seuls).
-- ============================================================================

-- ── 1. Helpers Vault (service_role uniquement) ──────────────────────────────
-- Le secret (JSON : skribble {username,api_key} | docusign {refresh_token,...})
-- vit dans vault.secrets. Ces 3 fonctions SECURITY DEFINER sont le SEUL pont,
-- révoquées de anon/authenticated → un client ne peut JAMAIS lire un secret.
-- search_path = '' impose la qualification de tous les noms (anti-hijack).

create or replace function public.esign_secret_store(p_secret text, p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  v_id := vault.create_secret(p_secret, p_name, 'MEGGA e-sign provider credential');
  return v_id;
end;
$$;

create or replace function public.esign_secret_read(p_id uuid)
returns text
language sql
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where id = p_id;
$$;

create or replace function public.esign_secret_delete(p_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from vault.secrets where id = p_id;
$$;

revoke execute on function public.esign_secret_store(text, text) from public, anon, authenticated;
revoke execute on function public.esign_secret_read(uuid)        from public, anon, authenticated;
revoke execute on function public.esign_secret_delete(uuid)      from public, anon, authenticated;
grant  execute on function public.esign_secret_store(text, text) to service_role;
grant  execute on function public.esign_secret_read(uuid)        to service_role;
grant  execute on function public.esign_secret_delete(uuid)      to service_role;

-- ── 2. Trigger updated_at (nommé esign_* pour ne rien clobber) ──────────────
create or replace function public.esign_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ── 3. esign_provider_connections (1 connexion par provider et par agence) ──
create table if not exists public.esign_provider_connections (
  id                  uuid primary key default gen_random_uuid(),
  agency_id           uuid not null references public.agencies(id) on delete cascade,
  provider            text not null,
  environment         text not null default 'production',
  display_name        text,                              -- email/raison sociale affiché en réglages
  vault_secret_id     uuid,                              -- pointeur vers vault.secrets (inutile sans accès Vault)
  config              jsonb not null default '{}'::jsonb, -- non-secret : skribble {hosting_region}; docusign {account_id, base_uri}
  default_quality     text default 'QES',
  default_legislation text default 'ZERTES',
  is_active           boolean not null default true,
  status              text not null default 'connected',
  last_error          text,
  connected_by        uuid references public.profiles(id) on delete set null,
  connected_at        timestamptz default now(),
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

alter table public.esign_provider_connections drop constraint if exists epc_provider_chk;
alter table public.esign_provider_connections add  constraint epc_provider_chk
  check (provider in ('skribble','docusign'));
alter table public.esign_provider_connections drop constraint if exists epc_env_chk;
alter table public.esign_provider_connections add  constraint epc_env_chk
  check (environment in ('sandbox','production'));
alter table public.esign_provider_connections drop constraint if exists epc_quality_chk;
alter table public.esign_provider_connections add  constraint epc_quality_chk
  check (default_quality in ('SES','AES','QES'));
alter table public.esign_provider_connections drop constraint if exists epc_legislation_chk;
alter table public.esign_provider_connections add  constraint epc_legislation_chk
  check (default_legislation in ('ZERTES','EIDAS'));
alter table public.esign_provider_connections drop constraint if exists epc_status_chk;
alter table public.esign_provider_connections add  constraint epc_status_chk
  check (status in ('connected','error','disconnected'));

-- une seule connexion par (agence, provider) ; un seul provider ACTIF par agence
create unique index if not exists epc_agency_provider_uniq on public.esign_provider_connections (agency_id, provider);
create unique index if not exists epc_agency_active_uniq   on public.esign_provider_connections (agency_id) where is_active;
create index        if not exists epc_agency_idx           on public.esign_provider_connections (agency_id);

alter table public.esign_provider_connections enable row level security;

-- Lecture = membres de l'agence (métadonnées seulement ; le secret est dans Vault).
-- Écriture = service_role (edge sign-document) uniquement : connecter chiffre la clé.
drop policy if exists epc_select on public.esign_provider_connections;
create policy epc_select on public.esign_provider_connections for select to authenticated
  using (agency_id = (select agency_id from public.profiles where id = auth.uid()));

drop trigger if exists epc_touch on public.esign_provider_connections;
create trigger epc_touch before update on public.esign_provider_connections
  for each row execute function public.esign_touch_updated_at();

grant select on public.esign_provider_connections to authenticated;
grant all    on public.esign_provider_connections to service_role;

-- ── 4. signature_requests (cycle de vie d'une demande de signature) ─────────
create table if not exists public.signature_requests (
  id                   uuid primary key default gen_random_uuid(),
  agency_id            uuid not null references public.agencies(id) on delete cascade,
  document_id          uuid references public.documents(id) on delete set null,
  provider             text not null,
  provider_request_id  text,                              -- Skribble signature-request id / DocuSign envelopeId
  provider_document_id text,                              -- Skribble document_id (download) / DocuSign envelopeId
  webhook_token        text,                              -- secret d'URL vérifié au callback (timing-safe)
  title                text not null,
  quality              text,
  legislation          text,
  status               text not null default 'draft',
  signers              jsonb not null default '[]'::jsonb, -- [{name,email,role,sequence,status,signing_url,signed_at}]
  signing_url          text,                               -- 1er signataire, confort UI
  signed_document_path text,                               -- chemin Storage du PDF signé final
  signed_sha256        text,
  context_type         text,                               -- 'mandate' | 'offer' | 'contract' | ...
  context_id           uuid,                               -- listing / offer / transaction lié
  raw_status           jsonb,                              -- dernier payload provider (debug/audit)
  last_error           text,
  created_by           uuid references public.profiles(id) on delete set null,
  created_at           timestamptz default now(),
  sent_at              timestamptz,
  completed_at         timestamptz,
  updated_at           timestamptz default now()
);

alter table public.signature_requests drop constraint if exists sr_provider_chk;
alter table public.signature_requests add  constraint sr_provider_chk
  check (provider in ('skribble','docusign'));
alter table public.signature_requests drop constraint if exists sr_status_chk;
alter table public.signature_requests add  constraint sr_status_chk
  check (status in ('draft','sent','viewed','signed','declined','withdrawn','error','expired'));
alter table public.signature_requests drop constraint if exists sr_quality_chk;
alter table public.signature_requests add  constraint sr_quality_chk
  check (quality is null or quality in ('SES','AES','QES'));

create index if not exists sr_agency_status_idx  on public.signature_requests (agency_id, status, created_at desc);
create index if not exists sr_provider_reqid_idx on public.signature_requests (provider, provider_request_id);
create index if not exists sr_webhook_token_idx  on public.signature_requests (webhook_token);
create index if not exists sr_document_idx        on public.signature_requests (document_id);

alter table public.signature_requests enable row level security;

drop policy if exists sr_select on public.signature_requests;
create policy sr_select on public.signature_requests for select to authenticated
  using (agency_id = (select agency_id from public.profiles where id = auth.uid()));

drop trigger if exists sr_touch on public.signature_requests;
create trigger sr_touch before update on public.signature_requests
  for each row execute function public.esign_touch_updated_at();

grant select on public.signature_requests to authenticated;
grant all    on public.signature_requests to service_role;

-- ── 5. documents : rattachement signature (additif, nullable) ───────────────
alter table public.documents
  add column if not exists signature_request_id uuid references public.signature_requests(id) on delete set null,
  add column if not exists signature_status     text,
  add column if not exists signed_at            timestamptz;

alter table public.documents drop constraint if exists documents_signature_status_chk;
alter table public.documents add  constraint documents_signature_status_chk
  check (signature_status is null or signature_status in ('pending','signed','declined','withdrawn'));

-- ── 6. Storage privé pour les PDF signés (chemin = <agency_id>/<sr_id>.pdf) ──
insert into storage.buckets (id, name, public)
values ('signed-documents', 'signed-documents', false)
on conflict (id) do nothing;

-- Lecture réservée aux membres de l'agence propriétaire du dossier.
-- Écriture = service_role (edge esign-webhook) uniquement → pas de policy client.
drop policy if exists signed_docs_select on storage.objects;
create policy signed_docs_select on storage.objects for select to authenticated
  using (
    bucket_id = 'signed-documents'
    and (storage.foldername(name))[1] = (select agency_id::text from public.profiles where id = auth.uid())
  );

comment on table public.esign_provider_connections is 'Connexion e-signature par agence (Skribble/DocuSign). Clé chiffrée dans Vault (vault_secret_id).';
comment on table public.signature_requests        is 'Cycle de vie d''une demande de signature qualifiée (QES/AES/SES) via le provider connecté.';
