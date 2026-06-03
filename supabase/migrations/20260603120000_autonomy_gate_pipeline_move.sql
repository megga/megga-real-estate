-- Ajoute la clé 'pipeline_move' à l'autonomy_gate de compute_agent_preferences (source de
-- vérité unique du calibrage). suggest=false, notify=false, resume=true. Sans cette clé,
-- can_auto_send(_, 'pipeline_move') renvoie false pour tout agent → le câblage L3 (Palier 3)
-- serait code mort. Reproduit le corps EXACT du baseline + la seule clé ajoutée. Idempotent
-- (CREATE OR REPLACE).

CREATE OR REPLACE FUNCTION public.compute_agent_preferences(p_agent_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
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
  SELECT day0_payload INTO v_payload FROM profiles WHERE id = p_agent_id;
  IF v_payload IS NULL THEN
    -- Pré-Day0 : retourne NULL pour que les engines en aval skip-ent.
    -- Aucune action IA ne doit partir tant que l'agent n'a pas calibré.
    RETURN NULL;  -- pré-Day0 : aucune action IA auto tant que l'agent n'a pas calibré
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
    WHEN 'office' THEN jsonb_build_object('hours_start',9,'hours_end',18,'days_of_week',jsonb_build_array(1,2,3,4,5),'response_target_hours',4)
    WHEN 'wide'   THEN jsonb_build_object('hours_start',8,'hours_end',20,'days_of_week',jsonb_build_array(1,2,3,4,5,6),'response_target_hours',8)
    WHEN '247'    THEN jsonb_build_object('hours_start',0,'hours_end',24,'days_of_week',jsonb_build_array(1,2,3,4,5,6,7),'response_target_hours',NULL)  -- libre, pas de SLA
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
  --
  -- autonomy_gate : + clé 'pipeline_move' (déplacement pipeline = réversible + audité, donc
  -- seul outil 'confirm' élevable ; jamais d'envoi client/offre/KYC ici — socle légal immuable).
  v_autonomy_gate := CASE v_autonomy
    WHEN 'suggest' THEN jsonb_build_object(
      'relance_simple',false,'sms_courtoisie',false,'accuse_reception',false,
      'email_followup',false,'briefing_today',false,'proposal_send',false,
      'pipeline_move',  false
    )
    WHEN 'notify' THEN jsonb_build_object(
      'relance_simple',true,'sms_courtoisie',true,'accuse_reception',true,
      'email_followup',false,'briefing_today',true,'proposal_send',false,
      'pipeline_move',  false
    )
    WHEN 'resume' THEN jsonb_build_object(
      'relance_simple',true,'sms_courtoisie',true,'accuse_reception',true,
      'email_followup',true,'briefing_today',true,
      -- 'proposal_send' reste toujours false : envoyer une proposition
      -- commerciale au nom de l'agent doit TOUJOURS être validé. Human-
      -- in-the-loop non négociable côté compliance.
      'proposal_send',  false,  -- proposition commerciale = TOUJOURS validée (immuable)
      'pipeline_move',  true     -- déplacement pipeline = auto en resume (réversible, audité)
    )
    ELSE jsonb_build_object()  -- autonomy inconnue → tout interdit
  END;

  -- ─── Pondérations par priorité 30j ─────────────────────────────
  -- Voir handoff §"Phase today" : la priorité Q4 pilote les 3 cartes
  -- proposées le matin. Ici on l'exprime en poids relatifs pour que
  -- le morning briefing (et le scoring) sache où mettre l'emphase.
  v_weights := CASE v_priorite
    WHEN 'acquisition'  THEN jsonb_build_object('new_lead',1.0,'dormant',0.3,'deal_active',0.5,'sourcing',0.9)  -- sourcing = prospect matching
    WHEN 'closing'      THEN jsonb_build_object('new_lead',0.4,'dormant',0.5,'deal_active',1.0,'sourcing',0.4)
    WHEN 'fidelisation' THEN jsonb_build_object('new_lead',0.5,'dormant',1.0,'deal_active',0.6,'sourcing',0.3)  -- dormant : "+60j silencieux"
    ELSE jsonb_build_object('new_lead',0.5,'dormant',0.5,'deal_active',0.5,'sourcing',0.5)
  END;

  RETURN jsonb_build_object(
    'agent_id',p_agent_id,'specialite',v_specialite,'zone_ids',v_zone,'dispo',v_dispo,
    'priorite',v_priorite,'autonomy',v_autonomy,'sla',v_sla,'autonomy_gate',v_autonomy_gate,
    'priorite_weights',v_weights,'has_calibrated',true
  );
END;
$$;

COMMENT ON FUNCTION public.compute_agent_preferences(p_agent_id uuid) IS 'Décompose profiles.day0_payload en JSONB exploitable par les moteurs IA (SLA, autonomy gate, priorité weights). Retourne NULL si pré-Day0. Source de vérité unique — modifier ici si la sémantique du calibrage change. L''autonomy_gate inclut désormais pipeline_move (déplacement pipeline = auto en resume, réversible + audité ; jamais d''envoi client/offre/KYC).';
