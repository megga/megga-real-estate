-- contact_messages — formulaire de contact général (page publique /contact).
--
-- Distinct des support_tickets (qui gèrent les demandes d'aide produit avec
-- catégories, SLA, statuts complexes, CSAT, etc.). Ici on capte un message
-- libre depuis la page marketing /contact (PxContactHero) : "Bonjour, je
-- voudrais vendre mon appartement", "Question sur l'estimation", etc.
--
-- Workflow attendu :
--   1. Visiteur remplit le form sur /contact → INSERT par anon
--   2. Email confirmation envoyé au visiteur (template contact_confirmation)
--   3. Email notification envoyé à l'admin (template contact_notification_admin)
--   4. L'agent répond directement par email (pas de thread en base v1)
--   5. L'admin marque le message comme "answered" / "archived" / "spam"
--
-- RLS :
--   - anon/authenticated INSERT (avec consent_privacy obligatoire)
--   - super_admin SELECT/UPDATE/DELETE (back-office)
--   - PAS de SELECT pour anon (anti-énumération / anti-scraping d'identités)
--
-- Anti-spam :
--   - consent_privacy obligatoire au niveau DB (CHECK)
--   - Rate-limiting prévu côté Edge Function (futur, non bloquant v1)

BEGIN;

CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS public.contact_messages (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       timestamptz NOT NULL    DEFAULT now(),

  -- Identité du visiteur
  name             text        NOT NULL    CHECK (length(trim(name))  BETWEEN 1 AND 120),
  email            citext      NOT NULL    CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone            text        NULL        CHECK (phone IS NULL OR length(trim(phone)) BETWEEN 3 AND 40),

  -- Contenu
  subject          text        NULL        CHECK (subject IS NULL OR length(trim(subject)) BETWEEN 1 AND 200),
  message          text        NOT NULL    CHECK (length(trim(message)) BETWEEN 10 AND 5000),

  -- Métadonnées
  lang             text        NOT NULL    DEFAULT 'fr'           CHECK (lang IN ('fr', 'de', 'en', 'it')),
  source           text        NOT NULL    DEFAULT 'contact_page' CHECK (length(source) BETWEEN 1 AND 60),
  consent_privacy  boolean     NOT NULL                           CHECK (consent_privacy = true),

  -- Statut admin
  status           text        NOT NULL    DEFAULT 'new'          CHECK (status IN ('new', 'answered', 'archived', 'spam')),
  responded_at     timestamptz NULL,
  responded_by     uuid        NULL        REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Index pour le back-office (liste triée par date + filtres status).
CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at
  ON public.contact_messages (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contact_messages_status_created
  ON public.contact_messages (status, created_at DESC)
  WHERE status = 'new';

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- anon INSERT — le visiteur envoie son message. consent_privacy=true imposé
-- par la CHECK + par la policy (defense in depth).
DROP POLICY IF EXISTS "contact_messages_anon_insert" ON public.contact_messages;
CREATE POLICY "contact_messages_anon_insert"
  ON public.contact_messages
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (consent_privacy = true AND status = 'new');

-- super_admin : tout (gestion via le back-office admin).
DROP POLICY IF EXISTS "contact_messages_super_admin_all" ON public.contact_messages;
CREATE POLICY "contact_messages_super_admin_all"
  ON public.contact_messages
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

COMMIT;
