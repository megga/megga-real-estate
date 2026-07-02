-- Append ATOMIQUE d'une URL photo à properties.photos — pour l'attache de photos
-- par WhatsApp (attach_property_photos). Une rafale de photos = plusieurs messages
-- traités en parallèle (background) → un read-modify-write applicatif perdrait des
-- photos. Cet UPDATE unique (verrou de ligne Postgres) est atomique et dédupe.
--
-- SECURITY DEFINER : appelé en service_role par l'edge function, qui a DÉJÀ
-- vérifié l'appartenance du bien à l'agence (scope agency_id ici en défense).

create or replace function public.append_property_photo(
  p_property_id uuid,
  p_agency_id uuid,
  p_url text
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.properties
     set photos = case
                    when p_url = any(coalesce(photos, '{}'::text[])) then photos
                    else array_append(coalesce(photos, '{}'::text[]), p_url)
                  end,
         updated_at = now()
   where id = p_property_id
     and agency_id = p_agency_id
     and deleted_at is null
  returning coalesce(array_length(photos, 1), 0) into v_count;
  return v_count; -- NULL si le bien n'existe pas / pas dans l'agence
end;
$$;

revoke all on function public.append_property_photo(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.append_property_photo(uuid, uuid, text) to service_role;
