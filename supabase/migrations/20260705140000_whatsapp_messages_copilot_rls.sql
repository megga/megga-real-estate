-- Isolation des fils copilote 1:1 agent↔MEGGA (P2 sécurité).
--
-- La policy whatsapp_messages_agency_select laissait TOUT agent de l'agence lire TOUS les
-- messages. Or les échanges privés agent↔MEGGA (chat copilote : stratégie de négociation,
-- brouillons, contexte client) vivent dans la MÊME table que les fils clients. Dans une
-- agence multi-agents, l'agent B pouvait donc lire le chat copilote privé de l'agent A.
--
-- Fix : un message appartient au fil copilote d'un agent si son wa_from OU wa_to est le
-- numéro d'un agent lié+vérifié de l'agence. Un tel message n'est visible QUE par l'agent
-- propriétaire ; les fils clients (aucun numéro d'agent impliqué) restent visibles par toute
-- l'agence. Un client ne peut pas avoir le numéro d'un agent → aucun risque de masquer par
-- erreur un vrai fil client.
--
-- Helper SECURITY DEFINER : la RLS "self" de whatsapp_agent_links (profile_id = auth.uid())
-- masquerait les liens des AUTRES agents ; il faut les voir tous pour détecter un fil étranger.
-- auth.uid() n'est PAS affecté par SECURITY DEFINER (claim JWT de la requête courante).
-- Comparaison via normalize_phone() des DEUX côtés (9 derniers chiffres, aligné sur le trigger
-- de back-link 20260617091000) : robuste aux formats hétérogènes (E.164/national, backfill SQL).
-- L'égalité brute rouvrait silencieusement le fil dès qu'un wa_number était écrit autrement.
-- PAS de scope agency_id sur le lien : le message est déjà borné à l'agence de l'appelant par la
-- base policy ; scoper le lien rouvrait le fil d'un agent ayant CHANGÉ d'agence (lien re-pointé
-- sur la nouvelle agence, anciens messages restés sur l'ancienne). Un numéro d'agent vérifié
-- reste un numéro d'agent quel que soit son tenant.

BEGIN;

CREATE OR REPLACE FUNCTION public.wa_msg_is_foreign_agent_thread(p_wa_from text, p_wa_to text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.whatsapp_agent_links l
    WHERE l.verified = true
      AND l.wa_number IS NOT NULL
      AND l.profile_id <> auth.uid()
      AND (
        public.normalize_phone(l.wa_number) = public.normalize_phone(p_wa_from)
        OR public.normalize_phone(l.wa_number) = public.normalize_phone(p_wa_to)
      )
  );
$$;

REVOKE ALL ON FUNCTION public.wa_msg_is_foreign_agent_thread(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.wa_msg_is_foreign_agent_thread(text, text) TO authenticated;

-- Remplace la policy SELECT agence : idem qu'avant + masque les fils copilote étrangers.
-- (La policy super_admin_all reste séparée et permissive → super_admin voit tout.)
DROP POLICY IF EXISTS "whatsapp_messages_agency_select" ON public.whatsapp_messages;
CREATE POLICY "whatsapp_messages_agency_select"
  ON public.whatsapp_messages
  FOR SELECT
  TO authenticated
  USING (
    agency_id IS NOT NULL
    AND agency_id = public.get_my_agency_id()
    AND NOT public.wa_msg_is_foreign_agent_thread(wa_from, wa_to)
  );

COMMIT;
