-- Retire les tables du Help Center SPA, devenues orphelines avec lui.
--
-- CONTEXTE. La migration 20260719100000_close_anon_dead_surface.sql a gardé
-- `article_feedback` / `article_views` ouvertes en INSERT anonyme, avec ce motif :
--
--   « le Help Center est PUBLIC (routes /help placées avant le premier
--     ProtectedRoute) et ArticleFeedback.tsx insère en anon au montage.
--     Fermer casserait la prod. »
--
-- Ce consommateur a été supprimé le LENDEMAIN (PR #919) : les 12 pages SPA
-- /help/* et ArticleFeedback.tsx sont parties, le corpus vit dans Intercom et
-- /help/* redirige vers intercom.help/megga/fr. La justification est donc
-- caduque, et il reste deux tables en écriture non authentifiée sans aucune
-- contrepartie — anon y détenait GRANT DELETE/INSERT/UPDATE/TRUNCATE, la RLS
-- étant le seul verrou (cf. le footgun des privilèges par défaut).
--
-- DONNÉES. Vérifié avant suppression : article_feedback = 0 ligne,
-- article_views = 2 lignes dont la plus récente date du 17.04.2026, sur des
-- articles qui n'existent plus. Aucune donnée métier, aucune contrainte
-- référentielle entrante (pg_constraint : 0 dépendance).
--
-- DROP TABLE emporte policies, index et GRANTs — inutile de les révoquer avant.
-- IF EXISTS partout : deploy.yml rejoue les migrations horodatées du jour même.

drop function if exists public.get_popular_articles(integer);

drop table if exists public.article_feedback;
drop table if exists public.article_views;
