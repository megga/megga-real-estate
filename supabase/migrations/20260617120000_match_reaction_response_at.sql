-- ============================================================================
-- Instrumentation comportementale — producteur de statut de RÉACTION de match
-- ============================================================================
-- Suite du socle (#659 / #660). Vague 1 : les statuts de réaction
-- ('interested', 'visit_planned', 'rejected') sont DÉJÀ autorisés par la
-- contrainte matches_status_check et présents dans le type MatchStatus, mais
-- AUCUN write-path ne les produit → matches.response_at reste NULL partout
-- (2679 lignes, 100 % 'suggested') et le consommateur automation-engine
-- (relance « envoyé sans réponse J+3 », .eq('status','sent').is('response_at',
-- null)) reste affamé. C'est le chaînon manquant de la couche comportementale.
--
-- Ce que pose cette migration (PLOMBERIE, pas un algo) :
--   1. set_match_response_at — BEFORE UPDATE OF status : stampe response_at au
--      1er passage vers un statut de réaction (path-independent, source unique :
--      web, edge WhatsApp, futur producteur IA → tous capturés sans les répéter).
--   2. log_match_reaction — AFTER UPDATE OF status : trace activity_events
--      'match_reaction' (HITL : qui a marqué quoi), attribution user/ai/system
--      via le même pattern GUC que capture_transaction_lifecycle (#659).
--
-- Invariants (identiques au socle) : SECURITY DEFINER, SET search_path, gardes
-- IS DISTINCT / IF NULL (idempotent + response_at immuable : la 1re réaction
-- gagne), agency_id de la ligne, append-only activity_events, 0 PII nouvelle
-- (un état déjà au schéma + un timestamp). HITL : c'est l'AGENT qui marque la
-- réaction du client — aucune IA ne décide 'rejected' de façon autonome (v1 web
-- agent ; un futur marquage WhatsApp passera par une RPC posant le GUC 'ai').
--
-- Pas de backfill : la réaction n'est pas reconstituable (aucun historique).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. matches.response_at — stampé au 1er passage vers un statut de réaction
-- ----------------------------------------------------------------------------
-- BEFORE pour poser NEW.response_at sans re-UPDATE (cf. set_property_published_at,
-- set_visit_completed_at). Immuable : la garde IS NULL fige la 1re réaction
-- (un changement ultérieur de statut ne ré-écrase pas la date). 'ignored' est
-- EXCLU : c'est un écart agent (dossier écarté), pas une réponse client. 'sent'
-- est posé par les chemins d'envoi existants (useMatching/atelier/edge), pas ici.
CREATE OR REPLACE FUNCTION public.set_match_response_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.status IN ('interested', 'visit_planned', 'rejected')
     AND NEW.response_at IS NULL THEN
    NEW.response_at := now();
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_match_response_at ON public.matches;
CREATE TRIGGER trg_match_response_at
  BEFORE UPDATE OF status ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.set_match_response_at();

-- ----------------------------------------------------------------------------
-- 2. activity_events 'match_reaction' — trace HITL de la réaction
-- ----------------------------------------------------------------------------
-- Attribution : pattern GUC transaction-local de capture_transaction_lifecycle
-- (#659). Web agent (JWT) → 'user' + actor_id ; un futur marquage WhatsApp via
-- RPC posant app.actor_kind='ai' → 'ai' + actor_id NULL ; service-role sans uid
-- → 'system'. Cohérence activity_events_actor_kind_coherence respectée
-- (actor_id non-NULL uniquement pour 'user'). Catégorie 'deal' (la réaction fait
-- avancer la relation). entity = le contact (entity_id = contact_id).
--
-- NB : 'match_reaction' n'est PAS dans l'allowlist du trigger
-- bump_contact_last_interaction (#659) → ne rafraîchit pas la recency
-- (lead-cooling) : un marquage agent peut être différé, on ne corrompt pas la
-- dormance. La réactivité se mesurera sur response_at, pas sur la recency.
CREATE OR REPLACE FUNCTION public.log_match_reaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_guc_kind text := NULLIF(current_setting('app.actor_kind', true), '');
  v_via      text := NULLIF(current_setting('app.actor_via', true), '');
  v_profile  text := NULLIF(current_setting('app.actor_profile_id', true), '');
  v_uid      uuid := auth.uid();
  v_kind     text;
  v_actor    uuid;
  v_meta     jsonb;
BEGIN
  v_kind := CASE
    WHEN v_guc_kind IN ('ai', 'system', 'user') THEN v_guc_kind
    WHEN v_uid IS NULL THEN 'system'
    ELSE 'user'
  END;
  v_actor := CASE WHEN v_kind = 'user' THEN v_uid ELSE NULL END;

  v_meta := jsonb_build_object(
    'match_id', NEW.id, 'old_status', OLD.status, 'new_status', NEW.status, 'contact_id', NEW.contact_id);
  IF v_via IS NOT NULL THEN v_meta := v_meta || jsonb_build_object('via', v_via); END IF;
  IF v_profile IS NOT NULL THEN v_meta := v_meta || jsonb_build_object('profile_id', v_profile); END IF;

  INSERT INTO activity_events
    (agency_id, actor_id, actor_kind, action, entity_type, entity_id, object_label, category, severity, metadata)
  VALUES
    (NEW.agency_id, v_actor, v_kind, 'match_reaction', 'contact', NEW.contact_id,
     OLD.status::text || ' → ' || NEW.status::text, 'deal', 'info', v_meta);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_match_reaction_audit ON public.matches;
CREATE TRIGGER trg_match_reaction_audit
  AFTER UPDATE OF status ON public.matches
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status
        AND NEW.status IN ('interested', 'visit_planned', 'rejected'))
  EXECUTE FUNCTION public.log_match_reaction();
