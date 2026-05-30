-- whatsapp_agent_links — appairage agent ↔ numéro WhatsApp (Phase 3, lecture seule).
--
-- Permet au webhook de reconnaître qu'un message entrant vient d'un AGENT (et non
-- d'un client), pour le router vers MEGGA AI (ai-copilot) au lieu de le stocker
-- comme message client.
--
-- Appairage AGENT-INITIÉ : l'agent saisit son numéro dans le CRM → un code à 6
-- chiffres est généré → l'agent envoie ce code au numéro MEGGA → le webhook le
-- matche et marque le lien vérifié. (Aucun message MEGGA→agent : on reste dans la
-- fenêtre 24h, pas de template Meta requis.)
--
-- RLS :
--   - authenticated : l'agent ne voit/gère QUE son propre lien (profile_id = auth.uid()).
--   - service_role : le webhook lit/écrit (bypass RLS).

BEGIN;

CREATE TABLE IF NOT EXISTS public.whatsapp_agent_links (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id          uuid        NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  agency_id           uuid        NULL REFERENCES public.agencies(id) ON DELETE SET NULL,
  wa_number           text        NULL,            -- digits only, rempli à la vérification
  verified            boolean     NOT NULL DEFAULT false,
  pairing_code        text        NULL,            -- 6 chiffres, effacé après vérification
  pairing_expires_at  timestamptz NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  verified_at         timestamptz NULL
);

-- Lookup webhook : numéro vérifié → agent. Partial index (seulement les liens actifs).
CREATE UNIQUE INDEX IF NOT EXISTS idx_wa_agent_links_verified_number
  ON public.whatsapp_agent_links (wa_number)
  WHERE verified = true AND wa_number IS NOT NULL;

-- Lookup appairage : retrouver un lien par code en attente.
CREATE INDEX IF NOT EXISTS idx_wa_agent_links_pairing_code
  ON public.whatsapp_agent_links (pairing_code)
  WHERE pairing_code IS NOT NULL;

ALTER TABLE public.whatsapp_agent_links ENABLE ROW LEVEL SECURITY;

-- L'agent gère uniquement SON lien.
DROP POLICY IF EXISTS "wa_agent_links_self" ON public.whatsapp_agent_links;
CREATE POLICY "wa_agent_links_self"
  ON public.whatsapp_agent_links
  FOR ALL
  TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- RPC : (re)génère un code d'appairage pour l'agent courant. SECURITY DEFINER pour
-- écrire pairing_code/expiry de façon atomique ; agency_id dérivé server-side via
-- le helper existant get_my_agency_id() (jamais fourni par le client).
CREATE OR REPLACE FUNCTION public.generate_whatsapp_pairing_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
BEGIN
  v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
  INSERT INTO public.whatsapp_agent_links (profile_id, agency_id, pairing_code, pairing_expires_at, verified)
  VALUES (auth.uid(), public.get_my_agency_id(), v_code, now() + interval '15 minutes', false)
  ON CONFLICT (profile_id) DO UPDATE
    SET pairing_code = EXCLUDED.pairing_code,
        pairing_expires_at = EXCLUDED.pairing_expires_at,
        agency_id = EXCLUDED.agency_id,
        -- (re)générer un code ne délie pas un compte déjà vérifié
        verified = public.whatsapp_agent_links.verified,
        wa_number = public.whatsapp_agent_links.wa_number;
  RETURN v_code;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_whatsapp_pairing_code() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.generate_whatsapp_pairing_code() TO authenticated;

COMMIT;
