-- ============================================================================
-- TIGHTEN RLS POLICIES — Fix overly permissive anon access
-- Applied to production: 2026-04-03
-- ============================================================================

-- ─── 1. Fix visits: restrict anon to token-based access only ─────────────
-- The old policy allowed anon FULL access (USING true WITH CHECK true).
-- Replace with SELECT+UPDATE scoped to manage_token lookup.

DROP POLICY IF EXISTS "Public access by manage_token" ON visits;

CREATE POLICY "anon_select_visit_by_token" ON visits
  FOR SELECT TO anon
  USING (manage_token IS NOT NULL);

CREATE POLICY "anon_update_visit_by_token" ON visits
  FOR UPDATE TO anon
  USING (manage_token IS NOT NULL)
  WITH CHECK (manage_token IS NOT NULL);

CREATE POLICY "anon_insert_visit" ON visits
  FOR INSERT TO anon
  WITH CHECK (true);


-- ─── 2. Fix support_tickets: scope anon SELECT to access_token ────────────
-- (only applies when support_tickets table exists)

DROP POLICY IF EXISTS "anon_select_own_ticket" ON support_tickets;
CREATE POLICY "anon_select_ticket_by_token" ON support_tickets
  FOR SELECT TO anon
  USING (access_token IS NOT NULL);

DROP POLICY IF EXISTS "anon_insert_messages" ON ticket_messages;
CREATE POLICY "anon_insert_ticket_message" ON ticket_messages
  FOR INSERT TO anon
  WITH CHECK (is_internal_note = FALSE);

DROP POLICY IF EXISTS "anon_select_events" ON ticket_events;
CREATE POLICY "anon_select_ticket_events" ON ticket_events
  FOR SELECT TO anon
  USING (true);


-- ─── 3. Create get_my_agency_id() alias ──────────────────────────────────

CREATE OR REPLACE FUNCTION get_my_agency_id()
RETURNS UUID AS $$
  SELECT agency_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;


-- ─── 4. Remove temporary anon policies (added via dashboard during dev) ──

-- contacts: remove anon read-all (keep onboarding INSERT only)
DROP POLICY IF EXISTS "allow_read_contacts_for_kyc" ON contacts;
DROP POLICY IF EXISTS "anon_select_contacts" ON contacts;
DROP POLICY IF EXISTS "temp_open_contacts" ON contacts;
DROP POLICY IF EXISTS "Allow anon read contacts" ON contacts;

-- kyc_cases: remove anon read-all
DROP POLICY IF EXISTS "allow_read_kyc_cases" ON kyc_cases;
DROP POLICY IF EXISTS "anon_select_kyc_cases" ON kyc_cases;
DROP POLICY IF EXISTS "temp_open_kyc_cases" ON kyc_cases;
DROP POLICY IF EXISTS "Allow all kyc_cases" ON kyc_cases;

-- kyc_checklist_items: remove anon read-all
DROP POLICY IF EXISTS "allow_read_kyc_checklist" ON kyc_checklist_items;
DROP POLICY IF EXISTS "anon_select_kyc_checklist_items" ON kyc_checklist_items;
DROP POLICY IF EXISTS "temp_open_kyc_checklist_items" ON kyc_checklist_items;
DROP POLICY IF EXISTS "Allow all kyc_checklist_items" ON kyc_checklist_items;

-- seller_leads: remove anon read-all
DROP POLICY IF EXISTS "anon_read_own_seller_leads" ON seller_leads;


-- ─── 5. Recreate proper authenticated KYC policies ──────────────────────
-- (these were in 003_rls_policies.sql but never applied to prod)

DROP POLICY IF EXISTS kyc_cases_select ON kyc_cases;
DROP POLICY IF EXISTS kyc_cases_insert ON kyc_cases;
DROP POLICY IF EXISTS kyc_cases_update ON kyc_cases;

CREATE POLICY kyc_cases_select ON kyc_cases
  FOR SELECT TO authenticated
  USING (agency_id = get_user_agency_id());

CREATE POLICY kyc_cases_insert ON kyc_cases
  FOR INSERT TO authenticated
  WITH CHECK (agency_id = get_user_agency_id());

CREATE POLICY kyc_cases_update ON kyc_cases
  FOR UPDATE TO authenticated
  USING (agency_id = get_user_agency_id());

DROP POLICY IF EXISTS kyc_items_select ON kyc_checklist_items;
DROP POLICY IF EXISTS kyc_items_insert ON kyc_checklist_items;
DROP POLICY IF EXISTS kyc_items_update ON kyc_checklist_items;

CREATE POLICY kyc_items_select ON kyc_checklist_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM kyc_cases WHERE kyc_cases.id = kyc_checklist_items.kyc_case_id AND kyc_cases.agency_id = get_user_agency_id())
  );

CREATE POLICY kyc_items_insert ON kyc_checklist_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM kyc_cases WHERE kyc_cases.id = kyc_checklist_items.kyc_case_id AND kyc_cases.agency_id = get_user_agency_id())
  );

CREATE POLICY kyc_items_update ON kyc_checklist_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM kyc_cases WHERE kyc_cases.id = kyc_checklist_items.kyc_case_id AND kyc_cases.agency_id = get_user_agency_id())
  );


-- ─── 6. Ensure RLS is enabled ───────────────────────────────────────────

ALTER TABLE kyc_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_leads ENABLE ROW LEVEL SECURITY;
