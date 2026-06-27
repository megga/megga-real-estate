-- =====================================================================
-- KYC — checklist LBA : SOURCE UNIQUE (trigger), fin du doublon
--
-- Trou (re-tally 27 juin, confirmé live : des dossiers ont 2 jeux côte à côte) :
--   * trigger seed_kyc_lba_checks() posait 5 items GÉNÉRIQUES (catégories
--     id/address/pep/sanctions/funds) à chaque INSERT de kyc_cases ;
--   * ET le frontend useCreateKycCase (useKyc.ts) posait 7-9 items DÉTAILLÉS
--     (catégories Identité/Domicile/Revenus/Origine des fonds/Compliance).
--   → tout dossier créé via le CRM recevait LES DEUX → checklist LBA dupliquée
--     et incohérente sous les yeux de l'agent (ex. « Pièce d'identité » +
--     « Pièce d'identité (passeport ou CI) »).
--
-- Fix : une seule source = le trigger (server-side, fire pour TOUS les writers :
-- CRM, WhatsApp open_kyc_case, insert direct). On y porte le jeu DÉTAILLÉ PP/PM
-- (catégories alignées sur l'UI) qui vivait côté frontend ; l'insert frontend est
-- retiré (même PR). L'AuditEvent « Dossier KYC ouvert » est conservé tel quel.
--
-- N.B. : ne nettoie pas les dossiers de test existants (10, pré-pilote) qui
-- gardent leurs anciens doublons — seuls les NOUVEAUX dossiers sont concernés.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.seed_kyc_lba_checks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
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

  -- AuditEvent : Dossier KYC ouvert (inchangé — handoff §7 KYC_ENRICHISSEMENTS)
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
$function$;
