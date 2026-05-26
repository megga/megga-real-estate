-- Migration : enable marketplace buyers (auth.users) to initiate threads
-- with an agency without requiring a CRM contacts row.
--
-- Model: threads are scoped by (buyer_user_id, property_id) — a buyer gets
-- one thread per listing they contact. No auto-assignment: every agent of
-- the agency sees new threads in a shared inbox (Zillow-style).

-- 1. Add buyer_user_id (references auth.users) and loosen contact_id
ALTER TABLE message_threads
  ADD COLUMN IF NOT EXISTS buyer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Make contact_id nullable — for public buyers we don't require a CRM
-- contacts row. Existing agent-side threads keep their contact_id.
ALTER TABLE message_threads
  ALTER COLUMN contact_id DROP NOT NULL;

-- 2. Prevent duplicate threads for the same (buyer, listing)
-- NULLS NOT DISTINCT treats two NULL property_ids as equal, so a buyer
-- has at most one "general inquiry" thread (no property) per agency.
CREATE UNIQUE INDEX IF NOT EXISTS idx_threads_unique_buyer_property
  ON message_threads (buyer_user_id, property_id, agency_id)
  WHERE buyer_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_threads_buyer_user
  ON message_threads (buyer_user_id, last_message_at DESC)
  WHERE buyer_user_id IS NOT NULL;

-- 3. RLS — buyers read/update their own threads
DROP POLICY IF EXISTS "Buyers read their threads" ON message_threads;
CREATE POLICY "Buyers read their threads"
  ON message_threads FOR SELECT
  USING (buyer_user_id = auth.uid());

DROP POLICY IF EXISTS "Buyers update their threads" ON message_threads;
CREATE POLICY "Buyers update their threads"
  ON message_threads FOR UPDATE
  USING (buyer_user_id = auth.uid());

-- Messages: a buyer can read/write messages on threads they own
DROP POLICY IF EXISTS "Buyers read their messages" ON messages;
CREATE POLICY "Buyers read their messages"
  ON messages FOR SELECT
  USING (
    thread_id IN (
      SELECT id FROM message_threads WHERE buyer_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Buyers send messages" ON messages;
CREATE POLICY "Buyers send messages"
  ON messages FOR INSERT
  WITH CHECK (
    thread_id IN (
      SELECT id FROM message_threads WHERE buyer_user_id = auth.uid()
    )
    AND sender_type = 'contact'
    AND sender_id = auth.uid()
  );

COMMENT ON COLUMN message_threads.buyer_user_id IS
  'auth.users id of the public marketplace buyer who initiated the thread. NULL for agent-only threads (agent-contact relationship from the CRM).';

-- 4. Seed a default "MEGGA Platform" agency that receives all public
-- marketplace inquiries until individual agencies claim their listings.
-- Keep the UUID fixed so the Edge Function can reference it as a constant.
INSERT INTO agencies (id, name, slug, plan)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'MEGGA Platform',
  'megga-platform',
  'starter'
)
ON CONFLICT (id) DO NOTHING;
