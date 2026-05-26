-- ============================================================================
-- Migration: Enriched CRM Tables (Étape 1/6 — Migration CRM Agent)
-- Date: 2026-03-19
-- Description: Creates 7 new tables for the enriched CRM pipeline + enriches
--              contacts and transactions tables for Gregory Lyonnet's workflow.
-- ============================================================================

-- ============================================================================
-- 1. NEW TABLES (in FK dependency order)
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1a. message_templates — Templates de messages (relances, confirmations...)
-- No external FK dependencies
-- --------------------------------------------------------------------------
CREATE TABLE message_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'follow_up', 'visit_confirmation', 'property_presentation',
    'post_visit', 'objection_response', 'offer_follow_up',
    'thank_you', 'seller_update'
  )),
  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp', 'both')),
  subject TEXT,
  body TEXT NOT NULL,
  is_ai_generated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- --------------------------------------------------------------------------
-- 1b. client_searches — Recherches sauvegardées par client (matching)
-- FK → contacts
-- --------------------------------------------------------------------------
CREATE TABLE client_searches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE NOT NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE NOT NULL,
  label TEXT,
  criteria JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_matched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- --------------------------------------------------------------------------
-- 1c. matches — Matching acheteurs ↔ biens
-- FK → contacts, properties, client_searches
-- --------------------------------------------------------------------------
CREATE TABLE matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE NOT NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE NOT NULL,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  client_search_id UUID REFERENCES client_searches(id) ON DELETE SET NULL,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  reasons JSONB,
  status TEXT NOT NULL DEFAULT 'suggested' CHECK (status IN (
    'suggested', 'sent', 'visit_planned', 'interested', 'rejected', 'ignored'
  )),
  sent_via TEXT CHECK (sent_via IN ('email', 'whatsapp', 'both')),
  sent_at TIMESTAMPTZ,
  response_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- --------------------------------------------------------------------------
-- 1d. reminders — Relances et rappels automatiques
-- FK → contacts, properties, transactions, matches (all nullable)
-- --------------------------------------------------------------------------
CREATE TABLE reminders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE NOT NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN (
    'follow_up_sent_property', 'post_visit_feedback', 'dormant_lead',
    'missing_document', 'price_change', 'custom'
  )),
  trigger_rule TEXT NOT NULL CHECK (trigger_rule IN (
    'days_after_event', 'no_response', 'inactivity', 'manual'
  )),
  trigger_days INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'triggered', 'done', 'cancelled', 'snoozed'
  )),
  trigger_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  message_template TEXT,
  channel TEXT CHECK (channel IN ('email', 'whatsapp', 'task', 'notification')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- --------------------------------------------------------------------------
-- 1e. automation_rules — Règles d'automatisation configurées par l'agent
-- FK → message_templates
-- --------------------------------------------------------------------------
CREATE TABLE automation_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  trigger_event TEXT NOT NULL CHECK (trigger_event IN (
    'property_sent', 'visit_completed', 'lead_inactive',
    'document_missing', 'new_match'
  )),
  action TEXT NOT NULL CHECK (action IN (
    'create_reminder', 'send_email', 'send_whatsapp',
    'create_task', 'notify_agent'
  )),
  delay_days INTEGER DEFAULT 3,
  template_id UUID REFERENCES message_templates(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- --------------------------------------------------------------------------
-- 1f. visits — Visites planifiées et effectuées
-- FK → properties, contacts, transactions
-- --------------------------------------------------------------------------
CREATE TABLE visits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE NOT NULL,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE NOT NULL,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN (
    'planned', 'confirmed', 'done', 'cancelled', 'no_show'
  )),
  feedback_buyer TEXT,
  feedback_agent TEXT,
  ai_objections JSONB,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- --------------------------------------------------------------------------
-- 1g. daily_actions — Actions du jour générées par IA
-- FK → agencies, profiles
-- --------------------------------------------------------------------------
CREATE TABLE daily_actions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE NOT NULL,
  agent_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('urgent', 'high', 'medium', 'low')),
  category TEXT NOT NULL CHECK (category IN (
    'follow_up', 'match_found', 'visit_confirm',
    'document_missing', 'deal_at_risk', 'suggestion'
  )),
  title TEXT NOT NULL,
  description TEXT,
  entity_type TEXT,
  entity_id UUID,
  action_type TEXT CHECK (action_type IN (
    'call', 'email', 'whatsapp', 'send_property',
    'plan_visit', 'review_document', 'adjust_price'
  )),
  is_completed BOOLEAN DEFAULT false,
  generated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);


-- ============================================================================
-- 2. ALTER TABLE contacts — Enrichir avec colonnes CRM avancées
-- ============================================================================

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT,
  ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'fr',
  ADD COLUMN IF NOT EXISTS nationality TEXT,
  ADD COLUMN IF NOT EXISTS budget_announced NUMERIC,
  ADD COLUMN IF NOT EXISTS budget_estimated_ai NUMERIC,
  ADD COLUMN IF NOT EXISTS search_zones TEXT[],
  ADD COLUMN IF NOT EXISTS search_criteria JSONB,
  ADD COLUMN IF NOT EXISTS ai_seriousness_score INTEGER,
  ADD COLUMN IF NOT EXISTS ai_purchase_probability INTEGER,
  ADD COLUMN IF NOT EXISTS ai_timing TEXT CHECK (ai_timing IN (
    'immediate', '1-3_months', '3-6_months', '6-12_months', 'long_term'
  )),
  ADD COLUMN IF NOT EXISTS ai_engagement_level TEXT CHECK (ai_engagement_level IN (
    'very_high', 'high', 'medium', 'low', 'dormant'
  )),
  ADD COLUMN IF NOT EXISTS ai_tension_level TEXT CHECK (ai_tension_level IN (
    'calm', 'moderate', 'tense', 'critical'
  )),
  ADD COLUMN IF NOT EXISTS ai_price_reduction_probability INTEGER,
  ADD COLUMN IF NOT EXISTS last_interaction_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();


-- ============================================================================
-- 3. ALTER TABLE transactions — Enrichir stage pour 15 étapes Gregory
-- ============================================================================

-- Drop the old stage constraint and replace with the enriched 15-stage pipeline
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_stage_check;

ALTER TABLE transactions
  ADD CONSTRAINT transactions_stage_check CHECK (stage IN (
    'new_lead', 'to_qualify', 'active_search', 'visit_planned', 'visit_done',
    'interest_confirmed', 'offer', 'negotiation', 'reserved',
    'financing', 'notary', 'signed', 'closed',
    'lost', 'to_recontact',
    -- Legacy stages kept for backward compatibility during migration
    'lead', 'qualified', 'visit_planned_legacy'
  ));


-- ============================================================================
-- 4. ROW LEVEL SECURITY — Toutes les nouvelles tables
-- ============================================================================

-- message_templates
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agents_own_agency" ON message_templates FOR ALL USING (
  agency_id = (SELECT agency_id FROM profiles WHERE id = auth.uid())
);

-- client_searches
ALTER TABLE client_searches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agents_own_agency" ON client_searches FOR ALL USING (
  agency_id = (SELECT agency_id FROM profiles WHERE id = auth.uid())
);

-- matches
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agents_own_agency" ON matches FOR ALL USING (
  agency_id = (SELECT agency_id FROM profiles WHERE id = auth.uid())
);

-- reminders
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agents_own_agency" ON reminders FOR ALL USING (
  agency_id = (SELECT agency_id FROM profiles WHERE id = auth.uid())
);

-- automation_rules
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agents_own_agency" ON automation_rules FOR ALL USING (
  agency_id = (SELECT agency_id FROM profiles WHERE id = auth.uid())
);

-- visits
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agents_own_agency" ON visits FOR ALL USING (
  agency_id = (SELECT agency_id FROM profiles WHERE id = auth.uid())
);

-- daily_actions (scoped to agent + agency)
ALTER TABLE daily_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agents_own_actions" ON daily_actions FOR ALL USING (
  agency_id = (SELECT agency_id FROM profiles WHERE id = auth.uid())
  AND agent_id = auth.uid()
);


-- ============================================================================
-- 5. PERFORMANCE INDEXES
-- ============================================================================

-- matches: lookup by contact or property + status
CREATE INDEX idx_matches_contact_status ON matches(contact_id, status);
CREATE INDEX idx_matches_property_status ON matches(property_id, status);

-- reminders: agency-wide query for pending/triggered reminders by date
CREATE INDEX idx_reminders_agency_status_trigger ON reminders(agency_id, status, trigger_at);

-- client_searches: active searches per contact
CREATE INDEX idx_client_searches_contact_active ON client_searches(contact_id, is_active);

-- daily_actions: agent's incomplete actions
CREATE INDEX idx_daily_actions_agent_incomplete ON daily_actions(agent_id, is_completed, generated_at);

-- visits: upcoming visits per property
CREATE INDEX idx_visits_property_scheduled ON visits(property_id, scheduled_at);

-- visits: upcoming visits per contact
CREATE INDEX idx_visits_contact_scheduled ON visits(contact_id, scheduled_at);

-- reminders: per contact lookup
CREATE INDEX idx_reminders_contact ON reminders(contact_id);

-- reminders: per transaction lookup
CREATE INDEX idx_reminders_transaction ON reminders(transaction_id);
