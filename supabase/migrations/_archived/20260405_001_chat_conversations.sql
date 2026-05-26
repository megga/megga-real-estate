-- Chat conversations (one per session)
CREATE TABLE IF NOT EXISTS chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_ref TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  category TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'escalated', 'closed')),
  accepted_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat messages within a conversation
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES chat_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_chat_conversations_user ON chat_conversations(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_chat_conversations_ref ON chat_conversations(conversation_ref);
CREATE INDEX idx_chat_messages_conversation ON chat_messages(conversation_id, created_at);

-- RLS
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own conversations" ON chat_conversations
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Anyone can create conversations" ON chat_conversations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users see own messages" ON chat_messages
  FOR ALL USING (
    conversation_id IN (SELECT id FROM chat_conversations WHERE user_id = auth.uid())
  );

CREATE POLICY "Anyone can insert messages" ON chat_messages
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role full access conversations" ON chat_conversations
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access messages" ON chat_messages
  FOR ALL USING (auth.role() = 'service_role');
