-- ════════════════════════════════════════════════════════════════════════════
-- MEGGA — Score de bien v1 (santé/chaleur d'un bien INTERNE, BACKEND persisté)
-- ════════════════════════════════════════════════════════════════════════════
-- Jumeau symétrique du score de contact (20260616170000_contact_scoring_v1.sql).
-- « Ce bien est-il sain / prêt-à-vendre / en train d'avancer ? » — refonte de la
-- table property_scores DORMANTE (0 ligne). CONTRAINTE Gregory (identique au
-- contact) : le score est CALCULÉ + PERSISTÉ en backend (RPC plpgsql + table), le
-- client ne fait que LIRE via la RLS d'agence déjà posée. AUCUN affichage UI en v1
-- (porté mais invisible, comme le lead_score du contact). La famille radar Focus
-- « bien qui stagne / à pousser » est DIFFÉRÉE — hors de cette PR.
--
-- ENTITÉ SCORÉE = public.properties (biens INTERNES, RLS agence). PAS market_listings
-- (marketplace OFF) : les colonnes marché de property_scores restent NULL, jamais
-- écrites SUR LES LIGNES source='internal' produites par ce RPC. Signaux v1 = 100%
-- internes CRM. 0 LLM. Déterministe.
--
-- Score 0-100 = SANTÉ/CHALEUR. HAUT = sain/chaud/qui avance ; BAS = stagnant/
-- incomplet/froid. Somme pondérée FIXE de 4 sous-scores HONNÊTES (data-backed) :
--   overall = 0.20·freshness + 0.20·interest + 0.15·pipeline + 0.45·completeness
-- Le comportemental (views/favorites=0 fantômes, visits/offers=0) et TOUTES les
-- colonnes marché (market_position_score, comparable_count, avg_comparable_price,
-- price_vs_market_pct, market_listing_id) restent NULL — jamais fabriqués.
-- interest n'est JAMAIS un terme additif brut : le COMPTE de matches est BORNÉ
-- (volume_cap) + mélangé à la qualité moyenne — leçon directe du contact 'cold'
-- à 2517 matches (le volume est anti-corrélé au sérieux ; un futur bien 'rent'
-- aspirerait des milliers de matches).
--
-- Calqué EXACTEMENT sur 20260616170000_contact_scoring_v1.sql (RPC SECURITY DEFINER
-- + search_path + statement_timeout 60s + tunable app_config en TEXT/JSON + jumeau
-- get_property_score_config() + cron gardé par présence pg_cron + trace activity_events).
--
-- DIVERGENCES vs contact (gérées explicitement plus bas) :
--   • ON CONFLICT cible (property_id, source) — PAS de unique sur property_id seul.
--   • source := 'internal' littéral partout (CHECK source IN internal/market).
--   • agency_id TOUJOURS écrit (RLS lecture = OR agency_id IS NULL → un NULL fuiterait).
--   • activity_events.category = 'bien' (PAS 'contact').
--   • cron décalé à 03:50 (contact 03:00 ; 03:30 occupé par cleanup-orphan-property-drafts).
--   • complétude calculée inline sur properties (UNE agence, petit volume).
--   • pas de bonus KYC (le KYC est porté par le contact, pas par le bien).

-- ── (1) NETTOYAGE NON DESTRUCTIF de property_scores ─────────────────────────
-- Colonnes v1 canoniques (overall_score 0-100 + 4 sous-scores + label + complétude).
-- N'existent PAS aujourd'hui (vérifié live) → ADD COLUMN IF NOT EXISTS.
ALTER TABLE public.property_scores
  ADD COLUMN IF NOT EXISTS overall_score      numeric,
  ADD COLUMN IF NOT EXISTS freshness_score    numeric,
  ADD COLUMN IF NOT EXISTS interest_score     numeric,
  ADD COLUMN IF NOT EXISTS pipeline_score     numeric,
  ADD COLUMN IF NOT EXISTS completeness_score numeric,
  ADD COLUMN IF NOT EXISTS score_label        text,
  ADD COLUMN IF NOT EXISTS data_completeness  numeric;

-- Marché + comportemental v1 = NULL (jamais fabriqué : marketplace OFF, signaux
-- absents). On retire les DEFAULT (0 / 'stable' / 'low') des colonnes que v1 ne
-- calcule pas : un score v1 doit laisser ces colonnes honnêtement VIDES plutôt
-- qu'un 0/'stable' trompeur (= « mesuré à zéro »). days_on_market : on retire son
-- DEFAULT et on ne l'alimente PAS dans le RPC (la fraîcheur vit dans freshness_score),
-- il reste honnêtement NULL au lieu d'un 0 trompeur.
ALTER TABLE public.property_scores
  ALTER COLUMN heat_score            DROP DEFAULT,
  ALTER COLUMN market_position_score DROP DEFAULT,
  ALTER COLUMN interest_level        DROP DEFAULT,
  ALTER COLUMN days_on_market        DROP DEFAULT,
  ALTER COLUMN comparable_count      DROP DEFAULT,
  ALTER COLUMN price_trend           DROP DEFAULT,
  ALTER COLUMN stagnation_risk       DROP DEFAULT;

-- Index mort (heat_score, jamais écrit en v1) → on le retire ; index de lecture v1.
-- (idx_property_scores_agency [agency_id seul] existe déjà et reste — distinct.)
DROP INDEX IF EXISTS public.idx_property_scores_heat;
CREATE INDEX IF NOT EXISTS idx_property_scores_agency_overall
  ON public.property_scores (agency_id, overall_score DESC);

-- ── (2) TUNABLES app_config 'property_scoring_v1' (value TEXT → chaîne JSON, lue
-- en ::jsonb comme contact_scoring_v1). Barème pilotable en DB sans redeploy ; le
-- RPC COALESCE chaque clé sur un littéral, donc un JSON cassé ne casse pas le calcul.
-- NB : `thresholds.completeness_limited_below` N'est PAS lu par le RPC (il sert l'UI
-- future via get_property_score_config pour signaler « score sur peu de signaux »).
INSERT INTO public.app_config (key, value)
VALUES (
  'property_scoring_v1',
  '{"weights":{"freshness":0.20,"interest":0.20,"pipeline":0.15,"completeness":0.45},"freshness":{"tiers":[{"max_days":30,"score":100},{"max_days":60,"score":80},{"max_days":90,"score":60},{"max_days":180,"score":40}],"floor":20},"interest":{"volume_cap":4,"weight_volume":0.60,"weight_quality":0.40,"neutral":30},"pipeline":{"stage_depth":{"lead":20,"new_lead":20,"qualified":35,"to_qualify":35,"active_search":40,"visit_planned":50,"visit_planned_legacy":50,"visit_done":60,"interest_confirmed":65,"offer":75,"negotiation":80,"reserved":85,"financing":90,"notary":95,"signed":100,"closed":100,"lost":15,"to_recontact":15},"unknown_stage_depth":20,"no_tx_depth":25},"completeness":{"desc_min_len":40,"fields":{"price":1.0,"surface_m2":1.0,"rooms_or_bedrooms":1.0,"description":1.0,"photos":1.5,"location":1.0,"energy":0.5,"year_built":0.5,"c2pa_verified":0.5}},"thresholds":{"label_chaud":70,"label_a_animer":45,"completeness_limited_below":0.50},"version":1}'
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ── (3) RPC de lecture du barème (jumeau de get_contact_score_config) ────────
-- app_config n'est pas destiné à être lu directement par le client. Ce wrapper
-- SECURITY DEFINER n'expose QUE la clé 'property_scoring_v1' (jamais tout app_config)
-- pour que l'UI future interprète les paliers (chaud/à animer/en veille) honnêtement.
-- La sécurité tient aux GRANTs ci-dessous (REVOKE anon), pas à une hypothèse sur get_app_config.
CREATE OR REPLACE FUNCTION public.get_property_score_config()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT value::jsonb FROM app_config WHERE key = 'property_scoring_v1'),
    '{}'::jsonb
  );
$$;

REVOKE ALL ON FUNCTION public.get_property_score_config() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_property_score_config() TO authenticated, service_role;

-- ── (4) RPC de CALCUL + UPSERT (service-role / cron uniquement) ──────────────
-- p_agency NULL → toutes les agences (mode cron) ; sinon scope à l'agence donnée.
-- service_role-only (GRANT plus bas) → pas de surface IDOR : le param EST le scope,
-- pas besoin de garde JWT (get_my_agency_id() serait NULL en contexte cron).
--
-- NB CI (landmine vérifiée) : la table properties a des triggers on_property_active
-- + on_property_price_change qui appellent net.http_post(get_app_config('supabase_url'))
-- — MAIS ce RPC n'écrit QUE dans property_scores et activity_events, JAMAIS dans
-- properties, donc ces triggers ne se déclenchent pas pendant le calcul. Aucune
-- parade supabase_url nécessaire ici (≠ seed de données de test).
CREATE OR REPLACE FUNCTION public.calculate_property_scores(p_agency uuid DEFAULT NULL)
RETURNS integer  -- nombre de biens (re)scorés
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
  w_fresh numeric; w_interest numeric; w_pipeline numeric; w_complete numeric;
  -- fraîcheur (paliers + plancher)
  fr_tiers jsonb; fr_floor numeric;
  -- intérêt (volume borné + qualité, neutre si 0 match)
  int_cap numeric; int_w_vol numeric; int_w_qual numeric; int_neutral numeric;
  -- pipeline (profondeur de stage, neutre si 0 tx)
  p_stage_depth jsonb; p_unknown_depth numeric; p_no_tx numeric;
  -- complétude (longueur min de description + poids des champs)
  c_desc_min int; c_fields jsonb; c_total_w numeric;
  -- paliers de label
  th_chaud numeric; th_a_animer numeric;
BEGIN
  SELECT value::jsonb INTO v_cfg FROM app_config WHERE key = 'property_scoring_v1';

  w_fresh         := COALESCE((v_cfg->'weights'->>'freshness')::numeric,    0.20);
  w_interest      := COALESCE((v_cfg->'weights'->>'interest')::numeric,     0.20);
  w_pipeline      := COALESCE((v_cfg->'weights'->>'pipeline')::numeric,     0.15);
  w_complete      := COALESCE((v_cfg->'weights'->>'completeness')::numeric, 0.45);
  fr_tiers        := COALESCE(v_cfg->'freshness'->'tiers',
                       '[{"max_days":30,"score":100},{"max_days":60,"score":80},{"max_days":90,"score":60},{"max_days":180,"score":40}]'::jsonb);
  fr_floor        := COALESCE((v_cfg->'freshness'->>'floor')::numeric, 20);
  -- GREATEST(1, …) : garde-fou anti division-par-zéro si volume_cap est tuné à 0
  -- en base (le COALESCE ne couvre que la clé ABSENTE, pas la valeur 0 ; 3/0 lèverait
  -- ERROR 22012 et tuerait tout le run nocturne). Même posture défensive que c_total_w.
  int_cap         := GREATEST(1, COALESCE((v_cfg->'interest'->>'volume_cap')::numeric, 4));
  int_w_vol       := COALESCE((v_cfg->'interest'->>'weight_volume')::numeric, 0.60);
  int_w_qual      := COALESCE((v_cfg->'interest'->>'weight_quality')::numeric, 0.40);
  int_neutral     := COALESCE((v_cfg->'interest'->>'neutral')::numeric, 30);
  p_stage_depth   := COALESCE(v_cfg->'pipeline'->'stage_depth', '{}'::jsonb);
  p_unknown_depth := COALESCE((v_cfg->'pipeline'->>'unknown_stage_depth')::numeric, 20);
  p_no_tx         := COALESCE((v_cfg->'pipeline'->>'no_tx_depth')::numeric, 25);
  c_desc_min      := COALESCE((v_cfg->'completeness'->>'desc_min_len')::int, 40);
  c_fields        := COALESCE(v_cfg->'completeness'->'fields',
                       '{"price":1.0,"surface_m2":1.0,"rooms_or_bedrooms":1.0,"description":1.0,"photos":1.5,"location":1.0,"energy":0.5,"year_built":0.5,"c2pa_verified":0.5}'::jsonb);
  th_chaud        := COALESCE((v_cfg->'thresholds'->>'label_chaud')::numeric, 70);
  th_a_animer     := COALESCE((v_cfg->'thresholds'->>'label_a_animer')::numeric, 45);
  v_version       := COALESCE((v_cfg->>'version')::int, 1);

  -- somme de TOUS les poids de champs (dénominateur de la complétude de fiche).
  -- Calculée une fois ici, défensive (NULLIF(…,0)->8.0 → division par zéro impossible).
  SELECT COALESCE(NULLIF(sum((f.value)::numeric), 0), 8.0)
    INTO c_total_w
  FROM jsonb_each_text(c_fields) AS f;

  WITH scored AS (
    SELECT
      p.id        AS property_id,
      p.agency_id AS agency_id,

      -- ── AXE 1 — FRAÎCHEUR (toujours présent : created_at NOT NULL) ─────────
      -- days_on_market = jours depuis création (published_at NULL 6/6 → inutilisable).
      -- Cast int + plancher 0 (contre une horloge de seed dans le futur). Décroissance
      -- par PALIERS : on prend le score du 1er palier dont max_days >= dom (paliers triés
      -- croissant) ; au-delà du dernier → fr_floor (jamais 0, un vieux bien ne cratère pas).
      -- Borné [0..100] (symétrie avec les 3 autres axes : un palier mal tuné ne persiste
      -- pas une valeur hors-bornes dans la colonne).
      LEAST(100, GREATEST(0, (
        SELECT COALESCE(
          (SELECT (t.elem->>'score')::numeric
             FROM jsonb_array_elements(fr_tiers) AS t(elem)
            WHERE GREATEST(0, (v_now::date - p.created_at::date))::int <= (t.elem->>'max_days')::int
            ORDER BY (t.elem->>'max_days')::int ASC
            LIMIT 1),
          fr_floor)
      ))) AS freshness_score,

      -- ── AXE 2 — INTÉRÊT (borné, neutre si 0 match) ────────────────────────
      -- matches INTERNES uniquement (source='internal' ; les matches marché pointant
      -- market_listing_id sont EXCLUS). Scope agence (defense-in-depth). Le compte =
      -- nb de contacts distincts croisés (uq matches(contact_id, property_id)).
      -- ANTI-PIÈGE-VOLUME : le compte n'est JAMAIS additif brut, il sature à int_cap
      -- (volume_part) et se mélange à la qualité moyenne (quality_part, bornée 0..100).
      -- 0 match → int_neutral (30, bas-neutre, calqué sur budget absent=30) — surtout
      -- PAS 0 (un bien sans match suggéré n'est pas 'mort', juste pas encore croisé).
      CASE WHEN COALESCE(im.n, 0) > 0 THEN
        round(
          int_w_vol  * (LEAST(int_cap, COALESCE(im.n, 0))::numeric / int_cap * 100)
        + int_w_qual * LEAST(100, GREATEST(0, COALESCE(im.avg_s, 0)))
        )
      ELSE int_neutral END AS interest_score,

      -- ── AXE 3 — PIPELINE (profondeur de stage, neutre si 0 tx) ────────────
      -- transactions liées AU BIEN (property_id), non annulées, scope agence. Même
      -- mapping stage_depth que contact_scoring_v1 (stage inconnu → unknown_stage_depth).
      -- 0 tx → no_tx_depth (25, « au repos », jamais 0). Pas de bonus KYC : le KYC est
      -- porté par le contact, pas par le bien — on ne le fabrique pas ici.
      CASE WHEN COALESCE(pl.n_tx, 0) > 0
           THEN LEAST(100, COALESCE(pl.max_depth, p_no_tx))
           ELSE p_no_tx END AS pipeline_score,

      -- ── AXE 4 — COMPLÉTUDE DE FICHE (100% intrinsèque sur properties) ─────
      -- Somme pondérée des champs présents / somme de tous les poids. Flags de
      -- présence robustes (cast défensif). HAUT = fiche prête-à-vendre = sain.
      -- GOTCHA photos VÉRIFIÉ : array_length('{}',1) = NULL → on utilise cardinality
      -- (qui renvoie 0 sur tableau vide). desc : longueur nette >= c_desc_min.
      round(100 * (
          (CASE WHEN p.price IS NOT NULL                          THEN COALESCE((c_fields->>'price')::numeric, 1.0)            ELSE 0 END)
        + (CASE WHEN p.surface_m2 IS NOT NULL                     THEN COALESCE((c_fields->>'surface_m2')::numeric, 1.0)       ELSE 0 END)
        + (CASE WHEN (p.rooms IS NOT NULL OR p.bedrooms IS NOT NULL)
                                                                  THEN COALESCE((c_fields->>'rooms_or_bedrooms')::numeric, 1.0) ELSE 0 END)
        + (CASE WHEN p.description IS NOT NULL
                 AND length(btrim(p.description)) >= c_desc_min   THEN COALESCE((c_fields->>'description')::numeric, 1.0)      ELSE 0 END)
        + (CASE WHEN cardinality(COALESCE(p.photos, '{}'::text[])) >= 1
                                                                  THEN COALESCE((c_fields->>'photos')::numeric, 1.5)           ELSE 0 END)
        + (CASE WHEN (p.address IS NOT NULL AND p.city IS NOT NULL AND p.postal_code IS NOT NULL)
                                                                  THEN COALESCE((c_fields->>'location')::numeric, 1.0)         ELSE 0 END)
        + (CASE WHEN (p.energy_label IS NOT NULL OR p.energy_class IS NOT NULL)
                                                                  THEN COALESCE((c_fields->>'energy')::numeric, 0.5)           ELSE 0 END)
        + (CASE WHEN p.year_built IS NOT NULL                     THEN COALESCE((c_fields->>'year_built')::numeric, 0.5)       ELSE 0 END)
        + (CASE WHEN COALESCE(p.c2pa_verified, false)             THEN COALESCE((c_fields->>'c2pa_verified')::numeric, 0.5)    ELSE 0 END)
      ) / c_total_w) AS completeness_score,

      -- ── COMPLÉTUDE DES SIGNAUX (data_completeness) ─────────────────────────
      -- Seuls les 2 axes qui peuvent légitimement être ABSENTS comptent : interest
      -- (>=1 match interne ?) + pipeline (>=1 tx liée non annulée ?). freshness et
      -- completeness sont INTRINSÈQUES (toujours présents car created_at NOT NULL et
      -- la fiche est toujours lisible) → exclus du dénominateur (les compter forcerait
      -- data_completeness >= 0.5 constant et mentirait sur la richesse réelle des signaux).
      (COALESCE(im.n, 0) > 0)    AS has_interest,
      (COALESCE(pl.n_tx, 0) > 0) AS has_pipeline
    FROM properties p
    -- intérêt : matches INTERNES du bien (count + qualité moyenne). Scope agence.
    -- source='internal' STRICT (jamais market_listing_id). avg défensif (score int NOT NULL).
    LEFT JOIN LATERAL (
      SELECT count(*) AS n, avg(m.score) AS avg_s
      FROM matches m
      WHERE m.property_id = p.id
        AND m.source = 'internal'
        AND m.agency_id = p.agency_id
    ) im ON true
    -- pipeline : stage le plus avancé parmi les transactions liées au bien, non annulées.
    LEFT JOIN LATERAL (
      SELECT count(*) AS n_tx,
             max(COALESCE((p_stage_depth->>(t.stage::text))::numeric, p_unknown_depth)) AS max_depth
      FROM transactions t
      WHERE t.property_id = p.id
        AND t.agency_id = p.agency_id
        AND t.status <> 'cancelled'
    ) pl ON true
    WHERE p.deleted_at IS NULL                  -- soft-delete : exclure les biens supprimés
      AND p.status NOT IN ('sold', 'archived')  -- terminal : un bien vendu/archivé ne « mérite
                                                -- pas l'attention » (objet du score) ; on ne le
                                                -- (re)score pas pour ne pas polluer la future file Focus
      AND p.agency_id IS NOT NULL               -- properties.agency_id NOT NULL ; ceinture+bretelles
                                                -- (un NULL fuiterait via RLS 'OR agency_id IS NULL')
      AND (p_agency IS NULL OR p.agency_id = p_agency)
  ),
  labeled AS (
    SELECT
      s.property_id, s.agency_id,
      s.freshness_score, s.interest_score, s.pipeline_score, s.completeness_score,
      -- overall = somme pondérée FIXE des 4 (poids = 1.00, PAS de re-normalisation),
      -- bornée [0..100] par construction (chaque sous-score l'est déjà). round() final.
      LEAST(100, GREATEST(0, round(
          w_fresh    * s.freshness_score
        + w_interest * s.interest_score
        + w_pipeline * s.pipeline_score
        + w_complete * s.completeness_score
      ))) AS overall_score,
      -- data_completeness = fraction des 2 signaux externes présents (interest+pipeline).
      round((s.has_interest::int + s.has_pipeline::int)::numeric / 2.0, 2) AS data_completeness
    FROM scored s
  ),
  finalrows AS (
    SELECT l.*,
      -- label : chaud (sain, complet, qui avance) / a_animer (fiche ou pipeline
      -- incomplets) / en_veille (froid/incomplet/stagnant).
      CASE WHEN l.overall_score >= th_chaud    THEN 'chaud'
           WHEN l.overall_score >= th_a_animer THEN 'a_animer'
           ELSE 'en_veille' END AS score_label
    FROM labeled l
  ),
  upsert AS (
    INSERT INTO property_scores AS ps
      (property_id, source, agency_id,
       overall_score, freshness_score, interest_score, pipeline_score, completeness_score,
       data_completeness, score_label, last_calculated_at)
    SELECT
       f.property_id, 'internal', f.agency_id,
       f.overall_score, f.freshness_score, f.interest_score, f.pipeline_score, f.completeness_score,
       f.data_completeness, f.score_label, v_now
    FROM finalrows f
    -- ON CONFLICT cible OBLIGATOIREMENT (property_id, source) : il n'existe AUCUN
    -- unique sur property_id seul (seuls property_id_source_key + market_listing_id_source_key).
    ON CONFLICT (property_id, source) DO UPDATE SET
      agency_id          = EXCLUDED.agency_id,           -- TOUJOURS écrit (jamais NULL → fuite RLS)
      overall_score      = EXCLUDED.overall_score,
      freshness_score    = EXCLUDED.freshness_score,
      interest_score     = EXCLUDED.interest_score,
      pipeline_score     = EXCLUDED.pipeline_score,
      completeness_score = EXCLUDED.completeness_score,
      data_completeness  = EXCLUDED.data_completeness,
      score_label        = EXCLUDED.score_label,
      last_calculated_at = EXCLUDED.last_calculated_at,
      -- MARCHÉ : forcé à NULL sur CETTE ligne 'internal' (marketplace OFF, signaux
      -- absents = honnêteté). On ne touche jamais market_listing_id (clé de conflit
      -- de l'autre source 'market', dont une éventuelle ligne sœur reste intacte).
      market_position_score = NULL,
      comparable_count      = NULL,
      avg_comparable_price  = NULL,
      price_vs_market_pct   = NULL,
      -- COMPORTEMENTAL / fantômes v1 = NULL (jamais fabriqué), même si une version
      -- passée a écrit 0/'stable'/'low'. days_on_market reste NULL : la fraîcheur
      -- vit dans freshness_score, on ne duplique pas un compteur historique.
      heat_score      = NULL,
      interest_level  = NULL,
      days_on_market  = NULL,
      price_trend     = NULL,
      stagnation_risk = NULL
    RETURNING ps.agency_id
  ),
  trace AS (
    -- audit trail : 1 event / agence / run (donnée dérivée d'un bien). category 'bien'
    -- (≠ 'contact' du score de contact) + severity 'info'. actor_kind='system' impose
    -- actor_id NULL (CHECK activity_events_actor_kind_coherence). metadata = count +
    -- version (aucune PII).
    INSERT INTO activity_events (agency_id, actor_kind, actor_id, action, entity_type, category, severity, metadata)
    SELECT u.agency_id, 'system', NULL, 'property_scores.recompute', 'property_scores', 'bien', 'info',
           jsonb_build_object('count', count(*), 'version', v_version)
    FROM upsert u
    GROUP BY u.agency_id
    RETURNING 1
  )
  SELECT count(*)::int INTO v_count FROM upsert;

  RETURN v_count;
END;
$$;

-- ── (5) GRANTS — calcul = service_role / cron UNIQUEMENT (jamais authenticated/anon).
REVOKE ALL ON FUNCTION public.calculate_property_scores(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_property_scores(uuid) TO service_role;

-- ── (6) CRON nocturne (03:50 UTC) — recalcul toutes agences. DÉCALÉ du contact
-- (03:00) ET de cleanup-orphan-property-drafts / whatsapp-purge-raw-daily (03:30,
-- le premier mute properties) pour éviter toute contention nocturne. Gardé par
-- présence pg_cron : planifié en prod, sauté en local/CI (schema "cron" absent)
-- pour ne pas casser l'application des migrations.
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    PERFORM cron.schedule(
      'property-score-nightly',
      '50 3 * * *',
      $cron$ SELECT public.calculate_property_scores(); $cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron absent (local/CI) — property-score-nightly non planifié';
  END IF;
END
$do$;
