-- ============================================================
-- FIX: Re-enable RLS on 7 tables flagged by Supabase linter
-- ============================================================
-- Linter errors detected on 2026-05-06 :
--
-- ERROR policy_exists_rls_disabled (4 tables) — policies définies mais RLS off :
--   - public.activity_events  (LBA audit trail — CRITIQUE compliance)
--   - public.agencies         (multi-tenant data)
--   - public.properties       (deal pipeline data)
--   - public.transactions     (deal data)
--
-- ERROR rls_disabled_in_public (7 tables — superset incluant les 4 ci-dessus) :
--   - public.activity_events, agencies, properties, transactions (déjà listés)
--   - public.favorites
--   - public.listings
--   - public.spatial_ref_sys  (table système PostGIS)
--
-- Toutes ces tables ont des policies définies (003_rls_policies.sql,
-- 20260329_*_super_admin_security.sql, etc.) mais RLS a été désactivée
-- quelque part — probablement via SQL editor ou drift entre migrations
-- locales et état déployé.
--
-- Cette migration est IDEMPOTENTE — sûre à exécuter même si RLS est
-- déjà active sur une table.
-- ============================================================

-- 1. Re-enable RLS sur les 6 tables métier qui ont déjà leurs policies
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

-- 2. spatial_ref_sys — table système PostGIS contenant les définitions
-- de systèmes de coordonnées géographiques (EPSG, etc.). Cette table est
-- ownership de l'extension PostGIS — la Supabase Management API n'a pas
-- les droits owner. On tente le ALTER, on attrape l'erreur silencieusement
-- si insufficient_privilege.
--
-- Si cette section échoue, l'utilisateur peut activer manuellement RLS
-- sur spatial_ref_sys via Supabase Studio Dashboard → Database → Tables →
-- spatial_ref_sys → Edit table → Enable RLS (action côté UI utilise des
-- privilèges supérieurs).
--
-- Note compliance : spatial_ref_sys ne contient AUCUNE donnée privée —
-- ce sont des références EPSG (codes de systèmes de coordonnées) publiques.
-- L'absence de RLS sur cette table n'est pas un risque de sécurité réel.
DO $$
BEGIN
  EXECUTE 'ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY';

  -- Policy SELECT permissive pour tous (donnée de référence publique).
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'spatial_ref_sys'
      AND policyname = 'spatial_ref_sys_public_read'
  ) THEN
    EXECUTE 'CREATE POLICY spatial_ref_sys_public_read ON public.spatial_ref_sys
      FOR SELECT TO anon, authenticated USING (true)';
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'spatial_ref_sys: insufficient_privilege (PostGIS-owned), skipping. Enable RLS via Supabase Dashboard if needed.';
  WHEN OTHERS THEN
    RAISE NOTICE 'spatial_ref_sys: skipped (%)', SQLERRM;
END $$;

-- 3. Vérification post-migration : log un NOTICE listant l'état RLS
-- de chaque table affectée. Visible dans les logs Supabase Studio après
-- exécution de la migration.
DO $$
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE 'RLS state after migration 20260506_001:';
  FOR rec IN
    SELECT c.relname AS tablename, c.relrowsecurity AS rls_enabled
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN (
        'activity_events', 'agencies', 'properties', 'transactions',
        'favorites', 'listings', 'spatial_ref_sys'
      )
    ORDER BY c.relname
  LOOP
    RAISE NOTICE '  - public.% : RLS = %', rec.tablename, rec.rls_enabled;
  END LOOP;
END $$;
