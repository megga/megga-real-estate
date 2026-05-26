-- ─────────────────────────────────────────────────────────────────────────
-- TRUNCATE market_listings + market_price_history + external_listings
-- + market_changes
--
-- Mode placeholder : les 38K biens scrappés de RealAdvisor sont supprimés
-- et remplacés par 27 biens de démonstration (12 vente + 15 location) via
-- `scripts/seed-placeholder-listings.mjs`.
--
-- Pour restaurer les vraies données :
--   1. Relancer `node scripts/scrape-paginated.mjs` (~20 min, 590 tranches)
--   2. Les biens de démo peuvent coexister (source_portal = 'megga-demo')
--      ou être supprimés :
--         DELETE FROM market_listings
--           WHERE source_portal = 'megga-demo';
-- ─────────────────────────────────────────────────────────────────────────

-- TRUNCATE définitif (rapide, remet les séquences à zéro)
-- CASCADE pour emporter les FK si elles existent

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'market_price_history') THEN
    TRUNCATE TABLE public.market_price_history RESTART IDENTITY CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'market_changes') THEN
    TRUNCATE TABLE public.market_changes RESTART IDENTITY CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'external_listings') THEN
    TRUNCATE TABLE public.external_listings RESTART IDENTITY CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'market_listings') THEN
    TRUNCATE TABLE public.market_listings RESTART IDENTITY CASCADE;
  END IF;
END $$;

-- Vérification (log côté psql, non bloquant)
DO $$
DECLARE
  ml_count INT;
BEGIN
  SELECT COUNT(*) INTO ml_count FROM public.market_listings;
  RAISE NOTICE 'market_listings rows after truncate: %', ml_count;
END $$;
