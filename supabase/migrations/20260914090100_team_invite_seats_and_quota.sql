-- Invitations d'équipe : un plafond de sièges qui compte enfin, et un quota d'envoi par
-- agence (constat relevé par la porte S17 de l'audit du 13.09.2026, corrigé le 14.09.2026).
--
-- ⛔ CE QUE MESURAIT LA PRODUCTION LE 13.09.2026. `send-team-invite` appliquait la limite de
-- membres du plan par `rpc('get_agency_member_count')` — une fonction qui n'existe NULLE PART
-- en production (aucune fonction `*member_count*` dans `public`) ni dans
-- `src/types/database.ts` : elle ne vivait que dans `supabase/migrations/_archived`. L'erreur
-- de la RPC était ignorée, le compte valait 0 et la limite ne bloquait JAMAIS. Plus grave,
-- l'envoi n'avait aucun quota. Or tout inscrit est admin de son agence solo (l'inscription en
-- provisionne une, 20260729150500) : n'importe qui faisait partir des invitations signées DKIM
-- `getmegga.com` vers n'importe quelle adresse, sous un nom d'agence qu'il choisit — le relais
-- ouvert de S1, par la seule porte que S1 ne fermait pas. Production : 0 invitation envoyée.
--
-- DEUX VERROUS, de natures différentes.
--
-- 1. LE PLAFOND DE SIÈGES est une LIMITE DE PLAN : même interrupteur, même lecture que le
--    quota de biens (20260913170100). INACTIF tant que `app_config.plan_limits_enforced` ≠
--    'true' — décision Julien du 13.09.2026 : toutes les agences sont en Starter, aucune ne
--    peut passer Pro, et Starter = 1 membre ; l'allumer aujourd'hui interdirait toute
--    invitation à toutes les agences. Le jour où la facturation est en service :
--      update public.app_config set value = 'true' where key = 'plan_limits_enforced';
--    allume les DEUX règles (biens et sièges) d'un seul geste.
--
--    Un SIÈGE = un membre (profil de l'agence, non supprimé) OU une invitation qui peut encore
--    être réclamée (`pending`, non expirée). Une invitation expirée ne tient rien : un renvoi
--    qui la ranime reprend donc un siège, et le trigger le juge.
--
--    Plan effectif : l'abonnement actif, en essai ou en retard de paiement de l'agence ; sinon
--    Starter — la lecture de `useSubscription` et d'`enforce_plan_property_quota`. ⛔ JAMAIS
--    `agencies.plan`, que lisait l'edge. Depuis 20260802170000 la colonne est du `text` au
--    vocabulaire du catalogue (starter|pro|entreprise) — l'enum `agency_plan`
--    (starter|pro|agency|enterprise) ne la type plus —, mais seuls `admin_create_agency` et
--    `admin_set_agency_plan` l'écrivent : le webhook Stripe ne tient que `subscriptions.plan`.
--    Elle décroche donc de l'abonnement au premier changement de plan par Stripe. L'edge y
--    indexait en plus une grille en dur, 1/3/10/50, dont deux clés (`agency`, `enterprise`)
--    ne peuvent plus exister dans la colonne : une agence Entreprise y retombait sur 1 siège.
--
--    Plafond : miroir de `PLAN_LIMITS[plan].features.maxAgents` (src/lib/plans.ts) — Starter 1,
--    Pro 1, Entreprise 10 —, confronté par tests/unit/team-invite-sieges-quota.spec.ts. Un plan
--    inconnu retombe sur Starter : fermé par défaut. ⚠ La grille d'AFFICHAGE du même fichier
--    (`PLANS`, `team_members`) dit 1 / 5 / illimité : c'est la décision PO n° 4, toujours
--    ouverte. La règle suit la valeur d'enforcement, comme le quota de biens.
--
--    Tenu à DEUX endroits : `team_seat_status`, que l'edge lit AVANT d'écrire (refus propre,
--    et fermé si l'état est illisible), et le trigger `enforce_plan_seat_quota`. Le trigger
--    n'est pas un doublon : `team_invitations` est ouverte en écriture aux dirigeants via
--    PostgREST (20260802210000), donc un plafond tenu par l'edge seule se contournait d'un
--    POST direct ; et deux invitations simultanées lisaient toutes deux « 0 siège pris ». Il
--    sérialise les écritures d'une même agence par un verrou consultatif.
--
-- 2. LE QUOTA D'ENVOI n'est PAS une limite de plan : c'est un garde-fou anti-abus, donc
--    ACTIF, interrupteur ou non. 20 invitations par agence et par 24 h glissantes, réglable
--    (`app_config.team_invite_daily_cap`). Il compte les invitations ET les renvois : un
--    renvoi repart vers la même adresse, et sans lui une seule invitation se renvoyait mille
--    fois. Il se tient dans `email_send_log` — le journal des e-mails pilotés par un agent —,
--    sous le MÊME verrou consultatif que `email_send_quota_take`, puis la prise passe par
--    celle-ci : une invitation compte donc AUSSI dans le plafond commun de l'agence (60/h,
--    300/j). Un budget d'envoi par agence, pas un par fonction.
--
-- Les deux fonctions appelées par l'edge sont réservées au `service_role` : leur entrée est un
-- identifiant d'agence, et ouvertes à `authenticated` elles diraient à n'importe quel inscrit
-- le plan et l'effectif d'une agence tierce.
--
-- ⚠ HORODATAGE. `deploy.yml` n'applique que les migrations datées du jour du merge ou après.
-- Mergée après le 14.09.2026, celle-ci serait SAUTÉE : l'edge, qui refuse fermé, répondrait
-- alors 503 à toute invitation (`seat_check_unavailable`). L'appliquer à la main avant le
-- merge, ou la re-dater au jour du merge.
--
-- Rejouable : INSERT … ON CONFLICT DO NOTHING (un rejeu ne réécrit JAMAIS un réglage),
-- CREATE OR REPLACE, DROP TRIGGER IF EXISTS, et un bloc de contrôle final qui n'écrit rien
-- de durable.

-- ═══════════════════════════════════════════════════════════════════════════
-- RÉGLAGES — créés s'ils manquent, jamais réécrits
-- ═══════════════════════════════════════════════════════════════════════════
-- L'interrupteur naît dans 20260913170100 ; le reposer ici rend cette migration autonome sur
-- une base où l'autre n'aurait pas été appliquée.
insert into public.app_config (key, value)
values ('plan_limits_enforced', 'false')
on conflict (key) do nothing;

insert into public.app_config (key, value)
values ('team_invite_daily_cap', '20')
on conflict (key) do nothing;

-- ═══════════════════════════════════════════════════════════════════════════
-- SIÈGES — l'état, lu par l'edge ET par le trigger
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.team_seat_status(p_agency_id uuid)
returns table (enforced boolean, plan text, seat_cap integer, seats_used integer)
language sql
stable
security definer
set search_path to ''
as $$
  with effectif as (
    select coalesce(
      (select s.plan
         from public.subscriptions s
        where s.agency_id = p_agency_id
          and s.status in ('active', 'trialing', 'past_due')
        limit 1),
      'starter') as plan
  )
  select
    -- Interrupteur : absent ou autre que 'true' = règle inactive.
    coalesce((select c.value from public.app_config c where c.key = 'plan_limits_enforced'), 'false') = 'true',
    effectif.plan,
    -- Miroir de PLAN_LIMITS[plan].features.maxAgents. Un plan inconnu = Starter.
    case effectif.plan when 'starter' then 1 when 'pro' then 1 when 'entreprise' then 10 else 1 end,
    (
      (select count(*)
         from public.profiles p
        where p.agency_id = p_agency_id
          and p.deleted_at is null)
      + (select count(*)
           from public.team_invitations i
          where i.agency_id = p_agency_id
            and i.status = 'pending'
            and i.expires_at > now())
    )::integer
  from effectif
$$;

comment on function public.team_seat_status(uuid) is
  'Sièges d''une agence : interrupteur plan_limits_enforced, plan effectif (abonnement actif, '
  'en essai ou en retard, sinon starter), plafond (miroir de PLAN_LIMITS.maxAgents : 1/1/10) et '
  'sièges pris (membres non supprimés + invitations pending non expirées). Lu par '
  'send-team-invite et par enforce_plan_seat_quota. Service_role seul (20260914090100).';

revoke all on function public.team_seat_status(uuid) from public, anon, authenticated;
grant execute on function public.team_seat_status(uuid) to service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- SIÈGES — la règle, tenue à l'écriture pour tous les rôles
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.enforce_plan_seat_quota()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_plan text;
  v_cap  integer;
  v_pris integer;
begin
  -- Seule une invitation qui SE MET à tenir un siège est jugée : en attente et non expirée.
  -- Annuler, accepter ou expirer libère un siège — rien à vérifier.
  if new.status is distinct from 'pending' or new.expires_at <= now() then
    return new;
  end if;
  -- Renvoi d'une invitation encore valable, dans la même agence : son siège était déjà compté.
  if tg_op = 'UPDATE'
     and old.status = 'pending'
     and old.expires_at > now()
     and old.agency_id is not distinct from new.agency_id then
    return new;
  end if;

  -- Interrupteur (voir l'en-tête) : absent ou autre que 'true' = règle inactive.
  if coalesce((select c.value from public.app_config c where c.key = 'plan_limits_enforced'), 'false') <> 'true' then
    return new;
  end if;

  -- Deux invitations simultanées de la même agence ne lisent pas toutes deux « 0 siège pris ».
  perform pg_advisory_xact_lock(hashtext('plan_seat_quota:' || new.agency_id::text));

  select t.plan, t.seat_cap, t.seats_used
    into v_plan, v_cap, v_pris
    from public.team_seat_status(new.agency_id) t;

  -- La ligne jugée n'est pas dans le compte : absente de la table à l'INSERT, et, à l'UPDATE,
  -- son état d'avant ne tenait pas de siège (sinon on serait sorti plus haut).
  if v_pris >= v_cap then
    raise exception 'plan_seat_limit'
      using errcode = 'P0001',
            detail = format('plan %s : %s siège(s) pris sur %s', v_plan, v_pris, v_cap);
  end if;
  return new;
end $$;

comment on function public.enforce_plan_seat_quota() is
  'BEFORE INSERT OR UPDATE sur team_invitations : une invitation qui se met à tenir un siège '
  '(pending, non expirée) est refusée (plan_seat_limit) quand l''agence a atteint le plafond '
  'de son plan (team_seat_status). INACTIF tant que app_config.plan_limits_enforced ≠ ''true'' '
  '(20260914090100).';

revoke all on function public.enforce_plan_seat_quota() from public, anon, authenticated;

drop trigger if exists trg_enforce_plan_seat_quota on public.team_invitations;
create trigger trg_enforce_plan_seat_quota
  before insert or update of status, expires_at, agency_id on public.team_invitations
  for each row execute function public.enforce_plan_seat_quota();

-- ═══════════════════════════════════════════════════════════════════════════
-- QUOTA D'ENVOI — prendre une place, ou être refusé
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.team_invite_quota_take(
  p_agency_id uuid,
  p_actor_id  uuid,
  p_recipient text
) returns table (allowed boolean, reason text, day_count integer, day_cap integer)
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_cap   integer;
  v_jour  integer;
  v_ok    boolean;
  v_motif text;
begin
  if p_agency_id is null then
    return query select false, 'no_agency'::text, 0, 0;
    return;
  end if;

  -- LE verrou du quota commun : `email_send_quota_take` le reprend plus bas (un verrou
  -- consultatif de transaction se cumule sans se bloquer lui-même). Deux envois simultanés
  -- de la même agence se sérialisent donc ici, invitations et autres expéditeurs confondus.
  perform pg_advisory_xact_lock(hashtext('email_send_quota:' || p_agency_id::text));

  -- Un réglage illisible ne doit ni bloquer toutes les invitations ni les libérer : défaut,
  -- et on le dit dans les journaux Postgres.
  begin
    v_cap := (select nullif(btrim(c.value), '')::integer
                from public.app_config c
               where c.key = 'team_invite_daily_cap');
  exception when others then
    raise warning 'team_invite_daily_cap illisible (%), défaut appliqué', sqlerrm;
    v_cap := null;
  end;
  v_cap := greatest(coalesce(v_cap, 20), 1);

  select count(*)::integer
    into v_jour
    from public.email_send_log l
   where l.agency_id = p_agency_id
     and l.sender = 'send-team-invite'
     and l.created_at > now() - interval '24 hours';

  if v_jour >= v_cap then
    return query select false, 'invite_daily_cap'::text, v_jour, v_cap;
    return;
  end if;

  -- Le plafond commun (60/h, 300/j) ET l'écriture du journal : une invitation est un e-mail
  -- sortant de l'agence comme un autre. `transactional` : le destinataire n'a encore aucun
  -- lien avec l'agence, c'est l'agence qui l'initie — la catégorie ne sert ici qu'au journal.
  select q.allowed, q.reason
    into v_ok, v_motif
    from public.email_send_quota_take(p_agency_id, p_actor_id, p_recipient, 'transactional', 'send-team-invite') q;

  if not coalesce(v_ok, false) then
    return query select false, coalesce(v_motif, 'quota_unavailable'), v_jour, v_cap;
    return;
  end if;

  return query select true, 'ok'::text, v_jour + 1, v_cap;
end $$;

comment on function public.team_invite_quota_take(uuid, uuid, text) is
  'Prend une place dans le quota d''invitations d''équipe de l''agence : 20 par 24 h glissantes '
  'par défaut (app_config.team_invite_daily_cap), invitations et renvois, compté dans '
  'email_send_log (sender send-team-invite) ; puis passe par email_send_quota_take (plafond '
  'commun 60/h, 300/j, écriture du journal). Refus : invite_daily_cap | hourly_cap | daily_cap | '
  'no_agency. Service_role seul (20260914090100).';

revoke all on function public.team_invite_quota_take(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.team_invite_quota_take(uuid, uuid, text) to service_role;

comment on table public.email_send_log is
  'Journal des e-mails sortants pilotés par un agent (send-email, send-property-email, '
  'send-relance-email, send-team-invite). Sert de compteur au quota par agence '
  '(email_send_quota_take ; team_invite_quota_take y ajoute le plafond d''invitations). '
  'Autonettoyé à 30 jours. Service_role seul.';

-- ═══════════════════════════════════════════════════════════════════════════
-- CONTRÔLE FINAL — la migration échoue plutôt que de laisser l'invariant faux.
-- Le refus lui-même (interrupteur allumé, plafond franchi ; quota épuisé) est éprouvé par
-- tests/backend/team-invite-seats-quota.spec.ts : il exige une agence peuplée, qu'une
-- migration n'a pas à fabriquer. Ici : la forme, les droits, et deux épreuves TOUJOURS
-- annulées qui prouvent que les chemins s'exécutent jusqu'à la clé étrangère.
-- ═══════════════════════════════════════════════════════════════════════════
do $$
declare
  v_type  int;
  v_plan  text;
  v_cap   integer;
  v_pris  integer;
  v_code  text;
  v_msg   text;
begin
  -- 1. Le trigger est posé, actif, ROW, BEFORE, sur INSERT ET sur UPDATE.
  select t.tgtype into v_type
    from pg_trigger t
   where t.tgrelid = 'public.team_invitations'::regclass
     and t.tgname = 'trg_enforce_plan_seat_quota'
     and t.tgenabled <> 'D';
  -- Bits de tgtype : 1 = ROW, 2 = BEFORE, 4 = INSERT, 16 = UPDATE.
  if v_type is null or (v_type & 1) = 0 or (v_type & 2) = 0 or (v_type & 4) = 0 or (v_type & 16) = 0 then
    raise exception 'sièges : trigger absent, désactivé ou mal typé (tgtype %)', v_type;
  end if;

  -- 2. Aucune des trois fonctions n'est appelable via l'API…
  if has_function_privilege('anon', 'public.team_seat_status(uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.team_seat_status(uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.team_invite_quota_take(uuid, uuid, text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.team_invite_quota_take(uuid, uuid, text)', 'EXECUTE')
     or has_function_privilege('anon', 'public.enforce_plan_seat_quota()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.enforce_plan_seat_quota()', 'EXECUTE') then
    raise exception 'sièges/quota : une fonction est appelable via l''API';
  end if;
  -- … TÉMOIN : l'edge, en service_role, les appelle toujours.
  if not has_function_privilege('service_role', 'public.team_seat_status(uuid)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.team_invite_quota_take(uuid, uuid, text)', 'EXECUTE') then
    raise exception 'sièges/quota : service_role a perdu l''accès aux RPC de send-team-invite';
  end if;

  -- 3. Les deux réglages existent.
  if not exists (select 1 from public.app_config where key = 'plan_limits_enforced')
     or not exists (select 1 from public.app_config where key = 'team_invite_daily_cap') then
    raise exception 'sièges/quota : réglage app_config absent';
  end if;

  -- 4. L'état d'une agence sans abonnement ni membre : Starter, un siège, aucun pris.
  select t.plan, t.seat_cap, t.seats_used into v_plan, v_cap, v_pris
    from public.team_seat_status(gen_random_uuid()) t;
  if v_plan is distinct from 'starter' or v_cap is distinct from 1 or v_pris is distinct from 0 then
    raise exception 'sièges : état inattendu pour une agence vide (%, %, %)', v_plan, v_cap, v_pris;
  end if;

  -- 5. Épreuve du trigger, en sous-transaction TOUJOURS annulée : une invitation neuve le
  --    TRAVERSE et n'échoue que plus loin, sur la clé étrangère (23503). Un trigger qui
  --    refuserait tout — ou qui planterait sur sa propre lecture — rougirait ici.
  v_code := null;
  begin
    insert into public.team_invitations (agency_id, email, role, invited_by)
    values (gen_random_uuid(), 'sonde-sieges@megga-test.invalid', 'agent', gen_random_uuid());
    raise exception 'sonde_inseree';
  exception when others then
    get stacked diagnostics v_code = returned_sqlstate, v_msg = message_text;
  end;
  if v_code is distinct from '23503' then
    raise exception 'sièges : l''épreuve du trigger n''a pas atteint la clé étrangère (% : %)', v_code, v_msg;
  end if;

  -- 6. Épreuve du quota, même forme : une agence sans envoi passe le plafond d'invitations et
  --    le plafond commun, et n'échoue qu'à l'écriture du journal (clé étrangère de l'agence).
  v_code := null;
  begin
    perform * from public.team_invite_quota_take(gen_random_uuid(), null, 'sonde-quota@megga-test.invalid');
    raise exception 'sonde_journalisee';
  exception when others then
    get stacked diagnostics v_code = returned_sqlstate, v_msg = message_text;
  end;
  if v_code is distinct from '23503' then
    raise exception 'quota : l''épreuve n''a pas atteint l''écriture du journal (% : %)', v_code, v_msg;
  end if;
end $$;
