-- ============================================================================
-- Instrumentation comportementale — PR2 : liaison + contextuel
-- ============================================================================
-- Suite de PR1 (20260617090000). Trois pièces :
--   1. Back-link whatsapp_messages.contact_id (5/126 liés en prod) — réutilise la
--      fonction EXISTANTE normalize_phone(p)=RIGHT(digits,9) (+ son index sur
--      contacts) ; trigger qui rétro-lie quand un contact gagne/maj un téléphone,
--      RPC resolve_contact_by_phone pour l'insert webhook, backfill ponctuel.
--   2. create_lead_with_optional_deal +p_property_id (rattachement deal↔bien).
--   3. (côté edge, hors migration) sent_at au vrai envoi send_listings.
-- Invariants : SECURITY DEFINER + search_path, append-only, idempotent, scoped
-- agence, 0 PII nouvelle (juste une FK + un timestamp dérivés de données déjà là).
-- Gardes anti-mé-attribution : EXACTEMENT 1 contact par numéro normalisé dans
-- l'agence, exclusion des numéros AGENTS (whatsapp_agent_links) et des JID de
-- GROUPE (>15 chiffres → pas un numéro E.164).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 2.1a  resolve_contact_by_phone — résolution robuste numéro → contact pour
--       l'insert webhook (remplace le ilike '%'+slice(-9) bancal sur le format
--       brut). N'identifie QUE si le numéro normalisé désigne UN SEUL contact
--       (toutes agences), sinon NULL (ambigu → message laissé orphelin, honnête).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_contact_by_phone(p_phone text)
RETURNS TABLE (id uuid, agency_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_norm text := normalize_phone(p_phone);
BEGIN
  -- numéro vide / JID de groupe (>15 chiffres) → pas de résolution
  IF v_norm IS NULL OR length(regexp_replace(coalesce(p_phone,''), '\D', '', 'g')) > 15 THEN
    RETURN;
  END IF;
  -- exactement 1 contact avec ce numéro normalisé → on le renvoie ; sinon rien
  IF (SELECT count(*) FROM contacts c WHERE c.phone IS NOT NULL AND normalize_phone(c.phone) = v_norm) = 1 THEN
    RETURN QUERY
      SELECT c.id, c.agency_id FROM contacts c
      WHERE c.phone IS NOT NULL AND normalize_phone(c.phone) = v_norm
      LIMIT 1;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.resolve_contact_by_phone(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_contact_by_phone(text) TO service_role;

-- ----------------------------------------------------------------------------
-- 2.1b  Index fonctionnel pour le back-link / backfill (lookup des orphelins
--       par numéro normalisé, scoped agence). normalize_phone est IMMUTABLE.
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_wa_messages_agency_normphone
  ON public.whatsapp_messages (agency_id, normalize_phone(wa_from))
  WHERE contact_id IS NULL;

-- resolve_contact_by_phone cherche par numéro normalisé SANS agence (pour le test
-- d'unicité globale) à CHAQUE webhook entrant → index dédié (l'index agence-first
-- existant ne couvre pas ce lookup). Tiny aujourd'hui, mais sur le chemin chaud.
CREATE INDEX IF NOT EXISTS idx_contacts_normphone
  ON public.contacts (normalize_phone(phone))
  WHERE phone IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 2.1c  Trigger : quand un contact gagne/maj un téléphone, rétro-lier ses
--       messages WhatsApp ENTRANTS orphelins (+ rafraîchir sa recency).
-- nLPD : whatsapp_messages.contact_id est ON DELETE SET NULL. Effacer un contact
-- (droit à l'oubli) détache ses messages ; si un NOUVEAU contact réutilise le même
-- numéro, ce trigger ré-aspirera l'historique. Accepté en v1 (même personne
-- physique = même numéro) ; à durcir si un cas de recyclage de numéro se présente.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.backlink_whatsapp_on_contact()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_norm text;
BEGIN
  IF NEW.phone IS NULL THEN RETURN NEW; END IF;
  v_norm := normalize_phone(NEW.phone);
  IF v_norm IS NULL THEN RETURN NEW; END IF;

  -- Garde unicité : ne rétro-lier QUE si NEW est le SEUL contact de son agence
  -- avec ce numéro normalisé (sinon mé-attribution entre homonymes de numéro).
  IF (SELECT count(*) FROM contacts c2
        WHERE c2.agency_id = NEW.agency_id AND c2.phone IS NOT NULL
          AND normalize_phone(c2.phone) = v_norm) <> 1 THEN
    RETURN NEW;
  END IF;

  UPDATE public.whatsapp_messages m
     SET contact_id = NEW.id
   WHERE m.contact_id IS NULL
     AND m.direction = 'inbound'                                         -- wa_from = expéditeur : ne vaut que pour l'ENTRANT (un sortant a wa_from = numéro MEGGA, pas le client)
     AND m.agency_id = NEW.agency_id
     AND length(regexp_replace(m.wa_from, '\D', '', 'g')) <= 15          -- exclut les JID de groupe
     AND normalize_phone(m.wa_from) = v_norm
     AND NOT EXISTS (                                                     -- exclut les numéros AGENTS
       SELECT 1 FROM whatsapp_agent_links l
       WHERE l.verified AND normalize_phone(l.wa_number) = normalize_phone(m.wa_from));

  -- Le back-link est un UPDATE (≠ INSERT) → il ne déclenche PAS le bump PR1
  -- (AFTER INSERT). On rafraîchit donc la recency ici, depuis les messages désormais liés.
  UPDATE public.contacts c
     SET last_interaction_at = GREATEST(
           COALESCE(c.last_interaction_at, '-infinity'::timestamptz),
           (SELECT max(COALESCE(m.wa_timestamp, m.created_at))
              FROM whatsapp_messages m WHERE m.contact_id = NEW.id))
   WHERE c.id = NEW.id
     AND EXISTS (SELECT 1 FROM whatsapp_messages m WHERE m.contact_id = NEW.id);

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_backlink_whatsapp ON public.contacts;
CREATE TRIGGER trg_backlink_whatsapp
  AFTER INSERT OR UPDATE OF phone ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.backlink_whatsapp_on_contact();

-- ----------------------------------------------------------------------------
-- 2.1d  Backfill : rattacher les orphelins existants (même garde unicité +
--       exclusions), puis re-rafraîchir la recency depuis tous les messages liés.
-- ----------------------------------------------------------------------------
UPDATE public.whatsapp_messages m
   SET contact_id = c.id
  FROM public.contacts c
 WHERE m.contact_id IS NULL
   AND m.direction = 'inbound'                         -- back-link par wa_from = entrant uniquement (cf. trigger)
   AND c.phone IS NOT NULL
   AND m.agency_id = c.agency_id
   AND length(regexp_replace(m.wa_from, '\D', '', 'g')) <= 15
   AND normalize_phone(m.wa_from) = normalize_phone(c.phone)
   AND NOT EXISTS (
     SELECT 1 FROM whatsapp_agent_links l
     WHERE l.verified AND normalize_phone(l.wa_number) = normalize_phone(m.wa_from))
   AND (SELECT count(*) FROM contacts c2
          WHERE c2.agency_id = m.agency_id AND c2.phone IS NOT NULL
            AND normalize_phone(c2.phone) = normalize_phone(m.wa_from)) = 1;

UPDATE public.contacts c
   SET last_interaction_at = GREATEST(COALESCE(c.last_interaction_at, '-infinity'::timestamptz), s.maxts)
  FROM (SELECT contact_id, max(COALESCE(wa_timestamp, created_at)) AS maxts
          FROM whatsapp_messages WHERE contact_id IS NOT NULL GROUP BY contact_id) s
 WHERE c.id = s.contact_id
   AND (c.last_interaction_at IS NULL OR c.last_interaction_at < s.maxts);

-- ----------------------------------------------------------------------------
-- 2.2  create_lead_with_optional_deal + p_property_id (rattachement deal↔bien).
--      DROP de la signature 16-args AVANT recreate (sinon CREATE OR REPLACE
--      crée une SURCHARGE 16+17 args → ambiguïté PostgREST PGRST203). SECURITY
--      INVOKER conservé (pas DEFINER). GRANT par défaut = PUBLIC EXECUTE (idem
--      avant). p_property_id ajouté EN FIN de signature (non-breaking pour
--      l'appelant useImportLead qui appelle par noms sans ce param).
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_lead_with_optional_deal(
  text, text, text, text, text, text, text, text[], text, numeric, text[], text, boolean, text, text, text);

CREATE OR REPLACE FUNCTION public.create_lead_with_optional_deal(
  p_first_name text,
  p_last_name text,
  p_email text DEFAULT NULL::text,
  p_phone text DEFAULT NULL::text,
  p_type text DEFAULT 'buyer'::text,
  p_source text DEFAULT 'import'::text,
  p_score text DEFAULT 'warm'::text,
  p_tags text[] DEFAULT '{}'::text[],
  p_notes text DEFAULT NULL::text,
  p_budget_announced numeric DEFAULT NULL::numeric,
  p_search_zones text[] DEFAULT '{}'::text[],
  p_import_raw_text text DEFAULT NULL::text,
  p_create_deal boolean DEFAULT false,
  p_deal_stage text DEFAULT 'new_lead'::text,
  p_deal_notes text DEFAULT NULL::text,
  p_deal_role text DEFAULT 'buyer'::text,
  p_property_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_agency_id UUID := get_user_agency_id();
  v_user_id   UUID := auth.uid();
  v_contact_id UUID;
  v_deal_id    UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  IF p_first_name IS NULL OR p_last_name IS NULL THEN
    RAISE EXCEPTION 'first_name_and_last_name_required' USING ERRCODE = '23502';
  END IF;

  -- NB : budget_announced / search_zones NE SONT PAS des colonnes de contacts
  -- (ni en prod ni dans les migrations — le budget vit dans les notes / client_searches).
  -- La fonction baseline les insérait à tort → 42703 latent à CHAQUE appel (corrigé ici).
  -- Les params p_budget_announced / p_search_zones restent acceptés pour la compat de
  -- signature avec useImportLead (le budget est déjà repris dans p_notes côté appelant).
  INSERT INTO contacts (
    agency_id, user_id,
    first_name, last_name, email, phone,
    type, source, score, tags, notes,
    import_raw_text, import_raw_text_received_at
  )
  VALUES (
    v_agency_id, v_user_id,
    p_first_name, p_last_name, NULLIF(p_email, ''), NULLIF(p_phone, ''),
    p_type, p_source, p_score, p_tags, p_notes,
    NULLIF(p_import_raw_text, ''),
    CASE WHEN p_import_raw_text IS NOT NULL AND p_import_raw_text <> '' THEN NOW() ELSE NULL END
  )
  RETURNING id INTO v_contact_id;

  IF p_create_deal AND v_agency_id IS NOT NULL THEN
    INSERT INTO transactions (
      agency_id,
      contact_buyer_id, contact_seller_id,
      property_id,
      stage, status, notes
    )
    VALUES (
      v_agency_id,
      CASE WHEN p_deal_role = 'seller' THEN NULL ELSE v_contact_id END,
      CASE WHEN p_deal_role = 'seller' THEN v_contact_id ELSE NULL END,
      p_property_id,
      p_deal_stage::transaction_stage,
      'active',
      p_deal_notes
    )
    RETURNING id INTO v_deal_id;
  END IF;

  RETURN jsonb_build_object(
    'contact_id', v_contact_id,
    'deal_id', v_deal_id
  );
END;
$function$;
