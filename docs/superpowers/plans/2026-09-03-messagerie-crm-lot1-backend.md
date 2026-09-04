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

> ### Deuxième passe de revue adverse — 04.09.2026 (les 18 défauts « importants »)
>
> Ce document porte le code **VERBATIM** : laissé tel quel, il aurait réintroduit chaque
> défaut dans les six lots suivants qui le prennent pour modèle. Les blocs sont donc
> re-synchronisés sur le code livré, et chaque tâche touchée porte en tête l'encadré de ce
> qui a changé et POURQUOI. Quatre familles, quatre commits :
>
> | Famille | Où | Ce qui était faux |
> |---|---|---|
> | Sécurité | 1.9 · 1.14 (+1.3) | la boîte d'un agent parti continuait d'alimenter son ancienne agence ; le type MIME d'une pièce, écrit par l'expéditeur, était servi `inline` |
> | Justesse fournisseur | 1.7 · 1.8 · 1.13 | une propriété absente du delta Graph lue comme `false` ; les pièces d'une réponse Outlook dans un PATCH ; `is_archived` jamais recalculé quand l'agent a le dernier mot ; un transfert Gmail avec le `threadId` de l'original |
> | Panne muette | 1.8 · 1.10 · 1.13 | un envoi ACCEPTÉ par le fournisseur annoncé « échoué » (donc renvoyé, donc reçu deux fois) ; une déconnexion qui laisse le jeton vivant ; deux rattachements de contact qui échouent en répondant `ok` |
> | Tests creux | 1.15 | quatre `it()` sur sept ne pouvaient pas rougir, dont celui qui devait garder le 404 inter-agences |
>
> ⚠ **Sept défauts avaient déjà été fermés par la passe « bloquante »** (d7a46911,
> 601a2a5b, 3323c7c7, 52a57dc6) : l'injection PostgREST dans `.or()`,
> `applyRemoteChanges` en échec ouvert, le `knownRows` non vérifié de `syncGraph`, et les
> ids d'attachement après un déplacement Graph — que `Prefer: IdType="ImmutableId"` rend
> sans objet.

> ### Troisième passe de revue adverse — 04.09.2026 (les 24 défauts « mineurs »)
>
> « Mineur » est le rang que la revue leur a donné, pas une dispense. Trois d'entre eux
> étaient des défauts de SÉCURITÉ ; deux sont **délibérément laissés**, avec leur raison
> écrite dans le code. Les blocs de ce document sont re-synchronisés une troisième fois.
>
> | Famille | Où | Ce qui était faux |
> |---|---|---|
> | Sécurité | 1.6 · 1.10 · 1.13 | le `mime_type` d'une pièce atteignait l'en-tête MIME SANS nettoyage, quand le `filename` voisin l'était depuis toujours (`text/plain\r\nX-Injected: yes` forge un en-tête de partie) ; le `state` OAuth était consommé par un contrôle-puis-agit (deux échanges concurrents passaient) ; une RÉAUTORISATION réécrivait `owner_id` et `visibility`, donc quiconque a le mot de passe d'une boîte partagée la prenait et la cachait à toute l'agence ; la branche admin de `disconnect` était inatteignable pour les boîtes qui la motivent |
> | Justesse fournisseur | 1.7 · 1.8 · 1.12 | `untrash` ajoutait INBOX aux copies « Envoyés » (l'agent retrouvait ses réponses dans sa Réception) ; un 404 sur le dossier Archive briquait la synchro d'une boîte Outlook ; les dates du fil se comparaient en CHAÎNES entre deux rendus ISO différents |
> | Ordonnancement | 1.9 · 1.11 · 1.12 | budget vérifié seulement en TÊTE de page (50 `messages.get` séquentiels de dépassement) ; aucun bail par compte sur les quatre chemins de synchro ; une passe initiale inachevée repassait en tête de file à CHAQUE tick et affamait toutes les autres boîtes |
> | Trace | 1.8 · 1.13 · 1.14 | trois écritures `activity_events` sur quatre ignoraient leur résultat, deux sans même un journal ; `msg!` sur une lecture non contrôlée rendait un 500 sans corps ; le marquage `document_id` — ce qui empêche de classer deux fois — n'était pas vérifié |
> | Documentation | 1.10-1.15 · maître | « streamés » (le maître avait déjà corrigé la phrase la veille) ; « pages de 100 » et un `sync_cursor.page_token` inexistant ; deux comptes de tests faux ; la note « région GÉNÉRÉE », copiée dans cinq tâches avec des numéros de ligne déjà périmés |
>
> **Deux défauts LAISSÉS, et c'est écrit sur place** — un mauvais correctif coûte plus que
> pas de correctif :
> 1. **`References` ne s'accumule pas** (mail-send). La RFC 5322 §3.6.4 veut « References du
>    parent + son Message-ID » ; on n'en pose que deux. Réparer demande une colonne
>    `references text[]`, son écriture à l'ingestion, puis la concaténation — un changement de
>    schéma pour un effet BORNÉ : le lien au parent immédiat est correct, donc Gmail, Outlook
>    et Apple Mail enfilent la conversation ; se dégrade seulement pour le participant ajouté
>    en cours de fil et pour les archives qui rebâtissent l'arbre par `References` seul. À
>    reprendre au lot 2.
> 2. **Le plafond de 5 000 messages du delta Graph sous `$filter`** — limite DOCUMENTÉE du
>    fournisseur, pas un défaut d'ici. Le contourner veut dire retirer le `$filter` et
>    parcourir la boîte ENTIÈRE pour n'en garder que 90 jours, sous un budget de 20 s par
>    compte. Le plafond est le moindre mal ; ce qui manque est de le DIRE dans l'UI (lot 2).
>
> ⚠ **Un point de la revue est écarté par mesure, pas par choix** : « un POST anonyme sur
> `mail-sync` coûte une lecture d'`app_config` ». `isServiceSecret` contrôle l'en-tête
> `Authorization` (require-service-secret.ts:24) AVANT d'interroger la base : sans en-tête,
> aucun aller-retour. Seul le plafond de corps manquait, il est posé.

**Tech Stack:** Postgres **17** en local et en CI (`supabase/config.toml` `major_version = 17` — mesuré le 03.09.2026 ; le plan annonçait 15), RLS, Vault, pg_cron, pg_net ; Deno (edge) ; Vitest (unit + backend contre `supabase start`).

---

## Règles du lot (elles viennent de pièges déjà payés)

1. ⛔ **`vitest.config.ts` liste EN DUR les specs de `_shared`** (`include: [...]`). Chaque `supabase/functions/_shared/mail/*.test.ts` doit y être ajouté, sinon il ne tourne nulle part. Contrôle : le compteur de tests de `npm run test:unit` monte.
2. ⛔ **Les modules `_shared/mail/*.ts` s'importent sous Node** (jsdom, pas de `Deno`). Donc : `import type` seulement pour `SupabaseClient` ; jamais `Deno.env` au corps du module ; les clients et la config passent en paramètres ; `fetch` reçu en paramètre (`deps.fetch ?? globalThis.fetch`) pour être mocké.
3. ⛔ **`deno check` refuse `Uint8Array<ArrayBufferLike>` comme `BufferSource`** : rendre des `ArrayBuffer` (`bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)`).
4. ⛔ **Toute edge est publique** (`--no-verify-jwt`) : la garde (`requireAgentAuth` / `isServiceSecret`) vient **avant** toute lecture de configuration, et sort par `return`, jamais par `throw`.
5. ⛔ **Service-role = pas de RLS** : chaque `account_id` venu du corps se revérifie contre `auth` (`ownerOrAgencyMember(account, ctx)`), sinon IDOR.
6. **Migration idempotente** (`npm run lint:migrations`) ; un seul fichier pour le lot, horodaté `20260903120000`.
7. `activity_events` : `severity` ∈ `info|warn|critical`, `category='messaging'`, `actor_kind='system'` ⇒ `actor_id` NULL. ⚠ Et **`entity_id` DOIT porter le `contact_id`** : `useContactTimeline` ne filtre que sur `entity_id` (son commentaire ligne 27 promet un « OU metadata », qui n'est pas implémenté) — un événement qui ne nomme le contact que dans `metadata` n'apparaît nulle part.
8. ⚠ **`supabase/functions/_shared/mail/` est le PREMIER dossier imbriqué** de `supabase/functions/` (mesuré le 03.09.2026 : `find … -mindepth 2 -type d` ne rend rien). Inoffensif pour `deno check` (son `find` est récursif), pour `deploy.yml` (il n'itère que `supabase/functions/*/` et exige un `index.ts`) et pour le roster (il exclut `_shared`). Mais **vitest ne le voit pas** : cf. règle 1.
9. ⛔ **Ne jamais écrire un bloc `[functions.*]` à la main dans `supabase/config.toml`** : la région entre les marqueurs `# ── GÉNÉRÉ par scripts/check-edge-roster.mjs — début ── / — fin ──` est générée et comparée texte pour texte. `node scripts/check-edge-roster.mjs --write` (cf. tâches 1.10-1.14). ⚠ Cette règle a porté « les lignes 482→700 » jusqu'au 04.09.2026 : elles étaient déjà 494→727 — les marqueurs, eux, ne bougent pas.
10. **Le nom de fichier de la migration doit valoir le jour du MERGE.** `deploy.yml:220` n'applique une migration que si `stamp_date >= TODAY` (UTC) et, plus bas, se contente d'un `::warning` pour celles qu'il saute : une migration datée du 03.09 fusionnée le 04.09 **ne partirait jamais en production**, toutes portes au vert. Re-dater par `git mv` avant de fusionner.

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

> ⚠ **Revue adverse du 04.09.2026 — une SECONDE migration.** La revue a trouvé que
> `status = 'error'`, pourtant autorisé par le CHECK de ce fichier, n'était écrit par
> AUCUN chemin de code : seule la reconnexion sortait une boîte du balayage, et les cinq
> autres façons de mourir (403 de quota, pointeur Vault orphelin, erreur d'ingestion,
> refus Graph, ligne `imap`) la laissaient `active` à réessayer toutes les 10 minutes,
> pour toujours. Ajouté : `supabase/migrations/20260904000000_mail_sync_failures.sql`
> (colonne `sync_failures`, contrainte, grant de colonne). ⛔ **Ce fichier-ci n'a PAS
> été touché** — il est relu et committé, et la CI le rejoue.

**Files:**
- Create: `supabase/migrations/20260903120000_mail_module.sql`
- Create (04.09.2026, revue adverse) : `supabase/migrations/20260904000000_mail_sync_failures.sql`

- [x] **Step 1 : Écrire la migration**

```sql
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
```

- [x] **Step 1 bis : la migration du compteur d'échecs (ajoutée le 04.09.2026, revue adverse)**

```sql
-- ============================================================================
-- Messagerie CRM — compteur d'échecs consécutifs de synchronisation.
--
-- POURQUOI. `mail_accounts.status` autorise 'error' depuis le socle
-- (20260903120000_mail_module.sql:97) mais AUCUN chemin de code ne l'écrivait :
-- seule la reconnexion (`reauth_required`) sortait une boîte du balayage. Les
-- cinq autres façons de mourir — 403 Gmail (scope réduit, quota, projet
-- suspendu), 403/429 Graph, pointeur Vault orphelin (`no_secret`), erreur
-- d'ingestion, ligne `imap` non gérée par ce build — écrivaient `last_error` et
-- repartaient pour 10 minutes, indéfiniment. Or `last_error` n'est lu par
-- personne (le lot 2 n'existe pas) : une boîte morte était rigoureusement
-- indiscernable d'une boîte saine sans courrier neuf, tout en brûlant un des 25
-- créneaux du balayage toutes les 10 minutes.
--
-- Le compteur donne à `status` de quoi le dire : `_shared/mail/sync.ts`
-- l'incrémente à chaque échec, le remet à 0 dès qu'une passe aboutit, élargit le
-- backoff en proportion, et bascule `status = 'error'` au 5e échec d'affilée.
-- ⚠ Pas de verdict sur le seul code HTTP : le 403 de Gmail couvre aussi
-- `rateLimitExceeded`, transitoire — un état terminal au premier 403 éteindrait
-- une boîte saine pendant un pic de quota.
--
-- IDEMPOTENT : la CI rejoue toute migration dont le préfixe de date est >= au
-- jour UTC courant (backend.yml « Rejouer les migrations du jour »), et
-- deploy.yml en fait autant à chaque push. `add column if not exists` ; et pour
-- la contrainte, la paire `drop … if exists` PUIS `add` — un bloc `do $$` ne rend
-- rien rejouable (un second `add constraint` lève 42710 dedans comme dehors) et
-- check-migration-idempotence.mjs blanchit les régions dollar-quotées avant de
-- scanner, donc il ne verrait rien.
-- ============================================================================

alter table public.mail_accounts
  add column if not exists sync_failures integer not null default 0;

alter table public.mail_accounts drop constraint if exists mail_accounts_sync_failures_chk;
alter table public.mail_accounts add constraint mail_accounts_sync_failures_chk
  check (sync_failures >= 0);

-- Le SELECT de `mail_accounts` est accordé COLONNE PAR COLONNE (le socle refuse
-- un SELECT de table, qui exposerait `sync_cursor`, `imap_config` et
-- `vault_secret_id`). Sans cette ligne, le lot 2 pourrait afficher `status` sans
-- jamais pouvoir dire depuis combien de passes la boîte échoue.
grant select (sync_failures) on public.mail_accounts to authenticated;

comment on column public.mail_accounts.sync_failures is
  'Échecs de synchronisation consécutifs ; remis à 0 par une passe réussie. Au 5e, _shared/mail/sync.ts bascule status=''error'' et la boîte quitte le balayage.';
```

- [x] **Step 2 : Vérifier l'idempotence et l'appliquer en local** (les deux dernières
  commandes n'ont PAS tourné : aucun runtime de conteneur sur cette machine — ni docker
  ni podman — donc pas de `supabase start`. Remplacées par une analyse syntaxique des
  corps `language sql` avec le vrai analyseur PostgreSQL (libpg-query) et par un contrôle
  statique des invariants d'idempotence ; la preuve reste la CI, qui rejoue la migration
  du jour contre une vraie base.)

```bash
npm run lint:migrations
supabase start
supabase db reset
```
Attendu : `lint:migrations` sans faute ; `db reset` termine sans erreur (la clause pg_cron est ignorée avec un NOTICE en local).

- [x] **Step 3 : Sonder ce que la base a réellement créé** (sondage remplacé par un
  décompte statique sur le fichier, faute de conteneur : 11 fonctions `mail_*` créées,
  et `search_text` déclarée `generated always as (…) stored`.)

⚠ `psql` n'est PAS sur le PATH de la machine de développement, et le dépôt évite
délibérément d'en dépendre : `tests/backend/helpers/local-sql.ts` passe par le
conteneur. Même chemin ici (le nom vient du `project_id` de `supabase/config.toml`) :

```bash
CONT=$(docker ps --filter name=supabase_db_ --format '{{.Names}}' | head -1)
docker exec -i "$CONT" psql -U postgres -d postgres -c "\d public.mail_threads" | head -40
docker exec -i "$CONT" psql -U postgres -d postgres -c "select proname from pg_proc where proname like 'mail_%' order by 1"
```
Attendu : la colonne `search_text` est `generated always as … stored` ; **11 fonctions
`mail_*`** — 4 ponts Vault, `mail_touch_updated_at`, `mail_account_visible`,
`mail_list_threads`, `mail_unread_counts`, `mail_folder_counts`, `mail_search_contacts`,
`mail_match_contact_by_emails`. (Le plan annonçait « 9 » là où son énumération en donnait
10 ; le rattachement par adresse en ajoute une onzième.)

- [x] **Step 4 : Commit**

```bash
git add supabase/migrations/20260903120000_mail_module.sql
git commit -m "feat(messagerie): socle SQL — comptes, fils, messages, Vault, RLS, RPC, cron"
```

---

### Task 1.2 : Spec backend RLS + RPC + Vault

**Files:**
- Create: `tests/backend/mail-rls.spec.ts`

- [x] **Step 1 : Écrire le spec (il doit rougir si une policy manque)** (écrit, plus
  QUATRE ajouts issus de la revue de sécurité de la task 1.1 — 15 `it()` au total au lieu
  des 9 ci-dessous : la fuite d'offboarding que ferme le ET conjoint de
  `mail_account_visible`, le super-admin qui ne lit aucun message, les trois WITH CHECK
  resserrés, et l'aller-retour Vault complet — `mail_secret_update` n'ayant aucun
  précédent au dépôt, rien d'autre ne l'éprouvera.)

```ts
// RLS de la Messagerie : visibilité owner/agency, isolation inter-agences, Vault
// inaccessible aux clients, RPC de liste. Tourne contre `supabase start`
// (SUPABASE_TEST_*), jamais la prod. skipIf sans clés.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { anonClient, serviceRoleClient } from './helpers/supabase'

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
  let labelBId: string        // libellé de l'agence B — cible du WITH CHECK de mail_threads
  let contactAId: string      // contact de l'agence A — cas passant des alias
  let contactBId: string      // contact de l'agence B — cible du WITH CHECK des alias
  let messageOwnerId: string  // message de la boîte perso : super-admin ET offboarding
  let superAdminId: string
  let superClient: SupabaseClient

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
  const mkContact = async (agencyId: string, firstName: string, lastName: string, email: string) => {
    const { data, error } = await service.from('contacts').insert({
      agency_id: agencyId, first_name: firstName, last_name: lastName, email, type: 'buyer',
    }).select('id').single()
    if (error) throw new Error(`contacts ${email}: ${error.message}`)
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

    // Un message dans la boîte PERSO : c'est le corps du courriel, la donnée que le
    // super-admin ne doit pas lire et que l'ex-membre doit perdre en partant.
    const { data: msg, error: mErr } = await service.from('mail_messages').insert({
      thread_id: threadOwnerId, account_id: ownerBoxId, agency_id: s.agencyAId,
      provider_message_id: `m-perso-${s.stamp}`, direction: 'inbound',
      from_name: 'Alice Martin', from_email: 'alice@example.ch',
      subject: 'Perso A', snippet: 'extrait', body_text: 'corps confidentiel',
      sent_at: new Date().toISOString(),
    }).select('id').single()
    if (mErr) throw new Error(`mail_messages: ${mErr.message}`)
    messageOwnerId = msg.id as string

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

    // Super-admin : agency_id NULL, domaine allowlisté par setupTwoAgencies
    // (app_config.super_admin_test_domain) — c'est ce que lit is_super_admin().
    const emailSu = `mail-super-${s.stamp}@megga-test.local`
    const { data: su, error: suErr } = await service.auth.admin.createUser({
      email: emailSu, password: PASSWORD, email_confirm: true,
      user_metadata: { full_name: 'Super Mail', role: 'agent' },
    })
    if (suErr) throw new Error(suErr.message)
    superAdminId = su!.user!.id
    const { error: spErr } = await service.from('profiles').upsert(
      { id: superAdminId, email: emailSu, full_name: 'Super Mail', role: 'super_admin', agency_id: null },
      { onConflict: 'id' },
    )
    if (spErr) throw new Error(spErr.message)
    superClient = anonClient()
    const { error: ssErr } = await superClient.auth.signInWithPassword({ email: emailSu, password: PASSWORD })
    if (ssErr) throw new Error(ssErr.message)

    const { data: lab, error: lErr } = await s.clientA.from('mail_labels')
      .insert({ agency_id: s.agencyAId, name: `À traiter ${s.stamp}`, color: '#fe566b' }).select('id').single()
    if (lErr) throw new Error(lErr.message)
    labelAId = lab.id

    const { data: labB, error: lbErr } = await service.from('mail_labels')
      .insert({ agency_id: s.agencyBId, name: `Chez B ${s.stamp}`, color: '#00aa55' }).select('id').single()
    if (lbErr) throw new Error(lbErr.message)
    labelBId = labB.id as string

    contactAId = await mkContact(s.agencyAId, 'Paul', 'Dumont', `paul-${s.stamp}@ex.ch`)
    contactBId = await mkContact(s.agencyBId, 'Bea', 'Berger', `bea-${s.stamp}@ex.ch`)
  }, 60_000)

  afterAll(async () => {
    await service.from('mail_accounts').delete().in('id', [ownerBoxId, sharedBoxId, boxBId])
    await service.from('mail_labels').delete().in('id', [labelAId, labelBId])
    await service.from('contacts').delete().in('id', [contactAId, contactBId])
    if (agentA2Id) await service.auth.admin.deleteUser(agentA2Id)
    if (superAdminId) await service.auth.admin.deleteUser(superAdminId)
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
    const emailKo = `refus-compte-${s.stamp}@y.test`
    const { error: e2 } = await s.clientA.from('mail_accounts')
      .insert({ agency_id: s.agencyAId, owner_id: s.agentAId, provider: 'gmail', email: emailKo })
    expect(e2).not.toBeNull()
    // ⚠ MÊME RÈGLE QU'AUX BROUILLONS ET AUX ALIAS PLUS BAS : une erreur non nulle ne
    // prouve pas qu'aucune ligne n'a été écrite — PostgREST sait répondre 201 avec un
    // corps vide sur certaines formes de requête. Ce fichier appliquait la relecture
    // service-role aux deux autres refus et pas à celui-ci, qui est pourtant le plus
    // lourd : une ligne `mail_accounts` écrite par un client est un compte de courrier
    // fabriqué de toutes pièces.
    const { data: resteCompte } = await service.from('mail_accounts').select('id').eq('email', emailKo)
    expect(resteCompte ?? []).toEqual([])
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

  // AJOUT — un refus ne prouve pas qu'un pont FONCTIONNE. `vault.secrets` compte 0 ligne
  // en production : le patron esign_secret_* recopié ici n'a jamais tourné pour de vrai,
  // et `mail_secret_update` n'a AUCUN précédent au dépôt (esign n'a que store/read/delete,
  // et `vault.update_secret` n'est appelée nulle part). Rien d'autre ne l'éprouvera jamais.
  it('le service-role fait l aller-retour complet dans le Vault', async () => {
    const nom = `mail:test:${s.stamp}`
    const avant = '{"a":1}'
    const apres = '{"a":2}'

    const store = await service.rpc('mail_secret_store', { p_secret: avant, p_name: nom })
    expect(store.error).toBeNull()
    expect(String(store.data)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    const secretId = store.data as string

    try {
      const lu = await service.rpc('mail_secret_read', { p_id: secretId })
      expect(lu.error).toBeNull()
      expect(String(lu.data)).toBe(avant)

      const maj = await service.rpc('mail_secret_update', { p_id: secretId, p_secret: apres })
      expect(maj.error).toBeNull()
      const relu = await service.rpc('mail_secret_read', { p_id: secretId })
      expect(String(relu.data)).toBe(apres)
    } finally {
      const del = await service.rpc('mail_secret_delete', { p_id: secretId })
      expect(del.error).toBeNull()
    }
    const disparu = await service.rpc('mail_secret_read', { p_id: secretId })
    expect(disparu.error).toBeNull()
    expect(disparu.data).toBeNull()
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
    // ⚠ `error` EST asserté : sans lui, un `grant execute` révoqué sur
    // `mail_list_threads` satisferait cette isolation — la RPC échouerait, `data` serait
    // null, et le test verrait le vide qu'il attend. Il ne tenait que par le contrôle
    // d'erreur du cas passant, quinze lignes plus haut, dans le même `it()`.
    const foreign = await s.clientB.rpc('mail_list_threads', { p_account_id: sharedBoxId, p_folder: 'in' })
    expect(foreign.error).toBeNull()
    expect(foreign.data ?? []).toEqual([])
  })

  it('mail_unread_counts et mail_folder_counts', async () => {
    // ⚠ Le libellé est posé ICI et non hérité du test précédent : `label_counts` dépendait
    // de l'ordre de DÉCLARATION des `it()`, un couplage que rien n'écrivait et que le
    // premier réordonnancement — ou un `--shard` — aurait cassé sans que la cause se voie.
    const { error: eLabel } = await s.clientA.from('mail_threads')
      .update({ label_id: labelAId }).eq('id', threadSharedId)
    expect(eLabel).toBeNull()

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

  // AJOUT — le plan maître (§7.2) promet que le super-admin ne lit AUCUN corps de
  // courriel. Aucune policy `is_super_admin()` n'existe sur mail_messages, et son
  // agency_id vaut NULL : la propriété tient par un `=` avec NULL, ce qui est exactement
  // le genre de garantie qui se casse à la première policy « de confort » ajoutée plus tard.
  it('un super-admin ne lit aucun message', async () => {
    const visible = await s.clientA.from('mail_messages').select('id').eq('id', messageOwnerId)
    expect((visible.data ?? []).map((r) => r.id)).toEqual([messageOwnerId])

    // ⛔ TÉMOIN POSITIF D'ABORD. Une lecture vide se produit aussi bien parce que la
    // policy tient que parce que la session est morte (jeton expiré, connexion ratée
    // avalée) — et « vide pour une raison qui n'est pas la bonne » est exactement la
    // forme de test que cette revue traque. Le témoin choisi prouve les DEUX prémisses en
    // une lecture : `super_admin_read_all_profiles` (USING `is_super_admin()`) est la
    // seule policy qui rende à cette session le profil d'un agent d'une agence à laquelle
    // elle n'appartient pas. Non vide ⇒ la session vit ET `is_super_admin()` répond vrai.
    // C'est bien un super-admin PUISSANT qui, ci-dessous, ne lit aucun courrier.
    const temoin = await superClient.from('profiles').select('id').eq('id', s.agentAId)
    expect(temoin.error, 'la session super-admin ne lit RIEN — le vide ci-dessous ne prouverait rien').toBeNull()
    expect((temoin.data ?? []).map((r) => r.id), 'is_super_admin() ne répond pas vrai pour cette session').toEqual([s.agentAId])

    const { data: rien, error } = await superClient.from('mail_messages').select('id')
    expect(error).toBeNull()
    expect(rien ?? []).toEqual([])
  })

  // AJOUT — les trois WITH CHECK resserrés à la revue de la task 1.1. Chacun refuse une
  // écriture INTER-AGENCES que la seule clé étrangère laisserait passer.
  it('un brouillon estampillé d une autre agence est refusé', async () => {
    const sujetOk = `brouillon-ok-${s.stamp}`
    const sujetKo = `brouillon-refus-${s.stamp}`

    // Cas passant d'abord : sans lui, un refus ne prouverait pas que le chemin d'écriture
    // existe — un brouillon refusé pour un motif quelconque passerait pour une preuve.
    const ok = await s.clientA.from('mail_drafts').insert({
      account_id: sharedBoxId, agency_id: s.agencyAId, author_id: s.agentAId, subject: sujetOk,
    }).select('id').single()
    expect(ok.error).toBeNull()
    await s.clientA.from('mail_drafts').delete().eq('id', ok.data!.id)

    const { error } = await s.clientA.from('mail_drafts').insert({
      account_id: sharedBoxId, agency_id: s.agencyBId, author_id: s.agentAId, subject: sujetKo,
    })
    expect(error).not.toBeNull()
    // ⚠ L'erreur ne suffit pas : PostgREST sait répondre 201 avec un corps vide sur
    // certaines formes de requête. On relit avec le service-role, hors RLS.
    const { data: reste } = await service.from('mail_drafts').select('id').eq('subject', sujetKo)
    expect(reste ?? []).toEqual([])
  })

  it('un libellé d une autre agence ne peut pas être posé sur un fil', async () => {
    const ok = await s.clientA.from('mail_threads')
      .update({ label_id: labelAId }).eq('id', threadSharedId)
    expect(ok.error).toBeNull()

    const { error } = await s.clientA.from('mail_threads')
      .update({ label_id: labelBId }).eq('id', threadSharedId)
    expect(error).not.toBeNull()
    const { data: apres } = await service.from('mail_threads')
      .select('label_id').eq('id', threadSharedId).single()
    expect(apres?.label_id).toBe(labelAId)
  })

  it('un alias vers le contact d une autre agence est refusé', async () => {
    const emailOk = `alias-ok-${s.stamp}@ex.ch`
    const emailKo = `alias-refus-${s.stamp}@ex.ch`

    const ok = await s.clientA.from('mail_contact_aliases').insert({
      agency_id: s.agencyAId, email: emailOk, contact_id: contactAId, learned_by: s.agentAId,
    }).select('id').single()
    expect(ok.error).toBeNull()
    await s.clientA.from('mail_contact_aliases').delete().eq('id', ok.data!.id)

    // agency_id reste celui de l'appelant : c'est le contact qui appartient à l'agence B.
    // Sans le `exists` du WITH CHECK, l'ingestion (service-role, hors RLS) recopierait ce
    // contact étranger sur mail_threads.contact_id — un fil « rattaché » et vide.
    const { error } = await s.clientA.from('mail_contact_aliases').insert({
      agency_id: s.agencyAId, email: emailKo, contact_id: contactBId, learned_by: s.agentAId,
    })
    expect(error).not.toBeNull()
    const { data: reste } = await service.from('mail_contact_aliases').select('id').eq('email', emailKo)
    expect(reste ?? []).toEqual([])
  })

  // AJOUT, ET LE DERNIER DE LA LISTE (la suite est sérielle : ce test déplace un profil
  // puis le remet, et l'ordre de déclaration est donc l'ordre d'exécution).
  //
  // La fuite que le ET conjoint de mail_account_visible ferme : `team_remove_member` ne
  // fait qu'un `update profiles set agency_id = null, role = 'buyer'` — la ligne profiles
  // SURVIT, donc la clé étrangère `owner_id … on delete cascade` ne se déclenche jamais et
  // le compte reste 'active'. `accept-team-invite` réécrit ensuite `profiles.agency_id`
  // vers une NOUVELLE agence. Sans le ET, la branche `owner_id = auth.uid()` suivrait
  // l'ex-membre chez le concurrent.
  //
  // ⚠ Le JWT de s.clientA n'est PAS renouvelé, et c'est le cœur du test : la policy
  // réévalue get_my_agency_id() à chaque instruction, elle n'est pas figée dans le jeton.
  it('une boîte ne suit pas son propriétaire qui change d agence', async () => {
    const avantComptes = await s.clientA.from('mail_accounts').select('id').eq('id', ownerBoxId)
    expect((avantComptes.data ?? []).map((r) => r.id)).toEqual([ownerBoxId])
    const avantFils = await s.clientA.from('mail_threads').select('id').eq('id', threadOwnerId)
    expect((avantFils.data ?? []).map((r) => r.id)).toEqual([threadOwnerId])
    const avantMsg = await s.clientA.from('mail_messages').select('id').eq('id', messageOwnerId)
    expect((avantMsg.data ?? []).map((r) => r.id)).toEqual([messageOwnerId])
    const avantListe = await s.clientA.rpc('mail_list_threads', { p_account_id: ownerBoxId, p_folder: 'in' })
    expect(avantListe.data?.length).toBe(1)

    try {
      const { error: movErr } = await service.from('profiles')
        .update({ agency_id: s.agencyBId }).eq('id', s.agentAId)
      expect(movErr).toBeNull()

      const { data: comptes } = await s.clientA.from('mail_accounts').select('id').eq('id', ownerBoxId)
      expect(comptes ?? []).toEqual([])
      const { data: fils } = await s.clientA.from('mail_threads').select('id').eq('account_id', ownerBoxId)
      expect(fils ?? []).toEqual([])
      const { data: msgs } = await s.clientA.from('mail_messages').select('id').eq('account_id', ownerBoxId)
      expect(msgs ?? []).toEqual([])
      const apresListe = await s.clientA.rpc('mail_list_threads', { p_account_id: ownerBoxId, p_folder: 'in' })
      expect(apresListe.data ?? []).toEqual([])
    } finally {
      await service.from('profiles').update({ agency_id: s.agencyAId }).eq('id', s.agentAId)
    }
  })
})
```

- [x] **Step 2 : Lancer, lire les échecs, corriger la migration si une policy manque**
  (⛔ **LA SUITE N'A PAS ÉTÉ EXÉCUTÉE ICI** : aucun runtime de conteneur sur la machine —
  `docker`, `podman` et `colima` sont absents du PATH — donc ni `supabase start` ni
  `npm run test:backend`. Et sans `.env.test.local`, le `describe.skipIf` ignorerait de
  toute façon les 15 tests en silence. La preuve est en CI :
  `.github/workflows/backend.yml` lance `supabase start -x studio,…` puis
  `npm run test:backend`. Contrôles statiques passés à la place : `tsc` en strict sur le
  fichier, `npm run lint` (0 erreur), `npm run lint:spec-sql` (vert ; le fichier ne porte
  pas `@sql-blocks-check` — il n'écrit aucun `do $$ … $$`), et une confrontation
  identifiant par identifiant — tables, colonnes, noms de RPC **et noms d'arguments**,
  ces derniers étant passés PAR NOM par `.rpc()` et donc invisibles au type-check —
  contre `supabase/migrations/20260903120000_mail_module.sql`.)

```bash
npm run test:backend -- tests/backend/mail-rls.spec.ts
```
Attendu : 15 tests verts (9 du plan + 6 `it()` ajoutés, regroupés en quatre sujets : les trois WITH CHECK, le Vault, la cécité du super-admin, et la boîte qui ne suit pas son propriétaire). ⚠ Le « + 4 » d'origine ne sommait pas à 15 — corrigé le 04.09.2026. Si « permission denied for table mail_labels » : le `grant` de §13 manque ; si le test « colonne accordée » rougit avec 42501 : le `grant update (label_id)` manque.

- [x] **Step 3 : Commit**

```bash
git add tests/backend/mail-rls.spec.ts
git commit -m "test(messagerie): RLS owner/agency, isolation, Vault, RPC de liste"
```

---

### Task 1.3 : Types partagés + MIME (`_shared/mail/types.ts`, `mime.ts`)

> ⚠ **Revue adverse « importante » du 04.09.2026 — deux fonctions ajoutées à `mime.ts`.**
> (1) `attachmentServing` : le `mime_type` d'une pièce est du texte d'EXPÉDITEUR, et
> `mail-attachment` le recopiait en `Content-Type` avec `Content-Disposition: inline` —
> une pièce déclarée `text/html` s'exécutait dans la session de l'agent (XSS stocké,
> jeton Supabase à portée). Liste blanche de RENDU (pdf, png, jpeg, webp, gif, texte
> brut) ; tout le reste en `application/octet-stream` + `attachment`. (2)
> `base64ByteLength` : `longueur * 0.75` surestimait de deux octets et débordait sur un
> contenu replié, or la valeur sert deux plafonds de REFUS (20 Mo au total, 3 Mo par
> pièce côté Graph).

> ⚠ **Revue adverse du 04.09.2026 — deux champs ajoutés.** `GmailCursor.historyPageToken`
> (le pageToken de `history.list` vivait dans une variable LOCALE : une pagination coupée
> par le budget n'était pas reprenable) et `MailAccountRow.sync_failures` (pour que
> `status` puisse enfin dire « cette boîte est morte »). Les deux sont optionnels : les
> curseurs et les lectures écrits avant cette date ne les portent pas.

**Files:**
- Create: `supabase/functions/_shared/mail/types.ts`
- Create: `supabase/functions/_shared/mail/mime.ts`
- Test: `supabase/functions/_shared/mail/mime.test.ts`
- Modify: `vitest.config.ts` (liste `include`)

- [x] **Step 1 : Écrire les types**

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
  /**
   * Échecs consécutifs de synchronisation (remis à 0 dès qu'une passe aboutit).
   * Existe pour que `status` puisse dire « cette boîte est morte » : sans ce compteur,
   * seul `reauth_required` sortait du balayage, et un 403 de quota, un pointeur Vault
   * orphelin ou une erreur d'ingestion laissaient le compte `active` à réessayer toutes
   * les 10 minutes — indiscernable d'une boîte saine sans courrier neuf.
   * Optionnel : une lecture qui ne projette pas la colonne rend `undefined`.
   */
  sync_failures?: number
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

/** Les huit gestes que `mail-actions` répercute sur un fil (et sur chacun de ses messages). */
export type MailThreadAction =
  | 'mark_read' | 'mark_unread' | 'star' | 'unstar'
  | 'archive' | 'unarchive' | 'trash' | 'untrash'

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
  /**
   * pageToken de la pagination `history.list` EN COURS, null quand elle est drainée.
   * ⚠ Sans lui, une pagination interrompue par le budget de temps n'était pas
   * reprenable : le tick suivant repartait sans pageToken et les pages restantes
   * n'étaient jamais lues (courrier perdu, en silence). Absent des curseurs écrits
   * avant le 04.09.2026 — toujours lu en `?? null`.
   */
  historyPageToken?: string | null
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

- [x] **Step 2 : Écrire le test MIME (rouge)**

```ts
// supabase/functions/_shared/mail/mime.test.ts
import { describe, it, expect } from 'vitest'
import {
  parseAddress, parseAddressList, decodeRfc2047, htmlToText, textToHtml, snippetOf,
  base64UrlDecodeToString, base64UrlEncodeString, buildMime, makeMessageId, encodeHeaderWord,
  attachmentServing, base64ByteLength,
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
  // ⛔ Le `mime_type` d'une pièce vient du CORPS de la requête mail-send : c'est du texte
  // d'appelant, posé dans un en-tête de partie. Sans validation, un CRLF y ouvrait un
  // en-tête à soi.
  it('un type de pièce ne peut pas ouvrir un en-tête de partie', () => {
    const raw = buildMime({
      ...base,
      attachments: [{ filename: 'f.txt', mimeType: 'text/plain\r\nX-Injected: yes', base64: 'QQ==' }],
    })
    expect(raw).not.toContain('X-Injected')
    expect(raw).toContain('Content-Type: application/octet-stream; name="f.txt"')
  })
  it('un type valide passe, ses paramètres sont jetés, tout le reste retombe sur octet-stream', () => {
    const of = (mimeType: string) =>
      buildMime({ ...base, attachments: [{ filename: 'f', mimeType, base64: 'QQ==' }] })
        .split('\r\n').find((l) => l.startsWith('Content-Type:') && l.includes('name='))
    expect(of('application/pdf')).toBe('Content-Type: application/pdf; name="f"')
    expect(of('APPLICATION/PDF')).toBe('Content-Type: application/pdf; name="f"')
    // Le paramètre est jeté : c'est là qu'on cacherait un guillemet ou un point-virgule.
    expect(of('text/plain; charset=utf-8')).toBe('Content-Type: text/plain; name="f"')
    for (const nawak of ['', 'nawak', 'text/', '/plain', 'text/plain"; x="y', 'text/pl ain']) {
      expect(of(nawak), nawak).toBe('Content-Type: application/octet-stream; name="f"')
    }
  })
  it('Message-ID et mot d en-tête', () => {
    expect(makeMessageId('agence.ch')).toMatch(/^<[0-9a-f-]{36}@agence\.ch>$/)
    expect(encodeHeaderWord('ascii only')).toBe('ascii only')
    expect(encodeHeaderWord('Zoé')).toBe('=?UTF-8?B?Wm/DqQ==?=')
  })
})

describe('attachmentServing — le type déclaré par l expéditeur ne traverse pas', () => {
  it('rend en ligne les six essences de la liste blanche, et elles seules', () => {
    expect(attachmentServing('application/pdf')).toEqual({ contentType: 'application/pdf', disposition: 'inline' })
    expect(attachmentServing('image/png')).toEqual({ contentType: 'image/png', disposition: 'inline' })
    expect(attachmentServing('image/jpeg')).toEqual({ contentType: 'image/jpeg', disposition: 'inline' })
    expect(attachmentServing('image/webp')).toEqual({ contentType: 'image/webp', disposition: 'inline' })
    expect(attachmentServing('image/gif')).toEqual({ contentType: 'image/gif', disposition: 'inline' })
    // Le jeu de caractères est imposé, il ne vient pas de l'expéditeur.
    expect(attachmentServing('text/plain; charset=utf-7')).toEqual({ contentType: 'text/plain; charset=utf-8', disposition: 'inline' })
  })
  it('force le téléchargement de TOUT ce qui pourrait s exécuter dans la session de l agent', () => {
    // Les trois essences par lesquelles un expéditeur obtiendrait un XSS stocké.
    for (const evil of ['text/html', 'image/svg+xml', 'application/xhtml+xml', 'TEXT/HTML', ' text/html ; charset=utf-8']) {
      expect(attachmentServing(evil), evil).toEqual({ contentType: 'application/octet-stream', disposition: 'attachment' })
    }
  })
  it('un type absent, vide ou inconnu se télécharge, il ne se devine pas', () => {
    for (const v of [null, undefined, '', 'application/zip', 'application/vnd.ms-excel', 'nawak']) {
      expect(attachmentServing(v).disposition).toBe('attachment')
      expect(attachmentServing(v).contentType).toBe('application/octet-stream')
    }
  })
})

describe('base64ByteLength', () => {
  it('compte les octets réels, bourrage et repli compris', () => {
    expect(base64ByteLength('')).toBe(0)
    expect(base64ByteLength('QQ==')).toBe(1)
    expect(base64ByteLength('QUI=')).toBe(2)
    expect(base64ByteLength('QUJD')).toBe(3)
    // Replié à 76 colonnes par le fournisseur : les CRLF ne sont pas des octets.
    expect(base64ByteLength('QUJD\r\nQUJD')).toBe(6)
  })
  it('ne surestime plus : 3 Mo pile ne dépassent pas le plafond de 3 Mo', () => {
    const exactly3MB = 'A'.repeat((3 * 1024 * 1024 * 4) / 3)
    expect(base64ByteLength(exactly3MB)).toBe(3 * 1024 * 1024)
    expect(Math.ceil(exactly3MB.length * 0.75)).toBe(3 * 1024 * 1024) // l'ancienne formule, ici d'accord
    expect(base64ByteLength('QQ==')).toBeLessThan(Math.ceil('QQ=='.length * 0.75)) // et là non : 1 contre 3
  })
})
```

- [x] **Step 3 : Ajouter le spec à la liste EN DUR de `vitest.config.ts`**

Dans `include: [...]`, après `'supabase/functions/_shared/emails-quatre-langues.test.ts'`, ajouter :
```ts
'supabase/functions/_shared/mail/mime.test.ts',
```

- [x] **Step 4 : Lancer — rouge attendu**

```bash
npx vitest run supabase/functions/_shared/mail/mime.test.ts
```
Attendu : FAIL. ⚠ Message réel de vite (corrigé le 04.09.2026, mesuré) : `Failed to resolve import "./mime.ts" from "…/mime.test.ts". Does the file exist?` — et non `Cannot find module`. Le spec EST bien chargé : c'est la preuve que vitest résout un chemin imbriqué sous `_shared/`.

- [x] **Step 5 : Écrire `mime.ts`**

⚠ **Corrigé le 04.09.2026 : la classe de caractères de `htmlToText` portait un NBSP LITTÉRAL** (`/[ \t<U+00A0>]+/`). Le comportement visé est juste — replier l'espace insécable sur une espace ordinaire — mais un caractère invisible dans le source fait rougir `no-irregular-whitespace` (1 erreur eslint, mesurée). Écrit `\u00a0` : même sémantique, gate verte. À reprendre tel quel dans les six tâches sœurs.

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
    .replace(/[ \t\u00a0]+/g, ' ')
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

/**
 * Taille RÉELLE d'un contenu base64, en octets.
 *
 * ⚠ `longueur * 0.75` surestime de 1 à 2 octets par le bourrage `=` et déborde dès
 * qu'un retour à la ligne traîne (les fournisseurs replient à 76 colonnes). Ce n'est
 * pas de la coquetterie : la valeur sert deux PLAFONDS de refus — le total de 20 Mo et
 * les 3 Mo par pièce que Graph impose —, et une pièce refusée à tort est un envoi
 * impossible sans explication.
 */
export function base64ByteLength(b64: string | null | undefined): number {
  const clean = (b64 ?? '').replace(/[^A-Za-z0-9+/=_-]/g, '')
  if (!clean) return 0
  const pad = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor((clean.length * 3) / 4) - pad)
}

/**
 * Comment servir une pièce jointe : type RENDU et disposition.
 *
 * ⛔ LE TYPE DÉCLARÉ PAR LE FOURNISSEUR NE TRAVERSE JAMAIS. `mail_attachments.mime_type`
 * est recopié de `part.mimeType` (Gmail) ou `a.contentType` (Graph) — c'est-à-dire du
 * texte choisi par L'EXPÉDITEUR du courrier. Le rendre tel quel avec
 * `Content-Disposition: inline` faisait de toute boîte connectée un vecteur de XSS
 * stocké : un inconnu envoie une pièce déclarée `text/html` contenant un `<script>`,
 * l'agent ouvre le message, le front la lit avec son jeton, et le script tourne dans la
 * session du CRM. `X-Content-Type-Options: nosniff` n'y peut rien — il empêche de
 * DEVINER un type, pas d'en honorer un déclaré.
 *
 * D'où une liste blanche de RENDU, jamais une liste noire : ce qui n'y est pas est
 * servi en `application/octet-stream` + `attachment`, donc téléchargé, jamais exécuté.
 * `text/html`, `image/svg+xml` et `application/xhtml+xml` en sont exclus par
 * construction — un SVG est un document scriptable, pas une image.
 */
export interface AttachmentServing { contentType: string; disposition: 'inline' | 'attachment' }
const INLINE_SAFE_MIME: Record<string, string> = {
  'application/pdf': 'application/pdf',
  'image/png': 'image/png',
  'image/jpeg': 'image/jpeg',
  'image/webp': 'image/webp',
  'image/gif': 'image/gif',
  // Le jeu de caractères est IMPOSÉ : sans lui, un texte en UTF-7 peut se faire lire
  // comme du balisage par les moteurs qui devinent encore l'encodage.
  'text/plain': 'text/plain; charset=utf-8',
}
export function attachmentServing(declared: string | null | undefined): AttachmentServing {
  // Un type est `type/sous-type` + paramètres : on ne compare que l'essence.
  const essence = (declared ?? '').split(';')[0].trim().toLowerCase()
  const safe = INLINE_SAFE_MIME[essence]
  return safe
    ? { contentType: safe, disposition: 'inline' }
    : { contentType: 'application/octet-stream', disposition: 'attachment' }
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
    // ⛔ LE TYPE EST DU TEXTE D'APPELANT, EXACTEMENT COMME LE NOM — et il atterrit dans un
    // EN-TÊTE. Le nom voisin était nettoyé depuis l'origine, le type ne l'était pas :
    // `{"mime_type": "text/plain\r\nX-Injected: yes"}` posté à mail-send rendait
    // littéralement `Content-Type: text/plain` / `X-Injected: yes; name="f.txt"`. De là on
    // forge n'importe quel en-tête de partie, on referme la frontière, on ajoute une pièce.
    // L'enveloppe, elle, est propre (`encodeHeaderWord` encode tout CRLF, `isAddr` refuse
    // une adresse qui en porte) : le trou n'était que dans les parties — assez pour ne pas
    // le laisser.
    //
    // On ne NETTOIE pas, on VALIDE : un type est `type/sous-type`, et ce qui n'a pas cette
    // forme n'est pas un type. ⚠ Les PARAMÈTRES sont volontairement jetés (`; charset=…`) —
    // `attachmentServing`, trente lignes plus haut, ne compare déjà que l'essence, et un
    // paramètre est précisément l'endroit où l'on cacherait un guillemet ou un point-virgule.
    const essence = a.mimeType.split(';')[0].trim().toLowerCase()
    const type = /^[a-z0-9][\w.+-]*\/[a-z0-9][\w.+-]*$/.test(essence) ? essence : 'application/octet-stream'
    parts.push(
      `--${mixed}`,
      `Content-Type: ${type}; name="${name}"`,
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

- [x] **Step 6 : Vert**

```bash
npx vitest run supabase/functions/_shared/mail/mime.test.ts
```
Attendu : 10 tests PASS.

- [x] **Step 7 : Commit**

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

- [x] **Step 1 : Test (rouge)**

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

- [x] **Step 2 : Implémentation**

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

- [x] **Step 3 : Vert, puis commit**

```bash
npx vitest run supabase/functions/_shared/mail/secrets.test.ts
git add supabase/functions/_shared/mail/secrets.ts supabase/functions/_shared/mail/secrets.test.ts vitest.config.ts
git commit -m "feat(messagerie): secrets Vault et rafraîchissement OAuth (tampon 5 min, rotation MS)"
```
Attendu : 8 tests PASS.

---

### Task 1.5 : OAuth (URL d'autorisation, PKCE, échange, identité) — `_shared/mail/oauth.ts`

> ⚠ **Revue adverse « importante » du 04.09.2026 — `revokeToken` rend un booléen.** Le
> `.catch(() => undefined)` muet rendait invisible un refus de Google : l'utilisateur
> lisait « déconnectée » et l'autorisation restait vivante. L'appelant décide désormais,
> et la raison est journalisée (voir la task 1.10).

**Files:**
- Create: `supabase/functions/_shared/mail/oauth.ts`
- Test: `supabase/functions/_shared/mail/oauth.test.ts`
- Modify: `vitest.config.ts`

- [x] **Step 1 : Test (rouge)**

```ts
// supabase/functions/_shared/mail/oauth.test.ts
import { describe, it, expect, vi } from 'vitest'
import { randomToken, pkceChallenge, buildAuthorizeUrl, exchangeCode, fetchIdentity, revokeToken } from './oauth.ts'

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

// ⛔ La révocation était un `.catch(() => undefined)` MUET : un refus de Google restait
// invisible, l'utilisateur lisait « déconnectée » et l'autorisation vivait toujours.
describe('revokeToken', () => {
  it('révocation acceptée ⇒ true', async () => {
    const fetch = vi.fn(async (u: string, init?: RequestInit) => {
      expect(u).toContain('https://oauth2.googleapis.com/revoke?token=rt-1')
      expect(init?.method).toBe('POST')
      return new Response(null, { status: 200 })
    })
    expect(await revokeToken('gmail', 'rt-1', { fetch: F(fetch) })).toBe(true)
  })
  it('refus du fournisseur ⇒ false, pas un succès silencieux', async () => {
    const fetch = vi.fn(async () => new Response('{"error":"invalid_token"}', { status: 400 }))
    expect(await revokeToken('gmail', 'rt-1', { fetch: F(fetch) })).toBe(false)
  })
  it('réseau injoignable ⇒ false, jamais une exception qui remonte au milieu d une déconnexion', async () => {
    const fetch = vi.fn(async () => { throw new Error('ECONNRESET') })
    expect(await revokeToken('gmail', 'rt-1', { fetch: F(fetch) })).toBe(false)
  })
  it('Microsoft n a rien à révoquer : true, et AUCUN appel réseau', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 200 }))
    expect(await revokeToken('outlook', 'rt-1', { fetch: F(fetch) })).toBe(true)
    expect(fetch).not.toHaveBeenCalled()
  })
})
```

Ajouter `'supabase/functions/_shared/mail/oauth.test.ts',` à `vitest.config.ts` ; lancer → FAIL (module absent).

- [x] **Step 2 : Implémentation**

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

/**
 * Google révoque ; Microsoft n'a pas d'endpoint de révocation de jeton (on efface Vault).
 *
 * ⛔ L'ÉCHEC EST RENDU, PLUS AVALÉ. Le `.catch(() => undefined)` d'origine rendait
 * INVISIBLE un 400 ou un 500 de Google : l'utilisateur voyait « déconnectée », et
 * l'autorisation restait vivante chez Google — MEGGA gardant le droit de lire sa boîte.
 * `false` ⇒ l'appelant décide (garder la ligne pour pouvoir réessayer, prévenir), et
 * la raison est journalisée avec le compte.
 */
export async function revokeToken(provider: OAuthProvider, token: string, deps: OAuthDeps = {}): Promise<boolean> {
  // Microsoft n'expose rien à révoquer : ce n'est pas un échec, il n'y a rien à faire.
  if (provider !== 'gmail') return true
  const f = deps.fetch ?? globalThis.fetch
  try {
    const res = await f(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: 'POST' })
    if (res.ok) return true
    console.error(`[mail oauth] révocation Google refusée: http ${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}`)
    return false
  } catch (e) {
    console.error('[mail oauth] révocation Google injoignable:', e instanceof Error ? e.message : String(e))
    return false
  }
}
```

- [x] **Step 3 : Vert, commit**

```bash
npx vitest run supabase/functions/_shared/mail/oauth.test.ts
git add supabase/functions/_shared/mail/oauth.ts supabase/functions/_shared/mail/oauth.test.ts vitest.config.ts
git commit -m "feat(messagerie): OAuth code+PKCE (URL, échange, identité, révocation)"
```
Attendu : 8 tests PASS.

---

### Task 1.6 : Adaptateur Gmail — `_shared/mail/gmail.ts`

> ⚠ **Revue adverse du 04.09.2026 — `nextHistoryCursor` ajoutée.** Le `historyId` d'une
> réponse `users.history.list` est « the ID of the mailbox's **current** history record »,
> donc la TÊTE de la boîte au moment de la réponse — et Gmail le rend sur CHAQUE page,
> `nextPageToken` compris. L'adopter après la page 1 sur N sautait définitivement les
> pages 2..N : la moitié du courrier d'un retour de congés n'arrivait jamais dans le CRM,
> sans erreur, sans `last_error`, le compte restant « synchronisé il y a 1 minute ». La
> règle est extraite en fonction PURE pour être testable ; quatre tests la couvrent.

**Files:**
- Create: `supabase/functions/_shared/mail/gmail.ts`
- Test: `supabase/functions/_shared/mail/gmail.test.ts`
- Modify: `vitest.config.ts`

- [x] **Step 1 : Test (rouge) avec une charge utile Gmail réaliste**

```ts
// supabase/functions/_shared/mail/gmail.test.ts
import { describe, it, expect, vi } from 'vitest'
import { normalizeGmailMessage, historyToChanges, nextHistoryCursor, gmailLabelPatch, gmailListInitial, gmailHistory, type GmailMessage, type GmailHistoryPage } from './gmail.ts'
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

describe('nextHistoryCursor', () => {
  // Gmail rend `historyId` = la TÊTE de la boîte sur CHAQUE page, nextPageToken compris.
  // L'adopter avant la fin de la pagination sautait les pages restantes pour toujours :
  // la moitié du courrier d'un retour de congés n'arrivait jamais, sans une erreur.
  it('page NON finale : le curseur ne bouge pas, le pageToken est rendu', () => {
    expect(nextHistoryCursor('1000', { historyId: '9999', nextPageToken: 'p2' }))
      .toEqual({ historyId: '1000', pageToken: 'p2' })
  })
  it('page finale : le curseur adopte la tête et la pagination est close', () => {
    expect(nextHistoryCursor('1000', { historyId: '9999' }))
      .toEqual({ historyId: '9999', pageToken: null })
  })
  it('page finale sans historyId : on garde le curseur courant plutôt que de le perdre', () => {
    expect(nextHistoryCursor('1000', {})).toEqual({ historyId: '1000', pageToken: null })
  })
  it('cinq pages : le curseur n avance qu à la dernière', () => {
    const pages: GmailHistoryPage[] = [
      { historyId: '9999', nextPageToken: 'p2' }, { historyId: '9999', nextPageToken: 'p3' },
      { historyId: '9999', nextPageToken: 'p4' }, { historyId: '9999', nextPageToken: 'p5' },
      { historyId: '9999' },
    ]
    let cursor: string | null = '1000'
    const vus: (string | null)[] = []
    for (const p of pages) { const n = nextHistoryCursor(cursor, p); cursor = n.historyId; vus.push(n.pageToken) }
    expect(vus).toEqual(['p2', 'p3', 'p4', 'p5', null])
    expect(cursor).toBe('9999')
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

// ⛔ Un geste de `mail-actions` s'applique à CHAQUE message du fil, copies « Envoyés »
// comprises. `untrash: [['INBOX'], …]` posait donc INBOX sur des messages qui ne l'avaient
// jamais eu : après avoir sorti une conversation de la corbeille, l'agent retrouvait ses
// PROPRES réponses dans sa Réception Gmail.
describe('gmailLabelPatch — INBOX ne se pose que sur un message entrant', () => {
  it('untrash et unarchive n ajoutent INBOX qu au courrier reçu', () => {
    expect(gmailLabelPatch('untrash', 'inbound')).toEqual({ add: ['INBOX'], remove: ['TRASH'] })
    expect(gmailLabelPatch('untrash', 'outbound')).toEqual({ add: [], remove: ['TRASH'] })
    expect(gmailLabelPatch('unarchive', 'inbound')).toEqual({ add: ['INBOX'], remove: [] })
    // Rien à faire du tout sur une copie « Envoyés » : mail-actions saute l'appel.
    expect(gmailLabelPatch('unarchive', 'outbound')).toEqual({ add: [], remove: [] })
  })
  it('RETIRER un libellé reste indifférencié — c est sans effet sur qui ne l a pas', () => {
    for (const d of ['inbound', 'outbound'] as const) {
      expect(gmailLabelPatch('archive', d), d).toEqual({ add: [], remove: ['INBOX'] })
      expect(gmailLabelPatch('trash', d), d).toEqual({ add: ['TRASH'], remove: ['INBOX'] })
      expect(gmailLabelPatch('mark_read', d), d).toEqual({ add: [], remove: ['UNREAD'] })
      expect(gmailLabelPatch('mark_unread', d), d).toEqual({ add: ['UNREAD'], remove: [] })
      expect(gmailLabelPatch('star', d), d).toEqual({ add: ['STARRED'], remove: [] })
      expect(gmailLabelPatch('unstar', d), d).toEqual({ add: [], remove: ['STARRED'] })
    }
  })
  it('aucun geste ne pose SENT ni DRAFT — Gmail les refuse (« can be manually applied: no »)', () => {
    for (const a of ['mark_read', 'mark_unread', 'star', 'unstar', 'archive', 'unarchive', 'trash', 'untrash'] as const) {
      for (const d of ['inbound', 'outbound'] as const) {
        const p = gmailLabelPatch(a, d)
        expect([...p.add, ...p.remove], `${a}/${d}`).not.toContain('SENT')
        expect([...p.add, ...p.remove], `${a}/${d}`).not.toContain('DRAFT')
      }
    }
  })
})
```

Ajouter `'supabase/functions/_shared/mail/gmail.test.ts',` à `vitest.config.ts` ; lancer → FAIL.

- [x] **Step 2 : Implémentation**

```ts
// supabase/functions/_shared/mail/gmail.ts
// Adaptateur Gmail API v1 (https://gmail.googleapis.com/gmail/v1/users/me).
// Première passe : messages.list `newer_than:90d` par pages de 50 ; ensuite
// history.list depuis le dernier historyId. Un 404 sur history = historique
// expiré côté Google : on repart en passe initiale (jamais une boucle d'erreur).
// PUR : `fetch` injectable ; aucune écriture en base ici (c'est ingest.ts).
import type { MailDirection, MailThreadAction, NormalizedAttachment, NormalizedMessage, RemoteChange } from './types.ts'
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

/**
 * Les libellés à poser et à retirer pour un geste, SUR CE MESSAGE-LÀ.
 *
 * ⛔ INBOX NE SE POSE QUE SUR UN MESSAGE ENTRANT, et c'est tout l'objet de cette fonction.
 * Un geste de `mail-actions` s'applique à TOUS les messages du fil, copies « Envoyés »
 * comprises — or celles-ci n'ont jamais porté INBOX. La table était pourtant
 * `untrash: [['INBOX'], ['TRASH']]` sans distinction : après avoir restauré une
 * conversation depuis la corbeille, l'agent retrouvait ses PROPRES réponses dans sa
 * Réception Gmail. `unarchive` avait la même forme et le même défaut. Retirer un libellé
 * reste juste pour tout le monde (retirer INBOX d'un message qui ne l'a pas est sans
 * effet) ; c'est l'AJOUT qui doit être dirigé.
 *
 * ⚠ On reste sur `messages.modify` plutôt que sur les endpoints dédiés `/trash` et
 * `/untrash`. Le guide « Manage labels » donne TRASH « can be manually applied: yes »
 * (seuls SENT et DRAFT sont à « no » — relu le 04.09.2026) : la voie actuelle est légale
 * et ne rendra pas 502. `users.messages.untrash` serait plus élégant, puisqu'il rendrait
 * au message son état d'avant — mais sa référence ne documente NULLE PART qu'il restaure
 * les libellés, INBOX compris. Échanger un défaut mesuré contre un comportement non
 * documenté n'est pas un progrès.
 */
export function gmailLabelPatch(action: MailThreadAction, direction: MailDirection): { add: string[]; remove: string[] } {
  const inbox = direction === 'inbound' ? ['INBOX'] : []
  const table: Record<MailThreadAction, [string[], string[]]> = {
    mark_read: [[], ['UNREAD']], mark_unread: [['UNREAD'], []],
    star: [['STARRED'], []], unstar: [[], ['STARRED']],
    archive: [[], ['INBOX']], unarchive: [inbox, []],
    trash: [['TRASH'], ['INBOX']], untrash: [inbox, ['TRASH']],
  }
  const [add, remove] = table[action]
  return { add, remove }
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

/**
 * Où en est la synchro incrémentale APRÈS avoir traité une page d'historique.
 *
 * ⛔ `page.historyId` n'est PAS le dernier enregistrement de la page : la référence
 * Gmail le définit comme « the ID of the mailbox's current history record », donc la
 * TÊTE de la boîte au moment de la réponse — et Gmail le rend sur CHAQUE page, y
 * compris celles qui portent un `nextPageToken`. L'adopter après la page 1 sur N
 * faisait repartir le tick suivant de la tête : les pages 2..N n'étaient jamais lues,
 * définitivement, sans erreur ni `last_error` (mesuré comme la moitié du courrier
 * d'un retour de congés qui n'arrivait jamais dans le CRM). Le curseur n'avance donc
 * que quand la pagination est DRAINÉE ; tant qu'elle ne l'est pas, c'est le
 * `pageToken` qui est persisté et repris au tick suivant.
 */
export function nextHistoryCursor(
  current: string | null, page: GmailHistoryPage,
): { historyId: string | null; pageToken: string | null } {
  const pageToken = page.nextPageToken ?? null
  if (pageToken) return { historyId: current, pageToken }
  return { historyId: page.historyId ? String(page.historyId) : current, pageToken: null }
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

- [x] **Step 3 : Vert, commit**

```bash
npx vitest run supabase/functions/_shared/mail/gmail.test.ts
git add supabase/functions/_shared/mail/gmail.ts supabase/functions/_shared/mail/gmail.test.ts vitest.config.ts
git commit -m "feat(messagerie): adaptateur Gmail (liste 90 j, history, normalisation, modify, send, pièces)"
```
Attendu : 6 tests PASS.

---

### Task 1.7 : Adaptateur Microsoft Graph — `_shared/mail/graph.ts`

> ⚠ **Revue adverse « importante » du 04.09.2026 — deux défauts de plus.**
> (1) **`deltaToChanges` lisait une propriété ABSENTE comme `false`.** La référence du
> delta dit qu'un item modifié est rendu « with *at least* the updated properties » : une
> charge utile PARTIELLE est le cas normal. Un `parentFolderId` absent donnait
> `inInbox: false`, qu'`applyRemoteChanges` écrit `is_archived = true` — poser un simple
> drapeau dans Outlook faisait disparaître la conversation de la Réception du CRM ; un
> `isRead` absent la remettait en non-lu. On n'émet que ce que la charge utile PORTE.
> (2) **Les pièces d'une réponse partaient dans le PATCH.** `attachments` est une
> propriété de NAVIGATION : « Update message » ne la liste pas parmi les modifiables. Ou
> Graph refusait (502, et le brouillon de `createReply` restait dans les Brouillons de
> l'agent), ou il l'ignorait et la réponse arrivait SANS pièce pendant que le CRM
> enregistrait `has_attachments = true`. Chaque pièce est POSTée dans
> `/me/messages/{draftId}/attachments` avant l'envoi, un échec supprime le brouillon
> orphelin, et le plafond documenté (« under 3 MB » par pièce) sort en constante lue par
> `mail-send`.

> ⚠ **Revue adverse du 04.09.2026 — l'archivage Outlook DÉTRUISAIT la conversation.**
> Le delta est PAR DOSSIER : archiver un message — le geste Outlook le plus courant — le
> sort de la Réception, qui le signale `@removed` exactement comme un message effacé.
> `deltaToChanges` en faisait un `message_deleted`, et `applyRemoteChanges` supprimait la
> ligne puis le fil entier en cascade. Même `reason: "changed"`, que Graph documente
> comme une suppression RESTAURABLE, était détruit. Deux changements, indissociables :
> (1) `Prefer: IdType="ImmutableId"` sur CHAQUE appel — Microsoft le documente
> exactement pour ce problème (concepts/outlook-immutable-id : l'id « changes when the
> item is moved from one container … to another. To change this behavior, use the Prefer:
> IdType header ») ; l'id survit alors au déplacement, ce SANS QUOI le GET de
> vérification rendrait 404 sur l'ancien id et l'on redétruirait. Les `nextLink` /
> `deltaLink` sont compatibles avec les deux formats, et le module n'a aucune donnée en
> production : pas de migration d'ids à prévoir. (2) Les disparus sortent dans leur
> propre panier (`removed`), que `resolveGraphRemoval` tranche par un GET : 404 ⇒
> vraiment parti, 200 ⇒ déplacé (on reclasse depuis `parentFolderId`, les quatre dossiers
> étant déjà résolus), autre erreur ⇒ indéterminé, on ne touche à rien.

**Files:**
- Create: `supabase/functions/_shared/mail/graph.ts`
- Test: `supabase/functions/_shared/mail/graph.test.ts`
- Modify: `vitest.config.ts`

Faits Graph qui décident du code (vérifiés dans la référence v1.0) :
- `…/mailFolders/{inbox|sentitems}/messages/delta` accepte `$select` et un `$filter=receivedDateTime ge <ISO>` **au premier appel seulement** ; ensuite on suit `@odata.nextLink` puis on garde `@odata.deltaLink`. Un élément supprimé arrive comme `{ id, "@removed": { reason } }`.
- `parentFolderId` est un id **opaque** : pour savoir si un message est dans la réception on résout une fois `GET /me/mailFolders/inbox?$select=id` (et `sentitems`, `archive`, `deleteditems`) → `cursor.folderIds`.
- ~~**Déplacer un message change son id**~~ — **plus vrai depuis le 04.09.2026** : avec `Prefer: IdType="ImmutableId"` sur chaque appel, l'id survit au déplacement tant que l'item reste dans la même boîte (il ne change qu'au passage en boîte d'archivage EN LIGNE ou à un export/réimport). `POST /me/messages/{id}/move` rend toujours un objet, dont l'id est désormais le même ; `mail-actions` garde le rapprochement `ancien → nouveau` mais l'ignore quand les deux coïncident. C'est cette stabilité qui permet de lever en doute un `@removed` par un simple GET.
- Le corps HTML et les en-têtes (`In-Reply-To`, `References`) demandent un second appel `GET /me/messages/{id}?$select=body,internetMessageHeaders`.
- `internetMessageId` est **modifiable sur un brouillon** : on le pose à la création pour rapprocher le message envoyé quand `sentitems` le rend (`pending:` → id réel).

- [x] **Step 1 : Test (rouge)**

```ts
// supabase/functions/_shared/mail/graph.test.ts
import { describe, it, expect, vi } from 'vitest'
import { normalizeGraphMessage, deltaToChanges, graphDelta, graphFolderIds, graphSend, resolveGraphRemoval, GRAPH_ATTACHMENT_MAX_BYTES, IMMUTABLE_ID_PREFER, type GraphMessage } from './graph.ts'

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
  // ⚠ Test RÉÉCRIT le 04.09.2026 : il figeait le défaut. Il exigeait qu'un `@removed`
  // devienne un `message_deleted`, ce qui faisait disparaître du CRM tout message
  // ARCHIVÉ dans Outlook (le delta est par dossier, archiver = quitter la Réception).
  // Les disparus sortent maintenant dans leur propre panier, que `resolveGraphRemoval`
  // tranche par un GET.
  it('sépare nouveaux, drapeaux et DISPARUS — un @removed n est pas une suppression', () => {
    const r = deltaToChanges([
      { ...M, id: 'N1' },
      { id: 'GONE', '@removed': { reason: 'deleted' } },
      { ...M, id: 'K1', isRead: true, flag: { flagStatus: 'notFlagged' }, parentFolderId: 'F-ARC' },
    ], new Set(['K1']), FOLDERS)
    expect(r.added.map((m) => m.id)).toEqual(['N1'])
    expect(r.removed).toEqual([{ id: 'GONE', reason: 'deleted' }])
    expect(r.changes).toEqual([
      { kind: 'flags', providerMessageId: 'K1', isRead: true, isStarred: false, inInbox: false, isTrashed: false },
    ])
    expect(r.changes.some((c) => c.kind === 'message_deleted')).toBe(false)
  })

  // ⛔ « Updated instances are represented by their id with *at least* the updated
  // properties, but other properties might be included » (delta query overview) : une
  // charge utile PARTIELLE est le cas normal. Ces trois cas rougissent si l'un des
  // drapeaux redevient inconditionnel.
  it('n émet QUE les drapeaux que la charge utile porte', () => {
    const r = deltaToChanges([{ id: 'K1', isRead: true }], new Set(['K1']), FOLDERS)
    expect(r.changes).toEqual([{ kind: 'flags', providerMessageId: 'K1', isRead: true }])
  })
  it('parentFolderId absent : ni inInbox ni isTrashed — sinon poser un drapeau dans Outlook archivait le fil', () => {
    const r = deltaToChanges([{ id: 'K1', flag: { flagStatus: 'flagged' } }], new Set(['K1']), FOLDERS)
    expect(r.changes).toEqual([{ kind: 'flags', providerMessageId: 'K1', isStarred: true }])
    const only = r.changes[0] as { inInbox?: boolean; isTrashed?: boolean; isRead?: boolean }
    expect('inInbox' in only).toBe(false)
    expect('isTrashed' in only).toBe(false)
    expect('isRead' in only).toBe(false) // un isRead absent ne remet pas le message en non-lu
  })
  it('isRead: false EXPLICITE est bien transmis (absence ≠ false)', () => {
    const r = deltaToChanges([{ id: 'K1', isRead: false }], new Set(['K1']), FOLDERS)
    expect(r.changes).toEqual([{ kind: 'flags', providerMessageId: 'K1', isRead: false }])
  })
  it('un item connu SANS aucune propriété suivie ne descend pas jusqu à la base', () => {
    expect(deltaToChanges([{ id: 'K1' }], new Set(['K1']), FOLDERS).changes).toEqual([])
  })
})

describe('graphSend', () => {
  const okJson = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { 'Content-Type': 'application/json' } })
  const OUT = {
    subject: 'Re: Visite', html: '<p>ok</p>',
    to: [{ name: null, email: 'zoe@ex.ch' }], cc: [], bcc: [],
    internetMessageId: '<m1@agence.ch>',
    attachments: [{ filename: 'plan.pdf', mimeType: 'application/pdf', base64: 'JVBERi0=' }],
  }
  const trace = () => {
    const calls: { url: string; method: string; body: string }[] = []
    const fetch = vi.fn(async (u: string, init?: RequestInit) => {
      calls.push({ url: u, method: init?.method ?? 'GET', body: String(init?.body ?? '') })
      if (u.endsWith('/send')) return new Response(null, { status: 202 })
      // Graph rend 200 + l'objet message sur un PATCH, et 201 + la pièce sur un POST
      // dans /attachments : le mock ne doit pas être plus pauvre que le fournisseur.
      return okJson({ id: 'DRAFT1' })
    })
    return { calls, fetch }
  }

  // ⛔ `attachments` est une propriété de NAVIGATION : la référence « Update message »
  // ne la liste pas parmi les modifiables. Envoyée dans le PATCH, la pièce était ou
  // refusée (502 + brouillon orphelin) ou ignorée (client sans pièce jointe).
  it('réponse : le PATCH ne porte AUCUNE pièce, chacune est POSTée dans la collection du brouillon', async () => {
    const { calls, fetch } = trace()
    await graphSend('tok', OUT, { kind: 'reply', providerMessageId: 'AAMk1' }, { fetch: F(fetch) })
    const patch = calls.find((c) => c.method === 'PATCH')!
    expect(patch.body).not.toContain('attachments')
    expect(patch.body).not.toContain('JVBERi0=')
    const post = calls.find((c) => c.url.endsWith('/attachments'))!
    expect(post.method).toBe('POST')
    expect(post.url).toContain('/me/messages/DRAFT1/attachments')
    expect(JSON.parse(post.body)).toMatchObject({ '@odata.type': '#microsoft.graph.fileAttachment', name: 'plan.pdf', contentBytes: 'JVBERi0=' })
    // L'ordre compte : la pièce doit être posée AVANT l'envoi.
    expect(calls.findIndex((c) => c.url.endsWith('/attachments'))).toBeLessThan(calls.findIndex((c) => c.url.endsWith('/send')))
  })
  it('nouveau message : pas de PATCH du tout, et les pièces passent par la collection', async () => {
    const { calls, fetch } = trace()
    await graphSend('tok', OUT, { kind: 'new' }, { fetch: F(fetch) })
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false)
    expect(JSON.parse(calls[0].body).attachments).toBeUndefined()
    expect(calls.some((c) => c.url.endsWith('/attachments') && c.method === 'POST')).toBe(true)
  })
  it('un échec après création SUPPRIME le brouillon — sinon il reste dans les Brouillons de l agent', async () => {
    const calls: { url: string; method: string }[] = []
    const fetch = vi.fn(async (u: string, init?: RequestInit) => {
      calls.push({ url: u, method: init?.method ?? 'GET' })
      if (u.endsWith('/attachments')) return new Response('too big', { status: 413 })
      if (init?.method === 'DELETE') return new Response(null, { status: 204 })
      return okJson({ id: 'DRAFT1' })
    })
    await expect(graphSend('tok', OUT, { kind: 'new' }, { fetch: F(fetch) })).rejects.toThrow(/http 413/)
    expect(calls.some((c) => c.method === 'DELETE' && c.url.includes('/me/messages/DRAFT1'))).toBe(true)
    expect(calls.some((c) => c.url.endsWith('/send'))).toBe(false)
  })
  it('le plafond Graph par pièce est bien « sous 3 Mo »', () => {
    expect(GRAPH_ATTACHMENT_MAX_BYTES).toBe(3 * 1024 * 1024)
  })
})

describe('resolveGraphRemoval', () => {
  it('404 : le message n existe plus ⇒ suppression', async () => {
    const fetch = vi.fn(async () => new Response('not found', { status: 404 }))
    const r = await resolveGraphRemoval('tok', { id: 'X', reason: 'deleted' }, FOLDERS, { fetch: F(fetch) })
    expect(r).toEqual({ kind: 'message_deleted', providerMessageId: 'X' })
  })
  it('200 dans Archive : DÉPLACÉ ⇒ hors réception, jamais supprimé', async () => {
    const fetch = vi.fn(async (u: string) => {
      expect(u).toContain('/me/messages/X')
      return new Response(JSON.stringify({ id: 'X', parentFolderId: 'F-ARC' }), { status: 200 })
    })
    const r = await resolveGraphRemoval('tok', { id: 'X', reason: 'changed' }, FOLDERS, { fetch: F(fetch) })
    expect(r).toEqual({ kind: 'flags', providerMessageId: 'X', inInbox: false, isTrashed: false })
  })
  it('200 dans Éléments supprimés : corbeille, pas destruction', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ id: 'X', parentFolderId: 'F-DEL' }), { status: 200 }))
    const r = await resolveGraphRemoval('tok', { id: 'X', reason: 'changed' }, FOLDERS, { fetch: F(fetch) })
    expect(r).toEqual({ kind: 'flags', providerMessageId: 'X', inInbox: false, isTrashed: true })
  })
  it('erreur autre que 404 : INDÉTERMINÉ, on ne touche à rien', async () => {
    for (const status of [429, 500]) {
      const fetch = vi.fn(async () => new Response('boom', { status }))
      expect(await resolveGraphRemoval('tok', { id: 'X', reason: 'changed' }, FOLDERS, { fetch: F(fetch) })).toBeNull()
    }
  })
  it('401 remonte : c est une reconnexion, pas un doute sur un message', async () => {
    const fetch = vi.fn(async () => new Response('nope', { status: 401 }))
    await expect(resolveGraphRemoval('tok', { id: 'X', reason: 'changed' }, FOLDERS, { fetch: F(fetch) }))
      .rejects.toMatchObject({ code: 'reauth_required' })
  })
})

describe('Prefer: IdType="ImmutableId"', () => {
  // Sans cet en-tête l'id change au déplacement, le GET de `resolveGraphRemoval` sur
  // l'ancien id rend 404, et « archivé » redevient indiscernable de « supprimé ».
  it('part sur CHAQUE appel, et se compose avec odata.maxpagesize', async () => {
    const seen: string[] = []
    const fetch = vi.fn(async (_u: string, init?: RequestInit) => {
      seen.push((init?.headers as Record<string, string>)['Prefer'])
      return new Response(JSON.stringify({ value: [], '@odata.deltaLink': 'https://graph.microsoft.com/v1.0/d?t=1' }), { status: 200 })
    })
    await graphDelta('tok', 'inbox', null, '2026-06-05T00:00:00.000Z', { fetch: F(fetch) })
    expect(seen[0]).toBe(`odata.maxpagesize=50, ${IMMUTABLE_ID_PREFER}`)

    const solo = vi.fn(async (_u: string, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>)['Prefer']).toBe('IdType="ImmutableId"')
      return new Response(JSON.stringify({ id: 'X', parentFolderId: 'F-IN' }), { status: 200 })
    })
    await resolveGraphRemoval('tok', { id: 'X', reason: 'changed' }, FOLDERS, { fetch: F(solo) })
    expect(solo).toHaveBeenCalledOnce()
  })
})

describe('graphDelta', () => {
  it('premier appel : filtre 90 j et taille de page ; suit nextLink ; rend deltaLink', async () => {
    const calls: string[] = []
    const fetch = vi.fn(async (u: string, init?: RequestInit) => {
      calls.push(u)
      expect((init?.headers as Record<string, string>)['Prefer']).toBe(`odata.maxpagesize=50, ${IMMUTABLE_ID_PREFER}`)
      if (calls.length === 1) return new Response(JSON.stringify({ value: [{ id: 'a' }], '@odata.nextLink': 'https://graph.microsoft.com/v1.0/next' }), { status: 200 })
      return new Response(JSON.stringify({ value: [{ id: 'b' }], '@odata.deltaLink': 'https://graph.microsoft.com/v1.0/delta?token=Z' }), { status: 200 })
    })
    const r = await graphDelta('tok', 'inbox', null, '2026-06-05T00:00:00.000Z', { fetch: F(fetch) })
    expect(calls[0]).toContain('/me/mailFolders/inbox/messages/delta?')
    expect(decodeURIComponent(calls[0])).toContain('$filter=receivedDateTime ge 2026-06-05T00:00:00.000Z')
    expect(r.items.map((i) => i.id)).toEqual(['a', 'b'])
    expect(r.deltaLink).toBe('https://graph.microsoft.com/v1.0/delta?token=Z')
  })

  // ⛔ Les URLs absolues rejouées par la synchro viennent du curseur PERSISTÉ. Le jour où
  // un chemin laisserait écrire ce curseur, un `nextLink` chez un tiers enverrait le jeton
  // Graph de l'agent à cet hôte. L'invariant se vérifie au point d'appel, pas ailleurs.
  it('un lien absolu hors graph.microsoft.com n emporte JAMAIS le jeton', async () => {
    for (const evil of [
      'https://evil.example/v1.0/next',
      'https://graph.microsoft.com.evil.example/v1.0/next', // passe un startsWith naïf
      'https://graph.microsoft.com@evil.example/v1.0/next', // userinfo : idem
      'https://GRAPH.microsoft.com.evil.example/next',
    ]) {
      const fetch = vi.fn(async () => new Response('{}', { status: 200 }))
      await expect(graphDelta('tok', 'inbox', evil, '2026-06-05T00:00:00.000Z', { fetch: F(fetch) }), evil)
        .rejects.toThrow(/hôte refusé/)
      expect(fetch, evil).not.toHaveBeenCalled()
    }
  })

  it('un lien absolu chez Graph reste accepté, quelle que soit la casse de l hôte', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ value: [], '@odata.deltaLink': 'https://graph.microsoft.com/v1.0/d' }), { status: 200 }))
    const r = await graphDelta('tok', 'inbox', 'https://GRAPH.microsoft.com/v1.0/next', '2026-06-05T00:00:00.000Z', { fetch: F(fetch) })
    expect(fetch).toHaveBeenCalledOnce()
    expect(r.deltaLink).toBe('https://graph.microsoft.com/v1.0/d')
  })
})

// ⛔ Une boîte sans dossier Archive faisait lever `graphFolderIds` AVANT le premier
// message : `last_error` portait un 404 Graph, le compte restait « active », et comme
// `folderIds` n'est persisté qu'en cas de succès, la passe suivante rejouait la même
// recherche — pour toujours. Or `archive` et `deleteditems` ne servent qu'à CLASSER.
describe('graphFolderIds — deux dossiers portent la synchro, deux la décorent', () => {
  const rep = (f: string, status: number) =>
    status === 200 ? new Response(JSON.stringify({ id: `F-${f}` }), { status }) : new Response('{"error":{"code":"ErrorItemNotFound"}}', { status })
  const serveur = (codes: Record<string, number>) =>
    vi.fn(async (u: string) => {
      const f = String(u.split('/mailFolders/')[1]).split('?')[0]
      return rep(f, codes[f] ?? 200)
    })

  it('un 404 sur Archive dégrade le classement, il n arrête pas la synchro', async () => {
    const fetch = serveur({ archive: 404 })
    const ids = await graphFolderIds('tok', { fetch: F(fetch) })
    expect(ids).toEqual({ inbox: 'F-inbox', sentitems: 'F-sentitems', deleteditems: 'F-deleteditems' })
    expect(fetch).toHaveBeenCalledTimes(4) // la boucle va au bout
  })

  it('la table incomplète ne fait pas d un dossier ABSENT la corbeille', async () => {
    const ids = await graphFolderIds('tok', { fetch: F(serveur({ deleteditems: 404 })) })
    // `undefined === undefined` aurait dit « oui » : un message à parentFolderId absent
    // — la charge utile PARTIELLE est le cas normal du delta — serait passé pour effacé.
    const n = normalizeGraphMessage({ ...M, parentFolderId: undefined }, BODY, [], ids, 'g@agence.ch')
    expect(n.isTrashed).toBe(false)
    expect(n.inInbox).toBe(false)
  })

  it('un 404 sur Réception ou Envoyés LÈVE : sans eux il n y a rien à synchroniser', async () => {
    for (const f of ['inbox', 'sentitems']) {
      await expect(graphFolderIds('tok', { fetch: F(serveur({ [f]: 404 })) }), f).rejects.toThrow(/http 404/)
    }
  })

  it('une panne serveur LÈVE même sur un dossier de confort — 404 n est pas 500', async () => {
    await expect(graphFolderIds('tok', { fetch: F(serveur({ archive: 500 })) })).rejects.toThrow(/http 500/)
  })
})
```

Ajouter `'supabase/functions/_shared/mail/graph.test.ts',` à `vitest.config.ts` ; lancer → FAIL.

- [x] **Step 2 : Implémentation**

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

/**
 * ⛔ SUR CHAQUE APPEL, SANS EXCEPTION. Par défaut l'id d'un message Outlook CHANGE
 * quand l'item change de dossier (« this value changes when the item is moved from one
 * container … to another. To change this behavior, use the Prefer: IdType header »,
 * concepts/outlook-immutable-id). Or le delta est PAR DOSSIER : archiver — le geste
 * Outlook le plus courant — sortait le message de la Réception, qui le signalait
 * `@removed` sous son ANCIEN id ; l'ancien id ne résolvait plus, et le code supprimait
 * la ligne (puis le fil, en cascade). Avec l'id immuable, l'id survit au déplacement,
 * donc un `@removed` peut être LEVÉ EN DOUTE par un simple GET : 404 ⇒ vraiment parti,
 * 200 ⇒ déplacé, et son `parentFolderId` dit où.
 *
 * L'en-tête ne vaut que pour la requête qui le porte. Les `@odata.nextLink` /
 * `@odata.deltaLink` sont compatibles avec les deux formats d'id : aucun resynchro à
 * prévoir. Les dossiers (mailFolder) ne connaissent pas l'id immuable — leurs ids
 * étaient déjà constants, `graphFolderIds` est donc inchangé.
 */
export const IMMUTABLE_ID_PREFER = 'IdType="ImmutableId"'

/** Fusionne notre `Prefer` avec celui de l'appelant (odata.maxpagesize) — un seul en-tête. */
function withImmutableId(headers: Record<string, string> = {}): Record<string, string> {
  const own = headers.Prefer
  return { ...headers, Prefer: own ? `${own}, ${IMMUTABLE_ID_PREFER}` : IMMUTABLE_ID_PREFER }
}

/**
 * ⛔ AUCUN APPEL PORTANT LE JETON NE SORT DE `graph.microsoft.com`.
 *
 * `gcall` accepte une URL ABSOLUE, et ces URLs-là ne viennent pas du code : ce sont les
 * `@odata.nextLink` / `@odata.deltaLink` que `sync.ts` persiste dans
 * `mail_accounts.sync_cursor` et rejoue au tick suivant avec `Authorization: Bearer
 * <jeton Graph de l'utilisateur>`. Aujourd'hui aucun appelant ne peut écrire ce curseur —
 * `sync_cursor` est hors de la liste de colonnes accordée à `authenticated`, et la table
 * n'a aucun grant d'UPDATE : seul le service-role l'écrit. C'est pourquoi ce n'est pas un
 * trou, et c'est aussi pourquoi l'invariant se pose ICI : il suffirait d'un futur chemin
 * qui laisse « réparer » un curseur depuis un corps de requête pour que ce `fetch`
 * devienne une exfiltration de jeton vers l'hôte d'un tiers. Une promesse tenue au
 * bord ne se vérifie pas ; une promesse tenue au point d'appel, si.
 *
 * L'hôte est comparé sur l'URL ANALYSÉE, jamais par préfixe de chaîne :
 * `https://graph.microsoft.com.evil.ch/` et `https://graph.microsoft.com@evil.ch/`
 * passent un `startsWith` naïf.
 */
export function graphUrl(url: string): string {
  const target = url.startsWith('https://') ? url : `${BASE}${url}`
  let host: string
  try { host = new URL(target).host } catch { throw new GraphApiError(0, `graph: URL illisible (${target.slice(0, 60)})`) }
  if (host !== 'graph.microsoft.com') throw new GraphApiError(0, `graph: hôte refusé (${host})`)
  return target
}

async function gcall<T>(token: string, url: string, deps: GraphDeps, init: RequestInit = {}): Promise<T> {
  const f = deps.fetch ?? globalThis.fetch
  const res = await f(graphUrl(url), {
    ...init,
    headers: withImmutableId({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...((init.headers ?? {}) as Record<string, string>) }),
  })
  if (res.status === 401) throw new MailAuthError('reauth_required', 'graph: 401')
  if (res.status === 202 || res.status === 204) return undefined as T
  if (!res.ok) throw new GraphApiError(res.status, `graph ${url.slice(0, 80)}: http ${res.status} ${(await res.text()).slice(0, 200)}`)
  return (await res.json()) as T
}

/**
 * Ids des quatre dossiers connus, résolus une fois puis persistés dans le curseur.
 *
 * ⛔ DEUX SONT PORTEURS, DEUX SONT DE CONFORT — et confondre les deux BRIQUAIT le compte.
 * `inbox` et `sentitems` sont les dossiers que le delta parcourt : sans eux il n'y a rien
 * à synchroniser. `archive` et `deleteditems` ne servent qu'à CLASSER (`inInbox`,
 * `isTrashed`). Or la boucle laissait `gcall` lever sur n'importe lequel des quatre : une
 * boîte sans dossier Archive — ou un 404/403 passager sur une seule recherche — faisait
 * échouer `syncGraph` AVANT le premier message. `syncAccount` écrivait `last_error` et un
 * backoff de 10 minutes, et comme `folderIds` n'est persisté qu'en cas de SUCCÈS, la passe
 * suivante rejouait la même recherche : le compte affichait `active`, portait un 404 Graph
 * en `last_error`, et ne synchronisait plus jamais un seul message.
 *
 * Un id de classement absent vaut donc « ni archivé ni en corbeille » — ce que
 * `sameFolder` traduit déjà d'une clé manquante, sans jamais faire d'`undefined ===
 * undefined` une égalité de dossiers.
 */
export async function graphFolderIds(token: string, deps: GraphDeps = {}): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const f of GRAPH_FOLDERS) {
    const porteur = f === 'inbox' || f === 'sentitems'
    try {
      const j = await gcall<{ id: string }>(token, `/me/mailFolders/${f}?$select=id`, deps)
      out[f] = j.id
    } catch (e) {
      if (porteur || !(e instanceof GraphApiError && (e.status === 404 || e.status === 403))) throw e
      console.error(`[mail graph] dossier ${f} indisponible (http ${e.status}) — classement dégradé, synchro poursuivie`)
    }
  }
  return out
}

/**
 * Deux dossiers sont-ils le même ? ⚠ `a === b` ne suffit PAS : depuis que `graphFolderIds`
 * peut rendre une table incomplète, `undefined === undefined` dirait « oui » — un message
 * à `parentFolderId` absent (charge utile partielle, le cas NORMAL du delta) serait alors
 * déclaré dans la corbeille d'une boîte sans dossier Éléments supprimés.
 */
const sameFolder = (a: string | undefined, b: string | undefined): boolean => !!a && !!b && a === b

/**
 * Une passe de delta : suit les nextLink jusqu'au deltaLink (ou jusqu'à `maxPages`).
 *
 * ⚠ LE `$filter` DE 90 JOURS PLAFONNE L'IMPORT INITIAL À 5 000 MESSAGES PAR DOSSIER, et
 * c'est une limite du fournisseur, pas un défaut d'ici. La page « Get incremental changes
 * to messages in a folder » l'écrit juste après avoir autorisé
 * `$filter=receivedDateTime ge {value}` : « Applying `$filter` in a delta query returns
 * only up to 5,000 messages » (relu le 04.09.2026). Une Réception d'agence chargée dépasse
 * ce compte sur 90 jours ; la passe se termine alors sur un `deltaLink` normal,
 * `initialDone` passe à true, `last_error` reste nul — l'historique est tronqué SANS que
 * rien ne le dise, et Gmail, qui n'a pas d'équivalent, en importe davantage sur la même
 * fenêtre.
 *
 * NON CORRIGÉ, ET C'EST UN CHOIX (04.09.2026) : la seule parade est de retirer le
 * `$filter` et de borner la fenêtre en lisant la date de CHAQUE item — Graph ne garantit
 * l'ordre qu'avec `$orderby=receivedDateTime desc`, donc on ne peut pas s'arrêter au
 * premier message trop vieux. Cela remplace un plafond de 5 000 par le parcours de la
 * boîte ENTIÈRE (dix ans de courrier pour en garder trois mois), au budget de 20 s par
 * compte. Le plafond est le moindre mal tant que l'import initial n'a pas son propre
 * mécanisme de reprise ; ce qu'il faut, c'est que le lot 2 le DISE (« les 5 000 messages
 * les plus récents ») au lieu de laisser croire à un import complet.
 */
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
  // Même en-tête que partout ailleurs : les ids stockés (message ET pièce) viennent
  // d'appels immuables, cette lecture doit vivre dans le même espace d'identifiants.
  const res = await f(`${BASE}/me/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}/$value`, { headers: withImmutableId({ Authorization: `Bearer ${token}` }) })
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
 * Plafond par pièce imposé par Graph : « This operation limits the size of the
 * attachment you can add to under 3 MB » (message: post attachments, v1.0). Au-delà il
 * faut `createUploadSession`, que ce build n'implémente pas — d'où un refus EXPLICITE
 * en amont, dans mail-send, plutôt qu'un 502 illisible au moment de l'envoi.
 */
export const GRAPH_ATTACHMENT_MAX_BYTES = 3 * 1024 * 1024

/**
 * Envoi : brouillon (POST /me/messages ou createReply/createForward) → PATCH du
 * contenu → POST des pièces → POST send. Le brouillon porte notre internetMessageId,
 * ce qui permet de rapprocher la copie « Envoyés » quand le delta la rend.
 *
 * ⛔ LES PIÈCES NE PASSENT PAS PAR LE PATCH. `attachments` est une propriété de
 * NAVIGATION : la référence « Update message » énumère ce qui est modifiable
 * (body, subject, toRecipients, internetMessageId… « Updatable only if isDraft =
 * true ») et `attachments` n'y figure pas. Les deux issues étaient mauvaises et
 * aucune n'était testée : ou Graph refusait le PATCH — 502 `send_failed`, et le
 * brouillon créé par createReply RESTAIT dans les Brouillons de l'agent —, ou il
 * ignorait la propriété et la réponse partait au client SANS sa pièce pendant que le
 * CRM enregistrait `has_attachments = true`. Chaque pièce est donc POSTée dans la
 * collection du brouillon, avant l'envoi.
 *
 * ⛔ Et le brouillon est NETTOYÉ si la suite échoue : sans cela, chaque tentative
 * ratée laissait un brouillon de plus dans la boîte de l'agent, sans rien pour dire
 * d'où il venait.
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
  }
  let draftId: string
  if (mode.kind === 'new') {
    const d = await gcall<{ id: string }>(token, '/me/messages', deps, { method: 'POST', body: JSON.stringify(payload) })
    draftId = d.id
  } else {
    const verb = mode.kind === 'reply' ? 'createReply' : 'createForward'
    const d = await gcall<{ id: string }>(token, `/me/messages/${encodeURIComponent(mode.providerMessageId)}/${verb}`, deps, { method: 'POST', body: '{}' })
    draftId = d.id
  }
  try {
    if (mode.kind !== 'new') {
      await gcall(token, `/me/messages/${encodeURIComponent(draftId)}`, deps, { method: 'PATCH', body: JSON.stringify(payload) })
    }
    for (const a of m.attachments) {
      await gcall(token, `/me/messages/${encodeURIComponent(draftId)}/attachments`, deps, {
        method: 'POST',
        body: JSON.stringify({ '@odata.type': '#microsoft.graph.fileAttachment', name: a.filename, contentType: a.mimeType, contentBytes: a.base64 }),
      })
    }
    await gcall(token, `/me/messages/${encodeURIComponent(draftId)}/send`, deps, { method: 'POST' })
  } catch (e) {
    // Le nettoyage ne doit JAMAIS masquer la cause : son propre échec se journalise,
    // l'erreur d'origine remonte telle quelle.
    try { await gcall(token, `/me/messages/${encodeURIComponent(draftId)}`, deps, { method: 'DELETE' }) }
    catch (e2) { console.error(`[mail graph] brouillon orphelin ${draftId} non supprimé:`, e2 instanceof Error ? e2.message : String(e2)) }
    throw e
  }
  return { draftId }
}

// ── Normalisation (pure) ──────────────────────────────────────────────────────
const addr = (r?: GraphRecipient) => (r?.emailAddress?.address ? { name: r.emailAddress.name || null, email: r.emailAddress.address.toLowerCase() } : null)
const addrs = (rs?: GraphRecipient[]) => (rs ?? []).map(addr).filter((a): a is { name: string | null; email: string } => !!a)

export function normalizeGraphMessage(
  m: GraphMessage, body: GraphBody, atts: GraphAttachment[], folderIds: Record<string, string>, boxEmail: string,
): NormalizedMessage {
  const from = addr(m.from) ?? { name: null, email: '' }
  const inSent = sameFolder(m.parentFolderId, folderIds.sentitems)
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
    inInbox: sameFolder(m.parentFolderId, folderIds.inbox),
    isTrashed: sameFolder(m.parentFolderId, folderIds.deleteditems),
    isDraft: !!m.isDraft,
    providerLabels: m.parentFolderId ? [m.parentFolderId] : [],
    attachments,
  }
}

/** Un item que le delta du dossier ne voit plus : à lever en doute, pas à supprimer. */
export interface GraphRemoval { id: string; reason: string }

/**
 * Items du delta → nouveaux à charger (inconnus) / drapeaux (connus) / DISPARUS.
 *
 * ⛔ Les disparus sortent dans leur propre panier, PAS en `message_deleted`. Le delta
 * est une opération PAR DOSSIER : un message archivé, mis à la corbeille ou rangé dans
 * un dossier personnel quitte la Réception et y est signalé `@removed` exactement comme
 * un message effacé. Les confondre supprimait la ligne — et le fil entier quand c'était
 * le seul message —, si bien qu'archiver un courrier client dans Outlook le faisait
 * disparaître du CRM, de la Réception, du dossier Archivé et de la fiche contact. Même
 * `reason: "changed"`, que Graph documente comme une suppression RESTAURABLE, était
 * détruit. Qui tranche, c'est `resolveGraphRemoval` : un GET sur l'id (immuable, donc
 * il survit au déplacement).
 *
 * ⛔ ET UNE PROPRIÉTÉ ABSENTE N'EST PAS UNE PROPRIÉTÉ FAUSSE. La référence du delta est
 * explicite : « Updated instances are represented by their id with *at least* the
 * updated properties, but other properties might be included » — donc une charge utile
 * PARTIELLE est le cas NORMAL, pas l'exception. Le code construisait pourtant les
 * quatre drapeaux sans condition : `!!it.isRead` sur un `isRead` absent rendait `false`
 * (le CRM remettait en non-lu un message lu), un `flag` absent déétoilait, et surtout
 * un `parentFolderId` absent donnait `inInbox: false, isTrashed: false`, ce que
 * `applyRemoteChanges` écrit en `is_archived = true` : mettre un simple drapeau sur un
 * courrier dans Outlook faisait DISPARAÎTRE la conversation de la Réception du CRM.
 * On n'émet donc que ce que la charge utile PORTE — comme `historyToChanges` (gmail.ts)
 * qui laisse tomber les enregistrements de drapeaux vides.
 */
export function deltaToChanges(items: GraphMessage[], known: Set<string>, folderIds: Record<string, string>): { added: GraphMessage[]; changes: RemoteChange[]; removed: GraphRemoval[] } {
  const added: GraphMessage[] = []
  const changes: RemoteChange[] = []
  const removed: GraphRemoval[] = []
  for (const it of items) {
    if (it['@removed']) { removed.push({ id: it.id, reason: it['@removed'].reason ?? 'unknown' }); continue }
    if (!known.has(it.id)) { added.push(it); continue }
    const f: Extract<RemoteChange, { kind: 'flags' }> = { kind: 'flags', providerMessageId: it.id }
    if ('isRead' in it) f.isRead = !!it.isRead
    if (it.flag) f.isStarred = it.flag.flagStatus === 'flagged'
    // Les deux se lisent sur le MÊME champ : ou il est là, ou aucun des deux n'est su.
    if (it.parentFolderId !== undefined) {
      f.inInbox = sameFolder(it.parentFolderId, folderIds.inbox)
      f.isTrashed = sameFolder(it.parentFolderId, folderIds.deleteditems)
    }
    // `kind` + `providerMessageId` = un changement qui ne change RIEN : inutile de le
    // faire descendre jusqu'à une lecture en base (même seuil que historyToChanges).
    if (Object.keys(f).length > 2) changes.push(f)
  }
  return { added, changes, removed }
}

/**
 * Que faire d'un `@removed` : GET du message par son id immuable.
 *   404            ⇒ il n'existe plus dans la boîte : suppression (`message_deleted`).
 *   200 + dossier  ⇒ il a DÉMÉNAGÉ : on reclasse le fil (archivé / corbeille), on ne
 *                    supprime rien. `graphFolderIds` résout déjà les quatre dossiers.
 *   autre erreur   ⇒ INDÉTERMINÉ : `null`, on ne touche à rien. Détruire sur un 500 ou
 *                    un 429 serait irréversible ; lever bloquerait la boîte à chaque
 *                    passe sur ce seul message. Le delta l'a consommé, mais un état de
 *                    drapeau raté se rattrape, une conversation perdue non.
 * ⚠ Le 401 continue de remonter (MailAuthError levée par `gcall`) : c'est bien une
 * demande de reconnexion, pas une incertitude sur un message.
 */
export async function resolveGraphRemoval(
  token: string, r: GraphRemoval, folderIds: Record<string, string>, deps: GraphDeps = {},
): Promise<RemoteChange | null> {
  let parentFolderId: string | undefined
  try {
    const j = await gcall<{ parentFolderId?: string }>(token, `/me/messages/${encodeURIComponent(r.id)}?$select=id,parentFolderId`, deps)
    parentFolderId = j?.parentFolderId
  } catch (e) {
    if (e instanceof GraphApiError && e.status === 404) return { kind: 'message_deleted', providerMessageId: r.id }
    if (e instanceof GraphApiError) {
      console.error(`[mail graph] @removed ${r.reason} non résolu (http ${e.status}) — aucun changement appliqué`)
      return null
    }
    throw e
  }
  if (!parentFolderId) return null
  return {
    kind: 'flags', providerMessageId: r.id,
    inInbox: sameFolder(parentFolderId, folderIds.inbox),
    isTrashed: sameFolder(parentFolderId, folderIds.deleteditems),
  }
}
```

- [x] **Step 3 : Vert, commit**

```bash
npx vitest run supabase/functions/_shared/mail/graph.test.ts
git add supabase/functions/_shared/mail/graph.ts supabase/functions/_shared/mail/graph.test.ts vitest.config.ts
git commit -m "feat(messagerie): adaptateur Microsoft Graph (delta, corps, pièces, patch/move, envoi)"
```
Attendu : **4** tests PASS (le spec compte 4 `it()`, pas 5).

---

### Task 1.8 : Ingestion — `_shared/mail/ingest.ts`

> ⚠ **Revue adverse « importante » du 04.09.2026 — trois défauts de plus.**
> (1) **`is_archived` ne se recalculait que si le dernier message était ENTRANT.** La
> passe initiale de Gmail liste du plus récent au plus ancien : pour tout fil dont
> l'agent a eu le dernier mot — la plupart des conversations réglées — le semis `false`
> ne pouvait plus jamais être corrigé, et l'import des 90 jours déversait les fils
> archivés dans la Réception. L'état se lit désormais sur le message ENTRANT le plus
> récent. Invisible en incrémental, donc introuvable autrement qu'à l'accueil d'un
> nouvel agent. (2) **`matchContact` jetait l'`error` de ses deux lectures** : un échec
> devenait « aucun contact », et comme `audit()` est gardé par `&& contactId`, le
> courrier n'entrait pas non plus dans la timeline — une trace append-only à laquelle il
> manque une entrée ne se rattrape pas. (3) **`linkThreadToContact` jetait le résultat
> de ses trois écritures** : l'edge répondait `{ ok: true }` alors que l'alias pouvait
> n'avoir pas été appris, donc que le prochain courrier de la même adresse repartirait
> non apparié — précisément le service que le mécanisme existe pour rendre.

> ⚠ **Revue adverse du 04.09.2026 — une injection PostgREST et une suppression sur
> erreur.** (1) Le `.or()` de dédoublonnage recopiait le `Message-ID` de l'expéditeur
> — du texte d'ATTAQUANT, qui traverse même `decodeRfc2047` — dans le paramètre
> `or=(…)` : postgrest-js n'y échappe RIEN (vérifié dans
> `node_modules/@supabase/postgrest-js/dist/index.mjs`, là où `in()` cite les caractères
> réservés). Une virgule ajoutait un terme au OU, un `provider_message_id.not.is.null`
> rendait un message quelconque de la boîte, et la suite l'écrasait avec le contenu de
> l'attaquant en supprimant ses pièces : un e-mail reçu, une conversation cliente
> détruite. Une virgule NUE, elle, rendait le filtre invalide — 400 jeté faute d'être
> destructuré, insertion, 23505, et la boîte ne se synchronisait plus jamais. Remplacé
> par deux `.eq()` séparés (`findKnownMessage`), dont les valeurs sont percent-encodées.
> (2) `recomputeThread` lisait `!msgs` comme « fil vide » et SUPPRIMAIT le fil : un
> timeout ou un cache de schéma PostgREST périmé — donc les minutes qui suivent le
> déploiement de la migration — effaçait objet, corps et pièces par les deux
> `on delete cascade`. La suppression est maintenant conditionnée à un compte de zéro
> positivement constaté. Toutes les lectures et écritures de ce fichier vérifient leur
> `error` et lèvent ; le catch de `syncAccount` en fait `last_error` + backoff.

**Files:**
- Create: `supabase/functions/_shared/mail/ingest.ts`
- Test: `supabase/functions/_shared/mail/ingest.test.ts`
- Modify: `vitest.config.ts`

- [x] **Step 1 : Test des parties pures (rouge)**

```ts
// supabase/functions/_shared/mail/ingest.test.ts
import { describe, it, expect } from 'vitest'
import { deriveThreadPatch, externalParticipants, ingestMessages, linkThreadToContact, pickContact, capHtml, recomputeThread, type ThreadRow } from './ingest.ts'
import type { MailAccountRow, NormalizedMessage } from './types.ts'

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

  // ⛔ Le fil archivé dont le DERNIER mot est celui de l'agent. La passe initiale de
  // Gmail liste du plus récent au plus ancien : le premier message ingéré est le
  // sortant, et l'ancienne condition (`inbound && plus récent`) ne laissait plus
  // AUCUN message décider ensuite — `is_archived` restait à `false` et le fil clos
  // remontait dans la Réception du CRM. Ce test rejoue exactement cet ordre.
  it('import initial, dernier mot à l agent : le fil suit son message ENTRANT le plus récent', () => {
    const sortant = msg({
      providerMessageId: 'm2', direction: 'outbound', from: { name: 'G', email: BOX },
      to: [{ name: 'Zoé', email: 'zoe@ex.ch' }], sentAt: '2026-09-03T09:00:00.000Z',
      isRead: true, inInbox: false,
    })
    const semis = { ...(deriveThreadPatch(null, sortant, BOX, true) as ThreadRow), id: 'T', account_id: 'A', label_id: null, contact_id: null }
    expect(semis.is_archived).toBe(false) // rien ne le sait encore : aucun entrant lu
    // Message suivant de la MÊME passe : l'entrant, plus ancien, sans libellé INBOX.
    const entrant = msg({ providerMessageId: 'm1', inInbox: false, isRead: true, sentAt: '2026-09-03T08:00:00.000Z' })
    expect(deriveThreadPatch(semis, entrant, BOX, true).is_archived).toBe(true)
  })
  it('un entrant PLUS ANCIEN que le dernier entrant connu ne décide plus de l archivage', () => {
    const recent = { ...(deriveThreadPatch(null, msg(), BOX, true) as ThreadRow), id: 'T', account_id: 'A', label_id: null, contact_id: null }
    expect(recent.is_archived).toBe(false) // le plus récent est en Réception
    const vieux = msg({ providerMessageId: 'm0', inInbox: false, sentAt: '2026-09-01T08:00:00.000Z' })
    expect(deriveThreadPatch(recent, vieux, BOX, true).is_archived).toBe(false)
  })
  it('un message SORTANT ne peut ni archiver ni désarchiver le fil', () => {
    const archive = { ...(deriveThreadPatch(null, msg({ inInbox: false }), BOX, true) as ThreadRow), id: 'T', account_id: 'A', label_id: null, contact_id: null }
    expect(archive.is_archived).toBe(true)
    const reponse = msg({ providerMessageId: 'm3', direction: 'outbound', from: { name: 'G', email: BOX }, sentAt: '2026-09-04T08:00:00.000Z', inInbox: false, isRead: true })
    expect(deriveThreadPatch(archive, reponse, BOX, true).is_archived).toBe(true)
  })

  // ⛔ LE PIÈGE QUE LES FIXTURES CI-DESSUS NE POUVAIENT PAS VOIR : elles écrivent la forme
  // `Z` des DEUX côtés. En vrai, `m.sentAt` vient de `toISOString()`
  // (`…T08:00:00.000Z`) et `existing.last_*_at` vient de PostgREST, qui rend un
  // `timestamptz` en `…T08:00:00+00:00`. Comparées en CHAÎNES, les deux divergent à
  // l'index 19 — c'est le préfixe date-heure qui décidait, et à la seconde près
  // `'.' > '+'` faisait toujours gagner l'entrant. Ces trois cas comparent des INSTANTS.
  describe('les dates du fil viennent de PostgREST, pas de toISOString', () => {
    const enBase = (m: NormalizedMessage): ThreadRow => {
      const p = deriveThreadPatch(null, m, BOX, true) as ThreadRow
      // Ce que PostgREST rend RÉELLEMENT pour un timestamptz sous une session UTC.
      const pg = (iso: string | null) => (iso ? iso.replace(/\.\d{3}Z$/, '+00:00') : iso)
      return { ...p, id: 'T', account_id: 'A', label_id: null, contact_id: null,
        last_message_at: pg(p.last_message_at)!, last_inbound_at: pg(p.last_inbound_at), last_outbound_at: pg(p.last_outbound_at) }
    }
    it('à la seconde PRÈS, un message plus ancien ne devient pas le dernier du fil', () => {
      const existing = enBase(msg({ snippet: 'Le vrai dernier' }))
      expect(existing.last_message_at).toBe('2026-09-03T08:00:00+00:00')
      // MÊME seconde, mais c'est déjà connu : rien ne doit rétrograder.
      const jumeau = msg({ providerMessageId: 'm9', snippet: 'Jumeau', sentAt: '2026-09-03T08:00:00.000Z' })
      expect(deriveThreadPatch(existing, jumeau, BOX, false).last_message_at).toBe('2026-09-03T08:00:00.000Z')
      // Plus ANCIEN d'une seconde : le fil garde sa date et son extrait.
      const vieux = msg({ providerMessageId: 'm0', snippet: 'Vieux', sentAt: '2026-09-03T07:59:59.000Z' })
      const p = deriveThreadPatch(existing, vieux, BOX, true)
      expect(p.last_message_at).toBe('2026-09-03T08:00:00+00:00')
      expect(p.snippet).toBe('Le vrai dernier')
    })
    it('last_inbound_at et last_outbound_at gardent le plus récent des deux formes', () => {
      const existing = enBase(msg())
      const vieuxEntrant = msg({ providerMessageId: 'm0', sentAt: '2026-09-02T08:00:00.000Z' })
      expect(deriveThreadPatch(existing, vieuxEntrant, BOX, true).last_inbound_at).toBe('2026-09-03T08:00:00+00:00')
      const sortantRecent = msg({ providerMessageId: 'm2', direction: 'outbound', from: { name: 'G', email: BOX }, sentAt: '2026-09-04T08:00:00.000Z' })
      expect(deriveThreadPatch(existing, sortantRecent, BOX, true).last_outbound_at).toBe('2026-09-04T08:00:00.000Z')
    })
    it('un entrant plus ancien ne décide toujours pas de l archivage sous la forme PostgREST', () => {
      const existing = enBase(msg()) // le plus récent est en Réception
      const vieux = msg({ providerMessageId: 'm0', inInbox: false, sentAt: '2026-09-01T08:00:00.000Z' })
      expect(deriveThreadPatch(existing, vieux, BOX, true).is_archived).toBe(false)
    })

    // ⛔ LE CAS QUI SÉPARE VRAIMENT LES DEUX IMPLÉMENTATIONS. Sous une session non UTC,
    // PostgREST rend le MÊME instant en `+02:00`. Comparé en chaînes,
    // `'2026-09-03T09:00:00.000Z' >= '2026-09-03T10:00:00+02:00'` est FAUX (divergence dès
    // l'heure) : un message POSTÉRIEUR d'une heure cessait de mettre le fil à jour — ni sa
    // date, ni son extrait, ni son état d'archivage. Comparés en instants, 09:00Z suit bien
    // 10:00+02:00 (soit 08:00Z).
    it('un fuseau de session non UTC ne renverse pas l ordre du fil', () => {
      const existing: ThreadRow = {
        ...(deriveThreadPatch(null, msg(), BOX, true) as ThreadRow),
        id: 'T', account_id: 'A', label_id: null, contact_id: null,
        last_message_at: '2026-09-03T10:00:00+02:00', // = 08:00Z, le même instant qu'au-dessus
        last_inbound_at: '2026-09-03T10:00:00+02:00',
      }
      const suivant = msg({ providerMessageId: 'm2', snippet: 'Le plus récent', inInbox: false, sentAt: '2026-09-03T09:00:00.000Z' })
      const p = deriveThreadPatch(existing, suivant, BOX, true)
      expect(p.last_message_at).toBe('2026-09-03T09:00:00.000Z')
      expect(p.last_inbound_at).toBe('2026-09-03T09:00:00.000Z')
      expect(p.snippet).toBe('Le plus récent')
      expect(p.is_archived).toBe(true)
    })
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

// ── Faux client PostgREST : on veut voir les REQUÊTES, pas simuler une base ────
// Chaque appel est enregistré sous la forme (table, opération, filtres) ; un
// « or » y apparaîtrait sous ce nom, ce qui rend le défaut d'injection visible
// depuis un test au lieu d'être une lecture de code.
interface FakeCall { table: string; op: string; filters: [string, unknown][] }
type Reply = { data: unknown; error: { message: string } | null }

function fakeAdmin(reply: (c: FakeCall) => Reply, rpcReply: () => Reply = () => ({ data: [], error: null })) {
  const calls: FakeCall[] = []
  const from = (table: string) => {
    const rec: FakeCall = { table, op: '', filters: [] }
    const settle = () => { calls.push(rec); return reply(rec) }
    const b = {
      select: () => { if (!rec.op) rec.op = 'select'; return b },
      insert: () => { rec.op = 'insert'; return b },
      update: () => { rec.op = 'update'; return b },
      upsert: () => { rec.op = 'upsert'; return b },
      delete: () => { rec.op = 'delete'; return b },
      eq: (col: string, val: unknown) => { rec.filters.push([`eq:${col}`, val]); return b },
      in: (col: string, val: unknown) => { rec.filters.push([`in:${col}`, val]); return b },
      is: (col: string, val: unknown) => { rec.filters.push([`is:${col}`, val]); return b },
      or: (f: string) => { rec.filters.push(['or', f]); return b },
      order: () => b,
      limit: () => b,
      maybeSingle: async () => settle(),
      single: async () => settle(),
      then: (res: (v: Reply) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve().then(settle).then(res, rej),
    }
    return b
  }
  const rpc = async () => rpcReply()
  return { admin: { from, rpc } as never, calls }
}

const account: MailAccountRow = {
  id: 'acc-1', agency_id: 'ag-1', owner_id: 'u-1', provider: 'gmail', email: BOX,
  display_name: null, visibility: 'owner', status: 'active', vault_secret_id: 'v-1',
  sync_cursor: {}, next_sync_at: '', last_sync_at: null, last_error: null, imap_config: null,
}
const vide = (c: FakeCall): Reply =>
  c.op === 'insert' ? { data: { id: `${c.table}-1` }, error: null }
    : c.op === 'select' && c.table === 'mail_contact_aliases' ? { data: [], error: null }
      : { data: null, error: null }

describe('ingestMessages : recherche du message déjà connu', () => {
  // ⛔ Le filtre était construit par concaténation dans `.or()`, que postgrest-js
  // recopie tel quel dans l'URL (aucun échappement, contrairement à `.in()`). Le
  // `Message-ID` d'un e-mail entrant est du texte d'ATTAQUANT : une virgule y
  // ajoutait un terme au OU, `provider_message_id.not.is.null` rendait un message
  // quelconque de la boîte, et la suite l'écrasait avec le contenu de l'attaquant.
  const PIEGE = '<a),provider_message_id.not.is.null,and(id.not.is.null'

  it('un Message-ID piégé ne peut désigner aucune autre ligne : deux .eq(), jamais de .or()', async () => {
    const { admin, calls } = fakeAdmin(vide)
    await ingestMessages(admin, account, [msg({ providerMessageId: 'm-neuf', rfc822MessageId: PIEGE })])

    expect(calls.some((c) => c.filters.some(([k]) => k === 'or'))).toBe(false)
    const lookups = calls.filter((c) => c.table === 'mail_messages' && c.op === 'select')
    expect(lookups).toHaveLength(2)
    // Le texte de l'attaquant reste UNE valeur, dans un paramètre à lui.
    expect(lookups[0].filters).toEqual([['eq:account_id', 'acc-1'], ['eq:provider_message_id', 'm-neuf']])
    expect(lookups[1].filters).toEqual([['eq:account_id', 'acc-1'], ['eq:provider_message_id', `pending:${PIEGE}`]])
    // Et il ne s'échappe nulle part ailleurs : aucune requête ne le porte comme filtre
    // structurel, seulement comme valeur de `provider_message_id`.
    for (const c of calls) {
      for (const [cle, val] of c.filters) {
        if (typeof val === 'string' && val.includes(PIEGE)) expect(cle).toBe('eq:provider_message_id')
      }
    }
  })

  it('la boîte est TOUJOURS dans le filtre : un message piégé ne sort pas du compte', async () => {
    const { admin, calls } = fakeAdmin(vide)
    await ingestMessages(admin, account, [msg({ rfc822MessageId: PIEGE })])
    for (const c of calls.filter((x) => x.table === 'mail_messages' && x.op === 'select')) {
      expect(c.filters[0]).toEqual(['eq:account_id', 'acc-1'])
    }
  })

  it('sans rfc822MessageId, une seule lecture', async () => {
    const { admin, calls } = fakeAdmin(vide)
    await ingestMessages(admin, account, [msg({ rfc822MessageId: null })])
    expect(calls.filter((c) => c.table === 'mail_messages' && c.op === 'select')).toHaveLength(1)
  })

  it('un message déjà connu arrête la recherche à la première lecture', async () => {
    const { admin, calls } = fakeAdmin((c) =>
      c.table === 'mail_messages' && c.op === 'select'
        ? { data: { id: 'M1', thread_id: 'T1', provider_message_id: 'm1' }, error: null }
        : vide(c))
    await ingestMessages(admin, account, [msg()])
    expect(calls.filter((c) => c.table === 'mail_messages' && c.op === 'select')).toHaveLength(1)
  })

  it('une erreur PostgREST est LEVÉE, jamais lue comme « message inconnu »', async () => {
    // Avaler l'erreur menait à une insertion, donc au 23505 de l'index unique, donc à
    // une passe qui mourait à chaque tick : la boîte ne se synchronisait plus jamais.
    const { admin } = fakeAdmin((c) =>
      c.table === 'mail_messages' && c.op === 'select' ? { data: null, error: { message: 'boom' } } : vide(c))
    await expect(ingestMessages(admin, account, [msg()])).rejects.toThrow(/message lookup: boom/)
  })
})

describe('recomputeThread', () => {
  it('une lecture en échec ne supprime RIEN — elle lève', async () => {
    // `!msgs` valait « fil vide » : un timeout ou un cache de schéma périmé suffisait à
    // effacer le fil, et les deux `on delete cascade` emportaient corps et pièces.
    const { admin, calls } = fakeAdmin((c) =>
      c.table === 'mail_messages' ? { data: null, error: { message: 'timeout' } } : vide(c))
    await expect(recomputeThread(admin, 'T1')).rejects.toThrow(/recompute select: timeout/)
    expect(calls.some((c) => c.op === 'delete')).toBe(false)
  })

  it('zéro message POSITIVEMENT constaté : là, le fil est supprimé', async () => {
    const { admin, calls } = fakeAdmin((c) =>
      c.table === 'mail_messages' ? { data: [], error: null } : { data: null, error: null })
    await recomputeThread(admin, 'T1')
    expect(calls.filter((c) => c.table === 'mail_threads' && c.op === 'delete')).toHaveLength(1)
  })

  it('des messages : agrégats recalculés, aucune suppression', async () => {
    const { admin, calls } = fakeAdmin((c) =>
      c.table === 'mail_messages'
        ? { data: [{ sent_at: '2026-09-03T08:00:00.000Z', direction: 'inbound', is_read: true, has_attachments: false, snippet: 'a' }], error: null }
        : { data: null, error: null })
    await recomputeThread(admin, 'T1')
    expect(calls.some((c) => c.op === 'delete')).toBe(false)
    expect(calls.filter((c) => c.table === 'mail_threads' && c.op === 'update')).toHaveLength(1)
  })
})


// ⛔ « Je n'ai pas pu chercher » n'est pas « il n'y a personne ». Une erreur avalée
// écrivait `contact_id: null` sur le fil ET sur le message, et sautait l'événement
// d'audit (gardé par `&& contactId`) : une trace append-only à laquelle il manque une
// entrée ne se rattrape pas, même quand la passe suivante rattache enfin le fil.
describe('matchContact : une recherche en échec est LEVÉE', () => {
  it('RPC de rapprochement en erreur', async () => {
    const { admin } = fakeAdmin(vide, () => ({ data: null, error: { message: 'rpc down' } }))
    await expect(ingestMessages(admin, account, [msg()])).rejects.toThrow(/contact match: rpc down/)
  })
  it('lecture des alias appris en erreur', async () => {
    const { admin } = fakeAdmin((c) =>
      c.table === 'mail_contact_aliases' ? { data: null, error: { message: 'alias down' } } : vide(c))
    await expect(ingestMessages(admin, account, [msg()])).rejects.toThrow(/contact alias match: alias down/)
  })
})

describe('linkThreadToContact : « Rapprocher l adresse » ne dit plus ok sur un travail non fait', () => {
  const ok = (c: FakeCall): Reply =>
    c.table === 'contacts' ? { data: { id: 'c1' }, error: null }
      : c.table === 'mail_threads' && c.op === 'update' ? { data: [{ id: 'T1' }], error: null }
        : { data: null, error: null }

  it('le chemin nominal apprend l alias, rattache le fil et complète les messages', async () => {
    const { admin, calls } = fakeAdmin(ok)
    await linkThreadToContact(admin, account, 'T1', 'c1', 'Zoe@Ex.ch', 'u-1')
    expect(calls.map((c) => `${c.table}:${c.op}`)).toEqual([
      'contacts:select', 'mail_contact_aliases:upsert', 'mail_threads:update', 'mail_messages:update',
    ])
  })
  it('alias refusé : levée — sinon le PROCHAIN courrier de l adresse repart non apparié', async () => {
    const { admin } = fakeAdmin((c) =>
      c.table === 'mail_contact_aliases' ? { data: null, error: { message: 'duplicate key' } } : ok(c))
    await expect(linkThreadToContact(admin, account, 'T1', 'c1', 'zoe@ex.ch', 'u-1')).rejects.toThrow(/alias upsert: duplicate key/)
  })
  it('aucun fil apparié (fil d un autre compte) : levée, jamais un ok:true', async () => {
    const { admin } = fakeAdmin((c) =>
      c.table === 'mail_threads' && c.op === 'update' ? { data: [], error: null } : ok(c))
    await expect(linkThreadToContact(admin, account, 'T-autre', 'c1', 'zoe@ex.ch', 'u-1')).rejects.toThrow(/thread_not_in_account/)
  })
  it('complément des messages en erreur : levée', async () => {
    const { admin } = fakeAdmin((c) =>
      c.table === 'mail_messages' && c.op === 'update' ? { data: null, error: { message: 'boom' } } : ok(c))
    await expect(linkThreadToContact(admin, account, 'T1', 'c1', 'zoe@ex.ch', 'u-1')).rejects.toThrow(/messages backfill: boom/)
  })
  it('lecture du contact en erreur : ce n est PAS « hors agence »', async () => {
    const { admin } = fakeAdmin((c) =>
      c.table === 'contacts' ? { data: null, error: { message: 'timeout' } } : ok(c))
    await expect(linkThreadToContact(admin, account, 'T1', 'c1', 'zoe@ex.ch', 'u-1')).rejects.toThrow(/contact lookup: timeout/)
  })
})
```

Ajouter `'supabase/functions/_shared/mail/ingest.test.ts',` à `vitest.config.ts` ; lancer → FAIL.

- [x] **Step 2 : Implémentation**

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

/**
 * ⛔ ON COMPARE DES INSTANTS, PAS DES CHAÎNES — les deux côtés ne parlent pas la même
 * langue. `m.sentAt` sort d'un `new Date().toISOString()`
 * (`2026-09-03T08:00:00.000Z`) ; `existing.last_message_at` sort de PostgREST, qui
 * sérialise un `timestamptz` selon le fuseau de la SESSION
 * (`2026-09-03T08:00:00+00:00`). Les deux chaînes divergent à l'index 19 (`.` contre
 * `+`), si bien que `>=` n'était juste QUE par le préfixe date-heure : à la seconde
 * près, `'.' > '+'` faisait toujours gagner le message entrant. Sous une session non
 * UTC, PostgREST rendrait `+02:00` et l'ordre serait faux de deux heures — le fil
 * cesserait de suivre son dernier message. Les tests unitaires ne le voient pas : leurs
 * fixtures écrivent la forme `Z` des deux côtés ; seul un aller-retour réel l'expose.
 *
 * ⚠ `laterThan(iso, at)` répond « cet ISO est POSTÉRIEUR à cet instant ». Une date
 * illisible (`NaN`) vaut « le message entrant est le plus récent », comme un `existing`
 * absent : le défaut écrit une valeur fraîche au lieu d'en figer une vieille.
 */
const laterThan = (iso: string | null | undefined, at: number): boolean => !!iso && Date.parse(iso) > at

/** Dérive l'état du fil après ce message. `isNew` = le message n'était pas connu. */
export function deriveThreadPatch(existing: ThreadRow | null, m: NormalizedMessage, boxEmail: string, isNew: boolean): ThreadPatch {
  const parts = externalParticipants(m, boxEmail)
  const at = Date.parse(m.sentAt)
  const newer = !existing || !laterThan(existing.last_message_at, at)
  const mergedParticipants = (() => {
    const acc: MailAddress[] = [...(existing?.participants ?? [])]
    for (const p of parts) if (!acc.some((x) => x.email === p.email)) acc.push(p)
    return acc.slice(0, 8)
  })()
  const inboundSender = m.direction === 'inbound' ? m.from : null
  const from = inboundSender && (newer || !existing?.from_email) ? inboundSender : (existing ? { name: existing.from_name, email: existing.from_email ?? '' } : (parts[0] ?? { name: null, email: '' }))
  /**
   * ⛔ « ARCHIVÉ » SE LIT SUR LE MESSAGE ENTRANT LE PLUS RÉCENT, jamais sur le dernier
   * message tout court. La condition était `m.direction === 'inbound' && newer` : dès
   * que le dernier mot du fil était celui de l'AGENT, plus aucun message ne pouvait
   * jamais décider, et `is_archived` restait à sa valeur de semis. Or la passe
   * initiale de Gmail liste du plus récent au plus ancien : le premier message ingéré
   * d'un tel fil est sortant, `existing` est null, `is_archived` naît donc `false` —
   * et les messages suivants, plus vieux, ne peuvent plus le corriger même s'ils
   * n'ont AUCUN libellé INBOX. Comme « l'agent a eu le dernier mot » décrit la
   * plupart des conversations réglées, le tout premier écran après la connexion d'une
   * boîte était une Réception pleine de fils clos vieux de plusieurs mois, et Archivé
   * quasi vide. Invisible en incrémental — `applyRemoteChanges` traite bien un archivage
   * ultérieur — donc introuvable autrement qu'à l'accueil d'un nouvel agent.
   */
  const newestInbound = m.direction === 'inbound' && !laterThan(existing?.last_inbound_at, at)
  return {
    subject: existing?.subject ?? m.subject,
    snippet: newer ? m.snippet : (existing?.snippet ?? m.snippet),
    participants: mergedParticipants,
    from_name: from.name,
    from_email: from.email || null,
    last_message_at: newer ? m.sentAt : existing!.last_message_at,
    last_inbound_at: m.direction === 'inbound'
      ? (laterThan(existing?.last_inbound_at, at) ? existing!.last_inbound_at : m.sentAt)
      : (existing?.last_inbound_at ?? null),
    last_outbound_at: m.direction === 'outbound'
      ? (laterThan(existing?.last_outbound_at, at) ? existing!.last_outbound_at : m.sentAt)
      : (existing?.last_outbound_at ?? null),
    message_count: (existing?.message_count ?? 0) + (isNew ? 1 : 0),
    has_attachments: (existing?.has_attachments ?? false) || m.attachments.some((a) => !a.isInline),
    is_read: (existing?.is_read ?? true) && m.isRead,
    is_starred: (existing?.is_starred ?? false) || m.isStarred,
    is_archived: newestInbound ? (!m.inInbox && !m.isTrashed) : (existing?.is_archived ?? false),
    is_trashed: newer ? m.isTrashed : (existing?.is_trashed ?? false),
  }
}

export function pickContact(rows: { contact_id: string }[]): string | null {
  const ids = Array.from(new Set(rows.map((r) => r.contact_id)))
  return ids.length === 1 ? ids[0] : null
}

/**
 * Cherche LE contact d'une adresse, dans la fiche puis dans les alias appris.
 *
 * ⚠ La recherche dans `contacts` passe par la RPC `mail_match_contact_by_emails` et
 * non par un `.in('email', …)`. Deux raisons mesurées le 03.09.2026, la première
 * muette : (1) `.in('email', …)` compare EN RESPECTANT LA CASSE et rien ne normalise
 * `contacts.email` à l'écriture — un contact « Jean.Dupont@ex.ch » ne serait jamais
 * rattaché à un « jean.dupont@ex.ch » entrant, sans erreur, le fil restant « Adresse
 * non rattachée » ; (2) l'index est `btree (agency_id, lower(email))`, une EXPRESSION,
 * qu'un prédicat sur la colonne nue ne peut pas utiliser — et ce chemin tourne à
 * chaque message de chaque synchro.
 *
 * `mail_contact_aliases`, lui, garde son filtre direct : sa colonne porte un CHECK
 * `email = lower(email)` et son index unique est sur la colonne nue.
 */
async function matchContact(admin: SupabaseClient, agencyId: string, emails: string[]): Promise<string | null> {
  if (emails.length === 0) return null
  const lowered = emails.map((e) => e.toLowerCase())
  // ⛔ « JE N'AI PAS PU CHERCHER » N'EST PAS « IL N'Y A PERSONNE ». Les deux lectures
  // laissaient tomber leur `error` : sur un échec, `contact_id` était écrit null sur le
  // fil ET sur le message, et comme `audit()` est gardé par `&& contactId`, le courrier
  // n'entrait pas non plus dans la timeline du contact — une trace d'audit
  // append-only à laquelle il manque une entrée ne se rattrape pas, même si la passe
  // suivante rattache enfin le fil. L'agent, lui, lisait « Adresse non rattachée » sur
  // un contact parfaitement appariable, sans un mot nulle part. Ironie du fichier :
  // trente lignes plus haut, on corrige une AUTRE cause du même symptôme muet.
  const { data: direct, error: eDirect } = await admin.rpc('mail_match_contact_by_emails', { p_agency_id: agencyId, p_emails: lowered })
  if (eDirect) throw new Error(`contact match: ${eDirect.message}`)
  const byContact = pickContact(((direct ?? []) as string[]).map((id) => ({ contact_id: id })))
  if (byContact) return byContact
  const { data: alias, error: eAlias } = await admin.from('mail_contact_aliases').select('contact_id').eq('agency_id', agencyId).in('email', lowered)
  if (eAlias) throw new Error(`contact alias match: ${eAlias.message}`)
  return pickContact((alias ?? []) as { contact_id: string }[])
}

/**
 * Écrit l'entrée de timeline. Rend `false` si `activity_events` a refusé la ligne.
 *
 * ⚠ ON CONTINUE SUR ÉCHEC — perdre le courrier pour sauver la ligne d'audit serait pire —
 * MAIS ON LE COMPTE. `console.error` seul rendait l'échec INDÉCOUVRABLE : il atterrit dans
 * les journaux d'edge, que rien n'alerte, et le `SyncOutcome` du balayage ne portait aucun
 * compteur. Dans un produit LAB/KYC où CLAUDE.md fait de `activity_events` la trace de
 * CHAQUE action, un courrier reçu sans son entrée de timeline se découvre à l'audit, des
 * mois plus tard. Le compte remonte désormais jusqu'au `results` de `mail-sync`.
 */
async function audit(admin: SupabaseClient, account: MailAccountRow, action: 'email_received' | 'email_sent', threadId: string, messageId: string, contactId: string, m: NormalizedMessage): Promise<boolean> {
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
  if (error) console.error(`[mail ingest] activity_events refuse ${action} (fil ${threadId}, message ${messageId}):`, error.message)
  return !error
}

export interface IngestOptions {
  /** true = ne journalise pas (mail-send écrit lui-même l'événement avec l'acteur). */
  skipAudit?: boolean
}

interface KnownMessageRow { id: string; thread_id: string; provider_message_id: string }

/**
 * Le message est-il déjà en base ? Deux lectures `.eq()` SÉPARÉES, jamais un `.or()`.
 *
 * ⛔ `.or('provider_message_id.eq.X,and(provider_message_id.eq.pending:Y)')` recopiait
 * `Y` — l'en-tête `Message-ID` de l'EXPÉDITEUR, du texte d'attaquant qui traverse même
 * `decodeRfc2047` — tel quel dans le paramètre `or=(…)` : postgrest-js n'échappe rien
 * dans `or()` (contrairement à `in()`, qui cite les caractères réservés). Une virgule
 * suffisait à ajouter un terme au OU : `Message-ID: <a),provider_message_id.not.is.null`
 * rendait un message QUELCONQUE de la boîte, que la suite écrasait avec le contenu de
 * l'attaquant (`update … .eq('id', known.id)`) et dont elle supprimait les pièces —
 * un e-mail reçu, une conversation cliente détruite. Une virgule NUE, elle, rendait le
 * filtre invalide : PostgREST 400, erreur jetée faute d'être destructurée, insertion,
 * puis 23505 à chaque tick — la boîte ne se synchronisait plus jamais.
 *
 * Une valeur dans un paramètre `col=eq.valeur` est percent-encodée par URLSearchParams :
 * elle ne peut ni ouvrir un terme ni en fermer un. Et l'erreur est LEVÉE, pour qu'un
 * défaut futur casse bruyamment au lieu de se déguiser en « message inconnu ».
 */
async function findKnownMessage(admin: SupabaseClient, accountId: string, m: NormalizedMessage): Promise<KnownMessageRow | null> {
  const base = () => admin.from('mail_messages').select('id, thread_id, provider_message_id').eq('account_id', accountId)
  const { data: byProvider, error: e1 } = await base().eq('provider_message_id', m.providerMessageId).maybeSingle()
  if (e1) throw new Error(`message lookup: ${e1.message}`)
  if (byProvider) return byProvider as KnownMessageRow
  if (!m.rfc822MessageId) return null
  const { data: byPending, error: e2 } = await base().eq('provider_message_id', `pending:${m.rfc822MessageId}`).maybeSingle()
  if (e2) throw new Error(`message lookup (pending): ${e2.message}`)
  return (byPending as KnownMessageRow | null) ?? null
}

/** Ingère des messages normalisés (idempotent sur (account_id, provider_message_id)). */
export async function ingestMessages(admin: SupabaseClient, account: MailAccountRow, msgs: NormalizedMessage[], opts: IngestOptions = {}): Promise<{ inserted: number; updated: number; auditFailures: number }> {
  let inserted = 0
  let updated = 0
  let auditFailures = 0
  for (const m of msgs) {
    if (m.isDraft) continue

    // Message déjà connu ? (ou copie « Envoyés » d'un envoi CRM en attente : pending:<Message-ID>)
    const known = await findKnownMessage(admin, account.id, m)
    const isNew = !known

    if (known && known.provider_message_id.startsWith('pending:')) {
      // Copie « Envoyés » d'un envoi CRM (Graph) : le fil provisoire prend l'id de
      // conversation réel s'il n'existe pas encore sous ce nom.
      const { data: real, error: eReal } = await admin.from('mail_threads').select('id').eq('account_id', account.id).eq('provider_thread_id', m.providerThreadId).maybeSingle()
      if (eReal) throw new Error(`thread lookup (pending): ${eReal.message}`)
      if (!real) {
        const { error } = await admin.from('mail_threads').update({ provider_thread_id: m.providerThreadId }).eq('id', known.thread_id)
        if (error) throw new Error(`thread rename: ${error.message}`)
      }
    }

    // Fil — une lecture en échec vaudrait « fil inconnu », donc une INSERTION d'un
    // fil jumeau (ou un 23505) : on lève au lieu de deviner.
    const { data: existing, error: eThread } = await admin.from('mail_threads').select('*').eq('account_id', account.id).eq('provider_thread_id', m.providerThreadId).maybeSingle()
    if (eThread) throw new Error(`thread lookup: ${eThread.message}`)
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
    const { error: eDelAtt } = await admin.from('mail_attachments').delete().eq('message_id', messageId)
    if (eDelAtt) throw new Error(`attachments delete: ${eDelAtt.message}`)
    if (m.attachments.length) {
      const { error } = await admin.from('mail_attachments').insert(m.attachments.map((a) => ({
        message_id: messageId, account_id: account.id, agency_id: account.agency_id,
        provider_attachment_id: a.providerAttachmentId, filename: a.filename, mime_type: a.mimeType,
        size_bytes: a.sizeBytes, is_inline: a.isInline, content_id: a.contentId,
      })))
      if (error) throw new Error(`attachments insert: ${error.message}`)
    }

    if (isNew && contactId && !opts.skipAudit) {
      if (!await audit(admin, account, m.direction === 'inbound' ? 'email_received' : 'email_sent', threadId, messageId, contactId, m)) auditFailures++
    }
  }
  return { inserted, updated, auditFailures }
}

/**
 * Recalcule les agrégats d'un fil depuis ses messages ; supprime le fil s'il est vide.
 *
 * ⛔ La suppression est conditionnée à un COMPTE de zéro POSITIVEMENT constaté, jamais
 * à `!msgs`. La lecture ne destructurait pas son `error` : un timeout, un cache de
 * schéma PostgREST périmé (donc les minutes qui suivent le déploiement de la migration)
 * ou une connexion coupée rendaient `data = null`, ce que le code lisait « ce fil n'a
 * plus de message » — il supprimait alors le fil, et les deux `on delete cascade`
 * emportaient objet, corps et pièces. Une simple « marquer comme lu » pouvait ainsi
 * faire disparaître une conversation, et l'edge répondait `{ ok: true }`. Lever est le
 * bon geste ici : le catch de `syncAccount` le transforme en `last_error` + backoff.
 */
export async function recomputeThread(admin: SupabaseClient, threadId: string): Promise<void> {
  const { data: msgs, error } = await admin.from('mail_messages')
    .select('sent_at, direction, is_read, has_attachments, snippet')
    .eq('thread_id', threadId).order('sent_at', { ascending: true })
  if (error) throw new Error(`recompute select: ${error.message}`)
  if (!msgs) throw new Error('recompute select: aucune ligne rendue et aucune erreur')
  if (msgs.length === 0) {
    const { error: eDel } = await admin.from('mail_threads').delete().eq('id', threadId)
    if (eDel) throw new Error(`recompute delete: ${eDel.message}`)
    return
  }
  const last = msgs[msgs.length - 1]
  const inbound = msgs.filter((x) => x.direction === 'inbound')
  const outbound = msgs.filter((x) => x.direction === 'outbound')
  const { error: eUpd } = await admin.from('mail_threads').update({
    message_count: msgs.length,
    last_message_at: last.sent_at,
    snippet: last.snippet,
    last_inbound_at: inbound.length ? inbound[inbound.length - 1].sent_at : null,
    last_outbound_at: outbound.length ? outbound[outbound.length - 1].sent_at : null,
    has_attachments: msgs.some((x) => x.has_attachments),
    is_read: msgs.every((x) => x.is_read),
  }).eq('id', threadId)
  if (eUpd) throw new Error(`recompute update: ${eUpd.message}`)
}

/** Applique les gestes faits chez le fournisseur (lu, étoile, archive, corbeille, suppression). */
export async function applyRemoteChanges(admin: SupabaseClient, account: MailAccountRow, changes: RemoteChange[]): Promise<number> {
  let applied = 0
  for (const c of changes) {
    // Une lecture en échec vaudrait « ce message n'existe pas ici » et le changement
    // serait perdu sans trace : on lève, le backoff de syncAccount rejouera la passe.
    const { data: msg, error: eMsg } = await admin.from('mail_messages').select('id, thread_id, direction')
      .eq('account_id', account.id).eq('provider_message_id', c.providerMessageId).maybeSingle()
    if (eMsg) throw new Error(`remote change lookup: ${eMsg.message}`)
    if (!msg) continue
    if (c.kind === 'message_deleted') {
      const { error } = await admin.from('mail_messages').delete().eq('id', msg.id)
      if (error) throw new Error(`remote delete: ${error.message}`)
      await recomputeThread(admin, msg.thread_id)
      applied++
      continue
    }
    if (c.isRead !== undefined) {
      const { error } = await admin.from('mail_messages').update({ is_read: c.isRead }).eq('id', msg.id)
      if (error) throw new Error(`remote read flag: ${error.message}`)
    }
    const patch: Record<string, unknown> = {}
    if (c.isStarred !== undefined) patch.is_starred = c.isStarred
    if (c.isTrashed !== undefined) patch.is_trashed = c.isTrashed
    if (c.inInbox !== undefined && msg.direction === 'inbound') patch.is_archived = !c.inInbox && !(c.isTrashed ?? false)
    if (Object.keys(patch).length) {
      const { error } = await admin.from('mail_threads').update(patch).eq('id', msg.thread_id)
      if (error) throw new Error(`remote flags: ${error.message}`)
    }
    if (c.isRead !== undefined) await recomputeThread(admin, msg.thread_id)
    applied++
  }
  return applied
}

/**
 * Apprend un alias et rattache le fil (modale « Rapprocher l'adresse »).
 *
 * ⛔ LES TROIS ÉCRITURES SONT VÉRIFIÉES. Aucune ne levait, et le `try` de mail-actions
 * ne rattrape que ce qui lève : l'edge répondait `{ ok: true, contact_id }` alors que
 * l'alias pouvait n'avoir pas été appris (violation d'unicité) ou le fil pas rattaché
 * (zéro ligne appariée). Le premier cas est le pire : l'agent voit « rattaché », et le
 * PROCHAIN courrier de la même adresse repart non apparié — c'est-à-dire exactement le
 * service que tout le mécanisme d'alias existe pour rendre. Levée : mail-actions la
 * convertit déjà en 400 portant le message.
 */
export async function linkThreadToContact(admin: SupabaseClient, account: MailAccountRow, threadId: string, contactId: string, email: string, learnedBy: string): Promise<void> {
  const { data: contact, error: eContact } = await admin.from('contacts').select('id').eq('id', contactId).eq('agency_id', account.agency_id).maybeSingle()
  // Une lecture en échec ne prouve PAS que le contact est hors agence : le dire
  // fermerait la porte sur une panne passagère avec un message de sécurité trompeur.
  if (eContact) throw new Error(`contact lookup: ${eContact.message}`)
  if (!contact) throw new Error('contact_not_in_agency')
  const { error: eAlias } = await admin.from('mail_contact_aliases').upsert(
    { agency_id: account.agency_id, email: email.toLowerCase(), contact_id: contactId, learned_by: learnedBy },
    { onConflict: 'agency_id,email', ignoreDuplicates: false },
  )
  if (eAlias) throw new Error(`alias upsert: ${eAlias.message}`)
  const { data: linked, error: eThread } = await admin.from('mail_threads').update({ contact_id: contactId }).eq('id', threadId).eq('account_id', account.id).select('id')
  if (eThread) throw new Error(`thread link: ${eThread.message}`)
  // Zéro ligne appariée = le fil n'appartient pas à ce compte, ou n'existe plus. Sans
  // ce contrôle, l'appelant lisait « rattaché » sur un fil que personne n'a touché.
  if (!linked || linked.length === 0) throw new Error('thread_not_in_account')
  const { error: eMsgs } = await admin.from('mail_messages').update({ contact_id: contactId }).eq('thread_id', threadId).is('contact_id', null)
  if (eMsgs) throw new Error(`messages backfill: ${eMsgs.message}`)
}
```

- [x] **Step 3 : Vert, commit**

```bash
npx vitest run supabase/functions/_shared/mail/ingest.test.ts
git add supabase/functions/_shared/mail/ingest.ts supabase/functions/_shared/mail/ingest.test.ts vitest.config.ts
git commit -m "feat(messagerie): ingestion (fils, messages, pièces, contact, audit) et changements distants"
```
Attendu : **7** tests PASS (le spec compte 7 `it()`, pas 8).

---

### Task 1.9 : Orchestration d'une synchro + garde IDOR — `_shared/mail/sync.ts`, `guard.ts`

> ⛔ **Revue adverse « importante » du 04.09.2026 — LE MIROIR ÉCRITURE DE LA GARDE
> MANQUAIT.** `accountVisibleTo` teste l'agence en CONJONCTION (58f250a8), mais rien
> n'arrêtait l'INGESTION : `team_remove_member` ne fait qu'un
> `update profiles set agency_id = null`, la ligne `mail_accounts` survit `active` avec
> son jeton dans Vault, et `mail_accounts_due_idx` ne regarde que `status`. Le balayage
> de deux minutes continuait donc d'écrire dans l'agence QUITTÉE chaque message, corps et
> pièce de la boîte d'un agent passé chez un concurrent — indéfiniment, et invisible en
> `visibility = 'owner'` (rien à l'écran, tout en base). `assertOwnerStillInAgency`
> (guard.ts) refuse la passe avant le moindre appel fournisseur, et `syncAccount` la
> traduit en `status = 'disabled'` : la boîte sort de la file au lieu d'y brûler un
> créneau. Placée au premier geste de `syncAccount`, elle couvre les QUATRE chemins —
> balayage cron, `mail-sync` ciblé, `mail-actions sync_now`, première passe de
> `mail-oauth exchange` — sans qu'aucun puisse la contourner.

> ⚠ **Revue adverse du 04.09.2026 — trois défauts.** (1) L'écriture du curseur ne
> vérifiait pas son `error` : muette, elle laissait `{ done: true, error: null }` sur une
> passe qui n'avait rien mémorisé — la passe initiale retéléchargeait les 50 mêmes
> messages toutes les 2 minutes sans jamais dépasser le 50e, `next_sync_at` ne bougeait
> pas (le compte affamait les autres, en tête de file), et `last_error` gardait l'erreur
> de la veille. (2) Le curseur d'historique Gmail avançait à la TÊTE après chaque page :
> voir Task 1.6. La pagination est désormais reprise d'un tick à l'autre par
> `historyPageToken`. (3) `status = 'error'` n'était écrit nulle part : compteur
> d'échecs consécutifs, backoff élargi (10 → 60 min), bascule au 5e. ⚠ Le 403 n'est
> volontairement PAS traité comme terminal en soi — celui de Gmail couvre aussi
> `rateLimitExceeded`, transitoire, et un verdict immédiat éteindrait une boîte saine
> pendant un pic de quota ; le compteur y arrive en ~2 h de panne ininterrompue, sans ce
> risque. Ajouté aussi : la résolution des `@removed` Graph (Task 1.7).

**Files:**
- Create: `supabase/functions/_shared/mail/guard.ts`
- Create: `supabase/functions/_shared/mail/sync.ts`

Pas de test unitaire dédié : `sync.ts` n'est que de l'assemblage des modules testés (1.5-1.8) ; il est éprouvé par `mail-edges.spec.ts` (1.15) et par l'épreuve §7.4 du maître.

- [x] **Step 1 : `guard.ts`**

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

// ⛔ Jumelle TypeScript de `mail_account_visible` (20260903120000_mail_module.sql) :
// les deux doivent dire la même chose, et ne jamais dériver. L'appartenance à l'agence
// est CONJOINTE ; `visibility` ne dit que qui voit la boîte DANS l'agence, jamais de
// quelle agence est le LECTEUR. En disjonction, `owner_id === ctx.userId` serait une
// porte qui survit au départ : `team_remove_member`
// (20260627120000_profiles_privilege_escalation_lockdown.sql:286) ne fait qu'un
// `update profiles set agency_id = null, role = 'buyer'` — la ligne profiles SURVIT,
// donc le `on delete cascade` d'`owner_id` ne se déclenche jamais et le compte reste
// 'active' — puis `accept-team-invite/index.ts:148` réécrit `profiles.agency_id` vers
// une NOUVELLE agence. L'ex-membre, passé chez un concurrent, garderait la lecture,
// l'envoi et les pièces jointes de la boîte de son ancienne agence, par tous les edges.
export function accountVisibleTo(account: Pick<MailAccountRow, 'owner_id' | 'agency_id' | 'visibility'>, ctx: CallerCtx): boolean {
  return account.agency_id === ctx.agencyId && (account.visibility === 'agency' || account.owner_id === ctx.userId)
}

/** Le propriétaire de la boîte a quitté l'agence : plus rien ne doit être ingéré pour elle. */
export class MailOwnerLeftError extends Error {
  constructor(detail: string) { super(`owner_left_agency: ${detail}`) }
}

/**
 * MIROIR CÔTÉ ÉCRITURE du test d'agence CONJOINT d'`accountVisibleTo` /
 * `mail_account_visible`. La garde ci-dessus ferme la LECTURE ; sans celle-ci, le
 * flux d'INGESTION restait ouvert, et c'est le même départ qui l'ouvre :
 * `team_remove_member` ne fait qu'un `update profiles set agency_id = null` — la ligne
 * `mail_accounts` survit, `status` reste 'active', le jeton de rafraîchissement reste
 * dans Vault, et `mail_accounts_due_idx` ne regarde que `status`. Le balayage de deux
 * minutes continuait donc d'écrire dans l'ANCIENNE agence chaque message, corps et
 * pièce de la boîte d'un agent passé chez un concurrent — indéfiniment, sans que rien
 * ne l'expire.
 *
 * Levée plutôt que « saut silencieux » : `syncAccount` la transforme en
 * `status = 'disabled'` + `last_error`, donc la boîte quitte la file au lieu d'y
 * brûler un créneau à chaque tick, et la raison est LISIBLE. Appelée au tout début de
 * `syncAccount`, c'est-à-dire avant le moindre appel fournisseur — et les quatre
 * chemins de synchro (balayage cron, `mail-sync` ciblé, `mail-actions sync_now`,
 * première passe lancée par `mail-oauth exchange`) passent tous par là : aucun ne peut
 * la contourner.
 */
export async function assertOwnerStillInAgency(admin: SupabaseClient, account: Pick<MailAccountRow, 'id' | 'owner_id' | 'agency_id'>): Promise<void> {
  const { data, error } = await admin.from('profiles').select('agency_id').eq('id', account.owner_id).maybeSingle()
  // Une lecture en échec ne vaut PAS « il est parti » (on éteindrait des boîtes saines
  // sur un timeout) ni « il est resté » (on rouvrirait la fuite) : c'est une erreur de
  // passe ordinaire, réessayée au backoff.
  if (error) throw new Error(`owner agency lookup: ${error.message}`)
  const ownerAgency = (data as { agency_id: string | null } | null)?.agency_id ?? null
  if (ownerAgency === account.agency_id) return
  throw new MailOwnerLeftError(`compte ${account.id}: propriétaire ${account.owner_id} rattaché à ${ownerAgency ?? 'aucune agence'}`)
}

/** Charge le compte si l'appelant a le droit de le voir, sinon null. */
export async function loadVisibleAccount(admin: SupabaseClient, accountId: string, ctx: CallerCtx): Promise<MailAccountRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(accountId ?? '')) return null
  const { data } = await admin.from('mail_accounts').select('*').eq('id', accountId).maybeSingle()
  if (!data) return null
  return accountVisibleTo(data as MailAccountRow, ctx) ? (data as MailAccountRow) : null
}

/**
 * Charge le compte s'il appartient à l'AGENCE de l'appelant — sans regarder `visibility`.
 *
 * ⛔ POUR RÉVOQUER, PAS POUR LIRE. `loadVisibleAccount` est la bonne porte partout où l'on
 * touche au CONTENU d'une boîte ; elle est la mauvaise pour `disconnect`, et le défaut
 * était exactement inversé : la branche « admin ou manager » de `mail-oauth disconnect`
 * était INATTEIGNABLE pour les boîtes qui la motivent. Une boîte en `visibility: 'owner'`
 * d'un autre membre rend `null` — donc 404 — AVANT le contrôle de rôle ; la branche ne
 * s'ouvrait que sur les boîtes 'agency', celles où l'admin était le moins nécessaire.
 * Conséquence : au départ d'un agent, aucun admin de l'agence ne pouvait couper la
 * connexion, effacer le courrier ingéré, ni arrêter le balayage — la seule issue était une
 * écriture directe en base.
 *
 * La visibilité gouverne QUI LIT une boîte ; elle n'a jamais eu à gouverner qui la révoque.
 * L'appartenance à l'agence reste, elle, la barrière : un id d'une autre agence rend `null`,
 * donc le même 404 qu'avant (contrat figé par tests/backend/mail-edges.spec.ts).
 */
export async function loadAgencyAccount(admin: SupabaseClient, accountId: string, ctx: CallerCtx): Promise<MailAccountRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(accountId ?? '')) return null
  const { data } = await admin.from('mail_accounts').select('*').eq('id', accountId).eq('agency_id', ctx.agencyId).maybeSingle()
  return (data as MailAccountRow | null) ?? null
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

⚠ **Ce bloc ne passe pas seul : `tests/unit/app-url-unique.spec.ts` rougit dessus.** Mesuré le
03.09.2026 en lançant la suite complète — `supabase/functions/_shared/mail/guard.ts:46`, le
littéral `https://app.megga.ch` de `MAIL_OAUTH_ORIGINS`. La garde interdit cette adresse dans
tout code de `supabase/functions/` hors `_shared/app-url.ts`.

Ici c'est la garde qui doit céder, et elle prévoit elle-même comment : une entrée dans
`EXEMPTES` **avec sa raison**. `MAIL_OAUTH_ORIGINS` n'est pas une adresse *construite* mais une
liste blanche d'origines *acceptées* — `redirectUriFor` bâtit son URI sur l'origine de
l'APPELANT, une fois celle-ci trouvée dans la liste. La faire dériver d'`appBaseUrl()` la
rendrait pilotable par `MEGGA_APP_URL`, or cette URI doit correspondre caractère pour caractère
à celle enregistrée chez Google et chez Microsoft : poser le réglage casserait la connexion des
boîtes (`redirect_uri_mismatch`). Et la panne que la garde redoute — muette, découverte au
changement de domaine — n'est pas possible sur une liste blanche : une origine absente refuse la
pop-up sur-le-champ et à l'écran. L'exemption est donc posée dans le spec, avec ce motif écrit.

- [x] **Step 2 : `sync.ts`**

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
import { gmailGetMessage, gmailHistory, gmailIdentity, gmailListInitial, historyToChanges, nextHistoryCursor, normalizeGmailMessage } from './gmail.ts'
import { deltaToChanges, graphDelta, graphFolderIds, graphGetBody, graphListAttachments, normalizeGraphMessage, resolveGraphRemoval } from './graph.ts'
import { applyRemoteChanges, ingestMessages } from './ingest.ts'
import type { RemoteChange } from './types.ts'
import { MailOwnerLeftError, assertOwnerStillInAgency } from './guard.ts'
import type { ProviderConfig } from './guard.ts'

export interface SyncDeps { fetch?: typeof fetch; now?: () => number }
export interface SyncOutcome {
  inserted: number
  updated: number
  changes: number
  /** Entrées de timeline refusées par `activity_events` — la passe a continué, mais ça se voit. */
  auditFailures: number
  done: boolean
  error: string | null
  /** Une autre passe tenait le bail de ce compte : rien n'a été fait, rien n'est perdu. */
  skipped?: 'locked'
}

const INITIAL_WINDOW_DAYS = 90
const NEXT_TICK_MS = 2 * 60_000
/**
 * Délai d'une passe initiale INACHEVÉE. ⚠ Ce n'était pas un délai mais `0` — un compte en
 * cours d'import 90 jours était donc TOUJOURS dû, avec le `next_sync_at` le plus ancien de
 * la file : il repassait en tête de `order('next_sync_at')` à chaque tick. Trois ou quatre
 * agences accueillies le même jour monopolisaient tous les ticks, et TOUTES les autres
 * boîtes du produit cessaient de se synchroniser — `status` restant 'active', `last_error`
 * nul, un `last_sync_at` de plus en plus vieux que personne ne lit. Quinze secondes suffisent
 * à les faire céder le pas aux comptes de la cadence normale sans ralentir l'import.
 */
const INITIAL_RESUME_MS = 15_000
const BACKOFF_MS = 10 * 60_000
/**
 * Marge du bail par compte au-delà du budget de la passe. Le bail existe parce que les
 * quatre chemins de synchro (balayage cron, `mail-sync` ciblé, `mail-actions sync_now`,
 * première passe de `mail-oauth exchange`) n'en prenaient AUCUN : seul le balayage était
 * sérialisé, contre lui-même. Un membre pouvait donc boucler `sync_now` sur une boîte
 * partagée — chaque appel brûlant le quota fournisseur de tous ses collègues — et deux
 * passes concurrentes écrivaient `sync_cursor` sans compare-and-set, chacune pouvant
 * rembobiner l'autre (courrier réingéré, ou sauté).
 */
const LEASE_MARGIN_MS = 30_000

/**
 * Échecs consécutifs après lesquels le compte quitte le balayage (`status = 'error'`).
 * ⚠ Un seuil, pas un verdict immédiat sur le code HTTP : le 403 de Gmail couvre AUSSI
 * `rateLimitExceeded` / `userRateLimitExceeded`, transitoires par construction —
 * l'utiliser comme état terminal éteindrait une boîte saine pendant un pic de quota.
 * Cinq échecs d'affilée, avec le backoff élargi ci-dessous, valent ~2 h de panne
 * ininterrompue : plus aucune chance que ce soit passager.
 */
const MAX_CONSECUTIVE_FAILURES = 5
/** Le backoff s'élargit avec les échecs (10, 20, 30… min), plafonné à 1 h. */
const MAX_BACKOFF_MS = 60 * 60_000

function since(now: number): string {
  return new Date(now - INITIAL_WINDOW_DAYS * 86_400_000).toISOString()
}

/**
 * Prend le bail d'UN compte, même mécanique que le bail de balayage (mail-sync/index.ts) et
 * pour la même raison : `mail_cron_locks` est une table de baux, `job` en est la clé.
 *
 * ⚠ La ligne du compte n'existe pas à la première passe : on tente d'abord la prise (le cas
 * courant, une seule instruction), et on ne sème que si elle n'a rien appariée. Semer
 * d'abord coûterait un aller-retour à chaque synchro de chaque compte. `ignoreDuplicates`
 * garantit qu'un semis n'écrase jamais un bail tenu.
 */
async function acquireAccountLease(admin: SupabaseClient, job: string, until: string, nowIso: string): Promise<boolean> {
  const take = async (): Promise<boolean> => {
    const { data, error } = await admin.from('mail_cron_locks').update({ locked_until: until })
      .eq('job', job).lt('locked_until', nowIso).select('job')
    if (error) throw new Error(`account lease: ${error.message}`)
    return (data ?? []).length === 1
  }
  if (await take()) return true
  const { error } = await admin.from('mail_cron_locks')
    .upsert({ job, locked_until: new Date(0).toISOString() }, { onConflict: 'job', ignoreDuplicates: true })
  if (error) throw new Error(`account lease seed: ${error.message}`)
  return take()
}

/** Rend le bail — et SEULEMENT le sien (`locked_until` sert de jeton, cf. `releaseLock`). */
async function releaseAccountLease(admin: SupabaseClient, job: string, until: string, nowIso: string): Promise<void> {
  const { error } = await admin.from('mail_cron_locks').update({ locked_until: nowIso })
    .eq('job', job).eq('locked_until', until)
  if (error) console.error(`[mail-sync] bail ${job} non relâché:`, error.message)
}

export async function syncAccount(admin: SupabaseClient, account: MailAccountRow, cfg: ProviderConfig, budgetMs: number, deps: SyncDeps = {}): Promise<SyncOutcome> {
  const now = deps.now ?? Date.now
  const start = now()
  const out: SyncOutcome = { inserted: 0, updated: 0, changes: 0, auditFailures: 0, done: true, error: null }
  // ⛔ UNE SEULE PASSE À LA FOIS PAR COMPTE, quel que soit le chemin d'appel. Le bail est
  // pris ici et non chez les appelants, parce qu'il y en a quatre et qu'un seul d'entre eux
  // se souvenait de se protéger. TTL = budget + marge : au pire, un compte reste bloqué le
  // temps d'une passe morte, jamais plus.
  const job = `mail-sync:${account.id}`
  const leaseUntil = new Date(now() + budgetMs + LEASE_MARGIN_MS).toISOString()
  let held = false
  try {
    held = await acquireAccountLease(admin, job, leaseUntil, new Date(now()).toISOString())
    if (!held) {
      // Ni erreur ni succès : une autre passe travaille sur ce compte. `next_sync_at` n'est
      // pas touché, donc il reste dû et repassera au tick suivant.
      out.done = false
      out.skipped = 'locked'
      return out
    }
    // AVANT le moindre appel fournisseur : une boîte dont le propriétaire a quitté
    // l'agence ne s'ingère plus (guard.ts, miroir écriture de `mail_account_visible`).
    await assertOwnerStillInAgency(admin, account)
    let cursor: SyncCursor
    if (account.provider === 'gmail') cursor = await syncGmail(admin, account, cfg, budgetMs, start, deps, out)
    else if (account.provider === 'outlook') cursor = await syncGraph(admin, account, cfg, budgetMs, start, deps, out)
    else throw new Error(`provider ${account.provider} not supported by this build`)
    // ⛔ L'écriture du curseur est VÉRIFIÉE. Muette, elle laissait `{ done: true,
    // error: null }` sur une passe qui n'avait rien mémorisé : la passe initiale
    // retéléchargeait les 50 mêmes messages toutes les 2 minutes sans jamais dépasser
    // le 50e, `next_sync_at` ne bougeait pas — le compte restait en tête de la file et
    // affamait les autres — et `last_error` gardait l'erreur de la veille. Lever
    // renvoie dans le catch, qui écrit `last_error` et un backoff.
    const { error } = await admin.from('mail_accounts').update({
      sync_cursor: cursor,
      last_sync_at: new Date(now()).toISOString(),
      last_error: null,
      sync_failures: 0,
      next_sync_at: new Date(now() + (out.done ? NEXT_TICK_MS : INITIAL_RESUME_MS)).toISOString(),
    }).eq('id', account.id)
    if (error) throw new Error(`cursor write: ${error.message}`)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    out.error = msg
    out.done = true
    const reauth = e instanceof MailAuthError && e.code === 'reauth_required'
    // Compteur d'échecs consécutifs : sans lui, `status` ne pouvait dire « cassée »
    // que pour la reconnexion, et les cinq autres façons de mourir (403 de quota,
    // pointeur Vault orphelin, erreur d'ingestion, provider non gelé, refus Graph)
    // laissaient la boîte `active` à réessayer toutes les 10 minutes pour toujours —
    // indiscernable, pour l'agent comme pour le lot 2, d'une boîte sans courrier neuf.
    const failures = (account.sync_failures ?? 0) + 1
    // Le départ du propriétaire est TERMINAL et immédiat : pas un échec transitoire à
    // réessayer cinq fois, mais une boîte qui ne doit plus jamais être ingérée dans
    // cette agence. `disabled` la retire de `mail_accounts_due_idx` dès ce tick.
    const terminal = e instanceof MailOwnerLeftError
      ? 'disabled'
      : reauth ? 'reauth_required' : failures >= MAX_CONSECUTIVE_FAILURES ? 'error' : null
    const { error: eWrite } = await admin.from('mail_accounts').update({
      last_error: msg.slice(0, 500),
      sync_failures: failures,
      next_sync_at: new Date(now() + Math.min(BACKOFF_MS * failures, MAX_BACKOFF_MS)).toISOString(),
      ...(terminal ? { status: terminal } : {}),
    }).eq('id', account.id)
    // Dernier filet : si même cette écriture échoue, l'échec n'existe NULLE PART.
    if (eWrite) console.error(`[mail-sync] ${account.id}: last_error non écrit (${eWrite.message})`)
    console.error(`[mail-sync] ${account.provider} ${account.id} (échec ${failures}${terminal ? `, statut ${terminal}` : ''}): ${msg}`)
  } finally {
    // Rendu quoi qu'il arrive : un bail oublié bloquerait le compte jusqu'au TTL.
    if (held) await releaseAccountLease(admin, job, leaseUntil, new Date(now()).toISOString())
  }
  return out
}

/** Ids fournisseur déjà en base parmi ceux-ci (une lecture en échec LÈVE, elle ne devine pas). */
async function knownProviderIds(admin: SupabaseClient, accountId: string, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set()
  const { data, error } = await admin.from('mail_messages').select('provider_message_id')
    .eq('account_id', accountId).in('provider_message_id', ids)
  if (error) throw new Error(`known ids lookup: ${error.message}`)
  return new Set((data ?? []).map((r: { provider_message_id: string }) => r.provider_message_id))
}

// ── Gmail ─────────────────────────────────────────────────────────────────────
async function syncGmail(admin: SupabaseClient, account: MailAccountRow, cfg: ProviderConfig, budgetMs: number, start: number, deps: SyncDeps, out: SyncOutcome): Promise<GmailCursor> {
  const now = deps.now ?? Date.now
  const token = await getValidAccessToken(admin, account, cfg.gmail, deps)
  const c: GmailCursor = (account.sync_cursor as GmailCursor)?.kind === 'gmail'
    ? (account.sync_cursor as GmailCursor)
    : { kind: 'gmail', historyId: null, initialPageToken: null, initialDone: false, historyPageToken: null }

  if (!c.initialDone) {
    // Le historyId est capturé AVANT la première page : tout ce qui bouge pendant
    // la passe initiale sera rejoué par history.list, rien n'est perdu.
    if (!c.historyId) c.historyId = (await gmailIdentity(token, deps)).historyId
    while (now() - start < budgetMs) {
      const page = await gmailListInitial(token, c.initialPageToken, deps)
      // Les ids DÉJÀ en base ne se retéléchargent pas — même pré-contrôle que le côté
      // Graph. Sans lui, une page reprise après un dépassement de budget rejouait ses 50
      // `messages.get` à chaque tick sans jamais progresser : le budget ne suffisant pas
      // la première fois, il ne suffirait jamais.
      const known = await knownProviderIds(admin, account.id, page.ids)
      const msgs: NormalizedMessage[] = []
      let exhausted = false
      for (const id of page.ids) {
        // ⛔ LE BUDGET SE VÉRIFIE DANS LA BOUCLE DES MESSAGES, pas seulement en tête de
        // page. Une page = jusqu'à 50 `messages.get` SÉQUENTIELS : entamée à une
        // milliseconde de la fin du budget, elle allait au bout — ~8 s de dépassement à
        // 150 ms l'appel, bien plus sur un compte limité en débit. Le balayage tient un
        // bail de 180 s pendant que pg_cron tire toutes les 120 s : c'est ce
        // dépassement-là qui finit par faire tourner deux balayages côte à côte.
        if (now() - start >= budgetMs) { exhausted = true; break }
        if (known.has(id)) continue
        msgs.push(normalizeGmailMessage(await gmailGetMessage(token, id, deps), account.email))
      }
      const r = await ingestMessages(admin, account, msgs)
      out.inserted += r.inserted; out.updated += r.updated; out.auditFailures += r.auditFailures
      // ⚠ Le `pageToken` n'avance QUE si la page a été lue en entier. Sinon le tick suivant
      // la reliste et saute ce qui est déjà écrit — au lieu de sauter ce qui ne l'est pas.
      if (exhausted) break
      c.initialPageToken = page.nextPageToken
      if (!page.nextPageToken) { c.initialDone = true; break }
    }
    out.done = c.initialDone
    return c
  }

  // ⛔ La pagination reprend là où le tick précédent l'a laissée. Le pageToken vivait
  // dans une variable LOCALE : une pagination coupée par le budget était perdue, et
  // comme le curseur était déjà avancé à la tête, les pages restantes n'étaient jamais
  // lues (cf. `nextHistoryCursor`). Il est désormais dans le curseur persisté.
  let pageToken: string | null = c.historyPageToken ?? null
  let exhausted = false
  for (let i = 0; i < 5 && now() - start < budgetMs; i++) {
    const h = await gmailHistory(token, c.historyId!, pageToken, deps)
    if (h.expired) {
      // Historique trop ancien côté Google : on repart sur 90 jours, sans boucle d'erreur.
      return { kind: 'gmail', historyId: null, initialPageToken: null, initialDone: false, historyPageToken: null }
    }
    const { added, changes } = historyToChanges(h.page!)
    const msgs: NormalizedMessage[] = []
    for (const id of added) {
      // Même borne qu'à la passe initiale : une page d'historique peut porter jusqu'à
      // 100 enregistrements, donc autant de `messages.get` séquentiels.
      if (now() - start >= budgetMs) { exhausted = true; break }
      try { msgs.push(normalizeGmailMessage(await gmailGetMessage(token, id, deps), account.email)) }
      catch (e) { if (!(e instanceof Error && /http 404/.test(e.message))) throw e } // supprimé entre-temps
    }
    const r = await ingestMessages(admin, account, msgs)
    out.inserted += r.inserted; out.updated += r.updated; out.auditFailures += r.auditFailures
    out.changes += await applyRemoteChanges(admin, account, changes)
    // ⚠ Page abandonnée en cours : le curseur NE BOUGE PAS. `historyId` et `pageToken`
    // restent ceux d'avant, donc la même page d'historique est rejouée au tick suivant —
    // les messages déjà écrits y sont réingérés à l'identique (idempotent), ceux qui
    // manquaient sont enfin chargés. Avancer ici les perdrait définitivement.
    if (exhausted) break
    const nxt = nextHistoryCursor(c.historyId, h.page!)
    c.historyId = nxt.historyId
    pageToken = nxt.pageToken
    if (!pageToken) break
  }
  c.historyPageToken = pageToken
  // ⚠ `done` dit « il ne reste rien à faire ». Une page abandonnée en cours de budget en
  // laisse, même quand la pagination était drainée : sans ce `!exhausted`, la passe se
  // déclarait finie et `next_sync_at` repartait à deux minutes au lieu de quinze secondes.
  out.done = !exhausted && pageToken === null
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
    // Une lecture en échec ferait passer TOUS les messages connus pour neufs : autant
    // de GET de corps et de pièces inutiles, et un `update` complet de chaque ligne.
    const known = await knownProviderIds(admin, account.id, ids)
    const { added, changes, removed } = deltaToChanges(d.items, known, c.folderIds)
    // Un `@removed` n'est PAS une suppression tant qu'un GET ne l'a pas dit (le delta
    // est par dossier : archiver produit le même signal qu'effacer).
    for (const r of removed) {
      const resolved: RemoteChange | null = await resolveGraphRemoval(token, r, c.folderIds, deps)
      if (resolved) changes.push(resolved)
    }
    const msgs: NormalizedMessage[] = []
    let exhausted = false
    for (const m of added) {
      // Chaque message ajouté coûte un `graphGetBody` PLUS un `graphListAttachments` :
      // une page de 50 vaut donc jusqu'à 100 allers-retours séquentiels, contrôlés
      // jusqu'ici par le seul test d'entrée de dossier.
      if (now() - start >= budgetMs) { exhausted = true; break }
      const body = await graphGetBody(token, m.id, deps)
      const atts = m.hasAttachments ? await graphListAttachments(token, m.id, deps) : []
      msgs.push(normalizeGraphMessage(m, body, atts, c.folderIds, account.email))
    }
    const r = await ingestMessages(admin, account, msgs)
    out.inserted += r.inserted; out.updated += r.updated; out.auditFailures += r.auditFailures
    out.changes += await applyRemoteChanges(admin, account, changes)
    // ⛔ Dossier abandonné en cours : le curseur de CE dossier ne bouge pas. L'avancer
    // consommerait le delta des messages jamais chargés — perdus sans une trace. Rejoué
    // au tick suivant, le même delta les rend `added` (les autres sont désormais connus,
    // donc de simples drapeaux) : la passe progresse au lieu de tourner en rond.
    if (exhausted) { allSettled = false; break }
    // deltaLink = passe finie pour ce dossier ; nextLink = il reste des pages (curseur provisoire).
    c[f.key] = d.deltaLink ?? d.nextLink
    if (!d.deltaLink) allSettled = false
  }
  if (allSettled) c.initialDone = true
  out.done = allSettled
  return c
}
```

- [x] **Step 3 : Type-check Deno et commit**

```bash
deno check supabase/functions/_shared/mail/sync.ts supabase/functions/_shared/mail/guard.ts
git add supabase/functions/_shared/mail/sync.ts supabase/functions/_shared/mail/guard.ts
git commit -m "feat(messagerie): orchestration de synchro (Gmail history, Graph delta) et garde IDOR"
```
Attendu : `deno check` sans erreur (⚠ `tsc -b` ne couvre pas ce dossier).

---

### Task 1.10 : Edge `mail-oauth` (start · exchange · disconnect · update)

> ⛔ **Revue adverse « importante » du 04.09.2026 — `disconnect` ne déconnectait pas.**
> Lecture Vault en `.catch(() => null)` (la révocation sautait alors sans un mot),
> effacement en `.catch(() => undefined)`, puis suppression de `mail_accounts` — LE SEUL
> pointeur vers `vault_secret_id` — et `{ ok: true }`. Au pire, MEGGA gardait un jeton
> Google chiffré, NON révoqué et référencé par rien, pour une boîte que l'utilisateur
> croyait déconnectée. On révoque et on efface AVANT de supprimer la ligne ; en cas
> d'échec la ligne reste (`disabled`), le pointeur survit et la réponse le dit. ⚠ Un
> secret ABSENT (`null`) n'est pas un échec : bloquer là condamnerait le compte à ne
> jamais pouvoir être supprimé. Les deux `deleteAccountSecret` de l'échange journalisent
> désormais l'orphelin qu'ils laissent.

**Files:**
- Create: `supabase/functions/mail-oauth/index.ts`
- Modify: `supabase/config.toml` (bloc `[functions.mail-oauth]`)

- [x] **Step 1 : Écrire l'edge**

```ts
// supabase/functions/mail-oauth/index.ts
// Connexion d'une boîte par OAuth en pop-up (plan §3 D1, §4 « Ajouter une boîte »).
//   start      → { url, state }            (state + code_verifier gardés en base)
//   exchange   → { account }               (échange PKCE, identité, Vault, 1re synchro en fond)
//   disconnect → { ok }                    (révocation, Vault effacé, cascade)
//   update     → { account }               (display_name, visibility, status active⇄disabled
//                                           — propriétaire seul)
// Garde : requireAgentAuth AVANT toute lecture de configuration (règle 4 du lot).
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'
import { buildAuthorizeUrl, exchangeCode, fetchIdentity, pkceChallenge, randomToken, revokeToken, type OAuthProvider } from '../_shared/mail/oauth.ts'
import { deleteAccountSecret, readAccountSecret, storeAccountSecret } from '../_shared/mail/secrets.ts'
import { loadAgencyAccount, loadVisibleAccount, providerConfigFromEnv, redirectUriFor } from '../_shared/mail/guard.ts'
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
    /**
     * ⛔ LA CONSOMMATION EST LA GARDE, en UNE instruction. La version d'origine lisait la
     * ligne, refusait un `consumed_at` non nul, PUIS marquait — un contrôle-puis-agit que
     * deux `exchange` concurrents sur le même `{code, state}` passaient tous les deux. La
     * propriété annoncée (« un state ne sert qu'une fois ») n'était donc pas tenue ici mais
     * chez Google/Microsoft, qui rendent `invalid_grant` au second échange — un 502 après
     * coup. Et sur un fournisseur lent, les deux appels atteignaient `storeAccountSecret` :
     * un secret Vault orphelin de plus à chaque course.
     *
     * L'UPDATE conditionnel tranche : `consumed_at is null and expires_at > now()` sont
     * évalués et écrits dans la même instruction, donc une seule des deux requêtes voit une
     * ligne rendue. Zéro ligne = état inconnu, déjà consommé, ou périmé — indistinctement
     * `invalid_state`, comme avant (aucun oracle offert à l'appelant).
     */
    const { data: consumed, error: eState } = await admin.from('mail_oauth_states')
      .update({ consumed_at: new Date().toISOString() })
      .eq('state', state).eq('user_id', user.id)
      .is('consumed_at', null).gt('expires_at', new Date().toISOString())
      .select('*')
    // Une lecture en échec n'est pas un état invalide : le dire 403 enverrait l'agent
    // recommencer une autorisation qui n'a rien de fautif.
    if (eState) return json({ error: 'state_consume_failed', detail: eState.message }, 500)
    const st = (consumed ?? [])[0]
    if (!st) return json({ error: 'invalid_state' }, 403)
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
    const { data: existing } = await admin.from('mail_accounts').select('id, vault_secret_id, owner_id, visibility')
      // ⚠ `.eq` et non `.ilike` : dans un motif LIKE, `_` et `%` sont des JOKERS —
      // `john_doe@x.ch` apparierait `johnXdoe@x.ch`, et `.maybeSingle()` lèverait sur
      // deux résultats. `identity.email` est déjà en minuscules (fetchIdentity) et
      // l'index unique est sur lower(email) : l'égalité est correcte ET indexée.
      .eq('agency_id', profile.agency_id).eq('provider', provider).eq('email', identity.email).maybeSingle()
    let accountId: string
    if (existing) {
      // ⚠ Une RÉAUTORISATION n'a pas à échouer parce que l'ANCIEN secret ne s'efface
      // pas : le nouveau va le remplacer dans la ligne, la boîte doit repartir. Mais
      // l'ancien devient alors un secret orphelin dans Vault — c'est écrit, ça ne
      // disparaît plus en silence à chaque reconnexion.
      if (existing.vault_secret_id) {
        await deleteAccountSecret(admin, existing.vault_secret_id)
          .catch((e) => console.error(`[mail-oauth] ancien secret ${existing.vault_secret_id} ORPHELIN (compte ${existing.id}):`, e instanceof Error ? e.message : String(e)))
      }
      const vaultId = await storeAccountSecret(admin, `mail:${provider}:${identity.email}`, secret)
      /**
       * ⛔ UNE RÉAUTORISATION NE CHANGE PAS DE MAIN. Le patch écrivait `owner_id: user.id`
       * ET `visibility: st.visibility` : n'importe quel membre de l'agence connaissant le
       * mot de passe de la boîte PARTAGÉE — c'est précisément ce que « partagée » veut dire
       * — la reconnectait en `{visibility:'owner'}` et en devenait propriétaire. La boîte et
       * TOUT son historique ingéré sortaient alors de la vue du directeur et de chaque
       * admin (`loadVisibleAccount` rend null pour eux) : plus de lecture, plus de `update`,
       * plus de `disconnect` par aucun edge. Rattrapable seulement par écriture directe en
       * base. Le geste demandé était « redonner un jeton », le geste obtenu était « prendre
       * la boîte ».
       *
       * ⚠ On REFUSE la prise, pas la réautorisation : la boîte partagée dont le jeton a
       * expiré doit pouvoir être réparée par le collègue qui a les identifiants, sans quoi
       * l'agence attend le retour de congés du propriétaire. Seuls le secret, le statut et
       * le nom d'affichage bougent. Le propriétaire et la visibilité ne se changent que par
       * l'action `update`, réservée au propriétaire.
       */
      if (existing.owner_id !== user.id) {
        console.error(`[mail-oauth] compte ${existing.id} réautorisé par ${user.id}, propriétaire ${existing.owner_id} — jeton remplacé, propriété INCHANGÉE`)
      }
      const { error } = await admin.from('mail_accounts').update({
        vault_secret_id: vaultId, status: 'active', last_error: null, sync_failures: 0,
        display_name: identity.name, next_sync_at: new Date().toISOString(),
      }).eq('id', existing.id)
      if (error) return json({ error: 'account_update_failed' }, 500)
      accountId = existing.id
    } else {
      const vaultId = await storeAccountSecret(admin, `mail:${provider}:${identity.email}`, secret)
      const { data: ins, error } = await admin.from('mail_accounts').insert({
        agency_id: profile.agency_id, owner_id: user.id, provider, email: identity.email, display_name: identity.name,
        visibility: st.visibility, status: 'active', vault_secret_id: vaultId,
      }).select('id').single()
      if (error) {
        // Retour arrière : sans ligne pour le porter, le secret n'aurait plus de nom.
        await deleteAccountSecret(admin, vaultId)
          .catch((e) => console.error(`[mail-oauth] secret ${vaultId} ORPHELIN après échec d'insertion:`, e instanceof Error ? e.message : String(e)))
        return json({ error: 'account_insert_failed', detail: error.message }, 500)
      }
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
    // ⚠ Gardé comme le fait flatfox-sync/index.ts:768-771, et pour une raison
    // précise : à ce point la ligne mail_accounts EST écrite et le secret EST dans
    // Vault. Un `EdgeRuntime` absent lèverait un ReferenceError APRÈS le succès —
    // l'assistant verrait un 500 pour une boîte pourtant connectée.
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      EdgeRuntime.waitUntil(syncAccount(admin, account as MailAccountRow, cfg, 45_000))
    }
    const { data: pub } = await admin.from('mail_accounts').select(PUBLIC_COLS).eq('id', accountId).single()
    return json({ account: pub })
  }

  if (action === 'disconnect') {
    // ⛔ CHARGÉ PAR L'AGENCE, PAS PAR LA VISIBILITÉ (loadAgencyAccount, guard.ts). Avec
    // `loadVisibleAccount`, la branche « admin ou manager » juste en dessous était
    // INATTEIGNABLE pour les boîtes qui la justifient : une boîte `visibility: 'owner'`
    // d'un autre membre rendait 404 avant même le contrôle de rôle. Le rôle vient d'une
    // source de confiance (select serveur dans require-agent-auth), et l'agence reste la
    // barrière — un compte d'une autre agence rend toujours 404.
    const account = await loadAgencyAccount(admin, String(body.account_id ?? ''), ctx)
    if (!account) return json({ error: 'not_found' }, 404)
    if (account.owner_id !== user.id && !['admin', 'manager'].includes(profile.role ?? '')) return json({ error: 'forbidden' }, 403)
    /**
     * ⛔ ON RÉVOQUE ET ON EFFACE AVANT DE SUPPRIMER LA LIGNE, et aucun des trois gestes
     * n'est avalé. La version d'origine faisait `.catch(() => null)` sur la lecture Vault
     * (la révocation sautait alors en silence), `.catch(() => undefined)` sur
     * l'effacement, puis supprimait `mail_accounts` — c'est-à-dire LE SEUL POINTEUR vers
     * `vault_secret_id` — et répondait `{ ok: true }`. Au pire des cas MEGGA conservait
     * un jeton de rafraîchissement Google chiffré, NON révoqué et plus référencé par
     * rien, pour une boîte que l'utilisateur croyait déconnectée ; au cas courant,
     * l'autorisation restait simplement active chez Google.
     *
     * En cas d'échec, la LIGNE RESTE (en `disabled`) : le pointeur survit, la
     * déconnexion est réessayable, et la réponse le dit au lieu de mentir.
     */
    if (account.vault_secret_id) {
      // ⚠ Deux issues à ne PAS confondre. Une LEVÉE = Vault n'a pas répondu, on ne sait
      // pas si le jeton existe : refuser, garder la ligne, réessayable. Un `null` = la
      // ligne de secret n'est plus là (déconnexion déjà à demi faite, purge) : il n'y a
      // rien à révoquer ni à effacer, et bloquer là condamnerait le compte à ne jamais
      // pouvoir être supprimé.
      let secret: OAuthSecret | null = null
      try { secret = await readAccountSecret<OAuthSecret>(admin, account.vault_secret_id) }
      catch (e) {
        const detail = e instanceof Error ? e.message : String(e)
        console.error(`[mail-oauth] secret ${account.vault_secret_id} illisible (compte ${account.id}):`, detail)
        await admin.from('mail_accounts').update({ status: 'disabled', last_error: 'disconnect: secret illisible, révocation impossible' }).eq('id', account.id)
        return json({ error: 'revocation_failed', detail: 'secret_unreadable', account_id: account.id }, 502)
      }
      if (!secret) console.error(`[mail-oauth] compte ${account.id} : aucun secret sous ${account.vault_secret_id} — rien à révoquer`)
      if (secret && 'refresh_token' in secret && (account.provider === 'gmail' || account.provider === 'outlook')) {
        if (!await revokeToken(account.provider, secret.refresh_token)) {
          await admin.from('mail_accounts').update({ status: 'disabled', last_error: 'disconnect: révocation refusée par le fournisseur' }).eq('id', account.id)
          return json({ error: 'revocation_failed', detail: 'provider_refused', account_id: account.id }, 502)
        }
      }
      try { if (secret) await deleteAccountSecret(admin, account.vault_secret_id) }
      catch (e) {
        const detail = e instanceof Error ? e.message : String(e)
        console.error(`[mail-oauth] secret ${account.vault_secret_id} non effacé (compte ${account.id}):`, detail)
        // Le jeton est révoqué, donc inoffensif — mais il reste dans Vault : garder la
        // ligne est ce qui laisse une chance de le retrouver et de réessayer.
        await admin.from('mail_accounts').update({ status: 'disabled', last_error: `disconnect: secret non effacé (${detail.slice(0, 200)})` }).eq('id', account.id)
        return json({ ok: false, error: 'vault_delete_failed', detail, account_id: account.id }, 500)
      }
    }
    const { error } = await admin.from('mail_accounts').delete().eq('id', account.id)
    if (error) return json({ error: 'delete_failed', detail: error.message }, 500)
    return json({ ok: true })
  }

  if (action === 'update') {
    const account = await loadVisibleAccount(admin, String(body.account_id ?? ''), ctx)
    if (!account) return json({ error: 'not_found' }, 404)
    if (account.owner_id !== user.id) return json({ error: 'forbidden' }, 403)
    const patch: Record<string, unknown> = {}
    if (typeof body.display_name === 'string') patch.display_name = body.display_name.slice(0, 80)
    if (body.visibility === 'owner' || body.visibility === 'agency') patch.visibility = body.visibility
    /**
     * METTRE EN PAUSE — le troisième champ que le plan maître §5 promet au propriétaire
     * (« UPDATE limité à `display_name`, `visibility`, `status='disabled'` »), et qui
     * n'existait nulle part. Sans lui, arrêter une boîte passait par `disconnect`, qui
     * révoque le jeton et emporte en cascade fils, messages et pièces : une réponse
     * DESTRUCTIVE à une demande réversible (« je pars trois semaines »).
     *
     * ⚠ La bascule ne vaut qu'entre `active` et `disabled`. Les trois autres états sont
     * des VERDICTS du système — `reauth_required` (le fournisseur a coupé),
     * `error` (cinq échecs d'affilée), et le `disabled` posé par le départ du
     * propriétaire — qu'un clic ne doit pas pouvoir effacer : les remettre `active`
     * relancerait un balayage condamné, ou, dans le dernier cas, l'ingestion du courrier
     * d'un agent parti. Ces états-là se réparent par une RÉAUTORISATION, pas par un
     * interrupteur. D'où un 409 explicite plutôt qu'un champ ignoré en silence.
     */
    if (body.status === 'disabled' || body.status === 'active') {
      if (account.status !== 'active' && account.status !== 'disabled') {
        return json({ error: 'status_not_togglable', status: account.status }, 409)
      }
      patch.status = body.status
      // Redémarrer, c'est repartir propre ET tout de suite : sinon la boîte traînerait
      // le dernier `last_error` et le backoff écrit avant la pause.
      if (body.status === 'active') { patch.last_error = null; patch.sync_failures = 0; patch.next_sync_at = new Date().toISOString() }
    }
    const { data: pub, error } = await admin.from('mail_accounts').update(patch).eq('id', account.id).select(PUBLIC_COLS).single()
    if (error) return json({ error: 'update_failed' }, 500)
    return json({ account: pub })
  }

  return json({ error: 'unknown_action' }, 400)
})
```

- [x] **Step 2 : Déclarer la fonction**

⛔ **NE PAS écrire ce bloc à la main.** La quasi-totalité de `supabase/config.toml` est une
**région GÉNÉRÉE**, délimitée par les marqueurs
`# ── GÉNÉRÉ par scripts/check-edge-roster.mjs — début ──` et `— fin ──` ; les rares blocs
écrits à la main, avec leur justification, vivent AU-DESSUS du marqueur d'ouverture.
Alphabétiquement, `mail-*` tombe entre `magic-link-send-email` et `matching-engine` — donc
DEDANS. Le script ne compte comme « documenté » que ce qui est hors marqueurs, puis régénère
la région et compare le fichier **texte pour texte** : un bloc inséré à la main y fait rougir
`npm run lint:roster`, avec un diagnostic qui ne nomme même pas la fonction
(« ✗ supabase/config.toml a dérivé du source tree »).
⚠ Cette note portait trois NUMÉROS DE LIGNE et deux comptes, copiés-collés dans cinq tâches
et déjà faux le lendemain (mesuré le 04.09.2026 : les marqueurs sont aux lignes 494 et 727,
la région porte 74 des 87 blocs, 13 restent au-dessus). Un numéro de ligne dans une note que
l'on lit JUSTE AVANT d'éditer le fichier envoie au mauvais endroit ; les noms de marqueurs,
eux, ne dérivent pas.

La façon juste — elle régénère `supabase/config.toml` ET `src/lib/edgeFunctionRoster.ts`
en une passe :
```bash
node scripts/check-edge-roster.mjs --write
npm run lint:roster    # attendu : exit 0
```
Le bloc produit est bien :
```toml
[functions.mail-oauth]
verify_jwt = false
```

- [x] **Step 3 : Type-check, servir en local, commit**

```bash
deno check supabase/functions/mail-oauth/index.ts
# ⚠ `supabase/.env.local` N'EXISTE PAS et n'est pas la convention du dépôt :
# .gitignore:37 nomme `supabase/.env` comme le fichier que lit la CLI (--env-file).
# Le créer au besoin (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET) ; sans lui, la
# branche attendue de `start` est le `503 provider_not_configured` documenté.
supabase functions serve mail-oauth --no-verify-jwt --env-file supabase/.env
```
Dans un second terminal, sans jeton :
```bash
curl -s -X POST http://127.0.0.1:54321/functions/v1/mail-oauth -H 'Content-Type: application/json' -d '{"action":"start","provider":"gmail","origin":"http://localhost:5173"}'
```
Attendu : `{"error":"Authentication required"}` (401, la garde parle avant tout).

⛔ **`supabase functions serve` N'A PAS PU TOURNER, et ce n'est pas un oubli** (mesuré le
04.09.2026) : la CLI démarre le runtime edge dans un CONTENEUR, et cette machine n'en a
aucun — `docker`, `podman` et `colima` sont tous « not found ». Le 401 attendu ci-dessus
reste la bonne prédiction, il n'a simplement pas été observé ici. Les preuves réellement
obtenues sont `deno check` (le SEUL type-check que voie ce dossier, `tsc -b` ne le couvrant
pas) et le job backend de la CI. Ne pas installer Docker pour cette ligne.

```bash
git add supabase/functions/mail-oauth/index.ts supabase/config.toml src/lib/edgeFunctionRoster.ts
git commit -m "feat(messagerie): edge mail-oauth (start, exchange PKCE, disconnect, update)"
```

⚠ `src/lib/edgeFunctionRoster.ts` s'ajoute au commit : `--write` régénère les DEUX fichiers,
et laisser le roster de côté ferait rougir `lint:roster` au commit suivant.

---

### Task 1.11 : Edge `mail-sync` (balayage cron + ciblé)

> ⚠ **Revue adverse du 04.09.2026 — deux arrêts silencieux, tous deux en 200.** (1) La
> file des comptes dus ne vérifiait pas son `error` : une lecture ratée rendait
> `{ ok: true, synced: 0 }`, pg_cron enregistrait un succès, aucun `last_error` n'était
> écrit — toute la messagerie du produit arrêtée sans un signal rouge (la panne d'agenda,
> à l'identique). Elle rend 500 désormais. (2) `acquireLock` lisait « zéro ligne mise à
> jour » comme « un autre balayage tient le bail » : or la ligne `mail_cron_locks` n'est
> créée que par la migration, et si elle manque (base fraîche, purge) CHAQUE balayage
> répondait `skipped: 'locked'` pour toujours. Semis `on conflict do nothing` avant la
> prise, erreur distinguée du refus, et libération devenue compare-and-release : un
> balayage qui dépassait le TTL libérait, en finissant, le bail de son successeur.

**Files:**
- Create: `supabase/functions/mail-sync/index.ts`
- Modify: `supabase/config.toml`

- [x] **Step 1 : Écrire l'edge**

```ts
// supabase/functions/mail-sync/index.ts
// Balayage de synchronisation. Deux appelants :
//   - pg_cron `mail-sync-2min` (Bearer = clé service, corps {}) : jusqu'à 25 comptes dus ;
//   - un agent connecté (`{ account_id }`) via mail-actions `sync_now` ou directement :
//     UN compte, visible par lui, budget court — c'est le « rafraîchir » de l'écran.
// Un bail en base (mail_cron_locks) empêche deux balayages simultanés : le budget
// (60 s) dépasse l'intervalle (120 s) rarement, mais un tick lent + un tick suivant
// = double coût fournisseur et curseurs en course. Le TTL (180 s) est le filet.
// ⚠ Le TTL ne tient que parce que le dépassement d'une passe est BORNÉ : depuis le
// 04.09.2026, `syncAccount` vérifie son budget DANS la boucle des messages et non plus
// seulement en tête de page (une page = jusqu'à 50 `messages.get` séquentiels, soit
// plusieurs secondes de débordement). 60 s de budget + le temps d'un message restent très
// en deçà des 180 s. Et chaque compte porte en plus son propre bail
// (`mail-sync:<account_id>`, sync.ts), qui sérialise le balayage contre les trois chemins
// déclenchés par un agent.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
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
/** `{}` ou `{"account_id":"<uuid>"}` : rien de légitime ne dépasse quelques dizaines d'octets. */
const MAX_BODY_BYTES = 4_096

type LockResult =
  | { ok: true; until: string }
  | { ok: false; reason: 'locked' }
  | { ok: false; reason: 'error'; detail: string }

/**
 * Prend le bail du balayage.
 *
 * ⛔ Zéro ligne mise à jour ne prouve PAS qu'un autre balayage tient le bail : la ligne
 * peut ne pas exister du tout (base fraîche, purge manuelle), la migration étant son
 * unique créatrice. Chaque balayage répondait alors `{ ok: true, skipped: 'locked' }`
 * en 200, POUR TOUJOURS — la synchro morte, pg_cron au vert. Le semis
 * `on conflict do nothing` (`ignoreDuplicates`) répare ce cas sans jamais écraser un
 * bail tenu ; et une erreur PostgREST n'est plus rendue comme un « quelqu'un d'autre
 * travaille », mais comme une erreur.
 */
async function acquireLock(admin: SupabaseClient): Promise<LockResult> {
  const seed = await admin.from('mail_cron_locks')
    .upsert({ job: 'mail-sync', locked_until: new Date(0).toISOString() }, { onConflict: 'job', ignoreDuplicates: true })
  if (seed.error) return { ok: false, reason: 'error', detail: `lock seed: ${seed.error.message}` }
  const until = new Date(Date.now() + LOCK_TTL_MS).toISOString()
  const { data, error } = await admin.from('mail_cron_locks').update({ locked_until: until })
    .eq('job', 'mail-sync').lt('locked_until', new Date().toISOString()).select('job')
  if (error) return { ok: false, reason: 'error', detail: `lock acquire: ${error.message}` }
  return (data ?? []).length === 1 ? { ok: true, until } : { ok: false, reason: 'locked' }
}

/**
 * Rend le bail — et SEULEMENT le sien. La libération était inconditionnelle : un
 * balayage qui dépassait le TTL de 180 s libérait, en finissant, le bail qu'un
 * successeur venait de prendre, et un troisième démarrait à côté du deuxième — deux
 * balayages en course sur le même `sync_cursor`, sans le moindre signal.
 */
async function releaseLock(admin: SupabaseClient, until: string): Promise<void> {
  const { error } = await admin.from('mail_cron_locks').update({ locked_until: new Date().toISOString() })
    .eq('job', 'mail-sync').eq('locked_until', until)
  if (error) console.error('[mail-sync] libération du bail refusée:', error.message)
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  // Le client service-role est la SEULE lecture de configuration autorisée avant la
  // garde : `isServiceSecret` en a besoin pour lire `app_config`. Les secrets des
  // fournisseurs, eux, se lisent APRÈS — règle 4 du lot (corrigé le 03.09.2026 :
  // la version d'origine lisait les quatre secrets et interrogeait app_config avant
  // de refuser un appelant anonyme).
  // ⛔ LE CORPS EST BORNÉ AVANT D'ÊTRE LU. Cette edge est déployée `--no-verify-jwt` :
  // n'importe qui peut la POSTer, et `await req.json()` sans plafond faisait tamponner au
  // runtime un corps de plusieurs centaines de Mo AVANT la moindre garde. Or les deux seuls
  // corps légitimes sont `{}` (balayage) et `{"account_id":"<uuid>"}` : quelques dizaines
  // d'octets. ⚠ `Content-Length` est absent d'un envoi en `chunked` — le plafond n'est donc
  // pas une preuve, c'est le coût d'entrée d'un abus trivial qu'il retire. La lecture
  // d'`app_config` par `isServiceSecret`, elle, est déjà précédée du contrôle d'en-tête
  // `Authorization` (require-service-secret.ts:24) : un POST anonyme SANS en-tête ne coûte
  // aucun aller-retour en base.
  const declared = Number(req.headers.get('content-length') ?? '0')
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return json({ error: 'payload_too_large' }, 413)

  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* corps vide = balayage */ }

  // ── Appel ciblé par un agent ───────────────────────────────────────────────
  if (typeof body.account_id === 'string') {
    const auth = await requireAgentAuth(req, corsHeaders)
    if (auth instanceof Response) return auth
    const cfg = providerConfigFromEnv((k) => Deno.env.get(k))
    const account = await loadVisibleAccount(auth.supabase, body.account_id, { userId: auth.user.id, agencyId: auth.profile.agency_id })
    if (!account) return json({ error: 'not_found' }, 404)
    if (account.status !== 'active') return json({ error: 'account_not_active', status: account.status }, 409)
    const r = await syncAccount(auth.supabase, account, cfg, TARGETED_BUDGET_MS)
    return json({ account_id: account.id, ...r })
  }

  // ── Balayage cron ──────────────────────────────────────────────────────────
  if (!(await isServiceSecret(admin, req))) return json({ error: 'unauthorized' }, 401)
  const cfg = providerConfigFromEnv((k) => Deno.env.get(k))
  const lock = await acquireLock(admin)
  if (!lock.ok && lock.reason === 'error') {
    console.error('[mail-sync] bail:', lock.detail)
    return json({ error: 'lock_failed', detail: lock.detail }, 500)
  }
  if (!lock.ok) return json({ ok: true, skipped: 'locked' })
  const started = Date.now()
  const results: Record<string, unknown>[] = []
  let budgetExhausted = false
  let dueCount = 0
  try {
    // ⛔ La file de travail est LUE, ou le balayage échoue. Sans le contrôle d'erreur,
    // une lecture ratée (cache de schéma périmé juste après le déploiement, timeout)
    // rendait `due = null`, la boucle ne tournait pas, et la réponse était
    // `{ ok: true, synced: 0 }` en 200 : pg_cron au vert, aucun `last_error` écrit —
    // toute la messagerie du produit arrêtée sans un seul signal rouge. C'est
    // exactement la panne muette de la synchro d'agenda.
    const { data: due, error } = await admin.from('mail_accounts').select('*')
      .eq('status', 'active').lte('next_sync_at', new Date().toISOString())
      .order('next_sync_at', { ascending: true }).limit(MAX_ACCOUNTS_PER_TICK)
    if (error) {
      console.error('[mail-sync] file des comptes dus illisible:', error.message)
      return json({ error: 'due_query_failed', detail: error.message }, 500)
    }
    // ⚠ `status = 'active'` ne dit RIEN de l'appartenance du propriétaire : le départ
    // d'un agent (`team_remove_member`) ne touche pas `mail_accounts`. C'est
    // `assertOwnerStillInAgency`, au premier geste de `syncAccount`, qui refuse la
    // passe et bascule la boîte en `disabled` — elle sort alors de cette file d'
    // elle-même, sans qu'un seul message ait été écrit dans l'ancienne agence.
    dueCount = (due ?? []).length
    for (const account of (due ?? []) as MailAccountRow[]) {
      // ⚠ Sortir par ÉPUISEMENT DU BUDGET et sortir par « plus rien à faire » sont deux
      // états opposés que la réponse confondait : `{ ok: true, synced: 3 }` dans les deux
      // cas. Le premier veut dire qu'il reste des boîtes en file à chaque tick — le
      // symptôme de l'affamement, qu'aucun `last_error` n'écrit puisque personne n'échoue.
      if (Date.now() - started > SWEEP_BUDGET_MS) { budgetExhausted = true; break }
      const r = await syncAccount(admin, account, cfg, Math.min(PER_ACCOUNT_BUDGET_MS, SWEEP_BUDGET_MS - (Date.now() - started)))
      results.push({ account_id: account.id, provider: account.provider, ...r })
    }
  } finally {
    await releaseLock(admin, lock.until)
  }
  return json({ ok: true, synced: results.length, due: dueCount, budget_exhausted: budgetExhausted, elapsed_ms: Date.now() - started, results })
})
```

- [x] **Step 2 : Déclarer, vérifier, commit**

⛔ **NE PAS écrire ce bloc à la main.** La quasi-totalité de `supabase/config.toml` est une
**région GÉNÉRÉE**, délimitée par les marqueurs
`# ── GÉNÉRÉ par scripts/check-edge-roster.mjs — début ──` et `— fin ──` ; les rares blocs
écrits à la main, avec leur justification, vivent AU-DESSUS du marqueur d'ouverture.
Alphabétiquement, `mail-*` tombe entre `magic-link-send-email` et `matching-engine` — donc
DEDANS. Le script ne compte comme « documenté » que ce qui est hors marqueurs, puis régénère
la région et compare le fichier **texte pour texte** : un bloc inséré à la main y fait rougir
`npm run lint:roster`, avec un diagnostic qui ne nomme même pas la fonction
(« ✗ supabase/config.toml a dérivé du source tree »).
⚠ Cette note portait trois NUMÉROS DE LIGNE et deux comptes, copiés-collés dans cinq tâches
et déjà faux le lendemain (mesuré le 04.09.2026 : les marqueurs sont aux lignes 494 et 727,
la région porte 74 des 87 blocs, 13 restent au-dessus). Un numéro de ligne dans une note que
l'on lit JUSTE AVANT d'éditer le fichier envoie au mauvais endroit ; les noms de marqueurs,
eux, ne dérivent pas.

La façon juste — elle régénère `supabase/config.toml` ET `src/lib/edgeFunctionRoster.ts`
en une passe :
```bash
node scripts/check-edge-roster.mjs --write
npm run lint:roster    # attendu : exit 0
```
Le bloc produit est bien :
```toml
[functions.mail-sync]
verify_jwt = false
```
```bash
deno check supabase/functions/mail-sync/index.ts
git add supabase/functions/mail-sync/index.ts supabase/config.toml src/lib/edgeFunctionRoster.ts
git commit -m "feat(messagerie): edge mail-sync (balayage cron verrouillé, synchro ciblée)"
```

---

### Task 1.12 : Edge `mail-actions` (état des fils, rattachement, sync_now)

> ⚠ **Revue adverse « importante » du 04.09.2026 — un id Graph qui change n'est plus
> muet.** Avec `Prefer: IdType="ImmutableId"` partout (task 1.7), `graphMove` rend le
> même id et le rapprochement `ancien → nouveau` ne s'exécute plus. S'il s'exécutait
> quand même, ce ne serait pas seulement `mail_messages` qui dériverait : les
> `provider_attachment_id` d'Exchange sont rattachés à l'item PARENT et cesseraient de
> résoudre avec lui — `mail-attachment` rendrait 502 sur un mandat PDF archivé. Le cas
> est journalisé pour être vu avant d'être découvert par un agent.

> ⚠ **Revue adverse du 04.09.2026 — `{ ok: true }` sur un geste jamais envoyé.** La
> lecture des messages du fil ne vérifiait pas son `error` : `msgs = null` donnait une
> liste vide, la boucle de `pushToProvider` « réussissait » sans rien envoyer, l'état
> local était écrit et l'API répondait `{ ok: true }`. L'agent archivait un fil : archivé
> dans le CRM, intact dans Gmail — et le balayage de 2 minutes le rétablissait, sans que
> rien ne pointe vers la cause. La lecture rend 500 sur erreur ; un fil sans message est
> refusé en 409 plutôt que traité comme un succès vide ; et le rechargement final ne peut
> plus répondre `{ ok: true, thread: null }`.

**Files:**
- Create: `supabase/functions/mail-actions/index.ts`
- Modify: `supabase/config.toml`

- [x] **Step 1 : Écrire l'edge**

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
import { gmailLabelPatch, gmailModify } from '../_shared/mail/gmail.ts'
import { graphMove, graphPatch } from '../_shared/mail/graph.ts'
import { linkThreadToContact, recomputeThread } from '../_shared/mail/ingest.ts'
import { syncAccount } from '../_shared/mail/sync.ts'
import type { MailAccountRow, MailThreadAction } from '../_shared/mail/types.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
}
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

// Le type vit dans `types.ts` : `gmailLabelPatch` (gmail.ts) en dépend, et deux unions
// jumelles qui dérivent l'une de l'autre est exactement le défaut que ce module ne veut pas.
type ThreadAction = MailThreadAction
const THREAD_ACTIONS: ThreadAction[] = ['mark_read', 'mark_unread', 'star', 'unstar', 'archive', 'unarchive', 'trash', 'untrash']

interface MsgRow { id: string; provider_message_id: string; direction: 'inbound' | 'outbound' }

/** Applique le geste chez le fournisseur, message par message. Rend les nouveaux ids Graph (move). */
async function pushToProvider(account: MailAccountRow, token: string, action: ThreadAction, msgs: MsgRow[]): Promise<Record<string, string>> {
  const renamed: Record<string, string> = {}
  for (const m of msgs) {
    if (m.provider_message_id.startsWith('pending:')) continue
    if (account.provider === 'gmail') {
      // La table des libellés vit dans `gmail.ts` — pure, donc éprouvée par un test
      // unitaire. Elle dépend de la DIRECTION du message : voir son en-tête (INBOX ne se
      // pose jamais sur une copie « Envoyés »).
      const { add, remove } = gmailLabelPatch(action, m.direction)
      if (add.length === 0 && remove.length === 0) continue
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
  const { data: thread, error: eThread } = await admin.from('mail_threads').select('id, is_read, is_starred, is_archived, is_trashed, contact_id')
    .eq('id', threadId).eq('account_id', account.id).maybeSingle()
  // Une lecture en échec n'est pas un fil absent : la dire 404 enverrait l'agent
  // chercher un fil qu'il voit pourtant à l'écran.
  if (eThread) return json({ error: 'thread_query_failed', detail: eThread.message }, 500)
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
  // ⛔ Ce que le fournisseur doit recevoir, on refuse de le DEVINER. La lecture ne
  // vérifiait pas son erreur : `msgs = null` donnait une liste vide, la boucle de
  // `pushToProvider` « réussissait » sans rien envoyer, l'état local était écrit quand
  // même et l'API répondait `{ ok: true }`. L'agent archivait un fil : archivé dans le
  // CRM, intact dans Gmail — et le balayage de 2 minutes le rétablissait. Rien nulle
  // part ne pointait vers la cause. Un fil sans message est, lui, une anomalie : la
  // ligne de fil naît AVEC son premier message et `recomputeThread` la supprime dès
  // qu'elle se vide — mieux vaut le dire que le traiter comme un succès vide.
  const { data: msgs, error: eMsgs } = await admin.from('mail_messages').select('id, provider_message_id, direction').eq('thread_id', thread.id)
  if (eMsgs) return json({ error: 'messages_query_failed', detail: eMsgs.message }, 500)
  if (!msgs || msgs.length === 0) {
    console.error(`[mail-actions] fil ${thread.id} sans message — geste ${action} refusé`)
    return json({ error: 'thread_empty' }, 409)
  }

  try {
    const token = await getValidAccessToken(admin, account, account.provider === 'gmail' ? cfg.gmail : cfg.outlook)
    const renamed = await pushToProvider(account, token, action as ThreadAction, msgs as MsgRow[])
    for (const [oldId, newId] of Object.entries(renamed)) {
      if (oldId === newId) continue // id immuable : le déplacement ne le change plus
      // ⚠ Si un id CHANGE malgré `Prefer: IdType="ImmutableId"`, ce n'est pas seulement
      // `mail_messages` qui dérive : les `provider_attachment_id` d'Exchange sont
      // rattachés à l'item PARENT, donc ils cessent de résoudre avec lui, et
      // mail-attachment rendrait 502 sur un mandat PDF archivé. Ce cas ne devrait plus
      // exister ; s'il réapparaît, il doit se voir dans les journaux avant d'être
      // découvert par un agent.
      console.error(`[mail-actions] id Graph modifié malgré l'id immuable (${oldId} → ${newId}) — pièces jointes du message potentiellement irrésolubles`)
      const { error } = await admin.from('mail_messages').update({ provider_message_id: newId }).eq('account_id', account.id).eq('provider_message_id', oldId)
      if (error) throw new Error(`renommage d'id: ${error.message}`)
    }
  } catch (e) {
    return json({ error: 'provider_failed', detail: e instanceof Error ? e.message : String(e) }, 502)
  }

  const patch: Record<string, unknown> = {}
  if (action === 'mark_read' || action === 'mark_unread') {
    const { error } = await admin.from('mail_messages').update({ is_read: action === 'mark_read' }).eq('thread_id', thread.id)
    if (error) return json({ error: 'local_write_failed', detail: error.message }, 500)
    try { await recomputeThread(admin, thread.id) }
    catch (e) { return json({ error: 'local_write_failed', detail: e instanceof Error ? e.message : String(e) }, 500) }
  }
  if (action === 'star') patch.is_starred = true
  if (action === 'unstar') patch.is_starred = false
  if (action === 'archive') patch.is_archived = true
  if (action === 'unarchive') patch.is_archived = false
  if (action === 'trash') { patch.is_trashed = true }
  if (action === 'untrash') { patch.is_trashed = false; patch.is_archived = false }
  if (Object.keys(patch).length) {
    const { error } = await admin.from('mail_threads').update(patch).eq('id', thread.id)
    if (error) return json({ error: 'local_write_failed', detail: error.message }, 500)
  }

  const { data: after, error: eAfter } = await admin.from('mail_threads').select('id, is_read, is_starred, is_archived, is_trashed').eq('id', thread.id).single()
  // `{ ok: true, thread: null }` disait « c'est fait » sur un fil devenu illisible.
  if (eAfter || !after) return json({ error: 'thread_reload_failed', detail: eAfter?.message ?? 'aucune ligne' }, 500)
  return json({ ok: true, thread: after })
})
```

- [x] **Step 2 : Déclarer, vérifier, commit**

⛔ **NE PAS écrire ce bloc à la main.** La quasi-totalité de `supabase/config.toml` est une
**région GÉNÉRÉE**, délimitée par les marqueurs
`# ── GÉNÉRÉ par scripts/check-edge-roster.mjs — début ──` et `— fin ──` ; les rares blocs
écrits à la main, avec leur justification, vivent AU-DESSUS du marqueur d'ouverture.
Alphabétiquement, `mail-*` tombe entre `magic-link-send-email` et `matching-engine` — donc
DEDANS. Le script ne compte comme « documenté » que ce qui est hors marqueurs, puis régénère
la région et compare le fichier **texte pour texte** : un bloc inséré à la main y fait rougir
`npm run lint:roster`, avec un diagnostic qui ne nomme même pas la fonction
(« ✗ supabase/config.toml a dérivé du source tree »).
⚠ Cette note portait trois NUMÉROS DE LIGNE et deux comptes, copiés-collés dans cinq tâches
et déjà faux le lendemain (mesuré le 04.09.2026 : les marqueurs sont aux lignes 494 et 727,
la région porte 74 des 87 blocs, 13 restent au-dessus). Un numéro de ligne dans une note que
l'on lit JUSTE AVANT d'éditer le fichier envoie au mauvais endroit ; les noms de marqueurs,
eux, ne dérivent pas.

La façon juste — elle régénère `supabase/config.toml` ET `src/lib/edgeFunctionRoster.ts`
en une passe :
```bash
node scripts/check-edge-roster.mjs --write
npm run lint:roster    # attendu : exit 0
```
Le bloc produit est bien :
```toml
[functions.mail-actions]
verify_jwt = false
```
```bash
deno check supabase/functions/mail-actions/index.ts
git add supabase/functions/mail-actions/index.ts supabase/config.toml src/lib/edgeFunctionRoster.ts
git commit -m "feat(messagerie): edge mail-actions (lu, étoile, archive, corbeille, rattachement, sync_now)"
```

---

### Task 1.13 : Edge `mail-send` (nouveau · réponse · transfert)

> ⛔ **Revue adverse « importante » du 04.09.2026 — trois défauts, dont un DOUBLE ENVOI.**
> (1) Un seul `try` couvrait l'appel fournisseur ET la comptabilité locale : `gmailSend`
> réussissait — le client A le courrier — puis `ingestMessages` levait sur n'importe
> quelle écriture, et l'edge répondait `send_failed` en 502 ; côté Outlook, `t!.id` sur
> une insertion non vérifiée levait un TypeError dans le même catch. L'agent lit
> « échec », renvoie, le client reçoit le message DEUX fois. Deux phases désormais, la
> frontière étant l'acceptation par le fournisseur : avant, 502 ; après, **200 avec
> `warning: 'sent_but_not_recorded'`** et un journal. (2) Le transfert Gmail passait le
> `threadId` de l'original avec un objet `Fwd:` — le guide d'envoi exige « The Subject
> headers match » : ou Gmail refuse, ou il ouvre un fil à part et les deux boîtes
> divergent pour toujours. `threadId = null` pour un transfert, et plus de
> `In-Reply-To`/`References` collés dessus (sous RFC 5322 ils rangeaient le transfert,
> chez le destinataire, dans une conversation à laquelle il n'a jamais participé).
> (3) Le plafond de 3 Mo par pièce de Graph est refusé en amont par un 413 nommé, au lieu
> d'un 502 muet propre à Outlook.

**Files:**
- Create: `supabase/functions/mail-send/index.ts`
- Modify: `supabase/config.toml`

- [x] **Step 1 : Écrire l'edge**

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
import { base64ByteLength, base64Encode, base64UrlEncode, buildMime, escapeHtml, makeMessageId, textToHtml } from '../_shared/mail/mime.ts'
import { gmailAttachment, gmailGetMessage, gmailSend, normalizeGmailMessage } from '../_shared/mail/gmail.ts'
import { GRAPH_ATTACHMENT_MAX_BYTES, graphSend } from '../_shared/mail/graph.ts'
import { ingestMessages, recomputeThread } from '../_shared/mail/ingest.ts'
import type { MailAddress, OutgoingMessage } from '../_shared/mail/types.ts'

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
  if (attachments.reduce((n, a) => n + base64ByteLength(a.base64), 0) > MAX_TOTAL_ATTACHMENT_BYTES) return json({ error: 'attachments_too_large' }, 413)

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

  // ⛔ Graph refuse une pièce de 3 Mo ou plus dans la collection d'un brouillon
  // (« limits the size of the attachment you can add to under 3 MB ») et ce build
  // n'implémente pas `createUploadSession`. Sans ce contrôle, un PDF de 4 Mo envoyé à
  // un acheteur passait sur Gmail et rendait 502 `send_failed` sur Outlook, sans que
  // rien ne dise que la TAILLE était en cause.
  if (account.provider === 'outlook') {
    const tooBig = outAtts.find((a) => base64ByteLength(a.base64) >= GRAPH_ATTACHMENT_MAX_BYTES)
    if (tooBig) return json({ error: 'attachment_too_large_outlook', filename: tooBig.filename, limit_bytes: GRAPH_ATTACHMENT_MAX_BYTES }, 413)
  }

  const messageId = makeMessageId(account.email.split('@')[1] ?? 'megga.ch')
  // ⛔ UN TRANSFERT N'EST PAS UNE RÉPONSE. Coller `In-Reply-To`/`References` de
  // l'original sur un transfert le range, chez le DESTINATAIRE, dans une conversation
  // à laquelle il n'a jamais participé (RFC 5322 : ces en-têtes désignent le message
  // auquel on RÉPOND). Ils ne sont posés que pour `reply`.
  const isReply = kind === 'reply'
  /**
   * ⚠ `References` NE S'ACCUMULE PAS, et c'est un écart ASSUMÉ à la RFC 5322 §3.6.4 (qui
   * veut « References du parent, puis Message-ID du parent »). Ici c'est
   * « In-Reply-To du parent, puis son Message-ID » : deux identifiants au maximum, quelle
   * que soit la longueur du fil.
   *
   * NON CORRIGÉ le 04.09.2026, faute de la donnée : `NormalizedMessage.references` existe
   * (types.ts) mais `ingest.ts` ne l'écrit nulle part et `mail_messages` n'a pas de colonne
   * pour la porter. Réparer demande donc une colonne `references text[]`, son écriture à
   * l'ingestion, puis la concaténation ici — un changement de schéma pour un défaut dont
   * l'effet est BORNÉ : le lien au parent immédiat est correct, donc Gmail, Outlook et
   * Apple Mail continuent d'enfiler la conversation. Ce qui se dégrade est le cas du
   * participant ajouté au huitième message, dont le client ne peut pas recoudre la réponse
   * à une racine qu'il n'a jamais reçue — et les archives qui reconstruisent l'arbre par
   * `References` seul (Thunderbird, mutt) après un trou. À reprendre au lot 2, avec la
   * troncature d'usage aux ~20 derniers identifiants.
   */
  const outgoing: OutgoingMessage = {
    from: { name: account.display_name ?? (prof?.full_name as string | null) ?? null, email: account.email },
    to, cc, bcc, subject, text: fullText, html: fullHtml,
    inReplyTo: isReply ? (original?.rfc822_message_id ?? null) : null,
    references: isReply && original ? [...(original.in_reply_to ? [original.in_reply_to] : []), ...(original.rfc822_message_id ? [original.rfc822_message_id] : [])] : [],
    messageId, attachments: outAtts,
  }

  let localMessageId: string | null = null
  let threadId: string | null = original?.thread_id ?? null
  if (account.provider !== 'gmail' && account.provider !== 'outlook') return json({ error: 'provider_not_supported' }, 501)

  /**
   * ⛔ DEUX PHASES, DEUX VERDICTS — et la frontière est l'ACCEPTATION PAR LE
   * FOURNISSEUR. Un seul `try` couvrait l'appel fournisseur ET toute la comptabilité
   * locale : `gmailSend` réussissait (le courrier est PARTI, le client l'a), puis
   * `ingestMessages` levait sur n'importe quelle écriture — insertion de fil, de
   * message, de pièce — et l'edge répondait `send_failed` en 502. Côté Outlook,
   * `t!.id` sur une insertion non vérifiée levait un TypeError dans le même catch.
   * L'agent lit « échec », renvoie, et le client reçoit le message DEUX fois. Rien ne
   * distinguait « le fournisseur a refusé » de « le fournisseur a accepté et nous
   * n'avons pas su l'écrire ».
   *
   * Après acceptation, la réponse est donc 200 avec un drapeau que le lot 2 peut
   * afficher (« envoyé ; copie locale incomplète, elle se rattrapera à la synchro »),
   * jamais une erreur d'envoi. Le rattrapage existe : Gmail réingère le message à la
   * passe suivante, et Graph rapproche la copie « Envoyés » par Message-ID.
   */
  let sentProviderMessageId: string | null = null
  try {
    if (account.provider === 'gmail') {
      const { data: th } = threadId ? await admin.from('mail_threads').select('provider_thread_id').eq('id', threadId).single() : { data: null }
      // ⛔ PAS DE threadId POUR UN TRANSFERT. Le guide d'envoi de Gmail pose les
      // conditions pour qu'un message rejoigne un fil existant : « The Subject headers
      // match » et « The References and In-Reply-To headers follow the RFC 2822
      // standard ». Un transfert porte `Fwd: <objet>`, qui ne concorde PAS. Les deux
      // issues étaient mauvaises : ou Gmail refusait l'envoi (502 `send_failed`, le
      // transfert devenait impossible), ou il l'acceptait en ouvrant un fil à part —
      // et le CRM gardait le transfert dans l'ancien fil pendant que Gmail le rangeait
      // ailleurs, les deux boîtes divergeant définitivement. Le fil CRM suit désormais
      // le fournisseur : la ligne relue après ingestion porte le vrai `thread_id`.
      const providerThreadId = kind === 'forward' ? null : (th?.provider_thread_id ?? null)
      const sent = await gmailSend(token, base64UrlEncode(new TextEncoder().encode(buildMime(outgoing))), providerThreadId)
      sentProviderMessageId = sent.id
    } else {
      const mode = original ? { kind: kind as 'reply' | 'forward', providerMessageId: original.provider_message_id } : { kind: 'new' as const }
      await graphSend(token, { subject, html: fullHtml, to, cc, bcc, internetMessageId: messageId, attachments: outAtts }, mode)
    }
  } catch (e) {
    return json({ error: 'send_failed', detail: e instanceof Error ? e.message : String(e) }, 502)
  }

  // ── Le courrier est PARTI. Tout ce qui suit est de la comptabilité locale. ───────
  let bookkeeping: string | null = null
  try {
    if (account.provider === 'gmail') {
      // Gmail rend l'id du message envoyé ; sans lui il n'y a rien à réingérer.
      if (!sentProviderMessageId) throw new Error('gmail: aucun id de message rendu par messages.send')
      const full = await gmailGetMessage(token, sentProviderMessageId)
      await ingestMessages(admin, account, [normalizeGmailMessage(full, account.email)], { skipAudit: true })
      const { data: row, error } = await admin.from('mail_messages').select('id, thread_id').eq('account_id', account.id).eq('provider_message_id', sentProviderMessageId).maybeSingle()
      if (error) throw new Error(`relecture du message envoyé: ${error.message}`)
      localMessageId = row?.id ?? null; threadId = row?.thread_id ?? threadId
    } else {
      // Ligne provisoire : la synchro « Envoyés » la rapproche par Message-ID.
      if (!threadId) {
        const { data: t, error } = await admin.from('mail_threads').insert({
          account_id: account.id, agency_id: account.agency_id, provider_thread_id: `pending-thread:${messageId}`,
          subject, snippet: text.slice(0, 160), participants: to, from_name: outgoing.from.name, from_email: account.email,
          last_message_at: new Date().toISOString(), last_outbound_at: new Date().toISOString(), message_count: 0, is_read: true,
        }).select('id').single()
        // ⚠ `t!.id` sur un résultat non vérifié levait un TypeError — dans l'ancien
        // `try` unique, cela devenait `send_failed` sur un courrier DÉJÀ PARTI.
        if (error || !t) throw new Error(`fil provisoire: ${error?.message ?? 'aucune ligne rendue'}`)
        threadId = t.id
      }
      const { data: m, error: eMsg } = await admin.from('mail_messages').insert({
        thread_id: threadId, account_id: account.id, agency_id: account.agency_id,
        provider_message_id: `pending:${messageId}`, rfc822_message_id: messageId, in_reply_to: outgoing.inReplyTo,
        direction: 'outbound', from_name: outgoing.from.name, from_email: account.email, to, cc, bcc,
        subject, snippet: text.slice(0, 160), body_text: fullText, body_html: fullHtml, sent_at: new Date().toISOString(),
        is_read: true, has_attachments: outAtts.length > 0,
      }).select('id').single()
      if (eMsg) throw new Error(`message provisoire: ${eMsg.message}`)
      localMessageId = m?.id ?? null
      const { error: eThread } = await admin.from('mail_threads').update({ last_message_at: new Date().toISOString(), last_outbound_at: new Date().toISOString(), snippet: text.slice(0, 160) }).eq('id', threadId)
      if (eThread) throw new Error(`fil, dates: ${eThread.message}`)
      // Le compteur et les dates viennent des messages : la ligne provisoire compte déjà.
      // ⚠ `threadId` est `string | null` ici pour TypeScript (il vient de `original?.thread_id`) :
      // sans cette garde, `deno check` rend TS2345 et l'étape CI « Type-check Edge Functions »,
      // déclarée bloquante, rougit.
      if (threadId) await recomputeThread(admin, threadId)
    }
  } catch (e) {
    // JAMAIS 502 ici : le fournisseur a accepté. Un refus renvoyé à l'agent le ferait
    // renvoyer, et le client recevrait le courrier deux fois.
    bookkeeping = e instanceof Error ? e.message : String(e)
    console.error(`[mail-send] ${account.provider} ${account.id}: envoyé mais NON enregistré — ${bookkeeping}`)
  }

  // Audit avec l'acteur (l'ingestion a été appelée en skipAudit).
  const { data: th } = threadId ? await admin.from('mail_threads').select('contact_id').eq('id', threadId).maybeSingle() : { data: null }
  if (th?.contact_id) {
    // ⛔ Le résultat de cette insertion était jeté — pas de `error`, pas de journal. Un
    // `email_sent` manquant dans la timeline d'un contact ne laissait alors AUCUNE trace,
    // nulle part, alors que CLAUDE.md §5 fait d'`activity_events` la trace de chaque
    // action. On ne refuse pas l'envoi pour autant : le courrier est parti.
    const { error: eAudit } = await admin.from('activity_events').insert({
      agency_id: account.agency_id, actor_id: user.id, actor_kind: 'user', action: 'email_sent', category: 'messaging', severity: 'info',
      entity_type: 'contact', entity_id: th.contact_id, object_label: subject,
      metadata: { thread_id: threadId, message_id: localMessageId, account_id: account.id, to: to.map((a) => a.email), kind },
    })
    if (eAudit) console.error(`[mail-send] activity_events refuse email_sent (fil ${threadId}, contact ${th.contact_id}):`, eAudit.message)
  }
  if (typeof body.draft_id === 'string') await admin.from('mail_drafts').delete().eq('id', body.draft_id).eq('author_id', user.id)
  // `ok: true` parce que le courrier est parti — `warning` dit que la copie locale est
  // incomplète, pour que l'UI l'annonce au lieu d'inviter à renvoyer.
  return json(bookkeeping
    ? { ok: true, message_id: localMessageId, thread_id: threadId, warning: 'sent_but_not_recorded', detail: bookkeeping.slice(0, 300) }
    : { ok: true, message_id: localMessageId, thread_id: threadId })
})
```

⚠ **`MailAccountRow` a été RETIRÉ de l'import de types** (04.09.2026) : ce fichier ne le
nomme nulle part — `loadVisibleAccount` rend déjà le type, et aucune annotation locale ne
le redit. `deno check` ne se plaint pas d'un import inutilisé (c'est une règle de lint, pas
de types) et le dépôt ne fait pas tourner `deno lint`, donc rien ne l'aurait signalé : le
corriger ici évite qu'il se recopie. Les deux autres, `MailAddress` et `OutgoingMessage`,
servent bien.

- [x] **Step 2 : Déclarer, vérifier, commit**

⛔ **NE PAS écrire ce bloc à la main.** La quasi-totalité de `supabase/config.toml` est une
**région GÉNÉRÉE**, délimitée par les marqueurs
`# ── GÉNÉRÉ par scripts/check-edge-roster.mjs — début ──` et `— fin ──` ; les rares blocs
écrits à la main, avec leur justification, vivent AU-DESSUS du marqueur d'ouverture.
Alphabétiquement, `mail-*` tombe entre `magic-link-send-email` et `matching-engine` — donc
DEDANS. Le script ne compte comme « documenté » que ce qui est hors marqueurs, puis régénère
la région et compare le fichier **texte pour texte** : un bloc inséré à la main y fait rougir
`npm run lint:roster`, avec un diagnostic qui ne nomme même pas la fonction
(« ✗ supabase/config.toml a dérivé du source tree »).
⚠ Cette note portait trois NUMÉROS DE LIGNE et deux comptes, copiés-collés dans cinq tâches
et déjà faux le lendemain (mesuré le 04.09.2026 : les marqueurs sont aux lignes 494 et 727,
la région porte 74 des 87 blocs, 13 restent au-dessus). Un numéro de ligne dans une note que
l'on lit JUSTE AVANT d'éditer le fichier envoie au mauvais endroit ; les noms de marqueurs,
eux, ne dérivent pas.

La façon juste — elle régénère `supabase/config.toml` ET `src/lib/edgeFunctionRoster.ts`
en une passe :
```bash
node scripts/check-edge-roster.mjs --write
npm run lint:roster    # attendu : exit 0
```
Le bloc produit est bien :
```toml
[functions.mail-send]
verify_jwt = false
```
```bash
deno check supabase/functions/mail-send/index.ts
git add supabase/functions/mail-send/index.ts supabase/config.toml src/lib/edgeFunctionRoster.ts
git commit -m "feat(messagerie): edge mail-send (nouveau, réponse, transfert ; Gmail raw, Graph brouillon+send)"
```

---

### Task 1.14 : Edge `mail-attachment` (octets authentifiés + classement au dossier)

> ⛔ **Revue adverse « importante » du 04.09.2026 — XSS STOCKÉ PAR PIÈCE JOINTE.** Le GET
> recopiait `mail_attachments.mime_type` — écrit par `ingest.ts` depuis `part.mimeType`
> (Gmail) ou `a.contentType` (Graph), donc choisi par l'EXPÉDITEUR du courrier — en
> `Content-Type`, avec `Content-Disposition: inline`. Un inconnu envoyait une pièce
> déclarée `text/html` portant un `<script>`, l'agent ouvrait le message, le front la
> lisait avec son jeton : script dans la session du CRM, et compromission inter-agences
> si la victime est super-admin. `X-Content-Type-Options: nosniff` n'y peut rien — il
> empêche de DEVINER un type, pas d'en honorer un déclaré. `attachmentServing`
> (`_shared/mail/mime.ts`, task 1.3) décide désormais : liste blanche de rendu, tout le
> reste en `application/octet-stream` + `attachment`, plus une CSP `default-src 'none';
> sandbox` en ceinture.

**Files:**
- Create: `supabase/functions/mail-attachment/index.ts`
- Modify: `supabase/config.toml`

- [x] **Step 1 : Écrire l'edge**

```ts
// supabase/functions/mail-attachment/index.ts
// GET  ?id=<mail_attachments.id>       → octets de la pièce, TÉLÉCHARGÉS EN MÉMOIRE avec le
//                                        jeton du compte puis rendus (jamais d'URL publique,
//                                        jamais d'objet Storage signable ; type SERVI décidé
//                                        par la liste blanche `attachmentServing`, jamais
//                                        celui que l'expéditeur a déclaré).
//   ⚠ CE N'EST PAS UN FLUX, et l'en-tête a dit le contraire jusqu'au 04.09.2026 — le plan
//   maître, lui, avait déjà corrigé la phrase le 03.09. Les deux adaptateurs matérialisent
//   l'objet ENTIER : `gmailAttachment` décode tout le base64 dans un `Uint8Array`,
//   `graphAttachmentBytes` fait un `arrayBuffer()`, et le `Content-Length` ci-dessous se lit
//   sur un tampon complet. Conséquence à connaître avant de toucher au plafond de 25 Mio :
//   deux téléchargements simultanés font 50 Mio résidents dans l'isolat.
// POST { action:'file', attachment_id, contact_id, document_type, name?, category? }
//                                      → copie dans le bucket `documents` + ligne `documents`
//                                        (contact_id, sha256), mail_attachments.document_id posé.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'
import { accountVisibleTo, providerConfigFromEnv } from '../_shared/mail/guard.ts'
import { attachmentServing } from '../_shared/mail/mime.ts'
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

async function loadAttachment(admin: SupabaseClient, id: string, ctx: { userId: string; agencyId: string }) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const { data: att } = await admin.from('mail_attachments').select('*').eq('id', id).maybeSingle()
  if (!att) return null
  const { data: account } = await admin.from('mail_accounts').select('*').eq('id', att.account_id).maybeSingle()
  if (!account || !accountVisibleTo(account as MailAccountRow, ctx)) return null
  // ⛔ `msg!.provider_message_id` sur une lecture NON contrôLÉE, hors de tout `try` : les
  // deux appelants de `loadAttachment` n'en ont aucun, donc un message disparu entre-temps
  // (course avec la cascade de `recomputeThread`) ou une simple erreur de lecture levait un
  // TypeError qui traversait `serve` — l'appelant recevait le 500 générique de la
  // plateforme, sans corps, sans rien à diagnostiquer. Un `null` rend le 404 que les deux
  // chemins savent déjà écrire, et la cause part dans les journaux.
  const { data: msg, error: eMsg } = await admin.from('mail_messages').select('provider_message_id').eq('id', att.message_id).maybeSingle()
  if (eMsg || !msg) {
    console.error(`[mail-attachment] pièce ${id}: message ${att.message_id} illisible —`, eMsg?.message ?? 'aucune ligne')
    return null
  }
  return { att: att as AttRow, account: account as MailAccountRow, providerMessageId: msg.provider_message_id as string }
}

async function fetchBytes(admin: SupabaseClient, a: NonNullable<Awaited<ReturnType<typeof loadAttachment>>>): Promise<Uint8Array> {
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
    // Le type vient de l'EXPÉDITEUR du courrier : il ne traverse jamais tel quel.
    // `attachmentServing` (mime.ts) rend l'essence autorisée pour un rendu en ligne, ou
    // `application/octet-stream` + `attachment` pour tout le reste — sans quoi une pièce
    // déclarée `text/html` s'exécutait dans la session de l'agent.
    const serving = attachmentServing(a.att.mime_type)
    return new Response(toBuffer(bytes), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': serving.contentType,
        'Content-Length': String(bytes.byteLength),
        'Content-Disposition': `${serving.disposition}; filename*=UTF-8''${name}`,
        'Cache-Control': 'private, max-age=300',
        'X-Content-Type-Options': 'nosniff',
        // Ceinture et bretelles : même si un jour une essence scriptable entrait dans la
        // liste, la page servie ici n'a droit à rien.
        'Content-Security-Policy': "default-src 'none'; sandbox",
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
  // ⚠ CE MARQUAGE EST CE QUI EMPÊCHE DE CLASSER DEUX FOIS. Son résultat n'était pas lu :
  // un échec ici laissait `document_id` nul alors que le fichier EST déposé et la ligne
  // `documents` insérée — la même pièce se reclassait, produisant un doublon dans
  // `documents` ET un second événement d'audit. On ne défait rien (le classement a bien eu
  // lieu, le défaire serait pire), on le DIT, pour que le lot 2 n'affiche pas « à classer »
  // sur une pièce déjà au dossier.
  const { error: eMark } = await admin.from('mail_attachments').update({ document_id: documentId }).eq('id', a.att.id)
  if (eMark) console.error(`[mail-attachment] pièce ${a.att.id} classée en ${documentId} mais NON marquée:`, eMark.message)
  // ⛔ L'AUDIT EST OBLIGATOIRE ICI (CLAUDE.md §5 : `activity_events` pour toute action), et
  // son résultat était jeté sans même un journal. Un document versé au dossier d'un contact
  // sans sa ligne d'audit est un trou de conformité qui ne se découvre qu'à l'audit, des
  // mois plus tard. On continue — le document est classé, le refuser après coup ne
  // rendrait rien — mais l'échec existe désormais quelque part.
  const { error: eAudit } = await admin.from('activity_events').insert({
    agency_id: profile.agency_id, actor_id: user.id, actor_kind: 'user', action: 'document_filed_from_email', category: 'doc', severity: 'info',
    entity_type: 'contact', entity_id: contactId, object_label: name,
    metadata: { document_id: documentId, attachment_id: a.att.id, message_id: a.att.message_id, document_type: docType },
  })
  if (eAudit) console.error(`[mail-attachment] activity_events refuse document_filed_from_email (document ${documentId}, contact ${contactId}):`, eAudit.message)
  const warning = eMark ? 'not_marked_filed' : eAudit ? 'not_audited' : null
  return json(warning
    ? { ok: true, document_id: documentId, storage_path: storagePath, warning }
    : { ok: true, document_id: documentId, storage_path: storagePath })
})
```

- [x] **Step 2 : Déclarer, vérifier, commit**

⛔ **NE PAS écrire ce bloc à la main.** La quasi-totalité de `supabase/config.toml` est une
**région GÉNÉRÉE**, délimitée par les marqueurs
`# ── GÉNÉRÉ par scripts/check-edge-roster.mjs — début ──` et `— fin ──` ; les rares blocs
écrits à la main, avec leur justification, vivent AU-DESSUS du marqueur d'ouverture.
Alphabétiquement, `mail-*` tombe entre `magic-link-send-email` et `matching-engine` — donc
DEDANS. Le script ne compte comme « documenté » que ce qui est hors marqueurs, puis régénère
la région et compare le fichier **texte pour texte** : un bloc inséré à la main y fait rougir
`npm run lint:roster`, avec un diagnostic qui ne nomme même pas la fonction
(« ✗ supabase/config.toml a dérivé du source tree »).
⚠ Cette note portait trois NUMÉROS DE LIGNE et deux comptes, copiés-collés dans cinq tâches
et déjà faux le lendemain (mesuré le 04.09.2026 : les marqueurs sont aux lignes 494 et 727,
la région porte 74 des 87 blocs, 13 restent au-dessus). Un numéro de ligne dans une note que
l'on lit JUSTE AVANT d'éditer le fichier envoie au mauvais endroit ; les noms de marqueurs,
eux, ne dérivent pas.

La façon juste — elle régénère `supabase/config.toml` ET `src/lib/edgeFunctionRoster.ts`
en une passe :
```bash
node scripts/check-edge-roster.mjs --write
npm run lint:roster    # attendu : exit 0
```
Le bloc produit est bien :
```toml
[functions.mail-attachment]
verify_jwt = false
```
```bash
deno check supabase/functions/mail-attachment/index.ts
git add supabase/functions/mail-attachment/index.ts supabase/config.toml src/lib/edgeFunctionRoster.ts
git commit -m "feat(messagerie): edge mail-attachment (flux authentifié, classement au dossier avec SHA-256)"
```

---

### Task 1.15 : Portes du lot + contrats HTTP des edges

**Files:**
- Create: `tests/backend/mail-edges.spec.ts`
- Modify: `src/lib/edgeFunctionRoster.ts` (régénéré), `src/types/database.ts` (régénéré)

- [x] **Step 1 : Roster, garde d'auth, idempotence**

```bash
node scripts/check-edge-roster.mjs --write
npm run lint:roster
npm run lint:edge-auth
npm run lint:migrations
```
Attendu : roster régénéré avec `mail-actions`, `mail-attachment`, `mail-oauth`, `mail-send`, `mail-sync` ; `lint:edge-auth` vert (chaque `index.ts` contient `requireAgentAuth` ou `isServiceSecret`) ; migrations vertes.

Mesuré le 04.09.2026 : `✓ Roster edge functions en phase avec le tree (87 fonctions).` /
`✓ supabase/config.toml déclare les 87 fonctions du tree.` ; `✓ Gardes edge : 85 fonction(s)
authentifient leur appelant, 2 ouverte(s) par conception et justifiée(s).` ;
`✓ Migrations rejouables (312 vérifiées, 3 historiques exclues).` Les cinq `mail-*` sont bien
dans `src/lib/edgeFunctionRoster.ts` (l. 59-63) et dans `supabase/config.toml` (l. 616-629).

- [x] **Step 2 : Types — ⛔ DÉLIBÉRÉMENT NON RÉGÉNÉRÉS, et c'est l'état JUSTE**

```bash
supabase db reset
npx supabase gen types typescript --local > src/types/database.ts
npm run build
```
⛔ **CES DEUX PREMIÈRES LIGNES SONT INEXÉCUTABLES ICI, ET LES CONTOURNER SERAIT PIRE QUE DE
S'EN PASSER.** Mesuré le 04.09.2026 : aucun runtime de conteneur sur la machine (`docker`,
`podman`, `colima`, `nerdctl` tous absents), donc pas de base locale à générer. Et générer
depuis la **production** ne réparerait rien : la migration n'y est pas encore appliquée, la
sortie n'aurait donc **aucune table `mail_*`** — soit un fichier identique (churn pour rien),
soit un fichier appauvri qui casserait les lots 2 et 3.

`src/types/database.ts` est donc laissé **intact**, et c'est prouvé plutôt que supposé :
- `npm run lint:types-freshness` → vert. Il le dit lui-même : `SUPABASE_ACCESS_TOKEN absent —
  contrôles statiques seuls (la comparaison à la prod est SAUTÉE).` Les deux côtés qu'il
  compare — le fichier et la production — sont **d'accord parce que ni l'un ni l'autre n'a la
  migration**. C'est un vert honnête, pas un vert creux : le script refuse explicitement
  d'annoncer « aucune relation manquante » sans avoir interrogé la base.
- La comparaison réelle vit dans `.github/workflows/migration-drift.yml:76`
  (`check-types-freshness.mjs --prod`), déclenché sur `push: main` — donc **APRÈS le merge**,
  jamais sur la PR (`unit-tests.yml:104` lance la version statique).
- `npm run build` → vert (`✓ built in 2.26s`). Rien dans `src/` ne référence encore une table
  `mail_*` : le lot 1 est du backend seul.
- Aucun client casté dans le code neuf. Les seuls `as unknown as` du module sont des `fetch`
  factices dans les `*.test.ts` de `_shared/mail/`, hors du périmètre `src/` de la porte.

**La conséquence est reportée au merge : voir la section finale de ce document.**

- [x] **Step 3 : Spec des contrats HTTP**

```ts
// Contrats HTTP des cinq edges de la Messagerie contre le runtime edge LOCAL.
//
// ⚠ ON ASSERTE LE CORPS DES REFUS, PAS SEULEMENT LE STATUT. La passerelle locale
// répond elle aussi 401, avec un autre message : un test qui ne regarde que le
// code prouverait qu'un gestionnaire jamais atteint refuse bien. Même raison que
// tests/backend/edge-service-secret-guard.spec.ts, qui l'écrit en tête.
//
// ⛔ 404 ET JAMAIS 403 POUR UN COMPTE D'UNE AUTRE AGENCE. `loadVisibleAccount`
// (_shared/mail/guard.ts) rend `null` aussi bien pour un id inexistant que pour
// un id appartenant à un tiers, et les cinq edges le traduisent en `not_found`.
// Un 403 dirait « cet id existe, mais pas pour vous » : un oracle d'existence
// inter-agences, exactement ce que la garde est là pour ne pas offrir. Ce fichier
// fige le 404 dans les QUATRE edges qui décident d'une visibilité : mail-actions,
// mail-send et mail-oauth par leur `account_id`, et mail-attachment — le seul qui
// rende des OCTETS — par le compte qu'il déduit de l'`attachment_id`. La version
// livrée annonçait « les trois edges qui prennent un account_id », ce qui excluait
// en silence le cas de plus grande valeur.
//
// ⛔ ET LA FIXTURE DÉCISIVE EST `boxAinB` : une boîte de l'AGENCE B dont le
// PROPRIÉTAIRE est l'agent A. C'est la seule forme qui distingue le prédicat
// CONJOINT (`agence == agence && (visibilité=='agency' || propriétaire==moi)`) de
// sa régression en DISJONCTION — celle que 58f250a8 a dû corriger, et qui rend un
// ex-employé lecteur à vie de son ancienne boîte. Une boîte de l'agence B possédée
// par l'agent B rend `false` sous les DEUX prédicats : le test restait vert pendant
// que tous les edges fuyaient.
//
// Ordre des refus, tel que le code le pose — un test qui l'ignore mesure autre
// chose que ce qu'il annonce :
//   mail-oauth start    provider (400) → origine (400) → clientId (503)
//   mail-send           auth (401) → compte visible (404) → statut (409) → destinataire (400)
//   mail-sync           account_id présent ? auth agent : secret de service (401)
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'
import { waitForEdgeWorker } from './helpers/edge'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'

// ⚠ `||` et non `??` : en CI la variable peut être exportée VIDE, et `??` ne
// retomberait pas. Même repli que agency-verification-run.spec.ts:115.
// Le JWT legacy est ce que le runtime edge injecte sous SUPABASE_SERVICE_ROLE_KEY ;
// une clé `sb_secret_…` est un credential valide mais AUTRE, et rendrait 401.
const SERVICE_JWT = process.env.SUPABASE_TEST_SERVICE_ROLE_JWT || process.env.SUPABASE_TEST_SERVICE_ROLE_KEY || ''

const FN = (name: string) => `${URL}/functions/v1/${name}`
const NAMES = ['mail-oauth', 'mail-sync', 'mail-actions', 'mail-send', 'mail-attachment']

/** Edges dont la garde est `requireAgentAuth` — leur refus anonyme dit « Authentication required ». */
const AGENT_EDGES = ['mail-oauth', 'mail-actions', 'mail-send']

describe.skipIf(!HAS_KEYS)('Messagerie — contrats HTTP des edges', () => {
  let s: TwoAgenciesSetup
  let jwtA: string
  let boxAId: string
  let boxBId: string
  /** Agence B, propriétaire = agent A : la forme d'après-départ (voir l'en-tête). */
  let boxAinBId: string
  /** Pièce jointe portée par `boxAinBId` (agence B) et par `boxBId`. */
  let attInBId: string
  let attOfBId: string

  const call = async (name: string, body: unknown, jwt?: string, method = 'POST') => {
    const res = await fetch(FN(name), {
      method,
      headers: { 'Content-Type': 'application/json', ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) },
      body: method === 'GET' ? undefined : JSON.stringify(body),
    })
    const text = await res.text()
    let json: Record<string, unknown> = {}
    try { json = JSON.parse(text) as Record<string, unknown> } catch { json = { raw: text } }
    return { status: res.status, json, text }
  }

  beforeAll(async () => {
    s = await setupTwoAgencies()
    const { data } = await s.clientA.auth.getSession()
    jwtA = data.session!.access_token
    const service = serviceRoleClient()
    // Deux boîtes : l'une INVISIBLE à l'agent A (autre agence) pour éprouver le 404,
    // l'autre VISIBLE (la sienne) pour atteindre les contrôles qui viennent APRÈS
    // la garde. Sans la seconde, « mail-send sans destinataire » rendrait 404 sur le
    // compte et passerait pour la bonne raison sans jamais toucher le bon code.
    // `status` vaut 'active' par défaut (migration 20260903120000) : le contrôle 409
    // ne s'interpose donc pas.
    const mk = async (agencyId: string, ownerId: string, email: string, visibility: 'agency' | 'owner' = 'agency') => {
      const { data: row, error } = await service.from('mail_accounts')
        .insert({ agency_id: agencyId, owner_id: ownerId, provider: 'gmail', email, visibility })
        .select('id').single()
      if (error) throw new Error(`mail_accounts ${email}: ${error.message}`)
      return row.id as string
    }
    boxAId = await mk(s.agencyAId, s.agentAId, `a-${s.stamp}@a.test`)
    boxBId = await mk(s.agencyBId, s.agentBId, `b-${s.stamp}@b.test`)
    // ⚠ `visibility: 'owner'` en plus de l'agence étrangère : sous le prédicat correct
    // les DEUX moitiés refusent, sous la disjonction régressée `owner_id === moi` suffit
    // à ouvrir. C'est ce compte-là qui rend la conjonction porteuse.
    boxAinBId = await mk(s.agencyBId, s.agentAId, `ab-${s.stamp}@b.test`, 'owner')

    // Une pièce jointe réelle dans chacune des deux boîtes de l'agence B : sans ligne,
    // mail-attachment sort au premier `.eq('id', …)` et n'atteint JAMAIS le contrôle de
    // visibilité — c'est ce que faisait l'unique sonde sur l'UUID nul.
    const seedAttachment = async (accountId: string, agencyId: string, tag: string) => {
      const { data: th, error: eTh } = await service.from('mail_threads')
        .insert({ account_id: accountId, agency_id: agencyId, provider_thread_id: `t-${tag}-${s.stamp}`, subject: 'Mandat' })
        .select('id').single()
      if (eTh) throw new Error(`mail_threads ${tag}: ${eTh.message}`)
      const { data: m, error: eM } = await service.from('mail_messages').insert({
        thread_id: th.id, account_id: accountId, agency_id: agencyId,
        provider_message_id: `m-${tag}-${s.stamp}`, direction: 'inbound', sent_at: new Date().toISOString(),
        has_attachments: true,
      }).select('id').single()
      if (eM) throw new Error(`mail_messages ${tag}: ${eM.message}`)
      const { data: a, error: eA } = await service.from('mail_attachments').insert({
        message_id: m.id, account_id: accountId, agency_id: agencyId,
        provider_attachment_id: `att-${tag}-${s.stamp}`, filename: 'mandat.pdf', mime_type: 'application/pdf', size_bytes: 1024,
      }).select('id').single()
      if (eA) throw new Error(`mail_attachments ${tag}: ${eA.message}`)
      return a.id as string
    }
    attInBId = await seedAttachment(boxAinBId, s.agencyBId, 'ab')
    attOfBId = await seedAttachment(boxBId, s.agencyBId, 'b')
    await Promise.all(NAMES.map((n) => waitForEdgeWorker(FN(n))))
  }, 180_000)

  afterAll(async () => {
    const service = serviceRoleClient()
    // Les fils, messages et pièces partent en cascade avec les comptes.
    await service.from('mail_accounts').delete().in('id', [boxAId, boxBId, boxAinBId])
    await s.cleanup()
  })

  it('sans jeton : chaque edge agent refuse AVANT toute configuration', async () => {
    for (const n of AGENT_EDGES) {
      const r = await call(n, { action: 'start' })
      expect(r.status, `${n} : ${r.text.slice(0, 200)}`).toBe(401)
      expect(String(r.json.error), n).toMatch(/Authentication required/i)
    }
    // mail-attachment garde AVANT de trancher GET/POST : la sonde GET refuse pareil.
    const g = await call('mail-attachment', null, undefined, 'GET')
    expect(g.status).toBe(401)
    expect(String(g.json.error)).toMatch(/Authentication required/i)
  })

  // ⛔ L'ÉCHAPPATOIRE 503 A ÉTÉ RETIRÉE, ET C'EST TOUT L'INTÉRÊT DU TEST. `GOOGLE_CLIENT_ID`
  // n'était pas injecté dans le runtime local, donc `mail-oauth:56` court-circuitait en 503
  // à CHAQUE exécution : la construction de l'URL d'autorisation, le défi PKCE,
  // `randomToken` et l'insertion dans `mail_oauth_states` n'étaient exercés PAR RIEN — un
  // scope erroné ou un défi cassé serait passé au vert. Le secret est désormais posé en
  // valeur de test dans `[edge_runtime.secrets]` (supabase/config.toml) ; aucun appel n'est
  // fait vers Google, seule la CONSTRUCTION est éprouvée. Et la justification d'origine
  // était fausse par-dessus le marché : le 503 ne prouvait pas que la garde avait couru
  // avant la configuration, seulement que le clientId était vide — cet ordre-là est prouvé
  // par le test anonyme 401 ci-dessus.
  it('mail-oauth start : URL d autorisation, scope, PKCE et ligne mail_oauth_states', async () => {
    const r = await call('mail-oauth', { action: 'start', provider: 'gmail', origin: 'http://localhost:5173', visibility: 'agency' }, jwtA)
    expect(r.status, r.text.slice(0, 200)).toBe(200)
    const url = new globalThis.URL(String(r.json.url))
    expect(`${url.origin}${url.pathname}`).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(url.searchParams.get('scope')).toContain('gmail.modify')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    // base64url de 32 octets = 43 caractères sans bourrage.
    expect(String(url.searchParams.get('code_challenge'))).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:5173/oauth/mail/callback')
    // Sans `access_type=offline` + `prompt=consent`, Google ne rend pas de refresh_token
    // à une seconde autorisation du même compte : la boîte se déconnecterait toute seule.
    expect(url.searchParams.get('access_type')).toBe('offline')
    expect(url.searchParams.get('prompt')).toBe('consent')
    // randomToken(32) → 32 octets en hexadécimal = 64 caractères.
    const state = String(r.json.state)
    expect(state).toMatch(/^[0-9a-f]{64}$/)
    expect(url.searchParams.get('state')).toBe(state)

    // La ligne EXISTE et porte le verifier : sans elle, l'échange qui suit est perdu.
    const service = serviceRoleClient()
    const { data: row, error } = await service.from('mail_oauth_states')
      .select('code_verifier, redirect_uri, provider, visibility, user_id, agency_id, consumed_at')
      .eq('state', state).maybeSingle()
    if (error) throw new Error(`mail_oauth_states: ${error.message}`)
    expect(row, 'aucune ligne mail_oauth_states pour ce state').toBeTruthy()
    expect(String(row!.code_verifier)).toMatch(/^[0-9a-f]{96}$/) // randomToken(48)
    expect(row!.redirect_uri).toBe('http://localhost:5173/oauth/mail/callback')
    expect(row!.provider).toBe('gmail')
    expect(row!.visibility).toBe('agency')
    expect(row!.user_id).toBe(s.agentAId)
    expect(row!.agency_id).toBe(s.agencyAId)
    expect(row!.consumed_at).toBeNull()
    await service.from('mail_oauth_states').delete().eq('state', state)
  })

  it('mail-oauth : origine hors liste → 400 invalid_origin ; state inconnu → 403 invalid_state', async () => {
    // `evil.example` n'est pas dans MAIL_OAUTH_ORIGINS : le refus tombe AVANT la
    // lecture du client, donc ce cas ne dépend pas de la configuration locale.
    const bad = await call('mail-oauth', { action: 'start', provider: 'gmail', origin: 'https://evil.example' }, jwtA)
    expect(bad.status, bad.text.slice(0, 200)).toBe(400)
    expect(bad.json.error).toBe('invalid_origin')
    // 64 caractères hexadécimaux : la FORME est valide, la ligne n'existe pas.
    // Un state mal formé rendrait le même 403 sans jamais interroger la base — on
    // veut ici le refus qui vient de la LECTURE, pas de la validation de syntaxe.
    const ex = await call('mail-oauth', { action: 'exchange', code: 'x', state: 'a'.repeat(64) }, jwtA)
    expect(ex.status, ex.text.slice(0, 200)).toBe(403)
    expect(ex.json.error).toBe('invalid_state')
  })

  it('mail-actions / mail-send / mail-oauth disconnect : un compte d une autre agence est introuvable (404), jamais 403', async () => {
    const cases: Array<[string, Record<string, unknown>]> = [
      ['mail-actions', { action: 'mark_read', account_id: boxBId, thread_id: 'x' }],
      ['mail-send', { account_id: boxBId, kind: 'new', to: [{ email: 'a@b.ch' }], subject: 's', body_text: 'b' }],
      ['mail-oauth', { action: 'disconnect', account_id: boxBId }],
    ]
    for (const [name, body] of cases) {
      const r = await call(name, body, jwtA)
      expect(r.status, `${name} : ${r.text.slice(0, 200)}`).toBe(404)
      expect(r.json.error, name).toBe('not_found')
    }
  })

  // ⛔ LE SEUL CAS QUI RENDE LA CONJONCTION PORTEUSE (voir l'en-tête). `boxAinB` est
  // possédée par l'APPELANT mais vit dans l'agence B : sous le prédicat correct les deux
  // moitiés refusent ; sous la disjonction régressée — celle que 58f250a8 a corrigée —
  // `owner_id === ctx.userId` ouvre tout, et `mail-oauth disconnect` SUPPRIMERAIT la
  // boîte d'une autre agence en répondant 200. C'est la forme d'après-départ :
  // `team_remove_member` laisse la ligne mail_accounts intacte, puis l'ex-membre est
  // rattaché ailleurs.
  it('une boîte d une AUTRE agence dont l appelant est propriétaire reste introuvable (404)', async () => {
    const cases: Array<[string, Record<string, unknown>]> = [
      ['mail-actions', { action: 'mark_read', account_id: boxAinBId, thread_id: 'x' }],
      ['mail-actions', { action: 'sync_now', account_id: boxAinBId }],
      ['mail-send', { account_id: boxAinBId, kind: 'new', to: [{ email: 'a@b.ch' }], subject: 's', body_text: 'b' }],
      ['mail-oauth', { action: 'disconnect', account_id: boxAinBId }],
      ['mail-oauth', { action: 'update', account_id: boxAinBId, display_name: 'volé' }],
      ['mail-sync', { account_id: boxAinBId }],
    ]
    for (const [name, body] of cases) {
      const r = await call(name, body, jwtA)
      expect(r.status, `${name} ${String(body.action ?? '')} : ${r.text.slice(0, 200)}`).toBe(404)
      expect(r.json.error, `${name} ${String(body.action ?? '')}`).toBe('not_found')
    }
    // Et la boîte est TOUJOURS là : un `disconnect` qui aurait passé la garde l'aurait
    // effacée, et les cinq assertions ci-dessus n'en sauraient rien.
    const service = serviceRoleClient()
    const { data } = await service.from('mail_accounts').select('id').eq('id', boxAinBId).maybeSingle()
    expect(data, 'la boîte de l agence B a été supprimée par l agent A').toBeTruthy()
  })

  it('mail-attachment : GET inconnu → 404 ; POST sans action → 400', async () => {
    const g = await fetch(`${FN('mail-attachment')}?id=00000000-0000-0000-0000-000000000000`, {
      headers: { Authorization: `Bearer ${jwtA}` },
    })
    expect(g.status).toBe(404)
    const p = await call('mail-attachment', { action: 'nope' }, jwtA)
    expect(p.status, p.text.slice(0, 200)).toBe(400)
    expect(p.json.error).toBe('unknown_action')
  })

  // ⛔ mail-attachment est le SEUL edge qui rende des octets de message, et il déduit le
  // compte de l'`attachment_id` : `accountVisibleTo` (index.ts) y est l'unique barrière
  // inter-locataires. La sonde sur l'UUID nul sortait au premier `.eq('id', …)` sans
  // JAMAIS l'atteindre — la garde pouvait être retirée, la suite restait verte. Ces deux
  // pièces EXISTENT, donc le refus vient bien du contrôle de visibilité.
  it('mail-attachment : les octets d une autre agence restent hors de portée (404), GET et classement', async () => {
    for (const [libelle, id] of [['agence B, propriétaire agent B', attOfBId], ['agence B, propriétaire APPELANT', attInBId]] as const) {
      const g = await fetch(`${FN('mail-attachment')}?id=${id}`, { headers: { Authorization: `Bearer ${jwtA}` } })
      const gText = await g.text()
      expect(g.status, `GET ${libelle} : ${gText.slice(0, 200)}`).toBe(404)
      expect(JSON.parse(gText).error, `GET ${libelle}`).toBe('not_found')
      const p = await call('mail-attachment', { action: 'file', attachment_id: id, contact_id: '00000000-0000-0000-0000-000000000001', document_type: 'mandat' }, jwtA)
      expect(p.status, `POST file ${libelle} : ${p.text.slice(0, 200)}`).toBe(404)
      expect(p.json.error, `POST file ${libelle}`).toBe('not_found')
    }
  })

  it('mail-send : sans destinataire → 400, sur une boîte que l appelant VOIT', async () => {
    // §7.2 du plan maître. La boîte est celle de l'agence A : la garde passe, le
    // statut est 'active', et le refus vient donc bien du contrôle de destinataire.
    const r = await call('mail-send', { account_id: boxAId, kind: 'new', subject: 's', body_text: 'b' }, jwtA)
    expect(r.status, r.text.slice(0, 200)).toBe(400)
    expect(r.json.error).toBe('recipient_required')
  })

  // ⛔ `expect(r.json.ok).toBe(true)` NE MESURAIT RIEN. Il passait quand les deux comptes
  // échouaient, quand ZÉRO compte était lu — c'est-à-dire dans la panne la plus dangereuse
  // du module, la file illisible qui rend `{ ok: true, synced: 0 }` avec pg_cron au vert —
  // et le contrôle du verrou passait même si le second balayage rendait 500, `skipped`
  // étant alors simplement absent d'un corps non analysable. On asserte donc la FORME, le
  // CONTENU, et l'état laissé en base.
  it('mail-sync : sans secret 401 ; avec la clé service, les comptes dus sont RÉELLEMENT traités et le verrou relâché', async () => {
    // Message propre à cette edge : sa garde est `isServiceSecret`, pas
    // `requireAgentAuth` — d'où `unauthorized` et non « Authentication required ».
    const anon = await call('mail-sync', {})
    expect(anon.status, anon.text.slice(0, 200)).toBe(401)
    expect(anon.json.error).toBe('unauthorized')

    const service = serviceRoleClient()
    const nos = [boxAId, boxBId, boxAinBId]
    // Date volontairement très ancienne : le balayage prend les 25 plus anciens dus, et
    // rien ne garantit qu'une autre spec n'a pas laissé de comptes en file.
    const { error: eDue } = await service.from('mail_accounts')
      .update({ next_sync_at: '2000-01-01T00:00:00Z', last_error: null, sync_failures: 0, status: 'active' })
      .in('id', nos)
    if (eDue) throw new Error(`mise en file: ${eDue.message}`)

    const r = await call('mail-sync', {}, SERVICE_JWT)
    expect(r.status, r.text.slice(0, 200)).toBe(200)
    expect(r.json.ok).toBe(true)
    const results = r.json.results as { account_id: string; error: string | null }[]
    expect(Array.isArray(results), `results absent : ${r.text.slice(0, 200)}`).toBe(true)
    // `synced` DOIT décrire `results` : c'est ce compte que pg_cron voit passer.
    expect(r.json.synced).toBe(results.length)
    for (const id of nos) {
      const ligne = results.find((x) => x.account_id === id)
      expect(ligne, `le compte ${id} était dû et n a pas été traité`).toBeTruthy()
      // Aucun de ces comptes n'a de secret Vault : la passe DOIT échouer, et le dire.
      expect(ligne!.error, `le compte ${id} n a pas rendu d erreur alors qu il n a aucun secret`).toBeTruthy()
    }

    // L'échec doit être ÉCRIT : sans `last_error`, une boîte morte est indiscernable
    // d'une boîte saine sans courrier neuf.
    const { data: apres, error: eApres } = await service.from('mail_accounts')
      .select('id, status, last_error, sync_failures').in('id', nos)
    if (eApres) throw new Error(`relecture: ${eApres.message}`)
    for (const id of nos) {
      const row = apres!.find((x) => x.id === id)!
      expect(row.last_error, `last_error non écrit pour ${id}`).toBeTruthy()
      expect(row.sync_failures, `sync_failures non incrémenté pour ${id}`).toBeGreaterThanOrEqual(1)
    }
    // ⛔ ET LA BOÎTE DE L'AGENCE B DONT LE PROPRIÉTAIRE EST AILLEURS EST DÉSARMÉE.
    // C'est le miroir écriture de `mail_account_visible` : sans lui, le balayage
    // continuait d'ingérer le courrier d'un agent parti dans son ANCIENNE agence, toutes
    // les deux minutes, indéfiniment. `disabled` la sort de `mail_accounts_due_idx`.
    const parti = apres!.find((x) => x.id === boxAinBId)!
    expect(parti.status, 'la boîte au propriétaire hors agence est restée dans le balayage').toBe('disabled')
    expect(String(parti.last_error)).toMatch(/owner_left_agency/)
    // Les deux boîtes saines, elles, échouent de façon TRANSITOIRE (secret absent) et
    // restent actives : un seul échec ne doit pas éteindre une boîte.
    for (const id of [boxAId, boxBId]) expect(apres!.find((x) => x.id === id)!.status, id).toBe('active')

    // Le verrou est pris puis relâché dans un `finally` : un second balayage doit
    // pouvoir le reprendre. S'il restait posé, la synchro s'arrêterait 180 s après
    // chaque tick sans une seule erreur.
    const again = await call('mail-sync', {}, SERVICE_JWT)
    expect(again.status, `second balayage : ${again.text.slice(0, 200)}`).toBe(200)
    expect(again.json.skipped, 'le verrou doit être relâché après un balayage').toBeUndefined()
    // Lu en base plutôt qu'inféré : `skipped` absent d'un corps illisible ne prouve rien.
    const { data: bail, error: eBail } = await service.from('mail_cron_locks')
      .select('locked_until').eq('job', 'mail-sync').maybeSingle()
    if (eBail) throw new Error(`mail_cron_locks: ${eBail.message}`)
    expect(bail, 'la ligne de bail mail-sync est absente').toBeTruthy()
    expect(new Date(String(bail!.locked_until)).getTime(), 'le bail est encore tenu après le balayage')
      .toBeLessThanOrEqual(Date.now())
  })
})
```

```bash
# ⚠ NE PAS lancer `functions serve` ici : c'est un processus BLOQUANT au premier plan,
# la ligne suivante ne s'exécuterait jamais. Et ce n'est pas ainsi que le dépôt sert
# ses edges aux tests — backend.yml fait `supabase start` en gardant `edge-runtime`,
# qui sert supabase/functions/ tout seul. (`supabase/.env.local` n'existe pas non plus :
# la convention est `supabase/.env`, cf. .gitignore:37.)
supabase start   # déjà démarré = sans effet
npm run test:backend -- tests/backend/mail-edges.spec.ts tests/backend/mail-rls.spec.ts
```
Attendu : **24 tests verts (9 + 15)**. ⚠ Le « 16 (7 + 9) » d'origine contredisait la ligne du
Step 1 de la task 1.2 dans ce même document, et les deux fichiers livrés — corrigé le
04.09.2026 : `mail-edges.spec.ts` porte 9 `it()` (7 du plan + les 2 de la revue adverse) et
`mail-rls.spec.ts` en porte 15. Qui lance la commande après le merge doit lire 24, sans avoir
à décider si huit tests sont apparus de nulle part.

⛔ **NON EXÉCUTÉE ICI — même mur qu'au Step 2 et qu'à la task 1.2** : aucun runtime de
conteneur, donc pas de `supabase start`, et `.env.test.local` n'existe pas (les clés `HAS_KEYS`
sont absentes ⇒ `describe.skipIf` sauterait le fichier entier, ce qui ne prouverait rien).
Vérifiée **statiquement**, le 04.09.2026 :
- `npx tsc --noEmit --skipLibCheck --strict --target ES2023 --lib ES2023 --module ESNext
  --moduleResolution bundler --verbatimModuleSyntax --moduleDetection force --types node
  tests/backend/mail-edges.spec.ts` → exit 0, aucun `any`.
- `npx eslint tests/backend/mail-edges.spec.ts` → exit 0. `npm run lint:spec-sql` → exit 0.
- Chaque nom d'edge, d'action, de champ et chaque code de statut relu contre les cinq
  `index.ts` livrés (tableau de recoupement dans la PR).

Trois écarts au bloc d'origine, tous imposés par le code livré — la spec a été corrigée, pas
l'edge :
1. **Sept `it()` et non six** — puis NEUF, la revue adverse en ayant ajouté deux (04.09.2026 :
   « une boîte d'une AUTRE agence dont l'appelant est propriétaire » et « les octets d'une autre
   agence », cf. l'encadré ci-dessous). Ajout de « mail-send sans destinataire → 400 », §7.2 du plan
   maître, que ce lot ne couvrait pas. ⚠ Il exige une boîte que l'appelant **VOIT** : sur
   `boxB`, `loadVisibleAccount` rend `null` et l'edge répond 404 **avant** d'atteindre le
   contrôle de destinataire — le test serait vert pour la mauvaise raison. `beforeAll` sème
   donc une seconde boîte, dans l'agence A. Elle est `status = 'active'` par défaut
   (migration 20260903120000), le 409 `account_not_active` ne s'interpose pas.
2. **Les corps des refus sont assertés, pas seulement les statuts** — `invalid_origin`,
   `invalid_state`, `not_found`, `unknown_action`, `recipient_required`, `unauthorized`,
   `provider_not_configured`. Un statut seul ne distingue pas le gestionnaire de la passerelle.
3. **`SERVICE_JWT` en `||` et non `??`** : en CI la variable peut être exportée VIDE, que `??`
   ne rattraperait pas. Repli identique à `agency-verification-run.spec.ts:115`.

> ⚠ **Revue adverse du 04.09.2026 — QUATRE des sept `it()` ne mesuraient rien, et le
> fichier est réécrit ci-dessus.** Aucune des deux specs backend du lot n'a jamais été
> exécutée (pas de runtime de conteneur sur cette machine, cf. Step 2) : un test qui ne peut
> pas rougir y est pire qu'absent, c'est un reçu.
> 1. **Le balayage cron.** `expect(r.json.ok).toBe(true)` passait quand les deux comptes
>    échouaient, et surtout quand ZÉRO compte était lu — la panne la plus dangereuse du
>    module, la file illisible qui rend `{ ok: true, synced: 0 }` avec pg_cron au vert.
>    On asserte désormais la forme (`synced` décrit `results`), le contenu (chaque compte dû
>    est présent et rend son erreur), l'état laissé en base (`last_error`, `sync_failures`),
>    et le bail est LU dans `mail_cron_locks` au lieu d'être inféré d'un `skipped` absent —
>    qui l'est aussi d'un corps illisible après un 500.
> 2. **Le 404 inter-agences ne pouvait pas détecter son propre défaut.** La fixture était une
>    boîte de l'agence B possédée par l'agent B : sous le prédicat CONJOINT comme sous sa
>    régression en DISJONCTION, les deux moitiés rendent `false`. Réintroduire la disjonction
>    corrigée par 58f250a8 laissait les trois cas verts pendant que tous les edges fuyaient.
>    La fixture décisive est `boxAinB` — agence B, propriétaire = l'appelant —, la seule
>    forme qui les distingue, et c'est la forme d'après-départ.
> 3. **Les octets n'étaient gardés par aucun test.** `mail-attachment` déduit le compte de
>    l'`attachment_id` ; la sonde n'utilisait qu'un UUID nul, qui sort au premier
>    `.eq('id', …)` sans jamais atteindre `accountVisibleTo`. Deux pièces réelles sont semées
>    dans l'agence B, et l'en-tête cesse d'annoncer « les trois edges qui prennent un
>    account_id ».
> 4. **`mail-oauth start` prenait TOUJOURS la branche 503.** Faute de `GOOGLE_CLIENT_ID` dans
>    le runtime local, l'URL d'autorisation, le scope, le défi PKCE, `randomToken` et
>    l'insertion dans `mail_oauth_states` n'étaient exercés par RIEN. Deux valeurs de TEST
>    sont posées dans `[edge_runtime.secrets]` de `supabase/config.toml` — aucun appel n'est
>    fait vers Google, seule la CONSTRUCTION est éprouvée —, l'échappatoire est retirée et la
>    ligne d'état est relue en base. La justification écrite était fausse en prime : le 503 ne
>    prouvait pas l'ordre garde-puis-configuration, seulement qu'un clientId était vide.
>
> ```toml
> # supabase/config.toml, sous [edge_runtime.secrets]
> GOOGLE_CLIENT_ID = "test-only-local.apps.googleusercontent.com"
> MICROSOFT_CLIENT_ID = "test-only-local-microsoft-client"
> ```
> ⚠ Un `supabase start` déjà en cours ne les voit pas : `supabase stop && supabase start`.

- [x] **Step 4 : Toutes les portes, puis commit**

```bash
npm run build && npm run lint && npm run test:unit && npm run lint:deadcode && npm run lint:email-shell
git add -A
git commit -m "test(messagerie): contrats HTTP des edges, portes du lot"
```
Les dix-sept portes du dépôt ont été passées, pas seulement ces cinq — résultats dans la PR.

- [ ] **Step 5 : Épreuve de bout en bout (§7.4 du maître, points 1-2 et 8) — SANS UI**

⛔ **RESTE OUVERTE, ET NE PEUT PAS ÊTRE COCHÉE DEPUIS LE DÉPÔT.** Elle exige trois choses qui
vivent toutes hors d'ici : la migration appliquée en production, l'**API Gmail activée** et
l'URI de redirection enregistrée sur le client OAuth (cf. la section finale, point 3). Tant
qu'elles manquent, `mail-oauth start` répond `503 provider_not_configured` ou Google refuse la
redirection — aucun des deux ne dit quoi que ce soit du code.

**Procédure, à dérouler par un humain APRÈS le merge.** Console du navigateur sur
`app.megga.ch`, session d'agent ouverte :

```js
// 1. Démarrer
const { data } = await supabase.functions.invoke('mail-oauth', { body: { action: 'start', provider: 'gmail', origin: location.origin } })
// 2. Ouvrir la pop-up et consentir
window.open(data.url, 'megga-mail-oauth', 'popup,width=520,height=680')
// 3. La pop-up finit sur /oauth/mail/callback?code=…&state=…
//    ⚠ page 404 tant que le lot 2 n'est pas livré — c'est ATTENDU : relever code et state dans la barre d'adresse.
// 4. Échanger
await supabase.functions.invoke('mail-oauth', { body: { action: 'exchange', code: '<code>', state: '<state>' } })
// attendu : { account: { id, email, status: 'active', … } }
```

Puis, SQL editor du dashboard, **deux minutes après** l'échange (la première synchro tourne en
`EdgeRuntime.waitUntil`) :

```sql
select status, vault_secret_id is not null as secret_pose, last_sync_at, last_error
  from mail_accounts where id = '<account.id>';
-- attendu : active | true | horodatage non nul | null

select count(*) from mail_threads where account_id = '<account.id>';
-- attendu : > 0
```

Déconnexion, dans la même console :

```js
await supabase.functions.invoke('mail-oauth', { body: { action: 'disconnect', account_id: '<account.id>' } })
```

Puis, SQL editor :

```sql
select count(*) from mail_threads where account_id = '<account.id>';   -- attendu : 0
select count(*) from vault.secrets where name like 'mail:%';           -- attendu : 0
select count(*) from documents where id = '<document_id classé>';      -- attendu : 1 (le document classé SURVIT)
```

Consigner dans la PR : compte de fils, durée de la première synchro, et le fait que le document
classé a survécu à la déconnexion.

---

## À faire au merge (hors dépôt et post-merge)

> Écrit le 04.09.2026, à la clôture de la task 1.15 ; un **quatrième** point ajouté le même
> jour par la revue adverse. Quatre choses que le lot 1 ne peut pas faire lui-même, et qui
> échouent toutes **en silence** si on les oublie : aucune ne fait rougir la PR.

### 1. Faire ARRIVER la migration en production

`supabase/migrations/20260903120000_mail_module.sql`.

⛔ **`deploy.yml:220` n'applique qu'une migration dont la DATE du nom est `>= TODAY` (UTC).**
Son propre commentaire le dit sans détour : une fois `stamp < TODAY`, « aucun déploiement
ultérieur ne les rattrapera ». Une migration horodatée `20260903` mergée le 4 septembre ou
plus tard est donc **sautée POUR TOUJOURS**, avec pour seule trace un `::warning` que
personne ne lit. Le même commentaire enregistre que l'application manuelle par le MCP
Supabase (`apply_migration`) **est le flux normal de ce dépôt** — 19 migrations étaient
déjà dans ce cas au 19.07.2026, et c'est la discipline humaine qui a tenu, pas la CI.

Deux voies, au choix, le jour du merge :
- `git mv supabase/migrations/20260903120000_mail_module.sql supabase/migrations/<AAAAMMJJ>120000_mail_module.sql`
  avec la date du jour du merge, pour que le filtre la prenne ; **ou**
- l'appliquer à la main (MCP `apply_migration`) avant de merger.

⚠ **Vérifier qu'elle a atterri se fait en LISANT la base, jamais en regardant un pipeline
vert** — un pipeline vert est exactement ce que rend une migration sautée :

```sql
select version from supabase_migrations.schema_migrations where version = '20260903120000';
-- (ou la version renommée) ; une ligne = appliquée. Zéro ligne = elle n'existe pas en prod.
select count(*) from information_schema.tables where table_schema = 'public' and table_name like 'mail\_%';
-- attendu : 9 — accounts, oauth_states, labels, threads, messages, attachments, drafts,
--               contact_aliases, cron_locks
```

### 2. Régénérer `src/types/database.ts`, ensuite — et le committer

Une fois la migration en production, et **pas avant** :

```bash
npx supabase gen types typescript --project-id eayczugyrvmtqnnmvjod > src/types/database.ts
```

⚠ Le fichier porte un en-tête `/** */` maison que le générateur n'émet pas : le remettre en
tête après régénération (le script `check-types-freshness.mjs` le rappelle dans son propre
message d'échec).

⛔ **Sans ça, `migration-drift.yml` passe au ROUGE sur `main`** : il lance
`check-types-freshness.mjs --prod`, qui compare `pg_class` au fichier et signalera les neuf
relations `mail_*` comme « vivantes en production, absentes de `src/types/database.ts` ».
C'est la porte qui **échoue vraiment**, à la différence de l'avertissement du point 1 — donc
la seule des deux qui se remarque, et elle se remarque une fois le mal fait.

⚠ Il tourne sur `push: main` : la PR reste verte quoi qu'il arrive. Ne pas prendre le vert de
la PR pour une preuve de fraîcheur des types.

### 3. Les deux prérequis hors dépôt — aucun agent ne peut les poser

**Google — console Cloud, compte `hello@megga.ai`, projet `tribal-dispatch-504619-c1`, client
OAuth `833483825712-vh715spjupqcl86qffv3hvffsaqk0g8e`** (le même que « Se connecter avec
Google » : c'est bien ce client-là qu'il faut étendre, pas un nouveau) :
1. Ajouter deux URI de redirection autorisées : `https://app.megga.ch/oauth/mail/callback` et
   `http://localhost:5173/oauth/mail/callback`. Elles doivent correspondre **au caractère
   près** à `redirectUriFor()` (`_shared/mail/guard.ts:47`).
2. **Activer l'API Gmail** sur le projet. Elle ne l'est pas : seule l'API Calendar l'a été.
3. Déclarer le scope `https://www.googleapis.com/auth/gmail.modify` dans *Data Access*.
   ⚠ Il est **RESTRICTED**, un cran au-dessus des scopes *sensibles* de Calendar : tant que la
   vérification n'est pas accordée, Google affiche l'écran « application non validée » et
   plafonne à **100 utilisateurs**. Acceptable pour le pilote, et c'est la décision prise —
   mais à savoir avant de le montrer à un client.

**Microsoft — Azure / Entra** :
1. Enregistrer l'application, y ajouter les deux mêmes URI de redirection.
2. Accorder les permissions **déléguées** `Mail.ReadWrite`, `Mail.Send`, `User.Read`,
   `offline_access` — exactement `MS_MAIL_SCOPE` (`_shared/mail/secrets.ts:32`).
3. Poser `MICROSOFT_CLIENT_ID` et `MICROSOFT_CLIENT_SECRET` dans les secrets Edge Function de
   Supabase.

⛔ **Ces deux secrets sont ABSENTS du projet aujourd'hui** (constat inchangé depuis le
16.08.2026, cf. CLAUDE.md §8). Conséquence assumée et **codée**, pas subie :
`mail-oauth` avec `provider: 'outlook'` répond `503 provider_not_configured` — un refus
lisible, rendu APRÈS la garde d'authentification. ⚠ En LOCAL, `MICROSOFT_CLIENT_ID` porte
depuis le 04.09.2026 une valeur de test (`[edge_runtime.secrets]`) : la branche 503 n'y est
donc plus atteignable, seule la construction de l'URL l'est. Rien n'est posé en production
par ce fichier. La moitié Outlook de l'épreuve de bout en
bout (Step 5) ne peut donc pas tourner tant qu'ils ne sont pas posés.

### 4. Mettre le cerveau et les docs à jour — §10 du plan maître, obligation par LOT

Le maître §8 le dit sans réserve : « Après **chaque** lot : … puis **mettre le cerveau à jour**
(§10). » Ce lot n'a touché ni `.claude-flow/knowledge/megga-memory.seed.json`, ni
`docs/system-map.md`, ni `docs/schema.md`, ni `docs/CHANGELOG.md`.

⛔ **Aucune porte ne surveille ça**, et deux affirmations deviennent fausses à la seconde où
la première boîte se connecte :
- `docs/system-map.md`, section « Messaging » : « `message_threads`, `messages`,
  `email_messages_cache` … n'existent plus en base » reste vrai, mais la ligne dit aussi que
  le canal réel du CRM **est** WhatsApp — il y en a désormais deux, et neuf tables `mail_*`.
- `CLAUDE.md` §7 annonce **50 jobs pg_cron** ; avec `mail-sync-2min` il y en a 51.
  ⚠ `scripts/check-claude-md-freshness.mjs` nomme explicitement le compte de jobs pg_cron
  comme la classe de prétention qu'il **ne peut lire d'aucun fichier** : rien ne rougira
  jamais dessus, c'est la discipline humaine ou rien.

À faire au merge, dans cet ordre :
1. Semer les trois clés de §10.1 dans `.claude-flow/knowledge/megga-memory.seed.json` —
   `megga/messagerie-architecture`, `megga/messagerie-oauth-popup`, `megga/messagerie-portes`
   — puis `npm run ruflo:seed`.
2. `docs/system-map.md` : section « Messagerie (e-mail) », et corriger la ligne « Messaging ».
3. `docs/schema.md` : ajouter les neuf tables `mail_*`.
4. `CLAUDE.md` §7 : passer le compte de jobs à 51 et inscrire `mail-sync-2min` au tableau ;
   puis `npm run lint:claude-md`.
5. `docs/CHANGELOG.md`.

⚠ `docs/pages.md` (§10.4) attend le **lot 2** : ce lot ne livre aucune route.
