-- ============================================================================
-- P0 FIX: Secure support_tickets RLS policies
-- Problem: anon could read ALL tickets (USING(true)), authenticated users
--          had full CRUD on all ticket tables without super_admin check.
-- Fix: anon scoped to own ticket via access_token header,
--       authenticated restricted to super_admin via is_super_admin().
-- ============================================================================

-- ── Drop insecure policies ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "anon_select_own_ticket" ON support_tickets;
DROP POLICY IF EXISTS "anon_insert_messages" ON ticket_messages;
DROP POLICY IF EXISTS "anon_select_messages" ON ticket_messages;
DROP POLICY IF EXISTS "anon_select_events" ON ticket_events;
DROP POLICY IF EXISTS "auth_all_tickets" ON support_tickets;
DROP POLICY IF EXISTS "auth_all_messages" ON ticket_messages;
DROP POLICY IF EXISTS "auth_all_events" ON ticket_events;
DROP POLICY IF EXISTS "auth_all_canned" ON ticket_canned_responses;

-- ── Anon: scoped to own ticket via access_token ─────────────────────────────

-- Anon can view ONLY their own ticket by providing the access_token as a query param
-- The access_token is a UUID generated at ticket creation, passed via RPC or header
CREATE POLICY "anon_select_own_ticket" ON support_tickets
  FOR SELECT TO anon
  USING (access_token::text = coalesce(
    current_setting('request.headers', true)::json->>'x-ticket-token',
    ''
  ));

-- Anon can insert messages only on tickets they have access to (via access_token)
CREATE POLICY "anon_insert_messages" ON ticket_messages
  FOR INSERT TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM support_tickets st
      WHERE st.id = ticket_id
        AND st.access_token::text = coalesce(
          current_setting('request.headers', true)::json->>'x-ticket-token',
          ''
        )
    )
  );

-- Anon can read non-internal messages only on their own ticket
CREATE POLICY "anon_select_messages" ON ticket_messages
  FOR SELECT TO anon
  USING (
    is_internal_note = FALSE
    AND EXISTS (
      SELECT 1 FROM support_tickets st
      WHERE st.id = ticket_id
        AND st.access_token::text = coalesce(
          current_setting('request.headers', true)::json->>'x-ticket-token',
          ''
        )
    )
  );

-- Anon can read events only on their own ticket
CREATE POLICY "anon_select_events" ON ticket_events
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM support_tickets st
      WHERE st.id = ticket_id
        AND st.access_token::text = coalesce(
          current_setting('request.headers', true)::json->>'x-ticket-token',
          ''
        )
    )
  );

-- ── Authenticated: super_admin only ─────────────────────────────────────────

CREATE POLICY "auth_all_tickets" ON support_tickets
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "auth_all_messages" ON ticket_messages
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "auth_all_events" ON ticket_events
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "auth_all_canned" ON ticket_canned_responses
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Keep anon insert for ticket creation (unchanged — still permissive for public form)
-- "anon_insert_tickets" policy already exists and is correct.
