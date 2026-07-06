-- Registre « numéro Business WhatsApp → agence » (routage wa_to → agence).
--
-- Aujourd'hui un inbound d'un numéro INCONNU n'est rattaché à une agence que si
-- EXACTEMENT 1 agence est vérifiée (pickTriageAgency, garde cross-tenant) — sinon
-- orphelin, et tout l'aval (compréhension / qualif / avis LPD, keyés contact_id +
-- agency_id) reste muet. C'est la dette DOCUMENTÉE dans _shared/whatsapp-lead-triage.ts :
-- sans routage par numéro Business, le multi-agence sur un numéro Meta partagé
-- n'attribue rien (on refuse de deviner : une mé-attribution = lead + avis LPD sous
-- la mauvaise identité).
--
-- Ce registre lie chaque numéro Business (wa_to, celui que le CLIENT compose) à SON
-- agence. Le webhook attribue alors un inconnu DÉTERMINISTIQUEMENT (le message est
-- physiquement arrivé sur ce numéro) — sûr même en multi-tenant, sans deviner. Repli
-- sur l'heuristique de comptage quand le numéro n'est pas (encore) enregistré.

BEGIN;

CREATE TABLE IF NOT EXISTS public.agency_wa_numbers (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id  uuid        NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  -- CHECK : rejette un numéro qui normalise à NULL (< 6 chiffres / garbage). Sans ça, deux
  -- lignes normalisant à NULL passeraient l'index unique (NULL ≠ NULL en btree) → trou de dédup.
  wa_number  text        NOT NULL
    CONSTRAINT agency_wa_numbers_norm_not_null CHECK (public.normalize_phone(wa_number) IS NOT NULL),
  label      text        NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Un numéro Business → EXACTEMENT une agence (unicité sur les 9 derniers chiffres via
-- normalize_phone, robuste au format). Empêche toute ambiguïté d'attribution.
-- CAVEAT (inerte au pilote mono-numéro CH) : normalize_phone garde 9 chiffres → deux numéros
-- de PAYS différents partageant leur national à 9 chiffres collisionneraient. Avant d'inscrire
-- une 2e agence, matcher sur l'E.164 complet (numéros Business = curatés, pas de national loose).
CREATE UNIQUE INDEX IF NOT EXISTS idx_agency_wa_numbers_norm
  ON public.agency_wa_numbers (public.normalize_phone(wa_number));
CREATE INDEX IF NOT EXISTS idx_agency_wa_numbers_agency
  ON public.agency_wa_numbers (agency_id);

ALTER TABLE public.agency_wa_numbers ENABLE ROW LEVEL SECURITY;

-- authenticated : voit le(s) numéro(s) de SON agence uniquement. Écriture = super_admin
-- (config) ; le webhook LIT via la RPC SECURITY DEFINER ci-dessous (service-role).
DROP POLICY IF EXISTS "agency_wa_numbers_agency_select" ON public.agency_wa_numbers;
CREATE POLICY "agency_wa_numbers_agency_select"
  ON public.agency_wa_numbers FOR SELECT TO authenticated
  USING (agency_id = public.get_my_agency_id());

DROP POLICY IF EXISTS "agency_wa_numbers_super_admin_all" ON public.agency_wa_numbers;
CREATE POLICY "agency_wa_numbers_super_admin_all"
  ON public.agency_wa_numbers FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- Résolution numéro Business → agence pour le webhook (service-role). SECURITY DEFINER
-- + search_path figé ; STABLE. Renvoie l'agence, ou NULL si le numéro n'est pas enregistré.
CREATE OR REPLACE FUNCTION public.agency_for_wa_business_number(p_wa_to text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT agency_id
  FROM public.agency_wa_numbers
  WHERE public.normalize_phone(wa_number) = public.normalize_phone(p_wa_to)
  ORDER BY created_at ASC   -- tie-break déterministe (théorique : l'index unique garantit ≤1)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.agency_for_wa_business_number(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agency_for_wa_business_number(text) TO service_role;
-- Épingle le propriétaire (definer) comme les autres helpers SECURITY DEFINER (normalize_phone,
-- get_my_agency_id…) : le deploy applique le SQL directement, un ré-apply par un autre superuser
-- ne doit pas déplacer l'identité effective du definer.
ALTER FUNCTION public.agency_for_wa_business_number(text) OWNER TO postgres;

-- Activation pilote : le numéro Business MEGGA partagé (+41 79 874 94 84) → Four Seasons
-- Group (Gregory). Lookup par SLUG → NO-OP sur une DB fraîche (CI / local, agence absente),
-- donc portable et sans FK cassée. Idempotent (ON CONFLICT sur le numéro normalisé).
INSERT INTO public.agency_wa_numbers (agency_id, wa_number, label)
SELECT a.id, '41798749484', 'MEGGA Business (pilote Gregory)'
FROM public.agencies a
WHERE a.slug = 'four-seasons-group'
ON CONFLICT DO NOTHING;

COMMIT;
