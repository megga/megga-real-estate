


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."agency_plan" AS ENUM (
    'starter',
    'pro',
    'agency',
    'enterprise'
);


ALTER TYPE "public"."agency_plan" OWNER TO "postgres";


CREATE TYPE "public"."contact_score" AS ENUM (
    'hot',
    'warm',
    'cold'
);


ALTER TYPE "public"."contact_score" OWNER TO "postgres";


CREATE TYPE "public"."contact_type" AS ENUM (
    'buyer',
    'seller',
    'both',
    'lead'
);


ALTER TYPE "public"."contact_type" OWNER TO "postgres";


CREATE TYPE "public"."crm_offer_kind" AS ENUM (
    'offer',
    'counter'
);


ALTER TYPE "public"."crm_offer_kind" OWNER TO "postgres";


CREATE TYPE "public"."crm_offer_party" AS ENUM (
    'buyer',
    'seller'
);


ALTER TYPE "public"."crm_offer_party" OWNER TO "postgres";


CREATE TYPE "public"."crm_offer_status" AS ENUM (
    'pending',
    'accepted',
    'rejected',
    'expired',
    'withdrawn'
);


ALTER TYPE "public"."crm_offer_status" OWNER TO "postgres";


CREATE TYPE "public"."document_status" AS ENUM (
    'pending',
    'validated',
    'rejected'
);


ALTER TYPE "public"."document_status" OWNER TO "postgres";


CREATE TYPE "public"."kyc_magic_link_mode" AS ENUM (
    'libre',
    'verifiee'
);


ALTER TYPE "public"."kyc_magic_link_mode" OWNER TO "postgres";


CREATE TYPE "public"."kyc_magic_link_status" AS ENUM (
    'pending',
    'opened',
    'uploading',
    'verifying',
    'submitted',
    'expired'
);


ALTER TYPE "public"."kyc_magic_link_status" OWNER TO "postgres";


CREATE TYPE "public"."kyc_magic_link_upload_type" AS ENUM (
    'identity',
    'address',
    'funds',
    'other'
);


ALTER TYPE "public"."kyc_magic_link_upload_type" OWNER TO "postgres";


CREATE TYPE "public"."kyc_person_type" AS ENUM (
    'buyer_pp',
    'buyer_pm',
    'seller_pp',
    'seller_pm'
);


ALTER TYPE "public"."kyc_person_type" OWNER TO "postgres";


CREATE TYPE "public"."kyc_risk_level" AS ENUM (
    'low',
    'medium',
    'high',
    'unassessed'
);


ALTER TYPE "public"."kyc_risk_level" OWNER TO "postgres";


CREATE TYPE "public"."kyc_source_of_funds_type" AS ENUM (
    'salary',
    'sale_property',
    'sale_business',
    'inheritance',
    'investment',
    'crypto',
    'loan',
    'mixed',
    'other'
);


ALTER TYPE "public"."kyc_source_of_funds_type" OWNER TO "postgres";


CREATE TYPE "public"."kyc_status" AS ENUM (
    'pending',
    'in_progress',
    'review',
    'validated',
    'rejected'
);


ALTER TYPE "public"."kyc_status" OWNER TO "postgres";


CREATE TYPE "public"."listing_report_reason" AS ENUM (
    'wrong_price',
    'already_taken',
    'wrong_photos',
    'inaccurate_description',
    'spam_fraud',
    'other'
);


ALTER TYPE "public"."listing_report_reason" OWNER TO "postgres";


CREATE TYPE "public"."listing_report_status" AS ENUM (
    'open',
    'reviewing',
    'resolved',
    'dismissed'
);


ALTER TYPE "public"."listing_report_status" OWNER TO "postgres";


CREATE TYPE "public"."mandate_type" AS ENUM (
    'simple',
    'semi_exclusive',
    'exclusive'
);


ALTER TYPE "public"."mandate_type" OWNER TO "postgres";


CREATE TYPE "public"."property_status" AS ENUM (
    'draft',
    'active',
    'reserved',
    'sold',
    'archived'
);


ALTER TYPE "public"."property_status" OWNER TO "postgres";


CREATE TYPE "public"."property_type" AS ENUM (
    'apartment',
    'house',
    'villa',
    'commercial',
    'land'
);


ALTER TYPE "public"."property_type" OWNER TO "postgres";


CREATE TYPE "public"."transaction_stage" AS ENUM (
    'lead',
    'qualified',
    'visit_planned',
    'offer',
    'negotiation',
    'reserved',
    'financing',
    'notary',
    'signed',
    'closed',
    'new_lead',
    'to_qualify',
    'active_search',
    'visit_done',
    'interest_confirmed',
    'lost',
    'to_recontact',
    'visit_planned_legacy'
);


ALTER TYPE "public"."transaction_stage" OWNER TO "postgres";


COMMENT ON TYPE "public"."transaction_stage" IS 'Sprint 3 (A.1 note) : enum aligné sur la CHECK constraint transactions_stage_check. 18 valeurs au total : 10 originales (lead, qualified, visit_planned, offer, negotiation, reserved, financing, notary, signed, closed) + 8 ajoutées (new_lead, to_qualify, active_search, visit_done, interest_confirmed, lost, to_recontact, visit_planned_legacy).';



CREATE TYPE "public"."transaction_status" AS ENUM (
    'active',
    'on_hold',
    'cancelled',
    'completed'
);


ALTER TYPE "public"."transaction_status" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'buyer',
    'seller',
    'agent',
    'manager',
    'admin',
    'assistant'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ai_actions_queue_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."ai_actions_queue_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."audit_crm_offer_event"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_action TEXT;
  v_severity TEXT := 'info';
  v_actor UUID := COALESCE(NEW.created_by, auth.uid());
BEGIN
  -- INSERT : nouvelle offre ou contre-offre
  IF TG_OP = 'INSERT' THEN
    v_action := CASE NEW.kind
      WHEN 'counter' THEN 'Contre-offre envoyée'
      ELSE 'Offre créée'
    END;
  -- UPDATE : transitions de status
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    v_action := CASE NEW.status
      WHEN 'accepted'  THEN 'Offre acceptée'
      WHEN 'rejected'  THEN 'Offre refusée'
      WHEN 'expired'   THEN 'Offre expirée'
      WHEN 'withdrawn' THEN 'Offre retirée'
      ELSE NULL
    END;
    IF v_action IS NULL THEN RETURN NEW; END IF;
    -- Pas d'acteur si la transition vient du cron (expired) — on garde NULL
    IF NEW.status = 'expired' THEN v_actor := NULL; END IF;
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO activity_events
    (agency_id, actor_id, action, entity_type, entity_id,
     category, severity, object_label, metadata)
  VALUES (
    NEW.agency_id,
    v_actor,
    v_action,
    'crm_offer',
    NEW.id,
    'deal',
    v_severity,
    NEW.by_label || ' · CHF ' || NEW.amount::TEXT,
    jsonb_build_object(
      'deal_id', NEW.deal_id,
      'kind', NEW.kind,
      'from_party', NEW.from_party,
      'amount', NEW.amount,
      'currency', NEW.currency,
      'parent_offer_id', NEW.parent_offer_id,
      'status', NEW.status,
      'expires_at', NEW.expires_at
    )
  );

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."audit_crm_offer_event"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."audit_kyc_magic_link_transitions"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_action TEXT;
  v_severity TEXT;
BEGIN
  -- INSERT = lien créé
  IF TG_OP = 'INSERT' THEN
    INSERT INTO activity_events
      (agency_id, actor_id, action, entity_type, entity_id,
       category, severity, object_label, metadata, actor_kind)
    VALUES (
      NEW.agency_id,
      NEW.created_by,
      'Lien magique KYC créé',
      'kyc_magic_link',
      NEW.id,
      'kyc',
      'info',
      'Lien ' || NEW.id::TEXT,
      jsonb_build_object(
        'kyc_case_id', NEW.kyc_case_id,
        'contact_id', NEW.contact_id,
        'mode', NEW.mode,
        'channels', NEW.channels,
        'expires_at', NEW.expires_at,
        'lba_article', 'art. 3 (identification)'
      ),
      -- M1 fix : actor_kind explicite (défensif si Edge function service_role
      -- insère sans auth.uid() ni created_by → fallback 'system' cohérent)
      CASE WHEN NEW.created_by IS NOT NULL THEN 'user'::TEXT ELSE 'system'::TEXT END
    );
    RETURN NEW;
  END IF;

  -- UPDATE = transition de status
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    v_action := CASE NEW.status
      WHEN 'opened' THEN 'Lien magique KYC ouvert par le client'
      WHEN 'uploading' THEN 'Pièces téléversées par le client'
      WHEN 'verifying' THEN 'Client en cours de vérification OCR'
      WHEN 'submitted' THEN 'Dossier soumis par le client (KYC complet)'
      WHEN 'expired' THEN 'Lien magique expiré sans soumission'
      ELSE 'Transition status lien magique : ' || NEW.status::TEXT
    END;
    v_severity := CASE NEW.status
      WHEN 'submitted' THEN 'info'
      WHEN 'expired' THEN 'warn'
      ELSE 'info'
    END;

    INSERT INTO activity_events
      (agency_id, actor_id, action, entity_type, entity_id,
       category, severity, object_label, metadata, actor_kind)
    VALUES (
      NEW.agency_id,
      NULL,  -- transitions déclenchées côté public, pas par un agent authentifié
      v_action,
      'kyc_magic_link',
      NEW.id,
      'kyc',
      v_severity,
      'Lien ' || NEW.id::TEXT,
      jsonb_build_object(
        'kyc_case_id', NEW.kyc_case_id,
        'previous_status', OLD.status,
        'new_status', NEW.status,
        'mode', NEW.mode,
        'client_ip', NEW.client_ip,
        'lba_article', 'art. 7 al. 1 (documentation)'
      ),
      'system'
    );

    NEW.updated_at := NOW();
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."audit_kyc_magic_link_transitions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_verify_kyc_dossier"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_remaining_required INTEGER;
  v_agency_id UUID;
  v_current_status TEXT;
  v_sanctions_status TEXT;
  v_pep_status TEXT;
  v_block_reason TEXT;
  v_sanctions_decision TEXT;
  v_pep_decision TEXT;
BEGIN
  -- Ne trigger QUE quand un check passe FALSE → TRUE
  IF NEW.is_completed IS NOT TRUE OR OLD.is_completed IS TRUE THEN
    RETURN NEW;
  END IF;

  SELECT
    agency_id,
    dossier_status,
    sanctions_status,
    pep_status
  INTO
    v_agency_id,
    v_current_status,
    v_sanctions_status,
    v_pep_status
  FROM kyc_cases
  WHERE id = NEW.kyc_case_id;

  -- (a) AuditEvent : contrôle individuel validé
  INSERT INTO activity_events
    (agency_id, actor_id, action, entity_type, entity_id,
     category, severity, object_label, metadata)
  VALUES (
    v_agency_id,
    COALESCE(NEW.completed_by, auth.uid()),
    'Contrôle validé',
    'kyc_check',
    NEW.id,
    'kyc',
    'info',
    NEW.label,
    jsonb_build_object('category', NEW.category, 'kyc_case_id', NEW.kyc_case_id)
  );

  SELECT COUNT(*) INTO v_remaining_required
  FROM kyc_checklist_items
  WHERE kyc_case_id = NEW.kyc_case_id
    AND is_required = TRUE
    AND is_completed = FALSE;

  IF v_remaining_required = 0 THEN
    -- Récupère les décisions compliance les plus récentes (non supersedées)
    SELECT decision INTO v_sanctions_decision
    FROM kyc_screening_decisions d
    WHERE d.kyc_case_id = NEW.kyc_case_id
      AND d.decision_target = 'sanctions'
      AND NOT EXISTS (
        SELECT 1 FROM kyc_screening_decisions d2
        WHERE d2.supersedes_id = d.id
      )
    ORDER BY d.decided_at DESC LIMIT 1;

    SELECT decision INTO v_pep_decision
    FROM kyc_screening_decisions d
    WHERE d.kyc_case_id = NEW.kyc_case_id
      AND d.decision_target = 'pep'
      AND NOT EXISTS (
        SELECT 1 FROM kyc_screening_decisions d2
        WHERE d2.supersedes_id = d.id
      )
    ORDER BY d.decided_at DESC LIMIT 1;

    v_block_reason := NULL;

    -- Match sanctions : bloqué SAUF si décision false_positive documentée
    IF v_sanctions_status = 'match' AND COALESCE(v_sanctions_decision, '') <> 'false_positive' THEN
      v_block_reason := CASE
        WHEN v_sanctions_decision IS NULL THEN 'sanctions_match_undecided'
        ELSE 'sanctions_match_' || v_sanctions_decision
      END;
    -- Match PEP : idem
    ELSIF v_pep_status = 'match' AND COALESCE(v_pep_decision, '') <> 'false_positive' THEN
      v_block_reason := CASE
        WHEN v_pep_decision IS NULL THEN 'pep_match_undecided'
        ELSE 'pep_match_' || v_pep_decision
      END;
    ELSIF v_sanctions_status = 'pending' OR v_pep_status = 'pending' THEN
      v_block_reason := 'screening_pending';
    ELSIF v_sanctions_status IS NULL OR v_sanctions_status = 'not_checked'
       OR v_pep_status IS NULL OR v_pep_status = 'not_checked' THEN
      v_block_reason := 'screening_missing';
    END IF;

    IF v_block_reason IS NOT NULL THEN
      UPDATE kyc_cases
      SET dossier_status = CASE
        WHEN v_block_reason LIKE 'sanctions_match%' OR v_block_reason LIKE 'pep_match%' THEN 'failed'
        ELSE 'pending'
      END
      WHERE id = NEW.kyc_case_id
        AND dossier_status NOT IN ('verified', 'failed');

      INSERT INTO activity_events
        (agency_id, actor_id, action, entity_type, entity_id,
         category, severity, object_label, metadata)
      VALUES (
        v_agency_id,
        COALESCE(NEW.completed_by, auth.uid()),
        'Validation KYC bloquée',
        'kyc_case',
        NEW.kyc_case_id,
        'kyc',
        'critical',
        'Dossier ' || NEW.kyc_case_id::TEXT,
        jsonb_build_object(
          'block_reason', v_block_reason,
          'sanctions_status', v_sanctions_status,
          'pep_status', v_pep_status,
          'sanctions_decision', v_sanctions_decision,
          'pep_decision', v_pep_decision,
          'lba_article', CASE
            WHEN v_block_reason LIKE 'sanctions_match%' OR v_block_reason LIKE 'pep_match%' THEN 'art. 9 (MROS)'
            ELSE 'art. 7 (vigilance documentée)'
          END
        )
      );

      RETURN NEW;
    END IF;

    -- Tout est OK (clear OU décision false_positive documentée) → verified
    UPDATE kyc_cases
    SET dossier_status = 'verified',
        validated_at = NOW(),
        expires_at = NOW() + INTERVAL '12 months'
    WHERE id = NEW.kyc_case_id
      AND dossier_status <> 'verified';

    INSERT INTO activity_events
      (agency_id, actor_id, action, entity_type, entity_id,
       category, severity, object_label, metadata)
    VALUES (
      v_agency_id,
      COALESCE(NEW.completed_by, auth.uid()),
      'Dossier KYC validé',
      'kyc_case',
      NEW.kyc_case_id,
      'kyc',
      'info',
      'Dossier ' || NEW.kyc_case_id::TEXT,
      jsonb_build_object(
        'checks_count', 5,
        'sanctions_status', v_sanctions_status,
        'pep_status', v_pep_status,
        'sanctions_decision', v_sanctions_decision,
        'pep_decision', v_pep_decision,
        'expires_at', (NOW() + INTERVAL '12 months')::TEXT
      )
    );
  ELSIF v_current_status = 'none' THEN
    UPDATE kyc_cases
    SET dossier_status = 'pending'
    WHERE id = NEW.kyc_case_id;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_verify_kyc_dossier"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."auto_verify_kyc_dossier"() IS 'Trigger AFTER UPDATE kyc_checklist_items. Passe verified UNIQUEMENT si tous les checks requis ET screening clear OU décision false_positive documentée (table kyc_screening_decisions). Match sans décision OU avec décision true_match/escalated/awaiting_evidence → failed + AuditEvent critical.';



CREATE OR REPLACE FUNCTION "public"."calculate_sla"("p_priority" "text", "p_created_at" timestamp with time zone) RETURNS TABLE("first_response_due" timestamp with time zone, "resolution_due" timestamp with time zone)
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  CASE p_priority
    WHEN 'urgent' THEN
      first_response_due := p_created_at + INTERVAL '1 hour';
      resolution_due := p_created_at + INTERVAL '4 hours';
    WHEN 'high' THEN
      first_response_due := p_created_at + INTERVAL '4 hours';
      resolution_due := p_created_at + INTERVAL '24 hours';
    WHEN 'medium' THEN
      first_response_due := p_created_at + INTERVAL '8 hours';
      resolution_due := p_created_at + INTERVAL '48 hours';
    WHEN 'low' THEN
      first_response_due := p_created_at + INTERVAL '24 hours';
      resolution_due := p_created_at + INTERVAL '72 hours';
    ELSE
      first_response_due := p_created_at + INTERVAL '8 hours';
      resolution_due := p_created_at + INTERVAL '48 hours';
  END CASE;
  RETURN NEXT;
END;
$$;


ALTER FUNCTION "public"."calculate_sla"("p_priority" "text", "p_created_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_auto_send"("p_agent_id" "uuid", "p_action_type" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_prefs   JSONB;
  v_allowed BOOLEAN;
BEGIN
  v_prefs := compute_agent_preferences(p_agent_id);
  IF v_prefs IS NULL THEN
    RETURN FALSE;  -- pré-Day0 : jamais d'auto-envoi
  END IF;
  v_allowed := COALESCE(
    (v_prefs->'autonomy_gate'->>p_action_type)::BOOLEAN,
    FALSE
  );
  RETURN v_allowed;
END;
$$;


ALTER FUNCTION "public"."can_auto_send"("p_agent_id" "uuid", "p_action_type" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."can_auto_send"("p_agent_id" "uuid", "p_action_type" "text") IS 'Helper pour automation-engine + ai-copilot. FALSE = mettre en draft dans ai_actions_queue. TRUE = envoyer puis logger en sent.';



CREATE OR REPLACE FUNCTION "public"."cleanup_orphan_property_drafts"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM properties
    WHERE status = 'draft'
      AND deleted_at IS NULL
      AND updated_at < now() - INTERVAL '30 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."cleanup_orphan_property_drafts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."compute_agent_preferences"("p_agent_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_payload       JSONB;
  v_specialite    TEXT;
  v_zone          JSONB;
  v_dispo         TEXT;
  v_priorite      TEXT;
  v_autonomy      TEXT;
  v_sla           JSONB;
  v_autonomy_gate JSONB;
  v_weights       JSONB;
BEGIN
  -- Lit le payload Premier jour. NULL si l'agent n'a pas encore joué le sas.
  SELECT day0_payload INTO v_payload
    FROM profiles
   WHERE id = p_agent_id;

  IF v_payload IS NULL THEN
    -- Pré-Day0 : retourne NULL pour que les engines en aval skip-ent.
    -- Aucune action IA ne doit partir tant que l'agent n'a pas calibré.
    RETURN NULL;
  END IF;

  v_specialite := v_payload->>'specialite';
  v_zone       := v_payload->'zone';
  v_dispo      := v_payload->>'dispo';
  v_priorite   := v_payload->>'priorite';
  v_autonomy   := v_payload->>'autonomy';

  -- ─── Fenêtre SLA selon dispo ───────────────────────────────────
  -- Voir handoff §"Modèle de données" point 4 : "Calculer les SLA de
  -- relance selon dispo (office=4h ouvrées, wide=8h sur plage élargie,
  -- 247=libre)". Heures locales Europe/Zurich.
  v_sla := CASE v_dispo
    WHEN 'office' THEN jsonb_build_object(
      'hours_start',           9,
      'hours_end',             18,
      'days_of_week',          jsonb_build_array(1,2,3,4,5),
      'response_target_hours', 4
    )
    WHEN 'wide' THEN jsonb_build_object(
      'hours_start',           8,
      'hours_end',             20,
      'days_of_week',          jsonb_build_array(1,2,3,4,5,6),
      'response_target_hours', 8
    )
    WHEN '247' THEN jsonb_build_object(
      'hours_start',           0,
      'hours_end',             24,
      'days_of_week',          jsonb_build_array(1,2,3,4,5,6,7),
      'response_target_hours', NULL  -- libre, pas de SLA
    )
    ELSE NULL
  END;

  -- ─── Gate d'autonomie par type d'action ─────────────────────────
  -- Pilote l'engagement de la synthèse : « Tous mes brouillons restent
  -- en attente de votre validation tant que vous n'élevez pas mon
  -- niveau d'autonomie ».
  --
  -- - suggest : rien d'automatique, tout en draft
  -- - notify  : relances simples (SMS courtoisie, accusés) auto, le reste draft
  -- - resume  : email follow-up et briefings auto, propositions toujours draft
  v_autonomy_gate := CASE v_autonomy
    WHEN 'suggest' THEN jsonb_build_object(
      'relance_simple',   false,
      'sms_courtoisie',   false,
      'accuse_reception', false,
      'email_followup',   false,
      'briefing_today',   false,
      'proposal_send',    false
    )
    WHEN 'notify' THEN jsonb_build_object(
      'relance_simple',   true,
      'sms_courtoisie',   true,
      'accuse_reception', true,
      'email_followup',   false,
      'briefing_today',   true,
      'proposal_send',    false
    )
    WHEN 'resume' THEN jsonb_build_object(
      'relance_simple',   true,
      'sms_courtoisie',   true,
      'accuse_reception', true,
      'email_followup',   true,
      'briefing_today',   true,
      -- 'proposal_send' reste toujours false : envoyer une proposition
      -- commerciale au nom de l'agent doit TOUJOURS être validé. Human-
      -- in-the-loop non négociable côté compliance.
      'proposal_send',    false
    )
    ELSE jsonb_build_object()  -- autonomy inconnue → tout interdit
  END;

  -- ─── Pondérations par priorité 30j ─────────────────────────────
  -- Voir handoff §"Phase today" : la priorité Q4 pilote les 3 cartes
  -- proposées le matin. Ici on l'exprime en poids relatifs pour que
  -- le morning briefing (et le scoring) sache où mettre l'emphase.
  v_weights := CASE v_priorite
    WHEN 'acquisition' THEN jsonb_build_object(
      'new_lead',     1.0,
      'dormant',      0.3,
      'deal_active',  0.5,
      'sourcing',     0.9  -- prospect matching
    )
    WHEN 'closing' THEN jsonb_build_object(
      'new_lead',     0.4,
      'dormant',      0.5,
      'deal_active',  1.0,
      'sourcing',     0.4
    )
    WHEN 'fidelisation' THEN jsonb_build_object(
      'new_lead',     0.5,
      'dormant',      1.0,  -- l'engagement explicite : "+60j silencieux"
      'deal_active',  0.6,
      'sourcing',     0.3
    )
    ELSE jsonb_build_object(
      'new_lead',     0.5,
      'dormant',      0.5,
      'deal_active',  0.5,
      'sourcing',     0.5
    )
  END;

  RETURN jsonb_build_object(
    'agent_id',         p_agent_id,
    'specialite',       v_specialite,
    'zone_ids',         v_zone,
    'dispo',            v_dispo,
    'priorite',         v_priorite,
    'autonomy',         v_autonomy,
    'sla',              v_sla,
    'autonomy_gate',    v_autonomy_gate,
    'priorite_weights', v_weights,
    'has_calibrated',   true
  );
END;
$$;


ALTER FUNCTION "public"."compute_agent_preferences"("p_agent_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."compute_agent_preferences"("p_agent_id" "uuid") IS 'Décompose profiles.day0_payload en JSONB exploitable par les moteurs IA (SLA, autonomy gate, priorité weights). Retourne NULL si pré-Day0. Source de vérité unique — modifier ici si la sémantique du calibrage change.';



CREATE OR REPLACE FUNCTION "public"."count_market_by_canton"("p_context" "text" DEFAULT 'buy'::"text") RETURNS TABLE("canton" "text", "count" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "statement_timeout" TO '30s'
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT
    ml.canton,
    COUNT(*)::BIGINT as count
  FROM market_listings ml
  WHERE ml.transaction_type = p_context
    AND ml.status IN ('active', 'price_reduced')
    AND ml.canton IS NOT NULL
    AND ml.canton != ''
  GROUP BY ml.canton
  ORDER BY count DESC;
$$;


ALTER FUNCTION "public"."count_market_by_canton"("p_context" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."count_market_by_type"("p_context" "text" DEFAULT 'buy'::"text") RETURNS TABLE("type" "text", "count" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "statement_timeout" TO '30s'
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT
    ml.type,
    COUNT(*)::BIGINT as count
  FROM market_listings ml
  WHERE ml.transaction_type = p_context
    AND ml.status IN ('active', 'price_reduced')
    AND ml.type IS NOT NULL
  GROUP BY ml.type
  ORDER BY count DESC;
$$;


ALTER FUNCTION "public"."count_market_by_type"("p_context" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_agency_and_join"("p_name" "text", "p_city" "text", "p_canton" "text", "p_solo" boolean) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_slug TEXT;
  v_id   UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  v_slug := lower(regexp_replace(btrim(p_name), '\s+', '-', 'g'));
  IF EXISTS (SELECT 1 FROM agencies WHERE slug = v_slug) THEN
    v_slug := v_slug || '-' || substring(gen_random_uuid()::text, 1, 6);
  END IF;

  INSERT INTO agencies (name, slug, city, canton, solo, plan, status, created_by)
  VALUES (btrim(p_name), v_slug, btrim(p_city), p_canton, COALESCE(p_solo, false),
          'starter', 'active', v_uid)
  RETURNING id INTO v_id;

  UPDATE profiles
     SET agency_id = v_id,
         role = CASE
           WHEN role IN ('manager', 'admin', 'agent', 'assistant') THEN role
           ELSE 'admin'::user_role
         END
   WHERE id = v_uid;

  RETURN v_id;
END;
$$;


ALTER FUNCTION "public"."create_agency_and_join"("p_name" "text", "p_city" "text", "p_canton" "text", "p_solo" boolean) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_agency_and_join"("p_name" "text", "p_city" "text", "p_canton" "text", "p_solo" boolean) IS 'Création d''agence + attache atomique au user courant (devient admin). Anti-doublon strict via unique index sur lower(btrim(name)).';



CREATE OR REPLACE FUNCTION "public"."create_lead_with_optional_deal"("p_first_name" "text", "p_last_name" "text", "p_email" "text" DEFAULT NULL::"text", "p_phone" "text" DEFAULT NULL::"text", "p_type" "text" DEFAULT 'buyer'::"text", "p_source" "text" DEFAULT 'import'::"text", "p_score" "text" DEFAULT 'warm'::"text", "p_tags" "text"[] DEFAULT '{}'::"text"[], "p_notes" "text" DEFAULT NULL::"text", "p_budget_announced" numeric DEFAULT NULL::numeric, "p_search_zones" "text"[] DEFAULT '{}'::"text"[], "p_import_raw_text" "text" DEFAULT NULL::"text", "p_create_deal" boolean DEFAULT false, "p_deal_stage" "text" DEFAULT 'new_lead'::"text", "p_deal_notes" "text" DEFAULT NULL::"text", "p_deal_role" "text" DEFAULT 'buyer'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_agency_id UUID := get_user_agency_id();
  v_user_id   UUID := auth.uid();
  v_contact_id UUID;
  v_deal_id    UUID;
BEGIN
  -- Validation minimum
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  IF p_first_name IS NULL OR p_last_name IS NULL THEN
    RAISE EXCEPTION 'first_name_and_last_name_required' USING ERRCODE = '23502';
  END IF;

  -- 1. INSERT contact
  INSERT INTO contacts (
    agency_id, user_id,
    first_name, last_name, email, phone,
    type, source, score, tags, notes,
    budget_announced, search_zones,
    import_raw_text, import_raw_text_received_at
  )
  VALUES (
    v_agency_id, v_user_id,
    p_first_name, p_last_name, NULLIF(p_email, ''), NULLIF(p_phone, ''),
    p_type, p_source, p_score, p_tags, p_notes,
    p_budget_announced, p_search_zones,
    NULLIF(p_import_raw_text, ''),
    CASE WHEN p_import_raw_text IS NOT NULL AND p_import_raw_text <> '' THEN NOW() ELSE NULL END
  )
  RETURNING id INTO v_contact_id;

  -- 2. INSERT deal (optionnel, scope agence obligatoire)
  IF p_create_deal AND v_agency_id IS NOT NULL THEN
    INSERT INTO transactions (
      agency_id,
      contact_buyer_id, contact_seller_id,
      stage, status, notes
    )
    VALUES (
      v_agency_id,
      CASE WHEN p_deal_role = 'seller' THEN NULL ELSE v_contact_id END,
      CASE WHEN p_deal_role = 'seller' THEN v_contact_id ELSE NULL END,
      p_deal_stage::transaction_stage,
      'active',
      p_deal_notes
    )
    RETURNING id INTO v_deal_id;
  END IF;

  -- Tout s'est bien passé → la fonction commit implicitement à la sortie.
  RETURN jsonb_build_object(
    'contact_id', v_contact_id,
    'deal_id', v_deal_id
  );

  -- Note : un EXCEPTION non capturée provoque un rollback de TOUT (contact + deal)
END;
$$;


ALTER FUNCTION "public"."create_lead_with_optional_deal"("p_first_name" "text", "p_last_name" "text", "p_email" "text", "p_phone" "text", "p_type" "text", "p_source" "text", "p_score" "text", "p_tags" "text"[], "p_notes" "text", "p_budget_announced" numeric, "p_search_zones" "text"[], "p_import_raw_text" "text", "p_create_deal" boolean, "p_deal_stage" "text", "p_deal_notes" "text", "p_deal_role" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."create_lead_with_optional_deal"("p_first_name" "text", "p_last_name" "text", "p_email" "text", "p_phone" "text", "p_type" "text", "p_source" "text", "p_score" "text", "p_tags" "text"[], "p_notes" "text", "p_budget_announced" numeric, "p_search_zones" "text"[], "p_import_raw_text" "text", "p_create_deal" boolean, "p_deal_stage" "text", "p_deal_notes" "text", "p_deal_role" "text") IS 'Sprint 3 (C.4) : création atomique Contact + Deal optionnel depuis Import Lead IA. Si le deal échoue, le contact est rollback (pas d''orphelin). RLS via get_user_agency_id() côté SECURITY INVOKER.';



CREATE OR REPLACE FUNCTION "public"."crm_offer_chain"("p_deal_id" "uuid") RETURNS TABLE("id" "uuid", "deal_id" "uuid", "agency_id" "uuid", "parent_offer_id" "uuid", "kind" "public"."crm_offer_kind", "from_party" "public"."crm_offer_party", "by_id" "uuid", "by_label" "text", "amount" bigint, "currency" "text", "conditions" "jsonb", "deposit" bigint, "closing_date" "date", "expires_at" timestamp with time zone, "attachments" "jsonb", "notes" "text", "status" "public"."crm_offer_status", "created_at" timestamp with time zone, "responded_at" timestamp with time zone)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT
    o.id, o.deal_id, o.agency_id, o.parent_offer_id, o.kind, o.from_party,
    o.by_id, o.by_label, o.amount, o.currency, o.conditions, o.deposit,
    o.closing_date, o.expires_at, o.attachments, o.notes, o.status,
    o.created_at, o.responded_at
  FROM crm_offers o
  WHERE o.deal_id = p_deal_id
    AND o.agency_id IN (SELECT p.agency_id FROM profiles p WHERE p.id = auth.uid())
  ORDER BY o.created_at ASC;
$$;


ALTER FUNCTION "public"."crm_offer_chain"("p_deal_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."crm_offer_chain"("p_deal_id" "uuid") IS 'Sprint 2 : retourne toutes les offres + contre-offres d''un deal, triées par created_at ASC. La dernière de la liste est l''offre en cours.';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."visits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agency_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    "contact_id" "uuid" NOT NULL,
    "transaction_id" "uuid",
    "scheduled_at" timestamp with time zone NOT NULL,
    "completed_at" timestamp with time zone,
    "status" "text" DEFAULT 'planned'::"text" NOT NULL,
    "feedback_buyer" "text",
    "feedback_agent" "text",
    "ai_objections" "jsonb",
    "rating" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "manage_token" "uuid" DEFAULT "gen_random_uuid"(),
    "qualification" "jsonb" DEFAULT '{}'::"jsonb",
    "buyer_name" "text",
    "buyer_email" "text",
    "buyer_phone" "text",
    "buyer_message" "text",
    "reminder_sent" boolean DEFAULT false,
    "feedback_sent" boolean DEFAULT false,
    "group_id" "uuid",
    "visit_type" "text" DEFAULT 'sur_place'::"text",
    "video_platform" "text",
    "video_link" "text",
    "duration_minutes" integer DEFAULT 45,
    "agent_id" "uuid",
    "bon" "jsonb",
    "rapport" "jsonb",
    CONSTRAINT "visits_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5))),
    CONSTRAINT "visits_status_check" CHECK (("status" = ANY (ARRAY['planned'::"text", 'confirmed'::"text", 'done'::"text", 'cancelled'::"text", 'no_show'::"text"]))),
    CONSTRAINT "visits_video_platform_check" CHECK (("video_platform" = ANY (ARRAY['google_meet'::"text", 'facetime'::"text"]))),
    CONSTRAINT "visits_visit_type_check" CHECK (("visit_type" = ANY (ARRAY['sur_place'::"text", 'video'::"text"])))
);


ALTER TABLE "public"."visits" OWNER TO "postgres";


COMMENT ON COLUMN "public"."visits"."duration_minutes" IS 'Durée prévue en minutes (30/45/60/90). Sprint 2 — modal Planifier visite.';



COMMENT ON COLUMN "public"."visits"."agent_id" IS 'Profil agent ayant planifié la visite (peut différer du créateur du dossier).';



COMMENT ON COLUMN "public"."visits"."bon" IS 'Bon de visite Sprint 2 : { generatedAt, signedAt, docId, visitorNames[], visitorIds[] }. NULL si pas encore généré.';



COMMENT ON COLUMN "public"."visits"."rapport" IS 'Rapport visite Sprint 2 : { savedAt, sentiment(hot|warm|cool|cold), interestLevel(0-10), highlights[], objections[], nextSteps, photos, voiceNote, followUpScheduledAt }. NULL tant que visite pas faite.';



CREATE OR REPLACE FUNCTION "public"."crm_visits_by_property"("p_property_id" "uuid") RETURNS SETOF "public"."visits"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT v.* FROM visits v
  WHERE v.property_id = p_property_id
    AND v.agency_id IN (SELECT p.agency_id FROM profiles p WHERE p.id = auth.uid())
  ORDER BY v.scheduled_at DESC;
$$;


ALTER FUNCTION "public"."crm_visits_by_property"("p_property_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."daily_matching_scan"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  agency RECORD;
  base_url TEXT;
  svc_key TEXT;
BEGIN
  base_url := get_app_config('supabase_url');
  svc_key := get_app_config('service_role_key');
  FOR agency IN SELECT DISTINCT agency_id FROM client_searches WHERE is_active = true
  LOOP
    PERFORM net.http_post(
      url := base_url || '/functions/v1/matching-engine',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || svc_key
      ),
      body := jsonb_build_object(
        'mode', 'scan-all',
        'agency_id', agency.agency_id
      )
    );
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."daily_matching_scan"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_activity_events_immutability"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_age_years NUMERIC;
  v_is_anonymization BOOLEAN;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Cas autorisé unique : anonymisation nLPD
    -- (actor_id passé à NULL ET actor_kind passé à 'system', tout le reste inchangé)
    v_is_anonymization :=
      (NEW.actor_id IS NULL)
      AND (NEW.actor_kind = 'system')
      AND (NEW.action = OLD.action)
      AND (NEW.entity_type = OLD.entity_type)
      AND (NEW.entity_id IS NOT DISTINCT FROM OLD.entity_id)
      AND (NEW.agency_id IS NOT DISTINCT FROM OLD.agency_id)
      AND (NEW.created_at = OLD.created_at)
      AND (NEW.severity IS NOT DISTINCT FROM OLD.severity)
      AND (NEW.category IS NOT DISTINCT FROM OLD.category);

    IF v_is_anonymization THEN
      -- Marque l'event comme anonymisé via metadata (preuve audit)
      NEW.metadata := COALESCE(NEW.metadata, '{}'::jsonb)
        || jsonb_build_object(
          'anonymized_at', NOW()::TEXT,
          'anonymized_reason', 'nLPD user deletion'
        );
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'activity_events est append-only (LBA art. 7 al. 1 — intégrité). Seule l''anonymisation nLPD (actor_id=NULL + actor_kind=system) est autorisée.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_age_years := EXTRACT(EPOCH FROM (NOW() - OLD.created_at)) / (365.25 * 24 * 3600);
    IF v_age_years < 10 THEN
      RAISE EXCEPTION 'Suppression activity_events interdite pendant 10 ans (LBA art. 7 al. 3). Event % a % ans.',
        OLD.id, ROUND(v_age_years, 2);
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."enforce_activity_events_immutability"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."enforce_activity_events_immutability"() IS 'Sprint 3 (Roger #4) : rend activity_events truly append-only même contre service_role. UPDATE autorisé uniquement pour anonymisation nLPD (actor_id NULL + actor_kind system, tout le reste figé). DELETE interdit < 10 ans (LBA art. 7 al. 3).';



CREATE OR REPLACE FUNCTION "public"."enforce_kyc_cases_retention"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_user_role TEXT;
  v_retention_until TIMESTAMPTZ;
BEGIN
  -- Calcule la date de fin de rétention (10 ans depuis création)
  v_retention_until := OLD.created_at + INTERVAL '10 years';

  -- Récupère le rôle de l'acteur (peut être NULL si service_role ou non-auth)
  SELECT role INTO v_user_role
  FROM profiles
  WHERE id = auth.uid();

  -- Si encore dans la fenêtre de rétention ET pas super_admin → refuser
  IF v_retention_until > NOW() AND COALESCE(v_user_role, '') <> 'super_admin' THEN
    -- Log la tentative bloquée pour audit FINMA
    INSERT INTO activity_events
      (agency_id, actor_id, action, entity_type, entity_id,
       category, severity, object_label, metadata)
    VALUES (
      OLD.agency_id,
      auth.uid(),
      'Tentative suppression dossier KYC bloquée',
      'kyc_case',
      OLD.id,
      'kyc',
      'critical',
      'Dossier ' || OLD.id::TEXT,
      jsonb_build_object(
        'reason', 'retention_period_active',
        'retention_until', v_retention_until::TEXT,
        'created_at', OLD.created_at::TEXT,
        'lba_article', 'art. 7 al. 3 (conservation 10 ans)',
        'attempted_by_role', COALESCE(v_user_role, 'unknown')
      )
    );

    RAISE EXCEPTION 'Suppression du dossier KYC interdite avant le %. Article 7 al. 3 LBA — conservation obligatoire 10 ans.',
      to_char(v_retention_until, 'DD.MM.YYYY');
  END IF;

  -- Si super_admin bypasse, log l'événement (rare, audit séparé)
  IF v_user_role = 'super_admin' AND v_retention_until > NOW() THEN
    INSERT INTO activity_events
      (agency_id, actor_id, action, entity_type, entity_id,
       category, severity, object_label, metadata)
    VALUES (
      OLD.agency_id,
      auth.uid(),
      'Suppression dossier KYC par super_admin (bypass rétention)',
      'kyc_case',
      OLD.id,
      'kyc',
      'warn',
      'Dossier ' || OLD.id::TEXT,
      jsonb_build_object(
        'reason', 'super_admin_override',
        'retention_until', v_retention_until::TEXT,
        'created_at', OLD.created_at::TEXT,
        'dossier_status', OLD.dossier_status,
        'sanctions_status', OLD.sanctions_status,
        'pep_status', OLD.pep_status
      )
    );
  END IF;

  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."enforce_kyc_cases_retention"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."enforce_kyc_cases_retention"() IS 'Trigger BEFORE DELETE kyc_cases. Refuse la suppression pendant 10 ans (LBA art. 7 al. 3). Miroir de enforce_kyc_retention sur documents. Bypass uniquement pour super_admin avec audit warn. Log critical sur tentative bloquée.';



CREATE OR REPLACE FUNCTION "public"."enforce_kyc_magic_links_retention"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_age_years NUMERIC;
  v_user_role TEXT;
BEGIN
  v_age_years := EXTRACT(EPOCH FROM (NOW() - OLD.created_at)) / (365.25 * 24 * 3600);

  -- Bypass super_admin (audit warn séparé)
  SELECT role::TEXT INTO v_user_role FROM profiles WHERE id = auth.uid();

  IF v_age_years < 10 AND COALESCE(v_user_role, '') <> 'super_admin' THEN
    INSERT INTO activity_events
      (agency_id, actor_id, action, entity_type, entity_id,
       category, severity, object_label, metadata)
    VALUES (
      OLD.agency_id,
      auth.uid(),
      'Tentative suppression lien magique bloquée',
      'kyc_magic_link',
      OLD.id,
      'kyc',
      'critical',
      'Lien magique ' || OLD.id::TEXT,
      jsonb_build_object(
        'reason', 'retention_period_active',
        'age_years', ROUND(v_age_years, 2),
        'lba_article', 'art. 7 al. 3'
      )
    );
    RAISE EXCEPTION 'Suppression du lien magique interdite avant 10 ans (LBA art. 7 al. 3).';
  END IF;

  -- M2 fix : audit le bypass super_admin pour traçabilité FINMA
  IF v_user_role = 'super_admin' AND v_age_years < 10 THEN
    INSERT INTO activity_events
      (agency_id, actor_id, action, entity_type, entity_id,
       category, severity, object_label, metadata)
    VALUES (
      OLD.agency_id,
      auth.uid(),
      'Suppression lien magique par super_admin (bypass rétention)',
      'kyc_magic_link',
      OLD.id,
      'kyc',
      'warn',
      'Lien magique ' || OLD.id::TEXT,
      jsonb_build_object(
        'reason', 'super_admin_override',
        'age_years', ROUND(v_age_years, 2),
        'created_at', OLD.created_at::TEXT,
        'kyc_case_id', OLD.kyc_case_id,
        'status', OLD.status::TEXT
      )
    );
  END IF;

  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."enforce_kyc_magic_links_retention"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_kyc_retention"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF OLD.kyc_case_id IS NOT NULL
     AND OLD.retention_until IS NOT NULL
     AND OLD.retention_until > now() THEN
    IF NOT is_super_admin() THEN
      RAISE EXCEPTION
        'KYC document retention period not elapsed. Retention until: %. LBA art. 7 al. 3 requires 10 years retention.',
        OLD.retention_until;
    END IF;
  END IF;
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."enforce_kyc_retention"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."estimate_property_price"("p_canton" "text", "p_city" "text" DEFAULT NULL::"text", "p_type" "text" DEFAULT NULL::"text", "p_surface" integer DEFAULT NULL::integer) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_median_price_m2 NUMERIC;
  v_count INTEGER;
  v_comparables JSON;
  v_confidence TEXT;
  v_estimation BIGINT;
  v_min BIGINT;
  v_max BIGINT;
BEGIN
  -- Step 1: Get median price/m2 for this canton (+ city + type if provided)
  SELECT
    percentile_cont(0.5) WITHIN GROUP (ORDER BY price_per_m2),
    count(*)
  INTO v_median_price_m2, v_count
  FROM market_listings
  WHERE status IN ('active', 'price_reduced')
    AND quality_score >= 50
    AND price_per_m2 IS NOT NULL
    AND price_per_m2 > 0
    AND canton = p_canton
    AND (p_city IS NULL OR city ILIKE p_city)
    AND (p_type IS NULL OR type = p_type)
    AND transaction_type = 'buy';

  -- Fallback: if too few results with city, try canton-only
  IF v_count < 5 AND p_city IS NOT NULL THEN
    SELECT
      percentile_cont(0.5) WITHIN GROUP (ORDER BY price_per_m2),
      count(*)
    INTO v_median_price_m2, v_count
    FROM market_listings
    WHERE status IN ('active', 'price_reduced')
      AND quality_score >= 50
      AND price_per_m2 IS NOT NULL
      AND price_per_m2 > 0
      AND canton = p_canton
      AND (p_type IS NULL OR type = p_type)
      AND transaction_type = 'buy';
  END IF;

  -- Confidence level
  IF v_count < 5 THEN
    v_confidence := 'low';
  ELSIF v_count <= 15 THEN
    v_confidence := 'medium';
  ELSE
    v_confidence := 'high';
  END IF;

  -- Calculate estimation if we have data
  IF v_median_price_m2 IS NOT NULL AND p_surface IS NOT NULL AND p_surface > 0 THEN
    v_estimation := (v_median_price_m2 * p_surface)::BIGINT;
    v_min := (v_estimation * 0.85)::BIGINT;
    v_max := (v_estimation * 1.15)::BIGINT;
  END IF;

  -- Step 2: Get 5 comparable properties
  SELECT json_agg(comp) INTO v_comparables
  FROM (
    SELECT
      id,
      title,
      city,
      address,
      type,
      rooms,
      surface_m2,
      price,
      price_per_m2,
      photos[1] AS photo_url,
      days_on_market
    FROM market_listings
    WHERE status IN ('active', 'price_reduced')
      AND quality_score >= 50
      AND canton = p_canton
      AND (p_type IS NULL OR type = p_type)
      AND transaction_type = 'buy'
      AND price IS NOT NULL
      AND surface_m2 IS NOT NULL
      AND (p_surface IS NULL OR (
        surface_m2 BETWEEN p_surface * 0.7 AND p_surface * 1.3
      ))
    ORDER BY
      CASE WHEN p_surface IS NOT NULL
        THEN ABS(surface_m2 - p_surface)
        ELSE 0
      END ASC,
      last_seen_at DESC
    LIMIT 5
  ) comp;

  RETURN json_build_object(
    'median_price_m2', ROUND(v_median_price_m2),
    'estimation', v_estimation,
    'estimation_min', v_min,
    'estimation_max', v_max,
    'confidence', v_confidence,
    'comparable_count', v_count,
    'comparables', COALESCE(v_comparables, '[]'::json)
  );
END;
$$;


ALTER FUNCTION "public"."estimate_property_price"("p_canton" "text", "p_city" "text", "p_type" "text", "p_surface" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."expire_crm_offers_now"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH expired AS (
    UPDATE crm_offers
    SET status = 'expired',
        responded_at = COALESCE(responded_at, now())
    WHERE status = 'pending'
      AND expires_at < now()
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM expired;
  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."expire_crm_offers_now"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."expire_crm_offers_now"() IS 'Sprint 2 : passe les offres pending expirées à status=expired. Appelée par cron crm-offers-expire-hourly. Retourne le nombre d''offres traitées.';



CREATE OR REPLACE FUNCTION "public"."find_contact_duplicates"("p_email" "text" DEFAULT NULL::"text", "p_phone" "text" DEFAULT NULL::"text", "p_first_name" "text" DEFAULT NULL::"text", "p_last_name" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "first_name" "text", "last_name" "text", "email" "text", "phone" "text", "type" "text", "created_at" timestamp with time zone, "user_id" "uuid", "match_kind" "text", "match_priority" integer)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  WITH agency AS (SELECT get_user_agency_id() AS aid),
  candidates AS (
    -- Match par email (priorité 1)
    SELECT c.id, c.first_name, c.last_name, c.email, c.phone, c.type,
           c.created_at, c.user_id, 'email'::TEXT AS match_kind, 1 AS match_priority
    FROM contacts c, agency
    WHERE c.agency_id = agency.aid
      AND p_email IS NOT NULL
      AND p_email <> ''
      AND LOWER(c.email) = LOWER(p_email)

    UNION ALL

    -- Match par téléphone normalisé (priorité 2)
    SELECT c.id, c.first_name, c.last_name, c.email, c.phone, c.type,
           c.created_at, c.user_id, 'phone'::TEXT AS match_kind, 2 AS match_priority
    FROM contacts c, agency
    WHERE c.agency_id = agency.aid
      AND p_phone IS NOT NULL
      AND p_phone <> ''
      AND normalize_phone(c.phone) IS NOT NULL
      AND normalize_phone(c.phone) = normalize_phone(p_phone)

    UNION ALL

    -- Match par prénom+nom (priorité 3)
    SELECT c.id, c.first_name, c.last_name, c.email, c.phone, c.type,
           c.created_at, c.user_id, 'name'::TEXT AS match_kind, 3 AS match_priority
    FROM contacts c, agency
    WHERE c.agency_id = agency.aid
      AND p_first_name IS NOT NULL
      AND p_last_name IS NOT NULL
      AND LENGTH(p_first_name) >= 2
      AND LENGTH(p_last_name) >= 2
      AND LOWER(c.first_name) = LOWER(p_first_name)
      AND LOWER(c.last_name)  = LOWER(p_last_name)
  )
  -- Dédup les mêmes contacts matchés sur plusieurs critères : on garde la
  -- meilleure priorité (email > phone > name).
  SELECT DISTINCT ON (id)
    id, first_name, last_name, email, phone, type, created_at, user_id,
    match_kind, match_priority
  FROM candidates
  ORDER BY id, match_priority ASC
  LIMIT 5;
$$;


ALTER FUNCTION "public"."find_contact_duplicates"("p_email" "text", "p_phone" "text", "p_first_name" "text", "p_last_name" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."find_contact_duplicates"("p_email" "text", "p_phone" "text", "p_first_name" "text", "p_last_name" "text") IS 'Sprint 3 (B3) : trouve les contacts agence pouvant matcher un nouvel import. Tri par priorité (email > phone > name). À appeler AVANT toute création de Contact via Import Lead, et idéalement aussi côté useCreateContact manuel.';



CREATE OR REPLACE FUNCTION "public"."generate_ticket_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.ticket_number := 'MEGGA-' || LPAD(nextval('ticket_number_seq')::TEXT, 4, '0');
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_ticket_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_admin_compliance_stats"() RETURNS TABLE("total" bigint, "pending" bigint, "screening_match" bigint, "avg_completion" numeric)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT
    (SELECT COUNT(*) FROM kyc_cases),
    (SELECT COUNT(*) FROM kyc_cases WHERE status IN ('pending', 'in_progress')),
    -- "screening match" agrège PEP + sanctions (cf. note sur idx_kyc_cases_screening_match)
    (SELECT COUNT(*) FROM kyc_cases WHERE pep_status = 'match' OR sanctions_status = 'match'),
    COALESCE((SELECT ROUND(AVG(completion_pct)::numeric, 1) FROM kyc_cases), 0)
$$;


ALTER FUNCTION "public"."get_admin_compliance_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_admin_dashboard_stats"() RETURNS TABLE("active_agencies" bigint, "total_users" bigint, "active_properties" bigint, "active_transactions" bigint, "high_risk_kyc" bigint, "new_agencies_this_month" bigint, "new_users_this_month" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT
    (SELECT COUNT(*) FROM agencies),
    (SELECT COUNT(*) FROM profiles),
    (SELECT COUNT(*) FROM properties WHERE status = 'active'),
    (SELECT COUNT(*) FROM transactions WHERE status = 'active'),
    (SELECT COUNT(*) FROM kyc_cases WHERE risk_level = 'high'),
    (SELECT COUNT(*) FROM agencies WHERE created_at >= date_trunc('month', now())),
    (SELECT COUNT(*) FROM profiles WHERE created_at >= date_trunc('month', now()))
$$;


ALTER FUNCTION "public"."get_admin_dashboard_stats"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_admin_dashboard_stats"() IS 'Retourne les 7 KPIs admin du dashboard en 1 round-trip. Remplace 7 queries count:exact côté client (red-team fix). Lisible uniquement par super_admin via REVOKE puis GRANT.';



CREATE OR REPLACE FUNCTION "public"."get_admin_moderation_stats"() RETURNS TABLE("published_count" bigint, "flags_this_month" bigint, "removes_this_month" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT
    (SELECT COUNT(*) FROM properties WHERE moderation_status = 'published'),
    (SELECT COUNT(*) FROM moderation_actions
      WHERE action = 'flag'
        AND created_at >= date_trunc('month', now())),
    (SELECT COUNT(*) FROM moderation_actions
      WHERE action = 'remove'
        AND created_at >= date_trunc('month', now()))
$$;


ALTER FUNCTION "public"."get_admin_moderation_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_admin_monitoring_health"() RETURNS TABLE("errors_last_24h" bigint, "emails_sent_today" bigint, "api_requests_today" bigint, "last_scraping_at" timestamp with time zone, "db_size_mb" numeric, "storage_used_mb" numeric)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT
    (SELECT COUNT(*) FROM activity_events
      WHERE action = 'edge_function_error'
        AND created_at >= now() - INTERVAL '24 hours'),
    (SELECT COUNT(*) FROM activity_events
      WHERE action = 'email_sent'
        AND created_at >= date_trunc('day', now())),
    (SELECT COUNT(*) FROM activity_events
      WHERE created_at >= date_trunc('day', now())),
    (SELECT MAX(created_at) FROM activity_events WHERE action = 'scraping_completed'),
    COALESCE((SELECT metric_value FROM platform_metrics
      WHERE metric_type = 'db_size_mb'
      ORDER BY recorded_at DESC LIMIT 1), 0),
    COALESCE((SELECT metric_value FROM platform_metrics
      WHERE metric_type = 'storage_used_mb'
      ORDER BY recorded_at DESC LIMIT 1), 0)
$$;


ALTER FUNCTION "public"."get_admin_monitoring_health"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_admin_support_stats"() RETURNS TABLE("open_count" bigint, "new_count" bigint, "resolved_this_week" bigint, "sla_breached_open" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT
    (SELECT COUNT(*) FROM support_tickets WHERE status = 'open'),
    (SELECT COUNT(*) FROM support_tickets WHERE status = 'new'),
    (SELECT COUNT(*) FROM support_tickets
      WHERE status = 'resolved'
        AND updated_at >= now() - INTERVAL '7 days'),
    (SELECT COUNT(*) FROM support_tickets
      WHERE sla_breached = true
        AND status IN ('new', 'open', 'pending'))
$$;


ALTER FUNCTION "public"."get_admin_support_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_app_config"("config_key" "text") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT value FROM app_config WHERE key = config_key;
$$;


ALTER FUNCTION "public"."get_app_config"("config_key" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_cities_by_canton"("p_canton" "text", "p_context" "text" DEFAULT 'buy'::"text") RETURNS TABLE("city" "text", "count" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT
    ml.city,
    COUNT(*)::BIGINT as count
  FROM market_listings ml
  WHERE ml.canton = p_canton
    AND ml.transaction_type = p_context
    AND ml.status IN ('active', 'price_reduced')
    AND ml.quality_score >= 50
    AND ml.city IS NOT NULL
    AND ml.city != ''
  GROUP BY ml.city
  ORDER BY count DESC;
$$;


ALTER FUNCTION "public"."get_cities_by_canton"("p_canton" "text", "p_context" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_market_map_points"("p_context" "text" DEFAULT 'buy'::"text", "p_types" "text"[] DEFAULT NULL::"text"[], "p_canton" "text" DEFAULT NULL::"text", "p_city" "text" DEFAULT NULL::"text", "p_min_price" numeric DEFAULT NULL::numeric, "p_max_price" numeric DEFAULT NULL::numeric, "p_min_rooms" numeric DEFAULT NULL::numeric, "p_min_surface" numeric DEFAULT NULL::numeric, "p_features" "text"[] DEFAULT NULL::"text"[]) RETURNS TABLE("id" "uuid", "lat" double precision, "lng" double precision, "price" numeric, "current_price" numeric, "type" "text", "rooms" numeric, "transaction_type" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "statement_timeout" TO '30s'
    AS $$
BEGIN
  PERFORM set_config('statement_timeout', '30s', true);
  RETURN QUERY
  SELECT m.id, m.lat, m.lng, m.price, m.current_price, m.type, m.rooms, m.transaction_type
  FROM market_listings m
  WHERE m.status = 'active' AND m.quality_score >= 50
    AND m.lat IS NOT NULL AND m.lng IS NOT NULL AND m.price > 0
    AND m.transaction_type = p_context
    AND (p_types IS NULL OR m.type = ANY(p_types))
    AND (p_canton IS NULL OR m.canton = p_canton)
    AND (p_city IS NULL OR m.city ILIKE '%' || p_city || '%')
    AND (p_min_price IS NULL OR m.price >= p_min_price)
    AND (p_max_price IS NULL OR m.price <= p_max_price)
    AND (p_min_rooms IS NULL OR m.rooms >= p_min_rooms)
    AND (p_min_surface IS NULL OR m.surface_m2 >= p_min_surface)
    AND (p_features IS NULL OR (
      ('balcony'      <> ALL(p_features) OR m.has_balcony = true) AND
      ('pool'         <> ALL(p_features) OR m.has_swimming_pool = true) AND
      ('view'         <> ALL(p_features) OR m.has_nice_view = true) AND
      ('garage'       <> ALL(p_features) OR m.has_garage = true) AND
      ('parking'      <> ALL(p_features) OR m.has_parking = true) AND
      ('elevator'     <> ALL(p_features) OR m.has_elevator = true) AND
      ('furnished'    <> ALL(p_features) OR m.is_furnished = true) AND
      ('pets_allowed' <> ALL(p_features) OR m.pets_allowed = true) AND
      ('fireplace'    <> ALL(p_features) OR m.has_fireplace = true) AND
      ('new_building' <> ALL(p_features) OR m.is_new_building = true) AND
      ('minergie'     <> ALL(p_features) OR m.is_minergie = true)
    ));
END; $$;


ALTER FUNCTION "public"."get_market_map_points"("p_context" "text", "p_types" "text"[], "p_canton" "text", "p_city" "text", "p_min_price" numeric, "p_max_price" numeric, "p_min_rooms" numeric, "p_min_surface" numeric, "p_features" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_agency_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT agency_id FROM profiles WHERE id = auth.uid()
$$;


ALTER FUNCTION "public"."get_my_agency_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_popular_articles"("limit_count" integer DEFAULT 6) RETURNS TABLE("article_slug" "text", "view_count" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT article_slug, COUNT(*) as view_count
  FROM article_views
  WHERE created_at > NOW() - INTERVAL '30 days'
  GROUP BY article_slug
  ORDER BY view_count DESC
  LIMIT limit_count;
$$;


ALTER FUNCTION "public"."get_popular_articles"("limit_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_price_hexagons"("p_min_lng" double precision, "p_min_lat" double precision, "p_max_lng" double precision, "p_max_lat" double precision, "p_hex_size_m" integer, "p_transaction_type" "text" DEFAULT 'rent'::"text", "p_types" "text"[] DEFAULT NULL::"text"[], "p_min_count" integer DEFAULT 3) RETURNS TABLE("hex_id" "text", "geom" "jsonb", "median_price_m2" numeric, "listing_count" integer, "p25_price_m2" numeric, "p75_price_m2" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  bbox_3857 geometry;
BEGIN
  PERFORM set_config('statement_timeout', '15s', true);

  IF p_hex_size_m < 100 THEN
    p_hex_size_m := 100;
  END IF;

  bbox_3857 := ST_Transform(
    ST_MakeEnvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326),
    3857
  );

  RETURN QUERY
  WITH hexes AS (
    SELECT
      h.i::text || '_' || h.j::text AS hex_id,
      h.geom AS geom_3857
    FROM ST_HexagonGrid(p_hex_size_m::float, bbox_3857) AS h
  ),
  listing_points AS (
    SELECT
      m.price_per_m2,
      ST_Transform(ST_SetSRID(ST_MakePoint(m.lng, m.lat), 4326), 3857) AS pt
    FROM market_listings m
    WHERE m.status = 'active'
      AND m.quality_score >= 50
      AND m.lat IS NOT NULL AND m.lng IS NOT NULL
      AND m.price_per_m2 IS NOT NULL
      AND m.price_per_m2 > 0
      AND m.transaction_type = p_transaction_type
      AND (p_types IS NULL OR m.type = ANY(p_types))
      AND m.lng BETWEEN p_min_lng AND p_max_lng
      AND m.lat BETWEEN p_min_lat AND p_max_lat
  ),
  agg AS (
    SELECT
      hx.hex_id,
      hx.geom_3857,
      COUNT(*)::int AS cnt,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY lp.price_per_m2) AS med,
      percentile_cont(0.25) WITHIN GROUP (ORDER BY lp.price_per_m2) AS q25,
      percentile_cont(0.75) WITHIN GROUP (ORDER BY lp.price_per_m2) AS q75
    FROM hexes hx
    JOIN listing_points lp ON ST_Contains(hx.geom_3857, lp.pt)
    GROUP BY hx.hex_id, hx.geom_3857
    HAVING COUNT(*) >= p_min_count
  )
  SELECT
    agg.hex_id,
    ST_AsGeoJSON(ST_Transform(agg.geom_3857, 4326))::jsonb,
    agg.med::numeric,
    agg.cnt,
    agg.q25::numeric,
    agg.q75::numeric
  FROM agg
  ORDER BY agg.cnt DESC
  LIMIT 5000;
END;
$$;


ALTER FUNCTION "public"."get_price_hexagons"("p_min_lng" double precision, "p_min_lat" double precision, "p_max_lng" double precision, "p_max_lat" double precision, "p_hex_size_m" integer, "p_transaction_type" "text", "p_types" "text"[], "p_min_count" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_price_hexagons"("p_min_lng" double precision, "p_min_lat" double precision, "p_max_lng" double precision, "p_max_lat" double precision, "p_hex_size_m" integer, "p_transaction_type" "text", "p_types" "text"[], "p_min_count" integer) IS 'Median CHF/m² per PostGIS hexagon inside bbox. Replaces Mapbox heatmap.';



CREATE OR REPLACE FUNCTION "public"."get_user_agency_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT agency_id FROM profiles WHERE id = auth.uid()
$$;


ALTER FUNCTION "public"."get_user_agency_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_role"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;


ALTER FUNCTION "public"."get_user_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ BEGIN INSERT INTO public.profiles (id, email, full_name, avatar_url, role) VALUES (NEW.id, COALESCE(NEW.email, ''), COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''), COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', NEW.raw_user_meta_data ->> 'picture', ''), COALESCE(NEW.raw_user_meta_data ->> 'role', 'buyer')); RETURN NEW; END; $$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hourly_automation_scan"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  agency RECORD;
  base_url TEXT;
  svc_key TEXT;
BEGIN
  base_url := get_app_config('supabase_url');
  svc_key := get_app_config('service_role_key');
  FOR agency IN SELECT DISTINCT id AS agency_id FROM agencies
  LOOP
    PERFORM net.http_post(
      url := base_url || '/functions/v1/automation-engine',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || svc_key
      ),
      body := jsonb_build_object(
        'agency_id', agency.agency_id
      )
    );
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."hourly_automation_scan"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_super_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'super_admin'
  );
$$;


ALTER FUNCTION "public"."is_super_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_within_sla_window"("p_agent_id" "uuid", "p_at" timestamp with time zone DEFAULT "now"()) RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_prefs       JSONB;
  v_sla         JSONB;
  v_dow         INT;
  v_hour        INT;
  v_swiss       TIMESTAMP;  -- naive, déjà en heure de Zurich
  v_days        JSONB;
BEGIN
  v_prefs := compute_agent_preferences(p_agent_id);
  IF v_prefs IS NULL THEN
    RETURN FALSE;
  END IF;

  v_sla := v_prefs->'sla';
  IF v_sla IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Conversion vers l'heure locale suisse (Europe/Zurich gère
  -- automatiquement les transitions été/hiver).
  v_swiss := (p_at AT TIME ZONE 'Europe/Zurich')::TIMESTAMP;
  v_dow   := EXTRACT(ISODOW FROM v_swiss)::INT;  -- 1=lundi … 7=dimanche
  v_hour  := EXTRACT(HOUR   FROM v_swiss)::INT;

  v_days := v_sla->'days_of_week';
  IF NOT (v_days @> to_jsonb(v_dow)) THEN
    RETURN FALSE;
  END IF;

  RETURN v_hour >= (v_sla->>'hours_start')::INT
     AND v_hour <  (v_sla->>'hours_end')::INT;
END;
$$;


ALTER FUNCTION "public"."is_within_sla_window"("p_agent_id" "uuid", "p_at" timestamp with time zone) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_within_sla_window"("p_agent_id" "uuid", "p_at" timestamp with time zone) IS 'Helper pg_cron. TRUE si l''agent est dans sa fenêtre de disponibilité (jour + heure CH). Évite d''envoyer une notif à 3h du matin à un agent "office".';



CREATE OR REPLACE FUNCTION "public"."join_agency"("p_agency_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM agencies WHERE id = p_agency_id) THEN
    RAISE EXCEPTION 'agency_not_found';
  END IF;

  UPDATE profiles
     SET agency_id = p_agency_id,
         role = CASE
           WHEN role IN ('agent', 'manager', 'admin', 'assistant') THEN role
           ELSE 'agent'::user_role
         END
   WHERE id = v_uid;
END;
$$;


ALTER FUNCTION "public"."join_agency"("p_agency_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."join_agency"("p_agency_id" "uuid") IS 'Phase MVP : attache directe du user à une agence existante (rôle agent par défaut). À remplacer par un workflow agency_join_requests avec validation admin.';



CREATE OR REPLACE FUNCTION "public"."kyc_by_contact_id"("p_contact_id" "uuid") RETURNS TABLE("id" "uuid", "agency_id" "uuid", "contact_id" "uuid", "transaction_id" "uuid", "type" "public"."kyc_person_type", "risk_level" "public"."kyc_risk_level", "risk_score" integer, "dossier_status" "text", "vigilance" "text", "validated_at" timestamp with time zone, "expires_at" timestamp with time zone, "created_at" timestamp with time zone, "pep_status" "text", "sanctions_status" "text", "last_screening_at" timestamp with time zone, "checks_total" integer, "checks_completed" integer)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT
    k.id, k.agency_id, k.contact_id, k.transaction_id, k.type, k.risk_level, k.risk_score,
    k.dossier_status, k.vigilance, k.validated_at, k.expires_at, k.created_at,
    k.pep_status, k.sanctions_status, k.last_screening_at,
    (SELECT COUNT(*)::INT FROM kyc_checklist_items WHERE kyc_case_id = k.id)::INT AS checks_total,
    (SELECT COUNT(*)::INT FROM kyc_checklist_items WHERE kyc_case_id = k.id AND is_completed = TRUE)::INT AS checks_completed
  FROM kyc_cases k
  WHERE k.contact_id = p_contact_id
    AND k.agency_id = get_user_agency_id()
  ORDER BY k.created_at DESC
  LIMIT 1;
$$;


ALTER FUNCTION "public"."kyc_by_contact_id"("p_contact_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."kyc_by_contact_id"("p_contact_id" "uuid") IS 'Sprint 1 : retourne le dossier KYC le plus récent pour un contact (ou rien). Inclut le compteur de contrôles complétés pour l''UI. Source de vérité du deep-link contact → KYC.';



CREATE OR REPLACE FUNCTION "public"."kyc_count_by_status"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT jsonb_object_agg(dossier_status, n)
  FROM (
    SELECT dossier_status, COUNT(*) AS n
    FROM kyc_cases
    WHERE agency_id = get_user_agency_id()
    GROUP BY dossier_status
  ) sub;
$$;


ALTER FUNCTION "public"."kyc_count_by_status"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."kyc_count_by_status"() IS 'Sprint 1 : compteurs par dossier_status pour les KPIs de la liste KYC.';



CREATE OR REPLACE FUNCTION "public"."kyc_latest_screening_decision"("p_kyc_case_id" "uuid", "p_target" "text") RETURNS TABLE("id" "uuid", "decision" "text", "justification" "text", "decided_by" "uuid", "decided_at" timestamp with time zone)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT d.id, d.decision, d.justification, d.decided_by, d.decided_at
  FROM kyc_screening_decisions d
  WHERE d.kyc_case_id = p_kyc_case_id
    AND d.decision_target = p_target
    AND d.agency_id = get_my_agency_id()
    AND NOT EXISTS (
      SELECT 1 FROM kyc_screening_decisions d2
      WHERE d2.supersedes_id = d.id
        AND d2.agency_id = get_my_agency_id()
    )
  ORDER BY d.decided_at DESC
  LIMIT 1;
$$;


ALTER FUNCTION "public"."kyc_latest_screening_decision"("p_kyc_case_id" "uuid", "p_target" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."kyc_latest_screening_decision"("p_kyc_case_id" "uuid", "p_target" "text") IS 'Retourne la décision compliance la plus récente pour un dossier/cible donné, en excluant les décisions supersedées. Utilisé par le hook useKycScreeningDecisions.';



CREATE OR REPLACE FUNCTION "public"."kyc_magic_link_summary"("p_kyc_case_id" "uuid") RETURNS TABLE("id" "uuid", "status" "public"."kyc_magic_link_status", "mode" "public"."kyc_magic_link_mode", "sent_at" timestamp with time zone, "expires_at" timestamp with time zone, "opened_at" timestamp with time zone, "confirmed_at" timestamp with time zone, "uploads_count" integer, "channels" "text"[])
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT
    ml.id,
    ml.status,
    ml.mode,
    ml.sent_at,
    ml.expires_at,
    ml.opened_at,
    ml.confirmed_at,
    (SELECT COUNT(*)::INT FROM kyc_magic_link_uploads u WHERE u.magic_link_id = ml.id),
    ml.channels
  FROM kyc_magic_links ml
  WHERE ml.kyc_case_id = p_kyc_case_id
    AND ml.agency_id = get_my_agency_id()
  ORDER BY ml.created_at DESC;
$$;


ALTER FUNCTION "public"."kyc_magic_link_summary"("p_kyc_case_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."kyc_magic_link_summary"("p_kyc_case_id" "uuid") IS 'Sprint 4.7.A — Liste des liens magiques d''un dossier KYC pour l''écran agent. RLS agency-scoped automatique.';



CREATE OR REPLACE FUNCTION "public"."log_kyc_screening_decision"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  INSERT INTO activity_events
    (agency_id, actor_id, action, entity_type, entity_id,
     category, severity, object_label, metadata)
  VALUES (
    NEW.agency_id,
    NEW.decided_by,
    'Décision compliance ' || NEW.decision_target || ' : ' || NEW.decision,
    'kyc_case',
    NEW.kyc_case_id,
    'kyc',
    'critical',
    'Dossier ' || NEW.kyc_case_id::TEXT,
    jsonb_build_object(
      'decision_id', NEW.id,
      'decision', NEW.decision,
      'decision_target', NEW.decision_target,
      'justification_length', length(NEW.justification),
      'supersedes_id', NEW.supersedes_id,
      'lba_article', 'art. 7 al. 1 lit. b'
    )
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_kyc_screening_decision"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_stale_kyc_dossiers"() RETURNS TABLE("id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_rec RECORD;
BEGIN
  FOR v_rec IN
    SELECT k.id, k.agency_id, k.expires_at
    FROM kyc_cases k
    WHERE k.dossier_status = 'verified'
      AND k.expires_at IS NOT NULL
      AND k.expires_at < NOW()
  LOOP
    UPDATE kyc_cases
    SET dossier_status = 'stale'
    WHERE id = v_rec.id;

    INSERT INTO activity_events
      (agency_id, actor_id, action, entity_type, entity_id,
       category, severity, object_label, metadata, actor_kind)
    VALUES (
      v_rec.agency_id,
      NULL,
      'Dossier KYC passé en stale (re-screening requis)',
      'kyc_case',
      v_rec.id,
      'kyc',
      'warn',
      'Dossier ' || v_rec.id::TEXT,
      jsonb_build_object(
        'expired_at', v_rec.expires_at::TEXT,
        'lba_article', 'art. 7a (mise à jour des informations)',
        'next_action', 'Re-screener Dilisense manuellement'
      ),
      'system'
    );

    id := v_rec.id;
    RETURN NEXT;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."mark_stale_kyc_dossiers"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."mark_stale_kyc_dossiers"() IS 'Sprint 3 (Marc #5) : passe les dossiers verified expirés en stale et logge l''event. Appelé daily par pg_cron kyc-stale-daily.';



CREATE OR REPLACE FUNCTION "public"."monitor_transaction_kyc_gate"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  -- Stages "post-qualification" qui devraient idéalement avoir un KYC verified
  -- (offre formelle → signature → closing). Stages libres : lead, qualified,
  -- visit_planned. L'absence de KYC sur ces stages génère un warn, pas un blocage.
  v_monitored_stages transaction_stage[] := ARRAY[
    'offer', 'negotiation', 'reserved', 'financing', 'notary', 'signed', 'closed'
  ]::transaction_stage[];
  v_threshold_chf NUMERIC := 100000;
  v_kyc_status TEXT;
  v_kyc_expires TIMESTAMPTZ;
  v_kyc_case_id UUID;
  v_actor_role TEXT;
  v_amount NUMERIC;
  v_kyc_expired BOOLEAN;
BEGIN
  -- 1. Court-circuit : pas de transition vers un stage surveillé → OK
  IF NOT (NEW.stage = ANY(v_monitored_stages)) OR OLD.stage = NEW.stage THEN
    RETURN NEW;
  END IF;

  -- 2. Pas de log si grandfather clause : transition INTERNE entre 2 stages
  --    surveillés (ex: signed → closed) — l'absence éventuelle de KYC a déjà
  --    été loggée à l'entrée dans la zone surveillée.
  IF OLD.stage = ANY(v_monitored_stages) THEN
    RETURN NEW;
  END IF;

  -- 3. Pas de log si pas de buyer (mandat de vente seul) — pas de KYC requis
  IF NEW.contact_buyer_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- 4. Pas de log si sous seuil LBA art. 7 (< CHF 100'000) — hors périmètre LAB
  v_amount := COALESCE(NEW.price_offered, NEW.price_final, 0);
  IF v_amount > 0 AND v_amount < v_threshold_chf THEN
    RETURN NEW;
  END IF;

  -- 5. Recherche du dossier KYC buyer le plus récent dans l'agence
  SELECT id, dossier_status, expires_at
    INTO v_kyc_case_id, v_kyc_status, v_kyc_expires
  FROM kyc_cases
  WHERE contact_id = NEW.contact_buyer_id
    AND agency_id = NEW.agency_id
  ORDER BY created_at DESC
  LIMIT 1;

  v_kyc_expired := (v_kyc_expires IS NOT NULL AND v_kyc_expires <= NOW());

  -- 6. Si KYC verified et non expiré → on log un info (transition conforme)
  IF v_kyc_status = 'verified' AND NOT v_kyc_expired THEN
    -- Pas de log info ici pour ne pas inonder activity_events sur des cas OK.
    -- (Le log de la validation KYC initial suffit comme preuve d'antériorité.)
    RETURN NEW;
  END IF;

  -- 7. KYC manquant / non-verified / expiré → log severity=warn pour le MLRO
  -- Cast explicite enum user_role → TEXT (défensif contre renommage futur de l'enum).
  SELECT role::TEXT INTO v_actor_role FROM profiles WHERE id = auth.uid();

  INSERT INTO activity_events
    (agency_id, actor_id, action, entity_type, entity_id,
     category, severity, object_label, metadata)
  VALUES (
    NEW.agency_id,
    auth.uid(),
    'Transition stage sans KYC vérifié',
    'transaction',
    NEW.id,
    'deal',
    'warn',
    'Transaction ' || NEW.id::TEXT,
    jsonb_build_object(
      'attempted_stage', NEW.stage,
      'previous_stage', OLD.stage,
      'kyc_case_id', v_kyc_case_id,
      'kyc_status', COALESCE(v_kyc_status, 'none'),
      'kyc_expires_at', v_kyc_expires,
      'kyc_expired', v_kyc_expired,
      'amount_chf', v_amount,
      'actor_role', COALESCE(v_actor_role, 'unknown'),
      'mode', 'monitoring_only',
      'lba_article', 'art. 3, 4, 7 al. 1',
      'mlro_action_required', TRUE
    )
  );

  -- Pas de RAISE EXCEPTION — la transition est autorisée mais tracée.
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."monitor_transaction_kyc_gate"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."monitor_transaction_kyc_gate"() IS 'Sprint 4.1 — Monitoring LBA art. 7 al. 1. Log un AuditEvent severity=warn quand une transition vers offer/negotiation/reserved/financing/notary/signed/closed se fait sans KYC buyer verified. Pas de blocage technique — le MLRO filtre les warns dans le dashboard pour action manuelle. Exemptions : pas de buyer, montant < CHF 100k, transition interne entre stages déjà surveillés.';



CREATE OR REPLACE FUNCTION "public"."normalize_phone"("p_phone" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT CASE
    WHEN p_phone IS NULL OR LENGTH(p_phone) < 6 THEN NULL
    ELSE
      -- Garde uniquement les chiffres, puis strip le 41/0 initial pour CH
      RIGHT(REGEXP_REPLACE(p_phone, '\D', '', 'g'), 9)
  END;
$$;


ALTER FUNCTION "public"."normalize_phone"("p_phone" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."normalize_phone"("p_phone" "text") IS 'Sprint 3 (B3) : normalise un téléphone à ses 9 derniers chiffres pour matcher +41 79 / 0041 79 / 079 → mêmes 9 chiffres.';



CREATE OR REPLACE FUNCTION "public"."pg_database_size_mb"() RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT (pg_database_size(current_database()) / (1024 * 1024))::integer;
$$;


ALTER FUNCTION "public"."pg_database_size_mb"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."properties_audit_event"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_action TEXT;
  v_severity TEXT;
  v_metadata JSONB;
  v_agency_id UUID;
  v_actor UUID := auth.uid();
  v_diff JSONB := '{}'::jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := CASE WHEN NEW.status = 'active' THEN 'bien_published' ELSE 'bien_created' END;
    v_severity := CASE WHEN NEW.status = 'active' THEN 'warn' ELSE 'info' END;
    v_agency_id := NEW.agency_id;
    v_metadata := jsonb_build_object(
      'status', NEW.status,
      'price', NEW.price,
      'type', NEW.type,
      'canton', NEW.canton,
      'transaction_type', NEW.transaction_type,
      'photo_count', COALESCE(array_length(NEW.photos, 1), 0)
    );

  ELSIF TG_OP = 'UPDATE' THEN
    -- Skip pure soft-delete touches (handled in DELETE branch by raising soft-delete event)
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
      v_action := 'bien_soft_deleted';
      v_severity := 'critical';
      v_agency_id := NEW.agency_id;
      v_metadata := jsonb_build_object(
        'previous_status', OLD.status,
        'price', OLD.price,
        'title', OLD.title
      );
    ELSE
      -- Build diff for changed fields we care about for audit
      IF NEW.status IS DISTINCT FROM OLD.status THEN
        v_diff := v_diff || jsonb_build_object('status', jsonb_build_array(OLD.status, NEW.status));
      END IF;
      IF NEW.price IS DISTINCT FROM OLD.price THEN
        v_diff := v_diff || jsonb_build_object('price', jsonb_build_array(OLD.price, NEW.price));
      END IF;
      IF NEW.address IS DISTINCT FROM OLD.address THEN
        v_diff := v_diff || jsonb_build_object('address', jsonb_build_array(OLD.address, NEW.address));
      END IF;
      IF NEW.canton IS DISTINCT FROM OLD.canton THEN
        v_diff := v_diff || jsonb_build_object('canton', jsonb_build_array(OLD.canton, NEW.canton));
      END IF;
      IF NEW.mandate_signed_at IS DISTINCT FROM OLD.mandate_signed_at THEN
        v_diff := v_diff || jsonb_build_object('mandate_signed_at',
          jsonb_build_array(OLD.mandate_signed_at, NEW.mandate_signed_at));
      END IF;
      IF NEW.c2pa_verified IS DISTINCT FROM OLD.c2pa_verified THEN
        v_diff := v_diff || jsonb_build_object('c2pa_verified',
          jsonb_build_array(OLD.c2pa_verified, NEW.c2pa_verified));
      END IF;
      IF (COALESCE(array_length(NEW.photos, 1), 0)) IS DISTINCT FROM (COALESCE(array_length(OLD.photos, 1), 0)) THEN
        v_diff := v_diff || jsonb_build_object('photo_count',
          jsonb_build_array(
            COALESCE(array_length(OLD.photos, 1), 0),
            COALESCE(array_length(NEW.photos, 1), 0)
          ));
      END IF;
      -- AI-generated photos array delta — captures virtual-staging additions/removals.
      -- We track the count (URLs themselves stay out of the audit log to keep rows
      -- small and avoid leaking storage paths to long-lived audit consumers).
      IF (COALESCE(array_length(NEW.ai_generated_photos, 1), 0))
         IS DISTINCT FROM (COALESCE(array_length(OLD.ai_generated_photos, 1), 0)) THEN
        v_diff := v_diff || jsonb_build_object('ai_photo_count',
          jsonb_build_array(
            COALESCE(array_length(OLD.ai_generated_photos, 1), 0),
            COALESCE(array_length(NEW.ai_generated_photos, 1), 0)
          ));
      END IF;

      -- No-op update (only updated_at touched): skip the event to avoid noise.
      IF v_diff = '{}'::jsonb THEN
        RETURN NEW;
      END IF;

      v_action := CASE
        WHEN OLD.status = 'draft' AND NEW.status = 'active' THEN 'bien_published'
        WHEN OLD.status != 'sold' AND NEW.status = 'sold' THEN 'bien_sold'
        ELSE 'bien_updated'
      END;
      v_severity := CASE
        WHEN v_action IN ('bien_published', 'bien_sold') THEN 'warn'
        ELSE 'info'
      END;
      v_agency_id := NEW.agency_id;
      v_metadata := jsonb_build_object('diff', v_diff);
    END IF;

  ELSE -- DELETE
    v_action := 'bien_hard_deleted';
    v_severity := 'critical';
    v_agency_id := OLD.agency_id;
    v_metadata := jsonb_build_object(
      'status', OLD.status,
      'price', OLD.price,
      'title', OLD.title,
      'address', OLD.address
    );
  END IF;

  -- Insert the audit row. actor_kind defaults to 'user' when actor_id is set;
  -- pg_cron writes (e.g. cleanup_orphan_drafts) have null auth.uid() → mark
  -- as 'system' so the dashboard can distinguish them from real human acts.
  INSERT INTO activity_events (
    agency_id, actor_id, actor_kind,
    action, entity_type, entity_id,
    severity, category, metadata
  ) VALUES (
    v_agency_id,
    v_actor,
    CASE WHEN v_actor IS NULL THEN 'system' ELSE 'user' END,
    v_action,
    'property',
    COALESCE(NEW.id, OLD.id),
    v_severity,
    'bien',
    v_metadata
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."properties_audit_event"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."purge_expired_import_raw_text"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_purged_count INTEGER;
BEGIN
  UPDATE contacts
  SET import_raw_text = NULL,
      import_raw_text_received_at = NULL
  WHERE import_raw_text IS NOT NULL
    AND import_raw_text_received_at < NOW() - INTERVAL '90 days';

  GET DIAGNOSTICS v_purged_count = ROW_COUNT;

  -- AuditEvent agrégé (uniquement si du travail réel a été fait)
  IF v_purged_count > 0 THEN
    INSERT INTO activity_events
      (agency_id, actor_id, actor_kind, action, entity_type, entity_id,
       category, severity, object_label, metadata)
    VALUES (
      NULL,
      NULL,
      'system',
      'Rétention rawText appliquée',
      'contact',
      NULL,
      'settings',
      'info',
      'Purge automatique 90j',
      jsonb_build_object('rows_purged', v_purged_count, 'cutoff_days', 90)
    );
  END IF;

  RETURN v_purged_count;
END;
$$;


ALTER FUNCTION "public"."purge_expired_import_raw_text"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."purge_expired_import_raw_text"() IS 'Sprint 3 (A.7) : purge le rawText (import lead IA) après 90 jours. Retourne le nombre de rows touchées. Loggue un AuditEvent agrégé si > 0.';



CREATE OR REPLACE FUNCTION "public"."run_search_alerts"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  base_url TEXT;
  svc_key TEXT;
BEGIN
  base_url := get_app_config('supabase_url');
  svc_key := get_app_config('service_role_key');

  PERFORM net.http_post(
    url := base_url || '/functions/v1/search-alert',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || svc_key
    ),
    body := '{}'::jsonb
  );
END;
$$;


ALTER FUNCTION "public"."run_search_alerts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_agencies"("q" "text", "lim" integer DEFAULT 10) RETURNS TABLE("id" "uuid", "name" "text", "city" "text", "canton" "text", "logo_url" "text", "member_count" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT a.id, a.name, a.city, a.canton, a.logo_url,
         (SELECT count(*) FROM profiles p WHERE p.agency_id = a.id) AS member_count
  FROM agencies a
  WHERE COALESCE(a.status, 'active') = 'active'
    AND (
      lower(a.name) LIKE '%' || lower(btrim(q)) || '%'
      OR lower(COALESCE(a.city, '')) LIKE '%' || lower(btrim(q)) || '%'
    )
  ORDER BY length(a.name) ASC
  LIMIT lim;
$$;


ALTER FUNCTION "public"."search_agencies"("q" "text", "lim" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."search_agencies"("q" "text", "lim" integer) IS 'Autocomplete pour le wizard d''onboarding. SECURITY DEFINER : bypasse RLS pour exposer uniquement les champs publics (id, name, city, canton, logo_url, member_count).';



CREATE OR REPLACE FUNCTION "public"."search_directory"("search_query" "text" DEFAULT ''::"text", "search_type" "text" DEFAULT 'agents'::"text", "filter_canton" "text" DEFAULT NULL::"text", "filter_city" "text" DEFAULT NULL::"text", "filter_specialties" "text"[] DEFAULT NULL::"text"[], "filter_languages" "text"[] DEFAULT NULL::"text"[], "filter_verified" boolean DEFAULT NULL::boolean, "sort_by" "text" DEFAULT 'relevance'::"text", "page_number" integer DEFAULT 0, "page_size" integer DEFAULT 20) RETURNS json
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  result json;
  total_count bigint;
BEGIN
  IF search_type = 'agents' THEN
    -- Count
    SELECT count(*) INTO total_count
    FROM agent_profiles ap
    WHERE (search_query = '' OR
      to_tsvector('french', coalesce(ap.first_name, '') || ' ' || coalesce(ap.last_name, '') || ' ' || coalesce(ap.city, ''))
      @@ plainto_tsquery('french', search_query)
      OR ap.first_name ILIKE '%' || search_query || '%'
      OR ap.last_name ILIKE '%' || search_query || '%'
      OR ap.city ILIKE '%' || search_query || '%')
    AND (filter_canton IS NULL OR ap.canton = filter_canton)
    AND (filter_city IS NULL OR ap.city ILIKE '%' || filter_city || '%')
    AND (filter_specialties IS NULL OR ap.specialties && filter_specialties)
    AND (filter_languages IS NULL OR ap.languages && filter_languages)
    AND (filter_verified IS NULL OR (filter_verified = true AND ap.status = 'verified') OR filter_verified = false);

    -- Results
    SELECT json_build_object(
      'total', total_count,
      'page', page_number,
      'pageSize', page_size,
      'items', coalesce(json_agg(row_to_json(r)), '[]'::json)
    ) INTO result
    FROM (
      SELECT ap.*,
        agp.name AS agency_name, agp.slug AS agency_slug
      FROM agent_profiles ap
      LEFT JOIN agency_profiles agp ON agp.id = ap.agency_profile_id
      WHERE (search_query = '' OR
        to_tsvector('french', coalesce(ap.first_name, '') || ' ' || coalesce(ap.last_name, '') || ' ' || coalesce(ap.city, ''))
        @@ plainto_tsquery('french', search_query)
        OR ap.first_name ILIKE '%' || search_query || '%'
        OR ap.last_name ILIKE '%' || search_query || '%'
        OR ap.city ILIKE '%' || search_query || '%')
      AND (filter_canton IS NULL OR ap.canton = filter_canton)
      AND (filter_city IS NULL OR ap.city ILIKE '%' || filter_city || '%')
      AND (filter_specialties IS NULL OR ap.specialties && filter_specialties)
      AND (filter_languages IS NULL OR ap.languages && filter_languages)
      AND (filter_verified IS NULL OR (filter_verified = true AND ap.status = 'verified') OR filter_verified = false)
      ORDER BY
        CASE WHEN sort_by = 'name' THEN ap.last_name END ASC,
        CASE WHEN sort_by = 'rating' THEN ap.rating_avg END DESC,
        CASE WHEN sort_by = 'listings' THEN ap.stats_properties_sold END DESC,
        CASE WHEN sort_by = 'relevance' THEN
          CASE WHEN ap.status = 'verified' THEN 0 WHEN ap.status = 'claimed' THEN 1 ELSE 2 END
        END ASC,
        ap.rating_avg DESC,
        ap.created_at DESC
      LIMIT page_size OFFSET page_number * page_size
    ) r;

  ELSE
    -- Agencies
    SELECT count(*) INTO total_count
    FROM agency_profiles agp
    WHERE (search_query = '' OR
      to_tsvector('french', coalesce(agp.name, '') || ' ' || coalesce(agp.city, ''))
      @@ plainto_tsquery('french', search_query)
      OR agp.name ILIKE '%' || search_query || '%'
      OR agp.city ILIKE '%' || search_query || '%')
    AND (filter_canton IS NULL OR agp.canton = filter_canton)
    AND (filter_city IS NULL OR agp.city ILIKE '%' || filter_city || '%')
    AND (filter_specialties IS NULL OR agp.specialties && filter_specialties)
    AND (filter_languages IS NULL OR agp.languages && filter_languages)
    AND (filter_verified IS NULL OR (filter_verified = true AND agp.status = 'verified') OR filter_verified = false);

    SELECT json_build_object(
      'total', total_count,
      'page', page_number,
      'pageSize', page_size,
      'items', coalesce(json_agg(row_to_json(r)), '[]'::json)
    ) INTO result
    FROM (
      SELECT agp.*
      FROM agency_profiles agp
      WHERE (search_query = '' OR
        to_tsvector('french', coalesce(agp.name, '') || ' ' || coalesce(agp.city, ''))
        @@ plainto_tsquery('french', search_query)
        OR agp.name ILIKE '%' || search_query || '%'
        OR agp.city ILIKE '%' || search_query || '%')
      AND (filter_canton IS NULL OR agp.canton = filter_canton)
      AND (filter_city IS NULL OR agp.city ILIKE '%' || filter_city || '%')
      AND (filter_specialties IS NULL OR agp.specialties && filter_specialties)
      AND (filter_languages IS NULL OR agp.languages && filter_languages)
      AND (filter_verified IS NULL OR (filter_verified = true AND agp.status = 'verified') OR filter_verified = false)
      ORDER BY
        CASE WHEN sort_by = 'name' THEN agp.name END ASC,
        CASE WHEN sort_by = 'rating' THEN agp.rating_avg END DESC,
        CASE WHEN sort_by = 'listings' THEN agp.active_listings_count END DESC,
        CASE WHEN sort_by = 'relevance' THEN
          CASE WHEN agp.status = 'verified' THEN 0 WHEN agp.status = 'claimed' THEN 1 ELSE 2 END
        END ASC,
        agp.rating_avg DESC,
        agp.created_at DESC
      LIMIT page_size OFFSET page_number * page_size
    ) r;
  END IF;

  RETURN result;
END;
$$;


ALTER FUNCTION "public"."search_directory"("search_query" "text", "search_type" "text", "filter_canton" "text", "filter_city" "text", "filter_specialties" "text"[], "filter_languages" "text"[], "filter_verified" boolean, "sort_by" "text", "page_number" integer, "page_size" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."seed_kyc_lba_checks"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  INSERT INTO kyc_checklist_items (kyc_case_id, label, category, is_required)
  VALUES
    (NEW.id, 'Pièce d''identité',         'id',        TRUE),
    (NEW.id, 'Justificatif de domicile',  'address',   TRUE),
    (NEW.id, 'Screening PEP',             'pep',       TRUE),
    (NEW.id, 'Listes de sanctions',       'sanctions', TRUE),
    (NEW.id, 'Source des fonds',          'funds',
      NEW.vigilance = 'renforced'
      OR COALESCE(NEW.transaction_amount, 0) > 100000);

  -- AuditEvent : Dossier KYC ouvert (handoff §7 KYC_ENRICHISSEMENTS)
  INSERT INTO activity_events
    (agency_id, actor_id, action, entity_type, entity_id,
     category, severity, object_label, metadata)
  VALUES (
    NEW.agency_id,
    auth.uid(),
    'Dossier KYC ouvert',
    'kyc_case',
    NEW.id,
    'kyc',
    'info',
    'Dossier ' || NEW.id::TEXT,
    jsonb_build_object(
      'vigilance', NEW.vigilance,
      'type', NEW.type,
      'risk_level', NEW.risk_level
    )
  );

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."seed_kyc_lba_checks"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_kyc_document_retention"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NEW.kyc_case_id IS NOT NULL AND NEW.retention_until IS NULL THEN
    NEW.retention_until := NEW.created_at + interval '10 years';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_kyc_document_retention"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_ticket_sla"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  sla RECORD;
BEGIN
  SELECT * INTO sla FROM calculate_sla(NEW.priority, COALESCE(NEW.created_at, now()));
  NEW.sla_first_response_due := sla.first_response_due;
  NEW.sla_resolution_due := sla.resolution_due;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_ticket_sla"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."slugify"("input" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT trim(both '-' from regexp_replace(
    regexp_replace(
      lower(unaccent(coalesce(input, ''))),
      '[^a-z0-9]+', '-', 'g'
    ),
    '-+', '-', 'g'
  ));
$$;


ALTER FUNCTION "public"."slugify"("input" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."storage_size_mb"() RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT COALESCE(
    (SELECT (SUM(COALESCE((metadata->>'size')::bigint, 0)) / (1024 * 1024))::integer
     FROM storage.objects),
    0
  );
$$;


ALTER FUNCTION "public"."storage_size_mb"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_matching_on_new_search"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  base_url TEXT;
  svc_key TEXT;
BEGIN
  IF NEW.is_active = true THEN
    base_url := get_app_config('supabase_url');
    svc_key := get_app_config('service_role_key');
    PERFORM net.http_post(
      url := base_url || '/functions/v1/matching-engine',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || svc_key
      ),
      body := jsonb_build_object(
        'mode', 'match-contact',
        'contact_id', NEW.contact_id,
        'agency_id', NEW.agency_id
      )
    );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_matching_on_new_search"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_matching_on_price_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  base_url TEXT;
  svc_key TEXT;
BEGIN
  IF NEW.status = 'active' AND NEW.price IS DISTINCT FROM OLD.price THEN
    DELETE FROM matches
    WHERE property_id = NEW.id AND status = 'suggested';
    base_url := get_app_config('supabase_url');
    svc_key := get_app_config('service_role_key');
    PERFORM net.http_post(
      url := base_url || '/functions/v1/matching-engine',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || svc_key
      ),
      body := jsonb_build_object(
        'mode', 'match-property',
        'property_id', NEW.id,
        'agency_id', NEW.agency_id
      )
    );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_matching_on_price_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_matching_on_property_active"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  base_url TEXT;
  svc_key TEXT;
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.status = 'active')
     OR (TG_OP = 'UPDATE' AND NEW.status = 'active' AND (OLD.status IS DISTINCT FROM 'active'))
  THEN
    base_url := get_app_config('supabase_url');
    svc_key := get_app_config('service_role_key');
    PERFORM net.http_post(
      url := base_url || '/functions/v1/matching-engine',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || svc_key
      ),
      body := jsonb_build_object(
        'mode', 'match-property',
        'property_id', NEW.id,
        'agency_id', NEW.agency_id
      )
    );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_matching_on_property_active"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_matching_on_search_updated"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  base_url TEXT;
  svc_key TEXT;
BEGIN
  IF NEW.is_active = true AND (
    NEW.criteria IS DISTINCT FROM OLD.criteria
  ) THEN
    base_url := get_app_config('supabase_url');
    svc_key := get_app_config('service_role_key');
    PERFORM net.http_post(
      url := base_url || '/functions/v1/matching-engine',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || svc_key
      ),
      body := jsonb_build_object(
        'mode', 'match-contact',
        'contact_id', NEW.contact_id,
        'agency_id', NEW.agency_id
      )
    );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_matching_on_search_updated"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."unpublish_expired_mandates"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE properties
    SET status = 'archived'
  WHERE status = 'active'
    AND deleted_at IS NULL
    AND mandate_expires_at IS NOT NULL
    AND mandate_expires_at < now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."unpublish_expired_mandates"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_email_token_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_email_token_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_market_listings_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;


ALTER FUNCTION "public"."update_market_listings_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_marketplace_inquiries_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_marketplace_inquiries_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_thread_on_new_message"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  UPDATE message_threads SET last_message = NEW.content, last_message_at = NEW.created_at, unread_count = CASE WHEN NEW.sender_type = 'contact' THEN unread_count + 1 ELSE unread_count END WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_thread_on_new_message"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_ticket_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_ticket_timestamp"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agency_id" "uuid",
    "actor_id" "uuid",
    "action" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "severity" "text" DEFAULT 'info'::"text",
    "category" "text",
    "object_label" "text",
    "ip_address" "text",
    "actor_kind" "text" DEFAULT 'user'::"text" NOT NULL,
    CONSTRAINT "activity_events_actor_kind_check" CHECK (("actor_kind" = ANY (ARRAY['user'::"text", 'ai'::"text", 'system'::"text"]))),
    CONSTRAINT "activity_events_actor_kind_coherence" CHECK ((("actor_id" IS NULL) OR ("actor_kind" = 'user'::"text"))),
    CONSTRAINT "activity_events_category_check" CHECK (("category" = ANY (ARRAY['kyc'::"text", 'deal'::"text", 'contact'::"text", 'bien'::"text", 'doc'::"text", 'auth'::"text", 'settings'::"text", 'ai'::"text"]))),
    CONSTRAINT "activity_events_severity_check" CHECK (("severity" = ANY (ARRAY['info'::"text", 'warn'::"text", 'critical'::"text"])))
);


ALTER TABLE "public"."activity_events" OWNER TO "postgres";


COMMENT ON COLUMN "public"."activity_events"."severity" IS 'AuditEvent nLPD severity. Handoff §1 — warn pour passage outre verrou KYC, critical pour stage=signed ou échec auth.';



COMMENT ON COLUMN "public"."activity_events"."category" IS 'AuditEvent nLPD category. Handoff §Modèle de données : kyc/deal/contact/bien/doc/auth/settings/ai.';



COMMENT ON COLUMN "public"."activity_events"."object_label" IS 'Libellé humain de l''objet ciblé (handoff : object.label). Ex: "Marie Bertrand · Eaux-Vives 4p".';



COMMENT ON COLUMN "public"."activity_events"."ip_address" IS 'Adresse IP de l''acteur (nullable pour acteurs système).';



COMMENT ON COLUMN "public"."activity_events"."actor_kind" IS 'Sprint 3 (G2) : discriminator de l''acteur. ''user'' = humain authentifié (actor_id pointe vers profiles), ''ai'' = MEGGA AI (actor_id NULL), ''system'' = job batch / trigger SQL (actor_id NULL).';



COMMENT ON CONSTRAINT "activity_events_actor_kind_coherence" ON "public"."activity_events" IS 'Sprint 3 (G2) : un actor_id UUID renseigné implique actor_kind=''user''. Empêche un trigger de mettre actor_id=auth.uid() puis actor_kind=''ai'' par erreur.';



CREATE TABLE IF NOT EXISTS "public"."admin_changelog" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" DEFAULT ''::"text" NOT NULL,
    "version" "text",
    "published" boolean DEFAULT true NOT NULL,
    "author_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."admin_changelog" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_feature_flags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "label" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "enabled_globally" boolean DEFAULT false NOT NULL,
    "enabled_plans" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "enabled_agencies" "uuid"[] DEFAULT '{}'::"uuid"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."admin_feature_flags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "author_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "admin_notes_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['agency'::"text", 'user'::"text", 'kyc_case'::"text", 'ticket'::"text", 'property'::"text"])))
);


ALTER TABLE "public"."admin_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_nps_responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "rating" smallint NOT NULL,
    "comment" "text" DEFAULT ''::"text" NOT NULL,
    "user_id" "uuid",
    "user_email" "text",
    "user_name" "text",
    "agency_id" "uuid",
    "role" "text",
    "submitted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "admin_nps_responses_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."admin_nps_responses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agencies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "logo_url" "text",
    "address" "text",
    "phone" "text",
    "email" "text",
    "plan" "public"."agency_plan" DEFAULT 'starter'::"public"."agency_plan" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "stripe_customer_id" "text",
    "status" "text" DEFAULT 'active'::"text",
    "monthly_target" numeric(12,2) DEFAULT 0,
    "quarterly_target" numeric(12,2) DEFAULT 0,
    "yearly_target" numeric(12,2) DEFAULT 0,
    "city" "text",
    "canton" "text",
    "website" "text",
    "billing" "text" DEFAULT 'monthly'::"text",
    "solo" boolean DEFAULT false,
    "created_by" "uuid",
    CONSTRAINT "agencies_billing_check" CHECK ((("billing" IS NULL) OR ("billing" = ANY (ARRAY['monthly'::"text", 'yearly'::"text"])))),
    CONSTRAINT "agencies_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'suspended'::"text"])))
);


ALTER TABLE "public"."agencies" OWNER TO "postgres";


COMMENT ON COLUMN "public"."agencies"."monthly_target" IS 'Objectif de revenu mensuel (commission projetée) — affiché dans le Dashboard Cockpit.';



COMMENT ON COLUMN "public"."agencies"."quarterly_target" IS 'Objectif de revenu trimestriel — affiché dans le Dashboard Cockpit (toggle period=quarter).';



COMMENT ON COLUMN "public"."agencies"."yearly_target" IS 'Objectif de revenu annuel — affiché dans le Dashboard Cockpit (toggle period=year).';



CREATE TABLE IF NOT EXISTS "public"."agency_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agency_id" "uuid",
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "logo_url" "text",
    "canton" "text",
    "city" "text",
    "address" "text",
    "description" "text",
    "founded_year" integer,
    "specialties" "text"[] DEFAULT '{}'::"text"[],
    "languages" "text"[] DEFAULT '{}'::"text"[],
    "certifications" "text"[] DEFAULT '{}'::"text"[],
    "website_url" "text",
    "phone" "text",
    "email" "text",
    "zones_covered" "text"[] DEFAULT '{}'::"text"[],
    "status" "text" DEFAULT 'unclaimed'::"text" NOT NULL,
    "claim_token" "uuid" DEFAULT "gen_random_uuid"(),
    "claimed_at" timestamp with time zone,
    "verified_at" timestamp with time zone,
    "agent_count" integer DEFAULT 0,
    "active_listings_count" integer DEFAULT 0,
    "rating_avg" numeric DEFAULT 0,
    "rating_count" integer DEFAULT 0,
    "source" "text",
    "source_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "uid_che" "text",
    "lookmove_agency_id" integer,
    "enriched_at" timestamp with time zone,
    CONSTRAINT "agency_profiles_status_check" CHECK (("status" = ANY (ARRAY['unclaimed'::"text", 'claimed'::"text", 'verified'::"text"])))
);


ALTER TABLE "public"."agency_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid",
    "agency_profile_id" "uuid",
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "photo_url" "text",
    "canton" "text",
    "city" "text",
    "specialties" "text"[] DEFAULT '{}'::"text"[],
    "languages" "text"[] DEFAULT '{}'::"text"[],
    "bio" "text",
    "experience_years" integer,
    "certifications" "text"[] DEFAULT '{}'::"text"[],
    "website_url" "text",
    "phone" "text",
    "email" "text",
    "status" "text" DEFAULT 'unclaimed'::"text" NOT NULL,
    "claim_token" "uuid" DEFAULT "gen_random_uuid"(),
    "claimed_at" timestamp with time zone,
    "verified_at" timestamp with time zone,
    "stats_properties_sold" integer DEFAULT 0,
    "stats_avg_price" numeric DEFAULT 0,
    "stats_avg_days_to_sell" integer DEFAULT 0,
    "stats_response_rate" numeric DEFAULT 0,
    "stats_updated_at" timestamp with time zone,
    "meta_title" "text",
    "meta_description" "text",
    "rating_avg" numeric DEFAULT 0,
    "rating_count" integer DEFAULT 0,
    "source" "text",
    "source_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "agent_profiles_status_check" CHECK (("status" = ANY (ARRAY['unclaimed'::"text", 'claimed'::"text", 'verified'::"text"])))
);


ALTER TABLE "public"."agent_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_profile_id" "uuid" NOT NULL,
    "reviewer_name" "text" NOT NULL,
    "reviewer_email" "text",
    "reviewer_contact_id" "uuid",
    "is_verified" boolean DEFAULT false,
    "rating_local_knowledge" smallint NOT NULL,
    "rating_process_expertise" smallint NOT NULL,
    "rating_responsiveness" smallint NOT NULL,
    "rating_negotiation" smallint NOT NULL,
    "rating_overall" numeric GENERATED ALWAYS AS (((((("rating_local_knowledge" + "rating_process_expertise") + "rating_responsiveness") + "rating_negotiation"))::numeric / 4.0)) STORED,
    "comment" "text",
    "agent_response" "text",
    "agent_responded_at" timestamp with time zone,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "moderated_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "agent_reviews_rating_local_knowledge_check" CHECK ((("rating_local_knowledge" >= 1) AND ("rating_local_knowledge" <= 5))),
    CONSTRAINT "agent_reviews_rating_negotiation_check" CHECK ((("rating_negotiation" >= 1) AND ("rating_negotiation" <= 5))),
    CONSTRAINT "agent_reviews_rating_process_expertise_check" CHECK ((("rating_process_expertise" >= 1) AND ("rating_process_expertise" <= 5))),
    CONSTRAINT "agent_reviews_rating_responsiveness_check" CHECK ((("rating_responsiveness" >= 1) AND ("rating_responsiveness" <= 5))),
    CONSTRAINT "agent_reviews_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."agent_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_actions_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "agency_id" "uuid" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid",
    "action_type" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "autonomy_required" "text" DEFAULT 'suggest'::"text" NOT NULL,
    "scheduled_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone,
    "validated_by" "uuid",
    "sent_at" timestamp with time zone,
    "dismissed_at" timestamp with time zone,
    "source_event_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ai_actions_autonomy_check" CHECK (("autonomy_required" = ANY (ARRAY['suggest'::"text", 'notify'::"text", 'resume'::"text"]))),
    CONSTRAINT "ai_actions_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['contact'::"text", 'deal'::"text", 'visit'::"text", 'briefing'::"text", 'property'::"text", 'kyc'::"text"]))),
    CONSTRAINT "ai_actions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'dismissed'::"text", 'cancelled'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."ai_actions_queue" OWNER TO "postgres";


COMMENT ON TABLE "public"."ai_actions_queue" IS 'Queue partagée des actions IA proposées par les moteurs (relances, briefings, drafts). Source de vérité pour le pop-up "brouillons en attente de validation" promis dans la synthèse Premier jour.';



COMMENT ON COLUMN "public"."ai_actions_queue"."autonomy_required" IS 'Snapshot du niveau autonomy agent au moment de la création. Permet aux engines en aval de décider sans relire profiles.day0_payload.';



COMMENT ON COLUMN "public"."ai_actions_queue"."scheduled_at" IS 'Quand l''action doit être affichée/envoyée. Un cron lit cette colonne pour faire avancer les actions ready.';



CREATE TABLE IF NOT EXISTS "public"."ai_balance_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "captured_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "provider" "text" NOT NULL,
    "total_balance_usd" numeric(10,2),
    "topped_up_balance_usd" numeric(10,2),
    "granted_balance_usd" numeric(10,2)
);


ALTER TABLE "public"."ai_balance_snapshots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_usage_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "edge_function" "text" NOT NULL,
    "provider" "text" NOT NULL,
    "input_tokens" integer NOT NULL,
    "output_tokens" integer NOT NULL,
    "estimated_cost_usd" numeric(10,6) NOT NULL,
    "was_fallback" boolean DEFAULT false NOT NULL,
    CONSTRAINT "ai_usage_logs_provider_check" CHECK (("provider" = ANY (ARRAY['deepseek'::"text", 'claude-sonnet'::"text", 'claude-haiku'::"text"])))
);


ALTER TABLE "public"."ai_usage_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_config" (
    "key" "text" NOT NULL,
    "value" "text" NOT NULL
);


ALTER TABLE "public"."app_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."article_feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "article_slug" "text" NOT NULL,
    "helpful" boolean NOT NULL,
    "comment" "text",
    "user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."article_feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."article_views" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "article_slug" "text" NOT NULL,
    "user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."article_views" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."auth_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "action" "text" NOT NULL,
    "severity" "text" DEFAULT 'info'::"text" NOT NULL,
    "ip_hash" "text",
    "user_agent" "text",
    "detail" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "auth_events_action_check" CHECK (("action" ~ '^(signin|signup|magic_link|password|oauth|signout)\.'::"text")),
    CONSTRAINT "auth_events_severity_check" CHECK (("severity" = ANY (ARRAY['info'::"text", 'warn'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."auth_events" OWNER TO "postgres";


COMMENT ON TABLE "public"."auth_events" IS 'Télémétrie nLPD des actions d''auth. Insert public (anon + authenticated), lecture super_admin seulement. Pas de PII brut.';



CREATE TABLE IF NOT EXISTS "public"."automation_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agency_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "trigger_event" "text" NOT NULL,
    "action" "text" NOT NULL,
    "delay_days" integer DEFAULT 3,
    "template_id" "uuid",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "auto_send" boolean DEFAULT false,
    CONSTRAINT "automation_rules_action_check" CHECK (("action" = ANY (ARRAY['create_reminder'::"text", 'send_email'::"text", 'send_whatsapp'::"text", 'create_task'::"text", 'notify_agent'::"text"]))),
    CONSTRAINT "automation_rules_trigger_event_check" CHECK (("trigger_event" = ANY (ARRAY['property_sent'::"text", 'visit_completed'::"text", 'lead_inactive'::"text", 'document_missing'::"text", 'new_match'::"text"])))
);


ALTER TABLE "public"."automation_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."calendar_sync" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "visit_id" "uuid" NOT NULL,
    "google_event_id" "text" NOT NULL,
    "google_calendar_id" "text" DEFAULT 'primary'::"text",
    "last_synced_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."calendar_sync" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."market_listings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "canton" "text" NOT NULL,
    "city" "text" NOT NULL,
    "postal_code" "text",
    "address" "text",
    "lat" double precision,
    "lng" double precision,
    "title" "text" NOT NULL,
    "description" "text",
    "type" "text" DEFAULT 'apartment'::"text" NOT NULL,
    "transaction_type" "text" DEFAULT 'buy'::"text" NOT NULL,
    "price" numeric(12,2),
    "currency" "text" DEFAULT 'CHF'::"text" NOT NULL,
    "price_at_first_seen" numeric(12,2),
    "current_price" numeric(12,2),
    "price_per_m2" numeric(10,2),
    "rooms" numeric(3,1),
    "bedrooms" integer,
    "bathrooms" integer,
    "surface_m2" numeric(8,2),
    "floor" integer,
    "features" "jsonb" DEFAULT '[]'::"jsonb",
    "photos" "text"[] DEFAULT '{}'::"text"[],
    "photos_count" integer DEFAULT 0,
    "source_portal" "text" DEFAULT 'realadvisor'::"text" NOT NULL,
    "source_url" "text",
    "source_id" "text" NOT NULL,
    "agency_name" "text",
    "agency_phone" "text",
    "first_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "days_on_market" integer DEFAULT 0,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "quality_score" integer DEFAULT 0,
    "quality_flags" "jsonb" DEFAULT '[]'::"jsonb",
    "year_built" integer,
    "year_renovated" integer,
    "usable_surface" numeric(8,2),
    "land_surface" numeric(8,2),
    "parking_count" integer,
    "property_type_detail" "text",
    "visit_contact_name" "text",
    "visit_contact_phone" "text",
    "agency_logo_url" "text",
    "agency_reference" "text",
    "has_balcony" boolean DEFAULT false,
    "has_parking" boolean DEFAULT false,
    "has_garage" boolean DEFAULT false,
    "has_elevator" boolean DEFAULT false,
    "has_nice_view" boolean DEFAULT false,
    "has_fireplace" boolean DEFAULT false,
    "has_swimming_pool" boolean DEFAULT false,
    "is_minergie" boolean DEFAULT false,
    "is_new_building" boolean DEFAULT false,
    "is_child_friendly" boolean DEFAULT false,
    "pets_allowed" boolean DEFAULT false,
    "description_de" "text",
    "description_en" "text",
    "description_it" "text",
    "listing_type" "text",
    "platforms" "text"[],
    "agency_contact_name" "text",
    "agency_contact_phone" "text",
    "source_created_at" timestamp with time zone,
    "source_updated_at" timestamp with time zone,
    "minergie_label" "text",
    "energy_label" "text",
    "floor_plan_url" "text",
    "floor_plan_hotspots" "jsonb" DEFAULT '[]'::"jsonb",
    "photo_tags" "jsonb" DEFAULT '[]'::"jsonb",
    "deposit_months" smallint,
    "is_furnished" boolean DEFAULT false,
    "external_regie" "jsonb",
    "availability_date" "date",
    "charges_monthly" integer,
    "agency_profile_id" "uuid",
    "photos_cf" "jsonb",
    "photos_cf_processed_at" timestamp with time zone,
    "c2pa_verified" boolean DEFAULT false,
    "relevance_score" numeric(4,3) GENERATED ALWAYS AS ((((((((LEAST(GREATEST(COALESCE("quality_score", 0), 0), 100))::numeric / 100.0) * 0.30) + (((LEAST(COALESCE("array_length"("photos", 1), 0), 8))::numeric / 8.0) * 0.25)) + ((
CASE
    WHEN (("rooms" IS NOT NULL) AND ("rooms" > (0)::numeric)) THEN 0.05
    ELSE (0)::numeric
END +
CASE
    WHEN (("surface_m2" IS NOT NULL) AND ("surface_m2" > (0)::numeric)) THEN 0.05
    ELSE (0)::numeric
END) +
CASE
    WHEN (("bedrooms" IS NOT NULL) AND ("bedrooms" > 0)) THEN 0.05
    ELSE (0)::numeric
END)) +
CASE
    WHEN (("current_price" IS NOT NULL) AND ("current_price" > (0)::numeric)) THEN 0.20
    ELSE (0)::numeric
END) +
CASE
    WHEN (("description" IS NOT NULL) AND ("length"("description") > 100)) THEN 0.10
    ELSE (0)::numeric
END)) STORED
);


ALTER TABLE "public"."market_listings" OWNER TO "postgres";


COMMENT ON COLUMN "public"."market_listings"."availability_date" IS 'Date d''entrée / moving date (surtout pour locations)';



COMMENT ON COLUMN "public"."market_listings"."charges_monthly" IS 'Charges mensuelles en CHF (locations surtout)';



COMMENT ON COLUMN "public"."market_listings"."photos_cf" IS 'Cloudflare R2 variants per photo. Array of {id, thumb, detail, hero} URLs under img.megga.ch. NULL = not yet processed, fall back to `photos` (Flatfox URLs).';



COMMENT ON COLUMN "public"."market_listings"."photos_cf_processed_at" IS 'Timestamp of last successful R2 upload. NULL = pending backfill.';



COMMENT ON COLUMN "public"."market_listings"."relevance_score" IS 'Static quality blend 0-1. 30% quality + 25% photos + 15% completeness + 20% price valid + 10% description. STORED (recalculated on write, no batch needed). Used by sort=recommended in useMarketListings.';



CREATE MATERIALIZED VIEW "public"."cantonal_price_medians" AS
 SELECT "canton",
    "transaction_type",
    "type",
    ("percentile_cont"((0.5)::double precision) WITHIN GROUP (ORDER BY (("price_per_m2")::double precision)))::numeric(10,2) AS "median_price_per_m2",
    ("count"(*))::integer AS "sample_size"
   FROM "public"."market_listings"
  WHERE (("status" = 'active'::"text") AND ("quality_score" >= 50) AND ("price_per_m2" IS NOT NULL) AND ("price_per_m2" > (0)::numeric) AND ("price_per_m2" < (50000)::numeric) AND ("canton" IS NOT NULL))
  GROUP BY "canton", "transaction_type", "type"
 HAVING ("count"(*) >= 5)
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."cantonal_price_medians" OWNER TO "postgres";


COMMENT ON MATERIALIZED VIEW "public"."cantonal_price_medians" IS 'Median price/m² by (canton, transaction_type, type). Refreshed daily by pg_cron 04:30 UTC. Public read for the "Bon prix" badge on listing cards (Comparis-style).';



CREATE TABLE IF NOT EXISTS "public"."chat_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_ref" "text" NOT NULL,
    "user_id" "uuid",
    "category" "text",
    "status" "text" DEFAULT 'active'::"text",
    "accepted_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "chat_conversations_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'escalated'::"text", 'closed'::"text"])))
);


ALTER TABLE "public"."chat_conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid",
    "role" "text" NOT NULL,
    "content" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "chat_messages_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'assistant'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."chat_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."client_searches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agency_id" "uuid" NOT NULL,
    "contact_id" "uuid" NOT NULL,
    "label" "text",
    "criteria" "jsonb" NOT NULL,
    "is_active" boolean DEFAULT true,
    "last_matched_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."client_searches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coming_soon_subscribers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "locale" "text" DEFAULT 'fr'::"text" NOT NULL,
    "source" "text" DEFAULT 'coming_soon_splash'::"text" NOT NULL,
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."coming_soon_subscribers" OWNER TO "postgres";


COMMENT ON TABLE "public"."coming_soon_subscribers" IS 'Waitlist publique collectée via le splash Coming Soon avant lancement du site.';



COMMENT ON COLUMN "public"."coming_soon_subscribers"."email" IS 'Email du visiteur (unique). Utilisé pour notifier le lancement.';



COMMENT ON COLUMN "public"."coming_soon_subscribers"."locale" IS 'Langue du visiteur au moment de l''inscription (fr/de/en/it).';



COMMENT ON COLUMN "public"."coming_soon_subscribers"."source" IS 'Origine de l''inscription (default: coming_soon_splash, sinon /coming-soon page).';



COMMENT ON COLUMN "public"."coming_soon_subscribers"."user_agent" IS 'User-agent du navigateur (audit léger anti-spam).';



CREATE TABLE IF NOT EXISTS "public"."contact_scores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contact_id" "uuid" NOT NULL,
    "agency_id" "uuid" NOT NULL,
    "reactivity_score" integer DEFAULT 0,
    "engagement_score" integer DEFAULT 0,
    "budget_coherence_score" integer DEFAULT 0,
    "visit_quality_score" integer DEFAULT 0,
    "buyer_score" integer DEFAULT 0,
    "conversion_probability" integer DEFAULT 0,
    "estimated_real_budget" numeric(12,2),
    "rejection_patterns" "jsonb" DEFAULT '[]'::"jsonb",
    "intent_signals" "jsonb" DEFAULT '{}'::"jsonb",
    "engagement_trend" "text" DEFAULT 'stable'::"text",
    "interactions_count" integer DEFAULT 0,
    "visits_count" integer DEFAULT 0,
    "matches_sent_count" integer DEFAULT 0,
    "last_calculated_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."contact_scores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agency_id" "uuid",
    "user_id" "uuid",
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text",
    "type" "text" NOT NULL,
    "entity_type" "text" DEFAULT 'pp'::"text" NOT NULL,
    "source" "text" DEFAULT 'onboarding'::"text" NOT NULL,
    "score" "text" DEFAULT 'warm'::"text",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "notes" "text",
    "form_data" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_user_id" "uuid",
    "import_raw_text" "text",
    "import_raw_text_received_at" timestamp with time zone,
    CONSTRAINT "contacts_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['pp'::"text", 'pm'::"text"]))),
    CONSTRAINT "contacts_score_check" CHECK (("score" = ANY (ARRAY['hot'::"text", 'warm'::"text", 'cold'::"text"]))),
    CONSTRAINT "contacts_source_check" CHECK (("source" = ANY (ARRAY['onboarding'::"text", 'manual'::"text", 'import'::"text", 'website'::"text", 'referral'::"text"]))),
    CONSTRAINT "contacts_type_check" CHECK (("type" = ANY (ARRAY['buyer'::"text", 'seller'::"text", 'tenant'::"text", 'landlord'::"text", 'investor'::"text", 'both'::"text", 'lead'::"text"])))
);

ALTER TABLE ONLY "public"."contacts" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."contacts" OWNER TO "postgres";


COMMENT ON COLUMN "public"."contacts"."import_raw_text" IS 'Sprint 3 (A.7) : message brut reçu lors de l''import lead IA (PII redactée côté serveur). Purgé à 90j par cron daily-import-raw-text-purge.';



COMMENT ON COLUMN "public"."contacts"."import_raw_text_received_at" IS 'Sprint 3 (A.7) : date de réception du rawText. Sert au décompte des 90j de rétention.';



COMMENT ON CONSTRAINT "contacts_type_check" ON "public"."contacts" IS 'Sprint 3 : domaine élargi pour absorber l''extraction Import Lead IA (intent ∈ {buyer, seller, tenant}) et matcher le type ContactType côté front. 4 valeurs historiques préservées.';



CREATE TABLE IF NOT EXISTS "public"."crm_offers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "deal_id" "uuid",
    "agency_id" "uuid" NOT NULL,
    "parent_offer_id" "uuid",
    "kind" "public"."crm_offer_kind" NOT NULL,
    "from_party" "public"."crm_offer_party" NOT NULL,
    "by_id" "uuid",
    "by_label" "text" NOT NULL,
    "amount" bigint NOT NULL,
    "currency" "text" DEFAULT 'CHF'::"text" NOT NULL,
    "conditions" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "deposit" bigint,
    "closing_date" timestamp with time zone,
    "expires_at" timestamp with time zone NOT NULL,
    "attachments" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "notes" "text",
    "status" "public"."crm_offer_status" DEFAULT 'pending'::"public"."crm_offer_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "responded_at" timestamp with time zone,
    "created_by" "uuid",
    CONSTRAINT "crm_offers_amount_positive" CHECK (("amount" > 0)),
    CONSTRAINT "crm_offers_counter_has_parent" CHECK ((("kind" = 'offer'::"public"."crm_offer_kind") OR ("parent_offer_id" IS NOT NULL))),
    CONSTRAINT "crm_offers_deposit_non_negative" CHECK ((("deposit" IS NULL) OR ("deposit" >= 0))),
    CONSTRAINT "crm_offers_no_self_parent" CHECK ((("parent_offer_id" IS NULL) OR ("parent_offer_id" <> "id")))
);


ALTER TABLE "public"."crm_offers" OWNER TO "postgres";


COMMENT ON TABLE "public"."crm_offers" IS 'Sprint 2 : chaîne d''offres + contre-offres par deal. Distincte de la table legacy offers (schéma minimal, conservée pour rétro-compat).';



COMMENT ON COLUMN "public"."crm_offers"."parent_offer_id" IS 'NULL = offre racine. Sinon : id de l''offre parente (counter répond à un parent).';



COMMENT ON COLUMN "public"."crm_offers"."conditions" IS 'Conditions suspensives Sprint 2 (handoff §Modèle de données) : 4 toggles + texte libre.';



COMMENT ON COLUMN "public"."crm_offers"."expires_at" IS 'Statut bascule auto pending → expired via cron crm-offers-expire-hourly.';



CREATE TABLE IF NOT EXISTS "public"."daily_actions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agency_id" "uuid" NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "priority" "text" NOT NULL,
    "category" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "entity_type" "text",
    "entity_id" "uuid",
    "action_type" "text",
    "is_completed" boolean DEFAULT false,
    "generated_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    CONSTRAINT "daily_actions_action_type_check" CHECK (("action_type" = ANY (ARRAY['call'::"text", 'email'::"text", 'whatsapp'::"text", 'send_property'::"text", 'plan_visit'::"text", 'review_document'::"text", 'adjust_price'::"text"]))),
    CONSTRAINT "daily_actions_category_check" CHECK (("category" = ANY (ARRAY['follow_up'::"text", 'match_found'::"text", 'visit_confirm'::"text", 'document_missing'::"text", 'deal_at_risk'::"text", 'suggestion'::"text"]))),
    CONSTRAINT "daily_actions_priority_check" CHECK (("priority" = ANY (ARRAY['urgent'::"text", 'high'::"text", 'medium'::"text", 'low'::"text"])))
);


ALTER TABLE "public"."daily_actions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agency_id" "uuid",
    "property_id" "uuid",
    "transaction_id" "uuid",
    "kyc_case_id" "uuid",
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "size_bytes" bigint NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "issued_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "document_category" "text" DEFAULT 'other'::"text",
    "retention_until" timestamp with time zone,
    "sha256_hash" "text",
    CONSTRAINT "documents_document_category_check" CHECK (("document_category" = ANY (ARRAY['identity'::"text", 'domicile'::"text", 'financial'::"text", 'compliance'::"text", 'other'::"text"]))),
    CONSTRAINT "documents_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'available'::"text", 'signed'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."documents" OWNER TO "postgres";


COMMENT ON COLUMN "public"."documents"."sha256_hash" IS 'SHA-256 hex du contenu fichier (64 chars). Calculé côté client avant upload (Web Crypto API). Permet de prouver à FINMA que le document n''a pas été altéré post-upload. NULL pour les documents legacy sans hash.';



CREATE TABLE IF NOT EXISTS "public"."email_messages_cache" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "external_message_id" "text" NOT NULL,
    "external_thread_id" "text",
    "from_address" "text",
    "from_name" "text",
    "to_addresses" "text"[],
    "cc_addresses" "text"[],
    "subject" "text",
    "snippet" "text",
    "contact_id" "uuid",
    "sent_at" timestamp with time zone NOT NULL,
    "is_unread" boolean DEFAULT false,
    "has_attachments" boolean DEFAULT false,
    "fetched_at" timestamp with time zone DEFAULT "now"(),
    "ai_classification" "text",
    "ai_priority" smallint,
    "ai_intents" "jsonb",
    "ai_suggested_replies" "jsonb",
    "ai_classified_at" timestamp with time zone,
    CONSTRAINT "email_messages_cache_ai_classification_check" CHECK ((("ai_classification" IS NULL) OR ("ai_classification" = ANY (ARRAY['lead_chaud'::"text", 'lead_tiede'::"text", 'question_simple'::"text", 'spam'::"text", 'interne'::"text"])))),
    CONSTRAINT "email_messages_cache_ai_priority_check" CHECK ((("ai_priority" IS NULL) OR (("ai_priority" >= 0) AND ("ai_priority" <= 100)))),
    CONSTRAINT "email_messages_cache_provider_check" CHECK (("provider" = ANY (ARRAY['gmail'::"text", 'outlook'::"text"])))
);


ALTER TABLE "public"."email_messages_cache" OWNER TO "postgres";


COMMENT ON COLUMN "public"."email_messages_cache"."ai_classification" IS 'Classification IA du message — lead_chaud, lead_tiede, question_simple, spam, interne. NULL si pas encore traité.';



COMMENT ON COLUMN "public"."email_messages_cache"."ai_priority" IS 'Score 0-100 — importance perçue (urgence, valeur business). NULL si pas classifié.';



COMMENT ON COLUMN "public"."email_messages_cache"."ai_intents" IS 'Array d''intentions détectées : ["request_visit", "ask_price", "negative_signal", ...]';



COMMENT ON COLUMN "public"."email_messages_cache"."ai_suggested_replies" IS 'Array d''objets {label, body} — 2-3 brouillons de réponse que l''agent peut envoyer en 1 click.';



CREATE TABLE IF NOT EXISTS "public"."external_listings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agency_id" "uuid",
    "search_hash" "text" NOT NULL,
    "external_id" "text",
    "title" "text",
    "price" numeric,
    "address" "text",
    "city" "text",
    "canton" "text",
    "rooms" numeric,
    "surface_m2" numeric,
    "type" "text",
    "photo_url" "text",
    "source_url" "text" NOT NULL,
    "source_portal" "text" DEFAULT 'realadvisor'::"text",
    "source_agency" "text",
    "source_logo_url" "text",
    "fetched_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone DEFAULT ("now"() + '01:00:00'::interval)
);


ALTER TABLE "public"."external_listings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."favorites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "listing_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."favorites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gmail_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "access_token" "text" NOT NULL,
    "refresh_token" "text" NOT NULL,
    "token_expires_at" timestamp with time zone NOT NULL,
    "sync_enabled" boolean DEFAULT true,
    "gmail_email" "text",
    "scopes" "text" DEFAULT 'https://www.googleapis.com/auth/gmail.readonly'::"text" NOT NULL,
    "last_sync_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."gmail_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."google_calendar_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "access_token" "text" NOT NULL,
    "refresh_token" "text" NOT NULL,
    "token_expires_at" timestamp with time zone NOT NULL,
    "calendar_id" "text" DEFAULT 'primary'::"text",
    "sync_enabled" boolean DEFAULT true,
    "google_email" "text",
    "last_sync_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."google_calendar_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kyc_cases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agency_id" "uuid" NOT NULL,
    "transaction_id" "uuid",
    "contact_id" "uuid",
    "type" "public"."kyc_person_type" NOT NULL,
    "risk_level" "public"."kyc_risk_level" DEFAULT 'unassessed'::"public"."kyc_risk_level" NOT NULL,
    "status" "public"."kyc_status" DEFAULT 'pending'::"public"."kyc_status" NOT NULL,
    "completion_pct" integer DEFAULT 0 NOT NULL,
    "validated_by" "uuid",
    "validated_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "pep_status" "text" DEFAULT 'not_checked'::"text",
    "pep_details" "jsonb",
    "sanctions_status" "text" DEFAULT 'not_checked'::"text",
    "sanctions_details" "jsonb",
    "last_screening_at" timestamp with time zone,
    "contact_nationality" "text",
    "transaction_amount" numeric,
    "risk_score" integer,
    "risk_factors" "jsonb",
    "notes" "text",
    "vigilance" "text" DEFAULT 'standard'::"text",
    "expires_at" timestamp with time zone,
    "dossier_status" "text" DEFAULT 'none'::"text",
    "source_of_funds_type" "public"."kyc_source_of_funds_type",
    "source_of_funds_description" "text",
    "source_of_funds_doc_id" "uuid",
    "ai_analysis" "jsonb",
    CONSTRAINT "kyc_cases_dossier_status_check" CHECK (("dossier_status" = ANY (ARRAY['none'::"text", 'pending'::"text", 'verified'::"text", 'stale'::"text", 'failed'::"text"]))),
    CONSTRAINT "kyc_cases_pep_status_check" CHECK (("pep_status" = ANY (ARRAY['clear'::"text", 'match'::"text", 'pending'::"text", 'not_checked'::"text"]))),
    CONSTRAINT "kyc_cases_sanctions_status_check" CHECK (("sanctions_status" = ANY (ARRAY['clear'::"text", 'match'::"text", 'pending'::"text", 'not_checked'::"text"]))),
    CONSTRAINT "kyc_cases_source_of_funds_desc_check" CHECK ((("source_of_funds_type" IS NULL) OR ("source_of_funds_type" <> ALL (ARRAY['crypto'::"public"."kyc_source_of_funds_type", 'mixed'::"public"."kyc_source_of_funds_type", 'other'::"public"."kyc_source_of_funds_type"])) OR (("source_of_funds_description" IS NOT NULL) AND ("length"("source_of_funds_description") >= 20)))),
    CONSTRAINT "kyc_cases_vigilance_check" CHECK (("vigilance" = ANY (ARRAY['standard'::"text", 'renforced'::"text"])))
);

ALTER TABLE ONLY "public"."kyc_cases" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."kyc_cases" OWNER TO "postgres";


COMMENT ON COLUMN "public"."kyc_cases"."vigilance" IS 'LBA art. 3-4 (standard) vs art. 6 (renforced). Source : KYCDossier handoff.';



COMMENT ON COLUMN "public"."kyc_cases"."expires_at" IS 'verifiedAt + 12 mois. Déclenche re-screening (dossier_status passe à stale).';



COMMENT ON COLUMN "public"."kyc_cases"."dossier_status" IS 'Statut dossier 5 valeurs (handoff §Modèle de données). Distinct du legacy status (kyc_status enum).';



COMMENT ON COLUMN "public"."kyc_cases"."source_of_funds_type" IS 'LBA art. 6 al. 1 lit. b — typologie de l''origine des fonds. crypto / mixed = red flag automatique.';



COMMENT ON COLUMN "public"."kyc_cases"."source_of_funds_description" IS 'Description libre obligatoire si type=crypto / mixed / other. Justifie l''arrière-plan économique.';



COMMENT ON COLUMN "public"."kyc_cases"."source_of_funds_doc_id" IS 'Lien vers la pièce justificative (attestation, contrat de vente, déclaration crypto…). Catégorie financial ou compliance.';



COMMENT ON COLUMN "public"."kyc_cases"."ai_analysis" IS 'Sprint 4.5 — Analyse contextuelle Claude Sonnet 4 (couche assistance MLRO). Complète le screening Dilisense factuel. Format JSONB : { provider, analyzed_at, qualitative_risk, vigilance_recommendation, patterns_detected[], justification, additional_checks_suggested[], confidence }.';



CREATE TABLE IF NOT EXISTS "public"."kyc_checklist_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "kyc_case_id" "uuid" NOT NULL,
    "label" "text" NOT NULL,
    "category" "text",
    "is_required" boolean DEFAULT true NOT NULL,
    "is_completed" boolean DEFAULT false NOT NULL,
    "document_id" "uuid",
    "notes" "text",
    "completed_at" timestamp with time zone,
    "completed_by" "uuid"
);

ALTER TABLE ONLY "public"."kyc_checklist_items" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."kyc_checklist_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."kyc_magic_link_uploads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "magic_link_id" "uuid" NOT NULL,
    "agency_id" "uuid" NOT NULL,
    "type" "public"."kyc_magic_link_upload_type" DEFAULT 'other'::"public"."kyc_magic_link_upload_type" NOT NULL,
    "filename" "text" NOT NULL,
    "size_bytes" bigint NOT NULL,
    "mime_type" "text",
    "storage_path" "text" NOT NULL,
    "sha256_hash" "text",
    "uploaded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ocr_fields" "jsonb",
    "ocr_provider" "text",
    "ocr_completed_at" timestamp with time zone,
    "confirmed_by_client" boolean DEFAULT false NOT NULL,
    "confirmed_at" timestamp with time zone,
    "document_id" "uuid",
    CONSTRAINT "kyc_magic_link_uploads_filename_check" CHECK ((("length"("filename") >= 1) AND ("length"("filename") <= 255))),
    CONSTRAINT "kyc_magic_link_uploads_sha256_hash_check" CHECK ((("sha256_hash" IS NULL) OR ("sha256_hash" ~ '^[a-f0-9]{64}$'::"text"))),
    CONSTRAINT "kyc_magic_link_uploads_size_bytes_check" CHECK ((("size_bytes" > 0) AND ("size_bytes" <= ((10 * 1024) * 1024))))
);

ALTER TABLE ONLY "public"."kyc_magic_link_uploads" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."kyc_magic_link_uploads" OWNER TO "postgres";


COMMENT ON TABLE "public"."kyc_magic_link_uploads" IS 'Sprint 4.7.A — Pièces uploadées via le lien magique. Stockage temporaire bucket magic-link, transfert vers kyc-documents quand l''agent valide.';



CREATE TABLE IF NOT EXISTS "public"."kyc_magic_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "token" "text" NOT NULL,
    "agency_id" "uuid" NOT NULL,
    "kyc_case_id" "uuid" NOT NULL,
    "contact_id" "uuid" NOT NULL,
    "mode" "public"."kyc_magic_link_mode" DEFAULT 'libre'::"public"."kyc_magic_link_mode" NOT NULL,
    "channels" "text"[] DEFAULT ARRAY['email'::"text"] NOT NULL,
    "custom_message" "text",
    "status" "public"."kyc_magic_link_status" DEFAULT 'pending'::"public"."kyc_magic_link_status" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "opened_at" timestamp with time zone,
    "uploaded_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone,
    "expired_at" timestamp with time zone,
    "client_ip" "text",
    "client_user_agent" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "kyc_magic_links_channels_check" CHECK ((("cardinality"("channels") >= 1) AND ("channels" <@ ARRAY['email'::"text", 'sms'::"text"]))),
    CONSTRAINT "kyc_magic_links_custom_message_check" CHECK ((("custom_message" IS NULL) OR ("length"("custom_message") <= 500))),
    CONSTRAINT "kyc_magic_links_expires_after_sent" CHECK (("expires_at" > "sent_at"))
);

ALTER TABLE ONLY "public"."kyc_magic_links" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."kyc_magic_links" OWNER TO "postgres";


COMMENT ON TABLE "public"."kyc_magic_links" IS 'Sprint 4.7.A — Lien magique KYC self-service. L''agent crée le lien, le client (sans compte MEGGA) dépose ses pièces via une URL signée HMAC. Boucle le 3e chemin "Demander les pièces" du wizard KYC.';



COMMENT ON COLUMN "public"."kyc_magic_links"."token" IS 'Token HMAC URL-safe. Payload signé : { id, exp }. Vérification stricte serveur à chaque hit. JAMAIS exposer dossier_id ou contact_id dans le payload.';



CREATE TABLE IF NOT EXISTS "public"."kyc_screening_decisions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agency_id" "uuid" NOT NULL,
    "kyc_case_id" "uuid" NOT NULL,
    "decision_target" "text" NOT NULL,
    "decision" "text" NOT NULL,
    "justification" "text" NOT NULL,
    "decided_by" "uuid" NOT NULL,
    "decided_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "screening_snapshot" "jsonb" NOT NULL,
    "supersedes_id" "uuid",
    CONSTRAINT "kyc_screening_decisions_decision_check" CHECK (("decision" = ANY (ARRAY['false_positive'::"text", 'true_match'::"text", 'escalated'::"text", 'awaiting_evidence'::"text"]))),
    CONSTRAINT "kyc_screening_decisions_decision_target_check" CHECK (("decision_target" = ANY (ARRAY['sanctions'::"text", 'pep'::"text"]))),
    CONSTRAINT "kyc_screening_decisions_justification_check" CHECK (("length"("justification") >= 30))
);

ALTER TABLE ONLY "public"."kyc_screening_decisions" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."kyc_screening_decisions" OWNER TO "postgres";


COMMENT ON TABLE "public"."kyc_screening_decisions" IS 'Workflow décision compliance LBA : documente les conclusions humaines sur chaque match Dilisense. Append-only, immuable, conservation 10 ans (alignement art. 7 al. 3).';



COMMENT ON COLUMN "public"."kyc_screening_decisions"."decision_target" IS 'sanctions OU pep — un dossier peut avoir 2 décisions (une par cible).';



COMMENT ON COLUMN "public"."kyc_screening_decisions"."decision" IS 'false_positive = débloque verified · true_match = SAR/MROS · escalated = direction · awaiting_evidence = pause.';



COMMENT ON COLUMN "public"."kyc_screening_decisions"."justification" IS 'LBA art. 7 al. 1 lit. b — texte libre minimum 30 caractères. Conservé 10 ans.';



COMMENT ON COLUMN "public"."kyc_screening_decisions"."screening_snapshot" IS 'Copie immuable de pep_details + sanctions_details + risk_factors au moment T. Permet de prouver à FINMA sur quoi reposait la décision même si Dilisense répond différemment plus tard.';



CREATE TABLE IF NOT EXISTS "public"."listing_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "listing_id" "text" NOT NULL,
    "user_id" "uuid",
    "reason" "public"."listing_report_reason" NOT NULL,
    "comment" "text",
    "status" "public"."listing_report_status" DEFAULT 'open'::"public"."listing_report_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."listing_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."listings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "agency_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description_ai" "text",
    "price_display" "text",
    "is_featured" boolean DEFAULT false NOT NULL,
    "is_hot" boolean DEFAULT false NOT NULL,
    "views_count" integer DEFAULT 0 NOT NULL,
    "favorites_count" integer DEFAULT 0 NOT NULL,
    "published_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone
);


ALTER TABLE "public"."listings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."market_changes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "market_listing_id" "uuid",
    "change_type" "text" NOT NULL,
    "old_price" numeric(12,2),
    "new_price" numeric(12,2),
    "change_pct" numeric(6,2),
    "listing_title" "text",
    "listing_city" "text",
    "listing_canton" "text",
    "listing_type" "text",
    "listing_rooms" numeric(3,1),
    "detected_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "market_changes_change_type_check" CHECK (("change_type" = ANY (ARRAY['new'::"text", 'price_drop'::"text", 'price_increase'::"text", 'removed'::"text", 'relisted'::"text"])))
);


ALTER TABLE "public"."market_changes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."market_favorites" (
    "user_id" "uuid" NOT NULL,
    "listing_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."market_favorites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."market_hidden" (
    "user_id" "uuid" NOT NULL,
    "listing_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."market_hidden" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."market_price_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "market_listing_id" "uuid" NOT NULL,
    "old_price" numeric(12,2) NOT NULL,
    "new_price" numeric(12,2) NOT NULL,
    "change_pct" numeric(5,2),
    "detected_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."market_price_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."marketplace_inquiries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "listing_prefixed_id" "text",
    "market_listing_id" "uuid",
    "property_id" "uuid",
    "listing_title" "text",
    "listing_city" "text",
    "listing_canton" "text",
    "listing_transaction_type" "text",
    "full_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text",
    "message" "text",
    "agency_name" "text",
    "source_portal" "text",
    "source_url" "text",
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "ip_address" "inet",
    "user_agent" "text",
    "referer" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "marketplace_inquiries_status_check" CHECK (("status" = ANY (ARRAY['new'::"text", 'contacted'::"text", 'archived'::"text", 'spam'::"text"])))
);


ALTER TABLE "public"."marketplace_inquiries" OWNER TO "postgres";


COMMENT ON TABLE "public"."marketplace_inquiries" IS 'Public contact requests submitted from /propriete/:id detail page. Captures buyer/renter intent before account creation, routes to agency for follow-up.';



CREATE TABLE IF NOT EXISTS "public"."matches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agency_id" "uuid" NOT NULL,
    "contact_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    "client_search_id" "uuid",
    "score" integer NOT NULL,
    "reasons" "jsonb",
    "status" "text" DEFAULT 'suggested'::"text" NOT NULL,
    "sent_via" "text",
    "sent_at" timestamp with time zone,
    "response_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "source" "text" DEFAULT 'internal'::"text" NOT NULL,
    "market_listing_id" "uuid",
    CONSTRAINT "matches_score_check" CHECK ((("score" >= 0) AND ("score" <= 100))),
    CONSTRAINT "matches_sent_via_check" CHECK (("sent_via" = ANY (ARRAY['email'::"text", 'whatsapp'::"text", 'both'::"text"]))),
    CONSTRAINT "matches_status_check" CHECK (("status" = ANY (ARRAY['suggested'::"text", 'sent'::"text", 'visit_planned'::"text", 'interested'::"text", 'rejected'::"text", 'ignored'::"text"])))
);


ALTER TABLE "public"."matches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."message_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agency_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "category" "text" NOT NULL,
    "channel" "text" NOT NULL,
    "subject" "text",
    "body" "text" NOT NULL,
    "is_ai_generated" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "message_templates_category_check" CHECK (("category" = ANY (ARRAY['follow_up'::"text", 'visit_confirmation'::"text", 'property_presentation'::"text", 'post_visit'::"text", 'objection_response'::"text", 'offer_follow_up'::"text", 'thank_you'::"text", 'seller_update'::"text"]))),
    CONSTRAINT "message_templates_channel_check" CHECK (("channel" = ANY (ARRAY['email'::"text", 'whatsapp'::"text", 'both'::"text"])))
);


ALTER TABLE "public"."message_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."message_threads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agency_id" "uuid" NOT NULL,
    "property_id" "uuid",
    "property_title" "text",
    "contact_id" "uuid",
    "contact_name" "text" NOT NULL,
    "contact_type" "text" NOT NULL,
    "last_message" "text",
    "last_message_at" timestamp with time zone DEFAULT "now"(),
    "unread_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "buyer_user_id" "uuid",
    CONSTRAINT "message_threads_contact_type_check" CHECK (("contact_type" = ANY (ARRAY['buyer'::"text", 'seller'::"text"])))
);


ALTER TABLE "public"."message_threads" OWNER TO "postgres";


COMMENT ON COLUMN "public"."message_threads"."buyer_user_id" IS 'auth.users id of the public marketplace buyer who initiated the thread. NULL for agent-only threads (agent-contact relationship from the CRM).';



CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "thread_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "sender_type" "text" NOT NULL,
    "sender_name" "text" NOT NULL,
    "content" "text" NOT NULL,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "messages_sender_type_check" CHECK (("sender_type" = ANY (ARRAY['agent'::"text", 'contact'::"text"])))
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."moderation_actions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid",
    "action" "text" NOT NULL,
    "reason" "text",
    "actor_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "moderation_actions_action_check" CHECK (("action" = ANY (ARRAY['approve'::"text", 'flag'::"text", 'remove'::"text"])))
);


ALTER TABLE "public"."moderation_actions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."offers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "agency_id" "uuid",
    "contact_buyer_id" "uuid",
    "buyer_name" "text" NOT NULL,
    "amount" bigint NOT NULL,
    "conditions" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "responded_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "offers_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'refused'::"text", 'counter'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."offers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."onboarding_checklist" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "agency_id" "uuid",
    "step_key" "text" NOT NULL,
    "completed" boolean DEFAULT false,
    "completed_at" timestamp with time zone
);


ALTER TABLE "public"."onboarding_checklist" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."outlook_calendar_sync" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "visit_id" "uuid" NOT NULL,
    "outlook_event_id" "text" NOT NULL,
    "last_synced_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."outlook_calendar_sync" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."outlook_calendar_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "access_token" "text" NOT NULL,
    "refresh_token" "text" NOT NULL,
    "token_expires_at" timestamp with time zone NOT NULL,
    "sync_enabled" boolean DEFAULT true,
    "outlook_email" "text",
    "last_sync_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."outlook_calendar_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."outlook_mail_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "access_token" "text" NOT NULL,
    "refresh_token" "text" NOT NULL,
    "token_expires_at" timestamp with time zone NOT NULL,
    "sync_enabled" boolean DEFAULT true,
    "outlook_email" "text",
    "scopes" "text" DEFAULT 'https://graph.microsoft.com/Mail.Read offline_access User.Read'::"text" NOT NULL,
    "last_sync_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."outlook_mail_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_metrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "metric_type" "text" NOT NULL,
    "metric_value" numeric NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "recorded_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."platform_metrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "agency_id" "uuid",
    "email" "text" NOT NULL,
    "full_name" "text" NOT NULL,
    "avatar_url" "text",
    "role" "text" DEFAULT 'buyer'::"text" NOT NULL,
    "phone" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    "onboarding_completed" boolean DEFAULT false,
    "onboarding_step" integer DEFAULT 0,
    "canton" "text",
    "email_signature" "text",
    "agent_role" "text",
    "spoken_languages" "text"[] DEFAULT '{fr}'::"text"[],
    "first_day_done" boolean DEFAULT false,
    "day0_payload" "jsonb",
    "first_day_completed_at" timestamp with time zone,
    "activation_checklist" "jsonb",
    CONSTRAINT "profiles_agent_role_check" CHECK ((("agent_role" IS NULL) OR ("agent_role" = ANY (ARRAY['courtier'::"text", 'direction'::"text", 'admin'::"text", 'stagiaire'::"text"])))),
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['super_admin'::"text", 'admin'::"text", 'manager'::"text", 'agent'::"text", 'assistant'::"text", 'seller'::"text", 'buyer'::"text", 'particulier'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."email_signature" IS 'Signature email auto-append en envoi via gmail-sync / outlook-mail-sync. Plain text ou HTML léger (no script).';



COMMENT ON COLUMN "public"."profiles"."first_day_done" IS 'Premier jour (Day 0 calibration) joué — one-shot. Voir handoff-premier-jour.';



COMMENT ON COLUMN "public"."profiles"."day0_payload" IS 'Snapshot du calibrage : { specialite, zone[], dispo, priorite, autonomy }.';



COMMENT ON COLUMN "public"."profiles"."first_day_completed_at" IS 'Horodatage de complétion du Premier jour (UTC).';



COMMENT ON COLUMN "public"."profiles"."activation_checklist" IS 'Checklist d''activation 5 items (Premier jour Today + persistance dashboard).';



CREATE TABLE IF NOT EXISTS "public"."properties" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agency_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "type" "public"."property_type" DEFAULT 'apartment'::"public"."property_type" NOT NULL,
    "status" "public"."property_status" DEFAULT 'draft'::"public"."property_status" NOT NULL,
    "price" numeric(12,2),
    "currency" "text" DEFAULT 'CHF'::"text" NOT NULL,
    "rooms" numeric(3,1),
    "bedrooms" integer,
    "bathrooms" integer,
    "surface_m2" numeric(8,2),
    "address" "text",
    "city" "text",
    "canton" "text",
    "postal_code" "text",
    "lat" double precision,
    "lng" double precision,
    "photos" "text"[] DEFAULT '{}'::"text"[],
    "features" "jsonb" DEFAULT '{}'::"jsonb",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "published_at" timestamp with time zone,
    "floor" integer,
    "total_floors" integer,
    "year_built" integer,
    "charges_monthly" numeric(10,2),
    "mandate_type" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "condition" "text",
    "availability_date" "date",
    "energy_label" "text",
    "minergie_label" "text",
    "floor_plan_url" "text",
    "floor_plan_hotspots" "jsonb" DEFAULT '[]'::"jsonb",
    "photo_tags" "jsonb" DEFAULT '[]'::"jsonb",
    "moderation_status" "text" DEFAULT 'published'::"text",
    "moderation_reason" "text",
    "transaction_type" "text" DEFAULT 'buy'::"text" NOT NULL,
    "deposit_months" smallint,
    "is_furnished" boolean DEFAULT false,
    "external_regie" "jsonb",
    "c2pa_verified" boolean DEFAULT false,
    "c2pa_verified_at" timestamp with time zone,
    "gallery_layout" "text" DEFAULT 'hero'::"text" NOT NULL,
    "contact_layout" "text" DEFAULT 'right'::"text" NOT NULL,
    "neighborhood_variant" "text" DEFAULT 'map'::"text" NOT NULL,
    "partner_agency" "text",
    "energy_class" "text",
    "mandate_commission_pct" numeric(5,2),
    "mandate_expires_at" timestamp with time zone,
    "mandate_signed_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    "ai_generated_photos" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "c2pa_verification_method" "text",
    "egid" "text",
    CONSTRAINT "properties_contact_layout_check" CHECK (("contact_layout" = ANY (ARRAY['right'::"text", 'banner'::"text", 'floating'::"text"]))),
    CONSTRAINT "properties_gallery_layout_check" CHECK (("gallery_layout" = ANY (ARRAY['hero'::"text", 'mosaic'::"text", 'carousel'::"text"]))),
    CONSTRAINT "properties_moderation_status_check" CHECK (("moderation_status" = ANY (ARRAY['pending'::"text", 'published'::"text", 'flagged'::"text", 'removed'::"text"]))),
    CONSTRAINT "properties_neighborhood_variant_check" CHECK (("neighborhood_variant" = ANY (ARRAY['scores'::"text", 'map'::"text"]))),
    CONSTRAINT "properties_partner_agency_check" CHECK ((("partner_agency" IS NULL) OR ("partner_agency" = ANY (ARRAY['naef'::"text", 'cardis'::"text", 'bernard'::"text"])))),
    CONSTRAINT "properties_transaction_type_check" CHECK (("transaction_type" = ANY (ARRAY['buy'::"text", 'rent'::"text"])))
);


ALTER TABLE "public"."properties" OWNER TO "postgres";


COMMENT ON COLUMN "public"."properties"."gallery_layout" IS 'Variante de galerie affichée sur /listing/:id. Choisi par l''agent à la création. Valeurs: hero | mosaic | carousel. Default: hero.';



COMMENT ON COLUMN "public"."properties"."contact_layout" IS 'Disposition de la card agent sur /listing/:id. right (default) | banner | floating.';



COMMENT ON COLUMN "public"."properties"."neighborhood_variant" IS 'Bento "Le quartier" sur /listing/:id. map (default, carte Leaflet) | scores (éditorial).';



COMMENT ON COLUMN "public"."properties"."partner_agency" IS 'Agence partenaire affichée en bandeau sur /listing/:id. naef | cardis | bernard | NULL.';



COMMENT ON COLUMN "public"."properties"."energy_class" IS 'Classe énergétique CECB Suisse (A à G). Affiché Fiche Bien §Caractéristiques.';



COMMENT ON COLUMN "public"."properties"."mandate_commission_pct" IS 'Commission agence en %. Affiché Fiche Bien §Mandat (sidebar).';



COMMENT ON COLUMN "public"."properties"."mandate_expires_at" IS 'Date d''expiration du mandat. Affiché Fiche Bien §Mandat avec compteur "dans X jours".';



COMMENT ON COLUMN "public"."properties"."mandate_signed_at" IS 'Date de signature du mandat. Affiché Fiche Bien §Mandat.';



COMMENT ON COLUMN "public"."properties"."c2pa_verification_method" IS 'capture | trufo | wasm | megga_shield. Only ''capture''/''trufo'' are real C2PA. ''megga_shield'' is SHA-256 + EXIF (transparent internal trust).';



COMMENT ON COLUMN "public"."properties"."egid" IS 'EGID — Eidgenössischer Gebäudeidentifikator (9 chiffres, OFS/SwissTopo). Requis par le notaire pour l''acte authentique et par FINMA pour reconstruire le dossier LBA. Optionnel au formulaire mais affiché en gros sur la fiche.';



CREATE TABLE IF NOT EXISTS "public"."property_scores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid",
    "market_listing_id" "uuid",
    "source" "text" NOT NULL,
    "agency_id" "uuid",
    "heat_score" integer DEFAULT 0,
    "market_position_score" integer DEFAULT 0,
    "interest_level" integer DEFAULT 0,
    "days_on_market" integer DEFAULT 0,
    "price_trend" "text" DEFAULT 'stable'::"text",
    "stagnation_risk" "text" DEFAULT 'low'::"text",
    "comparable_count" integer DEFAULT 0,
    "avg_comparable_price" numeric(12,2),
    "price_vs_market_pct" numeric(6,2),
    "last_calculated_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "property_scores_price_trend_check" CHECK (("price_trend" = ANY (ARRAY['stable'::"text", 'dropping'::"text", 'rising'::"text"]))),
    CONSTRAINT "property_scores_source_check" CHECK (("source" = ANY (ARRAY['internal'::"text", 'market'::"text"]))),
    CONSTRAINT "property_scores_stagnation_risk_check" CHECK (("stagnation_risk" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"])))
);


ALTER TABLE "public"."property_scores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reminders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agency_id" "uuid" NOT NULL,
    "contact_id" "uuid",
    "property_id" "uuid",
    "transaction_id" "uuid",
    "match_id" "uuid",
    "type" "text" NOT NULL,
    "trigger_rule" "text" NOT NULL,
    "trigger_days" integer,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "trigger_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "message_template" "text",
    "channel" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "reminders_channel_check" CHECK (("channel" = ANY (ARRAY['email'::"text", 'whatsapp'::"text", 'task'::"text", 'notification'::"text"]))),
    CONSTRAINT "reminders_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'triggered'::"text", 'done'::"text", 'cancelled'::"text", 'snoozed'::"text"]))),
    CONSTRAINT "reminders_trigger_rule_check" CHECK (("trigger_rule" = ANY (ARRAY['days_after_event'::"text", 'no_response'::"text", 'inactivity'::"text", 'manual'::"text"]))),
    CONSTRAINT "reminders_type_check" CHECK (("type" = ANY (ARRAY['follow_up_sent_property'::"text", 'post_visit_feedback'::"text", 'dormant_lead'::"text", 'missing_document'::"text", 'price_change'::"text", 'custom'::"text"])))
);


ALTER TABLE "public"."reminders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."saved_searches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "filters" "jsonb" NOT NULL,
    "alert_enabled" boolean DEFAULT false,
    "alert_email" "text",
    "alert_frequency" "text" DEFAULT 'daily'::"text",
    "last_alerted_at" timestamp with time zone,
    "results_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "saved_searches_alert_frequency_check" CHECK (("alert_frequency" = ANY (ARRAY['instant'::"text", 'daily'::"text", 'weekly'::"text"])))
);


ALTER TABLE "public"."saved_searches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."seller_leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "estimation_min" bigint,
    "estimation_max" bigint,
    "estimation_median" bigint,
    "estimation_price_per_m2" integer,
    "estimation_confidence" "text",
    "comparable_count" integer DEFAULT 0,
    "contact_name" "text" NOT NULL,
    "contact_email" "text" NOT NULL,
    "contact_phone" "text",
    "motivation" "text",
    "assigned_agency_id" "uuid",
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "source" "text" DEFAULT 'website'::"text" NOT NULL,
    "contact_id" "uuid",
    "property_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "seller_leads_estimation_confidence_check" CHECK (("estimation_confidence" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"]))),
    CONSTRAINT "seller_leads_motivation_check" CHECK (("motivation" = ANY (ARRAY['immediate'::"text", '3months'::"text", '6months'::"text", 'exploring'::"text"]))),
    CONSTRAINT "seller_leads_status_check" CHECK (("status" = ANY (ARRAY['new'::"text", 'contacted'::"text", 'mandate'::"text", 'lost'::"text"])))
);

ALTER TABLE ONLY "public"."seller_leads" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."seller_leads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."seller_portals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "token" "text" NOT NULL,
    "agency_id" "uuid",
    "contact_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone DEFAULT ("now"() + '6 mons'::interval),
    "last_viewed_at" timestamp with time zone,
    "view_count" integer DEFAULT 0,
    CONSTRAINT "seller_portals_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'expired'::"text", 'revoked'::"text"])))
);

ALTER TABLE ONLY "public"."seller_portals" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."seller_portals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agency_id" "uuid" NOT NULL,
    "stripe_customer_id" "text" NOT NULL,
    "stripe_subscription_id" "text",
    "stripe_price_id" "text",
    "plan" "text" DEFAULT 'starter'::"text" NOT NULL,
    "billing_period" "text" DEFAULT 'monthly'::"text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "current_period_start" timestamp with time zone,
    "current_period_end" timestamp with time zone,
    "cancel_at_period_end" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "subscriptions_billing_period_check" CHECK (("billing_period" = ANY (ARRAY['monthly'::"text", 'yearly'::"text"]))),
    CONSTRAINT "subscriptions_plan_check" CHECK (("plan" = ANY (ARRAY['starter'::"text", 'pro'::"text", 'entreprise'::"text"]))),
    CONSTRAINT "subscriptions_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'trialing'::"text", 'past_due'::"text", 'canceled'::"text", 'unpaid'::"text", 'incomplete'::"text"])))
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."support_tickets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ticket_number" "text" NOT NULL,
    "submitter_email" "text" NOT NULL,
    "submitter_name" "text" NOT NULL,
    "contact_id" "uuid",
    "subject" "text" NOT NULL,
    "category" "text" DEFAULT 'general'::"text" NOT NULL,
    "priority" "text" DEFAULT 'medium'::"text" NOT NULL,
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "assigned_to" "uuid",
    "sla_first_response_due" timestamp with time zone,
    "sla_resolution_due" timestamp with time zone,
    "first_responded_at" timestamp with time zone,
    "resolved_at" timestamp with time zone,
    "closed_at" timestamp with time zone,
    "sla_breached" boolean DEFAULT false,
    "access_token" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "csat_rating" integer,
    "csat_comment" "text",
    "source" "text" DEFAULT 'web_form'::"text",
    "tags" "text"[],
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "description" "text",
    "agency_id" "uuid"
);


ALTER TABLE "public"."support_tickets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ticket_canned_responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "category" "text",
    "shortcut" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ticket_canned_responses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ticket_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "actor_type" "text" NOT NULL,
    "actor_id" "uuid",
    "action" "text" NOT NULL,
    "old_value" "text",
    "new_value" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ticket_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ticket_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "author_type" "text" NOT NULL,
    "author_id" "uuid",
    "author_name" "text" NOT NULL,
    "body" "text" NOT NULL,
    "is_internal_note" boolean DEFAULT false,
    "attachments" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ticket_messages" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."ticket_number_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."ticket_number_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "agency_id" "uuid" NOT NULL,
    "property_id" "uuid",
    "contact_buyer_id" "uuid",
    "contact_seller_id" "uuid",
    "assigned_to" "uuid",
    "stage" "public"."transaction_stage" DEFAULT 'lead'::"public"."transaction_stage" NOT NULL,
    "status" "public"."transaction_status" DEFAULT 'active'::"public"."transaction_status" NOT NULL,
    "price_offered" numeric(12,2),
    "price_final" numeric(12,2),
    "mandate_type" "public"."mandate_type",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."translation_cache" (
    "content_hash" "text" NOT NULL,
    "lang" "text" NOT NULL,
    "translated_text" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "translation_cache_lang_check" CHECK (("lang" = ANY (ARRAY['de'::"text", 'en'::"text", 'it'::"text"])))
);


ALTER TABLE "public"."translation_cache" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_devices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "fingerprint" "text" NOT NULL,
    "user_agent" "text",
    "browser" "text",
    "os" "text",
    "ip" "text",
    "country" "text",
    "city" "text",
    "trusted" boolean DEFAULT true NOT NULL,
    "first_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_devices" OWNER TO "postgres";


ALTER TABLE ONLY "public"."activity_events"
    ADD CONSTRAINT "activity_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_changelog"
    ADD CONSTRAINT "admin_changelog_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_feature_flags"
    ADD CONSTRAINT "admin_feature_flags_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."admin_feature_flags"
    ADD CONSTRAINT "admin_feature_flags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_notes"
    ADD CONSTRAINT "admin_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_nps_responses"
    ADD CONSTRAINT "admin_nps_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agencies"
    ADD CONSTRAINT "agencies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agencies"
    ADD CONSTRAINT "agencies_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."agency_profiles"
    ADD CONSTRAINT "agency_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agency_profiles"
    ADD CONSTRAINT "agency_profiles_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."agent_profiles"
    ADD CONSTRAINT "agent_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_profiles"
    ADD CONSTRAINT "agent_profiles_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."agent_reviews"
    ADD CONSTRAINT "agent_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_actions_queue"
    ADD CONSTRAINT "ai_actions_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_balance_snapshots"
    ADD CONSTRAINT "ai_balance_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_usage_logs"
    ADD CONSTRAINT "ai_usage_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_config"
    ADD CONSTRAINT "app_config_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."article_feedback"
    ADD CONSTRAINT "article_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."article_views"
    ADD CONSTRAINT "article_views_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."auth_events"
    ADD CONSTRAINT "auth_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."automation_rules"
    ADD CONSTRAINT "automation_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."calendar_sync"
    ADD CONSTRAINT "calendar_sync_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."calendar_sync"
    ADD CONSTRAINT "calendar_sync_user_id_google_event_id_key" UNIQUE ("user_id", "google_event_id");



ALTER TABLE ONLY "public"."calendar_sync"
    ADD CONSTRAINT "calendar_sync_user_id_visit_id_key" UNIQUE ("user_id", "visit_id");



ALTER TABLE ONLY "public"."chat_conversations"
    ADD CONSTRAINT "chat_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."client_searches"
    ADD CONSTRAINT "client_searches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coming_soon_subscribers"
    ADD CONSTRAINT "coming_soon_subscribers_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."coming_soon_subscribers"
    ADD CONSTRAINT "coming_soon_subscribers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contact_scores"
    ADD CONSTRAINT "contact_scores_contact_id_key" UNIQUE ("contact_id");



ALTER TABLE ONLY "public"."contact_scores"
    ADD CONSTRAINT "contact_scores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."crm_offers"
    ADD CONSTRAINT "crm_offers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_actions"
    ADD CONSTRAINT "daily_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_messages_cache"
    ADD CONSTRAINT "email_messages_cache_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."email_messages_cache"
    ADD CONSTRAINT "email_messages_cache_user_id_provider_external_message_id_key" UNIQUE ("user_id", "provider", "external_message_id");



ALTER TABLE ONLY "public"."external_listings"
    ADD CONSTRAINT "external_listings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_user_id_listing_id_key" UNIQUE ("user_id", "listing_id");



ALTER TABLE ONLY "public"."gmail_tokens"
    ADD CONSTRAINT "gmail_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gmail_tokens"
    ADD CONSTRAINT "gmail_tokens_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."google_calendar_tokens"
    ADD CONSTRAINT "google_calendar_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."google_calendar_tokens"
    ADD CONSTRAINT "google_calendar_tokens_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."kyc_cases"
    ADD CONSTRAINT "kyc_cases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kyc_checklist_items"
    ADD CONSTRAINT "kyc_checklist_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kyc_magic_link_uploads"
    ADD CONSTRAINT "kyc_magic_link_uploads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kyc_magic_links"
    ADD CONSTRAINT "kyc_magic_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kyc_magic_links"
    ADD CONSTRAINT "kyc_magic_links_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."kyc_screening_decisions"
    ADD CONSTRAINT "kyc_screening_decisions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."listing_reports"
    ADD CONSTRAINT "listing_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."listings"
    ADD CONSTRAINT "listings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."listings"
    ADD CONSTRAINT "listings_property_id_unique" UNIQUE ("property_id");



ALTER TABLE ONLY "public"."market_changes"
    ADD CONSTRAINT "market_changes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."market_favorites"
    ADD CONSTRAINT "market_favorites_pkey" PRIMARY KEY ("user_id", "listing_id");



ALTER TABLE ONLY "public"."market_hidden"
    ADD CONSTRAINT "market_hidden_pkey" PRIMARY KEY ("user_id", "listing_id");



ALTER TABLE ONLY "public"."market_listings"
    ADD CONSTRAINT "market_listings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."market_listings"
    ADD CONSTRAINT "market_listings_portal_source_unique" UNIQUE ("source_portal", "source_id");



ALTER TABLE ONLY "public"."market_price_history"
    ADD CONSTRAINT "market_price_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketplace_inquiries"
    ADD CONSTRAINT "marketplace_inquiries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."message_templates"
    ADD CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."message_threads"
    ADD CONSTRAINT "message_threads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."moderation_actions"
    ADD CONSTRAINT "moderation_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."offers"
    ADD CONSTRAINT "offers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."onboarding_checklist"
    ADD CONSTRAINT "onboarding_checklist_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."onboarding_checklist"
    ADD CONSTRAINT "onboarding_checklist_user_id_step_key_key" UNIQUE ("user_id", "step_key");



ALTER TABLE ONLY "public"."outlook_calendar_sync"
    ADD CONSTRAINT "outlook_calendar_sync_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."outlook_calendar_sync"
    ADD CONSTRAINT "outlook_calendar_sync_user_id_outlook_event_id_key" UNIQUE ("user_id", "outlook_event_id");



ALTER TABLE ONLY "public"."outlook_calendar_sync"
    ADD CONSTRAINT "outlook_calendar_sync_user_id_visit_id_key" UNIQUE ("user_id", "visit_id");



ALTER TABLE ONLY "public"."outlook_calendar_tokens"
    ADD CONSTRAINT "outlook_calendar_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."outlook_calendar_tokens"
    ADD CONSTRAINT "outlook_calendar_tokens_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."outlook_mail_tokens"
    ADD CONSTRAINT "outlook_mail_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."outlook_mail_tokens"
    ADD CONSTRAINT "outlook_mail_tokens_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."platform_metrics"
    ADD CONSTRAINT "platform_metrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."properties"
    ADD CONSTRAINT "properties_canton_check" CHECK ((("canton" IS NULL) OR ("upper"("canton") = ANY (ARRAY['GE'::"text", 'VD'::"text", 'VS'::"text", 'NE'::"text", 'FR'::"text", 'BE'::"text", 'JU'::"text", 'BS'::"text", 'BL'::"text", 'AG'::"text", 'SO'::"text", 'ZH'::"text", 'LU'::"text", 'ZG'::"text", 'SZ'::"text", 'NW'::"text", 'OW'::"text", 'UR'::"text", 'GL'::"text", 'SH'::"text", 'TG'::"text", 'AR'::"text", 'AI'::"text", 'SG'::"text", 'GR'::"text", 'TI'::"text"])))) NOT VALID;



ALTER TABLE "public"."properties"
    ADD CONSTRAINT "properties_egid_check" CHECK ((("egid" IS NULL) OR ("egid" ~ '^[0-9]{9}$'::"text"))) NOT VALID;



ALTER TABLE "public"."properties"
    ADD CONSTRAINT "properties_lat_check" CHECK ((("lat" IS NULL) OR (("lat" >= (45.8)::double precision) AND ("lat" <= (47.85)::double precision)))) NOT VALID;



ALTER TABLE "public"."properties"
    ADD CONSTRAINT "properties_lng_check" CHECK ((("lng" IS NULL) OR (("lng" >= (5.95)::double precision) AND ("lng" <= (10.5)::double precision)))) NOT VALID;



ALTER TABLE ONLY "public"."properties"
    ADD CONSTRAINT "properties_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."properties"
    ADD CONSTRAINT "properties_postal_code_check" CHECK ((("postal_code" IS NULL) OR ("postal_code" ~ '^[1-9][0-9]{3}$'::"text"))) NOT VALID;



ALTER TABLE "public"."properties"
    ADD CONSTRAINT "properties_price_check" CHECK ((("price" IS NULL) OR (("price" >= (0)::numeric) AND ("price" <= (200000000)::numeric)))) NOT VALID;



ALTER TABLE ONLY "public"."property_scores"
    ADD CONSTRAINT "property_scores_market_listing_id_source_key" UNIQUE ("market_listing_id", "source");



ALTER TABLE ONLY "public"."property_scores"
    ADD CONSTRAINT "property_scores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."property_scores"
    ADD CONSTRAINT "property_scores_property_id_source_key" UNIQUE ("property_id", "source");



ALTER TABLE ONLY "public"."reminders"
    ADD CONSTRAINT "reminders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saved_searches"
    ADD CONSTRAINT "saved_searches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."seller_leads"
    ADD CONSTRAINT "seller_leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."seller_portals"
    ADD CONSTRAINT "seller_portals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."seller_portals"
    ADD CONSTRAINT "seller_portals_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_agency_id_key" UNIQUE ("agency_id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."support_tickets"
    ADD CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."support_tickets"
    ADD CONSTRAINT "support_tickets_ticket_number_key" UNIQUE ("ticket_number");



ALTER TABLE ONLY "public"."ticket_canned_responses"
    ADD CONSTRAINT "ticket_canned_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ticket_events"
    ADD CONSTRAINT "ticket_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ticket_messages"
    ADD CONSTRAINT "ticket_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."translation_cache"
    ADD CONSTRAINT "translation_cache_pkey" PRIMARY KEY ("content_hash", "lang");



ALTER TABLE ONLY "public"."user_devices"
    ADD CONSTRAINT "user_devices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_devices"
    ADD CONSTRAINT "user_devices_user_id_fingerprint_key" UNIQUE ("user_id", "fingerprint");



ALTER TABLE ONLY "public"."visits"
    ADD CONSTRAINT "visits_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_activity_events_action_created_at" ON "public"."activity_events" USING "btree" ("action", "created_at" DESC);



CREATE INDEX "idx_activity_events_actor_kind" ON "public"."activity_events" USING "btree" ("agency_id", "actor_kind", "created_at" DESC) WHERE ("actor_kind" <> 'user'::"text");



CREATE INDEX "idx_activity_events_audit_filters" ON "public"."activity_events" USING "btree" ("agency_id", "created_at" DESC, "category", "severity");



CREATE INDEX "idx_activity_events_created_at" ON "public"."activity_events" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_admin_changelog_created_at" ON "public"."admin_changelog" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_admin_feature_flags_key" ON "public"."admin_feature_flags" USING "btree" ("key");



CREATE INDEX "idx_admin_notes_entity" ON "public"."admin_notes" USING "btree" ("entity_type", "entity_id", "created_at" DESC);



CREATE INDEX "idx_admin_nps_rating" ON "public"."admin_nps_responses" USING "btree" ("rating");



CREATE INDEX "idx_admin_nps_submitted_at" ON "public"."admin_nps_responses" USING "btree" ("submitted_at" DESC);



CREATE INDEX "idx_agencies_status" ON "public"."agencies" USING "btree" ("status");



CREATE INDEX "idx_agency_profiles_canton" ON "public"."agency_profiles" USING "btree" ("canton");



CREATE INDEX "idx_agency_profiles_search" ON "public"."agency_profiles" USING "gin" ("to_tsvector"('"french"'::"regconfig", ((COALESCE("name", ''::"text") || ' '::"text") || COALESCE("city", ''::"text"))));



CREATE INDEX "idx_agency_profiles_slug" ON "public"."agency_profiles" USING "btree" ("slug");



CREATE INDEX "idx_agency_profiles_status" ON "public"."agency_profiles" USING "btree" ("status");



CREATE INDEX "idx_agent_profiles_canton" ON "public"."agent_profiles" USING "btree" ("canton");



CREATE INDEX "idx_agent_profiles_search" ON "public"."agent_profiles" USING "gin" ("to_tsvector"('"french"'::"regconfig", ((((COALESCE("first_name", ''::"text") || ' '::"text") || COALESCE("last_name", ''::"text")) || ' '::"text") || COALESCE("city", ''::"text"))));



CREATE INDEX "idx_agent_profiles_slug" ON "public"."agent_profiles" USING "btree" ("slug");



CREATE INDEX "idx_agent_profiles_status" ON "public"."agent_profiles" USING "btree" ("status");



CREATE INDEX "idx_agent_reviews_agent" ON "public"."agent_reviews" USING "btree" ("agent_profile_id");



CREATE INDEX "idx_agent_reviews_status" ON "public"."agent_reviews" USING "btree" ("status");



CREATE INDEX "idx_ai_actions_agency_created" ON "public"."ai_actions_queue" USING "btree" ("agency_id", "created_at" DESC);



CREATE INDEX "idx_ai_actions_agent_status_sched" ON "public"."ai_actions_queue" USING "btree" ("agent_id", "status", "scheduled_at" DESC);



CREATE INDEX "idx_ai_actions_entity" ON "public"."ai_actions_queue" USING "btree" ("entity_type", "entity_id") WHERE ("entity_id" IS NOT NULL);



CREATE INDEX "idx_ai_actions_ready_queue" ON "public"."ai_actions_queue" USING "btree" ("scheduled_at") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_ai_balance_captured" ON "public"."ai_balance_snapshots" USING "btree" ("provider", "captured_at" DESC);



CREATE INDEX "idx_ai_usage_logs_created" ON "public"."ai_usage_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_ai_usage_logs_provider" ON "public"."ai_usage_logs" USING "btree" ("provider", "created_at" DESC);



CREATE INDEX "idx_article_feedback_slug" ON "public"."article_feedback" USING "btree" ("article_slug");



CREATE INDEX "idx_article_views_slug" ON "public"."article_views" USING "btree" ("article_slug", "created_at");



CREATE INDEX "idx_auth_events_action_created_at" ON "public"."auth_events" USING "btree" ("action", "created_at" DESC);



CREATE INDEX "idx_auth_events_severity_created_at" ON "public"."auth_events" USING "btree" ("severity", "created_at" DESC) WHERE ("severity" <> 'info'::"text");



CREATE INDEX "idx_auth_events_user_id_created_at" ON "public"."auth_events" USING "btree" ("user_id", "created_at" DESC) WHERE ("user_id" IS NOT NULL);



CREATE INDEX "idx_calendar_sync_user_event" ON "public"."calendar_sync" USING "btree" ("user_id", "google_event_id");



CREATE INDEX "idx_calendar_sync_user_visit" ON "public"."calendar_sync" USING "btree" ("user_id", "visit_id");



CREATE INDEX "idx_chat_conversations_ref" ON "public"."chat_conversations" USING "btree" ("conversation_ref");



CREATE INDEX "idx_chat_conversations_user" ON "public"."chat_conversations" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "idx_chat_messages_conversation" ON "public"."chat_messages" USING "btree" ("conversation_id", "created_at");



CREATE INDEX "idx_client_searches_contact_active" ON "public"."client_searches" USING "btree" ("contact_id", "is_active");



CREATE INDEX "idx_coming_soon_subscribers_created_at" ON "public"."coming_soon_subscribers" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_contact_scores_agency" ON "public"."contact_scores" USING "btree" ("agency_id");



CREATE INDEX "idx_contact_scores_buyer" ON "public"."contact_scores" USING "btree" ("buyer_score" DESC);



CREATE INDEX "idx_contacts_agency_email_lower" ON "public"."contacts" USING "btree" ("agency_id", "lower"("email")) WHERE ("email" IS NOT NULL);



CREATE INDEX "idx_contacts_agency_id" ON "public"."contacts" USING "btree" ("agency_id");



CREATE INDEX "idx_contacts_agency_name_lower" ON "public"."contacts" USING "btree" ("agency_id", "lower"("first_name"), "lower"("last_name"));



CREATE INDEX "idx_contacts_agency_phone_normalized" ON "public"."contacts" USING "btree" ("agency_id", "public"."normalize_phone"("phone")) WHERE ("phone" IS NOT NULL);



CREATE INDEX "idx_contacts_deleted_user_id" ON "public"."contacts" USING "btree" ("deleted_user_id") WHERE ("deleted_user_id" IS NOT NULL);



CREATE INDEX "idx_contacts_email" ON "public"."contacts" USING "btree" ("email");



CREATE INDEX "idx_contacts_import_raw_text_expiry" ON "public"."contacts" USING "btree" ("import_raw_text_received_at") WHERE ("import_raw_text" IS NOT NULL);



CREATE INDEX "idx_contacts_source" ON "public"."contacts" USING "btree" ("source");



CREATE INDEX "idx_contacts_type" ON "public"."contacts" USING "btree" ("type");



CREATE INDEX "idx_contacts_user_id" ON "public"."contacts" USING "btree" ("user_id");



CREATE INDEX "idx_crm_offers_agency" ON "public"."crm_offers" USING "btree" ("agency_id");



CREATE INDEX "idx_crm_offers_deal" ON "public"."crm_offers" USING "btree" ("deal_id", "created_at" DESC);



CREATE INDEX "idx_crm_offers_parent" ON "public"."crm_offers" USING "btree" ("parent_offer_id") WHERE ("parent_offer_id" IS NOT NULL);



CREATE INDEX "idx_crm_offers_status_expires" ON "public"."crm_offers" USING "btree" ("status", "expires_at") WHERE ("status" = 'pending'::"public"."crm_offer_status");



CREATE INDEX "idx_daily_actions_agent_incomplete" ON "public"."daily_actions" USING "btree" ("agent_id", "is_completed", "generated_at");



CREATE INDEX "idx_documents_agency_id" ON "public"."documents" USING "btree" ("agency_id");



CREATE INDEX "idx_documents_kyc_expires" ON "public"."documents" USING "btree" ("kyc_case_id", "expires_at") WHERE ("expires_at" IS NOT NULL);



CREATE INDEX "idx_documents_property_id" ON "public"."documents" USING "btree" ("property_id");



CREATE INDEX "idx_documents_retention_until" ON "public"."documents" USING "btree" ("retention_until") WHERE ("retention_until" IS NOT NULL);



CREATE INDEX "idx_documents_sha256" ON "public"."documents" USING "btree" ("sha256_hash") WHERE ("sha256_hash" IS NOT NULL);



CREATE INDEX "idx_documents_uploaded_by" ON "public"."documents" USING "btree" ("uploaded_by");



CREATE INDEX "idx_email_cache_from" ON "public"."email_messages_cache" USING "btree" ("user_id", "from_address");



CREATE INDEX "idx_email_cache_hot_leads" ON "public"."email_messages_cache" USING "btree" ("user_id", "ai_priority" DESC, "sent_at" DESC) WHERE ("ai_classification" = 'lead_chaud'::"text");



CREATE INDEX "idx_email_cache_thread" ON "public"."email_messages_cache" USING "btree" ("user_id", "external_thread_id");



CREATE INDEX "idx_email_cache_user_contact" ON "public"."email_messages_cache" USING "btree" ("user_id", "contact_id", "sent_at" DESC) WHERE ("contact_id" IS NOT NULL);



CREATE INDEX "idx_email_cache_user_sent" ON "public"."email_messages_cache" USING "btree" ("user_id", "sent_at" DESC);



CREATE INDEX "idx_external_listings_agency" ON "public"."external_listings" USING "btree" ("agency_id");



CREATE INDEX "idx_external_listings_search_hash" ON "public"."external_listings" USING "btree" ("search_hash", "expires_at");



CREATE INDEX "idx_gcal_tokens_user" ON "public"."google_calendar_tokens" USING "btree" ("user_id");



CREATE INDEX "idx_gmail_tokens_user" ON "public"."gmail_tokens" USING "btree" ("user_id");



CREATE INDEX "idx_kyc_cases_ai_qualitative_risk" ON "public"."kyc_cases" USING "btree" ((("ai_analysis" ->> 'qualitative_risk'::"text"))) WHERE ("ai_analysis" IS NOT NULL);



CREATE INDEX "idx_kyc_cases_contact_agency_created" ON "public"."kyc_cases" USING "btree" ("contact_id", "agency_id", "created_at" DESC);



CREATE INDEX "idx_kyc_cases_pep_status" ON "public"."kyc_cases" USING "btree" ("pep_status");



CREATE INDEX "idx_kyc_cases_sanctions_status" ON "public"."kyc_cases" USING "btree" ("sanctions_status");



CREATE INDEX "idx_kyc_cases_screening_match" ON "public"."kyc_cases" USING "btree" ("created_at" DESC) WHERE (("pep_status" = 'match'::"text") OR ("sanctions_status" = 'match'::"text"));



CREATE INDEX "idx_kyc_cases_status_created_at" ON "public"."kyc_cases" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "idx_kyc_magic_link_uploads_agency" ON "public"."kyc_magic_link_uploads" USING "btree" ("agency_id");



CREATE INDEX "idx_kyc_magic_link_uploads_link" ON "public"."kyc_magic_link_uploads" USING "btree" ("magic_link_id", "uploaded_at");



CREATE INDEX "idx_kyc_magic_links_agency_status" ON "public"."kyc_magic_links" USING "btree" ("agency_id", "status") WHERE ("status" <> ALL (ARRAY['submitted'::"public"."kyc_magic_link_status", 'expired'::"public"."kyc_magic_link_status"]));



CREATE INDEX "idx_kyc_magic_links_expires" ON "public"."kyc_magic_links" USING "btree" ("expires_at") WHERE ("status" <> ALL (ARRAY['submitted'::"public"."kyc_magic_link_status", 'expired'::"public"."kyc_magic_link_status"]));



CREATE INDEX "idx_kyc_magic_links_kyc_case" ON "public"."kyc_magic_links" USING "btree" ("kyc_case_id", "created_at" DESC);



CREATE UNIQUE INDEX "idx_kyc_magic_links_token" ON "public"."kyc_magic_links" USING "btree" ("token");



CREATE INDEX "idx_kyc_screening_decisions_agency" ON "public"."kyc_screening_decisions" USING "btree" ("agency_id", "decided_at" DESC);



CREATE INDEX "idx_kyc_screening_decisions_case" ON "public"."kyc_screening_decisions" USING "btree" ("kyc_case_id", "decided_at" DESC);



CREATE INDEX "idx_kyc_screening_decisions_supersedes" ON "public"."kyc_screening_decisions" USING "btree" ("supersedes_id") WHERE ("supersedes_id" IS NOT NULL);



CREATE INDEX "idx_listing_reports_listing" ON "public"."listing_reports" USING "btree" ("listing_id");



CREATE INDEX "idx_listing_reports_status_created" ON "public"."listing_reports" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "idx_market_changes_detected" ON "public"."market_changes" USING "btree" ("detected_at" DESC);



CREATE INDEX "idx_market_changes_listing" ON "public"."market_changes" USING "btree" ("market_listing_id");



CREATE INDEX "idx_market_changes_type" ON "public"."market_changes" USING "btree" ("change_type", "detected_at" DESC);



CREATE INDEX "idx_market_favorites_user" ON "public"."market_favorites" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_market_hidden_user" ON "public"."market_hidden" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_market_listings_canton_status" ON "public"."market_listings" USING "btree" ("canton", "status");



CREATE INDEX "idx_market_listings_city_type_price" ON "public"."market_listings" USING "btree" ("city", "type", "price");



CREATE INDEX "idx_market_listings_energy_label" ON "public"."market_listings" USING "btree" ("energy_label") WHERE ("energy_label" IS NOT NULL);



CREATE INDEX "idx_market_listings_land_surface" ON "public"."market_listings" USING "btree" ("land_surface") WHERE ("land_surface" IS NOT NULL);



CREATE INDEX "idx_market_listings_last_seen" ON "public"."market_listings" USING "btree" ("last_seen_at");



CREATE INDEX "idx_market_listings_parking" ON "public"."market_listings" USING "btree" ("parking_count") WHERE ("parking_count" IS NOT NULL);



CREATE INDEX "idx_market_listings_quality_score" ON "public"."market_listings" USING "btree" ("quality_score") WHERE ("status" = ANY (ARRAY['active'::"text", 'price_reduced'::"text"]));



CREATE INDEX "idx_market_listings_source_id" ON "public"."market_listings" USING "btree" ("source_id");



CREATE INDEX "idx_market_listings_source_portal" ON "public"."market_listings" USING "btree" ("source_portal") WHERE ("status" = ANY (ARRAY['active'::"text", 'price_reduced'::"text"]));



CREATE INDEX "idx_market_listings_tx_type_status" ON "public"."market_listings" USING "btree" ("transaction_type", "status");



CREATE INDEX "idx_market_listings_year_built" ON "public"."market_listings" USING "btree" ("year_built") WHERE ("year_built" IS NOT NULL);



CREATE INDEX "idx_market_price_history_listing" ON "public"."market_price_history" USING "btree" ("market_listing_id", "detected_at" DESC);



CREATE INDEX "idx_marketplace_inquiries_created" ON "public"."marketplace_inquiries" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_marketplace_inquiries_market_listing" ON "public"."marketplace_inquiries" USING "btree" ("market_listing_id") WHERE ("market_listing_id" IS NOT NULL);



CREATE INDEX "idx_marketplace_inquiries_property" ON "public"."marketplace_inquiries" USING "btree" ("property_id") WHERE ("property_id" IS NOT NULL);



CREATE INDEX "idx_marketplace_inquiries_status" ON "public"."marketplace_inquiries" USING "btree" ("status", "created_at" DESC);



CREATE INDEX "idx_matches_contact_status" ON "public"."matches" USING "btree" ("contact_id", "status");



CREATE INDEX "idx_matches_market_listing" ON "public"."matches" USING "btree" ("market_listing_id") WHERE ("market_listing_id" IS NOT NULL);



CREATE INDEX "idx_matches_property_status" ON "public"."matches" USING "btree" ("property_id", "status");



CREATE INDEX "idx_matches_source" ON "public"."matches" USING "btree" ("source");



CREATE INDEX "idx_message_threads_agency_id" ON "public"."message_threads" USING "btree" ("agency_id");



CREATE INDEX "idx_message_threads_contact_id" ON "public"."message_threads" USING "btree" ("contact_id");



CREATE INDEX "idx_messages_created_at" ON "public"."messages" USING "btree" ("created_at");



CREATE INDEX "idx_messages_thread_id" ON "public"."messages" USING "btree" ("thread_id");



CREATE INDEX "idx_ml_active_tx_canton_type" ON "public"."market_listings" USING "btree" ("transaction_type", "canton", "type") WHERE ("status" = ANY (ARRAY['active'::"text", 'price_reduced'::"text"]));



CREATE INDEX "idx_ml_agency_profile_id" ON "public"."market_listings" USING "btree" ("agency_profile_id") WHERE ("agency_profile_id" IS NOT NULL);



CREATE INDEX "idx_ml_cf_pending" ON "public"."market_listings" USING "btree" ("created_at" DESC) WHERE (("photos_cf_processed_at" IS NULL) AND ("photos" IS NOT NULL) AND ("array_length"("photos", 1) > 0));



CREATE INDEX "idx_ml_map_points_active" ON "public"."market_listings" USING "btree" ("transaction_type") INCLUDE ("id", "lat", "lng", "price", "current_price", "type", "rooms") WHERE (("status" = 'active'::"text") AND ("quality_score" >= 50) AND ("lat" IS NOT NULL) AND ("lng" IS NOT NULL) AND ("price" > (0)::numeric));



CREATE INDEX "idx_ml_relevance" ON "public"."market_listings" USING "btree" ("transaction_type", "relevance_score" DESC, "created_at" DESC) WHERE (("status" = 'active'::"text") AND ("quality_score" >= 50));



CREATE INDEX "idx_ml_rent_active_created" ON "public"."market_listings" USING "btree" ("created_at" DESC) WHERE (("transaction_type" = 'rent'::"text") AND ("status" = 'active'::"text") AND ("quality_score" >= 50));



CREATE INDEX "idx_moderation_actions_action_created_at" ON "public"."moderation_actions" USING "btree" ("action", "created_at" DESC);



CREATE INDEX "idx_moderation_actions_property" ON "public"."moderation_actions" USING "btree" ("property_id", "created_at" DESC);



CREATE INDEX "idx_offers_agency_id" ON "public"."offers" USING "btree" ("agency_id");



CREATE INDEX "idx_offers_property_id" ON "public"."offers" USING "btree" ("property_id");



CREATE INDEX "idx_offers_status" ON "public"."offers" USING "btree" ("status");



CREATE INDEX "idx_onboarding_checklist_user" ON "public"."onboarding_checklist" USING "btree" ("user_id");



CREATE INDEX "idx_outlook_mail_tokens_user" ON "public"."outlook_mail_tokens" USING "btree" ("user_id");



CREATE INDEX "idx_outlook_sync_user_event" ON "public"."outlook_calendar_sync" USING "btree" ("user_id", "outlook_event_id");



CREATE INDEX "idx_outlook_sync_user_visit" ON "public"."outlook_calendar_sync" USING "btree" ("user_id", "visit_id");



CREATE INDEX "idx_outlook_tokens_user" ON "public"."outlook_calendar_tokens" USING "btree" ("user_id");



CREATE INDEX "idx_platform_metrics_type_date" ON "public"."platform_metrics" USING "btree" ("metric_type", "recorded_at" DESC);



CREATE INDEX "idx_profiles_agency_id" ON "public"."profiles" USING "btree" ("agency_id");



CREATE INDEX "idx_profiles_deleted_at" ON "public"."profiles" USING "btree" ("deleted_at") WHERE ("deleted_at" IS NOT NULL);



CREATE INDEX "idx_profiles_role" ON "public"."profiles" USING "btree" ("role");



CREATE INDEX "idx_properties_addr_agency" ON "public"."properties" USING "btree" ("agency_id", "lower"("address"), "postal_code") WHERE ("status" = ANY (ARRAY['draft'::"public"."property_status", 'active'::"public"."property_status"]));



CREATE INDEX "idx_properties_alive_agency_status" ON "public"."properties" USING "btree" ("agency_id", "status", "created_at" DESC) WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_properties_moderation" ON "public"."properties" USING "btree" ("moderation_status");



CREATE INDEX "idx_properties_moderation_status" ON "public"."properties" USING "btree" ("moderation_status") WHERE ("moderation_status" = 'published'::"text");



CREATE INDEX "idx_properties_transaction_type" ON "public"."properties" USING "btree" ("transaction_type") WHERE ("status" = 'active'::"public"."property_status");



CREATE INDEX "idx_property_scores_agency" ON "public"."property_scores" USING "btree" ("agency_id");



CREATE INDEX "idx_property_scores_heat" ON "public"."property_scores" USING "btree" ("heat_score" DESC);



CREATE INDEX "idx_reminders_agency_status_trigger" ON "public"."reminders" USING "btree" ("agency_id", "status", "trigger_at");



CREATE INDEX "idx_reminders_contact" ON "public"."reminders" USING "btree" ("contact_id");



CREATE INDEX "idx_reminders_transaction" ON "public"."reminders" USING "btree" ("transaction_id");



CREATE INDEX "idx_saved_searches_alert_enabled" ON "public"."saved_searches" USING "btree" ("alert_enabled", "alert_frequency") WHERE ("alert_enabled" = true);



CREATE INDEX "idx_saved_searches_user_id" ON "public"."saved_searches" USING "btree" ("user_id");



CREATE INDEX "idx_seller_leads_agency" ON "public"."seller_leads" USING "btree" ("assigned_agency_id") WHERE ("assigned_agency_id" IS NOT NULL);



CREATE INDEX "idx_seller_leads_created_at" ON "public"."seller_leads" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_seller_leads_status" ON "public"."seller_leads" USING "btree" ("status");



CREATE INDEX "idx_seller_portals_agency" ON "public"."seller_portals" USING "btree" ("agency_id");



CREATE INDEX "idx_seller_portals_contact" ON "public"."seller_portals" USING "btree" ("contact_id");



CREATE INDEX "idx_seller_portals_property" ON "public"."seller_portals" USING "btree" ("property_id");



CREATE UNIQUE INDEX "idx_seller_portals_token" ON "public"."seller_portals" USING "btree" ("token");



CREATE INDEX "idx_subscriptions_agency" ON "public"."subscriptions" USING "btree" ("agency_id");



CREATE INDEX "idx_subscriptions_stripe_customer" ON "public"."subscriptions" USING "btree" ("stripe_customer_id");



CREATE INDEX "idx_support_tickets_access_token" ON "public"."support_tickets" USING "btree" ("access_token");



CREATE INDEX "idx_support_tickets_agency" ON "public"."support_tickets" USING "btree" ("agency_id");



CREATE INDEX "idx_support_tickets_assigned_to" ON "public"."support_tickets" USING "btree" ("assigned_to");



CREATE INDEX "idx_support_tickets_category" ON "public"."support_tickets" USING "btree" ("category");



CREATE INDEX "idx_support_tickets_created_at" ON "public"."support_tickets" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_support_tickets_priority" ON "public"."support_tickets" USING "btree" ("priority");



CREATE INDEX "idx_support_tickets_sla_breached" ON "public"."support_tickets" USING "btree" ("sla_breached", "status") WHERE ("sla_breached" = true);



CREATE INDEX "idx_support_tickets_status" ON "public"."support_tickets" USING "btree" ("status");



CREATE INDEX "idx_support_tickets_status_updated_at" ON "public"."support_tickets" USING "btree" ("status", "updated_at" DESC);



CREATE INDEX "idx_threads_buyer_user" ON "public"."message_threads" USING "btree" ("buyer_user_id", "last_message_at" DESC) WHERE ("buyer_user_id" IS NOT NULL);



CREATE UNIQUE INDEX "idx_threads_unique_buyer_property" ON "public"."message_threads" USING "btree" ("buyer_user_id", "property_id", "agency_id") WHERE ("buyer_user_id" IS NOT NULL);



CREATE INDEX "idx_ticket_events_ticket_id" ON "public"."ticket_events" USING "btree" ("ticket_id");



CREATE INDEX "idx_ticket_messages_ticket_id" ON "public"."ticket_messages" USING "btree" ("ticket_id");



CREATE INDEX "idx_user_devices_user_last_seen" ON "public"."user_devices" USING "btree" ("user_id", "last_seen_at" DESC);



CREATE INDEX "idx_visits_contact_scheduled" ON "public"."visits" USING "btree" ("contact_id", "scheduled_at");



CREATE UNIQUE INDEX "idx_visits_manage_token" ON "public"."visits" USING "btree" ("manage_token");



CREATE INDEX "idx_visits_property_scheduled" ON "public"."visits" USING "btree" ("property_id", "scheduled_at");



CREATE UNIQUE INDEX "uq_agencies_name_normalized" ON "public"."agencies" USING "btree" ("lower"("btrim"("name")));



CREATE UNIQUE INDEX "uq_agency_profiles_lookmove_id" ON "public"."agency_profiles" USING "btree" ("lookmove_agency_id") WHERE ("lookmove_agency_id" IS NOT NULL);



CREATE UNIQUE INDEX "uq_agency_profiles_uid_che" ON "public"."agency_profiles" USING "btree" ("uid_che") WHERE ("uid_che" IS NOT NULL);



CREATE UNIQUE INDEX "uq_cantonal_medians" ON "public"."cantonal_price_medians" USING "btree" ("canton", "transaction_type", "type");



CREATE OR REPLACE TRIGGER "gmail_tokens_updated_at" BEFORE UPDATE ON "public"."gmail_tokens" FOR EACH ROW EXECUTE FUNCTION "public"."update_email_token_timestamp"();



CREATE OR REPLACE TRIGGER "on_new_client_search" AFTER INSERT ON "public"."client_searches" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_matching_on_new_search"();



CREATE OR REPLACE TRIGGER "on_new_message" AFTER INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_thread_on_new_message"();



CREATE OR REPLACE TRIGGER "on_property_active" AFTER INSERT OR UPDATE OF "status" ON "public"."properties" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_matching_on_property_active"();



CREATE OR REPLACE TRIGGER "on_property_price_change" AFTER UPDATE OF "price" ON "public"."properties" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_matching_on_price_change"();



CREATE OR REPLACE TRIGGER "on_search_criteria_updated" AFTER UPDATE OF "criteria", "is_active" ON "public"."client_searches" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_matching_on_search_updated"();



CREATE OR REPLACE TRIGGER "outlook_mail_tokens_updated_at" BEFORE UPDATE ON "public"."outlook_mail_tokens" FOR EACH ROW EXECUTE FUNCTION "public"."update_email_token_timestamp"();



CREATE OR REPLACE TRIGGER "trg_activity_events_immutable_delete" BEFORE DELETE ON "public"."activity_events" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_activity_events_immutability"();



CREATE OR REPLACE TRIGGER "trg_activity_events_immutable_update" BEFORE UPDATE ON "public"."activity_events" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_activity_events_immutability"();



CREATE OR REPLACE TRIGGER "trg_ai_actions_updated_at" BEFORE UPDATE ON "public"."ai_actions_queue" FOR EACH ROW EXECUTE FUNCTION "public"."ai_actions_queue_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_audit_crm_offer_insert" AFTER INSERT ON "public"."crm_offers" FOR EACH ROW EXECUTE FUNCTION "public"."audit_crm_offer_event"();



CREATE OR REPLACE TRIGGER "trg_audit_crm_offer_status" AFTER UPDATE OF "status" ON "public"."crm_offers" FOR EACH ROW EXECUTE FUNCTION "public"."audit_crm_offer_event"();



CREATE OR REPLACE TRIGGER "trg_audit_kyc_magic_link_insert" AFTER INSERT ON "public"."kyc_magic_links" FOR EACH ROW EXECUTE FUNCTION "public"."audit_kyc_magic_link_transitions"();



CREATE OR REPLACE TRIGGER "trg_audit_kyc_magic_link_update" BEFORE UPDATE ON "public"."kyc_magic_links" FOR EACH ROW EXECUTE FUNCTION "public"."audit_kyc_magic_link_transitions"();



CREATE OR REPLACE TRIGGER "trg_auto_verify_kyc_dossier" AFTER UPDATE ON "public"."kyc_checklist_items" FOR EACH ROW EXECUTE FUNCTION "public"."auto_verify_kyc_dossier"();



CREATE OR REPLACE TRIGGER "trg_enforce_kyc_cases_retention" BEFORE DELETE ON "public"."kyc_cases" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_kyc_cases_retention"();



CREATE OR REPLACE TRIGGER "trg_enforce_kyc_magic_links_retention" BEFORE DELETE ON "public"."kyc_magic_links" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_kyc_magic_links_retention"();



CREATE OR REPLACE TRIGGER "trg_enforce_kyc_retention" BEFORE DELETE ON "public"."documents" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_kyc_retention"();



CREATE OR REPLACE TRIGGER "trg_generate_ticket_number" BEFORE INSERT ON "public"."support_tickets" FOR EACH ROW WHEN ((("new"."ticket_number" IS NULL) OR ("new"."ticket_number" = ''::"text"))) EXECUTE FUNCTION "public"."generate_ticket_number"();



CREATE OR REPLACE TRIGGER "trg_log_kyc_screening_decision" AFTER INSERT ON "public"."kyc_screening_decisions" FOR EACH ROW EXECUTE FUNCTION "public"."log_kyc_screening_decision"();



CREATE OR REPLACE TRIGGER "trg_market_listings_updated_at" BEFORE UPDATE ON "public"."market_listings" FOR EACH ROW EXECUTE FUNCTION "public"."update_market_listings_updated_at"();



CREATE OR REPLACE TRIGGER "trg_marketplace_inquiries_updated_at" BEFORE UPDATE ON "public"."marketplace_inquiries" FOR EACH ROW EXECUTE FUNCTION "public"."update_marketplace_inquiries_updated_at"();



CREATE OR REPLACE TRIGGER "trg_monitor_transaction_kyc_gate" AFTER UPDATE OF "stage" ON "public"."transactions" FOR EACH ROW EXECUTE FUNCTION "public"."monitor_transaction_kyc_gate"();



CREATE OR REPLACE TRIGGER "trg_properties_audit" AFTER INSERT OR DELETE OR UPDATE ON "public"."properties" FOR EACH ROW EXECUTE FUNCTION "public"."properties_audit_event"();



CREATE OR REPLACE TRIGGER "trg_seed_kyc_lba_checks" AFTER INSERT ON "public"."kyc_cases" FOR EACH ROW EXECUTE FUNCTION "public"."seed_kyc_lba_checks"();



CREATE OR REPLACE TRIGGER "trg_set_kyc_document_retention" BEFORE INSERT ON "public"."documents" FOR EACH ROW EXECUTE FUNCTION "public"."set_kyc_document_retention"();



CREATE OR REPLACE TRIGGER "trg_set_ticket_sla" BEFORE INSERT ON "public"."support_tickets" FOR EACH ROW EXECUTE FUNCTION "public"."set_ticket_sla"();



CREATE OR REPLACE TRIGGER "trg_update_ticket_timestamp" BEFORE UPDATE ON "public"."support_tickets" FOR EACH ROW EXECUTE FUNCTION "public"."update_ticket_timestamp"();



ALTER TABLE ONLY "public"."activity_events"
    ADD CONSTRAINT "activity_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."activity_events"
    ADD CONSTRAINT "activity_events_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."admin_changelog"
    ADD CONSTRAINT "admin_changelog_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."admin_notes"
    ADD CONSTRAINT "admin_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."admin_nps_responses"
    ADD CONSTRAINT "admin_nps_responses_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id");



ALTER TABLE ONLY "public"."admin_nps_responses"
    ADD CONSTRAINT "admin_nps_responses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."agencies"
    ADD CONSTRAINT "agencies_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."agency_profiles"
    ADD CONSTRAINT "agency_profiles_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id");



ALTER TABLE ONLY "public"."agent_profiles"
    ADD CONSTRAINT "agent_profiles_agency_profile_id_fkey" FOREIGN KEY ("agency_profile_id") REFERENCES "public"."agency_profiles"("id");



ALTER TABLE ONLY "public"."agent_profiles"
    ADD CONSTRAINT "agent_profiles_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."agent_reviews"
    ADD CONSTRAINT "agent_reviews_agent_profile_id_fkey" FOREIGN KEY ("agent_profile_id") REFERENCES "public"."agent_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."agent_reviews"
    ADD CONSTRAINT "agent_reviews_reviewer_contact_id_fkey" FOREIGN KEY ("reviewer_contact_id") REFERENCES "public"."contacts"("id");



ALTER TABLE ONLY "public"."ai_actions_queue"
    ADD CONSTRAINT "ai_actions_queue_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_actions_queue"
    ADD CONSTRAINT "ai_actions_queue_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_actions_queue"
    ADD CONSTRAINT "ai_actions_queue_validated_by_fkey" FOREIGN KEY ("validated_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."article_feedback"
    ADD CONSTRAINT "article_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."article_views"
    ADD CONSTRAINT "article_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."auth_events"
    ADD CONSTRAINT "auth_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."automation_rules"
    ADD CONSTRAINT "automation_rules_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."automation_rules"
    ADD CONSTRAINT "automation_rules_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."message_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."calendar_sync"
    ADD CONSTRAINT "calendar_sync_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calendar_sync"
    ADD CONSTRAINT "calendar_sync_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_conversations"
    ADD CONSTRAINT "chat_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_searches"
    ADD CONSTRAINT "client_searches_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."client_searches"
    ADD CONSTRAINT "client_searches_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contact_scores"
    ADD CONSTRAINT "contact_scores_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contact_scores"
    ADD CONSTRAINT "contact_scores_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."crm_offers"
    ADD CONSTRAINT "crm_offers_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."crm_offers"
    ADD CONSTRAINT "crm_offers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."crm_offers"
    ADD CONSTRAINT "crm_offers_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "public"."transactions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."crm_offers"
    ADD CONSTRAINT "crm_offers_parent_offer_id_fkey" FOREIGN KEY ("parent_offer_id") REFERENCES "public"."crm_offers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."daily_actions"
    ADD CONSTRAINT "daily_actions_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daily_actions"
    ADD CONSTRAINT "daily_actions_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."email_messages_cache"
    ADD CONSTRAINT "email_messages_cache_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."email_messages_cache"
    ADD CONSTRAINT "email_messages_cache_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."external_listings"
    ADD CONSTRAINT "external_listings_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gmail_tokens"
    ADD CONSTRAINT "gmail_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."google_calendar_tokens"
    ADD CONSTRAINT "google_calendar_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kyc_cases"
    ADD CONSTRAINT "kyc_cases_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kyc_cases"
    ADD CONSTRAINT "kyc_cases_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."kyc_cases"
    ADD CONSTRAINT "kyc_cases_source_of_funds_doc_id_fkey" FOREIGN KEY ("source_of_funds_doc_id") REFERENCES "public"."documents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."kyc_cases"
    ADD CONSTRAINT "kyc_cases_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."kyc_cases"
    ADD CONSTRAINT "kyc_cases_validated_by_fkey" FOREIGN KEY ("validated_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."kyc_checklist_items"
    ADD CONSTRAINT "kyc_checklist_items_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."kyc_checklist_items"
    ADD CONSTRAINT "kyc_checklist_items_kyc_case_id_fkey" FOREIGN KEY ("kyc_case_id") REFERENCES "public"."kyc_cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kyc_magic_link_uploads"
    ADD CONSTRAINT "kyc_magic_link_uploads_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kyc_magic_link_uploads"
    ADD CONSTRAINT "kyc_magic_link_uploads_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."kyc_magic_link_uploads"
    ADD CONSTRAINT "kyc_magic_link_uploads_magic_link_id_fkey" FOREIGN KEY ("magic_link_id") REFERENCES "public"."kyc_magic_links"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kyc_magic_links"
    ADD CONSTRAINT "kyc_magic_links_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kyc_magic_links"
    ADD CONSTRAINT "kyc_magic_links_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kyc_magic_links"
    ADD CONSTRAINT "kyc_magic_links_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."kyc_magic_links"
    ADD CONSTRAINT "kyc_magic_links_kyc_case_id_fkey" FOREIGN KEY ("kyc_case_id") REFERENCES "public"."kyc_cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kyc_screening_decisions"
    ADD CONSTRAINT "kyc_screening_decisions_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kyc_screening_decisions"
    ADD CONSTRAINT "kyc_screening_decisions_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."kyc_screening_decisions"
    ADD CONSTRAINT "kyc_screening_decisions_kyc_case_id_fkey" FOREIGN KEY ("kyc_case_id") REFERENCES "public"."kyc_cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kyc_screening_decisions"
    ADD CONSTRAINT "kyc_screening_decisions_supersedes_id_fkey" FOREIGN KEY ("supersedes_id") REFERENCES "public"."kyc_screening_decisions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."listing_reports"
    ADD CONSTRAINT "listing_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."listings"
    ADD CONSTRAINT "listings_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."listings"
    ADD CONSTRAINT "listings_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."market_changes"
    ADD CONSTRAINT "market_changes_market_listing_id_fkey" FOREIGN KEY ("market_listing_id") REFERENCES "public"."market_listings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."market_favorites"
    ADD CONSTRAINT "market_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."market_hidden"
    ADD CONSTRAINT "market_hidden_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."market_listings"
    ADD CONSTRAINT "market_listings_agency_profile_id_fkey" FOREIGN KEY ("agency_profile_id") REFERENCES "public"."agency_profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."market_price_history"
    ADD CONSTRAINT "market_price_history_market_listing_id_fkey" FOREIGN KEY ("market_listing_id") REFERENCES "public"."market_listings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."marketplace_inquiries"
    ADD CONSTRAINT "marketplace_inquiries_market_listing_id_fkey" FOREIGN KEY ("market_listing_id") REFERENCES "public"."market_listings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."marketplace_inquiries"
    ADD CONSTRAINT "marketplace_inquiries_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_client_search_id_fkey" FOREIGN KEY ("client_search_id") REFERENCES "public"."client_searches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_market_listing_id_fkey" FOREIGN KEY ("market_listing_id") REFERENCES "public"."market_listings"("id");



ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."message_templates"
    ADD CONSTRAINT "message_templates_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."message_threads"
    ADD CONSTRAINT "message_threads_buyer_user_id_fkey" FOREIGN KEY ("buyer_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."message_threads"
    ADD CONSTRAINT "message_threads_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."message_threads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."moderation_actions"
    ADD CONSTRAINT "moderation_actions_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."moderation_actions"
    ADD CONSTRAINT "moderation_actions_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."offers"
    ADD CONSTRAINT "offers_contact_buyer_id_fkey" FOREIGN KEY ("contact_buyer_id") REFERENCES "public"."contacts"("id");



ALTER TABLE ONLY "public"."offers"
    ADD CONSTRAINT "offers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."onboarding_checklist"
    ADD CONSTRAINT "onboarding_checklist_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."onboarding_checklist"
    ADD CONSTRAINT "onboarding_checklist_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."outlook_calendar_sync"
    ADD CONSTRAINT "outlook_calendar_sync_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."outlook_calendar_sync"
    ADD CONSTRAINT "outlook_calendar_sync_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."outlook_calendar_tokens"
    ADD CONSTRAINT "outlook_calendar_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."outlook_mail_tokens"
    ADD CONSTRAINT "outlook_mail_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."properties"
    ADD CONSTRAINT "properties_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."properties"
    ADD CONSTRAINT "properties_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."property_scores"
    ADD CONSTRAINT "property_scores_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."property_scores"
    ADD CONSTRAINT "property_scores_market_listing_id_fkey" FOREIGN KEY ("market_listing_id") REFERENCES "public"."market_listings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."property_scores"
    ADD CONSTRAINT "property_scores_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reminders"
    ADD CONSTRAINT "reminders_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reminders"
    ADD CONSTRAINT "reminders_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reminders"
    ADD CONSTRAINT "reminders_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reminders"
    ADD CONSTRAINT "reminders_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reminders"
    ADD CONSTRAINT "reminders_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."saved_searches"
    ADD CONSTRAINT "saved_searches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."seller_leads"
    ADD CONSTRAINT "seller_leads_assigned_agency_id_fkey" FOREIGN KEY ("assigned_agency_id") REFERENCES "public"."agencies"("id");



ALTER TABLE ONLY "public"."seller_leads"
    ADD CONSTRAINT "seller_leads_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id");



ALTER TABLE ONLY "public"."seller_leads"
    ADD CONSTRAINT "seller_leads_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id");



ALTER TABLE ONLY "public"."seller_portals"
    ADD CONSTRAINT "seller_portals_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."support_tickets"
    ADD CONSTRAINT "support_tickets_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id");



ALTER TABLE ONLY "public"."support_tickets"
    ADD CONSTRAINT "support_tickets_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."support_tickets"
    ADD CONSTRAINT "support_tickets_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id");



ALTER TABLE ONLY "public"."ticket_events"
    ADD CONSTRAINT "ticket_events_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ticket_messages"
    ADD CONSTRAINT "ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_contact_buyer_id_fkey" FOREIGN KEY ("contact_buyer_id") REFERENCES "public"."contacts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_contact_seller_id_fkey" FOREIGN KEY ("contact_seller_id") REFERENCES "public"."contacts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_devices"
    ADD CONSTRAINT "user_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."visits"
    ADD CONSTRAINT "visits_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "public"."agencies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."visits"
    ADD CONSTRAINT "visits_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."visits"
    ADD CONSTRAINT "visits_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."visits"
    ADD CONSTRAINT "visits_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."visits"
    ADD CONSTRAINT "visits_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE SET NULL;



CREATE POLICY "Agents can delete agency documents" ON "public"."documents" FOR DELETE USING (("agency_id" IN ( SELECT "p"."agency_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"()))));



CREATE POLICY "Agents can delete agency offers" ON "public"."offers" FOR DELETE USING (("agency_id" IN ( SELECT "p"."agency_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"()))));



CREATE POLICY "Agents can insert agency documents" ON "public"."documents" FOR INSERT WITH CHECK (("agency_id" IN ( SELECT "p"."agency_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"()))));



CREATE POLICY "Agents can insert agency offers" ON "public"."offers" FOR INSERT WITH CHECK (("agency_id" IN ( SELECT "p"."agency_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"()))));



CREATE POLICY "Agents can insert agency threads" ON "public"."message_threads" FOR INSERT WITH CHECK (("agency_id" IN ( SELECT "p"."agency_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"()))));



CREATE POLICY "Agents can read agency offers" ON "public"."offers" FOR SELECT USING (("agency_id" IN ( SELECT "p"."agency_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"()))));



CREATE POLICY "Agents can read agency threads" ON "public"."message_threads" FOR SELECT USING (("agency_id" IN ( SELECT "p"."agency_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"()))));



CREATE POLICY "Agents can send messages" ON "public"."messages" FOR INSERT WITH CHECK (("thread_id" IN ( SELECT "t"."id"
   FROM "public"."message_threads" "t"
  WHERE ("t"."agency_id" IN ( SELECT "p"."agency_id"
           FROM "public"."profiles" "p"
          WHERE ("p"."id" = "auth"."uid"()))))));



CREATE POLICY "Agents can update agency documents" ON "public"."documents" FOR UPDATE USING (("agency_id" IN ( SELECT "p"."agency_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"()))));



CREATE POLICY "Agents can update agency offers" ON "public"."offers" FOR UPDATE USING (("agency_id" IN ( SELECT "p"."agency_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"()))));



CREATE POLICY "Agents can update agency threads" ON "public"."message_threads" FOR UPDATE USING (("agency_id" IN ( SELECT "p"."agency_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"()))));



CREATE POLICY "Anyone can insert feedback" ON "public"."article_feedback" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can insert views" ON "public"."article_views" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can read market changes" ON "public"."market_changes" FOR SELECT USING (true);



CREATE POLICY "Anyone can submit listing reports" ON "public"."listing_reports" FOR INSERT WITH CHECK (((("auth"."uid"() IS NULL) AND ("user_id" IS NULL)) OR (("auth"."uid"() IS NOT NULL) AND ("user_id" = "auth"."uid"()))));



CREATE POLICY "Authenticated users can read market_listings" ON "public"."market_listings" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read market_price_history" ON "public"."market_price_history" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Buyers read their messages" ON "public"."messages" FOR SELECT USING (("thread_id" IN ( SELECT "message_threads"."id"
   FROM "public"."message_threads"
  WHERE ("message_threads"."buyer_user_id" = "auth"."uid"()))));



CREATE POLICY "Buyers read their threads" ON "public"."message_threads" FOR SELECT USING (("buyer_user_id" = "auth"."uid"()));



CREATE POLICY "Buyers send messages" ON "public"."messages" FOR INSERT WITH CHECK ((("thread_id" IN ( SELECT "message_threads"."id"
   FROM "public"."message_threads"
  WHERE ("message_threads"."buyer_user_id" = "auth"."uid"()))) AND ("sender_type" = 'contact'::"text") AND ("sender_id" = "auth"."uid"())));



CREATE POLICY "Buyers update their threads" ON "public"."message_threads" FOR UPDATE USING (("buyer_user_id" = "auth"."uid"()));



CREATE POLICY "Contacts can read their threads" ON "public"."message_threads" FOR SELECT USING (("contact_id" IN ( SELECT "c"."id"
   FROM "public"."contacts" "c"
  WHERE ("c"."user_id" = "auth"."uid"()))));



CREATE POLICY "Contacts can send messages" ON "public"."messages" FOR INSERT WITH CHECK (("thread_id" IN ( SELECT "t"."id"
   FROM "public"."message_threads" "t"
  WHERE ("t"."contact_id" IN ( SELECT "c"."id"
           FROM "public"."contacts" "c"
          WHERE ("c"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Public can read active market_listings" ON "public"."market_listings" FOR SELECT TO "anon" USING (("status" = ANY (ARRAY['active'::"text", 'price_reduced'::"text"])));



CREATE POLICY "Public can read market_price_history" ON "public"."market_price_history" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Sellers can insert documents" ON "public"."documents" FOR INSERT WITH CHECK (("uploaded_by" = "auth"."uid"()));



CREATE POLICY "Sellers can read their documents" ON "public"."documents" FOR SELECT USING ((("uploaded_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."contacts" "c"
  WHERE (("c"."user_id" = "auth"."uid"()) AND ("c"."type" = 'seller'::"text"))))));



CREATE POLICY "Sellers can read their offers" ON "public"."offers" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."contacts" "c"
  WHERE (("c"."user_id" = "auth"."uid"()) AND ("c"."type" = 'seller'::"text")))));



CREATE POLICY "Sellers can respond to offers" ON "public"."offers" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."contacts" "c"
  WHERE (("c"."user_id" = "auth"."uid"()) AND ("c"."type" = 'seller'::"text")))));



CREATE POLICY "Service role can manage market_listings" ON "public"."market_listings" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage market_price_history" ON "public"."market_price_history" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can read all saved searches" ON "public"."saved_searches" FOR SELECT TO "service_role" USING (true);



CREATE POLICY "Service role feedback" ON "public"."article_feedback" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role full access contact scores" ON "public"."contact_scores" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role full access conversations" ON "public"."chat_conversations" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role full access email cache" ON "public"."email_messages_cache" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role full access gmail tokens" ON "public"."gmail_tokens" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role full access messages" ON "public"."chat_messages" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role full access outlook mail tokens" ON "public"."outlook_mail_tokens" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role full access outlook sync" ON "public"."outlook_calendar_sync" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role full access outlook tokens" ON "public"."outlook_calendar_tokens" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role full access property scores" ON "public"."property_scores" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role full access sync" ON "public"."calendar_sync" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role full access tokens" ON "public"."google_calendar_tokens" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role views" ON "public"."article_views" USING (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Users can delete own calendar sync" ON "public"."calendar_sync" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own calendar tokens" ON "public"."google_calendar_tokens" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own email cache" ON "public"."email_messages_cache" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own gmail tokens" ON "public"."gmail_tokens" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own outlook mail tokens" ON "public"."outlook_mail_tokens" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own outlook sync" ON "public"."outlook_calendar_sync" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own outlook tokens" ON "public"."outlook_calendar_tokens" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own calendar sync" ON "public"."calendar_sync" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own calendar tokens" ON "public"."google_calendar_tokens" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own email cache" ON "public"."email_messages_cache" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own gmail tokens" ON "public"."gmail_tokens" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own outlook mail tokens" ON "public"."outlook_mail_tokens" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own outlook sync" ON "public"."outlook_calendar_sync" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own outlook tokens" ON "public"."outlook_calendar_tokens" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can manage their own saved searches" ON "public"."saved_searches" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can mark messages as read" ON "public"."messages" FOR UPDATE USING (("sender_id" <> "auth"."uid"()));



CREATE POLICY "Users can read own agency contact scores" ON "public"."contact_scores" FOR SELECT USING (("agency_id" = "public"."get_my_agency_id"()));



CREATE POLICY "Users can read own agency property scores" ON "public"."property_scores" FOR SELECT USING ((("agency_id" = "public"."get_my_agency_id"()) OR ("agency_id" IS NULL)));



CREATE POLICY "Users can read own calendar sync" ON "public"."calendar_sync" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own calendar tokens" ON "public"."google_calendar_tokens" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own email cache" ON "public"."email_messages_cache" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own gmail tokens" ON "public"."gmail_tokens" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own outlook mail tokens" ON "public"."outlook_mail_tokens" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own outlook sync" ON "public"."outlook_calendar_sync" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own outlook tokens" ON "public"."outlook_calendar_tokens" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can read own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can read thread messages" ON "public"."messages" FOR SELECT USING (("thread_id" IN ( SELECT "t"."id"
   FROM "public"."message_threads" "t"
  WHERE (("t"."agency_id" IN ( SELECT "p"."agency_id"
           FROM "public"."profiles" "p"
          WHERE ("p"."id" = "auth"."uid"()))) OR ("t"."contact_id" IN ( SELECT "c"."id"
           FROM "public"."contacts" "c"
          WHERE ("c"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Users can update own calendar sync" ON "public"."calendar_sync" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own calendar tokens" ON "public"."google_calendar_tokens" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own email cache" ON "public"."email_messages_cache" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own gmail tokens" ON "public"."gmail_tokens" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own outlook mail tokens" ON "public"."outlook_mail_tokens" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own outlook sync" ON "public"."outlook_calendar_sync" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own outlook tokens" ON "public"."outlook_calendar_tokens" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users delete their devices" ON "public"."user_devices" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users delete their hidden" ON "public"."market_hidden" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users delete their market favorites" ON "public"."market_favorites" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users insert their hidden" ON "public"."market_hidden" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users insert their market favorites" ON "public"."market_favorites" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users read their devices" ON "public"."user_devices" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users read their hidden" ON "public"."market_hidden" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users read their market favorites" ON "public"."market_favorites" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users read their own reports" ON "public"."listing_reports" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users see own feedback" ON "public"."article_feedback" FOR SELECT USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."activity_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."admin_changelog" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_changelog_select" ON "public"."admin_changelog" FOR SELECT USING ((("published" = true) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text"))))));



CREATE POLICY "admin_changelog_write" ON "public"."admin_changelog" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text")))));



CREATE POLICY "admin_delete" ON "public"."coming_soon_subscribers" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"]))))));



CREATE POLICY "admin_delete_reviews" ON "public"."agent_reviews" FOR DELETE TO "authenticated" USING ("public"."is_super_admin"());



ALTER TABLE "public"."admin_feature_flags" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_feature_flags_select" ON "public"."admin_feature_flags" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "admin_feature_flags_write" ON "public"."admin_feature_flags" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text")))));



CREATE POLICY "admin_insert_agency_profiles" ON "public"."agency_profiles" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_super_admin"());



CREATE POLICY "admin_insert_agent_profiles" ON "public"."agent_profiles" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_super_admin"());



ALTER TABLE "public"."admin_notes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_nps_insert_own" ON "public"."admin_nps_responses" FOR INSERT WITH CHECK ((("auth"."uid"() IS NOT NULL) AND (("user_id" IS NULL) OR ("user_id" = "auth"."uid"()))));



ALTER TABLE "public"."admin_nps_responses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_nps_select_admin" ON "public"."admin_nps_responses" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'super_admin'::"text")))));



CREATE POLICY "admin_select_all" ON "public"."coming_soon_subscribers" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"]))))));



ALTER TABLE "public"."agencies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agency_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."agent_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "agent_respond_reviews" ON "public"."agent_reviews" FOR UPDATE TO "authenticated" USING ((("agent_profile_id" IN ( SELECT "agent_profiles"."id"
   FROM "public"."agent_profiles"
  WHERE ("agent_profiles"."profile_id" = "auth"."uid"()))) OR "public"."is_super_admin"()));



ALTER TABLE "public"."agent_reviews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "agents_own_agency" ON "public"."external_listings" USING (("agency_id" = ( SELECT "profiles"."agency_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "agents_own_agency" ON "public"."seller_portals" TO "authenticated" USING (("agency_id" = "public"."get_my_agency_id"()));



CREATE POLICY "agents_own_agency" ON "public"."subscriptions" USING (("agency_id" = ( SELECT "profiles"."agency_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "agents_update_seller_leads" ON "public"."seller_leads" FOR UPDATE TO "authenticated" USING ((("assigned_agency_id" = "public"."get_my_agency_id"()) OR ("assigned_agency_id" IS NULL)));



CREATE POLICY "ai_actions_insert_super_admin" ON "public"."ai_actions_queue" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'super_admin'::"text")))));



ALTER TABLE "public"."ai_actions_queue" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_actions_select_own_agency" ON "public"."ai_actions_queue" FOR SELECT USING ((("agent_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."agency_id" = "ai_actions_queue"."agency_id"))))));



CREATE POLICY "ai_actions_update_own" ON "public"."ai_actions_queue" FOR UPDATE USING (("agent_id" = "auth"."uid"())) WITH CHECK (("agent_id" = "auth"."uid"()));



ALTER TABLE "public"."ai_balance_snapshots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_usage_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "anon_insert_email" ON "public"."coming_soon_subscribers" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "anon_insert_messages" ON "public"."ticket_messages" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "anon_insert_tickets" ON "public"."support_tickets" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "anon_insert_visit" ON "public"."visits" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "anon_select_events" ON "public"."ticket_events" FOR SELECT TO "anon" USING (true);



CREATE POLICY "anon_select_messages" ON "public"."ticket_messages" FOR SELECT TO "anon" USING (("is_internal_note" = false));



CREATE POLICY "anon_select_own_ticket" ON "public"."support_tickets" FOR SELECT TO "anon" USING (true);



CREATE POLICY "anon_select_visit_by_token" ON "public"."visits" FOR SELECT TO "anon" USING (("manage_token" IS NOT NULL));



CREATE POLICY "anon_update_visit_by_token" ON "public"."visits" FOR UPDATE TO "anon" USING (("manage_token" IS NOT NULL)) WITH CHECK (("manage_token" IS NOT NULL));



CREATE POLICY "anyone_insert_reviews" ON "public"."agent_reviews" FOR INSERT WITH CHECK (true);



ALTER TABLE "public"."app_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."article_feedback" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."article_views" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."auth_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "auth_events_select_super_admin" ON "public"."auth_events" FOR SELECT TO "authenticated" USING ("public"."is_super_admin"());



COMMENT ON POLICY "auth_events_select_super_admin" ON "public"."auth_events" IS 'Select restreint à is_super_admin(). Insert restreint à la service_role via la suppression de auth_events_insert_any — seule l''edge function log-auth-event peut écrire.';



ALTER TABLE "public"."automation_rules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "automation_rules_insert" ON "public"."automation_rules" FOR INSERT WITH CHECK (("agency_id" = "public"."get_user_agency_id"()));



CREATE POLICY "automation_rules_select" ON "public"."automation_rules" FOR SELECT USING (("agency_id" = "public"."get_user_agency_id"()));



CREATE POLICY "automation_rules_update" ON "public"."automation_rules" FOR UPDATE USING (("agency_id" = "public"."get_user_agency_id"()));



ALTER TABLE "public"."calendar_sync" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_conversations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chat_conversations_auth_insert" ON "public"."chat_conversations" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "chat_conversations_owner_all" ON "public"."chat_conversations" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."chat_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "chat_messages_auth_insert" ON "public"."chat_messages" FOR INSERT TO "authenticated" WITH CHECK (("conversation_id" IN ( SELECT "chat_conversations"."id"
   FROM "public"."chat_conversations"
  WHERE ("chat_conversations"."user_id" = "auth"."uid"()))));



CREATE POLICY "chat_messages_owner_all" ON "public"."chat_messages" TO "authenticated" USING (("conversation_id" IN ( SELECT "chat_conversations"."id"
   FROM "public"."chat_conversations"
  WHERE ("chat_conversations"."user_id" = "auth"."uid"())))) WITH CHECK (("conversation_id" IN ( SELECT "chat_conversations"."id"
   FROM "public"."chat_conversations"
  WHERE ("chat_conversations"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."client_searches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "client_searches_delete" ON "public"."client_searches" FOR DELETE USING (("agency_id" = "public"."get_user_agency_id"()));



CREATE POLICY "client_searches_insert" ON "public"."client_searches" FOR INSERT WITH CHECK (("agency_id" = "public"."get_user_agency_id"()));



CREATE POLICY "client_searches_select" ON "public"."client_searches" FOR SELECT USING (("agency_id" = "public"."get_user_agency_id"()));



CREATE POLICY "client_searches_update" ON "public"."client_searches" FOR UPDATE USING (("agency_id" = "public"."get_user_agency_id"()));



ALTER TABLE "public"."coming_soon_subscribers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contact_scores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contacts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "contacts_anon_onboarding_insert" ON "public"."contacts" FOR INSERT TO "anon" WITH CHECK (("source" = 'onboarding'::"text"));



CREATE POLICY "contacts_delete" ON "public"."contacts" FOR DELETE TO "authenticated" USING (("agency_id" = "public"."get_my_agency_id"()));



CREATE POLICY "contacts_insert" ON "public"."contacts" FOR INSERT TO "authenticated" WITH CHECK (("agency_id" = "public"."get_my_agency_id"()));



CREATE POLICY "contacts_select" ON "public"."contacts" FOR SELECT TO "authenticated" USING ((("agency_id" = "public"."get_my_agency_id"()) OR ("user_id" = "auth"."uid"())));



CREATE POLICY "contacts_update" ON "public"."contacts" FOR UPDATE TO "authenticated" USING (("agency_id" = "public"."get_my_agency_id"())) WITH CHECK (("agency_id" = "public"."get_my_agency_id"()));



ALTER TABLE "public"."crm_offers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "crm_offers agents delete" ON "public"."crm_offers" FOR DELETE USING (("agency_id" IN ( SELECT "p"."agency_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"()))));



CREATE POLICY "crm_offers agents insert" ON "public"."crm_offers" FOR INSERT WITH CHECK (("agency_id" IN ( SELECT "p"."agency_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"()))));



CREATE POLICY "crm_offers agents select" ON "public"."crm_offers" FOR SELECT USING (("agency_id" IN ( SELECT "p"."agency_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"()))));



CREATE POLICY "crm_offers agents update" ON "public"."crm_offers" FOR UPDATE USING (("agency_id" IN ( SELECT "p"."agency_id"
   FROM "public"."profiles" "p"
  WHERE ("p"."id" = "auth"."uid"()))));



CREATE POLICY "crm_offers super admin select" ON "public"."crm_offers" FOR SELECT USING ("public"."is_super_admin"());



ALTER TABLE "public"."daily_actions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "daily_actions_insert" ON "public"."daily_actions" FOR INSERT WITH CHECK ((("agency_id" = "public"."get_user_agency_id"()) AND ("agent_id" = "auth"."uid"())));



CREATE POLICY "daily_actions_select" ON "public"."daily_actions" FOR SELECT USING ((("agency_id" = "public"."get_user_agency_id"()) AND ("agent_id" = "auth"."uid"())));



CREATE POLICY "daily_actions_update" ON "public"."daily_actions" FOR UPDATE USING ((("agency_id" = "public"."get_user_agency_id"()) AND ("agent_id" = "auth"."uid"())));



ALTER TABLE "public"."documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "documents_select" ON "public"."documents" FOR SELECT TO "authenticated" USING (("agency_id" = "public"."get_my_agency_id"()));



ALTER TABLE "public"."email_messages_cache" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "events_select" ON "public"."activity_events" FOR SELECT TO "authenticated" USING (("agency_id" = "public"."get_my_agency_id"()));



ALTER TABLE "public"."external_listings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."favorites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gmail_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."google_calendar_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kyc_cases" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "kyc_cases_delete" ON "public"."kyc_cases" FOR DELETE TO "authenticated" USING (("agency_id" = "public"."get_my_agency_id"()));



CREATE POLICY "kyc_cases_insert" ON "public"."kyc_cases" FOR INSERT TO "authenticated" WITH CHECK (("agency_id" = "public"."get_my_agency_id"()));



CREATE POLICY "kyc_cases_select" ON "public"."kyc_cases" FOR SELECT TO "authenticated" USING (("agency_id" = "public"."get_my_agency_id"()));



CREATE POLICY "kyc_cases_update" ON "public"."kyc_cases" FOR UPDATE TO "authenticated" USING (("agency_id" = "public"."get_my_agency_id"())) WITH CHECK (("agency_id" = "public"."get_my_agency_id"()));



ALTER TABLE "public"."kyc_checklist_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "kyc_items_delete" ON "public"."kyc_checklist_items" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."kyc_cases"
  WHERE (("kyc_cases"."id" = "kyc_checklist_items"."kyc_case_id") AND ("kyc_cases"."agency_id" = "public"."get_my_agency_id"())))));



CREATE POLICY "kyc_items_insert" ON "public"."kyc_checklist_items" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."kyc_cases"
  WHERE (("kyc_cases"."id" = "kyc_checklist_items"."kyc_case_id") AND ("kyc_cases"."agency_id" = "public"."get_my_agency_id"())))));



CREATE POLICY "kyc_items_select" ON "public"."kyc_checklist_items" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."kyc_cases"
  WHERE (("kyc_cases"."id" = "kyc_checklist_items"."kyc_case_id") AND ("kyc_cases"."agency_id" = "public"."get_my_agency_id"())))));



CREATE POLICY "kyc_items_update" ON "public"."kyc_checklist_items" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."kyc_cases"
  WHERE (("kyc_cases"."id" = "kyc_checklist_items"."kyc_case_id") AND ("kyc_cases"."agency_id" = "public"."get_my_agency_id"())))));



ALTER TABLE "public"."kyc_magic_link_uploads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "kyc_magic_link_uploads_select_agency" ON "public"."kyc_magic_link_uploads" FOR SELECT TO "authenticated" USING (("agency_id" = "public"."get_my_agency_id"()));



CREATE POLICY "kyc_magic_link_uploads_update_agency" ON "public"."kyc_magic_link_uploads" FOR UPDATE TO "authenticated" USING (("agency_id" = "public"."get_my_agency_id"())) WITH CHECK (("agency_id" = "public"."get_my_agency_id"()));



ALTER TABLE "public"."kyc_magic_links" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "kyc_magic_links_insert_agency" ON "public"."kyc_magic_links" FOR INSERT TO "authenticated" WITH CHECK ((("agency_id" = "public"."get_my_agency_id"()) AND ("created_by" = "auth"."uid"())));



CREATE POLICY "kyc_magic_links_select_agency" ON "public"."kyc_magic_links" FOR SELECT TO "authenticated" USING (("agency_id" = "public"."get_my_agency_id"()));



CREATE POLICY "kyc_magic_links_update_agency" ON "public"."kyc_magic_links" FOR UPDATE TO "authenticated" USING (("agency_id" = "public"."get_my_agency_id"())) WITH CHECK (("agency_id" = "public"."get_my_agency_id"()));



ALTER TABLE "public"."kyc_screening_decisions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "kyc_screening_decisions_insert" ON "public"."kyc_screening_decisions" FOR INSERT TO "authenticated" WITH CHECK ((("agency_id" = "public"."get_my_agency_id"()) AND ("decided_by" = "auth"."uid"())));



CREATE POLICY "kyc_screening_decisions_select" ON "public"."kyc_screening_decisions" FOR SELECT TO "authenticated" USING (("agency_id" = "public"."get_my_agency_id"()));



ALTER TABLE "public"."listing_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."listings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."market_changes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."market_favorites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."market_hidden" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."market_listings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."market_price_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketplace_inquiries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."matches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "matches_delete" ON "public"."matches" FOR DELETE USING (("agency_id" = "public"."get_user_agency_id"()));



CREATE POLICY "matches_insert" ON "public"."matches" FOR INSERT WITH CHECK (("agency_id" = "public"."get_user_agency_id"()));



CREATE POLICY "matches_select" ON "public"."matches" FOR SELECT USING (("agency_id" = "public"."get_user_agency_id"()));



CREATE POLICY "matches_update" ON "public"."matches" FOR UPDATE USING (("agency_id" = "public"."get_user_agency_id"()));



ALTER TABLE "public"."message_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "message_templates_insert" ON "public"."message_templates" FOR INSERT WITH CHECK (("agency_id" = "public"."get_user_agency_id"()));



CREATE POLICY "message_templates_select" ON "public"."message_templates" FOR SELECT USING (("agency_id" = "public"."get_user_agency_id"()));



CREATE POLICY "message_templates_update" ON "public"."message_templates" FOR UPDATE USING (("agency_id" = "public"."get_user_agency_id"()));



ALTER TABLE "public"."message_threads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."moderation_actions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."offers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."onboarding_checklist" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "onboarding_checklist_self" ON "public"."onboarding_checklist" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "onboarding_checklist_service" ON "public"."onboarding_checklist" TO "service_role" USING (true);



ALTER TABLE "public"."outlook_calendar_sync" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."outlook_calendar_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."outlook_mail_tokens" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "owner_update_agency_profiles" ON "public"."agency_profiles" FOR UPDATE TO "authenticated" USING ((("agency_id" IN ( SELECT "profiles"."agency_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))) OR "public"."is_super_admin"()));



CREATE POLICY "owner_update_agent_profiles" ON "public"."agent_profiles" FOR UPDATE TO "authenticated" USING ((("profile_id" = "auth"."uid"()) OR "public"."is_super_admin"()));



ALTER TABLE "public"."platform_metrics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_insert" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "profiles_select_agency" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("agency_id" = "public"."get_my_agency_id"()));



CREATE POLICY "profiles_select_own" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("id" = "auth"."uid"()));



CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"()));



ALTER TABLE "public"."properties" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "properties_select_agency" ON "public"."properties" FOR SELECT USING ((("agency_id" = "public"."get_user_agency_id"()) AND ("deleted_at" IS NULL)));



CREATE POLICY "properties_select_public" ON "public"."properties" FOR SELECT USING ((("status" = 'active'::"public"."property_status") AND ("deleted_at" IS NULL)));



ALTER TABLE "public"."property_scores" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "public_can_insert_marketplace_inquiries" ON "public"."marketplace_inquiries" FOR INSERT TO "authenticated", "anon" WITH CHECK (true);



CREATE POLICY "public_read_active_portals" ON "public"."seller_portals" FOR SELECT USING ((("expires_at" > "now"()) AND ("status" = 'active'::"text")));



CREATE POLICY "public_read_agency_profiles" ON "public"."agency_profiles" FOR SELECT USING (true);



CREATE POLICY "public_read_agent_profiles" ON "public"."agent_profiles" FOR SELECT USING (true);



CREATE POLICY "public_read_approved_reviews" ON "public"."agent_reviews" FOR SELECT USING (("status" = 'approved'::"text"));



CREATE POLICY "public_read_translation_cache" ON "public"."translation_cache" FOR SELECT USING (true);



ALTER TABLE "public"."reminders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reminders_insert" ON "public"."reminders" FOR INSERT WITH CHECK (("agency_id" = "public"."get_user_agency_id"()));



CREATE POLICY "reminders_select" ON "public"."reminders" FOR SELECT USING (("agency_id" = "public"."get_user_agency_id"()));



CREATE POLICY "reminders_update" ON "public"."reminders" FOR UPDATE USING (("agency_id" = "public"."get_user_agency_id"()));



ALTER TABLE "public"."saved_searches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."seller_leads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "seller_leads_agents_all" ON "public"."seller_leads" TO "authenticated" USING ((("assigned_agency_id" = "public"."get_my_agency_id"()) OR ("assigned_agency_id" IS NULL))) WITH CHECK ((("assigned_agency_id" = "public"."get_my_agency_id"()) OR ("assigned_agency_id" IS NULL)));



CREATE POLICY "seller_leads_anon_insert" ON "public"."seller_leads" FOR INSERT TO "anon" WITH CHECK (true);



ALTER TABLE "public"."seller_portals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "super_admin_delete_notes" ON "public"."admin_notes" FOR DELETE USING ("public"."is_super_admin"());



CREATE POLICY "super_admin_insert_events" ON "public"."activity_events" FOR INSERT WITH CHECK ("public"."is_super_admin"());



CREATE POLICY "super_admin_insert_metrics" ON "public"."platform_metrics" FOR INSERT WITH CHECK ("public"."is_super_admin"());



CREATE POLICY "super_admin_insert_moderation" ON "public"."moderation_actions" FOR INSERT WITH CHECK ("public"."is_super_admin"());



CREATE POLICY "super_admin_insert_notes" ON "public"."admin_notes" FOR INSERT WITH CHECK ("public"."is_super_admin"());



CREATE POLICY "super_admin_read_ai_balance" ON "public"."ai_balance_snapshots" FOR SELECT USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = 'super_admin'::"text"));



CREATE POLICY "super_admin_read_ai_usage" ON "public"."ai_usage_logs" FOR SELECT USING ((( SELECT "profiles"."role"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())) = 'super_admin'::"text"));



CREATE POLICY "super_admin_read_all_agencies" ON "public"."agencies" FOR SELECT USING ("public"."is_super_admin"());



CREATE POLICY "super_admin_read_all_events" ON "public"."activity_events" FOR SELECT USING ("public"."is_super_admin"());



CREATE POLICY "super_admin_read_all_kyc" ON "public"."kyc_cases" FOR SELECT TO "authenticated" USING ("public"."is_super_admin"());



CREATE POLICY "super_admin_read_all_profiles" ON "public"."profiles" FOR SELECT USING ("public"."is_super_admin"());



CREATE POLICY "super_admin_read_all_properties" ON "public"."properties" FOR SELECT USING ("public"."is_super_admin"());



CREATE POLICY "super_admin_read_all_subscriptions" ON "public"."subscriptions" FOR SELECT USING ("public"."is_super_admin"());



CREATE POLICY "super_admin_read_all_transactions" ON "public"."transactions" FOR SELECT USING ("public"."is_super_admin"());



CREATE POLICY "super_admin_read_marketplace_inquiries" ON "public"."marketplace_inquiries" FOR SELECT TO "authenticated" USING ("public"."is_super_admin"());



CREATE POLICY "super_admin_read_metrics" ON "public"."platform_metrics" FOR SELECT USING ("public"."is_super_admin"());



CREATE POLICY "super_admin_read_moderation" ON "public"."moderation_actions" FOR SELECT USING ("public"."is_super_admin"());



CREATE POLICY "super_admin_read_notes" ON "public"."admin_notes" FOR SELECT USING ("public"."is_super_admin"());



CREATE POLICY "super_admin_update_agencies" ON "public"."agencies" FOR UPDATE USING ("public"."is_super_admin"());



CREATE POLICY "super_admin_update_kyc" ON "public"."kyc_cases" FOR UPDATE TO "authenticated" USING ("public"."is_super_admin"()) WITH CHECK ("public"."is_super_admin"());



CREATE POLICY "super_admin_update_marketplace_inquiries" ON "public"."marketplace_inquiries" FOR UPDATE TO "authenticated" USING ("public"."is_super_admin"());



CREATE POLICY "super_admin_update_notes" ON "public"."admin_notes" FOR UPDATE USING ("public"."is_super_admin"()) WITH CHECK ("public"."is_super_admin"());



CREATE POLICY "super_admin_update_profiles" ON "public"."profiles" FOR UPDATE USING ("public"."is_super_admin"());



CREATE POLICY "super_admin_update_properties" ON "public"."properties" FOR UPDATE USING ("public"."is_super_admin"());



ALTER TABLE "public"."support_tickets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "support_tickets_authenticated" ON "public"."support_tickets" TO "authenticated" USING (("public"."is_super_admin"() OR ("submitter_email" = "auth"."email"()) OR ("assigned_to" = "auth"."uid"()))) WITH CHECK (("public"."is_super_admin"() OR ("submitter_email" = "auth"."email"()) OR ("assigned_to" = "auth"."uid"())));



CREATE POLICY "ticket_canned_authenticated" ON "public"."ticket_canned_responses" TO "authenticated" USING ("public"."is_super_admin"()) WITH CHECK ("public"."is_super_admin"());



ALTER TABLE "public"."ticket_canned_responses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ticket_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ticket_events_authenticated" ON "public"."ticket_events" TO "authenticated" USING (("public"."is_super_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."support_tickets" "st"
  WHERE (("st"."id" = "ticket_events"."ticket_id") AND (("st"."submitter_email" = "auth"."email"()) OR ("st"."assigned_to" = "auth"."uid"()))))))) WITH CHECK (("public"."is_super_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."support_tickets" "st"
  WHERE (("st"."id" = "ticket_events"."ticket_id") AND (("st"."submitter_email" = "auth"."email"()) OR ("st"."assigned_to" = "auth"."uid"())))))));



ALTER TABLE "public"."ticket_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ticket_messages_authenticated" ON "public"."ticket_messages" TO "authenticated" USING (("public"."is_super_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."support_tickets" "st"
  WHERE (("st"."id" = "ticket_messages"."ticket_id") AND (("st"."submitter_email" = "auth"."email"()) OR ("st"."assigned_to" = "auth"."uid"()))))))) WITH CHECK (("public"."is_super_admin"() OR (EXISTS ( SELECT 1
   FROM "public"."support_tickets" "st"
  WHERE (("st"."id" = "ticket_messages"."ticket_id") AND (("st"."submitter_email" = "auth"."email"()) OR ("st"."assigned_to" = "auth"."uid"())))))));



ALTER TABLE "public"."transactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."translation_cache" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_devices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."visits" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "visits_insert" ON "public"."visits" FOR INSERT WITH CHECK (("agency_id" = "public"."get_user_agency_id"()));



CREATE POLICY "visits_select" ON "public"."visits" FOR SELECT USING (("agency_id" = "public"."get_user_agency_id"()));



CREATE POLICY "visits_update" ON "public"."visits" FOR UPDATE USING (("agency_id" = "public"."get_user_agency_id"()));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."ai_actions_queue_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."ai_actions_queue_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ai_actions_queue_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."audit_crm_offer_event"() TO "anon";
GRANT ALL ON FUNCTION "public"."audit_crm_offer_event"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."audit_crm_offer_event"() TO "service_role";



GRANT ALL ON FUNCTION "public"."audit_kyc_magic_link_transitions"() TO "anon";
GRANT ALL ON FUNCTION "public"."audit_kyc_magic_link_transitions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."audit_kyc_magic_link_transitions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_verify_kyc_dossier"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_verify_kyc_dossier"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_verify_kyc_dossier"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_sla"("p_priority" "text", "p_created_at" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_sla"("p_priority" "text", "p_created_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_sla"("p_priority" "text", "p_created_at" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."can_auto_send"("p_agent_id" "uuid", "p_action_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."can_auto_send"("p_agent_id" "uuid", "p_action_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_auto_send"("p_agent_id" "uuid", "p_action_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_orphan_property_drafts"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_orphan_property_drafts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_orphan_property_drafts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."compute_agent_preferences"("p_agent_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."compute_agent_preferences"("p_agent_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."compute_agent_preferences"("p_agent_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."count_market_by_canton"("p_context" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."count_market_by_canton"("p_context" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."count_market_by_canton"("p_context" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."count_market_by_type"("p_context" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."count_market_by_type"("p_context" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."count_market_by_type"("p_context" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_agency_and_join"("p_name" "text", "p_city" "text", "p_canton" "text", "p_solo" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."create_agency_and_join"("p_name" "text", "p_city" "text", "p_canton" "text", "p_solo" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_agency_and_join"("p_name" "text", "p_city" "text", "p_canton" "text", "p_solo" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_lead_with_optional_deal"("p_first_name" "text", "p_last_name" "text", "p_email" "text", "p_phone" "text", "p_type" "text", "p_source" "text", "p_score" "text", "p_tags" "text"[], "p_notes" "text", "p_budget_announced" numeric, "p_search_zones" "text"[], "p_import_raw_text" "text", "p_create_deal" boolean, "p_deal_stage" "text", "p_deal_notes" "text", "p_deal_role" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_lead_with_optional_deal"("p_first_name" "text", "p_last_name" "text", "p_email" "text", "p_phone" "text", "p_type" "text", "p_source" "text", "p_score" "text", "p_tags" "text"[], "p_notes" "text", "p_budget_announced" numeric, "p_search_zones" "text"[], "p_import_raw_text" "text", "p_create_deal" boolean, "p_deal_stage" "text", "p_deal_notes" "text", "p_deal_role" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_lead_with_optional_deal"("p_first_name" "text", "p_last_name" "text", "p_email" "text", "p_phone" "text", "p_type" "text", "p_source" "text", "p_score" "text", "p_tags" "text"[], "p_notes" "text", "p_budget_announced" numeric, "p_search_zones" "text"[], "p_import_raw_text" "text", "p_create_deal" boolean, "p_deal_stage" "text", "p_deal_notes" "text", "p_deal_role" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."crm_offer_chain"("p_deal_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."crm_offer_chain"("p_deal_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."crm_offer_chain"("p_deal_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."visits" TO "anon";
GRANT ALL ON TABLE "public"."visits" TO "authenticated";
GRANT ALL ON TABLE "public"."visits" TO "service_role";



GRANT ALL ON FUNCTION "public"."crm_visits_by_property"("p_property_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."crm_visits_by_property"("p_property_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."crm_visits_by_property"("p_property_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."daily_matching_scan"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."daily_matching_scan"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_activity_events_immutability"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_activity_events_immutability"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_activity_events_immutability"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_kyc_cases_retention"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_kyc_cases_retention"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_kyc_cases_retention"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_kyc_magic_links_retention"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_kyc_magic_links_retention"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_kyc_magic_links_retention"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_kyc_retention"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_kyc_retention"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_kyc_retention"() TO "service_role";



GRANT ALL ON FUNCTION "public"."estimate_property_price"("p_canton" "text", "p_city" "text", "p_type" "text", "p_surface" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."estimate_property_price"("p_canton" "text", "p_city" "text", "p_type" "text", "p_surface" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."estimate_property_price"("p_canton" "text", "p_city" "text", "p_type" "text", "p_surface" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."expire_crm_offers_now"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."expire_crm_offers_now"() TO "service_role";



GRANT ALL ON FUNCTION "public"."find_contact_duplicates"("p_email" "text", "p_phone" "text", "p_first_name" "text", "p_last_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."find_contact_duplicates"("p_email" "text", "p_phone" "text", "p_first_name" "text", "p_last_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_contact_duplicates"("p_email" "text", "p_phone" "text", "p_first_name" "text", "p_last_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_ticket_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_ticket_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_ticket_number"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_admin_compliance_stats"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_admin_compliance_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_admin_compliance_stats"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_admin_dashboard_stats"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_admin_dashboard_stats"() TO "service_role";
GRANT ALL ON FUNCTION "public"."get_admin_dashboard_stats"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_admin_moderation_stats"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_admin_moderation_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_admin_moderation_stats"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_admin_monitoring_health"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_admin_monitoring_health"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_admin_monitoring_health"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_admin_support_stats"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_admin_support_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_admin_support_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_app_config"("config_key" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_app_config"("config_key" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_app_config"("config_key" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_cities_by_canton"("p_canton" "text", "p_context" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_cities_by_canton"("p_canton" "text", "p_context" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_cities_by_canton"("p_canton" "text", "p_context" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_market_map_points"("p_context" "text", "p_types" "text"[], "p_canton" "text", "p_city" "text", "p_min_price" numeric, "p_max_price" numeric, "p_min_rooms" numeric, "p_min_surface" numeric, "p_features" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_market_map_points"("p_context" "text", "p_types" "text"[], "p_canton" "text", "p_city" "text", "p_min_price" numeric, "p_max_price" numeric, "p_min_rooms" numeric, "p_min_surface" numeric, "p_features" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_market_map_points"("p_context" "text", "p_types" "text"[], "p_canton" "text", "p_city" "text", "p_min_price" numeric, "p_max_price" numeric, "p_min_rooms" numeric, "p_min_surface" numeric, "p_features" "text"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_my_agency_id"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_my_agency_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_agency_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_popular_articles"("limit_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_popular_articles"("limit_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_popular_articles"("limit_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_price_hexagons"("p_min_lng" double precision, "p_min_lat" double precision, "p_max_lng" double precision, "p_max_lat" double precision, "p_hex_size_m" integer, "p_transaction_type" "text", "p_types" "text"[], "p_min_count" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_price_hexagons"("p_min_lng" double precision, "p_min_lat" double precision, "p_max_lng" double precision, "p_max_lat" double precision, "p_hex_size_m" integer, "p_transaction_type" "text", "p_types" "text"[], "p_min_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_price_hexagons"("p_min_lng" double precision, "p_min_lat" double precision, "p_max_lng" double precision, "p_max_lat" double precision, "p_hex_size_m" integer, "p_transaction_type" "text", "p_types" "text"[], "p_min_count" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_user_agency_id"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_user_agency_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_agency_id"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_user_role"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_user_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_role"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."hourly_automation_scan"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."hourly_automation_scan"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_super_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_super_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_super_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_within_sla_window"("p_agent_id" "uuid", "p_at" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."is_within_sla_window"("p_agent_id" "uuid", "p_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_within_sla_window"("p_agent_id" "uuid", "p_at" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."join_agency"("p_agency_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."join_agency"("p_agency_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."join_agency"("p_agency_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."kyc_by_contact_id"("p_contact_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."kyc_by_contact_id"("p_contact_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."kyc_by_contact_id"("p_contact_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."kyc_count_by_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."kyc_count_by_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."kyc_count_by_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."kyc_latest_screening_decision"("p_kyc_case_id" "uuid", "p_target" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."kyc_latest_screening_decision"("p_kyc_case_id" "uuid", "p_target" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."kyc_latest_screening_decision"("p_kyc_case_id" "uuid", "p_target" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."kyc_magic_link_summary"("p_kyc_case_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."kyc_magic_link_summary"("p_kyc_case_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."kyc_magic_link_summary"("p_kyc_case_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_kyc_screening_decision"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_kyc_screening_decision"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_kyc_screening_decision"() TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_stale_kyc_dossiers"() TO "anon";
GRANT ALL ON FUNCTION "public"."mark_stale_kyc_dossiers"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_stale_kyc_dossiers"() TO "service_role";



GRANT ALL ON FUNCTION "public"."monitor_transaction_kyc_gate"() TO "anon";
GRANT ALL ON FUNCTION "public"."monitor_transaction_kyc_gate"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."monitor_transaction_kyc_gate"() TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_phone"("p_phone" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_phone"("p_phone" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_phone"("p_phone" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."pg_database_size_mb"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."pg_database_size_mb"() TO "service_role";



GRANT ALL ON FUNCTION "public"."properties_audit_event"() TO "anon";
GRANT ALL ON FUNCTION "public"."properties_audit_event"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."properties_audit_event"() TO "service_role";



GRANT ALL ON FUNCTION "public"."purge_expired_import_raw_text"() TO "anon";
GRANT ALL ON FUNCTION "public"."purge_expired_import_raw_text"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."purge_expired_import_raw_text"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."run_search_alerts"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."run_search_alerts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."search_agencies"("q" "text", "lim" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_agencies"("q" "text", "lim" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_agencies"("q" "text", "lim" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."search_directory"("search_query" "text", "search_type" "text", "filter_canton" "text", "filter_city" "text", "filter_specialties" "text"[], "filter_languages" "text"[], "filter_verified" boolean, "sort_by" "text", "page_number" integer, "page_size" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_directory"("search_query" "text", "search_type" "text", "filter_canton" "text", "filter_city" "text", "filter_specialties" "text"[], "filter_languages" "text"[], "filter_verified" boolean, "sort_by" "text", "page_number" integer, "page_size" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_directory"("search_query" "text", "search_type" "text", "filter_canton" "text", "filter_city" "text", "filter_specialties" "text"[], "filter_languages" "text"[], "filter_verified" boolean, "sort_by" "text", "page_number" integer, "page_size" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."seed_kyc_lba_checks"() TO "anon";
GRANT ALL ON FUNCTION "public"."seed_kyc_lba_checks"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."seed_kyc_lba_checks"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_kyc_document_retention"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_kyc_document_retention"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_kyc_document_retention"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_ticket_sla"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_ticket_sla"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_ticket_sla"() TO "service_role";



GRANT ALL ON FUNCTION "public"."slugify"("input" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."slugify"("input" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."slugify"("input" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."storage_size_mb"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."storage_size_mb"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."trigger_matching_on_new_search"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."trigger_matching_on_new_search"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."trigger_matching_on_price_change"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."trigger_matching_on_price_change"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."trigger_matching_on_property_active"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."trigger_matching_on_property_active"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."trigger_matching_on_search_updated"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."trigger_matching_on_search_updated"() TO "service_role";



GRANT ALL ON FUNCTION "public"."unpublish_expired_mandates"() TO "anon";
GRANT ALL ON FUNCTION "public"."unpublish_expired_mandates"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."unpublish_expired_mandates"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_email_token_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_email_token_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_email_token_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_market_listings_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_market_listings_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_market_listings_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_marketplace_inquiries_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_marketplace_inquiries_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_marketplace_inquiries_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_thread_on_new_message"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_thread_on_new_message"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_ticket_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_ticket_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_ticket_timestamp"() TO "service_role";



GRANT ALL ON TABLE "public"."activity_events" TO "anon";
GRANT ALL ON TABLE "public"."activity_events" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_events" TO "service_role";



GRANT ALL ON TABLE "public"."admin_changelog" TO "anon";
GRANT ALL ON TABLE "public"."admin_changelog" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_changelog" TO "service_role";



GRANT ALL ON TABLE "public"."admin_feature_flags" TO "anon";
GRANT ALL ON TABLE "public"."admin_feature_flags" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_feature_flags" TO "service_role";



GRANT ALL ON TABLE "public"."admin_notes" TO "anon";
GRANT ALL ON TABLE "public"."admin_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_notes" TO "service_role";



GRANT ALL ON TABLE "public"."admin_nps_responses" TO "anon";
GRANT ALL ON TABLE "public"."admin_nps_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_nps_responses" TO "service_role";



GRANT ALL ON TABLE "public"."agencies" TO "anon";
GRANT ALL ON TABLE "public"."agencies" TO "authenticated";
GRANT ALL ON TABLE "public"."agencies" TO "service_role";



GRANT ALL ON TABLE "public"."agency_profiles" TO "anon";
GRANT ALL ON TABLE "public"."agency_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."agency_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."agent_profiles" TO "anon";
GRANT ALL ON TABLE "public"."agent_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."agent_reviews" TO "anon";
GRANT ALL ON TABLE "public"."agent_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."ai_actions_queue" TO "anon";
GRANT ALL ON TABLE "public"."ai_actions_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_actions_queue" TO "service_role";



GRANT ALL ON TABLE "public"."ai_balance_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."ai_balance_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_balance_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."ai_usage_logs" TO "anon";
GRANT ALL ON TABLE "public"."ai_usage_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_usage_logs" TO "service_role";



GRANT ALL ON TABLE "public"."app_config" TO "anon";
GRANT ALL ON TABLE "public"."app_config" TO "authenticated";
GRANT ALL ON TABLE "public"."app_config" TO "service_role";



GRANT ALL ON TABLE "public"."article_feedback" TO "anon";
GRANT ALL ON TABLE "public"."article_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."article_feedback" TO "service_role";



GRANT ALL ON TABLE "public"."article_views" TO "anon";
GRANT ALL ON TABLE "public"."article_views" TO "authenticated";
GRANT ALL ON TABLE "public"."article_views" TO "service_role";



GRANT ALL ON TABLE "public"."auth_events" TO "anon";
GRANT ALL ON TABLE "public"."auth_events" TO "authenticated";
GRANT ALL ON TABLE "public"."auth_events" TO "service_role";



GRANT ALL ON TABLE "public"."automation_rules" TO "anon";
GRANT ALL ON TABLE "public"."automation_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."automation_rules" TO "service_role";



GRANT ALL ON TABLE "public"."calendar_sync" TO "anon";
GRANT ALL ON TABLE "public"."calendar_sync" TO "authenticated";
GRANT ALL ON TABLE "public"."calendar_sync" TO "service_role";



GRANT ALL ON TABLE "public"."market_listings" TO "anon";
GRANT ALL ON TABLE "public"."market_listings" TO "authenticated";
GRANT ALL ON TABLE "public"."market_listings" TO "service_role";



GRANT ALL ON TABLE "public"."cantonal_price_medians" TO "anon";
GRANT ALL ON TABLE "public"."cantonal_price_medians" TO "authenticated";
GRANT ALL ON TABLE "public"."cantonal_price_medians" TO "service_role";



GRANT ALL ON TABLE "public"."chat_conversations" TO "anon";
GRANT ALL ON TABLE "public"."chat_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_conversations" TO "service_role";



GRANT ALL ON TABLE "public"."chat_messages" TO "anon";
GRANT ALL ON TABLE "public"."chat_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_messages" TO "service_role";



GRANT ALL ON TABLE "public"."client_searches" TO "anon";
GRANT ALL ON TABLE "public"."client_searches" TO "authenticated";
GRANT ALL ON TABLE "public"."client_searches" TO "service_role";



GRANT ALL ON TABLE "public"."coming_soon_subscribers" TO "anon";
GRANT ALL ON TABLE "public"."coming_soon_subscribers" TO "authenticated";
GRANT ALL ON TABLE "public"."coming_soon_subscribers" TO "service_role";



GRANT ALL ON TABLE "public"."contact_scores" TO "anon";
GRANT ALL ON TABLE "public"."contact_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_scores" TO "service_role";



GRANT ALL ON TABLE "public"."contacts" TO "anon";
GRANT ALL ON TABLE "public"."contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."contacts" TO "service_role";



GRANT ALL ON TABLE "public"."crm_offers" TO "anon";
GRANT ALL ON TABLE "public"."crm_offers" TO "authenticated";
GRANT ALL ON TABLE "public"."crm_offers" TO "service_role";



GRANT ALL ON TABLE "public"."daily_actions" TO "anon";
GRANT ALL ON TABLE "public"."daily_actions" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_actions" TO "service_role";



GRANT ALL ON TABLE "public"."documents" TO "anon";
GRANT ALL ON TABLE "public"."documents" TO "authenticated";
GRANT ALL ON TABLE "public"."documents" TO "service_role";



GRANT ALL ON TABLE "public"."email_messages_cache" TO "anon";
GRANT ALL ON TABLE "public"."email_messages_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."email_messages_cache" TO "service_role";



GRANT ALL ON TABLE "public"."external_listings" TO "anon";
GRANT ALL ON TABLE "public"."external_listings" TO "authenticated";
GRANT ALL ON TABLE "public"."external_listings" TO "service_role";



GRANT ALL ON TABLE "public"."favorites" TO "anon";
GRANT ALL ON TABLE "public"."favorites" TO "authenticated";
GRANT ALL ON TABLE "public"."favorites" TO "service_role";



GRANT ALL ON TABLE "public"."gmail_tokens" TO "anon";
GRANT ALL ON TABLE "public"."gmail_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."gmail_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."google_calendar_tokens" TO "anon";
GRANT ALL ON TABLE "public"."google_calendar_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."google_calendar_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."kyc_cases" TO "anon";
GRANT ALL ON TABLE "public"."kyc_cases" TO "authenticated";
GRANT ALL ON TABLE "public"."kyc_cases" TO "service_role";



GRANT ALL ON TABLE "public"."kyc_checklist_items" TO "anon";
GRANT ALL ON TABLE "public"."kyc_checklist_items" TO "authenticated";
GRANT ALL ON TABLE "public"."kyc_checklist_items" TO "service_role";



GRANT ALL ON TABLE "public"."kyc_magic_link_uploads" TO "anon";
GRANT ALL ON TABLE "public"."kyc_magic_link_uploads" TO "authenticated";
GRANT ALL ON TABLE "public"."kyc_magic_link_uploads" TO "service_role";



GRANT ALL ON TABLE "public"."kyc_magic_links" TO "anon";
GRANT ALL ON TABLE "public"."kyc_magic_links" TO "authenticated";
GRANT ALL ON TABLE "public"."kyc_magic_links" TO "service_role";



GRANT ALL ON TABLE "public"."kyc_screening_decisions" TO "anon";
GRANT ALL ON TABLE "public"."kyc_screening_decisions" TO "authenticated";
GRANT ALL ON TABLE "public"."kyc_screening_decisions" TO "service_role";



GRANT ALL ON TABLE "public"."listing_reports" TO "anon";
GRANT ALL ON TABLE "public"."listing_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."listing_reports" TO "service_role";



GRANT ALL ON TABLE "public"."listings" TO "anon";
GRANT ALL ON TABLE "public"."listings" TO "authenticated";
GRANT ALL ON TABLE "public"."listings" TO "service_role";



GRANT ALL ON TABLE "public"."market_changes" TO "anon";
GRANT ALL ON TABLE "public"."market_changes" TO "authenticated";
GRANT ALL ON TABLE "public"."market_changes" TO "service_role";



GRANT ALL ON TABLE "public"."market_favorites" TO "anon";
GRANT ALL ON TABLE "public"."market_favorites" TO "authenticated";
GRANT ALL ON TABLE "public"."market_favorites" TO "service_role";



GRANT ALL ON TABLE "public"."market_hidden" TO "anon";
GRANT ALL ON TABLE "public"."market_hidden" TO "authenticated";
GRANT ALL ON TABLE "public"."market_hidden" TO "service_role";



GRANT ALL ON TABLE "public"."market_price_history" TO "anon";
GRANT ALL ON TABLE "public"."market_price_history" TO "authenticated";
GRANT ALL ON TABLE "public"."market_price_history" TO "service_role";



GRANT ALL ON TABLE "public"."marketplace_inquiries" TO "anon";
GRANT ALL ON TABLE "public"."marketplace_inquiries" TO "authenticated";
GRANT ALL ON TABLE "public"."marketplace_inquiries" TO "service_role";



GRANT ALL ON TABLE "public"."matches" TO "anon";
GRANT ALL ON TABLE "public"."matches" TO "authenticated";
GRANT ALL ON TABLE "public"."matches" TO "service_role";



GRANT ALL ON TABLE "public"."message_templates" TO "anon";
GRANT ALL ON TABLE "public"."message_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."message_templates" TO "service_role";



GRANT ALL ON TABLE "public"."message_threads" TO "anon";
GRANT ALL ON TABLE "public"."message_threads" TO "authenticated";
GRANT ALL ON TABLE "public"."message_threads" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."moderation_actions" TO "anon";
GRANT ALL ON TABLE "public"."moderation_actions" TO "authenticated";
GRANT ALL ON TABLE "public"."moderation_actions" TO "service_role";



GRANT ALL ON TABLE "public"."offers" TO "anon";
GRANT ALL ON TABLE "public"."offers" TO "authenticated";
GRANT ALL ON TABLE "public"."offers" TO "service_role";



GRANT ALL ON TABLE "public"."onboarding_checklist" TO "anon";
GRANT ALL ON TABLE "public"."onboarding_checklist" TO "authenticated";
GRANT ALL ON TABLE "public"."onboarding_checklist" TO "service_role";



GRANT ALL ON TABLE "public"."outlook_calendar_sync" TO "anon";
GRANT ALL ON TABLE "public"."outlook_calendar_sync" TO "authenticated";
GRANT ALL ON TABLE "public"."outlook_calendar_sync" TO "service_role";



GRANT ALL ON TABLE "public"."outlook_calendar_tokens" TO "anon";
GRANT ALL ON TABLE "public"."outlook_calendar_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."outlook_calendar_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."outlook_mail_tokens" TO "anon";
GRANT ALL ON TABLE "public"."outlook_mail_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."outlook_mail_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."platform_metrics" TO "anon";
GRANT ALL ON TABLE "public"."platform_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_metrics" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."properties" TO "anon";
GRANT ALL ON TABLE "public"."properties" TO "authenticated";
GRANT ALL ON TABLE "public"."properties" TO "service_role";



GRANT ALL ON TABLE "public"."property_scores" TO "anon";
GRANT ALL ON TABLE "public"."property_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."property_scores" TO "service_role";



GRANT ALL ON TABLE "public"."reminders" TO "anon";
GRANT ALL ON TABLE "public"."reminders" TO "authenticated";
GRANT ALL ON TABLE "public"."reminders" TO "service_role";



GRANT ALL ON TABLE "public"."saved_searches" TO "anon";
GRANT ALL ON TABLE "public"."saved_searches" TO "authenticated";
GRANT ALL ON TABLE "public"."saved_searches" TO "service_role";



GRANT ALL ON TABLE "public"."seller_leads" TO "anon";
GRANT ALL ON TABLE "public"."seller_leads" TO "authenticated";
GRANT ALL ON TABLE "public"."seller_leads" TO "service_role";



GRANT ALL ON TABLE "public"."seller_portals" TO "anon";
GRANT ALL ON TABLE "public"."seller_portals" TO "authenticated";
GRANT ALL ON TABLE "public"."seller_portals" TO "service_role";



GRANT ALL ON TABLE "public"."subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."support_tickets" TO "anon";
GRANT ALL ON TABLE "public"."support_tickets" TO "authenticated";
GRANT ALL ON TABLE "public"."support_tickets" TO "service_role";



GRANT ALL ON TABLE "public"."ticket_canned_responses" TO "anon";
GRANT ALL ON TABLE "public"."ticket_canned_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."ticket_canned_responses" TO "service_role";



GRANT ALL ON TABLE "public"."ticket_events" TO "anon";
GRANT ALL ON TABLE "public"."ticket_events" TO "authenticated";
GRANT ALL ON TABLE "public"."ticket_events" TO "service_role";



GRANT ALL ON TABLE "public"."ticket_messages" TO "anon";
GRANT ALL ON TABLE "public"."ticket_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."ticket_messages" TO "service_role";



GRANT ALL ON SEQUENCE "public"."ticket_number_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."ticket_number_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."ticket_number_seq" TO "service_role";



GRANT ALL ON TABLE "public"."transactions" TO "anon";
GRANT ALL ON TABLE "public"."transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."transactions" TO "service_role";



GRANT ALL ON TABLE "public"."translation_cache" TO "anon";
GRANT ALL ON TABLE "public"."translation_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."translation_cache" TO "service_role";



GRANT ALL ON TABLE "public"."user_devices" TO "anon";
GRANT ALL ON TABLE "public"."user_devices" TO "authenticated";
GRANT ALL ON TABLE "public"."user_devices" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







