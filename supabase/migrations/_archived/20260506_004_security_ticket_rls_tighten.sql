-- ============================================================
-- Phase C — CRITICAL: tighten auth_all_* RLS policies on ticket tables (lint 0024)
-- ============================================================
-- The Supabase linter flagged 4 policies of type rls_policy_always_true
-- (lint 0024) on the ticket platform:
--   - support_tickets.auth_all_tickets        (FOR ALL TO authenticated, qual=true, check=true)
--   - ticket_messages.auth_all_messages       (FOR ALL TO authenticated, qual=true, check=true)
--   - ticket_events.auth_all_events           (FOR ALL TO authenticated, qual=true, check=true)
--   - ticket_canned_responses.auth_all_canned (FOR ALL TO authenticated, qual=true, check=true)
--
-- These effectively bypass row-level security for every signed-in user,
-- meaning any agent in any agency could read or modify EVERY support
-- ticket and message in the platform.
--
-- Migration 20260404_003_fix_ticket_rls.sql attempted to fix this but
-- the live database still shows USING(true) — drift between migration
-- files and deployed state (likely manual SQL editor changes or a
-- partial migration application). This migration re-asserts the
-- canonical state idempotently and forces it into the next deploy.
--
-- ─── Access model ────────────────────────────────────────────
--
-- support_tickets / ticket_messages / ticket_events:
--     authenticated user can access a row if any of:
--       1. is_super_admin()                  → MEGGA platform admin
--       2. submitter_email = auth.email()    → user submitted the ticket
--       3. assigned_to = auth.uid()          → ticket is assigned to them
--
--     Child tables (messages, events) inherit access via EXISTS join on
--     support_tickets.id, so visibility on the parent automatically
--     scopes the children.
--
-- ticket_canned_responses:
--     authenticated user must be is_super_admin() — these are admin
--     templates, never user-facing.
--
-- ─── Anon-scoped policies (untouched) ────────────────────────
-- Public help form and ticket-status-by-token paths use anon policies
-- gated by the access_token UUID in the x-ticket-token request header.
-- Those policies are defined in 20260404_003_fix_ticket_rls.sql and
-- are not affected by this migration.
--
-- Idempotent — safe to re-run.
-- ============================================================

DO $$
BEGIN
  -- ─── support_tickets ────────────────────────────────────
  -- Drop every known variant of the broad authenticated policy
  EXECUTE 'DROP POLICY IF EXISTS "auth_all_tickets" ON public.support_tickets';
  EXECUTE 'DROP POLICY IF EXISTS "support_tickets_admin_all" ON public.support_tickets';
  EXECUTE 'DROP POLICY IF EXISTS "admin_all_tickets" ON public.support_tickets';
  EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can manage tickets" ON public.support_tickets';
  EXECUTE 'DROP POLICY IF EXISTS "support_tickets_authenticated" ON public.support_tickets';

  EXECUTE $POL$
    CREATE POLICY "support_tickets_authenticated" ON public.support_tickets
    FOR ALL TO authenticated
    USING (
      is_super_admin()
      OR submitter_email = auth.email()
      OR assigned_to = auth.uid()
    )
    WITH CHECK (
      is_super_admin()
      OR submitter_email = auth.email()
      OR assigned_to = auth.uid()
    )
  $POL$;
  RAISE NOTICE 'support_tickets: tightened authenticated policy installed';

  -- ─── ticket_messages ────────────────────────────────────
  EXECUTE 'DROP POLICY IF EXISTS "auth_all_messages" ON public.ticket_messages';
  EXECUTE 'DROP POLICY IF EXISTS "ticket_messages_admin_all" ON public.ticket_messages';
  EXECUTE 'DROP POLICY IF EXISTS "admin_all_ticket_messages" ON public.ticket_messages';
  EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can manage messages" ON public.ticket_messages';
  EXECUTE 'DROP POLICY IF EXISTS "ticket_messages_authenticated" ON public.ticket_messages';

  EXECUTE $POL$
    CREATE POLICY "ticket_messages_authenticated" ON public.ticket_messages
    FOR ALL TO authenticated
    USING (
      is_super_admin()
      OR EXISTS (
        SELECT 1 FROM public.support_tickets st
        WHERE st.id = ticket_messages.ticket_id
          AND (st.submitter_email = auth.email() OR st.assigned_to = auth.uid())
      )
    )
    WITH CHECK (
      is_super_admin()
      OR EXISTS (
        SELECT 1 FROM public.support_tickets st
        WHERE st.id = ticket_messages.ticket_id
          AND (st.submitter_email = auth.email() OR st.assigned_to = auth.uid())
      )
    )
  $POL$;
  RAISE NOTICE 'ticket_messages: tightened authenticated policy installed';

  -- ─── ticket_events ──────────────────────────────────────
  EXECUTE 'DROP POLICY IF EXISTS "auth_all_events" ON public.ticket_events';
  EXECUTE 'DROP POLICY IF EXISTS "ticket_events_admin_all" ON public.ticket_events';
  EXECUTE 'DROP POLICY IF EXISTS "admin_all_ticket_events" ON public.ticket_events';
  EXECUTE 'DROP POLICY IF EXISTS "ticket_events_authenticated" ON public.ticket_events';

  EXECUTE $POL$
    CREATE POLICY "ticket_events_authenticated" ON public.ticket_events
    FOR ALL TO authenticated
    USING (
      is_super_admin()
      OR EXISTS (
        SELECT 1 FROM public.support_tickets st
        WHERE st.id = ticket_events.ticket_id
          AND (st.submitter_email = auth.email() OR st.assigned_to = auth.uid())
      )
    )
    WITH CHECK (
      is_super_admin()
      OR EXISTS (
        SELECT 1 FROM public.support_tickets st
        WHERE st.id = ticket_events.ticket_id
          AND (st.submitter_email = auth.email() OR st.assigned_to = auth.uid())
      )
    )
  $POL$;
  RAISE NOTICE 'ticket_events: tightened authenticated policy installed';

  -- ─── ticket_canned_responses (admin-only templates) ────
  EXECUTE 'DROP POLICY IF EXISTS "auth_all_canned" ON public.ticket_canned_responses';
  EXECUTE 'DROP POLICY IF EXISTS "ticket_canned_admin_all" ON public.ticket_canned_responses';
  EXECUTE 'DROP POLICY IF EXISTS "admin_all_canned" ON public.ticket_canned_responses';
  EXECUTE 'DROP POLICY IF EXISTS "ticket_canned_authenticated" ON public.ticket_canned_responses';

  EXECUTE $POL$
    CREATE POLICY "ticket_canned_authenticated" ON public.ticket_canned_responses
    FOR ALL TO authenticated
    USING (is_super_admin())
    WITH CHECK (is_super_admin())
  $POL$;
  RAISE NOTICE 'ticket_canned_responses: super_admin-only policy installed';
END $$;

-- ─── Verification ────────────────────────────────────────
-- Logs the qual / with_check expressions on each ticket table after
-- the migration runs, so anything still reading "true" stands out
-- in the Supabase Studio logs.
DO $$
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE 'Post-Phase-C policy state on ticket tables:';
  FOR rec IN
    SELECT tablename, policyname, cmd, roles::text AS roles,
           coalesce(qual, '-') AS qual,
           coalesce(with_check, '-') AS with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('support_tickets', 'ticket_messages', 'ticket_events', 'ticket_canned_responses')
    ORDER BY tablename, policyname
  LOOP
    RAISE NOTICE '  - %.% [cmd=%, roles=%]: qual=%, check=%',
      rec.tablename, rec.policyname, rec.cmd, rec.roles, rec.qual, rec.with_check;
  END LOOP;
END $$;
