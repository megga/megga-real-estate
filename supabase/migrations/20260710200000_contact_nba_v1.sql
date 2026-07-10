-- Contact NBA v1 — « prochaine meilleure action » déterministe par contact,
-- cerveau partagé agent WhatsApp ⇄ copilote CRM.
-- Spec : docs/superpowers/plans/2026-07-10-contact-nba-v1.md (v1.1 post-revue adverse).
--
-- Contenu (idempotent, re-run sûr) :
--   1. touch_transactions_updated_at — pré-requis R4 : AUCUN chemin ne rafraîchit
--      transactions.updated_at aujourd'hui (pas de trigger ; wa_move_transaction_stage
--      ne SET que stage ; le front n'envoie que {stage, notes}) → sans ce trigger,
--      le proxy « deal qui stagne » serait cassé dans le sens MASQUANT.
--   2. contact_next_action(p_contact, p_agency) — fonction CŒUR, service_role only
--      (le paramètre EST le scope, patron calculate_contact_scores). Règles en
--      priorité ABSOLUE : rappel > offre expirante > visite (jour puis débrief) >
--      deal stagnant > matches à envoyer > relance dormance > aucune.
--      + kyc_note transverse : information FACULTATIVE, JAMAIS l'action (doctrine
--      KYC non-bloquant).
--   3. get_contact_next_action(p_contact) — wrapper JWT (agence dérivée de
--      get_user_agency_id(), zéro paramètre forgeable, patron focus_top_matches).
--      Deux portes, UNE logique (blocker B1).
--   4. app_config.contact_nba_v1 — tunables (COALESCE littéral : un JSON cassé ne
--      casse rien). match_gate ABSENT volontairement : R5 le lit en fallback depuis
--      today_focus_v1.thresholds.match_gate (une notion, un tunable).
--
-- ⚠ DATE-GUARD DEPLOY : la partie date de CE fichier doit être la date UTC du jour
-- du MERGE (deploy.yml n'applique que stamp_date >= TODAY). Re-stamper si la PR glisse.

-- ── 1. Trigger touch updated_at (pré-requis R4) ──────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_transactions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_transactions_updated_at ON public.transactions;
CREATE TRIGGER trg_touch_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.touch_transactions_updated_at();

-- ── 2. Fonction cœur ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.contact_next_action(p_contact uuid, p_agency uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
SET statement_timeout = '8s'
AS $$
DECLARE
  cfg jsonb := '{}'::jsonb;
  focus_cfg jsonb := '{}'::jsonb;
  v_dormant_days int;
  v_offer_window_days int;
  v_deal_stall_days int;
  v_debrief_days int;
  v_match_gate numeric;
  v_now timestamptz := now();
  v_sod timestamptz;   -- début de journée Europe/Zurich
  v_eod timestamptz;   -- fin de journée Europe/Zurich
  c RECORD;
  r RECORD;
  o RECORD;
  vi RECORD;
  tx RECORD;
  ky RECORD;
  m_count int;
  m_best numeric;
  v_kyc jsonb := NULL;
  v_action jsonb := NULL;
BEGIN
  IF p_contact IS NULL OR p_agency IS NULL THEN RETURN NULL; END IF;

  -- Tunables (un value non-JSON ne casse rien : exception → défauts littéraux)
  BEGIN
    SELECT value::jsonb INTO cfg FROM public.app_config WHERE key = 'contact_nba_v1';
  EXCEPTION WHEN others THEN cfg := '{}'::jsonb;
  END;
  BEGIN
    SELECT value::jsonb INTO focus_cfg FROM public.app_config WHERE key = 'today_focus_v1';
  EXCEPTION WHEN others THEN focus_cfg := '{}'::jsonb;
  END;
  cfg := COALESCE(cfg, '{}'::jsonb);
  focus_cfg := COALESCE(focus_cfg, '{}'::jsonb);

  v_dormant_days      := COALESCE((cfg->>'dormant_days')::int, 14);
  v_offer_window_days := COALESCE((cfg->>'offer_window_days')::int, 7);
  v_deal_stall_days   := COALESCE((cfg->>'deal_stall_days')::int, 14);
  v_debrief_days      := COALESCE((cfg->>'visit_debrief_window_days')::int, 21);
  -- match_gate : fallback sur le gate du radar Focus (une seule notion partagée)
  v_match_gate        := COALESCE((cfg->>'match_gate')::numeric,
                                  (focus_cfg->'thresholds'->>'match_gate')::numeric,
                                  70);

  -- Bornes de journée Europe/Zurich
  v_sod := date_trunc('day', v_now AT TIME ZONE 'Europe/Zurich') AT TIME ZONE 'Europe/Zurich';
  v_eod := v_sod + interval '1 day' - interval '1 second';

  -- Garde d'entrée : contact de CETTE agence, sinon NULL (pas de fuite d'existence)
  SELECT c2.id, c2.type, c2.last_interaction_at INTO c
  FROM public.contacts c2
  WHERE c2.id = p_contact AND c2.agency_id = p_agency;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- Note KYC transverse (JAMAIS une action) : dossier ouvert non terminal sur un
  -- deal closing-proximate. Information facultative.
  SELECT k2.status::text AS status, k2.completion_pct INTO ky
  FROM public.kyc_cases k2
  WHERE k2.contact_id = p_contact AND k2.agency_id = p_agency
    AND k2.status NOT IN ('validated', 'rejected')
    AND EXISTS (
      SELECT 1 FROM public.transactions t2
      WHERE t2.agency_id = p_agency
        AND (t2.contact_buyer_id = p_contact OR t2.contact_seller_id = p_contact)
        AND t2.status = 'active'
        AND t2.stage IN ('interest_confirmed','offer','negotiation','reserved','financing','notary','signed')
    )
  ORDER BY k2.created_at DESC
  LIMIT 1;
  IF FOUND THEN
    v_kyc := jsonb_build_object('status', ky.status, 'completion_pct', ky.completion_pct);
  END IF;

  -- R1 — Rappel échu ou du jour
  SELECT r2.id, r2.type, r2.trigger_at INTO r
  FROM public.reminders r2
  WHERE r2.contact_id = p_contact AND r2.agency_id = p_agency
    AND r2.status IN ('pending', 'triggered')
    AND r2.completed_at IS NULL
    AND r2.trigger_at <= v_eod
  ORDER BY r2.trigger_at ASC
  LIMIT 1;
  IF FOUND THEN
    v_action := jsonb_build_object(
      'action', 'rappel',
      'reason_key', CASE WHEN r.trigger_at < v_sod THEN 'reminder_overdue' ELSE 'reminder_today' END,
      'params', jsonb_build_object(
        'reminder_type', r.type,
        'days_overdue', GREATEST(0, floor(extract(epoch FROM (v_now - r.trigger_at)) / 86400))::int,
        'reminder_id', r.id),
      'due_at', to_jsonb(r.trigger_at));
  END IF;

  -- R2 — Offre en attente proche d'échéance (lien contact via transaction_id)
  IF v_action IS NULL THEN
    SELECT o2.id, o2.amount, o2.expires_at INTO o
    FROM public.crm_offers o2
    JOIN public.transactions t2 ON t2.id = o2.transaction_id AND t2.agency_id = p_agency
    WHERE o2.agency_id = p_agency AND o2.status = 'pending'
      AND (t2.contact_buyer_id = p_contact OR t2.contact_seller_id = p_contact)
      AND o2.expires_at IS NOT NULL   -- défensif (NOT NULL au schéma live)
      AND o2.expires_at <= v_now + make_interval(days => v_offer_window_days)
    ORDER BY o2.expires_at ASC
    LIMIT 1;
    IF FOUND THEN
      v_action := jsonb_build_object(
        'action', 'offre_expirante',
        'reason_key', 'offer_expiring',
        'params', jsonb_build_object(
          'amount', o.amount,
          'days_left', floor(extract(epoch FROM (o.expires_at - v_now)) / 86400)::int,
          'offer_id', o.id),
        'due_at', to_jsonb(o.expires_at));
    END IF;
  END IF;

  -- R3a — Visite à venir AUJOURD'HUI (Europe/Zurich)
  IF v_action IS NULL THEN
    SELECT v2.id, v2.scheduled_at INTO vi
    FROM public.visits v2
    WHERE v2.contact_id = p_contact AND v2.agency_id = p_agency
      AND v2.status IN ('planned', 'confirmed')
      AND v2.scheduled_at >= v_now
      AND (v2.scheduled_at AT TIME ZONE 'Europe/Zurich')::date = (v_now AT TIME ZONE 'Europe/Zurich')::date
    ORDER BY v2.scheduled_at ASC
    LIMIT 1;
    IF FOUND THEN
      v_action := jsonb_build_object(
        'action', 'visite_preparer', 'reason_key', 'visit_today',
        'params', jsonb_build_object('visit_id', vi.id, 'scheduled_at', vi.scheduled_at),
        'due_at', to_jsonb(vi.scheduled_at));
    END IF;
  END IF;

  -- R3b — Visite passée non clôturée (fenêtre bornée — pas de débrief antique)
  IF v_action IS NULL THEN
    SELECT v2.id, v2.scheduled_at INTO vi
    FROM public.visits v2
    WHERE v2.contact_id = p_contact AND v2.agency_id = p_agency
      AND ((v2.status IN ('planned', 'confirmed') AND v2.scheduled_at < v_now)
        OR (v2.status = 'done' AND v2.rapport IS NULL
            AND (v2.feedback_agent IS NULL OR btrim(v2.feedback_agent) = '')))
      AND v2.scheduled_at >= v_now - make_interval(days => v_debrief_days)
    ORDER BY v2.scheduled_at DESC
    LIMIT 1;
    IF FOUND THEN
      v_action := jsonb_build_object(
        'action', 'visite_debrief', 'reason_key', 'visit_debrief',
        'params', jsonb_build_object('visit_id', vi.id, 'scheduled_at', vi.scheduled_at),
        'due_at', to_jsonb(vi.scheduled_at));
    END IF;
  END IF;

  -- R4 — Deal actif qui stagne (proxy updated_at, rendu VIVANT par le trigger §1)
  IF v_action IS NULL THEN
    SELECT t2.id, t2.stage::text AS stage, t2.updated_at INTO tx
    FROM public.transactions t2
    WHERE t2.agency_id = p_agency
      AND (t2.contact_buyer_id = p_contact OR t2.contact_seller_id = p_contact)
      AND t2.status = 'active'
      AND t2.stage NOT IN ('signed', 'closed', 'lost', 'to_recontact')
      AND t2.updated_at < v_now - make_interval(days => v_deal_stall_days)
    ORDER BY t2.updated_at ASC
    LIMIT 1;
    IF FOUND THEN
      v_action := jsonb_build_object(
        'action', 'deal_stagnant', 'reason_key', 'deal_stalled',
        'params', jsonb_build_object(
          'stage', tx.stage,
          'days_stalled', floor(extract(epoch FROM (v_now - tx.updated_at)) / 86400)::int,
          'transaction_id', tx.id),
        'due_at', NULL);
    END IF;
  END IF;

  -- R5 — Matches à envoyer (index partiel idx_matches_agency_focus)
  IF v_action IS NULL THEN
    SELECT count(*)::int, max(m2.score) INTO m_count, m_best
    FROM public.matches m2
    WHERE m2.contact_id = p_contact AND m2.agency_id = p_agency
      AND m2.status = 'suggested' AND m2.response_at IS NULL
      AND (m2.snoozed_until IS NULL OR m2.snoozed_until <= v_now)
      AND m2.score >= v_match_gate;
    IF m_count > 0 THEN
      v_action := jsonb_build_object(
        'action', 'match_a_envoyer', 'reason_key', 'matches_to_send',
        'params', jsonb_build_object('count', m_count, 'best_score', m_best, 'gate', v_match_gate),
        'due_at', NULL);
    END IF;
  END IF;

  -- R6 — Relance dormance (whitelist = les 7 types de contacts_type_check)
  IF v_action IS NULL
     AND c.type IN ('buyer', 'seller', 'tenant', 'landlord', 'investor', 'both', 'lead') THEN
    IF c.last_interaction_at IS NULL THEN
      v_action := jsonb_build_object(
        'action', 'relance', 'reason_key', 'never_contacted',
        'params', jsonb_build_object('never', true),
        'due_at', NULL);
    ELSIF c.last_interaction_at < v_now - make_interval(days => v_dormant_days) THEN
      v_action := jsonb_build_object(
        'action', 'relance', 'reason_key', 'dormant',
        'params', jsonb_build_object(
          'days_dormant', floor(extract(epoch FROM (v_now - c.last_interaction_at)) / 86400)::int),
        'due_at', NULL);
    END IF;
  END IF;

  -- R7 — Rien (zéro honnête)
  IF v_action IS NULL THEN
    v_action := jsonb_build_object(
      'action', 'aucune', 'reason_key', 'none',
      'params', '{}'::jsonb, 'due_at', NULL);
  END IF;

  RETURN v_action || jsonb_build_object(
    'version', 1,
    'kyc_note', COALESCE(v_kyc, 'null'::jsonb),
    'computed_at', v_now);
END;
$$;

REVOKE ALL ON FUNCTION public.contact_next_action(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.contact_next_action(uuid, uuid) TO service_role;

-- ── 3. Wrapper JWT ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_contact_next_action(p_contact uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_agency uuid;
BEGIN
  v_agency := public.get_user_agency_id();
  IF v_agency IS NULL THEN RETURN NULL; END IF;
  RETURN public.contact_next_action(p_contact, v_agency);
END;
$$;

REVOKE ALL ON FUNCTION public.get_contact_next_action(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_contact_next_action(uuid) TO authenticated, service_role;

-- ── 4. Tunables ──────────────────────────────────────────────────────────────
INSERT INTO public.app_config (key, value)
VALUES ('contact_nba_v1',
        '{"dormant_days":14,"offer_window_days":7,"deal_stall_days":14,"visit_debrief_window_days":21,"version":1}')
ON CONFLICT (key) DO NOTHING;
