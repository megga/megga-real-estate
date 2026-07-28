-- Console super-admin — index de la santé Flatfox + retrait de deux orphelins.
--
-- 1. idx_ml_flatfox_sync
--    La carte « santé de la synchro Flatfox » du monitoring compte les annonces
--    flatfox actives. Sur 173k lignes, ce comptage passait par un bitmap heap
--    scan de 19 934 blocs : 17 s mesurées, soit au-delà du statement_timeout de
--    8 s du rôle `authenticated` — la carte échouait, sans que personne ne le
--    voie (React Query rendait un compte à zéro). Le même index sert la seconde
--    requête de la carte, « dernier last_seen_at flatfox », qui tombe de 640 ms
--    à 0,16 ms.
--
--    INCLUDE (status) plutôt qu'un prédicat sur status : la requête de fraîcheur
--    ne filtre PAS le statut, et un index partiel sur `status='active'` ne
--    pourrait pas la servir. Avec la colonne incluse, le comptage reste en
--    index-only scan (166 ms mesurées) tout en filtrant le statut.
--
--    Créé en prod via CREATE INDEX CONCURRENTLY (aucun verrou d'écriture sur une
--    table que flatfox-sync écrit chaque nuit) ; ce fichier le trace en dépôt et
--    y est un no-op (IF NOT EXISTS). Sur une base fraîche de CI la table est
--    vide, donc la création non concurrente est instantanée. Même procédé que
--    20260625170000_ml_city_trgm_index.sql.
create index if not exists idx_ml_flatfox_sync
  on public.market_listings (last_seen_at desc) include (status)
  where source_portal = 'flatfox';

-- 2. admin_notes — table orpheline de la baseline.
--    Aucun appelant dans src/, supabase/functions/ ni scripts/ ; 0 ligne en prod
--    (vérifié le 28.07.2026), aucune clé étrangère entrante. Les commentaires du
--    dépôt la mentionnent au passé (« remplace le hack admin_notes »).
drop table if exists public.admin_notes;

-- 3. get_admin_support_stats() — RPC orpheline.
--    Le support maison a été démonté (passage à Intercom) : `ticket_messages`,
--    `ticket_events` et consorts ont déjà été supprimées, `support_tickets` est
--    vide. Cette fonction n'a plus aucun appelant hors des types générés.
drop function if exists public.get_admin_support_stats();
