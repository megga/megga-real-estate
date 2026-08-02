-- ═══════════════════════════════════════════════════════════════════════════════════════
-- Débloque le REJEU du jour : `20260802170000` ne peut plus recréer une fonction dont
-- `20260802180000` a changé le type de retour.
-- ═══════════════════════════════════════════════════════════════════════════════════════
--
-- LE DÉFAUT, ET IL A CASSÉ LE DÉPLOIEMENT DE PRODUCTION. `20260802180000` a fait passer
-- `admin_set_agency_plan` de `void` à `jsonb` (entrée dans le périmètre des GESTES, qui
-- impose l'enveloppe §10.1). Or `20260802170000` — mergée le MÊME JOUR — porte un
-- `create or replace function public.admin_set_agency_plan(...) returns void`.
--
-- `deploy.yml` rejoue TOUTE migration dont le préfixe de date vaut `>= TODAY` (UTC), à
-- CHAQUE déploiement de la journée, dans l'ordre des noms de fichiers. Au deuxième
-- déploiement du 02.08 :
--   1. `…170000` tente son `create or replace … returns void` sur une fonction devenue
--      `jsonb` → **42P13 « cannot change return type of existing function »** ;
--   2. `set -e` interrompt l'étape → `…180000` n'est jamais rejouée, et les Edge Functions
--      ne sont jamais déployées non plus.
-- Constaté sur le déploiement de 19:16 UTC. L'état de la base était intact (le rejeu a
-- échoué AVANT de rien modifier), mais le pipeline restait rouge pour le reste de la
-- journée UTC.
--
-- ⚠ POURQUOI LA CI NE POUVAIT PAS LE VOIR. Sur une base FRAÎCHE, les migrations passent
-- UNE fois, dans l'ordre : `…170000` crée la fonction en `void`, puis `…180000` la
-- remplace en `jsonb`. Aucun conflit. Le conflit n'existe qu'au SECOND passage, c'est-à-dire
-- uniquement dans la boucle de rejeu de `deploy.yml`. C'est la classe de défaut que
-- `backend.yml` asservit désormais, en rejouant les migrations du jour une seconde fois.
--
-- ⚠ POURQUOI UN NOUVEAU FICHIER, ET DATÉ PLUS TÔT. La règle du dépôt interdit la reprise
-- sur place d'une migration déjà en production : une correction passe par un NOUVEAU
-- fichier. Ce fichier peut malgré tout s'exécuter AVANT `…170000` parce que le date-guard
-- ne compare que les 8 chiffres de la DATE (`stamp_date="${base:0:8}"`), tandis que l'ordre
-- d'application, lui, suit le nom COMPLET (`ls … | sort`). Un stamp `20260802165000` est
-- donc rejoué aujourd'hui ET trié avant `170000`.
--
-- Ordre obtenu, à chaque déploiement du jour :
--   `165000` retire la version `jsonb` → `170000` recrée en `void` → `180000` la remplace
--   en `jsonb` et repose les droits mesurés. État final identique à aujourd'hui.
--
-- Le drop est CONDITIONNEL, et pas seulement `if exists` : sur une base fraîche la fonction
-- n'existe pas encore quand ce fichier passe, et après `…180000` elle doit rester. On ne
-- retire donc que la version qui ferait ÉCHOUER `…170000` — celle qui rend `jsonb`.
-- Retirer inconditionnellement laisserait, entre `165000` et `180000`, une fenêtre où la
-- fonction est absente pour rien.

do $$
begin
  if exists (
    select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'admin_set_agency_plan'
       and pg_get_function_result(p.oid) = 'jsonb'
  ) then
    -- Les droits n'ont pas à être reposés ici : `…180000`, qui suit dans le même
    -- déploiement, refait `revoke … from public, anon, service_role` puis ses `grant`.
    drop function public.admin_set_agency_plan(uuid, text, text, text);
  end if;
end $$;
