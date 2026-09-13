-- Le journal d'audit n'accepte plus d'acteur forgé, et une suppression de contact y laisse
-- une trace (audit du 13.09.2026, point S3).
--
-- ⛔ CE QUE LA BASE ACCEPTAIT. `events_insert` (20260610_001) borne l'INSERT d'un agent à SON
-- agence — et à rien d'autre. Huit fichiers du front insèrent directement dans
-- `activity_events`, avec `actor_id` et `actor_kind` fournis par le NAVIGATEUR ; aucun
-- trigger BEFORE INSERT ne les relisait. Un agent pouvait donc écrire
--   {actor_id: <uuid du manager>, action: 'kyc_validated', …}   ou   {actor_kind: 'ai', …}
-- avec des métadonnées arbitraires ; la ligne devenait immuable (triggers UPDATE/DELETE de
-- la baseline), retenue dix ans, et remontait dans le flux de la console. Intra-agence,
-- mais c'est la garantie « un journal d'audit pour toute action » qui tombait.
--
-- LA RÈGLE, tenue par un trigger : sous les rôles `authenticated` / `anon`, l'acteur d'un
-- événement EST l'appelant. `actor_id` absent → posé à `auth.uid()` ; `actor_id` différent →
-- refusé (42501) ; `actor_kind` autre que 'user' → refusé. Les rôles de service et postgres
-- ne sont pas touchés : ce sont eux qui écrivent les événements 'ai' et 'system' (edge
-- functions, crons, `capture_transaction_lifecycle` via les GUC `app.actor_*`).
-- Relu avant d'écrire : les huit inserts du front posent tous l'appelant en `actor_id`
-- (`user.id` / `profile.id`) et 'user' en `actor_kind` — aucun chemin légitime ne change.
--
-- ⚠ SECURITY INVOKER, pas DEFINER : la garde lit `current_user`, qui vaudrait `postgres`
-- dans une fonction DEFINER et rendrait la condition toujours fausse (même piège que
-- `admin_log_write`, qui lit `session_user` pour cette raison). Elle n'a besoin d'aucun
-- privilège : `auth.uid()` est exécutable par `authenticated`.
--
-- ET LA SUPPRESSION D'UN CONTACT. Depuis le navigateur (`useContacts.ts` → hard delete),
-- aucun événement n'était écrit ; seule la voie WhatsApp/copilote journalisait la sienne.
-- Un trigger AFTER DELETE, lui aussi INVOKER et limité au rôle `authenticated`, écrit
-- `contact_deleted` — les voies de service gardent leur propre journalisation, sans doublon.
-- Le libellé porte le nom (c'est ce qu'un journal LBA doit pouvoir retrouver) ; PAS
-- l'e-mail ni le téléphone : une personne effacée ne laisse pas ses coordonnées derrière.

-- ═══════════════════════════════════════════════════════════════════════════
-- L'ACTEUR EST L'APPELANT
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.tg_activity_events_actor_guard()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid;
begin
  if current_user in ('authenticated', 'anon') then
    v_uid := auth.uid();
    if v_uid is null then
      raise exception 'activity_events: aucun appelant identifié' using errcode = '42501';
    end if;
    if new.actor_id is null then
      new.actor_id := v_uid;
    elsif new.actor_id <> v_uid then
      raise exception 'activity_events.actor_id doit être l''appelant (%), reçu %', v_uid, new.actor_id
        using errcode = '42501';
    end if;
    if new.actor_kind is distinct from 'user' then
      raise exception 'activity_events.actor_kind: un agent n''écrit qu''en tant que ''user'' (reçu %)', new.actor_kind
        using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

comment on function public.tg_activity_events_actor_guard() is
  'BEFORE INSERT sur activity_events : sous authenticated/anon, actor_id = auth.uid() (posé '
  'si absent, refusé si différent) et actor_kind = ''user''. Les rôles de service et '
  'postgres écrivent librement (événements ai/system). Invoker par construction (20260913130100).';

drop trigger if exists trg_activity_events_actor_guard on public.activity_events;
create trigger trg_activity_events_actor_guard
  before insert on public.activity_events
  for each row execute function public.tg_activity_events_actor_guard();

-- ═══════════════════════════════════════════════════════════════════════════
-- SUPPRIMER UN CONTACT LAISSE UNE TRACE
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.tg_contacts_audit_delete()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid;
begin
  -- Voies de service (copilote, WhatsApp, purges) : elles journalisent elles-mêmes.
  if current_user <> 'authenticated' then
    return old;
  end if;
  v_uid := auth.uid();
  if v_uid is null then
    return old;
  end if;
  insert into public.activity_events (
    agency_id, actor_id, actor_kind, action, entity_type, entity_id,
    object_label, category, severity, metadata
  ) values (
    old.agency_id, v_uid, 'user', 'contact_deleted', 'contact', old.id,
    nullif(btrim(coalesce(old.first_name, '') || ' ' || coalesce(old.last_name, '')), ''),
    'contact', 'warn',
    jsonb_build_object('source', old.source, 'type', old.type, 'created_at', old.created_at)
  );
  return old;
end $$;

comment on function public.tg_contacts_audit_delete() is
  'AFTER DELETE sur contacts : un agent qui supprime une fiche depuis le CRM laisse un '
  'événement contact_deleted (nom, source, type — jamais e-mail ni téléphone). Les rôles de '
  'service journalisent leurs propres suppressions (20260913130100).';

drop trigger if exists trg_contacts_audit_delete on public.contacts;
create trigger trg_contacts_audit_delete
  after delete on public.contacts
  for each row execute function public.tg_contacts_audit_delete();
