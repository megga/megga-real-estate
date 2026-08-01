-- Entrée en console : convergence vers admin_log, et état de session (TTL 8 h + allowlist).
-- Étape 3 du plan Console MEGGA, spec §1, §5.9, §6, §10.3.
--
-- CE QU'IL N'Y A PAS À FAIRE, et pourquoi c'est dit ici : la spec parle six fois de « faire
-- converger la table admin_console_entry_audit vers admin_log ». Cette table n'existe pas —
-- `admin_console_entry_audit` est le nom du FICHIER 20260725220000, qui ne crée qu'une
-- fonction écrivant dans activity_events (mesuré, docs/console-admin/INVENTAIRE_SOCLE.md §1).
-- Il n'y a donc aucune donnée à reprendre, aucun ALTER, aucun backfill : la convergence se
-- réduit à faire écrire cette fonction dans les DEUX journaux.
--
-- D'OÙ VIENNENT L'IP ET LE USER-AGENT. Pas des en-têtes de la requête : de `auth.sessions`,
-- que GoTrue renseigne lui-même à la connexion. Trois raisons. (1) C'est une donnée que
-- l'appelant ne fabrique pas — un en-tête `x-forwarded-for` est déclaratif. (2) La colonne
-- est déjà typée `inet`. (3) Mesuré en production : 27 sessions, 27 avec une IP, 12 IP
-- DISTINCTES — donc de vraies adresses clientes, pas une adresse de sortie unique. C'est ce
-- qui rend la détection d'anomalie de §5.9 possible ; sans cette mesure, on aurait bâti une
-- baseline sur une colonne constante.
--
-- LE TTL DE 8 H EST EXPOSÉ, PAS IMPOSÉ. §10.3 demande « sessions console : TTL 8 h ». Le
-- faire respecter dans `is_super_admin()` porterait sur les 91 gardes du dépôt et couperait
-- le CRM en même temps que la console : hors de ce que l'étape 3 a le droit de décider.
-- `admin_console_session_state()` rend donc le verdict, la console s'y conforme, et le
-- passage à un mur dur reste une décision PO — signalée plutôt que prise en douce.

-- ── 1. L'entrée écrit dans les deux journaux ─────────────────────────────────────────

create or replace function public.admin_log_console_entry(
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_actor      record;
  v_session    record;
  v_session_id uuid;
  v_event_id   uuid;
  v_label      text;
begin
  if not public.is_super_admin() then
    raise exception 'forbidden: super_admin required' using errcode = '42501';
  end if;

  select p.id, p.email, p.full_name
    into v_actor
    from public.profiles p
   where p.id = auth.uid();

  v_label := coalesce(nullif(btrim(coalesce(v_actor.full_name, '')), ''), v_actor.email);

  -- La revendication `session_id` du JWT quand elle est là ; sinon la session la plus
  -- récente du compte. Le repli est délibéré : une revendication absente doit dégrader
  -- l'enrichissement, jamais faire échouer l'entrée en console.
  begin
    v_session_id := nullif(
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'session_id', ''
    )::uuid;
  exception when others then
    v_session_id := null;
  end;

  select s.id, s.ip, s.user_agent, s.created_at
    into v_session
    from auth.sessions s
   where s.user_id = auth.uid()
     and (v_session_id is null or s.id = v_session_id)
   order by s.created_at desc
   limit 1;

  -- Journal historique, inchangé : la severity `warn` qu'il porte depuis l'origine n'est
  -- pas modifiée ici. §6 classe l'entrée console en `info`, mais réécrire la sévérité de
  -- lignes déjà émises brouillerait la lecture d'un journal qu'on n'a pas mandat de
  -- retoucher. Le registre console, lui, applique la spec.
  insert into public.activity_events
    (agency_id, actor_id, actor_kind, action, entity_type, entity_id,
     category, severity, object_label, metadata)
  values (
    null, auth.uid(), 'user', 'admin_console_entered', 'admin_console', auth.uid(),
    'auth', 'warn', v_label, coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_event_id;

  -- Registre console (§6, famille `session`, sévérité `info`). Non routine : une entrée en
  -- console est précisément ce que l'écran Sécurité montre en premier, pas ce qu'il replie.
  perform public.admin_log_write(
    p_family       => 'session',
    p_action       => 'admin_console_entered',
    p_severity     => 'info',
    p_entity_type  => 'admin_console',
    p_entity_label => v_label,
    p_entity_id    => auth.uid(),
    p_routine      => false,
    p_ip           => v_session.ip,
    p_user_agent   => v_session.user_agent,
    p_session_id   => v_session.id::text,
    p_metadata     => jsonb_build_array(
      jsonb_build_object('l', 'Origine',
        'v', coalesce(coalesce(p_metadata, '{}'::jsonb) ->> 'origin', 'inconnue')),
      jsonb_build_object('l', 'Session ouverte depuis',
        'v', case
               when v_session.created_at is null then 'inconnu'
               else (extract(epoch from (now() - v_session.created_at)) / 3600)::int::text || ' h'
             end)
    )
  );

  return v_event_id;
end;
$function$;

comment on function public.admin_log_console_entry(jsonb) is
  'Audit d''ouverture de console : écrit dans activity_events (historique, severity warn) ET '
  'dans admin_log (registre console, famille session, severity info — §6). IP et user-agent '
  'viennent de auth.sessions, renseignés par GoTrue, jamais d''un en-tête déclaratif.';

revoke all on function public.admin_log_console_entry(jsonb) from public, anon;
grant execute on function public.admin_log_console_entry(jsonb) to authenticated;

-- ── 2. État de la session console ────────────────────────────────────────────────────

drop function if exists public.admin_console_session_state();
create or replace function public.admin_console_session_state()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_ttl        constant interval := interval '8 hours';
  v_session    record;
  v_session_id uuid;
  v_super      boolean;
  v_age        interval;
begin
  -- Pas de garde 42501 ici : cette fonction EST le verdict d'accès. Elle doit pouvoir
  -- répondre « non » à qui n'a pas le droit, plutôt que de lever — sinon la console ne
  -- peut pas distinguer « refusé » de « indisponible », et c'est le mode de panne que
  -- useSuperAdminGate documente déjà (une RPC en hoquet fermait la porte définitivement).
  v_super := public.is_super_admin();

  if auth.uid() is null then
    return jsonb_build_object('allowed', false, 'reason', 'no_session');
  end if;

  begin
    v_session_id := nullif(
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'session_id', ''
    )::uuid;
  exception when others then
    v_session_id := null;
  end;

  select s.id, s.created_at, s.ip
    into v_session
    from auth.sessions s
   where s.user_id = auth.uid()
     and (v_session_id is null or s.id = v_session_id)
   order by s.created_at desc
   limit 1;

  if not v_super then
    -- La révocation hors allowlist ne demande aucun mécanisme : is_super_admin() relit le
    -- rôle ET l'allowlist à chaque appel. Retirer une adresse ferme l'accès au prochain
    -- appel de n'importe laquelle des gardes, sans attendre l'expiration d'un jeton.
    return jsonb_build_object('allowed', false, 'reason', 'not_super_admin');
  end if;

  if v_session.created_at is null then
    -- Session introuvable (revendication absente ET aucune ligne) : on n'invente pas un
    -- âge. Accès accordé — le mur reste is_super_admin() — mais l'état le dit.
    return jsonb_build_object('allowed', true, 'reason', 'session_unknown', 'ttl_hours', 8);
  end if;

  v_age := now() - v_session.created_at;

  return jsonb_build_object(
    'allowed',      v_age < v_ttl,
    'reason',       case when v_age < v_ttl then 'ok' else 'session_expired' end,
    'ttl_hours',    8,
    'age_seconds',  floor(extract(epoch from v_age))::bigint,
    'expires_at',   v_session.created_at + v_ttl,
    'session_id',   v_session.id
  );
end;
$function$;

comment on function public.admin_console_session_state() is
  'Verdict d''accès console : super-admin (rôle + allowlist, relus à chaque appel) ET session '
  'de moins de 8 h (§10.3). Rend un verdict au lieu de lever, pour que la console distingue '
  '« refusé » de « indisponible ». Le TTL est EXPOSÉ, pas imposé : l''imposer vivrait dans '
  'is_super_admin(), donc sur les 91 gardes du dépôt et sur le CRM — décision PO.';

revoke all on function public.admin_console_session_state() from public, anon;
grant execute on function public.admin_console_session_state() to authenticated;
