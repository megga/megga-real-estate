-- Onboarding wizard — persistance réelle.
--
-- Ajoute les colonnes manquantes sur agencies + profiles pour stocker les
-- données collectées par le wizard (Agence, Profil agence, Profil agent,
-- Forfait), plus les RPCs SECURITY DEFINER nécessaires :
--   - search_agencies(q, lim)         : autocomplete sans casser RLS
--   - create_agency_and_join(...)     : création + attache atomique
--   - join_agency(p_agency_id)        : phase MVP, attache directe (pas de
--                                       workflow de validation admin pour
--                                       l'instant)
-- Et le bucket Storage `agency-logos` (public, RLS membre-only en écriture).

-- ─── 1. Colonnes onboarding sur agencies ──────────────────────────────

ALTER TABLE agencies
  ADD COLUMN IF NOT EXISTS city       TEXT,
  ADD COLUMN IF NOT EXISTS canton     TEXT,
  ADD COLUMN IF NOT EXISTS website    TEXT,
  ADD COLUMN IF NOT EXISTS billing    TEXT DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS solo       BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

DO $$ BEGIN
  ALTER TABLE agencies ADD CONSTRAINT agencies_billing_check
    CHECK (billing IS NULL OR billing IN ('monthly', 'yearly'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Anti-doublon strict : un seul nom d'agence (case-insensitive, trim) en base.
CREATE UNIQUE INDEX IF NOT EXISTS uq_agencies_name_normalized
  ON agencies (lower(btrim(name)));

-- ─── 2. Colonnes onboarding sur profiles ──────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS agent_role       TEXT,
  ADD COLUMN IF NOT EXISTS spoken_languages TEXT[] DEFAULT '{fr}';

DO $$ BEGIN
  ALTER TABLE profiles ADD CONSTRAINT profiles_agent_role_check
    CHECK (agent_role IS NULL OR agent_role IN ('courtier', 'direction', 'admin', 'stagiaire'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 3. RPC : autocomplete agence ─────────────────────────────────────
-- SECURITY DEFINER pour bypasser la policy `agencies_select` (qui restreint
-- aux membres de l'agence). On expose uniquement les champs publics.

CREATE OR REPLACE FUNCTION public.search_agencies(q TEXT, lim INT DEFAULT 10)
RETURNS TABLE (
  id           UUID,
  name         TEXT,
  city         TEXT,
  canton       TEXT,
  logo_url     TEXT,
  member_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id, a.name, a.city, a.canton, a.logo_url,
         (SELECT count(*) FROM profiles p WHERE p.agency_id = a.id) AS member_count
  FROM agencies a
  WHERE COALESCE(a.status, 'active') = 'active'
    AND (
      lower(a.name) LIKE '%' || lower(btrim(q)) || '%'
      OR lower(COALESCE(a.city, '')) LIKE '%' || lower(btrim(q)) || '%'
    )
  ORDER BY length(a.name) ASC
  LIMIT lim;
$$;

GRANT EXECUTE ON FUNCTION public.search_agencies(TEXT, INT) TO authenticated;

-- ─── 4. RPC : création + attache atomique ─────────────────────────────

CREATE OR REPLACE FUNCTION public.create_agency_and_join(
  p_name   TEXT,
  p_city   TEXT,
  p_canton TEXT,
  p_solo   BOOLEAN
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_slug TEXT;
  v_id   UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  v_slug := lower(regexp_replace(btrim(p_name), '\s+', '-', 'g'));
  IF EXISTS (SELECT 1 FROM agencies WHERE slug = v_slug) THEN
    v_slug := v_slug || '-' || substring(gen_random_uuid()::text, 1, 6);
  END IF;

  INSERT INTO agencies (name, slug, city, canton, solo, plan, status, created_by)
  VALUES (btrim(p_name), v_slug, btrim(p_city), p_canton, COALESCE(p_solo, false),
          'starter', 'active', v_uid)
  RETURNING id INTO v_id;

  UPDATE profiles
     SET agency_id = v_id,
         role = CASE
           WHEN role IN ('manager', 'admin', 'agent', 'assistant') THEN role
           ELSE 'admin'::user_role
         END
   WHERE id = v_uid;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_agency_and_join(TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;

-- ─── 5. RPC : attache directe à une agence existante ──────────────────
-- Phase MVP : on attache sans workflow admin. À terme : créer une
-- table agency_join_requests + RLS + notification email + bouton "approuver".

CREATE OR REPLACE FUNCTION public.join_agency(p_agency_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM agencies WHERE id = p_agency_id) THEN
    RAISE EXCEPTION 'agency_not_found';
  END IF;

  UPDATE profiles
     SET agency_id = p_agency_id,
         role = CASE
           WHEN role IN ('agent', 'manager', 'admin', 'assistant') THEN role
           ELSE 'agent'::user_role
         END
   WHERE id = v_uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_agency(UUID) TO authenticated;

-- ─── 6. Bucket Storage : agency-logos ─────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'agency-logos',
  'agency-logos',
  true,
  4194304, -- 4 Mo
  ARRAY['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Lecture publique (les logos sont visibles sur la marketplace)
DROP POLICY IF EXISTS "Public agency-logos viewable by everyone" ON storage.objects;
CREATE POLICY "Public agency-logos viewable by everyone"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'agency-logos');

-- Insert : membre actuel de l'agence OU créateur juste après création
DROP POLICY IF EXISTS "Agency members can upload their agency logo" ON storage.objects;
CREATE POLICY "Agency members can upload their agency logo"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'agency-logos'
    AND auth.uid() IS NOT NULL
    AND (
      EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
          AND p.agency_id::text = (storage.foldername(name))[1]
      )
      OR EXISTS (
        SELECT 1 FROM agencies a
        WHERE a.id::text = (storage.foldername(name))[1]
          AND a.created_by = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Agency members can update their agency logo" ON storage.objects;
CREATE POLICY "Agency members can update their agency logo"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'agency-logos'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.agency_id::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS "Agency members can delete their agency logo" ON storage.objects;
CREATE POLICY "Agency members can delete their agency logo"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'agency-logos'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.agency_id::text = (storage.foldername(name))[1]
    )
  );

COMMENT ON FUNCTION public.search_agencies(TEXT, INT) IS
  'Autocomplete pour le wizard d''onboarding. SECURITY DEFINER : bypasse RLS pour exposer uniquement les champs publics (id, name, city, canton, logo_url, member_count).';
COMMENT ON FUNCTION public.create_agency_and_join(TEXT, TEXT, TEXT, BOOLEAN) IS
  'Création d''agence + attache atomique au user courant (devient admin). Anti-doublon strict via unique index sur lower(btrim(name)).';
COMMENT ON FUNCTION public.join_agency(UUID) IS
  'Phase MVP : attache directe du user à une agence existante (rôle agent par défaut). À remplacer par un workflow agency_join_requests avec validation admin.';
