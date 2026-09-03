# Messagerie CRM — Lot 1 : socle backend (tables, Vault, OAuth, synchronisation, envoi)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Avant de commencer** : lire le plan maître
> [2026-09-03-messagerie-crm.md](2026-09-03-messagerie-crm.md) en entier — §3 (décisions D1-D16),
> §4 (flux), §5 (modèle), §6 (hors dépôt), §7 (portes). Ce lot ne les répète pas.
>
> Branche : `claude/real-estate-crm-messaging-5ef3e3`. Un commit par tâche.
> Toute commande se lance depuis la racine du worktree.

**Goal:** Qu'une boîte Google ou Microsoft se connecte (par les edges, sans UI), se synchronise sur 90 jours puis en continu toutes les 2 minutes, et qu'on puisse lire, marquer, archiver, répondre et télécharger une pièce par appel d'edge — tout sous RLS, jetons dans Vault.

**Architecture:** Une migration (`mail_*` + Vault + RPC + cron) ; un dossier `supabase/functions/_shared/mail/` de modules **purs et testables sous Node** (MIME, adaptateurs Gmail/Graph, ingestion, jetons) ; cinq edge functions minces (`mail-oauth`, `mail-sync`, `mail-actions`, `mail-send`, `mail-attachment`) qui n'ont que la garde, la validation et le dispatch.

**Tech Stack:** Postgres 15 (RLS, Vault, pg_cron, pg_net), Deno (edge), Vitest (unit + backend contre `supabase start`).

---

## Règles du lot (elles viennent de pièges déjà payés)

1. ⛔ **`vitest.config.ts` liste EN DUR les specs de `_shared`** (`include: [...]`). Chaque `supabase/functions/_shared/mail/*.test.ts` doit y être ajouté, sinon il ne tourne nulle part. Contrôle : le compteur de tests de `npm run test:unit` monte.
2. ⛔ **Les modules `_shared/mail/*.ts` s'importent sous Node** (jsdom, pas de `Deno`). Donc : `import type` seulement pour `SupabaseClient` ; jamais `Deno.env` au corps du module ; les clients et la config passent en paramètres ; `fetch` reçu en paramètre (`deps.fetch ?? globalThis.fetch`) pour être mocké.
3. ⛔ **`deno check` refuse `Uint8Array<ArrayBufferLike>` comme `BufferSource`** : rendre des `ArrayBuffer` (`bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)`).
4. ⛔ **Toute edge est publique** (`--no-verify-jwt`) : la garde (`requireAgentAuth` / `isServiceSecret`) vient **avant** toute lecture de configuration, et sort par `return`, jamais par `throw`.
5. ⛔ **Service-role = pas de RLS** : chaque `account_id` venu du corps se revérifie contre `auth` (`ownerOrAgencyMember(account, ctx)`), sinon IDOR.
6. **Migration idempotente** (`npm run lint:migrations`) ; un seul fichier pour le lot, horodaté `20260903120000`.
7. `activity_events` : `severity` ∈ `info|warn|critical`, `category='messaging'`, `actor_kind='system'` ⇒ `actor_id` NULL.

---

## Fichiers du lot

| Créé | Rôle |
|---|---|
| `supabase/migrations/20260903120000_mail_module.sql` | tables, Vault, RLS, RPC, Realtime, rétention, cron, verrou |
| `supabase/functions/_shared/mail/types.ts` | types partagés (compte, message normalisé, curseurs, opérations) |
| `supabase/functions/_shared/mail/mime.ts` (+ `.test.ts`) | adresses, RFC 2047, base64url, HTML↔texte, construction MIME |
| `supabase/functions/_shared/mail/secrets.ts` (+ `.test.ts`) | Vault + rafraîchissement de jeton |
| `supabase/functions/_shared/mail/oauth.ts` (+ `.test.ts`) | URL d'autorisation, PKCE, échange de code, identité |
| `supabase/functions/_shared/mail/gmail.ts` (+ `.test.ts`) | adaptateur Gmail API |
| `supabase/functions/_shared/mail/graph.ts` (+ `.test.ts`) | adaptateur Microsoft Graph |
| `supabase/functions/_shared/mail/ingest.ts` (+ `.test.ts`) | upsert fils/messages/pièces, rattachement contact, audit |
| `supabase/functions/_shared/mail/sync.ts` | orchestration d'une synchro de compte (curseur, budget) |
| `supabase/functions/_shared/mail/guard.ts` | `loadVisibleAccount` : IDOR |
| `supabase/functions/mail-oauth/index.ts` | `start` · `exchange` · `disconnect` (+ `connect_imap` au lot 3) |
| `supabase/functions/mail-sync/index.ts` | balayage cron + `{account_id}` ciblé |
| `supabase/functions/mail-actions/index.ts` | `mark_read` · `mark_unread` · `star` · `unstar` · `archive` · `unarchive` · `trash` · `link_contact` · `sync_now` |
| `supabase/functions/mail-send/index.ts` | `new` · `reply` · `forward` |
| `supabase/functions/mail-attachment/index.ts` | `GET ?id=` (flux) · `POST {action:'file'}` (→ `documents`) |
| `tests/backend/mail-rls.spec.ts` | RLS deux agences, Vault, RPC |
| `tests/backend/mail-edges.spec.ts` | contrats HTTP des cinq edges |
| Modifié | |
| `supabase/config.toml` | 5 blocs `[functions.mail-*]` |
| `src/lib/edgeFunctionRoster.ts` | régénéré |
| `vitest.config.ts` | 6 specs `_shared/mail` ajoutés |
| `src/types/database.ts` | régénéré |
| `scripts/check-edge-auth.mjs` | rien à changer si les gardes partagées sont utilisées (vérifier) |

---

### Task 1.1 : Migration `mail_module`

**Files:**
- Create: `supabase/migrations/20260903120000_mail_module.sql`

- [ ] **Step 1 : Écrire la migration**

```sql
-- ============================================================================
-- Messagerie CRM (boîte mail intégrée) — socle.
--
-- Décisions : docs/superpowers/plans/2026-09-03-messagerie-crm.md §3 (D1-D16).
-- Modèle   : §5.  Ce fichier est la source ; le plan est la justification.
--
-- IDEMPOTENT : la CI rejoue toute migration datée du jour à chaque push
-- (scripts/check-migration-idempotence.mjs). IF NOT EXISTS partout ; DROP … IF
-- EXISTS avant CREATE POLICY / TRIGGER ; contraintes dans des blocs DO.
-- ============================================================================

-- ── 1. Vault : ponts service-role (patron esign_secret_*, 20260607183000) ──────
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
create or replace function public.mail_account_visible(p_account_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.mail_accounts a
    where a.id = p_account_id
      and (
        (a.visibility = 'agency' and a.agency_id = public.get_my_agency_id())
        or a.owner_id = auth.uid()
      )
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

grant select on public.mail_accounts, public.mail_threads, public.mail_messages,
  public.mail_attachments to authenticated;
grant select, insert, update, delete on public.mail_labels, public.mail_drafts,
  public.mail_contact_aliases to authenticated;
grant update (label_id) on public.mail_threads to authenticated;

drop policy if exists mail_accounts_select on public.mail_accounts;
create policy mail_accounts_select on public.mail_accounts for select to authenticated
  using ((visibility = 'agency' and agency_id = public.get_my_agency_id()) or owner_id = auth.uid());

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
  with check (public.mail_account_visible(account_id));

drop policy if exists mail_messages_select on public.mail_messages;
create policy mail_messages_select on public.mail_messages for select to authenticated
  using (public.mail_account_visible(account_id));

drop policy if exists mail_attachments_select on public.mail_attachments;
create policy mail_attachments_select on public.mail_attachments for select to authenticated
  using (public.mail_account_visible(account_id));

drop policy if exists mail_drafts_own on public.mail_drafts;
create policy mail_drafts_own on public.mail_drafts for all to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid() and public.mail_account_visible(account_id));

drop policy if exists mail_contact_aliases_agency on public.mail_contact_aliases;
create policy mail_contact_aliases_agency on public.mail_contact_aliases for all to authenticated
  using (agency_id = public.get_my_agency_id())
  with check (agency_id = public.get_my_agency_id());

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
    and (q.needle = '' or t.search_text like '%' || replace(replace(q.needle, '%', '\%'), '_', '\_') || '%')
  order by t.last_message_at desc
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
  with toks as (
    select array_remove(
      regexp_split_to_array(lower(regexp_replace(coalesce(p_q, ''), '[,()%*]', ' ', 'g')), '\s+'),
      ''
    )[1:5] as t
  )
  select c.id, c.first_name, c.last_name, c.email, c.phone
  from public.contacts c, toks
  where c.agency_id = public.get_my_agency_id()
    and cardinality(toks.t) > 0
    and (
      select bool_and(
        lower(c.first_name) like '%' || tok || '%'
        or lower(c.last_name) like '%' || tok || '%'
        or lower(c.email) like '%' || tok || '%'
        or coalesce(c.phone, '') like '%' || tok || '%'
      ) from unnest(toks.t) as tok
    )
  order by c.last_name, c.first_name
  limit 10;
$$;
revoke all on function public.mail_search_contacts(text) from public, anon;
grant execute on function public.mail_search_contacts(text) to authenticated;

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
```

- [ ] **Step 2 : Vérifier l'idempotence et l'appliquer en local**

```bash
npm run lint:migrations
supabase start
supabase db reset
```
Attendu : `lint:migrations` sans faute ; `db reset` termine sans erreur (la clause pg_cron est ignorée avec un NOTICE en local).

- [ ] **Step 3 : Sonder ce que la base a réellement créé**

```bash
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '"')" -c "\d public.mail_threads" | head -40
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '"')" -c "select proname from pg_proc where proname like 'mail_%' order by 1"
```
Attendu : la colonne `search_text` est `generated always as … stored` ; 9 fonctions `mail_*` (4 Vault + `mail_account_visible` + `mail_list_threads` + `mail_unread_counts` + `mail_folder_counts` + `mail_search_contacts` + `mail_touch_updated_at` = 10).

- [ ] **Step 4 : Commit**

```bash
git add supabase/migrations/20260903120000_mail_module.sql
git commit -m "feat(messagerie): socle SQL — comptes, fils, messages, Vault, RLS, RPC, cron"
```

---

### Task 1.2 : Spec backend RLS + RPC + Vault

**Files:**
- Create: `tests/backend/mail-rls.spec.ts`

- [ ] **Step 1 : Écrire le spec (il doit rougir si une policy manque)**

```ts
// RLS de la Messagerie : visibilité owner/agency, isolation inter-agences, Vault
// inaccessible aux clients, RPC de liste. Tourne contre `supabase start`
// (SUPABASE_TEST_*), jamais la prod. skipIf sans clés.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'
const ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY ?? ''
const PASSWORD = 'Test-Password-123!'

describe.skipIf(!HAS_KEYS)('Messagerie — RLS, RPC, Vault', () => {
  let s: TwoAgenciesSetup
  let service: SupabaseClient
  let ownerBoxId: string      // boîte 'owner' de l'agent A
  let sharedBoxId: string     // boîte 'agency' de l'agent A
  let boxBId: string          // boîte de l'agence B
  let agentA2Id: string
  let clientA2: SupabaseClient
  let threadOwnerId: string
  let threadSharedId: string
  let labelAId: string

  const mkAccount = async (agencyId: string, ownerId: string, email: string, visibility: 'owner' | 'agency') => {
    const { data, error } = await service.from('mail_accounts').insert({
      agency_id: agencyId, owner_id: ownerId, provider: 'gmail', email, visibility,
    }).select('id').single()
    if (error) throw new Error(`mail_accounts ${email}: ${error.message}`)
    return data.id as string
  }
  const mkThread = async (accountId: string, agencyId: string, subject: string, extra: Record<string, unknown> = {}) => {
    const { data, error } = await service.from('mail_threads').insert({
      account_id: accountId, agency_id: agencyId, provider_thread_id: `t-${subject}-${Date.now()}`,
      subject, snippet: 'extrait', from_name: 'Alice Martin', from_email: 'alice@example.ch',
      last_message_at: new Date().toISOString(), last_inbound_at: new Date().toISOString(),
      is_read: false, ...extra,
    }).select('id').single()
    if (error) throw new Error(`mail_threads ${subject}: ${error.message}`)
    return data.id as string
  }

  beforeAll(async () => {
    s = await setupTwoAgencies()
    service = serviceRoleClient()
    ownerBoxId = await mkAccount(s.agencyAId, s.agentAId, `perso-${s.stamp}@a.test`, 'owner')
    sharedBoxId = await mkAccount(s.agencyAId, s.agentAId, `contact-${s.stamp}@a.test`, 'agency')
    boxBId = await mkAccount(s.agencyBId, s.agentBId, `contact-${s.stamp}@b.test`, 'agency')
    threadOwnerId = await mkThread(ownerBoxId, s.agencyAId, 'Perso A')
    threadSharedId = await mkThread(sharedBoxId, s.agencyAId, 'Partagé A')
    await mkThread(sharedBoxId, s.agencyAId, 'Archivé A', { is_archived: true, is_read: true })
    await mkThread(boxBId, s.agencyBId, 'Agence B')

    // Second agent DANS l'agence A : voit la boîte partagée, pas la boîte perso.
    const emailA2 = `agent-a2-${s.stamp}@megga-test.local`
    const { data: u, error: uErr } = await service.auth.admin.createUser({
      email: emailA2, password: PASSWORD, email_confirm: true,
      user_metadata: { full_name: 'Agent A2', role: 'agent' },
    })
    if (uErr) throw new Error(uErr.message)
    agentA2Id = u!.user!.id
    await service.from('profiles').upsert(
      { id: agentA2Id, email: emailA2, full_name: 'Agent A2', role: 'agent', agency_id: s.agencyAId },
      { onConflict: 'id' },
    )
    clientA2 = createClient(URL, ANON_KEY)
    const { error: sErr } = await clientA2.auth.signInWithPassword({ email: emailA2, password: PASSWORD })
    if (sErr) throw new Error(sErr.message)

    const { data: lab, error: lErr } = await s.clientA.from('mail_labels')
      .insert({ agency_id: s.agencyAId, name: `À traiter ${s.stamp}`, color: '#fe566b' }).select('id').single()
    if (lErr) throw new Error(lErr.message)
    labelAId = lab.id
  }, 60_000)

  afterAll(async () => {
    await service.from('mail_accounts').delete().in('id', [ownerBoxId, sharedBoxId, boxBId])
    await service.from('mail_labels').delete().eq('id', labelAId)
    if (agentA2Id) await service.auth.admin.deleteUser(agentA2Id)
    await s.cleanup()
  })

  it('le propriétaire voit ses deux boîtes, un collègue ne voit que la partagée', async () => {
    const { data: mine } = await s.clientA.from('mail_accounts').select('id').in('id', [ownerBoxId, sharedBoxId])
    expect((mine ?? []).map((r) => r.id).sort()).toEqual([ownerBoxId, sharedBoxId].sort())
    const { data: colleague } = await clientA2.from('mail_accounts').select('id').in('id', [ownerBoxId, sharedBoxId])
    expect((colleague ?? []).map((r) => r.id)).toEqual([sharedBoxId])
  })

  it('une autre agence ne voit rien, ni comptes ni fils', async () => {
    const { data: acc } = await s.clientB.from('mail_accounts').select('id').in('id', [ownerBoxId, sharedBoxId])
    expect(acc ?? []).toEqual([])
    const { data: th } = await s.clientB.from('mail_threads').select('id').in('id', [threadOwnerId, threadSharedId])
    expect(th ?? []).toEqual([])
  })

  it('les fils suivent la visibilité du compte', async () => {
    const { data } = await clientA2.from('mail_threads').select('id').in('id', [threadOwnerId, threadSharedId])
    expect((data ?? []).map((r) => r.id)).toEqual([threadSharedId])
  })

  it('un client ne peut pas écrire un fil, ni un compte, ni lire un état OAuth', async () => {
    const { error: e1 } = await s.clientA.from('mail_threads')
      .update({ is_read: true }).eq('id', threadSharedId).select('id')
    // La colonne is_read n'est pas accordée à authenticated : PostgREST refuse (42501).
    expect(e1).not.toBeNull()
    const { error: e2 } = await s.clientA.from('mail_accounts')
      .insert({ agency_id: s.agencyAId, owner_id: s.agentAId, provider: 'gmail', email: 'x@y.test' })
    expect(e2).not.toBeNull()
    const { data: st, error: e3 } = await s.clientA.from('mail_oauth_states').select('state')
    expect(e3).not.toBeNull()
    expect(st ?? []).toEqual([])
  })

  it('un client peut poser un libellé sur un fil visible (colonne accordée)', async () => {
    const { error } = await s.clientA.from('mail_threads')
      .update({ label_id: labelAId }).eq('id', threadSharedId)
    expect(error).toBeNull()
    const { data } = await s.clientA.from('mail_threads').select('label_id').eq('id', threadSharedId).single()
    expect(data?.label_id).toBe(labelAId)
  })

  it('les ponts Vault sont refusés aux clients', async () => {
    const { error } = await s.clientA.rpc('mail_secret_read', { p_id: '00000000-0000-0000-0000-000000000000' })
    expect(error).not.toBeNull()
    expect(String(error?.message)).toMatch(/permission denied|not found|42501/i)
  })

  it('mail_list_threads : dossiers, total, recherche', async () => {
    const inbox = await s.clientA.rpc('mail_list_threads', { p_account_id: sharedBoxId, p_folder: 'in' })
    expect(inbox.error).toBeNull()
    expect(inbox.data?.map((r: { subject: string }) => r.subject)).toEqual(['Partagé A'])
    expect(Number(inbox.data?.[0]?.total)).toBe(1)

    const arch = await s.clientA.rpc('mail_list_threads', { p_account_id: sharedBoxId, p_folder: 'arch' })
    expect(arch.data?.map((r: { subject: string }) => r.subject)).toEqual(['Archivé A'])

    const search = await s.clientA.rpc('mail_list_threads', { p_account_id: sharedBoxId, p_folder: 'in', p_q: 'ALICE' })
    expect(search.data?.length).toBe(1)
    const none = await s.clientA.rpc('mail_list_threads', { p_account_id: sharedBoxId, p_folder: 'in', p_q: 'zzz' })
    expect(none.data ?? []).toEqual([])

    // Un compte invisible rend une liste vide, pas une erreur (la RLS filtre avant).
    const foreign = await s.clientB.rpc('mail_list_threads', { p_account_id: sharedBoxId, p_folder: 'in' })
    expect(foreign.data ?? []).toEqual([])
  })

  it('mail_unread_counts et mail_folder_counts', async () => {
    const { data } = await s.clientA.rpc('mail_unread_counts')
    const row = (data ?? []).find((r: { account_id: string }) => r.account_id === sharedBoxId)
    expect(Number(row?.unread)).toBe(1)
    const { data: fc } = await s.clientA.rpc('mail_folder_counts', { p_account_id: sharedBoxId })
    expect(Number(fc?.[0]?.inbox_unread)).toBe(1)
    expect(Number(fc?.[0]?.archived)).toBe(1)
    expect(Number(fc?.[0]?.drafts)).toBe(0)
    expect(fc?.[0]?.label_counts).toEqual({ [labelAId]: 1 })
  })

  it('mail_search_contacts cherche dans l agence de l appelant seulement', async () => {
    const { data: c } = await service.from('contacts').insert({
      agency_id: s.agencyAId, first_name: 'Zoé', last_name: 'Rochat', email: `zoe-${s.stamp}@ex.ch`, type: 'buyer',
    }).select('id').single()
    const hit = await s.clientA.rpc('mail_search_contacts', { p_q: 'zoé roch' })
    expect(hit.data?.map((r: { id: string }) => r.id)).toContain(c!.id)
    const miss = await s.clientB.rpc('mail_search_contacts', { p_q: 'zoé roch' })
    expect((miss.data ?? []).map((r: { id: string }) => r.id)).not.toContain(c!.id)
    await service.from('contacts').delete().eq('id', c!.id)
  })
})
```

- [ ] **Step 2 : Lancer, lire les échecs, corriger la migration si une policy manque**

```bash
npm run test:backend -- tests/backend/mail-rls.spec.ts
```
Attendu : 9 tests verts. Si « permission denied for table mail_labels » : le `grant` de §13 manque ; si le test « colonne accordée » rougit avec 42501 : le `grant update (label_id)` manque.

- [ ] **Step 3 : Commit**

```bash
git add tests/backend/mail-rls.spec.ts
git commit -m "test(messagerie): RLS owner/agency, isolation, Vault, RPC de liste"
```

---

### Task 1.3 : Types partagés + MIME (`_shared/mail/types.ts`, `mime.ts`)

**Files:**
- Create: `supabase/functions/_shared/mail/types.ts`
- Create: `supabase/functions/_shared/mail/mime.ts`
- Test: `supabase/functions/_shared/mail/mime.test.ts`
- Modify: `vitest.config.ts` (liste `include`)

- [ ] **Step 1 : Écrire les types**

```ts
// supabase/functions/_shared/mail/types.ts
// Types de la Messagerie partagés par les adaptateurs, l'ingestion et les edges.
// PUR : aucun import runtime, importable sous Node (tests) et Deno (edges).

export type MailProviderId = 'gmail' | 'outlook' | 'imap'
export type MailVisibility = 'owner' | 'agency'
export type MailAccountStatus = 'active' | 'reauth_required' | 'error' | 'disabled'
export type MailDirection = 'inbound' | 'outbound'

export interface MailAddress {
  name: string | null
  email: string
}

/** Ligne de `mail_accounts` telle que lue en service-role. */
export interface MailAccountRow {
  id: string
  agency_id: string
  owner_id: string
  provider: MailProviderId
  email: string
  display_name: string | null
  visibility: MailVisibility
  status: MailAccountStatus
  vault_secret_id: string | null
  sync_cursor: SyncCursor | Record<string, never>
  next_sync_at: string
  last_sync_at: string | null
  last_error: string | null
  imap_config: ImapConfig | null
}

/** Configuration IMAP/SMTP NON secrète (le mot de passe est dans Vault). */
export interface ImapConfig {
  imapHost: string
  imapPort: number
  smtpHost: string
  smtpPort: number
  user: string
  encryption: 'ssl' | 'starttls'
}

export interface NormalizedAttachment {
  providerAttachmentId: string
  filename: string
  mimeType: string
  sizeBytes: number
  isInline: boolean
  contentId: string | null
}

/** Un message tel que l'ingestion le consomme, quel que soit le fournisseur. */
export interface NormalizedMessage {
  providerMessageId: string
  providerThreadId: string
  rfc822MessageId: string | null
  inReplyTo: string | null
  references: string[]
  direction: MailDirection
  from: MailAddress
  to: MailAddress[]
  cc: MailAddress[]
  bcc: MailAddress[]
  replyTo: string | null
  subject: string
  snippet: string
  bodyText: string | null
  bodyHtml: string | null
  /** ISO 8601. */
  sentAt: string
  isRead: boolean
  isStarred: boolean
  inInbox: boolean
  isTrashed: boolean
  isDraft: boolean
  providerLabels: string[]
  attachments: NormalizedAttachment[]
}

/** Changement d'état venu du fournisseur (geste fait dans Gmail/Outlook). */
export type RemoteChange =
  | { kind: 'message_deleted'; providerMessageId: string }
  | {
      kind: 'flags'
      providerMessageId: string
      isRead?: boolean
      isStarred?: boolean
      inInbox?: boolean
      isTrashed?: boolean
    }

export interface GmailCursor {
  kind: 'gmail'
  /** historyId de départ de la prochaine synchro incrémentale. */
  historyId: string | null
  /** pageToken de la première passe (90 jours) tant qu'elle n'est pas finie. */
  initialPageToken: string | null
  initialDone: boolean
}

export interface GraphCursor {
  kind: 'outlook'
  inboxDelta: string | null
  sentDelta: string | null
  initialDone: boolean
  /** Ids opaques des dossiers connus (inbox, sentitems, archive, deleteditems), résolus une fois. */
  folderIds: Record<string, string> | null
}

export interface ImapCursor {
  kind: 'imap'
  folders: Record<string, { uidValidity: number; lastUid: number }>
  initialDone: boolean
}

export type SyncCursor = GmailCursor | GraphCursor | ImapCursor

/** Ce qu'une passe de synchro rend à l'orchestrateur. */
export interface SyncPass {
  messages: NormalizedMessage[]
  changes: RemoteChange[]
  cursor: SyncCursor
  /** false = il reste des pages ; l'orchestrateur rappelle au tick suivant. */
  done: boolean
}

export interface OAuthSecret {
  refresh_token: string
  access_token: string
  /** ISO 8601. */
  expires_at: string
}

export interface ImapSecret {
  password: string
}

export type AccountSecret = OAuthSecret | ImapSecret

/** Entrée de construction d'un message sortant. */
export interface OutgoingMessage {
  from: MailAddress
  to: MailAddress[]
  cc: MailAddress[]
  bcc: MailAddress[]
  subject: string
  text: string
  html: string
  inReplyTo: string | null
  references: string[]
  messageId: string
  attachments: { filename: string; mimeType: string; base64: string }[]
}
```

- [ ] **Step 2 : Écrire le test MIME (rouge)**

```ts
// supabase/functions/_shared/mail/mime.test.ts
import { describe, it, expect } from 'vitest'
import {
  parseAddress, parseAddressList, decodeRfc2047, htmlToText, textToHtml, snippetOf,
  base64UrlDecodeToString, base64UrlEncodeString, buildMime, makeMessageId, encodeHeaderWord,
} from './mime.ts'

describe('adresses', () => {
  it('lit les trois formes', () => {
    expect(parseAddress('"Alice Martin" <alice@ex.ch>')).toEqual({ name: 'Alice Martin', email: 'alice@ex.ch' })
    expect(parseAddress('Alice Martin <alice@ex.ch>')).toEqual({ name: 'Alice Martin', email: 'alice@ex.ch' })
    expect(parseAddress('alice@ex.ch')).toEqual({ name: null, email: 'alice@ex.ch' })
    expect(parseAddress('')).toBeNull()
  })
  it('sépare une liste sur les virgules hors guillemets', () => {
    const l = parseAddressList('"Martin, Alice" <alice@ex.ch>, bob@ex.ch')
    expect(l).toEqual([{ name: 'Martin, Alice', email: 'alice@ex.ch' }, { name: null, email: 'bob@ex.ch' }])
  })
  it('décode un nom RFC 2047 en B et en Q', () => {
    expect(decodeRfc2047('=?UTF-8?B?Wm/DqSBSb2NoYXQ=?= <zoe@ex.ch>')).toBe('Zoé Rochat <zoe@ex.ch>')
    expect(decodeRfc2047('=?utf-8?Q?Zo=C3=A9_Rochat?=')).toBe('Zoé Rochat')
    expect(decodeRfc2047('plain')).toBe('plain')
  })
})

describe('corps', () => {
  it('HTML → texte : scripts retirés, blocs en lignes, entités décodées', () => {
    const t = htmlToText('<style>p{}</style><p>Bonjour&nbsp;<b>Zo&eacute;</b></p><script>x()</script><div>2<sup>e</sup> ligne &amp; fin</div>')
    expect(t).toBe('Bonjour Zoé\n2e ligne & fin')
  })
  it('texte → HTML échappe et conserve les paragraphes', () => {
    expect(textToHtml('a < b\n\nc & d')).toBe('<p>a &lt; b</p><p>c &amp; d</p>')
  })
  it('extrait borné', () => {
    expect(snippetOf('  a   b\nc  ', 3)).toBe('a b')
  })
  it('base64url aller-retour', () => {
    expect(base64UrlDecodeToString(base64UrlEncodeString('Zoé ✓'))).toBe('Zoé ✓')
  })
})

describe('buildMime', () => {
  const base = {
    from: { name: 'Gregory Lyonnet', email: 'g@agence.ch' },
    to: [{ name: 'Zoé Rochat', email: 'zoe@ex.ch' }],
    cc: [], bcc: [],
    subject: 'Visite rue du Rhône',
    text: 'Bonjour Zoé,\nà demain.',
    html: '<p>Bonjour Zoé,<br>à demain.</p>',
    inReplyTo: '<abc@ex.ch>',
    references: ['<root@ex.ch>', '<abc@ex.ch>'],
    messageId: '<m1@agence.ch>',
    attachments: [] as { filename: string; mimeType: string; base64: string }[],
  }
  it('pose les en-têtes de fil et encode les mots non ASCII', () => {
    const raw = buildMime(base)
    expect(raw).toContain('\r\nIn-Reply-To: <abc@ex.ch>\r\n')
    expect(raw).toContain('\r\nReferences: <root@ex.ch> <abc@ex.ch>\r\n')
    expect(raw).toContain('\r\nMessage-ID: <m1@agence.ch>\r\n')
    expect(raw).toContain('Subject: =?UTF-8?B?')
    expect(raw).toContain('To: =?UTF-8?B?Wm/DqSBSb2NoYXQ=?= <zoe@ex.ch>')
    expect(raw).toContain('Content-Type: multipart/alternative; boundary=')
    expect(raw).toMatch(/Content-Type: text\/plain; charset=utf-8\r\nContent-Transfer-Encoding: base64/)
  })
  it('enveloppe les pièces dans multipart/mixed', () => {
    const raw = buildMime({ ...base, attachments: [{ filename: 'plan.pdf', mimeType: 'application/pdf', base64: 'JVBERi0=' }] })
    expect(raw).toContain('Content-Type: multipart/mixed; boundary=')
    expect(raw).toContain('Content-Disposition: attachment; filename="plan.pdf"')
    expect(raw).toContain('\r\nJVBERi0=\r\n')
  })
  it('Message-ID et mot d en-tête', () => {
    expect(makeMessageId('agence.ch')).toMatch(/^<[0-9a-f-]{36}@agence\.ch>$/)
    expect(encodeHeaderWord('ascii only')).toBe('ascii only')
    expect(encodeHeaderWord('Zoé')).toBe('=?UTF-8?B?Wm/DqQ==?=')
  })
})
```

- [ ] **Step 3 : Ajouter le spec à la liste EN DUR de `vitest.config.ts`**

Dans `include: [...]`, après `'supabase/functions/_shared/emails-quatre-langues.test.ts'`, ajouter :
```ts
'supabase/functions/_shared/mail/mime.test.ts',
```

- [ ] **Step 4 : Lancer — rouge attendu**

```bash
npx vitest run supabase/functions/_shared/mail/mime.test.ts
```
Attendu : FAIL, `Cannot find module './mime.ts'`.

- [ ] **Step 5 : Écrire `mime.ts`**

```ts
// supabase/functions/_shared/mail/mime.ts
// Adresses, RFC 2047, base64url, HTML↔texte, construction d'un message RFC 5322.
// PUR (aucun import runtime) : testé sous Node, exécuté sous Deno.
import type { MailAddress, OutgoingMessage } from './types.ts'

const CRLF = '\r\n'

// ── base64 / base64url ────────────────────────────────────────────────────────
function bytesToBinary(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return s
}
function binaryToBytes(bin: string): Uint8Array {
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
export function base64Encode(bytes: Uint8Array): string {
  return btoa(bytesToBinary(bytes))
}
export function base64Decode(b64: string): Uint8Array {
  return binaryToBytes(atob(b64.replace(/\s+/g, '')))
}
export function base64UrlEncode(bytes: Uint8Array): string {
  return base64Encode(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
export function base64UrlEncodeString(s: string): string {
  return base64UrlEncode(new TextEncoder().encode(s))
}
export function base64UrlDecodeToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4))
  return base64Decode(b64 + pad)
}
export function base64UrlDecodeToString(s: string): string {
  return new TextDecoder().decode(base64UrlDecodeToBytes(s))
}
/** Plie une chaîne base64 à 76 colonnes (RFC 2045). */
export function foldBase64(b64: string): string {
  return (b64.match(/.{1,76}/g) ?? []).join(CRLF)
}

// ── RFC 2047 ──────────────────────────────────────────────────────────────────
/** Décode les mots encodés `=?charset?B|Q?…?=` d'un en-tête. */
export function decodeRfc2047(s: string): string {
  if (!s || !s.includes('=?')) return s
  return s.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=(\s*(?==\?))?/g, (_m, charset: string, enc: string, text: string) => {
    let bytes: Uint8Array
    if (enc.toUpperCase() === 'B') {
      bytes = base64Decode(text)
    } else {
      const bin = text.replace(/_/g, ' ').replace(/=([0-9A-Fa-f]{2})/g, (_x, h: string) => String.fromCharCode(parseInt(h, 16)))
      bytes = binaryToBytes(bin)
    }
    try {
      return new TextDecoder(charset.toLowerCase()).decode(bytes)
    } catch {
      return new TextDecoder('utf-8').decode(bytes)
    }
  })
}

/** Encode un mot d'en-tête si non ASCII (`=?UTF-8?B?…?=`), sinon tel quel. */
export function encodeHeaderWord(s: string): string {
  if (!/[^\x20-\x7e]/.test(s)) return s
  return `=?UTF-8?B?${base64Encode(new TextEncoder().encode(s))}?=`
}

// ── Adresses ─────────────────────────────────────────────────────────────────
export function parseAddress(raw: string): MailAddress | null {
  const s = decodeRfc2047((raw ?? '').trim())
  if (!s) return null
  const m = s.match(/^(?:"?([^"<]*)"?\s*)?<([^>]+)>$/)
  if (m) {
    const name = (m[1] ?? '').trim()
    return { name: name || null, email: m[2].trim().toLowerCase() }
  }
  const bare = s.replace(/^<|>$/g, '').trim()
  if (!bare.includes('@')) return null
  return { name: null, email: bare.toLowerCase() }
}

/** Sépare sur les virgules qui ne sont ni entre guillemets ni entre chevrons. */
export function parseAddressList(raw: string): MailAddress[] {
  const out: MailAddress[] = []
  let cur = ''
  let quoted = false
  let angle = 0
  for (const ch of raw ?? '') {
    if (ch === '"') quoted = !quoted
    else if (ch === '<' && !quoted) angle++
    else if (ch === '>' && !quoted) angle = Math.max(0, angle - 1)
    if (ch === ',' && !quoted && angle === 0) {
      const a = parseAddress(cur)
      if (a) out.push(a)
      cur = ''
    } else {
      cur += ch
    }
  }
  const last = parseAddress(cur)
  if (last) out.push(last)
  return out
}

export function formatAddress(a: MailAddress): string {
  return a.name ? `${encodeHeaderWord(a.name)} <${a.email}>` : a.email
}

// ── Corps ─────────────────────────────────────────────────────────────────────
const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  eacute: 'é', egrave: 'è', ecirc: 'ê', agrave: 'à', acirc: 'â', ccedil: 'ç',
  ocirc: 'ô', ucirc: 'û', ugrave: 'ù', icirc: 'î', iuml: 'ï', euml: 'ë', uuml: 'ü', ouml: 'ö', auml: 'ä',
}
function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_m, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d: string) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n: string) => ENTITIES[n.toLowerCase()] ?? m)
}

/** HTML → texte lisible : scripts/styles retirés, blocs en lignes, entités décodées. */
export function htmlToText(html: string): string {
  return decodeEntities(
    (html ?? '')
      .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|tr|li|h[1-6]|blockquote|pre|table)>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Texte → HTML : un `<p>` par paragraphe (ligne vide), `<br>` pour les retours simples. */
export function textToHtml(text: string): string {
  return (text ?? '')
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

export function snippetOf(text: string, max = 160): string {
  const s = (text ?? '').replace(/\s+/g, ' ').trim()
  return s.length > max ? s.slice(0, max) : s
}

export function makeMessageId(domain: string): string {
  return `<${crypto.randomUUID()}@${domain}>`
}

// ── Construction RFC 5322 ─────────────────────────────────────────────────────
function boundary(tag: string): string {
  return `=_megga_${tag}_${crypto.randomUUID().replace(/-/g, '')}`
}

/**
 * Construit le message brut (CRLF) : multipart/alternative texte+HTML, enveloppé
 * dans multipart/mixed s'il y a des pièces. Tout corps en base64 : aucune
 * ambiguïté d'encodage, aucune ligne trop longue.
 */
export function buildMime(m: OutgoingMessage): string {
  const alt = boundary('alt')
  const utf8 = (s: string) => foldBase64(base64Encode(new TextEncoder().encode(s)))
  const altPart = [
    `--${alt}`,
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    utf8(m.text),
    `--${alt}`,
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    utf8(m.html),
    `--${alt}--`,
  ].join(CRLF)

  const headers: string[] = [
    `From: ${formatAddress(m.from)}`,
    `To: ${m.to.map(formatAddress).join(', ')}`,
  ]
  if (m.cc.length) headers.push(`Cc: ${m.cc.map(formatAddress).join(', ')}`)
  if (m.bcc.length) headers.push(`Bcc: ${m.bcc.map(formatAddress).join(', ')}`)
  headers.push(`Subject: ${encodeHeaderWord(m.subject)}`)
  headers.push(`Date: ${new Date().toUTCString()}`)
  headers.push(`Message-ID: ${m.messageId}`)
  if (m.inReplyTo) headers.push(`In-Reply-To: ${m.inReplyTo}`)
  if (m.references.length) headers.push(`References: ${m.references.join(' ')}`)
  headers.push('MIME-Version: 1.0')

  if (m.attachments.length === 0) {
    headers.push(`Content-Type: multipart/alternative; boundary="${alt}"`)
    return headers.join(CRLF) + CRLF + CRLF + altPart + CRLF
  }

  const mixed = boundary('mix')
  headers.push(`Content-Type: multipart/mixed; boundary="${mixed}"`)
  const parts: string[] = [
    `--${mixed}`,
    `Content-Type: multipart/alternative; boundary="${alt}"`,
    '',
    altPart,
  ]
  for (const a of m.attachments) {
    const name = a.filename.replace(/["\r\n]/g, '')
    parts.push(
      `--${mixed}`,
      `Content-Type: ${a.mimeType}; name="${name}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${name}"`,
      '',
      foldBase64(a.base64.replace(/\s+/g, '')),
    )
  }
  parts.push(`--${mixed}--`)
  return headers.join(CRLF) + CRLF + CRLF + parts.join(CRLF) + CRLF
}
```

- [ ] **Step 6 : Vert**

```bash
npx vitest run supabase/functions/_shared/mail/mime.test.ts
```
Attendu : 10 tests PASS.

- [ ] **Step 7 : Commit**

```bash
git add supabase/functions/_shared/mail/types.ts supabase/functions/_shared/mail/mime.ts supabase/functions/_shared/mail/mime.test.ts vitest.config.ts
git commit -m "feat(messagerie): types partagés et MIME (adresses, RFC 2047, base64url, construction)"
```

---

### Task 1.4 : Secrets Vault + rafraîchissement de jeton (`_shared/mail/secrets.ts`)

**Files:**
- Create: `supabase/functions/_shared/mail/secrets.ts`
- Test: `supabase/functions/_shared/mail/secrets.test.ts`
- Modify: `vitest.config.ts`

- [ ] **Step 1 : Test (rouge)**

```ts
// supabase/functions/_shared/mail/secrets.test.ts
import { describe, it, expect, vi } from 'vitest'
import { needsRefresh, refreshOAuthToken, getValidAccessToken, MailAuthError } from './secrets.ts'
import type { MailAccountRow, OAuthSecret } from './types.ts'

const cfg = { clientId: 'cid', clientSecret: 'sec' }
const NOW = Date.parse('2026-09-03T10:00:00Z')

function account(over: Partial<MailAccountRow> = {}): MailAccountRow {
  return {
    id: 'acc-1', agency_id: 'ag', owner_id: 'u', provider: 'gmail', email: 'g@ex.ch',
    display_name: null, visibility: 'owner', status: 'active', vault_secret_id: 'vault-1',
    sync_cursor: {}, next_sync_at: '', last_sync_at: null, last_error: null, imap_config: null, ...over,
  }
}
/** Faux admin : rpc() rend le secret, update() mémorise les écritures sur mail_accounts. */
function fakeAdmin(secret: OAuthSecret | null) {
  const writes: Record<string, unknown>[] = []
  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    if (name === 'mail_secret_read') return { data: secret ? JSON.stringify(secret) : null, error: null }
    if (name === 'mail_secret_update') { writes.push({ rpc: name, ...args }); return { data: null, error: null } }
    return { data: null, error: { message: `unexpected rpc ${name}` } }
  })
  const from = vi.fn(() => ({ update: (patch: Record<string, unknown>) => ({ eq: async () => { writes.push(patch); return { error: null } } }) }))
  return { admin: { rpc, from } as never, writes, rpc }
}

describe('needsRefresh', () => {
  it('rafraîchit à moins de 5 minutes de l échéance', () => {
    expect(needsRefresh(new Date(NOW + 10 * 60_000).toISOString(), NOW)).toBe(false)
    expect(needsRefresh(new Date(NOW + 4 * 60_000).toISOString(), NOW)).toBe(true)
    expect(needsRefresh('invalid', NOW)).toBe(true)
  })
})

describe('refreshOAuthToken', () => {
  it('poste le bon corps à Google et rend le jeton', async () => {
    const fetch = vi.fn(async (_url: string, init: RequestInit) => {
      expect(String(init.body)).toContain('grant_type=refresh_token')
      expect(String(init.body)).toContain('client_id=cid')
      return new Response(JSON.stringify({ access_token: 'at2', expires_in: 3600 }), { status: 200 })
    })
    const r = await refreshOAuthToken('gmail', 'rt', cfg, { fetch: fetch as unknown as typeof globalThis.fetch })
    expect(fetch.mock.calls[0][0]).toBe('https://oauth2.googleapis.com/token')
    expect(r).toEqual({ access_token: 'at2', expires_in: 3600, refresh_token: undefined })
  })
  it('Microsoft envoie le scope et peut faire tourner le refresh token', async () => {
    const fetch = vi.fn(async (_url: string, init: RequestInit) => {
      expect(String(init.body)).toContain('scope=offline_access')
      return new Response(JSON.stringify({ access_token: 'at3', expires_in: 3599, refresh_token: 'rt-new' }), { status: 200 })
    })
    const r = await refreshOAuthToken('outlook', 'rt', cfg, { fetch: fetch as unknown as typeof globalThis.fetch })
    expect(fetch.mock.calls[0][0]).toBe('https://login.microsoftonline.com/common/oauth2/v2.0/token')
    expect(r.refresh_token).toBe('rt-new')
  })
  it('invalid_grant lève MailAuthError reauth_required', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 }))
    await expect(refreshOAuthToken('gmail', 'rt', cfg, { fetch: fetch as unknown as typeof globalThis.fetch }))
      .rejects.toMatchObject({ code: 'reauth_required' })
  })
})

describe('getValidAccessToken', () => {
  it('rend le jeton en cache s il est frais, sans réseau', async () => {
    const { admin, rpc } = fakeAdmin({ refresh_token: 'rt', access_token: 'at', expires_at: new Date(NOW + 30 * 60_000).toISOString() })
    const fetch = vi.fn()
    const t = await getValidAccessToken(admin, account(), cfg, { fetch: fetch as unknown as typeof globalThis.fetch, now: () => NOW })
    expect(t).toBe('at')
    expect(fetch).not.toHaveBeenCalled()
    expect(rpc).toHaveBeenCalledWith('mail_secret_read', { p_id: 'vault-1' })
  })
  it('rafraîchit, réécrit Vault (rotation MS comprise)', async () => {
    const { admin, writes } = fakeAdmin({ refresh_token: 'rt', access_token: 'old', expires_at: new Date(NOW - 1000).toISOString() })
    const fetch = vi.fn(async () => new Response(JSON.stringify({ access_token: 'fresh', expires_in: 3600, refresh_token: 'rt2' }), { status: 200 }))
    const t = await getValidAccessToken(admin, account({ provider: 'outlook' }), cfg, { fetch: fetch as unknown as typeof globalThis.fetch, now: () => NOW })
    expect(t).toBe('fresh')
    const upd = writes.find((w) => w.rpc === 'mail_secret_update') as { p_secret: string }
    const stored = JSON.parse(upd.p_secret) as OAuthSecret
    expect(stored.refresh_token).toBe('rt2')
    expect(stored.access_token).toBe('fresh')
    expect(Date.parse(stored.expires_at)).toBe(NOW + 3600_000)
  })
  it('un refus définitif passe le compte en reauth_required et lève', async () => {
    const { admin, writes } = fakeAdmin({ refresh_token: 'rt', access_token: 'old', expires_at: new Date(NOW - 1000).toISOString() })
    const fetch = vi.fn(async () => new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 }))
    await expect(getValidAccessToken(admin, account(), cfg, { fetch: fetch as unknown as typeof globalThis.fetch, now: () => NOW }))
      .rejects.toBeInstanceOf(MailAuthError)
    expect(writes).toContainEqual(expect.objectContaining({ status: 'reauth_required' }))
  })
  it('sans secret Vault : no_secret, jamais un appel réseau', async () => {
    const { admin } = fakeAdmin(null)
    const fetch = vi.fn()
    await expect(getValidAccessToken(admin, account(), cfg, { fetch: fetch as unknown as typeof globalThis.fetch, now: () => NOW }))
      .rejects.toMatchObject({ code: 'no_secret' })
    expect(fetch).not.toHaveBeenCalled()
  })
})
```

Ajouter `'supabase/functions/_shared/mail/secrets.test.ts',` à `vitest.config.ts` puis :
```bash
npx vitest run supabase/functions/_shared/mail/secrets.test.ts
```
Attendu : FAIL (module absent).

- [ ] **Step 2 : Implémentation**

```ts
// supabase/functions/_shared/mail/secrets.ts
// Jetons de boîte : lecture/écriture Vault par les ponts mail_secret_* (service-role
// seul) et rafraîchissement OAuth avec tampon de 5 minutes.
//
// ⚠ Microsoft peut renvoyer un NOUVEAU refresh_token à chaque rafraîchissement :
// on réécrit toujours le secret complet. Google ne le fait pas ; on garde l'ancien.
// ⚠ Un `invalid_grant` est DÉFINITIF (jeton révoqué, mot de passe changé) : le
// compte passe en `reauth_required`, visible dans l'UI — jamais un échec muet
// (leçon de host-freebusy qui éteignait sync_enabled en silence).
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { AccountSecret, MailAccountRow, OAuthSecret } from './types.ts'

export interface OAuthClientConfig {
  clientId: string
  clientSecret: string
}
export interface SecretsDeps {
  fetch?: typeof fetch
  now?: () => number
}

export class MailAuthError extends Error {
  code: 'reauth_required' | 'no_secret' | 'provider_error'
  constructor(code: MailAuthError['code'], message: string) {
    super(message)
    this.code = code
  }
}

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const MS_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
export const MS_MAIL_SCOPE = 'offline_access User.Read Mail.ReadWrite Mail.Send'
export const GOOGLE_MAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.modify openid email'
const REFRESH_BUFFER_MS = 5 * 60_000

// ── Vault ─────────────────────────────────────────────────────────────────────
export async function storeAccountSecret(admin: SupabaseClient, name: string, payload: AccountSecret): Promise<string> {
  const { data, error } = await admin.rpc('mail_secret_store', { p_secret: JSON.stringify(payload), p_name: name })
  if (error || !data) throw new Error(`vault store failed: ${error?.message ?? 'no id'}`)
  return data as string
}
export async function readAccountSecret<T extends AccountSecret>(admin: SupabaseClient, id: string): Promise<T | null> {
  const { data, error } = await admin.rpc('mail_secret_read', { p_id: id })
  if (error) throw new Error(`vault read failed: ${error.message}`)
  if (!data) return null
  return JSON.parse(data as string) as T
}
export async function updateAccountSecret(admin: SupabaseClient, id: string, payload: AccountSecret): Promise<void> {
  const { error } = await admin.rpc('mail_secret_update', { p_id: id, p_secret: JSON.stringify(payload) })
  if (error) throw new Error(`vault update failed: ${error.message}`)
}
export async function deleteAccountSecret(admin: SupabaseClient, id: string): Promise<void> {
  const { error } = await admin.rpc('mail_secret_delete', { p_id: id })
  if (error) throw new Error(`vault delete failed: ${error.message}`)
}

// ── OAuth ─────────────────────────────────────────────────────────────────────
export function needsRefresh(expiresAt: string, now = Date.now(), bufferMs = REFRESH_BUFFER_MS): boolean {
  const t = Date.parse(expiresAt)
  if (Number.isNaN(t)) return true
  return t - now < bufferMs
}

export async function refreshOAuthToken(
  provider: 'gmail' | 'outlook',
  refreshToken: string,
  cfg: OAuthClientConfig,
  deps: SecretsDeps = {},
): Promise<{ access_token: string; expires_in: number; refresh_token?: string }> {
  const f = deps.fetch ?? globalThis.fetch
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
  })
  if (provider === 'outlook') body.set('scope', MS_MAIL_SCOPE)
  const res = await f(provider === 'gmail' ? GOOGLE_TOKEN_URL : MS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; refresh_token?: string; error?: string; error_description?: string }
  if (!res.ok || !json.access_token) {
    const err = json.error ?? `http_${res.status}`
    if (err === 'invalid_grant' || res.status === 401) {
      throw new MailAuthError('reauth_required', `${provider}: ${err} ${json.error_description ?? ''}`.trim())
    }
    throw new MailAuthError('provider_error', `${provider}: ${err} ${json.error_description ?? ''}`.trim())
  }
  return { access_token: json.access_token, expires_in: json.expires_in ?? 3600, refresh_token: json.refresh_token }
}

/**
 * Rend un access token valide pour le compte, en rafraîchissant et en réécrivant
 * Vault si nécessaire. Marque le compte `reauth_required` sur refus définitif.
 */
export async function getValidAccessToken(
  admin: SupabaseClient,
  account: MailAccountRow,
  cfg: OAuthClientConfig,
  deps: SecretsDeps = {},
): Promise<string> {
  const now = deps.now ?? Date.now
  if (!account.vault_secret_id) throw new MailAuthError('no_secret', `account ${account.id} has no vault secret`)
  const secret = await readAccountSecret<OAuthSecret>(admin, account.vault_secret_id)
  if (!secret) throw new MailAuthError('no_secret', `account ${account.id}: vault secret missing`)
  if (!needsRefresh(secret.expires_at, now())) return secret.access_token

  if (account.provider !== 'gmail' && account.provider !== 'outlook') {
    throw new MailAuthError('provider_error', `account ${account.id}: ${account.provider} has no OAuth token`)
  }
  try {
    const r = await refreshOAuthToken(account.provider, secret.refresh_token, cfg, deps)
    const next: OAuthSecret = {
      refresh_token: r.refresh_token ?? secret.refresh_token,
      access_token: r.access_token,
      expires_at: new Date(now() + r.expires_in * 1000).toISOString(),
    }
    await updateAccountSecret(admin, account.vault_secret_id, next)
    return next.access_token
  } catch (e) {
    if (e instanceof MailAuthError && e.code === 'reauth_required') {
      await admin.from('mail_accounts')
        .update({ status: 'reauth_required', last_error: e.message })
        .eq('id', account.id)
    }
    throw e
  }
}
```

- [ ] **Step 3 : Vert, puis commit**

```bash
npx vitest run supabase/functions/_shared/mail/secrets.test.ts
git add supabase/functions/_shared/mail/secrets.ts supabase/functions/_shared/mail/secrets.test.ts vitest.config.ts
git commit -m "feat(messagerie): secrets Vault et rafraîchissement OAuth (tampon 5 min, rotation MS)"
```
Attendu : 8 tests PASS.

---

### Task 1.5 : OAuth (URL d'autorisation, PKCE, échange, identité) — `_shared/mail/oauth.ts`

**Files:**
- Create: `supabase/functions/_shared/mail/oauth.ts`
- Test: `supabase/functions/_shared/mail/oauth.test.ts`
- Modify: `vitest.config.ts`

- [ ] **Step 1 : Test (rouge)**

```ts
// supabase/functions/_shared/mail/oauth.test.ts
import { describe, it, expect, vi } from 'vitest'
import { randomToken, pkceChallenge, buildAuthorizeUrl, exchangeCode, fetchIdentity } from './oauth.ts'

const F = (fn: (url: string, init?: RequestInit) => Promise<Response>) => fn as unknown as typeof globalThis.fetch

describe('PKCE', () => {
  it('randomToken rend de l hex de la longueur demandée', () => {
    expect(randomToken(32)).toMatch(/^[0-9a-f]{64}$/)
    expect(randomToken(32)).not.toBe(randomToken(32))
  })
  it('challenge S256 = base64url(sha256(verifier)) — vecteur RFC 7636 annexe B', async () => {
    expect(await pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'))
      .toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')
  })
})

describe('buildAuthorizeUrl', () => {
  const common = { clientId: 'cid', redirectUri: 'https://app.megga.ch/oauth/mail/callback', state: 'st', codeChallenge: 'ch', loginHint: 'g@ex.ch' }
  it('Google : offline + consent + gmail.modify', () => {
    const u = new URL(buildAuthorizeUrl('gmail', common))
    expect(u.origin + u.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(u.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/gmail.modify openid email')
    expect(u.searchParams.get('access_type')).toBe('offline')
    expect(u.searchParams.get('prompt')).toBe('consent')
    expect(u.searchParams.get('code_challenge_method')).toBe('S256')
    expect(u.searchParams.get('login_hint')).toBe('g@ex.ch')
    expect(u.searchParams.get('state')).toBe('st')
  })
  it('Microsoft : scopes délégués mail', () => {
    const u = new URL(buildAuthorizeUrl('outlook', common))
    expect(u.origin + u.pathname).toBe('https://login.microsoftonline.com/common/oauth2/v2.0/authorize')
    expect(u.searchParams.get('scope')).toBe('offline_access User.Read Mail.ReadWrite Mail.Send')
    expect(u.searchParams.get('response_mode')).toBe('query')
  })
})

describe('exchangeCode', () => {
  it('envoie code + verifier + redirect_uri et rend les jetons', async () => {
    const fetch = vi.fn(async (_u: string, init?: RequestInit) => {
      const b = String(init?.body)
      expect(b).toContain('grant_type=authorization_code')
      expect(b).toContain('code=abc')
      expect(b).toContain('code_verifier=ver')
      expect(b).toContain('redirect_uri=https%3A%2F%2Fapp.megga.ch%2Foauth%2Fmail%2Fcallback')
      return new Response(JSON.stringify({ access_token: 'at', refresh_token: 'rt', expires_in: 3599 }), { status: 200 })
    })
    const r = await exchangeCode('gmail', { code: 'abc', codeVerifier: 'ver', clientId: 'cid', clientSecret: 's', redirectUri: 'https://app.megga.ch/oauth/mail/callback' }, { fetch: F(fetch) })
    expect(r).toEqual({ access_token: 'at', refresh_token: 'rt', expires_in: 3599 })
  })
  it('sans refresh_token (consentement réutilisé) : erreur explicite', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ access_token: 'at', expires_in: 3599 }), { status: 200 }))
    await expect(exchangeCode('gmail', { code: 'abc', codeVerifier: 'v', clientId: 'c', clientSecret: 's', redirectUri: 'r' }, { fetch: F(fetch) }))
      .rejects.toThrow(/refresh_token/)
  })
})

describe('fetchIdentity', () => {
  it('Google : userinfo → email + name', async () => {
    const fetch = vi.fn(async (u: string) => {
      expect(u).toBe('https://www.googleapis.com/oauth2/v3/userinfo')
      return new Response(JSON.stringify({ email: 'G@Ex.ch', name: 'Greg' }), { status: 200 })
    })
    expect(await fetchIdentity('gmail', 'at', { fetch: F(fetch) })).toEqual({ email: 'g@ex.ch', name: 'Greg' })
  })
  it('Microsoft : /me → mail sinon userPrincipalName', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ mail: null, userPrincipalName: 'x@Outlook.com', displayName: 'X' }), { status: 200 }))
    expect(await fetchIdentity('outlook', 'at', { fetch: F(fetch) })).toEqual({ email: 'x@outlook.com', name: 'X' })
  })
})
```

Ajouter `'supabase/functions/_shared/mail/oauth.test.ts',` à `vitest.config.ts` ; lancer → FAIL (module absent).

- [ ] **Step 2 : Implémentation**

```ts
// supabase/functions/_shared/mail/oauth.ts
// Flux code + PKCE pour Google et Microsoft (D1). Le `state` et le `code_verifier`
// sont générés ici et STOCKÉS PAR L'EDGE dans mail_oauth_states ; le navigateur ne
// voit que l'URL. PUR : `fetch` injectable, `crypto` WebCrypto (Node ≥ 20 et Deno).
import { base64UrlEncode } from './mime.ts'
import { GOOGLE_MAIL_SCOPE, MS_MAIL_SCOPE, MailAuthError } from './secrets.ts'

export type OAuthProvider = 'gmail' | 'outlook'
export interface OAuthDeps { fetch?: typeof fetch }

const PROVIDERS: Record<OAuthProvider, { authorize: string; token: string; scope: string; extra: Record<string, string> }> = {
  gmail: {
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    scope: GOOGLE_MAIL_SCOPE,
    // offline + consent : sans les deux, Google ne rend PAS de refresh_token à
    // une seconde autorisation du même compte.
    extra: { access_type: 'offline', prompt: 'consent', include_granted_scopes: 'false' },
  },
  outlook: {
    authorize: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    token: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scope: MS_MAIL_SCOPE,
    extra: { response_mode: 'query', prompt: 'select_account' },
  },
}

export function randomToken(bytes = 32): string {
  const b = new Uint8Array(bytes)
  crypto.getRandomValues(b)
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer)
  return base64UrlEncode(new Uint8Array(digest))
}

export function buildAuthorizeUrl(
  provider: OAuthProvider,
  a: { clientId: string; redirectUri: string; state: string; codeChallenge: string; loginHint?: string | null },
): string {
  const p = PROVIDERS[provider]
  const u = new URL(p.authorize)
  u.searchParams.set('client_id', a.clientId)
  u.searchParams.set('redirect_uri', a.redirectUri)
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('scope', p.scope)
  u.searchParams.set('state', a.state)
  u.searchParams.set('code_challenge', a.codeChallenge)
  u.searchParams.set('code_challenge_method', 'S256')
  if (a.loginHint) u.searchParams.set('login_hint', a.loginHint)
  for (const [k, v] of Object.entries(p.extra)) u.searchParams.set(k, v)
  return u.toString()
}

export async function exchangeCode(
  provider: OAuthProvider,
  a: { code: string; codeVerifier: string; clientId: string; clientSecret: string; redirectUri: string },
  deps: OAuthDeps = {},
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const f = deps.fetch ?? globalThis.fetch
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: a.code,
    code_verifier: a.codeVerifier,
    client_id: a.clientId,
    client_secret: a.clientSecret,
    redirect_uri: a.redirectUri,
  })
  if (provider === 'outlook') body.set('scope', PROVIDERS.outlook.scope)
  const res = await f(PROVIDERS[provider].token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string; error_description?: string }
  if (!res.ok || !json.access_token) {
    throw new MailAuthError('provider_error', `${provider} token exchange: ${json.error ?? res.status} ${json.error_description ?? ''}`.trim())
  }
  if (!json.refresh_token) {
    throw new MailAuthError('provider_error', `${provider} token exchange: no refresh_token in response (consent screen skipped?)`)
  }
  return { access_token: json.access_token, refresh_token: json.refresh_token, expires_in: json.expires_in ?? 3600 }
}

export async function fetchIdentity(provider: OAuthProvider, accessToken: string, deps: OAuthDeps = {}): Promise<{ email: string; name: string | null }> {
  const f = deps.fetch ?? globalThis.fetch
  const url = provider === 'gmail' ? 'https://www.googleapis.com/oauth2/v3/userinfo' : 'https://graph.microsoft.com/v1.0/me'
  const res = await f(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) throw new MailAuthError('provider_error', `${provider} identity: http ${res.status}`)
  const j = (await res.json()) as { email?: string; name?: string; mail?: string | null; userPrincipalName?: string; displayName?: string }
  const email = (provider === 'gmail' ? j.email : (j.mail ?? j.userPrincipalName)) ?? ''
  if (!email.includes('@')) throw new MailAuthError('provider_error', `${provider} identity: no email`)
  return { email: email.toLowerCase(), name: (provider === 'gmail' ? j.name : j.displayName) ?? null }
}

/** Google révoque ; Microsoft n'a pas d'endpoint de révocation de jeton (on efface Vault). */
export async function revokeToken(provider: OAuthProvider, token: string, deps: OAuthDeps = {}): Promise<void> {
  if (provider !== 'gmail') return
  const f = deps.fetch ?? globalThis.fetch
  await f(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: 'POST' }).catch(() => undefined)
}
```

- [ ] **Step 3 : Vert, commit**

```bash
npx vitest run supabase/functions/_shared/mail/oauth.test.ts
git add supabase/functions/_shared/mail/oauth.ts supabase/functions/_shared/mail/oauth.test.ts vitest.config.ts
git commit -m "feat(messagerie): OAuth code+PKCE (URL, échange, identité, révocation)"
```
Attendu : 8 tests PASS.

---

### Task 1.6 : Adaptateur Gmail — `_shared/mail/gmail.ts`

**Files:**
- Create: `supabase/functions/_shared/mail/gmail.ts`
- Test: `supabase/functions/_shared/mail/gmail.test.ts`
- Modify: `vitest.config.ts`

- [ ] **Step 1 : Test (rouge) avec une charge utile Gmail réaliste**

```ts
// supabase/functions/_shared/mail/gmail.test.ts
import { describe, it, expect, vi } from 'vitest'
import { normalizeGmailMessage, historyToChanges, gmailListInitial, gmailHistory, type GmailMessage, type GmailHistoryPage } from './gmail.ts'
import { base64UrlEncodeString } from './mime.ts'

const F = (fn: (url: string, init?: RequestInit) => Promise<Response>) => fn as unknown as typeof globalThis.fetch

const MSG: GmailMessage = {
  id: 'm1', threadId: 't1', labelIds: ['INBOX', 'UNREAD'], snippet: 'Bonjour &amp; bienvenue',
  internalDate: '1756857600000',
  payload: {
    mimeType: 'multipart/mixed',
    headers: [
      { name: 'From', value: '=?UTF-8?B?Wm/DqSBSb2NoYXQ=?= <zoe@ex.ch>' },
      { name: 'To', value: 'Gregory <g@agence.ch>, bob@ex.ch' },
      { name: 'Cc', value: '' },
      { name: 'Subject', value: 'Visite' },
      { name: 'Message-ID', value: '<abc@ex.ch>' },
      { name: 'In-Reply-To', value: '<root@agence.ch>' },
      { name: 'References', value: '<root@agence.ch>  <mid@ex.ch>' },
      { name: 'Reply-To', value: 'Zoé <reply@ex.ch>' },
    ],
    parts: [
      {
        mimeType: 'multipart/alternative',
        parts: [
          { mimeType: 'text/plain', body: { data: base64UrlEncodeString('Bonjour & bienvenue') } },
          { mimeType: 'text/html', body: { data: base64UrlEncodeString('<p>Bonjour &amp; bienvenue</p>') } },
        ],
      },
      { mimeType: 'application/pdf', filename: 'plan.pdf', body: { attachmentId: 'att-1', size: 1234 } },
      { mimeType: 'image/png', filename: 'logo.png', headers: [{ name: 'Content-ID', value: '<logo@cid>' }, { name: 'Content-Disposition', value: 'inline; filename="logo.png"' }], body: { attachmentId: 'att-2', size: 99 } },
    ],
  },
}

describe('normalizeGmailMessage', () => {
  it('lit en-têtes, corps, pièces, drapeaux', () => {
    const n = normalizeGmailMessage(MSG, 'g@agence.ch')
    expect(n.providerMessageId).toBe('m1')
    expect(n.providerThreadId).toBe('t1')
    expect(n.from).toEqual({ name: 'Zoé Rochat', email: 'zoe@ex.ch' })
    expect(n.to).toEqual([{ name: 'Gregory', email: 'g@agence.ch' }, { name: null, email: 'bob@ex.ch' }])
    expect(n.cc).toEqual([])
    expect(n.replyTo).toBe('reply@ex.ch')
    expect(n.subject).toBe('Visite')
    expect(n.snippet).toBe('Bonjour & bienvenue')
    expect(n.rfc822MessageId).toBe('<abc@ex.ch>')
    expect(n.inReplyTo).toBe('<root@agence.ch>')
    expect(n.references).toEqual(['<root@agence.ch>', '<mid@ex.ch>'])
    expect(n.bodyText).toBe('Bonjour & bienvenue')
    expect(n.bodyHtml).toBe('<p>Bonjour &amp; bienvenue</p>')
    expect(n.sentAt).toBe('2025-09-03T00:00:00.000Z')
    expect(n.direction).toBe('inbound')
    expect(n).toMatchObject({ isRead: false, isStarred: false, inInbox: true, isTrashed: false, isDraft: false })
    expect(n.attachments).toEqual([
      { providerAttachmentId: 'att-1', filename: 'plan.pdf', mimeType: 'application/pdf', sizeBytes: 1234, isInline: false, contentId: null },
      { providerAttachmentId: 'att-2', filename: 'logo.png', mimeType: 'image/png', sizeBytes: 99, isInline: true, contentId: '<logo@cid>' },
    ])
  })
  it('un message envoyé par la boîte est sortant, lu', () => {
    const sent: GmailMessage = { ...MSG, labelIds: ['SENT'], payload: { ...MSG.payload, headers: [...MSG.payload.headers!.filter((h) => h.name !== 'From'), { name: 'From', value: 'g@agence.ch' }] } }
    const n = normalizeGmailMessage(sent, 'g@agence.ch')
    expect(n.direction).toBe('outbound')
    expect(n.isRead).toBe(true)
    expect(n.inInbox).toBe(false)
  })
  it('corps HTML seul → texte dérivé ; sans corps → snippet', () => {
    const htmlOnly: GmailMessage = { ...MSG, payload: { mimeType: 'text/html', headers: MSG.payload.headers, body: { data: base64UrlEncodeString('<p>Seul</p>') } } }
    expect(normalizeGmailMessage(htmlOnly, 'g@agence.ch').bodyText).toBe('Seul')
  })
})

describe('historyToChanges', () => {
  it('traduit ajouts, suppressions et libellés en opérations', () => {
    const page: GmailHistoryPage = {
      historyId: '999',
      history: [
        { id: '1', messagesAdded: [{ message: { id: 'new1', threadId: 't9', labelIds: ['INBOX', 'UNREAD'] } }] },
        { id: '2', messagesDeleted: [{ message: { id: 'gone1', threadId: 't1' } }] },
        { id: '3', labelsAdded: [{ message: { id: 'm1', threadId: 't1' }, labelIds: ['STARRED'] }], labelsRemoved: [{ message: { id: 'm1', threadId: 't1' }, labelIds: ['UNREAD', 'INBOX'] }] },
        { id: '4', labelsAdded: [{ message: { id: 'm2', threadId: 't2' }, labelIds: ['TRASH'] }] },
      ],
    }
    const r = historyToChanges(page)
    expect(r.added).toEqual(['new1'])
    expect(r.changes).toEqual([
      { kind: 'message_deleted', providerMessageId: 'gone1' },
      { kind: 'flags', providerMessageId: 'm1', isStarred: true, isRead: true, inInbox: false },
      { kind: 'flags', providerMessageId: 'm2', isTrashed: true },
    ])
  })
})

describe('appels HTTP', () => {
  it('gmailListInitial borne à 90 jours hors spam/corbeille', async () => {
    const fetch = vi.fn(async (u: string) => {
      const url = new URL(u)
      expect(url.searchParams.get('q')).toBe('newer_than:90d -in:spam -in:trash -in:chats')
      expect(url.searchParams.get('maxResults')).toBe('50')
      return new Response(JSON.stringify({ messages: [{ id: 'a' }, { id: 'b' }], nextPageToken: 'p2' }), { status: 200 })
    })
    expect(await gmailListInitial('tok', null, { fetch: F(fetch) })).toEqual({ ids: ['a', 'b'], nextPageToken: 'p2' })
  })
  it('gmailHistory : 404 = historique expiré (resynchro complète)', async () => {
    const fetch = vi.fn(async () => new Response('{}', { status: 404 }))
    expect(await gmailHistory('tok', '1', null, { fetch: F(fetch) })).toEqual({ expired: true, page: null })
  })
})
```

Ajouter `'supabase/functions/_shared/mail/gmail.test.ts',` à `vitest.config.ts` ; lancer → FAIL.

- [ ] **Step 2 : Implémentation**

```ts
// supabase/functions/_shared/mail/gmail.ts
// Adaptateur Gmail API v1 (https://gmail.googleapis.com/gmail/v1/users/me).
// Première passe : messages.list `newer_than:90d` par pages de 50 ; ensuite
// history.list depuis le dernier historyId. Un 404 sur history = historique
// expiré côté Google : on repart en passe initiale (jamais une boucle d'erreur).
// PUR : `fetch` injectable ; aucune écriture en base ici (c'est ingest.ts).
import type { NormalizedAttachment, NormalizedMessage, RemoteChange } from './types.ts'
import { base64UrlDecodeToString, decodeRfc2047, htmlToText, parseAddress, parseAddressList, snippetOf } from './mime.ts'
import { MailAuthError } from './secrets.ts'

const BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'
export const GMAIL_INITIAL_QUERY = 'newer_than:90d -in:spam -in:trash -in:chats'
export const GMAIL_PAGE_SIZE = 50

export interface GmailDeps { fetch?: typeof fetch }

export interface GmailHeader { name: string; value: string }
export interface GmailPart {
  mimeType?: string
  filename?: string
  headers?: GmailHeader[]
  body?: { data?: string; attachmentId?: string; size?: number }
  parts?: GmailPart[]
}
export interface GmailMessage {
  id: string
  threadId: string
  labelIds?: string[]
  snippet?: string
  internalDate?: string
  payload: GmailPart
}
export interface GmailHistoryRecord {
  id: string
  messagesAdded?: { message: { id: string; threadId: string; labelIds?: string[] } }[]
  messagesDeleted?: { message: { id: string; threadId: string } }[]
  labelsAdded?: { message: { id: string; threadId: string }; labelIds: string[] }[]
  labelsRemoved?: { message: { id: string; threadId: string }; labelIds: string[] }[]
}
export interface GmailHistoryPage {
  historyId?: string
  history?: GmailHistoryRecord[]
  nextPageToken?: string
}

export class GmailApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

async function gcall<T>(token: string, path: string, deps: GmailDeps, init: RequestInit = {}): Promise<T> {
  const f = deps.fetch ?? globalThis.fetch
  const res = await f(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
  if (res.status === 401) throw new MailAuthError('reauth_required', 'gmail: 401')
  if (!res.ok) throw new GmailApiError(res.status, `gmail ${path}: http ${res.status} ${(await res.text()).slice(0, 200)}`)
  return (await res.json()) as T
}

export async function gmailIdentity(token: string, deps: GmailDeps = {}): Promise<{ email: string; historyId: string }> {
  const j = await gcall<{ emailAddress: string; historyId: string }>(token, '/profile', deps)
  return { email: j.emailAddress.toLowerCase(), historyId: String(j.historyId) }
}

export async function gmailListInitial(token: string, pageToken: string | null, deps: GmailDeps = {}): Promise<{ ids: string[]; nextPageToken: string | null }> {
  const q = new URLSearchParams({ q: GMAIL_INITIAL_QUERY, maxResults: String(GMAIL_PAGE_SIZE) })
  if (pageToken) q.set('pageToken', pageToken)
  const j = await gcall<{ messages?: { id: string }[]; nextPageToken?: string }>(token, `/messages?${q}`, deps)
  return { ids: (j.messages ?? []).map((m) => m.id), nextPageToken: j.nextPageToken ?? null }
}

export async function gmailHistory(
  token: string, startHistoryId: string, pageToken: string | null, deps: GmailDeps = {},
): Promise<{ expired: boolean; page: GmailHistoryPage | null }> {
  const q = new URLSearchParams({ startHistoryId, maxResults: '100' })
  for (const t of ['messageAdded', 'messageDeleted', 'labelAdded', 'labelRemoved']) q.append('historyTypes', t)
  if (pageToken) q.set('pageToken', pageToken)
  try {
    const page = await gcall<GmailHistoryPage>(token, `/history?${q}`, deps)
    return { expired: false, page }
  } catch (e) {
    if (e instanceof GmailApiError && e.status === 404) return { expired: true, page: null }
    throw e
  }
}

export async function gmailGetMessage(token: string, id: string, deps: GmailDeps = {}): Promise<GmailMessage> {
  return gcall<GmailMessage>(token, `/messages/${encodeURIComponent(id)}?format=full`, deps)
}

export async function gmailModify(
  token: string, id: string, add: string[], remove: string[], deps: GmailDeps = {}, scope: 'message' | 'thread' = 'message',
): Promise<void> {
  const path = scope === 'thread' ? `/threads/${encodeURIComponent(id)}/modify` : `/messages/${encodeURIComponent(id)}/modify`
  await gcall(token, path, deps, { method: 'POST', body: JSON.stringify({ addLabelIds: add, removeLabelIds: remove }) })
}

export async function gmailSend(token: string, rawBase64Url: string, threadId: string | null, deps: GmailDeps = {}): Promise<{ id: string; threadId: string }> {
  const body: Record<string, string> = { raw: rawBase64Url }
  if (threadId) body.threadId = threadId
  return gcall<{ id: string; threadId: string }>(token, '/messages/send', deps, { method: 'POST', body: JSON.stringify(body) })
}

export async function gmailAttachment(token: string, messageId: string, attachmentId: string, deps: GmailDeps = {}): Promise<Uint8Array> {
  const j = await gcall<{ data: string }>(token, `/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`, deps)
  const b64 = j.data.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

// ── Normalisation (pure) ──────────────────────────────────────────────────────
function header(headers: GmailHeader[] | undefined, name: string): string {
  const h = (headers ?? []).find((x) => x.name.toLowerCase() === name.toLowerCase())
  return h ? decodeRfc2047(h.value) : ''
}

function walk(part: GmailPart, acc: { text: string | null; html: string | null; atts: NormalizedAttachment[] }): void {
  const mime = (part.mimeType ?? '').toLowerCase()
  if (part.parts?.length) {
    for (const p of part.parts) walk(p, acc)
    return
  }
  if (part.filename && part.body?.attachmentId) {
    const disp = header(part.headers, 'Content-Disposition').toLowerCase()
    const cid = header(part.headers, 'Content-ID') || null
    acc.atts.push({
      providerAttachmentId: part.body.attachmentId,
      filename: part.filename,
      mimeType: mime || 'application/octet-stream',
      sizeBytes: part.body.size ?? 0,
      isInline: disp.startsWith('inline') || !!cid,
      contentId: cid,
    })
    return
  }
  if (!part.body?.data) return
  if (mime === 'text/plain' && acc.text === null) acc.text = base64UrlDecodeToString(part.body.data)
  else if (mime === 'text/html' && acc.html === null) acc.html = base64UrlDecodeToString(part.body.data)
}

export function normalizeGmailMessage(m: GmailMessage, boxEmail: string): NormalizedMessage {
  const h = m.payload.headers
  const labels = m.labelIds ?? []
  const acc = { text: null as string | null, html: null as string | null, atts: [] as NormalizedAttachment[] }
  walk(m.payload, acc)
  const from = parseAddress(header(h, 'From')) ?? { name: null, email: '' }
  const outbound = labels.includes('SENT') || from.email === boxEmail.toLowerCase()
  const bodyText = acc.text ?? (acc.html ? htmlToText(acc.html) : null)
  const snippet = snippetOf(htmlToText(m.snippet ?? '') || bodyText || '')
  const replyTo = parseAddress(header(h, 'Reply-To'))
  return {
    providerMessageId: m.id,
    providerThreadId: m.threadId,
    rfc822MessageId: header(h, 'Message-ID') || null,
    inReplyTo: header(h, 'In-Reply-To') || null,
    references: header(h, 'References').split(/\s+/).filter(Boolean),
    direction: outbound ? 'outbound' : 'inbound',
    from,
    to: parseAddressList(header(h, 'To')),
    cc: parseAddressList(header(h, 'Cc')),
    bcc: parseAddressList(header(h, 'Bcc')),
    replyTo: replyTo?.email ?? null,
    subject: header(h, 'Subject'),
    snippet,
    bodyText,
    bodyHtml: acc.html,
    sentAt: new Date(Number(m.internalDate ?? Date.now())).toISOString(),
    isRead: !labels.includes('UNREAD'),
    isStarred: labels.includes('STARRED'),
    inInbox: labels.includes('INBOX'),
    isTrashed: labels.includes('TRASH'),
    isDraft: labels.includes('DRAFT'),
    providerLabels: labels,
    attachments: acc.atts,
  }
}

/** history.list → ids à charger + opérations d'état. Les libellés Gmail deviennent des drapeaux. */
export function historyToChanges(page: GmailHistoryPage): { added: string[]; changes: RemoteChange[] } {
  const added: string[] = []
  const flagsById = new Map<string, Extract<RemoteChange, { kind: 'flags' }>>()
  const order: RemoteChange[] = []
  const flags = (id: string) => {
    let f = flagsById.get(id)
    if (!f) { f = { kind: 'flags', providerMessageId: id }; flagsById.set(id, f); order.push(f) }
    return f
  }
  const apply = (id: string, labelIds: string[], on: boolean) => {
    for (const l of labelIds) {
      if (l === 'UNREAD') flags(id).isRead = !on
      else if (l === 'STARRED') flags(id).isStarred = on
      else if (l === 'INBOX') flags(id).inInbox = on
      else if (l === 'TRASH') flags(id).isTrashed = on
    }
  }
  for (const rec of page.history ?? []) {
    for (const a of rec.messagesAdded ?? []) if (!added.includes(a.message.id)) added.push(a.message.id)
    for (const d of rec.messagesDeleted ?? []) order.push({ kind: 'message_deleted', providerMessageId: d.message.id })
    for (const l of rec.labelsAdded ?? []) apply(l.message.id, l.labelIds, true)
    for (const l of rec.labelsRemoved ?? []) apply(l.message.id, l.labelIds, false)
  }
  // Un message ajouté puis supprimé dans la même fenêtre n'a pas à être chargé.
  const deleted = new Set(order.filter((c) => c.kind === 'message_deleted').map((c) => c.providerMessageId))
  return { added: added.filter((id) => !deleted.has(id)), changes: order.filter((c) => c.kind !== 'flags' || Object.keys(c).length > 2) }
}
```

- [ ] **Step 3 : Vert, commit**

```bash
npx vitest run supabase/functions/_shared/mail/gmail.test.ts
git add supabase/functions/_shared/mail/gmail.ts supabase/functions/_shared/mail/gmail.test.ts vitest.config.ts
git commit -m "feat(messagerie): adaptateur Gmail (liste 90 j, history, normalisation, modify, send, pièces)"
```
Attendu : 6 tests PASS.

---

### Task 1.7 : Adaptateur Microsoft Graph — `_shared/mail/graph.ts`

**Files:**
- Create: `supabase/functions/_shared/mail/graph.ts`
- Test: `supabase/functions/_shared/mail/graph.test.ts`
- Modify: `vitest.config.ts`

Faits Graph qui décident du code (vérifiés dans la référence v1.0) :
- `…/mailFolders/{inbox|sentitems}/messages/delta` accepte `$select` et un `$filter=receivedDateTime ge <ISO>` **au premier appel seulement** ; ensuite on suit `@odata.nextLink` puis on garde `@odata.deltaLink`. Un élément supprimé arrive comme `{ id, "@removed": { reason } }`.
- `parentFolderId` est un id **opaque** : pour savoir si un message est dans la réception on résout une fois `GET /me/mailFolders/inbox?$select=id` (et `sentitems`, `archive`, `deleteditems`) → `cursor.folderIds`.
- **Déplacer un message change son id** (`POST /me/messages/{id}/move` rend un nouvel objet). L'action met à jour `provider_message_id`.
- Le corps HTML et les en-têtes (`In-Reply-To`, `References`) demandent un second appel `GET /me/messages/{id}?$select=body,internetMessageHeaders`.
- `internetMessageId` est **modifiable sur un brouillon** : on le pose à la création pour rapprocher le message envoyé quand `sentitems` le rend (`pending:` → id réel).

- [ ] **Step 1 : Test (rouge)**

```ts
// supabase/functions/_shared/mail/graph.test.ts
import { describe, it, expect, vi } from 'vitest'
import { normalizeGraphMessage, deltaToChanges, graphDelta, type GraphMessage } from './graph.ts'

const F = (fn: (url: string, init?: RequestInit) => Promise<Response>) => fn as unknown as typeof globalThis.fetch
const FOLDERS = { inbox: 'F-IN', sentitems: 'F-SENT', archive: 'F-ARC', deleteditems: 'F-DEL' }

const M: GraphMessage = {
  id: 'AAMk1', conversationId: 'CONV1', internetMessageId: '<abc@ex.ch>', subject: 'Visite',
  bodyPreview: 'Bonjour & bienvenue', receivedDateTime: '2026-09-03T08:00:00Z', sentDateTime: '2026-09-03T07:59:00Z',
  isRead: false, isDraft: false, hasAttachments: true, parentFolderId: 'F-IN',
  flag: { flagStatus: 'flagged' },
  from: { emailAddress: { name: 'Zoé Rochat', address: 'Zoe@Ex.ch' } },
  toRecipients: [{ emailAddress: { name: 'Gregory', address: 'g@agence.ch' } }],
  ccRecipients: [], bccRecipients: [],
  replyTo: [{ emailAddress: { name: null, address: 'reply@ex.ch' } }],
}
const BODY = { body: { contentType: 'html', content: '<p>Bonjour &amp; bienvenue</p>' }, internetMessageHeaders: [{ name: 'In-Reply-To', value: '<root@agence.ch>' }, { name: 'References', value: '<root@agence.ch> <mid@ex.ch>' }] }
const ATTS = [{ id: 'A1', name: 'plan.pdf', contentType: 'application/pdf', size: 1234, isInline: false, contentId: null, '@odata.type': '#microsoft.graph.fileAttachment' }]

describe('normalizeGraphMessage', () => {
  it('lit métadonnées, corps, en-têtes de fil et pièces', () => {
    const n = normalizeGraphMessage(M, BODY, ATTS, FOLDERS, 'g@agence.ch')
    expect(n.providerMessageId).toBe('AAMk1')
    expect(n.providerThreadId).toBe('CONV1')
    expect(n.from).toEqual({ name: 'Zoé Rochat', email: 'zoe@ex.ch' })
    expect(n.replyTo).toBe('reply@ex.ch')
    expect(n.inReplyTo).toBe('<root@agence.ch>')
    expect(n.references).toEqual(['<root@agence.ch>', '<mid@ex.ch>'])
    expect(n.bodyHtml).toBe('<p>Bonjour &amp; bienvenue</p>')
    expect(n.bodyText).toBe('Bonjour & bienvenue')
    expect(n.sentAt).toBe('2026-09-03T08:00:00.000Z')
    expect(n).toMatchObject({ direction: 'inbound', isRead: false, isStarred: true, inInbox: true, isTrashed: false, isDraft: false })
    expect(n.attachments).toEqual([{ providerAttachmentId: 'A1', filename: 'plan.pdf', mimeType: 'application/pdf', sizeBytes: 1234, isInline: false, contentId: null }])
  })
  it('un message du dossier Envoyés est sortant ; corbeille = trashed ; archive = hors réception', () => {
    const sent = normalizeGraphMessage({ ...M, parentFolderId: 'F-SENT', from: { emailAddress: { name: 'G', address: 'g@agence.ch' } } }, BODY, [], FOLDERS, 'g@agence.ch')
    expect(sent.direction).toBe('outbound')
    expect(sent.inInbox).toBe(false)
    expect(normalizeGraphMessage({ ...M, parentFolderId: 'F-DEL' }, BODY, [], FOLDERS, 'g@agence.ch').isTrashed).toBe(true)
    expect(normalizeGraphMessage({ ...M, parentFolderId: 'F-ARC' }, BODY, [], FOLDERS, 'g@agence.ch').inInbox).toBe(false)
  })
})

describe('deltaToChanges', () => {
  it('sépare nouveaux, supprimés et drapeaux', () => {
    const r = deltaToChanges([
      { ...M, id: 'N1' },
      { id: 'GONE', '@removed': { reason: 'deleted' } },
      { ...M, id: 'K1', isRead: true, flag: { flagStatus: 'notFlagged' }, parentFolderId: 'F-ARC' },
    ], new Set(['K1']), FOLDERS)
    expect(r.added.map((m) => m.id)).toEqual(['N1'])
    expect(r.changes).toEqual([
      { kind: 'message_deleted', providerMessageId: 'GONE' },
      { kind: 'flags', providerMessageId: 'K1', isRead: true, isStarred: false, inInbox: false, isTrashed: false },
    ])
  })
})

describe('graphDelta', () => {
  it('premier appel : filtre 90 j et taille de page ; suit nextLink ; rend deltaLink', async () => {
    const calls: string[] = []
    const fetch = vi.fn(async (u: string, init?: RequestInit) => {
      calls.push(u)
      expect((init?.headers as Record<string, string>)['Prefer']).toBe('odata.maxpagesize=50')
      if (calls.length === 1) return new Response(JSON.stringify({ value: [{ id: 'a' }], '@odata.nextLink': 'https://graph.microsoft.com/v1.0/next' }), { status: 200 })
      return new Response(JSON.stringify({ value: [{ id: 'b' }], '@odata.deltaLink': 'https://graph.microsoft.com/v1.0/delta?token=Z' }), { status: 200 })
    })
    const r = await graphDelta('tok', 'inbox', null, '2026-06-05T00:00:00.000Z', { fetch: F(fetch) })
    expect(calls[0]).toContain('/me/mailFolders/inbox/messages/delta?')
    expect(decodeURIComponent(calls[0])).toContain('$filter=receivedDateTime ge 2026-06-05T00:00:00.000Z')
    expect(r.items.map((i) => i.id)).toEqual(['a', 'b'])
    expect(r.deltaLink).toBe('https://graph.microsoft.com/v1.0/delta?token=Z')
  })
})
```

Ajouter `'supabase/functions/_shared/mail/graph.test.ts',` à `vitest.config.ts` ; lancer → FAIL.

- [ ] **Step 2 : Implémentation**

```ts
// supabase/functions/_shared/mail/graph.ts
// Adaptateur Microsoft Graph v1.0 (délégué, jeton utilisateur). Voir l'en-tête de
// la tâche 1.7 du plan pour les cinq faits Graph qui décident de ce code.
import type { NormalizedAttachment, NormalizedMessage, RemoteChange } from './types.ts'
import { htmlToText, snippetOf } from './mime.ts'
import { MailAuthError } from './secrets.ts'

const BASE = 'https://graph.microsoft.com/v1.0'
export const GRAPH_PAGE_SIZE = 50
const DELTA_SELECT = 'id,conversationId,internetMessageId,subject,bodyPreview,from,toRecipients,ccRecipients,bccRecipients,replyTo,receivedDateTime,sentDateTime,isRead,isDraft,hasAttachments,flag,parentFolderId'
export const GRAPH_FOLDERS = ['inbox', 'sentitems', 'archive', 'deleteditems'] as const
export type GraphFolder = 'inbox' | 'sentitems'

export interface GraphDeps { fetch?: typeof fetch }
export interface GraphRecipient { emailAddress: { name: string | null; address: string } }
export interface GraphMessage {
  id: string
  conversationId?: string
  internetMessageId?: string
  subject?: string | null
  bodyPreview?: string
  receivedDateTime?: string
  sentDateTime?: string
  isRead?: boolean
  isDraft?: boolean
  hasAttachments?: boolean
  parentFolderId?: string
  flag?: { flagStatus?: 'notFlagged' | 'flagged' | 'complete' }
  from?: GraphRecipient
  toRecipients?: GraphRecipient[]
  ccRecipients?: GraphRecipient[]
  bccRecipients?: GraphRecipient[]
  replyTo?: GraphRecipient[]
  '@removed'?: { reason: string }
}
export interface GraphBody {
  body?: { contentType: string; content: string }
  internetMessageHeaders?: { name: string; value: string }[]
}
export interface GraphAttachment {
  id: string
  name: string
  contentType: string | null
  size: number
  isInline: boolean
  contentId?: string | null
  '@odata.type': string
}

export class GraphApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

async function gcall<T>(token: string, url: string, deps: GraphDeps, init: RequestInit = {}): Promise<T> {
  const f = deps.fetch ?? globalThis.fetch
  const res = await f(url.startsWith('https://') ? url : `${BASE}${url}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
  if (res.status === 401) throw new MailAuthError('reauth_required', 'graph: 401')
  if (res.status === 202 || res.status === 204) return undefined as T
  if (!res.ok) throw new GraphApiError(res.status, `graph ${url.slice(0, 80)}: http ${res.status} ${(await res.text()).slice(0, 200)}`)
  return (await res.json()) as T
}

export async function graphFolderIds(token: string, deps: GraphDeps = {}): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const f of GRAPH_FOLDERS) {
    const j = await gcall<{ id: string }>(token, `/me/mailFolders/${f}?$select=id`, deps)
    out[f] = j.id
  }
  return out
}

/** Une passe de delta : suit les nextLink jusqu'au deltaLink (ou jusqu'à `maxPages`). */
export async function graphDelta(
  token: string, folder: GraphFolder, deltaLink: string | null, sinceIso: string, deps: GraphDeps = {}, maxPages = 4,
): Promise<{ items: GraphMessage[]; deltaLink: string | null; nextLink: string | null }> {
  let url = deltaLink ?? `/me/mailFolders/${folder}/messages/delta?$select=${DELTA_SELECT}&$filter=${encodeURIComponent(`receivedDateTime ge ${sinceIso}`)}`
  const items: GraphMessage[] = []
  let pages = 0
  while (url && pages < maxPages) {
    const j = await gcall<{ value: GraphMessage[]; '@odata.nextLink'?: string; '@odata.deltaLink'?: string }>(
      token, url, deps, { headers: { Prefer: `odata.maxpagesize=${GRAPH_PAGE_SIZE}` } },
    )
    items.push(...(j.value ?? []))
    pages++
    if (j['@odata.deltaLink']) return { items, deltaLink: j['@odata.deltaLink'], nextLink: null }
    url = j['@odata.nextLink'] ?? ''
  }
  // Budget de pages épuisé : on garde le nextLink comme curseur provisoire.
  return { items, deltaLink: null, nextLink: url || null }
}

export async function graphGetBody(token: string, id: string, deps: GraphDeps = {}): Promise<GraphBody> {
  return gcall<GraphBody>(token, `/me/messages/${encodeURIComponent(id)}?$select=body,internetMessageHeaders`, deps)
}

export async function graphListAttachments(token: string, id: string, deps: GraphDeps = {}): Promise<GraphAttachment[]> {
  const j = await gcall<{ value: GraphAttachment[] }>(token, `/me/messages/${encodeURIComponent(id)}/attachments?$select=id,name,contentType,size,isInline,contentId`, deps)
  return (j.value ?? []).filter((a) => a['@odata.type'] === '#microsoft.graph.fileAttachment')
}

export async function graphAttachmentBytes(token: string, messageId: string, attachmentId: string, deps: GraphDeps = {}): Promise<Uint8Array> {
  const f = deps.fetch ?? globalThis.fetch
  const res = await f(`${BASE}/me/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}/$value`, { headers: { Authorization: `Bearer ${token}` } })
  if (res.status === 401) throw new MailAuthError('reauth_required', 'graph: 401')
  if (!res.ok) throw new GraphApiError(res.status, `graph attachment: http ${res.status}`)
  return new Uint8Array(await res.arrayBuffer())
}

export async function graphPatch(token: string, id: string, patch: { isRead?: boolean; flagged?: boolean }, deps: GraphDeps = {}): Promise<void> {
  const body: Record<string, unknown> = {}
  if (patch.isRead !== undefined) body.isRead = patch.isRead
  if (patch.flagged !== undefined) body.flag = { flagStatus: patch.flagged ? 'flagged' : 'notFlagged' }
  await gcall(token, `/me/messages/${encodeURIComponent(id)}`, deps, { method: 'PATCH', body: JSON.stringify(body) })
}

/** Déplace et rend le NOUVEL id. */
export async function graphMove(token: string, id: string, destination: 'inbox' | 'archive' | 'deleteditems', deps: GraphDeps = {}): Promise<string> {
  const j = await gcall<{ id: string }>(token, `/me/messages/${encodeURIComponent(id)}/move`, deps, { method: 'POST', body: JSON.stringify({ destinationId: destination }) })
  return j.id
}

export interface GraphOutgoing {
  subject: string
  html: string
  to: { name: string | null; email: string }[]
  cc: { name: string | null; email: string }[]
  bcc: { name: string | null; email: string }[]
  internetMessageId: string
  attachments: { filename: string; mimeType: string; base64: string }[]
}
const rcpt = (a: { name: string | null; email: string }) => ({ emailAddress: { address: a.email, name: a.name ?? undefined } })

/**
 * Envoi : brouillon (POST /me/messages ou createReply/createForward) → PATCH du
 * contenu → POST send. Le brouillon porte notre internetMessageId, ce qui permet
 * de rapprocher la copie « Envoyés » quand le delta la rend.
 */
export async function graphSend(
  token: string, m: GraphOutgoing, mode: { kind: 'new' } | { kind: 'reply' | 'forward'; providerMessageId: string }, deps: GraphDeps = {},
): Promise<{ draftId: string }> {
  const payload = {
    subject: m.subject,
    body: { contentType: 'HTML', content: m.html },
    toRecipients: m.to.map(rcpt),
    ccRecipients: m.cc.map(rcpt),
    bccRecipients: m.bcc.map(rcpt),
    internetMessageId: m.internetMessageId,
    attachments: m.attachments.map((a) => ({ '@odata.type': '#microsoft.graph.fileAttachment', name: a.filename, contentType: a.mimeType, contentBytes: a.base64 })),
  }
  let draftId: string
  if (mode.kind === 'new') {
    const d = await gcall<{ id: string }>(token, '/me/messages', deps, { method: 'POST', body: JSON.stringify(payload) })
    draftId = d.id
  } else {
    const verb = mode.kind === 'reply' ? 'createReply' : 'createForward'
    const d = await gcall<{ id: string }>(token, `/me/messages/${encodeURIComponent(mode.providerMessageId)}/${verb}`, deps, { method: 'POST', body: '{}' })
    draftId = d.id
    await gcall(token, `/me/messages/${encodeURIComponent(draftId)}`, deps, { method: 'PATCH', body: JSON.stringify(payload) })
  }
  await gcall(token, `/me/messages/${encodeURIComponent(draftId)}/send`, deps, { method: 'POST' })
  return { draftId }
}

// ── Normalisation (pure) ──────────────────────────────────────────────────────
const addr = (r?: GraphRecipient) => (r?.emailAddress?.address ? { name: r.emailAddress.name || null, email: r.emailAddress.address.toLowerCase() } : null)
const addrs = (rs?: GraphRecipient[]) => (rs ?? []).map(addr).filter((a): a is { name: string | null; email: string } => !!a)

export function normalizeGraphMessage(
  m: GraphMessage, body: GraphBody, atts: GraphAttachment[], folderIds: Record<string, string>, boxEmail: string,
): NormalizedMessage {
  const from = addr(m.from) ?? { name: null, email: '' }
  const inSent = m.parentFolderId === folderIds.sentitems
  const outbound = inSent || from.email === boxEmail.toLowerCase()
  const html = body.body?.contentType?.toLowerCase() === 'html' ? body.body.content : null
  const text = html ? htmlToText(html) : (body.body?.content ?? null)
  const hdr = (n: string) => (body.internetMessageHeaders ?? []).find((h) => h.name.toLowerCase() === n.toLowerCase())?.value ?? ''
  const attachments: NormalizedAttachment[] = atts.map((a) => ({
    providerAttachmentId: a.id, filename: a.name, mimeType: a.contentType ?? 'application/octet-stream',
    sizeBytes: a.size ?? 0, isInline: !!a.isInline, contentId: a.contentId ?? null,
  }))
  return {
    providerMessageId: m.id,
    providerThreadId: m.conversationId ?? m.id,
    rfc822MessageId: m.internetMessageId ?? null,
    inReplyTo: hdr('In-Reply-To') || null,
    references: hdr('References').split(/\s+/).filter(Boolean),
    direction: outbound ? 'outbound' : 'inbound',
    from,
    to: addrs(m.toRecipients),
    cc: addrs(m.ccRecipients),
    bcc: addrs(m.bccRecipients),
    replyTo: addr(m.replyTo?.[0])?.email ?? null,
    subject: m.subject ?? '',
    snippet: snippetOf(m.bodyPreview ?? text ?? ''),
    bodyText: text,
    bodyHtml: html,
    sentAt: new Date(m.receivedDateTime ?? m.sentDateTime ?? Date.now()).toISOString(),
    isRead: !!m.isRead,
    isStarred: m.flag?.flagStatus === 'flagged',
    inInbox: m.parentFolderId === folderIds.inbox,
    isTrashed: m.parentFolderId === folderIds.deleteditems,
    isDraft: !!m.isDraft,
    providerLabels: m.parentFolderId ? [m.parentFolderId] : [],
    attachments,
  }
}

/** Items du delta → nouveaux à charger (inconnus) / drapeaux (connus) / supprimés. */
export function deltaToChanges(items: GraphMessage[], known: Set<string>, folderIds: Record<string, string>): { added: GraphMessage[]; changes: RemoteChange[] } {
  const added: GraphMessage[] = []
  const changes: RemoteChange[] = []
  for (const it of items) {
    if (it['@removed']) { changes.push({ kind: 'message_deleted', providerMessageId: it.id }); continue }
    if (!known.has(it.id)) { added.push(it); continue }
    changes.push({
      kind: 'flags', providerMessageId: it.id,
      isRead: !!it.isRead, isStarred: it.flag?.flagStatus === 'flagged',
      inInbox: it.parentFolderId === folderIds.inbox, isTrashed: it.parentFolderId === folderIds.deleteditems,
    })
  }
  return { added, changes }
}
```

- [ ] **Step 3 : Vert, commit**

```bash
npx vitest run supabase/functions/_shared/mail/graph.test.ts
git add supabase/functions/_shared/mail/graph.ts supabase/functions/_shared/mail/graph.test.ts vitest.config.ts
git commit -m "feat(messagerie): adaptateur Microsoft Graph (delta, corps, pièces, patch/move, envoi)"
```
Attendu : 5 tests PASS.

---

### Task 1.8 : Ingestion — `_shared/mail/ingest.ts`

**Files:**
- Create: `supabase/functions/_shared/mail/ingest.ts`
- Test: `supabase/functions/_shared/mail/ingest.test.ts`
- Modify: `vitest.config.ts`

- [ ] **Step 1 : Test des parties pures (rouge)**

```ts
// supabase/functions/_shared/mail/ingest.test.ts
import { describe, it, expect } from 'vitest'
import { deriveThreadPatch, externalParticipants, pickContact, capHtml, type ThreadRow } from './ingest.ts'
import type { NormalizedMessage } from './types.ts'

const BOX = 'g@agence.ch'
const msg = (over: Partial<NormalizedMessage> = {}): NormalizedMessage => ({
  providerMessageId: 'm1', providerThreadId: 't1', rfc822MessageId: '<m1@ex>', inReplyTo: null, references: [],
  direction: 'inbound', from: { name: 'Zoé', email: 'zoe@ex.ch' }, to: [{ name: null, email: BOX }], cc: [], bcc: [],
  replyTo: null, subject: 'Visite', snippet: 'Bonjour', bodyText: 'Bonjour', bodyHtml: null,
  sentAt: '2026-09-03T08:00:00.000Z', isRead: false, isStarred: false, inInbox: true, isTrashed: false, isDraft: false,
  providerLabels: [], attachments: [], ...over,
})

describe('externalParticipants', () => {
  it('exclut la boîte, dédoublonne, garde l ordre', () => {
    const m = msg({ to: [{ name: 'G', email: BOX }, { name: 'Bob', email: 'bob@ex.ch' }], cc: [{ name: null, email: 'ZOE@ex.ch' }] })
    expect(externalParticipants(m, BOX)).toEqual([{ name: 'Zoé', email: 'zoe@ex.ch' }, { name: 'Bob', email: 'bob@ex.ch' }])
  })
})

describe('deriveThreadPatch', () => {
  it('nouveau fil entrant : non lu, en réception, expéditeur = premier externe', () => {
    const p = deriveThreadPatch(null, msg(), BOX, true)
    expect(p).toMatchObject({
      subject: 'Visite', snippet: 'Bonjour', from_name: 'Zoé', from_email: 'zoe@ex.ch',
      last_message_at: '2026-09-03T08:00:00.000Z', last_inbound_at: '2026-09-03T08:00:00.000Z', last_outbound_at: null,
      message_count: 1, has_attachments: false, is_read: false, is_starred: false, is_archived: false, is_trashed: false,
    })
    expect(p.participants).toEqual([{ name: 'Zoé', email: 'zoe@ex.ch' }])
  })
  it('réponse sortante plus récente : le fil devient lu-inchangé, last_outbound posé, extrait mis à jour', () => {
    const existing: ThreadRow = {
      id: 'T', account_id: 'A', subject: 'Visite', snippet: 'Bonjour', participants: [{ name: 'Zoé', email: 'zoe@ex.ch' }],
      from_name: 'Zoé', from_email: 'zoe@ex.ch', last_message_at: '2026-09-03T08:00:00.000Z', last_inbound_at: '2026-09-03T08:00:00.000Z',
      last_outbound_at: null, message_count: 1, has_attachments: false, is_read: true, is_starred: false, is_archived: false, is_trashed: false,
      label_id: null, contact_id: null,
    }
    const out = msg({ providerMessageId: 'm2', direction: 'outbound', from: { name: 'G', email: BOX }, to: [{ name: 'Zoé', email: 'zoe@ex.ch' }], snippet: 'À demain', sentAt: '2026-09-03T09:00:00.000Z', isRead: true, inInbox: false })
    const p = deriveThreadPatch(existing, out, BOX, true)
    expect(p).toMatchObject({ snippet: 'À demain', last_message_at: '2026-09-03T09:00:00.000Z', last_outbound_at: '2026-09-03T09:00:00.000Z', message_count: 2, is_read: true, from_email: 'zoe@ex.ch' })
  })
  it('un message archivé côté fournisseur archive le fil ; un déjà connu ne recompte pas', () => {
    const existing = { ...(deriveThreadPatch(null, msg(), BOX, true) as ThreadRow), id: 'T', account_id: 'A', label_id: null, contact_id: null }
    const p = deriveThreadPatch(existing, msg({ inInbox: false, isRead: true }), BOX, false)
    expect(p.is_archived).toBe(true)
    expect(p.message_count).toBe(1)
  })
  it('un message plus ancien n écrase ni l extrait ni la date', () => {
    const existing = { ...(deriveThreadPatch(null, msg(), BOX, true) as ThreadRow), id: 'T', account_id: 'A', label_id: null, contact_id: null }
    const p = deriveThreadPatch(existing, msg({ providerMessageId: 'm0', snippet: 'Ancien', sentAt: '2026-09-01T08:00:00.000Z' }), BOX, true)
    expect(p.snippet).toBe('Bonjour')
    expect(p.last_message_at).toBe('2026-09-03T08:00:00.000Z')
    expect(p.message_count).toBe(2)
  })
})

describe('pickContact', () => {
  it('un seul contact distinct = match ; plusieurs = null', () => {
    expect(pickContact([{ contact_id: 'c1' }, { contact_id: 'c1' }])).toBe('c1')
    expect(pickContact([{ contact_id: 'c1' }, { contact_id: 'c2' }])).toBeNull()
    expect(pickContact([])).toBeNull()
  })
})

describe('capHtml', () => {
  it('plafonne à 512 Kio et le dit', () => {
    expect(capHtml('x'.repeat(10))).toEqual({ html: 'x'.repeat(10), truncated: false })
    const big = capHtml('y'.repeat(600 * 1024))
    expect(big.truncated).toBe(true)
    expect(big.html.length).toBe(512 * 1024)
  })
})
```

Ajouter `'supabase/functions/_shared/mail/ingest.test.ts',` à `vitest.config.ts` ; lancer → FAIL.

- [ ] **Step 2 : Implémentation**

```ts
// supabase/functions/_shared/mail/ingest.ts
// Écrit ce que les adaptateurs ont lu : fils, messages, pièces (métadonnées),
// rattachement au contact (D11), événement d'audit (timeline). Service-role :
// TOUT est filtré par account.agency_id, jamais par une valeur venue du réseau.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { MailAccountRow, MailAddress, NormalizedMessage, RemoteChange } from './types.ts'

export const HTML_CAP = 512 * 1024

export interface ThreadRow {
  id: string
  account_id: string
  subject: string | null
  snippet: string | null
  participants: MailAddress[]
  from_name: string | null
  from_email: string | null
  last_message_at: string
  last_inbound_at: string | null
  last_outbound_at: string | null
  message_count: number
  has_attachments: boolean
  is_read: boolean
  is_starred: boolean
  is_archived: boolean
  is_trashed: boolean
  label_id: string | null
  contact_id: string | null
}
export type ThreadPatch = Omit<ThreadRow, 'id' | 'account_id' | 'label_id' | 'contact_id'>

export function externalParticipants(m: NormalizedMessage, boxEmail: string): MailAddress[] {
  const box = boxEmail.toLowerCase()
  const seen = new Set<string>()
  const out: MailAddress[] = []
  for (const a of [m.from, ...m.to, ...m.cc]) {
    const e = a.email.toLowerCase()
    if (!e || e === box || seen.has(e)) continue
    seen.add(e)
    out.push({ name: a.name, email: e })
  }
  return out
}

export function capHtml(html: string | null): { html: string | null; truncated: boolean } {
  if (!html) return { html: null, truncated: false }
  return html.length > HTML_CAP ? { html: html.slice(0, HTML_CAP), truncated: true } : { html, truncated: false }
}

/** Dérive l'état du fil après ce message. `isNew` = le message n'était pas connu. */
export function deriveThreadPatch(existing: ThreadRow | null, m: NormalizedMessage, boxEmail: string, isNew: boolean): ThreadPatch {
  const parts = externalParticipants(m, boxEmail)
  const newer = !existing || m.sentAt >= existing.last_message_at
  const mergedParticipants = (() => {
    const acc: MailAddress[] = [...(existing?.participants ?? [])]
    for (const p of parts) if (!acc.some((x) => x.email === p.email)) acc.push(p)
    return acc.slice(0, 8)
  })()
  const inboundSender = m.direction === 'inbound' ? m.from : null
  const from = inboundSender && (newer || !existing?.from_email) ? inboundSender : (existing ? { name: existing.from_name, email: existing.from_email ?? '' } : (parts[0] ?? { name: null, email: '' }))
  const latestInbound = m.direction === 'inbound' && newer
  return {
    subject: existing?.subject ?? m.subject,
    snippet: newer ? m.snippet : (existing?.snippet ?? m.snippet),
    participants: mergedParticipants,
    from_name: from.name,
    from_email: from.email || null,
    last_message_at: newer ? m.sentAt : existing!.last_message_at,
    last_inbound_at: m.direction === 'inbound'
      ? (existing?.last_inbound_at && existing.last_inbound_at > m.sentAt ? existing.last_inbound_at : m.sentAt)
      : (existing?.last_inbound_at ?? null),
    last_outbound_at: m.direction === 'outbound'
      ? (existing?.last_outbound_at && existing.last_outbound_at > m.sentAt ? existing.last_outbound_at : m.sentAt)
      : (existing?.last_outbound_at ?? null),
    message_count: (existing?.message_count ?? 0) + (isNew ? 1 : 0),
    has_attachments: (existing?.has_attachments ?? false) || m.attachments.some((a) => !a.isInline),
    is_read: (existing?.is_read ?? true) && m.isRead,
    is_starred: (existing?.is_starred ?? false) || m.isStarred,
    is_archived: latestInbound ? (!m.inInbox && !m.isTrashed) : (existing?.is_archived ?? false),
    is_trashed: newer ? m.isTrashed : (existing?.is_trashed ?? false),
  }
}

export function pickContact(rows: { contact_id: string }[]): string | null {
  const ids = Array.from(new Set(rows.map((r) => r.contact_id)))
  return ids.length === 1 ? ids[0] : null
}

async function matchContact(admin: SupabaseClient, agencyId: string, emails: string[]): Promise<string | null> {
  if (emails.length === 0) return null
  const lowered = emails.map((e) => e.toLowerCase())
  const { data: direct } = await admin.from('contacts').select('id').eq('agency_id', agencyId).in('email', lowered)
  const byContact = pickContact((direct ?? []).map((r: { id: string }) => ({ contact_id: r.id })))
  if (byContact) return byContact
  const { data: alias } = await admin.from('mail_contact_aliases').select('contact_id').eq('agency_id', agencyId).in('email', lowered)
  return pickContact((alias ?? []) as { contact_id: string }[])
}

async function audit(admin: SupabaseClient, account: MailAccountRow, action: 'email_received' | 'email_sent', threadId: string, messageId: string, contactId: string, m: NormalizedMessage): Promise<void> {
  const { error } = await admin.from('activity_events').insert({
    agency_id: account.agency_id,
    actor_id: null,
    actor_kind: 'system',
    action,
    category: 'messaging',
    severity: 'info',
    entity_type: 'contact',
    entity_id: contactId,
    object_label: m.subject || '(sans objet)',
    metadata: { thread_id: threadId, message_id: messageId, account_id: account.id, from: m.from.email, to: m.to.map((a) => a.email) },
  })
  if (error) console.error('[mail ingest] activity_events refused', error.message)
}

export interface IngestOptions {
  /** true = ne journalise pas (mail-send écrit lui-même l'événement avec l'acteur). */
  skipAudit?: boolean
}

/** Ingère des messages normalisés (idempotent sur (account_id, provider_message_id)). */
export async function ingestMessages(admin: SupabaseClient, account: MailAccountRow, msgs: NormalizedMessage[], opts: IngestOptions = {}): Promise<{ inserted: number; updated: number }> {
  let inserted = 0
  let updated = 0
  for (const m of msgs) {
    if (m.isDraft) continue

    // Message déjà connu ? (ou copie « Envoyés » d'un envoi CRM en attente : pending:<Message-ID>)
    const { data: known } = await admin.from('mail_messages')
      .select('id, thread_id, provider_message_id')
      .eq('account_id', account.id)
      .or(`provider_message_id.eq.${m.providerMessageId}${m.rfc822MessageId ? `,and(provider_message_id.eq.pending:${m.rfc822MessageId})` : ''}`)
      .limit(1).maybeSingle()
    const isNew = !known

    if (known && known.provider_message_id.startsWith('pending:')) {
      // Copie « Envoyés » d'un envoi CRM (Graph) : le fil provisoire prend l'id de
      // conversation réel s'il n'existe pas encore sous ce nom.
      const { data: real } = await admin.from('mail_threads').select('id').eq('account_id', account.id).eq('provider_thread_id', m.providerThreadId).maybeSingle()
      if (!real) await admin.from('mail_threads').update({ provider_thread_id: m.providerThreadId }).eq('id', known.thread_id)
    }

    // Fil
    const { data: existing } = await admin.from('mail_threads').select('*').eq('account_id', account.id).eq('provider_thread_id', m.providerThreadId).maybeSingle()
    const patch = deriveThreadPatch((existing as ThreadRow | null) ?? null, m, account.email, isNew)
    let threadId: string
    let contactId: string | null = existing?.contact_id ?? null
    if (contactId === null) contactId = await matchContact(admin, account.agency_id, externalParticipants(m, account.email).map((a) => a.email))
    if (existing) {
      threadId = existing.id
      const { error } = await admin.from('mail_threads').update({ ...patch, contact_id: contactId }).eq('id', threadId)
      if (error) throw new Error(`thread update: ${error.message}`)
    } else {
      const { data: t, error } = await admin.from('mail_threads').insert({
        account_id: account.id, agency_id: account.agency_id, provider_thread_id: m.providerThreadId, ...patch, contact_id: contactId,
      }).select('id').single()
      if (error) throw new Error(`thread insert: ${error.message}`)
      threadId = t.id
    }

    // Message
    const { html, truncated } = capHtml(m.bodyHtml)
    const row = {
      thread_id: threadId, account_id: account.id, agency_id: account.agency_id,
      provider_message_id: m.providerMessageId, rfc822_message_id: m.rfc822MessageId, in_reply_to: m.inReplyTo,
      direction: m.direction, from_name: m.from.name, from_email: m.from.email,
      to: m.to, cc: m.cc, bcc: m.bcc, reply_to: m.replyTo, subject: m.subject, snippet: m.snippet,
      body_text: m.bodyText, body_html: html, body_truncated: truncated, sent_at: m.sentAt,
      is_read: m.isRead, has_attachments: m.attachments.some((a) => !a.isInline), provider_labels: m.providerLabels,
      contact_id: contactId,
    }
    let messageId: string
    if (known) {
      const { error } = await admin.from('mail_messages').update(row).eq('id', known.id)
      if (error) throw new Error(`message update: ${error.message}`)
      messageId = known.id
      updated++
    } else {
      const { data: ins, error } = await admin.from('mail_messages').insert(row).select('id').single()
      if (error) throw new Error(`message insert: ${error.message}`)
      messageId = ins.id
      inserted++
    }

    // Pièces (remplacement intégral : la liste du fournisseur fait foi)
    await admin.from('mail_attachments').delete().eq('message_id', messageId)
    if (m.attachments.length) {
      const { error } = await admin.from('mail_attachments').insert(m.attachments.map((a) => ({
        message_id: messageId, account_id: account.id, agency_id: account.agency_id,
        provider_attachment_id: a.providerAttachmentId, filename: a.filename, mime_type: a.mimeType,
        size_bytes: a.sizeBytes, is_inline: a.isInline, content_id: a.contentId,
      })))
      if (error) throw new Error(`attachments insert: ${error.message}`)
    }

    if (isNew && contactId && !opts.skipAudit) {
      await audit(admin, account, m.direction === 'inbound' ? 'email_received' : 'email_sent', threadId, messageId, contactId, m)
    }
  }
  return { inserted, updated }
}

/** Recalcule les agrégats d'un fil depuis ses messages ; supprime le fil s'il est vide. */
export async function recomputeThread(admin: SupabaseClient, threadId: string): Promise<void> {
  const { data: msgs } = await admin.from('mail_messages')
    .select('sent_at, direction, is_read, has_attachments, snippet')
    .eq('thread_id', threadId).order('sent_at', { ascending: true })
  if (!msgs || msgs.length === 0) {
    await admin.from('mail_threads').delete().eq('id', threadId)
    return
  }
  const last = msgs[msgs.length - 1]
  const inbound = msgs.filter((x) => x.direction === 'inbound')
  const outbound = msgs.filter((x) => x.direction === 'outbound')
  await admin.from('mail_threads').update({
    message_count: msgs.length,
    last_message_at: last.sent_at,
    snippet: last.snippet,
    last_inbound_at: inbound.length ? inbound[inbound.length - 1].sent_at : null,
    last_outbound_at: outbound.length ? outbound[outbound.length - 1].sent_at : null,
    has_attachments: msgs.some((x) => x.has_attachments),
    is_read: msgs.every((x) => x.is_read),
  }).eq('id', threadId)
}

/** Applique les gestes faits chez le fournisseur (lu, étoile, archive, corbeille, suppression). */
export async function applyRemoteChanges(admin: SupabaseClient, account: MailAccountRow, changes: RemoteChange[]): Promise<number> {
  let applied = 0
  for (const c of changes) {
    const { data: msg } = await admin.from('mail_messages').select('id, thread_id, direction')
      .eq('account_id', account.id).eq('provider_message_id', c.providerMessageId).maybeSingle()
    if (!msg) continue
    if (c.kind === 'message_deleted') {
      await admin.from('mail_messages').delete().eq('id', msg.id)
      await recomputeThread(admin, msg.thread_id)
      applied++
      continue
    }
    if (c.isRead !== undefined) await admin.from('mail_messages').update({ is_read: c.isRead }).eq('id', msg.id)
    const patch: Record<string, unknown> = {}
    if (c.isStarred !== undefined) patch.is_starred = c.isStarred
    if (c.isTrashed !== undefined) patch.is_trashed = c.isTrashed
    if (c.inInbox !== undefined && msg.direction === 'inbound') patch.is_archived = !c.inInbox && !(c.isTrashed ?? false)
    if (Object.keys(patch).length) await admin.from('mail_threads').update(patch).eq('id', msg.thread_id)
    if (c.isRead !== undefined) await recomputeThread(admin, msg.thread_id)
    applied++
  }
  return applied
}

/** Apprend un alias et rattache le fil (modale « Rapprocher l'adresse »). */
export async function linkThreadToContact(admin: SupabaseClient, account: MailAccountRow, threadId: string, contactId: string, email: string, learnedBy: string): Promise<void> {
  const { data: contact } = await admin.from('contacts').select('id').eq('id', contactId).eq('agency_id', account.agency_id).maybeSingle()
  if (!contact) throw new Error('contact_not_in_agency')
  await admin.from('mail_contact_aliases').upsert(
    { agency_id: account.agency_id, email: email.toLowerCase(), contact_id: contactId, learned_by: learnedBy },
    { onConflict: 'agency_id,email', ignoreDuplicates: false },
  )
  await admin.from('mail_threads').update({ contact_id: contactId }).eq('id', threadId).eq('account_id', account.id)
  await admin.from('mail_messages').update({ contact_id: contactId }).eq('thread_id', threadId).is('contact_id', null)
}
```

- [ ] **Step 3 : Vert, commit**

```bash
npx vitest run supabase/functions/_shared/mail/ingest.test.ts
git add supabase/functions/_shared/mail/ingest.ts supabase/functions/_shared/mail/ingest.test.ts vitest.config.ts
git commit -m "feat(messagerie): ingestion (fils, messages, pièces, contact, audit) et changements distants"
```
Attendu : 8 tests PASS.

---

### Task 1.9 : Orchestration d'une synchro + garde IDOR — `_shared/mail/sync.ts`, `guard.ts`

**Files:**
- Create: `supabase/functions/_shared/mail/guard.ts`
- Create: `supabase/functions/_shared/mail/sync.ts`

Pas de test unitaire dédié : `sync.ts` n'est que de l'assemblage des modules testés (1.5-1.8) ; il est éprouvé par `mail-edges.spec.ts` (1.15) et par l'épreuve §7.4 du maître.

- [ ] **Step 1 : `guard.ts`**

```ts
// supabase/functions/_shared/mail/guard.ts
// Service-role ⇒ pas de RLS : tout account_id venu du corps de la requête est
// revérifié ici contre l'identité prouvée par requireAgentAuth. Sans cette
// fonction, mail-actions serait un IDOR (même famille que les deux calendriers
// de l'audit du 02.08.2026).
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { MailAccountRow } from './types.ts'
import type { OAuthClientConfig } from './secrets.ts'

export interface CallerCtx { userId: string; agencyId: string }

export function accountVisibleTo(account: Pick<MailAccountRow, 'owner_id' | 'agency_id' | 'visibility'>, ctx: CallerCtx): boolean {
  return account.owner_id === ctx.userId || (account.visibility === 'agency' && account.agency_id === ctx.agencyId)
}

/** Charge le compte si l'appelant a le droit de le voir, sinon null. */
export async function loadVisibleAccount(admin: SupabaseClient, accountId: string, ctx: CallerCtx): Promise<MailAccountRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(accountId ?? '')) return null
  const { data } = await admin.from('mail_accounts').select('*').eq('id', accountId).maybeSingle()
  if (!data) return null
  return accountVisibleTo(data as MailAccountRow, ctx) ? (data as MailAccountRow) : null
}

export interface ProviderConfig { gmail: OAuthClientConfig; outlook: OAuthClientConfig }

/** Lit les quatre secrets. Un secret vide n'est PAS une erreur ici : c'est l'échange qui échouera, lisiblement. */
export function providerConfigFromEnv(get: (k: string) => string | undefined): ProviderConfig {
  return {
    gmail: { clientId: get('GOOGLE_CLIENT_ID') ?? '', clientSecret: get('GOOGLE_CLIENT_SECRET') ?? '' },
    outlook: { clientId: get('MICROSOFT_CLIENT_ID') ?? '', clientSecret: get('MICROSOFT_CLIENT_SECRET') ?? '' },
  }
}

/** Origines autorisées pour l'URI de redirection de la pop-up (D1). */
export const MAIL_OAUTH_ORIGINS = ['https://app.megga.ch', 'http://localhost:5173', 'http://localhost:5174'] as const
export function redirectUriFor(origin: string): string | null {
  return (MAIL_OAUTH_ORIGINS as readonly string[]).includes(origin) ? `${origin}/oauth/mail/callback` : null
}
```

- [ ] **Step 2 : `sync.ts`**

```ts
// supabase/functions/_shared/mail/sync.ts
// Une passe de synchronisation d'un compte, bornée par un budget de temps.
// Curseurs (types.ts) : Gmail = historyId + pageToken de la passe initiale ;
// Graph = deltaLink/nextLink par dossier + ids de dossiers.
// Échecs : reauth_required ⇒ le compte est déjà marqué (secrets.ts) ; autre
// erreur ⇒ last_error + backoff 10 min, statut inchangé (transitoire).
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { GmailCursor, GraphCursor, MailAccountRow, NormalizedMessage, SyncCursor } from './types.ts'
import { MailAuthError, getValidAccessToken } from './secrets.ts'
import { gmailGetMessage, gmailHistory, gmailIdentity, gmailListInitial, historyToChanges, normalizeGmailMessage } from './gmail.ts'
import { deltaToChanges, graphDelta, graphFolderIds, graphGetBody, graphListAttachments, normalizeGraphMessage } from './graph.ts'
import { applyRemoteChanges, ingestMessages } from './ingest.ts'
import type { ProviderConfig } from './guard.ts'

export interface SyncDeps { fetch?: typeof fetch; now?: () => number }
export interface SyncOutcome { inserted: number; updated: number; changes: number; done: boolean; error: string | null }

const INITIAL_WINDOW_DAYS = 90
const NEXT_TICK_MS = 2 * 60_000
const BACKOFF_MS = 10 * 60_000

function since(now: number): string {
  return new Date(now - INITIAL_WINDOW_DAYS * 86_400_000).toISOString()
}

export async function syncAccount(admin: SupabaseClient, account: MailAccountRow, cfg: ProviderConfig, budgetMs: number, deps: SyncDeps = {}): Promise<SyncOutcome> {
  const now = deps.now ?? Date.now
  const start = now()
  const out: SyncOutcome = { inserted: 0, updated: 0, changes: 0, done: true, error: null }
  try {
    let cursor: SyncCursor
    if (account.provider === 'gmail') cursor = await syncGmail(admin, account, cfg, budgetMs, start, deps, out)
    else if (account.provider === 'outlook') cursor = await syncGraph(admin, account, cfg, budgetMs, start, deps, out)
    else throw new Error(`provider ${account.provider} not supported by this build`)
    await admin.from('mail_accounts').update({
      sync_cursor: cursor,
      last_sync_at: new Date(now()).toISOString(),
      last_error: null,
      next_sync_at: new Date(now() + (out.done ? NEXT_TICK_MS : 0)).toISOString(),
    }).eq('id', account.id)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    out.error = msg
    out.done = true
    const reauth = e instanceof MailAuthError && e.code === 'reauth_required'
    await admin.from('mail_accounts').update({
      last_error: msg.slice(0, 500),
      next_sync_at: new Date(now() + BACKOFF_MS).toISOString(),
      ...(reauth ? { status: 'reauth_required' } : {}),
    }).eq('id', account.id)
    console.error(`[mail-sync] ${account.provider} ${account.id}: ${msg}`)
  }
  return out
}

// ── Gmail ─────────────────────────────────────────────────────────────────────
async function syncGmail(admin: SupabaseClient, account: MailAccountRow, cfg: ProviderConfig, budgetMs: number, start: number, deps: SyncDeps, out: SyncOutcome): Promise<GmailCursor> {
  const now = deps.now ?? Date.now
  const token = await getValidAccessToken(admin, account, cfg.gmail, deps)
  const c: GmailCursor = (account.sync_cursor as GmailCursor)?.kind === 'gmail'
    ? (account.sync_cursor as GmailCursor)
    : { kind: 'gmail', historyId: null, initialPageToken: null, initialDone: false }

  if (!c.initialDone) {
    // Le historyId est capturé AVANT la première page : tout ce qui bouge pendant
    // la passe initiale sera rejoué par history.list, rien n'est perdu.
    if (!c.historyId) c.historyId = (await gmailIdentity(token, deps)).historyId
    while (now() - start < budgetMs) {
      const page = await gmailListInitial(token, c.initialPageToken, deps)
      const msgs: NormalizedMessage[] = []
      for (const id of page.ids) msgs.push(normalizeGmailMessage(await gmailGetMessage(token, id, deps), account.email))
      const r = await ingestMessages(admin, account, msgs)
      out.inserted += r.inserted; out.updated += r.updated
      c.initialPageToken = page.nextPageToken
      if (!page.nextPageToken) { c.initialDone = true; break }
    }
    out.done = c.initialDone
    return c
  }

  let pageToken: string | null = null
  for (let i = 0; i < 5 && now() - start < budgetMs; i++) {
    const h = await gmailHistory(token, c.historyId!, pageToken, deps)
    if (h.expired) {
      // Historique trop ancien côté Google : on repart sur 90 jours, sans boucle d'erreur.
      return { kind: 'gmail', historyId: null, initialPageToken: null, initialDone: false }
    }
    const { added, changes } = historyToChanges(h.page!)
    const msgs: NormalizedMessage[] = []
    for (const id of added) {
      try { msgs.push(normalizeGmailMessage(await gmailGetMessage(token, id, deps), account.email)) }
      catch (e) { if (!(e instanceof Error && /http 404/.test(e.message))) throw e } // supprimé entre-temps
    }
    const r = await ingestMessages(admin, account, msgs)
    out.inserted += r.inserted; out.updated += r.updated
    out.changes += await applyRemoteChanges(admin, account, changes)
    if (h.page!.historyId) c.historyId = String(h.page!.historyId)
    pageToken = h.page!.nextPageToken ?? null
    if (!pageToken) break
  }
  out.done = pageToken === null
  return c
}

// ── Microsoft Graph ───────────────────────────────────────────────────────────
async function syncGraph(admin: SupabaseClient, account: MailAccountRow, cfg: ProviderConfig, budgetMs: number, start: number, deps: SyncDeps, out: SyncOutcome): Promise<GraphCursor> {
  const now = deps.now ?? Date.now
  const token = await getValidAccessToken(admin, account, cfg.outlook, deps)
  const c: GraphCursor = (account.sync_cursor as GraphCursor)?.kind === 'outlook'
    ? (account.sync_cursor as GraphCursor)
    : { kind: 'outlook', inboxDelta: null, sentDelta: null, initialDone: false, folderIds: null }
  if (!c.folderIds) c.folderIds = await graphFolderIds(token, deps)

  const folders: { name: 'inbox' | 'sentitems'; key: 'inboxDelta' | 'sentDelta' }[] = [{ name: 'inbox', key: 'inboxDelta' }, { name: 'sentitems', key: 'sentDelta' }]
  let allSettled = true
  for (const f of folders) {
    if (now() - start >= budgetMs) { allSettled = false; break }
    const d = await graphDelta(token, f.name, c[f.key], since(now()), deps)
    const ids = d.items.filter((i) => !i['@removed']).map((i) => i.id)
    const { data: knownRows } = ids.length
      ? await admin.from('mail_messages').select('provider_message_id').eq('account_id', account.id).in('provider_message_id', ids)
      : { data: [] as { provider_message_id: string }[] }
    const known = new Set((knownRows ?? []).map((r: { provider_message_id: string }) => r.provider_message_id))
    const { added, changes } = deltaToChanges(d.items, known, c.folderIds)
    const msgs: NormalizedMessage[] = []
    for (const m of added) {
      const body = await graphGetBody(token, m.id, deps)
      const atts = m.hasAttachments ? await graphListAttachments(token, m.id, deps) : []
      msgs.push(normalizeGraphMessage(m, body, atts, c.folderIds, account.email))
    }
    const r = await ingestMessages(admin, account, msgs)
    out.inserted += r.inserted; out.updated += r.updated
    out.changes += await applyRemoteChanges(admin, account, changes)
    // deltaLink = passe finie pour ce dossier ; nextLink = il reste des pages (curseur provisoire).
    c[f.key] = d.deltaLink ?? d.nextLink
    if (!d.deltaLink) allSettled = false
  }
  if (allSettled) c.initialDone = true
  out.done = allSettled
  return c
}
```

- [ ] **Step 3 : Type-check Deno et commit**

```bash
deno check supabase/functions/_shared/mail/sync.ts supabase/functions/_shared/mail/guard.ts
git add supabase/functions/_shared/mail/sync.ts supabase/functions/_shared/mail/guard.ts
git commit -m "feat(messagerie): orchestration de synchro (Gmail history, Graph delta) et garde IDOR"
```
Attendu : `deno check` sans erreur (⚠ `tsc -b` ne couvre pas ce dossier).

---

### Task 1.10 : Edge `mail-oauth` (start · exchange · disconnect · update)

**Files:**
- Create: `supabase/functions/mail-oauth/index.ts`
- Modify: `supabase/config.toml` (bloc `[functions.mail-oauth]`)

- [ ] **Step 1 : Écrire l'edge**

```ts
// supabase/functions/mail-oauth/index.ts
// Connexion d'une boîte par OAuth en pop-up (plan §3 D1, §4 « Ajouter une boîte »).
//   start      → { url, state }            (state + code_verifier gardés en base)
//   exchange   → { account }               (échange PKCE, identité, Vault, 1re synchro en fond)
//   disconnect → { ok }                    (révocation, Vault effacé, cascade)
//   update     → { account }               (display_name, visibility — propriétaire seul)
// Garde : requireAgentAuth AVANT toute lecture de configuration (règle 4 du lot).
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'
import { buildAuthorizeUrl, exchangeCode, fetchIdentity, pkceChallenge, randomToken, revokeToken, type OAuthProvider } from '../_shared/mail/oauth.ts'
import { deleteAccountSecret, readAccountSecret, storeAccountSecret } from '../_shared/mail/secrets.ts'
import { loadVisibleAccount, providerConfigFromEnv, redirectUriFor } from '../_shared/mail/guard.ts'
import { syncAccount } from '../_shared/mail/sync.ts'
import type { MailAccountRow, OAuthSecret } from '../_shared/mail/types.ts'

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
}
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

/** Six libellés semés à la première boîte de l'agence (D12), dans la langue de l'agent. */
const SEED_LABELS: Record<'fr' | 'de' | 'en' | 'it', string[]> = {
  fr: ['À traiter', 'Banques', 'Notaires', 'Clients', 'Visites', 'Fournisseurs'],
  de: ['Zu erledigen', 'Banken', 'Notare', 'Kunden', 'Besichtigungen', 'Lieferanten'],
  en: ['To handle', 'Banks', 'Notaries', 'Clients', 'Viewings', 'Suppliers'],
  it: ['Da trattare', 'Banche', 'Notai', 'Clienti', 'Visite', 'Fornitori'],
}
const SEED_COLORS = ['#fe566b', '#8dc1ff', '#efc42c', '#adecbb', '#424bfb', '#686868'] // MXC_SYSTEM + accent + n500

const PUBLIC_COLS = 'id, agency_id, owner_id, provider, email, display_name, visibility, status, last_sync_at, last_error, created_at'

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const auth = await requireAgentAuth(req, corsHeaders)
  if (auth instanceof Response) return auth
  const { user, profile, supabase: admin } = auth
  const ctx = { userId: user.id, agencyId: profile.agency_id }

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }
  const action = String(body.action ?? '')
  const cfg = providerConfigFromEnv((k) => Deno.env.get(k))

  if (action === 'start') {
    const provider = body.provider as OAuthProvider
    if (provider !== 'gmail' && provider !== 'outlook') return json({ error: 'invalid_provider' }, 400)
    const redirectUri = redirectUriFor(String(body.origin ?? ''))
    if (!redirectUri) return json({ error: 'invalid_origin' }, 400)
    if (!cfg[provider].clientId) return json({ error: 'provider_not_configured', provider }, 503)
    const visibility = body.visibility === 'agency' ? 'agency' : 'owner'
    const loginHint = typeof body.login_hint === 'string' && body.login_hint.includes('@') ? body.login_hint.trim().toLowerCase() : null
    const state = randomToken(32)
    const codeVerifier = randomToken(48)
    const { error } = await admin.from('mail_oauth_states').insert({
      state, user_id: user.id, agency_id: profile.agency_id, provider, code_verifier: codeVerifier,
      login_hint: loginHint, visibility, redirect_uri: redirectUri,
    })
    if (error) return json({ error: 'state_store_failed' }, 500)
    const url = buildAuthorizeUrl(provider, { clientId: cfg[provider].clientId, redirectUri, state, codeChallenge: await pkceChallenge(codeVerifier), loginHint })
    return json({ url, state })
  }

  if (action === 'exchange') {
    const code = String(body.code ?? '')
    const state = String(body.state ?? '')
    if (!code || !/^[0-9a-f]{64}$/.test(state)) return json({ error: 'invalid_state' }, 403)
    const { data: st } = await admin.from('mail_oauth_states').select('*').eq('state', state).eq('user_id', user.id).maybeSingle()
    if (!st || st.consumed_at || new Date(st.expires_at).getTime() < Date.now()) return json({ error: 'invalid_state' }, 403)
    await admin.from('mail_oauth_states').update({ consumed_at: new Date().toISOString() }).eq('state', state)
    const provider = st.provider as OAuthProvider

    let tokens: { access_token: string; refresh_token: string; expires_in: number }
    let identity: { email: string; name: string | null }
    try {
      tokens = await exchangeCode(provider, { code, codeVerifier: st.code_verifier, clientId: cfg[provider].clientId, clientSecret: cfg[provider].clientSecret, redirectUri: st.redirect_uri })
      identity = await fetchIdentity(provider, tokens.access_token)
    } catch (e) {
      return json({ error: 'exchange_failed', detail: e instanceof Error ? e.message : String(e) }, 502)
    }

    const secret: OAuthSecret = {
      refresh_token: tokens.refresh_token, access_token: tokens.access_token,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    }
    // Une boîte déjà connectée (même agence, même adresse) est RÉAUTORISÉE, pas dupliquée.
    const { data: existing } = await admin.from('mail_accounts').select('id, vault_secret_id')
      .eq('agency_id', profile.agency_id).eq('provider', provider).ilike('email', identity.email).maybeSingle()
    let accountId: string
    if (existing) {
      if (existing.vault_secret_id) await deleteAccountSecret(admin, existing.vault_secret_id).catch(() => undefined)
      const vaultId = await storeAccountSecret(admin, `mail:${provider}:${identity.email}`, secret)
      const { error } = await admin.from('mail_accounts').update({
        vault_secret_id: vaultId, status: 'active', last_error: null, owner_id: user.id,
        visibility: st.visibility, display_name: identity.name, next_sync_at: new Date().toISOString(),
      }).eq('id', existing.id)
      if (error) return json({ error: 'account_update_failed' }, 500)
      accountId = existing.id
    } else {
      const vaultId = await storeAccountSecret(admin, `mail:${provider}:${identity.email}`, secret)
      const { data: ins, error } = await admin.from('mail_accounts').insert({
        agency_id: profile.agency_id, owner_id: user.id, provider, email: identity.email, display_name: identity.name,
        visibility: st.visibility, status: 'active', vault_secret_id: vaultId,
      }).select('id').single()
      if (error) { await deleteAccountSecret(admin, vaultId).catch(() => undefined); return json({ error: 'account_insert_failed', detail: error.message }, 500) }
      accountId = ins.id
    }

    // Libellés par défaut si l'agence n'en a aucun (langue de correspondance de l'agent).
    const { count } = await admin.from('mail_labels').select('id', { count: 'exact', head: true }).eq('agency_id', profile.agency_id)
    if ((count ?? 0) === 0) {
      const { data: p } = await admin.from('profiles').select('language').eq('id', user.id).maybeSingle()
      const lang = (['fr', 'de', 'en', 'it'] as const).find((l) => l === p?.language) ?? 'fr'
      await admin.from('mail_labels').insert(SEED_LABELS[lang].map((name, i) => ({ agency_id: profile.agency_id, name, color: SEED_COLORS[i], position: i, is_default: true })))
    }

    // Première synchro en arrière-plan : l'assistant affiche « Boîte connectée » sans attendre.
    const { data: account } = await admin.from('mail_accounts').select('*').eq('id', accountId).single()
    EdgeRuntime.waitUntil(syncAccount(admin, account as MailAccountRow, cfg, 45_000))
    const { data: pub } = await admin.from('mail_accounts').select(PUBLIC_COLS).eq('id', accountId).single()
    return json({ account: pub })
  }

  if (action === 'disconnect') {
    const account = await loadVisibleAccount(admin, String(body.account_id ?? ''), ctx)
    if (!account) return json({ error: 'not_found' }, 404)
    if (account.owner_id !== user.id && !['admin', 'manager'].includes(profile.role ?? '')) return json({ error: 'forbidden' }, 403)
    if (account.vault_secret_id) {
      const secret = await readAccountSecret<OAuthSecret>(admin, account.vault_secret_id).catch(() => null)
      if (secret && 'refresh_token' in secret && (account.provider === 'gmail' || account.provider === 'outlook')) await revokeToken(account.provider, secret.refresh_token)
      await deleteAccountSecret(admin, account.vault_secret_id).catch(() => undefined)
    }
    const { error } = await admin.from('mail_accounts').delete().eq('id', account.id)
    if (error) return json({ error: 'delete_failed' }, 500)
    return json({ ok: true })
  }

  if (action === 'update') {
    const account = await loadVisibleAccount(admin, String(body.account_id ?? ''), ctx)
    if (!account) return json({ error: 'not_found' }, 404)
    if (account.owner_id !== user.id) return json({ error: 'forbidden' }, 403)
    const patch: Record<string, unknown> = {}
    if (typeof body.display_name === 'string') patch.display_name = body.display_name.slice(0, 80)
    if (body.visibility === 'owner' || body.visibility === 'agency') patch.visibility = body.visibility
    const { data: pub, error } = await admin.from('mail_accounts').update(patch).eq('id', account.id).select(PUBLIC_COLS).single()
    if (error) return json({ error: 'update_failed' }, 500)
    return json({ account: pub })
  }

  return json({ error: 'unknown_action' }, 400)
})
```

- [ ] **Step 2 : Déclarer la fonction**

Dans `supabase/config.toml`, à la suite du dernier bloc `[functions.*]` (ordre alphabétique du roster : après `[functions.magic-link-send-email]` s'il existe, sinon en fin de section) :
```toml
[functions.mail-oauth]
verify_jwt = false
```

- [ ] **Step 3 : Type-check, servir en local, commit**

```bash
deno check supabase/functions/mail-oauth/index.ts
supabase functions serve mail-oauth --no-verify-jwt --env-file supabase/.env.local
```
Dans un second terminal, sans jeton :
```bash
curl -s -X POST http://127.0.0.1:54321/functions/v1/mail-oauth -H 'Content-Type: application/json' -d '{"action":"start","provider":"gmail","origin":"http://localhost:5173"}'
```
Attendu : `{"error":"Authentication required"}` (401, la garde parle avant tout).

```bash
git add supabase/functions/mail-oauth/index.ts supabase/config.toml
git commit -m "feat(messagerie): edge mail-oauth (start, exchange PKCE, disconnect, update)"
```

---

### Task 1.11 : Edge `mail-sync` (balayage cron + ciblé)

**Files:**
- Create: `supabase/functions/mail-sync/index.ts`
- Modify: `supabase/config.toml`

- [ ] **Step 1 : Écrire l'edge**

```ts
// supabase/functions/mail-sync/index.ts
// Balayage de synchronisation. Deux appelants :
//   - pg_cron `mail-sync-2min` (Bearer = clé service, corps {}) : jusqu'à 25 comptes dus ;
//   - un agent connecté (`{ account_id }`) via mail-actions `sync_now` ou directement :
//     UN compte, visible par lui, budget court — c'est le « rafraîchir » de l'écran.
// Un bail en base (mail_cron_locks) empêche deux balayages simultanés : le budget
// (60 s) dépasse l'intervalle (120 s) rarement, mais un tick lent + un tick suivant
// = double coût fournisseur et curseurs en course. Le TTL (180 s) est le filet.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { isServiceSecret } from '../_shared/require-service-secret.ts'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'
import { loadVisibleAccount, providerConfigFromEnv } from '../_shared/mail/guard.ts'
import { syncAccount } from '../_shared/mail/sync.ts'
import type { MailAccountRow } from '../_shared/mail/types.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
}
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

const SWEEP_BUDGET_MS = 60_000
const PER_ACCOUNT_BUDGET_MS = 20_000
const TARGETED_BUDGET_MS = 20_000
const MAX_ACCOUNTS_PER_TICK = 25
const LOCK_TTL_MS = 180_000

async function acquireLock(admin: ReturnType<typeof createClient>): Promise<boolean> {
  const until = new Date(Date.now() + LOCK_TTL_MS).toISOString()
  const { data } = await admin.from('mail_cron_locks').update({ locked_until: until })
    .eq('job', 'mail-sync').lt('locked_until', new Date().toISOString()).select('job')
  return (data ?? []).length === 1
}
async function releaseLock(admin: ReturnType<typeof createClient>): Promise<void> {
  await admin.from('mail_cron_locks').update({ locked_until: new Date().toISOString() }).eq('job', 'mail-sync')
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* corps vide = balayage */ }
  const cfg = providerConfigFromEnv((k) => Deno.env.get(k))

  // ── Appel ciblé par un agent ───────────────────────────────────────────────
  if (typeof body.account_id === 'string') {
    const auth = await requireAgentAuth(req, corsHeaders)
    if (auth instanceof Response) return auth
    const account = await loadVisibleAccount(auth.supabase, body.account_id, { userId: auth.user.id, agencyId: auth.profile.agency_id })
    if (!account) return json({ error: 'not_found' }, 404)
    if (account.status !== 'active') return json({ error: 'account_not_active', status: account.status }, 409)
    const r = await syncAccount(auth.supabase, account, cfg, TARGETED_BUDGET_MS)
    return json({ account_id: account.id, ...r })
  }

  // ── Balayage cron ──────────────────────────────────────────────────────────
  if (!(await isServiceSecret(admin, req))) return json({ error: 'unauthorized' }, 401)
  if (!(await acquireLock(admin))) return json({ ok: true, skipped: 'locked' })
  const started = Date.now()
  const results: Record<string, unknown>[] = []
  try {
    const { data: due } = await admin.from('mail_accounts').select('*')
      .eq('status', 'active').lte('next_sync_at', new Date().toISOString())
      .order('next_sync_at', { ascending: true }).limit(MAX_ACCOUNTS_PER_TICK)
    for (const account of (due ?? []) as MailAccountRow[]) {
      if (Date.now() - started > SWEEP_BUDGET_MS) break
      const r = await syncAccount(admin, account, cfg, Math.min(PER_ACCOUNT_BUDGET_MS, SWEEP_BUDGET_MS - (Date.now() - started)))
      results.push({ account_id: account.id, provider: account.provider, ...r })
    }
  } finally {
    await releaseLock(admin)
  }
  return json({ ok: true, synced: results.length, elapsed_ms: Date.now() - started, results })
})
```

- [ ] **Step 2 : Déclarer, vérifier, commit**

`supabase/config.toml` :
```toml
[functions.mail-sync]
verify_jwt = false
```
```bash
deno check supabase/functions/mail-sync/index.ts
git add supabase/functions/mail-sync/index.ts supabase/config.toml
git commit -m "feat(messagerie): edge mail-sync (balayage cron verrouillé, synchro ciblée)"
```

---

### Task 1.12 : Edge `mail-actions` (état des fils, rattachement, sync_now)

**Files:**
- Create: `supabase/functions/mail-actions/index.ts`
- Modify: `supabase/config.toml`

- [ ] **Step 1 : Écrire l'edge**

```ts
// supabase/functions/mail-actions/index.ts
// Gestes sur un fil, répercutés chez le fournisseur PUIS en base (l'UI est
// optimiste ; si le fournisseur refuse, elle rétablit — plan §4 « Flux d'actions »).
//   mark_read | mark_unread | star | unstar | archive | unarchive | trash | untrash
//     { account_id, thread_id }
//   link_contact { account_id, thread_id, contact_id, email }
//   sync_now     { account_id }
// Le libellé (label_id) s'écrit directement par PostgREST (colonne accordée) :
// il n'a pas d'équivalent fournisseur.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'
import { loadVisibleAccount, providerConfigFromEnv } from '../_shared/mail/guard.ts'
import { getValidAccessToken } from '../_shared/mail/secrets.ts'
import { gmailModify } from '../_shared/mail/gmail.ts'
import { graphMove, graphPatch } from '../_shared/mail/graph.ts'
import { linkThreadToContact, recomputeThread } from '../_shared/mail/ingest.ts'
import { syncAccount } from '../_shared/mail/sync.ts'
import type { MailAccountRow } from '../_shared/mail/types.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
}
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

type ThreadAction = 'mark_read' | 'mark_unread' | 'star' | 'unstar' | 'archive' | 'unarchive' | 'trash' | 'untrash'
const THREAD_ACTIONS: ThreadAction[] = ['mark_read', 'mark_unread', 'star', 'unstar', 'archive', 'unarchive', 'trash', 'untrash']

interface MsgRow { id: string; provider_message_id: string; direction: 'inbound' | 'outbound' }

/** Applique le geste chez le fournisseur, message par message. Rend les nouveaux ids Graph (move). */
async function pushToProvider(account: MailAccountRow, token: string, action: ThreadAction, msgs: MsgRow[]): Promise<Record<string, string>> {
  const renamed: Record<string, string> = {}
  for (const m of msgs) {
    if (m.provider_message_id.startsWith('pending:')) continue
    if (account.provider === 'gmail') {
      const [add, remove] = ({
        mark_read: [[], ['UNREAD']], mark_unread: [['UNREAD'], []],
        star: [['STARRED'], []], unstar: [[], ['STARRED']],
        archive: [[], ['INBOX']], unarchive: [['INBOX'], []],
        trash: [['TRASH'], ['INBOX']], untrash: [['INBOX'], ['TRASH']],
      } as Record<ThreadAction, [string[], string[]]>)[action]
      await gmailModify(token, m.provider_message_id, add, remove)
    } else if (account.provider === 'outlook') {
      if (action === 'mark_read' || action === 'mark_unread') await graphPatch(token, m.provider_message_id, { isRead: action === 'mark_read' })
      else if (action === 'star' || action === 'unstar') await graphPatch(token, m.provider_message_id, { flagged: action === 'star' })
      else if (m.direction === 'inbound') {
        const dest = action === 'archive' ? 'archive' : action === 'trash' ? 'deleteditems' : 'inbox'
        renamed[m.provider_message_id] = await graphMove(token, m.provider_message_id, dest)
      }
    } else {
      throw new Error(`provider ${account.provider} not supported by this build`)
    }
  }
  return renamed
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  const auth = await requireAgentAuth(req, corsHeaders)
  if (auth instanceof Response) return auth
  const { user, profile, supabase: admin } = auth
  const ctx = { userId: user.id, agencyId: profile.agency_id }

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }
  const action = String(body.action ?? '')
  const account = await loadVisibleAccount(admin, String(body.account_id ?? ''), ctx)
  if (!account) return json({ error: 'not_found' }, 404)
  const cfg = providerConfigFromEnv((k) => Deno.env.get(k))

  if (action === 'sync_now') {
    if (account.status !== 'active') return json({ error: 'account_not_active', status: account.status }, 409)
    return json(await syncAccount(admin, account, cfg, 20_000))
  }

  const threadId = String(body.thread_id ?? '')
  const { data: thread } = await admin.from('mail_threads').select('id, is_read, is_starred, is_archived, is_trashed, contact_id')
    .eq('id', threadId).eq('account_id', account.id).maybeSingle()
  if (!thread) return json({ error: 'thread_not_found' }, 404)

  if (action === 'link_contact') {
    const contactId = String(body.contact_id ?? '')
    const email = String(body.email ?? '').trim().toLowerCase()
    if (!/^[0-9a-f-]{36}$/i.test(contactId) || !email.includes('@')) return json({ error: 'invalid_input' }, 400)
    try {
      await linkThreadToContact(admin, account, thread.id, contactId, email, user.id)
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : 'link_failed' }, 400)
    }
    return json({ ok: true, thread_id: thread.id, contact_id: contactId })
  }

  if (!THREAD_ACTIONS.includes(action as ThreadAction)) return json({ error: 'unknown_action' }, 400)
  const { data: msgs } = await admin.from('mail_messages').select('id, provider_message_id, direction').eq('thread_id', thread.id)

  try {
    const token = await getValidAccessToken(admin, account, account.provider === 'gmail' ? cfg.gmail : cfg.outlook)
    const renamed = await pushToProvider(account, token, action as ThreadAction, (msgs ?? []) as MsgRow[])
    for (const [oldId, newId] of Object.entries(renamed)) {
      await admin.from('mail_messages').update({ provider_message_id: newId }).eq('account_id', account.id).eq('provider_message_id', oldId)
    }
  } catch (e) {
    return json({ error: 'provider_failed', detail: e instanceof Error ? e.message : String(e) }, 502)
  }

  const patch: Record<string, unknown> = {}
  if (action === 'mark_read' || action === 'mark_unread') {
    await admin.from('mail_messages').update({ is_read: action === 'mark_read' }).eq('thread_id', thread.id)
    await recomputeThread(admin, thread.id)
  }
  if (action === 'star') patch.is_starred = true
  if (action === 'unstar') patch.is_starred = false
  if (action === 'archive') patch.is_archived = true
  if (action === 'unarchive') patch.is_archived = false
  if (action === 'trash') { patch.is_trashed = true }
  if (action === 'untrash') { patch.is_trashed = false; patch.is_archived = false }
  if (Object.keys(patch).length) await admin.from('mail_threads').update(patch).eq('id', thread.id)

  const { data: after } = await admin.from('mail_threads').select('id, is_read, is_starred, is_archived, is_trashed').eq('id', thread.id).single()
  return json({ ok: true, thread: after })
})
```

- [ ] **Step 2 : Déclarer, vérifier, commit**

`supabase/config.toml` :
```toml
[functions.mail-actions]
verify_jwt = false
```
```bash
deno check supabase/functions/mail-actions/index.ts
git add supabase/functions/mail-actions/index.ts supabase/config.toml
git commit -m "feat(messagerie): edge mail-actions (lu, étoile, archive, corbeille, rattachement, sync_now)"
```

---

### Task 1.13 : Edge `mail-send` (nouveau · réponse · transfert)

**Files:**
- Create: `supabase/functions/mail-send/index.ts`
- Modify: `supabase/config.toml`

- [ ] **Step 1 : Écrire l'edge**

```ts
// supabase/functions/mail-send/index.ts
// Envoi depuis la boîte de l'agent (D10) : jamais Resend, jamais la coquille
// transactionnelle. MIME construit ici (texte + HTML + pièces), signature
// profiles.email_signature en pied, In-Reply-To/References sur réponse.
//   { account_id, kind: 'new'|'reply'|'forward', to, cc?, bcc?, subject?, body_text,
//     thread_id?, in_reply_to_message_id?, attachments?: [{filename, mime_type, base64}], draft_id? }
// Gmail : messages.send (+ threadId) puis ingestion immédiate du message rendu.
// Graph : brouillon → send ; ligne locale provisoire `pending:<Message-ID>` rapprochée
//         par la synchro « Envoyés » (ingest.ts).
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'
import { loadVisibleAccount, providerConfigFromEnv } from '../_shared/mail/guard.ts'
import { getValidAccessToken } from '../_shared/mail/secrets.ts'
import { base64Encode, base64UrlEncode, buildMime, escapeHtml, makeMessageId, textToHtml } from '../_shared/mail/mime.ts'
import { gmailAttachment, gmailGetMessage, gmailSend, normalizeGmailMessage } from '../_shared/mail/gmail.ts'
import { graphSend } from '../_shared/mail/graph.ts'
import { ingestMessages, recomputeThread } from '../_shared/mail/ingest.ts'
import type { MailAddress, MailAccountRow, OutgoingMessage } from '../_shared/mail/types.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
}
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

const MAX_TOTAL_ATTACHMENT_BYTES = 20 * 1024 * 1024
const isAddr = (a: unknown): a is MailAddress => !!a && typeof a === 'object' && typeof (a as MailAddress).email === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((a as MailAddress).email)
const addrList = (v: unknown): MailAddress[] => (Array.isArray(v) ? v.filter(isAddr).map((a) => ({ name: typeof a.name === 'string' ? a.name : null, email: a.email.toLowerCase() })) : [])

interface OriginalRow {
  id: string; thread_id: string; provider_message_id: string; rfc822_message_id: string | null; in_reply_to: string | null
  from_name: string | null; from_email: string | null; reply_to: string | null; subject: string | null
  body_text: string | null; body_html: string | null; sent_at: string; to: MailAddress[]
}

function quoteHeader(o: OriginalRow, lang: string): string {
  const d = new Date(o.sent_at).toLocaleString(lang === 'de' ? 'de-CH' : lang === 'it' ? 'it-CH' : lang === 'en' ? 'en-GB' : 'fr-CH', { timeZone: 'Europe/Zurich', dateStyle: 'medium', timeStyle: 'short' })
  const who = o.from_name ? `${o.from_name} <${o.from_email}>` : (o.from_email ?? '')
  return ({ fr: `Le ${d}, ${who} a écrit :`, de: `Am ${d} schrieb ${who}:`, en: `On ${d}, ${who} wrote:`, it: `Il ${d}, ${who} ha scritto:` } as Record<string, string>)[lang] ?? `Le ${d}, ${who} a écrit :`
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  const auth = await requireAgentAuth(req, corsHeaders)
  if (auth instanceof Response) return auth
  const { user, profile, supabase: admin } = auth

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }
  const account = await loadVisibleAccount(admin, String(body.account_id ?? ''), { userId: user.id, agencyId: profile.agency_id })
  if (!account) return json({ error: 'not_found' }, 404)
  if (account.status !== 'active') return json({ error: 'account_not_active', status: account.status }, 409)
  const kind = body.kind === 'reply' || body.kind === 'forward' ? body.kind : 'new'
  const text = typeof body.body_text === 'string' ? body.body_text.trim() : ''
  let to = addrList(body.to)
  const cc = addrList(body.cc)
  const bcc = addrList(body.bcc)
  let subject = typeof body.subject === 'string' ? body.subject.trim() : ''
  const attachments = (Array.isArray(body.attachments) ? body.attachments : []) as { filename: string; mime_type: string; base64: string }[]
  if (attachments.reduce((n, a) => n + Math.ceil((a.base64?.length ?? 0) * 0.75), 0) > MAX_TOTAL_ATTACHMENT_BYTES) return json({ error: 'attachments_too_large' }, 413)

  // Original (réponse/transfert) — TOUJOURS relu par account_id : un id étranger rend 404.
  let original: OriginalRow | null = null
  if (kind !== 'new') {
    const { data } = await admin.from('mail_messages')
      .select('id, thread_id, provider_message_id, rfc822_message_id, in_reply_to, from_name, from_email, reply_to, subject, body_text, body_html, sent_at, to')
      .eq('id', String(body.in_reply_to_message_id ?? '')).eq('account_id', account.id).maybeSingle()
    if (!data) return json({ error: 'original_not_found' }, 404)
    original = data as OriginalRow
    if (kind === 'reply' && to.length === 0) to = [{ name: original.from_name, email: (original.reply_to ?? original.from_email ?? '').toLowerCase() }].filter(isAddr)
    if (!subject) subject = `${kind === 'reply' ? 'Re' : 'Fwd'}: ${(original.subject ?? '').replace(/^(re|fwd?|tr)\s*:\s*/i, '')}`
  }
  if (to.length === 0) return json({ error: 'recipient_required' }, 400)
  if (!subject && kind === 'new') return json({ error: 'subject_required' }, 400)

  // Signature + citation
  const { data: prof } = await admin.from('profiles').select('email_signature, language, full_name').eq('id', user.id).maybeSingle()
  const lang = (prof?.language as string | null) ?? 'fr'
  const signature = (prof?.email_signature as string | null)?.trim() ?? ''
  let fullText = signature ? `${text}\n\n-- \n${signature}` : text
  let fullHtml = textToHtml(fullText)
  if (original) {
    const qh = quoteHeader(original, lang)
    fullText += `\n\n${qh}\n${(original.body_text ?? '').split('\n').map((l) => `> ${l}`).join('\n')}`
    fullHtml += `<p style="margin-top:16px;color:#686868">${escapeHtml(qh)}</p><blockquote style="margin:0 0 0 8px;padding-left:12px;border-left:2px solid #cccccc">${original.body_html ?? textToHtml(original.body_text ?? '')}</blockquote>`
  }

  // Transfert Gmail : on rattache les pièces de l'original (Graph le fait seul via createForward).
  const cfg = providerConfigFromEnv((k) => Deno.env.get(k))
  const outAtts = attachments.map((a) => ({ filename: String(a.filename).slice(0, 200), mimeType: String(a.mime_type || 'application/octet-stream'), base64: String(a.base64) }))
  let token: string
  try { token = await getValidAccessToken(admin, account, account.provider === 'gmail' ? cfg.gmail : cfg.outlook) }
  catch (e) { return json({ error: 'provider_auth', detail: e instanceof Error ? e.message : String(e) }, 502) }

  if (kind === 'forward' && original && account.provider === 'gmail') {
    const { data: origAtts } = await admin.from('mail_attachments').select('provider_attachment_id, filename, mime_type').eq('message_id', original.id).eq('is_inline', false)
    for (const a of origAtts ?? []) {
      const bytes = await gmailAttachment(token, original.provider_message_id, a.provider_attachment_id)
      outAtts.push({ filename: a.filename, mimeType: a.mime_type, base64: base64Encode(bytes) })
    }
  }

  const messageId = makeMessageId(account.email.split('@')[1] ?? 'megga.ch')
  const outgoing: OutgoingMessage = {
    from: { name: account.display_name ?? (prof?.full_name as string | null) ?? null, email: account.email },
    to, cc, bcc, subject, text: fullText, html: fullHtml,
    inReplyTo: original?.rfc822_message_id ?? null,
    references: original ? [...(original.in_reply_to ? [original.in_reply_to] : []), ...(original.rfc822_message_id ? [original.rfc822_message_id] : [])] : [],
    messageId, attachments: outAtts,
  }

  let localMessageId: string | null = null
  let threadId: string | null = original?.thread_id ?? null
  try {
    if (account.provider === 'gmail') {
      const { data: th } = threadId ? await admin.from('mail_threads').select('provider_thread_id').eq('id', threadId).single() : { data: null }
      const sent = await gmailSend(token, base64UrlEncode(new TextEncoder().encode(buildMime(outgoing))), th?.provider_thread_id ?? null)
      const full = await gmailGetMessage(token, sent.id)
      await ingestMessages(admin, account, [normalizeGmailMessage(full, account.email)], { skipAudit: true })
      const { data: row } = await admin.from('mail_messages').select('id, thread_id').eq('account_id', account.id).eq('provider_message_id', sent.id).single()
      localMessageId = row?.id ?? null; threadId = row?.thread_id ?? threadId
    } else if (account.provider === 'outlook') {
      const mode = original ? { kind: kind as 'reply' | 'forward', providerMessageId: original.provider_message_id } : { kind: 'new' as const }
      await graphSend(token, { subject, html: fullHtml, to, cc, bcc, internetMessageId: messageId, attachments: outAtts }, mode)
      // Ligne provisoire : la synchro « Envoyés » la rapproche par Message-ID.
      if (!threadId) {
        const { data: t } = await admin.from('mail_threads').insert({
          account_id: account.id, agency_id: account.agency_id, provider_thread_id: `pending-thread:${messageId}`,
          subject, snippet: text.slice(0, 160), participants: to, from_name: outgoing.from.name, from_email: account.email,
          last_message_at: new Date().toISOString(), last_outbound_at: new Date().toISOString(), message_count: 0, is_read: true,
        }).select('id').single()
        threadId = t!.id
      }
      const { data: m } = await admin.from('mail_messages').insert({
        thread_id: threadId, account_id: account.id, agency_id: account.agency_id,
        provider_message_id: `pending:${messageId}`, rfc822_message_id: messageId, in_reply_to: outgoing.inReplyTo,
        direction: 'outbound', from_name: outgoing.from.name, from_email: account.email, to, cc, bcc,
        subject, snippet: text.slice(0, 160), body_text: fullText, body_html: fullHtml, sent_at: new Date().toISOString(),
        is_read: true, has_attachments: outAtts.length > 0,
      }).select('id').single()
      localMessageId = m?.id ?? null
      await admin.from('mail_threads').update({ last_message_at: new Date().toISOString(), last_outbound_at: new Date().toISOString(), snippet: text.slice(0, 160) }).eq('id', threadId)
      // Le compteur et les dates viennent des messages : la ligne provisoire compte déjà.
      await recomputeThread(admin, threadId)
    } else {
      return json({ error: 'provider_not_supported' }, 501)
    }
  } catch (e) {
    return json({ error: 'send_failed', detail: e instanceof Error ? e.message : String(e) }, 502)
  }

  // Audit avec l'acteur (l'ingestion a été appelée en skipAudit).
  const { data: th } = threadId ? await admin.from('mail_threads').select('contact_id').eq('id', threadId).single() : { data: null }
  if (th?.contact_id) {
    await admin.from('activity_events').insert({
      agency_id: account.agency_id, actor_id: user.id, actor_kind: 'user', action: 'email_sent', category: 'messaging', severity: 'info',
      entity_type: 'contact', entity_id: th.contact_id, object_label: subject,
      metadata: { thread_id: threadId, message_id: localMessageId, account_id: account.id, to: to.map((a) => a.email), kind },
    })
  }
  if (typeof body.draft_id === 'string') await admin.from('mail_drafts').delete().eq('id', body.draft_id).eq('author_id', user.id)
  return json({ ok: true, message_id: localMessageId, thread_id: threadId })
})
```

- [ ] **Step 2 : Déclarer, vérifier, commit**

`supabase/config.toml` :
```toml
[functions.mail-send]
verify_jwt = false
```
```bash
deno check supabase/functions/mail-send/index.ts
git add supabase/functions/mail-send/index.ts supabase/config.toml supabase/functions/_shared/mail/ingest.ts
git commit -m "feat(messagerie): edge mail-send (nouveau, réponse, transfert ; Gmail raw, Graph brouillon+send)"
```

---

### Task 1.14 : Edge `mail-attachment` (flux + classement au dossier)

**Files:**
- Create: `supabase/functions/mail-attachment/index.ts`
- Modify: `supabase/config.toml`

- [ ] **Step 1 : Écrire l'edge**

```ts
// supabase/functions/mail-attachment/index.ts
// GET  ?id=<mail_attachments.id>       → octets de la pièce, streamés depuis le fournisseur
//                                        (jamais d'URL publique ; content-type de la pièce).
// POST { action:'file', attachment_id, contact_id, document_type, name?, category? }
//                                      → copie dans le bucket `documents` + ligne `documents`
//                                        (contact_id, sha256), mail_attachments.document_id posé.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'
import { accountVisibleTo, providerConfigFromEnv } from '../_shared/mail/guard.ts'
import { getValidAccessToken } from '../_shared/mail/secrets.ts'
import { gmailAttachment } from '../_shared/mail/gmail.ts'
import { graphAttachmentBytes } from '../_shared/mail/graph.ts'
import type { MailAccountRow } from '../_shared/mail/types.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
}
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

const MAX_BYTES = 25 * 1024 * 1024
// Allowlist du bucket `documents` (migration 20260802140000) — la même liste, sinon l'upload échoue après téléchargement.
const DOC_MIME: Record<string, string> = {
  'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
  'application/msword': 'doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
}
const CATEGORY_BY_TYPE: Record<string, string> = { piece_identite: 'identity', justificatif_domicile: 'domicile', financement: 'financial', contrat: 'compliance', mandat: 'compliance' }

interface AttRow { id: string; message_id: string; account_id: string; agency_id: string; provider_attachment_id: string; filename: string; mime_type: string; size_bytes: number; document_id: string | null }

async function loadAttachment(admin: ReturnType<typeof import('https://esm.sh/@supabase/supabase-js@2').createClient>, id: string, ctx: { userId: string; agencyId: string }) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const { data: att } = await admin.from('mail_attachments').select('*').eq('id', id).maybeSingle()
  if (!att) return null
  const { data: account } = await admin.from('mail_accounts').select('*').eq('id', att.account_id).maybeSingle()
  if (!account || !accountVisibleTo(account as MailAccountRow, ctx)) return null
  const { data: msg } = await admin.from('mail_messages').select('provider_message_id').eq('id', att.message_id).single()
  return { att: att as AttRow, account: account as MailAccountRow, providerMessageId: msg!.provider_message_id as string }
}

async function fetchBytes(admin: Parameters<typeof loadAttachment>[0], a: NonNullable<Awaited<ReturnType<typeof loadAttachment>>>): Promise<Uint8Array> {
  const cfg = providerConfigFromEnv((k) => Deno.env.get(k))
  const token = await getValidAccessToken(admin, a.account, a.account.provider === 'gmail' ? cfg.gmail : cfg.outlook)
  if (a.account.provider === 'gmail') return gmailAttachment(token, a.providerMessageId, a.att.provider_attachment_id)
  if (a.account.provider === 'outlook') return graphAttachmentBytes(token, a.providerMessageId, a.att.provider_attachment_id)
  throw new Error('provider_not_supported')
}

const toBuffer = (b: Uint8Array): ArrayBuffer => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer
async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', toBuffer(bytes))
  return Array.from(new Uint8Array(d), (x) => x.toString(16).padStart(2, '0')).join('')
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const auth = await requireAgentAuth(req, corsHeaders)
  if (auth instanceof Response) return auth
  const { user, profile, supabase: admin } = auth
  const ctx = { userId: user.id, agencyId: profile.agency_id }

  if (req.method === 'GET') {
    const id = new URL(req.url).searchParams.get('id') ?? ''
    const a = await loadAttachment(admin, id, ctx)
    if (!a) return json({ error: 'not_found' }, 404)
    if (a.att.size_bytes > MAX_BYTES) return json({ error: 'too_large' }, 413)
    let bytes: Uint8Array
    try { bytes = await fetchBytes(admin, a) } catch (e) { return json({ error: 'provider_failed', detail: e instanceof Error ? e.message : String(e) }, 502) }
    const name = encodeURIComponent(a.att.filename).replace(/['()]/g, escape)
    return new Response(toBuffer(bytes), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': a.att.mime_type || 'application/octet-stream',
        'Content-Length': String(bytes.byteLength),
        'Content-Disposition': `inline; filename*=UTF-8''${name}`,
        'Cache-Control': 'private, max-age=300',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  }

  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }
  if (body.action !== 'file') return json({ error: 'unknown_action' }, 400)
  const a = await loadAttachment(admin, String(body.attachment_id ?? ''), ctx)
  if (!a) return json({ error: 'not_found' }, 404)
  const contactId = String(body.contact_id ?? '')
  const { data: contact } = await admin.from('contacts').select('id').eq('id', contactId).eq('agency_id', profile.agency_id).maybeSingle()
  if (!contact) return json({ error: 'contact_not_found' }, 404)
  const ext = DOC_MIME[a.att.mime_type]
  if (!ext) return json({ error: 'unsupported_type', mime: a.att.mime_type, allowed: Object.keys(DOC_MIME) }, 415)
  if (a.att.size_bytes > 20 * 1024 * 1024) return json({ error: 'too_large' }, 413)

  let bytes: Uint8Array
  try { bytes = await fetchBytes(admin, a) } catch (e) { return json({ error: 'provider_failed', detail: e instanceof Error ? e.message : String(e) }, 502) }
  const documentId = crypto.randomUUID()
  const storagePath = `${profile.agency_id}/${documentId}.${ext}`
  const { error: upErr } = await admin.storage.from('documents').upload(storagePath, toBuffer(bytes), { contentType: a.att.mime_type, upsert: false })
  if (upErr) return json({ error: 'upload_failed', detail: upErr.message }, 500)
  const docType = typeof body.document_type === 'string' && body.document_type ? body.document_type.slice(0, 40) : 'autre'
  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 160) : a.att.filename
  const { error: insErr } = await admin.from('documents').insert({
    id: documentId, agency_id: profile.agency_id, contact_id: contactId, name, type: docType,
    document_category: CATEGORY_BY_TYPE[docType] ?? 'other', storage_path: storagePath, size_bytes: bytes.byteLength,
    status: 'available', uploaded_by: user.id, sha256_hash: await sha256Hex(bytes),
  })
  if (insErr) {
    await admin.storage.from('documents').remove([storagePath])
    return json({ error: 'document_insert_failed', detail: insErr.message }, 500)
  }
  await admin.from('mail_attachments').update({ document_id: documentId }).eq('id', a.att.id)
  await admin.from('activity_events').insert({
    agency_id: profile.agency_id, actor_id: user.id, actor_kind: 'user', action: 'document_filed_from_email', category: 'doc', severity: 'info',
    entity_type: 'contact', entity_id: contactId, object_label: name,
    metadata: { document_id: documentId, attachment_id: a.att.id, message_id: a.att.message_id, document_type: docType },
  })
  return json({ ok: true, document_id: documentId, storage_path: storagePath })
})
```

- [ ] **Step 2 : Déclarer, vérifier, commit**

`supabase/config.toml` :
```toml
[functions.mail-attachment]
verify_jwt = false
```
```bash
deno check supabase/functions/mail-attachment/index.ts
git add supabase/functions/mail-attachment/index.ts supabase/config.toml
git commit -m "feat(messagerie): edge mail-attachment (flux authentifié, classement au dossier avec SHA-256)"
```

---

### Task 1.15 : Portes du lot + contrats HTTP des edges

**Files:**
- Create: `tests/backend/mail-edges.spec.ts`
- Modify: `src/lib/edgeFunctionRoster.ts` (régénéré), `src/types/database.ts` (régénéré)

- [ ] **Step 1 : Roster, garde d'auth, idempotence**

```bash
node scripts/check-edge-roster.mjs --write
npm run lint:roster
npm run lint:edge-auth
npm run lint:migrations
```
Attendu : roster régénéré avec `mail-actions`, `mail-attachment`, `mail-oauth`, `mail-send`, `mail-sync` ; `lint:edge-auth` vert (chaque `index.ts` contient `requireAgentAuth` ou `isServiceSecret`) ; migrations vertes.

- [ ] **Step 2 : Types**

```bash
supabase db reset
npx supabase gen types typescript --local > src/types/database.ts
npm run build
```
Attendu : build vert. ⚠ `npm run lint:types-freshness` compare au projet **distant** ; il ne passera qu'après déploiement de la migration (merge). Le noter dans la PR, ne pas caster le client pour compiler.

- [ ] **Step 3 : Spec des contrats HTTP**

```ts
// tests/backend/mail-edges.spec.ts
// Contrats HTTP des cinq edges de la Messagerie contre le runtime edge LOCAL.
// On asserte le CORPS des refus (pas seulement le statut) : la passerelle locale
// répond aussi 401, avec un autre message (mémoire project_activity_events_emission_rules).
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'
import { waitForEdgeWorker } from './helpers/edge'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'
const SERVICE_JWT = process.env.SUPABASE_TEST_SERVICE_ROLE_JWT ?? process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ?? ''
const FN = (name: string) => `${URL}/functions/v1/${name}`
const NAMES = ['mail-oauth', 'mail-sync', 'mail-actions', 'mail-send', 'mail-attachment']

describe.skipIf(!HAS_KEYS)('Messagerie — contrats HTTP des edges', () => {
  let s: TwoAgenciesSetup
  let jwtA: string
  let boxBId: string

  const call = async (name: string, body: unknown, jwt?: string, method = 'POST') => {
    const res = await fetch(FN(name), { method, headers: { 'Content-Type': 'application/json', ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) }, body: method === 'GET' ? undefined : JSON.stringify(body) })
    const text = await res.text()
    let json: Record<string, unknown> = {}
    try { json = JSON.parse(text) } catch { json = { raw: text } }
    return { status: res.status, json, headers: res.headers }
  }

  beforeAll(async () => {
    s = await setupTwoAgencies()
    const { data } = await s.clientA.auth.getSession()
    jwtA = data.session!.access_token
    const service = serviceRoleClient()
    const { data: b } = await service.from('mail_accounts').insert({ agency_id: s.agencyBId, owner_id: s.agentBId, provider: 'gmail', email: `b-${s.stamp}@b.test`, visibility: 'agency' }).select('id').single()
    boxBId = b!.id
    await Promise.all(NAMES.map((n) => waitForEdgeWorker(FN(n))))
  }, 180_000)

  afterAll(async () => {
    await serviceRoleClient().from('mail_accounts').delete().eq('id', boxBId)
    await s.cleanup()
  })

  it('sans jeton : chaque edge agent refuse AVANT toute configuration', async () => {
    for (const n of ['mail-oauth', 'mail-actions', 'mail-send']) {
      const r = await call(n, { action: 'start' })
      expect(r.status, n).toBe(401)
      expect(String(r.json.error), n).toMatch(/Authentication required/i)
    }
    const g = await call('mail-attachment', null, undefined, 'GET')
    expect(g.status).toBe(401)
  })

  it('mail-oauth start : URL Google + state, ou 503 lisible si le client n est pas configuré en local', async () => {
    const r = await call('mail-oauth', { action: 'start', provider: 'gmail', origin: 'http://localhost:5173' }, jwtA)
    if (r.status === 503) { expect(r.json.error).toBe('provider_not_configured'); return }
    expect(r.status).toBe(200)
    expect(String(r.json.url)).toContain('https://accounts.google.com/o/oauth2/v2/auth?')
    expect(String(r.json.url)).toContain('gmail.modify')
    expect(String(r.json.state)).toMatch(/^[0-9a-f]{64}$/)
  })

  it('mail-oauth : origine hors liste → 400 ; state inconnu → 403', async () => {
    const bad = await call('mail-oauth', { action: 'start', provider: 'gmail', origin: 'https://evil.example' }, jwtA)
    expect(bad.status).toBe(400)
    const ex = await call('mail-oauth', { action: 'exchange', code: 'x', state: 'a'.repeat(64) }, jwtA)
    expect(ex.status).toBe(403)
    expect(ex.json.error).toBe('invalid_state')
  })

  it('mail-actions / mail-send / mail-oauth disconnect : un compte d une autre agence est introuvable (404), jamais 403', async () => {
    expect((await call('mail-actions', { action: 'mark_read', account_id: boxBId, thread_id: 'x' }, jwtA)).status).toBe(404)
    expect((await call('mail-send', { account_id: boxBId, kind: 'new', to: [{ email: 'a@b.ch' }], subject: 's', body_text: 'b' }, jwtA)).status).toBe(404)
    expect((await call('mail-oauth', { action: 'disconnect', account_id: boxBId }, jwtA)).status).toBe(404)
  })

  it('mail-attachment GET inconnu → 404 ; POST sans action → 400', async () => {
    const g = await fetch(`${FN('mail-attachment')}?id=00000000-0000-0000-0000-000000000000`, { headers: { Authorization: `Bearer ${jwtA}` } })
    expect(g.status).toBe(404)
    expect((await call('mail-attachment', { action: 'nope' }, jwtA)).status).toBe(400)
  })

  it('mail-sync : sans secret 401 ; avec la clé service, balayage vide OK et verrou relâché', async () => {
    expect((await call('mail-sync', {})).status).toBe(401)
    const r = await call('mail-sync', {}, SERVICE_JWT)
    expect(r.status).toBe(200)
    expect(r.json.ok).toBe(true)
    const again = await call('mail-sync', {}, SERVICE_JWT)
    expect(again.json.skipped, 'le verrou doit être relâché après un balayage').toBeUndefined()
  })
})
```

```bash
supabase functions serve --no-verify-jwt --env-file supabase/.env.local
npm run test:backend -- tests/backend/mail-edges.spec.ts tests/backend/mail-rls.spec.ts
```
Attendu : 15 tests verts (6 + 9).

- [ ] **Step 4 : Toutes les portes, puis commit**

```bash
npm run build && npm run lint && npm run test:unit && npm run lint:deadcode && npm run lint:email-shell
git add -A
git commit -m "test(messagerie): contrats HTTP des edges, roster, types régénérés"
```

- [ ] **Step 5 : Épreuve de bout en bout (§7.4 du maître, points 1-2 et 8) — SANS UI**

Après merge (les edges se déploient seules), depuis la console du navigateur sur `app.megga.ch`, connecté :
```js
const { data } = await supabase.functions.invoke('mail-oauth', { body: { action: 'start', provider: 'gmail', origin: location.origin } })
window.open(data.url, 'megga-mail-oauth', 'popup,width=520,height=680')
// dans la pop-up, après consentement, l'URL est /oauth/mail/callback?code=…&state=… (page 404 tant que le lot 2 n'est pas là : copier code+state)
await supabase.functions.invoke('mail-oauth', { body: { action: 'exchange', code: '<code>', state: '<state>' } })
```
Attendu : `{ account }` ; deux minutes plus tard `select count(*) from mail_threads` > 0 pour ce compte, `last_sync_at` posé, `last_error` nul. Puis `disconnect` : 0 fil, secret Vault absent (`select count(*) from vault.secrets where name like 'mail:%'` via le SQL editor du dashboard).

Consigner le résultat (compte de fils, durée de la première synchro) dans la PR.
