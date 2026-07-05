-- Corpus de savoir métier immobilier suisse (« cerveau expert » du copilote).
-- Retrieval DÉTERMINISTE (0 embedding) : le copilote sélectionne des extraits
-- SOURCÉS + DATÉS + VALIDÉS-HUMAIN et les injecte dans le prompt selon l'intent.
-- La donnée est un savoir PARTAGÉ (droit suisse), pas de la donnée d'agence :
-- aucune colonne agency_id, lecture ouverte à tout agent authentifié.
--
-- Gate de qualité = la DONNÉE, pas un flag : seul status='active' est injecté, et
-- un snippet ne passe 'active' qu'après relecture humaine (revue de PR + seed).
-- Kill-switch d'exploitation en plus (app_config copilot_knowledge_enabled).

BEGIN;

CREATE TABLE IF NOT EXISTS public.knowledge_snippets (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug               text NOT NULL UNIQUE,
  domain             text NOT NULL,
  canton             text,                         -- NULL = droit fédéral
  title              text NOT NULL,
  body_md            text NOT NULL,
  applies_to_actions text[] NOT NULL DEFAULT '{}', -- actions copilote concernées
  keywords           text[] NOT NULL DEFAULT '{}', -- normalisés (sans accents, minuscules)
  priority           integer NOT NULL DEFAULT 5,
  source_url         text NOT NULL,                -- source OFFICIELLE (jamais NULL)
  source_ref         text,                         -- ex. « LDTR/GE art. 39 », « CO art. 269d »
  verified_at        date NOT NULL,                -- date de vérification de la source
  review_after       date,                         -- péremption (NULL = jamais)
  status             text NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft', 'active', 'expired')),
  lang               text NOT NULL DEFAULT 'fr',
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Recherche du sélecteur : filtre WHERE status='active' + match keywords (GIN) OU
-- applies_to_actions (GIN). Index GIN sur les deux tableaux + index partiel actif.
CREATE INDEX IF NOT EXISTS idx_knowledge_keywords_gin
  ON public.knowledge_snippets USING gin (keywords);
CREATE INDEX IF NOT EXISTS idx_knowledge_actions_gin
  ON public.knowledge_snippets USING gin (applies_to_actions);
CREATE INDEX IF NOT EXISTS idx_knowledge_active
  ON public.knowledge_snippets (domain, priority DESC)
  WHERE status = 'active';

-- touch updated_at
CREATE OR REPLACE FUNCTION public.trg_knowledge_touch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_knowledge_snippets_touch ON public.knowledge_snippets;
CREATE TRIGGER trg_knowledge_snippets_touch
  BEFORE UPDATE ON public.knowledge_snippets
  FOR EACH ROW EXECUTE FUNCTION public.trg_knowledge_touch();

-- RLS : lecture pour tout agent authentifié (savoir partagé, zéro PII). Les
-- écritures passent par le service_role (script de seed), qui contourne la RLS.
ALTER TABLE public.knowledge_snippets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS knowledge_snippets_select ON public.knowledge_snippets;
CREATE POLICY knowledge_snippets_select
  ON public.knowledge_snippets FOR SELECT
  TO authenticated
  USING (true);

REVOKE ALL ON public.knowledge_snippets FROM PUBLIC, anon;
GRANT SELECT ON public.knowledge_snippets TO authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON public.knowledge_snippets TO service_role;

-- Kill-switch d'exploitation. Défaut 'false' : le corpus reste inerte tant qu'un
-- humain n'a pas validé (revue PR) puis activé en prod (mise à 'true'). Miroir du
-- pattern copilot_tools_enabled / copilot_persistence_enabled.
INSERT INTO public.app_config (key, value)
VALUES ('copilot_knowledge_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

-- Péremption automatique : un snippet dont review_after est dépassé passe
-- 'expired' (donc plus jamais injecté). Fonction pure SQL + audit d'un résumé.
CREATE OR REPLACE FUNCTION public.expire_knowledge_snippets()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH expired AS (
    UPDATE public.knowledge_snippets
    SET status = 'expired'
    WHERE status = 'active'
      AND review_after IS NOT NULL
      AND review_after < current_date
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM expired;

  IF v_count > 0 THEN
    INSERT INTO public.activity_events
      (agency_id, actor_id, actor_kind, action, entity_type, entity_id, category, metadata)
    VALUES
      (NULL, NULL, 'system', 'Corpus MEGGA — snippets périmés', 'ai_chat', NULL, 'ai',
       jsonb_build_object('expired_count', v_count));
  END IF;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_knowledge_snippets() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_knowledge_snippets() TO service_role;

-- Planification hebdomadaire (lundi 03:15 UTC). Gardé par la présence de pg_cron :
-- planifié en prod, sauté en local/CI (schema « cron » absent).
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    PERFORM cron.schedule(
      'knowledge-snippets-expire-weekly',
      '15 3 * * 1',
      $cron$ SELECT public.expire_knowledge_snippets(); $cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron absent (local/CI) — knowledge-snippets-expire-weekly non planifié';
  END IF;
END
$do$;

COMMIT;
