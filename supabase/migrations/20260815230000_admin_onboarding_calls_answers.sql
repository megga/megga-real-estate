-- Les réponses de calibrage deviennent lisibles depuis la console.
--
-- `onboarding_calls.attendee_answers` (20260804200000) porte les réponses posées au
-- moment de la réservation de l'appel d'accueil — c'est la matière du calibrage du CRM.
-- Or `get_admin_onboarding_calls` ne rendait pas la colonne : côté console, elle était
-- INJOIGNABLE, pas simplement non affichée (constaté sur la définition vivante le
-- 15.08.2026). Ce fichier l'ajoute au retour, à l'identique pour le reste.
--
-- ⚠ Le type de RETOUR change : `create or replace` refuse (42P13), il faut déposer
-- d'abord — même geste que pour admin_upsert_onboarding_host (20260803214105, §9).
-- La recréation garde EXACTEMENT les mêmes arguments : aucune surcharge ne survit au
-- drop, donc pas d'ambiguïté PGRST203 côté PostgREST.

drop function if exists public.get_admin_onboarding_calls(text, integer, integer);

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
  attendee_answers  jsonb,
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
      c.attendee_phone, c.attendee_note, c.attendee_answers,
      c.rescheduled_count, c.cancel_reason,
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
