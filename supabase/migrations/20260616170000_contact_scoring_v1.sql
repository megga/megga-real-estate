-- ════════════════════════════════════════════════════════════════════════════
-- MEGGA — Score de contact v1 (lead scoring acheteur, BACKEND persisté)
-- ════════════════════════════════════════════════════════════════════════════
-- « Ce lead mérite-t-il mon temps ? » — refonte du score-engine mort (edge +
-- hook jamais branchés). CONTRAINTE Gregory : le score est CALCULÉ + PERSISTÉ
-- en backend (RPC plpgsql + table), le client ne fait que LIRE via la RLS déjà
-- posée (≠ familles radar Focus qui scorent côté client).
--
-- v1 ACHETEUR seulement (vendeur déjà couvert par le radar seller-lead). Score
-- 0-100 DÉTERMINISTE, somme pondérée FIXE de 3 sous-scores HONNÊTES (data-backed) :
--   overall = 0.50·quality_declared + 0.30·budget_coherence_present + 0.20·pipeline_depth
-- Le comportemental (réactivité/engagement/visites/conversion/budget réel estimé…)
-- reste NULL — jamais fabriqué tant qu'on n'a pas les signaux. matches_count
-- n'est JAMAIS un terme additif (le volume de matches est ANTI-corrélé au sérieux :
-- en base, 1 lead 'cold' concentre 94% des matches).
--
-- Calqué sur 20260616120000_today_focus.sql (RPC SECURITY DEFINER + search_path
-- + statement_timeout + tunable app_config en TEXT/JSON + jumeau get_*_config)
-- et 20260604140100_learn_agent_style_cron.sql (cron gardé par présence pg_cron).
--
-- L'écriture du score (donnée perso DÉRIVÉE) est tracée dans activity_events
-- (1 event / agence / run, actor_kind='system') ; le score n'est JAMAIS exposé
-- au client/portail au-delà de la RLS d'agence déjà en place (LPD).

-- ── (1) NETTOYAGE NON DESTRUCTIF de contact_scores ──────────────────────────
-- Colonnes v1 (canonique = overall_score numeric 0-100, déjà restauré le 26/05).
ALTER TABLE public.contact_scores
  ADD COLUMN IF NOT EXISTS quality_score     numeric,
  ADD COLUMN IF NOT EXISTS pipeline_score    numeric,
  ADD COLUMN IF NOT EXISTS data_completeness numeric,
  ADD COLUMN IF NOT EXISTS score_label       text;

-- Comportemental v1 = NULL (jamais fabriqué). On retire les DEFAULT (0 / 'stable'
-- / '{}' / '[]') des colonnes que v1 ne calcule pas : un score v1 doit laisser ces
-- colonnes honnêtement VIDES plutôt qu'un 0 trompeur (= « mesuré à zéro »).
ALTER TABLE public.contact_scores
  ALTER COLUMN reactivity_score      DROP DEFAULT,
  ALTER COLUMN engagement_score      DROP DEFAULT,
  ALTER COLUMN visit_quality_score   DROP DEFAULT,
  ALTER COLUMN buyer_score           DROP DEFAULT,
  ALTER COLUMN conversion_probability DROP DEFAULT,
  ALTER COLUMN interactions_count    DROP DEFAULT,
  ALTER COLUMN visits_count          DROP DEFAULT,
  ALTER COLUMN matches_sent_count    DROP DEFAULT,
  ALTER COLUMN engagement_trend      DROP DEFAULT,
  ALTER COLUMN intent_signals        DROP DEFAULT,
  ALTER COLUMN rejection_patterns    DROP DEFAULT;

-- Index mort (buyer_score, jamais écrit en v1) → on le retire ; index de lecture v1.
DROP INDEX IF EXISTS public.idx_contact_scores_buyer;
CREATE INDEX IF NOT EXISTS idx_contact_scores_agency_overall
  ON public.contact_scores (agency_id, overall_score DESC);

-- ── (2) TUNABLES app_config 'contact_scoring_v1' (value TEXT → chaîne JSON, lue
-- en ::jsonb comme today_focus_v1). Barème pilotable en DB sans redeploy ; le RPC
-- COALESCE chaque clé sur un littéral, donc un JSON cassé ne casse pas le calcul.
-- NB : `buyer_types` et `thresholds.completeness_limited_below` NE sont PAS lus par
-- le RPC (le filtre acheteur est codé en dur ; le seuil de complétude sert l'UI
-- côté client via get_contact_score_config) — forward-looking, documentés ici.
INSERT INTO public.app_config (key, value)
VALUES (
  'contact_scoring_v1',
  '{"weights":{"quality":0.50,"budget":0.30,"pipeline":0.20},"quality_map":{"hot":85,"warm":65,"cold":35,"unknown":50},"buyer_types":["buyer","lead"],"budget":{"present_full":100,"present_min":70,"implausible":50,"absent":30,"rent_min":300,"rent_max":30000,"buy_min":50000,"buy_max":50000000},"pipeline":{"stage_depth":{"lead":20,"new_lead":20,"qualified":35,"to_qualify":35,"active_search":40,"visit_planned":50,"visit_planned_legacy":50,"visit_done":60,"interest_confirmed":65,"offer":75,"negotiation":80,"reserved":85,"financing":90,"notary":95,"signed":100,"closed":100,"lost":15,"to_recontact":15},"no_tx_depth":25,"kyc_validated_bonus":8},"thresholds":{"label_serieux":70,"label_a_qualifier":45,"completeness_limited_below":0.34},"version":1}'
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ── (3) RPC de lecture du barème (jumeau de get_today_focus_config) ──────────
-- app_config n'est pas destiné à être lu directement par le client. Ce wrapper
-- SECURITY DEFINER n'expose QUE la clé 'contact_scoring_v1' (jamais tout app_config)
-- pour que l'UI interprète les paliers (sérieux/à qualifier/froid) honnêtement. La
-- sécurité tient aux GRANTs ci-dessous (REVOKE anon), pas à une hypothèse sur get_app_config.
CREATE OR REPLACE FUNCTION public.get_contact_score_config()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT value::jsonb FROM app_config WHERE key = 'contact_scoring_v1'),
    '{}'::jsonb
  );
$$;

REVOKE ALL ON FUNCTION public.get_contact_score_config() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_contact_score_config() TO authenticated, service_role;

-- ── (4) RPC de CALCUL + UPSERT (service-role / cron uniquement) ──────────────
-- p_agency NULL → toutes les agences (mode cron) ; sinon scope à l'agence donnée.
-- service_role-only (GRANT plus bas) → pas de surface IDOR : le param EST le scope,
-- pas besoin de garde JWT (get_user_agency_id() serait NULL en contexte cron).
CREATE OR REPLACE FUNCTION public.calculate_contact_scores(p_agency uuid DEFAULT NULL)
RETURNS integer  -- nombre de contacts (re)scorés
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '60s'
AS $$
DECLARE
  v_cfg     jsonb;
  v_now     timestamptz := now();
  v_count   integer := 0;
  v_version integer;
  -- poids
  w_quality  numeric; w_budget numeric; w_pipeline numeric;
  -- qualité déclarée (contacts.score)
  q_hot numeric; q_warm numeric; q_cold numeric; q_unknown numeric;
  -- cohérence budget (présence/plausibilité, tx-type-aware)
  b_full numeric; b_min numeric; b_implausible numeric; b_absent numeric;
  rent_min numeric; rent_max numeric; buy_min numeric; buy_max numeric;
  -- profondeur pipeline
  p_stage_depth jsonb; p_no_tx numeric; p_kyc_bonus numeric;
  -- paliers
  th_serieux numeric; th_a_qualifier numeric;
BEGIN
  SELECT value::jsonb INTO v_cfg FROM app_config WHERE key = 'contact_scoring_v1';

  w_quality      := COALESCE((v_cfg->'weights'->>'quality')::numeric, 0.50);
  w_budget       := COALESCE((v_cfg->'weights'->>'budget')::numeric, 0.30);
  w_pipeline     := COALESCE((v_cfg->'weights'->>'pipeline')::numeric, 0.20);
  q_hot          := COALESCE((v_cfg->'quality_map'->>'hot')::numeric, 85);
  q_warm         := COALESCE((v_cfg->'quality_map'->>'warm')::numeric, 65);
  q_cold         := COALESCE((v_cfg->'quality_map'->>'cold')::numeric, 35);
  q_unknown      := COALESCE((v_cfg->'quality_map'->>'unknown')::numeric, 50);
  b_full         := COALESCE((v_cfg->'budget'->>'present_full')::numeric, 100);
  b_min          := COALESCE((v_cfg->'budget'->>'present_min')::numeric, 70);
  b_implausible  := COALESCE((v_cfg->'budget'->>'implausible')::numeric, 50);
  b_absent       := COALESCE((v_cfg->'budget'->>'absent')::numeric, 30);
  rent_min       := COALESCE((v_cfg->'budget'->>'rent_min')::numeric, 300);
  rent_max       := COALESCE((v_cfg->'budget'->>'rent_max')::numeric, 30000);
  buy_min        := COALESCE((v_cfg->'budget'->>'buy_min')::numeric, 50000);
  buy_max        := COALESCE((v_cfg->'budget'->>'buy_max')::numeric, 50000000);
  p_stage_depth  := COALESCE(v_cfg->'pipeline'->'stage_depth', '{}'::jsonb);
  p_no_tx        := COALESCE((v_cfg->'pipeline'->>'no_tx_depth')::numeric, 25);
  p_kyc_bonus    := COALESCE((v_cfg->'pipeline'->>'kyc_validated_bonus')::numeric, 8);
  th_serieux     := COALESCE((v_cfg->'thresholds'->>'label_serieux')::numeric, 70);
  th_a_qualifier := COALESCE((v_cfg->'thresholds'->>'label_a_qualifier')::numeric, 45);
  v_version      := COALESCE((v_cfg->>'version')::int, 1);

  WITH scored AS (
    SELECT
      c.id        AS contact_id,
      c.agency_id AS agency_id,
      -- qualité déclarée (« qualification agent », déclaratif) → hot/warm/cold/unknown
      CASE lower(COALESCE(c.score, ''))
        WHEN 'hot' THEN q_hot WHEN 'warm' THEN q_warm WHEN 'cold' THEN q_cold ELSE q_unknown
      END AS quality_score,
      -- cohérence budget : présence + plausibilité du budget_max (tx-type-aware) ;
      -- budget_min seul = « min seul » ; rien = « absent ».
      CASE
        WHEN bud.bmax IS NOT NULL THEN
          CASE WHEN bud.bmax BETWEEN
                 (CASE WHEN bud.tx_type = 'rent' THEN rent_min ELSE buy_min END)
             AND (CASE WHEN bud.tx_type = 'rent' THEN rent_max ELSE buy_max END)
               THEN b_full ELSE b_implausible END
        WHEN bud.bmin IS NOT NULL THEN b_min
        ELSE b_absent
      END AS budget_score,
      -- profondeur pipeline : stage le plus avancé d'une tx (acheteur) non annulée ;
      -- aucune tx → no_tx_depth ; + bonus KYC non-bloquant ; borné [0..100].
      LEAST(100,
        (CASE WHEN COALESCE(pl.n_tx, 0) > 0 THEN COALESCE(pl.max_depth, p_no_tx) ELSE p_no_tx END)
        + (CASE WHEN COALESCE(kv.validated, false) THEN p_kyc_bonus ELSE 0 END)
      ) AS pipeline_score,
      -- complétude honnête : 3 signaux présents ? (score / budget / tx)
      (c.score IS NOT NULL AND c.score <> '')        AS has_score,
      (bud.bmin IS NOT NULL OR bud.bmax IS NOT NULL) AS has_budget,
      (COALESCE(pl.n_tx, 0) > 0)                     AS has_tx
    FROM contacts c
    -- recherche active la plus récente : budget (min/max) + type de transaction.
    -- Cast DÉFENSIF : un budget non numérique ('approx 800k', "800'000") → NULL
    -- (traité comme « absent ») au lieu d'une exception qui ferait planter tout le
    -- run. Scope agence (parité avec pl/kv ; defense-in-depth cross-agence).
    LEFT JOIN LATERAL (
      SELECT (cr.criteria->>'transaction_type') AS tx_type,
             CASE WHEN cr.criteria->>'budget_min' ~ '^[0-9]+(\.[0-9]+)?$'
                  THEN (cr.criteria->>'budget_min')::numeric END AS bmin,
             CASE WHEN cr.criteria->>'budget_max' ~ '^[0-9]+(\.[0-9]+)?$'
                  THEN (cr.criteria->>'budget_max')::numeric END AS bmax
      FROM client_searches cr
      WHERE cr.contact_id = c.id AND cr.is_active = true AND cr.agency_id = c.agency_id
      ORDER BY cr.updated_at DESC NULLS LAST, cr.created_at DESC NULLS LAST
      LIMIT 1
    ) bud ON true
    -- stage le plus avancé parmi les transactions acheteur non annulées
    LEFT JOIN LATERAL (
      SELECT count(*) AS n_tx,
             max(COALESCE((p_stage_depth->>(t.stage::text))::numeric, 20)) AS max_depth
      FROM transactions t
      WHERE t.contact_buyer_id = c.id
        AND t.agency_id = c.agency_id
        AND t.status <> 'cancelled'
    ) pl ON true
    -- KYC validé (bonus non-bloquant ; absence ne pénalise jamais)
    LEFT JOIN LATERAL (
      SELECT bool_or(k.status = 'validated') AS validated
      FROM kyc_cases k
      WHERE k.contact_id = c.id AND k.agency_id = c.agency_id
    ) kv ON true
    WHERE c.type IN ('buyer', 'lead')        -- v1 acheteur (buyer_types informatif en config)
      AND c.agency_id IS NOT NULL            -- contacts.agency_id NULLABLE → sinon NOT NULL violation
                                             -- (contact_scores.agency_id NOT NULL) qui tuerait tout le run cron
      AND (p_agency IS NULL OR c.agency_id = p_agency)
  ),
  labeled AS (
    SELECT contact_id, agency_id, quality_score, budget_score, pipeline_score,
      round(w_quality * quality_score + w_budget * budget_score + w_pipeline * pipeline_score) AS overall_score,
      round((has_score::int + has_budget::int + has_tx::int)::numeric / 3.0, 2) AS data_completeness
    FROM scored
  ),
  finalrows AS (
    SELECT *,
      CASE WHEN overall_score >= th_serieux     THEN 'serieux'
           WHEN overall_score >= th_a_qualifier THEN 'a_qualifier'
           ELSE 'froid' END AS score_label
    FROM labeled
  ),
  upsert AS (
    INSERT INTO contact_scores AS cs
      (contact_id, agency_id, quality_score, budget_coherence_score, pipeline_score,
       overall_score, data_completeness, score_label, last_calculated_at)
    SELECT contact_id, agency_id, quality_score, budget_score, pipeline_score,
           overall_score, data_completeness, score_label, v_now
    FROM finalrows
    ON CONFLICT (contact_id) DO UPDATE SET
      agency_id              = EXCLUDED.agency_id,
      quality_score          = EXCLUDED.quality_score,
      budget_coherence_score = EXCLUDED.budget_coherence_score,
      pipeline_score         = EXCLUDED.pipeline_score,
      overall_score          = EXCLUDED.overall_score,
      data_completeness      = EXCLUDED.data_completeness,
      score_label            = EXCLUDED.score_label,
      last_calculated_at     = EXCLUDED.last_calculated_at,
      -- comportemental v1 = NULL (jamais fabriqué), même si une version passée a écrit 0
      reactivity_score       = NULL,
      engagement_score       = NULL,
      visit_quality_score    = NULL,
      buyer_score            = NULL,
      conversion_probability = NULL,
      conversion_score       = NULL,
      estimated_real_budget  = NULL,
      estimated_budget       = NULL,
      engagement_trend       = NULL,
      intent_signals         = NULL,
      rejection_patterns     = NULL,
      interactions_count     = NULL,
      visits_count           = NULL,
      matches_sent_count     = NULL
    RETURNING cs.agency_id
  ),
  trace AS (
    -- audit trail : 1 event / agence / run (donnée perso dérivée, LPD). category
    -- 'contact' + severity 'info' pour classer comme le reste de la piste contact.
    -- metadata = count + version uniquement (aucune PII).
    INSERT INTO activity_events (agency_id, actor_kind, actor_id, action, entity_type, category, severity, metadata)
    SELECT agency_id, 'system', NULL, 'contact_scores.recompute', 'contact_scores', 'contact', 'info',
           jsonb_build_object('count', count(*), 'version', v_version)
    FROM upsert
    GROUP BY agency_id
    RETURNING 1
  )
  SELECT count(*)::int INTO v_count FROM upsert;

  RETURN v_count;
END;
$$;

-- ── (5) GRANTS — calcul = service_role / cron UNIQUEMENT (jamais authenticated/anon).
REVOKE ALL ON FUNCTION public.calculate_contact_scores(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_contact_scores(uuid) TO service_role;

-- ── (6) CRON nocturne (03:00 UTC) — recalcul toutes agences. Gardé par présence
-- pg_cron : planifié en prod, sauté en local/CI (schema "cron" absent) pour ne pas
-- casser l'application des migrations.
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    PERFORM cron.schedule(
      'contact-score-nightly',
      '0 3 * * *',
      $cron$ SELECT public.calculate_contact_scores(); $cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron absent (local/CI) — contact-score-nightly non planifié';
  END IF;
END
$do$;
