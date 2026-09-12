-- ════════════════════════════════════════════════════════════════════════════
-- Libellés du Calendrier (13.09.2026) — retour de Julien : « fais comme les
-- mails, rajoute les libellés, avec les couleurs qu'on peut customiser ».
--
-- MÊME MODÈLE QUE `mail_labels` (décisions de Julien) : un classement de
-- l'AGENCE — nom + couleur libre —, UN libellé par événement, les « Types
-- d'événement » gardés à côté (ils viennent de la donnée : une visite reste une
-- visite).
--
-- ⚠ UN ÉVÉNEMENT N'EST PAS UNE LIGNE : le Calendrier assemble trois tables
-- (`visits`, `reminders`, `appointments`). Chacune reçoit sa colonne
-- `calendar_label_id`, tenue par une clé étrangère COMPOSITE
-- `(calendar_label_id, agency_id) → calendar_labels (id, agency_id)` : un
-- événement ne peut porter QUE le libellé de sa propre agence, quelle que soit la
-- voie d'écriture. `ON DELETE SET NULL (calendar_label_id)` — la forme à liste de
-- colonnes (PG 15+) : supprimer un libellé le retire des événements, sans
-- toucher à leur `agency_id`.
--
-- ⚠ DEUX RPC, ET C'EST UN CHOIX DE SÛRETÉ :
--   · L'ÉCRITURE passe par `calendar_set_event_label`, qui ne touche QUE la
--     colonne du libellé. Les rendez-vous KYC sont des pièces de conformité :
--     élargir leurs policies pour qu'un agent y écrive un classement aurait
--     élargi tout ce que ces policies couvrent.
--   · La LECTURE passe par `calendar_label_assignments`, pas par la requête
--     principale du Calendrier. Si cette migration manquait en production (le
--     date-guard de deploy.yml saute toute migration dont la date est passée),
--     le Calendrier perdrait ses libellés — pas ses événements.
--
-- Rejouable : deploy.yml réapplique toute migration datée du jour à chaque push.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Horodatage ────────────────────────────────────────────────────────────
create or replace function public.calendar_labels_touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end; $$;

-- ── 2. Libellés ──────────────────────────────────────────────────────────────
create table if not exists public.calendar_labels (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid not null references public.agencies(id) on delete cascade,
  name        text not null,
  color       text not null,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

do $$ begin
  alter table public.calendar_labels drop constraint if exists calendar_labels_color_hex;
  alter table public.calendar_labels add constraint calendar_labels_color_hex
    check (color ~ '^#[0-9a-fA-F]{6}$');
  alter table public.calendar_labels drop constraint if exists calendar_labels_name_len;
  alter table public.calendar_labels add constraint calendar_labels_name_len
    check (length(trim(name)) between 1 and 40);
  -- Cible des trois clés composites. ⚠ Jamais « drop puis add » : au second rejeu
  -- du jour, les clés étrangères qui en dépendent interdiraient le drop.
  if not exists (select 1 from pg_constraint where conname = 'calendar_labels_id_agency_id_key') then
    alter table public.calendar_labels add constraint calendar_labels_id_agency_id_key unique (id, agency_id);
  end if;
end $$;

create unique index if not exists calendar_labels_agency_name_uniq
  on public.calendar_labels (agency_id, lower(name));

drop trigger if exists calendar_labels_touch on public.calendar_labels;
create trigger calendar_labels_touch before update on public.calendar_labels
  for each row execute function public.calendar_labels_touch_updated_at();

-- ── 3. Le libellé de chaque événement ────────────────────────────────────────
alter table public.visits       add column if not exists calendar_label_id uuid;
alter table public.reminders    add column if not exists calendar_label_id uuid;
alter table public.appointments add column if not exists calendar_label_id uuid;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'visits_calendar_label_id_agency_id_fkey') then
    alter table public.visits add constraint visits_calendar_label_id_agency_id_fkey
      foreign key (calendar_label_id, agency_id) references public.calendar_labels (id, agency_id)
      on delete set null (calendar_label_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reminders_calendar_label_id_agency_id_fkey') then
    alter table public.reminders add constraint reminders_calendar_label_id_agency_id_fkey
      foreign key (calendar_label_id, agency_id) references public.calendar_labels (id, agency_id)
      on delete set null (calendar_label_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'appointments_calendar_label_id_agency_id_fkey') then
    alter table public.appointments add constraint appointments_calendar_label_id_agency_id_fkey
      foreign key (calendar_label_id, agency_id) references public.calendar_labels (id, agency_id)
      on delete set null (calendar_label_id);
  end if;
end $$;

-- Partiels : la plupart des événements n'auront JAMAIS de libellé, et ces index
-- servent la suppression d'un libellé (SET NULL) comme la lecture des affectations.
create index if not exists visits_calendar_label_idx
  on public.visits (calendar_label_id) where calendar_label_id is not null;
create index if not exists reminders_calendar_label_idx
  on public.reminders (calendar_label_id) where calendar_label_id is not null;
create index if not exists appointments_calendar_label_idx
  on public.appointments (calendar_label_id) where calendar_label_id is not null;

-- ── 4. RLS ───────────────────────────────────────────────────────────────────
alter table public.calendar_labels enable row level security;

-- Les privilèges par défaut du projet accordent trop à anon (cf. la migration de
-- la Messagerie) : on révoque tout, puis on accorde le strict.
revoke all on public.calendar_labels from anon, authenticated;
grant select, insert, update, delete on public.calendar_labels to authenticated;

drop policy if exists calendar_labels_all on public.calendar_labels;
create policy calendar_labels_all on public.calendar_labels for all to authenticated
  using (agency_id = public.get_my_agency_id())
  with check (agency_id = public.get_my_agency_id());

-- ── 5. Lecture des affectations ──────────────────────────────────────────────
-- SECURITY DEFINER : elle lit trois tables dont les droits de COLONNE diffèrent,
-- et ne rend que des identifiants — jamais le contenu d'un événement. Bornée à
-- l'agence de l'appelant ; `get_my_agency_id()` nul (super-admin) ⇒ rien.
create or replace function public.calendar_label_assignments(p_from timestamptz, p_to timestamptz)
returns table (source text, event_id uuid, label_id uuid)
language sql stable security definer set search_path = '' as $$
  select 'visit'::text, v.id, v.calendar_label_id
    from public.visits v
   where v.agency_id = public.get_my_agency_id()
     and v.calendar_label_id is not null
     and v.scheduled_at between p_from and p_to
  union all
  select 'reminder'::text, r.id, r.calendar_label_id
    from public.reminders r
   where r.agency_id = public.get_my_agency_id()
     and r.calendar_label_id is not null
     and r.trigger_at between p_from and p_to
  union all
  select 'appointment'::text, a.id, a.calendar_label_id
    from public.appointments a
   where a.agency_id = public.get_my_agency_id()
     and a.calendar_label_id is not null
     and a.starts_at between p_from and p_to
$$;

revoke execute on function public.calendar_label_assignments(timestamptz, timestamptz) from public, anon;
grant execute on function public.calendar_label_assignments(timestamptz, timestamptz) to authenticated;

-- ── 6. Écriture : poser ou retirer le libellé d'un événement ─────────────────
-- ⚠ Ne touche QUE `calendar_label_id`. Le seul déclencheur des trois tables est
-- l'horodatage de `appointments` (vérifié) : aucun courriel ni aucune
-- synchronisation d'agenda ne part d'un changement de libellé.
-- `p_label_id` a une valeur par défaut : l'OMETTRE retire le libellé. Le typage
-- généré rend les paramètres non nullables ; sans défaut, retirer un libellé
-- aurait demandé de caster le client — exactement ce que la porte de typage refuse.
create or replace function public.calendar_set_event_label(p_source text, p_event_id uuid, p_label_id uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_agency uuid := public.get_my_agency_id();
  v_n integer;
begin
  if v_agency is null then
    raise exception 'calendar_set_event_label: no agency' using errcode = '42501';
  end if;
  if p_label_id is not null and not exists (
    select 1 from public.calendar_labels l where l.id = p_label_id and l.agency_id = v_agency
  ) then
    raise exception 'calendar_set_event_label: label not found' using errcode = 'P0002';
  end if;

  if p_source = 'visit' then
    update public.visits set calendar_label_id = p_label_id
     where id = p_event_id and agency_id = v_agency;
  elsif p_source = 'reminder' then
    update public.reminders set calendar_label_id = p_label_id
     where id = p_event_id and agency_id = v_agency;
  elsif p_source = 'appointment' then
    update public.appointments set calendar_label_id = p_label_id
     where id = p_event_id and agency_id = v_agency;
  else
    raise exception 'calendar_set_event_label: bad source %', p_source using errcode = '22023';
  end if;

  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'calendar_set_event_label: event not found' using errcode = 'P0002';
  end if;
end $$;

revoke execute on function public.calendar_set_event_label(text, uuid, uuid) from public, anon;
grant execute on function public.calendar_set_event_label(text, uuid, uuid) to authenticated;
