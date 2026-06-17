-- ============================================================================
-- Instrumentation comportementale — PR1 : socle de triggers structurels
-- ============================================================================
-- Vague 3 du chantier « instrumentation comportementale » (méthode 3 vagues).
-- Constat Vague 1 : tous les signaux temporels/comportementaux sont à ~0 capture
-- en prod alors que les colonnes existent déjà — « N chemins, M oublis ».
-- Réponse : des POINTS DE CAPTURE déterministes, append-only, idempotents,
-- scoped agence, 0 PII nouvelle. Trigger DB pour les signaux STRUCTURELS
-- (connus côté base, path-independent) ; écriture app/edge pour le contextuel.
--
-- Précédents prod réutilisés : monitor_transaction_kyc_gate (AFTER UPDATE
-- transactions), properties_audit_event (AFTER INS/UPD/DEL properties).
-- Invariants : SECURITY DEFINER, SET search_path, gardes IS DISTINCT/IF NULL/
-- GREATEST, agency_id de la ligne, aucune mutation d'activity_events (append-only
-- préservé : on n'écrit que via INSERT, jamais UPDATE/DELETE).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1.1  transactions → activity_events 'stage_change' + 'status_change'
-- ----------------------------------------------------------------------------
-- Capture le mouvement d'étape ET de statut (on_hold/cancelled/completed =
-- « deal at-risk ») quel que soit le chemin de mutation — ferme le bypass
-- archiveDeal (status='cancelled' en direct) et le revert WhatsApp.
--
-- Attribution (décision Gregory 17/06) : on préserve « MEGGA AI » pour les
-- mouvements pilotés sur WhatsApp via un GUC transaction-local posé par la RPC
-- wa_move_transaction_stage (cf. §1.1b). Sans GUC : actor dérivé de auth.uid()
-- (web agent → 'user' ; service-role sans uid → 'system'). La contrainte
-- activity_events_actor_kind_coherence (actor_id IS NULL OR actor_kind='user')
-- est respectée : actor_id n'est posé QUE pour 'user'.
CREATE OR REPLACE FUNCTION public.capture_transaction_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_guc_kind  text := NULLIF(current_setting('app.actor_kind', true), '');
  v_via       text := NULLIF(current_setting('app.actor_via', true), '');
  v_profile   text := NULLIF(current_setting('app.actor_profile_id', true), '');
  v_uid       uuid := auth.uid();
  v_kind      text;
  v_actor     uuid;
  v_contact   uuid := COALESCE(NEW.contact_buyer_id, NEW.contact_seller_id);
  v_meta      jsonb;
BEGIN
  v_kind := CASE
    WHEN v_guc_kind IN ('ai', 'system', 'user') THEN v_guc_kind
    WHEN v_uid IS NULL THEN 'system'
    ELSE 'user'
  END;
  -- Cohérence : actor_id non-NULL uniquement pour 'user'.
  v_actor := CASE WHEN v_kind = 'user' THEN v_uid ELSE NULL END;

  IF OLD.stage IS DISTINCT FROM NEW.stage THEN
    v_meta := jsonb_build_object('old_stage', OLD.stage, 'new_stage', NEW.stage, 'contact_id', v_contact);
    IF v_via IS NOT NULL THEN v_meta := v_meta || jsonb_build_object('via', v_via); END IF;
    IF v_profile IS NOT NULL THEN v_meta := v_meta || jsonb_build_object('profile_id', v_profile); END IF;
    INSERT INTO activity_events
      (agency_id, actor_id, actor_kind, action, entity_type, entity_id, object_label, category, severity, metadata)
    VALUES
      (NEW.agency_id, v_actor, v_kind, 'stage_change', 'transaction', NEW.id,
       OLD.stage::text || ' → ' || NEW.stage::text, 'deal', 'info', v_meta);
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    v_meta := jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status, 'contact_id', v_contact);
    IF v_via IS NOT NULL THEN v_meta := v_meta || jsonb_build_object('via', v_via); END IF;
    IF v_profile IS NOT NULL THEN v_meta := v_meta || jsonb_build_object('profile_id', v_profile); END IF;
    INSERT INTO activity_events
      (agency_id, actor_id, actor_kind, action, entity_type, entity_id, object_label, category, severity, metadata)
    VALUES
      (NEW.agency_id, v_actor, v_kind, 'status_change', 'transaction', NEW.id,
       OLD.status::text || ' → ' || NEW.status::text, 'deal', 'info', v_meta);
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_transaction_lifecycle ON public.transactions;
CREATE TRIGGER trg_transaction_lifecycle
  AFTER UPDATE OF stage, status ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.capture_transaction_lifecycle();

-- ----------------------------------------------------------------------------
-- 1.1b  RPC wa_move_transaction_stage — pose le GUC 'ai' + UPDATE dans la MÊME
--       transaction (set_config is_local=true ne survit pas à travers deux
--       appels PostgREST distincts ; l'edge WhatsApp [aller ET undo] doit donc
--       passer par ici au lieu d'un .update() direct, afin que le trigger lise
--       app.actor_*). RETURNS integer = nb de lignes affectées → l'edge détecte
--       le 0-ligne (deal supprimé / autre agence) pour ne pas confirmer à tort.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.wa_move_transaction_stage(
  p_transaction_id uuid,
  p_stage          transaction_stage,
  p_agency_id      uuid,
  p_profile_id     uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_rows integer;
BEGIN
  PERFORM set_config('app.actor_kind', 'ai', true);
  PERFORM set_config('app.actor_via', 'whatsapp', true);
  IF p_profile_id IS NOT NULL THEN
    PERFORM set_config('app.actor_profile_id', p_profile_id::text, true);
  END IF;
  UPDATE public.transactions
     SET stage = p_stage
   WHERE id = p_transaction_id
     AND agency_id = p_agency_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$function$;

REVOKE ALL ON FUNCTION public.wa_move_transaction_stage(uuid, transaction_stage, uuid, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wa_move_transaction_stage(uuid, transaction_stage, uuid, uuid) TO service_role;

-- ----------------------------------------------------------------------------
-- 1.2  properties.published_at — freshness réelle (1er passage en 'active')
-- ----------------------------------------------------------------------------
-- BEFORE pour pouvoir poser NEW.published_at sans re-UPDATE. Immuable une fois
-- posé (neutralise la réécriture de ListingFormPage à chaque save d'un actif).
-- v1 = première publication (re-activation archived→active = raffinement v2).
CREATE OR REPLACE FUNCTION public.set_property_published_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.published_at IS NOT NULL THEN
    NEW.published_at := OLD.published_at;            -- immuable : protège l'historique
  ELSIF NEW.status = 'active' AND NEW.published_at IS NULL THEN
    NEW.published_at := now();                        -- 1er passage en actif
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_property_published_at ON public.properties;
CREATE TRIGGER trg_property_published_at
  BEFORE INSERT OR UPDATE OF status, published_at ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.set_property_published_at();

-- Backfill : les biens actifs existants précèdent ce trigger (0 event
-- bien_published en base) → repli honnête sur created_at (= ce que le RPC de
-- score utilisait déjà). Append-only : ne touche que les NULL.
UPDATE public.properties
   SET published_at = created_at
 WHERE status = 'active' AND published_at IS NULL;

-- ----------------------------------------------------------------------------
-- 1.3  visits.completed_at — invariant « status=done ⇒ completed_at »
-- ----------------------------------------------------------------------------
-- L'invariant est aujourd'hui dupliqué à la main dans ≥5 write-paths app ; le
-- trigger en fait un filet de vérité unique. Ne pose que si NULL (n'écrase pas
-- une date saisie) ; ne l'efface pas sur revert en v1 (préserve la donnée).
CREATE OR REPLACE FUNCTION public.set_visit_completed_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.status = 'done' AND NEW.completed_at IS NULL THEN
    NEW.completed_at := now();
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_visit_completed_at ON public.visits;
CREATE TRIGGER trg_visit_completed_at
  BEFORE INSERT OR UPDATE OF status ON public.visits
  FOR EACH ROW
  EXECUTE FUNCTION public.set_visit_completed_at();

-- ----------------------------------------------------------------------------
-- 1.4  contacts.last_interaction_at — recency d'interaction (lead-cooling)
-- ----------------------------------------------------------------------------
-- Décision Gregory : UN seul signal = tout touch humain (entrant ET sortant).
-- Deux sources, deux triggers :
--   (a) activity_events allowlistés (touches NON-WhatsApp : pipeline, note,
--       message CRM). match_suggested (actor_kind='ai' + metadata.contact_id,
--       ~2673 lignes) est EXCLU par omission → la dormance n'est pas corrompue.
--   (b) whatsapp_messages (le canal WhatsApp client n'écrit PAS dans
--       activity_events ; correction d'une assertion erronée de la Vague 1).
-- Idempotent (GREATEST → un event ancien ne régresse pas). Le contact est
-- l'identité (PK) → le scope agence est belt-and-suspenders et tolère les
-- events à agency_id NULL.

-- (a) depuis activity_events
CREATE OR REPLACE FUNCTION public.bump_contact_last_interaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_contact uuid;
  v_raw     text;
BEGIN
  IF NEW.entity_type = 'contact' THEN
    v_contact := NEW.entity_id;
  ELSE
    v_raw := NEW.metadata->>'contact_id';
    -- Garde UUID STRICTE : un cast d'une valeur malformée lèverait 22P02 et
    -- ferait rollback de l'INSERT source (même transaction). Leçon CI contact_scoring.
    IF v_raw ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
      v_contact := v_raw::uuid;
    END IF;
  END IF;

  IF v_contact IS NULL THEN
    RETURN NEW;
  END IF;

  -- Ne PAS rafraîchir la recency sur une bascule de deal MORT / EN PAUSE : perdre,
  -- annuler ou suspendre un deal n'est pas « rester en contact » avec le lead —
  -- sinon le contact sortirait à tort de la file de relance (lead-cooling /
  -- automation-engine) pendant la fenêtre de dormance. Les AVANCÉES de pipeline
  -- restent un touch (décision « tout-touch incl. geste deal »).
  IF NEW.action = 'stage_change' AND (NEW.metadata->>'new_stage') = 'lost' THEN
    RETURN NEW;
  END IF;
  IF NEW.action = 'status_change' AND (NEW.metadata->>'new_status') IN ('cancelled', 'on_hold') THEN
    RETURN NEW;
  END IF;

  UPDATE public.contacts c
     SET last_interaction_at = GREATEST(COALESCE(c.last_interaction_at, '-infinity'::timestamptz), NEW.created_at)
   WHERE c.id = v_contact
     AND (NEW.agency_id IS NULL OR c.agency_id = NEW.agency_id);

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_contact_last_interaction ON public.activity_events;
CREATE TRIGGER trg_contact_last_interaction
  AFTER INSERT ON public.activity_events
  FOR EACH ROW
  WHEN (NEW.action IN ('stage_change', 'status_change', 'Note ajoutée', 'contact_message_received'))
  EXECUTE FUNCTION public.bump_contact_last_interaction();

-- (b) depuis whatsapp_messages (entrant + sortant lié à un contact)
CREATE OR REPLACE FUNCTION public.bump_contact_last_interaction_wa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE public.contacts c
     SET last_interaction_at = GREATEST(
           COALESCE(c.last_interaction_at, '-infinity'::timestamptz),
           COALESCE(NEW.wa_timestamp, NEW.created_at))
   WHERE c.id = NEW.contact_id
     AND (NEW.agency_id IS NULL OR c.agency_id = NEW.agency_id);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_contact_last_interaction_wa ON public.whatsapp_messages;
CREATE TRIGGER trg_contact_last_interaction_wa
  AFTER INSERT ON public.whatsapp_messages
  FOR EACH ROW
  WHEN (NEW.contact_id IS NOT NULL)
  EXECUTE FUNCTION public.bump_contact_last_interaction_wa();

-- Backfill last_interaction_at : GREATEST des 2 sources, scoped, n'écrit que si
-- > valeur courante. (Les events stage_change/status_change sont à 0 en prod →
-- la source utile aujourd'hui est whatsapp_messages ; le reste reste NULL =
-- « jamais recontacté », honnête.)
WITH touch AS (
  SELECT
    CASE
      WHEN ae.entity_type = 'contact' THEN ae.entity_id
      WHEN (ae.metadata->>'contact_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        THEN (ae.metadata->>'contact_id')::uuid
    END AS cid,
    ae.created_at AS ts
  FROM public.activity_events ae
  WHERE ae.action IN ('stage_change', 'status_change', 'Note ajoutée', 'contact_message_received')
    -- miroir du trigger : les bascules de deal mort/en pause ne comptent pas
    AND NOT (ae.action = 'stage_change' AND ae.metadata->>'new_stage' = 'lost')
    AND NOT (ae.action = 'status_change' AND ae.metadata->>'new_status' IN ('cancelled', 'on_hold'))
  UNION ALL
  SELECT wm.contact_id, COALESCE(wm.wa_timestamp, wm.created_at)
  FROM public.whatsapp_messages wm
  WHERE wm.contact_id IS NOT NULL
)
UPDATE public.contacts c
   SET last_interaction_at = g.ts
FROM (SELECT cid, max(ts) AS ts FROM touch WHERE cid IS NOT NULL GROUP BY cid) g
WHERE c.id = g.cid
  AND (c.last_interaction_at IS NULL OR c.last_interaction_at < g.ts);

-- ----------------------------------------------------------------------------
-- 1.5  calculate_property_scores — fermer la boucle published_at
-- ----------------------------------------------------------------------------
-- L'axe freshness lisait p.created_at EN DUR (published_at était inutilisable,
-- NULL 6/6). Maintenant que published_at est instrumenté + backfillé, l'axe
-- bascule sur COALESCE(published_at, created_at) → le signal a enfin un
-- consommateur. Reste du corps IDENTIQUE à 20260616190000.
CREATE OR REPLACE FUNCTION public.calculate_property_scores(p_agency uuid DEFAULT NULL::uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '60s'
AS $function$
DECLARE
  v_cfg jsonb; v_now timestamptz := now(); v_count integer := 0; v_version integer;
  w_fresh numeric; w_interest numeric; w_pipeline numeric; w_complete numeric;
  fr_tiers jsonb; fr_floor numeric;
  int_cap numeric; int_w_vol numeric; int_w_qual numeric; int_neutral numeric;
  p_stage_depth jsonb; p_unknown_depth numeric; p_no_tx numeric;
  c_desc_min int; c_fields jsonb; c_total_w numeric;
  th_chaud numeric; th_a_animer numeric;
BEGIN
  SELECT value::jsonb INTO v_cfg FROM app_config WHERE key='property_scoring_v1';
  w_fresh := COALESCE((v_cfg->'weights'->>'freshness')::numeric,0.20);
  w_interest := COALESCE((v_cfg->'weights'->>'interest')::numeric,0.20);
  w_pipeline := COALESCE((v_cfg->'weights'->>'pipeline')::numeric,0.15);
  w_complete := COALESCE((v_cfg->'weights'->>'completeness')::numeric,0.45);
  fr_tiers := COALESCE(v_cfg->'freshness'->'tiers','[{"max_days":30,"score":100},{"max_days":60,"score":80},{"max_days":90,"score":60},{"max_days":180,"score":40}]'::jsonb);
  fr_floor := COALESCE((v_cfg->'freshness'->>'floor')::numeric,20);
  int_cap := GREATEST(1, COALESCE((v_cfg->'interest'->>'volume_cap')::numeric,4));
  int_w_vol := COALESCE((v_cfg->'interest'->>'weight_volume')::numeric,0.60);
  int_w_qual := COALESCE((v_cfg->'interest'->>'weight_quality')::numeric,0.40);
  int_neutral := COALESCE((v_cfg->'interest'->>'neutral')::numeric,30);
  p_stage_depth := COALESCE(v_cfg->'pipeline'->'stage_depth','{}'::jsonb);
  p_unknown_depth := COALESCE((v_cfg->'pipeline'->>'unknown_stage_depth')::numeric,20);
  p_no_tx := COALESCE((v_cfg->'pipeline'->>'no_tx_depth')::numeric,25);
  c_desc_min := COALESCE((v_cfg->'completeness'->>'desc_min_len')::int,40);
  c_fields := COALESCE(v_cfg->'completeness'->'fields','{"price":1.0,"surface_m2":1.0,"rooms_or_bedrooms":1.0,"description":1.0,"photos":1.5,"location":1.0,"energy":0.5,"year_built":0.5,"c2pa_verified":0.5}'::jsonb);
  th_chaud := COALESCE((v_cfg->'thresholds'->>'label_chaud')::numeric,70);
  th_a_animer := COALESCE((v_cfg->'thresholds'->>'label_a_animer')::numeric,45);
  v_version := COALESCE((v_cfg->>'version')::int,1);
  SELECT COALESCE(NULLIF(sum((f.value)::numeric),0),8.0) INTO c_total_w FROM jsonb_each_text(c_fields) AS f;
  WITH scored AS (
    SELECT p.id AS property_id, p.agency_id AS agency_id,
      LEAST(100, GREATEST(0, (
        SELECT COALESCE((SELECT (t.elem->>'score')::numeric FROM jsonb_array_elements(fr_tiers) AS t(elem)
          WHERE GREATEST(0,(v_now::date - COALESCE(p.published_at, p.created_at)::date))::int <= (t.elem->>'max_days')::int
          ORDER BY (t.elem->>'max_days')::int ASC LIMIT 1), fr_floor)))) AS freshness_score,
      CASE WHEN COALESCE(im.n,0) > 0 THEN
        round(int_w_vol*(LEAST(int_cap,COALESCE(im.n,0))::numeric/int_cap*100) + int_w_qual*LEAST(100,GREATEST(0,COALESCE(im.avg_s,0))))
      ELSE int_neutral END AS interest_score,
      CASE WHEN COALESCE(pl.n_tx,0) > 0 THEN LEAST(100,COALESCE(pl.max_depth,p_no_tx)) ELSE p_no_tx END AS pipeline_score,
      round(100 * (
          (CASE WHEN p.price IS NOT NULL THEN COALESCE((c_fields->>'price')::numeric,1.0) ELSE 0 END)
        + (CASE WHEN p.surface_m2 IS NOT NULL THEN COALESCE((c_fields->>'surface_m2')::numeric,1.0) ELSE 0 END)
        + (CASE WHEN (p.rooms IS NOT NULL OR p.bedrooms IS NOT NULL) THEN COALESCE((c_fields->>'rooms_or_bedrooms')::numeric,1.0) ELSE 0 END)
        + (CASE WHEN p.description IS NOT NULL AND length(btrim(p.description)) >= c_desc_min THEN COALESCE((c_fields->>'description')::numeric,1.0) ELSE 0 END)
        + (CASE WHEN cardinality(COALESCE(p.photos,'{}'::text[])) >= 1 THEN COALESCE((c_fields->>'photos')::numeric,1.5) ELSE 0 END)
        + (CASE WHEN (p.address IS NOT NULL AND p.city IS NOT NULL AND p.postal_code IS NOT NULL) THEN COALESCE((c_fields->>'location')::numeric,1.0) ELSE 0 END)
        + (CASE WHEN (p.energy_label IS NOT NULL OR p.energy_class IS NOT NULL) THEN COALESCE((c_fields->>'energy')::numeric,0.5) ELSE 0 END)
        + (CASE WHEN p.year_built IS NOT NULL THEN COALESCE((c_fields->>'year_built')::numeric,0.5) ELSE 0 END)
        + (CASE WHEN COALESCE(p.c2pa_verified,false) THEN COALESCE((c_fields->>'c2pa_verified')::numeric,0.5) ELSE 0 END)
      ) / c_total_w) AS completeness_score,
      (COALESCE(im.n,0) > 0) AS has_interest, (COALESCE(pl.n_tx,0) > 0) AS has_pipeline
    FROM properties p
    LEFT JOIN LATERAL (SELECT count(*) AS n, avg(m.score) AS avg_s FROM matches m
      WHERE m.property_id=p.id AND m.source='internal' AND m.agency_id=p.agency_id) im ON true
    LEFT JOIN LATERAL (SELECT count(*) AS n_tx, max(COALESCE((p_stage_depth->>(t.stage::text))::numeric,p_unknown_depth)) AS max_depth
      FROM transactions t WHERE t.property_id=p.id AND t.agency_id=p.agency_id AND t.status <> 'cancelled') pl ON true
    WHERE p.deleted_at IS NULL AND p.status NOT IN ('sold','archived') AND p.agency_id IS NOT NULL
      AND (p_agency IS NULL OR p.agency_id=p_agency)
  ),
  labeled AS (
    SELECT s.property_id, s.agency_id, s.freshness_score, s.interest_score, s.pipeline_score, s.completeness_score,
      LEAST(100,GREATEST(0,round(w_fresh*s.freshness_score + w_interest*s.interest_score + w_pipeline*s.pipeline_score + w_complete*s.completeness_score))) AS overall_score,
      round((s.has_interest::int + s.has_pipeline::int)::numeric/2.0,2) AS data_completeness
    FROM scored s
  ),
  finalrows AS (
    SELECT l.*, CASE WHEN l.overall_score >= th_chaud THEN 'chaud' WHEN l.overall_score >= th_a_animer THEN 'a_animer' ELSE 'en_veille' END AS score_label
    FROM labeled l
  ),
  upsert AS (
    INSERT INTO property_scores AS ps (property_id, source, agency_id, overall_score, freshness_score, interest_score, pipeline_score, completeness_score, data_completeness, score_label, last_calculated_at)
    SELECT f.property_id,'internal',f.agency_id,f.overall_score,f.freshness_score,f.interest_score,f.pipeline_score,f.completeness_score,f.data_completeness,f.score_label,v_now
    FROM finalrows f
    ON CONFLICT (property_id, source) DO UPDATE SET
      agency_id=EXCLUDED.agency_id, overall_score=EXCLUDED.overall_score, freshness_score=EXCLUDED.freshness_score,
      interest_score=EXCLUDED.interest_score, pipeline_score=EXCLUDED.pipeline_score, completeness_score=EXCLUDED.completeness_score,
      data_completeness=EXCLUDED.data_completeness, score_label=EXCLUDED.score_label, last_calculated_at=EXCLUDED.last_calculated_at,
      market_position_score=NULL, comparable_count=NULL, avg_comparable_price=NULL, price_vs_market_pct=NULL,
      heat_score=NULL, interest_level=NULL, days_on_market=NULL, price_trend=NULL, stagnation_risk=NULL
    RETURNING ps.agency_id
  ),
  trace AS (
    INSERT INTO activity_events (agency_id, actor_kind, actor_id, action, entity_type, category, severity, metadata)
    SELECT u.agency_id,'system',NULL,'property_scores.recompute','property_scores','bien','info',jsonb_build_object('count',count(*),'version',v_version)
    FROM upsert u GROUP BY u.agency_id RETURNING 1
  )
  SELECT count(*)::int INTO v_count FROM upsert;
  RETURN v_count;
END; $function$;
