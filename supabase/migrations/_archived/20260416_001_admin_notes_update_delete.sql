-- ============================================================================
-- Fix: admin_notes missing UPDATE + DELETE policies
--
-- Problem: admin_notes only had SELECT + INSERT policies for super_admin.
-- useFeatureFlags.updateFlag() and useChangelog.deleteEntry() fail silently
-- because Supabase RLS blocks the UPDATE/DELETE without returning an error
-- (PostgREST returns 0 affected rows instead of a 403).
--
-- Fix: add UPDATE + DELETE policies using the existing is_super_admin()
-- function (defined in 20260404_001_super_admin.sql).
--
-- Idempotent: safe to re-run.
-- ============================================================================

-- UPDATE — needed by useFeatureFlags.updateFlag() and useChangelog edits
DROP POLICY IF EXISTS "super_admin_update_notes" ON admin_notes;
CREATE POLICY "super_admin_update_notes"
  ON admin_notes FOR UPDATE
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- DELETE — needed by useChangelog.deleteEntry()
DROP POLICY IF EXISTS "super_admin_delete_notes" ON admin_notes;
CREATE POLICY "super_admin_delete_notes"
  ON admin_notes FOR DELETE
  USING (is_super_admin());
