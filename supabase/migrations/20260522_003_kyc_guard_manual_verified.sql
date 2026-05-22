-- Migration: guard_manual_kyc_verified
-- Empêche tout passage manuel de kyc_cases.dossier_status à 'verified'
-- en bypassant la checklist LBA art. 7 al. 1.
--
-- Contexte (red-team audit 2026-05-19, finding F5) :
-- Le hook frontend useUpdateKycStatus rejette 'validated' côté JS,
-- mais un agent peut TRIVIALEMENT contourner ce safeguard via DevTools :
--   await supabase.from('kyc_cases')
--     .update({dossier_status:'verified'})
--     .eq('id', '<id>')
-- → le UPDATE passe (la RLS autorise par agency_id), aucun trigger DB
--   ne le refuse → dossier "validé" sans checks LBA, sans screening
--   Dilisense, sans décision documentée. Casse l'art. 7 al. 1 LBA.
--
-- Solution : trigger BEFORE UPDATE qui refuse la transition à 'verified'
-- SAUF si elle vient de auto_verify_kyc_dossier() (qui passe par un autre
-- trigger AFTER UPDATE sur kyc_checklist_items et fait alors un UPDATE
-- nested sur kyc_cases — détectable via pg_trigger_depth() > 1).
--
-- pg_trigger_depth() retourne :
--   - 1 si on est dans le trigger d'un UPDATE direct (cas à bloquer)
--   - 2+ si on est dans un UPDATE déclenché par un autre trigger
--     (cas auto_verify_kyc_dossier — autorisé)
--
-- Le bypass se fait aussi proprement pour les MIGRATIONS / scripts ops :
-- on désactive temporairement le trigger via ALTER TABLE DISABLE TRIGGER.

CREATE OR REPLACE FUNCTION guard_manual_kyc_verified()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_depth INTEGER;
BEGIN
  -- Ne s'active que sur la transition NEW.dossier_status = 'verified'
  -- (les passages à 'pending'/'failed'/'stale'/'none' restent libres).
  IF NEW.dossier_status IS DISTINCT FROM 'verified' THEN
    RETURN NEW;
  END IF;

  -- Si on entre déjà en 'verified' (pas de transition), no-op
  IF OLD.dossier_status = 'verified' THEN
    RETURN NEW;
  END IF;

  v_depth := pg_trigger_depth();

  -- Depth = 1 → on est appelé par un UPDATE direct (utilisateur via
  -- supabase-js / DevTools / psql). On bloque.
  -- Depth >= 2 → on est appelé en cascade depuis auto_verify_kyc_dossier
  -- (qui fait un UPDATE kyc_cases depuis le AFTER UPDATE de
  -- kyc_checklist_items). On laisse passer.
  IF v_depth <= 1 THEN
    -- Log la tentative pour traçabilité forensique
    INSERT INTO activity_events
      (agency_id, actor_id, action, entity_type, entity_id,
       category, severity, object_label, metadata)
    VALUES (
      NEW.agency_id,
      auth.uid(),
      'Tentative validation manuelle KYC bloquée',
      'kyc_case',
      NEW.id,
      'kyc',
      'critical',
      'Dossier ' || NEW.id::TEXT,
      jsonb_build_object(
        'reason', 'manual_verified_bypass_blocked',
        'old_status', OLD.dossier_status,
        'attempted_status', NEW.dossier_status,
        'pg_trigger_depth', v_depth
      )
    );

    RAISE EXCEPTION
      'Le passage de dossier_status à "verified" doit passer par la checklist LBA art. 7 al. 1 et le trigger auto_verify_kyc_dossier. Bypass manuel refusé.'
      USING ERRCODE = 'check_violation',
            HINT = 'Cocher tous les checks requis dans le wizard KYC ; les décisions sanctions/PEP doivent être documentées.';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION guard_manual_kyc_verified() IS
  'Refuse UPDATE kyc_cases SET dossier_status=verified si appelé directement (depth=1). Autorise les cascades depuis auto_verify_kyc_dossier (depth>=2). Red-team finding F5 — voir audit 2026-05-19.';

DROP TRIGGER IF EXISTS trg_guard_manual_kyc_verified ON kyc_cases;
CREATE TRIGGER trg_guard_manual_kyc_verified
  BEFORE UPDATE OF dossier_status ON kyc_cases
  FOR EACH ROW
  EXECUTE FUNCTION guard_manual_kyc_verified();

COMMENT ON TRIGGER trg_guard_manual_kyc_verified ON kyc_cases IS
  'P0 sécu — ferme le bypass JS-only de useUpdateKycStatus côté DevTools. Voir migration et audit red-team 2026-05-19.';
