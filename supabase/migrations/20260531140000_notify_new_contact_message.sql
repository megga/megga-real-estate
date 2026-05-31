-- Storefront « Contact » (megga.ch statique) → notification CRM.
--
-- Le visiteur anonyme peut INSÉRER dans contact_messages (RLS contact_messages_anon_insert,
-- consent_privacy=true imposé) mais PAS dans activity_events. Ce trigger SECURITY DEFINER
-- écrit l'event de notification à sa place, pour que la cloche agent (useAgentNotifications,
-- actor_kind <> 'user') sonne en temps réel. Les super-admins voient l'event via
-- super_admin_read_all_events (agency_id NULL suffit).
--
-- Scopé à source='storefront' : le funnel React /contact (source='contact_page', qui envoie
-- déjà 2 emails Resend via send-email) reste inchangé — pas de doublon de notification.

create or replace function public.notify_new_contact_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subject text := nullif(btrim(new.subject), '');
  v_label   text;
begin
  if new.source is distinct from 'storefront' then
    return new;
  end if;

  v_label := 'Nouveau message de contact'
    || case when coalesce(new.name, '') <> '' then ' · ' || new.name else '' end
    || case when v_subject is not null then ' · ' || v_subject else '' end;

  insert into public.activity_events (
    agency_id, actor_id, actor_kind, action, entity_type, entity_id,
    category, severity, object_label, metadata
  ) values (
    null, null, 'system', 'contact_message_received', 'contact_message', new.id,
    null, 'info', v_label,
    jsonb_build_object('source', new.source, 'subject', v_subject, 'email', new.email::text, 'name', new.name)
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_new_contact_message on public.contact_messages;
create trigger trg_notify_new_contact_message
after insert on public.contact_messages
for each row execute function public.notify_new_contact_message();
