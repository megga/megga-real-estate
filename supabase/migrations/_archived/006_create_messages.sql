-- Migration 006: Create messaging tables
-- message_threads + messages with Realtime support

CREATE TABLE message_threads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID NOT NULL,
  property_id UUID,
  property_title TEXT,
  contact_id UUID REFERENCES contacts(id),
  contact_name TEXT NOT NULL,
  contact_type TEXT NOT NULL CHECK (contact_type IN ('buyer', 'seller')),
  last_message TEXT,
  last_message_at TIMESTAMPTZ DEFAULT now(),
  unread_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('agent', 'contact')),
  sender_name TEXT NOT NULL,
  content TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Threads: agents see threads in their agency
CREATE POLICY "Agents can read agency threads"
  ON message_threads FOR SELECT
  USING (agency_id IN (SELECT p.agency_id FROM profiles p WHERE p.id = auth.uid()));

CREATE POLICY "Agents can insert agency threads"
  ON message_threads FOR INSERT
  WITH CHECK (agency_id IN (SELECT p.agency_id FROM profiles p WHERE p.id = auth.uid()));

CREATE POLICY "Agents can update agency threads"
  ON message_threads FOR UPDATE
  USING (agency_id IN (SELECT p.agency_id FROM profiles p WHERE p.id = auth.uid()));

-- Threads: sellers see threads where they are the contact
CREATE POLICY "Contacts can read their threads"
  ON message_threads FOR SELECT
  USING (
    contact_id IN (SELECT c.id FROM contacts c WHERE c.user_id = auth.uid())
  );

-- Messages: visible if user can see the thread
CREATE POLICY "Users can read thread messages"
  ON messages FOR SELECT
  USING (
    thread_id IN (
      SELECT t.id FROM message_threads t
      WHERE t.agency_id IN (SELECT p.agency_id FROM profiles p WHERE p.id = auth.uid())
      OR t.contact_id IN (SELECT c.id FROM contacts c WHERE c.user_id = auth.uid())
    )
  );

-- Messages: participants can send messages
CREATE POLICY "Agents can send messages"
  ON messages FOR INSERT
  WITH CHECK (
    thread_id IN (
      SELECT t.id FROM message_threads t
      WHERE t.agency_id IN (SELECT p.agency_id FROM profiles p WHERE p.id = auth.uid())
    )
  );

CREATE POLICY "Contacts can send messages"
  ON messages FOR INSERT
  WITH CHECK (
    thread_id IN (
      SELECT t.id FROM message_threads t
      WHERE t.contact_id IN (SELECT c.id FROM contacts c WHERE c.user_id = auth.uid())
    )
  );

-- Messages: users can update read_at on messages they received
CREATE POLICY "Users can mark messages as read"
  ON messages FOR UPDATE
  USING (sender_id != auth.uid());

-- Trigger: update thread on new message
CREATE OR REPLACE FUNCTION update_thread_on_new_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE message_threads
  SET
    last_message = NEW.content,
    last_message_at = NEW.created_at,
    unread_count = CASE
      WHEN NEW.sender_type = 'contact' THEN unread_count + 1
      ELSE unread_count
    END
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_new_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_thread_on_new_message();

-- Indexes
CREATE INDEX idx_messages_thread_id ON messages(thread_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_message_threads_agency_id ON message_threads(agency_id);
CREATE INDEX idx_message_threads_contact_id ON message_threads(contact_id);

-- Enable Realtime on messages table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
