-- ============================================================================
-- Migration: Fix RLS policies on enriched CRM tables
-- Date: 2026-03-23
-- Description: Replace inline subquery-based RLS policies with
--              get_user_agency_id() (SECURITY DEFINER) to avoid
--              recursion issues and stay consistent with 003_rls_policies.sql
-- ============================================================================

-- ── matches ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "agents_own_agency" ON matches;
CREATE POLICY matches_select ON matches FOR SELECT USING (agency_id = get_user_agency_id());
CREATE POLICY matches_insert ON matches FOR INSERT WITH CHECK (agency_id = get_user_agency_id());
CREATE POLICY matches_update ON matches FOR UPDATE USING (agency_id = get_user_agency_id());
CREATE POLICY matches_delete ON matches FOR DELETE USING (agency_id = get_user_agency_id());

-- ── client_searches ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "agents_own_agency" ON client_searches;
CREATE POLICY client_searches_select ON client_searches FOR SELECT USING (agency_id = get_user_agency_id());
CREATE POLICY client_searches_insert ON client_searches FOR INSERT WITH CHECK (agency_id = get_user_agency_id());
CREATE POLICY client_searches_update ON client_searches FOR UPDATE USING (agency_id = get_user_agency_id());
CREATE POLICY client_searches_delete ON client_searches FOR DELETE USING (agency_id = get_user_agency_id());

-- ── message_templates ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "agents_own_agency" ON message_templates;
CREATE POLICY message_templates_select ON message_templates FOR SELECT USING (agency_id = get_user_agency_id());
CREATE POLICY message_templates_insert ON message_templates FOR INSERT WITH CHECK (agency_id = get_user_agency_id());
CREATE POLICY message_templates_update ON message_templates FOR UPDATE USING (agency_id = get_user_agency_id());

-- ── reminders ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "agents_own_agency" ON reminders;
CREATE POLICY reminders_select ON reminders FOR SELECT USING (agency_id = get_user_agency_id());
CREATE POLICY reminders_insert ON reminders FOR INSERT WITH CHECK (agency_id = get_user_agency_id());
CREATE POLICY reminders_update ON reminders FOR UPDATE USING (agency_id = get_user_agency_id());

-- ── automation_rules ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "agents_own_agency" ON automation_rules;
CREATE POLICY automation_rules_select ON automation_rules FOR SELECT USING (agency_id = get_user_agency_id());
CREATE POLICY automation_rules_insert ON automation_rules FOR INSERT WITH CHECK (agency_id = get_user_agency_id());
CREATE POLICY automation_rules_update ON automation_rules FOR UPDATE USING (agency_id = get_user_agency_id());

-- ── visits ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "agents_own_agency" ON visits;
CREATE POLICY visits_select ON visits FOR SELECT USING (agency_id = get_user_agency_id());
CREATE POLICY visits_insert ON visits FOR INSERT WITH CHECK (agency_id = get_user_agency_id());
CREATE POLICY visits_update ON visits FOR UPDATE USING (agency_id = get_user_agency_id());

-- ── daily_actions ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "agents_own_actions" ON daily_actions;
CREATE POLICY daily_actions_select ON daily_actions FOR SELECT USING (
  agency_id = get_user_agency_id() AND agent_id = auth.uid()
);
CREATE POLICY daily_actions_insert ON daily_actions FOR INSERT WITH CHECK (
  agency_id = get_user_agency_id() AND agent_id = auth.uid()
);
CREATE POLICY daily_actions_update ON daily_actions FOR UPDATE USING (
  agency_id = get_user_agency_id() AND agent_id = auth.uid()
);
