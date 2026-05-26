-- ============================================================
-- MEGGA Real Estate — Core Tables
-- Migration 002: Create all core tables
-- ============================================================

-- ─── Custom Types ───────────────────────────────────────────

CREATE TYPE user_role AS ENUM ('buyer', 'seller', 'agent', 'manager', 'admin', 'assistant');
CREATE TYPE property_type AS ENUM ('apartment', 'house', 'villa', 'commercial', 'land');
CREATE TYPE property_status AS ENUM ('draft', 'active', 'reserved', 'sold', 'archived');
CREATE TYPE contact_type AS ENUM ('buyer', 'seller', 'both', 'lead');
CREATE TYPE contact_score AS ENUM ('hot', 'warm', 'cold');
CREATE TYPE transaction_stage AS ENUM ('lead', 'qualified', 'visit_planned', 'offer', 'negotiation', 'reserved', 'financing', 'notary', 'signed', 'closed');
CREATE TYPE transaction_status AS ENUM ('active', 'on_hold', 'cancelled', 'completed');
CREATE TYPE mandate_type AS ENUM ('simple', 'semi_exclusive', 'exclusive');
CREATE TYPE kyc_person_type AS ENUM ('buyer_pp', 'buyer_pm', 'seller_pp', 'seller_pm');
CREATE TYPE kyc_risk_level AS ENUM ('low', 'medium', 'high', 'unassessed');
CREATE TYPE kyc_status AS ENUM ('pending', 'in_progress', 'review', 'validated', 'rejected');
CREATE TYPE document_status AS ENUM ('pending', 'validated', 'rejected');
CREATE TYPE agency_plan AS ENUM ('starter', 'pro', 'agency', 'enterprise');

-- ─── 1. Agencies ────────────────────────────────────────────

CREATE TABLE agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  plan agency_plan NOT NULL DEFAULT 'starter',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 2. Profiles (extends auth.users) ──────────────────────

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  agency_id UUID REFERENCES agencies(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  role user_role NOT NULL DEFAULT 'buyer',
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 3. Contacts ────────────────────────────────────────────

CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  type contact_type NOT NULL DEFAULT 'lead',
  source TEXT,
  score contact_score NOT NULL DEFAULT 'cold',
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 4. Properties ──────────────────────────────────────────

CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  type property_type NOT NULL DEFAULT 'apartment',
  status property_status NOT NULL DEFAULT 'draft',
  price NUMERIC(12,2),
  currency TEXT NOT NULL DEFAULT 'CHF',
  rooms NUMERIC(3,1),
  bedrooms INTEGER,
  bathrooms INTEGER,
  surface_m2 NUMERIC(8,2),
  address TEXT,
  city TEXT,
  canton TEXT,
  postal_code TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  photos TEXT[] DEFAULT '{}',
  features JSONB DEFAULT '{}',
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ
);

-- ─── 5. Listings (published announcements) ──────────────────

CREATE TABLE listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description_ai TEXT,
  price_display TEXT,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_hot BOOLEAN NOT NULL DEFAULT false,
  views_count INTEGER NOT NULL DEFAULT 0,
  favorites_count INTEGER NOT NULL DEFAULT 0,
  published_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);

-- ─── 6. Transactions / Deals ────────────────────────────────

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  contact_buyer_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  contact_seller_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  stage transaction_stage NOT NULL DEFAULT 'lead',
  status transaction_status NOT NULL DEFAULT 'active',
  price_offered NUMERIC(12,2),
  price_final NUMERIC(12,2),
  mandate_type mandate_type,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 7. KYC Cases ───────────────────────────────────────────

CREATE TABLE kyc_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  type kyc_person_type NOT NULL,
  risk_level kyc_risk_level NOT NULL DEFAULT 'unassessed',
  status kyc_status NOT NULL DEFAULT 'pending',
  completion_pct INTEGER NOT NULL DEFAULT 0,
  validated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 8. KYC Checklist Items ─────────────────────────────────

CREATE TABLE kyc_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kyc_case_id UUID NOT NULL REFERENCES kyc_cases(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  category TEXT,
  is_required BOOLEAN NOT NULL DEFAULT true,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  document_id UUID,
  notes TEXT,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- ─── 9. Documents ───────────────────────────────────────────

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  kyc_case_id UUID REFERENCES kyc_cases(id) ON DELETE SET NULL,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  type TEXT,
  storage_path TEXT NOT NULL,
  size_bytes BIGINT,
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status document_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add FK from kyc_checklist_items.document_id to documents
ALTER TABLE kyc_checklist_items
  ADD CONSTRAINT fk_checklist_document
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL;

-- ─── 10. Message Threads ────────────────────────────────────

CREATE TABLE message_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) ON DELETE SET NULL,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  participants UUID[] NOT NULL DEFAULT '{}',
  last_message_at TIMESTAMPTZ DEFAULT now()
);

-- ─── 11. Messages ───────────────────────────────────────────

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL DEFAULT 'user',
  content TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 12. Favorites ──────────────────────────────────────────

CREATE TABLE favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, listing_id)
);

-- ─── 13. Activity Events (Audit Trail) ─────────────────────

CREATE TABLE activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES agencies(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
