-- « Annuler » abandonne CE QUI EST EN COURS, code d'appairage compris.
--
-- ⛔ CUL-DE-SAC MESURÉ EN PRODUCTION LE 17.08.2026. L'écran d'attente d'appairage
-- n'offrait que deux gestes — « Ouvrir WhatsApp » et « Régénérer un code » — et tous deux
-- RESTENT dans l'appairage. Un agent qui génère un code puis change d'avis (il veut la
-- voie OTP, ou il s'est trompé) était enfermé là pour les quinze minutes de validité, sans
-- rien à cliquer pour en sortir. Rapporté mot pour mot : « je ne peux pas rentrer l'OTP ».
--
-- ⚠ Le correctif d'écran a besoin d'un geste côté base, et `cancel_whatsapp_number_…`
-- n'effaçait que l'OTP. Plutôt qu'une SECONDE RPC quasi identique — deux fonctions à
-- maintenir pour un même verbe, et la garantie qu'un jour l'une oubliera ce que l'autre
-- fait — elle abandonne désormais les DEUX codes en vol. C'est déjà ce que son nom
-- promet à l'utilisateur : annuler ce qu'il a commencé.
--
-- Sans risque de collision : les deux états s'excluent à l'écran (la carte teste
-- `pairing_code` avant `otp_…`), et effacer une colonne déjà nulle ne coûte rien.
--
-- ⛔ CE QU'ELLE NE TOUCHE TOUJOURS PAS, et c'est le point qui compte :
--   · `otp_sent_count` / `otp_window_started_at` — le plafond de débit doit SURVIVRE à
--     l'annulation, sinon « envoyer / annuler / recommencer » redevient un envoi illimité
--     (le défaut du 17.08 au matin) ;
--   · `wa_number` / `verified` — annuler n'est pas délier ;
--   · `profiles.phone` — rien à retirer à l'acheteur parce qu'un code a été abandonné.

BEGIN;

CREATE OR REPLACE FUNCTION public.cancel_whatsapp_number_verification()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  UPDATE public.whatsapp_agent_links
     SET pending_number = NULL,
         otp_hash = NULL,
         otp_expires_at = NULL,
         otp_attempts = 0,
         pairing_code = NULL,
         pairing_expires_at = NULL
   WHERE profile_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_whatsapp_number_verification() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cancel_whatsapp_number_verification() TO authenticated;
ALTER FUNCTION public.cancel_whatsapp_number_verification() OWNER TO postgres;

COMMIT;
