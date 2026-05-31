-- Storefront « Publier une annonce » (megga.ch statique) → notification CRM.
--
-- Le visiteur anonyme peut INSÉRER dans seller_leads (RLS seller_leads_anon_insert)
-- mais PAS dans activity_events (seule policy INSERT = super_admin_insert_events).
-- Ce trigger SECURITY DEFINER écrit donc l'event de notification à sa place.
--
-- La cloche agent (useAgentNotifications) lit activity_events WHERE actor_kind <> 'user'.
-- Les super-admins (nos vrais comptes) voient tous les events via super_admin_read_all_events,
-- donc agency_id = assigned_agency_id (NULL pour un lead web non réclamé) suffit.
-- Scopé à source='marketplace' : le funnel React /vendre (source='website', qui crée
-- déjà un daily_action) reste inchangé — pas de doublon de notification.

create or replace function public.notify_new_seller_lead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_city  text := nullif(new.property_data->>'city', '');
  v_type  text := nullif(new.property_data->>'type', '');
  v_label text;
begin
  if new.source is distinct from 'marketplace' then
    return new;
  end if;

  v_label := 'Nouvelle annonce vendeur'
    || case when coalesce(new.contact_name, '') <> '' then ' · ' || new.contact_name else '' end
    || case when v_city is not null then ' · ' || v_city else '' end;

  insert into public.activity_events (
    agency_id, actor_id, actor_kind, action, entity_type, entity_id,
    category, severity, object_label, metadata
  ) values (
    new.assigned_agency_id, null, 'system', 'seller_lead_received', 'seller_lead', new.id,
    'deal', 'info', v_label,
    jsonb_build_object('source', new.source, 'city', v_city, 'type', v_type, 'contact_name', new.contact_name)
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_new_seller_lead on public.seller_leads;
create trigger trg_notify_new_seller_lead
after insert on public.seller_leads
for each row execute function public.notify_new_seller_lead();
