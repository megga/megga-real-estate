-- ============================================================================
-- Migration: Sprint 3 — Extension du domaine contacts.type
-- Date: 2026-05-16
--
-- Problème (red-team G1) : la contrainte CHECK historique sur contacts.type
--   ('buyer', 'seller', 'both', 'lead')
-- rejette les valeurs 'tenant', 'landlord', 'investor' que le type TypeScript
-- ContactType (src/types/contact.ts) accepte depuis longtemps. Sprint 3
-- (Import Lead IA) extrait explicitement intent ∈ {buyer, seller, tenant}
-- depuis un message libre → premier import de locataire produit aujourd'hui
-- une erreur PostgreSQL 23514 (check_violation) bloquante.
--
-- Solution : aligner le domaine SQL sur le type TS, sans renommer ni casser
-- les données existantes. Idempotent.
--
-- Spec : RED_TEAM_SPRINT_3.md §G.2 G1.
-- ============================================================================

-- Drop la contrainte historique (nommée automatiquement par PG dans la
-- migration 003 → format `contacts_type_check`).
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_type_check;

-- Recrée la contrainte avec le domaine élargi. Conserve les 4 valeurs
-- historiques + ajoute tenant / landlord / investor (cf. ContactType TS).
ALTER TABLE contacts
  ADD CONSTRAINT contacts_type_check
  CHECK (type IN ('buyer', 'seller', 'tenant', 'landlord', 'investor', 'both', 'lead'));

COMMENT ON CONSTRAINT contacts_type_check ON contacts IS
  'Sprint 3 : domaine élargi pour absorber l''extraction Import Lead IA (intent ∈ {buyer, seller, tenant}) et matcher le type ContactType côté front. 4 valeurs historiques préservées.';
