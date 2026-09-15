-- 20260915080300_calendar_events.sql
-- Les ÉVÉNEMENTS du Calendrier (15.09.2026, Julien : « on ne peut pas créer d'événements…
-- il faudrait que les mails soient aussi connectés avec le calendrier »).
--
-- ⛔ LE DÉFAUT QU'ELLE RÉPARE. Le Calendrier n'assemblait que trois tables — `visits`,
-- `reminders`, `appointments` — et tout ce qui n'était ni une visite (contact ET bien
-- exigés) ni un rendez-vous KYC partait en `reminders` : un rendez-vous chez le notaire
-- devenait une « relance » dont le titre n'était qu'un préfixe de `message_template`,
-- relue « Tâche » ou « Relance X », sa fin, son type, sa journée entière et sa récurrence
-- perdus au rechargement. Cette table garde l'événement TEL QU'ON L'A SAISI. Visites,
-- relances et rendez-vous KYC ne bougent pas.
--
-- ⚠ DATÉE DU 15.09, comme les trois migrations de la Messagerie : le date-guard de
-- deploy.yml ne rejoue que les migrations d'horodatage >= jour du merge (UTC). À appliquer
-- AVANT le déploiement, à renommer si le merge tombe après le 15.09.2026. Rejouable.

-- ── 1. La table ──────────────────────────────────────────────────────────────
create table if not exists public.calendar_events (
  id                 uuid primary key default gen_random_uuid(),
  agency_id          uuid not null references public.agencies(id) on delete cascade,
  created_by         uuid references public.profiles(id) on delete set null default auth.uid(),
  type               text not null,
  title              text not null,
  starts_at          timestamptz not null,
  ends_at            timestamptz not null,
  all_day            boolean not null default false,
  location           text,
  notes              text,
  color              text,
  recurrence         jsonb,
  status             text,
  contact_id         uuid references public.contacts(id) on delete set null,
  property_id        uuid references public.properties(id) on delete set null,
  -- L'e-mail d'où l'événement est né (« Planifier » dans la Messagerie) : le lien retour.
  mail_thread_id     uuid references public.mail_threads(id) on delete set null,
  calendar_label_id  uuid,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

do $$ begin
  alter table public.calendar_events drop constraint if exists calendar_events_type_check;
  alter table public.calendar_events add constraint calendar_events_type_check
    check (type in ('visite', 'mandate', 'notary', 'task', 'publish', 'kyc', 'autre'));
  alter table public.calendar_events drop constraint if exists calendar_events_title_len;
  alter table public.calendar_events add constraint calendar_events_title_len
    check (length(trim(title)) between 1 and 200);
  alter table public.calendar_events drop constraint if exists calendar_events_order;
  alter table public.calendar_events add constraint calendar_events_order check (ends_at >= starts_at);
  alter table public.calendar_events drop constraint if exists calendar_events_color_hex;
  alter table public.calendar_events add constraint calendar_events_color_hex
    check (color is null or color ~ '^#[0-9a-fA-F]{6}$');
  alter table public.calendar_events drop constraint if exists calendar_events_status_check;
  alter table public.calendar_events add constraint calendar_events_status_check
    check (status is null or status in ('done', 'cancelled'));
  alter table public.calendar_events drop constraint if exists calendar_events_recurrence_object;
  alter table public.calendar_events add constraint calendar_events_recurrence_object
    check (recurrence is null or jsonb_typeof(recurrence) = 'object');
  -- Le libellé : même clé COMPOSITE que les trois autres sources (20260914213550) — un
  -- événement ne porte que le libellé de sa propre agence, quelle que soit la voie.
  if not exists (select 1 from pg_constraint where conname = 'calendar_events_calendar_label_id_agency_id_fkey') then
    alter table public.calendar_events add constraint calendar_events_calendar_label_id_agency_id_fkey
      foreign key (calendar_label_id, agency_id) references public.calendar_labels (id, agency_id)
      on delete set null (calendar_label_id);
  end if;
end $$;

-- La lecture du Calendrier : l'agence et la fenêtre de dates.
create index if not exists calendar_events_agency_starts_idx on public.calendar_events (agency_id, starts_at);
create index if not exists calendar_events_label_idx
  on public.calendar_events (calendar_label_id) where calendar_label_id is not null;
create index if not exists calendar_events_mail_thread_idx
  on public.calendar_events (mail_thread_id) where mail_thread_id is not null;

drop trigger if exists calendar_events_touch on public.calendar_events;
create trigger calendar_events_touch before update on public.calendar_events
  for each row execute function public.calendar_labels_touch_updated_at();

-- ── 2. RLS ───────────────────────────────────────────────────────────────────
alter table public.calendar_events enable row level security;

-- Les privilèges par défaut du projet accordent trop à anon : on révoque tout, puis on
-- accorde le strict (même geste que `calendar_labels`).
revoke all on public.calendar_events from anon, authenticated;
grant select, insert, update, delete on public.calendar_events to authenticated;

drop policy if exists calendar_events_all on public.calendar_events;
create policy calendar_events_all on public.calendar_events for all to authenticated
  using (agency_id = public.get_my_agency_id())
  with check (agency_id = public.get_my_agency_id());

-- ── 2 bis. Les liens, vérifiés quand ils NAISSENT ou CHANGENT ──────────────────
-- ⛔ PAS DANS LE `WITH CHECK`. Le lien à l'e-mail y était vérifié : réévalué à CHAQUE
-- écriture, sous la RLS de l'appelant, il interdisait à un collègue qui ne voit pas la boîte
-- personnelle d'origine de déplacer, modifier ou cocher l'événement (42501, éprouvé sur
-- Postgres 17.6) — alors qu'il pouvait le supprimer. Le lien se vérifie une fois, quand on le
-- pose : c'est là seulement qu'un agent pourrait citer un fil qu'il ne voit pas.
--
-- ⚠ SECURITY INVOKER, et c'est le point : la sous-requête sur `mail_threads` passe par SA
-- RLS (`mail_account_visible`) sous l'identité de l'appelant. Un fil d'une boîte personnelle
-- d'un collègue, ou d'une autre agence, est donc refusé — et le refus ne dit pas s'il existe.
-- Un contact et un bien, eux, sont de l'agence de l'événement. L'auteur est celui qui crée,
-- et il ne se réécrit pas ensuite (la suppression d'un profil, qui le remet à NULL, passe).
create or replace function public.calendar_events_verifier_liens()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.mail_thread_id is not null
     and (tg_op = 'INSERT' or new.mail_thread_id is distinct from old.mail_thread_id)
     and not exists (select 1 from public.mail_threads t where t.id = new.mail_thread_id) then
    raise exception 'calendar_events: mail thread not visible' using errcode = '42501';
  end if;
  if new.contact_id is not null
     and (tg_op = 'INSERT' or new.contact_id is distinct from old.contact_id or new.agency_id is distinct from old.agency_id)
     and not exists (select 1 from public.contacts c where c.id = new.contact_id and c.agency_id = new.agency_id) then
    raise exception 'calendar_events: contact not in agency' using errcode = '42501';
  end if;
  if new.property_id is not null
     and (tg_op = 'INSERT' or new.property_id is distinct from old.property_id or new.agency_id is distinct from old.agency_id)
     and not exists (select 1 from public.properties p where p.id = new.property_id and p.agency_id = new.agency_id) then
    raise exception 'calendar_events: property not in agency' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' and auth.uid() is not null then
    new.created_by := auth.uid();
  elsif tg_op = 'UPDATE' and new.created_by is not null and new.created_by is distinct from old.created_by then
    new.created_by := old.created_by;
  end if;
  return new;
end $$;
revoke all on function public.calendar_events_verifier_liens() from public, anon, authenticated;

drop trigger if exists calendar_events_liens on public.calendar_events;
create trigger calendar_events_liens before insert or update on public.calendar_events
  for each row execute function public.calendar_events_verifier_liens();

-- ── 2 ter. Le journal : le FAIT d'un geste, sur la fiche de ce qu'il concerne ──
-- ⛔ Créer, déplacer, clore ou supprimer un événement n'écrivait rien au journal (revue du
-- 15.09.2026) : le rendez-vous chez le notaire d'un client n'apparaissait jamais sur sa fiche,
-- et sa suppression ne laissait aucune trace. Un DÉCLENCHEUR, pas l'écran — même raison que
-- `agencies_audit_identity_columns` (20260731130000) : il attrape toutes les voies d'écriture
-- et ne peut pas mentir sur ce qui a changé.
--
-- Le FAIT, jamais le contenu (règle du courrier, D11) : ni titre, ni lieu, ni notes — ils
-- viennent d'un e-mail, parfois d'une boîte personnelle, et `activity_events` est lisible de
-- toute l'agence, relue par les outils IA et conservée sans purge possible. L'identifiant, le
-- type, la date et, à la modification, la LISTE des colonnes changées.
--
-- ⚠ Seul s'écrit un événement qui CONCERNE quelqu'un : un contact (sa fiche, `contact`), sinon
-- un bien (`bien`). L'agenda personnel de l'agent — le dentiste — n'a rien à faire dans le
-- journal de l'agence, et aucune famille de la contrainte ne le décrirait.
-- ⚠ Une agence qu'on supprime emporte ses événements en cascade : écrire alors une ligne à son
-- nom violerait la clé étrangère et ferait échouer la suppression de l'agence.
create or replace function public.calendar_events_journaliser()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_ligne public.calendar_events := case when tg_op = 'DELETE' then old else new end;
  v_changees jsonb;
  v_acteur uuid := auth.uid();
begin
  if v_ligne.contact_id is null and v_ligne.property_id is null then return null; end if;
  if not exists (select 1 from public.agencies a where a.id = v_ligne.agency_id) then return null; end if;
  if tg_op = 'UPDATE' then
    -- Le libellé classe, l'horodatage et l'auteur suivent : aucun n'est un geste sur l'événement.
    select coalesce(jsonb_agg(k order by k), '[]'::jsonb) into v_changees
      from jsonb_object_keys(to_jsonb(new)) as k
     where k not in ('updated_at', 'created_by', 'calendar_label_id')
       and to_jsonb(new) -> k is distinct from to_jsonb(old) -> k;
    if jsonb_array_length(v_changees) = 0 then return null; end if;
  end if;
  insert into public.activity_events
    (agency_id, actor_id, actor_kind, action, entity_type, entity_id, category, severity, object_label, metadata)
  values (
    v_ligne.agency_id, v_acteur, case when v_acteur is null then 'system' else 'user' end,
    case tg_op when 'INSERT' then 'calendar_event_created' when 'UPDATE' then 'calendar_event_updated' else 'calendar_event_deleted' end,
    case when v_ligne.contact_id is not null then 'contact' else 'property' end,
    coalesce(v_ligne.contact_id, v_ligne.property_id),
    case when v_ligne.contact_id is not null then 'contact' else 'bien' end,
    'info', null,
    jsonb_strip_nulls(jsonb_build_object(
      'event_id', v_ligne.id,
      'type', v_ligne.type,
      'starts_at', to_char(v_ligne.starts_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'changed', v_changees)));
  return null;
end $$;
revoke all on function public.calendar_events_journaliser() from public, anon, authenticated;

drop trigger if exists calendar_events_journal on public.calendar_events;
create trigger calendar_events_journal after insert or update or delete on public.calendar_events
  for each row execute function public.calendar_events_journaliser();

-- ── 3. Les libellés, étendus à la quatrième source ───────────────────────────
-- Mêmes signatures que 20260914213550 : un `create or replace` suffit.
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
  union all
  -- ⚠ Un événement RÉCURRENT né avant la fenêtre y a quand même des occurrences : il
  -- garde son libellé.
  select 'event'::text, e.id, e.calendar_label_id
    from public.calendar_events e
   where e.agency_id = public.get_my_agency_id()
     and e.calendar_label_id is not null
     and e.starts_at <= p_to
     and (e.starts_at >= p_from or e.recurrence is not null)
$$;

revoke execute on function public.calendar_label_assignments(timestamptz, timestamptz) from public, anon;
grant execute on function public.calendar_label_assignments(timestamptz, timestamptz) to authenticated;

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
  elsif p_source = 'event' then
    update public.calendar_events set calendar_label_id = p_label_id
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
