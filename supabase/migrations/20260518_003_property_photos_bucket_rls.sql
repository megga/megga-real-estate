-- ============================================================================
-- PROPERTY-PHOTOS BUCKET — agency-scoped RLS + MIME / size limits
-- Created: 2026-05-18
-- Audit: red-team Storage auditor (Week 1 hotfix #3)
--
-- Closes:
--   - V2 Critical: bucket policies invisibles (dashboard-only), risque cross-
--     agency upload. Pas de migration SQL versionnée du bucket avant aujourd'hui.
--   - V3 Critical: path traversal via `propertyId` non validé côté client.
--   - V4 Élevée: MIME bypass (`image/svg+xml` → XSS stockée sur CDN public).
--   - V5 Élevée: pas de file_size_limit serveur.
--
-- Path pattern enforced:
--   - Agent uploads : `{agency_id}/properties/{propertyId}/{filename}`
--   - Public seller-lead uploads (VendrePage anon) : `seller-leads/{filename}`
--
-- Idempotent: ON CONFLICT + DROP POLICY IF EXISTS + recréation propre.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. BUCKET — limites serveur (taille + MIME whitelist)
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'property-photos',
  'property-photos',
  true,
  10485760, -- 10 Mo
  ARRAY['image/jpeg', 'image/png', 'image/webp']
  -- NOTE: SVG volontairement exclu — risque XSS stockée sur CDN public
  -- (un SVG malveillant servi par le CDN s'exécute dans le contexte de
  -- *.supabase.co et peut voler le token Supabase de l'agent).
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================================
-- 2. POLICIES — purge des templates dashboard puis recréation versionnée
-- ============================================================================

-- Drop policies known to be created by the Supabase dashboard templates for
-- public buckets. Idempotent: IF EXISTS no-ops if the policy is absent.
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Public access for property-photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read on property-photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload property photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update property photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete property photos" ON storage.objects;
DROP POLICY IF EXISTS "property_photos_public_read" ON storage.objects;
DROP POLICY IF EXISTS "property_photos_agency_insert" ON storage.objects;
DROP POLICY IF EXISTS "property_photos_agency_update" ON storage.objects;
DROP POLICY IF EXISTS "property_photos_agency_delete" ON storage.objects;
DROP POLICY IF EXISTS "property_photos_seller_leads_insert" ON storage.objects;

-- Lecture publique (le bucket est public pour la marketplace)
CREATE POLICY "property_photos_public_read" ON storage.objects
FOR SELECT
USING (bucket_id = 'property-photos');

-- INSERT agent : préfixe = son agency_id, pas de path traversal
CREATE POLICY "property_photos_agency_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'property-photos'
  AND (storage.foldername(name))[1] = get_my_agency_id()::text
  AND name !~ '\.\./'
);

-- UPDATE agent : même contrainte
CREATE POLICY "property_photos_agency_update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'property-photos'
  AND (storage.foldername(name))[1] = get_my_agency_id()::text
)
WITH CHECK (
  bucket_id = 'property-photos'
  AND (storage.foldername(name))[1] = get_my_agency_id()::text
  AND name !~ '\.\./'
);

-- DELETE agent : même contrainte
CREATE POLICY "property_photos_agency_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'property-photos'
  AND (storage.foldername(name))[1] = get_my_agency_id()::text
);

-- INSERT seller-leads anonyme (VendrePage soumission vendeur publique).
-- Restreint au préfixe `seller-leads/` ET path direct (pas de sous-dossier
-- arbitraire), pour éviter qu'un visiteur écrive dans un dossier d'agence.
-- Le seul niveau autorisé : `seller-leads/<filename>` (1 segment).
CREATE POLICY "property_photos_seller_leads_insert" ON storage.objects
FOR INSERT TO anon, authenticated
WITH CHECK (
  bucket_id = 'property-photos'
  AND name LIKE 'seller-leads/%'
  AND array_length(storage.foldername(name), 1) = 1
  AND name !~ '\.\./'
);

COMMIT;

-- ============================================================================
-- VERIFICATION (à exécuter manuellement après application)
-- ============================================================================
-- 1. Vérifier que les policies sont bien en place :
--    SELECT policyname FROM pg_policies
--    WHERE schemaname='storage' AND tablename='objects'
--    AND policyname LIKE 'property_photos_%';
--    -- Doit retourner 5 lignes : public_read, agency_insert, agency_update,
--    --                            agency_delete, seller_leads_insert.
--
-- 2. Vérifier les limites bucket :
--    SELECT id, file_size_limit, allowed_mime_types
--    FROM storage.buckets WHERE id='property-photos';
--    -- file_size_limit = 10485760, allowed_mime_types sans svg.
--
-- 3. Tester cross-agency INSERT bloqué (en tant qu'agent agency A) :
--    INSERT INTO storage.objects (bucket_id, name, owner)
--    VALUES ('property-photos', '<otherAgencyUuid>/properties/x/y.jpg', auth.uid());
--    -- Doit échouer : "new row violates row-level security policy".
--
-- 4. Lister les policies dashboard résiduelles à supprimer manuellement :
--    SELECT policyname FROM pg_policies
--    WHERE schemaname='storage' AND tablename='objects'
--    AND policyname NOT LIKE 'property_photos_%'
--    AND policyname NOT LIKE 'kyc_docs_%'
--    AND policyname NOT LIKE '%avatar%';
-- ============================================================================
