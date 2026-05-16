-- ============================================================================
-- Migration: Sprint 3 — activity_events.actor_kind + nettoyage FK actor_id
-- Date: 2026-05-16
--
-- Problème (red-team G2) : la table activity_events déclare
--   actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL
-- mais les Edge Functions IA (ai-copilot, et bientôt extract-lead) tentent
-- d'insérer actor_id = 'ai' (string). Aujourd'hui ça passe parce que le
-- driver Supabase JS sérialise une string non-UUID en NULL côté insert, mais
-- on perd l'information "c'était l'IA". La FK rend impossible de stocker un
-- UUID synthétique sans le matérialiser dans profiles (anti-pattern).
--
-- Solution : ajouter actor_kind ('user' | 'ai' | 'system') comme
-- discriminator, et garder actor_id UUID nullable pour les acteurs humains
-- uniquement. La FK reste — humains pointent vers profiles, IA/system
-- laissent actor_id NULL et renseignent actor_kind.
--
-- Migration rétro-compatible :
--   - actor_kind a un DEFAULT 'user' → tous les inserts existants restent valides
--   - on backfille les anciennes lignes avec actor_id IS NULL en actor_kind='system'
--     uniquement si action contient indices clairs (heuristique conservative)
--
-- Spec : RED_TEAM_SPRINT_3.md §G.2 G2.
-- ============================================================================

-- 1. Ajout colonne actor_kind avec discriminator
ALTER TABLE activity_events ADD COLUMN IF NOT EXISTS actor_kind TEXT
  NOT NULL DEFAULT 'user'
  CHECK (actor_kind IN ('user', 'ai', 'system'));

COMMENT ON COLUMN activity_events.actor_kind IS
  'Sprint 3 (G2) : discriminator de l''acteur. ''user'' = humain authentifié (actor_id pointe vers profiles), ''ai'' = MEGGA AI (actor_id NULL), ''system'' = job batch / trigger SQL (actor_id NULL).';

-- 2. Backfill conservative : les anciens events sans actor_id avec action
--    contenant "MEGGA AI", "AI —", ou "Suggestion générée" → kind='ai'.
--    Le reste sans actor_id → 'system' (triggers, jobs).
UPDATE activity_events
SET actor_kind = 'ai'
WHERE actor_id IS NULL
  AND actor_kind = 'user'  -- skip rows déjà touchées (idempotence)
  AND (
    action ILIKE 'MEGGA AI%'
    OR action ILIKE 'AI %'
    OR action ILIKE '%Suggestion générée%'
    OR action ILIKE '%Matching auto%'
  );

UPDATE activity_events
SET actor_kind = 'system'
WHERE actor_id IS NULL
  AND actor_kind = 'user';  -- tout le reste avec actor_id NULL

-- 3. Index pour requêtes filtres "tous les events IA" (dashboard analytique)
CREATE INDEX IF NOT EXISTS idx_activity_events_actor_kind
  ON activity_events (agency_id, actor_kind, created_at DESC)
  WHERE actor_kind <> 'user';

-- 4. CHECK de cohérence : actor_id renseigné implique actor_kind='user'
--    (un humain ne peut pas être noté comme 'ai').
--    On le pose en NOT VALID pour ne pas bloquer sur les rows historiques
--    pourries, et on VALIDATE après backfill — qui devrait passer puisque
--    le backfill a respecté l'invariant.
ALTER TABLE activity_events
  ADD CONSTRAINT activity_events_actor_kind_coherence
  CHECK (actor_id IS NULL OR actor_kind = 'user')
  NOT VALID;

ALTER TABLE activity_events
  VALIDATE CONSTRAINT activity_events_actor_kind_coherence;

COMMENT ON CONSTRAINT activity_events_actor_kind_coherence ON activity_events IS
  'Sprint 3 (G2) : un actor_id UUID renseigné implique actor_kind=''user''. Empêche un trigger de mettre actor_id=auth.uid() puis actor_kind=''ai'' par erreur.';
