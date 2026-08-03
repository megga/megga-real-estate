-- Appel d'accueil : socle de la prise de rendez-vous entre l'équipe MEGGA et une
-- agence qui vient de terminer son dossier d'identité (KYB).
--
-- POURQUOI CES TABLES ET PAS `visits`. `visits` décrit une visite de bien à
-- l'intérieur d'un tenant : `agency_id`, `property_id` et `contact_id` y sont tous
-- NOT NULL, et toute la chaîne aval (cockpit, brief matinal, pipeline, scores) la lit
-- comme telle. Un appel entre MEGGA et une agence n'a ni bien ni contact, et n'appartient
-- à aucun tenant : c'est un objet de PLATEFORME. Le faire entrer dans `visits` aurait
-- exigé de rendre deux colonnes nullables et d'apprendre à toute cette chaîne à ignorer
-- des lignes qui ne la concernent pas.
--
-- CE QUI PORTE VRAIMENT LA CORRECTION, ce sont les deux index partiels uniques plus bas.
-- Une revérification applicative du créneau juste avant l'écriture ne ferme PAS la course :
-- deux requêtes concurrentes la passent toutes les deux. Seule une contrainte d'unicité
-- en base arbitre, et c'est elle que le test de concurrence vise.
--
-- MINIMISATION nLPD : on ne recopie ni le nom ni l'e-mail du réservant. `booked_by`
-- pointe `profiles`, et l'envoi lit la source. Seuls un téléphone facultatif et une note
-- libre sont propres au rendez-vous. `host_display_name` est en revanche figé sur la
-- ligne : c'est le nom sous lequel le rendez-vous a été pris, et un hôte renommé ne doit
-- pas réécrire l'histoire d'un appel passé.

-- ── 1. Le pool d'hôtes MEGGA ────────────────────────────────────────────────
create table if not exists public.onboarding_hosts (
  id                    uuid primary key default gen_random_uuid(),
  profile_id            uuid not null references public.profiles(id) on delete cascade,
  display_name          text not null,
  timezone              text not null default 'Europe/Zurich',
  is_active             boolean not null default true,
  -- [{ "dow": 1..7 (ISO, 1 = lundi), "start": "09:00", "end": "12:00" }, …]
  -- Heure MURALE dans `timezone`, jamais un instant : c'est ce qui rend le passage
  -- à l'heure d'été neutre pour l'hôte.
  weekly_hours          jsonb not null default '[]'::jsonb,
  slot_minutes          integer not null default 30,
  duration_minutes      integer not null default 30,
  buffer_after_minutes  integer not null default 15,
  min_notice_hours      integer not null default 4,
  horizon_days          integer not null default 30,
  max_per_day           integer,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint onboarding_hosts_profile_unique unique (profile_id),
  constraint onboarding_hosts_weekly_hours_is_array check (jsonb_typeof(weekly_hours) = 'array'),
  constraint onboarding_hosts_slot_positive check (slot_minutes between 5 and 240),
  constraint onboarding_hosts_duration_positive check (duration_minutes between 5 and 480),
  constraint onboarding_hosts_buffer_sane check (buffer_after_minutes between 0 and 240),
  constraint onboarding_hosts_notice_sane check (min_notice_hours between 0 and 720),
  constraint onboarding_hosts_horizon_sane check (horizon_days between 1 and 365),
  constraint onboarding_hosts_max_per_day_sane check (max_per_day is null or max_per_day > 0)
);

comment on table public.onboarding_hosts is
  'Membres de l''équipe MEGGA qui reçoivent les agences en appel d''accueil. Table de plateforme : aucun agent ne la lit.';
comment on column public.onboarding_hosts.weekly_hours is
  'Plages hebdomadaires en heure murale du fuseau de l''hôte. Format [{dow,start,end}], dow ISO 1=lundi..7=dimanche.';

-- ── 2. Les exceptions datées ────────────────────────────────────────────────
create table if not exists public.onboarding_host_exceptions (
  id         uuid primary key default gen_random_uuid(),
  host_id    uuid not null references public.onboarding_hosts(id) on delete cascade,
  day        date not null,
  is_closed  boolean not null default true,
  -- Ignoré quand is_closed : sinon, remplace les plages du jour de semaine.
  slices     jsonb not null default '[]'::jsonb,
  reason     text,
  created_at timestamptz not null default now(),
  constraint onboarding_host_exceptions_unique unique (host_id, day),
  constraint onboarding_host_exceptions_slices_is_array check (jsonb_typeof(slices) = 'array')
);

-- ── 3. Le rendez-vous ───────────────────────────────────────────────────────
create table if not exists public.onboarding_calls (
  id                   uuid primary key default gen_random_uuid(),
  agency_id            uuid not null references public.agencies(id) on delete cascade,
  booked_by            uuid not null references public.profiles(id) on delete cascade,
  host_id              uuid not null references public.onboarding_hosts(id) on delete restrict,
  host_display_name    text not null,
  scheduled_at         timestamptz not null,
  duration_minutes     integer not null default 30,
  status               text not null default 'confirmed',
  -- Capability URL : uuid non devinable, servi par RPC SECURITY DEFINER scopée jeton.
  -- JAMAIS par une policy `manage_token is not null` — c'était la fuite `visits`
  -- (cf. 20260711190000_rls_advisors_hardening.sql).
  manage_token         uuid not null default gen_random_uuid(),
  attendee_phone       text,
  attendee_note        text,
  meeting_url          text,
  calendar_provider    text,
  calendar_event_id    text,
  rescheduled_count    integer not null default 0,
  confirmation_sent_at timestamptz,
  reminder_sent_at     timestamptz,
  cancelled_at         timestamptz,
  cancel_reason        text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint onboarding_calls_manage_token_unique unique (manage_token),
  constraint onboarding_calls_status_check
    check (status = any (array['confirmed', 'cancelled', 'done', 'no_show'])),
  constraint onboarding_calls_provider_check
    check (calendar_provider is null or calendar_provider = any (array['google', 'outlook'])),
  constraint onboarding_calls_duration_positive check (duration_minutes between 5 and 480),
  constraint onboarding_calls_reschedule_count_sane check (rescheduled_count >= 0)
);

comment on table public.onboarding_calls is
  'Appel d''accueil MEGGA <-> agence. Objet de plateforme, distinct de `visits` (visite de bien, objet de tenant).';

-- Le vrai garde-fou anti double réservation. Une revérification applicative ne suffit
-- jamais : deux requêtes simultanées la passent toutes les deux et écrivent toutes les deux.
create unique index if not exists idx_onboarding_calls_host_slot
  on public.onboarding_calls (host_id, scheduled_at)
  where status = 'confirmed';

-- Une agence n'a qu'un appel d'accueil en cours. Empêche l'accumulation, et rend
-- « l'appel de cette agence » une question qui a une seule réponse.
create unique index if not exists idx_onboarding_calls_agency_active
  on public.onboarding_calls (agency_id)
  where status = 'confirmed';

create index if not exists idx_onboarding_calls_scheduled
  on public.onboarding_calls (scheduled_at desc);

create index if not exists idx_onboarding_calls_reminder_due
  on public.onboarding_calls (scheduled_at)
  where status = 'confirmed' and reminder_sent_at is null;

create index if not exists idx_onboarding_host_exceptions_day
  on public.onboarding_host_exceptions (host_id, day);

-- ── 4. Fraîcheur de `updated_at` ────────────────────────────────────────────
create or replace function public.touch_onboarding_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.touch_onboarding_updated_at() from public, anon, authenticated;

drop trigger if exists trg_onboarding_hosts_touch on public.onboarding_hosts;
create trigger trg_onboarding_hosts_touch
  before update on public.onboarding_hosts
  for each row execute function public.touch_onboarding_updated_at();

drop trigger if exists trg_onboarding_calls_touch on public.onboarding_calls;
create trigger trg_onboarding_calls_touch
  before update on public.onboarding_calls
  for each row execute function public.touch_onboarding_updated_at();

-- ── 5. RLS et privilèges ────────────────────────────────────────────────────
-- Rappel du footgun maison : Supabase accorde d'office à `anon` et `authenticated`
-- tous les droits sur une table neuve. Une policy permissive écrite plus tard n'aurait
-- alors plus rien devant elle. On révoque d'abord, on ouvre ensuite le strict nécessaire.
alter table public.onboarding_hosts            enable row level security;
alter table public.onboarding_host_exceptions  enable row level security;
alter table public.onboarding_calls            enable row level security;

revoke all on table public.onboarding_hosts           from anon, authenticated;
revoke all on table public.onboarding_host_exceptions from anon, authenticated;
revoke all on table public.onboarding_calls           from anon;

-- Le pool et ses exceptions ne sont JAMAIS lus en direct : la console passe par les RPC
-- gardées ci-dessous. Pas de grant client, donc pas de policy à écrire (deny-all assumé,
-- même famille que les autres `rls_enabled_no_policy` acceptés du dépôt).

grant select on table public.onboarding_calls to authenticated;

drop policy if exists onboarding_calls_select_super_admin on public.onboarding_calls;
create policy onboarding_calls_select_super_admin
  on public.onboarding_calls
  for select to authenticated
  using (public.is_super_admin());

-- L'agence doit voir SON appel pour afficher le rappel dans le CRM. Lecture seule :
-- réserver, replanifier et annuler passent tous par une edge function en service_role.
drop policy if exists onboarding_calls_select_own_agency on public.onboarding_calls;
create policy onboarding_calls_select_own_agency
  on public.onboarding_calls
  for select to authenticated
  using (agency_id = (select public.get_my_agency_id()));

-- ── 6. `activity_events` : une catégorie honnête ────────────────────────────
-- Les huit valeurs existantes ne couvrent pas ce domaine. `settings` mentirait, et un
-- audit qui ment est pire qu'un audit absent : on ajoute la valeur au lieu de la tordre.
do $$
begin
  alter table public.activity_events drop constraint if exists activity_events_category_check;
  alter table public.activity_events add constraint activity_events_category_check
    check (category = any (array[
      'kyc', 'deal', 'contact', 'bien', 'doc', 'auth', 'settings', 'ai', 'onboarding'
    ]));
end $$;

-- ── 7. Lecture publique par jeton ───────────────────────────────────────────
-- Forme calquée sur `get_visit_by_token` : ne renvoie que ce que la page affiche, et
-- rien d'autre. Un jeton fuité n'expose que CE rendez-vous.
create or replace function public.get_onboarding_call_by_token(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', c.id,
    'scheduled_at', c.scheduled_at,
    'duration_minutes', c.duration_minutes,
    'status', c.status,
    'host_name', c.host_display_name,
    'host_timezone', h.timezone,
    'meeting_url', case when c.status = 'confirmed' then c.meeting_url else null end,
    'attendee_name', p.full_name,
    'agency_name', a.name,
    'rescheduled_count', c.rescheduled_count,
    -- La même règle est appliquée côté serveur à l'écriture ; celle-ci ne sert qu'à
    -- ne pas proposer un geste qui sera refusé.
    'can_manage', (c.status = 'confirmed' and c.scheduled_at > now()),
    'can_reschedule', (c.status = 'confirmed' and c.scheduled_at > now() and c.rescheduled_count < 3)
  )
  from public.onboarding_calls c
  join public.onboarding_hosts h on h.id = c.host_id
  left join public.profiles p on p.id = c.booked_by
  left join public.agencies a on a.id = c.agency_id
  where p_token is not null and c.manage_token = p_token
$$;

revoke all on function public.get_onboarding_call_by_token(uuid) from public;
grant execute on function public.get_onboarding_call_by_token(uuid) to anon, authenticated, service_role;

-- ── 8. Lectures de la console super-admin ───────────────────────────────────
create or replace function public.get_admin_onboarding_calls(
  p_status text default null,
  p_limit  integer default 200,
  p_offset integer default 0
)
returns table (
  id                uuid,
  agency_id         uuid,
  agency_name       text,
  agency_slug       text,
  verification_status text,
  booked_by         uuid,
  booked_by_name    text,
  booked_by_email   text,
  host_id           uuid,
  host_name         text,
  scheduled_at      timestamptz,
  duration_minutes  integer,
  status            text,
  meeting_url       text,
  attendee_phone    text,
  attendee_note     text,
  rescheduled_count integer,
  cancel_reason     text,
  created_at        timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_limit  integer := least(greatest(coalesce(p_limit, 200), 1), 2000);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
begin
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;

  return query
    select
      c.id, c.agency_id, a.name, a.slug, a.verification_status,
      c.booked_by, p.full_name, p.email,
      c.host_id, c.host_display_name,
      c.scheduled_at, c.duration_minutes, c.status, c.meeting_url,
      c.attendee_phone, c.attendee_note, c.rescheduled_count, c.cancel_reason,
      c.created_at
    from public.onboarding_calls c
    left join public.agencies a on a.id = c.agency_id
    left join public.profiles p on p.id = c.booked_by
    where p_status is null or c.status = p_status
    order by c.scheduled_at desc
    limit v_limit offset v_offset;
end;
$$;

revoke all on function public.get_admin_onboarding_calls(text, integer, integer) from public, anon;
grant execute on function public.get_admin_onboarding_calls(text, integer, integer) to authenticated, service_role;

create or replace function public.get_admin_onboarding_hosts()
returns table (
  id                   uuid,
  profile_id           uuid,
  display_name         text,
  profile_email        text,
  timezone             text,
  is_active            boolean,
  weekly_hours         jsonb,
  slot_minutes         integer,
  duration_minutes     integer,
  buffer_after_minutes integer,
  min_notice_hours     integer,
  horizon_days         integer,
  max_per_day          integer,
  upcoming_calls       bigint,
  created_at           timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;

  return query
    select
      h.id, h.profile_id, h.display_name, p.email, h.timezone, h.is_active,
      h.weekly_hours, h.slot_minutes, h.duration_minutes, h.buffer_after_minutes,
      h.min_notice_hours, h.horizon_days, h.max_per_day,
      coalesce(n.upcoming, 0), h.created_at
    from public.onboarding_hosts h
    left join public.profiles p on p.id = h.profile_id
    left join lateral (
      select count(*) as upcoming
      from public.onboarding_calls c
      where c.host_id = h.id and c.status = 'confirmed' and c.scheduled_at >= now()
    ) n on true
    order by h.is_active desc, h.display_name asc;
end;
$$;

revoke all on function public.get_admin_onboarding_hosts() from public, anon;
grant execute on function public.get_admin_onboarding_hosts() to authenticated, service_role;

-- ── 9. Gestion du pool depuis la console ────────────────────────────────────
-- ⚠ Le type de RETOUR change par rapport a une version deja posee : `create or replace`
-- refuse (42P13). On depose d'abord — sans quoi la migration n'est pas rejouable.
drop function if exists public.admin_upsert_onboarding_host(uuid, text, text, jsonb, integer, integer, integer, integer, integer, integer);
create or replace function public.admin_upsert_onboarding_host(
  p_profile_id           uuid,
  p_display_name         text,
  p_timezone             text default 'Europe/Zurich',
  p_weekly_hours         jsonb default '[]'::jsonb,
  p_slot_minutes         integer default 30,
  p_duration_minutes     integer default 30,
  p_buffer_after_minutes integer default 15,
  p_min_notice_hours     integer default 4,
  p_horizon_days         integer default 30,
  p_max_per_day          integer default null
)
-- Enveloppe §10.1 (`{ ok, data }` via admin_ok) et non l'uuid nu : tout geste de
-- console partage la meme forme, pour que l'ecran teste une seule cle.
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_slice jsonb;
begin
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;

  if p_profile_id is null or coalesce(trim(p_display_name), '') = '' then
    raise exception 'onboarding_host_invalid: profile_id and display_name required'
      using errcode = '22023';
  end if;

  -- Un fuseau inconnu ne doit pas se découvrir au moment de calculer les créneaux :
  -- la conversion échouerait alors silencieusement, hors de portée de l'écran qui l'a posé.
  begin
    perform now() at time zone p_timezone;
  exception when others then
    raise exception 'onboarding_host_invalid: unknown timezone %', p_timezone using errcode = '22023';
  end;

  if jsonb_typeof(p_weekly_hours) <> 'array' then
    raise exception 'onboarding_host_invalid: weekly_hours must be an array' using errcode = '22023';
  end if;

  for v_slice in select * from jsonb_array_elements(coalesce(p_weekly_hours, '[]'::jsonb)) loop
    if (v_slice->>'dow') is null
       or (v_slice->>'dow')::int not between 1 and 7
       or (v_slice->>'start') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
       or (v_slice->>'end')   !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
       or (v_slice->>'start') >= (v_slice->>'end') then
      raise exception 'onboarding_host_invalid: bad weekly_hours slice %', v_slice using errcode = '22023';
    end if;
  end loop;

  insert into public.onboarding_hosts as h (
    profile_id, display_name, timezone, weekly_hours, slot_minutes, duration_minutes,
    buffer_after_minutes, min_notice_hours, horizon_days, max_per_day
  ) values (
    p_profile_id, trim(p_display_name), p_timezone, p_weekly_hours, p_slot_minutes,
    p_duration_minutes, p_buffer_after_minutes, p_min_notice_hours, p_horizon_days, p_max_per_day
  )
  on conflict (profile_id) do update set
    display_name         = excluded.display_name,
    timezone             = excluded.timezone,
    weekly_hours         = excluded.weekly_hours,
    slot_minutes         = excluded.slot_minutes,
    duration_minutes     = excluded.duration_minutes,
    buffer_after_minutes = excluded.buffer_after_minutes,
    min_notice_hours     = excluded.min_notice_hours,
    horizon_days         = excluded.horizon_days,
    max_per_day          = excluded.max_per_day
  returning h.id into v_id;

  -- Registre MEGGA, en DERNIÈRE instruction (le verrou de chaîne se tient jusqu'au
  -- COMMIT). `activity_events` ne remplace pas ce journal : il raconte ce que font les
  -- AGENCES et ne porte aucune chaîne d'empreintes ; une action de MEGGA passe par ici.
  perform public.admin_log_write(
    p_family => 'ops', p_action => 'onboarding_host_upsert', p_severity => 'info',
    p_entity_type => 'onboarding_host', p_entity_id => v_id, p_entity_label => trim(p_display_name),
    p_metadata => jsonb_build_array(
      jsonb_build_object('l', 'Fuseau', 'v', p_timezone),
      jsonb_build_object('l', 'Plages', 'v', jsonb_array_length(coalesce(p_weekly_hours, '[]'::jsonb))),
      jsonb_build_object('l', 'Duree', 'v', p_duration_minutes)));

  return public.admin_ok(jsonb_build_object('host_id', v_id));
end;
$$;

revoke all on function public.admin_upsert_onboarding_host(uuid, text, text, jsonb, integer, integer, integer, integer, integer, integer) from public, anon;
grant execute on function public.admin_upsert_onboarding_host(uuid, text, text, jsonb, integer, integer, integer, integer, integer, integer) to authenticated, service_role;

drop function if exists public.admin_set_onboarding_host_active(uuid, boolean);
create or replace function public.admin_set_onboarding_host_active(
  p_host_id uuid,
  p_active  boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id    uuid;
  v_label text;
begin
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;

  update public.onboarding_hosts
     set is_active = coalesce(p_active, false)
   where id = p_host_id
  returning id, display_name into v_id, v_label;

  if v_id is null then
    return public.admin_error('not_found', 'Hote introuvable.');
  end if;

  perform public.admin_log_write(
    p_family => 'ops',
    p_action => case when coalesce(p_active, false) then 'onboarding_host_activate' else 'onboarding_host_deactivate' end,
    -- Désactiver le dernier hôte ferme la réservation pour toutes les agences : ce
    -- n'est pas un geste anodin, et le registre doit le dire.
    p_severity => case when coalesce(p_active, false) then 'info' else 'warn' end,
    p_entity_type => 'onboarding_host', p_entity_id => v_id, p_entity_label => v_label);

  return public.admin_ok(jsonb_build_object('is_active', coalesce(p_active, false)));
end;
$$;

revoke all on function public.admin_set_onboarding_host_active(uuid, boolean) from public, anon;
grant execute on function public.admin_set_onboarding_host_active(uuid, boolean) to authenticated, service_role;

-- Marquer l'issue d'un appel passé. Volontairement borné à `done` et `no_show` :
-- annuler prévient l'agence et touche l'agenda de l'hôte, donc annuler passe par
-- l'edge function, pas par une écriture directe.
drop function if exists public.admin_set_onboarding_call_outcome(uuid, text);
create or replace function public.admin_set_onboarding_call_outcome(
  p_call_id uuid,
  p_status  text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id     uuid;
  v_agency uuid;
  v_label  text;
begin
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;

  if p_status is null or p_status not in ('done', 'no_show') then
    raise exception 'onboarding_call_invalid_outcome: %', p_status using errcode = '22023';
  end if;

  update public.onboarding_calls
     set status = p_status
   where id = p_call_id and status = 'confirmed'
  returning id, agency_id, host_display_name into v_id, v_agency, v_label;

  -- Rejouer sur une ligne qui n'est plus `confirmed` ne fait rien, et ne doit donc
  -- rien journaliser : le registre raconterait un geste qui n'a pas eu lieu.
  if v_id is null then
    -- Vocabulaire d'erreur §10.1 FERME : `precondition_failed`, et non un code inventé
    -- (admin_error refuse tout code hors liste, ce qui ferait lever le geste entier).
    return public.admin_error('precondition_failed', 'Appel deja cloture ou annule.');
  end if;

  perform public.admin_log_write(
    p_family => 'ops', p_action => 'onboarding_call_' || p_status,
    p_severity => case when p_status = 'no_show' then 'warn' else 'info' end,
    p_entity_type => 'onboarding_call', p_entity_id => v_id, p_entity_label => v_label,
    p_agency_id => v_agency);

  return public.admin_ok(jsonb_build_object('status', p_status));
end;
$$;

revoke all on function public.admin_set_onboarding_call_outcome(uuid, text) from public, anon;
grant execute on function public.admin_set_onboarding_call_outcome(uuid, text) to authenticated, service_role;
