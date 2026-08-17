-- Deux correctifs de revue sur la vérification par code envoyé.
--
-- 1. L'agence était DÉRIVÉE DU LIEN plutôt que du profil, donc figée sur sa valeur
--    périmée. 2. La confirmation ne rattrapait pas la course sur le numéro : un
--    `unique_violation` sortait en exception brute là où toute la fonction rend un verdict.

BEGIN;

-- ── 1. L'agence vient du PROFIL, pas du lien ────────────────────────────────
--
-- ⚠ L'ordre du `coalesce` était inversé : `coalesce(v_link.agency_id, <profil>)` ne
-- retombait sur le profil que si le lien n'avait AUCUNE agence — c'est-à-dire jamais, une
-- fois la ligne créée. Le lien conservait donc l'agence qu'il portait au premier
-- appairage, indéfiniment.
--
-- Ce n'est pas théorique : mesuré en production le 17.08.2026, le seul agent apparié porte
-- `whatsapp_agent_links.agency_id = ebec0ad9` (megga-ge-3) alors que son
-- `profiles.agency_id` vaut `18f9003d` (megga-agence). Il a changé d'agence, son lien non.
--
-- `generate_whatsapp_pairing_code` fait déjà le bon geste depuis mai (`get_my_agency_id()`
-- ré-évalué à chaque appel) ; cette RPC-ci s'en écartait. L'agence gouverne l'audit de
-- l'envoi, le rangement de `whatsapp_messages` et le `p_agency_id` que la garde de
-- consentement utilise pour décider quels motifs de refus sont visibles : la figer sur une
-- valeur périmée, c'est ranger l'envoi sous le mauvais tenant.
--
-- ⛔ `get_my_agency_id()` n'est PAS utilisable ici : cette RPC tourne en service_role
-- (appelée par la fonction edge après vérification du JWT), donc `auth.uid()` y est NULL.
-- On lit le profil explicitement, par le `p_profile_id` que l'edge a dérivé du jeton.
CREATE OR REPLACE FUNCTION public.start_whatsapp_number_verification(
  p_profile_id uuid,
  p_number     text
)
RETURNS TABLE (ok boolean, reason text, code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_digits text := regexp_replace(coalesce(p_number, ''), '\D', '', 'g');
  v_norm   text;
  v_code   text;
  v_link   public.whatsapp_agent_links%rowtype;
  v_agency uuid;
BEGIN
  IF p_profile_id IS NULL THEN
    RETURN QUERY SELECT false, 'no_profile', NULL::text; RETURN;
  END IF;

  IF length(v_digits) < 6 OR length(v_digits) > 15 THEN
    RETURN QUERY SELECT false, 'invalid_phone', NULL::text; RETURN;
  END IF;
  v_norm := public.normalize_phone(v_digits);
  IF v_norm IS NULL THEN
    RETURN QUERY SELECT false, 'invalid_phone', NULL::text; RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.whatsapp_agent_links l
     WHERE l.verified
       AND public.normalize_phone(l.wa_number) = v_norm
       AND l.profile_id <> p_profile_id
  ) THEN
    RETURN QUERY SELECT false, 'number_taken', NULL::text; RETURN;
  END IF;

  -- FOR UPDATE : sérialise la lecture du compteur et son écriture plus bas. Sans lui, deux
  -- onglets (ou un double-clic) lisaient tous deux `otp_sent_count = 2`, passaient tous
  -- deux le test, et envoyaient deux messages — le second écrasant au passage l'`otp_hash`
  -- du premier, si bien que le code reçu en premier devenait faux sans que rien ne le dise.
  SELECT * INTO v_link FROM public.whatsapp_agent_links
   WHERE profile_id = p_profile_id FOR UPDATE;

  IF v_link.profile_id IS NOT NULL
     AND v_link.otp_window_started_at IS NOT NULL
     AND v_link.otp_window_started_at > now() - interval '1 hour'
     AND coalesce(v_link.otp_sent_count, 0) >= 3
  THEN
    RETURN QUERY SELECT false, 'rate_limited', NULL::text; RETURN;
  END IF;

  v_code := lpad(
    ((hashtextextended(gen_random_uuid()::text, 0) % 1000000 + 1000000) % 1000000)::text,
    6, '0'
  );
  -- Le PROFIL d'abord. Le lien ne sert plus que de repli, pour le cas — théorique — d'un
  -- profil sans agence dont le lien en porterait une.
  v_agency := coalesce((SELECT agency_id FROM public.profiles WHERE id = p_profile_id), v_link.agency_id);

  INSERT INTO public.whatsapp_agent_links AS l (
    profile_id, agency_id, pending_number, otp_hash, otp_expires_at,
    otp_attempts, otp_sent_count, otp_window_started_at, verified
  )
  VALUES (
    p_profile_id, v_agency, v_digits,
    encode(extensions.digest(v_code || p_profile_id::text, 'sha256'), 'hex'),
    now() + interval '10 minutes', 0, 1, now(), false
  )
  ON CONFLICT (profile_id) DO UPDATE
    SET pending_number = EXCLUDED.pending_number,
        otp_hash       = EXCLUDED.otp_hash,
        otp_expires_at = EXCLUDED.otp_expires_at,
        otp_attempts   = 0,
        agency_id      = EXCLUDED.agency_id,
        otp_sent_count = CASE
          WHEN l.otp_window_started_at IS NULL OR l.otp_window_started_at <= now() - interval '1 hour'
          THEN 1 ELSE coalesce(l.otp_sent_count, 0) + 1 END,
        otp_window_started_at = CASE
          WHEN l.otp_window_started_at IS NULL OR l.otp_window_started_at <= now() - interval '1 hour'
          THEN now() ELSE l.otp_window_started_at END,
        verified  = l.verified,
        wa_number = l.wa_number;

  RETURN QUERY SELECT true, 'ok', v_code;
END;
$$;

REVOKE ALL ON FUNCTION public.start_whatsapp_number_verification(uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_whatsapp_number_verification(uuid, text) TO service_role;
ALTER FUNCTION public.start_whatsapp_number_verification(uuid, text) OWNER TO postgres;

-- ── 2. La confirmation rattrape la course sur le numéro ─────────────────────
--
-- Dix minutes séparent le démarrage de la confirmation, et `number_taken` n'était vérifié
-- qu'au démarrage. Si un AUTRE agent apparie le même numéro entre-temps (le webhook le
-- peut à tout instant), l'UPDATE final violait `idx_wa_agent_links_verified_number` —
-- index UNIQUE partiel sur `wa_number WHERE verified`. L'exception sortait telle quelle :
-- PostgREST rendait une erreur brute là où toute la fonction rend un `(ok, reason)`, et
-- l'écran retombait sur son libellé générique au lieu de dire que le numéro a été pris.
--
-- Deux gestes, et les deux sont nécessaires : le pré-contrôle donne le bon motif dans le
-- cas courant, le bloc d'exception ferme la fenêtre qui reste entre ce contrôle et
-- l'écriture. Un pré-contrôle seul serait un TOCTOU de plus.
CREATE OR REPLACE FUNCTION public.confirm_whatsapp_number_verification(p_code text)
RETURNS TABLE (ok boolean, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link public.whatsapp_agent_links%rowtype;
  v_hash text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN QUERY SELECT false, 'not_authenticated'; RETURN;
  END IF;

  SELECT * INTO v_link FROM public.whatsapp_agent_links
   WHERE profile_id = auth.uid() FOR UPDATE;

  IF v_link.profile_id IS NULL OR v_link.otp_hash IS NULL THEN
    RETURN QUERY SELECT false, 'no_pending'; RETURN;
  END IF;
  IF v_link.otp_expires_at IS NULL OR v_link.otp_expires_at <= now() THEN
    RETURN QUERY SELECT false, 'expired'; RETURN;
  END IF;
  IF coalesce(v_link.otp_attempts, 0) >= 5 THEN
    RETURN QUERY SELECT false, 'too_many_attempts'; RETURN;
  END IF;

  v_hash := encode(extensions.digest(coalesce(p_code, '') || auth.uid()::text, 'sha256'), 'hex');

  IF v_hash IS DISTINCT FROM v_link.otp_hash THEN
    UPDATE public.whatsapp_agent_links
       SET otp_attempts = coalesce(otp_attempts, 0) + 1
     WHERE profile_id = auth.uid();
    RETURN QUERY SELECT false, 'wrong_code'; RETURN;
  END IF;

  -- Le code est BON. Reste à savoir si le numéro l'est encore.
  IF EXISTS (
    SELECT 1 FROM public.whatsapp_agent_links l
     WHERE l.verified
       AND public.normalize_phone(l.wa_number) = public.normalize_phone(v_link.pending_number)
       AND l.profile_id <> auth.uid()
  ) THEN
    RETURN QUERY SELECT false, 'number_taken'; RETURN;
  END IF;

  BEGIN
    UPDATE public.whatsapp_agent_links
       SET wa_number = pending_number,
           verified = true,
           verified_at = now(),
           pending_number = NULL,
           otp_hash = NULL,
           otp_expires_at = NULL,
           otp_attempts = 0,
           pairing_code = NULL,
           pairing_expires_at = NULL
     WHERE profile_id = auth.uid();
  EXCEPTION WHEN unique_violation THEN
    -- La fenêtre entre le contrôle ci-dessus et cette écriture. Rare, mais elle rend un
    -- VERDICT — c'est le contrat de cette fonction, et l'écran sait déjà l'afficher.
    RETURN QUERY SELECT false, 'number_taken'; RETURN;
  END;

  RETURN QUERY SELECT true, 'ok';
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_whatsapp_number_verification(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.confirm_whatsapp_number_verification(text) TO authenticated;
ALTER FUNCTION public.confirm_whatsapp_number_verification(text) OWNER TO postgres;

COMMIT;
