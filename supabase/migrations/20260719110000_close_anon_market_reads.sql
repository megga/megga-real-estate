-- Ferme la lecture anon sur market_listings / market_price_history.
--
-- Volet différé de l'audit RLS anon du 19 juillet 2026 (voir la section « DIFFÉRÉ »
-- de 20260719100000_close_anon_dead_surface.sql). Il avait été sorti de cette
-- migration-là parce qu'il exige d'adapter un test dans la même PR — cf. plus bas.
--
-- POURQUOI ON PEUT FERMER
-- Les deux policies datent de la marketplace publique, désactivée au pivot CRM-first :
-- /acheter et /louer redirigent désormais vers la vitrine megga.ch. Plus aucun
-- lecteur anon ne subsiste — vérifié sur src/, sites/, supabase/functions/ et scripts/ :
--   · src/         → useMatchingRecherche, useAtelierMatching, useContactSentMatches,
--                    useMatching, AdminMonitoringPage : toutes des surfaces CRM/admin
--                    derrière authentification
--   · edge fns     → market-scraper, matching-engine, admin-monitoring,
--                    buyer-reception-get, flatfox-sync : toutes en SUPABASE_SERVICE_ROLE_KEY
--                    (donc hors RLS), aucune n'utilise la clé anon
--   · sites/       → la vitrine déployée (sites/megga-vitrine) ne fait que du
--                    client.auth.*, aucune lecture de table
--
-- Les lecteurs authentifiés restants sont couverts par les policies
-- `Authenticated users can read market_listings` / `... market_price_history`, qui
-- existent déjà sur les deux tables et ne sont pas touchées ici.
--
-- Vérifié aussi qu'aucun pont SECURITY DEFINER ne contourne la fermeture (le piège
-- rencontré sur contact_messages) : la RPC `match_candidate_listings`, definer et
-- lectrice de market_listings, porte déjà `REVOKE ALL ... FROM PUBLIC, anon`
-- (20260614130100), et la MV `market_rent_stats` est révoquée pour anon comme pour
-- authenticated (20260618210000 puis 20260628120000) — service_role seul.
--
-- ⚠ UN SEUL chemin anon subsiste, DORMANT : sites/_marketplace-phase-ulterieure/_worker.js
-- proxifie `/api/listings` vers market_listings avec une clé anon en dur. Ce dossier
-- n'est buildé ni déployé par aucun workflow CI (overlay-storefront.mjs pointe sur
-- sites/megga-vitrine), donc il ne casse rien aujourd'hui. Mais à la réactivation
-- éventuelle du storefront, cette route tombera en 403 : il faudra la faire passer
-- par une edge function en service_role (ou la vue en liste blanche ci-dessous),
-- pas restaurer la policy anon.
--
-- CE QUE ÇA CHANGE POUR LA CI (à ne pas redécouvrir dans la douleur)
-- Un DROP POLICY seul serait resté invisible : sans policy permissive, PostgREST
-- répond 200 avec un tableau vide, pas une erreur. C'est le REVOKE qui produit un
-- vrai 42501. tests/backend/smoke.spec.ts assertait justement `error === null` sur
-- un SELECT anon de market_listings ; l'assertion est inversée dans la même PR.
-- Les specs backend tournent LIVE en CI : sans cette adaptation, toute la suite rougit.

BEGIN;

DROP POLICY IF EXISTS "Public can read active market_listings" ON public.market_listings;
REVOKE ALL ON TABLE public.market_listings FROM anon;

DROP POLICY IF EXISTS "Public can read market_price_history" ON public.market_price_history;
REVOKE ALL ON TABLE public.market_price_history FROM anon;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- SI UNE LECTURE PUBLIQUE EST UN JOUR ROUVERTE : passer par une VUE en liste
-- blanche de colonnes, jamais par la table.
--
-- market_listings ne contient pas que des annonces : elle expose aussi des internes
-- d'algorithme (quality_score, relevance_score, absent_probe_count) et ~26 000
-- source_payload (la réponse brute du portail source). Une policy `USING (status =
-- 'active')` filtre les LIGNES mais aucune COLONNE — rouvrir la table telle quelle
-- republierait ces internes. Une vue en liste blanche est le seul cadrage correct,
-- et elle évite au passage de rejouer ce ticket.
--
-- Rappel du garde-fou général : le baseline pose `GRANT ALL ON TABLE public.<t>
-- TO anon` sur chaque table (et sur les futures via ALTER DEFAULT PRIVILEGES). Le
-- REVOKE ci-dessus est de la défense en profondeur ; le verrou reste la policy.
--
-- DONNÉES : aucune ligne touchée — uniquement des policies et des privilèges.
