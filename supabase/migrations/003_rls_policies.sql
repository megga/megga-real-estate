-- ============================================================
-- MEGGA Real Estate — Row Level Security Policies
-- Migration 003: Enable RLS + create policies for all tables
-- ============================================================

-- Helper: get the agency_id for the current user
CREATE OR REPLACE FUNCTION get_user_agency_id()
RETURNS UUID AS $$
  SELECT agency_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper: get the role for the current user
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ─── Enable RLS on all tables ──────────────────────────────

ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_events ENABLE ROW LEVEL SECURITY;

-- ─── Profiles ──────────────────────────────────────────────

-- Users can read their own profile
CREATE POLICY profiles_select_own ON profiles
  FOR SELECT USING (id = auth.uid());

-- Users can update their own profile
CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE USING (id = auth.uid());

-- Agents can see profiles in their agency
CREATE POLICY profiles_select_agency ON profiles
  FOR SELECT USING (agency_id = get_user_agency_id() AND get_user_agency_id() IS NOT NULL);

-- Service role can insert (trigger)
CREATE POLICY profiles_insert ON profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- ─── Agencies ──────────────────────────────────────────────

-- Members can see their agency
CREATE POLICY agencies_select ON agencies
  FOR SELECT USING (id = get_user_agency_id());

-- Admins can update their agency
CREATE POLICY agencies_update ON agencies
  FOR UPDATE USING (
    id = get_user_agency_id()
    AND get_user_role() IN ('admin', 'manager')
  );

-- Anyone can create an agency (during registration)
CREATE POLICY agencies_insert ON agencies
  FOR INSERT WITH CHECK (true);

-- ─── Contacts ──────────────────────────────────────────────

-- Agents see contacts in their agency
CREATE POLICY contacts_select ON contacts
  FOR SELECT USING (agency_id = get_user_agency_id());

-- Agents can create contacts in their agency
CREATE POLICY contacts_insert ON contacts
  FOR INSERT WITH CHECK (agency_id = get_user_agency_id());

-- Agents can update contacts in their agency
CREATE POLICY contacts_update ON contacts
  FOR UPDATE USING (agency_id = get_user_agency_id());

-- Agents can delete contacts in their agency
CREATE POLICY contacts_delete ON contacts
  FOR DELETE USING (agency_id = get_user_agency_id());

-- ─── Properties ────────────────────────────────────────────

-- Agents see properties in their agency
CREATE POLICY properties_select_agency ON properties
  FOR SELECT USING (agency_id = get_user_agency_id());

-- Public: anyone can see active properties
CREATE POLICY properties_select_public ON properties
  FOR SELECT USING (status = 'active');

-- Agents can create properties in their agency
CREATE POLICY properties_insert ON properties
  FOR INSERT WITH CHECK (agency_id = get_user_agency_id());

-- Agents can update properties in their agency
CREATE POLICY properties_update ON properties
  FOR UPDATE USING (agency_id = get_user_agency_id());

-- ─── Listings ──────────────────────────────────────────────

-- Public: anyone can see published listings
CREATE POLICY listings_select_public ON listings
  FOR SELECT USING (published_at IS NOT NULL AND (expires_at IS NULL OR expires_at > now()));

-- Agents see all listings in their agency
CREATE POLICY listings_select_agency ON listings
  FOR SELECT USING (agency_id = get_user_agency_id());

-- Agents can create listings in their agency
CREATE POLICY listings_insert ON listings
  FOR INSERT WITH CHECK (agency_id = get_user_agency_id());

-- Agents can update listings in their agency
CREATE POLICY listings_update ON listings
  FOR UPDATE USING (agency_id = get_user_agency_id());

-- Agents can delete listings in their agency
CREATE POLICY listings_delete ON listings
  FOR DELETE USING (agency_id = get_user_agency_id());

-- ─── Transactions ──────────────────────────────────────────

-- Agents see transactions in their agency
CREATE POLICY transactions_select ON transactions
  FOR SELECT USING (agency_id = get_user_agency_id());

CREATE POLICY transactions_insert ON transactions
  FOR INSERT WITH CHECK (agency_id = get_user_agency_id());

CREATE POLICY transactions_update ON transactions
  FOR UPDATE USING (agency_id = get_user_agency_id());

-- ─── KYC Cases ─────────────────────────────────────────────

-- Agents see KYC cases in their agency
CREATE POLICY kyc_cases_select ON kyc_cases
  FOR SELECT USING (agency_id = get_user_agency_id());

CREATE POLICY kyc_cases_insert ON kyc_cases
  FOR INSERT WITH CHECK (agency_id = get_user_agency_id());

CREATE POLICY kyc_cases_update ON kyc_cases
  FOR UPDATE USING (agency_id = get_user_agency_id());

-- ─── KYC Checklist Items ───────────────────────────────────

-- Access through parent kyc_case
CREATE POLICY kyc_items_select ON kyc_checklist_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM kyc_cases WHERE kyc_cases.id = kyc_checklist_items.kyc_case_id AND kyc_cases.agency_id = get_user_agency_id())
  );

CREATE POLICY kyc_items_insert ON kyc_checklist_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM kyc_cases WHERE kyc_cases.id = kyc_checklist_items.kyc_case_id AND kyc_cases.agency_id = get_user_agency_id())
  );

CREATE POLICY kyc_items_update ON kyc_checklist_items
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM kyc_cases WHERE kyc_cases.id = kyc_checklist_items.kyc_case_id AND kyc_cases.agency_id = get_user_agency_id())
  );

-- ─── Documents ─────────────────────────────────────────────

CREATE POLICY documents_select ON documents
  FOR SELECT USING (agency_id = get_user_agency_id());

CREATE POLICY documents_insert ON documents
  FOR INSERT WITH CHECK (agency_id = get_user_agency_id());

CREATE POLICY documents_update ON documents
  FOR UPDATE USING (agency_id = get_user_agency_id());

CREATE POLICY documents_delete ON documents
  FOR DELETE USING (agency_id = get_user_agency_id());

-- ─── Message Threads ───────────────────────────────────────

-- Users can see threads they participate in
CREATE POLICY threads_select ON message_threads
  FOR SELECT USING (auth.uid() = ANY(participants));

CREATE POLICY threads_insert ON message_threads
  FOR INSERT WITH CHECK (auth.uid() = ANY(participants));

CREATE POLICY threads_update ON message_threads
  FOR UPDATE USING (auth.uid() = ANY(participants));

-- ─── Messages ──────────────────────────────────────────────

-- Users can see messages in their threads
CREATE POLICY messages_select ON messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM message_threads WHERE message_threads.id = messages.thread_id AND auth.uid() = ANY(message_threads.participants))
  );

-- Users can send messages in their threads
CREATE POLICY messages_insert ON messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (SELECT 1 FROM message_threads WHERE message_threads.id = messages.thread_id AND auth.uid() = ANY(message_threads.participants))
  );

-- ─── Favorites ─────────────────────────────────────────────

-- Users see their own favorites
CREATE POLICY favorites_select ON favorites
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY favorites_insert ON favorites
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY favorites_delete ON favorites
  FOR DELETE USING (user_id = auth.uid());

-- ─── Activity Events ───────────────────────────────────────

-- Agents see events in their agency
CREATE POLICY events_select ON activity_events
  FOR SELECT USING (agency_id = get_user_agency_id());

-- Anyone authenticated can insert events
CREATE POLICY events_insert ON activity_events
  FOR INSERT WITH CHECK (actor_id = auth.uid());
