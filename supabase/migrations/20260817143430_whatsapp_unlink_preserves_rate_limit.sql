-- Le plafond d'envois ne doit pas mourir avec la ligne qui le porte.
--
-- ⛔ DÉFAUT MESURÉ LE 17.08.2026, sur le code de cette même série. Le plafond de trois
-- codes par heure vit dans `otp_sent_count` / `otp_window_started_at`, deux colonnes de la
-- ligne `whatsapp_agent_links` de l'agent. Or `unlink_whatsapp_number()` SUPPRIMAIT cette
-- ligne, et la carte des réglages câblait son bouton « Annuler » de l'écran OTP dessus.
-- La boucle tenait en quatre gestes d'interface :
--
--     saisir le numéro d'un tiers → « Recevoir un code » (message parti, compteur à 1)
--     → « Annuler » (ligne supprimée, compteur avec elle) → recommencer
--
-- Soit un nombre ILLIMITÉ de messages template vers un numéro arbitraire, facturés sur le
-- WABA partagé, alors que la fonction edge documente ce plafond comme sa protection. Le
-- seul frein restant était la suppression par numéro (STOP), qui suppose que la victime
-- ait déjà écrit à MEGGA.
--
-- La leçon dépasse ce cas : **un compteur de débit ne doit pas vivre dans un objet que
-- l'utilisateur limité peut détruire.** Ici, plutôt que de déplacer le compteur, on rend la
-- déliaison NON destructrice — la ligne survit, vidée de tout ce qui prouve quelque chose.
-- C'est aussi ce qui permet aux deux gestes (délier / annuler) d'être distincts.

BEGIN;

-- ── 1. Délier : vider, ne plus supprimer ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.unlink_whatsapp_number()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wa_number text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT wa_number INTO v_wa_number
    FROM public.whatsapp_agent_links
   WHERE profile_id = auth.uid() AND verified;

  -- UPDATE et non DELETE : `otp_sent_count` et `otp_window_started_at` SURVIVENT, sinon
  -- la déliaison est un bouton « remets mon quota à zéro ». Tout le reste est effacé —
  -- le lien ne prouve plus rien, ce qui est exactement ce que délier veut dire.
  UPDATE public.whatsapp_agent_links
     SET wa_number = NULL,
         verified = false,
         verified_at = NULL,
         pairing_code = NULL,
         pairing_expires_at = NULL,
         pending_number = NULL,
         otp_hash = NULL,
         otp_expires_at = NULL,
         otp_attempts = 0
   WHERE profile_id = auth.uid();

  -- Le numéro quitte AUSSI les surfaces clientes (décision Julien, 17.08.2026), et c'est
  -- un renversement assumé de ce qu'écrivait 20260817133211. Le motif d'alors — « ne pas
  -- retirer un moyen de contact que l'agent n'a pas demandé à retirer » — ne tient plus
  -- une fois qu'on regarde POURQUOI on délie : le cas qui compte est l'agent qui a PERDU
  -- son numéro. Le garder afficherait à l'acheteur un numéro mort, voire recyclé chez un
  -- inconnu, sans aucun geste pour l'effacer puisque le champ n'est plus éditable.
  --
  -- ⚠ Conditionné à l'ÉGALITÉ avec le numéro délié. Un agent dont `profiles.phone` porte
  -- encore une saisie libre d'avant cette série ne doit pas la perdre parce qu'il délie un
  -- WhatsApp sans rapport — on n'efface que ce que la vérification avait elle-même écrit.
  IF v_wa_number IS NOT NULL THEN
    UPDATE public.profiles
       SET phone = NULL
     WHERE id = auth.uid()
       AND phone = '+' || v_wa_number;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.unlink_whatsapp_number() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.unlink_whatsapp_number() TO authenticated;
ALTER FUNCTION public.unlink_whatsapp_number() OWNER TO postgres;

-- ── 2. Annuler une vérification en cours ────────────────────────────────────
-- Distinct de la déliaison, et c'est le point : « Annuler » ne retire aucune preuve
-- acquise et ne touche pas `profiles.phone` — il abandonne seulement un code en vol. Le
-- compteur, lui, reste consommé : le message est PARTI, et le rendre inviterait
-- précisément à la boucle que cette migration ferme.
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
         otp_attempts = 0
   WHERE profile_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_whatsapp_number_verification() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cancel_whatsapp_number_verification() TO authenticated;
ALTER FUNCTION public.cancel_whatsapp_number_verification() OWNER TO postgres;

-- ── 3. Abandon APRÈS un envoi qui a échoué (service seul) ───────────────────
-- ⛔ Sans elle, l'écran ment. `start_whatsapp_number_verification` arme l'OTP AVANT que
-- l'envoi soit tenté ; si la garde refuse (kill-switch) ou si Meta échoue, la fonction
-- edge rendait l'erreur en laissant `pending_number` et `otp_expires_at` posés. L'agent
-- voyait le refus, puis — au retour sur l'onglet, `refetchOnWindowFocus` aidant — la carte
-- basculait sur « Code envoyé, il expire dans 10 minutes ». Il attendait dix minutes un
-- code jamais parti.
--
-- Le jeton de débit est RENDU ici, contrairement à l'annulation volontaire : rien n'est
-- parti, donc rien n'a été consommé. Sans ce remboursement, trois kill-switches d'affilée
-- verrouilleraient l'agent une heure pour des pannes qui ne sont pas les siennes.
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
END;
$$;

REVOKE ALL ON FUNCTION public.abort_whatsapp_number_verification(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.abort_whatsapp_number_verification(uuid) TO service_role;
ALTER FUNCTION public.abort_whatsapp_number_verification(uuid) OWNER TO postgres;

COMMIT;
