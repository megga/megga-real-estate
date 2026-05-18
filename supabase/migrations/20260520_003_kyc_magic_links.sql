-- ============================================================================
-- Migration: KYC Magic Link — Self-service client uploads (Sprint 4.7.A)
-- Date: 2026-05-20
--
-- Boucle la promesse "Demander les pièces" du wizard KYC (Step 0 source='magic').
-- L'agent crée un lien magique signé HMAC qui est envoyé au client par email/SMS.
-- Le client dépose ses pièces sans compte MEGGA, l'agent récupère tout dans la
-- section Documents joints du dossier KYC existant.
--
-- Articles LBA :
--   - art. 3 (identification du cocontractant)
--   - art. 6 (vigilance renforcée — mode 'verifiee' avec OCR pour la phase D)
--   - art. 7 al. 1 (documentation diligence)
--   - art. 7 al. 3 (conservation 10 ans)
--
-- Cette migration NE crée PAS :
--   - Les Edge functions (séparées, voir supabase/functions/magic-link-*)
--   - L'OCR (Sprint 4.7.D)
--   - L'envoi Email/SMS (Sprint 4.7.E)
-- ============================================================================

-- ─── 1. Enums ──────────────────────────────────────────────────────────────

DO $enum$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'kyc_magic_link_mode') THEN
    CREATE TYPE kyc_magic_link_mode AS ENUM ('libre', 'verifiee');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'kyc_magic_link_status') THEN
    CREATE TYPE kyc_magic_link_status AS ENUM (
      'pending',      -- créé, pas encore ouvert par le client
      'opened',       -- client a ouvert le lien (1er GET)
      'uploading',    -- ≥ 1 upload reçu, pas encore confirmé
      'verifying',    -- mode verifiee : client est sur l'écran de confirmation OCR
      'submitted',    -- confirmé par client → dossier KYC peut avancer
      'expired'       -- expiresAt dépassé sans soumission
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'kyc_magic_link_upload_type') THEN
    CREATE TYPE kyc_magic_link_upload_type AS ENUM ('identity', 'address', 'funds', 'other');
  END IF;
END $enum$;

-- ─── 2. Table principale kyc_magic_links ──────────────────────────────────

CREATE TABLE IF NOT EXISTS kyc_magic_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Token HMAC signé côté serveur (URL-safe, ~32-48 chars base62/hex).
  -- Le payload signé contient { id, exp } — le serveur résout dossier/contact
  -- à partir de l'id pour ne JAMAIS exposer ces UUID dans l'URL publique.
  token TEXT NOT NULL UNIQUE,

  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  kyc_case_id UUID NOT NULL REFERENCES kyc_cases(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,

  mode kyc_magic_link_mode NOT NULL DEFAULT 'libre',
  channels TEXT[] NOT NULL DEFAULT ARRAY['email']::TEXT[]
    CHECK (
      cardinality(channels) >= 1
      AND channels <@ ARRAY['email', 'sms']::TEXT[]
    ),
  custom_message TEXT CHECK (custom_message IS NULL OR length(custom_message) <= 500),

  status kyc_magic_link_status NOT NULL DEFAULT 'pending',

  expires_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  opened_at TIMESTAMPTZ,
  uploaded_at TIMESTAMPTZ,    -- premier upload terminé
  confirmed_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,

  -- Traçabilité accès (premier hit publique)
  client_ip TEXT,
  client_user_agent TEXT,

  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT kyc_magic_links_expires_after_sent CHECK (expires_at > sent_at)
);

COMMENT ON TABLE kyc_magic_links IS
  'Sprint 4.7.A — Lien magique KYC self-service. L''agent crée le lien, le client (sans compte MEGGA) dépose ses pièces via une URL signée HMAC. Boucle le 3e chemin "Demander les pièces" du wizard KYC.';

COMMENT ON COLUMN kyc_magic_links.token IS
  'Token HMAC URL-safe. Payload signé : { id, exp }. Vérification stricte serveur à chaque hit. JAMAIS exposer dossier_id ou contact_id dans le payload.';

-- Indices : lookup public rapide par token + dashboard agent par dossier/agence
CREATE UNIQUE INDEX IF NOT EXISTS idx_kyc_magic_links_token
  ON kyc_magic_links (token);
CREATE INDEX IF NOT EXISTS idx_kyc_magic_links_kyc_case
  ON kyc_magic_links (kyc_case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kyc_magic_links_agency_status
  ON kyc_magic_links (agency_id, status)
  WHERE status NOT IN ('submitted', 'expired');
CREATE INDEX IF NOT EXISTS idx_kyc_magic_links_expires
  ON kyc_magic_links (expires_at)
  WHERE status NOT IN ('submitted', 'expired');

-- ─── 3. Sous-table kyc_magic_link_uploads ─────────────────────────────────

CREATE TABLE IF NOT EXISTS kyc_magic_link_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  magic_link_id UUID NOT NULL REFERENCES kyc_magic_links(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,

  type kyc_magic_link_upload_type NOT NULL DEFAULT 'other',
  filename TEXT NOT NULL CHECK (length(filename) >= 1 AND length(filename) <= 255),
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10 * 1024 * 1024), -- max 10 MB
  mime_type TEXT,
  storage_path TEXT NOT NULL,
  sha256_hash TEXT CHECK (sha256_hash IS NULL OR sha256_hash ~ '^[a-f0-9]{64}$'),

  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Mode 'verifiee' : OCR rempli côté serveur (Sprint 4.7.D)
  ocr_fields JSONB,
  ocr_provider TEXT,
  ocr_completed_at TIMESTAMPTZ,

  -- Le client confirme chaque pièce avant submit final
  confirmed_by_client BOOLEAN NOT NULL DEFAULT FALSE,
  confirmed_at TIMESTAMPTZ,

  -- Lien optionnel vers la table `documents` quand l'agent valide la pièce
  -- (déplacée du bucket magic-link vers le bucket kyc-documents final).
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL
);

COMMENT ON TABLE kyc_magic_link_uploads IS
  'Sprint 4.7.A — Pièces uploadées via le lien magique. Stockage temporaire bucket magic-link, transfert vers kyc-documents quand l''agent valide.';

CREATE INDEX IF NOT EXISTS idx_kyc_magic_link_uploads_link
  ON kyc_magic_link_uploads (magic_link_id, uploaded_at);
CREATE INDEX IF NOT EXISTS idx_kyc_magic_link_uploads_agency
  ON kyc_magic_link_uploads (agency_id);

-- ─── 4. RLS — Multi-tenant agency-scoped + accès public via Edge functions ─

ALTER TABLE kyc_magic_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_magic_links FORCE ROW LEVEL SECURITY;
ALTER TABLE kyc_magic_link_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_magic_link_uploads FORCE ROW LEVEL SECURITY;

-- Agent : voit tous les liens de son agence (suivi statut)
DROP POLICY IF EXISTS kyc_magic_links_select_agency ON kyc_magic_links;
CREATE POLICY kyc_magic_links_select_agency ON kyc_magic_links
  FOR SELECT TO authenticated
  USING (agency_id = get_my_agency_id());

-- Agent : peut créer un lien pour son agence + lui-même comme created_by
DROP POLICY IF EXISTS kyc_magic_links_insert_agency ON kyc_magic_links;
CREATE POLICY kyc_magic_links_insert_agency ON kyc_magic_links
  FOR INSERT TO authenticated
  WITH CHECK (
    agency_id = get_my_agency_id()
    AND created_by = auth.uid()
  );

-- Agent : peut update SEULEMENT pour regénérer un lien expiré
-- (en pratique : transition status='expired' → nouveau token via Edge function)
DROP POLICY IF EXISTS kyc_magic_links_update_agency ON kyc_magic_links;
CREATE POLICY kyc_magic_links_update_agency ON kyc_magic_links
  FOR UPDATE TO authenticated
  USING (agency_id = get_my_agency_id())
  WITH CHECK (agency_id = get_my_agency_id());

-- Pas de DELETE direct — retention 10 ans LBA (trigger ci-dessous)
-- Les Edge functions publiques utilisent service_role et bypassent ce RLS
-- (vérification HMAC + agency_id implicite via le token).

-- Uploads : identique scope agence
DROP POLICY IF EXISTS kyc_magic_link_uploads_select_agency ON kyc_magic_link_uploads;
CREATE POLICY kyc_magic_link_uploads_select_agency ON kyc_magic_link_uploads
  FOR SELECT TO authenticated
  USING (agency_id = get_my_agency_id());

-- Pas d'INSERT direct côté authenticated (passe par Edge function publique en
-- service_role) — l'agent ne crée pas d'upload, le client le fait via le lien.

DROP POLICY IF EXISTS kyc_magic_link_uploads_update_agency ON kyc_magic_link_uploads;
CREATE POLICY kyc_magic_link_uploads_update_agency ON kyc_magic_link_uploads
  FOR UPDATE TO authenticated
  USING (agency_id = get_my_agency_id())
  WITH CHECK (agency_id = get_my_agency_id());

-- ─── 5. Retention 10 ans LBA art. 7 al. 3 (trigger BEFORE DELETE) ─────────

CREATE OR REPLACE FUNCTION enforce_kyc_magic_links_retention()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_age_years NUMERIC;
  v_user_role TEXT;
BEGIN
  v_age_years := EXTRACT(EPOCH FROM (NOW() - OLD.created_at)) / (365.25 * 24 * 3600);

  -- Bypass super_admin (audit warn séparé)
  SELECT role::TEXT INTO v_user_role FROM profiles WHERE id = auth.uid();

  IF v_age_years < 10 AND COALESCE(v_user_role, '') <> 'super_admin' THEN
    INSERT INTO activity_events
      (agency_id, actor_id, action, entity_type, entity_id,
       category, severity, object_label, metadata)
    VALUES (
      OLD.agency_id,
      auth.uid(),
      'Tentative suppression lien magique bloquée',
      'kyc_magic_link',
      OLD.id,
      'kyc',
      'critical',
      'Lien magique ' || OLD.id::TEXT,
      jsonb_build_object(
        'reason', 'retention_period_active',
        'age_years', ROUND(v_age_years, 2),
        'lba_article', 'art. 7 al. 3'
      )
    );
    RAISE EXCEPTION 'Suppression du lien magique interdite avant 10 ans (LBA art. 7 al. 3).';
  END IF;

  -- M2 fix : audit le bypass super_admin pour traçabilité FINMA
  IF v_user_role = 'super_admin' AND v_age_years < 10 THEN
    INSERT INTO activity_events
      (agency_id, actor_id, action, entity_type, entity_id,
       category, severity, object_label, metadata)
    VALUES (
      OLD.agency_id,
      auth.uid(),
      'Suppression lien magique par super_admin (bypass rétention)',
      'kyc_magic_link',
      OLD.id,
      'kyc',
      'warn',
      'Lien magique ' || OLD.id::TEXT,
      jsonb_build_object(
        'reason', 'super_admin_override',
        'age_years', ROUND(v_age_years, 2),
        'created_at', OLD.created_at::TEXT,
        'kyc_case_id', OLD.kyc_case_id,
        'status', OLD.status::TEXT
      )
    );
  END IF;

  RETURN OLD;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_enforce_kyc_magic_links_retention ON kyc_magic_links;
CREATE TRIGGER trg_enforce_kyc_magic_links_retention
  BEFORE DELETE ON kyc_magic_links
  FOR EACH ROW
  EXECUTE FUNCTION enforce_kyc_magic_links_retention();

-- ─── 6. AuditEvent automatique sur transitions de status ──────────────────

CREATE OR REPLACE FUNCTION audit_kyc_magic_link_transitions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_action TEXT;
  v_severity TEXT;
BEGIN
  -- INSERT = lien créé
  IF TG_OP = 'INSERT' THEN
    INSERT INTO activity_events
      (agency_id, actor_id, action, entity_type, entity_id,
       category, severity, object_label, metadata, actor_kind)
    VALUES (
      NEW.agency_id,
      NEW.created_by,
      'Lien magique KYC créé',
      'kyc_magic_link',
      NEW.id,
      'kyc',
      'info',
      'Lien ' || NEW.id::TEXT,
      jsonb_build_object(
        'kyc_case_id', NEW.kyc_case_id,
        'contact_id', NEW.contact_id,
        'mode', NEW.mode,
        'channels', NEW.channels,
        'expires_at', NEW.expires_at,
        'lba_article', 'art. 3 (identification)'
      ),
      -- M1 fix : actor_kind explicite (défensif si Edge function service_role
      -- insère sans auth.uid() ni created_by → fallback 'system' cohérent)
      CASE WHEN NEW.created_by IS NOT NULL THEN 'user'::TEXT ELSE 'system'::TEXT END
    );
    RETURN NEW;
  END IF;

  -- UPDATE = transition de status
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    v_action := CASE NEW.status
      WHEN 'opened' THEN 'Lien magique KYC ouvert par le client'
      WHEN 'uploading' THEN 'Pièces téléversées par le client'
      WHEN 'verifying' THEN 'Client en cours de vérification OCR'
      WHEN 'submitted' THEN 'Dossier soumis par le client (KYC complet)'
      WHEN 'expired' THEN 'Lien magique expiré sans soumission'
      ELSE 'Transition status lien magique : ' || NEW.status::TEXT
    END;
    v_severity := CASE NEW.status
      WHEN 'submitted' THEN 'info'
      WHEN 'expired' THEN 'warn'
      ELSE 'info'
    END;

    INSERT INTO activity_events
      (agency_id, actor_id, action, entity_type, entity_id,
       category, severity, object_label, metadata, actor_kind)
    VALUES (
      NEW.agency_id,
      NULL,  -- transitions déclenchées côté public, pas par un agent authentifié
      v_action,
      'kyc_magic_link',
      NEW.id,
      'kyc',
      v_severity,
      'Lien ' || NEW.id::TEXT,
      jsonb_build_object(
        'kyc_case_id', NEW.kyc_case_id,
        'previous_status', OLD.status,
        'new_status', NEW.status,
        'mode', NEW.mode,
        'client_ip', NEW.client_ip,
        'lba_article', 'art. 7 al. 1 (documentation)'
      ),
      'system'
    );

    NEW.updated_at := NOW();
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_audit_kyc_magic_link_insert ON kyc_magic_links;
CREATE TRIGGER trg_audit_kyc_magic_link_insert
  AFTER INSERT ON kyc_magic_links
  FOR EACH ROW EXECUTE FUNCTION audit_kyc_magic_link_transitions();

DROP TRIGGER IF EXISTS trg_audit_kyc_magic_link_update ON kyc_magic_links;
CREATE TRIGGER trg_audit_kyc_magic_link_update
  BEFORE UPDATE ON kyc_magic_links
  FOR EACH ROW EXECUTE FUNCTION audit_kyc_magic_link_transitions();

-- ─── 7. Storage bucket pour les uploads ───────────────────────────────────
-- Le bucket `kyc-magic-link` est temporaire — l'agent peut transférer les
-- pièces vers `kyc-documents` (bucket compliance définitif) après validation.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'kyc-magic-link',
  'kyc-magic-link',
  FALSE,
  10 * 1024 * 1024,  -- 10 MB max
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- RLS storage : path pattern `{agency_id}/{magic_link_id}/{filename}`
-- Public INSERT via Edge function (service_role bypasse RLS)
-- Agent SELECT/DELETE pour gérer les uploads de son agence

DROP POLICY IF EXISTS kyc_magic_link_storage_select ON storage.objects;
CREATE POLICY kyc_magic_link_storage_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'kyc-magic-link'
    AND (storage.foldername(name))[1] = get_my_agency_id()::TEXT
  );

DROP POLICY IF EXISTS kyc_magic_link_storage_delete ON storage.objects;
CREATE POLICY kyc_magic_link_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'kyc-magic-link'
    AND (storage.foldername(name))[1] = get_my_agency_id()::TEXT
  );

-- ─── 8. RPC helper — résolution token + métadonnées agent ─────────────────
-- Utilisée par l'écran KYC détail pour afficher l'état des liens envoyés.

CREATE OR REPLACE FUNCTION kyc_magic_link_summary(p_kyc_case_id UUID)
RETURNS TABLE (
  id UUID,
  status kyc_magic_link_status,
  mode kyc_magic_link_mode,
  sent_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  uploads_count INTEGER,
  channels TEXT[]
)
LANGUAGE sql STABLE
SECURITY INVOKER SET search_path = public, pg_temp
AS $$
  SELECT
    ml.id,
    ml.status,
    ml.mode,
    ml.sent_at,
    ml.expires_at,
    ml.opened_at,
    ml.confirmed_at,
    (SELECT COUNT(*)::INT FROM kyc_magic_link_uploads u WHERE u.magic_link_id = ml.id),
    ml.channels
  FROM kyc_magic_links ml
  WHERE ml.kyc_case_id = p_kyc_case_id
    AND ml.agency_id = get_my_agency_id()
  ORDER BY ml.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION kyc_magic_link_summary(UUID) TO authenticated;

COMMENT ON FUNCTION kyc_magic_link_summary(UUID) IS
  'Sprint 4.7.A — Liste des liens magiques d''un dossier KYC pour l''écran agent. RLS agency-scoped automatique.';
