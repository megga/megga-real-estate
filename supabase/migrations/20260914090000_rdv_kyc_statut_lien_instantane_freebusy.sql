-- Prise de rendez-vous KYC : un lien RÉVOQUÉ ne réserve plus, et l'agenda externe de
-- l'agent n'est plus interrogé qu'une fois par minute (audit du 13.09.2026, deux constats
-- laissés hors périmètre des PR #1308 et #1319).
--
-- ⛔ CONSTAT 1 — LA DATE SEULE. `appointment-slots`, `appointment-book` et la RPC
-- `book_kyc_appointment` ne testaient que `expires_at`. Or le seul levier de révocation d'un
-- lien magique est son STATUT : le passer à `expired` avant l'échéance (la réémission de la
-- console l'exige de son futur consommateur d'outbox — `expire_previous`, 20260801370000 —,
-- un agent le peut par sa policy d'UPDATE). Un lien révoqué restait donc bon pour lister les
-- créneaux et réserver jusqu'à sa date — sept jours pour les émetteurs réels, trente au plafond.
-- Écrivains du statut, relevés avant d'écrire : magic-link-get (`opened`, `expired` à
-- échéance), magic-link-upload (`uploading`, `expired`), magic-link-confirm (`submitted`,
-- `expired`), la console (20260801310000, retiré par 20260801370000), et les agents par RLS.
--
-- LE CORRECTIF EST UNE LISTE BLANCHE, pas « ≠ expired » : un statut ajouté demain à l'enum
-- (`revoked`…) doit refuser tant que personne n'a décidé qu'il réserve. La liste :
-- les quatre statuts OUVERTS plus `submitted` — c'est au statut soumis que la page publique
-- propose la réservation (MlkSuccess → MlkBooking) ; soumettre ferme le dépôt, pas la prise
-- de rendez-vous. Miroir de `MAGIC_LINK_BOOKING_STATUSES` (_shared/magic-link-limits.ts),
-- que les deux edge functions appliquent AVANT la RPC ; la copie en base fait foi au moment
-- d'écrire le rendez-vous. Les deux sont confrontées par
-- tests/unit/rdv-kyc-statut-lien-instantane.spec.ts.
--
-- ⛔ CONSTAT 2 — UN APPEL AU FOURNISSEUR PAR REQUÊTE. `appointment-slots` est public, et
-- chaque appel déclenchait un `freeBusy` Google ou un `getSchedule` Graph sur l'agenda de
-- l'agent — plus un rafraîchissement OAuth dès que le jeton d'accès avait une heure, le
-- jeton rafraîchi n'étant jamais réécrit (_shared/booking-oauth.ts). Un lien transféré
-- suffisait à marteler les deux API au nom de l'agent, sans limite.
--
-- LE CORRECTIF : un INSTANTANÉ par agent, pris sous BAIL. `kyc_booking_freebusy_cache`
-- garde le résultat du dernier appel (des bornes début/fin, ou le constat « injoignable »)
-- pendant 60 s ; `kyc_booking_freebusy_claim` accorde atomiquement, par fenêtre, le droit
-- d'appeler le fournisseur à UNE requête — les autres attendent son instantané au lieu
-- d'appeler. Logique, durée et justification : _shared/booking-freebusy-cache.ts.
--
-- POURQUOI PAR AGENT ET NON PAR LIEN : l'appel porte sur l'agenda de l'AGENT et son
-- résultat ne dépend pas du lien. Une clé par lien laisserait K liens d'un même agent
-- déclencher K appels par fenêtre ; la clé par agent borne chaque lien ET leur somme.
-- Toujours pas l'IP : elle ne protège pas un lien transféré (même raisonnement que les
-- plafonds du lien magique, 20260913160400).
--
-- ⚠ CE QUE L'INSTANTANÉ NE PORTE JAMAIS : l'occupation INTERNE. Rendez-vous, visites,
-- absences et réglages sont relus à chaque requête (`kyc_booking_busy_ranges`), et la RPC
-- revalide tout à la réservation : un créneau pris dans MEGGA ne peut pas ressortir d'un
-- instantané. Les edge functions le jettent en plus après chaque réservation, annulation ou
-- report, une fois l'écho posé dans l'agenda externe — pour qu'il dise ce que l'agenda dit.
--
-- DROITS. Table et bail réservés au service : `anon` et `authenticated` n'y ont AUCUN droit
-- (RLS activée sans policy, et REVOKE — les droits par défaut de Supabase accordaient la
-- lecture à anon, lecture et écriture à authenticated). Les trois fonctions publiques
-- tournent en service_role. Rien de ce que ces deux rôles lisent sur `kyc_magic_links`
-- n'est élargi : la table des liens n'est pas touchée.
--
-- Rejouable (deploy.yml rejoue les migrations du jour) : CREATE … IF NOT EXISTS, CREATE OR
-- REPLACE, réécriture de la RPC sautée si elle porte déjà la liste, GRANT/REVOKE idempotents,
-- et un bloc de contrôle final qui n'écrit rien de durable.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. LA LISTE BLANCHE — une fonction, pour être éprouvée seule
-- ═══════════════════════════════════════════════════════════════════════════
-- En `text` et non sur l'enum : la comparaison reste IMMUTABLE pour de vrai, et une valeur
-- inconnue — un statut ajouté demain — rend false au lieu de lever.
create or replace function public.kyc_magic_link_bookable(p_status text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_status in ('pending', 'opened', 'uploading', 'verifying', 'submitted'), false)
$$;

comment on function public.kyc_magic_link_bookable(text) is
  'Liste BLANCHE des statuts d''un lien magique KYC qui peut encore réserver sa vérification '
  'd''identité : les statuts ouverts et submitted. expired, et tout statut inconnu, refusent. '
  'Miroir de MAGIC_LINK_BOOKING_STATUSES (_shared/magic-link-limits.ts) — 20260914090000.';

revoke all on function public.kyc_magic_link_bookable(text) from public, anon, authenticated;
grant execute on function public.kyc_magic_link_bookable(text) to service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. book_kyc_appointment CONSULTE LA LISTE — réécrite EN PLACE
-- ═══════════════════════════════════════════════════════════════════════════
-- Depuis sa définition VIVANTE (`pg_get_functiondef`), jamais recopiée de 20260803090000 :
-- le corps en service ne vient pas toujours de la migration qu'on croit (cf. 20260806164512,
-- 20260914080000). Le contrôle s'insère juste après celui de la date ; tout autre écart —
-- ancre absente, ancre en double, définition relue différente de l'attendue — LÈVE, et la
-- migration entière est annulée plutôt que d'écraser une version qu'on n'a pas lue.
do $$
declare
  v_fn    constant regprocedure := 'public.book_kyc_appointment(uuid, timestamptz, text, text, text, text)'::regprocedure;
  -- Le contrôle de la date, tolérant aux blancs : c'est après lui que tout lien s'arrête.
  v_ancre constant text := $re$IF\s+l\.expires_at\s*<\s*now\(\)\s+THEN\s+RAISE\s+EXCEPTION\s+'link_expired';\s*END\s+IF;$re$;
  v_ajout constant text := $aj$
  -- Liste BLANCHE de statuts (20260914090000) : un lien révoqué — passé à `expired` avant
  -- son échéance — ne réserve plus. La date seule ne le disait pas.
  IF NOT public.kyc_magic_link_bookable(l.status::text) THEN RAISE EXCEPTION 'link_expired'; END IF;$aj$;
  v_def   text;
  v_neuve text;
begin
  v_def := pg_get_functiondef(v_fn);

  -- Rejeu du jour : la RPC porte déjà la liste.
  if position('kyc_magic_link_bookable' in v_def) > 0 then
    return;
  end if;

  if regexp_count(v_def, v_ancre, 1, 'i') <> 1 then
    raise exception 'book_kyc_appointment : contrôle de date introuvable ou multiple dans la définition vivante (% occurrence(s)) — rien n''est réécrit',
      regexp_count(v_def, v_ancre, 1, 'i');
  end if;

  -- `\&` rend l'ancre elle-même : l'ajout la SUIT, rien n'est retiré.
  v_neuve := regexp_replace(v_def, v_ancre, '\&' || v_ajout, 'i');
  execute v_neuve;

  -- Relecture : la seule différence avec la version d'avant doit être l'ajout.
  if replace(pg_get_functiondef(v_fn), v_ajout, '') is distinct from v_def then
    raise exception 'book_kyc_appointment : la définition relue diffère au-delà du contrôle de statut';
  end if;
end $$;

-- Droits inchangés par CREATE OR REPLACE ; rappelés ici, idempotents, pour qu'on les lise
-- au même endroit que le changement (20260803090000 : service_role seul).
revoke all on function public.book_kyc_appointment(uuid, timestamptz, text, text, text, text) from public, anon, authenticated;
grant execute on function public.book_kyc_appointment(uuid, timestamptz, text, text, text, text) to service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. L'INSTANTANÉ FREE/BUSY, UNE LIGNE PAR AGENT
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.kyc_booking_freebusy_cache (
  agent_id    uuid        not null,
  -- Le BAIL : la requête qui l'a pris est la seule à appeler le fournisseur jusqu'à
  -- `claimed_at` + la durée de vie, et la seule dont l'écriture de l'instantané porte.
  lease_id    uuid        not null default gen_random_uuid(),
  claimed_at  timestamptz not null default now(),
  -- L'instantané. NULL tant que le porteur du bail ne l'a pas écrit.
  fetched_at  timestamptz,
  window_from timestamptz,
  window_to   timestamptz,
  ok          boolean,
  provider    text,
  busy        jsonb       not null default '[]'::jsonb,
  constraint kyc_booking_freebusy_cache_pkey primary key (agent_id),
  -- CASCADE : l'effacement d'un compte (delete-account → auth.users → profiles) emporte
  -- l'instantané de son agenda.
  constraint kyc_booking_freebusy_cache_agent_id_fkey
    foreign key (agent_id) references public.profiles(id) on delete cascade,
  constraint kyc_booking_freebusy_cache_busy_array check (jsonb_typeof(busy) = 'array'),
  constraint kyc_booking_freebusy_cache_window
    check (window_from is null or window_to is null or window_to > window_from)
);

comment on table public.kyc_booking_freebusy_cache is
  'Instantané des occupations EXTERNES (freeBusy Google / getSchedule Graph) d''un agent, '
  'servi 60 s par appointment-slots, et bail qui n''autorise qu''UN appel au fournisseur par '
  'agent et par fenêtre. Jamais d''occupation interne ici. Service seul (20260914090000).';

alter table public.kyc_booking_freebusy_cache enable row level security;
-- Aucune policy : seul le service lit et écrit. Les droits par défaut de Supabase donnaient
-- la lecture à anon et tout à authenticated — retirés.
revoke all on table public.kyc_booking_freebusy_cache from public, anon, authenticated;
grant select, insert, update, delete on table public.kyc_booking_freebusy_cache to service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. LE BAIL
-- ═══════════════════════════════════════════════════════════════════════════
-- Rend l'identifiant d'un bail NEUF si l'agent n'en a pas de vivant, NULL sinon. Atomique
-- par construction : deux appels simultanés passent par le même ON CONFLICT, le second
-- attend le premier puis relit sa ligne — `claimed_at` y est frais, la condition est fausse.
--
-- SECURITY INVOKER : l'appelant légitime (service_role) a déjà les droits de table ; une
-- fonction plus privilégiée que son appelant n'aurait rien à y gagner.
--
-- Au passage, les lignes d'AUTRES agents sans bail depuis une heure sont supprimées : un
-- instantané périmé ne sert plus qu'à révéler l'emploi du temps d'un agent. Il ne survit
-- donc pas une heure à sa dernière demande, tant que le module sert quelqu'un.
create or replace function public.kyc_booking_freebusy_claim(p_agent_id uuid, p_ttl_seconds integer)
returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_lease uuid;
begin
  if p_agent_id is null then
    raise exception 'agent_required';
  end if;
  -- Une durée absurde ne doit pas transformer le bail en porte ouverte (0 s) ni en blocage
  -- de plusieurs heures.
  if p_ttl_seconds is null or p_ttl_seconds < 1 or p_ttl_seconds > 3600 then
    raise exception 'bad_ttl';
  end if;

  insert into public.kyc_booking_freebusy_cache as c (agent_id, lease_id, claimed_at)
  values (p_agent_id, gen_random_uuid(), now())
  on conflict (agent_id) do update
     set lease_id   = excluded.lease_id,
         claimed_at = excluded.claimed_at
   where c.claimed_at <= now() - make_interval(secs => p_ttl_seconds)
  returning c.lease_id into v_lease;

  delete from public.kyc_booking_freebusy_cache
   where claimed_at < now() - interval '1 hour';

  return v_lease;
end $$;

comment on function public.kyc_booking_freebusy_claim(uuid, integer) is
  'Bail d''appel au fournisseur d''agenda pour un agent : un identifiant neuf si aucun bail '
  'n''a été pris depuis p_ttl_seconds, NULL sinon. Purge les instantanés sans bail depuis une '
  'heure. Service seul (20260914090000).';

revoke all on function public.kyc_booking_freebusy_claim(uuid, integer) from public, anon, authenticated;
grant execute on function public.kyc_booking_freebusy_claim(uuid, integer) to service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- CONTRÔLE FINAL — la migration échoue plutôt que de laisser un invariant faux.
-- Chaque refus a son témoin : un catalogue mal lu, ou une garde qui refuserait TOUT,
-- ne passerait pas les contrôles positifs.
-- ═══════════════════════════════════════════════════════════════════════════
do $$
declare
  v_def   text;
  v_agent uuid;
  v_l1    uuid;
  v_l2    uuid;
  v_l3    uuid;
  v_msg   text;
  v_priv  text;
  v_role  text;
begin
  -- 1. La liste blanche : `expired` et l'inconnu refusent…
  if public.kyc_magic_link_bookable('expired') then
    raise exception 'liste blanche : un lien expiré réserve encore';
  end if;
  if public.kyc_magic_link_bookable('revoked') or public.kyc_magic_link_bookable('')
     or public.kyc_magic_link_bookable(null) or public.kyc_magic_link_bookable('SUBMITTED') then
    raise exception 'liste blanche : un statut inconnu réserve — la liste n''est plus blanche';
  end if;
  --    … TÉMOINS : chacun des cinq statuts vivants réserve, et l'enum n'en a pas d'autre que
  --    `expired` au moment de cette migration.
  if exists (
    select 1 from unnest(enum_range(null::public.kyc_magic_link_status)) as s(v)
     where public.kyc_magic_link_bookable(s.v::text) is distinct from (s.v::text <> 'expired')
  ) then
    raise exception 'liste blanche : elle ne recouvre pas l''enum kyc_magic_link_status moins expired';
  end if;

  -- 2. La RPC de réservation consulte la liste, AVANT d'écrire le rendez-vous.
  v_def := lower(pg_get_functiondef('public.book_kyc_appointment(uuid, timestamptz, text, text, text, text)'::regprocedure));
  if position('public.kyc_magic_link_bookable(l.status::text)' in v_def) = 0
     or position('public.kyc_magic_link_bookable(l.status::text)' in v_def)
        > position('insert into public.appointments' in v_def)
     or position('insert into public.appointments' in v_def) = 0 then
    raise exception 'book_kyc_appointment ne consulte pas la liste blanche avant d''écrire';
  end if;

  -- 3. Droits : aucun rôle client sur la table, ni sur les fonctions…
  foreach v_role in array array['anon', 'authenticated'] loop
    foreach v_priv in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'] loop
      if has_table_privilege(v_role, 'public.kyc_booking_freebusy_cache', v_priv) then
        raise exception 'instantané : % détient % sur kyc_booking_freebusy_cache', v_role, v_priv;
      end if;
    end loop;
    if has_function_privilege(v_role, 'public.kyc_booking_freebusy_claim(uuid, integer)', 'EXECUTE')
       or has_function_privilege(v_role, 'public.kyc_magic_link_bookable(text)', 'EXECUTE')
       or has_function_privilege(v_role, 'public.book_kyc_appointment(uuid, timestamptz, text, text, text, text)', 'EXECUTE') then
      raise exception 'instantané : % peut exécuter une fonction réservée au service', v_role;
    end if;
  end loop;
  --    … TÉMOINS : le service lit, écrit, prend le bail et réserve.
  foreach v_priv in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE'] loop
    if not has_table_privilege('service_role', 'public.kyc_booking_freebusy_cache', v_priv) then
      raise exception 'instantané : service_role a perdu % sur kyc_booking_freebusy_cache', v_priv;
    end if;
  end loop;
  if not has_function_privilege('service_role', 'public.kyc_booking_freebusy_claim(uuid, integer)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.book_kyc_appointment(uuid, timestamptz, text, text, text, text)', 'EXECUTE') then
    raise exception 'instantané : service_role ne peut plus prendre le bail ou réserver';
  end if;
  if not exists (
    select 1 from pg_class
     where oid = 'public.kyc_booking_freebusy_cache'::regclass and relrowsecurity
  ) then
    raise exception 'instantané : RLS désactivée sur kyc_booking_freebusy_cache';
  end if;

  -- 4. Le bail refuse une durée absurde (avant toute écriture : pas besoin d'agent réel).
  begin
    perform public.kyc_booking_freebusy_claim(gen_random_uuid(), 0);
    v_msg := 'accepté';
  exception when others then
    get stacked diagnostics v_msg = message_text;
  end;
  if v_msg is distinct from 'bad_ttl' then
    raise exception 'bail : une durée de 0 s n''est pas refusée (reçu : %)', v_msg;
  end if;

  -- 5. Épreuve du bail, en sous-transaction TOUJOURS annulée : accordé, puis refusé dans la
  --    fenêtre, puis ré-accordé une fois la fenêtre échue. Il faut un profil réel (clé
  --    étrangère) ; sur une base vierge de CI il n'y en a pas encore — l'épreuve est alors
  --    celle de tests/backend/rdv-kyc-statut-lien-instantane.spec.ts.
  v_msg := null;
  begin
    select p.id into v_agent
      from public.profiles p
     where not exists (select 1 from public.kyc_booking_freebusy_cache c where c.agent_id = p.id)
     limit 1;
    if v_agent is not null then
      v_l1 := public.kyc_booking_freebusy_claim(v_agent, 60);
      v_l2 := public.kyc_booking_freebusy_claim(v_agent, 60);
      update public.kyc_booking_freebusy_cache
         set claimed_at = now() - interval '61 seconds'
       where agent_id = v_agent;
      v_l3 := public.kyc_booking_freebusy_claim(v_agent, 60);
    end if;
    raise exception 'sonde_annulee';
  exception when others then
    get stacked diagnostics v_msg = message_text;
  end;
  if v_msg is distinct from 'sonde_annulee' then
    raise exception 'bail : l''épreuve a échoué (%)', v_msg;
  end if;
  if v_agent is not null then
    if v_l1 is null then
      raise exception 'bail : le premier bail d''un agent sans ligne est refusé';
    end if;
    if v_l2 is not null then
      raise exception 'bail : un second bail est accordé dans la même fenêtre';
    end if;
    if v_l3 is null or v_l3 = v_l1 then
      raise exception 'bail : un bail échu n''est pas repris';
    end if;
  end if;
end $$;
