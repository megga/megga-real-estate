-- Signature email persistée sur profiles
-- Phase 2 mail : auto-append à la fin du body lors d'un envoi depuis le CRM.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email_signature TEXT;

COMMENT ON COLUMN profiles.email_signature IS
  'Signature email auto-append en envoi via gmail-sync / outlook-mail-sync. Plain text ou HTML léger (no script).';
