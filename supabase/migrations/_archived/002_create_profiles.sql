-- Migration 002: Create profiles table
-- Stores user profile data with role-based access.
--
-- Made idempotent (CREATE … IF NOT EXISTS, DROP+CREATE for policies/triggers)
-- so `supabase start` can replay the full migration history locally without
-- crashing on objects already created by 002_core_tables.sql.

CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  agency_id UUID,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'buyer' CHECK (role IN ('admin', 'manager', 'agent', 'assistant', 'seller', 'buyer')),
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS (no-op if already enabled)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Users can insert their own profile (during signup)
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Agents can read profiles in their agency
DROP POLICY IF EXISTS "Agents can read agency profiles" ON profiles;
CREATE POLICY "Agents can read agency profiles"
  ON profiles FOR SELECT
  USING (
    agency_id IS NOT NULL
    AND agency_id IN (SELECT p.agency_id FROM profiles p WHERE p.id = auth.uid())
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_agency_id ON profiles(agency_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Auto-create profile on signup via trigger
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'buyer')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
