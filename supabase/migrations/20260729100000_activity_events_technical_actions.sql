-- `activity_events.action` redevient une clé TECHNIQUE.
--
-- La colonne servait deux usages à la fois : identifiant filtrable, et texte
-- affiché tel quel dans la timeline contact et le journal d'audit. La plupart
-- des producteurs y écrivent du snake_case ; quelques-uns y écrivaient du
-- français (« Offre créée », « Dossier KYC ouvert »…). L'agent voyait donc un
-- mélange, et tout filtrage par action laissait passer les seconds — le jour où
-- une de ces actions devra être surveillée, elle sera introuvable.
--
-- Le libellé lisible passe côté interface (clés `audit.action.*`, i18n dans les
-- quatre langues), avec repli sur la valeur brute pour une action inconnue.
--
-- ⚠ Le point le plus dangereux de ce changement : `trg_contact_last_interaction`
-- se déclenche sur une LISTE D'ACTIONS qui contient « Note ajoutée ». Renommer
-- le producteur sans toucher au trigger aurait donc arrêté la mise à jour de
-- `contacts.last_interaction_at`, sans le moindre message d'erreur. Les couplages
-- de ce type ont été cherchés en base (fonctions, triggers, policies) : trois en
-- tout, tous traités ici.

BEGIN;

-- ── 1. Trigger des offres : libellés → clés techniques ──────────────────────
-- ⚠ Corps repris de la définition VIVANTE, pas du dump de baseline : celle-ci
-- journalise huit champs de métadonnées (from_party, currency, parent_offer_id,
-- expires_at…) que la version du dump ignore. La reconstruire depuis le fichier
-- aurait amputé de moitié la piste d'audit de chaque offre. Seuls les six
-- littéraux d'action changent.
CREATE OR REPLACE FUNCTION public.audit_crm_offer_event() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $offer$
DECLARE
  v_action TEXT;
  v_severity TEXT := 'info';
  v_actor UUID := COALESCE(NEW.created_by, auth.uid());
BEGIN
  -- INSERT : nouvelle offre ou contre-offre
  IF TG_OP = 'INSERT' THEN
    v_action := CASE NEW.kind
      WHEN 'counter' THEN 'offer_countered'
      ELSE 'offer_created'
    END;
  -- UPDATE : transitions de status
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    v_action := CASE NEW.status
      WHEN 'accepted'  THEN 'offer_accepted'
      WHEN 'rejected'  THEN 'offer_rejected'
      WHEN 'expired'   THEN 'offer_expired'
      WHEN 'withdrawn' THEN 'offer_withdrawn'
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
$offer$;

-- ── 2. Ouverture de dossier KYC (trigger sur kyc_cases) ─────────────────────
-- ⚠ Corps repris de la définition VIVANTE en production, pas du fichier de
-- migration qui l'a créée : la fonction a évolué depuis (elle distingue
-- personne morale et physique, et amorce neuf contrôles au lieu de cinq).
-- La reconstruire depuis le fichier aurait remplacé l'amorçage des contrôles
-- LBA par une version obsolète. Seul le littéral d'action change ici.
CREATE OR REPLACE FUNCTION public.seed_kyc_lba_checks() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $seed$
DECLARE
  v_is_pm boolean := strpos(COALESCE(NEW.type::text, ''), '_pm') > 0;
BEGIN
  IF v_is_pm THEN
    -- Personne morale
    INSERT INTO kyc_checklist_items (kyc_case_id, label, category, is_required) VALUES
      (NEW.id, 'Extrait du Registre du Commerce',                   'Identité',          TRUE),
      (NEW.id, 'Statuts de la société',                             'Identité',          TRUE),
      (NEW.id, 'Identification des ayants droit économiques (UBO)', 'Identité',          TRUE),
      (NEW.id, 'Attestation de domicile du siège',                 'Domicile',          TRUE),
      (NEW.id, 'Rapport de révision / comptes annuels',            'Revenus',           TRUE),
      (NEW.id, 'Bilan et compte de résultat',                      'Revenus',           FALSE),
      (NEW.id, 'Déclaration d''origine des fonds',                 'Origine des fonds', TRUE),
      (NEW.id, 'Formulaire A / T',                                 'Origine des fonds', TRUE),
      (NEW.id, 'Screening PEP/Sanctions effectué',                 'Compliance',        TRUE);
  ELSE
    -- Personne physique
    INSERT INTO kyc_checklist_items (kyc_case_id, label, category, is_required) VALUES
      (NEW.id, 'Pièce d''identité (passeport ou CI)',              'Identité',          TRUE),
      (NEW.id, 'Extrait du registre des poursuites',               'Identité',          TRUE),
      (NEW.id, 'Attestation de domicile',                          'Domicile',          TRUE),
      (NEW.id, 'Dernière déclaration fiscale',                     'Revenus',           TRUE),
      (NEW.id, 'Attestation bancaire (preuve de fonds)',           'Revenus',           FALSE),
      (NEW.id, 'Déclaration d''origine des fonds',                 'Origine des fonds', TRUE),
      (NEW.id, 'Screening PEP/Sanctions effectué',                 'Compliance',        TRUE);
  END IF;

  INSERT INTO activity_events
    (agency_id, actor_id, action, entity_type, entity_id,
     category, severity, object_label, metadata)
  VALUES (
    NEW.agency_id,
    auth.uid(),
    'kyc_case_opened',
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
$seed$;

-- ── 3. Trigger de dernière interaction : la liste d'actions suivait le libellé ─
DROP TRIGGER IF EXISTS trg_contact_last_interaction ON public.activity_events;
CREATE TRIGGER trg_contact_last_interaction
  AFTER INSERT ON public.activity_events
  FOR EACH ROW
  WHEN (new.action = ANY (ARRAY['stage_change'::text, 'status_change'::text, 'note_added'::text, 'contact_message_received'::text]))
  EXECUTE FUNCTION bump_contact_last_interaction();

-- ── 4. Reprise de l'existant ────────────────────────────────────────────────
-- `activity_events` est immuable par trigger (audit LBA) : la garde de l'UPDATE
-- est levée le temps de la reprise, puis remise. Ciblée sur ce seul trigger —
-- `DISABLE TRIGGER USER` couperait aussi la mise à jour de last_interaction_at
-- et la garde de suppression, pour rien.
ALTER TABLE public.activity_events DISABLE TRIGGER trg_activity_events_immutable_update;

UPDATE public.activity_events SET action = CASE action
  WHEN 'Offre créée'             THEN 'offer_created'
  WHEN 'Contre-offre envoyée'    THEN 'offer_countered'
  WHEN 'Offre acceptée'          THEN 'offer_accepted'
  WHEN 'Offre refusée'           THEN 'offer_rejected'
  WHEN 'Offre expirée'           THEN 'offer_expired'
  WHEN 'Offre retirée'           THEN 'offer_withdrawn'
  WHEN 'Dossier KYC ouvert'      THEN 'kyc_case_opened'
  WHEN 'Contact créé'            THEN 'contact_created'
  WHEN 'Note ajoutée'            THEN 'note_added'
  WHEN 'Lead créé (WhatsApp)'    THEN 'lead_created_whatsapp'
  WHEN 'Lead qualifié (WhatsApp)' THEN 'lead_qualified_whatsapp'
  ELSE action
END
WHERE action IN (
  'Offre créée', 'Contre-offre envoyée', 'Offre acceptée', 'Offre refusée',
  'Offre expirée', 'Offre retirée', 'Dossier KYC ouvert', 'Contact créé',
  'Note ajoutée', 'Lead créé (WhatsApp)', 'Lead qualifié (WhatsApp)'
);

ALTER TABLE public.activity_events ENABLE TRIGGER trg_activity_events_immutable_update;

COMMENT ON COLUMN public.activity_events.action IS
  'Identifiant TECHNIQUE de l''événement (snake_case). Jamais de libellé affichable : le rendu passe par les clés i18n audit.action.*, avec repli sur cette valeur.';

COMMIT;
