-- Le relais e-mail se ferme : un PÉRIMÈTRE de destinataires et un QUOTA par agence.
--
-- ⛔ CONSTAT DE L'AUDIT DU 13.09.2026. Les trois expéditeurs Resend pilotés par un agent
-- (`send-email`, `send-property-email`, `send-relance-email`) acceptaient un `to` ARBITRAIRE,
-- validé par une regex et rien d'autre. Or un « agent authentifié » est gratuit : l'inscription
-- provisionne une agence solo (20260729150500), donc `requireAgentAuth` est satisfait par
-- n'importe qui muni d'une adresse e-mail. Résultat : un relais ouvert, signé DKIM par
-- `noreply@getmegga.com`, sans aucune limite de débit — de quoi hameçonner sous l'identité
-- MEGGA et brûler la réputation du domaine en une boucle. La garde `lint:edge-auth` était
-- verte : elle vérifie la PRÉSENCE d'un symbole, pas ce que la fonction accepte.
--
-- Deux verrous, tous deux côté base parce que c'est là qu'ils se mesurent :
--
--   1. `email_recipient_scope(agence, adresse)` — le destinataire doit être connu de l'agence
--      de l'appelant : un CONTACT, un LEAD vendeur qui lui est attribué, un MEMBRE de l'agence
--      ou l'adresse de l'AGENCE elle-même. Sinon NULL, et l'edge refuse (403). C'est la
--      philosophie du CRM : on écrit à quelqu'un qui existe dans le fichier, on ne relaie pas.
--      ⚠ Comparaison en `lower(btrim(…))` des deux côtés : `contacts.email` n'est pas normalisé.
--
--   2. `email_send_quota_take(…)` — un compteur glissant par agence (60/h, 300/j par défaut,
--      réglable dans `app_config.email_send_caps` = {"hour":60,"day":300}). Il PREND la place
--      avant l'envoi : refus = `hourly_cap` / `daily_cap`, et la ligne de journal n'est écrite
--      que si l'envoi est autorisé. Le verrou consultatif rend la prise atomique par agence.
--      Le journal s'autonettoie (30 jours) à chaque prise : pas de cron pour ça.
--
-- Les deux fonctions sont réservées au `service_role` : leur entrée est une ADRESSE, et
-- ouvertes à `authenticated` elles deviendraient un oracle énumérable (même motif que
-- `email_send_allowed`, 20260815220000). Le pendant edge est `_shared/email-recipient.ts`,
-- gardé par `tests/unit/email-senders-scope.spec.ts` (ordre : périmètre → suppression → quota
-- → Resend, et plus aucun repli `data.html`).

-- ═══════════════════════════════════════════════════════════════════════════
-- JOURNAL DES ENVOIS (compteur du quota)
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists public.email_send_log (
  id          bigint generated always as identity primary key,
  agency_id   uuid not null references public.agencies(id) on delete cascade,
  actor_id    uuid references public.profiles(id) on delete set null,
  sender      text not null,   -- la fonction edge qui a envoyé
  purpose     text not null,   -- transactional | relance | digest (cf. email-guard.ts)
  recipient   text not null,   -- normalisé lower/trim
  created_at  timestamptz not null default now()
);

create index if not exists idx_email_send_log_agency_created
  on public.email_send_log (agency_id, created_at desc);

alter table public.email_send_log enable row level security;
-- Aucune policy : lecture et écriture par le seul service_role, via la RPC ci-dessous.
-- ⛔ REVOKE explicite — Supabase accorde d'office INSERT/UPDATE/DELETE à anon et authenticated
-- à la création d'une table (cf. scripts/check-privilege-drift.mjs) ; sans cette ligne le
-- journal d'un quota serait effaçable par la personne qu'il limite, dès qu'une policy
-- trop large apparaîtrait un jour.
revoke all on table public.email_send_log from public, anon, authenticated;

comment on table public.email_send_log is
  'Journal des e-mails sortants pilotés par un agent (send-email, send-property-email, '
  'send-relance-email). Sert de compteur au quota par agence (email_send_quota_take). '
  'Autonettoyé à 30 jours. Service_role seul.';

-- ═══════════════════════════════════════════════════════════════════════════
-- PÉRIMÈTRE — le destinataire est-il connu de l'agence ?
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.email_recipient_scope(p_agency_id uuid, p_email text)
returns text
language sql stable security definer
set search_path to 'public', 'pg_temp'
as $$
  select case
    when p_agency_id is null or nullif(btrim(coalesce(p_email, '')), '') is null then null
    when exists (
      select 1 from public.contacts c
       where c.agency_id = p_agency_id and lower(c.email) = lower(btrim(p_email))
    ) then 'contact'
    when exists (
      select 1 from public.seller_leads l
       where l.assigned_agency_id = p_agency_id and lower(l.contact_email) = lower(btrim(p_email))
    ) then 'lead'
    when exists (
      select 1 from public.profiles p
       where p.agency_id = p_agency_id and lower(p.email) = lower(btrim(p_email))
    ) then 'member'
    when exists (
      select 1 from public.agencies a
       where a.id = p_agency_id and lower(a.email) = lower(btrim(p_email))
    ) then 'agency'
    else null
  end
$$;

comment on function public.email_recipient_scope(uuid, text) is
  'Périmètre d''un destinataire e-mail pour une agence : contact | lead | member | agency, '
  'ou NULL si l''adresse lui est inconnue (l''edge refuse alors l''envoi). Service_role seul.';

revoke all on function public.email_recipient_scope(uuid, text) from public, anon, authenticated;
grant execute on function public.email_recipient_scope(uuid, text) to service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- QUOTA — prendre une place, ou être refusé
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.email_send_quota_take(
  p_agency_id uuid,
  p_actor_id  uuid,
  p_recipient text,
  p_purpose   text,
  p_sender    text
) returns table (allowed boolean, reason text, hour_count integer, day_count integer)
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_caps     jsonb := '{}'::jsonb;
  v_cap_hour integer;
  v_cap_day  integer;
  v_hour     integer;
  v_day      integer;
begin
  if p_agency_id is null then
    return query select false, 'no_agency', 0, 0; return;
  end if;

  -- Deux appels simultanés de la même agence se sérialisent ici : sans ce verrou, chacun
  -- lirait « 59 » et les deux passeraient au-dessus du plafond.
  perform pg_advisory_xact_lock(hashtext('email_send_quota:' || p_agency_id::text));

  -- Un réglage illisible ne doit ni bloquer tous les envois ni les libérer : on retombe
  -- sur les défauts, et on le dit dans les journaux Postgres.
  begin
    v_caps := coalesce(
      (select nullif(value, '')::jsonb from public.app_config where key = 'email_send_caps'),
      '{}'::jsonb);
  exception when others then
    raise warning 'email_send_caps illisible (%), défauts appliqués', sqlerrm;
    v_caps := '{}'::jsonb;
  end;
  v_cap_hour := greatest(coalesce((v_caps ->> 'hour')::integer, 60), 1);
  v_cap_day  := greatest(coalesce((v_caps ->> 'day')::integer, 300), 1);

  -- Entretien opportuniste : le journal ne sert qu'à compter 24 h, on garde 30 j pour l'audit.
  delete from public.email_send_log
   where agency_id = p_agency_id and created_at < now() - interval '30 days';

  select count(*) filter (where created_at > now() - interval '1 hour'), count(*)
    into v_hour, v_day
    from public.email_send_log
   where agency_id = p_agency_id and created_at > now() - interval '24 hours';

  if v_hour >= v_cap_hour then
    return query select false, 'hourly_cap', v_hour, v_day; return;
  end if;
  if v_day >= v_cap_day then
    return query select false, 'daily_cap', v_hour, v_day; return;
  end if;

  insert into public.email_send_log (agency_id, actor_id, sender, purpose, recipient)
  values (p_agency_id, p_actor_id, coalesce(p_sender, '?'), coalesce(p_purpose, '?'),
          lower(btrim(coalesce(p_recipient, ''))));

  return query select true, 'ok', v_hour + 1, v_day + 1;
end $$;

comment on function public.email_send_quota_take(uuid, uuid, text, text, text) is
  'Prend une place dans le quota d''e-mails sortants de l''agence (défauts 60/h, 300/j ; '
  'app_config.email_send_caps = {"hour","day"}). Refus : hourly_cap | daily_cap | no_agency. '
  'Écrit email_send_log seulement si autorisé. Service_role seul.';

revoke all on function public.email_send_quota_take(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.email_send_quota_take(uuid, uuid, text, text, text) to service_role;
