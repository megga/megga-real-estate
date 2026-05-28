-- newsletter_subscribers — marketplace newsletter signup.
--
-- Branche les formulaires "Subscribe" présents en bas de page (FooterMega
-- sur /louer, /acheter, /listing/:id, etc. + PxNewsletter sur les pages
-- Property X). Avant cette migration les forms étaient cosmétiques :
-- onSubmit={e => e.preventDefault()} et rien d'autre.
--
-- Modèle minimal :
--   - id              uuid PK
--   - email           citext, UNIQUE (case-insensitive)
--   - lang            text  (FR par défaut — i18n.language au moment du submit)
--   - source          text  (footer_marketplace | px_newsletter | ...)
--   - status          text  (active | unsubscribed)  — pas de double opt-in en v1
--   - created_at      timestamptz
--   - unsubscribed_at timestamptz
--
-- RLS :
--   - anon INSERT seul (le visiteur s'inscrit lui-même, pas de SELECT pour
--     éviter l'énumération d'emails)
--   - super_admin SELECT/UPDATE/DELETE (gestion via le back-office admin)
--
-- Anti-doublon : index UNIQUE sur email. Le frontend traite le code 23505
-- comme un succès silencieux ("déjà inscrit, merci !").

BEGIN;

CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           citext NOT NULL UNIQUE,
  lang            text NOT NULL DEFAULT 'fr' CHECK (lang IN ('fr', 'de', 'en', 'it')),
  source          text NOT NULL DEFAULT 'footer_marketplace',
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  unsubscribed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_created_at
  ON public.newsletter_subscribers (created_at DESC);

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- anon INSERT — le visiteur s'inscrit. Pas de SELECT pour anon (anti-énumération).
DROP POLICY IF EXISTS "newsletter_anon_insert" ON public.newsletter_subscribers;
CREATE POLICY "newsletter_anon_insert"
  ON public.newsletter_subscribers
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (status = 'active');

-- super_admin : tout (gestion via le back-office admin). Helper existant
-- public.is_super_admin() (cf. baseline_remote_schema.sql:1923).
DROP POLICY IF EXISTS "newsletter_super_admin_all" ON public.newsletter_subscribers;
CREATE POLICY "newsletter_super_admin_all"
  ON public.newsletter_subscribers
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

COMMIT;
