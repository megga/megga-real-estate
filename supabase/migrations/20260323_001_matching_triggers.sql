-- ═══════════════════════════════════════════════════════════════════════════
-- Matching Phase B — Triggers automatiques + pg_cron quotidien
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Prérequis :
--   1. Extension pg_net activée (Dashboard > Database > Extensions)
--   2. Extension pg_cron activée (Dashboard > Database > Extensions)
--   3. Variables app.settings configurées via SQL Editor :
--      ALTER DATABASE postgres SET app.settings.supabase_url = 'https://eayczugyrvmtqnnmvjod.supabase.co';
--      ALTER DATABASE postgres SET app.settings.service_role_key = 'VOTRE_SERVICE_ROLE_KEY';
--
-- Ces triggers utilisent pg_net (net.http_post) pour appeler l'Edge Function
-- matching-engine de manière ASYNCHRONE — pas de blocage des transactions.
-- ═══════════════════════════════════════════════════════════════════════════

-- Activer les extensions nécessaires
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ═══════════════════════════════════════════════════════════════
-- Trigger 1 : Bien activé → lancer matching contre tous les acheteurs
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION trigger_matching_on_property_active()
RETURNS trigger AS $$
BEGIN
  -- Déclencher seulement si le statut passe à 'active'
  IF (TG_OP = 'INSERT' AND NEW.status = 'active')
     OR (TG_OP = 'UPDATE' AND NEW.status = 'active' AND (OLD.status IS DISTINCT FROM 'active'))
  THEN
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/matching-engine',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object(
        'mode', 'match-property',
        'property_id', NEW.id,
        'agency_id', NEW.agency_id
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_property_active ON properties;
CREATE TRIGGER on_property_active
  AFTER INSERT OR UPDATE OF status ON properties
  FOR EACH ROW
  EXECUTE FUNCTION trigger_matching_on_property_active();


-- ═══════════════════════════════════════════════════════════════
-- Trigger 2 : Nouvelle recherche client créée → lancer matching
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION trigger_matching_on_new_search()
RETURNS trigger AS $$
BEGIN
  IF NEW.is_active = true THEN
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/matching-engine',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object(
        'mode', 'match-contact',
        'contact_id', NEW.contact_id,
        'agency_id', NEW.agency_id
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_new_client_search ON client_searches;
CREATE TRIGGER on_new_client_search
  AFTER INSERT ON client_searches
  FOR EACH ROW
  EXECUTE FUNCTION trigger_matching_on_new_search();


-- ═══════════════════════════════════════════════════════════════
-- Trigger 3 : Critères de recherche modifiés → relancer matching
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION trigger_matching_on_search_updated()
RETURNS trigger AS $$
BEGIN
  IF NEW.is_active = true AND (
    NEW.criteria IS DISTINCT FROM OLD.criteria
  ) THEN
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/matching-engine',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object(
        'mode', 'match-contact',
        'contact_id', NEW.contact_id,
        'agency_id', NEW.agency_id
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_search_criteria_updated ON client_searches;
CREATE TRIGGER on_search_criteria_updated
  AFTER UPDATE OF criteria, is_active ON client_searches
  FOR EACH ROW
  EXECUTE FUNCTION trigger_matching_on_search_updated();


-- ═══════════════════════════════════════════════════════════════
-- Trigger 4 : Prix d'un bien modifié → recalculer les matchs
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION trigger_matching_on_price_change()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'active' AND NEW.price IS DISTINCT FROM OLD.price THEN
    -- Supprimer les anciens matchs "suggested" pour ce bien (les scores changent)
    DELETE FROM matches
    WHERE property_id = NEW.id AND status = 'suggested';

    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/matching-engine',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object(
        'mode', 'match-property',
        'property_id', NEW.id,
        'agency_id', NEW.agency_id
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_property_price_change ON properties;
CREATE TRIGGER on_property_price_change
  AFTER UPDATE OF price ON properties
  FOR EACH ROW
  EXECUTE FUNCTION trigger_matching_on_price_change();


-- ═══════════════════════════════════════════════════════════════
-- pg_cron : scan quotidien à 5h UTC (6h heure suisse hiver)
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION daily_matching_scan()
RETURNS void AS $$
DECLARE
  agency RECORD;
BEGIN
  -- Pour chaque agence ayant des recherches actives
  FOR agency IN SELECT DISTINCT agency_id FROM client_searches WHERE is_active = true
  LOOP
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/matching-engine',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object(
        'mode', 'scan-all',
        'agency_id', agency.agency_id
      )
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Programmer le job quotidien
SELECT cron.schedule(
  'daily-matching-scan',
  '0 5 * * *',
  'SELECT daily_matching_scan()'
);
