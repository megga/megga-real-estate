-- WhatsApp Conversation Intelligence — Engagements actionnables.
-- MEGGA extrait déjà des `commitments` (« Agent: rappeler jeudi ») dans l'insight ;
-- ils restaient INERTES (affichés sur la fiche, jamais transformés en geste). Ici on
-- en dérive des SUGGESTIONS de suivi datées, par contact, que l'agent accepte (→ vrai
-- rappel) ou écarte. Human-in-the-loop : rien ne crée de rappel ni n'écrit au client
-- sans le « accept » de l'agent. Idempotent (date-guard deploy.yml safe).

create table if not exists public.whatsapp_followup_suggestions (
  id                uuid primary key default gen_random_uuid(),
  agency_id         uuid not null references public.agencies (id) on delete cascade,
  contact_id        uuid not null references public.contacts (id) on delete cascade,
  owner             text not null default 'agent' check (owner in ('agent', 'client')),
  action            text not null,
  due_at            timestamptz,                       -- null = engagement sans date (l'agent la pose à l'accept)
  kind              text not null default 'commitment' check (kind in ('commitment', 'next_action')),
  dedup_key         text not null,                     -- stable par (contact, engagement, jour) → pas de doublon au re-run du cron
  status            text not null default 'suggested' check (status in ('suggested', 'accepted', 'dismissed')),
  reminder_id       uuid references public.reminders (id) on delete set null,
  source_insight_at timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (contact_id, dedup_key)
);

create index if not exists idx_wa_followups_agency_status
  on public.whatsapp_followup_suggestions (agency_id, status, created_at desc);
create index if not exists idx_wa_followups_contact
  on public.whatsapp_followup_suggestions (contact_id, status);

alter table public.whatsapp_followup_suggestions enable row level security;

-- L'agent voit / écarte les suggestions de SON agence. L'insert vient du cron
-- (service_role, bypass RLS) ; l'accept passe par la RPC SECURITY DEFINER ci-dessous.
drop policy if exists "wa_followups_agency_select" on public.whatsapp_followup_suggestions;
create policy "wa_followups_agency_select" on public.whatsapp_followup_suggestions
  for select to authenticated using (agency_id = public.get_my_agency_id());

drop policy if exists "wa_followups_agency_update" on public.whatsapp_followup_suggestions;
create policy "wa_followups_agency_update" on public.whatsapp_followup_suggestions
  for update to authenticated
  using (agency_id = public.get_my_agency_id())
  with check (agency_id = public.get_my_agency_id());

drop policy if exists "wa_followups_super_admin_all" on public.whatsapp_followup_suggestions;
create policy "wa_followups_super_admin_all" on public.whatsapp_followup_suggestions
  for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- Accept = l'action humaine. Crée un VRAI rappel (table reminders, convention
-- create_reminder : custom/manual/task/pending) et marque la suggestion acceptée.
-- Idempotent : ré-accepter une suggestion déjà traitée renvoie le rappel existant.
create or replace function public.accept_followup_suggestion(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row   public.whatsapp_followup_suggestions%rowtype;
  v_rid   uuid;
  v_when  timestamptz;
begin
  select * into v_row from public.whatsapp_followup_suggestions where id = p_id;
  if not found then
    raise exception 'suggestion introuvable';
  end if;
  if v_row.agency_id is distinct from public.get_my_agency_id() and not public.is_super_admin() then
    raise exception 'accès refusé';
  end if;
  -- Déjà traitée → renvoyer le rappel existant (re-jouable sans doublon).
  if v_row.status = 'accepted' then
    return v_row.reminder_id;
  end if;

  v_when := coalesce(v_row.due_at, now() + interval '1 day');
  insert into public.reminders (agency_id, contact_id, type, trigger_rule, status, channel, trigger_at, message_template)
  values (v_row.agency_id, v_row.contact_id, 'custom', 'manual', 'pending', 'task', v_when, left(v_row.action, 500))
  returning id into v_rid;

  update public.whatsapp_followup_suggestions
     set status = 'accepted', reminder_id = v_rid, updated_at = now()
   where id = p_id;

  insert into public.activity_events
    (agency_id, actor_id, actor_kind, action, entity_type, entity_id, object_label, category, severity, metadata)
  values
    (v_row.agency_id, auth.uid(), 'user', 'Rappel créé depuis WhatsApp', 'contact', v_row.contact_id,
     left(v_row.action, 500), 'contact', 'info', jsonb_build_object('via', 'whatsapp', 'source', 'followup_suggestion'));

  return v_rid;
end;
$$;

grant execute on function public.accept_followup_suggestion(uuid) to authenticated;
