-- ============================================================================
-- RLS SECURITY AUDIT & HARDENING
-- ============================================================================
-- Problem: Multiple tables may still have overly permissive anon policies
-- from dev-time dashboard edits. This migration is IDEMPOTENT and
-- CONDITIONAL — it skips tables that don't exist in the current DB.
--
-- Safe to run multiple times. Belt-and-suspenders with 20260403_001.
-- ============================================================================

-- ─── 0. Ensure helper functions exist ───────────────────────────────────────

CREATE OR REPLACE FUNCTION get_my_agency_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT agency_id FROM profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION get_user_agency_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT agency_id FROM profiles WHERE id = auth.uid()
$$;

-- ============================================================================
-- 1. CONTACTS
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='contacts') THEN
    EXECUTE 'DROP POLICY IF EXISTS "allow_read_contacts_for_kyc" ON contacts';
    EXECUTE 'DROP POLICY IF EXISTS "anon_select_contacts" ON contacts';
    EXECUTE 'DROP POLICY IF EXISTS "temp_open_contacts" ON contacts';
    EXECUTE 'DROP POLICY IF EXISTS "Allow anon read contacts" ON contacts';
    EXECUTE 'DROP POLICY IF EXISTS "Allow anonymous read" ON contacts';
    EXECUTE 'DROP POLICY IF EXISTS "contacts_anon_read" ON contacts';
    EXECUTE 'DROP POLICY IF EXISTS "contacts_public_select" ON contacts';
    EXECUTE 'DROP POLICY IF EXISTS "Enable read access for all users" ON contacts';
    EXECUTE 'DROP POLICY IF EXISTS contacts_select ON contacts';
    EXECUTE 'DROP POLICY IF EXISTS contacts_insert ON contacts';
    EXECUTE 'DROP POLICY IF EXISTS contacts_update ON contacts';
    EXECUTE 'DROP POLICY IF EXISTS contacts_delete ON contacts';
    EXECUTE 'DROP POLICY IF EXISTS "Agents can view agency contacts" ON contacts';
    EXECUTE 'DROP POLICY IF EXISTS "Agents can update agency contacts" ON contacts';
    EXECUTE 'DROP POLICY IF EXISTS "Agents can delete agency contacts" ON contacts';
    EXECUTE 'DROP POLICY IF EXISTS "Anon can insert onboarding contacts" ON contacts';
    EXECUTE 'DROP POLICY IF EXISTS contacts_anon_onboarding_insert ON contacts';

    -- Authenticated: agency-scoped CRUD
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contacts' AND column_name='user_id') THEN
      EXECUTE 'CREATE POLICY contacts_select ON contacts FOR SELECT TO authenticated USING (agency_id = get_my_agency_id() OR user_id = auth.uid())';
    ELSE
      EXECUTE 'CREATE POLICY contacts_select ON contacts FOR SELECT TO authenticated USING (agency_id = get_my_agency_id())';
    END IF;

    EXECUTE 'CREATE POLICY contacts_insert ON contacts FOR INSERT TO authenticated WITH CHECK (agency_id = get_my_agency_id())';
    EXECUTE 'CREATE POLICY contacts_update ON contacts FOR UPDATE TO authenticated USING (agency_id = get_my_agency_id()) WITH CHECK (agency_id = get_my_agency_id())';
    EXECUTE 'CREATE POLICY contacts_delete ON contacts FOR DELETE TO authenticated USING (agency_id = get_my_agency_id())';

    -- Anon INSERT only for onboarding source
    EXECUTE 'CREATE POLICY contacts_anon_onboarding_insert ON contacts FOR INSERT TO anon WITH CHECK (source = ''onboarding'')';

    EXECUTE 'ALTER TABLE contacts ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE contacts FORCE ROW LEVEL SECURITY';
    RAISE NOTICE 'contacts: RLS hardened';
  ELSE
    RAISE NOTICE 'contacts: table not found, skipping';
  END IF;
END $$;

-- ============================================================================
-- 2. KYC_CASES
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='kyc_cases') THEN
    EXECUTE 'DROP POLICY IF EXISTS "allow_read_kyc_cases" ON kyc_cases';
    EXECUTE 'DROP POLICY IF EXISTS "anon_select_kyc_cases" ON kyc_cases';
    EXECUTE 'DROP POLICY IF EXISTS "temp_open_kyc_cases" ON kyc_cases';
    EXECUTE 'DROP POLICY IF EXISTS "Allow all kyc_cases" ON kyc_cases';
    EXECUTE 'DROP POLICY IF EXISTS "kyc_cases_anon_read" ON kyc_cases';
    EXECUTE 'DROP POLICY IF EXISTS "kyc_cases_public_select" ON kyc_cases';
    EXECUTE 'DROP POLICY IF EXISTS "Enable read access for all users" ON kyc_cases';
    EXECUTE 'DROP POLICY IF EXISTS kyc_cases_select ON kyc_cases';
    EXECUTE 'DROP POLICY IF EXISTS kyc_cases_insert ON kyc_cases';
    EXECUTE 'DROP POLICY IF EXISTS kyc_cases_update ON kyc_cases';
    EXECUTE 'DROP POLICY IF EXISTS kyc_cases_delete ON kyc_cases';

    EXECUTE 'CREATE POLICY kyc_cases_select ON kyc_cases FOR SELECT TO authenticated USING (agency_id = get_my_agency_id())';
    EXECUTE 'CREATE POLICY kyc_cases_insert ON kyc_cases FOR INSERT TO authenticated WITH CHECK (agency_id = get_my_agency_id())';
    EXECUTE 'CREATE POLICY kyc_cases_update ON kyc_cases FOR UPDATE TO authenticated USING (agency_id = get_my_agency_id()) WITH CHECK (agency_id = get_my_agency_id())';
    EXECUTE 'CREATE POLICY kyc_cases_delete ON kyc_cases FOR DELETE TO authenticated USING (agency_id = get_my_agency_id())';

    EXECUTE 'ALTER TABLE kyc_cases ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE kyc_cases FORCE ROW LEVEL SECURITY';
    RAISE NOTICE 'kyc_cases: RLS hardened';
  ELSE
    RAISE NOTICE 'kyc_cases: table not found, skipping';
  END IF;
END $$;

-- ============================================================================
-- 3. KYC_CHECKLIST_ITEMS
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='kyc_checklist_items') THEN
    EXECUTE 'DROP POLICY IF EXISTS "allow_read_kyc_checklist" ON kyc_checklist_items';
    EXECUTE 'DROP POLICY IF EXISTS "anon_select_kyc_checklist_items" ON kyc_checklist_items';
    EXECUTE 'DROP POLICY IF EXISTS "temp_open_kyc_checklist_items" ON kyc_checklist_items';
    EXECUTE 'DROP POLICY IF EXISTS "Allow all kyc_checklist_items" ON kyc_checklist_items';
    EXECUTE 'DROP POLICY IF EXISTS "kyc_items_anon_read" ON kyc_checklist_items';
    EXECUTE 'DROP POLICY IF EXISTS kyc_items_select ON kyc_checklist_items';
    EXECUTE 'DROP POLICY IF EXISTS kyc_items_insert ON kyc_checklist_items';
    EXECUTE 'DROP POLICY IF EXISTS kyc_items_update ON kyc_checklist_items';
    EXECUTE 'DROP POLICY IF EXISTS kyc_items_delete ON kyc_checklist_items';

    EXECUTE $POL$CREATE POLICY kyc_items_select ON kyc_checklist_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM kyc_cases WHERE kyc_cases.id = kyc_checklist_items.kyc_case_id AND kyc_cases.agency_id = get_my_agency_id()))$POL$;
    EXECUTE $POL$CREATE POLICY kyc_items_insert ON kyc_checklist_items FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM kyc_cases WHERE kyc_cases.id = kyc_checklist_items.kyc_case_id AND kyc_cases.agency_id = get_my_agency_id()))$POL$;
    EXECUTE $POL$CREATE POLICY kyc_items_update ON kyc_checklist_items FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM kyc_cases WHERE kyc_cases.id = kyc_checklist_items.kyc_case_id AND kyc_cases.agency_id = get_my_agency_id()))$POL$;
    EXECUTE $POL$CREATE POLICY kyc_items_delete ON kyc_checklist_items FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM kyc_cases WHERE kyc_cases.id = kyc_checklist_items.kyc_case_id AND kyc_cases.agency_id = get_my_agency_id()))$POL$;

    EXECUTE 'ALTER TABLE kyc_checklist_items ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE kyc_checklist_items FORCE ROW LEVEL SECURITY';
    RAISE NOTICE 'kyc_checklist_items: RLS hardened';
  ELSE
    RAISE NOTICE 'kyc_checklist_items: table not found, skipping';
  END IF;
END $$;

-- ============================================================================
-- 4. SELLER_PORTALS (valid statuses: active, expired, revoked)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='seller_portals') THEN
    EXECUTE 'DROP POLICY IF EXISTS "public_read_by_token" ON seller_portals';
    EXECUTE 'DROP POLICY IF EXISTS "anon_read_seller_portals" ON seller_portals';
    EXECUTE 'DROP POLICY IF EXISTS seller_portals_anon_read ON seller_portals';
    EXECUTE 'DROP POLICY IF EXISTS "agents_read_seller_portals" ON seller_portals';
    EXECUTE 'DROP POLICY IF EXISTS "agents_manage_seller_portals" ON seller_portals';
    EXECUTE 'DROP POLICY IF EXISTS seller_portals_agents_all ON seller_portals';

    EXECUTE $POL$CREATE POLICY seller_portals_anon_read ON seller_portals FOR SELECT TO anon USING (expires_at > now() AND status = 'active')$POL$;
    EXECUTE 'CREATE POLICY seller_portals_agents_all ON seller_portals FOR ALL TO authenticated USING (agency_id = get_my_agency_id()) WITH CHECK (agency_id = get_my_agency_id())';

    EXECUTE 'ALTER TABLE seller_portals ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE seller_portals FORCE ROW LEVEL SECURITY';
    RAISE NOTICE 'seller_portals: RLS hardened';
  ELSE
    RAISE NOTICE 'seller_portals: table not found, skipping';
  END IF;
END $$;

-- ============================================================================
-- 5. SELLER_LEADS
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='seller_leads') THEN
    EXECUTE 'DROP POLICY IF EXISTS "anon_read_own_seller_leads" ON seller_leads';
    EXECUTE 'DROP POLICY IF EXISTS "anon_select_seller_leads" ON seller_leads';
    EXECUTE 'DROP POLICY IF EXISTS "anon_insert_seller_leads" ON seller_leads';
    EXECUTE 'DROP POLICY IF EXISTS seller_leads_anon_insert ON seller_leads';
    EXECUTE 'DROP POLICY IF EXISTS "agents_read_seller_leads" ON seller_leads';
    EXECUTE 'DROP POLICY IF EXISTS "agents_manage_seller_leads" ON seller_leads';
    EXECUTE 'DROP POLICY IF EXISTS seller_leads_agents_all ON seller_leads';

    EXECUTE 'CREATE POLICY seller_leads_anon_insert ON seller_leads FOR INSERT TO anon WITH CHECK (true)';
    EXECUTE 'CREATE POLICY seller_leads_agents_all ON seller_leads FOR ALL TO authenticated USING (assigned_agency_id = get_my_agency_id() OR assigned_agency_id IS NULL) WITH CHECK (assigned_agency_id = get_my_agency_id() OR assigned_agency_id IS NULL)';

    EXECUTE 'ALTER TABLE seller_leads ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE seller_leads FORCE ROW LEVEL SECURITY';
    RAISE NOTICE 'seller_leads: RLS hardened';
  ELSE
    RAISE NOTICE 'seller_leads: table not found, skipping';
  END IF;
END $$;

-- ============================================================================
-- 6. CHAT_CONVERSATIONS / CHAT_MESSAGES
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='chat_conversations') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Anyone can create conversations" ON chat_conversations';
    EXECUTE 'DROP POLICY IF EXISTS chat_conversations_auth_insert ON chat_conversations';
    EXECUTE 'CREATE POLICY chat_conversations_auth_insert ON chat_conversations FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())';
    RAISE NOTICE 'chat_conversations: RLS hardened';
  ELSE
    RAISE NOTICE 'chat_conversations: table not found, skipping';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='chat_messages') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Anyone can insert messages" ON chat_messages';
    EXECUTE 'DROP POLICY IF EXISTS chat_messages_auth_insert ON chat_messages';
    EXECUTE 'CREATE POLICY chat_messages_auth_insert ON chat_messages FOR INSERT TO authenticated WITH CHECK (conversation_id IN (SELECT id FROM chat_conversations WHERE user_id = auth.uid()))';
    RAISE NOTICE 'chat_messages: RLS hardened';
  ELSE
    RAISE NOTICE 'chat_messages: table not found, skipping';
  END IF;
END $$;

-- ============================================================================
-- 7. SUPPORT_TICKETS — super_admin only
-- ============================================================================

DO $$
BEGIN
  -- Only run if is_super_admin() function exists
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_super_admin') THEN

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='support_tickets') THEN
      EXECUTE 'DROP POLICY IF EXISTS "admin_all_tickets" ON support_tickets';
      EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can manage tickets" ON support_tickets';
      EXECUTE 'DROP POLICY IF EXISTS support_tickets_admin_all ON support_tickets';
      EXECUTE 'CREATE POLICY support_tickets_admin_all ON support_tickets FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin())';
      RAISE NOTICE 'support_tickets: RLS hardened';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='ticket_messages') THEN
      EXECUTE 'DROP POLICY IF EXISTS "admin_all_ticket_messages" ON ticket_messages';
      EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can manage messages" ON ticket_messages';
      EXECUTE 'DROP POLICY IF EXISTS ticket_messages_admin_all ON ticket_messages';
      EXECUTE 'CREATE POLICY ticket_messages_admin_all ON ticket_messages FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin())';
      RAISE NOTICE 'ticket_messages: RLS hardened';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='ticket_events') THEN
      EXECUTE 'DROP POLICY IF EXISTS "admin_all_ticket_events" ON ticket_events';
      EXECUTE 'DROP POLICY IF EXISTS ticket_events_admin_all ON ticket_events';
      EXECUTE 'CREATE POLICY ticket_events_admin_all ON ticket_events FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin())';
      RAISE NOTICE 'ticket_events: RLS hardened';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='ticket_canned_responses') THEN
      EXECUTE 'DROP POLICY IF EXISTS "admin_all_canned" ON ticket_canned_responses';
      EXECUTE 'DROP POLICY IF EXISTS ticket_canned_admin_all ON ticket_canned_responses';
      EXECUTE 'CREATE POLICY ticket_canned_admin_all ON ticket_canned_responses FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin())';
      RAISE NOTICE 'ticket_canned_responses: RLS hardened';
    END IF;

  ELSE
    RAISE NOTICE 'is_super_admin() not found, skipping support tickets section';
  END IF;
END $$;

-- ============================================================================
-- 8. AUDIT LOG
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='activity_events') THEN
    INSERT INTO activity_events (action, entity_type, entity_id, metadata, created_at)
    VALUES (
      'rls_hardening_applied',
      'system',
      gen_random_uuid(),
      jsonb_build_object(
        'migration', '20260410_001_rls_security_audit',
        'timestamp', now()
      ),
      now()
    );
  END IF;
END $$;
