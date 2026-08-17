-- Plafonds de PLATEFORME sur l'envoi de codes de vérification.
--
-- ⛔ CE QUI MANQUAIT, ET POURQUOI ÇA COMPTE. La vérification par code envoyé est la seule
-- finalité qui écrive à un numéro que l'agent vient de TAPER — donc potentiellement celui
-- d'un tiers qui n'a rien demandé. Le seul frein était un plafond de 3 envois par heure
-- ET PAR AGENT. Cette borne se multiplie par le nombre de comptes : elle limite un agent,
-- pas la plateforme, et pas du tout le harcèlement d'UNE personne. Mesuré avant ce
-- correctif : aucun plafond d'agence ni global n'existait sur ce chemin — la colonne
-- `agency_usage_quotas.whatsapp_monthly_cap` existe mais n'est LUE nulle part côté envoi.
--
-- Trois plafonds sont ajoutés, et le troisième est celui qui protège vraiment quelqu'un :
--   1. `platform_daily`            — total d'envois, tous agents confondus, sur 24 h ;
--   2. `distinct_numbers_per_agent_daily` — un agent ne peut pas balayer des numéros ;
--   3. `per_number_daily`          — un MÊME numéro ne peut pas être ciblé en boucle,
--                                    fût-ce par des comptes différents.
--
-- ── Où vit le compteur, et pourquoi PAS ailleurs ────────────────────────────
--
-- ⚠ Un compteur ne doit pas vivre dans un objet que l'utilisateur limité peut détruire :
-- c'est exactement le défaut corrigé le 17.08 (la déliaison effaçait la ligne qui portait
-- le plafond horaire). Deux candidats ont donc été écartés :
--
--   · `whatsapp_agent_links` — l'agent peut la faire disparaître par déliaison, et elle
--     ne dit rien des autres agents.
--   · `whatsapp_messages` — tentant, mais DEUX défauts. Sa persistance est BEST-EFFORT
--     (le guard journalise et rend `ok` si l'insert échoue : un message parti peut n'y
--     laisser aucune trace), et le seul marqueur du template est une CHAÎNE dans `body`
--     (`[template: number_verification]`). Un plafond qui repose sur un format de chaîne
--     tombe SILENCIEUSEMENT à zéro le jour où ce format change — la panne la plus
--     dangereuse, puisqu'elle ressemble à un système qui fonctionne.
--
-- D'où ce registre dédié : écrit par la RPC elle-même (choke point unique, garanti par la
-- porte CI qui borne la finalité `number_verification` à un seul fichier), sans AUCUN
-- droit client, et remboursé par `abort_…` quand l'envoi échoue.

BEGIN;

-- ── 1. Le registre ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.whatsapp_verification_sends (
  id          bigserial   PRIMARY KEY,
  profile_id  uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  agency_id   uuid        NULL REFERENCES public.agencies(id) ON DELETE SET NULL,
  -- Numéro NORMALISÉ (9 derniers chiffres) : c'est la clé de comparaison partout ailleurs
  -- dans le domaine WhatsApp, et la seule qui résiste aux différences de format.
  wa_norm     text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Les trois plafonds lisent tous une fenêtre de 24 h : l'index porte donc created_at en
-- tête, et les deux discriminants ensuite.
CREATE INDEX IF NOT EXISTS idx_wa_verif_sends_created ON public.whatsapp_verification_sends (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_verif_sends_profile ON public.whatsapp_verification_sends (profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_verif_sends_norm    ON public.whatsapp_verification_sends (wa_norm, created_at DESC);

ALTER TABLE public.whatsapp_verification_sends ENABLE ROW LEVEL SECURITY;

-- ⛔ AUCUNE policy, et c'est délibéré : RLS active sans policy = personne ne passe, hormis
-- le propriétaire (les fonctions SECURITY DEFINER) et le service_role. Un agent n'a aucune
-- raison de lire, et surtout aucune de supprimer, le registre qui le borne.
REVOKE ALL ON public.whatsapp_verification_sends FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.whatsapp_verification_sends_id_seq FROM anon, authenticated;

COMMENT ON TABLE public.whatsapp_verification_sends IS
  'Registre append-only des codes de vérification ENVOYÉS. Porte les plafonds de plateforme ; aucun droit client (cf. 20260817160000).';

-- ── 2. Les plafonds, réglables sans déploiement ─────────────────────────────
-- `app_config` n'est exposée à AUCUN rôle client (vérifié : ni anon ni authenticated n'y
-- ont de privilège), donc la valeur ne peut pas être remontée par celui qu'elle borne.
-- ⚠ `app_config.value` est du TEXTE, pas du jsonb (vérifié sur le schéma, et c'est la
-- convention des autres clés : `contact_scoring_v1`, `matching_scoring_v2`… y stockent
-- toutes du JSON sérialisé). La lecture caste donc explicitement.
INSERT INTO public.app_config (key, value)
VALUES ('whatsapp_number_verification_caps',
        '{"platform_daily": 50, "distinct_numbers_per_agent_daily": 3, "per_number_daily": 2}')
ON CONFLICT (key) DO NOTHING;

-- ── 3. La RPC de démarrage applique les trois plafonds ──────────────────────
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
  v_caps   jsonb;
  v_cap_platform int;
  v_cap_numbers  int;
  v_cap_per_num  int;
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

  -- Plafonds : lus en base, repli sur des valeurs CONSERVATRICES. ⚠ Le repli va dans le
  -- sens de la FERMETURE — une clé absente, illisible ou mal formée ne doit pas rendre le
  -- chemin illimité. C'est la même règle que le « fail closed » de la garde de consentement.
  -- ⚠ Le cast est enveloppé : une valeur mal formée lèverait `invalid_text_representation`
  -- et ferait échouer TOUT le parcours, là où le repli conservateur suffit. Un plafond mal
  -- saisi doit fermer, pas casser.
  BEGIN
    SELECT value::jsonb INTO v_caps FROM public.app_config WHERE key = 'whatsapp_number_verification_caps';
  EXCEPTION WHEN others THEN
    v_caps := NULL;
  END;
  v_cap_platform := greatest(coalesce((v_caps->>'platform_daily')::int, 50), 0);
  v_cap_numbers  := greatest(coalesce((v_caps->>'distinct_numbers_per_agent_daily')::int, 3), 0);
  v_cap_per_num  := greatest(coalesce((v_caps->>'per_number_daily')::int, 2), 0);

  -- (a) PLATEFORME. Ce plafond-ci ne se multiplie pas par le nombre de comptes : c'est
  --     tout son intérêt, l'inscription étant ouverte.
  IF (SELECT count(*) FROM public.whatsapp_verification_sends
       WHERE created_at > now() - interval '24 hours') >= v_cap_platform
  THEN
    RETURN QUERY SELECT false, 'platform_rate_limited', NULL::text; RETURN;
  END IF;

  -- (b) LE NUMÉRO VISÉ. Le plus protecteur des trois : il borne ce qu'UNE personne peut
  --     recevoir, y compris quand plusieurs comptes s'y mettent. Un agent qui refait une
  --     tentative sur SON propre numéro reste couvert par (c) et par le plafond horaire.
  IF (SELECT count(*) FROM public.whatsapp_verification_sends
       WHERE wa_norm = v_norm AND created_at > now() - interval '24 hours') >= v_cap_per_num
  THEN
    RETURN QUERY SELECT false, 'number_rate_limited', NULL::text; RETURN;
  END IF;

  -- (c) BALAYAGE. Un agent vérifie SON numéro : au-delà de quelques-uns par jour, il ne
  --     vérifie plus, il compose. Un numéro DÉJÀ visé aujourd'hui ne compte pas comme
  --     nouveau — sinon réessayer sur le même numéro consommerait le quota de diversité.
  IF NOT EXISTS (
        SELECT 1 FROM public.whatsapp_verification_sends
         WHERE profile_id = p_profile_id AND wa_norm = v_norm
           AND created_at > now() - interval '24 hours')
     AND (SELECT count(DISTINCT wa_norm) FROM public.whatsapp_verification_sends
           WHERE profile_id = p_profile_id AND created_at > now() - interval '24 hours') >= v_cap_numbers
  THEN
    RETURN QUERY SELECT false, 'too_many_numbers', NULL::text; RETURN;
  END IF;

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

  -- Le registre est écrit ICI, pas après l'envoi : la fonction edge n'a aucun moyen de
  -- garantir qu'elle repassera (délai, panne, arrêt d'instance), et un plafond qu'on peut
  -- esquiver en faisant échouer l'aval n'en est pas un. En contrepartie, `abort_…` retire
  -- la ligne quand l'envoi n'a PAS eu lieu.
  INSERT INTO public.whatsapp_verification_sends (profile_id, agency_id, wa_norm)
  VALUES (p_profile_id, v_agency, v_norm);

  RETURN QUERY SELECT true, 'ok', v_code;
END;
$$;

REVOKE ALL ON FUNCTION public.start_whatsapp_number_verification(uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_whatsapp_number_verification(uuid, text) TO service_role;
ALTER FUNCTION public.start_whatsapp_number_verification(uuid, text) OWNER TO postgres;

-- ── 4. L'abandon rembourse AUSSI le registre ────────────────────────────────
CREATE OR REPLACE FUNCTION public.abort_whatsapp_number_verification(p_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.whatsapp_agent_links
     SET pending_number = NULL,
         otp_hash = NULL,
         otp_expires_at = NULL,
         otp_attempts = 0,
         otp_sent_count = greatest(coalesce(otp_sent_count, 1) - 1, 0)
   WHERE profile_id = p_profile_id;

  -- La DERNIÈRE ligne de ce profil, et elle seule : l'envoi qui vient d'échouer. Sans ce
  -- remboursement, trois kill-switches d'affilée consommeraient le quota de diversité de
  -- l'agent pour des pannes qui ne sont pas les siennes — et le plafond plateforme
  -- s'éroderait sur des messages jamais partis.
  DELETE FROM public.whatsapp_verification_sends
   WHERE id = (SELECT id FROM public.whatsapp_verification_sends
                WHERE profile_id = p_profile_id ORDER BY created_at DESC, id DESC LIMIT 1);
END;
$$;

REVOKE ALL ON FUNCTION public.abort_whatsapp_number_verification(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.abort_whatsapp_number_verification(uuid) TO service_role;
ALTER FUNCTION public.abort_whatsapp_number_verification(uuid) OWNER TO postgres;

COMMIT;
