-- Étape 16 du plan Console MEGGA — le socle des GESTES (spec §10.1, §10.2).
-- Rien de fonctionnel ici : quatre primitives que toutes les RPC mutantes du Lot 2
-- consommeront. Aucun bouton n'est activé par ce fichier.
--
-- ── POURQUOI UNE NOUVELLE FILE, ALORS QUE `whatsapp_async_jobs` EXISTE ───────────────
-- R1 exige que toute table nouvelle dise pourquoi l'existant ne suffit pas. Mesuré :
-- `whatsapp_async_jobs` porte bien un `status`, un `retry_count` et un `last_error`, mais
-- c'est une file d'EXÉCUTION D'OUTIL pour l'agent WhatsApp — colonnes `wa_agent_phone`,
-- `tool`, `args`, `contact_id`, `lang`, et surtout `expires_at` à QUINZE MINUTES. Un effet
-- externe raté (Stripe, portail, courriel) doit survivre des jours, pas un quart d'heure ;
-- il n'a ni téléphone ni langue ; et deux consommateurs actifs (whatsapp-agent,
-- whatsapp-agent-async) dépendent de cette sémantique courte. L'élargir, c'était risquer le
-- chemin WhatsApp pour économiser une table. §4.2 énumère d'ailleurs les quatre `kind` de
-- l'outbox — WhatsApp n'en fait pas partie.
--
-- ── L'ORDRE DES VERROUS : AMENDEMENT DE §10.2 ────────────────────────────────────────
-- §10.2 dit « journal d'abord ». Corrigé en « journal DANS LA MÊME TRANSACTION » : le
-- verrou de chaîne d'`admin_log` est tenu jusqu'au COMMIT, donc journaliser en premier ne
-- garantit rien de plus — et croise l'ordre de verrouillage des RPC KYB, ce qui produit un
-- interblocage `40P01` au rétro-branchement. Règle d'ordre, dans cet ordre :
--
--     1. verrou d'ENTITÉ   (admin_lock_entity, ci-dessous)
--     2. lecture/écriture de l'état
--     3. verrou de CHAÎNE  (implicite, pris par admin_log_write)
--
-- Prendre la chaîne avant l'entité, c'est l'interblocage garanti dès que deux gestes
-- touchent la même agence.

-- ── 1. Enveloppe d'erreur unifiée (§10.1) ────────────────────────────────────────────
--
-- ⚠ `unauthorized` N'EST PAS rendu par ces fonctions, et c'est délibéré. §10.1 le décrit
-- comme « patron repo : exception 42501 — MAPPER » : le refus d'accès reste une EXCEPTION
-- Postgres, que la couche console traduit. Le rendre en enveloppe ferait répondre « 200 OK,
-- ok:false » à un appelant sans droits — et sortirait la RPC du balayage comportemental de
-- gardes (admin-rpc-guard-sweep), qui vérifie précisément qu'elle LÈVE 42501.
-- L'enveloppe couvre les issues MÉTIER ; la garde reste une exception.

create or replace function public.admin_error(
  p_code       text,
  p_message_fr text,
  p_details    jsonb default null
)
returns jsonb
language plpgsql
immutable
as $function$
begin
  -- Le vocabulaire est FERMÉ. Un code inventé au fil de l'eau rendrait l'écran incapable de
  -- distinguer ce qu'il doit réessayer de ce qu'il doit signaler — et personne ne le verrait
  -- avant la production. `unauthorized` est admis pour que la couche de mapping puisse
  -- fabriquer la même enveloppe à partir d'un 42501.
  if p_code not in ('unauthorized', 'not_found', 'conflict', 'precondition_failed',
                    'too_many', 'rate_limited', 'locked', 'upstream_error') then
    raise exception 'code d''erreur hors vocabulaire §10.1 : %', p_code using errcode = '22023';
  end if;
  if coalesce(btrim(p_message_fr), '') = '' then
    raise exception 'message_fr obligatoire : l''écran n''a rien d''autre à montrer'
      using errcode = '22023';
  end if;

  return jsonb_strip_nulls(jsonb_build_object(
    'ok', false, 'code', p_code, 'message_fr', p_message_fr, 'details', p_details));
end;
$function$;

comment on function public.admin_error(text, text, jsonb) is
  'Enveloppe d''erreur §10.1 : { ok:false, code, message_fr, details? }. Vocabulaire FERMÉ '
  'de huit codes — un code inventé lève 22023 à l''écriture plutôt que de produire un écran '
  'muet en production. `unauthorized` y figure pour la couche qui MAPPE un 42501, mais '
  'aucune RPC ne doit le rendre elle-même : le refus d''accès reste une exception, sans quoi '
  'la RPC sortirait du balayage comportemental de gardes.';

create or replace function public.admin_ok(p_data jsonb default null)
returns jsonb
language sql
immutable
as $function$
  select jsonb_strip_nulls(jsonb_build_object('ok', true, 'data', p_data));
$function$;

comment on function public.admin_ok(jsonb) is
  'Pendant de admin_error() : { ok:true, data? }. Les deux formes partagent la clé `ok`, '
  'que l''appelant teste une seule fois.';

revoke all on function public.admin_error(text, text, jsonb) from public, anon;
revoke all on function public.admin_ok(jsonb) from public, anon;
grant execute on function public.admin_error(text, text, jsonb) to authenticated, service_role;
grant execute on function public.admin_ok(jsonb) to authenticated, service_role;

-- ── 2. Verrou advisory par entité (§10.2) ────────────────────────────────────────────

create or replace function public.admin_lock_entity(p_entity_type text, p_entity_id uuid)
returns void
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin
  if p_entity_type is null or p_entity_id is null then
    raise exception 'verrou d''entité sans cible' using errcode = '22023';
  end if;
  -- Verrou de TRANSACTION (`_xact_`), jamais de session : il se relâche au COMMIT comme au
  -- ROLLBACK. Un verrou de session survivrait à une erreur et bloquerait l'entité jusqu'à
  -- la fin de la connexion — c'est-à-dire indéfiniment derrière un pooler.
  --
  -- Deux clés plutôt qu'un hash de concaténation : « agency » + un id ne peut pas entrer en
  -- collision avec « profile » + le même id, alors que hash('agency:'||id) et
  -- hash('profile:'||id) le peuvent, silencieusement.
  perform pg_advisory_xact_lock(hashtext(p_entity_type), hashtext(p_entity_id::text));
end;
$function$;

comment on function public.admin_lock_entity(text, uuid) is
  'Verrou advisory par entité (§10.2), à prendre AVANT toute lecture d''état et AVANT le '
  'journal. Ordre imposé : entité, puis état, puis chaîne admin_log — l''inverse produit un '
  'interblocage 40P01 dès que deux gestes touchent la même agence. Verrou de TRANSACTION : '
  'un verrou de session survivrait à une erreur et murerait l''entité derrière le pooler.';

revoke all on function public.admin_lock_entity(text, uuid) from public, anon;
grant execute on function public.admin_lock_entity(text, uuid) to authenticated, service_role;

-- ── 3. Idempotence : `rpc_receipts` (§10.2, 24 h) ────────────────────────────────────

create table if not exists public.rpc_receipts (
  idempotency_key text        primary key,
  rpc             text        not null,
  actor_user_id   uuid,
  ts              timestamptz not null default now(),
  result_hash     text
);

comment on table public.rpc_receipts is
  'Reçus d''idempotence des RPC mutantes de la console (§10.2). La CLÉ est la primary key : '
  'c''est elle qui rend « deux appels = un effet » atomique, sans verrou ni lecture '
  'préalable — un second insert échoue par contrainte, pas par test-puis-agit. Rétention '
  '24 h : au-delà, un rejeu n''est plus un doublon accidentel mais une nouvelle intention.';
comment on column public.rpc_receipts.result_hash is
  'Empreinte du résultat, posée APRÈS coup par admin_receipt_seal(). Sert à constater qu''un '
  'rejeu aurait produit la même chose ; ne permet pas de rejouer la réponse — §4.2 demande '
  'un hash, pas un cache de résultats.';

create index if not exists rpc_receipts_ts_idx on public.rpc_receipts (ts);

alter table public.rpc_receipts enable row level security;
revoke all on table public.rpc_receipts from public, anon, authenticated, service_role;
-- Aucune policy, aucun GRANT : la table ne se lit et ne s'écrit QUE par les deux fonctions
-- ci-dessous, qui sont SECURITY DEFINER. Une clé d'idempotence lisible serait rejouable.

create or replace function public.admin_receipt_try(p_key text, p_rpc text)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_insere boolean;
begin
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;
  if coalesce(btrim(p_key), '') = '' then
    raise exception 'clé d''idempotence vide' using errcode = '22023';
  end if;

  -- `on conflict do nothing` : l'atomicité vient de la contrainte, jamais d'un SELECT
  -- suivi d'un INSERT — entre les deux, un second appel passerait.
  insert into public.rpc_receipts (idempotency_key, rpc, actor_user_id)
       values (p_key, p_rpc, auth.uid())
  on conflict (idempotency_key) do nothing;

  get diagnostics v_insere = row_count;
  -- true  → première fois : l'appelant exécute le geste
  -- false → déjà vu : l'appelant s'arrête, l'effet a déjà eu lieu
  return v_insere;
end;
$function$;

comment on function public.admin_receipt_try(text, text) is
  'Réserve une clé d''idempotence. Rend true la PREMIÈRE fois (exécuter le geste), false '
  'ensuite (l''effet a déjà eu lieu). L''atomicité vient de la primary key et non d''un '
  'test-puis-agit, qui laisserait passer un second appel entre le SELECT et l''INSERT — '
  'c''est exactement le double-clic sur « Suspendre » que §10.7 demande de rendre inoffensif.';

create or replace function public.admin_receipt_seal(p_key text, p_result jsonb)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;
  -- ⚠ `sha256(bytea)` de `pg_catalog`, PAS `digest()` de pgcrypto. Mesuré : `digest` vit
  -- dans le schéma `extensions`, invisible sous `search_path = public, pg_temp` — l'appel
  -- aurait levé 42883 À L'EXÉCUTION, pas à la création. Même forme que la chaîne
  -- d'admin_log, qui a déjà tranché cette question.
  update public.rpc_receipts
     set result_hash = encode(sha256(convert_to(coalesce(p_result, '{}'::jsonb)::text, 'UTF8')), 'hex')
   where idempotency_key = p_key;
end;
$function$;

comment on function public.admin_receipt_seal(text, jsonb) is
  'Pose l''empreinte du résultat sur un reçu déjà réservé. Séparée de admin_receipt_try() '
  'parce que le résultat n''existe qu''APRÈS le geste, et que la réservation, elle, doit '
  'précéder le geste.';

revoke all on function public.admin_receipt_try(text, text) from public, anon;
revoke all on function public.admin_receipt_seal(text, jsonb) from public, anon;
grant execute on function public.admin_receipt_try(text, text) to authenticated, service_role;
grant execute on function public.admin_receipt_seal(text, jsonb) to authenticated, service_role;

-- ── 4. Effets externes : `outbox_jobs` (§10.2, 90 j) ─────────────────────────────────

create table if not exists public.outbox_jobs (
  id            uuid        primary key default gen_random_uuid(),
  kind          text        not null check (kind in ('stripe', 'portal', 'notify', 'email')),
  payload       jsonb       not null default '{}'::jsonb,
  attempts      smallint    not null default 0,
  next_retry_at timestamptz not null default now(),
  status        text        not null default 'pending' check (status in ('pending', 'done', 'dead')),
  last_error    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.outbox_jobs is
  'File des effets EXTERNES des gestes console (§10.2). Raison d''être : ne JAMAIS appeler '
  'un service HTTP dans une transaction Postgres — c''est l''invariant 14 du relais KYB, et '
  'la raison du découpage agency-verification-run / record_agency_verification_run. Le geste '
  'écrit ici et commite ; le worker appelle dehors. Distincte de whatsapp_async_jobs, qui '
  'est une file d''exécution d''outil expirant en 15 minutes.';
comment on column public.outbox_jobs.status is
  'pending → done, ou pending → dead après épuisement des tentatives. Un mort n''est jamais '
  'repris automatiquement : il remonte au Monitoring (§5.8) pour décision humaine.';

create index if not exists outbox_jobs_a_traiter_idx
  on public.outbox_jobs (next_retry_at)
  where status = 'pending';
comment on index public.outbox_jobs_a_traiter_idx is
  'Index PARTIEL sur le seul état réclamable : le worker ne balaie jamais les jobs finis, '
  'qui restent 90 jours. Le prédicat est un LITTÉRAL — paramétré, il ne serait pas utilisé.';

create index if not exists outbox_jobs_dead_idx
  on public.outbox_jobs (updated_at desc)
  where status = 'dead';

alter table public.outbox_jobs enable row level security;
revoke all on table public.outbox_jobs from public, anon, authenticated, service_role;
grant select on table public.outbox_jobs to authenticated, service_role;

drop policy if exists outbox_jobs_select_super_admin on public.outbox_jobs;
create policy outbox_jobs_select_super_admin on public.outbox_jobs
  for select to authenticated using (public.is_super_admin());
-- Lecture seule, et pour le super-admin seul : le Monitoring montre les dead-letters. Toute
-- ÉCRITURE passe par les fonctions ci-dessous.

create or replace function public.admin_outbox_enqueue(p_kind text, p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_id uuid;
begin
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;
  insert into public.outbox_jobs (kind, payload)
       values (p_kind, coalesce(p_payload, '{}'::jsonb))
    returning id into v_id;
  return v_id;
end;
$function$;

comment on function public.admin_outbox_enqueue(text, jsonb) is
  'Dépose un effet externe. Appelée DANS la transaction du geste : si le geste échoue, le '
  'job disparaît avec lui — c''est tout l''intérêt d''une outbox par rapport à un appel HTTP '
  'immédiat, qui aurait déjà eu lieu au moment du ROLLBACK.';

create or replace function public.admin_outbox_claim(p_limit integer default 10)
returns setof public.outbox_jobs
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 10), 1), 100);
begin
  -- Garde élargie à `session_user` : ce worker est destiné à tourner sous pg_cron, sans JWT.
  if not (public.is_super_admin() or public.is_service_role()
          or session_user in ('postgres', 'supabase_admin')) then
    raise exception 'forbidden: super_admin or service only' using errcode = '42501';
  end if;

  -- `skip locked` : deux workers concurrents se partagent la file au lieu de s'attendre.
  -- Sans lui, le second bloque sur la première ligne verrouillée et la file se sérialise.
  return query
  update public.outbox_jobs o
     set attempts = o.attempts + 1, updated_at = now()
   where o.id in (
     select j.id from public.outbox_jobs j
      where j.status = 'pending' and j.next_retry_at <= now()
      order by j.next_retry_at
      limit v_limit
      for update skip locked
   )
  returning o.*;
end;
$function$;

comment on function public.admin_outbox_claim(integer) is
  'Réclame des jobs dus, en incrémentant `attempts` DANS la même instruction : un worker qui '
  'meurt après la réclamation a quand même consommé sa tentative, sinon un job qui fait '
  'tomber son worker serait repris à l''infini. `skip locked` laisse deux workers se '
  'partager la file au lieu de la sérialiser.';

create or replace function public.admin_outbox_settle(
  p_id      uuid,
  p_ok      boolean,
  p_error   text default null,
  p_max     smallint default 6
)
returns text
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_attempts smallint;
  v_statut   text;
begin
  if not (public.is_super_admin() or public.is_service_role()
          or session_user in ('postgres', 'supabase_admin')) then
    raise exception 'forbidden: super_admin or service only' using errcode = '42501';
  end if;

  select attempts into v_attempts from public.outbox_jobs where id = p_id;
  if v_attempts is null then
    raise exception 'job inconnu: %', p_id using errcode = '22023';
  end if;

  if p_ok then
    v_statut := 'done';
  elsif v_attempts >= p_max then
    -- Mort : plus jamais repris tout seul. Le Monitoring le montre, un humain décide.
    v_statut := 'dead';
  else
    v_statut := 'pending';
  end if;

  update public.outbox_jobs
     set status     = v_statut,
         last_error = case when p_ok then null else left(coalesce(p_error, ''), 2000) end,
         -- Backoff exponentiel borné : 30 s, 1 min, 2, 4, 8, 16 — puis mort. Non borné, la
         -- sixième tentative tomberait à plusieurs heures et le job semblerait perdu.
         next_retry_at = case when p_ok or v_statut = 'dead' then now()
                              else now() + (interval '30 seconds' * power(2, least(v_attempts, 5))) end,
         updated_at = now()
   where id = p_id;

  return v_statut;
end;
$function$;

comment on function public.admin_outbox_settle(uuid, boolean, text, smallint) is
  'Clôt une tentative : `done`, ou `pending` avec backoff exponentiel borné (30 s → 16 min), '
  'ou `dead` au-delà du plafond. Un mort ne se reprend jamais seul — c''est ce qui le rend '
  'visible : une file qui se rejoue indéfiniment ne remonte aucune anomalie.';

revoke all on function public.admin_outbox_enqueue(text, jsonb) from public, anon;
revoke all on function public.admin_outbox_claim(integer) from public, anon, authenticated;
revoke all on function public.admin_outbox_settle(uuid, boolean, text, smallint) from public, anon, authenticated;

grant execute on function public.admin_outbox_enqueue(text, jsonb) to authenticated, service_role;

-- ⚠ CLAIM et SETTLE ne sont PAS accordées à `authenticated`, et ce n'est pas un oubli.
-- Deux raisons, la seconde mesurée :
--   1. Aucun écran n'a de raison de vider une file : ce sont des gestes de WORKER. Un
--      super-admin dans un navigateur n'en a pas l'usage, donc pas le droit.
--   2. Leur garde admet `session_user` (elles tournent sous pg_cron, sans JWT). Or le
--      balayage de gardes ÉCARTE de son volet comportemental toute fonction contenant
--      `session_user` ET joignable par `authenticated`, et plafonne cet écart à QUATRE — au
--      delà, il déclare lui-même qu'il ne prouve plus rien. Les accorder ici aurait consommé
--      la moitié de cette marge pour une surface dont personne n'a besoin.
grant execute on function public.admin_outbox_claim(integer) to service_role;
grant execute on function public.admin_outbox_settle(uuid, boolean, text, smallint) to service_role;

-- ── 5. Rétentions (§4.2 : reçus 24 h, jobs 90 j) ─────────────────────────────────────
--
-- `cron` peut manquer en base fraîche de CI : la planification est gardée, comme le fait
-- déjà 20260603110200 pour la purge des jobs WhatsApp.

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'admin-socle-purge-hourly', '25 * * * *',
      $sql$
        delete from public.rpc_receipts where ts < now() - interval '24 hours';
        delete from public.outbox_jobs
         where status in ('done', 'dead') and updated_at < now() - interval '90 days';
      $sql$
    );
  end if;
end $$;
