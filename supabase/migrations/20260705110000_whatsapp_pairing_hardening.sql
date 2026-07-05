-- Durcissement du code d'appairage agent↔WhatsApp (P2 sécurité).
--
-- Avant : `lpad((floor(random() * 1000000))::int::text, 6, '0')` — PRNG NON
-- cryptographique + espace de seulement 10^6, sans plafond de tentatives → un
-- attaquant pouvait tenter de deviner un code en attente (15 min) en inondant le
-- numéro MEGGA de messages « 000000 ».. « 999999 » : au premier match, SON numéro
-- devenait le device vérifié de l'agent (hijack du copilote, scoping agence).
--
-- Après :
--   - Aléa CRYPTOGRAPHIQUE : la source est gen_random_uuid() (RNG du système, non
--     prédictible), diffusée par hashtextextended() puis ramenée à 8 chiffres.
--     Formule sans abs() ni dépendance pgcrypto ; le résidu (x % 1e8 + 1e8) % 1e8
--     couvre toujours 0..99999999, lpad garantit 8 caractères (zéros de tête inclus).
--   - Espace ÉLARGI à 10^8 (×100) → combiné au plafond de tentatives ajouté côté
--     webhook (whatsapp-webhook) et au TTL, le brute-force en ligne via WhatsApp
--     devient infaisable (le canal Meta limite fortement le débit entrant).
--
-- Le reste est inchangé (upsert par profile_id, agency_id server-side, ne délie
-- jamais un compte déjà vérifié). Le webhook accepte désormais un code à 8 chiffres
-- (extractPairingCode mis à jour en parallèle).

BEGIN;

COMMENT ON COLUMN public.whatsapp_agent_links.pairing_code IS
  '8 chiffres (aléa cryptographique), effacé après vérification';

CREATE OR REPLACE FUNCTION public.generate_whatsapp_pairing_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
BEGIN
  -- 8 chiffres à partir d'une source cryptographique (gen_random_uuid), sans biais
  -- de signe (le double modulo garde le résidu dans 0..99999999).
  v_code := lpad(
    ((hashtextextended(gen_random_uuid()::text, 0) % 100000000 + 100000000) % 100000000)::text,
    8, '0'
  );
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
