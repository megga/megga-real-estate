-- Atomicité : accepter une offre SIGNE le deal (transactions.stage='signed').
-- ─────────────────────────────────────────────────────────────────────
-- Contrat handoff « boucle de négociation » : accepter une offre signe le deal.
-- Le front faisait 2 écritures séparées (crm_offers.status='accepted' PUIS
-- transactions.stage='signed') → non atomique : si la 2e échoue, l'offre est
-- acceptée mais le deal reste non signé. Ce trigger déplace la signature dans la
-- MÊME transaction que l'update de l'offre → atomique. Le front garde un update
-- de secours idempotent (no-op quand ce trigger est présent : garde `stage <>
-- 'signed'` + garde `OLD.stage IS DISTINCT FROM NEW.stage` de
-- capture_transaction_lifecycle → aucun audit en double).
--
-- Audit inchangé : audit_crm_offer_event → 'Offre acceptée' (trg_audit_crm_offer_status) ;
-- trg_transaction_lifecycle (sur transactions) → 'stage_change' vers signed.
-- Pattern SECURITY DEFINER + search_path : aligné sur audit_crm_offer_event.

CREATE OR REPLACE FUNCTION sign_deal_on_offer_accept()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  -- deal_id peut être NULL (transaction supprimée → ON DELETE SET NULL).
  IF NEW.deal_id IS NOT NULL THEN
    UPDATE transactions
      SET stage = 'signed'
      WHERE id = NEW.deal_id
        AND stage <> 'signed';   -- évite un no-op + un audit stage_change en double
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_offer_sign_deal ON crm_offers;
CREATE TRIGGER trg_crm_offer_sign_deal
  AFTER UPDATE ON crm_offers
  FOR EACH ROW
  WHEN (NEW.status = 'accepted' AND OLD.status IS DISTINCT FROM 'accepted')
  EXECUTE FUNCTION sign_deal_on_offer_accept();
