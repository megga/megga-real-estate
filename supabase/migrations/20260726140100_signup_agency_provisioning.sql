-- Chemin d'inscription : le fondateur dirige son agence.
--
-- La vitrine envoie role:'agent' dans raw_user_meta_data, handle_new_user() fige cette
-- valeur, et provision_solo_agency() ne touchait pas au rôle. Or is_agency_admin()
-- (20260726130200) exige admin ou manager : le dirigeant échouait donc à la garde qui
-- protège ses propres données de conformité, et le parcours KYB était bloqué avant
-- d'exister. create_agency_and_join fait l'inverse depuis la baseline : l'appelant
-- devient admin de l'agence qu'il crée. On aligne.
--
-- Idempotente : CREATE OR REPLACE.

create or replace function public.provision_solo_agency(p_user uuid, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_name text := coalesce(nullif(btrim(p_display_name), ''), 'Mon agence');
  v_slug text;
  v_id   uuid;
begin
  -- Même génération de slug que create_agency_and_join (cohérence).
  v_slug := lower(regexp_replace(btrim(v_name), '\s+', '-', 'g'));
  if exists (select 1 from agencies where slug = v_slug) then
    v_slug := v_slug || '-' || substring(gen_random_uuid()::text, 1, 6);
  end if;

  insert into agencies (name, slug, solo, plan, status, created_by)
  values (v_name, v_slug, true, 'starter', 'active', p_user)
  returning id into v_id;

  -- Le fondateur DIRIGE l'agence qu'il vient de créer : sans 'admin' il échoue à
  -- is_agency_admin() et ne peut pas saisir sa propre identité KYB. On ne rattache
  -- que si le profil n'a pas encore d'agence (idempotence backfill / double trigger).
  update profiles
     set agency_id = v_id,
         role = 'admin'
   where id = p_user and agency_id is null;

  return v_id;
end;
$$;

revoke all on function public.provision_solo_agency(uuid, text) from public, anon, authenticated;

comment on function public.provision_solo_agency(uuid, text) is
  'Interne : crée l''agence solo d''un inscrit et l''en fait l''admin. Appelée par handle_new_user uniquement. Aucun EXECUTE client.';
