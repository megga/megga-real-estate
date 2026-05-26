-- ═══════════════════════════════════════════════════════════════════════════
-- Matching Phase B — Triggers automatiques + pg_cron quotidien
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Utilise une table app_config pour stocker l'URL et la service_role_key
-- (compatible Supabase Free — pas besoin de ALTER DATABASE)
--
-- Prérequis : extensions pg_net et pg_cron activées (bloc 1 déjà fait)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Table de configuration ──────────────────────────────────────────────
-- Stocke les secrets nécessaires aux triggers (URL + service role key)

CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Insérer les valeurs (REMPLACEZ service_role_key par votre vraie clé)
INSERT INTO app_config (key, value) VALUES
  ('supabase_url', 'https://eayczugyrvmtqnnmvjod.supabase.co'),
  ('service_role_key', 'REMPLACEZ_PAR_VOTRE_SERVICE_ROLE_KEY')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Sécuriser : seul le service role peut lire cette table
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
-- Aucune policy = personne via l'API ne peut lire (seulement SECURITY DEFINER functions)


-- ── Helper : lire la config ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_app_config(config_key TEXT)
RETURNS TEXT AS $$
  SELECT value FROM app_config WHERE key = config_key;
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ═══════════════════════════════════════════════════════════════
-- Trigger 1 : Bien activé → lancer matching contre tous les acheteurs
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION trigger_matching_on_property_active()
RETURNS trigger AS $$
DECLARE
  base_url TEXT;
  svc_key TEXT;
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.status = 'active')
     OR (TG_OP = 'UPDATE' AND NEW.status = 'active' AND (OLD.status IS DISTINCT FROM 'active'))
  THEN
    base_url := get_app_config('supabase_url');
    svc_key := get_app_config('service_role_key');

    PERFORM net.http_post(
      url := base_url || '/functions/v1/matching-engine',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || svc_key
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
DECLARE
  base_url TEXT;
  svc_key TEXT;
BEGIN
  IF NEW.is_active = true THEN
    base_url := get_app_config('supabase_url');
    svc_key := get_app_config('service_role_key');

    PERFORM net.http_post(
      url := base_url || '/functions/v1/matching-engine',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || svc_key
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
DECLARE
  base_url TEXT;
  svc_key TEXT;
BEGIN
  IF NEW.is_active = true AND (
    NEW.criteria IS DISTINCT FROM OLD.criteria
  ) THEN
    base_url := get_app_config('supabase_url');
    svc_key := get_app_config('service_role_key');

    PERFORM net.http_post(
      url := base_url || '/functions/v1/matching-engine',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || svc_key
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
DECLARE
  base_url TEXT;
  svc_key TEXT;
BEGIN
  IF NEW.status = 'active' AND NEW.price IS DISTINCT FROM OLD.price THEN
    DELETE FROM matches
    WHERE property_id = NEW.id AND status = 'suggested';

    base_url := get_app_config('supabase_url');
    svc_key := get_app_config('service_role_key');

    PERFORM net.http_post(
      url := base_url || '/functions/v1/matching-engine',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || svc_key
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
  base_url TEXT;
  svc_key TEXT;
BEGIN
  base_url := get_app_config('supabase_url');
  svc_key := get_app_config('service_role_key');

  FOR agency IN SELECT DISTINCT agency_id FROM client_searches WHERE is_active = true
  LOOP
    PERFORM net.http_post(
      url := base_url || '/functions/v1/matching-engine',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || svc_key
      ),
      body := jsonb_build_object(
        'mode', 'scan-all',
        'agency_id', agency.agency_id
      )
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT cron.schedule(
  'daily-matching-scan',
  '0 5 * * *',
  'SELECT daily_matching_scan()'
);
