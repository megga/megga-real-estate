-- Fix support_tickets: add missing columns expected by admin panel
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS agency_id UUID REFERENCES agencies(id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_agency ON support_tickets(agency_id);
