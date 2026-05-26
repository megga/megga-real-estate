-- ============================================================
-- Phase D — Scope public storage bucket SELECT policies (lint 0025)
-- ============================================================
-- Supabase linter flagged 3 public storage buckets with broad SELECT
-- policies on `storage.objects`:
--   - agency-logos    (policy: "agency-logos anon read")
--   - avatars         (policy: "Public can view avatars")
--   - property-photos (policy: "Public can view property photos")
--
-- The flagged policies use `USING (bucket_id = 'X')` only, which lets any
-- client list every object in the bucket via the storage API. The lint
-- says: "Public buckets don't need this for object URL access and it may
-- expose more data than intended."
--
-- Public bucket URL access (https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>)
-- is served by the CDN without consulting RLS. So dropping these broad
-- SELECT policies does NOT break any existing image rendering — every
-- frontend reference uses `getPublicUrl()` which produces CDN URLs.
-- What it DOES block is `supabase.storage.from('avatars').list()` and
-- similar metadata-listing API calls — which is the desired state.
--
-- Frontend audit (grep on src/):
--   - useAvatar.ts: upload + getPublicUrl + remove → no list/download
--   - useProperties.ts: getPublicUrl → no list/download
--   - VendrePage.tsx: getPublicUrl → no list/download
--   - kyc-documents bucket uses .download(), but it's a private bucket
--     and not part of the lint warnings (its policies enforce path-level
--     auth checks — out of scope for this migration).
--
-- ============================================================

DO $$
DECLARE
  rec RECORD;
  dropped_count integer := 0;
BEGIN
  -- Static name-based drops for the variants we know exist (live names
  -- come from the linter output; older names come from migration files).
  FOR rec IN
    SELECT unnest(ARRAY[
      'Public avatars are viewable by everyone',
      'Public can view avatars',
      'avatars anon read',
      'avatars public read',
      'agency-logos anon read',
      'agency-logos public read',
      'Public can view agency logos',
      'Public can view property photos',
      'Public can view property-photos',
      'property-photos anon read',
      'property-photos public read'
    ]) AS policyname
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', rec.policyname);
  END LOOP;

  -- Defensive dynamic drop: any remaining SELECT policy on storage.objects
  -- whose qual is JUST a bucket_id equality on one of the 3 buckets, and
  -- has no other conditions (no auth check, no path filter). The exact
  -- qual format is `(bucket_id = 'X'::text)` after PostgreSQL normalizes.
  FOR rec IN
    SELECT policyname, qual
    FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND cmd = 'SELECT'
      AND qual IN (
        '(bucket_id = ''avatars''::text)',
        '(bucket_id = ''agency-logos''::text)',
        '(bucket_id = ''property-photos''::text)',
        'bucket_id = ''avatars''::text',
        'bucket_id = ''agency-logos''::text',
        'bucket_id = ''property-photos''::text'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', rec.policyname);
    RAISE NOTICE 'Dropped broad SELECT policy by qual match: % (qual=%)',
      rec.policyname, rec.qual;
    dropped_count := dropped_count + 1;
  END LOOP;

  RAISE NOTICE 'Phase D complete: %s broad SELECT policy(ies) dropped', dropped_count;
END $$;

-- ─── Verification ────────────────────────────────────────
-- List remaining SELECT policies on storage.objects scoped to the
-- 3 flagged buckets, so any drift is visible in Supabase logs.
DO $$
DECLARE
  rec RECORD;
  remaining integer := 0;
BEGIN
  RAISE NOTICE 'Remaining SELECT policies on storage.objects for flagged buckets:';
  FOR rec IN
    SELECT policyname, roles::text AS roles, qual
    FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND cmd = 'SELECT'
      AND (
        qual LIKE '%avatars%'
        OR qual LIKE '%agency-logos%'
        OR qual LIKE '%property-photos%'
      )
    ORDER BY policyname
  LOOP
    RAISE NOTICE '  - % (roles=%): %', rec.policyname, rec.roles, rec.qual;
    remaining := remaining + 1;
  END LOOP;
  IF remaining = 0 THEN
    RAISE NOTICE '  (none — buckets rely on public CDN URLs)';
  END IF;
END $$;
