-- Vérification d'un numéro par code ENVOYÉ (l'agent saisit son numéro, MEGGA lui écrit).
--
-- Complète l'appairage historique, qui va dans l'autre sens (MEGGA affiche un code, l'agent
-- l'envoie depuis son WhatsApp). Les deux coexistent, et c'est délibéré : l'appairage prouve
-- DAVANTAGE — que la personne pilote ce compte WhatsApp — là où un code reçu prouve seulement
-- qu'elle lit ce numéro. L'appairage reste donc le chemin par défaut ; celui-ci existe pour
-- l'agent qui préfère saisir son numéro, et il est INERTE tant qu'aucun template Meta n'est
-- configuré (cf. `whatsapp-templates.ts`).
--
-- ⛔ LE MUR QUI A DICTÉ CETTE FORME. `whatsapp_send_allowed` refuse `agent_link_unverified`
-- dès qu'on lui passe un profil sans lien vérifié SUR CE NUMÉRO, et sans profil le numéro
-- retombe en sujet inconnu, refusé faute de fenêtre 24 h. Autrement dit la garde interdit
-- exactement le message qu'une vérification doit envoyer — par conception, elle échoue
-- FERMÉ. On ne la contourne pas : on lui ajoute une finalité, et on la BORNE à un fait
-- qu'elle vérifie elle-même — il existe, pour CE numéro, une vérification en cours que
-- l'agent a lui-même demandée depuis son compte, non expirée. Hors de cette fenêtre, la
-- finalité ne donne aucun droit.
--
-- Ce qui n'est PAS assoupli : la suppression par numéro (étape 3) continue de s'appliquer.
-- Quelqu'un qui a écrit STOP ne reçoit pas de code sous prétexte qu'un agent a saisi son
-- numéro — c'est même le scénario d'abus le plus évident de ce parcours.

BEGIN;

-- ── 1. État de la vérification, porté par le lien lui-même ───────────────────
-- Sur `whatsapp_agent_links` et non dans une table à part : la contrainte utile est
-- « UNE vérification en cours par agent », et elle est déjà exprimée par l'unicité de
-- profile_id. Une table séparée l'aurait laissée à écrire.
ALTER TABLE public.whatsapp_agent_links
  -- Le numéro REVENDIQUÉ, pas encore prouvé. Il ne devient `wa_number` qu'à la confirmation.
  ADD COLUMN IF NOT EXISTS pending_number         text        NULL,
  -- ⛔ Le HASH, jamais le code. La RLS de cette table laisse l'agent LIRE sa ligne : y
  -- stocker le code en clair lui permettrait de le lire au lieu de le recevoir, et la
  -- vérification ne prouverait plus rien du tout. Le sel est le profile_id — deux agents
  -- qui tirent le même code n'ont pas la même empreinte.
  ADD COLUMN IF NOT EXISTS otp_hash               text        NULL,
  ADD COLUMN IF NOT EXISTS otp_expires_at         timestamptz NULL,
  -- Tentatives de saisie ERRONÉES depuis le dernier envoi. Un code à 6 chiffres se devine
  -- en 10^6 essais ; ce compteur est ce qui rend l'espace suffisant.
  ADD COLUMN IF NOT EXISTS otp_attempts           smallint    NOT NULL DEFAULT 0,
  -- Envois dans la fenêtre courante : plafonne l'usage du parcours comme robot à SMS.
  ADD COLUMN IF NOT EXISTS otp_sent_count         smallint    NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS otp_window_started_at  timestamptz NULL;

COMMENT ON COLUMN public.whatsapp_agent_links.otp_hash IS
  'sha256(code || profile_id) — jamais le code en clair (la ligne est lisible par son agent)';

-- ── 2. Le hash n'est lisible par personne ────────────────────────────────────
-- La RLS est une garde de LIGNE : elle dit qui voit la ligne, pas quelles colonnes. Le
-- privilège colonne est le seul verrou qui exclut `otp_hash` de la lecture de l'agent.
-- (Défense en profondeur : même lu, un sha256 salé ne rend pas le code.)
REVOKE SELECT ON public.whatsapp_agent_links FROM authenticated;
GRANT SELECT (
  id, profile_id, agency_id, wa_number, verified, verified_at,
  pairing_code, pairing_expires_at, morning_brief_enabled, created_at,
  pending_number, otp_expires_at, otp_attempts
) ON public.whatsapp_agent_links TO authenticated;

-- ── 3. Démarrage — appelable par le SERVICE seul ─────────────────────────────
-- Elle RETOURNE le code en clair, donc elle ne doit jamais être atteignable par un client :
-- c'est la fonction edge qui l'appelle, lit le code, l'envoie, et ne le rend pas à l'appelant.
-- `p_profile_id` est passé par la fonction edge APRÈS vérification du JWT ; la RPC ne peut
-- pas le dériver d'`auth.uid()` puisqu'elle tourne en service_role.
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

  -- Mêmes bornes que la garde sortante : sous 6 chiffres ou au-delà de 15, Meta n'a rien
  -- à composer, et un JID de groupe (18 chiffres) doit être refusé ici, pas plus loin.
  IF length(v_digits) < 6 OR length(v_digits) > 15 THEN
    RETURN QUERY SELECT false, 'invalid_phone', NULL::text; RETURN;
  END IF;
  v_norm := public.normalize_phone(v_digits);
  IF v_norm IS NULL THEN
    RETURN QUERY SELECT false, 'invalid_phone', NULL::text; RETURN;
  END IF;

  -- Numéro déjà tenu par QUELQU'UN D'AUTRE : on refuse ici plutôt qu'à la confirmation.
  -- L'index unique `idx_wa_agent_links_verified_number` le refuserait de toute façon, mais
  -- il le ferait APRÈS l'envoi du code — donc après avoir écrit à un tiers pour rien.
  IF EXISTS (
    SELECT 1 FROM public.whatsapp_agent_links l
     WHERE l.verified
       AND public.normalize_phone(l.wa_number) = v_norm
       AND l.profile_id <> p_profile_id
  ) THEN
    RETURN QUERY SELECT false, 'number_taken', NULL::text; RETURN;
  END IF;

  SELECT * INTO v_link FROM public.whatsapp_agent_links WHERE profile_id = p_profile_id;

  -- Plafond : 3 envois par heure et par agent. La fenêtre est GLISSANTE par remise à zéro,
  -- pas un seau à jetons — suffisant ici, où le coût d'un abus est un message de trop,
  -- et lisible par quiconque relit la fonction dans six mois.
  IF v_link.profile_id IS NOT NULL
     AND v_link.otp_window_started_at IS NOT NULL
     AND v_link.otp_window_started_at > now() - interval '1 hour'
     AND coalesce(v_link.otp_sent_count, 0) >= 3
  THEN
    RETURN QUERY SELECT false, 'rate_limited', NULL::text; RETURN;
  END IF;

  -- Même source d'aléa que le code d'appairage durci (20260705110000) : gen_random_uuid()
  -- diffusé par hashtextextended. 6 chiffres et non 8 — celui-ci se SAISIT à la main, et
  -- il est protégé par un plafond de tentatives que l'autre n'avait pas.
  v_code := lpad(
    ((hashtextextended(gen_random_uuid()::text, 0) % 1000000 + 1000000) % 1000000)::text,
    6, '0'
  );
  v_agency := coalesce(v_link.agency_id, (SELECT agency_id FROM public.profiles WHERE id = p_profile_id));

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
        -- Fenêtre échue → on repart à 1 ; sinon on incrémente. C'est ce calcul qui rend
        -- le plafond ci-dessus effectif.
        otp_sent_count = CASE
          WHEN l.otp_window_started_at IS NULL OR l.otp_window_started_at <= now() - interval '1 hour'
          THEN 1 ELSE coalesce(l.otp_sent_count, 0) + 1 END,
        otp_window_started_at = CASE
          WHEN l.otp_window_started_at IS NULL OR l.otp_window_started_at <= now() - interval '1 hour'
          THEN now() ELSE l.otp_window_started_at END,
        -- Demander un code ne DÉLIE PAS un lien déjà vérifié, même règle que la génération
        -- d'un code d'appairage : tant que la confirmation n'a pas eu lieu, l'ancien
        -- numéro continue de fonctionner.
        verified  = l.verified,
        wa_number = l.wa_number;

  RETURN QUERY SELECT true, 'ok', v_code;
END;
$$;

REVOKE ALL ON FUNCTION public.start_whatsapp_number_verification(uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_whatsapp_number_verification(uuid, text) TO service_role;
ALTER FUNCTION public.start_whatsapp_number_verification(uuid, text) OWNER TO postgres;

-- ── 4. Confirmation — appelable par l'AGENT ──────────────────────────────────
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

  -- FOR UPDATE : sans le verrou, deux confirmations concurrentes liraient le même
  -- `otp_attempts` et le plafond de 5 se franchirait en parallèle.
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

  -- Succès. Le numéro revendiqué devient le numéro vérifié ; l'état d'OTP est effacé, et
  -- le trigger `trg_sync_profile_phone_from_wa_link` reporte le numéro sur le profil.
  UPDATE public.whatsapp_agent_links
     SET wa_number = pending_number,
         verified = true,
         verified_at = now(),
         pending_number = NULL,
         otp_hash = NULL,
         otp_expires_at = NULL,
         otp_attempts = 0,
         -- Un code d'appairage encore en vol n'a plus de sens une fois le lien acquis.
         pairing_code = NULL,
         pairing_expires_at = NULL
   WHERE profile_id = auth.uid();

  RETURN QUERY SELECT true, 'ok';
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_whatsapp_number_verification(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.confirm_whatsapp_number_verification(text) TO authenticated;
ALTER FUNCTION public.confirm_whatsapp_number_verification(text) OWNER TO postgres;

COMMIT;
