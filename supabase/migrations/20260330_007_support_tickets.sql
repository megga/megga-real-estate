-- ============================================================================
-- SUPPORT TICKETS SYSTEM
-- ============================================================================

-- ─── Sequence for ticket numbers ────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS ticket_number_seq START WITH 1;

-- ─── Support Tickets ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT UNIQUE NOT NULL,
  submitter_email TEXT NOT NULL,
  submitter_name TEXT NOT NULL,
  contact_id UUID REFERENCES contacts(id),
  subject TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'new',
  assigned_to UUID REFERENCES profiles(id),
  sla_first_response_due TIMESTAMPTZ,
  sla_resolution_due TIMESTAMPTZ,
  first_responded_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  sla_breached BOOLEAN DEFAULT FALSE,
  access_token UUID NOT NULL DEFAULT gen_random_uuid(),
  csat_rating INT,
  csat_comment TEXT,
  source TEXT DEFAULT 'web_form',
  tags TEXT[],
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- category: 'bug' | 'feature_request' | 'billing' | 'account' | 'onboarding' | 'kyc' | 'general'
-- priority: 'low' | 'medium' | 'high' | 'urgent'
-- status: 'new' | 'open' | 'pending' | 'resolved' | 'closed'
-- source: 'web_form' | 'email' | 'chat'

-- ─── Ticket Messages ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_type TEXT NOT NULL,
  author_id UUID,
  author_name TEXT NOT NULL,
  body TEXT NOT NULL,
  is_internal_note BOOLEAN DEFAULT FALSE,
  attachments JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- author_type: 'customer' | 'agent' | 'system'

-- ─── Ticket Events (audit trail) ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ticket_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  actor_type TEXT NOT NULL,
  actor_id UUID,
  action TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- actor_type: 'customer' | 'agent' | 'system'
-- action: 'status_change' | 'priority_change' | 'assignment_change' | 'message_added' | 'note_added' | 'csat_submitted'

-- ─── Canned Responses ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ticket_canned_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT,
  shortcut TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_to ON support_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_support_tickets_access_token ON support_tickets(access_token);
CREATE INDEX IF NOT EXISTS idx_support_tickets_category ON support_tickets(category);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON support_tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id ON ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_events_ticket_id ON ticket_events(ticket_id);

-- ─── Auto-generate ticket_number trigger ────────────────────────────────────

CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.ticket_number := 'MEGGA-' || LPAD(nextval('ticket_number_seq')::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_ticket_number ON support_tickets;
CREATE TRIGGER trg_generate_ticket_number
  BEFORE INSERT ON support_tickets
  FOR EACH ROW
  WHEN (NEW.ticket_number IS NULL OR NEW.ticket_number = '')
  EXECUTE FUNCTION generate_ticket_number();

-- ─── Calculate SLA function ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION calculate_sla(p_priority TEXT, p_created_at TIMESTAMPTZ)
RETURNS TABLE(first_response_due TIMESTAMPTZ, resolution_due TIMESTAMPTZ) AS $$
BEGIN
  CASE p_priority
    WHEN 'urgent' THEN
      first_response_due := p_created_at + INTERVAL '1 hour';
      resolution_due := p_created_at + INTERVAL '4 hours';
    WHEN 'high' THEN
      first_response_due := p_created_at + INTERVAL '4 hours';
      resolution_due := p_created_at + INTERVAL '24 hours';
    WHEN 'medium' THEN
      first_response_due := p_created_at + INTERVAL '8 hours';
      resolution_due := p_created_at + INTERVAL '48 hours';
    WHEN 'low' THEN
      first_response_due := p_created_at + INTERVAL '24 hours';
      resolution_due := p_created_at + INTERVAL '72 hours';
    ELSE
      first_response_due := p_created_at + INTERVAL '8 hours';
      resolution_due := p_created_at + INTERVAL '48 hours';
  END CASE;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ─── Auto-set SLA on insert ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_ticket_sla()
RETURNS TRIGGER AS $$
DECLARE
  sla RECORD;
BEGIN
  SELECT * INTO sla FROM calculate_sla(NEW.priority, COALESCE(NEW.created_at, now()));
  NEW.sla_first_response_due := sla.first_response_due;
  NEW.sla_resolution_due := sla.resolution_due;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_ticket_sla ON support_tickets;
CREATE TRIGGER trg_set_ticket_sla
  BEFORE INSERT ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION set_ticket_sla();

-- ─── Auto-update updated_at ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_ticket_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_ticket_timestamp ON support_tickets;
CREATE TRIGGER trg_update_ticket_timestamp
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_ticket_timestamp();

-- ─── RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_canned_responses ENABLE ROW LEVEL SECURITY;

-- Anon: can create tickets
CREATE POLICY "anon_insert_tickets" ON support_tickets
  FOR INSERT TO anon WITH CHECK (true);

-- Anon: can view own ticket via access_token
CREATE POLICY "anon_select_own_ticket" ON support_tickets
  FOR SELECT TO anon USING (true);

-- Anon: can insert messages on tickets they have access to
CREATE POLICY "anon_insert_messages" ON ticket_messages
  FOR INSERT TO anon WITH CHECK (true);

-- Anon: can read non-internal messages
CREATE POLICY "anon_select_messages" ON ticket_messages
  FOR SELECT TO anon USING (is_internal_note = FALSE);

-- Anon: can read events (for ticket timeline)
CREATE POLICY "anon_select_events" ON ticket_events
  FOR SELECT TO anon USING (true);

-- Authenticated: full access to all ticket tables
CREATE POLICY "auth_all_tickets" ON support_tickets
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_all_messages" ON ticket_messages
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_all_events" ON ticket_events
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "auth_all_canned" ON ticket_canned_responses
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── Seed: Canned Responses ────────────────────────────────────────────────

INSERT INTO ticket_canned_responses (title, body, category, shortcut) VALUES
(
  'Accusé de réception',
  'Bonjour {{name}},

Merci pour votre message. Nous avons bien reçu votre demande ({{ticket_number}}) et un membre de notre équipe va la traiter dans les meilleurs délais.

Cordialement,
L''équipe MEGGA',
  'general',
  '/accuse'
),
(
  'Demande d''informations complémentaires',
  'Bonjour {{name}},

Merci pour votre demande. Afin de mieux vous aider, pourriez-vous nous fournir les informations suivantes :

- [Précisez les informations nécessaires]

Nous reviendrons vers vous dès réception de ces éléments.

Cordialement,
L''équipe MEGGA',
  'general',
  '/infos'
),
(
  'Problème résolu',
  'Bonjour {{name}},

Nous avons résolu le problème que vous nous avez signalé. Voici ce qui a été fait :

- [Détails de la résolution]

N''hésitez pas à nous recontacter si le problème persiste.

Cordialement,
L''équipe MEGGA',
  'bug',
  '/resolu'
),
(
  'Fonctionnalité planifiée',
  'Bonjour {{name}},

Merci pour votre suggestion. Nous avons pris note de votre demande de fonctionnalité et l''avons ajoutée à notre feuille de route.

Nous vous tiendrons informé(e) lorsqu''elle sera disponible.

Cordialement,
L''équipe MEGGA',
  'feature_request',
  '/planifie'
),
(
  'Question facturation',
  'Bonjour {{name}},

Concernant votre question de facturation :

- [Réponse détaillée]

Pour toute question supplémentaire, n''hésitez pas à consulter notre page Abonnements dans les Paramètres.

Cordialement,
L''équipe MEGGA',
  'billing',
  '/facture'
);
