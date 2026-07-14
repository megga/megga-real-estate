-- =====================================================================
-- P8b — Création d'agence depuis l'admin (onboarding sales-led)
--
-- Jusqu'ici une agence ne naissait que via create_agency_and_join (attache
-- l'appelant qui DEVIENT admin de l'agence). Pour un onboarding piloté par
-- l'équipe MEGGA, le super-admin crée l'agence SANS s'y rattacher ; le
-- propriétaire est invité séparément (team_invitations + send-team-invite).
--
-- Réutilise la logique slug + anti-doublon de create_agency_and_join
-- (unique sur lower(btrim(name))). Guard super_admin, audit agency_created.
-- =====================================================================

create or replace function public.admin_create_agency(
  p_name text,
  p_city text default null,
  p_canton text default null,
  p_plan text default 'starter',
  p_solo boolean default false,
  p_note text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path to 'public'
as $$
declare
  v_slug text;
  v_id uuid;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden: super_admin required' using errcode = '42501';
  end if;

  if length(btrim(coalesce(p_name, ''))) < 2 then
    raise exception 'agency name too short';
  end if;
  if p_plan not in ('starter', 'pro', 'entreprise') then
    raise exception 'invalid plan: %', p_plan;
  end if;

  -- Anti-doublon explicite (message clair) — le unique index sur
  -- lower(btrim(name)) reste le backstop en cas de course.
  if exists (select 1 from agencies where lower(btrim(name)) = lower(btrim(p_name))) then
    raise exception 'agency name already exists' using errcode = '23505';
  end if;

  v_slug := lower(regexp_replace(btrim(p_name), '\s+', '-', 'g'));
  if exists (select 1 from agencies where slug = v_slug) then
    v_slug := v_slug || '-' || substring(gen_random_uuid()::text, 1, 6);
  end if;

  insert into agencies (name, slug, city, canton, solo, plan, status, created_by)
  values (btrim(p_name), v_slug, nullif(btrim(coalesce(p_city, '')), ''), p_canton,
          coalesce(p_solo, false), p_plan::agency_plan, 'active', auth.uid())
  returning id into v_id;

  insert into activity_events
    (agency_id, actor_id, actor_kind, action, entity_type, entity_id,
     category, severity, object_label, metadata)
  values (
    v_id, auth.uid(), 'user', 'agency_created', 'agency', v_id,
    'settings', 'info', btrim(p_name),
    jsonb_build_object('admin_created', true, 'plan', p_plan, 'note', p_note)
  );

  return v_id;
end;
$$;

comment on function public.admin_create_agency(text, text, text, text, boolean, text) is
  'Création d''agence par le super-admin (onboarding sales-led) SANS rattachement de l''appelant. Anti-doublon sur lower(btrim(name)). Audité agency_created (admin_created=true). Le propriétaire est invité séparément. Voir 20260714100000.';

revoke all on function public.admin_create_agency(text, text, text, text, boolean, text) from public, anon;
grant execute on function public.admin_create_agency(text, text, text, text, boolean, text) to authenticated;
