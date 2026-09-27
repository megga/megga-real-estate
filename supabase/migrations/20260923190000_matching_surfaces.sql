-- Matching · lot D1 (23.09.2026) — les surfaces du CRM : « Aujourd'hui », « Ce qui a bougé », « Pendant ton absence ».
-- Conception : docs/superpowers/specs/2026-09-23-matching-lot-d1-surfaces-design.md (§5, §7bis).
--
-- 1. `matching_actions_du_jour(p_limite)` — le segment « Matching » d'« Aujourd'hui » : quatre sortes d'actions,
--    classées et coupées ICI. La page ne lit jamais les matchs de l'agence (§3 : on ne charge jamais tout pour en
--    garder cinq).
-- 2. `pige_acheteurs_compatibles(p_annonces)` — « Ce qui a bougé » : les acheteurs compatibles des annonces d'une page
--    du flux. `pige_mouvements` ne change pas : lui ajouter une colonne changerait son type de retour.
-- 3. `today_absence` — ses rappels disent leur TYPE et combien de biens attendent encore une réponse : une relance de
--    proposition ne se « reprend » pas, elle se consigne (« Retours de … » du fil). Sa sortie reste un `jsonb`.
--
-- ⚠ Deux noms NEUFS, jamais un CREATE OR REPLACE d'une fonction existante dont le type change : le date-guard de
-- `deploy.yml` rejoue les migrations du jour à chaque push (leçon du lot C). `today_absence` garde le sien.
-- ⚠ Les seuils (3, 14 et 7 jours) sont ceux de `src/components/matching-fil/filSignaux.ts` : `matching-du-jour.spec.ts`
-- les confronte.
-- ⚠ Au redatage du jour de la fusion, garder un suffixe POSTÉRIEUR à toute la pile (après …180000_contacts_roles) :
-- cette migration lit des colonnes du lot B (`prix_propose`, `match_ids` : …140000_matching_boucle). Un corps
-- `language sql` est validé à sa création : placée avant lui, elle ferait échouer `db reset`.

-- ── 1. Les actions du jour ────────────────────────────────────────────────────
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
  with agence as (
    select public.get_user_agency_id() as id
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

comment on function public.matching_actions_du_jour(integer) is
  'Lot D1 : le segment Matching d''Aujourd''hui — retours dus, baisses sous le prix de proposition, nouveaux mandats (7 j) avec acquéreurs compatibles, marché (nouveau 3 j, baisse 14 j, jamais proposé) ; classées, p_limite au plus (5 par défaut, 20 au plus), total avant la coupe.';

revoke all on function public.matching_actions_du_jour(integer) from public, anon;
grant execute on function public.matching_actions_du_jour(integer) to authenticated;

-- ── 2. Les acheteurs compatibles d'une page de « Ce qui a bougé » ─────────────
-- Les compatibles de « Qui pour ce bien ? » (§7) : à proposer (reportés compris), proposés, intéressés, en visite — ceux
-- qu'un refus n'a pas écartés. 30 identifiants au plus : une page du flux. Servie par `idx_matches_market_listing`.
create or replace function public.pige_acheteurs_compatibles(p_annonces uuid[])
returns table (market_listing_id uuid, acheteurs integer)
language sql
stable
security invoker
set search_path to 'public', 'pg_temp'
as $$
  select m.market_listing_id, count(distinct m.contact_id)::integer
    from public.matches m
   where m.agency_id = public.get_user_agency_id()
     and m.market_listing_id = any ((p_annonces)[1:30])
     and m.status in ('suggested', 'sent', 'interested', 'visit_planned')
   group by m.market_listing_id;
$$;

comment on function public.pige_acheteurs_compatibles(uuid[]) is
  'Lot D1 : « Ce qui a bougé » — les acheteurs compatibles (matchs suggested, sent, interested, visit_planned de l''agence) de 30 annonces au plus.';

revoke all on function public.pige_acheteurs_compatibles(uuid[]) from public, anon;
grant execute on function public.pige_acheteurs_compatibles(uuid[]) to authenticated;

-- ── 3. « Pendant ton absence » : le type de chaque rappel, et les biens qu'il attend ──
-- Corps de 20260803120000, À L'IDENTIQUE, plus deux clés par signal : `reminder_type` et `nb_biens` (les biens encore
-- `sent` d'une relance de proposition), et un filtre d'agence dans le sous-select de `nb_biens` (`m.agency_id =
-- v_agency`) : la fonction est SECURITY DEFINER, la RLS ne filtre pas. Le client ouvre alors « Retours de … » au lieu
-- de passer la relance à `done` : elle se clôt quand ses réponses sont consignées (`fermer_relance_proposition`). Même
-- signature, même `jsonb` : le date-guard peut la rejouer.
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
      m.id                                                as ref_id,
      null::text                                          as reminder_type,
      null::integer                                       as nb_biens
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
      r.id                                                as ref_id,
      r.type                                              as reminder_type,
      case when r.type = 'follow_up_sent_property' then (
        select count(*)::integer
          from public.matches m
         where m.id = any (coalesce(r.match_ids, array[r.match_id]))
           and m.status = 'sent'
           -- SECURITY DEFINER : la RLS ne filtre pas, et un rappel ne compte que des matchs de son agence.
           and m.agency_id = v_agency
      ) end                                               as nb_biens
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
