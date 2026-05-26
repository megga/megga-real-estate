-- Soft-delete columns for nLPD art. 32 (right to erasure) + LBA art. 7 al. 3 retention
-- profiles.deleted_at: marker for anonymised accounts
-- contacts.deleted_user_id: link back to the original user_id that was deleted
BEGIN;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS deleted_user_id UUID;

CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at
  ON profiles(deleted_at) WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_deleted_user_id
  ON contacts(deleted_user_id) WHERE deleted_user_id IS NOT NULL;

COMMIT;
