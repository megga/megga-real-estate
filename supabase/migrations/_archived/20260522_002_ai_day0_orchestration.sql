-- Premier jour (Day 0) — Fondation de l'orchestrateur IA arrière-plan.
--
-- Cette migration pose la fondation pour que les moteurs existants
-- (score-engine, matching-engine, automation-engine, dashboard-ai-hint)
-- puissent lire le calibrage Premier jour (profiles.day0_payload) et
-- adapter leur comportement (zone, dispo, priorité, autonomy).
--
--   1. Table `ai_actions_queue`     — queue partagée des actions IA
--                                     (drafts en attente de validation,
--                                     briefings du matin, relances pending)
--   2. compute_agent_preferences()  — décompose day0_payload en valeurs
--                                     exploitables (SLA window, autonomy
--                                     gate, priorité weights). Source de
--                                     vérité unique pour tous les engines.
--   3. can_auto_send()              — helper pour automation-engine et
--                                     ai-copilot : « cette action peut-elle
--                                     partir sans validation humaine ? »
--   4. is_within_sla_window()       — helper pour pg_cron : « est-ce que
--                                     je peux solliciter l'agent maintenant
--                                     dans sa plage de disponibilité ? »
--
-- Voir docs/ai-modules.md §8.x pour le contrat fonctionnel des engines.
-- Voir handoff-premier-jour pour la sémantique du payload.

-- ═══════════════════════════════════════════════════════════════════
-- 1. Table ai_actions_queue
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ai_actions_queue (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  agency_id         UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,

  -- Entité ciblée (NULL pour les briefings du matin qui sont agent-level).
  entity_type       TEXT NOT NULL,
  entity_id         UUID,

  -- Taxonomie d'actions. Aligné avec automation-engine.reminderTypeToTrigger
  -- et étendu pour les nouvelles actions IA. La whitelist est volontairement
  -- ouverte (TEXT) pour faciliter l'ajout sans migration ; les engines
  -- valident sémantiquement.
  action_type       TEXT NOT NULL,

  -- Payload structuré : { channel, body, template, score, reason, ... }.
  -- Schéma libre selon action_type — les Edge Functions sérialisent un
  -- TypeScript discriminated union ici.
  payload           JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Cycle de vie d'une action :
  --   pending  → en attente de validation agent (autonomy='suggest') ou
  --              dans la fenêtre SLA (autonomy='notify'/'resume')
  --   sent     → action envoyée (email envoyé, SMS poussé, briefing affiché)
  --   dismissed → l'agent a explicitement rejeté
  --   cancelled → annulée par le système (lead supprimé, contact off, etc.)
  --   expired  → expires_at dépassé sans action
  status            TEXT NOT NULL DEFAULT 'pending',

  -- Snapshot du niveau d'autonomie agent au moment de la création.
  -- Permet aux engines en aval de savoir comment traiter cette action
  -- sans relire profiles.day0_payload (qui peut changer entretemps).
  autonomy_required TEXT NOT NULL DEFAULT 'suggest',

  -- Timing : quand l'action doit être proposée/envoyée
  scheduled_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Optionnel : si pas validée avant cette date, elle expire (cron daily)
  expires_at        TIMESTAMPTZ,

  -- Trace de validation humaine (utilisé pour autonomy='suggest')
  validated_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  sent_at           TIMESTAMPTZ,
  dismissed_at      TIMESTAMPTZ,

  -- Lien optionnel vers l'AuditEvent qui a déclenché cette action
  -- (ex: visit_completed → post_visit_feedback)
  source_event_id   UUID,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT ai_actions_status_check CHECK (
    status IN ('pending', 'sent', 'dismissed', 'cancelled', 'expired')
  ),
  CONSTRAINT ai_actions_autonomy_check CHECK (
    autonomy_required IN ('suggest', 'notify', 'resume')
  ),
  CONSTRAINT ai_actions_entity_type_check CHECK (
    entity_type IN ('contact', 'deal', 'visit', 'briefing', 'property', 'kyc')
  )
);

-- ─── Indexes ────────────────────────────────────────────────────────

-- Vue principale agent : "mes actions à valider, du plus urgent au moins"
CREATE INDEX IF NOT EXISTS idx_ai_actions_agent_status_sched
  ON ai_actions_queue (agent_id, status, scheduled_at DESC);

-- Vue agence (audit + super-admin monitoring)
CREATE INDEX IF NOT EXISTS idx_ai_actions_agency_created
  ON ai_actions_queue (agency_id, created_at DESC);

-- Lookup par entité : "toutes les actions proposées pour ce contact"
CREATE INDEX IF NOT EXISTS idx_ai_actions_entity
  ON ai_actions_queue (entity_type, entity_id)
  WHERE entity_id IS NOT NULL;

-- Hot queue pour pg_cron : "actions prêtes à partir maintenant"
CREATE INDEX IF NOT EXISTS idx_ai_actions_ready_queue
  ON ai_actions_queue (scheduled_at)
  WHERE status = 'pending';

-- ─── RLS ────────────────────────────────────────────────────────────
-- Lecture : l'agent voit ses propres actions ; les autres membres de
-- l'agence voient les actions des collègues (transparence intra-agence
-- attendue côté Sugar Pure). Super-admin voit tout.
-- Écriture : INSERT/UPDATE par service_role uniquement (les Edge Functions
-- créent ; le frontend valide via une RPC dédiée plus tard).

ALTER TABLE ai_actions_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_actions_select_own_agency ON ai_actions_queue;
CREATE POLICY ai_actions_select_own_agency ON ai_actions_queue
  FOR SELECT
  USING (
    -- L'agent voit ses actions
    agent_id = auth.uid()
    -- Ou un membre de la même agence (transparence intra-agence)
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.agency_id = ai_actions_queue.agency_id
    )
  );

DROP POLICY IF EXISTS ai_actions_update_own ON ai_actions_queue;
CREATE POLICY ai_actions_update_own ON ai_actions_queue
  FOR UPDATE
  USING (agent_id = auth.uid())
  WITH CHECK (agent_id = auth.uid());

-- INSERT : interdit aux utilisateurs end-user. Seul service_role (Edge
-- Functions, pg_cron) peut créer. Pas de policy = REJECTED par défaut
-- avec RLS activé → on autorise explicitement aux super-admins pour le
-- debug manuel via dashboard Studio.

DROP POLICY IF EXISTS ai_actions_insert_super_admin ON ai_actions_queue;
CREATE POLICY ai_actions_insert_super_admin ON ai_actions_queue
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

COMMENT ON TABLE ai_actions_queue IS
  'Queue partagée des actions IA proposées par les moteurs (relances, briefings, drafts). Source de vérité pour le pop-up "brouillons en attente de validation" promis dans la synthèse Premier jour.';
COMMENT ON COLUMN ai_actions_queue.autonomy_required IS
  'Snapshot du niveau autonomy agent au moment de la création. Permet aux engines en aval de décider sans relire profiles.day0_payload.';
COMMENT ON COLUMN ai_actions_queue.scheduled_at IS
  'Quand l''action doit être affichée/envoyée. Un cron lit cette colonne pour faire avancer les actions ready.';

-- ═══════════════════════════════════════════════════════════════════
-- 2. compute_agent_preferences(agent_id) — décompose day0_payload
-- ═══════════════════════════════════════════════════════════════════
-- Retourne un JSON avec toutes les valeurs dérivées du calibrage Premier
-- jour. Une seule source de vérité, lue par tous les engines IA pour
-- éviter de dupliquer la logique « dispo → SLA window » ou
-- « autonomy → quelles actions sont auto-envoyables ».

CREATE OR REPLACE FUNCTION public.compute_agent_preferences(p_agent_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
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

GRANT EXECUTE ON FUNCTION public.compute_agent_preferences(UUID) TO authenticated;

COMMENT ON FUNCTION public.compute_agent_preferences(UUID) IS
  'Décompose profiles.day0_payload en JSONB exploitable par les moteurs IA (SLA, autonomy gate, priorité weights). Retourne NULL si pré-Day0. Source de vérité unique — modifier ici si la sémantique du calibrage change.';

-- ═══════════════════════════════════════════════════════════════════
-- 3. can_auto_send(agent_id, action_type) — helper pour automation-engine
-- ═══════════════════════════════════════════════════════════════════
-- Question simple à appeler avant chaque envoi automatique :
-- « cette action peut-elle partir sans clic agent ? »
-- Retourne FALSE par défaut (fail-safe : human-in-the-loop si on ne sait pas).

CREATE OR REPLACE FUNCTION public.can_auto_send(
  p_agent_id    UUID,
  p_action_type TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
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

GRANT EXECUTE ON FUNCTION public.can_auto_send(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.can_auto_send(UUID, TEXT) IS
  'Helper pour automation-engine + ai-copilot. FALSE = mettre en draft dans ai_actions_queue. TRUE = envoyer puis logger en sent.';

-- ═══════════════════════════════════════════════════════════════════
-- 4. is_within_sla_window(agent_id, at) — helper pour pg_cron
-- ═══════════════════════════════════════════════════════════════════
-- Avant qu'un cron envoie une notification ou une relance, il vérifie
-- que l'agent est dans sa plage de disponibilité (heures locales CH).
-- Évite d'envoyer un SMS de courtoisie à 23h à un agent "office".

CREATE OR REPLACE FUNCTION public.is_within_sla_window(
  p_agent_id UUID,
  p_at       TIMESTAMPTZ DEFAULT now()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
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

GRANT EXECUTE ON FUNCTION public.is_within_sla_window(UUID, TIMESTAMPTZ) TO authenticated;

COMMENT ON FUNCTION public.is_within_sla_window(UUID, TIMESTAMPTZ) IS
  'Helper pg_cron. TRUE si l''agent est dans sa fenêtre de disponibilité (jour + heure CH). Évite d''envoyer une notif à 3h du matin à un agent "office".';

-- ═══════════════════════════════════════════════════════════════════
-- 5. Trigger updated_at sur ai_actions_queue
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION ai_actions_queue_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ai_actions_updated_at ON ai_actions_queue;
CREATE TRIGGER trg_ai_actions_updated_at
  BEFORE UPDATE ON ai_actions_queue
  FOR EACH ROW
  EXECUTE FUNCTION ai_actions_queue_set_updated_at();
