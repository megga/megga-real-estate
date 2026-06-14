-- ════════════════════════════════════════════════════════════════════════════
-- MEGGA — Analytics « Cockpit Commission » : 3 RPC d'agrégation + persistance objectif
-- ════════════════════════════════════════════════════════════════════════════
-- Recâble AxDashboard (src/components/crm-sugar/analytics/AxDashboard.tsx) sur le
-- live. Remplace les 3 hooks client v3 (useDashboardCockpit/Funnel/Objectif) qui
-- faisaient ~14 requêtes, des count:'exact' (perf §7), oubliaient .eq('agency_id')
-- sur crm_offers (fuite cross-tenant) et rataient les stages legacy 'lead'/'closed'/
-- 'visit_planned_legacy' (le mapping TS renvoyait undefined).
--
-- Tout SECURITY DEFINER (sauf analytics_set_target). RÈGLE ANTI-IDOR : l'agence
-- vient TOUJOURS du JWT (get_user_agency_id()), jamais d'un paramètre client, et
-- v_agency est filtré dans CHAQUE sous-requête. Toute sous-requête future sans
-- agency_id = v_agency serait une fuite cross-tenant → test backend obligatoire.
-- 100% déterministe, aucun appel LLM. Probabilités/bornes = littéraux nommés.
-- ════════════════════════════════════════════════════════════════════════════

-- ── INDEX (§7 — composites/partiels, vérifiés absents en base) ────────────────
CREATE INDEX IF NOT EXISTS idx_tx_agency_stage_updated
  ON public.transactions (agency_id, stage, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_tx_agency_assigned_stage
  ON public.transactions (agency_id, assigned_to, stage)
  WHERE stage <> 'lost';

CREATE INDEX IF NOT EXISTS idx_crm_offers_agency_created
  ON public.crm_offers (agency_id, created_at);

CREATE INDEX IF NOT EXISTS idx_visits_agency_scheduled
  ON public.visits (agency_id, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_contacts_agency_created
  ON public.contacts (agency_id, created_at);

CREATE INDEX IF NOT EXISTS idx_kyc_agency_risk
  ON public.kyc_cases (agency_id, risk_level, expires_at)
  WHERE risk_level = 'high';

-- ── HELPER mapping stage → catégorie Sugar, EXHAUSTIF sur les 18 labels enum ──
-- Couvre lead/closed/visit_planned_legacy que le mapping TS ratait. ELSE 'pipeline'
-- attrape tout futur label inconnu (lead/qualified/new_lead/to_qualify/
-- active_search/visit_planned/visit_done/visit_planned_legacy/to_recontact).
-- 'lost' → NULL = exclu des décomptes.
CREATE OR REPLACE FUNCTION public._analytics_decomp(p public.transaction_stage)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p
    WHEN 'signed'             THEN 'signed'
    WHEN 'closed'             THEN 'signed'
    WHEN 'notary'             THEN 'compromis'
    WHEN 'financing'          THEN 'compromis'
    WHEN 'reserved'           THEN 'compromis'
    WHEN 'interest_confirmed' THEN 'compromis'
    WHEN 'offer'              THEN 'offres'
    WHEN 'negotiation'        THEN 'offres'
    WHEN 'lost'               THEN NULL
    ELSE 'pipeline'
  END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 1) analytics_cockpit — décompo pondérée, contributeurs, conversion, vitals KYC
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.analytics_cockpit(
  p_period text DEFAULT 'month',
  p_scope  text DEFAULT 'me'
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '15s'
AS $$
DECLARE
  v_agency  uuid := get_user_agency_id();
  v_me      uuid := auth.uid();
  v_scope   boolean;
  v_from    timestamptz;
  v_to      timestamptz;
  v_pfrom   timestamptz;  -- fenêtre précédente (N-1) pour les deltas
  v_pto     timestamptz;
  v_now     timestamptz := now();
  v_result  jsonb;
BEGIN
  IF v_agency IS NULL THEN RETURN '{}'::jsonb; END IF;
  IF p_scope NOT IN ('me','agency') THEN p_scope := 'agency'; END IF;
  v_scope := (p_scope = 'me');

  -- Bornes mois/trim/année courantes via date_trunc (jamais open-ended).
  IF p_period = 'year' THEN
    v_from := date_trunc('year', v_now);  v_to := v_from + interval '1 year';
    v_pfrom := v_from - interval '1 year'; v_pto := v_from;
  ELSIF p_period = 'quarter' THEN
    v_from := date_trunc('quarter', v_now);  v_to := v_from + interval '3 months';
    v_pfrom := v_from - interval '3 months'; v_pto := v_from;
  ELSE
    v_from := date_trunc('month', v_now);  v_to := v_from + interval '1 month';
    v_pfrom := v_from - interval '1 month'; v_pto := v_from;
  END IF;

  WITH tx AS (
    -- Toutes transactions actives (≠ lost) updated dans la fenêtre, scope appliqué.
    SELECT
      t.id,
      t.stage,
      public._analytics_decomp(t.stage) AS cat,
      ROUND(COALESCE(t.price_final, t.price_offered, p.price, 0)
            * COALESCE(p.mandate_commission_pct, 3) / 100)::bigint AS commission,
      (t.price_final IS NULL AND t.price_offered IS NULL AND p.price IS NULL) AS price_missing,
      (p.mandate_commission_pct IS NULL) AS pct_default,
      t.price_final, t.price_offered, p.price AS prop_price,
      c.first_name, c.last_name
    FROM transactions t
    LEFT JOIN properties p ON p.id = t.property_id
    LEFT JOIN contacts   c ON c.id = t.contact_buyer_id
    WHERE t.agency_id = v_agency
      AND t.stage <> 'lost'
      AND t.updated_at >= v_from AND t.updated_at < v_to
      AND (NOT v_scope OR t.assigned_to = v_me)
  ),
  decomp AS (
    SELECT
      COALESCE(SUM(commission) FILTER (WHERE cat = 'signed'), 0)::bigint    AS signed,
      COALESCE(SUM(commission) FILTER (WHERE cat = 'compromis'), 0)::bigint AS compromis,
      COALESCE(SUM(commission) FILTER (WHERE cat = 'offres'), 0)::bigint    AS offres,
      COALESCE(SUM(commission) FILTER (WHERE cat = 'pipeline'), 0)::bigint  AS pipeline,
      -- Compteurs fallback par catégorie (price_missing exclu du commission ci-dessus
      -- via COALESCE 0, mais on le signale ; pct_default = taux 3% appliqué).
      COUNT(*) FILTER (WHERE cat = 'signed'    AND pct_default)::int    AS sg_pct,
      COUNT(*) FILTER (WHERE cat = 'signed'    AND price_missing)::int  AS sg_miss,
      COUNT(*) FILTER (WHERE cat = 'compromis' AND pct_default)::int    AS cp_pct,
      COUNT(*) FILTER (WHERE cat = 'compromis' AND price_missing)::int  AS cp_miss,
      COUNT(*) FILTER (WHERE cat = 'offres'    AND pct_default)::int    AS of_pct,
      COUNT(*) FILTER (WHERE cat = 'offres'    AND price_missing)::int  AS of_miss,
      COUNT(*) FILTER (WHERE cat = 'pipeline'  AND pct_default)::int    AS pl_pct,
      COUNT(*) FILTER (WHERE cat = 'pipeline'  AND price_missing)::int  AS pl_miss,
      COUNT(*) FILTER (WHERE cat IS NOT NULL)::int                      AS deals,
      COUNT(*) FILTER (WHERE cat = 'signed')::int                       AS n_signed,
      -- volume signé = Σ prix retenu sur les signed (NULL si aucun)
      SUM(COALESCE(price_final, price_offered, prop_price))
        FILTER (WHERE cat = 'signed')                                   AS volume_signed
    FROM tx
  ),
  contrib AS (
    -- Top 5 contributeurs par montant de commission.
    SELECT jsonb_agg(j ORDER BY (j->>'amount')::bigint DESC) AS arr
    FROM (
      SELECT jsonb_build_object(
        'name', NULLIF(TRIM(COALESCE(first_name,'') || ' ' || COALESCE(last_name,'')), ''),
        'stage', CASE cat
                   WHEN 'signed' THEN 'Signé'
                   WHEN 'compromis' THEN 'Compromis'
                   WHEN 'offres' THEN 'Offre'
                   ELSE 'Visite' END,
        'amount', commission,
        'price_missing', price_missing,
        'pct_default', pct_default
      ) AS j
      FROM tx
      WHERE cat IS NOT NULL
      ORDER BY commission DESC
      LIMIT 5
    ) s
  ),
  conv AS (
    -- Conversion = signed / (signed + lost) sur la fenêtre. NULL si dénom 0.
    SELECT
      COUNT(*) FILTER (WHERE stage IN ('signed','closed'))::int AS n_sg,
      COUNT(*) FILTER (WHERE stage = 'lost')::int               AS n_lost
    FROM transactions
    WHERE agency_id = v_agency
      AND stage IN ('signed','closed','lost')
      AND updated_at >= v_from AND updated_at < v_to
      AND (NOT v_scope OR assigned_to = v_me)
  ),
  conv_prev AS (
    SELECT
      COUNT(*) FILTER (WHERE stage IN ('signed','closed'))::int AS n_sg,
      COUNT(*) FILTER (WHERE stage = 'lost')::int               AS n_lost
    FROM transactions
    WHERE agency_id = v_agency
      AND stage IN ('signed','closed','lost')
      AND updated_at >= v_pfrom AND updated_at < v_pto
      AND (NOT v_scope OR assigned_to = v_me)
  ),
  deals_prev AS (
    -- count actifs fenêtre N-1 pour deltaDeals
    SELECT COUNT(*)::int AS n
    FROM transactions
    WHERE agency_id = v_agency
      AND public._analytics_decomp(stage) IS NOT NULL
      AND updated_at >= v_pfrom AND updated_at < v_pto
      AND (NOT v_scope OR assigned_to = v_me)
  ),
  velo AS (
    -- Vélocité = proxy AVG(updated_at - created_at) en jours sur les signed.
    SELECT COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400)), 0)::int AS v
    FROM transactions
    WHERE agency_id = v_agency
      AND stage IN ('signed','closed')   -- « gagné » = catégorie signed (signed + closed)
      AND updated_at >= v_from AND updated_at < v_to
      AND (NOT v_scope OR assigned_to = v_me)
  ),
  kyc AS (
    -- KYC agence-only (pas de colonne agent) — non bloquant, lecture seule.
    SELECT
      COUNT(*) FILTER (WHERE risk_level = 'high')::int AS risk,
      COUNT(*) FILTER (WHERE risk_level = 'high'
                       AND expires_at IS NOT NULL
                       AND expires_at <= v_now + interval '7 days')::int AS urgent
    FROM kyc_cases
    WHERE agency_id = v_agency
  ),
  kyc_prev AS (
    SELECT COUNT(*) FILTER (WHERE risk_level = 'high')::int AS risk
    FROM kyc_cases
    WHERE agency_id = v_agency
      AND created_at >= v_pfrom AND created_at < v_pto
  )
  SELECT jsonb_build_object(
    'scope', p_scope,
    'period', p_period,
    'velocity_source', 'proxy_signed_duration',
    'decomp', jsonb_build_object(
      'signed', d.signed, 'compromis', d.compromis, 'offres', d.offres, 'pipeline', d.pipeline
    ),
    'decomp_flags', jsonb_build_object(
      'signed',    jsonb_build_object('n_default_pct', d.sg_pct, 'n_missing_price', d.sg_miss),
      'compromis', jsonb_build_object('n_default_pct', d.cp_pct, 'n_missing_price', d.cp_miss),
      'offres',    jsonb_build_object('n_default_pct', d.of_pct, 'n_missing_price', d.of_miss),
      'pipeline',  jsonb_build_object('n_default_pct', d.pl_pct, 'n_missing_price', d.pl_miss)
    ),
    -- Projection pondérée par probabilité de réalisation (littéraux nommés) :
    -- signed=1.0 / compromis=0.95 / offres=0.70 / pipeline=0.35.
    'projected', ROUND(d.signed * 1.0 + d.compromis * 0.95 + d.offres * 0.70 + d.pipeline * 0.35)::bigint,
    'contributors', COALESCE(ct.arr, '[]'::jsonb),
    'deals', d.deals,
    'n_signed', d.n_signed,
    'volume_signed', d.volume_signed,
    'conversion', CASE WHEN (cv.n_sg + cv.n_lost) > 0
                       THEN ROUND(cv.n_sg::numeric * 100 / (cv.n_sg + cv.n_lost))::int
                       ELSE NULL END,
    'conversion_prev', CASE WHEN (cp.n_sg + cp.n_lost) > 0
                            THEN ROUND(cp.n_sg::numeric * 100 / (cp.n_sg + cp.n_lost))::int
                            ELSE NULL END,
    'delta_deals', CASE WHEN dp.n > 0
                        THEN ROUND((d.deals - dp.n)::numeric * 100 / dp.n)::int
                        ELSE 0 END,
    'velocity', vl.v,
    'kyc_risk', k.risk,
    'kyc_urgent', k.urgent,
    'kyc_risk_prev', kp.risk
  )
  INTO v_result
  FROM decomp d
  CROSS JOIN contrib ct
  CROSS JOIN conv cv
  CROSS JOIN conv_prev cp
  CROSS JOIN deals_prev dp
  CROSS JOIN velo vl
  CROSS JOIN kyc k
  CROSS JOIN kyc_prev kp;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 2) analytics_funnel — paliers, sources (leads par canal), forecast par horizon
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.analytics_funnel(
  p_period text DEFAULT 'month',
  p_scope  text DEFAULT 'me'
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '15s'
AS $$
DECLARE
  v_agency uuid := get_user_agency_id();
  v_me     uuid := auth.uid();
  v_scope  boolean;
  v_from   timestamptz;
  v_to     timestamptz;
  v_pfrom  timestamptz;
  v_pto    timestamptz;
  v_now    timestamptz := now();
  v_result jsonb;
BEGIN
  IF v_agency IS NULL THEN RETURN '{}'::jsonb; END IF;
  IF p_scope NOT IN ('me','agency') THEN p_scope := 'agency'; END IF;
  v_scope := (p_scope = 'me');

  IF p_period = 'year' THEN
    v_from := date_trunc('year', v_now);  v_to := v_from + interval '1 year';
    v_pfrom := v_from - interval '1 year'; v_pto := v_from;
  ELSIF p_period = 'quarter' THEN
    v_from := date_trunc('quarter', v_now);  v_to := v_from + interval '3 months';
    v_pfrom := v_from - interval '3 months'; v_pto := v_from;
  ELSE
    v_from := date_trunc('month', v_now);  v_to := v_from + interval '1 month';
    v_pfrom := v_from - interval '1 month'; v_pto := v_from;
  END IF;

  WITH cnt AS (
    -- contacts : agence-only (pas de colonne agent) — documenté, marqué « périmètre
    -- agence » dans l'UI. Fenêtre courante.
    SELECT source, score
    FROM contacts
    WHERE agency_id = v_agency
      AND created_at >= v_from AND created_at < v_to
  ),
  cnt_prev AS (
    SELECT COUNT(*)::int AS leads,
           COUNT(*) FILTER (WHERE score IS NOT NULL)::int AS qualif
    FROM contacts
    WHERE agency_id = v_agency
      AND created_at >= v_pfrom AND created_at < v_pto
  ),
  vis AS (
    -- visites distinctes par contact, scope sur agent_id.
    SELECT COUNT(DISTINCT contact_id)::int AS n
    FROM visits
    WHERE agency_id = v_agency
      AND scheduled_at >= v_from AND scheduled_at < v_to
      AND (NOT v_scope OR agent_id = v_me)
  ),
  off AS (
    -- FIX fuite cross-tenant : WHERE agency_id = v_agency (le hook l'oubliait).
    SELECT COUNT(*)::int AS n
    FROM crm_offers
    WHERE agency_id = v_agency
      AND created_at >= v_from AND created_at < v_to
      AND (NOT v_scope OR created_by = v_me)
  ),
  comp AS (
    -- compromis = SNAPSHOT du stock actuel aux stages avancés (funnel d'état),
    -- volontairement NON fenêtré par date — idem forecast ci-dessous (prévision sur
    -- le pipeline ouvert courant). Ne PAS afficher comme un chiffre « de période ».
    -- scope sur assigned_to.
    SELECT COUNT(*)::int AS n
    FROM transactions
    WHERE agency_id = v_agency
      AND stage IN ('interest_confirmed','reserved','financing','notary','signed','closed')
      AND (NOT v_scope OR assigned_to = v_me)
  ),
  src AS (
    SELECT source,
           COUNT(*)::int AS v,
           COUNT(*) FILTER (WHERE score IS NOT NULL)::int AS qualifs
    FROM cnt
    GROUP BY source
  ),
  src_prev AS (
    SELECT source, COUNT(*)::int AS prev
    FROM contacts
    WHERE agency_id = v_agency
      AND created_at >= v_pfrom AND created_at < v_pto
    GROUP BY source
  ),
  sources AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'source', s.source,
        'v', s.v,
        'conv', CASE WHEN s.v > 0 THEN ROUND(s.qualifs::numeric * 100 / s.v)::int ELSE 0 END,
        'prev', COALESCE(sp.prev, 0)
      ) ORDER BY s.v DESC, s.source
    ) AS arr
    FROM src s
    LEFT JOIN src_prev sp ON sp.source = s.source
  ),
  fc AS (
    -- forecast par horizon stage avancé (mid = Σ commission), cumulatif.
    SELECT
      COALESCE(SUM(commission) FILTER (WHERE h = 30), 0)::bigint AS m30,
      COUNT(*) FILTER (WHERE h = 30)::int                       AS n30,
      COALESCE(SUM(commission) FILTER (WHERE h <= 60), 0)::bigint AS m60,
      COUNT(*) FILTER (WHERE h <= 60)::int                     AS n60,
      COALESCE(SUM(commission) FILTER (WHERE h <= 90), 0)::bigint AS m90,
      COUNT(*) FILTER (WHERE h <= 90)::int                     AS n90
    FROM (
      SELECT
        CASE
          WHEN t.stage IN ('notary','financing','reserved') THEN 30
          WHEN t.stage IN ('offer','negotiation','interest_confirmed') THEN 60
          WHEN t.stage IN ('visit_done','visit_planned') THEN 90
          ELSE NULL
        END AS h,
        ROUND(COALESCE(t.price_final, t.price_offered, p.price, 0)
              * COALESCE(p.mandate_commission_pct, 3) / 100)::bigint AS commission
      FROM transactions t
      LEFT JOIN properties p ON p.id = t.property_id
      WHERE t.agency_id = v_agency
        AND t.stage <> 'lost'
        AND (NOT v_scope OR t.assigned_to = v_me)
    ) hz
    WHERE h IS NOT NULL
  )
  SELECT jsonb_build_object(
    'funnel', jsonb_build_object(
      'leads', (SELECT COUNT(*) FROM cnt),
      'leads_prev', (SELECT leads FROM cnt_prev),
      'qualif', (SELECT COUNT(*) FROM cnt WHERE score IS NOT NULL),
      'qualif_prev', (SELECT qualif FROM cnt_prev),
      'visits', (SELECT n FROM vis),
      'offers', (SELECT n FROM off),
      'compromis', (SELECT n FROM comp)
    ),
    'sources', COALESCE((SELECT arr FROM sources), '[]'::jsonb),
    'forecast', jsonb_build_object(
      'n30', fc.n30, 'mid30', fc.m30,
      'n60', fc.n60, 'mid60', fc.m60,
      'n90', fc.n90, 'mid90', fc.m90
    )
  )
  INTO v_result
  FROM fc;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 3) analytics_objectif — bucketing temporel + cumul + extrapolation linéaire
-- ════════════════════════════════════════════════════════════════════════════
-- Port SQL de useDashboardObjectif : Σ commission signed par bucket (jour/semaine/
-- mois), cumul jusqu'à realIdx, extrapolation au rythme courant. Source unique du
-- Hero (projectedEnd/series), distincte de la décompo pondérée du cockpit.
CREATE OR REPLACE FUNCTION public.analytics_objectif(
  p_period text DEFAULT 'month',
  p_scope  text DEFAULT 'me'
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '15s'
AS $$
DECLARE
  v_agency  uuid := get_user_agency_id();
  v_me      uuid := auth.uid();
  v_scope   boolean;
  v_now     timestamptz := now();
  v_from    timestamptz;
  v_to      timestamptz;
  v_trunc   text;
  v_buckets int;
  v_realidx int;
  v_target  numeric;
  v_label   text;
  v_xlabels text[];
  v_per     bigint[];     -- commission par bucket
  v_real    bigint[];     -- cumul jusqu'à realIdx
  v_median  bigint[];     -- extrapolation depuis realIdx
  v_realized bigint;
  v_slope   numeric;
  v_remaining int;
  v_projected bigint;
  i int;
  v_running bigint := 0;
  v_result  jsonb;
  fr_months_short text[] := ARRAY['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];
  fr_months_full  text[] := ARRAY['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  v_month int;
  v_q int;
  v_firstweek int;
BEGIN
  IF v_agency IS NULL THEN RETURN '{}'::jsonb; END IF;
  IF p_scope NOT IN ('me','agency') THEN p_scope := 'agency'; END IF;
  v_scope := (p_scope = 'me');

  -- Axe temporel + target dérivée selon la période.
  SELECT
    CASE p_period WHEN 'month' THEN monthly_target
                  WHEN 'quarter' THEN quarterly_target
                  ELSE yearly_target END
  INTO v_target
  FROM agencies WHERE id = v_agency;
  v_target := COALESCE(v_target, 0);

  IF p_period = 'year' THEN
    v_from := date_trunc('year', v_now);
    v_to := v_from + interval '1 year';
    v_trunc := 'month';
    v_buckets := 12;
    v_realidx := EXTRACT(MONTH FROM v_now)::int - 1;
    v_xlabels := fr_months_short;
    v_label := 'Année ' || EXTRACT(YEAR FROM v_now)::int;
  ELSIF p_period = 'quarter' THEN
    v_q := FLOOR((EXTRACT(MONTH FROM v_now)::int - 1) / 3)::int;  -- 0-based quarter
    v_from := date_trunc('quarter', v_now);
    v_to := v_from + interval '3 months';
    v_trunc := 'week';
    -- nb de semaines de la fenêtre (≈13), ceil sur les jours / 7
    v_buckets := CEIL((EXTRACT(EPOCH FROM (v_to - v_from)) / 86400) / 7.0)::int;
    v_realidx := LEAST(v_buckets - 1, FLOOR(EXTRACT(EPOCH FROM (v_now - v_from)) / 86400 / 7)::int);
    v_firstweek := FLOOR(EXTRACT(EPOCH FROM (v_from - date_trunc('year', v_from))) / 86400 / 7)::int;
    v_xlabels := ARRAY(SELECT 'S' || (v_firstweek + g + 1)::text FROM generate_series(0, v_buckets - 1) g);
    v_label := 'T' || (v_q + 1)::text || ' ' || EXTRACT(YEAR FROM v_now)::int;
  ELSE
    v_from := date_trunc('month', v_now);
    v_to := v_from + interval '1 month';
    v_trunc := 'day';
    v_buckets := EXTRACT(DAY FROM (v_to - interval '1 day'))::int;
    v_realidx := LEAST(v_buckets - 1, EXTRACT(DAY FROM v_now)::int - 1);
    v_xlabels := ARRAY(SELECT (g + 1)::text FROM generate_series(0, v_buckets - 1) g);
    v_month := EXTRACT(MONTH FROM v_now)::int;
    -- libellé FR explicite (to_char TMMonth dépend du lc_time de la base, souvent en_US -> « June »)
    v_label := fr_months_full[v_month] || ' ' || EXTRACT(YEAR FROM v_now)::int;
  END IF;

  -- Commission signed par bucket (jour/semaine/mois selon v_trunc).
  v_per := ARRAY(SELECT 0::bigint FROM generate_series(1, v_buckets));
  FOR i IN 0 .. v_buckets - 1 LOOP
    v_per[i + 1] := COALESCE((
      SELECT SUM(ROUND(COALESCE(t.price_final, t.price_offered, p.price, 0)
                       * COALESCE(p.mandate_commission_pct, 3) / 100))
      FROM transactions t
      LEFT JOIN properties p ON p.id = t.property_id
      WHERE t.agency_id = v_agency
        AND t.stage IN ('signed','closed')   -- realized = catégorie signed (signed + closed)
        AND t.updated_at >= v_from AND t.updated_at < v_to
        AND (NOT v_scope OR t.assigned_to = v_me)
        AND (
          CASE v_trunc
            WHEN 'day'  THEN LEAST(v_buckets - 1, GREATEST(0, EXTRACT(DAY FROM t.updated_at)::int - 1))
            WHEN 'week' THEN LEAST(v_buckets - 1, GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (t.updated_at - v_from)) / 86400 / 7)::int))
            ELSE LEAST(v_buckets - 1, GREATEST(0, EXTRACT(MONTH FROM t.updated_at)::int - 1))
          END
        ) = i
    ), 0)::bigint;
  END LOOP;

  -- Cumul progressif jusqu'à realIdx.
  v_real := ARRAY[]::bigint[];
  v_running := 0;
  FOR i IN 0 .. v_realidx LOOP
    v_running := v_running + COALESCE(v_per[i + 1], 0);
    v_real := array_append(v_real, v_running);
  END LOOP;
  v_realized := COALESCE(v_real[array_length(v_real, 1)], 0);

  -- Extrapolation linéaire au rythme courant (slope = realized / realIdx).
  v_remaining := GREATEST(0, v_buckets - 1 - v_realidx);
  IF v_remaining > 0 AND v_realidx > 0 THEN
    v_slope := v_realized::numeric / v_realidx;
  ELSE
    v_slope := 0;
  END IF;
  v_projected := ROUND(v_realized + v_slope * v_remaining)::bigint;

  v_median := ARRAY[v_realized];
  FOR i IN 1 .. v_remaining LOOP
    v_median := array_append(v_median, ROUND(v_realized + v_slope * i)::bigint);
  END LOOP;

  v_result := jsonb_build_object(
    'period', p_period,
    'trunc', v_trunc,
    'target', v_target,
    'target_is_set', (v_target > 0),
    'realized', v_realized,
    'buckets', v_buckets,
    'realIdx', v_realidx,
    'xLabels', to_jsonb(v_xlabels),
    'real', to_jsonb(v_real),
    'median', to_jsonb(v_median),
    'projected', v_projected,
    'label', v_label
  );

  RETURN v_result;
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 4) analytics_set_target — persiste l'objectif (saisie annuelle) + audit atomique
-- ════════════════════════════════════════════════════════════════════════════
-- SECURITY INVOKER : s'appuie sur RLS agencies_members_update (ouverte à tout
-- membre, sans garde de rôle) + events_insert. Atomicité UPDATE + INSERT dans la
-- même transaction PL/pgSQL → le trail d'audit est garanti, jamais best-effort.
CREATE OR REPLACE FUNCTION public.analytics_set_target(p_yearly numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_agency  uuid := get_my_agency_id();
  v_yearly  numeric := ROUND(GREATEST(0, COALESCE(p_yearly, 0)));
  v_quarter numeric := ROUND(v_yearly / 4);
  v_month   numeric := ROUND(v_yearly / 12);
  v_prev    jsonb;
BEGIN
  IF v_agency IS NULL THEN
    RAISE EXCEPTION 'Aucune agence associée à l''utilisateur';
  END IF;

  SELECT jsonb_build_object(
    'yearly', yearly_target, 'quarterly', quarterly_target, 'monthly', monthly_target
  ) INTO v_prev
  FROM agencies WHERE id = v_agency;

  UPDATE agencies
  SET yearly_target = v_yearly,
      quarterly_target = v_quarter,
      monthly_target = v_month
  WHERE id = v_agency;

  INSERT INTO activity_events (
    agency_id, actor_id, actor_kind, action, entity_type, entity_id,
    category, severity, object_label, metadata
  ) VALUES (
    v_agency, auth.uid(), 'user', 'agency_target_updated', 'agency', v_agency,
    'settings', 'info', 'Objectif commercial annuel',
    jsonb_build_object(
      'basis', 'annual',
      'old', v_prev,
      'new', jsonb_build_object('yearly', v_yearly, 'quarterly', v_quarter, 'monthly', v_month)
    )
  );
END;
$$;

-- ── GRANTS : aucun accès anon, exécution réservée aux sessions authentifiées ──
REVOKE ALL ON FUNCTION public._analytics_decomp(public.transaction_stage) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.analytics_cockpit(text, text)   FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.analytics_funnel(text, text)    FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.analytics_objectif(text, text)  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.analytics_set_target(numeric)   FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public._analytics_decomp(public.transaction_stage) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.analytics_cockpit(text, text)  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.analytics_funnel(text, text)   TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.analytics_objectif(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.analytics_set_target(numeric)  TO authenticated, service_role;
