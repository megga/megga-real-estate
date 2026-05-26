-- ============================================================================
-- Migration: Sprint 3 — Extension défensive du type ENUM transaction_stage
-- Date: 2026-05-17
--
-- Problème (audit Sprint 3a, §A.1 note) : la contrainte CHECK
--   transactions_stage_check (migration 20260319_001:205) autorise les valeurs
--   'new_lead', 'to_qualify', 'active_search', 'visit_done',
--   'interest_confirmed', 'lost', 'to_recontact', 'visit_planned_legacy'
-- MAIS le type ENUM transaction_stage (migration 002_core_tables.sql:13) n'a
-- jamais été étendu avec ces valeurs. Le type reste sur les 10 valeurs
-- originales (lead, qualified, visit_planned, offer, negotiation, reserved,
-- financing, notary, signed, closed).
--
-- Conséquence : tout INSERT/UPDATE qui pose stage='new_lead' (ex.
-- useSellerLeads, NewTransactionDialog, le nouveau useImportLead Sprint 3a)
-- échoue avec invalid input value for enum transaction_stage, malgré le fait
-- que le CHECK accepte la valeur.
--
-- Hypothèse : soit la prod a été migrée hors-band (DDL via dashboard
-- Supabase), soit les inserts neufs cassent silencieusement et personne
-- ne s'en est rendu compte. Cette migration ferme la fuite des deux côtés
-- (idempotent — IF NOT EXISTS).
--
-- Note PG : ALTER TYPE ... ADD VALUE doit être une statement de top-niveau
-- (pas dans un DO block, pas dans une transaction Supabase auto-commit OK).
-- Les statements ci-dessous sont posées chacune au niveau racine du script.
--
-- Spec : RED_TEAM_SPRINT_3.md §G.G1 / AUDIT_SPRINT_3A.md §A.1.
-- ============================================================================

ALTER TYPE transaction_stage ADD VALUE IF NOT EXISTS 'new_lead';
ALTER TYPE transaction_stage ADD VALUE IF NOT EXISTS 'to_qualify';
ALTER TYPE transaction_stage ADD VALUE IF NOT EXISTS 'active_search';
ALTER TYPE transaction_stage ADD VALUE IF NOT EXISTS 'visit_done';
ALTER TYPE transaction_stage ADD VALUE IF NOT EXISTS 'interest_confirmed';
ALTER TYPE transaction_stage ADD VALUE IF NOT EXISTS 'lost';
ALTER TYPE transaction_stage ADD VALUE IF NOT EXISTS 'to_recontact';
ALTER TYPE transaction_stage ADD VALUE IF NOT EXISTS 'visit_planned_legacy';

-- Note : on conserve les anciennes valeurs (lead, qualified, etc.) en place
-- pour la backward compat — la CHECK constraint elle-même les liste comme
-- "Legacy stages kept for backward compatibility during migration".

COMMENT ON TYPE transaction_stage IS
  'Sprint 3 (A.1 note) : enum aligné sur la CHECK constraint transactions_stage_check. 18 valeurs au total : 10 originales (lead, qualified, visit_planned, offer, negotiation, reserved, financing, notary, signed, closed) + 8 ajoutées (new_lead, to_qualify, active_search, visit_done, interest_confirmed, lost, to_recontact, visit_planned_legacy).';
