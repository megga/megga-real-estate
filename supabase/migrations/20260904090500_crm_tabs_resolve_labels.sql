-- Libellés des onglets qui pointent un ENREGISTREMENT, et détection des disparus.
--
-- POURQUOI CÔTÉ SERVEUR. Un onglet restauré doit porter son nom AVANT que son écran ne se
-- monte — sinon la barre affiche « Contact » sur six puces au boot, puis se réécrit une par
-- une à mesure qu'on les ouvre. Le client ne peut pas le faire seul : il ne charge que
-- l'écran actif.
--
-- ET SURTOUT : le cas de l'enregistrement DISPARU. Une fiche supprimée entre deux sessions
-- laisse un onglet qui, ouvert, tombe sur un écran d'erreur. Le handoff de design tranche
-- (§6) : « `res_id` supprimé entre deux sessions : l'entrée retombe sur la vue liste de son
-- modèle — jamais un écran d'erreur ». Il faut donc SAVOIR, au chargement de la pile, quels
-- enregistrements ont disparu. C'est ce que `missing` porte.
--
-- ⚠ `security invoker` — et c'est le point de sûreté principal. La fonction s'exécute sous
-- la RLS de l'appelant : un id d'une autre agence ne rend simplement AUCUNE ligne, donc il
-- ressort dans `missing` et son onglet retombe sur la liste. Une `security definer` aurait
-- transformé cette fonction en oracle d'existence inter-agences — on aurait pu sonder
-- l'existence d'un contact chez un concurrent en fabriquant une entrée d'onglet.
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

  -- Borne dure : la pile est plafonnée à 24 entrées (crm_open_tabs_taille). 24 aussi ici,
  -- pour qu'un appel fabriqué ne puisse pas transformer la fonction en balayage.
  for v_ref in
    select value from jsonb_array_elements(p_refs) limit 24
  loop
    v_kind := v_ref ->> 'kind';
    v_id   := v_ref ->> 'id';
    v_label := null;

    -- Un id non-uuid n'est pas une erreur : la route `market/:externalId` en porte un.
    -- Il ressort en `missing`, ce qui est le comportement voulu.
    begin
      v_uuid := v_id::uuid;
    exception when others then
      v_missing := v_missing || to_jsonb(v_id);
      continue;
    end;

    if v_kind = 'contact' then
      select nullif(btrim(concat_ws(' ', c.first_name, c.last_name)), '')
        into v_label
        from public.contacts c
       where c.id = v_uuid;

    elsif v_kind = 'property' then
      select coalesce(nullif(btrim(p.title), ''),
                      nullif(btrim(concat_ws(', ', p.address, p.city)), ''))
        into v_label
        from public.properties p
       where p.id = v_uuid;

    -- Un deal n'a pas de titre à lui : son nom d'usage est celui de son BIEN, et à défaut
    -- celui de son acheteur ou de son vendeur. C'est l'ordre qu'affiche la fiche deal.
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

    -- Un dossier KYC porte le nom de son contact — c'est ce que la fiche affiche.
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
      -- Genre inconnu : ni un libellé, ni un disparu. Le client garde le sien.
      continue;
    end if;

    -- ⚠ `not found` et « trouvé mais sans nom » sont DEUX choses. Un contact sans prénom ni
    -- nom existe (l'import en crée) : son onglet doit rester ouvert avec le libellé de
    -- repli du client, pas retomber sur la liste comme un supprimé.
    if not found then
      v_missing := v_missing || to_jsonb(v_id);
    elsif v_label is not null then
      v_labels := v_labels || jsonb_build_object(v_id, v_label);
    end if;
  end loop;

  return jsonb_build_object('labels', v_labels, 'missing', v_missing);
end;
$$;

comment on function public.crm_tabs_resolve_labels(jsonb) is
  'Resout les libelles des onglets pointant un enregistrement. Entree : [{kind, id}] avec '
  'kind dans (contact, property, deal, kyc, visit). Rend {labels: {id: libelle}, missing: '
  '[id]}. `missing` = enregistrement absent OU illisible sous la RLS de l''appelant — dans '
  'les deux cas l''onglet doit retomber sur la vue liste, jamais sur un ecran d''erreur. '
  'SECURITY INVOKER volontairement : une definer ferait de cette fonction un oracle '
  'd''existence inter-agences.';

revoke all on function public.crm_tabs_resolve_labels(jsonb) from public, anon;
grant execute on function public.crm_tabs_resolve_labels(jsonb) to authenticated;

commit;
