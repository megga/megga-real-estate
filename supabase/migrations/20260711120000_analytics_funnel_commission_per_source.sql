-- ════════════════════════════════════════════════════════════════════════════
-- analytics_funnel — commission RÉELLE par canal (décompose le « Réalisé » du héro)
-- ════════════════════════════════════════════════════════════════════════════
-- Avant : `sources` = uniquement le VOLUME de leads par canal (contacts.source).
-- Après : chaque canal porte aussi `comm` = Σ commission RÉALISÉE des deals gagnés
--         attribués au canal du contact ACHETEUR (transactions.contact_buyer_id
--         → contacts.source), + `won` = nombre de deals gagnés de ce canal.
--
-- Attribution = MÊME définition que analytics_objectif.realized (source de vérité
-- du « Réalisé ») : stage IN ('signed','closed'), updated_at dans la fenêtre de
-- période, scope assigned_to → la somme des `comm` par canal = le Réalisé du héro
-- MOINS les deals gagnés sans acheteur rattaché (contact_buyer_id/source NULL),
-- qui restent honnêtement non attribués (jamais forcés dans un canal fantôme).
--
-- Les champs existants (`v` leads, `conv`, `prev`) sont INCHANGÉS — le mobile et
-- le % de leads continuent de fonctionner à l'identique. On AJOUTE seulement.
-- La liste des canaux couvre désormais l'UNION (leads de la période) ∪ (canaux
-- ayant produit de la commission), pour qu'un canal qui a converti sans nouveau
-- lead ce mois apparaisse quand même. Tri par commission décroissante.

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
    SELECT COUNT(*)::int AS n
    FROM crm_offers
    WHERE agency_id = v_agency
      AND created_at >= v_from AND created_at < v_to
      AND (NOT v_scope OR created_by = v_me)
  ),
  comp AS (
    -- compromis = SNAPSHOT du stock actuel aux stages avancés (funnel d'état),
    -- volontairement NON fenêtré par date. scope sur assigned_to.
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
  src_comm AS (
    -- commission RÉALISÉE par canal du contact ACHETEUR — MÊME définition que
    -- analytics_objectif.realized (signed/closed, updated_at dans la fenêtre,
    -- scope assigned_to). Deals sans acheteur/source rattaché → exclus (honnête,
    -- pas de canal fantôme). COALESCE prix/pct identique au reste des RPC.
    SELECT c.source,
           SUM(ROUND(COALESCE(t.price_final, t.price_offered, p.price, 0)
                     * COALESCE(p.mandate_commission_pct, 3) / 100))::bigint AS comm,
           COUNT(*)::int AS won
    FROM transactions t
    JOIN contacts c ON c.id = t.contact_buyer_id
    LEFT JOIN properties p ON p.id = t.property_id
    WHERE t.agency_id = v_agency
      AND t.stage IN ('signed','closed')
      AND t.updated_at >= v_from AND t.updated_at < v_to
      AND c.source IS NOT NULL
      AND (NOT v_scope OR t.assigned_to = v_me)
    GROUP BY c.source
  ),
  chan AS (
    -- univers des canaux = leads de la période ∪ canaux ayant produit de la commission.
    SELECT source FROM src WHERE source IS NOT NULL
    UNION
    SELECT source FROM src_comm
  ),
  sources AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'source', ch.source,
        'v', COALESCE(s.v, 0),
        'conv', CASE WHEN COALESCE(s.v, 0) > 0 THEN ROUND(s.qualifs::numeric * 100 / s.v)::int ELSE 0 END,
        'prev', COALESCE(sp.prev, 0),
        'comm', COALESCE(scm.comm, 0),
        'won', COALESCE(scm.won, 0)
      ) ORDER BY COALESCE(scm.comm, 0) DESC, COALESCE(s.v, 0) DESC, ch.source
    ) AS arr
    FROM chan ch
    LEFT JOIN src      s   ON s.source  = ch.source
    LEFT JOIN src_prev sp  ON sp.source = ch.source
    LEFT JOIN src_comm scm ON scm.source = ch.source
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

-- Grants inchangés (CREATE OR REPLACE les préserve, on les ré-assère par sûreté :
-- aucun accès anon/public, exécution réservée aux sessions authentifiées + service).
REVOKE ALL ON FUNCTION public.analytics_funnel(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.analytics_funnel(text, text) TO authenticated, service_role;
