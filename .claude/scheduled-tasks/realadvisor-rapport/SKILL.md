---
name: realadvisor-rapport
description: Mini-rapport quotidien du détecteur RealAdvisor (probe id_in + sweep tronqué + revive + fresh + price_reduced) avec vérif d'erreurs
---

Produis un mini-rapport quotidien (en français, 8-11 lignes) du système d'ingestion + détection RealAdvisor de MEGGA Real Estate.

⚠ REFONTE DES 20-21/07/2026 — à connaître avant de lire les chiffres :
- **Cause racine trouvée** : l'API RealAdvisor indexe ses pages **à partir de 0**, le code commençait à 1. Chaque requête sautait ses 36 annonces les plus récentes, donc toute slice de ≤ 36 biens revenait VIDE, ce qui stérilisait le découpage canton × bande de prix. Corrigé (#920).
- Conséquence : le vivier est passé de **25 261 à 42 621** (98 % des ~43 500 que RA déclare, contre 58 % avant), dont **+16 573 annonces jamais vues**. Tous les seuils calculés sur l'ancien vivier sont périmés.
- #925 : l'énumération n'enchaîne plus AUCUN retrait. `runSweep` (legacy, sans plafond de volume) est passé en dry-run derrière `realadvisor_sweep_enabled` (à `false`). Nouveau statut possible sur un run chunk : `partial` (des slices ont échoué) — ce n'est pas une erreur au sens de la Requête C.
- #926 + #927 : le crawl efface l'historique d'absence des biens qu'il revoit, et le prédicat du sweep exclut les biens re-vus vivants. Motif : sur 858 candidats d'une nuit, 162 avaient été re-vus dans les 12h, et 5 vérifiés à la main étaient tous encore en ligne sur RA.
- Point de vigilance sur le **taux de résurrection du revive** (symptôme des faux absents) : il tournait à 2-8 % avant le 21/07 contre ~1 % attendu. **RÉSOLU — il est redescendu dans la fourchette attendue** : 0,6 % le 23/07 (13 réactivés / 2 160 vus), 1,1 % le 24/07 (23), 1,6 % le 25/07 (34). Ne plus le signaler comme anomalie ouverte ; le recalculer chaque nuit (`revived` ÷ `total_seen` du `cron-revive`) et ne le remonter que s'il repasse durablement au-dessus de ~3 %.

⚠ **GATE EMPIRIQUE `id_in` PASSÉ À LA MAIN LE 03/08/2026 — intervention humaine sur les compteurs, à ne PAS lire comme un drainage naturel.**
Déclencheur : sweep `capped` 3 nuits d'affilée (01, 02, 03/08), dont la 3ᵉ sous le régime « 3 % seul » — la règle des 3 nuits imposait le gate. Oracle `id_in` rejoué depuis un poste (même UA, réponses toutes cohérentes ; lot de contrôle 34/36 présents ⇒ l'oracle n'était pas throttlé).
- **Faux absents mesurés** : cohorte « burst du 01/08 07:00-09:00 UTC » (578 candidats apparus d'un coup contre une baseline de 40-80/h) vérifiée **exhaustivement** → **205 encore en ligne sur RA (35,5 %)**. Concentration nette : 192/258 des ids `500*` de cette cohorte (74 %) contre 13/320 des ids courts (4 %). **Hors de cette fenêtre, pas de faux absents** : 2/72 en tirage aléatoire, et **0/36 sur les ids `500*` hors burst** — ce n'est donc PAS une classe d'ids mal gérée, c'est cet évènement daté.
- **Gestes appliqués en base le 03/08** (chemins de code du système, pas d'UPDATE ad hoc) :
  · `realadvisor_probe_bookkeep(<205 ids>, '{}', 20)` → file du sweep **972 → 767** (plafond 3 % = 1 309).
  · Les 1 348 retirés par le sweep du 03/08 01:30 repassés à l'oracle (38 lots, tous cohérents) → **35 vivants (2,6 %)** réactivés avec l'UPDATE verbatim de `realadvisor_revive_collect` (dont 3 re-dérivés `price_reduced` par le trigger).
- ⇒ **Ne PAS conclure « le capping s'est résorbé » si le sweep du 04/08 sort `completed`** : ~205 candidats ont été retirés de la file à la main. Le retour à `completed` est attendu par construction, il ne prouve rien sur l'inflow.
- ⇒ **TEST À LIRE JUSQU'AU 06/08** : ces 205 biens ont été remis à `absent_probe_count=0`. S'ils **remontent à 3** d'ici là alors qu'ils sont toujours en ligne, la sonde a un défaut systémique et il faut un garde-fou (re-vérification par un second chemin réseau avant retrait) ; s'ils ne remontent pas, l'incident du 01/08 était isolé. Requête : compter les biens dont `absent_probe_count >= 3` parmi cette cohorte (ids `500*` dont `absent_first_at` retombe dans une nouvelle fenêtre).
- **Mécanisme NON élucidé** — écarté par mesure : ce ne sont ni les en-têtes ni la forme de l'URL (rejoué en URL brute façon `pg_net`, réponse identique), ni une troncature (garde `total_count` vs tableau cohérent, `ambiguous=0`), ni un dérivage horaire de la sonde (les 3 absences ont eu lieu à 08:10, ~04:10 puis 02:10, des heures différentes). Restent l'IP de sortie `pg_net` servie différemment par RA, ou un cache côté RA. Ne pas re-dérouler ces trois pistes.

✅ **GATE OUTILLÉ DEPUIS LE 13/08/2026 — ne plus décrire une procédure à la main, pointer le script.**
`scripts/realadvisor-gate-id-in.mjs` (branche `outil/gate-id-in-rejouable`, puis `main` après merge) rejoue tout le protocole : candidats extraits par le prédicat exact du sweep (recoupés avec le RPC en dry-run), lot témoin de 36 vivants passé EN PREMIER (oracle throttlé ⇒ exit 2, run sans valeur), garde d'ambiguïté `total_count` vs tableau, ET l'écart live ↔ `total_count` national de RA — le second discriminant, que le gate seul ne voit pas. Sans `--apply` il n'écrit rien ; avec, il rend les vivants à la file via `realadvisor_probe_bookkeep` en relisant `absent_probe_count` juste avant (le 13/08, 4 vivants sur 5 s'étaient auto-corrigés pendant le run — sans cette relecture le taux est sur-estimé ~×5).
```bash
SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/realadvisor-gate-id-in.mjs   # constat seul
SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/realadvisor-gate-id-in.mjs --apply
```
⚠ Le rapport quotidien NE lance PAS ce script (il exige la clé de service et tourne depuis un poste) : quand une règle du verdict appelle un gate, le RECOMMANDER à l'opérateur avec la commande ci-dessus.
**Mesures à date** : 35,5 % de faux absents le 03/08 (incident daté, burst du 01/08) · 0,3 % le 11/08 · 0,8 % brut le 13/08 (0,15 % persistants) — la sonde ne se trompe pas en régime normal.

**Écart au catalogue — série suivie, à PROLONGER chaque nuit** (live de la Requête B moins `total_count` national de RA, Requête D) :
`+1 558` (11/08) → `+472` (12/08) → `+136` (13/08) → `~+900` (14/08) → **`−456` (15/08, live 42 090 vs RA 42 546)**.
⚠ **Le 15/08 l'écart a changé de SIGNE** — c'est un régime différent, pas la suite du drainage. Un écart POSITIF = sur-rétention (on garde des biens partis, c'est la sonde qui traîne) ; un écart NÉGATIF = sous-ingestion (le catalogue contient des biens qu'on n'a pas encore vus). Les deux se lisent avec la même mesure mais n'appellent PAS le même geste : le gate `id_in` ne diagnostique QUE le cas positif, le lancer sur un écart négatif ne rend rien.
Cause attendue du négatif, à ne pas re-diagnostiquer : l'asymétrie de cadence (détection nationale quotidienne vs ingestion par bucket sur 3 nuits) fait osciller le live autour du catalogue, d'autant plus après deux gros sweeps (1 492 le 14/08 puis 1 295 le 15/08). ~1 % de creux est du bruit.

CONTEXTE : `realadvisor-sync` (edge function Supabase) ingère les annonces VENTE de RealAdvisor dans `market_listings`. Architecture (pivot pg_net du 21 juin, sweep tronqué + revive du 9 juillet) :
- `fresh` (cron quotidien 03:30, edge fn) : ingère les nouvelles annonces (requête nationale).
- `probe` (crons HORAIRES pg_net fire :00 / collect :10) : détecte les disparitions via l'oracle `id_in` (« sur ces 36 ids, lesquels existent encore ? »). Un bien absent 3× (espacées ≥20h) ET depuis ≥48h devient candidat au retrait. Le probe ne supprime rien ; il tient les compteurs.
- `probe_sweep` (cron 01:30) : retire (`status='removed'`) les absents confirmés, **borné au plafond = 3 % du live** — le plafond se RECALCULE chaque nuit sur le live du moment, ne JAMAIS le citer comme une constante. Le lire sur `total_seen` du run de sweep (= le live au moment du run), ne jamais le citer de mémoire.
  ⚠ **CAP ABSOLU 1200 RETIRÉ le 02/08/2026** (migration `20260802120000_realadvisor_sweep_cap_pct_only.sql`) : l'ancien plafond était min(1200, 3 %), et depuis que le live dépassait ~40 000 c'était la branche absolue qui mordait (capped chronique les 01-02/08 : candidats 1 296 puis 1 412 contre 1 200) alors que l'inflow naturel tourne à 1 100-1 800/j. Désormais seul le 3 % borne ; `p_cap_abs` reste dans la signature (nullable, null = pas de cap) comme frein d'urgence manuel, et le cron passe `null` en positionnel. Sur la 1re nuit post-merge, attendre un retour à `completed` (~1 350 de plafond à live ~45 000) — si le sweep reste `capped` avec le 3 % seul, C'EST un vrai signal d'inflow, appliquer la règle des 3 nuits sans l'excuse du cap. Il retire les plus anciens à hauteur du plafond et journalise `status='capped'` s'il reste du backlog (le backlog se draine seul sur plusieurs nuits ; `safety_skipped` n'existe plus depuis le 09/07). Armé (`realadvisor_probe_apply='true'`).
  **Depuis le 21/07 (#927), le prédicat exclut les biens re-vus vivants** : `and (last_seen_at is null or last_seen_at < absent_first_at)`. Un bien que le crawl ou la sonde a constaté présent après sa première absence n'est plus candidat.
- `revive` (crons 02:30 fire / 02:45 collect) : sonde de RÉSURRECTION — re-vérifie les biens `removed` (fenêtre 60j sur `absent_first_at`, re-check ≥14j) et ré-active ceux revenus en ligne sur RA (~1 % attendu). Plafond 300 réactivations/nuit (`dropped_batches` sinon) — ⚠ ce plafond de 300 est affirmé de longue date mais **n'a jamais été confirmé dans les données** (runs observés à 408 / 919 / 2 160 vus) : ne pas s'en servir pour conclure sans avoir relu le code du cron. Kill-switch `realadvisor_revive_enabled`. Le fire plafonne à 2160 ids/nuit (60 lots × 36) : un `due=` supérieur signifie que le reliquat se reporte à la nuit suivante, ce n'est pas une anomalie en soi.
  **HEARTBEAT (PR #901, 19/07)** : le collect écrit désormais une ligne de run à CHAQUE passage, même à zéro lot, avec `due=N` = le nombre de candidats encore dus APRÈS traitement. Trois statuts propres au revive :
  · `idle` — 0 lot traité et 0 candidat dû : accalmie normale, désormais prouvée (le gate des 14j peut légitimement ne rien libérer pendant plusieurs nuits d'affilée).
  · `paused` — kill-switch à `false` : arrêt délibéré, `total_errors=0`, ce n'est PAS une erreur.
  · `stalled` — 0 lot traité ALORS QUE des candidats étaient dus : c'est la vraie anomalie (le fire n'a rien produit de collectable). Compté `total_errors=1`, donc il remonte aussi dans la Requête C.
  Conséquence : **l'absence totale de ligne `cron-revive` ne signifie plus « accalmie », elle signifie que le cron lui-même n'a pas tourné** — c'est devenu un signal fort.
- Un trigger marque `price_reduced` les baisses de prix (re-dérivé aussi à la résurrection).
POINT DE VIGILANCE : si RA throttle l'IP pg_net (rare), les batchs reviennent « ambigus » → runs `throttled`, la détection pause sans fausse écriture. Signe : `cron-probe` (ou `cron-revive`) en `throttled`.

ÉTAPE 1 — Interroge Supabase via l'outil MCP `execute_sql` (project_id = `eayczugyrvmtqnnmvjod`) :

Requête A (runs des dernières 24h) :
```sql
select trigger_source, status, count(*) as n,
       sum(total_seen) as seen, sum(total_updated) as updated,
       sum(total_removed) as removed, sum(total_errors) as errs,
       max(error_message) as sample_msg
from realadvisor_sync_runs
where started_at > now() - interval '25 hours'
  and trigger_source in ('cron-probe','cron-probe-sweep','cron-fresh','cron-revive','cron-health','cron-rolling')
group by trigger_source, status order by trigger_source, status;
```

Requête B (santé du probe : couverture + pipeline d'absence + price_reduced + removed) :
```sql
select
  count(*) filter (where status in ('active','price_reduced')) as live,
  count(*) filter (where status in ('active','price_reduced') and last_probe_at is not null) as deja_sonde,
  count(*) filter (where status in ('active','price_reduced') and absent_probe_count = 1) as absent_1x,
  count(*) filter (where status in ('active','price_reduced') and absent_probe_count = 2) as absent_2x,
  count(*) filter (where status in ('active','price_reduced') and absent_probe_count >= 3) as absent_3plus,
  count(*) filter (where status='price_reduced') as price_reduced,
  count(*) filter (where status='removed') as removed_total
from market_listings where source_portal='realadvisor' and transaction_type='buy';
```
NB : le « retirés cette nuit » se lit dans Requête A (`removed` du `cron-probe-sweep`), PAS via
`updated_at` sur les lignes removed — la sonde revive bumpe `updated_at` des removed re-vérifiés.

Requête C (scan d'erreurs) :
```sql
select trigger_source, status, total_errors, error_message, to_char(started_at,'MM-DD HH24:MI') started
from realadvisor_sync_runs
where started_at > now() - interval '25 hours'
  and (status in ('failed','throttled','circuit_open','alert') or total_errors > 0)
order by started_at desc limit 8;
```

Requête D (écart au catalogue — **à lancer CHAQUE nuit depuis le 15/08**, plus seulement en cas de `capped`) :
```bash
curl -s -H 'Accept: application/json' \
     -H 'User-Agent: <valeur de app_config.realadvisor_user_agent>' \
     'https://realadvisor.ch/api/listings?offerType_eq=buy&page=0'
```
→ lire `total_count`, le soustraire au `live` de la Requête B, et **prolonger la série** du bloc « Écart au catalogue » ci-dessus. L'UA se lit en base : `select value from app_config where key='realadvisor_user_agent';` — ne pas le taper de mémoire, un UA non whitelisté peut être servi différemment.

ÉTAPE 2 — Pour `cron-probe-sweep`, parse `candidates=N removed=N` depuis `error_message` ; pour `cron-revive`, parse `revived=N still_gone=N dropped_batches=N due=N orphans_purged=N` (les deux derniers champs existent depuis la PR #901 ; sur une ligne antérieure au 20/07 ils seront absents, afficher `—`).

ÉTAPE 3 — Rédige le rapport, format :
```
📊 RealAdvisor — nuit du <date>
• Probe : <nb runs cron-probe> runs, <nb completed> OK / <nb throttled> throttlés ; <deja_sonde>/<live> biens déjà sondés
• Pipeline absence : <absent_1x> vus absents 1×, <absent_2x> 2×, <absent_3plus> confirmés (≥3)
• Sweep : <status>, candidats=<N>, retirés cette nuit=<removed de Requête A> (total removed=<removed_total>)
• Revive : <status>, réactivés=<revived>, toujours absents re-datés=<still_gone>, reste dû=<due>
• Fresh : <seen> vus / <total_inserted> insérés
• Ingestion réelle : <créations market_listings.created_at sur 24h, tous vecteurs confondus>
  ⚠ RAPPORT DU 31/07 UNIQUEMENT — la fenêtre de 24-30h attrapera le rattrapage manuel du 30/07 10:41-11:16 UTC (`manual-rattrapage-0730`, 8 cantons du bucket manqué la nuit du 29) : **963 créations qui ne viennent PAS du cron**. Les défalquer avant de juger l'ingestion nocturne, ou borner la requête à `created_at > '2026-07-30 12:00+00'`. Deux autres lignes `manual-test-0730` (2 × 42 annonces) datent du même matin ; elles n'apparaissent pas dans la Requête A, qui filtre sur les `cron-*`.
• Rolling : <status>, <seen> biens re-crawlés (bucket du jour)
• Baisses de prix : <price_reduced> biens en price_reduced
• Écart au catalogue : live <live> vs total_count RA <N> = <±N> (série de la veille : <valeurs>)
• Erreurs : <aucune | liste de Requête C>
→ Verdict : <voir règles>
```
(Si aucun run `cron-revive` n'apparaît, c'est que le cron 02:45 lui-même n'a pas tourné — depuis le heartbeat, une nuit sans candidat produit quand même une ligne `idle`. Vérifier `cron.job` / `cron.job_run_details` pour les jobid des jobs `realadvisor-revive-fire` et `realadvisor-revive-collect` avant de conclure.)

RÈGLES DU VERDICT (une ligne) :
- Si un `cron-probe`, `cron-fresh` ou `cron-revive` est `failed` (vrai bug, ≠ throttled) → "⚠ ERREUR — <résumé>, à vérifier".
- Sinon si `cron-revive` est `stalled` → "⚠ revive à l'arrêt — <due> candidats étaient dus et le fire n'a produit aucun lot collectable : vérifier pg_net (net.http_request_queue / net._http_response), le job 02:30 et un éventuel throttle RA". (C'est l'anomalie que le heartbeat existe pour attraper. `idle` et `paused` ne déclenchent RIEN : le premier est une accalmie prouvée, le second un arrêt volontaire.)
- Sinon si AUCUNE ligne `cron-revive` n'apparaît sur 24h → "⚠ le cron revive n'a pas tourné — depuis le heartbeat une nuit calme produit une ligne `idle`, donc l'absence de ligne pointe le cron lui-même (pg_cron désactivé, jobid supprimé), pas le vivier".
- Sinon si la MAJORITÉ des runs `cron-probe` sont `throttled` → "⚠ IP pg_net throttlée → détection en pause (sûr, 0 fausse écriture) ; si ça persiste >2 jours, investiguer (UA, volume, contact RA)".
- ✅ SURVEILLANCE DU CAPPING REFERMÉE LE 30/07 (sweep `completed`, candidats 1 075 / retirés 1 075, sous le plafond). Série observée : 25/07 `capped` · 26/07 `capped` · 27/07 `completed` (946) · 28/07 `capped` (1 487) · 29/07 `capped` (1 696) · 30/07 `completed` (1 075). L'oscillation annoncée s'est produite, sans divergence : ne plus compter la série chaque nuit, ne plus l'annoncer dans la ligne « Sweep ». La règle de verdict « 3 `capped` consécutifs » reste seule en vigueur. Le raisonnement structurel ci-dessous est conservé parce qu'il reste vrai, pas parce qu'il y a quelque chose à surveiller.
  Le backlog post-refonte est DRAINÉ, ne plus invoquer cette explication. Historique des sweeps : 20/07 `capped` (780), 21/07 `capped` (1 200), 22/07 `completed` (364), 23/07 `completed` (209), 24/07 `completed` (1 003), **25/07 `capped` (candidats 1 338 / retirés 1 197, reliquat ~141)**. ⚠ **La séquence 209 → 1 003 → 1 338 n'est PAS une pente d'inflow** (diagnostic vérifié le 25/07, ne pas le refaire à l'envers) : le crawl national du 20/07 a re-vu 51 239 biens et #926 remet à zéro les compteurs d'absence de tout ce qu'il re-voit ⇒ **il a vidé le pipeline**, que 3 sondes espacées ≥20h + le gate 48h mettent ~3 jours à re-remplir. Les nuits 22-23 sont le trou, les nuits 24-25 le retour au niveau naturel. Mesuré sur `absent_first_at` : ~900-1 040 nouvelles absences/jour avant la refonte (live ~26 900 ⇒ 3,4-3,9 %/j) contre ~1 100-1 400 après (live ~40 000 ⇒ 2,8-3,4 %/j) — **le taux par bien a BAISSÉ, il n'y a pas de vague de churn RA**.
  Le capping n'est pas nouveau non plus : 18, 19 et 20/07 étaient déjà `capped` (1 026 / 1 035 / 1 235 candidats contre des plafonds de ~800). La refonte a juste hissé le plafond au-dessus de l'inflow en gonflant le live à 42 621 ; les retraits font maigrir le live, donc le plafond avec (1 278 → 1 197), pendant que l'inflow reste ~1 200 ⇒ ils se recroisent. **Structurel : plafond = % d'un vivier que les retraits rabotent, face à un inflow constant en absolu ⇒ oscillation durable autour de `capped`, sans divergence.** Ne pas re-diagnostiquer un `capped` isolé comme une anomalie de churn.
  ⇒ Requête d'historique, à ne lancer QUE si le sweep de la nuit est `capped` (pour appliquer la règle des 3 nuits consécutives) :
  ```sql
  select to_char(started_at,'MM-DD') nuit, status, total_removed, error_message
  from realadvisor_sync_runs
  where trigger_source='cron-probe-sweep' and started_at > now() - interval '6 days'
  order by started_at desc;
  ```

- ⚠ **ÉNUMÉRATION COMPLÈTE RELANCÉE À LA MAIN LE 25/07 ~14:45-17:00 UTC** (26 cantons, 5 lots scopés + canari, `trigger_source='manual-enum-0725-*'`). Deux effets de bord ATTENDUS sur les rapports du 26 au 29/07 — ne PAS les lire comme des pannes :
  · **Le pipeline d'absence n'a PAS été vidé** — j'avais prédit l'inverse en lançant le crawl, les chiffres m'ont démenti, c'est la version corrigée qui fait foi. Mesuré avant/après les 6 lots : biens portant un compteur d'absence **3 707 → 3 013 (−19 % seulement)**, et `absent_probe_count >= 3` est même REMONTÉ à 1 173 (contre 698 après le sweep du matin), les sondes horaires ayant continué à remplir pendant le crawl. Raison : `mapHit` ne remet à zéro que ce que RA **re-sert** ; un bien réellement délisté n'est pas renvoyé par le crawl, donc pas reseté. Le trou spectaculaire du 20/07 venait de ce que le pipeline était alors plein de FAUX absents (c'est précisément ce que #926/#927 ont corrigé) — ce n'est plus le cas.
    ⇒ **Prévision pour le sweep du 26/07 01:30 : ~996 candidats** (mesuré avec le prédicat exact, garde `last_seen_at` incluse) contre un plafond de 3 % de ~43 900 ≈ **1 318** ⇒ attendu `completed`, sans capping. 933 autres biens sont à 2 absences et arriveront ensuite. `proteges_car_revus = 0` : la garde #927 ne masque rien actuellement. Si le sweep sort très en dessous de ~900 ou au contraire `capped`, c'est un écart réel à investiguer, pas un effet du crawl.
  · **`removed_total` va baisser d'un coup.** `mapHit` écrit `status='active'` sans condition ⇒ tout `removed` que RA sert encore est ressuscité au passage. C'est l'effet recherché (remonter le vivier), pas une régression du sweep.
  **RÉSULTAT FINAL (6 runs, 14:47 → 16:40 UTC, ~2 h)** : live **39 377 → 43 937 (+4 560, +11,6 %)**, `removed` 23 819 → 23 533 (−286 résurrections), 67 470 lignes au total. 5 runs `completed`, 1 `partial` (lot 4, « 1 slice(s) en échec »). Tous les cantons gagnent entre +5 % (JU) et +17 % (ZG). Le vivier dépasse désormais les ~43 500 que RA déclarait au 20/07 — soit ce chiffre a bougé, soit il reste des biens partis non encore retirés ; ne pas traiter « live > 43 500 » comme une anomalie en soi.
  ✅ **« 5 cantons à ZÉRO » (AI, GL, NW, OW, UR) — RÉSOLU, ne plus enquêter.** Ce n'était PAS un problème de slug : les 5 slugs répondent 200 avec des annonces cohérentes (vérifié à la source par #967, et les reçus `realadvisor_slice_coverage` montrent `canton-appenzell-rhodes-interieures` résolvant 24/24 le 20/07 puis 27/27 le 25/07). La cause était la table NPA→canton calée sur des **blocs de 100** : GL/NW/OW/UR n'étaient JAMAIS émis, et AI seulement via `[9700,9799]`, une plage MORTE (le plus haut NPA suisse est 9658). Corrigé par le registre swisstopo dans `_shared/npa.ts` (#967, déployé le 26/07). Constaté en base le 28/07 : **AI 26 · GL 137 · NW 91 · OW 73 · UR 98 = 425 vivants**, cohérent avec les 422 mesurés à la source.
    ⚠ Piège de mesure à ne pas refaire : `updated_at` NE prouve PAS qu'une ligne a été recrawlée — la sonde horaire le bumpe sans recalculer `canton`. Même faiblesse sur `last_seen_at` depuis #926. Pour juger d'un canton, comparer `canton` au NPA via la table de `_shared/npa.ts`, pas via une date.

- ✅ **CRON `realadvisor-rolling-daily` RE-CRÉÉ le 25/07 (jobid 263, `0 22 * * *`, actif)** — c'était la cause racine du bleed. Il re-crawle 1 bucket de cantons/nuit depuis `realadvisor_shard_map` (app_config).
  **Depuis le 28/07 (#984) : rotation RÉELLEMENT périodique à 3 jours.** La map compte **exactement 3 entrées** et l'index est un compteur de jours ABSOLU — `mod(mod(date_utc - date '2026-01-01', 3) + 3, 3)` — plus `dow`.
  **Buckets rééquilibrés le 28/07 (#985), sur le COÛT DE CRAWL et non le volume** (~573 pages ≈ 31 min chacun, écart 0,2 %) :
  · idx 0 — VD, BE, GE, SG, LU, SO, BS, UR, AI
  · idx 1 — VS, ZH, FR, GR, NE, SH, ZG, SZ, OW
  · idx 2 — TI, AG, BL, JU, TG, AR, GL, NW
  ⚠ Les 5 petits cantons (AI/GL/NW/OW/UR) ne sont PLUS groupés : ils sont répartis sur les 3 buckets. Ne plus les attendre la même nuit.
  ⚠ **Le volume d'annonces n'est PAS le coût** — `pages ≈ 33 × n_cantons + 0,020 × annonces`, ~3,2 s/page. 33 slices par canton quelle que soit sa taille (1 non filtrée + 32 bandes de prix). Mesuré : 15 267 annonces en 22 min sur 2 cantons contre 16 187 en 39 min sur 11. ⛔ Ne jamais « rééquilibrer par volume » : TI seul pèse 23 % du catalogue, et viser l'égalité des volumes aggrave l'écart de durée.
  ⚠ **Map et index sont COUPLÉS, ne jamais toucher l'un sans l'autre.** L'ancien montage (3 buckets répétés sur 7 slots indexés par `dow`) donnait 4 jours d'écart à 24 cantons sur 26 et re-crawlait TI/VD 3×/semaine. Une map de 3 entrées indexée par `dow` renvoie NULL du mercredi au samedi ⇒ `cantons` vide ⇒ la fonction abort sur son garde-fou anti-full-crawl **sans écrire AUCUNE ligne de run** (silence total). C'est le mode de panne à suspecter en priorité si `cron-rolling` disparaît du rapport.
  ⚠ L'ancre `2026-01-01` doit rester FIXE : la changer décale la phase et peut sauter un bucket une nuit. `realadvisor_rolling_enabled` remis à `true` (il était à `false`, la fonction abortait sur son kill-switch). 1re exécution attendue le **25/07 22:00 UTC** sur le bucket 6 = FR + SG + JU + NE.
  Contexte à ne pas perdre : il avait été retiré VOLONTAIREMENT le 21/06 (migration `20260621140000`, motif « rolling+sweep-enum, throttlé+inerte » — RA throttlait alors l'IP des edge functions). Ce motif est caduc : l'énumération du 25/07 a tourné sans throttle avec l'UA identifié whitelisté.
  ⇒ **Vérifier chaque nuit qu'une ligne `cron-rolling` apparaît.** Si elle manque : soit le cron a été supprimé, soit `realadvisor_rolling_enabled` est repassé à `false` (l'abort du kill-switch n'écrit AUCUNE ligne de run — silence total, pas de trace). Si elle est `throttled` plusieurs nuits, c'est le retour du problème de 06/2026 ⇒ le signaler, ne pas insister.

  ⚠ **INCIDENT DU 29/07 22:00 — UNE TROISIÈME CAUSE EXISTE, ne pas s'arrêter aux deux ci-dessus.** Cette nuit-là, aucune ligne `cron-rolling`, aucune annonce touchée, 0 création sur 24h. Or le cron avait bien tiré (`cron.job_run_details` = `succeeded`), le kill-switch valait `true`, le bucket du jour portait 8 cantons, aucun verrou n'était tenu et la file pg_net était vide. Rejoué à la main le 30/07 sur un canton témoin, le chemin complet a fonctionné des DEUX bouts (appel HTTP direct ET `net.http_post` monté comme le cron : 202, run créé, 42 vues / 42 écrites). Conclusion : **requête pg_net enfilée puis jamais émise**, transitoire. Ne pas re-dérouler ce diagnostic à l'envers.
  ⛔ Pièges de méthode à ne pas refaire : `job_run_details = succeeded` prouve seulement que le SQL a ENFILÉ la requête ; `net._http_response` ne retient que ~6 h ; `net.http_request_queue` se vide, donc « file vide » ne distingue rien ; l'outil MCP `get_logs` annonce 24 h mais ne rend en pratique que la dernière heure.
  ✅ **Le seul discriminant fiable** : histogramme horaire de `market_listings.updated_at` — la sonde horaire pose un plancher de ~1 420/h, un rolling laisse une signature de 16 à 23 k sur une heure. Plancher plat = le crawl n'a jamais rien touché.
  ```sql
  select date_trunc('hour', updated_at) h, count(*) n from market_listings
  where source_portal='realadvisor' and transaction_type='buy'
    and updated_at > now() - interval '12 hours'
  group by 1 order by 1 desc;
  ```
  ✅ **Depuis la PR #1032 (30/07), le health check couvre ce cas** : nouvelle règle `rolling_stopped` (aucun run `cron-rolling` sur 26h, fenêtre sur `coalesce(ended_at, started_at)`), et `realadvisor-rolling-daily` rejoint la liste surveillée par `cron_inactive`. Un `cron-health` en `alert [rolling_stopped]` se relaie tel quel ; combiné à `cron_inactive` sur le même job, c'est le cron qui a disparu, pas une requête perdue.
  ⚠ Le rolling tient le **verrou singleton** ~15-40 min. S'il débordait jusqu'à 03:30, `realadvisor-fresh-daily` abandonnerait EN SILENCE. Un `fresh` absent du rapport alors que le rolling a duré anormalement longtemps = cette collision.
  ✅ La migration qui rend ce cron reproductible (**PR #954**, `20260725170000_realadvisor_rolling_recreate.sql`) est **MERGÉE le 25/07 17:31 UTC** — le cron ne dépend plus de la seule base de prod, une reconstruction d'environnement ne ré-appliquera plus le `unschedule` du 21/06.

- ⚠ **BILAN VIVIER — ⛔ NE JAMAIS mesurer l'ingestion avec `total_inserted`.** Cette colonne n'est
  renseignée QUE par `runFresh`. Tous les runs en mode chunk (`cron-rolling` et les
  `manual-enum-*`) la laissent à 0 : les 6 runs d'énumération du 25/07 affichent
  `total_inserted=0` alors qu'ils ont créé **4 274 lignes**. Le rapport du 26/07 en a conclu
  « seul `fresh` alimente le vivier, il manque un cron d'énumération » — **c'était faux**, le
  `cron-rolling` ingère bien (95 créations sur sa seule fenêtre du 25/07 22:00). Depuis le
  26/07 le mode chunk écrit `total_updated` = lignes écrites (insert+update confondus,
  l'upsert PostgREST ne les distingue pas), mais la seule mesure fiable des CRÉATIONS reste
  `market_listings.created_at` :
  ```sql
  select date_trunc('hour', created_at) h, count(*) n
  from market_listings
  where source_portal='realadvisor' and transaction_type='buy'
    and created_at > now() - interval '30 hours'
  group by 1 order by 1 desc;
  ```
  Rapprocher le total de ces créations des retraits du sweep, et donner le live du jour.
  **Le vrai sujet n'est pas « qui alimente » mais l'ASYMÉTRIE DE CADENCE** : la détection est
  nationale et quotidienne (sonde horaire, 100 % du vivier, retrait confirmé en ~3 j), alors
  que l'ingestion passe surtout par `cron-rolling`, qui n'énumère qu'un bucket de cantons par
  nuit. Tant que la rotation durait 7 nuits, un bien qui partait sortait en 3 j et un bien qui
  arrivait entrait en jusqu'à 7 j ⇒ le vivier se stabilisait ~4 jours d'inflow SOUS le
  catalogue réel (42 930 contre ~43 500+ le 26/07). **Correctif en DEUX temps** : la migration
  `20260726120000_realadvisor_shard_map_3day.sql` (26/07) a ramené la map à 3 buckets mais a
  laissé l'index sur `dow` (période 7), ce qui ne donnait PAS une rotation de 3 jours — 24
  cantons sur 26 attendaient jusqu'à 4 jours et TI/VD étaient crawlés 3×/semaine. Réellement
  aligné le 28/07 par `20260728100000_realadvisor_rolling_true_3day_rotation.sql` (#984), qui
  change map ET index ensemble. Chaque nuit couvre ~14 300 biens au lieu de ~6 100 (~40 min de
  crawl, départ 22:00).
  ⇒ **À surveiller sur les nuits suivantes** : que le rolling dure bien < 3 h (sinon il tient
  le verrou singleton jusqu'à `fresh` 03:30, qui abandonne EN SILENCE), qu'il ne passe pas en
  `throttled`, et que le live cesse de décroître. Si le live passe **sous 35 000**, ou si les
  créations restent < 200/nuit pendant 3 nuits alors que le sweep retire > 800, signaler : il
  faudra relancer une énumération complète en lots scopés (hors 03:00-04:00 UTC, verrou
  singleton).
- Sinon si `cron-probe-sweep` = `capped` 3 nuits de suite (la vérifier avec la requête ci-dessus, ne pas se fier à la mémoire) → deux cas :
  · **Série en cours démarrée le 09/08/2026 : les DEUX causes sont déjà écartées par la mesure** (gates des 11 et 13/08 : sonde saine à 0,3 % / 0,8 %, écart au catalogue refermé à +136). Ce qui reste est un inflow réel qui frôle le plafond — l'alerte `sweep_capped_persistent` va remailer sans désigner un défaut. Verdict : "⚠ capped chronique, causes écartées par les gates des 11+13/08 — surveiller l'écart live ↔ `total_count` RA, ne re-gater que s'il recreuse (> +500)". Le rapport peut mesurer cet écart lui-même : `curl -s -H 'Accept: application/json' -H 'User-Agent: <app_config.realadvisor_user_agent>' 'https://realadvisor.ch/api/listings?offerType_eq=buy&page=0'` → comparer `total_count` au live de la Requête B.
  · **Toute NOUVELLE série** (après un retour durable à `completed`) → "⚠ capping persistant — vague de churn RA ou faux absents : passer le gate `SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/realadvisor-gate-id-in.mjs` (voir bloc GATE OUTILLÉ) avant de laisser drainer" — recommandation à l'opérateur, le rapport ne lance pas le script.
  (1-2 nuits capped isolées = pic qui se draine seul, simple mention.)
- Sinon si l'**écart au catalogue** (Requête D) sort de la bande `−1 000 … +500`, deux verdicts distincts selon le SIGNE :
  · **> +500** (sur-rétention qui recreuse) → "⚠ écart au catalogue à +<N> — sur-rétention : passer le gate `SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/realadvisor-gate-id-in.mjs`" (recommandation à l'opérateur, le rapport ne lance pas le script).
  · **< −1 000** (sous-ingestion) → "⚠ écart au catalogue à −<N> — le vivier est sous le catalogue RA : ce n'est PAS un défaut de sonde, ne pas passer le gate `id_in`. Vérifier côté ingestion (rolling `completed` chaque nuit ? créations 24 h en rapport avec les retraits du sweep ?), et si le creux persiste 3 nuits, relancer une énumération complète en lots scopés."
  ⚠ Un franchissement isolé sur UNE nuit se mentionne sans déclencher de geste : l'écart oscille par construction (détection quotidienne vs ingestion sur 3 nuits). C'est la PERSISTANCE sur 3 nuits, ou une dérive monotone de la série, qui fait signal.
- Sinon si `cron-revive` = `capped` (dropped_batches>0) → "⚠ plafond de résurrection atteint (>300/nuit) — anormal (~1 % attendu), vérifier un faux-présent massif".
- Sinon si un run `cron-health` est en `alert` → relayer le code d'alerte ("l'alerte santé a mailé : <codes>").
- Sinon → "✅ système autonome sain — détection, drainage borné et résurrection tournent" (+ chiffre notable éventuel).

Ton factuel et court. Si aucun run n'apparaît, dis-le et signale tout run en erreur.
