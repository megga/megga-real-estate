-- Restore the user_id column on contacts that the (now archived) legacy
-- migration 003_create_contacts.sql used to add. Other migrations (notably
-- 004_create_offers.sql RLS policies) reference contacts.user_id, so without
-- this column `supabase start` fails on a fresh local DB.
--
-- In prod the column already exists (it was added the first time the legacy
-- migration ran), so this `ADD COLUMN IF NOT EXISTS` is a no-op.
-- Idempotent for safe local replays.

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
