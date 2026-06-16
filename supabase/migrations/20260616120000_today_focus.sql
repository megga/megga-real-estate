-- ════════════════════════════════════════════════════════════════════════════
-- MEGGA — Cockpit « Aujourd'hui » : Algo Focus (RPC MATCHES + index + tunables)
-- ════════════════════════════════════════════════════════════════════════════
-- Archi C hybride : ce RPC ne couvre QUE les matches (le seul gros volume :
-- ~2.6k 'suggested', concentrés à 94% sur un contact). Les deals/reminders
-- restent agrégés côté client (volumes triviaux). 100% déterministe, 0 LLM.
-- ANTI-IDOR : agence du JWT (get_user_agency_id()), jamais paramètre client.
-- KYC = bonus non-bloquant (jamais un gate). §7 perf respecté (index partiel,
-- eq pas in, pas de count exact, colonnes minimales).
-- Calqué sur 20260614150000_analytics_rpcs.sql (SECURITY DEFINER + search_path +
-- statement_timeout + garde v_agency NULL) et 20260614130000_matching_scoring_config.sql
-- (clé app_config JSON tunable).

-- ── (1) INDEX PARTIEL (§7) — matches n'a aucun index agency/score (vérifié).
-- Ordre des colonnes : agency_id (égalité) → contact_id (PARTITION BY de la
-- window) → score DESC (ORDER BY intra-partition). Couvre WHERE + le tri de la
-- window ROW_NUMBER() ; le prédicat se limite à status='suggested' (immutable).
CREATE INDEX IF NOT EXISTS idx_matches_agency_focus
  ON public.matches (agency_id, contact_id, score DESC)
  WHERE status = 'suggested';

-- ── (2) TUNABLES app_config 'today_focus_v1' (value est TEXT → chaîne JSON,
-- lue en ::jsonb comme matching_scoring_v2). Le RPC lit match_gate / per_contact
-- / matches_returned ; le reste (poids/seuils de tiers) pilote le scoring client.
INSERT INTO public.app_config (key, value)
VALUES (
  'today_focus_v1',
  '{"weights":{"reminder":0.45,"match":0.40,"deal":0.15},"thresholds":{"match_gate":70,"match_now":80,"match_next":70,"reminder_overdue_saturation_days":3,"deal_next_stage_prob":0.60,"kyc_expiry_window_days":14},"bonuses":{"match_internal":0.08,"match_quality":0.05,"reminder_kyc":0.15,"reminder_offer":0.10,"deal_tension_at_risk":0.20,"deal_tension_stalled":0.10,"kyc_max":0.12,"deal_value_ref":3000000},"caps":{"now_total":3,"per_contact":2,"matches_returned":40},"version":1}'
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ── (3) RPC : matches suggérés gatés + dé-dupliqués + cappés + enrichis ──────
CREATE OR REPLACE FUNCTION public.focus_top_matches(p_limit integer DEFAULT 30)
RETURNS TABLE (
  match_id            uuid,
  contact_id          uuid,
  contact_name        text,        -- « Prénom Nom » résolu (jamais d'UUID brut)
  kind                text,        -- 'internal' | 'market' (= matches.source)
  score               integer,     -- brut, déjà gaté >= match_gate
  reasons_match_count integer,     -- 0..5 (nb de clés reasons avec match=true)
  reason_keys         text[],      -- sous-ensemble de {type,zone,rooms,budget,features}
  property_title      text,
  property_price      numeric,
  property_photo      text,
  city                text,
  kyc_risk_high       boolean,     -- bonus NON-BLOQUANT côté client
  kyc_days_to_expiry  integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '15s'
AS $$
DECLARE
  v_agency     uuid := get_user_agency_id();
  v_now        timestamptz := now();
  v_cfg        jsonb;
  v_gate       integer;
  v_percontact integer;
  v_limit      integer := LEAST(GREATEST(COALESCE(p_limit, 30), 1), 200);
BEGIN
  -- Garde anti-fuite : JWT sans agence → aucune ligne (jamais d'erreur).
  IF v_agency IS NULL THEN RETURN; END IF;

  -- Tunables (value TEXT → ::jsonb). Fallbacks littéraux si clé absente.
  SELECT value::jsonb INTO v_cfg FROM app_config WHERE key = 'today_focus_v1';
  v_gate       := COALESCE((v_cfg->'thresholds'->>'match_gate')::int, 70);
  v_percontact := COALESCE((v_cfg->'caps'->>'per_contact')::int, 2);
  v_limit      := LEAST(v_limit, COALESCE((v_cfg->'caps'->>'matches_returned')::int, 40));

  RETURN QUERY
  WITH gated AS (
    -- Source dure : matches suggérés actionnables de l'agence du JWT, déjà gatés.
    SELECT
      m.id, m.contact_id, m.score, m.source, m.reasons,
      m.property_id, m.market_listing_id,
      row_number() OVER (
        PARTITION BY m.contact_id
        ORDER BY m.score DESC, m.created_at DESC NULLS LAST, m.id
      ) AS rn_contact
    FROM matches m
    WHERE m.agency_id = v_agency                                  -- anti-IDOR
      AND m.status = 'suggested'                                  -- eq, pas in (§7)
      AND m.response_at IS NULL                                   -- pas encore répondu
      AND m.score >= v_gate                                       -- tier-gate dur
      AND (m.snoozed_until IS NULL OR m.snoozed_until <= v_now)   -- snooze respecté
  ),
  capped AS (
    -- Cap DUR per_contact (concentration 94% sur 1 contact en base).
    SELECT * FROM gated WHERE rn_contact <= v_percontact
    ORDER BY score DESC, id
    LIMIT v_limit
  )
  SELECT
    g.id,
    g.contact_id,
    NULLIF(TRIM(COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, '')), '') AS contact_name,
    g.source AS kind,
    g.score,
    (SELECT COUNT(*)::int FROM jsonb_each(COALESCE(g.reasons, '{}'::jsonb)) e
       WHERE (e.value->>'match')::boolean IS TRUE) AS reasons_match_count,
    (SELECT COALESCE(array_agg(e.key ORDER BY e.key), ARRAY[]::text[])
       FROM jsonb_each(COALESCE(g.reasons, '{}'::jsonb)) e
       WHERE (e.value->>'match')::boolean IS TRUE) AS reason_keys,
    COALESCE(p.title, ml.title)                              AS property_title,
    COALESCE(p.price, ml.current_price, ml.price)           AS property_price,
    CASE WHEN p.id IS NOT NULL THEN p.photos[1] ELSE ml.photos[1] END AS property_photo,
    COALESCE(p.city, ml.city)                               AS city,
    (k.risk_level = 'high')                                 AS kyc_risk_high,
    CASE WHEN k.expires_at IS NULL THEN NULL
         ELSE FLOOR(EXTRACT(EPOCH FROM (k.expires_at::timestamptz - v_now)) / 86400)::int END AS kyc_days_to_expiry
  FROM capped g
  JOIN contacts c              ON c.id = g.contact_id
  LEFT JOIN properties p       ON p.id = g.property_id
  LEFT JOIN market_listings ml ON ml.id = g.market_listing_id
  LEFT JOIN LATERAL (
    -- KYC high le plus récent du contact (non-bloquant, simple bonus).
    SELECT kc.risk_level, kc.expires_at
    FROM kyc_cases kc
    WHERE kc.agency_id = v_agency AND kc.contact_id = g.contact_id
    ORDER BY (kc.risk_level = 'high') DESC, kc.created_at DESC
    LIMIT 1
  ) k ON TRUE
  ORDER BY g.score DESC, g.id;
END;
$$;

-- ── (4) GRANTS — exécutable par les agents authentifiés + service_role ; jamais anon.
REVOKE ALL ON FUNCTION public.focus_top_matches(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.focus_top_matches(integer) TO authenticated, service_role;
