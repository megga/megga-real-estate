-- L'hôte d'un appel d'accueil peut être une BOÎTE WORKSPACE de MEGGA, et plus seulement
-- un compte du CRM.
--
-- CE QUI CLOCHAIT. `onboarding_hosts.profile_id` était NOT NULL et pointait `profiles`.
-- L'agenda d'un hôte n'était donc lisible que via `google_calendar_tokens`, alimenté par
-- le bouton « connecter mon agenda » de l'écran agent. Autrement dit : pour que MEGGA
-- puisse recevoir une agence, il fallait qu'un membre de MEGGA existe comme UTILISATEUR
-- D'AGENCE — `profiles.agency_id` est NOT NULL — puis se connecte au CRM et clique. La
-- boîte des rendez-vous devenait un locataire de sa propre plateforme, et la prise de
-- rendez-vous de TOUTES les agences dépendait du jeton personnel d'une seule personne.
--
-- CE QUE ÇA DEVIENT. `calendar_email` porte la boîte Workspace dont l'agenda fait foi.
-- Le backend s'y authentifie par délégation à l'échelle du domaine (compte de service,
-- secret `GOOGLE_WORKSPACE_SA_KEY`), sans jeton personnel et sans consentement à
-- renouveler. `profile_id` devient facultatif : il reste la voie d'un hôte qui préfère
-- son propre agenda déjà connecté, et c'est la seule raison de le garder.
--
-- ⚠ Un hôte doit porter AU MOINS l'un des deux. Sans identité d'agenda ni profil, la
-- ligne ne désigne rien : ni un agenda à lire, ni quelqu'un à prévenir.

-- ── 1. La boîte Workspace ───────────────────────────────────────────────────
alter table public.onboarding_hosts
  add column if not exists calendar_email text;

alter table public.onboarding_hosts
  alter column profile_id drop not null;

comment on column public.onboarding_hosts.calendar_email is
  'Boîte Google Workspace dont l''agenda fait foi pour cet hôte. Le backend l''incarne '
  'par délégation à l''échelle du domaine (GOOGLE_WORKSPACE_SA_KEY) — aucun jeton personnel.';

do $$
begin
  -- Forme minimale, pas une validation d'adresse : le seul but est d'attraper un champ
  -- rempli avec un nom ou un uuid. La vraie vérification est l'aller-retour chez Google,
  -- que la console propose en un clic.
  if not exists (
    select 1 from pg_constraint where conname = 'onboarding_hosts_calendar_email_shape'
  ) then
    alter table public.onboarding_hosts
      add constraint onboarding_hosts_calendar_email_shape
      check (calendar_email is null or calendar_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'onboarding_hosts_has_identity'
  ) then
    alter table public.onboarding_hosts
      add constraint onboarding_hosts_has_identity
      check (profile_id is not null or calendar_email is not null);
  end if;
end $$;

-- Deux hôtes sur la même boîte se voleraient leurs créneaux : chacun calculerait sa
-- disponibilité sur le même agenda, et le moteur les traiterait comme deux personnes.
create unique index if not exists idx_onboarding_hosts_calendar_email
  on public.onboarding_hosts (lower(calendar_email))
  where calendar_email is not null;

-- ── 1bis. D'où vient l'événement posé ───────────────────────────────────────
-- `workspace` rejoint `google` et `outlook`. Un événement de boîte Workspace EST un
-- événement Google, mais il ne s'atteint pas avec la même clé : le déplacer ou le
-- retirer exige celle qui l'a créé. Sans cette troisième valeur, il faudrait redeviner
-- la source à chaque geste — et se tromper le jour où un hôte change de voie, laissant
-- l'ancienne entrée orpheline à l'heure abandonnée.
do $$
begin
  alter table public.onboarding_calls drop constraint if exists onboarding_calls_provider_check;
  alter table public.onboarding_calls add constraint onboarding_calls_provider_check
    check (calendar_provider is null or calendar_provider = any (array['google', 'outlook', 'workspace']));
end $$;

-- ── 2. Lecture de la console ────────────────────────────────────────────────
drop function if exists public.get_admin_onboarding_hosts();
create or replace function public.get_admin_onboarding_hosts()
returns table (
  id                   uuid,
  profile_id           uuid,
  display_name         text,
  profile_email        text,
  calendar_email       text,
  -- 'workspace' | 'profile' | 'none' — d'où vient l'agenda, dit une fois pour que
  -- l'écran n'ait pas à redériver la règle de priorité que le backend applique.
  calendar_source      text,
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
      h.id, h.profile_id, h.display_name, p.email, h.calendar_email,
      case
        when h.calendar_email is not null then 'workspace'
        when h.profile_id is not null and (g.user_id is not null or o.user_id is not null) then 'profile'
        else 'none'
      end,
      h.timezone, h.is_active,
      h.weekly_hours, h.slot_minutes, h.duration_minutes, h.buffer_after_minutes,
      h.min_notice_hours, h.horizon_days, h.max_per_day,
      coalesce(n.upcoming, 0), h.created_at
    from public.onboarding_hosts h
    left join public.profiles p on p.id = h.profile_id
    left join public.google_calendar_tokens  g on g.user_id = h.profile_id and g.sync_enabled
    left join public.outlook_calendar_tokens o on o.user_id = h.profile_id and o.sync_enabled
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

-- ── 3. Écriture depuis la console ───────────────────────────────────────────
-- La signature gagne `p_host_id` et `p_calendar_email`, et `p_profile_id` devient
-- facultatif. On DÉPOSE l'ancienne : deux surcharges qui ne diffèrent que par leurs
-- valeurs par défaut rendent l'appel ambigu, et PostgREST refuse alors le geste entier.
drop function if exists public.admin_upsert_onboarding_host(uuid, text, text, jsonb, integer, integer, integer, integer, integer, integer);
create or replace function public.admin_upsert_onboarding_host(
  p_display_name         text,
  p_host_id              uuid    default null,
  p_profile_id           uuid    default null,
  p_calendar_email       text    default null,
  p_timezone             text    default 'Europe/Zurich',
  p_weekly_hours         jsonb   default '[]'::jsonb,
  p_slot_minutes         integer default 30,
  p_duration_minutes     integer default 30,
  p_buffer_after_minutes integer default 15,
  p_min_notice_hours     integer default 4,
  p_horizon_days         integer default 30,
  p_max_per_day          integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id    uuid;
  v_slice jsonb;
  v_email text := nullif(lower(trim(coalesce(p_calendar_email, ''))), '');
begin
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;

  if coalesce(trim(p_display_name), '') = '' then
    raise exception 'onboarding_host_invalid: display_name required' using errcode = '22023';
  end if;

  -- Le miroir applicatif de `onboarding_hosts_has_identity`. La contrainte suffirait à
  -- protéger la table, mais elle remonterait un 23514 que l'écran ne sait pas traduire.
  if p_host_id is null and p_profile_id is null and v_email is null then
    raise exception 'onboarding_host_invalid: profile_id or calendar_email required'
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

  -- Quelle ligne vise-t-on ? `p_host_id` quand l'écran modifie, sinon la ligne qui porte
  -- déjà cette identité. On ne peut PAS s'en remettre à `on conflict (profile_id)` :
  -- deux lignes à `profile_id` nul ne se heurtent pas — Postgres tient les NULL pour
  -- distincts — donc chaque enregistrement d'un hôte Workspace en créerait un nouveau.
  v_id := coalesce(
    p_host_id,
    (select h.id from public.onboarding_hosts h
      where (p_profile_id is not null and h.profile_id = p_profile_id)
         or (v_email is not null and lower(h.calendar_email) = v_email)
      limit 1)
  );

  if v_id is null then
    insert into public.onboarding_hosts (
      profile_id, calendar_email, display_name, timezone, weekly_hours, slot_minutes,
      duration_minutes, buffer_after_minutes, min_notice_hours, horizon_days, max_per_day
    ) values (
      p_profile_id, v_email, trim(p_display_name), p_timezone, p_weekly_hours, p_slot_minutes,
      p_duration_minutes, p_buffer_after_minutes, p_min_notice_hours, p_horizon_days, p_max_per_day
    )
    returning id into v_id;
  else
    update public.onboarding_hosts set
      -- `coalesce` sur les deux identités : une modification qui ne touche pas à
      -- l'agenda ne doit pas le débrancher en passant `null`. Les détacher se fait en
      -- désactivant l'hôte, geste qui a son propre journal.
      profile_id           = coalesce(p_profile_id, profile_id),
      calendar_email       = coalesce(v_email, calendar_email),
      display_name         = trim(p_display_name),
      timezone             = p_timezone,
      weekly_hours         = p_weekly_hours,
      slot_minutes         = p_slot_minutes,
      duration_minutes     = p_duration_minutes,
      buffer_after_minutes = p_buffer_after_minutes,
      min_notice_hours     = p_min_notice_hours,
      horizon_days         = p_horizon_days,
      max_per_day          = p_max_per_day
    where id = v_id;
  end if;

  -- Registre MEGGA, en DERNIÈRE instruction (le verrou de chaîne se tient jusqu'au
  -- COMMIT). `activity_events` ne remplace pas ce journal : il raconte ce que font les
  -- AGENCES et ne porte aucune chaîne d'empreintes ; une action de MEGGA passe par ici.
  perform public.admin_log_write(
    p_family => 'ops', p_action => 'onboarding_host_upsert', p_severity => 'info',
    p_entity_type => 'onboarding_host', p_entity_id => v_id, p_entity_label => trim(p_display_name),
    p_metadata => jsonb_build_array(
      jsonb_build_object('l', 'Agenda', 'v', coalesce(v_email, 'profil CRM')),
      jsonb_build_object('l', 'Fuseau', 'v', p_timezone),
      jsonb_build_object('l', 'Plages', 'v', jsonb_array_length(coalesce(p_weekly_hours, '[]'::jsonb))),
      jsonb_build_object('l', 'Duree', 'v', p_duration_minutes)));

  return public.admin_ok(jsonb_build_object('host_id', v_id));
end;
$$;

revoke all on function public.admin_upsert_onboarding_host(text, uuid, uuid, text, text, jsonb, integer, integer, integer, integer, integer, integer) from public, anon;
grant execute on function public.admin_upsert_onboarding_host(text, uuid, uuid, text, text, jsonb, integer, integer, integer, integer, integer, integer) to authenticated, service_role;
