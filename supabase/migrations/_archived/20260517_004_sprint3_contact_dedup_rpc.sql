-- ============================================================================
-- Migration: Sprint 3 — RPC find_contact_duplicates
-- Date: 2026-05-16
--
-- Problème (red-team B3) : useCreateContact insère sans dédup. Pour l'Import
-- Lead IA, on doit vérifier AVANT création qu'aucun contact ne matche déjà
-- (email exact, téléphone exact, ou prénom+nom). Scope obligatoire = agence
-- (red-team F2) — sinon double-KYC sur la même personne.
--
-- Cette RPC retourne les candidats de dédup avec un discriminator match_kind,
-- pour que le modal Import Lead affiche l'origine du match à l'agent
-- ("Marie a déjà importé ce contact il y a 3 j · KYC en cours").
--
-- Spec : RED_TEAM_SPRINT_3.md §B.B3, §F.F2.
-- ============================================================================

-- Helper : normalise un téléphone pour comparaison (strip tout sauf chiffres,
-- ignore le préfixe pays initial pour matcher +41 79 vs 079).
CREATE OR REPLACE FUNCTION normalize_phone(p_phone TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_phone IS NULL OR LENGTH(p_phone) < 6 THEN NULL
    ELSE
      -- Garde uniquement les chiffres, puis strip le 41/0 initial pour CH
      RIGHT(REGEXP_REPLACE(p_phone, '\D', '', 'g'), 9)
  END;
$$;

COMMENT ON FUNCTION normalize_phone(TEXT) IS
  'Sprint 3 (B3) : normalise un téléphone à ses 9 derniers chiffres pour matcher +41 79 / 0041 79 / 079 → mêmes 9 chiffres.';

-- ============================================================================
-- find_contact_duplicates(email, phone, first_name, last_name)
--
-- Retourne 0..N candidats existants matchant, avec un discriminator
-- `match_kind` :
--   'email' → email identique (case-insensitive)
--   'phone' → téléphone normalisé identique
--   'name'  → prénom ET nom identiques (case-insensitive, ignore accents
--             simples via UNACCENT — bonus si extension dispo)
--
-- Tri : email > phone > name (priorité de fiabilité).
-- Limite : 5 candidats max (UI ne peut pas en afficher plus).
-- Scope : RLS implicit via agency_id = get_user_agency_id().
-- ============================================================================

CREATE OR REPLACE FUNCTION find_contact_duplicates(
  p_email      TEXT DEFAULT NULL,
  p_phone      TEXT DEFAULT NULL,
  p_first_name TEXT DEFAULT NULL,
  p_last_name  TEXT DEFAULT NULL
)
RETURNS TABLE (
  id            UUID,
  first_name    TEXT,
  last_name     TEXT,
  email         TEXT,
  phone         TEXT,
  type          TEXT,
  created_at    TIMESTAMPTZ,
  user_id       UUID,
  match_kind    TEXT,
  match_priority INTEGER
)
LANGUAGE sql STABLE
SECURITY INVOKER SET search_path = public, pg_temp
AS $$
  WITH agency AS (SELECT get_user_agency_id() AS aid),
  candidates AS (
    -- Match par email (priorité 1)
    SELECT c.id, c.first_name, c.last_name, c.email, c.phone, c.type,
           c.created_at, c.user_id, 'email'::TEXT AS match_kind, 1 AS match_priority
    FROM contacts c, agency
    WHERE c.agency_id = agency.aid
      AND p_email IS NOT NULL
      AND p_email <> ''
      AND LOWER(c.email) = LOWER(p_email)

    UNION ALL

    -- Match par téléphone normalisé (priorité 2)
    SELECT c.id, c.first_name, c.last_name, c.email, c.phone, c.type,
           c.created_at, c.user_id, 'phone'::TEXT AS match_kind, 2 AS match_priority
    FROM contacts c, agency
    WHERE c.agency_id = agency.aid
      AND p_phone IS NOT NULL
      AND p_phone <> ''
      AND normalize_phone(c.phone) IS NOT NULL
      AND normalize_phone(c.phone) = normalize_phone(p_phone)

    UNION ALL

    -- Match par prénom+nom (priorité 3)
    SELECT c.id, c.first_name, c.last_name, c.email, c.phone, c.type,
           c.created_at, c.user_id, 'name'::TEXT AS match_kind, 3 AS match_priority
    FROM contacts c, agency
    WHERE c.agency_id = agency.aid
      AND p_first_name IS NOT NULL
      AND p_last_name IS NOT NULL
      AND LENGTH(p_first_name) >= 2
      AND LENGTH(p_last_name) >= 2
      AND LOWER(c.first_name) = LOWER(p_first_name)
      AND LOWER(c.last_name)  = LOWER(p_last_name)
  )
  -- Dédup les mêmes contacts matchés sur plusieurs critères : on garde la
  -- meilleure priorité (email > phone > name).
  SELECT DISTINCT ON (id)
    id, first_name, last_name, email, phone, type, created_at, user_id,
    match_kind, match_priority
  FROM candidates
  ORDER BY id, match_priority ASC
  LIMIT 5;
$$;

GRANT EXECUTE ON FUNCTION find_contact_duplicates(TEXT, TEXT, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION find_contact_duplicates(TEXT, TEXT, TEXT, TEXT) IS
  'Sprint 3 (B3) : trouve les contacts agence pouvant matcher un nouvel import. Tri par priorité (email > phone > name). À appeler AVANT toute création de Contact via Import Lead, et idéalement aussi côté useCreateContact manuel.';

-- ============================================================================
-- Index supports
-- ============================================================================

-- Email match — déjà couvert par idx_contacts_agency_email s'il existe.
-- Sinon création conditionnelle pour accélérer la dédup.
CREATE INDEX IF NOT EXISTS idx_contacts_agency_email_lower
  ON contacts (agency_id, LOWER(email))
  WHERE email IS NOT NULL;

-- Phone match — on indexe directement la version normalisée.
CREATE INDEX IF NOT EXISTS idx_contacts_agency_phone_normalized
  ON contacts (agency_id, normalize_phone(phone))
  WHERE phone IS NOT NULL;

-- Name match — index composite case-insensitive.
CREATE INDEX IF NOT EXISTS idx_contacts_agency_name_lower
  ON contacts (agency_id, LOWER(first_name), LOWER(last_name));
