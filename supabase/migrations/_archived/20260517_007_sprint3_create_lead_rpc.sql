-- ============================================================================
-- Migration: Sprint 3 — RPC transactionnelle create_lead_with_optional_deal
-- Date: 2026-05-17
--
-- Problème (audit Sprint 3a §C.4) : useImportLead fait 2 INSERTs séquentiels
-- (contacts puis transactions). Si le contact INSERT réussit mais le deal
-- INSERT échoue (FK manquante, RLS, CHECK constraint), on a un Contact
-- orphelin sans Deal — incohérence métier.
--
-- Solution : encapsuler les 2 INSERTs dans une RPC PL/pgSQL qui s'exécute
-- comme une transaction atomique. Si une étape échoue, la fonction lève
-- une exception et tout est rollback.
--
-- Spec : AUDIT_SPRINT_3A.md §C.4.
-- ============================================================================

CREATE OR REPLACE FUNCTION create_lead_with_optional_deal(
  p_first_name TEXT,
  p_last_name TEXT,
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_type TEXT DEFAULT 'buyer',
  p_source TEXT DEFAULT 'import',
  p_score TEXT DEFAULT 'warm',
  p_tags TEXT[] DEFAULT '{}',
  p_notes TEXT DEFAULT NULL,
  p_budget_announced NUMERIC DEFAULT NULL,
  p_search_zones TEXT[] DEFAULT '{}',
  p_import_raw_text TEXT DEFAULT NULL,
  p_create_deal BOOLEAN DEFAULT FALSE,
  p_deal_stage TEXT DEFAULT 'new_lead',
  p_deal_notes TEXT DEFAULT NULL,
  p_deal_role TEXT DEFAULT 'buyer'  -- 'buyer' | 'seller' (qui rattacher sur le deal)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER SET search_path = public, pg_temp
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

GRANT EXECUTE ON FUNCTION create_lead_with_optional_deal(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT,
  NUMERIC, TEXT[], TEXT, BOOLEAN, TEXT, TEXT, TEXT
) TO authenticated;

COMMENT ON FUNCTION create_lead_with_optional_deal IS
  'Sprint 3 (C.4) : création atomique Contact + Deal optionnel depuis Import Lead IA. Si le deal échoue, le contact est rollback (pas d''orphelin). RLS via get_user_agency_id() côté SECURITY INVOKER.';
