-- Un fil de notes par contact : chaque note datée, signée, modifiable et supprimable par
-- son auteur (16.09.2026, demande de Julien).
--
-- ⛔ CE QUI EXISTAIT. `contacts.notes` était UN bloc de texte libre. « Plusieurs notes »
-- voulait dire écrire à la suite dans le même bloc : ni date, ni auteur, et chaque frappe
-- réécrivait le bloc entier (enregistrement automatique, sans historique) — une ligne
-- effacée était perdue, deux collègues sur la même fiche s'écrasaient sans le savoir.
-- ⛔ ET LES NOTES DE MEGGA AI N'Y ARRIVAIENT PAS. « Ajoute une note à Camille » (copilote
-- web et WhatsApp) écrivait un `note_added` dans `activity_events`, que la fiche contact
-- du BUREAU n'affiche nulle part : la note existait, l'agent ne la voyait pas.
--
-- CE QUI CHANGE.
--   1. `contact_notes` porte les notes, une par ligne : auteur (agent, MEGGA AI ou
--      système), date de création, date de dernière modification.
--   2. Un agent lit toutes les notes de son agence ; il ne modifie et ne supprime QUE les
--      siennes. Les notes de MEGGA AI et du système ne se modifient pas depuis le CRM.
--   3. Chaque note créée écrit `note_added` au journal (audit, dernière interaction,
--      frise mobile) — pour toutes les voies, plus seulement celle de l'IA.
--   4. `contacts.notes` DEVIENT UN RÉSUMÉ, recalculé à chaque note : les vingt plus
--      récentes, datées. Il reste la lecture des outils qui le lisaient déjà (fiche du
--      copilote, agent WhatsApp, exports) — ils voient désormais aussi les notes de l'IA,
--      sans avoir été touchés.
--   5. Une création de contact qui porte encore `notes` (fiche express, import de lead,
--      agent WhatsApp) en fait la PREMIÈRE note du fil.
--   6. Reprise : chaque `contacts.notes` non vide devient une note, datée de la dernière
--      modification du contact — sans événement de journal (ce ne sont pas des gestes
--      d'aujourd'hui) et sans réécrire le texte d'origine.

-- ═══════════════════════════════════════════════════════════════════════════
-- LA TABLE
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.contact_notes (
  id           uuid primary key default gen_random_uuid(),
  agency_id    uuid not null references public.agencies(id) on delete cascade,
  contact_id   uuid not null references public.contacts(id) on delete cascade,
  author_id    uuid references public.profiles(id) on delete set null,
  author_kind  text not null default 'user',
  body         text not null,
  -- Une note de MEGGA AI garde QUI l'a demandée, et PAR OÙ : c'est ce que l'ancien
  -- `note_added` portait en métadonnées, et qu'on ne perd pas en changeant de table.
  requested_by uuid references public.profiles(id) on delete set null,
  via          text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz
);

do $$ begin
  alter table public.contact_notes drop constraint if exists contact_notes_author_kind_check;
  alter table public.contact_notes add constraint contact_notes_author_kind_check
    check (author_kind in ('user', 'ai', 'system'));
  -- Même cohérence que `activity_events` : un auteur nommé est un humain.
  alter table public.contact_notes drop constraint if exists contact_notes_author_coherence;
  alter table public.contact_notes add constraint contact_notes_author_coherence
    check (author_id is null or author_kind = 'user');
  alter table public.contact_notes drop constraint if exists contact_notes_via_check;
  alter table public.contact_notes add constraint contact_notes_via_check
    check (via is null or via in ('web', 'whatsapp'));
  alter table public.contact_notes drop constraint if exists contact_notes_body_len;
  alter table public.contact_notes add constraint contact_notes_body_len
    check (length(btrim(body)) between 1 and 5000);
end $$;

create index if not exists contact_notes_contact_created_idx
  on public.contact_notes (contact_id, created_at desc);
create index if not exists contact_notes_agency_idx on public.contact_notes (agency_id);
create index if not exists contact_notes_author_idx
  on public.contact_notes (author_id) where author_id is not null;

-- ═══════════════════════════════════════════════════════════════════════════
-- REPRISE — AVANT les triggers : ni événement de journal, ni résumé réécrit
-- ═══════════════════════════════════════════════════════════════════════════
insert into public.contact_notes (agency_id, contact_id, author_id, author_kind, body, created_at)
select c.agency_id,
       c.id,
       p.id,
       case when p.id is not null then 'user' else 'system' end,
       left(btrim(c.notes), 5000),
       coalesce(c.updated_at, c.created_at, now())
from public.contacts c
left join public.profiles p on p.id = c.user_id
where c.agency_id is not null
  and c.notes is not null
  and length(btrim(c.notes)) > 0
  and not exists (select 1 from public.contact_notes n where n.contact_id = c.id);

-- ═══════════════════════════════════════════════════════════════════════════
-- DROITS
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.contact_notes enable row level security;
revoke all on public.contact_notes from anon, authenticated;
grant select, insert, update, delete on public.contact_notes to authenticated;

drop policy if exists contact_notes_select on public.contact_notes;
create policy contact_notes_select on public.contact_notes for select to authenticated
  using (agency_id = public.get_my_agency_id());

drop policy if exists contact_notes_insert on public.contact_notes;
create policy contact_notes_insert on public.contact_notes for insert to authenticated
  with check (agency_id = public.get_my_agency_id());

-- ⛔ Modifier ou supprimer : SA note, et seulement une note d'agent. Une note de MEGGA AI
-- ou du système n'a pas d'auteur humain à qui en confier la réécriture.
drop policy if exists contact_notes_update on public.contact_notes;
create policy contact_notes_update on public.contact_notes for update to authenticated
  using (agency_id = public.get_my_agency_id() and author_kind = 'user' and author_id = auth.uid())
  with check (agency_id = public.get_my_agency_id() and author_kind = 'user' and author_id = auth.uid());

drop policy if exists contact_notes_delete on public.contact_notes;
create policy contact_notes_delete on public.contact_notes for delete to authenticated
  using (agency_id = public.get_my_agency_id() and author_kind = 'user' and author_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════════
-- GARDE : l'auteur est l'appelant, le contact est de l'agence, seul le texte bouge
-- ═══════════════════════════════════════════════════════════════════════════
-- ⚠ SECURITY INVOKER, comme `tg_activity_events_actor_guard` : la garde lit `current_user`,
-- qui vaudrait `postgres` dans une fonction DEFINER. Les rôles de service (edges) écrivent
-- les notes 'ai' et 'system' librement ; un agent n'écrit qu'en son nom.
create or replace function public.tg_contact_notes_guard()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
declare
  v_agence uuid;
begin
  if tg_op = 'INSERT' then
    select c.agency_id into v_agence from public.contacts c where c.id = new.contact_id;
    if v_agence is null or v_agence is distinct from new.agency_id then
      raise exception 'contact_notes: contact hors de l''agence' using errcode = '42501';
    end if;
    if current_user in ('authenticated', 'anon') then
      if auth.uid() is null then
        raise exception 'contact_notes: aucun appelant identifié' using errcode = '42501';
      end if;
      new.author_id := auth.uid();
      new.author_kind := 'user';
      new.requested_by := null;
      new.via := null;
      new.created_at := now();
    end if;
    new.updated_at := null;
    new.body := btrim(new.body);
  else
    -- UPDATE : seul le texte change. Contact, agence, auteur et date de création sont
    -- ceux d'origine, quoi qu'envoie l'appelant.
    new.contact_id := old.contact_id;
    new.agency_id := old.agency_id;
    new.author_id := old.author_id;
    new.author_kind := old.author_kind;
    new.requested_by := old.requested_by;
    new.via := old.via;
    new.created_at := old.created_at;
    new.body := btrim(new.body);
    new.updated_at := case when new.body is distinct from old.body then now() else old.updated_at end;
  end if;
  return new;
end $$;

revoke all on function public.tg_contact_notes_guard() from public, anon, authenticated;
drop trigger if exists trg_contact_notes_guard on public.contact_notes;
create trigger trg_contact_notes_guard
  before insert or update on public.contact_notes
  for each row execute function public.tg_contact_notes_guard();

-- ═══════════════════════════════════════════════════════════════════════════
-- JOURNAL : une note créée est un geste
-- ═══════════════════════════════════════════════════════════════════════════
-- INVOKER, pour passer par la garde de `activity_events` (l'acteur est l'appelant) :
-- l'événement d'un agent est signé de lui, celui d'une edge de MEGGA AI reste 'ai'.
-- `note_added` fait aussi avancer `last_interaction_at` (trg_contact_last_interaction)
-- et alimente la frise du contact sur mobile, qui lit `object_label`.
create or replace function public.tg_contact_notes_audit()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  insert into public.activity_events
    (agency_id, actor_id, actor_kind, action, category, severity, entity_type, entity_id, object_label, metadata)
  values
    (new.agency_id, new.author_id, new.author_kind, 'note_added', 'contact', 'info', 'contact', new.contact_id,
     left(new.body, 500),
     jsonb_strip_nulls(jsonb_build_object('note_id', new.id, 'via', new.via, 'profile_id', new.requested_by)));
  return null;
end $$;

revoke all on function public.tg_contact_notes_audit() from public, anon, authenticated;
drop trigger if exists trg_contact_notes_audit on public.contact_notes;
create trigger trg_contact_notes_audit
  after insert on public.contact_notes
  for each row execute function public.tg_contact_notes_audit();

-- ═══════════════════════════════════════════════════════════════════════════
-- RÉSUMÉ : `contacts.notes` suit le fil
-- ═══════════════════════════════════════════════════════════════════════════
-- DEFINER : supprimer SA note doit pouvoir réécrire le résumé du contact, sans que la
-- politique de mise à jour des contacts entre en jeu. Seule la colonne `notes` est
-- écrite — aucun trigger de `contacts` n'écoute cette colonne (ils visent `phone`,
-- `search_criteria`, les noms) : le résumé ne relance ni le matching ni le rapprochement
-- WhatsApp.
create or replace function public.tg_contact_notes_resume()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  -- Sur DELETE, NEW est nul : on lit OLD, et seulement là.
  v_contact uuid := case when tg_op = 'DELETE' then old.contact_id else new.contact_id end;
begin
  update public.contacts c
     set notes = (
       select left(string_agg(to_char(n.created_at at time zone 'Europe/Zurich', 'DD.MM.YYYY') || ' — ' || n.body,
                              E'\n\n' order by n.created_at desc), 8000)
         from (select created_at, body from public.contact_notes
                where contact_id = v_contact order by created_at desc limit 20) n
     )
   where c.id = v_contact;
  return null;
end $$;

revoke all on function public.tg_contact_notes_resume() from public, anon, authenticated;
drop trigger if exists trg_contact_notes_resume on public.contact_notes;
create trigger trg_contact_notes_resume
  after insert or update of body or delete on public.contact_notes
  for each row execute function public.tg_contact_notes_resume();

-- ═══════════════════════════════════════════════════════════════════════════
-- CRÉATION D'UN CONTACT AVEC `notes` : la première note du fil
-- ═══════════════════════════════════════════════════════════════════════════
-- Les voies qui créent un contact en posant `notes` (fiche express, `import_lead`, agent
-- WhatsApp) n'ont pas à connaître le fil. DEFINER pour écrire la note quelle que soit la
-- voie ; l'auteur est l'appelant s'il y en a un, MEGGA AI pour un lead né sur WhatsApp,
-- le système sinon. Un contact sans agence (formulaire public d'onboarding) n'a pas de fil.
create or replace function public.tg_contacts_notes_premiere()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_auteur uuid := auth.uid();
begin
  if new.agency_id is null or new.notes is null or length(btrim(new.notes)) = 0 then
    return null;
  end if;
  insert into public.contact_notes (agency_id, contact_id, author_id, author_kind, body)
  values (
    new.agency_id, new.id,
    v_auteur,
    case when v_auteur is not null then 'user' when new.source = 'whatsapp_ai' then 'ai' else 'system' end,
    left(btrim(new.notes), 5000)
  );
  return null;
end $$;

revoke all on function public.tg_contacts_notes_premiere() from public, anon, authenticated;
drop trigger if exists trg_contacts_notes_premiere on public.contacts;
create trigger trg_contacts_notes_premiere
  after insert on public.contacts
  for each row execute function public.tg_contacts_notes_premiere();

comment on table public.contact_notes is
  'Fil de notes d''un contact (20260916150000) : une note par ligne, datée et signée '
  '(agent, MEGGA AI ou système). Lecture : toute l''agence ; modification et suppression : '
  'l''auteur seul, notes d''agent seulement. contacts.notes en est le résumé (20 plus récentes).';
