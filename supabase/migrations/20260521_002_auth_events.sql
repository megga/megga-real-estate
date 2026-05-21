-- Auth events — table dédiée pour la télémétrie nLPD des actions d'auth.
--
-- Spec : handoff-auth/HANDOFF_AUTH_CLAUDE_CODE.md § "AuditEvents serveur".
-- Pas de PII brut (pas d'email en clair, IP non capturée côté client → laissée
-- vide pour cette phase ; à brancher via edge function plus tard pour calculer
-- SHA-256(ip + dailySalt)).
--
-- Distincte de `activity_events` (qui est CRM-scoped via agency_id + actor_id
-- et a une RLS qui requiert actor_id = auth.uid() à l'insert — incompatible
-- avec signin.failure où on n'a pas d'auth.uid()).

CREATE TABLE IF NOT EXISTS auth_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  severity    TEXT NOT NULL DEFAULT 'info'
              CHECK (severity IN ('info', 'warn', 'error')),
  ip_hash     TEXT,                 -- SHA-256(ip + dailySalt), rempli côté serveur
  user_agent  TEXT,                 -- tronqué 256c côté client
  detail      TEXT,                 -- libre, ex. "rate_limited, retry in 180s"
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE auth_events ADD CONSTRAINT auth_events_action_check
    CHECK (action ~ '^(signin|signup|magic_link|password|oauth|signout)\.');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_auth_events_user_id_created_at
  ON auth_events (user_id, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_auth_events_action_created_at
  ON auth_events (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_events_severity_created_at
  ON auth_events (severity, created_at DESC) WHERE severity != 'info';

ALTER TABLE auth_events ENABLE ROW LEVEL SECURITY;

-- Insert : tout le monde peut logger (y compris anon pour signin.failure).
-- Le user_agent + detail sont sous le contrôle du client donc considérés
-- comme non-fiables à 100% — la table sert d'audit, pas de source de vérité.
CREATE POLICY auth_events_insert_any ON auth_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Select : seul super_admin peut lire (helper is_super_admin() défini dans
-- 20260404_001_super_admin.sql).
CREATE POLICY auth_events_select_super_admin ON auth_events
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

COMMENT ON TABLE auth_events IS
  'Télémétrie nLPD des actions d''auth. Insert public (anon + authenticated), lecture super_admin seulement. Pas de PII brut.';
