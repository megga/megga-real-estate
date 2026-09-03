-- pg_cron : l'historique d'exécution des jobs cesse de croître sans fin.
--
-- Constat du 03.09.2026 (audit de santé). `cron.job_run_details` portait **320 492 lignes
-- (189 Mo) depuis le 23.03.2026**, dont **216 604 au-delà de 30 jours**, et AUCUN des 50 jobs
-- ne la purgeait. Elle croît d'environ 7 000 lignes/jour, et ce rythme monte avec le nombre
-- de jobs (41 fin juillet, 50 aujourd'hui).
--
-- Ce n'est pas qu'une affaire de stockage. `public.get_cron_health()` scanne cette table une
-- fois par job — 50 fois par appel — et **expirait 22 fois sur 24** (relevé dans les journaux
-- postgres : `statement timeout` sur la requête PostgREST de get_cron_health, user
-- `authenticator`, 1 à 2 par heure). Or l'appelant, `_shared/admin-alerts.ts`, ne déstructure
-- pas le champ `error` de la réponse : PostgREST ne lève pas sur un timeout, il rend
-- `{data: null, error}`, donc `cronRows ?? []` valait `[]` et la boucle d'alerte ne parcourait
-- rien, sans que le `catch` ne se déclenche. **Le chien de garde des 50 crons était aveugle,
-- et sa cécité était silencieuse.** La table est la CAUSE ; la lecture du champ `error` est
-- traitée séparément, côté code.
--
-- Rétention : 30 jours. C'est au-delà de tout ce qui interroge cet historique — ni
-- `realadvisor-health-daily` (fenêtres de 26 h à 6 jours) ni le rapport quotidien ne
-- remontent plus loin.
--
-- ⚠ `coalesce(end_time, start_time)` et non `end_time` seul : une exécution restée en
-- `running` porte `end_time` NULL et ne serait JAMAIS purgée — c'est exactement le genre de
-- ligne qui s'accumule sans qu'on la voie.
-- ⚠ Le DELETE est BORNÉ (50 000/nuit). Le régime normal est ~7 000 lignes/jour, donc la borne
-- ne mord jamais en croisière ; elle n'existe que pour empêcher une purge de rattrapage de
-- tenir un verrou trop longtemps. L'arriéré ci-dessous est traité en une fois, dans cette
-- migration, où le coût est assumé et surveillé.
-- ⚠ La table n'a pas d'index sur les dates : le DELETE fait un parcours séquentiel. C'est
-- acceptable sur 189 Mo, et le coût baisse dès que l'arriéré est passé. Ne pas créer d'index
-- sur une table système de pg_cron pour ça.

-- ⛔ LA RÉÉCRITURE DE `get_cron_health` A ÉTÉ ESSAYÉE ET ABANDONNÉE — ne pas la refaire.
-- Le `LEFT JOIN LATERAL … WHERE r.jobid = j.jobid OR r.command = j.command` se paie une fois
-- par job, et le `OR` interdit tout index (la table n'en porte qu'un, sur `runid` ; en créer
-- un est hors de portée, elle appartient à `supabase_admin`). Deux réécritures ont été
-- mesurées par EXPLAIN ANALYZE, table déjà purgée à 103 888 lignes :
--   · original (52 parcours, mais table en cache)      : 2 424 ms
--   · deux `DISTINCT ON` (jobid puis command)          : 2 080 ms — 14 %, et 11 Mo de tri
--     débordant sur DISQUE, le tri par `command` portant sur 329 octets par ligne
--   · repli paresseux par sous-requête scalaire        : 5 322 ms — TROIS jobs n'ont pas de
--     `jobid` correspondant et chacun redéclenche deux parcours complets
-- Modifier une fonction `security definer` pour 14 % en échange d'un débordement de tri est
-- un mauvais échange : la fonction est restée telle quelle. **C'est la rétention ci-dessous
-- qui corrige**, en divisant le volume par trois — et c'est aussi elle qu'il faudra resserrer
-- (30 j → 7 j) si le temps de réponse redevient un problème.
--
-- 1) L'arriéré, en une passe. Ré-exécutable : un rejeu ne trouve plus rien à supprimer.
delete from cron.job_run_details
 where coalesce(end_time, start_time) < now() - interval '30 days';

-- 2) L'entretien. Même montage que les autres crons du dépôt (unschedule avalé, schedule
--    gardé par l'existence du schéma cron pour une base de CI sans pg_cron).
do $$ begin perform cron.unschedule('cron-job-run-details-retention'); exception when others then null; end $$;
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.schedule('cron-job-run-details-retention', '55 3 * * *', $cron$
  delete from cron.job_run_details
   where ctid in (
     select ctid from cron.job_run_details
      where coalesce(end_time, start_time) < now() - interval '30 days'
      limit 50000
   );
$cron$);
  end if;
end $$;
