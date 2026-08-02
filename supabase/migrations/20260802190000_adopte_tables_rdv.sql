-- ═══════════════════════════════════════════════════════════════════════════════════════
-- RÉGULARISE trois tables du module « prise de rendez-vous » créées HORS du pipeline.
-- ═══════════════════════════════════════════════════════════════════════════════════════
--
-- CE QUE CE FICHIER EST, ET N'EST PAS. Il ne crée rien de neuf : `agent_booking_settings`,
-- `agent_time_off` et `appointments` existent DÉJÀ en production. Il les DÉCLARE, pour que
-- le schéma de production redevienne reproductible depuis le dépôt. Sur la base de
-- production il est donc un no-op intégral (`if not exists` partout) ; sur une base fraîche
-- de CI, il reconstruit à l'identique ce qui manquait.
--
-- POURQUOI IL FALLAIT L'ÉCRIRE. La porte `Migration drift (prod vs dépôt)` échoue sur `main`
-- depuis le 02.08.2026 ~19:32 UTC : trois relations vivantes en production, absentes de
-- `src/types/database.ts` ET d'`supabase/migrations/`. Mesuré avant d'agir :
--   · aucune migration du dépôt ne les déclare ;
--   · AUCUNE branche distante, AUCUNE PR ouverte ne les mentionne — nulle part, sous
--     aucune forme (ni SQL, ni TypeScript, ni types) ;
--   · les trois sont VIDES (0 ligne) et aucun code du dépôt ne les lit ;
--   · elles étaient absentes de la régénération de types faite à 18:15 UTC le même jour.
-- Elles ont donc été appliquées directement en base (éditeur SQL ou `apply_migration`)
-- entre 18:15 et 19:32, sans contrepartie versionnée.
--
-- POURQUOI ADOPTER PLUTÔT QUE SUPPRIMER. Les deux options étaient sur la table. Supprimer
-- exige de détruire en production un schéma qu'on ne sait pas attribuer — et rien ne le
-- justifie : le module est cohérent, documenté par ses propres `comment on`, et manifestement
-- délibéré (contrainte d'exclusion anti-chevauchement, validation de grille horaire,
-- rattachement au parcours KYC). Adopter est NON DESTRUCTIF et réversible : si le module est
-- abandonné, une migration de suppression reste possible, en connaissance de cause. Ce
-- fichier ne tranche donc PAS l'avenir du module — il rend seulement la base reproductible.
--
-- ⛔ CE QU'IL NE FAUT SURTOUT PAS FAIRE À LA PLACE : régénérer `src/types/database.ts` seul.
-- La porte deviendrait verte alors que le schéma de production resterait irreproductible —
-- exactement le défaut qu'elle existe pour signaler. Les types sont régénérés EN PLUS, pas
-- À LA PLACE.
--
-- ── Deux pièges mesurés dans ce fichier ───────────────────────────────────────────────
-- 1. `appointments.slot` n'a PAS un DEFAULT mais est `GENERATED ALWAYS … STORED`
--    (`pg_attribute.attgenerated = 's'`). Un DEFAULT ne peut pas référencer d'autres
--    colonnes : le lire comme tel aurait produit une table qui refuse tout INSERT.
-- 2. La contrainte d'exclusion exige l'opérateur `=` sur `uuid` en gist, donc **btree_gist**,
--    qui vit dans le schéma `extensions` (comme `pg_trgm`, cf. §6.5). Vérifié : le
--    search_path du runner de migrations vaut `"$user", public, extensions`, donc la classe
--    d'opérateurs est visible — mais l'extension doit exister, d'où le `create extension`
--    ci-dessous, indispensable sur une base FRAÎCHE.
--
-- ⚠ Deux observations qui ne sont PAS corrigées ici, parce que ce fichier déclare l'existant
-- et ne redessine rien. Elles appartiennent à qui finira le module :
--   · les policies d'`appointments` sont toutes `TO authenticated`, alors que le commentaire
--     de la table décrit une réservation « par le client depuis son lien magique » : en
--     l'état, un client anonyme ne peut RIEN y insérer ;
--   · `appointments.updated_at` n'a aucun trigger de mise à jour (seul
--     `agent_booking_settings` en a un) : la colonne restera à sa valeur d'insertion.
-- ═══════════════════════════════════════════════════════════════════════════════════════

-- Indispensable à la contrainte d'exclusion ci-dessous. Sans schéma explicite, une base
-- fraîche l'installerait dans `public` et divergerait de la production.
create extension if not exists btree_gist with schema extensions;

-- ───────────────────────────────────────────────────────────────────────────────────────
-- 1. agent_booking_settings — les disponibilités d'un agent
-- ───────────────────────────────────────────────────────────────────────────────────────

create table if not exists public.agent_booking_settings (
  agent_id          uuid        not null,
  agency_id         uuid        not null,
  is_open           boolean     not null default false,
  timezone          text        not null default 'Europe/Zurich'::text,
  slot_minutes      smallint    not null default 30,
  buffer_minutes    smallint    not null default 15,
  min_notice_hours  smallint    not null default 24,
  max_advance_days  smallint    not null default 30,
  weekly_hours      jsonb       not null default '{}'::jsonb,
  location_label    text,
  default_mode      text        not null default 'sur_place'::text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint agent_booking_settings_pkey primary key (agent_id),
  constraint agent_booking_settings_agent_id_fkey
    foreign key (agent_id)  references public.profiles(id) on delete cascade,
  constraint agent_booking_settings_agency_id_fkey
    foreign key (agency_id) references public.agencies(id) on delete cascade,
  constraint agent_booking_settings_slot_minutes_check
    check (slot_minutes >= 15 and slot_minutes <= 240),
  constraint agent_booking_settings_buffer_minutes_check
    check (buffer_minutes >= 0 and buffer_minutes <= 120),
  constraint agent_booking_settings_min_notice_hours_check
    check (min_notice_hours >= 0 and min_notice_hours <= 720),
  constraint agent_booking_settings_max_advance_days_check
    check (max_advance_days >= 1 and max_advance_days <= 365),
  constraint agent_booking_settings_default_mode_check
    check (default_mode = any (array['sur_place'::text, 'video'::text])),
  -- Aucune clé hors 1..7 (ISO, 1 = lundi) : `jsonb - text[]` retire ces clés, le reste doit
  -- être vide.
  constraint agent_booking_settings_weekly_hours_keys
    check ((weekly_hours - array['1'::text,'2'::text,'3'::text,'4'::text,'5'::text,'6'::text,'7'::text]) = '{}'::jsonb)
);

-- ───────────────────────────────────────────────────────────────────────────────────────
-- 2. agent_time_off — les absences ponctuelles
-- ───────────────────────────────────────────────────────────────────────────────────────

create table if not exists public.agent_time_off (
  id         uuid        not null default gen_random_uuid(),
  agent_id   uuid        not null,
  agency_id  uuid        not null,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  reason     text,
  created_at timestamptz not null default now(),
  constraint agent_time_off_pkey primary key (id),
  constraint agent_time_off_agent_id_fkey
    foreign key (agent_id)  references public.profiles(id) on delete cascade,
  constraint agent_time_off_agency_id_fkey
    foreign key (agency_id) references public.agencies(id) on delete cascade,
  constraint agent_time_off_range check (ends_at > starts_at)
);

create index if not exists idx_agent_time_off_agent_window
  on public.agent_time_off using btree (agent_id, starts_at, ends_at);

-- ───────────────────────────────────────────────────────────────────────────────────────
-- 3. appointments — le rendez-vous lui-même
-- ───────────────────────────────────────────────────────────────────────────────────────

create table if not exists public.appointments (
  id                   uuid        not null default gen_random_uuid(),
  agency_id            uuid        not null,
  agent_id             uuid        not null,
  contact_id           uuid        not null,
  kyc_case_id          uuid,
  magic_link_id        uuid,
  purpose              text        not null default 'kyc_verification'::text,
  mode                 text        not null default 'sur_place'::text,
  starts_at            timestamptz not null,
  ends_at              timestamptz not null,
  -- GÉNÉRÉE, pas un DEFAULT (voir l'en-tête, piège n° 1). LEAST/GREATEST rendent la plage
  -- robuste même si l'appelant inverse les bornes ; le CHECK `appointments_range` refuse
  -- ce cas par ailleurs.
  slot                 tstzrange
    generated always as (tstzrange(least(starts_at, ends_at), greatest(starts_at, ends_at), '[)'::text)) stored,
  status               text        not null default 'confirmed'::text,
  location             text,
  video_link           text,
  client_note          text,
  booked_by            text        not null default 'client'::text,
  external_provider    text,
  external_event_id    text,
  confirmation_sent_at timestamptz,
  reminder_sent_at     timestamptz,
  cancelled_at         timestamptz,
  cancelled_by         text,
  reschedule_count     smallint    not null default 0,
  client_ip            text,
  client_user_agent    text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint appointments_pkey primary key (id),
  constraint appointments_agency_id_fkey
    foreign key (agency_id)     references public.agencies(id)        on delete cascade,
  -- RESTRICT et non CASCADE : un rendez-vous est une trace, il ne disparaît pas avec le
  -- compte de l'agent qui le tenait.
  constraint appointments_agent_id_fkey
    foreign key (agent_id)      references public.profiles(id)        on delete restrict,
  constraint appointments_contact_id_fkey
    foreign key (contact_id)    references public.contacts(id)        on delete cascade,
  constraint appointments_kyc_case_id_fkey
    foreign key (kyc_case_id)   references public.kyc_cases(id)       on delete set null,
  constraint appointments_magic_link_id_fkey
    foreign key (magic_link_id) references public.kyc_magic_links(id) on delete set null,
  constraint appointments_purpose_check check (purpose = 'kyc_verification'::text),
  constraint appointments_mode_check
    check (mode = any (array['sur_place'::text, 'video'::text])),
  constraint appointments_status_check
    check (status = any (array['confirmed'::text, 'cancelled'::text, 'done'::text, 'no_show'::text])),
  constraint appointments_booked_by_check
    check (booked_by = any (array['client'::text, 'agent'::text])),
  constraint appointments_cancelled_by_check
    check (cancelled_by = any (array['client'::text, 'agent'::text])),
  constraint appointments_external_provider_check
    check (external_provider = any (array['google'::text, 'outlook'::text])),
  constraint appointments_range check (ends_at > starts_at),
  -- Le cœur du module : un agent ne peut pas avoir deux rendez-vous CONFIRMÉS qui se
  -- chevauchent. Le prédicat partiel laisse passer les annulés et les honorés.
  constraint appointments_no_overlap
    exclude using gist (agent_id with =, slot with &&) where (status = 'confirmed'::text)
);

create index if not exists idx_appointments_agency_window
  on public.appointments using btree (agency_id, starts_at desc);
create index if not exists idx_appointments_contact
  on public.appointments using btree (contact_id, starts_at desc);

-- ───────────────────────────────────────────────────────────────────────────────────────
-- 4. Validation de la grille horaire (trigger, pas RPC : `abs_self_write` autorise
--    l'écriture directe par l'agent, donc la garde doit vivre sur la table)
-- ───────────────────────────────────────────────────────────────────────────────────────

create or replace function public.validate_agent_weekly_hours()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_day      text;
  v_window   jsonb;
  v_prev_end time;
  v_start    time;
  v_end      time;
begin
  for v_day in select jsonb_object_keys(new.weekly_hours) loop
    if jsonb_typeof(new.weekly_hours -> v_day) <> 'array' then
      raise exception 'weekly_hours[%] : tableau de plages attendu', v_day
        using errcode = 'check_violation';
    end if;
    v_prev_end := null;
    for v_window in select value from jsonb_array_elements(new.weekly_hours -> v_day) loop
      if jsonb_typeof(v_window) <> 'array' or jsonb_array_length(v_window) <> 2 then
        raise exception 'weekly_hours[%] : chaque plage doit etre [debut, fin]', v_day
          using errcode = 'check_violation';
      end if;
      begin
        v_start := (v_window ->> 0)::time;
        v_end   := (v_window ->> 1)::time;
      exception when others then
        raise exception 'weekly_hours[%] : heure illisible (format HH:MM attendu)', v_day
          using errcode = 'check_violation';
      end;
      if v_end <= v_start then
        raise exception 'weekly_hours[%] : fin (%) <= debut (%)', v_day, v_end, v_start
          using errcode = 'check_violation';
      end if;
      if v_prev_end is not null and v_start < v_prev_end then
        raise exception 'weekly_hours[%] : plages non ordonnees ou chevauchantes', v_day
          using errcode = 'check_violation';
      end if;
      v_prev_end := v_end;
    end loop;
  end loop;
  new.updated_at := now();
  return new;
end $function$;

drop trigger if exists trg_validate_agent_weekly_hours on public.agent_booking_settings;
create trigger trg_validate_agent_weekly_hours
  before insert or update on public.agent_booking_settings
  for each row execute function public.validate_agent_weekly_hours();

-- ───────────────────────────────────────────────────────────────────────────────────────
-- 5. RLS — activée ET FORCÉE sur les trois (l'état de la production)
-- ───────────────────────────────────────────────────────────────────────────────────────
--
-- ⚠ Les GRANT ne sont PAS reposés ici, et c'est délibéré : `anon`, `authenticated` et
-- `service_role` reçoivent tout par les DEFAULT PRIVILEGES du projet (cf. §6.14), aussi bien
-- en production que sur une base fraîche — les deux coïncident donc sans qu'on écrive rien.
-- La RLS FORCÉE et des policies réservées à `authenticated` sont le verrou réel.

alter table public.agent_booking_settings enable row level security;
alter table public.agent_booking_settings force  row level security;
alter table public.agent_time_off         enable row level security;
alter table public.agent_time_off         force  row level security;
alter table public.appointments           enable row level security;
alter table public.appointments           force  row level security;

drop policy if exists abs_agency_read on public.agent_booking_settings;
create policy abs_agency_read on public.agent_booking_settings
  for select to authenticated
  using (agency_id in (select p.agency_id from public.profiles p where p.id = auth.uid()));

drop policy if exists abs_self_write on public.agent_booking_settings;
create policy abs_self_write on public.agent_booking_settings
  for all to authenticated
  using (agent_id = auth.uid())
  with check (agent_id = auth.uid()
              and agency_id in (select p.agency_id from public.profiles p where p.id = auth.uid()));

drop policy if exists ato_agency_read on public.agent_time_off;
create policy ato_agency_read on public.agent_time_off
  for select to authenticated
  using (agency_id in (select p.agency_id from public.profiles p where p.id = auth.uid()));

drop policy if exists ato_self_write on public.agent_time_off;
create policy ato_self_write on public.agent_time_off
  for all to authenticated
  using (agent_id = auth.uid())
  with check (agent_id = auth.uid()
              and agency_id in (select p.agency_id from public.profiles p where p.id = auth.uid()));

drop policy if exists appt_agency_read on public.appointments;
create policy appt_agency_read on public.appointments
  for select to authenticated
  using (agency_id in (select p.agency_id from public.profiles p where p.id = auth.uid()));

drop policy if exists appt_agency_insert on public.appointments;
create policy appt_agency_insert on public.appointments
  for insert to authenticated
  with check (agency_id in (select p.agency_id from public.profiles p where p.id = auth.uid()));

drop policy if exists appt_agency_update on public.appointments;
create policy appt_agency_update on public.appointments
  for update to authenticated
  using (agency_id in (select p.agency_id from public.profiles p where p.id = auth.uid()))
  with check (agency_id in (select p.agency_id from public.profiles p where p.id = auth.uid()));

-- ───────────────────────────────────────────────────────────────────────────────────────
-- 6. Commentaires — repris À L'IDENTIQUE de la production (dollar-quoting : ils portent
--    des apostrophes)
-- ───────────────────────────────────────────────────────────────────────────────────────

comment on table public.agent_booking_settings is
  $c$Disponibilités d'un agent pour l'auto-réservation client (RDV de vérification KYC). is_open = opt-in explicite : false tant que l'agent n'a rien configuré.$c$;
comment on column public.agent_booking_settings.buffer_minutes is
  $c$Battement appliqué au CALCUL des créneaux offerts, pas à appointments.ends_at : la durée réelle du RDV reste exacte dans l'agenda externe.$c$;
comment on column public.agent_booking_settings.weekly_hours is
  $c$Grille hebdo { "1".."7" (ISO, 1=lundi) : [[HH:MM, HH:MM], …] } en heure locale du champ timezone. Forme validee par le trigger trg_validate_agent_weekly_hours (et non par une RPC : la policy abs_self_write autorise l'ecriture directe).$c$;

comment on table public.agent_time_off is
  $c$Absences ponctuelles d'un agent, soustraites de agent_booking_settings.weekly_hours au calcul des créneaux offerts.$c$;

comment on table public.appointments is
  $c$Rendez-vous SANS bien — aujourd'hui la vérification d'identité KYC, réservée par le client depuis son lien magique. Distinct de `visits`, qui est une visite de bien (property_id NOT NULL, bon/rapport/matching).$c$;
comment on column public.appointments.slot is
  $c$Plage dérivée de starts_at/ends_at, existe uniquement pour la contrainte d'exclusion appointments_no_overlap.$c$;
