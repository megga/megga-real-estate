-- Matching · lot D2 (24.09.2026) — le copilote WhatsApp : le point du matin, `get_matches`, `get_buyers_for_property`,
-- `record_match_outcome`, `schedule_visit` → `visit_planned`.
-- Conception : docs/superpowers/specs/2026-09-24-matching-lot-d2-whatsapp-design.md (§3, §4, §5.2, §5.3, §5.4, §6).
--
-- 1. `matching_actions_agence(p_agency, p_limite)` — le corps de `matching_actions_du_jour` (lot D1), l'agence en
--    paramètre : le point du matin et les copilotes lisent par le rôle de service, où `get_user_agency_id()` est nul.
--    `matching_actions_du_jour` en devient l'enveloppe : UNE définition des quatre sortes d'actions.
-- 2. `wa_matching_consigner` — les quatre réponses de `record_match_outcome`, aux règles des gestes du fil.
-- 3. `wa_matching_visite` et `wa_matching_visite_annuler` — la visite de `schedule_visit`, et son « /annuler ».
-- 4. `calendar_events_journaliser` — REDÉFINIE, pas neuve : sous le rôle de service, `auth.uid()` est nul, et le
--    chemin ANNONCE de `wa_matching_visite` (1 818 matchs sur 1 828 au 24.09.2026) posait donc un `calendar_events`
--    journalisé `system`, jamais MEGGA AI.
-- 5. `wa_matching_biens_designes(p_agency, p_mots, p_limite)` — la désignation d'un bien par un texte lit l'agence
--    ENTIÈRE, jamais un échantillon : PostgREST plafonne à 1 000 lignes (`supabase/config.toml:18`), et une agence
--    portait déjà 1 754 matchs le 21.09.2026. Elle rend les mandats de l'agence ET les annonces qu'un match
--    compatible y suit, ENSEMBLE — jamais l'un puis l'autre à défaut, ce qui laisserait un mandat masquer SEUL une
--    annonce qui répond aussi (conception §3, principe 5 : le copilote ne devine pas).
--
-- ⛔ MEGGA AI signe ce qu'il écrit : 2 et 3 posent `app.actor_kind = 'ai'` (et `via`, `profile_id`) pour la
-- transaction, comme `wa_move_transaction_stage` ; les déclencheurs de la boucle (réponse datée, journal et motif,
-- clôture de la relance, étape du deal, événement d'agenda) l'attribuent alors à MEGGA AI. Le point 4 ne POSE rien :
-- il LIT ce même réglage, posé par 3 dans la même transaction. Une écriture directe par PostgREST serait journalisée
-- `system` : chaque requête est sa propre transaction, un réglage posé par l'une ne survit pas à l'autre.
-- ⛔ Rien ne part vers l'acheteur : une visite du copilote naît avec `reminder_sent = true`, comme celle du fil.
-- ⚠ Même signature et même type de retour pour `matching_actions_du_jour` et pour `calendar_events_journaliser` :
-- leurs CREATE OR REPLACE se rejouent sans erreur (date-guard). Cinq noms neufs : `matching_actions_agence`
-- (`security invoker`, ouverte à `authenticated` et `service_role`), `wa_matching_biens_designes` (`security
-- invoker` aussi — une LECTURE — mais réservée au SEUL `service_role`, §5 ci-dessous explique pourquoi) et trois
-- fonctions d'écriture, `security definer`, réservées au rôle de service — plus la redéfinition de
-- `calendar_events_journaliser` (20260915080300).
-- Pas besoin de recréer son déclencheur : il désigne la fonction par OID, que CREATE OR REPLACE conserve.
-- ⚠ Au redatage du jour de la fusion, garder un suffixe POSTÉRIEUR à `…190000_matching_surfaces` : cette migration
-- réécrit sa fonction, et lit les colonnes du lot B (`prix_propose`, `match_ids`, `sent_via = 'agent'`).

-- ── 1. Les actions du jour d'UNE agence ─────────────────────────────────────
-- Le corps de `matching_actions_du_jour` (migration …_matching_surfaces.sql, lot D1), À L'IDENTIQUE, l'agence en
-- paramètre : `tests/unit/matching-whatsapp-sql.spec.ts` confronte les deux textes. `security invoker` : sous un
-- jeton utilisateur, la RLS de `matches`, `reminders` et `properties` borne la lecture à SON agence, quelle que soit
-- celle qu'il passe ; le rôle de service (point du matin, copilotes) la choisit.
-- Sous le rôle de service, la RLS ne borne plus rien : le corps s'ancre sur `p_agency`, mais trois jointures ne
-- tiennent que par la cohérence des références, jamais par une politique — `reminders.match_ids` (un `uuid[]` sans
-- clé étrangère), `matches.property_id` et `contacts` : une référence vers une autre agence, posée dans les lignes
-- de l'agence passée, y ferait entrer les données de l'autre (sous jeton, la RLS la masquait). C'est improbable, il
-- faut en connaître les UUID, et passer la bonne agence n'y change rien : un ancrage des trois jointures (dans D1 et
-- D2 ensemble), ou un garde d'intégrité sur ces références, le fermerait.
create or replace function public.matching_actions_agence(p_agency uuid, p_limite integer default 5)
returns table (
  genre text,
  contact_id uuid,
  prenom text,
  nom text,
  match_id uuid,
  property_id uuid,
  market_listing_id uuid,
  statut text,
  titre text,
  ville text,
  nombre integer,
  nouveaux integer,
  baisses integer,
  montant numeric,
  location boolean,
  quand timestamptz,
  total integer
)
language sql
stable
security invoker
set search_path to 'public', 'pg_temp'
as $$
  with agence as (
    select p_agency as id
  ),
  -- 1. Un retour dû : une relance de proposition échue dont au moins un bien attend encore sa réponse. Une ligne par
  --    acheteur, comme « En attente » dans le fil ; son échéance est la plus ancienne de ses relances échues.
  relances_dues as (
    select r.contact_id, r.trigger_at, coalesce(r.match_ids, array[r.match_id]) as ids
      from public.reminders r
      join agence a on r.agency_id = a.id
     where r.type = 'follow_up_sent_property'
       and r.status in ('pending', 'triggered', 'snoozed')
       and r.trigger_at is not null
       and r.trigger_at <= now()
       and r.contact_id is not null
  ),
  retours as (
    select 'retour'::text as genre, 1 as rang, d.contact_id,
           null::uuid as match_id, null::uuid as property_id, null::uuid as market_listing_id, null::text as statut,
           null::text as titre, null::text as ville,
           count(distinct m.id)::integer as nombre, null::integer as nouveaux, null::integer as baisses,
           null::numeric as montant, null::boolean as location, min(d.trigger_at) as quand
      from relances_dues d
      join public.matches m on m.id = any (d.ids) and m.status = 'sent'
     group by d.contact_id
  ),
  -- 2. Un prix passé sous le prix de proposition (`prix_propose`) : sur un bien proposé sans réponse, ou refusé pour le
  --    prix et revenu à proposer — le signal du lot B (`signalPrix`). Un prix nul (« prix sur demande ») n'est pas une
  --    baisse ; un match reporté attend son heure ; une annonce retirée n'est plus une occasion.
  prix as (
    select 'prix'::text, 2, m.contact_id, m.id, m.property_id, m.market_listing_id, m.status,
           coalesce(nullif(p.title, ''), nullif(ml.title, ''), p.address, ml.address),
           coalesce(p.city, ml.city),
           null::integer, null::integer, null::integer,
           m.prix_propose - x.prix,
           coalesce(p.transaction_type, ml.transaction_type) = 'rent',
           m.sent_at
      from public.matches m
      join agence a on m.agency_id = a.id
      left join public.properties p on p.id = m.property_id
      left join public.market_listings ml on ml.id = m.market_listing_id
      cross join lateral (
        select case when m.property_id is not null then p.price else coalesce(ml.current_price, ml.price) end as prix
      ) x
     where m.prix_propose is not null
       and x.prix > 0
       and x.prix < m.prix_propose
       and (m.status = 'sent'
         or (m.status = 'suggested' and m.reaction_motif = 'prix'
             and (m.snoozed_until is null or m.snoozed_until <= now())))
       and ml.status is distinct from 'removed'
       -- Un mandat vendu, retiré ou supprimé n'est plus une occasion : la règle de l'annonce retirée et de `mandats`.
       and (m.property_id is null or (p.status = 'active' and p.deleted_at is null))
  ),
  -- 3. Un nouveau mandat : signé ou mis en service il y a 7 jours au plus — la plus récente des deux dates, la règle de
  --    `signalBien` —, actif, avec au moins un acquéreur compatible. Un mandat vendu, retiré ou supprimé n'est plus une
  --    occasion.
  mandats as (
    select 'mandat'::text, 3, null::uuid, null::uuid, p.id, null::uuid, null::text,
           coalesce(nullif(p.title, ''), p.address), p.city,
           count(distinct m.contact_id)::integer, null::integer, null::integer, null::numeric,
           p.transaction_type = 'rent',
           greatest(p.mandate_signed_at, p.published_at)
      from public.properties p
      join agence a on p.agency_id = a.id
      join public.matches m on m.property_id = p.id and m.agency_id = a.id
       and m.status in ('suggested', 'sent', 'interested', 'visit_planned')
     where p.status = 'active'
       and p.deleted_at is null
       and greatest(p.mandate_signed_at, p.published_at) > now() - interval '7 days'
       and greatest(p.mandate_signed_at, p.published_at) <= now()
     group by p.id
  ),
  -- 4. Le marché : par acheteur, ses annonces nouvelles (3 jours) ou en baisse (14 jours) — les seuils de
  --    `matching_fil_marche_resume`. Une annonce en baisse ne compte pas aussi comme nouvelle. ⚠ Sans les biens déjà
  --    proposés à l'acheteur (`prix_propose` posé) : leur baisse est l'action 2, un bien ne s'annonce pas deux fois.
  signaux as (
    select m.contact_id, ml.id as annonce, coalesce(nullif(ml.title, ''), ml.address) as titre, ml.city,
           ml.transaction_type,
           coalesce(ml.price_reduced_at > now() - interval '14 days'
             and ml.price_reduced_at <= now()
             and ml.price_at_first_seen > coalesce(ml.current_price, ml.price)
             and coalesce(ml.current_price, ml.price) > 0, false) as en_baisse,
           coalesce(ml.first_seen_at > now() - interval '3 days'
             and ml.first_seen_at <= now(), false) as nouveau,
           ml.price_reduced_at, ml.first_seen_at
      from public.matches m
      join agence a on m.agency_id = a.id
      join public.market_listings ml on ml.id = m.market_listing_id
     where m.status = 'suggested'
       and m.market_listing_id is not null
       and m.prix_propose is null
       and (m.snoozed_until is null or m.snoozed_until <= now())
       and ml.status is distinct from 'removed'
  ),
  -- UNE annonce est nommée ; au-delà, on compte, pour qu'un acheteur tienne en une ligne.
  marche as (
    select 'marche'::text, 4, s.contact_id, null::uuid, null::uuid,
           case when count(*) = 1 then (array_agg(s.annonce))[1] end,
           null::text,
           case when count(*) = 1 then (array_agg(s.titre))[1] end,
           case when count(*) = 1 then (array_agg(s.city))[1] end,
           count(*)::integer,
           (count(*) filter (where s.nouveau and not s.en_baisse))::integer,
           (count(*) filter (where s.en_baisse))::integer,
           null::numeric,
           bool_or(s.transaction_type = 'rent'),
           max(case when s.en_baisse then s.price_reduced_at else s.first_seen_at end)
      from signaux s
     where s.en_baisse or s.nouveau
     group by s.contact_id
  ),
  actions as (
    select * from retours
    union all select * from prix
    union all select * from mandats
    union all select * from marche
  )
  -- L'ordre dit l'urgence : un retour dû ferme la boucle, une baisse sur un bien déjà montré est l'argument le plus fort,
  -- un nouveau mandat est une occasion, le marché un flux. Dans une sorte : la plus ancienne échéance, la plus forte
  -- baisse, le plus récent.
  select x.genre, x.contact_id, c.first_name, c.last_name, x.match_id, x.property_id, x.market_listing_id, x.statut,
         x.titre, x.ville, x.nombre, x.nouveaux, x.baisses, x.montant, x.location, x.quand,
         (count(*) over ())::integer
    from actions x
    left join public.contacts c on c.id = x.contact_id
   order by x.rang,
            case when x.rang = 1 then x.quand end asc nulls last,
            case when x.rang = 2 then x.montant end desc nulls last,
            case when x.rang in (3, 4) then x.quand end desc nulls last,
            x.contact_id nulls last, x.property_id nulls last, x.match_id nulls last
   limit least(greatest(coalesce(p_limite, 5), 1), 20);
$$;

comment on function public.matching_actions_agence(uuid, integer) is
  'Lot D2 : les actions du jour (lot D1), l''agence en paramètre — retours dus, baisses sous le prix de proposition, nouveaux mandats (7 j) avec acquéreurs compatibles, marché (nouveau 3 j, baisse 14 j, jamais proposé) ; classées, p_limite au plus (5 par défaut, 20 au plus), total avant la coupe. Le point du matin WhatsApp et les copilotes lisent par le rôle de service, où get_user_agency_id() est nul ; sous un jeton utilisateur, la RLS borne la lecture à son agence.';

revoke all on function public.matching_actions_agence(uuid, integer) from public, anon;
grant execute on function public.matching_actions_agence(uuid, integer) to authenticated, service_role;

-- `matching_actions_du_jour` devient l'enveloppe : UNE définition des quatre sortes d'actions. Même signature, même
-- type de retour : son CREATE OR REPLACE se rejoue sans erreur.
create or replace function public.matching_actions_du_jour(p_limite integer default 5)
returns table (
  genre text,
  contact_id uuid,
  prenom text,
  nom text,
  match_id uuid,
  property_id uuid,
  market_listing_id uuid,
  statut text,
  titre text,
  ville text,
  nombre integer,
  nouveaux integer,
  baisses integer,
  montant numeric,
  location boolean,
  quand timestamptz,
  total integer
)
language sql
stable
security invoker
set search_path to 'public', 'pg_temp'
as $$
  select * from public.matching_actions_agence(public.get_user_agency_id(), p_limite);
$$;

comment on function public.matching_actions_du_jour(integer) is
  'Lot D1 : le segment Matching d''Aujourd''hui — l''enveloppe de matching_actions_agence (lot D2) sur l''agence de l''appelant.';

revoke all on function public.matching_actions_du_jour(integer) from public, anon;
grant execute on function public.matching_actions_du_jour(integer) to authenticated;

-- ── 2. Consigner une réponse (`record_match_outcome`, question Oui / Non) ────
-- Les règles des gestes du fil (`useAtelierMatching` : execProposer, execRepondre, execPasEncore), À L'IDENTIQUE,
-- chacune d'un bloc. Le statut de départ est une garde : si un collègue a consigné entre-temps, rien n'est réécrit et
-- la réponse le dit (`deja`), avec le `statut` trouvé — absent d'un succès, que l'appelant lit par `ok`/`deja` seuls.
-- Rendu : { ok, deja, statut?, deal_id, relance_id } ; `ok = false` quand le match, son acheteur, son bien
-- (property_id) ou le profil ne sont pas de l'agence passée.
create or replace function public.wa_matching_consigner(
  p_agency uuid,
  p_profile uuid,
  p_match uuid,
  p_reponse text,
  p_motif text default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_match public.matches%rowtype;
  v_nom text;
  v_titre text;
  v_ref text;
  v_deal uuid;
  v_relance uuid;
  v_lignes integer;
begin
  if p_reponse is null or p_reponse not in ('propose', 'interesse', 'pas_interesse', 'pas_encore') then
    raise exception 'wa_matching_consigner : réponse inconnue (%)', p_reponse using errcode = '22023';
  end if;
  if p_reponse = 'pas_interesse' and (p_motif is null or p_motif not in
      ('prix', 'quartier', 'surface', 'pieces', 'type', 'equipements', 'etat', 'autre')) then
    raise exception 'wa_matching_consigner : un refus porte un motif (%)', p_motif using errcode = '22023';
  end if;

  -- MEGGA AI signe : les déclencheurs de la boucle lisent ces réglages de transaction.
  perform set_config('app.actor_kind', 'ai', true);
  perform set_config('app.actor_via', 'whatsapp', true);
  if p_profile is not null then
    perform set_config('app.actor_profile_id', p_profile::text, true);
  end if;

  select * into v_match from public.matches m where m.id = p_match and m.agency_id = p_agency for update;
  if not found then
    return jsonb_build_object('ok', false);
  end if;
  -- Le nom brut, comme le fil (`${buyer.first} ${buyer.last}`, sans repli) : ce qu'il fait quand le contact
  -- n'a pas de nom, c'est justement rien — la phrase de relance le reproduit à l'identique.
  -- SANS verrou de ligne : `for update` ici ouvrait DEUX cycles d'interblocage (établis à la lecture des
  -- déclencheurs et des modes de verrou, non reproduits sur une base) —
  -- (a) avec l'insertion d'une relance par le fil, qui vérifie ses clés étrangères contact PUIS match en
  -- FOR KEY SHARE pendant que cette fonction tient le match et attend le contact ; (b) avec un changement
  -- d'étape du deal, où capture_transaction_lifecycle → bump_contact_last_interaction mettent à jour le
  -- contact pendant que cette fonction tient le contact et attend le deal.
  select c.first_name || ' ' || c.last_name into v_nom
    from public.contacts c
   where c.id = v_match.contact_id and c.agency_id = p_agency;
  if not found then
    return jsonb_build_object('ok', false);
  end if;
  -- Sérialise les appels de CETTE fonction pour UN acheteur (deux « proposé » simultanés sur deux matchs
  -- différents ne créent plus chacun leur propre deal) par un verrou CONSULTATIF plutôt qu'un verrou de ligne :
  -- un verrou consultatif vit dans un espace séparé de celui des lignes, donc ne peut entrer en conflit ni
  -- avec les verrous de clé étrangère (a), ni avec ceux que pose le déclencheur de l'étape du deal (b) — aucun
  -- cycle possible avec l'un ou l'autre. Clé NEUTRE (`wa_matching_acheteur:`, pas le nom de cette fonction) :
  -- `wa_matching_visite`, plus bas, prend le MÊME verrou avec la MÊME clé. ⛔ Un ordre unique partout : le
  -- match, PUIS ce verrou, PUIS la relance ou le deal — le prendre avant le match ouvrirait un cycle entre deux
  -- fonctions qui tiennent chacune ce que l'autre attend. ⚠ Le fil (`rattacherDeal`) ne le
  -- prend PAS : la course à deux deals reste ouverte entre le fil et WhatsApp, seulement fermée entre deux
  -- appels de CETTE fonction.
  perform pg_advisory_xact_lock(hashtextextended('wa_matching_acheteur:' || v_match.contact_id::text, 0));
  -- `matches_insert` (RLS) ne vérifie que agency_id : un match peut pointer le mandat d'une AUTRE agence.
  if v_match.property_id is not null and not exists (
    select 1 from public.properties p where p.id = v_match.property_id and p.agency_id = p_agency
  ) then
    return jsonb_build_object('ok', false);
  end if;
  -- Le profil doit être un profil de CETTE agence, avant toute écriture.
  if p_profile is not null and not exists (
    select 1 from public.profiles pr where pr.id = p_profile and pr.agency_id = p_agency
  ) then
    return jsonb_build_object('ok', false);
  end if;
  v_titre := coalesce(
    (select coalesce(nullif(p.title, ''), p.address) from public.properties p
      where p.id = v_match.property_id and p.agency_id = p_agency),
    (select coalesce(nullif(ml.title, ''), ml.address, ml.city) from public.market_listings ml
      where ml.id = v_match.market_listing_id),
    'bien');
  -- La référence du fil (`refBienInterne` / `refAnnonceMarche`, useAtelierMatching.ts) : la phrase de relance
  -- désigne le bien par sa référence, jamais par son titre — le journal (object_label), lui, garde le titre.
  v_ref := coalesce(
    (select 'MG-IN-' || upper(left(p.id::text, 6)) from public.properties p
      where p.id = v_match.property_id and p.agency_id = p_agency),
    (select 'MG-' || case when ml.source_portal = 'flatfox' then 'FL' else 'MK' end || '-' ||
        coalesce(ml.source_id, left(ml.id::text, 6))
       from public.market_listings ml where ml.id = v_match.market_listing_id),
    'bien');

  if p_reponse = 'propose' then
    -- « Je l'ai proposé » : `set_match_prix_propose` pose le prix du moment et efface la réponse d'avant.
    update public.matches set status = 'sent', sent_via = 'agent', sent_at = now()
     where id = p_match and status = 'suggested';
    get diagnostics v_lignes = row_count;
    if v_lignes = 0 then
      return jsonb_build_object('ok', true, 'deja', true, 'statut', v_match.status);
    end if;
    -- Le deal : l'actif le plus récent de l'acheteur (un mandat y est rattaché s'il n'en porte aucun, jamais
    -- écrasé), sinon un `new_lead` sur ce bien — `rattacherDeal` du fil.
    select t.id into v_deal from public.transactions t
     where t.agency_id = p_agency and t.contact_buyer_id = v_match.contact_id and t.status = 'active'
     order by t.created_at desc
     limit 1;
    if v_deal is null then
      insert into public.transactions (agency_id, contact_buyer_id, assigned_to, stage, status, property_id, market_listing_id)
      values (p_agency, v_match.contact_id, p_profile, 'new_lead', 'active', v_match.property_id,
              case when v_match.property_id is null then v_match.market_listing_id end)
      returning id into v_deal;
    elsif v_match.property_id is not null then
      update public.transactions set property_id = v_match.property_id where id = v_deal and property_id is null;
    end if;
    -- UNE relance interne à +3 jours (canal `task`) : l'agent consignera la réponse — `poserRelance` du fil.
    insert into public.reminders (agency_id, contact_id, property_id, transaction_id, match_id, type, trigger_rule,
                                  trigger_days, trigger_at, status, channel, message_template)
    values (p_agency, v_match.contact_id, v_match.property_id, v_deal, p_match, 'follow_up_sent_property', 'manual',
            3, now() + interval '3 days', 'pending', 'task',
            'Retour de ' || v_nom || ' sur ' || v_ref)
    returning id into v_relance;
    insert into public.activity_events (agency_id, actor_id, actor_kind, action, entity_type, entity_id, object_label,
                                        category, severity, metadata)
    values (p_agency, null, 'ai', 'match_propose', 'contact', v_match.contact_id,
            left(coalesce(nullif(btrim(v_nom), ''), '—') || ' · ' || v_titre, 500), 'deal', 'info',
            jsonb_build_object('match_ids', jsonb_build_array(p_match), 'deal_id', v_deal, 'bien_refs',
                               jsonb_build_array(v_ref), 'nombre', 1, 'score', v_match.score, 'via', 'whatsapp',
                               'profile_id', p_profile));
    return jsonb_build_object('ok', true, 'deja', false, 'deal_id', v_deal, 'relance_id', v_relance);
  end if;

  if p_reponse = 'pas_encore' then
    -- « Pas encore » : rien sur le match ; la relance qui COUVRE ce bien (`match_ids`, ou `match_id` pour une
    -- proposition d'un seul bien) est repoussée de trois jours, sinon posée — `execPasEncore` du fil.
    if v_match.status <> 'sent' then
      return jsonb_build_object('ok', true, 'deja', true, 'statut', v_match.status);
    end if;
    select r.id into v_relance from public.reminders r
     where r.agency_id = p_agency and r.contact_id = v_match.contact_id and r.type = 'follow_up_sent_property'
       and r.status in ('pending', 'triggered', 'snoozed')
       and p_match = any (coalesce(r.match_ids, array[r.match_id]))
     order by r.created_at desc
     limit 1
     for update;
    if v_relance is not null then
      update public.reminders set trigger_at = now() + interval '3 days', status = 'pending' where id = v_relance;
    else
      insert into public.reminders (agency_id, contact_id, property_id, match_id, type, trigger_rule, trigger_days,
                                    trigger_at, status, channel, message_template)
      values (p_agency, v_match.contact_id, v_match.property_id, p_match, 'follow_up_sent_property', 'manual', 3,
              now() + interval '3 days', 'pending', 'task',
              'Retour : ' || v_nom || ' sur ' || v_ref)
      returning id into v_relance;
    end if;
    insert into public.activity_events (agency_id, actor_id, actor_kind, action, entity_type, entity_id, object_label,
                                        category, severity, metadata)
    values (p_agency, null, 'ai', 'match_pas_encore', 'contact', v_match.contact_id,
            left(coalesce(nullif(btrim(v_nom), ''), '—') || ' · ' || v_titre, 500), 'deal', 'info',
            jsonb_build_object('match_id', p_match, 'bien_ref', v_ref, 'relance_id', v_relance, 'via', 'whatsapp',
                               'profile_id', p_profile));
    return jsonb_build_object('ok', true, 'deja', false, 'relance_id', v_relance);
  end if;

  -- « Intéressé » répond à un bien PROPOSÉ ; « Pas intéressé » aussi, ou revient sur un intérêt. Les déclencheurs
  -- datent la réponse, la journalisent (motif compris) et closent la relance quand plus aucun bien n'attend.
  if p_reponse = 'interesse' then
    update public.matches
       set status = 'interested', reaction_motif = null, reaction_note = null, apprentissage_at = null
     where id = p_match and status = 'sent';
  else
    update public.matches
       set status = 'rejected', reaction_motif = p_motif,
           -- `E' \t\r\n'` comme `.trim()` du fil : `btrim()` seul n'ôte que l'espace, jamais tabulation ni saut de ligne.
           reaction_note = nullif(btrim(p_note, E' \t\r\n'), ''), apprentissage_at = null
     where id = p_match and status in ('sent', 'interested');
  end if;
  get diagnostics v_lignes = row_count;
  if v_lignes = 0 then
    return jsonb_build_object('ok', true, 'deja', true, 'statut', v_match.status);
  end if;
  return jsonb_build_object('ok', true, 'deja', false);
end;
$$;

comment on function public.wa_matching_consigner(uuid, uuid, uuid, text, text, text) is
  'Lot D2 : la réponse d''un acheteur consignée par le copilote WhatsApp (après le « oui » de l''agent) — proposé, intéressé, pas intéressé + motif, pas encore — aux règles des gestes du fil, attribuée à MEGGA AI (app.actor_kind). N''écrit jamais à l''acheteur.';

revoke all on function public.wa_matching_consigner(uuid, uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.wa_matching_consigner(uuid, uuid, uuid, text, text, text) to service_role;

-- ── 3. La visite de `schedule_visit`, et son « /annuler » ───────────────────
-- La règle de « Planifier une visite » (`execPlanifierVisite` du fil) : si l'acheteur est INTÉRESSÉ par ce bien, son
-- match passe `visit_planned` et son deal (l'actif, sinon un `new_lead`) avance à `visit_planned` s'il était avant,
-- jamais en arrière. Un mandat reçoit une ligne `visits` ; une annonce du marché, que l'agence ne détient pas
-- (`visits.property_id` n'accepte qu'un mandat), un événement `visite` de l'agenda, qui se journalise lui-même.
-- ⛔ `reminder_sent = true` : `visit-reminders-j1` écrit au client la veille de toute visite `planned` dont le rappel
-- n'est pas parti ; le copilote promet de ne RIEN lui envoyer.
-- Rendu, pour « /annuler » (`wa_matching_visite_annuler`) : `match_id` SEULEMENT si CET appel l'a fait bouger
-- (`v_statut = 'interested'`) — jamais sur un match qu'il n'a fait que lire ; `statut_match`, lui, reste toujours
-- rendu, pour dire où en est l'acheteur. Le deal n'est jamais supprimé, créé ici ou déjà là : seule l'étape
-- avancée par cet appel est défaite, vers `etape_avant` (`new_lead` pour un deal créé ici).
create or replace function public.wa_matching_visite(
  p_agency uuid,
  p_profile uuid,
  p_contact uuid,
  p_property uuid,
  p_market_listing uuid,
  p_debut timestamptz,
  p_duree integer default 45,
  p_type text default 'sur_place'
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_nom text;
  v_titre text;
  v_lieu text;
  v_match uuid;
  v_statut text;
  v_deal uuid;
  v_etape text;
  v_etape_avant text;
  v_visite uuid;
  v_evenement uuid;
  v_duree integer := least(greatest(coalesce(p_duree, 45), 5), 480);
begin
  if (p_property is null) = (p_market_listing is null) then
    raise exception 'wa_matching_visite : un bien, et un seul (un mandat OU une annonce)' using errcode = '22023';
  end if;
  if p_debut is null then
    raise exception 'wa_matching_visite : la date est requise' using errcode = '22023';
  end if;

  perform set_config('app.actor_kind', 'ai', true);
  perform set_config('app.actor_via', 'whatsapp', true);
  if p_profile is not null then
    perform set_config('app.actor_profile_id', p_profile::text, true);
  end if;

  select nullif(btrim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')), '') into v_nom
    from public.contacts c
   where c.id = p_contact and c.agency_id = p_agency;
  if not found then
    return jsonb_build_object('ok', false, 'raison', 'contact');
  end if;
  if p_property is not null then
    select coalesce(nullif(p.title, ''), p.address, 'bien'), p.address into v_titre, v_lieu
      from public.properties p
     where p.id = p_property and p.agency_id = p_agency and p.deleted_at is null;
  else
    -- Le lieu de l'événement, comme le fil (FilConclure.tsx : `[bien.adresse, bien.ville].filter(Boolean).join(', ')
    -- || null`) : adresse et ville jointes par une virgule, l'une ou l'autre omise si absente (NULL ou vide), null
    -- si les deux le sont.
    select coalesce(nullif(ml.title, ''), ml.address, ml.city, 'annonce'),
           nullif(concat_ws(', ', nullif(ml.address, ''), nullif(ml.city, '')), '')
      into v_titre, v_lieu
      from public.market_listings ml
     where ml.id = p_market_listing;
  end if;
  if not found then
    return jsonb_build_object('ok', false, 'raison', 'bien');
  end if;
  -- Le profil doit être un profil de CETTE agence, avant toute écriture (comme wa_matching_consigner).
  if p_profile is not null and not exists (
    select 1 from public.profiles pr where pr.id = p_profile and pr.agency_id = p_agency
  ) then
    return jsonb_build_object('ok', false, 'raison', 'profil');
  end if;

  -- Le match de CET acheteur sur CE bien : une paire au plus (index uniques par contact et bien).
  select m.id, m.status::text into v_match, v_statut
    from public.matches m
   where m.agency_id = p_agency and m.contact_id = p_contact
     and ((p_property is not null and m.property_id = p_property)
       or (p_market_listing is not null and m.market_listing_id = p_market_listing))
   limit 1
   for update;

  -- Même clé que wa_matching_consigner (`wa_matching_acheteur:`) : un ordre unique partout, le match PUIS ce
  -- verrou PUIS le deal — le prendre avant le match ouvrirait un cycle avec wa_matching_consigner, qui tient
  -- son match et attend ce verrou. Sert ici à ce que deux appels pour le même acheteur ne créent pas chacun
  -- leur propre deal new_lead.
  perform pg_advisory_xact_lock(hashtextextended('wa_matching_acheteur:' || p_contact::text, 0));

  if v_statut = 'interested' then
    update public.matches set status = 'visit_planned' where id = v_match and status = 'interested';
    select t.id, t.stage::text into v_deal, v_etape
      from public.transactions t
     where t.agency_id = p_agency and t.contact_buyer_id = p_contact and t.status = 'active'
     order by t.created_at desc
     limit 1
     for update;
    if v_deal is null then
      insert into public.transactions (agency_id, contact_buyer_id, assigned_to, stage, status, property_id, market_listing_id)
      values (p_agency, p_contact, p_profile, 'new_lead', 'active', p_property, p_market_listing)
      returning id into v_deal;
      v_etape := 'new_lead';
    elsif p_property is not null then
      update public.transactions set property_id = p_property where id = v_deal and property_id is null;
    end if;
  end if;

  if p_property is not null then
    insert into public.visits (agency_id, agent_id, property_id, contact_id, transaction_id, scheduled_at,
                               duration_minutes, status, visit_type, buyer_name, reminder_sent, video_platform)
    values (p_agency, p_profile, p_property, p_contact, v_deal, p_debut, v_duree, 'planned',
            case when p_type = 'video' then 'video' else 'sur_place' end, v_nom,
            true,
            case when p_type = 'video' then 'google_meet' end)
    returning id into v_visite;
    insert into public.activity_events (agency_id, actor_id, actor_kind, action, entity_type, entity_id, object_label,
                                        category, severity, metadata)
    values (p_agency, null, 'ai', 'visit_scheduled', 'contact', p_contact,
            left(coalesce(v_nom, '—') || ' · ' || v_titre, 500),
            'contact', 'info',
            jsonb_build_object('via', 'whatsapp', 'profile_id', p_profile, 'visit_id', v_visite, 'match_id', v_match,
                               'deal_id', v_deal, 'scheduled_at', p_debut, 'bien_ref',
                               'MG-IN-' || upper(left(p_property::text, 6))));
  else
    insert into public.calendar_events (agency_id, created_by, type, title, starts_at, ends_at, contact_id, location)
    values (p_agency, p_profile, 'visite', left('Visite · ' || v_titre, 200), p_debut,
            p_debut + make_interval(mins => v_duree), p_contact, v_lieu)
    returning id into v_evenement;
  end if;

  if v_deal is not null and v_etape in ('new_lead', 'to_qualify', 'active_search', 'to_recontact') then
    update public.transactions set stage = 'visit_planned' where id = v_deal;
    v_etape_avant := v_etape;
  end if;

  return jsonb_build_object(
    'ok', true,
    'genre', case when p_property is not null then 'mandat' else 'annonce' end,
    'titre', v_titre,
    'visite_id', v_visite,
    'evenement_id', v_evenement,
    'match_id', case when v_statut = 'interested' then v_match end,
    'statut_match', v_statut,
    'match_avant', case when v_statut = 'interested' then 'interested' end,
    'deal_id', v_deal,
    'etape_avant', v_etape_avant);
end;
$$;

comment on function public.wa_matching_visite(uuid, uuid, uuid, uuid, uuid, timestamptz, integer, text) is
  'Lot D2 : la visite planifiée par le copilote WhatsApp — visits (mandat, sans rappel J-1 au client) ou événement d''agenda (annonce) ; un acheteur intéressé passe visit_planned et son deal avance. Attribuée à MEGGA AI.';

revoke all on function public.wa_matching_visite(uuid, uuid, uuid, uuid, uuid, timestamptz, integer, text) from public, anon, authenticated;
grant execute on function public.wa_matching_visite(uuid, uuid, uuid, uuid, uuid, timestamptz, integer, text) to service_role;

-- « /annuler » d'une visite du copilote : rend ce que `wa_matching_visite` a écrit, d'un bloc. Accepte aussi l'ancien
-- `visit_id` (payload d'avant le lot D2, dans sa fenêtre de 30 s). `ok = false` : rien n'a été défait.
create or replace function public.wa_matching_visite_annuler(p_agency uuid, p_profile uuid, p_retour jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_visite uuid := nullif(coalesce(p_retour ->> 'visite_id', p_retour ->> 'visit_id'), '')::uuid;
  v_evenement uuid := nullif(p_retour ->> 'evenement_id', '')::uuid;
  v_match uuid := nullif(p_retour ->> 'match_id', '')::uuid;
  v_deal uuid := nullif(p_retour ->> 'deal_id', '')::uuid;
  v_etape text := nullif(p_retour ->> 'etape_avant', '');
  v_lignes integer := 0;
begin
  perform set_config('app.actor_kind', 'ai', true);
  perform set_config('app.actor_via', 'whatsapp', true);
  if p_profile is not null then
    perform set_config('app.actor_profile_id', p_profile::text, true);
  end if;
  -- Le profil doit être un profil de CETTE agence, avant toute écriture (comme ses deux sœurs).
  if p_profile is not null and not exists (
    select 1 from public.profiles pr where pr.id = p_profile and pr.agency_id = p_agency
  ) then
    return jsonb_build_object('ok', false);
  end if;

  if v_visite is not null then
    delete from public.visits where id = v_visite and agency_id = p_agency;
    get diagnostics v_lignes = row_count;
  elsif v_evenement is not null then
    delete from public.calendar_events where id = v_evenement and agency_id = p_agency;
    get diagnostics v_lignes = row_count;
  end if;
  if v_lignes = 0 then
    return jsonb_build_object('ok', false);
  end if;
  -- Seulement ce que la visite avait posé, et seulement s'il n'a pas bougé depuis.
  if v_match is not null then
    update public.matches set status = 'interested'
     where id = v_match and agency_id = p_agency and status = 'visit_planned';
  end if;
  if v_deal is not null and v_etape is not null then
    update public.transactions set stage = v_etape::public.transaction_stage
     where id = v_deal and agency_id = p_agency and stage = 'visit_planned';
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

comment on function public.wa_matching_visite_annuler(uuid, uuid, jsonb) is
  'Lot D2 : « /annuler » d''une visite du copilote WhatsApp — la visite ou l''événement, le match revenu à interested, le deal à son étape d''avant ; attribué à MEGGA AI.';

revoke all on function public.wa_matching_visite_annuler(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.wa_matching_visite_annuler(uuid, uuid, jsonb) to service_role;

-- `calendar_events_journaliser` (REDÉFINIE, pas neuve) : le chemin ANNONCE de `wa_matching_visite` ci-dessus pose un
-- `calendar_events` sous le RÔLE DE SERVICE, où `auth.uid()` est nul.
-- La fonction du 15.09 (20260915080300_calendar_events.sql) ne lisait que `auth.uid()` : ce chemin — majoritaire,
-- 1 818 matchs de marché sur 1 828 — journalisait donc `system`, jamais MEGGA AI.
-- Corps du 15.09 À L'IDENTIQUE (garde, calcul des colonnes changées, forme de l'insertion), SAUF la détermination
-- de l'acteur, qui reprend EXACTEMENT celle de `log_match_reaction` (20260921140000_matching_boucle.sql) : les
-- trois réglages de transaction d'abord (`ai`/`system`/`user` explicite), sinon `system` sans jeton, sinon `user` ;
-- `actor_id` posé pour `user` seul ; `via`/`profile_id` ajoutés aux métadonnées quand ils sont posés. Le principe ne
-- bouge pas : le FAIT, jamais le contenu (D11) — cette redéfinition ne touche à rien de ce qui s'écrit, seulement à
-- QUI signe. Rien ne change pour le CRM : sous un jeton utilisateur, il ne pose jamais ces réglages, et l'acteur y
-- reste `auth.uid()` comme avant (non-régression couverte par `tests/backend/mail-rls.spec.ts`). Le déclencheur
-- `calendar_events_journal` n'est pas recréé : il désigne cette fonction par OID, que CREATE OR REPLACE conserve.
create or replace function public.calendar_events_journaliser()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_ligne public.calendar_events := case when tg_op = 'DELETE' then old else new end;
  v_changees jsonb;
  v_guc_kind text := nullif(current_setting('app.actor_kind', true), '');
  v_via text := nullif(current_setting('app.actor_via', true), '');
  v_profile text := nullif(current_setting('app.actor_profile_id', true), '');
  v_uid uuid := auth.uid();
  v_kind text;
  v_actor uuid;
  v_meta jsonb;
begin
  if v_ligne.contact_id is null and v_ligne.property_id is null then return null; end if;
  if not exists (select 1 from public.agencies a where a.id = v_ligne.agency_id) then return null; end if;
  if tg_op = 'UPDATE' then
    -- Le libellé classe, l'horodatage et l'auteur suivent : aucun n'est un geste sur l'événement.
    select coalesce(jsonb_agg(k order by k), '[]'::jsonb) into v_changees
      from jsonb_object_keys(to_jsonb(new)) as k
     where k not in ('updated_at', 'created_by', 'calendar_label_id')
       and to_jsonb(new) -> k is distinct from to_jsonb(old) -> k;
    if jsonb_array_length(v_changees) = 0 then return null; end if;
  end if;

  v_kind := case
    when v_guc_kind in ('ai', 'system', 'user') then v_guc_kind
    when v_uid is null then 'system'
    else 'user'
  end;
  v_actor := case when v_kind = 'user' then v_uid else null end;

  v_meta := jsonb_strip_nulls(jsonb_build_object(
    'event_id', v_ligne.id,
    'type', v_ligne.type,
    'starts_at', to_char(v_ligne.starts_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'changed', v_changees));
  if v_via is not null then v_meta := v_meta || jsonb_build_object('via', v_via); end if;
  if v_profile is not null then v_meta := v_meta || jsonb_build_object('profile_id', v_profile); end if;

  insert into public.activity_events
    (agency_id, actor_id, actor_kind, action, entity_type, entity_id, category, severity, object_label, metadata)
  values (
    v_ligne.agency_id, v_actor, v_kind,
    case tg_op when 'INSERT' then 'calendar_event_created' when 'UPDATE' then 'calendar_event_updated' else 'calendar_event_deleted' end,
    case when v_ligne.contact_id is not null then 'contact' else 'property' end,
    coalesce(v_ligne.contact_id, v_ligne.property_id),
    case when v_ligne.contact_id is not null then 'contact' else 'bien' end,
    'info', null,
    v_meta);
  return null;
end $$;
revoke all on function public.calendar_events_journaliser() from public, anon, authenticated;

-- ── 5. Désigner un bien par un texte, EN BASE ────────────────────────────────
-- `wa_matching_biens_designes(p_agency, p_mots, p_limite)` rend un SUR-ENSEMBLE de ce que `candidats` (pur,
-- whatsapp-matching.ts) garde ensuite en TypeScript : chaque mot de `p_mots` (déjà nettoyé par `motsDe` — sans
-- accent, sans mot vide) doit être CONTENU dans le titre, l'adresse ou la ville — SAUF un mot NUMÉRIQUE (`^[0-9]+$`),
-- qui ne se compare qu'à l'ADRESSE, comme `candidats` : un « 2 » ne doit pas prendre tous les titres qui en portent
-- un (pièces, étage…), seulement une adresse qui le porte. `candidats` affine ensuite le mot exact ou son début.
-- Rend les MANDATS non supprimés de l'agence et les ANNONCES qui ont un match COMPATIBLE dans l'agence (les statuts
-- de `STATUTS_COMPATIBLES`, whatsapp-matching.ts — recopiés ici en dur, comme le CTE `mandats` de
-- `matching_actions_agence` ci-dessus), ENSEMBLE, dans le même ordre stable (mandats d'abord, puis id) : jamais l'un
-- puis l'autre à défaut, ce qui laisserait un mandat masquer SEUL une annonce qui répond aussi (conception §3,
-- principe 5 : le copilote ne devine pas). Une lecture coupée à `p_limite` ne désigne jamais un survivant unique
-- comme LE bien pour autant : l'exécuteur (`designerBien`, whatsapp-matching-outils.ts) appelle cette fonction avec
-- `p_limite` posé à UNE LIGNE DE PLUS que ce qu'il garde, et lit par `aLaLimite` si cette ligne surnuméraire est
-- revenue — auquel cas il demande à l'agent au lieu de choisir.
--
-- `security invoker`, comme `matching_actions_agence` (une lecture, pas une écriture). Réservée au SEUL
-- `service_role` : son seul appelant est le copilote WhatsApp, qui lit toujours par ce rôle — l'ouvrir à
-- `authenticated` n'aurait aucun usage réel. Ce n'est pas une nécessité de sécurité : sous un jeton utilisateur, la
-- RLS de `properties` et de `matches` bornerait de toute façon la lecture à SON agence quel que soit `p_agency`
-- passé — exactement ce que le §1 ci-dessus dit déjà pour `matching_actions_agence`.
--
-- Chaque mot se compare en `lower(unaccent(x))`, PAS `unaccent(lower(x))` : sous un ctype `C`, `lower()` ignore les
-- lettres accentuées (`lower('É')` rend `É`, inchangé) — `unaccent` D'ABORD ramène tout à de l'ASCII simple, que
-- `lower()` sait ensuite traiter sur N'IMPORTE QUEL ctype. L'ordre inverse laisserait passer une majuscule accentuée
-- dans le texte ou dans un mot cherché. `%` et `_` sont neutralisés dans chaque mot avant la comparaison, comme
-- `search_cities` (20260707140000_matching_city_filter.sql).
--
-- Index existants sollicités (aucun nouveau nécessaire) :
--   · mandats — `idx_properties_alive_agency_status (agency_id, status, created_at desc) where deleted_at is null`
--     (00000000000000_baseline_remote_schema.sql) : son prédicat partiel (`deleted_at is null`) est EXACTEMENT
--     notre garde de suppression, et sa première colonne (`agency_id`) porte notre égalité — Postgres peut
--     l'emprunter même sans rien filtrer sur `status` ni `created_at`.
--   · annonces — DEUX index partiels couvrent, CHACUN, une partie seulement des statuts compatibles :
--     `idx_matches_agency_focus (agency_id, contact_id, score desc) where status = 'suggested'`
--     (20260616120000_today_focus.sql) et `idx_matches_boucle (agency_id, status)
--     where status in ('sent', 'interested', 'rejected', 'visit_planned')` (20260921140000_matching_boucle.sql). Un
--     `status = any (array[...])` unique ne prouve à Postgres ni l'un ni l'autre prédicat ; écrit en deux branches OR
--     (`status = 'suggested' or status in (...)`), chacune couvrant exactement le prédicat d'un des deux index (le
--     `rejected` en trop dans `idx_matches_boucle` ne coûte rien, on ne le demande simplement pas), la requête
--     DEVRAIT laisser Postgres combiner les deux par un OR d'index scans plutôt que de balayer `matches` en entier —
--     ATTENDU, mais NON vérifié ici (aucune base accessible depuis ce poste) : à confirmer par un EXPLAIN sur une
--     base locale avant d'appliquer cette migration. W4 (tests/backend/matching-whatsapp.spec.ts) contrôle les
--     RÉSULTATS de la fonction, jamais son plan. Le sous-select `distinct` qui isole les `market_listing_id` reste
--     sa propre étape du plan (son `distinct` l'empêche d'être
--     simplement repliée dans la requête qui l'entoure), ce qui ne gêne en rien l'usage des deux index ci-dessus PAR
--     CETTE ÉTAPE elle-même, avant de rejoindre `market_listings` par sa clé primaire — aucun index ne sert de toute
--     façon le filtre par mots (`like '%…%'`, tête variable).
create or replace function public.wa_matching_biens_designes(
  p_agency uuid,
  p_mots text[],
  p_limite integer default 50
)
returns table (
  genre text,
  id uuid,
  titre text,
  adresse text,
  ville text
)
language sql
stable
security invoker
set search_path to 'public', 'pg_temp'
as $$
  select genre, id, titre, adresse, ville
    from (
      select 'mandat'::text as genre, p.id, p.title as titre, p.address as adresse, p.city as ville, 0 as rang
        from public.properties p
       where p.agency_id = p_agency
         and p.deleted_at is null
         and coalesce(array_length(p_mots, 1), 0) > 0
         and not exists (
           select 1 from unnest(p_mots) as mot(w)
            where (case
                     when w ~ '^[0-9]+$' then lower(unaccent(coalesce(p.address, '')))
                     else lower(unaccent(concat_ws(' ', p.title, p.address, p.city)))
                   end)
              not like '%' || lower(unaccent(replace(replace(w, '%', ''), '_', ''))) || '%'
         )
      union all
      select 'annonce'::text, ml.id, ml.title, ml.address, ml.city, 1
        from public.market_listings ml
        join (
          -- `distinct` : plusieurs matchs compatibles peuvent viser la MÊME annonce (plusieurs acheteurs) — sans
          -- lui, `union all` la dupliquerait autant de fois qu'elle a d'acheteurs.
          select distinct m.market_listing_id
            from public.matches m
           where m.agency_id = p_agency
             and (m.status = 'suggested' or m.status in ('sent', 'interested', 'visit_planned'))
             and m.market_listing_id is not null
        ) c on c.market_listing_id = ml.id
       where coalesce(array_length(p_mots, 1), 0) > 0
         and not exists (
           select 1 from unnest(p_mots) as mot(w)
            where (case
                     when w ~ '^[0-9]+$' then lower(unaccent(coalesce(ml.address, '')))
                     else lower(unaccent(concat_ws(' ', ml.title, ml.address, ml.city)))
                   end)
              not like '%' || lower(unaccent(replace(replace(w, '%', ''), '_', ''))) || '%'
         )
    ) candidats
   order by rang, id
   limit least(greatest(coalesce(p_limite, 50), 1), 200);
$$;

comment on function public.wa_matching_biens_designes(uuid, text[], integer) is
  'Désigne EN BASE les biens dont titre/adresse/ville contiennent chaque mot de p_mots (un mot numérique ne se compare qu''à l''adresse ; unaccent, sur-ensemble affiné ensuite par candidats en TypeScript) — les mandats non supprimés de l''agence ET les annonces ayant un match compatible dans l''agence, ENSEMBLE, mandats en tête puis id, p_limite au plus (50 par défaut, 200 au plus). Lue par le copilote WhatsApp (designerBien) sous le rôle de service, le seul qui l''appelle.';

revoke all on function public.wa_matching_biens_designes(uuid, text[], integer) from public, anon, authenticated;
grant execute on function public.wa_matching_biens_designes(uuid, text[], integer) to service_role;
