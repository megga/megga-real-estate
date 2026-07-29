-- Dé-duplication des logos d'agence hérités d'un compte « org » Flatfox partagé.
--
-- Flatfox attribue le même logo (compte parent / co-listing) à des agences
-- distinctes ; flatfox-sync le recopie tel quel dans agency_profiles.logo_url
-- pour chacune, ce qui affiche un FAUX logo (ex. un garage arborant le logo
-- d'une régie, ou un placeholder partagé par 5 agences sans lien).
--
-- Cette fonction re-vide les logos partagés par des agences aux noms
-- DISSEMBLABLES (similarité de trigrammes < seuil). Les franchises légitimes
-- (Wincasa, Helvetia, REMICOM, CBRE, Bernard Nicod…) forment des clusters de
-- noms similaires et ne sont donc PAS touchées.
--
-- Appelée par flatfox-sync à la fin de chaque passe (mode « sweep »), UNE fois,
-- après que l'upsert des chunks a ré-écrit tous les logos → single-pass
-- déterministe sur les groupes complets. SECURITY DEFINER : exécutée par le
-- service role du sync. Audit logos : juillet 2026.

CREATE OR REPLACE FUNCTION public.suppress_agency_logo_collisions(sim_threshold real DEFAULT 0.15)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  affected integer;
BEGIN
  WITH shared AS (
    SELECT logo_url, name FROM public.agency_profiles
    WHERE logo_url IS NOT NULL AND logo_url <> ''
      AND logo_url IN (
        SELECT logo_url FROM public.agency_profiles
        WHERE logo_url IS NOT NULL AND logo_url <> ''
        GROUP BY logo_url HAVING count(*) > 1
      )
  ),
  scored AS (
    SELECT a.name, max(similarity(lower(a.name), lower(b.name))) AS max_sim
    FROM shared a JOIN shared b ON a.logo_url = b.logo_url AND a.name <> b.name
    GROUP BY a.name
  )
  UPDATE public.agency_profiles a
  SET logo_url = NULL, updated_at = now()
  FROM scored sc
  WHERE a.name = sc.name AND sc.max_sim < sim_threshold AND a.logo_url IS NOT NULL;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

COMMENT ON FUNCTION public.suppress_agency_logo_collisions(real) IS
  'Vide agency_profiles.logo_url des agences partageant un logo (compte org Flatfox) avec des agences aux noms dissemblables (similarity < seuil). Appelée par flatfox-sync en fin de passe. Audit logos juil. 2026.';

REVOKE ALL ON FUNCTION public.suppress_agency_logo_collisions(real) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.suppress_agency_logo_collisions(real) TO service_role;
