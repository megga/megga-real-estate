-- Le numéro WhatsApp VÉRIFIÉ devient le numéro de téléphone de l'agent.
--
-- Décision produit (Julien, 17.08.2026) : dans les réglages, l'agent ne saisit plus un
-- téléphone en texte libre — il APPAIRE son WhatsApp, et c'est ce numéro-là qui le
-- représente partout. Deux champs libres (`profiles.phone` « ligne fixe » et
-- `profiles.mobile_phone`) disparaissent de l'écran Profil au profit d'un seul numéro,
-- prouvé.
--
-- ⚠ CE QUI RENDAIT LE RETRAIT DANGEREUX. `profiles.phone` n'est pas décoratif : il est
-- LU par trois chemins tournés vers le client, et retirer le champ sans rien mettre à la
-- place les aurait laissés vides pour tout nouvel agent —
--   · `buyer-reception-get`  : le téléphone de l'agent affiché à l'ACHETEUR ;
--   · `useSendEmail`         : le téléphone dans les e-mails de matching, dont le repli
--                              est le numéro FICTIF « +41 22 000 00 00 » ;
--   · `OcBooking`            : préremplissage du RDV d'accueil.
-- D'où ce miroir : au lieu de perdre la valeur, ces trois chemins reçoivent désormais un
-- numéro VÉRIFIÉ là où ils recevaient une saisie libre jamais confrontée à rien.
--
-- Le miroir vit en TRIGGER, et non dans le code de la fonction edge qui vérifie, parce
-- que la vérification a déjà deux écrivains (le webhook en service_role, et demain toute
-- autre voie d'appairage) : un miroir posé dans l'un d'eux serait absent de l'autre.
-- Ici la règle tient à la table, quel que soit l'appelant.

BEGIN;

CREATE OR REPLACE FUNCTION public.sync_profile_phone_from_wa_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- N'écrit QUE sur une vérification effective. Un code régénéré, un changement de
  -- morning_brief_enabled ou une ligne encore en attente ne touchent pas le profil.
  IF NEW.verified IS NOT TRUE OR NEW.wa_number IS NULL THEN
    RETURN NULL;
  END IF;

  -- `wa_number` est en chiffres seuls (wa_id Meta) ; `profiles.phone` porte l'E.164 avec
  -- le « + », comme les valeurs déjà en base. `IS DISTINCT FROM` évite une écriture (et
  -- un réveil de Realtime) quand rien ne change.
  UPDATE public.profiles
     SET phone = '+' || NEW.wa_number
   WHERE id = NEW.profile_id
     AND phone IS DISTINCT FROM '+' || NEW.wa_number;

  RETURN NULL;
END;
$$;

ALTER FUNCTION public.sync_profile_phone_from_wa_link() OWNER TO postgres;

DROP TRIGGER IF EXISTS trg_sync_profile_phone_from_wa_link ON public.whatsapp_agent_links;
CREATE TRIGGER trg_sync_profile_phone_from_wa_link
  AFTER INSERT OR UPDATE OF verified, wa_number ON public.whatsapp_agent_links
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_phone_from_wa_link();

-- ⛔ PAS de miroir à la déliaison, délibérément. Un agent qui délie son WhatsApp ne
-- déclare pas que son numéro n'existe plus ; vider `profiles.phone` retirerait son
-- moyen de contact de la page de réception acheteur et des e-mails de matching, sans
-- qu'il l'ait demandé ni ne le voie. La valeur reste, simplement plus rafraîchie —
-- l'écran Profil dit alors « non vérifié », ce qui est l'information exacte.

-- Rattrapage des liens DÉJÀ vérifiés : sans lui, le seul agent apparié en prod garderait
-- dans son profil un numéro sans rapport avec son WhatsApp (mesuré le 17.08.2026 :
-- profil `+41798999379` contre WhatsApp vérifié `41766080408` — deux numéros différents
-- pour une même personne, et c'est le premier que voyait l'acheteur).
UPDATE public.profiles p
   SET phone = '+' || l.wa_number
  FROM public.whatsapp_agent_links l
 WHERE l.profile_id = p.id
   AND l.verified
   AND l.wa_number IS NOT NULL
   AND p.phone IS DISTINCT FROM '+' || l.wa_number;

COMMIT;
