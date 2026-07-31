-- Garde super-admin sur les deux lectures d'agrégats par agence, et fermeture à `anon`
-- des deux RPC de maintenance des logos.
--
-- CONSTAT (docs/console-admin/INVENTAIRE_SOCLE.md §6, bloquant pré-lancement 0.2) :
-- `get_onboarding_milestones(uuid[])` et `get_agency_activity_summary(uuid[], integer)`
-- sont SECURITY DEFINER, EXECUTE accordé à `authenticated`, et n'ont NI garde NI filtre
-- d'agence : elles prennent un tableau d'agency_id et répondent pour n'importe lequel.
-- Tout compte authentifié apprenait donc, agence par agence, si elle a des contacts, des
-- biens, des dossiers KYC, des transactions, des matchs, ainsi que son volume d'événements
-- et sa date de dernière activité. C'est le finding S2/S10/S17 de l'audit pré-lancement
-- (audit/patches/06) : la remédiation du 17.07 (20260717190000) a traité `get_agency_stats`
-- et les quatre `get_admin_*`, mais a laissé ces deux-là — mesuré en base le 31.07.2026,
-- `prosrc ILIKE '%is_super_admin%'` = false sur les deux.
--
-- Ces deux fonctions sont nommément citées par le handoff de la Console MEGGA (§4.1, §5.1,
-- §5.3) comme sources de la console : elles doivent tenir le test §10.3 « JWT agent sur
-- chaque RPC → refus », qu'elles échouent aujourd'hui.
--
-- MÉTHODE : le corps SELECT est repris VERBATIM de la définition VIVANTE
-- (`pg_get_functiondef`, 31.07.2026), jamais du fichier d'origine — le dépôt porte quatre
-- cas mesurés de fonction dont le corps en service vient d'une autre migration que celle
-- qu'on croit. Seules la langue (sql → plpgsql) et la garde changent ; signature, type de
-- retour et valeur par défaut sont identiques, donc CREATE OR REPLACE suffit (pas de
-- 42P13) et la migration reste rejouable telle quelle.
--
-- APPELANTS (les seuls, vérifiés) : src/hooks/useOnboardingTracker.ts:45 et
-- src/pages/admin/AdminAgenciesPage.tsx:126 — deux surfaces super-admin. Aucune régression
-- attendue côté agent.

-- ── 1. Jalons d'activation par agence ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_onboarding_milestones(agency_ids uuid[])
 RETURNS TABLE(agency_id uuid, has_contact boolean, has_property boolean, has_kyc boolean, has_transaction boolean, has_match boolean, last_activity_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT (public.is_super_admin() OR public.is_service_role()) THEN
    RAISE EXCEPTION 'forbidden: super_admin only' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT a.id AS agency_id,
    EXISTS (SELECT 1 FROM public.contacts WHERE contacts.agency_id = a.id) AS has_contact,
    EXISTS (SELECT 1 FROM public.properties WHERE properties.agency_id = a.id) AS has_property,
    EXISTS (SELECT 1 FROM public.kyc_cases WHERE kyc_cases.agency_id = a.id) AS has_kyc,
    EXISTS (SELECT 1 FROM public.transactions WHERE transactions.agency_id = a.id) AS has_transaction,
    EXISTS (SELECT 1 FROM public.matches WHERE matches.agency_id = a.id) AS has_match,
    (SELECT max(created_at) FROM public.activity_events WHERE activity_events.agency_id = a.id) AS last_activity_at
  FROM unnest(agency_ids) AS a(id);
END;
$function$;

COMMENT ON FUNCTION public.get_onboarding_milestones(uuid[]) IS
  'Jalons d''activation par agence (super-admin). Garde is_super_admin() OR is_service_role() (42501 sinon) — 20260731190000, bloquant pré-lancement 0.2.';

-- ── 2. Volume et dernière activité par agence ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_agency_activity_summary(agency_ids uuid[], since_days integer DEFAULT 30)
 RETURNS TABLE(agency_id uuid, event_count bigint, last_activity_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT (public.is_super_admin() OR public.is_service_role()) THEN
    RAISE EXCEPTION 'forbidden: super_admin only' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT
    e.agency_id,
    count(*) AS event_count,
    max(e.created_at) AS last_activity_at
  FROM public.activity_events e
  WHERE e.agency_id = ANY(agency_ids)
    AND e.created_at >= now() - make_interval(days => GREATEST(since_days, 0))
  GROUP BY e.agency_id;
END;
$function$;

COMMENT ON FUNCTION public.get_agency_activity_summary(uuid[], integer) IS
  'Volume et dernière activité par agence (super-admin). Garde is_super_admin() OR is_service_role() (42501 sinon) — 20260731190000, bloquant pré-lancement 0.2.';

-- ── 3. Résidu S17 : deux écritures en masse ouvertes à anon ───────────────────────
--
-- `realadvisor_fill_agency_logos()` et `suppress_agency_logo_collisions(real)` sont
-- SECURITY DEFINER et écrivent en masse dans agency_profiles. Elles portaient encore
-- EXECUTE pour anon et authenticated (mesuré : acl = {postgres, anon, authenticated,
-- service_role}) : n'importe quel porteur de la clé publique pouvait déclencher une
-- mutation de masse et son coût CPU. Elles sont apparues APRÈS le lot de révocation du
-- 11.07 (20260711210000), ce qui montre que la note « tout nouveau SECURITY DEFINER porte
-- un REVOKE explicite » n'a pas de garde-fou automatique.
--
-- Seuls appelants : le cron et l'edge de synchronisation RealAdvisor, en service_role.

REVOKE EXECUTE ON FUNCTION public.realadvisor_fill_agency_logos() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.suppress_agency_logo_collisions(real) FROM public, anon, authenticated;
