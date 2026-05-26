-- Migration: Add 'particulier' role to profiles
-- This merges buyer/seller into a single 'particulier' role for non-agent users

-- 1. Update CHECK constraint to allow 'particulier'
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'manager', 'agent', 'assistant', 'seller', 'buyer', 'particulier'));

-- 2. Update trigger to default to 'particulier' instead of 'buyer'
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', NEW.raw_user_meta_data ->> 'picture', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'particulier')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
