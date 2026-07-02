-- Syndication sortante (Phase 1) — premier vrai chemin de publication d'annonces
-- vers les portails externes via le standard suisse IDX (immobilier.ch d'abord).
--
-- Modèle « feed » : on n'envoie pas une annonce à la fois ; on inscrit un bien
-- dans le feed IDX de l'agence, que le portail va chercher (pull) et importe.
--   - property_syndications      : quels biens sont dans le feed de quel portail
--   - agency_syndication_config  : token d'accès au feed (mode pull) par agence
--
-- RLS : isolation par agence via public.get_my_agency_id() (helper canonique).

-- ─── property_syndications ───────────────────────────────────────────────────
create table if not exists public.property_syndications (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  agency_id uuid not null references public.agencies (id) on delete cascade,
  portal text not null default 'immobilier_ch',
  status text not null default 'queued'
    check (status in ('queued', 'published', 'error', 'withdrawn')),
  external_ref text,                 -- advertisement_id renvoyé par le portail (updates)
  last_pushed_at timestamptz,        -- dernière fois que le feed a inclus ce bien
  last_imported_at timestamptz,      -- import confirmé par le portail (si connu)
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id, portal)
);

comment on table public.property_syndications is
  'Inscription d''un bien (properties) au feed de syndication d''un portail externe (IDX). 1 ligne = (bien, portail).';

create index if not exists idx_property_syndications_agency_portal_status
  on public.property_syndications (agency_id, portal, status);
create index if not exists idx_property_syndications_property
  on public.property_syndications (property_id);

alter table public.property_syndications enable row level security;

-- Idempotence : le deploy ré-applique les migrations du jour → drop avant create
-- (CREATE POLICY n'a pas de IF NOT EXISTS).
drop policy if exists "ps_select_own_agency" on public.property_syndications;
create policy "ps_select_own_agency" on public.property_syndications
  for select to authenticated
  using (agency_id = public.get_my_agency_id());

drop policy if exists "ps_insert_own_agency" on public.property_syndications;
create policy "ps_insert_own_agency" on public.property_syndications
  for insert to authenticated
  with check (agency_id = public.get_my_agency_id());

drop policy if exists "ps_update_own_agency" on public.property_syndications;
create policy "ps_update_own_agency" on public.property_syndications
  for update to authenticated
  using (agency_id = public.get_my_agency_id())
  with check (agency_id = public.get_my_agency_id());

drop policy if exists "ps_delete_own_agency" on public.property_syndications;
create policy "ps_delete_own_agency" on public.property_syndications
  for delete to authenticated
  using (agency_id = public.get_my_agency_id());

-- ─── agency_syndication_config ───────────────────────────────────────────────
-- Config par agence. Le token authentifie le pull du feed (immobilier.ch va
-- chercher https://…/idx-feed?token=…). Les creds FTP éventuels (mode push,
-- plan B) ne sont PAS stockés ici en clair : ils iront dans les secrets Edge
-- une fois le transport confirmé avec immobilier.ch.
create table if not exists public.agency_syndication_config (
  agency_id uuid primary key references public.agencies (id) on delete cascade,
  idx_enabled boolean not null default false,
  idx_feed_token text unique,        -- token d'accès au feed (mode pull)
  idx_sender_id text not null default 'MEGGA',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.agency_syndication_config is
  'Config de syndication par agence (token feed IDX en mode pull). Écriture via service_role uniquement (setup syndication).';

alter table public.agency_syndication_config enable row level security;

-- Lecture par les membres de l'agence ; écriture réservée au service_role
-- (pas de policy insert/update pour authenticated → RLS refuse, le setup passe
-- par la clé service-role).
drop policy if exists "asc_select_own_agency" on public.agency_syndication_config;
create policy "asc_select_own_agency" on public.agency_syndication_config
  for select to authenticated
  using (agency_id = public.get_my_agency_id());
