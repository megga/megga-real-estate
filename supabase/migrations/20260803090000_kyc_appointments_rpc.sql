-- ============================================================================
-- Prise de rendez-vous KYC — gestes serveur (RPC) et garde-fous
-- ============================================================================
-- Complète les trois tables déclarées par 20260802190000_adopte_tables_rdv.sql.
--
-- ── POURQUOI CE MODULE EST DESSINÉ AINSI ────────────────────────────────────
-- Rationale rapatriée ici : la migration qui créait les tables a été retirée de
-- cette branche au profit de l'adoption sur `main`, qui déclare le MÊME schéma.
-- Une seule déclaration, un seul propriétaire — mais le « pourquoi » ne devait
-- pas disparaître avec le fichier.
--
-- Une table dédiée plutôt que `visits` : `visits` est sémantiquement une VISITE
-- DE BIEN dans tout le code — `property_id` est NOT NULL, `visit_type` est
-- contraint à sur_place|video, et la table porte feedback_buyer / rating /
-- ai_objections / bon / rapport, consommés par le pipeline et le matching. Un
-- rendez-vous de vérification KYC n'a pas de bien ; rendre `property_id`
-- nullable pour l'y loger imposerait un cas nouveau à TOUS ces consommateurs.
--
-- `appointments.agent_id` est ON DELETE RESTRICT et non CASCADE : un rendez-vous
-- de vérification est une pièce du dossier LAB/KYC. Supprimer un profil agent ne
-- doit pas effacer silencieusement la trace qu'une vérification a eu lieu.
--
-- La contrainte d'exclusion GiST est LA garantie anti-double-réservation. Une
-- vérification applicative ne suffit pas : deux clients qui valident le même
-- créneau à la même seconde passent tous les deux le SELECT avant que l'un ait
-- inséré. Partielle sur 'confirmed' — un rendez-vous annulé libère son créneau.
--
-- Statut initial 'confirmed' et non 'pending' : le créneau vient des
-- disponibilités que l'agent a lui-même déclarées, il est donc déjà autorisé.
-- Le human-in-the-loop de CLAUDE.md porte sur les DÉCISIONS KYC (validation d'un
-- dossier, envoi d'une pièce), pas sur la réservation d'un créneau déjà ouvert.
--
-- ── CE QUI SUIT ─────────────────────────────────────────────────────────────
-- Tout est réservé au `service_role` : les edge functions vérifient le token
-- HMAC en amont (le secret vit dans Deno, la base ne peut pas le vérifier),
-- exactement comme `record_buyer_reaction` pour la boucle de réception acheteur.
--
-- AUCUN GRANT À `anon` NI À `authenticated` sur ces fonctions. Un client public
-- n'atteint jamais la base directement : il passe par une edge function qui
-- résout son token, puis appelle ces RPC avec la clé de service.
--
-- RÈGLES ARBITRÉES (validées avec Gregory)
--   - Annulation / report : impossibles une fois dans la fenêtre de prévenance
--     (`min_notice_hours`, 24 h par défaut) — au-delà, le client doit appeler
--     l'agent, ce qui est le comportement voulu à moins de 24 h d'une
--     vérification d'identité.
--   - Report : 2 au maximum. Au 3e, le client doit passer par l'agent.
--
-- NOTE : `validate_agent_weekly_hours` et son trigger ne sont PAS redéclarés
-- ici — 20260802190000_adopte_tables_rdv.sql les porte déjà, à l'identique.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 2. kyc_booking_busy_ranges — tout ce qui occupe l'agent sur une fenêtre
-- ----------------------------------------------------------------------------
-- Une seule définition de « occupé », pour que le calcul des créneaux offerts
-- (edge) et la validation de la réservation (RPC) ne puissent pas diverger.
--
-- Les VISITES DE BIEN comptent. La contrainte d'exclusion du socle ne couvre que
-- `appointments` : sans cette branche, un client poserait un RDV KYC pile sur une
-- visite déjà planifiée, et rien ne l'arrêterait.
--
-- ⚠ `visits.agent_id` est nullable : une visite sans agent rattaché n'occupe
-- personne et ne bloque donc rien. C'est le comportement existant de la table,
-- pas une décision prise ici.
CREATE OR REPLACE FUNCTION public.kyc_booking_busy_ranges(
  p_agent_id   uuid,
  p_from       timestamptz,
  p_to         timestamptz,
  p_exclude_id uuid DEFAULT NULL
) RETURNS TABLE (source text, starts_at timestamptz, ends_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT 'time_off'::text, t.starts_at, t.ends_at
    FROM public.agent_time_off t
   WHERE t.agent_id = p_agent_id
     AND tstzrange(t.starts_at, t.ends_at, '[)') && tstzrange(p_from, p_to, '[)')

  UNION ALL

  SELECT 'appointment'::text, a.starts_at, a.ends_at
    FROM public.appointments a
   WHERE a.agent_id = p_agent_id
     AND a.status = 'confirmed'
     AND (p_exclude_id IS NULL OR a.id <> p_exclude_id)   -- report : ne pas se bloquer soi-même
     AND a.slot && tstzrange(p_from, p_to, '[)')

  UNION ALL

  SELECT 'visit'::text,
         v.scheduled_at,
         v.scheduled_at + make_interval(mins => COALESCE(v.duration_minutes, 45))
    FROM public.visits v
   WHERE v.agent_id = p_agent_id
     AND v.status IN ('planned', 'confirmed')
     AND tstzrange(v.scheduled_at,
                   v.scheduled_at + make_interval(mins => COALESCE(v.duration_minutes, 45)),
                   '[)') && tstzrange(p_from, p_to, '[)')
$$;

COMMENT ON FUNCTION public.kyc_booking_busy_ranges(uuid, timestamptz, timestamptz, uuid) IS
  'Source unique de « l''agent est occupe » : absences + RDV confirmes + visites de bien. Consommee par le calcul des creneaux (edge) ET par la validation de reservation, pour qu''ils ne divergent pas.';

-- ----------------------------------------------------------------------------
-- 3. kyc_slot_rejection — le créneau est-il réservable ? (NULL = oui)
-- ----------------------------------------------------------------------------
-- Retourne un CODE d'erreur stable plutôt que de lever : les appelants (book,
-- reschedule) veulent décider quoi en faire, et l'edge doit pouvoir traduire ce
-- code en message client dans les 4 langues.
CREATE OR REPLACE FUNCTION public.kyc_slot_rejection(
  p_agent_id   uuid,
  p_starts_at  timestamptz,
  p_ends_at    timestamptz,
  p_exclude_id uuid DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  s         public.agent_booking_settings%ROWTYPE;
  v_local   timestamp;
  v_dow     text;
  v_t_start time;
  v_t_end   time;
  v_inside  boolean;
BEGIN
  SELECT * INTO s FROM public.agent_booking_settings WHERE agent_id = p_agent_id;
  IF NOT FOUND OR NOT s.is_open THEN RETURN 'booking_closed'; END IF;

  IF p_ends_at <= p_starts_at THEN RETURN 'bad_range'; END IF;

  IF p_starts_at < now() + make_interval(hours => s.min_notice_hours) THEN RETURN 'too_soon'; END IF;
  IF p_starts_at > now() + make_interval(days  => s.max_advance_days) THEN RETURN 'too_far';  END IF;

  -- Comparaison en heure LOCALE de l'agent : la grille hebdomadaire est écrite en
  -- heures murales, pas en UTC. C'est ici que se joue la correction DST — deux
  -- fois l'an, le même 09:00 local ne tombe pas au même instant UTC.
  v_local   := p_starts_at AT TIME ZONE s.timezone;
  v_dow     := to_char(v_local, 'ID');            -- 1 = lundi … 7 = dimanche
  v_t_start := v_local::time;
  v_t_end   := (p_ends_at AT TIME ZONE s.timezone)::time;

  -- Un créneau franchissant minuit n'est pas comparable à une plage [HH:MM,HH:MM].
  -- Il n'a de toute façon aucun sens pour une vérification d'identité.
  IF v_t_end <= v_t_start THEN RETURN 'crosses_midnight'; END IF;

  SELECT EXISTS (
    SELECT 1
      FROM jsonb_array_elements(COALESCE(s.weekly_hours -> v_dow, '[]'::jsonb)) w
     WHERE (w ->> 0)::time <= v_t_start
       AND (w ->> 1)::time >= v_t_end
  ) INTO v_inside;
  IF NOT v_inside THEN RETURN 'outside_hours'; END IF;

  -- Sonde élargie du battement de part et d'autre : `buffer_minutes` doit séparer
  -- ce RDV du précédent ET du suivant, sinon le battement ne protège que dans un
  -- sens et deux RDV peuvent se coller dos à dos.
  IF EXISTS (
    SELECT 1 FROM public.kyc_booking_busy_ranges(
      p_agent_id,
      p_starts_at - make_interval(mins => s.buffer_minutes),
      p_ends_at   + make_interval(mins => s.buffer_minutes),
      p_exclude_id)
  ) THEN
    RETURN 'slot_taken';
  END IF;

  RETURN NULL;
END $$;

COMMENT ON FUNCTION public.kyc_slot_rejection(uuid, timestamptz, timestamptz, uuid) IS
  'NULL si le creneau est reservable, sinon un code stable : booking_closed | bad_range | too_soon | too_far | crosses_midnight | outside_hours | slot_taken.';

-- ----------------------------------------------------------------------------
-- 4. book_kyc_appointment — la réservation client
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.book_kyc_appointment(
  p_magic_link_id     uuid,
  p_starts_at         timestamptz,
  p_mode              text DEFAULT NULL,
  p_client_note       text DEFAULT NULL,
  p_client_ip         text DEFAULT NULL,
  p_client_user_agent text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  l        public.kyc_magic_links%ROWTYPE;
  s        public.agent_booking_settings%ROWTYPE;
  v_ends   timestamptz;
  v_err    text;
  v_mode   text;
  v_id     uuid;
BEGIN
  SELECT * INTO l FROM public.kyc_magic_links WHERE id = p_magic_link_id;
  IF NOT FOUND            THEN RAISE EXCEPTION 'link_not_found'; END IF;
  IF l.expires_at < now() THEN RAISE EXCEPTION 'link_expired';   END IF;

  -- L'agent du rendez-vous est celui qui a émis le lien. Sans lui, aucun agenda
  -- de référence : on refuse plutôt que de rattacher le RDV à un agent arbitraire.
  IF l.created_by IS NULL THEN RAISE EXCEPTION 'no_agent'; END IF;

  -- Un lien = un rendez-vous. Sans cette garde, un client rechargeant la page de
  -- confirmation pourrait empiler les créneaux dans l'agenda de l'agent.
  IF EXISTS (
    SELECT 1 FROM public.appointments
     WHERE magic_link_id = p_magic_link_id AND status = 'confirmed'
  ) THEN
    RAISE EXCEPTION 'already_booked';
  END IF;

  SELECT * INTO s FROM public.agent_booking_settings WHERE agent_id = l.created_by;
  IF NOT FOUND THEN RAISE EXCEPTION 'booking_closed'; END IF;

  v_ends := p_starts_at + make_interval(mins => s.slot_minutes);
  v_mode := COALESCE(p_mode, s.default_mode);
  IF v_mode NOT IN ('sur_place', 'video') THEN RAISE EXCEPTION 'bad_mode'; END IF;

  v_err := public.kyc_slot_rejection(l.created_by, p_starts_at, v_ends);
  IF v_err IS NOT NULL THEN RAISE EXCEPTION '%', v_err; END IF;

  -- Attribution : geste du CLIENT via le lien magique, pas de l'agent. Même
  -- convention que record_buyer_reaction.
  PERFORM set_config('app.actor_kind', 'system', true);
  PERFORM set_config('app.actor_via',  'kyc_booking', true);

  BEGIN
    INSERT INTO public.appointments (
      agency_id, agent_id, contact_id, kyc_case_id, magic_link_id,
      mode, starts_at, ends_at, location, client_note,
      booked_by, client_ip, client_user_agent
    ) VALUES (
      l.agency_id, l.created_by, l.contact_id, l.kyc_case_id, l.id,
      v_mode, p_starts_at, v_ends, s.location_label, NULLIF(btrim(p_client_note), ''),
      'client', p_client_ip, p_client_user_agent
    ) RETURNING id INTO v_id;
  EXCEPTION WHEN exclusion_violation THEN
    -- Deux clients ont validé le même créneau dans le même instant : le second
    -- arrive ici. `kyc_slot_rejection` ne peut pas l'éviter — elle lit avant que
    -- l'autre transaction n'ait écrit.
    RAISE EXCEPTION 'slot_taken';
  END;

  INSERT INTO public.activity_events
    (agency_id, actor_id, actor_kind, action, entity_type, entity_id,
     category, severity, object_label, metadata)
  VALUES (
    l.agency_id, NULL, 'system',
    'Rendez-vous de vérification réservé par le client',
    'appointment', v_id, 'kyc', 'info',
    to_char(p_starts_at AT TIME ZONE s.timezone, 'DD.MM.YYYY HH24:MI'),
    jsonb_build_object('contact_id', l.contact_id, 'kyc_case_id', l.kyc_case_id,
                       'magic_link_id', l.id, 'mode', v_mode, 'via', 'kyc_booking')
  );

  RETURN v_id;
END $$;

-- ----------------------------------------------------------------------------
-- 5. reschedule_kyc_appointment — report client (2 maximum)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reschedule_kyc_appointment(
  p_appointment_id uuid,
  p_new_starts_at  timestamptz,
  p_client_ip      text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  a      public.appointments%ROWTYPE;
  s      public.agent_booking_settings%ROWTYPE;
  v_ends timestamptz;
  v_err  text;
BEGIN
  SELECT * INTO a FROM public.appointments WHERE id = p_appointment_id;
  IF NOT FOUND               THEN RAISE EXCEPTION 'appointment_not_found'; END IF;
  IF a.status <> 'confirmed' THEN RAISE EXCEPTION 'not_reschedulable';     END IF;

  SELECT * INTO s FROM public.agent_booking_settings WHERE agent_id = a.agent_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'booking_closed'; END IF;

  -- Fenêtre de prévenance : à moins de min_notice_hours du RDV, le client passe
  -- par l'agent. Un report la veille au soir d'une vérification d'identité n'est
  -- pas un geste self-service.
  IF a.starts_at < now() + make_interval(hours => s.min_notice_hours) THEN
    RAISE EXCEPTION 'too_late_to_change';
  END IF;

  IF a.reschedule_count >= 2 THEN RAISE EXCEPTION 'reschedule_limit_reached'; END IF;

  v_ends := p_new_starts_at + make_interval(mins => s.slot_minutes);
  -- p_appointment_id exclu de la sonde d'occupation : sinon le RDV se bloquerait
  -- lui-même dès que la nouvelle plage recouvre l'ancienne.
  v_err  := public.kyc_slot_rejection(a.agent_id, p_new_starts_at, v_ends, p_appointment_id);
  IF v_err IS NOT NULL THEN RAISE EXCEPTION '%', v_err; END IF;

  PERFORM set_config('app.actor_kind', 'system', true);
  PERFORM set_config('app.actor_via',  'kyc_booking', true);

  BEGIN
    UPDATE public.appointments
       SET starts_at         = p_new_starts_at,
           ends_at           = v_ends,
           reschedule_count  = reschedule_count + 1,
           client_ip         = COALESCE(p_client_ip, client_ip),
           updated_at        = now()
     WHERE id = p_appointment_id;
  EXCEPTION WHEN exclusion_violation THEN
    RAISE EXCEPTION 'slot_taken';
  END;

  INSERT INTO public.activity_events
    (agency_id, actor_id, actor_kind, action, entity_type, entity_id,
     category, severity, object_label, metadata)
  VALUES (
    a.agency_id, NULL, 'system',
    'Rendez-vous de vérification reporté par le client',
    'appointment', a.id, 'kyc', 'info',
    to_char(p_new_starts_at AT TIME ZONE s.timezone, 'DD.MM.YYYY HH24:MI'),
    jsonb_build_object('contact_id', a.contact_id, 'kyc_case_id', a.kyc_case_id,
                       'from', a.starts_at, 'to', p_new_starts_at,
                       'reschedule_count', a.reschedule_count + 1, 'via', 'kyc_booking')
  );
END $$;

-- ----------------------------------------------------------------------------
-- 6. cancel_kyc_appointment — annulation client
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_kyc_appointment(
  p_appointment_id uuid,
  p_client_ip      text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  a public.appointments%ROWTYPE;
  s public.agent_booking_settings%ROWTYPE;
BEGIN
  SELECT * INTO a FROM public.appointments WHERE id = p_appointment_id;
  IF NOT FOUND               THEN RAISE EXCEPTION 'appointment_not_found'; END IF;
  IF a.status <> 'confirmed' THEN RAISE EXCEPTION 'not_cancellable';       END IF;

  SELECT * INTO s FROM public.agent_booking_settings WHERE agent_id = a.agent_id;

  IF a.starts_at < now() + make_interval(hours => COALESCE(s.min_notice_hours, 24)) THEN
    RAISE EXCEPTION 'too_late_to_change';
  END IF;

  PERFORM set_config('app.actor_kind', 'system', true);
  PERFORM set_config('app.actor_via',  'kyc_booking', true);

  -- Annulation, jamais suppression : la trace qu'une vérification avait été
  -- posée puis annulée fait partie de la piste d'audit LAB/KYC.
  UPDATE public.appointments
     SET status       = 'cancelled',
         cancelled_at = now(),
         cancelled_by = 'client',
         client_ip    = COALESCE(p_client_ip, client_ip),
         updated_at   = now()
   WHERE id = p_appointment_id;

  INSERT INTO public.activity_events
    (agency_id, actor_id, actor_kind, action, entity_type, entity_id,
     category, severity, object_label, metadata)
  VALUES (
    a.agency_id, NULL, 'system',
    'Rendez-vous de vérification annulé par le client',
    'appointment', a.id, 'kyc', 'warn',
    to_char(a.starts_at AT TIME ZONE COALESCE(s.timezone, 'Europe/Zurich'), 'DD.MM.YYYY HH24:MI'),
    jsonb_build_object('contact_id', a.contact_id, 'kyc_case_id', a.kyc_case_id,
                       'was_at', a.starts_at, 'via', 'kyc_booking')
  );
END $$;

-- ----------------------------------------------------------------------------
-- 7. get_kyc_appointment_public — ce que la page client a le droit de voir
-- ----------------------------------------------------------------------------
-- Liste blanche stricte. Surtout PAS `SELECT *` : la table porte client_ip,
-- client_user_agent et external_event_id, qui n'ont rien à faire dans une
-- réponse publique.
CREATE OR REPLACE FUNCTION public.get_kyc_appointment_public(p_appointment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  a public.appointments%ROWTYPE;
  s public.agent_booking_settings%ROWTYPE;
BEGIN
  SELECT * INTO a FROM public.appointments WHERE id = p_appointment_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT * INTO s FROM public.agent_booking_settings WHERE agent_id = a.agent_id;

  RETURN jsonb_build_object(
    'id',               a.id,
    'starts_at',        a.starts_at,
    'ends_at',          a.ends_at,
    'status',           a.status,
    'mode',             a.mode,
    'location',         a.location,
    'video_link',       a.video_link,
    'timezone',         COALESCE(s.timezone, 'Europe/Zurich'),
    'reschedule_count', a.reschedule_count,
    -- Permet à l'UI de griser « annuler / reporter » au lieu de laisser le client
    -- cliquer pour récolter une erreur.
    'can_change',       (a.status = 'confirmed'
                         AND a.reschedule_count < 2
                         AND a.starts_at >= now() + make_interval(hours => COALESCE(s.min_notice_hours, 24)))
  );
END $$;

-- ----------------------------------------------------------------------------
-- 8. Verrouillage des droits
-- ----------------------------------------------------------------------------
-- Ces fonctions sont SECURITY DEFINER : sans REVOKE, `anon` et `authenticated`
-- les appelleraient avec les droits du propriétaire et contourneraient toute la
-- RLS du socle. Même discipline que 20260711210000_secdef_execute_revoke.
REVOKE ALL ON FUNCTION public.kyc_booking_busy_ranges(uuid, timestamptz, timestamptz, uuid)   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.kyc_slot_rejection(uuid, timestamptz, timestamptz, uuid)        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.book_kyc_appointment(uuid, timestamptz, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reschedule_kyc_appointment(uuid, timestamptz, text)             FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_kyc_appointment(uuid, text)                              FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_kyc_appointment_public(uuid)                                FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.kyc_booking_busy_ranges(uuid, timestamptz, timestamptz, uuid)   TO service_role;
GRANT EXECUTE ON FUNCTION public.kyc_slot_rejection(uuid, timestamptz, timestamptz, uuid)        TO service_role;
GRANT EXECUTE ON FUNCTION public.book_kyc_appointment(uuid, timestamptz, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.reschedule_kyc_appointment(uuid, timestamptz, text)             TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_kyc_appointment(uuid, text)                              TO service_role;
GRANT EXECUTE ON FUNCTION public.get_kyc_appointment_public(uuid)                                TO service_role;


-- ----------------------------------------------------------------------------
-- 9. appointments.updated_at — horodatage automatique
-- ----------------------------------------------------------------------------
-- Signalé par 20260802190000_adopte_tables_rdv.sql : la colonne existait sans
-- aucun trigger, donc restait figée à sa valeur d'insertion.
--
-- Les RPC ci-dessus la posaient déjà explicitement, ce qui masquait le trou :
-- il ne s'ouvre que sur les écritures DIRECTES de l'agent, autorisées par les
-- policies `appt_agency_update` (annuler, marquer « effectué » depuis le CRM).
-- Ces écritures-là laissaient `updated_at` mentir.
--
-- Fonction dédiée plutôt que le `update_updated_at()` générique : ce dernier ne
-- vit que dans `supabase/migrations/_archived/`, que la CLI ne rejoue pas — il
-- serait absent d'une base fraîche de CI.
CREATE OR REPLACE FUNCTION public.update_appointments_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_appointments_updated_at ON public.appointments;
CREATE TRIGGER trg_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_appointments_updated_at();

-- ----------------------------------------------------------------------------
-- 10. Pourquoi les policies d'`appointments` sont TOUTES `TO authenticated`
-- ----------------------------------------------------------------------------
-- Question soulevée par 20260802190000_adopte_tables_rdv.sql : le commentaire de
-- la table décrit une réservation « par le client depuis son lien magique »,
-- alors qu'aucune policy ne vise `anon` — un client anonyme ne peut donc RIEN y
-- insérer. C'est EXACT, et c'est VOULU.
--
-- Le client n'atteint jamais PostgREST. Il appelle une edge function, qui
-- vérifie son token HMAC puis invoque `book_kyc_appointment` avec la clé de
-- service. La RLS n'est pas le point de contrôle du chemin public : la
-- vérification de signature l'est, et elle vit là où le secret vit.
--
-- ⛔ NE PAS « CORRIGER » EN AJOUTANT UNE POLICY `anon`. Une policy d'insertion
-- ouverte à `anon` sur cette table rouvrirait exactement la faille
-- `rls_policy_always_true` corrigée en 20260711190000, où
-- `manage_token IS NOT NULL` exposait TOUTES les visites. Le trou serait ici
-- pire : `appointments` porte contact_id, kyc_case_id et l'IP du client.
COMMENT ON TABLE public.appointments IS
  'Rendez-vous SANS bien — aujourd''hui la vérification d''identité KYC, réservée par le client depuis son lien magique. Distinct de `visits`, qui est une visite de bien (property_id NOT NULL, bon/rapport/matching). ⚠ Les policies sont volontairement toutes TO authenticated : le client public passe par une edge function + RPC service_role, JAMAIS par PostgREST. N''ajoutez pas de policy anon (cf. faille rls_policy_always_true, migration 20260711190000).';
