-- Phase 2 espace vendeur — préférences du vendeur (page « Votre vente »).
-- Persistées via l'edge function seller-portal-action (service_role, après validation
-- du token seller_portals). Aucune écriture directe par anon/vendeur (pas de compte).
-- Lecture agent : visibilité agence (créneaux de visite, canal de contact préféré…).

create table if not exists public.seller_preferences (
  id            uuid primary key default gen_random_uuid(),
  portal_id     uuid not null references public.seller_portals(id) on delete cascade,
  agency_id     uuid references public.agencies(id) on delete cascade,
  notif_offre   boolean not null default true,
  notif_visite  boolean not null default true,
  notif_retour  boolean not null default true,
  notif_resume  boolean not null default true,
  jours         text[]  not null default '{}',
  creneaux      text[]  not null default '{}',
  preavis       text    not null default '24h',
  langue        text    not null default 'fr',
  canal         text    not null default 'whatsapp',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint seller_preferences_portal_uniq  unique (portal_id),
  constraint seller_preferences_langue_check  check (langue  in ('fr','de','en','it')),
  constraint seller_preferences_canal_check   check (canal   in ('whatsapp','tel','email')),
  constraint seller_preferences_preavis_check check (preavis in ('jour','24h','48h'))
);

comment on table public.seller_preferences is
  'Préférences vendeur (notifs, dispo visites, langue, canal) — écrites via edge seller-portal-action.';

alter table public.seller_preferences enable row level security;
alter table public.seller_preferences force row level security;

-- Agent : lecture des préférences des vendeurs de son agence (service_role bypass RLS pour l'écriture).
drop policy if exists "seller_preferences_agency_read" on public.seller_preferences;
create policy "seller_preferences_agency_read"
  on public.seller_preferences for select to authenticated
  using (agency_id = public.get_my_agency_id());

create index if not exists idx_seller_preferences_agency on public.seller_preferences (agency_id);
