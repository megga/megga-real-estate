-- ============================================================================
-- Back-link WhatsApp — rattachement des orphelins « agence inconnue »
-- ============================================================================
-- Suite de 20260617091000 (instrumentation PR2). Le trigger de back-link posé
-- là-bas rattachait un message ENTRANT orphelin (contact_id IS NULL) à un contact
-- qui gagne/maj un téléphone — MAIS uniquement via `m.agency_id = NEW.agency_id`.
--
-- Trou : un entrant dont l'AGENCE elle-même n'a pas pu être déterminée à la
-- réception est stocké avec agency_id NULL (numéro inconnu + wa_to non résolu par
-- le registre agency_wa_numbers ; média-seul / body vide = bruit ; ou legacy
-- pré-triage). Pour ces lignes, `agency_id = NEW.agency_id` vaut `NULL = <uuid>`
-- = NULL = faux → JAMAIS rattachées, MÊME après création de la fiche. Elles
-- restent invisibles à l'agent (la policy whatsapp_messages_agency_select exige
-- agency_id = get_my_agency_id()) et absentes de la timeline. Le back-link ne
-- soignait donc QUE la classe « agence connue, contact ambigu », pas « agence
-- inconnue » — la plus fréquente pour un prospect spontané.
--
-- Fix (3 pièces) :
--   1. Helper PARTAGÉ backlink_whatsapp_orphans_for_contact(contact_id) — SOURCE
--      UNIQUE de la logique de rattachement, appelé par le trigger ET par la passe
--      de réparation (élimine tout risque de divergence copier-coller entre deux
--      SQL rédigés séparément, sur un chemin qui porte l'isolation multi-tenant).
--   2. Trigger (fonction inchangée de nom) réduit à un wrapper : PERFORM helper(NEW.id).
--      Il couvre désormais AUSSI les orphelins agency_id IS NULL, sous garde
--      d'unicité GLOBALE (le numéro normalisé désigne UN SEUL contact toutes agences
--      confondues → aucune ambiguïté cross-tenant), et POSE agency_id = <agence du
--      contact> dans le même geste (sinon un contact_id lié + agency_id NULL
--      resterait invisible sous RLS *et* irréparable — contact_id n'étant plus NULL).
--      La branche « agence connue » (m.agency_id = agence, garde par agence) est
--      conservée à l'identique.
--   3. Passe de RÉPARATION : boucle sur les contacts ayant un orphelin correspondant
--      et appelle le MÊME helper → rattache l'existant sans réécrire la logique.
--
-- Sécurité multi-tenant : la branche agency_id NULL n'attribue QUE si le numéro est
-- globalement unique à un seul contact. Deux agences partageant un client (même
-- numéro dans deux fiches) → on ne devine pas (orphelin laissé, honnête). Sémantique
-- assumée « premier détenteur légitime au moment du lien » : si le numéro est
-- globalement unique quand une fiche est créée, l'orphelin lui est rattaché ; une
-- SECONDE agence réutilisant le numéro plus tard ne dé-attribue PAS rétroactivement
-- le message déjà lié (l'orphelin va toujours à une fiche réelle de ce numéro, jamais
-- à un tenant qui n'en a aucune) — exactement la sémantique de resolve_contact_by_phone
-- à la réception. Aucun verrou de sérialisation n'est requis : sous READ COMMITTED,
-- l'UPDATE re-teste contact_id IS NULL à l'exécution → jamais de double rattachement.
--
-- nLPD : whatsapp_messages.contact_id/agency_id sont ON DELETE SET NULL. Effacer un
-- contact (droit à l'oubli) redétache ses messages ; un nouveau contact réutilisant
-- le même numéro ré-aspirera l'historique (accepté v1 = même personne physique =
-- même numéro ; à durcir si recyclage de numéro constaté — cf. note 20260617091000).
--
-- Invariants : SECURITY DEFINER + search_path, idempotent, 0 PII nouvelle (une FK +
-- un agency_id dérivés de données déjà en base). Pas de nouvel index : le lookup des
-- orphelins agency_id NULL par numéro normalisé est servi par idx_wa_messages_agency_
-- normphone (agency_id, normalize_phone(wa_from)) WHERE contact_id IS NULL — la
-- condition agency_id IS NULL est un scan sargable sur la colonne de tête (btree).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Helper partagé : rattache les orphelins entrants d'UN contact (les 2 classes).
--    Retourne le nombre de messages rattachés. Réutilisé par le trigger ET la passe.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.backlink_whatsapp_orphans_for_contact(p_contact_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_phone      text;
  v_agency     uuid;
  v_norm       text;
  v_agency_cnt integer;   -- contacts de l'agence du contact portant ce numéro (garde « agence connue »)
  v_global_cnt integer;   -- contacts TOUTES agences portant ce numéro (garde « agence inconnue »)
  v_linked     integer := 0;
BEGIN
  SELECT phone, agency_id INTO v_phone, v_agency FROM contacts WHERE id = p_contact_id;
  IF v_phone IS NULL THEN RETURN 0; END IF;
  v_norm := normalize_phone(v_phone);
  IF v_norm IS NULL THEN RETURN 0; END IF;

  SELECT count(*) INTO v_agency_cnt
    FROM contacts c2
   WHERE c2.agency_id = v_agency AND c2.phone IS NOT NULL
     AND normalize_phone(c2.phone) = v_norm;

  SELECT count(*) INTO v_global_cnt
    FROM contacts c3
   WHERE c3.phone IS NOT NULL
     AND normalize_phone(c3.phone) = v_norm;

  -- Un seul UPDATE, deux branches disjointes (m.agency_id non-null vs NULL) :
  --   • « agence connue »   : m.agency_id = v_agency ET le contact est unique dans SON agence.
  --   • « agence inconnue »  : m.agency_id IS NULL ET contact globalement unique ET agence connue
  --                            (sinon on lierait contact_id en laissant agency_id NULL = message
  --                            lié mais invisible, irréparable).
  -- COALESCE : la branche connue préserve m.agency_id (déjà = v_agency) ; la branche inconnue
  -- le POSE à v_agency → le message devient visible sous RLS.
  UPDATE public.whatsapp_messages m
     SET contact_id = p_contact_id,
         agency_id  = COALESCE(m.agency_id, v_agency)
   WHERE m.contact_id IS NULL
     AND m.direction = 'inbound'                                        -- wa_from = expéditeur : ne vaut que pour l'ENTRANT
     AND length(regexp_replace(m.wa_from, '\D', '', 'g')) <= 15         -- exclut les JID de groupe
     AND normalize_phone(m.wa_from) = v_norm
     AND NOT EXISTS (                                                    -- exclut les numéros AGENTS
       SELECT 1 FROM whatsapp_agent_links l
       WHERE l.verified AND normalize_phone(l.wa_number) = normalize_phone(m.wa_from))
     AND (
           (m.agency_id = v_agency AND v_agency_cnt = 1)
        OR (m.agency_id IS NULL AND v_agency IS NOT NULL AND v_global_cnt = 1)
     );
  GET DIAGNOSTICS v_linked = ROW_COUNT;

  -- Le back-link est un UPDATE (≠ INSERT) → il ne déclenche PAS le bump d'interaction
  -- (trg_contact_last_interaction_wa, AFTER INSERT). On rafraîchit donc la recency ici,
  -- depuis les messages désormais liés, quand on vient d'en rattacher.
  IF v_linked > 0 THEN
    UPDATE public.contacts c
       SET last_interaction_at = GREATEST(
             COALESCE(c.last_interaction_at, '-infinity'::timestamptz),
             (SELECT max(COALESCE(m.wa_timestamp, m.created_at))
                FROM whatsapp_messages m WHERE m.contact_id = p_contact_id))
     WHERE c.id = p_contact_id;
  END IF;

  RETURN v_linked;
END;
$function$;

REVOKE ALL ON FUNCTION public.backlink_whatsapp_orphans_for_contact(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backlink_whatsapp_orphans_for_contact(uuid) TO service_role;

-- ----------------------------------------------------------------------------
-- 2. Trigger : wrapper mince sur le helper (fonction de même nom qu'en 20260617091000).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.backlink_whatsapp_on_contact()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM public.backlink_whatsapp_orphans_for_contact(NEW.id);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_backlink_whatsapp ON public.contacts;
CREATE TRIGGER trg_backlink_whatsapp
  AFTER INSERT OR UPDATE OF phone ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.backlink_whatsapp_on_contact();

-- ----------------------------------------------------------------------------
-- 3. Passe de réparation : orphelins déjà en base → fiche existante, via le MÊME
--    helper (parité garantie avec le trigger). Boucle bornée aux seuls contacts
--    ayant un orphelin entrant correspondant (le helper applique toutes les gardes).
--    Table petite en pré-pilote → pas de lot / CONCURRENTLY. Idempotent.
-- ----------------------------------------------------------------------------
DO $do$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.id
      FROM public.contacts c
     WHERE c.phone IS NOT NULL
       AND c.agency_id IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM public.whatsapp_messages m
          WHERE m.contact_id IS NULL
            AND m.direction = 'inbound'
            AND public.normalize_phone(m.wa_from) = public.normalize_phone(c.phone))
  LOOP
    PERFORM public.backlink_whatsapp_orphans_for_contact(r.id);
  END LOOP;
END
$do$;

COMMIT;
