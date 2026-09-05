-- Correctif du régime à GRAND NOMBRE : la borne du résolveur de libellés.
--
-- ⚠ FICHIER NEUF plutôt qu'édition de `20260904090500` : `deploy.yml` ne rejoue que les
-- migrations dont l'horodatage vaut >= TODAY. Corriger un fichier daté du matin marcherait
-- aujourd'hui et jamais plus — la production ne le reverrait pas demain.
--
-- LE DÉFAUT. `crm_tabs_resolve_labels` bornait sa boucle à 24, le plafond du CLIENT. Mais
-- le garde-fou de la table vaut 32 (relevé le 04.09.2026 : il a été monté le jour même,
-- justement pour qu'un dépassement transitoire — duplication sur pile pleine, pile
-- entièrement épinglée — n'annule pas l'écriture). Entre 24 et 32, les onglets excédentaires
-- ressortaient donc SANS libellé : ils s'affichaient sous le nom de leur section (« Contacts »)
-- au lieu du nom du client, sur les seules piles où l'on a le plus besoin de les distinguer.
begin;

create or replace function public.crm_tabs_resolve_labels(p_refs jsonb)
returns jsonb
language plpgsql
security invoker
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_labels  jsonb := '{}'::jsonb;
  v_missing jsonb := '[]'::jsonb;
  v_ref     jsonb;
  v_kind    text;
  v_id      text;
  v_uuid    uuid;
  v_label   text;
begin
  if v_uid is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_refs is null or jsonb_typeof(p_refs) <> 'array' then
    return jsonb_build_object('labels', v_labels, 'missing', v_missing);
  end if;

  -- 32 : alignée sur le garde-fou de la TABLE, pas sur le plafond du client.
  for v_ref in
    select value from jsonb_array_elements(p_refs) limit 32
  loop
    v_kind := v_ref ->> 'kind';
    v_id   := v_ref ->> 'id';
    v_label := null;

    begin
      v_uuid := v_id::uuid;
    exception when others then
      v_missing := v_missing || to_jsonb(v_id);
      continue;
    end;

    if v_kind = 'contact' then
      select nullif(btrim(concat_ws(' ', c.first_name, c.last_name)), '')
        into v_label from public.contacts c where c.id = v_uuid;

    elsif v_kind = 'property' then
      select coalesce(nullif(btrim(p.title), ''),
                      nullif(btrim(concat_ws(', ', p.address, p.city)), ''))
        into v_label from public.properties p where p.id = v_uuid;

    elsif v_kind = 'deal' then
      select coalesce(
               nullif(btrim(p.title), ''),
               nullif(btrim(concat_ws(', ', p.address, p.city)), ''),
               nullif(btrim(concat_ws(' ', cb.first_name, cb.last_name)), ''),
               nullif(btrim(concat_ws(' ', cs.first_name, cs.last_name)), ''))
        into v_label
        from public.transactions t
        left join public.properties p on p.id = t.property_id
        left join public.contacts  cb on cb.id = t.contact_buyer_id
        left join public.contacts  cs on cs.id = t.contact_seller_id
       where t.id = v_uuid;

    elsif v_kind = 'kyc' then
      select nullif(btrim(concat_ws(' ', c.first_name, c.last_name)), '')
        into v_label
        from public.kyc_cases k
        left join public.contacts c on c.id = k.contact_id
       where k.id = v_uuid;

    elsif v_kind = 'visit' then
      select coalesce(
               nullif(btrim(v.buyer_name), ''),
               nullif(btrim(concat_ws(' ', c.first_name, c.last_name)), ''),
               nullif(btrim(p.title), ''))
        into v_label
        from public.visits v
        left join public.contacts   c on c.id = v.contact_id
        left join public.properties p on p.id = v.property_id
       where v.id = v_uuid;

    else
      continue;
    end if;

    if not found then
      v_missing := v_missing || to_jsonb(v_id);
    elsif v_label is not null then
      v_labels := v_labels || jsonb_build_object(v_id, v_label);
    end if;
  end loop;

  return jsonb_build_object('labels', v_labels, 'missing', v_missing);
end;
$$;

revoke all on function public.crm_tabs_resolve_labels(jsonb) from public, anon;
grant execute on function public.crm_tabs_resolve_labels(jsonb) to authenticated;

commit;
