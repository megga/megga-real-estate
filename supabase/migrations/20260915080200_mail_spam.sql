-- 20260915080200_mail_spam.sql
-- Le dossier « Spam » de la Messagerie (Julien, 14.09.2026 : « tu as oublié les spams »).
--
-- Jusqu'ici le lot 1 écartait le spam À L'IMPORT (`-in:spam` chez Gmail, Réception et
-- Envoyés seulement chez Graph et en IMAP) — mais pas ce qui y entrait ENSUITE : un
-- message que le fournisseur rangeait dans le spam, ou que l'agent y envoyait depuis son
-- webmail, quittait la Réception, et la synchro le lisait « archivé ». Il apparaissait
-- dans « Archivé », et chez Gmail même le courrier filtré d'emblée y entrait. Le spam
-- devient une donnée de première classe : une colonne, un dossier, et TOUS les autres
-- dossiers l'excluent.
--
-- ⚠ DATÉE DU LENDEMAIN, comme 20260915080000 et 080100 : le date-guard de deploy.yml ne
-- rejoue que les migrations d'horodatage >= jour du merge (UTC). À appliquer AVANT le
-- déploiement des edges, et à renommer si le merge tombe après le 15.09.2026.

-- ── 1. Les colonnes ──────────────────────────────────────────────────────────
-- Par MESSAGE (le fournisseur classe des messages) et par FIL (le dossier se lit sur le
-- fil) : le fil suit son message entrant le plus récent, comme `is_archived`.
alter table public.mail_messages add column if not exists is_spam boolean not null default false;
alter table public.mail_threads  add column if not exists is_spam boolean not null default false;

create index if not exists mail_threads_account_spam_idx
  on public.mail_threads (account_id, last_message_at desc) where is_spam and not is_trashed;

-- ── 2. La liste ──────────────────────────────────────────────────────────────
-- Le type de retour gagne `is_spam` : un `create or replace` ne change pas les colonnes
-- d'une fonction (42P13) — on la retire et on la recrée, droits compris. Et `last_inbound_at`
-- (revue du 15.09.2026) : un fil sans aucun message reçu n'offre pas « Spam » — signalé, il
-- prenait `is_spam` sans qu'un seul de ses messages le porte, et le premier recalcul le rendait.
drop function if exists public.mail_list_threads(uuid, text, uuid, text, boolean, boolean, integer, integer);
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
  is_read boolean, is_starred boolean, is_archived boolean, is_trashed boolean, is_spam boolean,
  label_id uuid, contact_id uuid, message_count integer, last_inbound_at timestamptz, total bigint
)
language sql stable security invoker set search_path = public as $$
  with q as (
    select lower(trim(coalesce(p_q, ''))) as needle,
           greatest(coalesce(p_per_page, 12), 1) as per_page,
           greatest(coalesce(p_page, 0), 0) as page
  )
  select t.id, t.account_id, t.subject, t.snippet, t.from_name, t.from_email,
         t.participants, t.last_message_at, t.has_attachments,
         t.is_read, t.is_starred, t.is_archived, t.is_trashed, t.is_spam,
         t.label_id, t.contact_id, t.message_count, t.last_inbound_at,
         count(*) over () as total
  from public.mail_threads t, q
  where t.account_id = p_account_id
    -- ⛔ Le spam n'apparaît QUE dans « Spam » : ni en Réception, ni en Archivé, ni dans
    -- Suivis, ni dans Envoyés. C'est ce qui rend inoffensif un message que le fournisseur
    -- a sorti de la Réception pour le ranger au spam.
    and case p_folder
          when 'in'   then (not t.is_archived and not t.is_trashed and not t.is_spam and t.last_inbound_at is not null)
          when 'arch' then (t.is_archived and not t.is_trashed and not t.is_spam)
          when 'star' then (t.is_starred and not t.is_trashed and not t.is_spam)
          when 'sent' then (t.last_outbound_at is not null and not t.is_trashed and not t.is_spam)
          when 'spam' then (t.is_spam and not t.is_trashed)
          else false
        end
    and (p_label_id is null or t.label_id = p_label_id)
    and (not p_unread_only or not t.is_read)
    and (not p_att_only or t.has_attachments)
    -- ⚠ La contre-oblique s'échappe EN PREMIER (cf. 20260904074500) : c'est le caractère
    -- d'échappement par défaut de LIKE.
    and (q.needle = '' or t.search_text like
         '%' || replace(replace(replace(q.needle, '\', '\\'), '%', '\%'), '_', '\_') || '%')
  order by t.last_message_at desc, t.id desc
  limit (select per_page from q) offset (select page * per_page from q);
$$;
revoke all on function public.mail_list_threads(uuid, text, uuid, text, boolean, boolean, integer, integer) from public, anon;
grant execute on function public.mail_list_threads(uuid, text, uuid, text, boolean, boolean, integer, integer) to authenticated;

-- ── 3. Les compteurs ─────────────────────────────────────────────────────────
-- Un spam non lu n'est pas un courrier en attente : la pastille du sélecteur l'ignore.
create or replace function public.mail_unread_counts()
returns table (account_id uuid, unread bigint)
language sql stable security invoker set search_path = public as $$
  select t.account_id, count(*)
  from public.mail_threads t
  where not t.is_read and not t.is_archived and not t.is_trashed and not t.is_spam and t.last_inbound_at is not null
  group by t.account_id;
$$;
revoke all on function public.mail_unread_counts() from public, anon;
grant execute on function public.mail_unread_counts() to authenticated;

-- Le rail gagne le compte du dossier Spam (le type de retour change : même geste qu'en 2).
drop function if exists public.mail_folder_counts(uuid);
create or replace function public.mail_folder_counts(p_account_id uuid)
returns table (inbox_unread bigint, archived bigint, drafts bigint, spam bigint, label_counts jsonb)
language sql stable security invoker set search_path = public as $$
  select
    (select count(*) from public.mail_threads t where t.account_id = p_account_id
       and not t.is_read and not t.is_archived and not t.is_trashed and not t.is_spam and t.last_inbound_at is not null),
    (select count(*) from public.mail_threads t where t.account_id = p_account_id
       and t.is_archived and not t.is_trashed and not t.is_spam),
    (select count(*) from public.mail_drafts d where d.account_id = p_account_id and d.author_id = auth.uid()),
    (select count(*) from public.mail_threads t where t.account_id = p_account_id
       and t.is_spam and not t.is_trashed),
    (select coalesce(jsonb_object_agg(x.label_id, x.n), '{}'::jsonb)
       from (select t.label_id, count(*) as n from public.mail_threads t
             where t.account_id = p_account_id and not t.is_trashed and not t.is_spam and t.label_id is not null
             group by t.label_id) x);
$$;
revoke all on function public.mail_folder_counts(uuid) from public, anon;
grant execute on function public.mail_folder_counts(uuid) to authenticated;

-- ── 4. La fiche du contact ───────────────────────────────────────────────────
-- Le spam arrivé comme tel n'est rattaché à personne et n'écrit rien au journal (ingest.ts).
-- Mais un courrier rattaché PUIS signalé comme spam garde sa ligne : le journal est
-- append-only, et il dit vrai — le courrier est arrivé, il a été rattaché. La fiche du
-- contact, elle, ne le montre plus : elle demande ici lesquels de ses courriers sont du spam.
-- ⚠ SECURITY DEFINER, borné à l'agence : un collègue voit le FAIT d'un courrier reçu sur une
-- boîte personnelle (D11) sans pouvoir lire la boîte ; il doit pouvoir le masquer aussi. Il
-- n'apprend qu'un bit, sur un fait qu'il voyait déjà. 200 identifiants au plus : la fiche en
-- demande 50.
create or replace function public.mail_spam_message_ids(p_ids uuid[])
returns setof uuid
language sql stable security definer set search_path = '' as $$
  select m.id from public.mail_messages m
  where m.id = any(p_ids[1:200]) and m.is_spam and m.agency_id = public.get_my_agency_id();
$$;
revoke all on function public.mail_spam_message_ids(uuid[]) from public, anon;
grant execute on function public.mail_spam_message_ids(uuid[]) to authenticated;
