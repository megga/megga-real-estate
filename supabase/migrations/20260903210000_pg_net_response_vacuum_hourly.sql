-- pg_net : la table des réponses est passée au VACUUM toutes les heures.
--
-- Constat du 03.09.2026 (audit de santé). `net._http_response` occupait **5 390 Mo sur
-- 7 408 Mo de base — 73 %** — pour **1 050 lignes vivantes et 18 Mo de contenu réel**. La
-- rétention interne de pg_net fonctionnait (la table ne gardait bien que 6 h de réponses) ;
-- c'est le FICHIER qui ne rendait rien. Relevé avant intervention : `last_autovacuum` au
-- 05.08 et `autovacuum_count = 1` sur le heap COMME sur son TOAST — un seul passage en un
-- mois, pour ~11 000 réponses écrites et supprimées par jour. L'espace libéré n'était donc
-- jamais rendu réutilisable, et le fichier grossissait d'environ 1 Go par mois.
--
-- Un `VACUUM FULL` manuel a rendu 5,37 Go le 03.09 (base 7 408 → 2 038 Mo). Ce n'était qu'un
-- rattrapage : sans traiter la cause, le ballonnement repart au même rythme.
--
-- ⚠ POURQUOI PAS LA VOIE ÉVIDENTE. Deux correctifs plus directs ont été essayés et sont hors
-- de portée depuis le rôle `postgres`, ce n'est pas un choix de confort :
--   · `pg_net.ttl` (6 h → 30 min) a le contexte **sighup** : `alter database … set` et
--     `alter role … set` échouent tous deux en `55P02 parameter cannot be changed now`.
--     ⛔ La documentation Supabase qui recommande `alter role postgres set pg_net.ttl` est
--     FAUSSE sur cette version — mesuré, pas supposé. La TTL ne se change que par la config
--     Postgres personnalisée du projet (tableau de bord / API de gestion), hors migration.
--   · `alter table net._http_response set (autovacuum_*)` exige la PROPRIÉTÉ de la table,
--     détenue par `supabase_admin` ; `postgres` n'a que le privilège `MAINTAIN` (PG 17),
--     lequel suffit précisément pour VACUUM et ANALYZE.
--
-- D'où ce correctif, qui tient dans ce que le rôle peut faire : un VACUUM explicite horaire.
-- Un VACUUM simple ne prend qu'un `SHARE UPDATE EXCLUSIVE` — il ne bloque ni les lectures ni
-- les écritures, contrairement au `VACUUM FULL` — et rend l'espace réutilisable DANS le
-- fichier, ce qui suffit à stopper la croissance. Coût : quelques dizaines de Mo à parcourir.
--
-- ⚠ Ce correctif ne REND PAS l'espace à l'OS. Si le fichier a déjà ballonné, il faut un
-- `VACUUM FULL` ponctuel (verrou ACCESS EXCLUSIVE, à passer entre :15 et :55 hors 02h–03h,
-- après avoir vérifié que `net.http_request_queue` et `realadvisor_probe_inflight` sont à 0).
--
-- ⚠ Ce qui reste NON ÉLUCIDÉ, et qu'il faudra rouvrir si le fichier regrossit malgré ce
-- job : pourquoi l'autovacuum ne passait qu'une fois par mois sur une table constamment
-- réécrite. L'hypothèse la plus plausible est l'annulation répétée de l'autovacuum par les
-- conflits de verrou (écritures pg_net à la minute), mais elle n'a PAS été prouvée — le
-- `VACUUM FULL` du 03.09 a réinitialisé les compteurs qui l'auraient montrée. Ne pas
-- présenter cette hypothèse comme établie.
-- ⛔ `reltuples = -1` et `last_autoanalyze = null` sur la table TOAST ne sont PAS un défaut :
-- Postgres n'analyse jamais les tables TOAST. Ne pas repartir sur cette piste.
--
-- :50 est choisi à l'écart des sondes RealAdvisor (tir à :00, collecte à :10).

do $$ begin perform cron.unschedule('pg-net-response-vacuum-hourly'); exception when others then null; end $$;
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron')
     and exists (select 1 from pg_extension where extname = 'pg_net') then
    perform cron.schedule('pg-net-response-vacuum-hourly', '50 * * * *',
      'vacuum (analyze) net._http_response');
  end if;
end $$;
