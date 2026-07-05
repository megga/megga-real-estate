-- Triage des numéros WhatsApp inconnus → leads CRM.
--
-- Aujourd'hui, un message d'un numéro INCONNU (resolve_contact_by_phone = null) est stocké
-- avec contact_id null → INVISIBLE en CRM et jamais compris (whatsapp_stale_insight_contacts
-- exige contact_id IS NOT NULL). Le prospect qui écrit spontanément — le plus chaud du canal
-- — est donc le seul invisible. On crée un CONTACT LEAD minimal à l'inbound pour qu'il
-- devienne visible + entre dans la compréhension/qualif/avis LPD (tout l'aval est déjà branché
-- sur contact_id/agency_id).
--
-- Deux objets :
--  1. Index UNIQUE PARTIEL (agency_id, normalize_phone(phone)) pour les seuls leads issus du
--     canal WhatsApp (source in whatsapp/whatsapp_ai) → idempotence sous concurrence (deux
--     inbound rapprochés = deux invocations webhook concurrentes) SANS impacter les contacts
--     saisis à la main (imports multi-numéros, etc.). 0 doublon legacy vérifié avant création.
--  2. RPC ensure_wa_inbound_lead : insert-or-get ATOMIQUE (ON CONFLICT DO NOTHING sur l'index),
--     avec gestion de l'ambiguïté (≥2 contacts même numéro dans l'agence → ne devine pas).
--     Non exprimable en supabase-js (ON CONFLICT sur index partiel d'expression) → RPC SQL.

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_wa_lead_unique
  ON public.contacts (agency_id, public.normalize_phone(phone))
  WHERE source IN ('whatsapp', 'whatsapp_ai') AND phone IS NOT NULL;

-- Insert-or-get atomique d'un lead entrant WhatsApp. SECURITY DEFINER : appelée par le webhook
-- en service-role ; auth.uid() non utilisé (pas de contexte utilisateur, agence fournie
-- server-side par l'appelant). Retourne le contact (existant ou créé) ou NULL si non créable.
CREATE OR REPLACE FUNCTION public.ensure_wa_inbound_lead(
  p_agency_id  uuid,
  p_phone      text,
  p_first_name text,
  p_last_name  text
)
RETURNS TABLE(contact_id uuid, created boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm  text := public.normalize_phone(p_phone);
  v_count int;
  v_id    uuid;
BEGIN
  -- Numéro invalide (JID de groupe > 15 chiffres → normalize renvoie 9 derniers, on borne en
  -- amont côté appelant ; ici garde de robustesse) ou agence absente → rien.
  IF p_agency_id IS NULL OR v_norm IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, false; RETURN;
  END IF;

  -- Sérialise count→insert pour la même (agence, numéro) → ferme la fenêtre TOCTOU : sans ça,
  -- un contact d'une AUTRE source (ex. 'manual') inséré entre le count et notre INSERT
  -- échapperait à l'index partiel (scopé source whatsapp) et créerait un doublon. Le verrou
  -- transactionnel est relâché en fin d'appel ; il ne sérialise que les inbounds du même numéro.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_agency_id::text || '|' || v_norm, 0));

  -- Déjà un (ou plusieurs) contact de l'agence avec ce numéro ? (min(uuid) n'existe pas en
  -- Postgres → on COMPTE, puis on récupère l'id du gagnant séparément quand il y en a 1.)
  SELECT count(*) INTO v_count
    FROM public.contacts
    WHERE agency_id = p_agency_id AND phone IS NOT NULL
      AND public.normalize_phone(phone) = v_norm;

  IF v_count = 1 THEN
    SELECT id INTO v_id
      FROM public.contacts
      WHERE agency_id = p_agency_id AND phone IS NOT NULL
        AND public.normalize_phone(phone) = v_norm
      LIMIT 1;
    RETURN QUERY SELECT v_id, false; RETURN;           -- exactement 1 → on s'y rattache
  ELSIF v_count > 1 THEN
    RETURN QUERY SELECT NULL::uuid, false; RETURN;      -- ambigu → on ne devine pas (orphelin)
  END IF;

  -- Aucun : créer le lead (idempotent sous concurrence via l'index unique partiel).
  INSERT INTO public.contacts (agency_id, first_name, last_name, phone, source, score, tags)
  VALUES (p_agency_id, p_first_name, p_last_name, p_phone, 'whatsapp', 'cold',
          ARRAY['à_compléter', 'lead_whatsapp_auto'])
  ON CONFLICT (agency_id, public.normalize_phone(phone))
    WHERE source IN ('whatsapp', 'whatsapp_ai') AND phone IS NOT NULL
  DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NOT NULL THEN
    RETURN QUERY SELECT v_id, true; RETURN;             -- créé par nous
  END IF;

  -- Course perdue : un autre inbound concurrent a créé le lead → on récupère le gagnant.
  SELECT id INTO v_id FROM public.contacts
    WHERE agency_id = p_agency_id AND phone IS NOT NULL
      AND public.normalize_phone(phone) = v_norm
    ORDER BY created_at ASC LIMIT 1;
  RETURN QUERY SELECT v_id, false;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_wa_inbound_lead(uuid, text, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_wa_inbound_lead(uuid, text, text, text) TO service_role;

COMMIT;
