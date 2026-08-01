-- Registre des gestes sensibles de la Console MEGGA — append-only, chaîné, 10 ans.
-- Étape 2 du plan (docs/handoff/console-admin/PLAN_CONSOLE_ADMIN_BACKEND.md), spec §4.2,
-- §5.9, §6, §10.2. Contrat d'écran : docs/handoff/console-admin/front/admin-security.jsx.
--
-- VERSION « RÉDUITE », actée : cette table ne porte QUE ce qu'`activity_events` ne peut pas
-- porter — la colonne `family` (12 valeurs propres à la console, impossibles à loger dans un
-- CHECK `category` à 8 valeurs partagé avec le CRM) et une chaîne de hash STOCKÉE à l'insert.
-- L'écho fonctionnel des gestes reste dans `activity_events`, qui porte déjà l'append-only
-- par trigger et l'interdiction de suppression pendant 10 ans.
--
-- ─────────────────────────────────────────────────────────────────────────────────────
-- CE QUE CE FICHIER GARANTIT, ET CE QU'IL NE GARANTIT PAS
--
-- L'immuabilité repose sur des triggers que le PROPRIÉTAIRE de la table (postgres) peut
-- désactiver. C'est un SCELLÉ, pas un coffre : il rend toute altération visible, il ne
-- l'empêche pas. Et un chaînage `prev_hash` ne protège que les lignes qui ont un
-- successeur — supprimer les N DERNIÈRES lignes laisse une chaîne parfaitement cohérente.
-- Seules l'ancre externe quotidienne (rows_count publié hors Postgres) et le PITR
-- détectent ce cas. C'est dit ici plutôt que découvert en audit.
--
-- ─────────────────────────────────────────────────────────────────────────────────────
-- DÉFAUTS ÉVITÉS, chacun mesuré avant écriture (revue adversariale du 31.07.2026) :
--
--  1. pg_cron tourne en `session_user = postgres` SANS JWT : une garde
--     `is_super_admin() OR is_service_role()` refuse le cron de vérification. Et la garde
--     `current_user in ('postgres','supabase_admin')` qu'on serait tenté de recopier de
--     `purge_activity_events_retention` est VACUOUS : dans une SECURITY DEFINER détenue par
--     postgres, `current_user` VAUT toujours postgres. Le discriminant est `session_user`.
--  2. Les privilèges par défaut de Supabase (`pg_default_acl`) accordent `arwdDxtm` à
--     anon/authenticated/service_role sur toute table neuve de `public`, et EXECUTE à anon
--     sur toute fonction neuve. Un REVOKE qui oublie `service_role` laisse l'INSERT direct
--     par l'API : une ligne forgée serait chaînée par le trigger, donc indiscernable.
--  3. Un `timestamptz` rendu en texte dépend du GUC TimeZone de la session. Hacher
--     `ts::text` ferait crier à la falsification depuis une session en fuseau différent.
--  4. Concaténer les champs avec un séparateur est collisionnable :
--     `'a|b' || '|' || ''` = `'a' || '|' || 'b|'`. Le payload est un jsonb, pas une
--     concaténation, et il porte son numéro de version.
--  5. `'abc' || null` vaut NULL en SQL : un champ NULL non traité annulerait le hash, donc
--     le geste. `jsonb_build_object` rend `null` JSON, jamais un absorbant.
--  6. `GENERATED ALWAYS AS IDENTITY` alloue son rang AVANT le déclenchement du trigger
--     BEFORE (nœud `Result` en amont de `ModifyTable`) : le verrou ne peut pas sérialiser
--     l'attribution. `seq` est donc attribué DANS le trigger, sous le verrou.
--  7. Deux lignes d'une même INSTRUCTION ne se voient pas : elles hériteraient du même
--     `prev_hash`. `unique (prev_hash)` transforme la fourche silencieuse en 23505.
--  8. jsonb ne conserve pas l'ordre des clés d'un objet (tri par longueur puis octets), or
--     le déplié de l'écran consomme des paires ORDONNÉES : `metadata` est un TABLEAU.
--  9. `cron.schedule` non gardé casse l'application des migrations sur la base fraîche de
--     la CI, où pg_cron n'est pas installé. Garde sur `pg_extension`, jamais sur le schéma.
-- 10. `FORCE ROW LEVEL SECURITY` (le patron maison des 7 tables LBA) casserait ce design :
--     la RPC d'écriture perdrait l'exemption propriétaire, et la vérification sous pg_cron
--     lirait 0 ligne en déclarant la chaîne intacte. Volontairement absent, verrouillé par
--     un test.
--
-- TROIS ÉCARTS ASSUMÉS avec la revue :
--  a. Le vocabulaire vit dans deux tables de référence, pas dans des CHECK littéraux. Motif
--     mesuré : `lint:migrations` ne connaît pas `CONSTRAINT`, donc un futur
--     `alter table … add constraint` non gardé passe le linter et casse le rejeu en 42710.
--     Une 13ᵉ famille devient un INSERT idempotent.
--  b. La tête de chaîne vit dans `admin_log_chain_head`, pas dans un `order by seq desc
--     limit 1` sur la table. Lecture en O(1) par clé primaire au lieu d'un tri sous verrou,
--     et `sealed` sans `count(*)` exact (interdit au-delà de 5 000 lignes, CLAUDE.md §7).
--     Conséquence : pas de ligne de genèse artificielle — la tête initiale EST la ligne de
--     head, avec `head_hash = repeat('0',64)`.
--  c. `admin_session_baseline` (§5.9, détection d'anomalie) est REPORTÉE à l'étape 14. Ce
--     qui est posé ici, ce sont les colonnes `ip` / `user_agent` / `session_id`, qui ne
--     sont pas rattrapables après coup sur un registre append-only.

-- ── 1. Vocabulaires ──────────────────────────────────────────────────────────────────
-- Disjoints par construction : l'écran n'a qu'un filtre pour les deux
-- (`e.sev === filter || e.fam === filter`, admin-security.jsx:162).

create table if not exists public.admin_log_severity (
  code text primary key
);
insert into public.admin_log_severity (code) values ('info'), ('warn'), ('crit')
  on conflict (code) do nothing;

comment on table public.admin_log_severity is
  'Sévérités du registre console. `crit`, jamais `critical` : c''est ce que rend la maquette '
  '(admin-security.jsx:77, secSevColor). activity_events écrit `critical` de son côté — toute '
  'vue qui unit les deux sources doit traduire au bord, sinon un événement critique s''affiche '
  'en couleur neutre sans lever d''erreur.';

create table if not exists public.admin_log_family (
  code      text primary key,
  label_key text not null
);
insert into public.admin_log_family (code, label_key) values
  ('session',   'audit.family.session'),
  ('identity',  'audit.family.identity'),
  ('lifecycle', 'audit.family.lifecycle'),
  ('plans',     'audit.family.plans'),
  ('deploy',    'audit.family.deploy'),
  ('export',    'audit.family.export'),
  ('link',      'audit.family.link'),
  ('diffusion', 'audit.family.diffusion'),
  ('comm',      'audit.family.comm'),
  ('ai',        'audit.family.ai'),
  ('ops',       'audit.family.ops'),
  ('kyb',       'audit.family.kyb')
  on conflict (code) do nothing;

comment on table public.admin_log_family is
  'Les 12 familles de §4.2/§6. `impers` en est ABSENTE : « Voir en tant que » est retiré de la '
  'V1 (spec §1, acté le 31.07.2026). La maquette porte encore une chip « Impersonation » — '
  'contradiction relevée dans docs/console-admin/INVENTAIRE_SOCLE.md §8, à trancher par le PO. '
  'Conséquence à connaître : le jour où admin_log_impersonation écrirait ici, son insert '
  'lèverait 23503 — et « journal dans la même transaction » ferait échouer le geste.';

-- ── 2. La tête de chaîne ─────────────────────────────────────────────────────────────
-- Une seule ligne, mise à jour sous le même verrou que l'insert. Elle sert trois choses :
-- le chaînage en O(1), les compteurs `sealed`/`last`/`head` de l'écran, et la détection
-- d'une troncature (rows_count qui recule).

create table if not exists public.admin_log_chain_head (
  one           boolean primary key default true check (one),
  seq_max       bigint      not null default 0,
  rows_count    bigint      not null default 0,
  head_hash     text        not null,
  last_event_ts timestamptz,
  updated_at    timestamptz not null default now()
);

insert into public.admin_log_chain_head (one, seq_max, rows_count, head_hash)
  values (true, 0, 0, repeat('0', 64))
  on conflict (one) do nothing;

comment on table public.admin_log_chain_head is
  'Tête de la chaîne admin_log : évite un tri sous verrou à chaque écriture et un count(*) '
  'exact à chaque lecture d''écran. `last_event_ts` est le dernier GESTE — la ligne '
  'ops/admin_log_chain_verified déposée par le cron ne la met délibérément pas à jour, sinon '
  '`last` et `checked` s''effondreraient sur la même valeur à l''écran.';

-- ── 3. Le registre ───────────────────────────────────────────────────────────────────

create table if not exists public.admin_log (
  id              uuid primary key default gen_random_uuid(),
  seq             bigint      not null,
  ts              timestamptz not null default clock_timestamp(),
  severity        text        not null references public.admin_log_severity(code),
  family          text        not null references public.admin_log_family(code),
  action          text        not null,
  action_params   jsonb       not null default '{}'::jsonb,
  routine         boolean     not null default false,
  actor_user_id   uuid,
  actor_label     text        not null,
  entity_type     text,
  entity_id       uuid,
  entity_label    text,
  agency_id       uuid,
  ip              inet,
  user_agent      text,
  session_id      text,
  metadata        jsonb       not null default '[]'::jsonb,
  payload_version smallint    not null default 1,
  prev_hash       text        not null,
  hash            text        not null,
  constraint admin_log_seq_uniq        unique (seq),
  constraint admin_log_prev_hash_uniq  unique (prev_hash),
  constraint admin_log_hash_uniq       unique (hash),
  constraint admin_log_metadata_array  check (jsonb_typeof(metadata) = 'array'),
  constraint admin_log_params_object   check (jsonb_typeof(action_params) = 'object'),
  constraint admin_log_actor_coherence check ((actor_user_id is null) = (actor_label = 'Système'))
);

comment on table public.admin_log is
  'Registre LBA append-only de la console, rétention 10 ans. L''immuabilité vient de triggers '
  'que le propriétaire peut désactiver : c''est un scellé, pas un coffre. La chaîne ne détecte '
  'PAS la suppression des dernières lignes — seules l''ancre externe et le PITR le font. Toute '
  'restauration logique exige DISABLE TRIGGER / rechargement / ENABLE TRIGGER, puis '
  'admin_log_verify_chain ET comparaison à l''ancre externe.';
comment on column public.admin_log.seq is
  'Rang dans la chaîne, attribué SOUS le verrou. Ordre de référence, y compris à l''écran. '
  'Troué par construction : une transaction annulée consomme un rang. Ne jamais compter par '
  'max(seq) — utiliser admin_log_chain_head.rows_count.';
comment on column public.admin_log.ts is
  'Heure de l''ÉCRITURE (clock_timestamp), pas du BEGIN : deux lignes d''un même geste doivent '
  'être départageables. Champ d''AFFICHAGE — l''ordre de référence reste `seq`.';
comment on column public.admin_log.action is
  'Clé technique snake_case, jamais du français (règle du dépôt, cf. 20260729100000). Le '
  'gabarit FR vit dans l''i18n `audit.action.*` et s''interpole avec `action_params`.';
comment on column public.admin_log.routine is
  'Décision prise AU GESTE, non dérivable de severity/family/actor : l''écran replie ces lignes '
  'en pied (admin-security.jsx:210-217), et la même action peut être routine ou non. Non '
  'rattrapable après coup, la table étant append-only.';
comment on column public.admin_log.metadata is
  'TABLEAU ORDONNÉ de paires [{"l":…,"v":…}] — l''écran le rend dans l''ordre reçu '
  '(admin-security.jsx:98). Un objet jsonb perdrait cet ordre (tri par longueur puis octets), '
  'et afficherait la conséquence avant le fait. Le hash porte sur la valeur STOCKÉE.';
comment on column public.admin_log.payload_version is
  'Recette de hachage employée. Toute évolution = admin_log_payload_v2 + version 2 ; la v1 ne '
  'bouge JAMAIS, sinon la chaîne se déclare rompue depuis l''origine.';

create index if not exists admin_log_seq_desc_idx      on public.admin_log (seq desc);
create index if not exists admin_log_main_ts_idx       on public.admin_log (ts desc) where not routine;
create index if not exists admin_log_routine_ts_idx    on public.admin_log (ts desc) where routine;
create index if not exists admin_log_family_ts_idx     on public.admin_log (family, ts desc);
create index if not exists admin_log_severity_ts_idx   on public.admin_log (severity, ts desc);
create index if not exists admin_log_actor_ts_idx      on public.admin_log (actor_user_id, ts desc);
create index if not exists admin_log_agency_ts_idx     on public.admin_log (agency_id, ts desc) where agency_id is not null;
create index if not exists admin_log_session_base_idx  on public.admin_log (actor_user_id, ip, ts desc) where family = 'session';

-- ── 4. La forme canonique, gelée ─────────────────────────────────────────────────────

drop function if exists public.admin_log_payload_v1(bigint, uuid, timestamptz, text, text, text, jsonb, boolean, uuid, text, text, uuid, text, uuid, inet, text, text, jsonb);
create or replace function public.admin_log_payload_v1(
  p_seq bigint, p_id uuid, p_ts timestamptz, p_severity text, p_family text,
  p_action text, p_action_params jsonb, p_routine boolean,
  p_actor_user_id uuid, p_actor_label text,
  p_entity_type text, p_entity_id uuid, p_entity_label text,
  p_agency_id uuid, p_ip inet, p_user_agent text, p_session_id text,
  p_metadata jsonb
) returns text
language sql
stable parallel safe
set search_path to 'public', 'pg_temp'
as $function$
  select jsonb_build_object(
    'v', 1,
    'seq', p_seq,
    'id', p_id,
    -- to_char explicite : un timestamptz nu se rend dans le fuseau de la SESSION.
    'ts', to_char(p_ts at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'severity', p_severity,
    'family', p_family,
    'action', p_action,
    'action_params', p_action_params,
    'routine', p_routine,
    'actor_user_id', p_actor_user_id,
    'actor_label', p_actor_label,
    'entity_type', p_entity_type,
    'entity_id', p_entity_id,
    'entity_label', p_entity_label,
    'agency_id', p_agency_id,
    'ip', p_ip::text,
    'user_agent', p_user_agent,
    'session_id', p_session_id,
    'metadata', p_metadata
  )::text
$function$;

comment on function public.admin_log_payload_v1 is
  'Forme canonique GELÉE de la v1. STABLE et non IMMUTABLE : to_char/jsonb_build_object sont '
  'provolatile=''s'' — ne JAMAIS bâtir un index d''expression ni une colonne générée dessus. '
  'jsonb, jamais une concaténation : ''a|b''||''|''||'''' et ''a''||''|''||''b|'' sont égales, '
  'donc deux lignes de sens opposé partageraient un hash.';

-- ── 5. Chaînage ──────────────────────────────────────────────────────────────────────

create or replace function public.admin_log_chain()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_head    public.admin_log_chain_head%rowtype;
  v_payload text;
begin
  -- Une ligne pré-hachée ne peut venir que d'un rechargement triggers désactivés.
  if new.hash is not null or new.prev_hash is not null or new.seq is not null then
    raise exception 'admin_log: seq/prev_hash/hash sont posés par le trigger, jamais par l''appelant'
      using errcode = '42501';
  end if;

  -- Sérialise l'attribution du rang ET la lecture de la tête. Verrou de transaction :
  -- relâché au COMMIT. C'est la raison pour laquelle l'écriture doit être la DERNIÈRE
  -- instruction du geste et non la première (cf. §10.2, amendé).
  perform pg_advisory_xact_lock(4815162342);

  select * into v_head from public.admin_log_chain_head where one for update;
  if not found then
    -- Jamais de coalesce() qui reposerait une genèse en silence : une tête introuvable
    -- signale une RLS, un search_path détourné ou une table amputée, pas une table neuve.
    raise exception 'admin_log: tete de chaine introuvable' using errcode = '55000';
  end if;

  new.seq       := v_head.seq_max + 1;
  new.prev_hash := v_head.head_hash;

  v_payload := public.admin_log_payload_v1(
    new.seq, new.id, new.ts, new.severity, new.family, new.action, new.action_params,
    new.routine, new.actor_user_id, new.actor_label, new.entity_type, new.entity_id,
    new.entity_label, new.agency_id, new.ip, new.user_agent, new.session_id, new.metadata
  );
  new.hash := encode(sha256(convert_to(new.prev_hash || v_payload, 'UTF8')), 'hex');

  update public.admin_log_chain_head
     set seq_max       = new.seq,
         rows_count    = rows_count + 1,
         head_hash     = new.hash,
         -- La vérification ne doit pas devenir « le dernier événement » à l'écran.
         last_event_ts = case
                           when new.family = 'ops' and new.action = 'admin_log_chain_verified'
                           then last_event_ts
                           else new.ts
                         end,
         updated_at    = now()
   where one;

  return new;
end;
$function$;

create or replace function public.admin_log_deny()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin
  raise exception 'admin_log est append-only (registre LBA, retention 10 ans)'
    using errcode = '42501';
end;
$function$;

drop trigger if exists admin_log_chain_biu on public.admin_log;
create trigger admin_log_chain_biu
  before insert on public.admin_log
  for each row execute function public.admin_log_chain();

drop trigger if exists admin_log_no_update on public.admin_log;
create trigger admin_log_no_update
  before update on public.admin_log
  for each row execute function public.admin_log_deny();

drop trigger if exists admin_log_no_delete on public.admin_log;
create trigger admin_log_no_delete
  before delete on public.admin_log
  for each row execute function public.admin_log_deny();

-- activity_events n'a PAS cet équivalent : TRUNCATE ignore la RLS et ne déclenche aucun
-- trigger ligne-à-ligne. Mesuré : 0 trigger TRUNCATE dans tout le schéma public.
drop trigger if exists admin_log_no_truncate on public.admin_log;
create trigger admin_log_no_truncate
  before truncate on public.admin_log
  for each statement execute function public.admin_log_deny();

-- ── 6. Écriture ──────────────────────────────────────────────────────────────────────

drop function if exists public.admin_log_write(text, text, text, text, text, uuid, text, uuid, jsonb, jsonb, boolean, inet, text, text);
create or replace function public.admin_log_write(
  p_family        text,
  p_action        text,
  p_severity      text default 'info',
  p_entity_type   text default null,
  p_entity_label  text default null,
  p_entity_id     uuid default null,
  p_actor_label   text default null,
  p_agency_id     uuid default null,
  p_metadata      jsonb default '[]'::jsonb,
  p_action_params jsonb default '{}'::jsonb,
  p_routine       boolean default false,
  p_ip            inet default null,
  p_user_agent    text default null,
  p_session_id    text default null
) returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_actor    uuid := auth.uid();
  v_label    text;
  v_metadata jsonb := coalesce(p_metadata, '[]'::jsonb);
  v_id       uuid;
begin
  -- `session_user`, jamais `current_user` : dans une SECURITY DEFINER détenue par postgres,
  -- current_user VAUT postgres, et la branche serait toujours vraie. pg_cron s'exécute en
  -- session_user = postgres, sans JWT, donc sans is_super_admin() ni is_service_role().
  if not (
    public.is_super_admin()
    or public.is_service_role()
    or session_user in ('postgres', 'supabase_admin')
  ) then
    raise exception 'forbidden: super_admin or service only' using errcode = '42501';
  end if;

  -- Échouer vite plutôt que d'empiler derrière le verrou de chaîne.
  set local lock_timeout = '3s';

  if jsonb_typeof(v_metadata) <> 'array' then
    raise exception 'metadata: tableau ordonne de paires attendu' using errcode = '22023';
  end if;
  -- Le hash porte sur le TEXTE du jsonb : un flottant re-sérialisé différemment romprait
  -- la chaîne sans qu'aucune donnée n'ait bougé.
  if exists (
    select 1 from jsonb_array_elements(v_metadata) e
     where jsonb_typeof(e -> 'v') = 'number' and (e ->> 'v') ~ '[.eE]'
  ) then
    raise exception 'metadata: nombre flottant interdit' using errcode = '22023';
  end if;
  -- Pas de garde sur le caractere nul : `text` n'en contient jamais en PostgreSQL, et une
  -- sequence d'echappement nulle dans un litteral JSON est refusee a la conversion en
  -- jsonb (22P05), donc bien avant d'arriver ici. Un `like` sur le motif echappe
  -- rejetterait des valeurs legitimes sans rien proteger.

  -- L'écran affiche un nom dans 132 px, pas un e-mail (admin-security.jsx:93), et la
  -- recherche porte dessus. « Système » est le libellé des gestes machine.
  if v_actor is null then
    v_label := coalesce(nullif(btrim(coalesce(p_actor_label, '')), ''), 'Système');
    if v_label <> 'Système' then
      raise exception 'actor_label doit valoir Systeme quand il n''y a pas d''acteur'
        using errcode = '22023';
    end if;
  else
    select coalesce(nullif(btrim(coalesce(p_actor_label, '')), ''),
                    nullif(btrim(coalesce(pr.full_name, '')), ''),
                    pr.email,
                    'compte ' || left(v_actor::text, 8))
      into v_label
      from public.profiles pr
     where pr.id = v_actor;
    v_label := coalesce(v_label, 'compte ' || left(v_actor::text, 8));
  end if;

  insert into public.admin_log (
    severity, family, action, action_params, routine,
    actor_user_id, actor_label, entity_type, entity_id, entity_label,
    agency_id, ip, user_agent, session_id, metadata
  ) values (
    p_severity, p_family, p_action, coalesce(p_action_params, '{}'::jsonb), coalesce(p_routine, false),
    v_actor, v_label, p_entity_type, p_entity_id, p_entity_label,
    p_agency_id, p_ip, p_user_agent, p_session_id, v_metadata
  )
  returning id into v_id;

  return v_id;
end;
$function$;

comment on function public.admin_log_write is
  'Seul chemin d''écriture du registre. À appeler en DERNIÈRE instruction du geste : le verrou '
  'de chaîne est tenu jusqu''au COMMIT, et journaliser en premier ne garantit rien de plus '
  '(l''insert disparaît avec le geste en cas d''échec) tout en croisant l''ordre de '
  'verrouillage des RPC existantes, qui prennent le verrou d''agence AVANT d''écrire leur '
  'journal. Règle d''ordre : verrou d''entité PUIS verrou de chaîne, jamais l''inverse.';

-- ── 7. Vérification ──────────────────────────────────────────────────────────────────

-- L'ancienne signature à un seul argument est déposée : sans ce drop, la version bornée
-- ci-dessous coexisterait avec elle et un appel sans argument deviendrait AMBIGU (les deux
-- acceptent zéro paramètre), donc 42725 sur le cron de vérification.
drop function if exists public.admin_log_verify_chain(bigint);
create or replace function public.admin_log_verify_chain(
  p_from bigint default null,
  -- Borne HAUTE, ajoutée après revue. Sans elle, vérifier « à partir de » revenait à
  -- vérifier jusqu'à la fin du registre : le coût croissait avec l'ÂGE de la fenêtre, et
  -- un extrait signé portait un verdict couvrant des lignes qu'il ne contenait pas.
  p_to   bigint default null
)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  r          record;
  v_prev     text;
  v_n        bigint := 0;
  v_first    bigint;
  v_last     bigint;
  v_head     text;
  v_break    bigint;
  v_expected text;
begin
  if not (
    public.is_super_admin()
    or public.is_service_role()
    or session_user in ('postgres', 'supabase_admin')
  ) then
    raise exception 'forbidden: super_admin or service only' using errcode = '42501';
  end if;

  for r in
    select * from public.admin_log
     where (p_from is null or seq >= p_from)
       and (p_to   is null or seq <= p_to)
     order by seq asc
  loop
    if r.payload_version <> 1 then
      raise exception 'admin_log: version de payload inconnue: %', r.payload_version
        using errcode = '22023';
    end if;
    if v_n = 0 then
      v_first := r.seq;
      v_prev  := r.prev_hash;   -- point de départ : on ne juge pas le maillon amont
    end if;
    v_expected := encode(sha256(convert_to(v_prev || public.admin_log_payload_v1(
      r.seq, r.id, r.ts, r.severity, r.family, r.action, r.action_params, r.routine,
      r.actor_user_id, r.actor_label, r.entity_type, r.entity_id, r.entity_label,
      r.agency_id, r.ip, r.user_agent, r.session_id, r.metadata
    ), 'UTF8')), 'hex');
    if v_break is null and (r.prev_hash <> v_prev or r.hash <> v_expected) then
      v_break := r.seq;
    end if;
    v_prev := r.hash;
    v_last := r.seq;
    v_head := r.hash;
    v_n    := v_n + 1;
  end loop;

  -- Une marche sur zéro ligne ne rencontre aucune rupture : ne JAMAIS rendre 'ok'.
  if v_n = 0 then
    return jsonb_build_object('status', 'no_rows', 'rows_checked', 0);
  end if;

  return jsonb_build_object(
    'status',       case when v_break is null then 'ok' else 'broken' end,
    'rows_checked', v_n,
    'first_seq',    v_first,
    'last_seq',     v_last,
    'seq_gaps',     (v_last - v_first + 1) - v_n,
    'head',         v_head,
    'break_at',     v_break,
    'anchored',     (p_from is null),
    -- Un verdict doit dire SUR QUOI il porte : `bounded` false signale que la marche est
    -- allée jusqu'à la tête du registre, et non jusqu'à la fin d'une fenêtre demandée.
    'bounded',      (p_to is not null),
    -- check:drift ne couvre ni les triggers, ni les policies, ni les GRANT : la
    -- vérification les asserte elle-même.
    'triggers',     (select count(*) from pg_trigger t
                      where t.tgrelid = 'public.admin_log'::regclass
                        and not t.tgisinternal and t.tgenabled = 'O'),
    'rls',          (select relrowsecurity from pg_class where oid = 'public.admin_log'::regclass),
    'forced_rls',   (select relforcerowsecurity from pg_class where oid = 'public.admin_log'::regclass),
    'policies',     (select count(*) from pg_policy where polrelid = 'public.admin_log'::regclass),
    'head_row',     (select jsonb_build_object('seq_max', seq_max, 'rows_count', rows_count,
                                               'head_hash', head_hash, 'last_event_ts', last_event_ts)
                       from public.admin_log_chain_head where one)
  );
end;
$function$;

comment on function public.admin_log_verify_chain is
  'Rend un verdict, jamais un booléen. `no_rows` n''est PAS `ok` : une chaîne vue sur zéro '
  'ligne (RLS, FORCE RLS, table amputée) ne prouve rien. Ne détecte pas la troncature de '
  'queue — c''est le rôle de l''ancre externe (rows_count publié hors Postgres). '
  'La marche est bornée AUX DEUX BOUTS : `p_to` a été ajouté après revue, parce qu''un '
  'verdict qui court jusqu''à la tête du registre coûte proportionnellement à l''ÂGE de la '
  'fenêtre et décrit des lignes que l''appelant n''a pas demandées. `bounded` dit lequel des '
  'deux cas a eu lieu.';

-- ── 8. Privilèges ────────────────────────────────────────────────────────────────────
-- Les privilèges par défaut de Supabase accordent arwdDxtm à anon/authenticated/service_role
-- sur toute table neuve, et EXECUTE à anon sur toute fonction neuve. Sans ces REVOKE,
-- « l'écriture passe exclusivement par la RPC » serait faux.

alter table public.admin_log                enable row level security;
alter table public.admin_log_chain_head     enable row level security;
alter table public.admin_log_family         enable row level security;
alter table public.admin_log_severity       enable row level security;
-- PAS de FORCE ROW LEVEL SECURITY, volontairement : admin_log_write appartient à postgres,
-- propriétaire de la table, et il n'existe (à dessein) aucune policy INSERT. Sous FORCE,
-- l'écriture serait impossible et la vérification lirait 0 ligne en criant « intacte ».

revoke all on table public.admin_log            from public, anon, authenticated, service_role;
revoke all on table public.admin_log_chain_head from public, anon, authenticated, service_role;
revoke all on table public.admin_log_family     from public, anon, authenticated, service_role;
revoke all on table public.admin_log_severity   from public, anon, authenticated, service_role;

grant select on table public.admin_log            to authenticated;
grant select on table public.admin_log_chain_head to authenticated;
grant select on table public.admin_log_family     to authenticated;
grant select on table public.admin_log_severity   to authenticated;

drop policy if exists admin_log_select_super_admin on public.admin_log;
create policy admin_log_select_super_admin on public.admin_log
  for select to authenticated using (public.is_super_admin());

drop policy if exists admin_log_head_select_super_admin on public.admin_log_chain_head;
create policy admin_log_head_select_super_admin on public.admin_log_chain_head
  for select to authenticated using (public.is_super_admin());

drop policy if exists admin_log_family_select_super_admin on public.admin_log_family;
create policy admin_log_family_select_super_admin on public.admin_log_family
  for select to authenticated using (public.is_super_admin());

drop policy if exists admin_log_severity_select_super_admin on public.admin_log_severity;
create policy admin_log_severity_select_super_admin on public.admin_log_severity
  for select to authenticated using (public.is_super_admin());

revoke all on function public.admin_log_write(text, text, text, text, text, uuid, text, uuid, jsonb, jsonb, boolean, inet, text, text)
  from public, anon;
grant execute on function public.admin_log_write(text, text, text, text, text, uuid, text, uuid, jsonb, jsonb, boolean, inet, text, text)
  to authenticated, service_role;

-- La console n'appelle pas la vérification : elle lit la ligne `ops` déposée par le cron.
revoke all on function public.admin_log_verify_chain(bigint, bigint) from public, anon, authenticated;
grant execute on function public.admin_log_verify_chain(bigint, bigint) to service_role;

revoke all on function public.admin_log_payload_v1(bigint, uuid, timestamptz, text, text, text, jsonb, boolean, uuid, text, text, uuid, text, uuid, inet, text, text, jsonb)
  from public, anon, authenticated;

-- ── 9. Vérification planifiée ────────────────────────────────────────────────────────
-- Garde sur pg_extension et PAS sur le schéma : en CI le schéma `cron` existe SANS la table
-- cron.job, et plpgsql planifie toute l'expression d'un IF.
-- Le scan tourne SANS le verrou de chaîne, puis journalise son résultat dans une écriture
-- séparée — jamais dans la transaction de son propre scan.

create or replace function public.admin_log_chain_verify_job()
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_result jsonb;
begin
  v_result := public.admin_log_verify_chain();
  perform public.admin_log_write(
    p_family   => 'ops',
    p_action   => 'admin_log_chain_verified',
    p_severity => case when v_result ->> 'status' = 'ok' then 'info' else 'crit' end,
    p_routine  => (v_result ->> 'status' = 'ok'),
    p_metadata => jsonb_build_array(
      jsonb_build_object('l', 'Statut',        'v', v_result ->> 'status'),
      jsonb_build_object('l', 'Lignes relues', 'v', v_result ->> 'rows_checked'),
      jsonb_build_object('l', 'Tête',          'v', left(coalesce(v_result ->> 'head', ''), 12)),
      jsonb_build_object('l', 'Rupture',       'v', coalesce(v_result ->> 'break_at', 'aucune'))
    )
  );
end;
$function$;

revoke all on function public.admin_log_chain_verify_job() from public, anon, authenticated;
grant execute on function public.admin_log_chain_verify_job() to service_role;

do $$
begin
  perform cron.unschedule('admin-log-chain-verify-hourly');
exception when others then null;
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'admin-log-chain-verify-hourly',
      '40 * * * *',
      $cron$ select public.admin_log_chain_verify_job(); $cron$
    );
  end if;
end $$;
