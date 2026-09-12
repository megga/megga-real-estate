-- Chaque changement d'état de PREUVE d'un lien WhatsApp d'agent laisse une trace.
--
-- ⛔ INCIDENT DU 10.09.2026. Le copilote WhatsApp ne répondait plus à Julien : son numéro
-- n'était relié à aucun compte (`whatsapp_agent_links.verified = false` partout), donc le
-- webhook routait ses messages en branche CLIENT — capture, coches bleues, aucune réponse.
-- La ligne avait été vidée le 17.08.2026 par `unlink_whatsapp_number()`, mais il était
-- IMPOSSIBLE de dire par qui ni quand : aucun des gestes qui font ou défont la preuve d'un
-- lien n'écrivait dans `activity_events`, que CLAUDE.md §5 exige pour toute action.
--
-- Les gestes, relevés en production le 11.09.2026 (`pg_get_functiondef` de toute fonction
-- qui écrit `whatsapp_agent_links`, et balayage des edge functions) — il y en a TROIS :
--   1. `unlink_whatsapp_number()`              → whatsapp_number_unlinked            (ici)
--   2. `confirm_whatsapp_number_verification`  → whatsapp_number_verified, via 'otp'  (ici)
--   3. l'appairage de `whatsapp-webhook`       → whatsapp_number_verified, via 'pairing'
-- Aucun autre ne bascule `verified` : `generate_whatsapp_pairing_code` et
-- `start_whatsapp_number_verification` le PRÉSERVENT sur conflit, et la table n'accorde
-- aucune écriture à `authenticated` (lecture seule depuis 20260817133200).
--
-- Forme commune aux trois :
--   · category 'settings' — un lien est un RÉGLAGE du compte, posé et retiré depuis la carte
--     des réglages, comme la connexion d'un fournisseur de signature
--     (`signature.provider_connected`). 'messaging' range ce qui CIRCULE sur un canal —
--     envois refusés, e-mails —, pas l'existence du canal.
--   · severity 'info' — geste légitime du titulaire sur son propre compte. Un 'warn' le
--     placerait en tête du journal de la console à chaque changement de téléphone, et le
--     soustrairait à la purge de rétention, qui ne retire que les 'info' : conservation
--     perpétuelle d'un simple réglage.
--     ⚠ Conséquence assumée : 'info' + 'settings' ⇒ purgé après TROIS ans
--     (`purge_activity_events_retention`, « info>3y hors kyc/deal/auth »), pas dix. Pour
--     répondre à « qui a délié, et quand », c'est large.
--     ⚠ La cloche de l'agent (`useAgentNotifications`) ne filtre PAS sur la sévérité mais
--     sur `actor_kind <> 'user'` : les deux événements de ce fichier n'y paraissent jamais,
--     quelle que soit leur sévérité. Celui de l'appairage (acteur 'system') y paraît.
--   · jamais le numéro complet : `phone_tail`, ses 4 derniers chiffres, comme `auditGuard`
--     (_shared/whatsapp-outbound-guard.ts). La table est append-only ; y recopier un numéro
--     créerait une seconde rétention, hors registre et hors DSAR.
--   · entité = le LIEN (`whatsapp_agent_link`, son id) : la ligne survit à la déliaison
--     depuis 20260817143430, son id suit donc le lien d'un appairage à l'autre.
--     `metadata.profile_id` est posé même quand l'acteur est l'agent, pour qu'une seule
--     requête retrouve les trois gestes, appairage compris (actor_id NULL).
--   · agency_id = celle du LIEN, pas du profil : c'est le tenant sous lequel le canal a
--     réellement opéré (whatsapp-agent la re-dérive du lien). Les deux peuvent diverger
--     (mesuré le 17.08.2026, cf. 20260817145711).
--
-- L'INSERT vit dans la transaction du geste, SANS bloc d'exception : le geste et sa trace
-- commitent ensemble ou pas du tout. Chaque colonne contrainte l'est par construction —
-- category, severity et actor_kind littéraux ; actor_id = auth.uid(), dont le profil existe
-- puisque le lien le référence (FK ON DELETE CASCADE) ; agency_id lue sur le lien (FK).
--
-- Corps repris de pg_get_functiondef en production le 11.09.2026, identiques à
-- 20260817143430 (unlink) et 20260817145711 (confirm). SECURITY DEFINER, search_path, droits
-- et propriétaire conservés.
--
-- ⚠ HORODATAGE : `deploy.yml` n'applique que les migrations dont le préfixe vaut `>=` le jour
-- UTC du MERGE. Mergée plus tard que le 11.09.2026, celle-ci serait sautée SANS BRUIT — et
-- `migration-drift.yml` ne le verrait pas : il sonde l'EXISTENCE des fonctions, et ces deux-là
-- existent déjà. La renommer au jour du merge avant de merger.

BEGIN;

-- ── 1. Délier ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.unlink_whatsapp_number()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link public.whatsapp_agent_links%rowtype;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;

  -- FOR UPDATE : sans lui, deux déliaisons concurrentes (double-clic, deux onglets) lisaient
  -- toutes deux le lien vérifié et journalisaient DEUX déliaisons pour un seul geste.
  -- Verrouillée, la seconde attend la première et relit un lien déjà vidé.
  SELECT * INTO v_link
    FROM public.whatsapp_agent_links
   WHERE profile_id = auth.uid() AND verified
     FOR UPDATE;

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

  -- Trace SEULEMENT si un lien vérifié existait : vider une ligne déjà vide, ou abandonner
  -- une vérification en cours, ne retire aucune preuve et ne ferait que bruiter le journal.
  IF v_link.profile_id IS NOT NULL THEN
    INSERT INTO public.activity_events
      (agency_id, actor_id, actor_kind, action, entity_type, entity_id,
       category, severity, metadata)
    VALUES (
      v_link.agency_id, auth.uid(), 'user', 'whatsapp_number_unlinked',
      'whatsapp_agent_link', v_link.id,
      'settings', 'info',
      jsonb_build_object(
        'profile_id', v_link.profile_id,
        'phone_tail', right(regexp_replace(v_link.wa_number, '\D', '', 'g'), 4)
      )
    );
  END IF;

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
  IF v_link.wa_number IS NOT NULL THEN
    UPDATE public.profiles
       SET phone = NULL
     WHERE id = auth.uid()
       AND phone = '+' || v_link.wa_number;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.unlink_whatsapp_number() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.unlink_whatsapp_number() TO authenticated;
ALTER FUNCTION public.unlink_whatsapp_number() OWNER TO postgres;

-- ── 2. Confirmer le code reçu ───────────────────────────────────────────────
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

  -- Seul le chemin de SUCCÈS journalise : un code faux, expiré ou épuisé ne change aucune
  -- preuve. Hors du bloc ci-dessus, qui n'intercepte que la course sur le numéro.
  --
  -- `replaced_phone_tail` : l'écran n'offre pas de vérifier un autre numéro quand le lien
  -- l'est déjà, mais l'API le permet (`start_…` préserve `verified` sur conflit). La
  -- confirmation remplace alors le numéro prouvé SANS passer par la déliaison — un
  -- changement de preuve pour l'ANCIEN numéro, qui sans ce champ ne laisserait aucune trace.
  INSERT INTO public.activity_events
    (agency_id, actor_id, actor_kind, action, entity_type, entity_id,
     category, severity, metadata)
  VALUES (
    v_link.agency_id, auth.uid(), 'user', 'whatsapp_number_verified',
    'whatsapp_agent_link', v_link.id,
    'settings', 'info',
    jsonb_strip_nulls(jsonb_build_object(
      'via', 'otp',
      'profile_id', v_link.profile_id,
      'phone_tail', right(regexp_replace(v_link.pending_number, '\D', '', 'g'), 4),
      'replaced_phone_tail', CASE
        WHEN v_link.verified
         AND public.normalize_phone(v_link.wa_number)
             IS DISTINCT FROM public.normalize_phone(v_link.pending_number)
        THEN right(regexp_replace(v_link.wa_number, '\D', '', 'g'), 4)
      END
    ))
  );

  RETURN QUERY SELECT true, 'ok';
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_whatsapp_number_verification(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.confirm_whatsapp_number_verification(text) TO authenticated;
ALTER FUNCTION public.confirm_whatsapp_number_verification(text) OWNER TO postgres;

COMMIT;
