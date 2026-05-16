# Sprint 2 — déploiement migration

## Vue d'ensemble

Une seule migration : `supabase/migrations/20260517_001_sprint2_crm_offers_visits.sql`

Cette migration est **idempotente** (utilise `IF NOT EXISTS` partout, `DROP TRIGGER IF EXISTS` avant `CREATE TRIGGER`, etc.). On peut la rejouer sans risque.

## Pré-requis

- Migration Sprint 1 `20260516_002_sprint1_kyc_lba.sql` déjà appliquée (table `activity_events` étendue avec `severity`/`category`/`object_label`).
- Tables existantes : `transactions`, `properties`, `visits`, `contacts`, `agencies`, `profiles`, `auth.users`.
- Extension `pg_cron` activée (Supabase Pro = OK par défaut). Sinon le bloc `DO $$ ... cron.schedule ... $$` est skip (silencieux).

## Application

```bash
# Production (Supabase CLI lié à eayczugyrvmtqnnmvjod)
supabase db push

# Ou manuellement via psql
psql $DATABASE_URL -f supabase/migrations/20260517_001_sprint2_crm_offers_visits.sql
```

## Vérifications post-migration

```sql
-- 1. Table crm_offers + enums
\d crm_offers
SELECT typname FROM pg_type WHERE typname IN ('crm_offer_kind', 'crm_offer_party', 'crm_offer_status');

-- 2. Colonnes visits étendues
\d visits  -- doit montrer duration_minutes, agent_id, bon, rapport

-- 3. Colonnes properties étendues
\d properties  -- doit montrer energy_class, mandate_commission_pct, mandate_signed_at, mandate_expires_at

-- 4. Triggers AuditEvent
SELECT tgname FROM pg_trigger WHERE tgrelid = 'crm_offers'::regclass;
-- attendu : trg_audit_crm_offer_insert, trg_audit_crm_offer_status

-- 5. RPC
SELECT proname FROM pg_proc WHERE proname IN ('crm_offer_chain', 'crm_visits_by_property', 'expire_crm_offers_now');

-- 6. Cron job
SELECT jobname, schedule FROM cron.job WHERE jobname = 'crm-offers-expire-hourly';
-- attendu : crm-offers-expire-hourly | 0 * * * *

-- 7. Realtime publication
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime'
  AND tablename IN ('crm_offers', 'visits');
-- attendu : 2 lignes (une par table)
```

## Smoke test fonctionnel (via Supabase SQL Editor)

```sql
-- Insertion d'une offre test (devrait déclencher trg_audit_crm_offer_insert)
INSERT INTO crm_offers
  (deal_id, agency_id, parent_offer_id, kind, from_party,
   by_id, by_label, amount, conditions, expires_at, status)
VALUES
  ('<un-transaction-id-existant>',
   '<son-agency-id>',
   NULL,
   'offer',
   'buyer',
   '<un-contact-id>',
   'Test acheteur',
   500000,
   '{"financing":{"active":true,"days":45},"sale":{"active":false},"diagnostic":{"active":false},"occupancy":{"active":false},"other":""}'::jsonb,
   NOW() + INTERVAL '5 days',
   'pending')
RETURNING id;

-- Vérifier qu'un AuditEvent a été créé
SELECT * FROM activity_events
  WHERE entity_type = 'crm_offer'
  ORDER BY created_at DESC LIMIT 1;
-- attendu : action='Offre créée', category='deal', severity='info'

-- Cleanup
DELETE FROM crm_offers WHERE by_label = 'Test acheteur';
```

## Rollback

La migration n'a pas de section `DOWN`. Si rollback nécessaire :

```sql
-- ⚠ Détruit toutes les offres existantes
DROP TABLE IF EXISTS crm_offers CASCADE;
DROP TYPE IF EXISTS crm_offer_status;
DROP TYPE IF EXISTS crm_offer_party;
DROP TYPE IF EXISTS crm_offer_kind;

-- Supprime les colonnes visits Sprint 2
ALTER TABLE visits
  DROP COLUMN IF EXISTS duration_minutes,
  DROP COLUMN IF EXISTS agent_id,
  DROP COLUMN IF EXISTS bon,
  DROP COLUMN IF EXISTS rapport;

-- Supprime les colonnes properties Sprint 2
ALTER TABLE properties
  DROP COLUMN IF EXISTS energy_class,
  DROP COLUMN IF EXISTS mandate_commission_pct,
  DROP COLUMN IF EXISTS mandate_signed_at,
  DROP COLUMN IF EXISTS mandate_expires_at;

-- Cron + RPC
SELECT cron.unschedule('crm-offers-expire-hourly');
DROP FUNCTION IF EXISTS expire_crm_offers_now();
DROP FUNCTION IF EXISTS crm_offer_chain(UUID);
DROP FUNCTION IF EXISTS crm_visits_by_property(UUID);
DROP FUNCTION IF EXISTS audit_crm_offer_event();

-- Realtime
ALTER PUBLICATION supabase_realtime DROP TABLE crm_offers;
ALTER PUBLICATION supabase_realtime DROP TABLE visits;
```

## Notes performance

- Index partiel `idx_crm_offers_status_expires` (WHERE status='pending') optimise le cron horaire — < 10ms même avec 10k offres.
- Index `idx_crm_offers_deal` (deal_id, created_at DESC) optimise la RPC `crm_offer_chain`.
- RLS agency-scoped : filtre via `profiles` est fast grâce à `idx_profiles_id` (clé primaire).
