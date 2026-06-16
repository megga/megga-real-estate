-- ════════════════════════════════════════════════════════════════════════════
-- MEGGA — Focus × Score de contact : pondérer la file matches par le lead score
-- ════════════════════════════════════════════════════════════════════════════
-- LA valeur v1 du score de contact : CASSER LE BIAIS « volume de matches ».
-- En base, 1 lead 'cold' concentre 94% des ~2.6k matches → il monopolisait le
-- haut de la file Focus alors qu'il est froid. On re-trie la file matches par un
-- score MÉLANGÉ : fit du bien × sérieux du contact.
--
--   blend = g.score · (floor + (1-floor)·COALESCE(lead_score,50)/100)   (floor=0.5)
--
-- Un contact sans score → facteur neutre (lead_score=50 → ×0.75). On NE MUTE
-- JAMAIS matches.score (reste le fit pur, historisé, score_version) : le blend ne
-- vit QUE dans l'ORDER BY (tri d'affichage) + une colonne de sortie `lead_score`.
-- Le cap per_contact, les gates, l'anti-IDOR et les KYC restent identiques à
-- 20260616120000_today_focus.sql (réécriture complète CREATE OR REPLACE).
--
-- floor pilotable via today_focus_v1.blend.focus_floor (lu défensivement, fallback
-- 0.5) — on NE réécrit PAS le JSON today_focus_v1 (le client n'en a pas besoin et
-- on préserve le miroir FOCUS_DEFAULTS).

-- La signature CHANGE (nouvelle colonne de sortie `lead_score`) → CREATE OR REPLACE
-- ne peut pas modifier le type de retour d'une fonction existante (la 13-colonnes
-- créée en 20260616120000). On DROP d'abord, puis on recrée (GRANTs réaffirmés plus
-- bas). focus_top_matches n'est référencée par aucun autre objet DB (RPC client only).
DROP FUNCTION IF EXISTS public.focus_top_matches(integer);

CREATE OR REPLACE FUNCTION public.focus_top_matches(p_limit integer DEFAULT 30)
RETURNS TABLE (
  match_id            uuid,
  contact_id          uuid,
  contact_name        text,        -- « Prénom Nom » résolu (jamais d'UUID brut)
  kind                text,        -- 'internal' | 'market' (= matches.source)
  score               integer,     -- brut, déjà gaté >= match_gate (JAMAIS muté)
  lead_score          numeric,     -- score de contact 0-100 (NULL si non calculé)
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
  v_floor      numeric;
  v_limit      integer := LEAST(GREATEST(COALESCE(p_limit, 30), 1), 200);
BEGIN
  -- Garde anti-fuite : JWT sans agence → aucune ligne (jamais d'erreur).
  IF v_agency IS NULL THEN RETURN; END IF;

  -- Tunables (value TEXT → ::jsonb). Fallbacks littéraux si clé absente.
  SELECT value::jsonb INTO v_cfg FROM app_config WHERE key = 'today_focus_v1';
  v_gate       := COALESCE((v_cfg->'thresholds'->>'match_gate')::int, 70);
  v_percontact := COALESCE((v_cfg->'caps'->>'per_contact')::int, 2);
  v_limit      := LEAST(v_limit, COALESCE((v_cfg->'caps'->>'matches_returned')::int, 40));
  -- plancher du blend : 0 = tri 100% lead score, 1 = ignore le lead score (= ancien tri).
  v_floor      := LEAST(GREATEST(COALESCE((v_cfg->'blend'->>'focus_floor')::numeric, 0.5), 0), 1);

  RETURN QUERY
  WITH gated AS (
    -- Source dure : matches suggérés actionnables de l'agence du JWT, déjà gatés.
    -- LEFT JOIN du score de contact (nullable) → facteur de mélange du tri.
    SELECT
      m.id, m.contact_id, m.score, m.source, m.reasons,
      m.property_id, m.market_listing_id,
      cs.overall_score AS lead_score,
      row_number() OVER (
        PARTITION BY m.contact_id
        ORDER BY m.score DESC, m.created_at DESC NULLS LAST, m.id
      ) AS rn_contact
    FROM matches m
    LEFT JOIN contact_scores cs
      ON cs.contact_id = m.contact_id AND cs.agency_id = v_agency
    WHERE m.agency_id = v_agency                                  -- anti-IDOR
      AND m.status = 'suggested'                                  -- eq, pas in (§7)
      AND m.response_at IS NULL                                   -- pas encore répondu
      AND m.score >= v_gate                                       -- tier-gate dur
      AND (m.snoozed_until IS NULL OR m.snoozed_until <= v_now)   -- snooze respecté
  ),
  capped AS (
    -- Cap DUR per_contact (concentration 94% sur 1 contact en base), PUIS top-N
    -- par score MÉLANGÉ (fit × sérieux) — c'est ici que le biais se casse.
    SELECT * FROM gated WHERE rn_contact <= v_percontact
    ORDER BY (score * (v_floor + (1 - v_floor) * COALESCE(lead_score, 50) / 100)) DESC, score DESC, id
    LIMIT v_limit
  )
  SELECT
    g.id,
    g.contact_id,
    NULLIF(TRIM(COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, '')), '') AS contact_name,
    g.source AS kind,
    g.score,
    g.lead_score,
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
  -- tri d'affichage final : même score mélangé (fit × sérieux), brut en départage.
  ORDER BY (g.score * (v_floor + (1 - v_floor) * COALESCE(g.lead_score, 50) / 100)) DESC, g.score DESC, g.id;
END;
$$;

-- GRANTS inchangés (réaffirmés par sûreté après CREATE OR REPLACE).
REVOKE ALL ON FUNCTION public.focus_top_matches(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.focus_top_matches(integer) TO authenticated, service_role;
