-- Soft-delete d'un bien par un agent de son agence — RPC SECURITY DEFINER.
--
-- POURQUOI une RPC et pas un UPDATE client : la policy SELECT de `properties`
-- (`agency_id = get_user_agency_id() AND deleted_at IS NULL`) est aussi
-- appliquée par PostgreSQL à la ligne MODIFIÉE dès que l'UPDATE lit la table
-- (clause WHERE). Poser `deleted_at` rend la ligne invisible à sa propre
-- policy → « new row violates row-level security policy » (vérifié
-- empiriquement en rôle authenticated, avec et sans RETURNING). Le definer
-- contourne ce re-check tout en re-vérifiant l'appartenance à l'agence.
--
-- Le trigger AFTER UPDATE `trg_properties_audit` convertit ce touch en
-- événement `bien_soft_deleted` (severity critical) dans activity_events —
-- la trace survit à la suppression (rétention LBA art. 7 al. 3).

create or replace function public.soft_delete_property(p_property_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agency uuid;
  v_n int;
begin
  v_agency := get_user_agency_id();
  if v_agency is null then
    raise exception 'Agence introuvable pour l''utilisateur courant';
  end if;
  update properties
     set deleted_at = now(),
         updated_at = now()
   where id = p_property_id
     and agency_id = v_agency
     and deleted_at is null;
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$$;

comment on function public.soft_delete_property(uuid) is
  'Soft-delete agency-scopé d''un bien (pose deleted_at). SECURITY DEFINER car la policy SELECT (deleted_at IS NULL) bloque l''UPDATE client. Renvoie false si bien introuvable/hors agence/déjà supprimé.';

-- Durcissement : jamais d'EXECUTE par défaut (cf. passe advisors), agents seulement.
revoke execute on function public.soft_delete_property(uuid) from public, anon;
grant execute on function public.soft_delete_property(uuid) to authenticated;
