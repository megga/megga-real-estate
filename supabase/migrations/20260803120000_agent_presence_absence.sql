-- Today V2 « concept H » · LOT 1 — présence de l'agent et « Pendant ton absence ».
--
-- Le bloc « Pendant ton absence » était le SEUL de la page à n'avoir aucun
-- backend : ni table, ni colonne, ni concept. Cette migration en pose le
-- minimum, et rien de plus.
--
-- ═══ CE QU'ON NE CONSTRUIT PAS, ET POURQUOI ═══════════════════════════════════
--
-- 1. PAS de table `signal_acks`. Le handoff en demande une ; elle serait la
--    TROISIÈME mécanique d'acquittement du dépôt, après le localStorage des
--    notifications (`activity_events` est immuable, cf. son trigger) et le
--    snooze en base (`matches.snoozed_until`, `reminders.status='snoozed'`).
--    On s'en passe par une observation simple : **la présence EST
--    l'acquittement**. « Tout marquer comme vu » = avancer `last_seen_at`, ce
--    qui vide le fil par construction. L'écartement d'UNE ligne reste local à la
--    session — exactement ce que fait la maquette (son état `seen` est un
--    useState). Sa disparition durable viendra du GESTE (Lot 2), pas d'un accusé
--    de lecture : une visite proposée fait avancer le match, donc le signal
--    change d'état de lui-même.
--
-- 2. PAS de groupe « MEGGA AI ». Il n'existe aucune table d'insight par
--    événement, et en fabriquer une supposerait un appel LLM par signal affiché
--    — ce que l'architecture Focus refuse explicitement (« DÉTERMINISTE +
--    EXPLICABLE … 0 LLM »). Le fil sort donc à DEUX groupes sur trois. C'est un
--    manque assumé, pas un oubli.
--
-- ═══ PORTÉE : AGENCE, PAS AGENT ═══════════════════════════════════════════════
-- Le handoff dit « l'agent ne voit que son portefeuille ». `matches` et
-- `reminders` ne portent PAS d'`agent_id` : seulement `agency_id`. La portée
-- réelle est donc l'agence, et l'agence vient du JWT — jamais du client (c'est
-- la convention anti-IDOR de `focus_top_matches`, pas celle de `matching-engine`
-- qui la reçoit dans son body).

-- ── 1. La table de présence ──────────────────────────────────────────────────
-- Une ligne par agent. `last_seen_at` = dernier moment où l'agent a QUITTÉ son
-- poste ; il n'est donc PAS touché au chargement de la page, sinon « pendant ton
-- absence » serait vide en permanence.
create table if not exists public.agent_presence (
  agent_id     uuid primary key references auth.users (id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.agent_presence is
  'Dernier départ de l''agent. Sert de borne au fil « Pendant ton absence » et tient lieu d''acquittement global (aucune table d''accusé de lecture).';

alter table public.agent_presence enable row level security;

-- Lecture de SA propre ligne. Aucune écriture directe : elle passe par
-- `presence_touch()`, pour qu'un seul chemin fasse foi.
drop policy if exists agent_presence_select_own on public.agent_presence;
create policy agent_presence_select_own on public.agent_presence
  for select to authenticated
  using (agent_id = auth.uid());

revoke insert, update, delete, truncate on table public.agent_presence from anon, authenticated;
revoke all on table public.agent_presence from anon;

-- ── 2. presence_touch — horodate le départ ───────────────────────────────────
create or replace function public.presence_touch()
returns timestamptz
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_previous timestamptz;
begin
  -- Garde explicite plutôt que le seul GRANT : le dépôt a déjà payé le footgun
  -- des privilèges par défaut (`GRANT ALL TO anon` posé par une migration
  -- ultérieure rouvrirait la porte en silence).
  if auth.uid() is null then
    raise exception 'forbidden: authenticated only' using errcode = '42501';
  end if;

  select ap.last_seen_at into v_previous
    from public.agent_presence ap
   where ap.agent_id = auth.uid();

  insert into public.agent_presence as ap (agent_id, last_seen_at, updated_at)
       values (auth.uid(), now(), now())
  on conflict (agent_id)
    do update set last_seen_at = now(), updated_at = now();

  -- Rend la valeur PRÉCÉDENTE : c'est elle qui borne le prochain « depuis … ».
  return v_previous;
end;
$function$;

revoke all on function public.presence_touch() from public, anon;
grant execute on function public.presence_touch() to authenticated, service_role;

-- ── 3. today_absence — le fil, borné par la présence ─────────────────────────
-- Rend des DONNÉES, pas des phrases : la prose (« a liké le 3.5p de Carouge »)
-- et les dates relatives sont composées côté client, où vit l'i18n.
--
-- Deux régimes, assumés :
--   · réactions acheteur → bornées par `last_seen_at` (ce sont des ÉVÉNEMENTS) ;
--   · rappels échus      → non bornés (ce sont des CHOSES QUI ATTENDENT).
--
-- `p_fallback_hours` couvre la toute première session d'un agent, qui n'a pas
-- encore de ligne de présence : sans borne, on lui déverserait tout l'historique
-- des réactions de l'agence.
--
-- ⚠ Constat du 03.08.2026, à garder en tête en relisant ce code : la base compte
-- ZÉRO réaction acheteur et ZÉRO lien de réception. Le groupe « Retours
-- acheteurs » sortira donc VIDE en production tant que la boucle de match n'aura
-- pas servi. Ce n'est pas un défaut de cette fonction.
create or replace function public.today_absence(p_fallback_hours integer default 72)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_agency   uuid;
  v_since    timestamptz;
  v_fallback integer;
  v_signals  jsonb;
begin
  if auth.uid() is null then
    raise exception 'forbidden: authenticated only' using errcode = '42501';
  end if;

  -- L'agence vient du JWT, jamais de l'appelant.
  select p.agency_id into v_agency from public.profiles p where p.id = auth.uid();
  if v_agency is null then
    return jsonb_build_object('since', null, 'signals', '[]'::jsonb);
  end if;

  v_fallback := least(greatest(coalesce(p_fallback_hours, 72), 1), 720);

  select ap.last_seen_at into v_since
    from public.agent_presence ap
   where ap.agent_id = auth.uid();
  v_since := coalesce(v_since, now() - make_interval(hours => v_fallback));

  with reactions as (
    -- Retours acheteurs : `interested` = like, `rejected` = écarté (avec motif).
    -- `response_at` est posé par le trigger `set_match_response_at`.
    select
      'match:' || m.id::text                              as id,
      case when m.status = 'interested' then 'like' else 'skip' end as kind,
      m.contact_id                                        as contact_id,
      c.first_name                                        as first_name,
      c.last_name                                         as last_name,
      coalesce(pr.title, pr.address, ml.title)            as subject,
      m.reaction_motif                                    as motif,
      m.response_at                                       as occurred_at,
      false                                               as late,
      m.id                                                as ref_id
    from public.matches m
      join public.contacts c on c.id = m.contact_id
      left join public.properties pr on pr.id = m.property_id
      left join public.market_listings ml on ml.id = m.market_listing_id
    where m.agency_id = v_agency
      and m.status in ('interested', 'rejected')
      and m.response_at is not null
      and m.response_at > v_since
  ),
  due_reminders as (
    -- Rappels échus et TOUJOURS à traiter. Un rappel fait, annulé ou reporté
    -- n'est pas un signal.
    --
    -- ⚠ VOLONTAIREMENT NON BORNÉ PAR `v_since`, contrairement aux réactions.
    -- Mesuré le 03.08.2026 : les 9 rappels échus de la base datent d'avril à
    -- juillet, donc TOUS antérieurs à n'importe quelle fenêtre d'absence
    -- raisonnable. Les borner afficherait « Tu es à jour » à un agent qui a
    -- trois mois de retard — un mensonge poli. Un rappel échu n'est pas un
    -- événement survenu pendant l'absence : c'est quelque chose qui ATTEND, et
    -- qui attend d'autant plus qu'il est vieux. La maquette dit la même chose :
    -- son propre exemple de rappel est en retard (« prévue hier », en rouge).
    --
    -- Conséquence voulue : « Tu es à jour » devient une affirmation FORTE — ni
    -- retour acheteur nouveau, ni rappel en souffrance.
    select
      'reminder:' || r.id::text                           as id,
      'reminder'                                          as kind,
      r.contact_id                                        as contact_id,
      c.first_name                                        as first_name,
      c.last_name                                         as last_name,
      coalesce(pr.title, pr.address)                      as subject,
      null::text                                          as motif,
      r.trigger_at                                        as occurred_at,
      true                                                as late,
      r.id                                                as ref_id
    from public.reminders r
      left join public.contacts c on c.id = r.contact_id
      left join public.properties pr on pr.id = r.property_id
    where r.agency_id = v_agency
      and r.status in ('pending', 'triggered')
      and r.trigger_at is not null
      and r.trigger_at <= now()
  ),
  unioned as (
    select * from reactions
    union all
    select * from due_reminders
  )
  select coalesce(jsonb_agg(to_jsonb(s) order by s.occurred_at desc), '[]'::jsonb)
    into v_signals
  from (select * from unioned order by occurred_at desc limit 50) s;

  return jsonb_build_object('since', v_since, 'signals', v_signals);
end;
$function$;

revoke all on function public.today_absence(integer) from public, anon;
grant execute on function public.today_absence(integer) to authenticated, service_role;
