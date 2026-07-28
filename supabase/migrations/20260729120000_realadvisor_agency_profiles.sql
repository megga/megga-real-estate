-- Rattachement des annonces RealAdvisor à l'annuaire `agency_profiles`
-- + captation de `agency_portal_id`.
--
-- CONTEXTE. Les 43 604 annonces VENTE de RealAdvisor portaient jusqu'ici des
-- champs d'agence à plat (`agency_name`, `agency_logo_url`, …) et AUCUN
-- `agency_profile_id` — contrairement aux annonces Flatfox, rattachées par
-- flatfox-sync. L'annuaire ignorait donc 5 141 régies vendeuses, et RA ne
-- sert un logo que sur 31 % de ses annonces (13 598 / 43 604).
--
-- ⚠ PORTÉE. Cette migration pose la DONNÉE, pas l'affichage. À ce jour aucune
-- surface de src/ ne lit `agency_profiles.logo_url` pour une annonce de
-- marché : MrhAgencyLogo (Matching · Recherche) lit `agency_logo_url` en
-- direct et se replie sur le nom. Le rattachement ne change donc rien à
-- l'écran tant qu'une lecture jointe n'est pas branchée — c'est un socle.
--
-- CLÉ DE RATTACHEMENT = slug du nom d'agence, comme flatfox-sync.
-- `agency_portal_id` a été écarté comme clé après mesure sur le vivier
-- complet : 406 de ses valeurs portent PLUSIEURS agences — `tuttifill` en
-- couvre 471 à elle seule, `anibisfill` 323. C'est l'identifiant du FLUX
-- d'origine (Tutti.ch, Anibis, logiciel métier…), pas de la régie. Il est
-- capté comme provenance, jamais comme identité.
-- `agency_id` (RA) a été écarté aussi : rempli sur 29 % des annonces
-- seulement, et 37 de ses valeurs regroupent les succursales sous un même
-- id parent (ImmoSky, Proximmo…), donc plus grossier que le nom.
--
-- Le slug fait converger une régie présente sur les DEUX portails vers UN
-- seul profil : 573 des 4 962 slugs RA existent déjà côté Flatfox. C'est ce
-- qui produit l'essentiel du gain logo (+8 766 annonces couvertes, 31 % → 51 %).
--
-- Idempotente : rejouable le jour même (deploy.yml rejoue tout stamp >= TODAY).

-- ─── 1. Provenance : identifiant du flux RA ───────────────────────

ALTER TABLE public.market_listings
  ADD COLUMN IF NOT EXISTS agency_portal_id text;

COMMENT ON COLUMN public.market_listings.agency_portal_id IS
  'RealAdvisor `agency_portal_id` : identifiant du FLUX d''origine (tuttifill, anibisfill, logiciel métier, compte agence…). N''identifie PAS une agence — 406 valeurs portent plusieurs régies. Provenance uniquement ; le rattachement passe par agency_profile_id.';

CREATE INDEX IF NOT EXISTS idx_market_listings_agency_portal_id
  ON public.market_listings (agency_portal_id)
  WHERE agency_portal_id IS NOT NULL;

-- Backfill depuis le payload brut déjà stocké — pas besoin d'attendre le
-- re-crawl : `source_payload` est renseigné sur 100 % des lignes RA, et
-- porte `agency_portal_id` sur 35 477 d'entre elles (81 %).
UPDATE public.market_listings
SET agency_portal_id = source_payload->>'agency_portal_id'
WHERE source_portal = 'realadvisor'
  AND agency_portal_id IS DISTINCT FROM (source_payload->>'agency_portal_id')
  AND source_payload->>'agency_portal_id' IS NOT NULL;

-- ─── 2. Slug d'agence, réplique exacte du slugifyName() JS ────────
--
-- flatfox-sync et realadvisor-sync slugifient en TypeScript
-- (`lower → NFD → suppression des diacritiques → [^a-z0-9]+ → '-'`).
-- Cette fonction rejoue le même algorithme en SQL pour que le backfill
-- ci-dessous et les upserts des edge functions tombent sur les mêmes slugs.
-- Vérifié sans divergence sur les 5 141 noms d'agence RA du vivier.

CREATE OR REPLACE FUNCTION public.megga_agency_slug(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT nullif(trim(both '-' FROM
    regexp_replace(
      regexp_replace(
        regexp_replace(lower(normalize(p_name, NFD)), E'[̀-ͯ]', '', 'g'),
      '[^a-z0-9]+', '-', 'g'),
    '-+', '-', 'g')), '')
$$;

COMMENT ON FUNCTION public.megga_agency_slug(text) IS
  'Slug d''agence — réplique SQL exacte du slugifyName() de flatfox-sync / realadvisor-sync. Garantit que backfill SQL et upserts edge tombent sur le même slug.';

-- ─── 3. Créer les profils manquants pour les agences RA ───────────
--
-- Un slug peut porter plusieurs graphies du même bureau ("GEIERSBERGER
-- IMMOBILIEN" / "Geiersberger Immobilien") : on retient la graphie la plus
-- fréquente, départage par ordre alphabétique pour rester déterministe.
-- ON CONFLICT DO NOTHING : les profils Flatfox existants ne sont jamais
-- écrasés (ni leur `source`, ni leur logo, ni leur enrichissement Zefix).

WITH ra AS (
  SELECT
    public.megga_agency_slug(agency_name) AS slug,
    agency_name,
    count(*) AS n,
    max(agency_logo_url) AS logo_url,
    max(agency_phone)    AS phone
  FROM public.market_listings
  WHERE source_portal = 'realadvisor'
    AND status IN ('active', 'price_reduced')
    AND agency_name IS NOT NULL
    AND public.megga_agency_slug(agency_name) IS NOT NULL
  GROUP BY 1, 2
),
best AS (
  SELECT DISTINCT ON (slug)
    slug, agency_name AS name
  FROM ra
  ORDER BY slug, n DESC, agency_name
),
agg AS (
  SELECT slug, max(logo_url) AS logo_url, max(phone) AS phone
  FROM ra GROUP BY slug
)
INSERT INTO public.agency_profiles (slug, name, logo_url, phone, source, status)
SELECT b.slug, b.name, a.logo_url, a.phone, 'realadvisor', 'unclaimed'
FROM best b JOIN agg a USING (slug)
ON CONFLICT (slug) DO NOTHING;

-- ─── 4. Rattacher les annonces ────────────────────────────────────
-- Toutes les annonces RA, y compris `removed` : une annonce retirée garde son
-- agence, et la sonde revive peut la réactiver.

UPDATE public.market_listings ml
SET agency_profile_id = ap.id
FROM public.agency_profiles ap
WHERE ml.source_portal = 'realadvisor'
  AND ml.agency_name IS NOT NULL
  AND ap.slug = public.megga_agency_slug(ml.agency_name)
  AND ml.agency_profile_id IS DISTINCT FROM ap.id;

-- ─── 5. Propager les logos RA vers les profils qui n'en ont pas ───
--
-- C'est le gain visible : une agence dont UNE annonce porte un logo le voit
-- servi sur TOUTES ses annonces via le fallback du profil.
-- On ne remplit que les profils dépourvus de logo — jamais d'écrasement d'un
-- logo Flatfox ou d'un logo enrichi à la main.
-- Les logos partagés à tort (même URL sur des agences aux noms dissemblables)
-- restent policés par suppress_agency_logo_collisions(), appelée en fin de
-- passe flatfox-sync et qui balaie agency_profiles en entier.

CREATE OR REPLACE FUNCTION public.realadvisor_fill_agency_logos()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
-- Appelée par l'edge function via PostgREST, donc soumise au statement timeout
-- du rôle. Mesurée à ~1,0 s sur 43 604 annonces (agrégat sur idx_ml_ra_probe) ;
-- la marge couvre la croissance du vivier sans dépendre du réglage du rôle.
SET statement_timeout = '60s'
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.agency_profiles ap
  SET logo_url = src.logo_url, updated_at = now()
  FROM (
    SELECT public.megga_agency_slug(agency_name) AS slug,
           max(agency_logo_url) AS logo_url
    FROM public.market_listings
    WHERE source_portal = 'realadvisor'
      AND status IN ('active', 'price_reduced')
      AND agency_name IS NOT NULL
      AND agency_logo_url IS NOT NULL
    GROUP BY 1
  ) src
  WHERE ap.slug = src.slug
    AND ap.logo_url IS NULL;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

COMMENT ON FUNCTION public.realadvisor_fill_agency_logos() IS
  'Remplit agency_profiles.logo_url à NULL avec un logo servi par RealAdvisor pour la même agence. Ne remplace JAMAIS un logo existant (Flatfox, Zefix, saisie manuelle). Appelée en fin de passe realadvisor-sync.';

REVOKE ALL ON FUNCTION public.realadvisor_fill_agency_logos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.realadvisor_fill_agency_logos() TO service_role;

SELECT public.realadvisor_fill_agency_logos();
