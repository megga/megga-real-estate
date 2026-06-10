-- ════════════════════════════════════════════════════════════════════════
-- Atelier Matching — boucle de matching complète (handoff juin 2026)
-- Idempotente (rejouable) — contrat du déploiement CI (Management API).
--
-- 1. matches.property_id nullable + CHECK : les matches « marché » (Flatfox)
--    étaient silencieusement perdus (NOT NULL violé, erreur avalée par le
--    moteur). Un match vise SOIT un bien interne SOIT une annonce marché.
-- 2. matches.snoozed_until : geste « Plus tard » (parking Reportés, +7 j).
-- 3. Index uniques (contact, bien) : durcit la dédup applicative du moteur
--    (matching-engine vérifie l'existence avant insert — protège des courses
--    pg_cron / scan manuel). Un couple écarté (status='ignored') reste en
--    base et n'est donc jamais re-proposé.
-- 4. transactions.market_listing_id : « Envoyer le dossier » rattache le bien
--    au deal même quand le bien vient de la veille marché (contrat COUTURES).
-- 5. activity_events : policy INSERT agence manquante — seuls les
--    super-admins pouvaient consigner ; les écritures timeline côté client
--    (stage_change, dossier envoyé…) échouaient silencieusement.
-- ════════════════════════════════════════════════════════════════════════

-- 1. Matches marché : property_id devient nullable, cible garantie par CHECK
ALTER TABLE public.matches ALTER COLUMN property_id DROP NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'matches_target_check'
      AND conrelid = 'public.matches'::regclass
  ) THEN
    ALTER TABLE public.matches
      ADD CONSTRAINT matches_target_check
      CHECK (property_id IS NOT NULL OR market_listing_id IS NOT NULL);
  END IF;
END $$;

-- 2. Snooze (« Plus tard » — sur le match, ni le contact ni le deal)
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS snoozed_until timestamptz;

-- 3. Dédup dure par couple (contact, bien)
CREATE UNIQUE INDEX IF NOT EXISTS uq_matches_contact_property
  ON public.matches (contact_id, property_id)
  WHERE property_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_matches_contact_market
  ON public.matches (contact_id, market_listing_id)
  WHERE market_listing_id IS NOT NULL;

-- 4. Deal ↔ annonce marché (FK indexée)
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS market_listing_id uuid
  REFERENCES public.market_listings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_market_listing
  ON public.transactions (market_listing_id)
  WHERE market_listing_id IS NOT NULL;

-- 5. Timeline : les agents consignent dans leur agence
DROP POLICY IF EXISTS events_insert ON public.activity_events;
CREATE POLICY events_insert ON public.activity_events
  FOR INSERT TO authenticated
  WITH CHECK (agency_id = (SELECT get_my_agency_id()));
