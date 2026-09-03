-- ============================================================================
-- Messagerie CRM (boîte mail intégrée) — socle.
--
-- Décisions : docs/superpowers/plans/2026-09-03-messagerie-crm.md §3 (D1-D16).
-- Modèle   : §5.  Ce fichier est la source ; le plan est la justification.
--
-- IDEMPOTENT : la CI rejoue toute migration datée du jour à chaque push
-- (backend.yml « Rejouer les migrations du jour », et deploy.yml à chaque
-- déploiement). IF NOT EXISTS partout ; DROP … IF EXISTS avant CREATE POLICY /
-- TRIGGER ; et pour les contraintes, `drop constraint if exists` AVANT chaque
-- `add constraint`.
-- ⚠ LE BLOC DO NE REND RIEN REJOUABLE — corrigé le 03.09.2026. Un second
-- `alter table … add constraint` lève 42710 qu'il soit dans un DO ou non, et le
-- linter n'y voit rien : check-migration-idempotence.mjs blanchit les régions
-- dollar-quotées avant de scanner, et ne contrôle jamais ADD CONSTRAINT. Ce qui
-- protège ici, c'est UNIQUEMENT la paire drop-puis-add. Ajouter une contrainte
-- sans son `drop … if exists` passerait toutes les portes au vert et ne casserait
-- qu'au rejeu du jour — c'est-à-dire en tuant le déploiement.
-- ============================================================================

-- ── 1. Vault : ponts service-role (patron esign_secret_*, 20260607183000) ──────
-- ⚠ Le patron n'a que TROIS fonctions (store / read / delete) — mesuré le
-- 03.09.2026 : `esign_secret_update` n'existe ni au dépôt ni en prod, et
-- `vault.update_secret` n'est appelée nulle part. `mail_secret_update` est donc
-- ÉCRITE, pas recopiée. Vérifiée en prod malgré tout : vault.update_secret a
-- 5 paramètres dont 4 à défaut et fait `coalesce(new_name, s.name)`, donc l'appel
-- à 2 arguments préserve le nom et la description du secret.
-- Un client (anon/authenticated) ne peut JAMAIS lire un jeton : les quatre
-- fonctions sont SECURITY DEFINER, search_path vide, révoquées de tout sauf
-- service_role. mail_accounts.vault_secret_id n'est qu'un pointeur.

create or replace function public.mail_secret_store(p_secret text, p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  v_id := vault.create_secret(p_secret, p_name, 'MEGGA mail account credential');
  return v_id;
end; $$;

create or replace function public.mail_secret_read(p_id uuid)
returns text language sql security definer set search_path = '' as $$
  select decrypted_secret from vault.decrypted_secrets where id = p_id;
$$;

create or replace function public.mail_secret_update(p_id uuid, p_secret text)
returns void language sql security definer set search_path = '' as $$
  select vault.update_secret(p_id, p_secret);
$$;

create or replace function public.mail_secret_delete(p_id uuid)
returns void language sql security definer set search_path = '' as $$
  delete from vault.secrets where id = p_id;
$$;

revoke execute on function public.mail_secret_store(text, text) from public, anon, authenticated;
revoke execute on function public.mail_secret_read(uuid)        from public, anon, authenticated;
revoke execute on function public.mail_secret_update(uuid, text) from public, anon, authenticated;
revoke execute on function public.mail_secret_delete(uuid)      from public, anon, authenticated;
grant  execute on function public.mail_secret_store(text, text) to service_role;
grant  execute on function public.mail_secret_read(uuid)        to service_role;
grant  execute on function public.mail_secret_update(uuid, text) to service_role;
grant  execute on function public.mail_secret_delete(uuid)      to service_role;

-- ── 2. Horodatage ────────────────────────────────────────────────────────────
create or replace function public.mail_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;

-- ── 3. Comptes ───────────────────────────────────────────────────────────────
create table if not exists public.mail_accounts (
  id               uuid primary key default gen_random_uuid(),
  agency_id        uuid not null references public.agencies(id) on delete cascade,
  owner_id         uuid not null references public.profiles(id) on delete cascade,
  provider         text not null,
  email            text not null,
  display_name     text,
  visibility       text not null default 'owner',
  status           text not null default 'active',
  vault_secret_id  uuid,
  sync_cursor      jsonb not null default '{}'::jsonb,
  next_sync_at     timestamptz not null default now(),
  last_sync_at     timestamptz,
  last_error       text,
  imap_config      jsonb,               -- hôtes/ports/utilisateur ; JAMAIS le mot de passe
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

do $$ begin
  alter table public.mail_accounts drop constraint if exists mail_accounts_provider_chk;
  alter table public.mail_accounts add constraint mail_accounts_provider_chk
    check (provider in ('gmail','outlook','imap'));
  alter table public.mail_accounts drop constraint if exists mail_accounts_visibility_chk;
  alter table public.mail_accounts add constraint mail_accounts_visibility_chk
    check (visibility in ('owner','agency'));
  alter table public.mail_accounts drop constraint if exists mail_accounts_status_chk;
  alter table public.mail_accounts add constraint mail_accounts_status_chk
    check (status in ('active','reauth_required','error','disabled'));
  alter table public.mail_accounts drop constraint if exists mail_accounts_email_shape;
  alter table public.mail_accounts add constraint mail_accounts_email_shape
    check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');
end $$;

create unique index if not exists mail_accounts_agency_provider_email_uniq
  on public.mail_accounts (agency_id, provider, lower(email));
create index if not exists mail_accounts_due_idx
  on public.mail_accounts (next_sync_at) where status = 'active';
create index if not exists mail_accounts_owner_idx on public.mail_accounts (owner_id);

drop trigger if exists mail_accounts_touch on public.mail_accounts;
create trigger mail_accounts_touch before update on public.mail_accounts
  for each row execute function public.mail_touch_updated_at();

-- ── 4. États OAuth (state + code_verifier côté serveur, D1) ──────────────────
create table if not exists public.mail_oauth_states (
  state          text primary key,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  agency_id      uuid not null references public.agencies(id) on delete cascade,
  provider       text not null,
  code_verifier  text not null,
  login_hint     text,
  visibility     text not null default 'owner',
  redirect_uri   text not null,
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null default now() + interval '10 minutes',
  consumed_at    timestamptz
);
create index if not exists mail_oauth_states_expires_idx on public.mail_oauth_states (expires_at);

-- ── 5. Libellés (par agence, D12) ────────────────────────────────────────────
create table if not exists public.mail_labels (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid not null references public.agencies(id) on delete cascade,
  name        text not null,
  color       text not null,
  position    integer not null default 0,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
do $$ begin
  alter table public.mail_labels drop constraint if exists mail_labels_color_hex;
  alter table public.mail_labels add constraint mail_labels_color_hex
    check (color ~ '^#[0-9a-fA-F]{6}$');
  alter table public.mail_labels drop constraint if exists mail_labels_name_len;
  alter table public.mail_labels add constraint mail_labels_name_len
    check (length(trim(name)) between 1 and 40);
end $$;
create unique index if not exists mail_labels_agency_name_uniq
  on public.mail_labels (agency_id, lower(name));
drop trigger if exists mail_labels_touch on public.mail_labels;
create trigger mail_labels_touch before update on public.mail_labels
  for each row execute function public.mail_touch_updated_at();

-- ── 6. Fils ──────────────────────────────────────────────────────────────────
create table if not exists public.mail_threads (
  id                  uuid primary key default gen_random_uuid(),
  account_id          uuid not null references public.mail_accounts(id) on delete cascade,
  agency_id           uuid not null references public.agencies(id) on delete cascade,
  provider_thread_id  text not null,
  subject             text,
  snippet             text,
  participants        jsonb not null default '[]'::jsonb,   -- [{name,email}] hors adresse de la boîte
  from_name           text,
  from_email          text,
  last_message_at     timestamptz not null default now(),
  last_inbound_at     timestamptz,
  last_outbound_at    timestamptz,
  message_count       integer not null default 0,
  has_attachments     boolean not null default false,
  is_read             boolean not null default true,
  is_starred          boolean not null default false,
  is_archived         boolean not null default false,
  is_trashed          boolean not null default false,
  label_id            uuid references public.mail_labels(id) on delete set null,
  contact_id          uuid references public.contacts(id) on delete set null,
  search_text         text generated always as (
    lower(coalesce(from_name,'') || ' ' || coalesce(from_email,'') || ' ' ||
          coalesce(subject,'') || ' ' || coalesce(snippet,''))
  ) stored,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create unique index if not exists mail_threads_account_provider_uniq
  on public.mail_threads (account_id, provider_thread_id);
create index if not exists mail_threads_account_recent_idx
  on public.mail_threads (account_id, last_message_at desc) where not is_trashed;
create index if not exists mail_threads_account_unread_idx
  on public.mail_threads (account_id) where not is_read and not is_archived and not is_trashed;
create index if not exists mail_threads_contact_idx
  on public.mail_threads (contact_id) where contact_id is not null;
create index if not exists mail_threads_agency_idx on public.mail_threads (agency_id);
drop trigger if exists mail_threads_touch on public.mail_threads;
create trigger mail_threads_touch before update on public.mail_threads
  for each row execute function public.mail_touch_updated_at();

-- ── 7. Messages ──────────────────────────────────────────────────────────────
create table if not exists public.mail_messages (
  id                   uuid primary key default gen_random_uuid(),
  thread_id            uuid not null references public.mail_threads(id) on delete cascade,
  account_id           uuid not null references public.mail_accounts(id) on delete cascade,
  agency_id            uuid not null references public.agencies(id) on delete cascade,
  provider_message_id  text not null,
  rfc822_message_id    text,
  in_reply_to          text,
  direction            text not null,
  from_name            text,
  from_email           text,
  "to"                 jsonb not null default '[]'::jsonb,
  cc                   jsonb not null default '[]'::jsonb,
  bcc                  jsonb not null default '[]'::jsonb,
  reply_to             text,
  subject              text,
  snippet              text,
  body_text            text,
  body_html            text,
  body_truncated       boolean not null default false,
  sent_at              timestamptz not null,
  is_read              boolean not null default true,
  has_attachments      boolean not null default false,
  provider_labels      text[] not null default '{}',
  contact_id           uuid references public.contacts(id) on delete set null,
  created_at           timestamptz not null default now()
);
do $$ begin
  alter table public.mail_messages drop constraint if exists mail_messages_direction_chk;
  alter table public.mail_messages add constraint mail_messages_direction_chk
    check (direction in ('inbound','outbound'));
end $$;
create unique index if not exists mail_messages_account_provider_uniq
  on public.mail_messages (account_id, provider_message_id);
create index if not exists mail_messages_thread_idx on public.mail_messages (thread_id, sent_at);
create index if not exists mail_messages_rfc822_idx
  on public.mail_messages (account_id, rfc822_message_id) where rfc822_message_id is not null;

-- ── 8. Pièces jointes (métadonnées seulement, D9) ────────────────────────────
create table if not exists public.mail_attachments (
  id                      uuid primary key default gen_random_uuid(),
  message_id              uuid not null references public.mail_messages(id) on delete cascade,
  account_id              uuid not null references public.mail_accounts(id) on delete cascade,
  agency_id               uuid not null references public.agencies(id) on delete cascade,
  provider_attachment_id  text not null,
  filename                text not null,
  mime_type               text not null,
  size_bytes              bigint not null default 0,
  is_inline               boolean not null default false,
  content_id              text,
  document_id             uuid references public.documents(id) on delete set null,
  created_at              timestamptz not null default now()
);
create index if not exists mail_attachments_message_idx on public.mail_attachments (message_id);

-- ── 9. Brouillons locaux (D7) ────────────────────────────────────────────────
create table if not exists public.mail_drafts (
  id                      uuid primary key default gen_random_uuid(),
  account_id              uuid not null references public.mail_accounts(id) on delete cascade,
  agency_id               uuid not null references public.agencies(id) on delete cascade,
  author_id               uuid not null references public.profiles(id) on delete cascade,
  kind                    text not null default 'new',
  thread_id               uuid references public.mail_threads(id) on delete cascade,
  in_reply_to_message_id  uuid references public.mail_messages(id) on delete set null,
  "to"                    jsonb not null default '[]'::jsonb,
  cc                      jsonb not null default '[]'::jsonb,
  subject                 text,
  body_text               text,
  attachments             jsonb not null default '[]'::jsonb,   -- [{name,size,storage_path}] (pièces déjà déposées)
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
do $$ begin
  alter table public.mail_drafts drop constraint if exists mail_drafts_kind_chk;
  alter table public.mail_drafts add constraint mail_drafts_kind_chk
    check (kind in ('new','reply','forward'));
end $$;
create index if not exists mail_drafts_author_idx on public.mail_drafts (author_id, updated_at desc);
drop trigger if exists mail_drafts_touch on public.mail_drafts;
create trigger mail_drafts_touch before update on public.mail_drafts
  for each row execute function public.mail_touch_updated_at();

-- ── 10. Alias appris (D11) ───────────────────────────────────────────────────
create table if not exists public.mail_contact_aliases (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid not null references public.agencies(id) on delete cascade,
  email       text not null,
  contact_id  uuid not null references public.contacts(id) on delete cascade,
  learned_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
-- L'adresse est stockée en minuscules (CHECK) : l'index unique reste simple, donc
-- ciblable par un upsert PostgREST (onConflict ne sait pas viser un index d'expression).
do $$ begin
  alter table public.mail_contact_aliases drop constraint if exists mail_contact_aliases_email_lower;
  alter table public.mail_contact_aliases add constraint mail_contact_aliases_email_lower
    check (email = lower(email));
end $$;
create unique index if not exists mail_contact_aliases_agency_email_uniq
  on public.mail_contact_aliases (agency_id, email);

-- ── 11. Verrou de cron (patron whatsapp_cron_locks) ──────────────────────────
create table if not exists public.mail_cron_locks (
  job           text primary key,
  locked_until  timestamptz not null default now()
);
insert into public.mail_cron_locks (job, locked_until)
  values ('mail-sync', now() - interval '1 hour')
  on conflict (job) do nothing;

-- ── 12. Visibilité (D14) ─────────────────────────────────────────────────────
-- SECURITY DEFINER pour que les policies des tables filles lisent mail_accounts
-- sans dépendre de la policy de mail_accounts elle-même (pas de récursion).
--
-- ⛔ L'APPARTENANCE À L'AGENCE EST CONJOINTE, ET CE N'EST PAS UN DOUBLON DE
-- `visibility` — ne pas la retirer. `visibility` dit qui voit la boîte DANS
-- l'agence ; elle ne dit rien de l'agence du LECTEUR. Sans ce ET, la branche
-- `owner_id = auth.uid()` est une porte de sortie qui survit au départ :
-- `team_remove_member` (20260627120000_profiles_privilege_escalation_lockdown.sql:286)
-- ne fait qu'un `update profiles set agency_id = null, role = 'buyer'` — la ligne
-- profiles SURVIT, donc la clé étrangère `owner_id … on delete cascade` ne se
-- déclenche jamais et le compte reste 'active'. `accept-team-invite/index.ts:148`
-- réécrit ensuite `profiles.agency_id` vers une NOUVELLE agence. L'ex-membre,
-- passé chez un concurrent, continuerait de lire les fils, les corps et les
-- pièces de son ancienne agence — y compris tout ce que le balayage de 2 minutes
-- ingère APRÈS son départ, `mail_accounts_due_idx` ne regardant que `status`.
create or replace function public.mail_account_visible(p_account_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.mail_accounts a
    where a.id = p_account_id
      and a.agency_id = public.get_my_agency_id()
      and (a.visibility = 'agency' or a.owner_id = auth.uid())
  );
$$;
revoke all on function public.mail_account_visible(uuid) from public, anon;
grant execute on function public.mail_account_visible(uuid) to authenticated, service_role;

-- ── 13. RLS ──────────────────────────────────────────────────────────────────
alter table public.mail_accounts        enable row level security;
alter table public.mail_oauth_states    enable row level security;
alter table public.mail_labels          enable row level security;
alter table public.mail_threads         enable row level security;
alter table public.mail_messages        enable row level security;
alter table public.mail_attachments     enable row level security;
alter table public.mail_drafts          enable row level security;
alter table public.mail_contact_aliases enable row level security;
alter table public.mail_cron_locks      enable row level security;

-- Les privilèges par défaut du projet accordent trop à anon (cf. mémoire
-- project_authenticated_truncate_grants) : on révoque tout, puis on accorde le strict.
revoke all on public.mail_accounts, public.mail_oauth_states, public.mail_labels,
  public.mail_threads, public.mail_messages, public.mail_attachments, public.mail_drafts,
  public.mail_contact_aliases, public.mail_cron_locks from anon, authenticated;

grant select on public.mail_threads, public.mail_messages,
  public.mail_attachments to authenticated;
-- ⚠ mail_accounts en LISTE DE COLONNES. Un SELECT de table exposerait
-- `sync_cursor` (historyId Gmail, deltaLink Graph), `imap_config` (hôte, port,
-- utilisateur) et `vault_secret_id` — que personne ne projette : les `select('*')`
-- des lots 1-3 sur cette table passent tous par le client service-role.
grant select (id, agency_id, owner_id, provider, email, display_name, visibility,
  status, last_sync_at, last_error, created_at) on public.mail_accounts to authenticated;
grant select, insert, update, delete on public.mail_labels, public.mail_drafts,
  public.mail_contact_aliases to authenticated;
grant update (label_id) on public.mail_threads to authenticated;

drop policy if exists mail_accounts_select on public.mail_accounts;
create policy mail_accounts_select on public.mail_accounts for select to authenticated
  using (agency_id = public.get_my_agency_id()
         and (visibility = 'agency' or owner_id = auth.uid()));

drop policy if exists mail_labels_all on public.mail_labels;
create policy mail_labels_all on public.mail_labels for all to authenticated
  using (agency_id = public.get_my_agency_id())
  with check (agency_id = public.get_my_agency_id());

drop policy if exists mail_threads_select on public.mail_threads;
create policy mail_threads_select on public.mail_threads for select to authenticated
  using (public.mail_account_visible(account_id));
drop policy if exists mail_threads_update_label on public.mail_threads;
create policy mail_threads_update_label on public.mail_threads for update to authenticated
  using (public.mail_account_visible(account_id))
  -- Le libellé se valide ici : la clé étrangère vers mail_labels est aveugle à
  -- l'agence, et un PATCH sur son propre fil suffirait sinon à y coller l'id
  -- d'un libellé d'une AUTRE agence — qui gouvernerait dès lors le champ
  -- (`on delete set null` le viderait à distance).
  with check (
    public.mail_account_visible(account_id)
    and (label_id is null or exists (
      select 1 from public.mail_labels l
      where l.id = label_id and l.agency_id = public.get_my_agency_id()
    ))
  );

drop policy if exists mail_messages_select on public.mail_messages;
create policy mail_messages_select on public.mail_messages for select to authenticated
  using (public.mail_account_visible(account_id));

drop policy if exists mail_attachments_select on public.mail_attachments;
create policy mail_attachments_select on public.mail_attachments for select to authenticated
  using (public.mail_account_visible(account_id));

drop policy if exists mail_drafts_own on public.mail_drafts;
create policy mail_drafts_own on public.mail_drafts for all to authenticated
  using (author_id = auth.uid() and public.mail_account_visible(account_id))
  with check (author_id = auth.uid()
              and agency_id = public.get_my_agency_id()
              and public.mail_account_visible(account_id));

drop policy if exists mail_contact_aliases_agency on public.mail_contact_aliases;
create policy mail_contact_aliases_agency on public.mail_contact_aliases for all to authenticated
  using (agency_id = public.get_my_agency_id())
  -- `agency_id` seul ne suffit pas : un alias de SON agence pointant vers le
  -- contact d'une autre serait recopié tel quel sur `mail_threads.contact_id`
  -- par l'ingestion (service-role, donc hors RLS). Le fil se lirait « rattaché »
  -- tout en restant vide, sans la moindre erreur.
  with check (
    agency_id = public.get_my_agency_id()
    and exists (
      select 1 from public.contacts c
      where c.id = contact_id and c.agency_id = public.get_my_agency_id()
    )
    and (learned_by is null or learned_by = auth.uid())
  );

-- mail_oauth_states et mail_cron_locks : RLS activée, AUCUNE policy = service_role seul.

-- ── 14. RPC de lecture ───────────────────────────────────────────────────────
-- Dossiers = requêtes (D8). SECURITY INVOKER : la RLS filtre, le total est
-- calculé sur ce que l'appelant a le droit de voir.
create or replace function public.mail_list_threads(
  p_account_id uuid,
  p_folder text default 'in',
  p_label_id uuid default null,
  p_q text default null,
  p_unread_only boolean default false,
  p_att_only boolean default false,
  p_page integer default 0,
  p_per_page integer default 12
)
returns table (
  id uuid, account_id uuid, subject text, snippet text, from_name text, from_email text,
  participants jsonb, last_message_at timestamptz, has_attachments boolean,
  is_read boolean, is_starred boolean, is_archived boolean, is_trashed boolean,
  label_id uuid, contact_id uuid, message_count integer, total bigint
)
language sql stable security invoker set search_path = public as $$
  with q as (
    select lower(trim(coalesce(p_q, ''))) as needle,
           greatest(coalesce(p_per_page, 12), 1) as per_page,
           greatest(coalesce(p_page, 0), 0) as page
  )
  select t.id, t.account_id, t.subject, t.snippet, t.from_name, t.from_email,
         t.participants, t.last_message_at, t.has_attachments,
         t.is_read, t.is_starred, t.is_archived, t.is_trashed,
         t.label_id, t.contact_id, t.message_count,
         count(*) over () as total
  from public.mail_threads t, q
  where t.account_id = p_account_id
    and case p_folder
          when 'in'   then (not t.is_archived and not t.is_trashed and t.last_inbound_at is not null)
          when 'arch' then (t.is_archived and not t.is_trashed)
          when 'star' then (t.is_starred and not t.is_trashed)
          when 'sent' then (t.last_outbound_at is not null and not t.is_trashed)
          else false
        end
    and (p_label_id is null or t.label_id = p_label_id)
    and (not p_unread_only or not t.is_read)
    and (not p_att_only or t.has_attachments)
    -- ⚠ La contre-oblique s'échappe EN PREMIER : c'est le caractère d'échappement
    -- par défaut de LIKE, et l'oublier se trompe dans les deux sens à la fois —
    -- `'ab' like '%a\b%'` rend TRUE (un fil sans contre-oblique remonte) et
    -- `'a\b' like '%a\b%'` rend FALSE (celui qu'on cherche disparaît).
    and (q.needle = '' or t.search_text like
         '%' || replace(replace(replace(q.needle, '\', '\\'), '%', '\%'), '_', '\_') || '%')
  -- Départage stable : une première synchro écrit des fils au même horodatage,
  -- et sans second critère Postgres peut les ordonner autrement d'une page à
  -- l'autre — un fil vu deux fois, un autre jamais. L'index fournit toujours la
  -- tête de tri.
  order by t.last_message_at desc, t.id desc
  limit (select per_page from q) offset (select page * per_page from q);
$$;
revoke all on function public.mail_list_threads(uuid, text, uuid, text, boolean, boolean, integer, integer) from public, anon;
grant execute on function public.mail_list_threads(uuid, text, uuid, text, boolean, boolean, integer, integer) to authenticated;

create or replace function public.mail_unread_counts()
returns table (account_id uuid, unread bigint)
language sql stable security invoker set search_path = public as $$
  select t.account_id, count(*)
  from public.mail_threads t
  where not t.is_read and not t.is_archived and not t.is_trashed and t.last_inbound_at is not null
  group by t.account_id;
$$;
revoke all on function public.mail_unread_counts() from public, anon;
grant execute on function public.mail_unread_counts() to authenticated;

create or replace function public.mail_folder_counts(p_account_id uuid)
returns table (inbox_unread bigint, archived bigint, drafts bigint, label_counts jsonb)
language sql stable security invoker set search_path = public as $$
  select
    (select count(*) from public.mail_threads t where t.account_id = p_account_id
       and not t.is_read and not t.is_archived and not t.is_trashed and t.last_inbound_at is not null),
    (select count(*) from public.mail_threads t where t.account_id = p_account_id
       and t.is_archived and not t.is_trashed),
    (select count(*) from public.mail_drafts d where d.account_id = p_account_id and d.author_id = auth.uid()),
    -- compteur par libellé (rail de la maquette : « 11px var(--mut) » à droite de chaque libellé)
    (select coalesce(jsonb_object_agg(x.label_id, x.n), '{}'::jsonb)
       from (select t.label_id, count(*) as n from public.mail_threads t
             where t.account_id = p_account_id and not t.is_trashed and t.label_id is not null
             group by t.label_id) x);
$$;
revoke all on function public.mail_folder_counts(uuid) from public, anon;
grant execute on function public.mail_folder_counts(uuid) to authenticated;

-- Recherche de contacts pour « Rapprocher l'adresse » — patron tokenisé de
-- _shared/whatsapp-actions.ts:131-153, scoppé sur l'agence de l'appelant.
create or replace function public.mail_search_contacts(p_q text)
returns table (id uuid, first_name text, last_name text, email text, phone text)
language sql stable security invoker set search_path = public as $$
  -- ⚠ LES PARENTHÈSES AUTOUR DE array_remove NE SONT PAS DU STYLE. Mesuré le
  -- 03.09.2026 avec le vrai analyseur PostgreSQL (libpg-query) : `array_remove(…)[1:5]`
  -- rend « syntax error at or near "[" » — un appel de fonction ne se souscrit pas
  -- directement. Et un corps `language sql` est validé À LA CRÉATION
  -- (check_function_bodies), donc la faute aurait tué `supabase db reset`, puis
  -- l'étape migration de deploy.yml, et avec elle le déploiement des edge functions.
  --
  -- ⚠ LES coalesce NON PLUS. `contacts.email` est NULLABLE (mesuré : 3 des 15
  -- contacts vivants ont NULL) : sans coalesce, `lower(c.email) like …` rend NULL,
  -- `bool_and` IGNORE les NULL, et le ET de jetons dégénère en OU dès qu'un seul
  -- jeton correspond — sur les contacts sans adresse, ceux-là mêmes qu'on cherche
  -- pour leur en attacher une. Le coalesce final rend FALSE plutôt que NULL sur une
  -- ligne entièrement nulle.
  with toks as (
    select (array_remove(
      regexp_split_to_array(lower(regexp_replace(coalesce(p_q, ''), '[,()%*_\\]', ' ', 'g')), '\s+'),
      ''
    ))[1:5] as t
  )
  select c.id, c.first_name, c.last_name, c.email, c.phone
  from public.contacts c, toks
  where c.agency_id = public.get_my_agency_id()
    and cardinality(toks.t) > 0
    and coalesce((
      select bool_and(
        lower(coalesce(c.first_name, '')) like '%' || tok || '%'
        or lower(coalesce(c.last_name, '')) like '%' || tok || '%'
        or lower(coalesce(c.email, '')) like '%' || tok || '%'
        or coalesce(c.phone, '') like '%' || tok || '%'
      ) from unnest(toks.t) as tok
    ), false)
  order by c.last_name, c.first_name
  limit 10;
$$;
revoke all on function public.mail_search_contacts(text) from public, anon;
grant execute on function public.mail_search_contacts(text) to authenticated;

-- Rattachement automatique (D11) : la recherche d'un contact PAR ADRESSE passe par
-- ici et non par un filtre PostgREST. Deux raisons mesurées le 03.09.2026 :
--   1. `idx_contacts_agency_email_lower` est `btree (agency_id, lower(email))
--      WHERE email IS NOT NULL` — une EXPRESSION. Un prédicat sur la colonne nue
--      `email` ne peut PAS s'en servir (EXPLAIN forcé : « Index Scan using
--      idx_contacts_agency_created » + « Filter: (email = …) »), alors que
--      `lower(email) = any(…)` donne « Index Cond ». Ce chemin tourne à chaque
--      message de chaque synchro, toutes les 2 minutes par compte.
--   2. `.in('email', …)` compare EN RESPECTANT LA CASSE. Rien ne normalise
--      `contacts.email` à l'écriture (src/hooks/useContacts.ts:126) : un contact
--      saisi « Jean.Dupont@ex.ch » ne serait jamais rattaché à un « jean.dupont@ex.ch »
--      entrant. Panne muette — aucune erreur, le fil reste « Adresse non rattachée »,
--      aucun activity_events, rien sur la timeline. 0 des 15 contacts vivants porte
--      une majuscule : le défaut n'apparaîtrait qu'au premier import CSV.
-- PostgREST ne sait pas écrire `lower(email) in (…)` : d'où la RPC.
-- SECURITY DEFINER + agence passée en paramètre : l'appelant est le service-role de
-- l'ingestion, qui n'a pas d'auth.uid() — l'agence vient du compte, jamais du réseau.
create or replace function public.mail_match_contact_by_emails(p_agency_id uuid, p_emails text[])
returns setof uuid language sql stable security definer set search_path = '' as $$
  select c.id
  from public.contacts c
  where c.agency_id = p_agency_id
    and c.email is not null
    and lower(c.email) = any (p_emails)   -- p_emails est DÉJÀ en minuscules (appelant)
$$;
revoke all on function public.mail_match_contact_by_emails(uuid, text[]) from public, anon, authenticated;
grant execute on function public.mail_match_contact_by_emails(uuid, text[]) to service_role;

-- ── 15. Realtime (fils seulement : le client invalide ses requêtes) ──────────
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mail_threads'
     ) then
    alter publication supabase_realtime add table public.mail_threads;
  end if;
end $$;

-- ⚠ Avec la REPLICA IDENTITY par défaut, l'ancienne ligne d'un DELETE ne porte
-- que la clé primaire : pas d'`agency_id`, donc le filtre serveur du lot 2 jette
-- l'événement. Or des fils disparaissent pour de bon (recomputeThread supprime un
-- fil dont le dernier message s'est évaporé chez le fournisseur). Rejouable : SET.
alter table public.mail_threads replica identity full;

-- ── 16. Rétention : 'messaging' rejoint le seau « info > 3 ans » (D15) ───────
-- Recopie intégrale de 20260705171000 avec UNE catégorie de plus. Sans cette
-- ligne, les événements messaging info seraient conservés sans borne — ce qui
-- n'est pas une décision, c'est un oubli.
create or replace function public.purge_activity_events_retention()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_deleted integer;
begin
  if not (
    public.is_super_admin()
    or public.is_service_role()
    or current_user in ('postgres', 'supabase_admin')
  ) then
    raise exception 'forbidden: super_admin or service only' using errcode = '42501';
  end if;

  delete from public.activity_events
  where severity = 'info'
    and category in ('ai', 'settings', 'contact', 'bien', 'doc', 'messaging')
    and created_at < now() - interval '3 years';

  get diagnostics v_deleted = row_count;

  if v_deleted > 0 then
    insert into public.activity_events
      (agency_id, actor_id, actor_kind, action, entity_type, entity_id,
       category, severity, object_label, metadata)
    values (
      null, null, 'system', 'retention_purge', 'activity_events', null,
      'settings', 'info', 'Purge rétention nLPD',
      jsonb_build_object('deleted_count', v_deleted, 'policy', 'info>3y hors kyc/deal/auth')
    );
  end if;

  return v_deleted;
end;
$$;

-- ── 17. Cron : balayage toutes les 2 minutes (patron 20260803214110) ─────────
-- La commande purge d'abord les états OAuth périmés. Ils portent un code_verifier
-- PKCE et un login_hint (adresse) ; la callback ne fait qu'estampiller
-- `consumed_at`, et un parcours abandonné n'est même pas estampillé — sans cette
-- ligne la table croîtrait sans fin. Même raisonnement qu'au §16 : l'index
-- mail_oauth_states_expires_idx disait déjà qu'une purge était prévue.
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron absent (base locale) : planification ignoree';
    return;
  end if;
  if exists (select 1 from cron.job where jobname = 'mail-sync-2min') then
    perform cron.unschedule('mail-sync-2min');
  end if;
  perform cron.schedule(
    'mail-sync-2min',
    '*/2 * * * *',
    $cmd$
    delete from public.mail_oauth_states where expires_at < now() - interval '1 day';
    select net.http_post(
      url := 'https://eayczugyrvmtqnnmvjod.supabase.co/functions/v1/mail-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || public.get_app_config('service_role_key')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
    $cmd$
  );
end $$;

comment on table public.mail_accounts is 'Messagerie CRM : boîtes connectées (jeton dans Vault via vault_secret_id). Plan 2026-09-03-messagerie-crm.';
comment on table public.mail_threads  is 'Messagerie CRM : fils, état d''affichage et agrégats de liste. Dossiers = requêtes (mail_list_threads).';
comment on table public.mail_messages is 'Messagerie CRM : messages (corps texte + HTML brut plafonné 512 Kio, assaini côté client).';
