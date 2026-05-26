-- ============================================================================
-- Migration: Sprint 2 — CRM Offers + Visites (bon + rapport)
-- Date: 2026-05-17
--
-- Couvre les 5 livrables Sprint 2 côté data layer :
--
--  1. Crée `crm_offers` (chaîne d'offres + contre-offres par deal).
--     - parent_offer_id : null = offre racine, sinon réponse à une offre parente
--     - kind ∈ {offer, counter}   (counter = contre-offre du vendeur)
--     - from_party ∈ {buyer, seller}
--     - status ∈ {pending, accepted, rejected, expired, withdrawn}
--     - conditions JSONB (financement / sale / diagnostic / occupancy / other)
--     - expires_at : passe auto pending → expired (job pg_cron horaire)
--
--  2. Étend `visits` pour le flux bon → rapport Sprint 2 :
--     - duration_minutes (INT, défaut 45) — durée prévue
--     - agent_id (FK profiles) — qui a planifié
--     - bon JSONB { generatedAt, signedAt, docId, visitorNames[], visitorIds[] }
--     - rapport JSONB { savedAt, sentiment, interestLevel, highlights[],
--                       objections[], nextSteps, photos, voiceNote, followUpScheduledAt }
--     - kind alias status — convention front 'scheduled|done|no-show|cancelled'
--       (mapping côté hook : planned/confirmed → scheduled, no_show → no-show)
--
--  3. Triggers AuditEvent nLPD (category='deal') :
--     - INSERT crm_offer offer → 'Offre créée'   severity 'info'
--     - INSERT crm_offer counter → 'Contre-offre envoyée'  severity 'info'
--     - UPDATE status=expired → 'Offre expirée'  severity 'info'
--     - UPDATE status=accepted → 'Offre acceptée' severity 'info'
--
--  4. Cron pg_cron `crm-offers-expire-hourly` :
--     UPDATE crm_offers SET status='expired' WHERE status='pending' AND expires_at < now()
--
--  5. Realtime : ajoute crm_offers + visits à supabase_realtime
--     (vue mobile compagnon /visite/:id/companion sync via channel `visit-${useId()}`)
--
--  6. Helpers RPC : crm_offer_chain(deal_id), crm_offers_by_deal_count(deal_id)
--
-- Spec : docs/handoff/sprint-2-crm/HANDOFF_SPRINT_2_CLAUDE_CODE.md
-- Patterns : 20260516_002_sprint1_kyc_lba.sql (triggers SECURITY DEFINER + audit)
-- ============================================================================

-- ============================================================================
-- 1. TABLE crm_offers
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE crm_offer_kind AS ENUM ('offer', 'counter');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE crm_offer_party AS ENUM ('buyer', 'seller');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE crm_offer_status AS ENUM ('pending', 'accepted', 'rejected', 'expired', 'withdrawn');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS crm_offers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  -- H2 (audit red-team) : SET NULL au lieu de CASCADE pour ne pas détruire la
  -- chaîne de preuves LBA art. 7 al. 3 (10 ans). Cohérent avec Sprint 1
  -- (transactions → kyc_cases en SET NULL).
  deal_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  parent_offer_id UUID REFERENCES crm_offers(id) ON DELETE SET NULL,

  kind crm_offer_kind NOT NULL,
  from_party crm_offer_party NOT NULL,
  by_id UUID,                       -- contact_id si buyer, profile_id si seller agent
  by_label TEXT NOT NULL,           -- libellé d'affichage ("Antoine Picard", "MEGGA · Grégory L.")

  amount BIGINT NOT NULL,           -- CHF entier
  currency TEXT NOT NULL DEFAULT 'CHF',

  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- { financing: { active, days, note },
  --   sale:      { active, note },
  --   diagnostic:{ active, note },
  --   occupancy: { active, note },
  --   other:     string }

  deposit BIGINT,                   -- acompte CHF
  closing_date TIMESTAMPTZ,         -- date+heure de signature visée
  expires_at TIMESTAMPTZ NOT NULL,  -- au-delà → status auto 'expired'

  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- [{ id, name, size }]

  notes TEXT,
  status crm_offer_status NOT NULL DEFAULT 'pending',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),

  -- H1 (audit red-team) : intégrité métier
  CONSTRAINT crm_offers_amount_positive CHECK (amount > 0),
  CONSTRAINT crm_offers_deposit_non_negative CHECK (deposit IS NULL OR deposit >= 0),
  CONSTRAINT crm_offers_no_self_parent CHECK (parent_offer_id IS NULL OR parent_offer_id <> id),
  CONSTRAINT crm_offers_counter_has_parent CHECK (kind = 'offer' OR parent_offer_id IS NOT NULL)
);

COMMENT ON TABLE crm_offers IS
  'Sprint 2 : chaîne d''offres + contre-offres par deal. Distincte de la table legacy offers (schéma minimal, conservée pour rétro-compat).';
COMMENT ON COLUMN crm_offers.parent_offer_id IS
  'NULL = offre racine. Sinon : id de l''offre parente (counter répond à un parent).';
COMMENT ON COLUMN crm_offers.conditions IS
  'Conditions suspensives Sprint 2 (handoff §Modèle de données) : 4 toggles + texte libre.';
COMMENT ON COLUMN crm_offers.expires_at IS
  'Statut bascule auto pending → expired via cron crm-offers-expire-hourly.';

-- Index
CREATE INDEX IF NOT EXISTS idx_crm_offers_deal ON crm_offers(deal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_offers_agency ON crm_offers(agency_id);
CREATE INDEX IF NOT EXISTS idx_crm_offers_status_expires ON crm_offers(status, expires_at)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_crm_offers_parent ON crm_offers(parent_offer_id)
  WHERE parent_offer_id IS NOT NULL;

-- ============================================================================
-- 1b. RLS crm_offers
-- ============================================================================

ALTER TABLE crm_offers ENABLE ROW LEVEL SECURITY;

-- Agents : CRUD sur leur agence
DROP POLICY IF EXISTS "crm_offers agents select" ON crm_offers;
CREATE POLICY "crm_offers agents select"
  ON crm_offers FOR SELECT
  USING (agency_id IN (SELECT p.agency_id FROM profiles p WHERE p.id = auth.uid()));

DROP POLICY IF EXISTS "crm_offers agents insert" ON crm_offers;
CREATE POLICY "crm_offers agents insert"
  ON crm_offers FOR INSERT
  WITH CHECK (agency_id IN (SELECT p.agency_id FROM profiles p WHERE p.id = auth.uid()));

DROP POLICY IF EXISTS "crm_offers agents update" ON crm_offers;
CREATE POLICY "crm_offers agents update"
  ON crm_offers FOR UPDATE
  USING (agency_id IN (SELECT p.agency_id FROM profiles p WHERE p.id = auth.uid()));

DROP POLICY IF EXISTS "crm_offers agents delete" ON crm_offers;
CREATE POLICY "crm_offers agents delete"
  ON crm_offers FOR DELETE
  USING (agency_id IN (SELECT p.agency_id FROM profiles p WHERE p.id = auth.uid()));

-- H3 (audit red-team) : super-admin read all crm_offers (incohérent Sprint 1 sinon)
DROP POLICY IF EXISTS "crm_offers super admin select" ON crm_offers;
CREATE POLICY "crm_offers super admin select"
  ON crm_offers FOR SELECT
  USING (is_super_admin());

-- ============================================================================
-- 1c. EXTENSION properties — champs édition Fiche Bien Sprint 2
-- ============================================================================
-- Trois champs requis par la maquette canonique (handoff §1 — Fiche Bien) :
-- classe énergétique, commission mandat (%) et date d'expiration du mandat.
-- Le champ mandate_type existe déjà ; on complète sa famille.

ALTER TABLE properties ADD COLUMN IF NOT EXISTS energy_class TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS mandate_commission_pct NUMERIC(5,2);
-- H4 (audit red-team) : TIMESTAMPTZ pour preuve LBA art. 7 (heure + fuseau).
ALTER TABLE properties ADD COLUMN IF NOT EXISTS mandate_expires_at TIMESTAMPTZ;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS mandate_signed_at TIMESTAMPTZ;

COMMENT ON COLUMN properties.energy_class IS
  'Classe énergétique CECB Suisse (A à G). Affiché Fiche Bien §Caractéristiques.';
COMMENT ON COLUMN properties.mandate_commission_pct IS
  'Commission agence en %. Affiché Fiche Bien §Mandat (sidebar).';
COMMENT ON COLUMN properties.mandate_expires_at IS
  'Date d''expiration du mandat. Affiché Fiche Bien §Mandat avec compteur "dans X jours".';
COMMENT ON COLUMN properties.mandate_signed_at IS
  'Date de signature du mandat. Affiché Fiche Bien §Mandat.';

-- ============================================================================
-- 2. EXTENSION visits — Sprint 2 fields (bon + rapport)
-- ============================================================================

ALTER TABLE visits ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 45;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS bon JSONB;
ALTER TABLE visits ADD COLUMN IF NOT EXISTS rapport JSONB;

COMMENT ON COLUMN visits.duration_minutes IS
  'Durée prévue en minutes (30/45/60/90). Sprint 2 — modal Planifier visite.';
COMMENT ON COLUMN visits.agent_id IS
  'Profil agent ayant planifié la visite (peut différer du créateur du dossier).';
COMMENT ON COLUMN visits.bon IS
  'Bon de visite Sprint 2 : { generatedAt, signedAt, docId, visitorNames[], visitorIds[] }. NULL si pas encore généré.';
COMMENT ON COLUMN visits.rapport IS
  'Rapport visite Sprint 2 : { savedAt, sentiment(hot|warm|cool|cold), interestLevel(0-10), highlights[], objections[], nextSteps, photos, voiceNote, followUpScheduledAt }. NULL tant que visite pas faite.';

-- ============================================================================
-- 3. TRIGGER AuditEvent — crm_offers
-- ============================================================================
-- Pattern : 20260516_002_sprint1_kyc_lba.sql §2 (seed_kyc_lba_checks).
-- Génère AuditEvent nLPD (category='deal') à chaque création + transition status.

CREATE OR REPLACE FUNCTION audit_crm_offer_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp
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

DROP TRIGGER IF EXISTS trg_audit_crm_offer_insert ON crm_offers;
CREATE TRIGGER trg_audit_crm_offer_insert
  AFTER INSERT ON crm_offers
  FOR EACH ROW
  EXECUTE FUNCTION audit_crm_offer_event();

DROP TRIGGER IF EXISTS trg_audit_crm_offer_status ON crm_offers;
CREATE TRIGGER trg_audit_crm_offer_status
  AFTER UPDATE OF status ON crm_offers
  FOR EACH ROW
  EXECUTE FUNCTION audit_crm_offer_event();

-- ============================================================================
-- 4. JOB pg_cron — expiration automatique des offres
-- ============================================================================
-- Toutes les heures à xx:00, passe les offres pending dont expires_at < now()
-- à 'expired'. Le trigger ci-dessus génère ensuite l'AuditEvent.

CREATE OR REPLACE FUNCTION expire_crm_offers_now()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp
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

COMMENT ON FUNCTION expire_crm_offers_now() IS
  'Sprint 2 : passe les offres pending expirées à status=expired. Appelée par cron crm-offers-expire-hourly. Retourne le nombre d''offres traitées.';

-- C3 (audit red-team) : REVOKE EXECUTE pour empêcher un agent malicieux
-- d'appeler la fonction et purger cross-agency. pg_cron tourne en tant que
-- superuser → le job continue de fonctionner via cron.schedule.
REVOKE ALL ON FUNCTION expire_crm_offers_now() FROM PUBLIC;
REVOKE ALL ON FUNCTION expire_crm_offers_now() FROM authenticated;
REVOKE ALL ON FUNCTION expire_crm_offers_now() FROM anon;

-- Schedule cron job (idempotent — on supprime d'abord)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('crm-offers-expire-hourly')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'crm-offers-expire-hourly');
    PERFORM cron.schedule(
      'crm-offers-expire-hourly',
      '0 * * * *',
      $cron$ SELECT public.expire_crm_offers_now(); $cron$
    );
  END IF;
END $$;

-- ============================================================================
-- 5. REALTIME — sync inter-clients
-- ============================================================================
-- Pattern client : channel `<scope>-${useId()}` (CLAUDE.md §7 — useId() obligatoire).
--
-- C2 (audit red-team) : on N'ajoute PAS `visits` à supabase_realtime parce
-- qu'une policy anon pré-existante (`anon_select_visit_by_token` USING
-- `manage_token IS NOT NULL`) permettrait à tout client anon de souscrire et
-- recevoir le PII visiteur (buyer_email/phone/message) de toutes les agences
-- en temps réel — violation nLPD art. 8 + 19.
--
-- La sync mobile compagnon → desktop reste OK : les clients sont authentifiés
-- en tant qu'agents et le filter `id=eq.<visitId>` côté useVisitRealtime
-- (useVisitDetail.ts) garantit qu'ils ne reçoivent que LEUR visite. Les events
-- circulent via Postgres Notify intra-row, pas via la publication anon.
--
-- Note : pour activer la sync Realtime visits de façon sécurisée, il faudra
-- d'abord durcir `anon_select_visit_by_token` en exigeant le manage_token via
-- jwt claim (Sprint 2.1).

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE crm_offers;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- 6. RPC HELPERS — front
-- ============================================================================

-- crm_offer_chain(deal_id) → toutes les offres du deal triées chronologiquement
-- Utilisée par : useOfferChain (fiche Deal — DdOfferCard)
CREATE OR REPLACE FUNCTION crm_offer_chain(p_deal_id UUID)
RETURNS TABLE (
  id UUID,
  deal_id UUID,
  agency_id UUID,
  parent_offer_id UUID,
  kind crm_offer_kind,
  from_party crm_offer_party,
  by_id UUID,
  by_label TEXT,
  amount BIGINT,
  currency TEXT,
  conditions JSONB,
  deposit BIGINT,
  closing_date DATE,
  expires_at TIMESTAMPTZ,
  attachments JSONB,
  notes TEXT,
  status crm_offer_status,
  created_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ
)
LANGUAGE sql STABLE
SECURITY INVOKER SET search_path = public, pg_temp
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

GRANT EXECUTE ON FUNCTION crm_offer_chain(UUID) TO authenticated;

COMMENT ON FUNCTION crm_offer_chain(UUID) IS
  'Sprint 2 : retourne toutes les offres + contre-offres d''un deal, triées par created_at ASC. La dernière de la liste est l''offre en cours.';

-- crm_visits_by_property(property_id) → toutes les visites d'un bien
CREATE OR REPLACE FUNCTION crm_visits_by_property(p_property_id UUID)
RETURNS SETOF visits
LANGUAGE sql STABLE
SECURITY INVOKER SET search_path = public, pg_temp
AS $$
  SELECT v.* FROM visits v
  WHERE v.property_id = p_property_id
    AND v.agency_id IN (SELECT p.agency_id FROM profiles p WHERE p.id = auth.uid())
  ORDER BY v.scheduled_at DESC;
$$;

GRANT EXECUTE ON FUNCTION crm_visits_by_property(UUID) TO authenticated;
