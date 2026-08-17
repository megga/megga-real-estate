-- whatsapp_agent_links — l'agent LIT son lien, il ne l'ÉCRIT plus.
--
-- ⛔ TROU MESURÉ LE 17.08.2026. La policy posée en mai (20260530120000) était
-- `FOR ALL … USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid())`,
-- et `authenticated` détenait INSERT/UPDATE/DELETE sur la table. La contrainte de
-- ligne dit QUI, jamais QUOI : n'importe quel compte authentifié pouvait donc écrire
-- lui-même
--
--     update whatsapp_agent_links set wa_number = '<numéro d'un tiers>', verified = true
--      where profile_id = auth.uid();
--
-- …et se déclarer propriétaire vérifié d'un numéro WhatsApp qu'il ne contrôle pas.
-- Toute la vérification par code d'appairage devenait décorative : le webhook n'a
-- jamais eu d'autre témoin que cette colonne `verified`.
--
-- Les trois conséquences, par ordre de gravité :
--   1. FUITE INTER-AGENCE. Le webhook insère l'entrant d'un agent avec
--      `agency_id = <agence du lien>` (whatsapp-webhook, branche agent). En s'appropriant
--      le numéro d'un agent d'une AUTRE agence, l'attaquant fait atterrir dans SA propre
--      agence le CONTENU des messages que la victime écrit à MEGGA — donc les noms de
--      clients, adresses et montants qu'elle y cite — lisibles ensuite par sa RLS.
--   2. VOL DU NUMÉRO. `idx_wa_agent_links_verified_number` est UNIQUE : une fois le
--      numéro capté, la victime ne peut plus s'apparier du tout.
--   3. DÉTOURNEMENT DU COPILOTE. Les réponses de MEGGA AI partent vers le numéro capté
--      avec le contexte de l'agence de l'attaquant.
--
-- Le correctif ne retire aucune capacité réelle : `useWhatsAppPairing` ne fait qu'un
-- SELECT et appelle des RPC. Les seules écritures légitimes sont SECURITY DEFINER
-- (`generate_whatsapp_pairing_code`, `unlink_whatsapp_number` ci-dessous) ou passent par
-- le service_role (webhook), et aucune des deux ne dépend de ces droits de table.

BEGIN;

-- 1. Lecture seule côté client. La policy `FOR ALL` est remplacée par un SELECT nu :
--    l'agent doit continuer de voir son état (numéro masqué, code en cours, « vérifié »).
DROP POLICY IF EXISTS "wa_agent_links_self" ON public.whatsapp_agent_links;

DROP POLICY IF EXISTS "wa_agent_links_self_read" ON public.whatsapp_agent_links;
CREATE POLICY "wa_agent_links_self_read"
  ON public.whatsapp_agent_links
  FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

-- 2. Ceinture ET bretelles : la policy ne suffit pas seule. RLS et privilèges de table
--    sont deux verrous indépendants — une future policy trop large redeviendrait
--    exploitable tant que le GRANT d'écriture reste posé.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.whatsapp_agent_links FROM authenticated;
-- `anon` n'a aucune raison de toucher cette table : personne de non connecté n'a de lien.
REVOKE ALL ON public.whatsapp_agent_links FROM anon;

-- 3. Déliaison — la capacité que la lecture seule retire, rendue explicitement.
--    Sans elle, un agent qui change de téléphone reste collé à son ancien numéro :
--    `generate_whatsapp_pairing_code` ne délie JAMAIS un lien déjà vérifié (c'est ce qui
--    empêche un code régénéré de casser un appairage qui marche), et le webhook ne bascule
--    que `verified = false → true`.
--
--    SECURITY DEFINER pour écrire malgré le REVOKE ci-dessus, bornée à auth.uid() : un
--    agent ne peut délier que SON lien. Le numéro libéré redevient appariable par son
--    propriétaire réel (l'index unique ne porte que sur `verified = true`).
CREATE OR REPLACE FUNCTION public.unlink_whatsapp_number()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  -- DELETE et non UPDATE : la ligne ne porte que l'appairage. La garder vidée laisserait
  -- un enregistrement `verified = false` que `generate_whatsapp_pairing_code` réutilise
  -- par ON CONFLICT — même résultat, mais une ligne morte de plus par agent qui a changé
  -- de numéro. L'historique d'appairage, lui, vit dans activity_events, pas ici.
  DELETE FROM public.whatsapp_agent_links WHERE profile_id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.unlink_whatsapp_number() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.unlink_whatsapp_number() TO authenticated;
-- Épingle le propriétaire comme les autres helpers SECURITY DEFINER du domaine
-- (generate_whatsapp_pairing_code, agency_for_wa_business_number) : un ré-apply par un
-- autre superuser ne doit pas déplacer l'identité effective du definer.
ALTER FUNCTION public.unlink_whatsapp_number() OWNER TO postgres;

COMMIT;
