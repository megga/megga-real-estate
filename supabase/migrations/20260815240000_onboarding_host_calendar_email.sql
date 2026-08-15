-- L'agenda d'un hôte peut être une boîte Workspace de MEGGA, pas un compte personnel.
--
-- Jusqu'ici, le seul chemin vers l'agenda d'un hôte était son jeton OAuth personnel
-- (`google_calendar_tokens`) : l'appel d'accueil dépendait donc du consentement d'une
-- personne, expirait avec lui, et disparaissait à son départ. `calendar_email` déclare
-- la boîte dont l'agenda FAIT FOI ; le backend l'atteint alors par compte de service en
-- usurpation (cf. `_shared/google-service-account.ts`), sans consentement individuel —
-- et c'est aussi la seule voie qui permette de créer un lien Google Meet.
--
-- ⚠ COLONNE NULLE PAR DÉFAUT, ET C'EST VOULU : tant qu'elle n'est pas renseignée, rien
-- ne change pour un hôte existant (voie OAuth conservée, Outlook comprise). La bascule
-- se fait hôte par hôte, sans déploiement, et se défait en remettant NULL.

alter table public.onboarding_hosts
  add column if not exists calendar_email text;

comment on column public.onboarding_hosts.calendar_email is
  'Boîte Google Workspace dont l''agenda fait foi pour cet hôte (usurpée par le compte '
  'de service). NULL = voie historique, jeton OAuth personnel de profile_id. Exige que '
  'la délégation à l''échelle du domaine soit accordée au compte de service pour le '
  'scope calendar, sinon les créneaux de cet hôte cessent d''être proposés.';

-- Une adresse, pas une chaîne libre : cette valeur part telle quelle dans la revendication
-- `sub` de l'assertion JWT. Une faute de frappe y produit un `unauthorized_client` opaque,
-- très loin de l'écran qui l'a saisie.
alter table public.onboarding_hosts
  drop constraint if exists onboarding_hosts_calendar_email_format;
alter table public.onboarding_hosts
  add constraint onboarding_hosts_calendar_email_format
  check (calendar_email is null or calendar_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');

-- ── La console doit voir quelle boîte sert ────────────────────────────────────
-- Sans cela, le réglage le plus structurant de l'appel d'accueil serait invisible : on
-- verrait « aucun créneau » sans pouvoir dire quel agenda est interrogé.
-- ⚠ Le type de RETOUR change ⇒ `create or replace` refuse (42P13) : déposer d'abord.
drop function if exists public.get_admin_onboarding_hosts();

create or replace function public.get_admin_onboarding_hosts()
returns table (
  id                   uuid,
  profile_id           uuid,
  display_name         text,
  profile_email        text,
  calendar_email       text,
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
      h.id, h.profile_id, h.display_name, p.email, h.calendar_email, h.timezone, h.is_active,
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
