-- ════════════════════════════════════════════════════════════════════════════
-- MEGGA — Algo « Focus » : file de priorité « quoi faire maintenant » (cockpit Aujourd'hui)
-- ════════════════════════════════════════════════════════════════════════════
-- Recâble la colonne Focus / Mode Focus (src/components/crm-sugar/today/useFocusQueue.ts)
-- sur un score de priorité DÉTERMINISTE, EXPLICABLE et TUNABLE. Remplace l'heuristique
-- client qui s'appuyait sur deal.risk (FACTICE — dérivé de transaction.status) et sur
-- nextAction.dueAt (= updated_at, bidon). Le vrai signal « deal sous tension » devient la
-- STALENESS (now - updated_at vs un seuil par stage).
--
-- Même grammaire que matching v2 (20260614130000/130100) et analytics (20260614150000) :
--   • SECURITY DEFINER + agence du JWT via get_user_agency_id() → anti-IDOR. v_agency est
--     filtré dans CHAQUE sous-requête : toute sous-requête future sans agency_id = v_agency
--     serait une fuite cross-tenant (→ test backend obligatoire).
--   • Barème externalisé dans app_config.key='today_focus_v1' (ajustable sans redéploiement).
--   • 100 % déterministe, AUCUN appel LLM. Poids/seuils/probabilités = littéraux nommés.
--   • KYC NON-BLOQUANT : surfacé comme assist, ne gate jamais aucune action (compliance CH :
--     le notaire finalise ; le KYC MEGGA est facultatif).
--   • §7 perf : statement_timeout, index partiels couvrant WHERE+ORDER, pas de count exact,
--     LIMIT bornés, pas de colonne lourde (description/photos array) en liste.
--
-- Sortie : tableau jsonb plat DÉJÀ TRIÉ (tier 'now' d'abord puis 'next', score desc dans
-- chaque tier). L'agent garde la main (estimation + HITL) : Focus SUGGÈRE un ordre, il
-- n'exécute rien.
-- ════════════════════════════════════════════════════════════════════════════

-- ── INDEX (§7) — matches.status='suggested' scanné par le signal « matchs chauds » ───
-- 2656 lignes 'suggested' en base → index partiel pour ne pas séquentiellement scanner.
-- (idx_tx_agency_stage_updated, idx_reminders_agency_status_trigger, idx_kyc_agency_risk
--  existent déjà et servent les autres branches.)
CREATE INDEX IF NOT EXISTS idx_matches_agency_status_score
  ON public.matches (agency_id, score DESC, created_at DESC)
  WHERE status = 'suggested';

-- ── BARÈME par défaut (app_config) ───────────────────────────────────────────────────
-- weights : total 100. urgency domine (échéance/staleness), value/probability inclinent les
-- deals, kyc et match ont leur poids dédié. staleness_days/stage_probability : un littéral
-- par label d'enum transaction_stage (les stages absents retombent sur les défauts du RPC).
INSERT INTO public.app_config (key, value)
VALUES (
  'today_focus_v1',
  '{
    "version": 1,
    "weights": { "urgency": 40, "value": 18, "probability": 14, "kyc": 16, "match": 12 },
    "value_ref": 1500000,
    "result_cap": 12,
    "overdue_cap_days": 14,
    "match_min_score": 80,
    "match_recency_days": 7,
    "match_cap": 3,
    "kyc_urgent_days": 7,
    "kyc_soon_days": 30,
    "staleness_days": {
      "lead": 14, "new_lead": 14, "to_qualify": 12, "qualified": 12,
      "active_search": 10, "to_recontact": 7,
      "visit_planned": 5, "visit_planned_legacy": 5, "visit_done": 4,
      "interest_confirmed": 3, "reserved": 3, "negotiation": 2, "offer": 2,
      "financing": 5, "notary": 5
    },
    "stage_probability": {
      "lead": 5, "new_lead": 5, "to_qualify": 15, "qualified": 15,
      "active_search": 30, "to_recontact": 25,
      "visit_planned": 45, "visit_planned_legacy": 45, "visit_done": 60,
      "interest_confirmed": 75, "reserved": 80, "negotiation": 80, "offer": 85,
      "financing": 90, "notary": 95
    }
  }'
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ════════════════════════════════════════════════════════════════════════════
-- today_focus_queue(p_scope) — file de priorité scorée
-- ════════════════════════════════════════════════════════════════════════════
-- p_scope 'me' (défaut) : transactions assigned_to = appelant OU non assignées (cockpit
-- personnel). 'agency' : toute l'agence. reminders/matches/kyc = périmètre AGENCE dans les
-- deux scopes (pas de colonne owner) — documenté.
CREATE OR REPLACE FUNCTION public.today_focus_queue(p_scope text DEFAULT 'me')
RETURNS jsonb
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
  -- fin de journée en heure suisse (frontière « aujourd'hui » correcte, pas UTC)
  v_endday  timestamptz := (date_trunc('day', now() AT TIME ZONE 'Europe/Zurich') + interval '1 day') AT TIME ZONE 'Europe/Zurich';
  v_cfg     jsonb;
  v_w_urg   numeric; v_w_val numeric; v_w_prob numeric; v_w_kyc numeric; v_w_match numeric;
  v_value_ref   numeric;
  v_overdue_cap numeric;
  v_match_min   int;
  v_match_rec   int;
  v_match_cap   int;
  v_kyc_urg     int;
  v_kyc_soon    int;
  v_result_cap  int;
  v_stale   jsonb;
  v_prob    jsonb;
  v_result  jsonb;
BEGIN
  IF v_agency IS NULL THEN RETURN '[]'::jsonb; END IF;
  IF p_scope NOT IN ('me','agency') THEN p_scope := 'me'; END IF;
  v_scope := (p_scope = 'me');

  v_cfg := COALESCE((SELECT value::jsonb FROM app_config WHERE key = 'today_focus_v1'), '{}'::jsonb);
  v_w_urg      := COALESCE((v_cfg->'weights'->>'urgency')::numeric, 40);
  v_w_val      := COALESCE((v_cfg->'weights'->>'value')::numeric, 18);
  v_w_prob     := COALESCE((v_cfg->'weights'->>'probability')::numeric, 14);
  v_w_kyc      := COALESCE((v_cfg->'weights'->>'kyc')::numeric, 16);
  v_w_match    := COALESCE((v_cfg->'weights'->>'match')::numeric, 12);
  v_value_ref  := GREATEST(COALESCE((v_cfg->>'value_ref')::numeric, 1500000), 1);
  v_overdue_cap:= GREATEST(COALESCE((v_cfg->>'overdue_cap_days')::numeric, 14), 1);
  v_match_min  := COALESCE((v_cfg->>'match_min_score')::int, 80);
  v_match_rec  := GREATEST(COALESCE((v_cfg->>'match_recency_days')::int, 7), 1);
  v_match_cap  := GREATEST(COALESCE((v_cfg->>'match_cap')::int, 3), 0);
  v_kyc_urg    := GREATEST(COALESCE((v_cfg->>'kyc_urgent_days')::int, 7), 1);
  v_kyc_soon   := GREATEST(COALESCE((v_cfg->>'kyc_soon_days')::int, 30), 1);
  v_result_cap := GREATEST(COALESCE((v_cfg->>'result_cap')::int, 12), 1);
  v_stale      := COALESCE(v_cfg->'staleness_days', '{}'::jsonb);
  v_prob       := COALESCE(v_cfg->'stage_probability', '{}'::jsonb);

  WITH
  -- ── 1. REMINDERS : vraies échéances (relance / KYC / offre selon le type) ──────────
  rem AS (
    SELECT
      'rem-' || r.id::text AS id,
      'reminder'::text AS source,
      r.id AS reminder_id,
      r.contact_id,
      TRIM(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,'')) AS contact,
      CASE WHEN r.trigger_at <= v_now THEN 'now' ELSE 'next' END AS tier,
      (r.trigger_at <= v_now) AS urgent,
      r.trigger_at AS due_at,
      CASE r.type WHEN 'missing_document' THEN 'kyc' WHEN 'price_change' THEN 'offer' ELSE 'call' END AS type,
      CASE r.type WHEN 'missing_document' THEN 'KYC' WHEN 'price_change' THEN 'OFFRE' ELSE 'RELANCE' END AS kind,
      p.price AS value,
      p.photos[1] AS photo,
      -- urgency : échu → 0.5..1 selon retard ; à venir aujourd'hui → 0.2..0.5 selon proximité
      CASE WHEN r.trigger_at <= v_now
           THEN 0.5 + 0.5 * LEAST(1, (EXTRACT(EPOCH FROM (v_now - r.trigger_at))/86400) / v_overdue_cap)
           ELSE 0.2 + 0.3 * (1 - LEAST(1, EXTRACT(EPOCH FROM (r.trigger_at - v_now))/86400))
      END AS u,
      CASE WHEN r.trigger_at <= v_now
           THEN 'En retard de ' || GREATEST(1, FLOOR(EXTRACT(EPOCH FROM (v_now - r.trigger_at))/86400))::int || ' j — '
                || CASE r.type WHEN 'missing_document' THEN 'pièce KYC à obtenir.'
                               WHEN 'price_change' THEN 'changement de prix à traiter.'
                               ELSE 'relance à passer.' END
           ELSE 'Prévu aujourd''hui à ' || to_char(r.trigger_at AT TIME ZONE 'Europe/Zurich', 'HH24:MI') || '.'
      END AS reason
    FROM reminders r
    LEFT JOIN contacts c ON c.id = r.contact_id
    LEFT JOIN properties p ON p.id = r.property_id
    WHERE r.agency_id = v_agency
      AND r.status IN ('pending','triggered')
      AND r.trigger_at <= v_endday
    LIMIT 100
  ),
  rem_scored AS (
    SELECT id, source, tier, ROUND(v_w_urg * u)::int AS score, reason, contact, contact_id,
           kind, type, due_at, urgent, value, photo, reminder_id
    FROM rem
  ),
  -- ── 2. DEALS sous tension : staleness (now - updated_at >= seuil du stage) ──────────
  dl AS (
    SELECT
      'deal-' || t.id::text AS id,
      t.id AS tx_id,
      COALESCE(t.contact_buyer_id, t.contact_seller_id) AS contact_id,
      TRIM(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,'')) AS contact,
      t.stage::text AS stage,
      EXTRACT(EPOCH FROM (v_now - t.updated_at))/86400 AS idle_days,
      COALESCE((v_stale->>t.stage::text)::numeric, 7) AS thr,
      COALESCE(t.price_final, t.price_offered, p.price, 0) AS value,
      COALESCE((v_prob->>t.stage::text)::numeric, 30) AS prob,
      p.photos[1] AS photo
    FROM transactions t
    LEFT JOIN properties p ON p.id = t.property_id
    LEFT JOIN contacts c ON c.id = COALESCE(t.contact_buyer_id, t.contact_seller_id)
    WHERE t.agency_id = v_agency
      AND t.stage NOT IN ('lost','signed','closed')
      AND (NOT v_scope OR t.assigned_to = v_me OR t.assigned_to IS NULL)
      AND EXTRACT(EPOCH FROM (v_now - t.updated_at))/86400 >= COALESCE((v_stale->>t.stage::text)::numeric, 7)
    LIMIT 100
  ),
  dl_scored AS (
    SELECT
      id, 'deal'::text AS source, 'now'::text AS tier,
      ROUND( v_w_urg  * LEAST(1, (idle_days - thr) / GREATEST(thr, 1))
           + v_w_val  * LEAST(1, value / v_value_ref)
           + v_w_prob * (prob / 100) )::int AS score,
      'Sans activité depuis ' || FLOOR(idle_days)::int || ' j — '
        || CASE
             WHEN stage IN ('offer','negotiation','interest_confirmed','reserved') THEN 'offre en jeu'
             WHEN stage IN ('financing','notary') THEN 'signature à sécuriser'
             ELSE 'à relancer'
           END
        || ' (probabilité ' || prob::int || ' %).' AS reason,
      contact, contact_id,
      CASE WHEN stage IN ('offer','negotiation','interest_confirmed','reserved') THEN 'OFFRE'
           WHEN stage IN ('financing','notary') THEN 'SIGNATURE'
           ELSE 'RELANCE' END AS kind,
      CASE WHEN stage IN ('offer','negotiation','interest_confirmed','reserved') THEN 'offer'
           WHEN stage IN ('financing','notary') THEN 'sign'
           ELSE 'call' END AS type,
      NULL::timestamptz AS due_at,
      true AS urgent,
      value, photo, NULL::uuid AS reminder_id
    FROM dl
  ),
  -- ── 3. MATCHS chauds : opportunité (status='suggested', score haut, récents) ───────
  -- dédup par contact (meilleur score), puis cap dur. Tier 'next' (pas d'échéance).
  mt_raw AS (
    SELECT DISTINCT ON (m.contact_id)
      m.id, m.contact_id, m.score,
      EXTRACT(EPOCH FROM (v_now - m.created_at))/86400 AS age_days,
      TRIM(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,'')) AS contact,
      COALESCE(pp.price, ml.current_price, ml.price) AS value,
      COALESCE(pp.photos[1], ml.photos[1]) AS photo
    FROM matches m
    LEFT JOIN contacts c ON c.id = m.contact_id
    LEFT JOIN properties pp ON pp.id = m.property_id
    LEFT JOIN market_listings ml ON ml.id = m.market_listing_id
    WHERE m.agency_id = v_agency
      AND m.status = 'suggested'
      AND m.score >= v_match_min
      AND m.created_at >= v_now - make_interval(days => v_match_rec)
      AND (m.snoozed_until IS NULL OR m.snoozed_until <= v_now)
    ORDER BY m.contact_id, m.score DESC, m.created_at DESC
  ),
  mt AS (
    SELECT * FROM mt_raw ORDER BY score DESC, age_days ASC LIMIT v_match_cap
  ),
  mt_scored AS (
    SELECT
      'match-' || id::text AS id, 'match'::text AS source, 'next'::text AS tier,
      ROUND( v_w_urg * (1 - LEAST(1, age_days / v_match_rec))
           + v_w_match * (score / 100) )::int AS score,
      'Nouveau bien à ' || score::int || ' % pour ce client — à envoyer.' AS reason,
      contact, contact_id, 'MATCH'::text AS kind, 'match'::text AS type,
      NULL::timestamptz AS due_at, false AS urgent, value, photo, NULL::uuid AS reminder_id
    FROM mt
  ),
  -- ── 4. KYC : assist NON-BLOQUANT (dossier lié à une tx active, échéance proche) ─────
  ky AS (
    SELECT DISTINCT ON (k.id)
      'kyc-' || k.id::text AS id, 'kyc'::text AS source,
      k.contact_id,
      TRIM(COALESCE(c.first_name,'') || ' ' || COALESCE(c.last_name,'')) AS contact,
      k.expires_at,
      EXTRACT(EPOCH FROM (k.expires_at - v_now))/86400 AS days_left,
      p.price AS value,
      p.photos[1] AS photo
    FROM kyc_cases k
    JOIN transactions t ON t.id = k.transaction_id
      AND t.stage NOT IN ('lost','signed','closed')
      AND (NOT v_scope OR t.assigned_to = v_me OR t.assigned_to IS NULL)
    LEFT JOIN contacts c ON c.id = k.contact_id
    LEFT JOIN properties p ON p.id = t.property_id
    WHERE k.agency_id = v_agency
      AND k.expires_at IS NOT NULL
      AND k.expires_at <= v_now + make_interval(days => v_kyc_soon)
      AND COALESCE(k.dossier_status, '') <> 'complete'
    LIMIT 50
  ),
  ky_scored AS (
    SELECT
      id, source,
      CASE WHEN days_left <= v_kyc_urg THEN 'now' ELSE 'next' END AS tier,
      ROUND( v_w_urg * (1 - LEAST(1, GREATEST(days_left, 0) / v_kyc_soon))
           + v_w_kyc * 1 )::int AS score,
      CASE WHEN days_left <= 0
           THEN 'Dossier KYC échu — à compléter (assist, non bloquant).'
           ELSE 'Dossier KYC à compléter — échéance dans ' || CEIL(days_left)::int || ' j (assist).'
      END AS reason,
      contact, contact_id, 'KYC'::text AS kind, 'kyc'::text AS type,
      NULL::timestamptz AS due_at, (days_left <= v_kyc_urg) AS urgent,
      value, photo, NULL::uuid AS reminder_id
    FROM ky
  ),
  unioned AS (
    SELECT * FROM rem_scored
    UNION ALL SELECT * FROM dl_scored
    UNION ALL SELECT * FROM mt_scored
    UNION ALL SELECT * FROM ky_scored
  )
  -- Tri global : tier 'now' d'abord, puis score desc. Cap honnête (result_cap).
  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY (x.tier = 'now') DESC, x.score DESC), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT * FROM unioned
    ORDER BY (tier = 'now') DESC, score DESC
    LIMIT v_result_cap
  ) x;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- ── GRANTS : aucun anon, exécution réservée aux sessions authentifiées ────────────────
REVOKE ALL ON FUNCTION public.today_focus_queue(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.today_focus_queue(text) TO authenticated, service_role;

COMMENT ON FUNCTION public.today_focus_queue(text) IS
  'Algo Focus (cockpit Aujourd''hui) : file de priorité scorée déterministe/explicable. '
  'Agence du JWT (anti-IDOR), barème app_config.today_focus_v1, 0 LLM, KYC non bloquant, estimation+HITL.';
