-- Purge les fiches d'annuaire moissonnées, après l'arrêt du cron qui les produisait.
--
-- CONTEXTE. `.github/workflows/sync-directory.yml` tournait tous les jours à 03h07
-- et lançait `scripts/seed-directory.mjs`, qui moissonnait SVIT / SMK / USPI vers
-- `agency_profiles` et `agent_profiles`. Or la fonctionnalité « annuaire » a été
-- retirée au pivot CRM-first : 20260719100000_close_anon_dead_surface.sql constate
-- déjà « agency_profiles : AUCUN lecteur applicatif ». Le cron collectait donc en
-- continu des coordonnées de tiers NON CLIENTS pour des tables que rien ne lit —
-- une collecte sans finalité. Workflow et script supprimés dans le même commit.
--
-- CE QUI EST CONSERVÉ, ET POURQUOI. Les deux tables restent VIVANTES :
--   · `agency_profiles` est aussi alimentée par flatfox-sync (upsert on slug) et
--     sert à rattacher les annonces du matching — 1413 lignes `source='flatfox'`
--     portant 54 235 annonces.
--   · `agent_profiles` porte la fiche de l'agent connecté (bio / langues /
--     spécialités, via useAgentProfileSugar → Réglages ▸ Profil).
--
-- La purge est donc CIBLÉE, pas globale :
--   · agency_profiles : seulement les sources d'annuaire ET sans annonce rattachée.
--     Vérifié avant écriture — 14 agences moissonnées portent 660 annonces
--     (uspi 609, svit 51) : elles sont ÉPARGNÉES, sinon la FK
--     market_listings_agency_profile_id_fkey casse et le matching perd leur identité.
--   · agent_profiles : seulement `profile_id IS NULL`, c.-à-d. les fiches sans
--     compte rattaché. Mesuré : 0 ligne appartient à un vrai utilisateur, les 2 062
--     sont du moissonnage. Une fiche créée par un agent réel a profile_id = son uid
--     et n'est jamais touchée par ce DELETE.
--
-- Effet mesuré : ~4 421 fiches d'agences (3 914 e-mails, 1 922 téléphones) et
-- ~2 062 fiches d'agents (1 637 e-mails, 185 téléphones) retirées.
--
-- Idempotent par nature (DELETE sur prédicat) : deploy.yml rejoue les migrations
-- horodatées du jour même, un second passage ne trouve simplement plus rien.

-- ORDRE IMPOSÉ par agent_profiles_agency_profile_id_fkey, qui est en NO ACTION :
-- 597 fiches d'agents pointent sur des agences purgées ci-dessous. Supprimer les
-- agences d'abord lèverait une violation de clé étrangère. Les agents partent donc
-- en premier.
delete from public.agent_profiles
where profile_id is null;

delete from public.agency_profiles ap
where ap.source in ('svit', 'smk', 'uspi', 'immobilier-ch')
  and not exists (
    select 1 from public.market_listings ml
    where ml.agency_profile_id = ap.id
  );
