-- Labs — le studio de génération du CRM (`/dashboard/labs`) : images Nano Banana 2,
-- vidéos Seedance, voix off Gemini TTS. Deux tables scopées agence : les DOSSIERS
-- que l'agent crée, renomme et supprime, et les PRODUCTIONS qu'il y range — image
-- générée, vidéo générée, photo importée.
--
-- ⚠ Une production se supprime en DOUX (`deleted_at`) : son fichier vit sur R2, et
-- la purge du bucket est un geste à part. Une ligne effacée en dur laisserait un
-- objet orphelin que plus rien ne désigne. Aucune policy DELETE, donc, sur les
-- productions ; les dossiers, eux, s'effacent en dur — leurs productions retombent
-- « sans dossier » (`on delete set null`), jamais à la corbeille.
--
-- ⚠ Le client n'INSÈRE que des imports (`kind = 'upload'`) : les générations sont
-- écrites par les edges `labs-image` / `labs-video` sous le rôle de service, qui
-- posent le modèle, le coût et l'identifiant de tâche du fournisseur. Ces
-- identifiants (`provider_request_id`, les deux URL de file d'attente fal.ai) ne
-- sont pas des secrets : une URL de file est inutilisable sans la clé.
--
-- Idempotente : rejouable le jour même (create … if not exists, drop policy if exists).

-- ── 1. Dossiers ────────────────────────────────────────────────────────────────
create table if not exists public.labs_folders (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid not null references public.agencies(id) on delete cascade,
  created_by  uuid references auth.users(id) on delete set null,
  name        text not null check (length(btrim(name)) between 1 and 80),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists labs_folders_agency_idx
  on public.labs_folders (agency_id, sort_order, created_at);

alter table public.labs_folders enable row level security;

drop policy if exists labs_folders_select on public.labs_folders;
create policy labs_folders_select on public.labs_folders for select to authenticated
  using (agency_id = public.get_my_agency_id());

drop policy if exists labs_folders_insert on public.labs_folders;
create policy labs_folders_insert on public.labs_folders for insert to authenticated
  with check (agency_id = public.get_my_agency_id());

drop policy if exists labs_folders_update on public.labs_folders;
create policy labs_folders_update on public.labs_folders for update to authenticated
  using (agency_id = public.get_my_agency_id())
  with check (agency_id = public.get_my_agency_id());

drop policy if exists labs_folders_delete on public.labs_folders;
create policy labs_folders_delete on public.labs_folders for delete to authenticated
  using (agency_id = public.get_my_agency_id());

-- L'auteur et l'horodatage viennent de la base, jamais du corps envoyé.
create or replace function public.tg_labs_folders_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.created_by := auth.uid();
    end if;
    new.created_at := now();
  else
    new.agency_id := old.agency_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  new.name := btrim(new.name);
  return new;
end;
$$;

drop trigger if exists tg_labs_folders_guard on public.labs_folders;
create trigger tg_labs_folders_guard
  before insert or update on public.labs_folders
  for each row execute function public.tg_labs_folders_guard();

-- ── 2. Productions ─────────────────────────────────────────────────────────────
create table if not exists public.labs_assets (
  id                    uuid primary key default gen_random_uuid(),
  agency_id             uuid not null references public.agencies(id) on delete cascade,
  folder_id             uuid references public.labs_folders(id) on delete set null,
  created_by            uuid references auth.users(id) on delete set null,
  -- image : générée par Nano Banana 2 · video : générée par Seedance · upload : importée
  kind                  text not null check (kind in ('image', 'video', 'upload')),
  status                text not null default 'ready'
                        check (status in ('pending', 'generating', 'ready', 'failed')),
  prompt                text,
  voiceover_text        text,
  voiceover_voice       text,
  -- La langue LUE, choisie par l'agent : Gemini TTS n'a pas de paramètre de langue,
  -- elle se détecte du texte. On la force par une consigne, et on la garde ici pour
  -- que « réutiliser » rejoue la même — un texte court se détecte mal.
  voiceover_lang        text check (voiceover_lang is null or voiceover_lang in ('fr', 'de', 'en', 'it')),
  voiceover_url         text,
  -- L'image de départ d'une vidéo ou d'une retouche (dans la même agence).
  source_asset_id       uuid references public.labs_assets(id) on delete set null,
  url                   text,
  thumbnail_url         text,
  width                 integer,
  height                integer,
  duration_s            numeric(6, 2),
  aspect_ratio          text,
  model                 text,
  provider              text check (provider is null or provider in ('gemini', 'fal', 'upload')),
  provider_request_id   text,
  provider_status_url   text,
  provider_response_url text,
  error_code            text,
  cost_chf              numeric(8, 4),
  is_favorite           boolean not null default false,
  metadata              jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  completed_at          timestamptz,
  deleted_at            timestamptz
);

create index if not exists labs_assets_agency_created_idx
  on public.labs_assets (agency_id, created_at desc)
  where deleted_at is null;

create index if not exists labs_assets_folder_idx
  on public.labs_assets (folder_id)
  where folder_id is not null;

-- Le quota mensuel et la reprise des tâches en cours lisent ces deux prédicats.
create index if not exists labs_assets_agency_kind_month_idx
  on public.labs_assets (agency_id, kind, created_at desc)
  where status <> 'failed';

create index if not exists labs_assets_en_cours_idx
  on public.labs_assets (status)
  where status in ('pending', 'generating');

alter table public.labs_assets enable row level security;

drop policy if exists labs_assets_select on public.labs_assets;
create policy labs_assets_select on public.labs_assets for select to authenticated
  using (agency_id = public.get_my_agency_id());

-- Le client n'insère que des IMPORTS : une génération porte un coût et un
-- identifiant de fournisseur que seul l'edge sait poser.
drop policy if exists labs_assets_insert on public.labs_assets;
create policy labs_assets_insert on public.labs_assets for insert to authenticated
  with check (
    agency_id = public.get_my_agency_id()
    and kind = 'upload'
    and status = 'ready'
  );

drop policy if exists labs_assets_update on public.labs_assets;
create policy labs_assets_update on public.labs_assets for update to authenticated
  using (agency_id = public.get_my_agency_id())
  with check (agency_id = public.get_my_agency_id());

-- Ce qu'un agent peut CHANGER sur une production : son dossier, son étoile, sa
-- corbeille. Le reste (URL, coût, statut, prompt) est figé à la création — une
-- mise à jour cliente le rétablit en silence au lieu d'échouer.
create or replace function public.tg_labs_assets_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.created_by := auth.uid();
    end if;
    new.created_at := now();
    return new;
  end if;
  -- UPDATE : le rôle de service (edge) écrit tout ; un agent ne touche qu'à trois colonnes.
  if auth.uid() is not null then
    new.agency_id := old.agency_id;
    new.created_by := old.created_by;
    new.kind := old.kind;
    new.status := old.status;
    new.prompt := old.prompt;
    new.voiceover_text := old.voiceover_text;
    new.voiceover_voice := old.voiceover_voice;
    new.voiceover_lang := old.voiceover_lang;
    new.voiceover_url := old.voiceover_url;
    new.source_asset_id := old.source_asset_id;
    new.url := old.url;
    new.thumbnail_url := old.thumbnail_url;
    new.width := old.width;
    new.height := old.height;
    new.duration_s := old.duration_s;
    new.aspect_ratio := old.aspect_ratio;
    new.model := old.model;
    new.provider := old.provider;
    new.provider_request_id := old.provider_request_id;
    new.provider_status_url := old.provider_status_url;
    new.provider_response_url := old.provider_response_url;
    new.error_code := old.error_code;
    new.cost_chf := old.cost_chf;
    new.metadata := old.metadata;
    new.created_at := old.created_at;
    new.completed_at := old.completed_at;
  end if;
  return new;
end;
$$;

drop trigger if exists tg_labs_assets_guard on public.labs_assets;
create trigger tg_labs_assets_guard
  before insert or update on public.labs_assets
  for each row execute function public.tg_labs_assets_guard();

-- Une vidéo qui aboutit doit remonter sans rechargement : la galerie s'abonne
-- aux changements de statut (canal `useId()`, filtre `agency_id`).
alter table public.labs_assets replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'labs_assets'
     ) then
    alter publication supabase_realtime add table public.labs_assets;
  end if;
end
$$;

-- ── 3. Bucket des imports ───────────────────────────────────────────────────────
-- Les photos que l'agent APPORTE passent par Supabase Storage, en lecture publique :
-- Seedance (fal.ai) et Gemini les lisent par URL. Les productions, elles, vont sur
-- R2 (`img.getmegga.com`, sortie gratuite), écrites par les edges seules.
-- Layout : labs/{agency_id}/{uuid}.{jpg|png|webp}
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('labs', 'labs', true, 20971520, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "labs_bucket_select" on storage.objects;
create policy "labs_bucket_select" on storage.objects for select to authenticated
  using (bucket_id = 'labs' and (storage.foldername(name))[1] = public.get_user_agency_id()::text);

drop policy if exists "labs_bucket_insert" on storage.objects;
create policy "labs_bucket_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'labs' and (storage.foldername(name))[1] = public.get_user_agency_id()::text);

drop policy if exists "labs_bucket_update" on storage.objects;
create policy "labs_bucket_update" on storage.objects for update to authenticated
  using (bucket_id = 'labs' and (storage.foldername(name))[1] = public.get_user_agency_id()::text);

drop policy if exists "labs_bucket_delete" on storage.objects;
create policy "labs_bucket_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'labs' and (storage.foldername(name))[1] = public.get_user_agency_id()::text);
