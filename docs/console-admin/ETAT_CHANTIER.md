# Console MEGGA · backend — état du chantier et reprise

> **1ᵉʳ août 2026, 19 h UTC — TOUT EST MERGÉ ET DÉPLOYÉ.** Document de reprise : tout ce
> qu'il faut pour continuer sans relire la conversation. Spec :
> `docs/handoff/console-admin/` · Inventaire du socle : [INVENTAIRE_SOCLE.md](INVENTAIRE_SOCLE.md).
>
> 🎯 **PROCHAIN CHANTIER : LE LOT 3** (étapes 24 à 30). ⚠ Lire le **§7ter** avant de
> commencer : il a été mesuré le 01.08 et **la majeure partie du Lot 3 est murée** — 24/25/26
> par la décision **P3**, 28 et 30 par des specs qui ne définissent pas ce qu'elles
> demandent, 27 par une maquette qui n'existe pas au dépôt. Y aller sans l'avoir lu, c'est
> retomber sur les mêmes murs.
>
> ✅ **REVUE DU LOT 1** (01.08, PR #1049). Deux défauts : le verdict de chaîne de l'extrait
> n'était borné qu'en bas, et une erreur métier consommait la clé d'idempotence. **§7**.
>
> ✅ **REVUE DU LOT 2** (01.08, PR #1054 — **mergée et déployée**). Les étapes 16, 19, 20, 21
> et 22 étaient cochées ✅ mais portaient **HUIT défauts**, dont **deux de sécurité** :
> `anon` lisait toutes les nouveautés publiées en production, et six tables internes lui
> accordaient des droits — cinq en `DELETE/INSERT/TRUNCATE`, `app_config` comprise, qui porte
> la clé de service. Plus deux garde-fous posés (alerte de rupture de chaîne, porte sur la
> dérive des privilèges). **§7bis**, et chaque correctif est vérifié dans la fonction
> VIVANTE, pas dans le fichier.
>
> ✅ **PR #1057** — le contrôle de dérive de schéma cesse de crier pendant les déploiements.
>
> ⚠ **DEUX DÉCISIONS FERMENT L'ÉTAPE 19**, cochée ✅ mais inutilisable de bout en bout : le
> **destinataire** du lien KYC régénéré n'est défini nulle part dans les 25 fichiers de spec,
> et le **plafond 3** compte des liens et non des personnes. **§7bis**.

## 1. Comment on travaille (décidé avec le PO)

Thomas et Antoine travaillent en parallèle sur le même dépôt. Méthode retenue :

- **une branche pour le chantier**, PR ouverte **en brouillon** et poussée à chaque étape ;
- la CI tourne sur `pull_request`, donc **chaque push est validé sans rien merger** ;
- **merge aux gates** du plan (G0, G1, G2), pas à chaque étape ;
- **au merge : re-dater toutes les migrations au jour du merge.**

⚠ Deux mécaniques mesurées, à ne pas redécouvrir :
- **une PR empilée ne reçoit AUCUNE CI** — les workflows sont filtrés sur
  `pull_request: branches: [main]` et aucun ne porte de `workflow_dispatch` ;
- **recibler une PR ne relance rien** — GitHub émet une action `edited`, absente du trio par
  défaut `opened`/`synchronize`/`reopened`. Il faut un commit (un rebase suffit).

## 2. Ce qui est mergé, ce qui attend

| PR | Contenu | État |
|---|---|---|
| #1043 | Inventaire du socle (245 ressources mesurées) | **mergée**, déployée |
| #1044 | Bloquants pré-lancement 0.2 et 0.4 | **mergée**, gardes vérifiées en base ET en comportement |
| #1046 | Lots 0 et 1 complets + Lot 2 à 5/9 | **mergée** le 01.08, **14 migrations re-datées et déployées** |
| #1049 | Revue du Lot 1 — deux défauts d'affichage juste (Plans, Vue d'ensemble) | **mergée**, déployée |
| #1050 | Étape 23 — le contrat des gestes devient un balayage | **mergée** |
| #1051 | Cerveau — les huit gestes hors chaîne, et la méthode | **mergée** |
| #1054 | Revue du Lot 2 — **8 défauts corrigés** (dont 2 de sécurité), 2 garde-fous posés, 6 migrations. Détail au §7bis | **mergée le 01.08 à 18:26 UTC, DÉPLOYÉE et vérifiée en production** |
| #1057 | La dérive de schéma cesse de crier pendant le déploiement (faux positif mesuré sur le merge de #1054) | **mergée**, déployée |

Les quatre bloquants pré-lancement (dépendance **P6**) sont **fermés et vérifiés en
production** : 0.1 et 0.3 l'étaient déjà, 0.2 et 0.4 par #1044.

## 3. Avancement des étapes

**Lot 0 — complet.** 1 ✅ (mergée) · 2 ✅ `admin_log` · 3 ✅ entrée console + verdict de
session · 4 ✅ focus clavier · plus un **balayage de gardes** couvrant les 32 RPC admin.
Les trois critères de sortie **G0** sont couverts par des tests permanents.

**Lot 1 — 10 étapes sur 11.** 5 ✅ socle §4.2 · **6 ✅ instrumentation** · 7 ✅ Stripe · 8 ✅ activation ·
**9 ✅ vues** · **10 ✅ `admin_overview`** · 11 ✅ Live · 12 ✅ crons · 13 ✅ tunnel KYC ·
**14 ✅ Sécurité (tests écrits)** · **15 ✅ branchement + seed**.

**Le Lot 1 est livré côté code.** Ce qui reste avant de déclarer le gate **G1** ne dépend
plus de moi : la base de recette pour mesurer le p95, la démo PO, et **14b** (revue KYB en
lecture), suspendue à la dépendance **P5** — une maquette, pas du code.

**Lot 2 — 6 étapes sur 9.** **16 ✅ socle des gestes** · **19 ✅ diagnostic de lien KYC** ·
**20 ✅ relevé IA et dérives** · **21 ✅ changelog « What's new »** · **22 ✅ exports** ·
**23 ◑ contrat des gestes** (fait pour les gestes qui existent ; 17/18 restent bloqués).

⚠ **L'étape 23 a trouvé HUIT RPC super-admin qui écrivent hors du registre MEGGA.** Les
cinq décisions KYB, `set_role`, plan et quotas d'agence journalisent dans `activity_events`
— l'autre journal, celui des AGENCES : **sans chaîne d'empreintes**, et hors de l'écran
Sécurité, qui est pourtant la surface faite pour auditer MEGGA. Ce sont exactement les
gestes que 19b, 18 et la famille 17 promettent de brancher ; elles restent bloquées par des
décisions PO, donc 23 ne les corrige pas — elle les **nomme dans un cliquet**
(liste `DETTE` de [admin-gestes-sweep.spec.ts](../../tests/backend/admin-gestes-sweep.spec.ts))
qui rougit dans les deux sens. **En branchant 17/18/19b : retirer les lignes correspondantes**,
sinon la CI échoue avec le message qui le dit.

⚠ **Amendement de méthode, §10.7.** La spec dit « tests **par RPC** » ; j'ai livré un
**balayage**. Le défaut de clé d'idempotence brûlée avait traversé des specs qui testaient
pourtant l'idempotence — elles éprouvaient le chemin HEUREUX. Une liste écrite à la main
couvre les objets du jour et laisse le suivant sans filet. Le balayage définit son périmètre
par une **propriété**, se garde contre le vide, plafonne ses exceptions, et son détecteur est
**muté avant livraison**.

⚠ **L'étape 22 a trouvé la décision « aucun CSV » NON APPLIQUÉE.** §5.2 l'acte le 31 juil.
et le répète deux fois ; les maquettes n'en portent aucun. La console réelle en avait
**cinq** — Agences, Utilisateurs, Modération, Conformité, Sécurité — via `src/lib/exportCsv.ts`.
Personne n'avait menti : les boutons précédaient la décision, et rien ne rougissait. Les cinq
sont retirés, le helper supprimé, et un **garde-fou statique** défend désormais la décision
(muté : il rougit si un `.csv` réapparaît). Les deux exports autorisés restent, et le test
vérifie aussi leur PRÉSENCE — un garde-fou qui se contenterait d'interdire serait satisfait
par une console sans aucun export, ce qui n'est pas la décision.

⚠ **`admin_log_export` est distinct d'`audit-pdf-export`.** Le second exporte
`activity_events` — ce que font les AGENCES. Le premier exporte `admin_log` — ce que fait
MEGGA. Deux registres, deux publics ; le second n'avait pas à toucher au premier.

⚠ **L'extraction PRÉCÈDE la journalisation, et un test le prouve sans lire le code** : deux
extraits successifs sur la même fenêtre doivent différer d'exactement UNE ligne, celle que le
premier a écrite. Dans l'autre ordre, la ligne d'export entrerait dans son propre extrait
selon la seconde où elle tombe, et la même demande rendrait deux empreintes différentes —
une empreinte qui change toute seule ne signe rien.

⚠ **Deux défauts de l'existant corrigés à l'étape 21.** (a) `admin_changelog.published` avait
`DEFAULT TRUE` — sur un journal de nouveautés, une ligne insérée sans y penser était visible
de TOUS les agents. (b) Les deux policies testaient `profiles.role = 'super_admin'` **en
dur**, pas `is_super_admin()` : elles rataient donc la moitié **allowlist** du mur réel du
dépôt. La brèche était étroite (`profiles.role` n'est pas écrivable par le client) mais elle
divergeait de la règle que toute la console applique.

⚠ **`status` et `published` ne peuvent plus diverger** : c'est une CONTRAINTE, pas une
convention. `published` reste la vérité de la RLS et de la page Aujourd'hui, `status` porte
le workflow — « publié sans être publié » n'est pas représentable, et le test l'attaque en
écriture directe pour vérifier que c'est bien la BASE qui refuse.

⚠ **Amendement — une 5ᵉ RPC, `admin_changelog_delete`.** §5.10 en liste quatre
(save/publish/schedule/unpublish), sans suppression. Mais `useChangelog.ts` exposait déjà une
suppression par DELETE direct, que la fermeture de la table casserait. Retirer une capacité
qui marche n'était pas le sujet : la RPC la remplace, gardée et journalisée — strictement
mieux que de laisser passer un GRANT.

⚠ **Une seule clé d'idempotence sur cinq gestes, et c'est voulu.** `save` en prend une : sans
elle, un double-clic sur « Créer » produit deux entrées que rien ne distingue. Les quatre
transitions vérifient leur état de départ — l'ÉTAT est la clé, et il est plus juste qu'un
jeton d'appelant : deux super-admins qui publient la même entrée convergent.

⚠ **Amendement mesuré à l'étape 20 — la moitié « par compte » de §5.11 n'a AUCUNE source.**
§5.11 demande « médiane par COMPTE », « comptes à zéro appel avec raison », et la maquette
porte une vue « Par compte » plus une dérive « X pèse N× la médiane ». Or `ai_usage_logs`
n'a **aucune colonne d'utilisateur**, et ce n'est pas un oubli de schéma : `AIUsageInput`
n'en porte pas non plus, son commentaire dit « Agence à l'origine de l'appel (attribution
des coûts) ». Rien à agréger, et **rien à rattraper** — le passé ne contient pas
l'information. La rendre possible est un chantier d'**instrumentation** (comme l'étape 6),
pas une vue à écrire : ajouter `profile_id` ET le faire remonter par tous les appelants,
dont plusieurs (weekly-digest…) n'ont aucun utilisateur en contexte. Nommé dans
`unavailable`, avec un test qui rougira le jour où la colonne apparaîtra.

⚠ **`get_admin_ai_costs()` n'a PAS été recréée.** Elle rend déjà mois × agence × provider ×
module sur N mois — la moitié « usage » de `v_ai_month`. `get_admin_ai_month()` agrège à un
grain **différent** (mois × agence, avec part et médiane), que la première ne permet pas de
calculer sans re-agréger côté écran. Ce n'est pas un doublon, c'est l'étage au-dessus.

⚠ **Deux seuils à ne pas confondre** : la **dérive** est à 95 % du plafond (§7), l'**alerte**
à `alert_threshold_pct` (défaut 80, servie par `get_admin_quota_breaches`). Une alerte
prévient, une dérive demande un arbitrage. Un test les sépare explicitement.

⚠ **Amendement mesuré à l'étape 19 — la régénération ne peut PAS émettre le lien en SQL.**
Le handoff dit « en émet un nouveau ». Mesuré : le jeton final est un **HMAC-SHA256 signé en
Edge Function** (`signMagicLinkToken`, secret ≥ 32 car.), et la création se fait en trois
temps — insert d'un placeholder, signature qui inclut l'UUID de la ligne, update. Aucune
fonction SQL ne peut produire cette signature ; le secret n'est pas en base et n'a rien à y
faire. La RPC fait donc ce qu'une transaction peut faire — invalider, journaliser — et dépose
l'émission dans l'**outbox de l'étape 16**. C'est §10.2 appliqué à une signature plutôt qu'à
un appel HTTP. La réponse reste celle du handoff : succès + horodatage, jamais le lien.

⚠ **Quatrième argument ajouté à `admin_kyc_link_regenerate`** (`p_idempotency_key`), absent
du handoff : §10.2 l'impose sur toute RPC mutante. Sans elle, un double-clic invaliderait
deux fois et déposerait deux demandes — l'agence recevrait deux liens pour un signalement.

⚠ **Le plafond de débit ne s'éprouve qu'avec un vrai super-admin.** Il compte les lignes
d'`admin_log` où `actor_user_id = auth.uid()` ; sous `service_role`, `auth.uid()` est NULL et
`colonne = NULL` n'est jamais vrai — le compteur rendrait toujours 0 et le test serait creux.

**Ce que l'étape 16 a posé** — quatre primitives, aucun bouton activé : enveloppe d'erreur
§10.1 (`admin_error` / `admin_ok`, vocabulaire FERMÉ de 8 codes), verrou advisory par entité
(`admin_lock_entity`), idempotence (`rpc_receipts` + `admin_receipt_try` / `_seal`), outbox
(`outbox_jobs` + `enqueue` / `claim` / `settle`, backoff exponentiel borné et dead-letter).
**17 tests, verts du premier coup.** Les étapes 19, 20 et 21 s'en servent déjà.

Les étapes 17, 18 et 19b restent **bloquées par les décisions PO n° 3, 4, 5 et P4**. Reste
faisable sans elles : **22** (exports DSAR + PDF signé).

**L'étape 9 a surtout consisté à NE PAS créer.** §4.3 énumère douze vues ; six seulement
manquaient. `v_admin_kpis` n'a pas été créée — `get_admin_dashboard_stats()` rend déjà, en
production, les sept champs d'`ADMIN_KPIS` et rien d'autre, correspondance 1:1 avec la
maquette. `v_monitoring_board` non plus : `get_admin_monitoring_health()` +
`get_admin_ops_health_rpcs()` + `get_admin_cron_runs()` couvrent tout `ADMIN_HEALTH`.
`v_kyc_funnel_30d` et `v_security_journal` étaient déjà posées en fonctions (240000, 260000) ;
`v_diffusion_board`, `v_ai_month` et `v_changelog` appartiennent aux lots 2 et 3.
Livrées : `agency_mrr` (+ sa règle pure `agency_mrr_rule`), `get_admin_agencies`,
`get_admin_agency_detail`, `get_admin_users`, `get_admin_user_activity`,
`get_admin_plans_board`.

⚠ **Une erreur de l'étape 9, corrigée à l'étape 10** : le commentaire de `20260801280000`
citait `get_admin_ops_health_rpcs()` comme source de « fonctions en erreur ». **Cette
fonction n'existe pas** — ni en base, ni dans le dépôt. Le nom vient du plan, qui désigne
ainsi `20260705172000`, laquelle a en réalité créé `get_admin_syndication_health`,
`get_admin_whatsapp_health` et `get_admin_ai_costs`. Le fichier a été rectifié sur place
(il n'est ni mergé ni déployé). **Leçon** : citer une fonction sans l'avoir vue dans
`pg_proc` reproduit l'erreur du document qu'on recopie.

**L'étape 10 assemble, elle ne crée rien.** `admin_overview()` appelle
`get_admin_monitoring_health`, `get_admin_dashboard_stats`, `get_admin_kyc_funnel_30d`,
`get_admin_plans_board`, `get_admin_live_feed`, `get_cron_health` et
`get_admin_agency_review_queue` — jamais une requête recopiée, pour qu'une correction faite
une fois vaille partout. Le surcoût est leur garde rejouée cinq ou six fois, pas cent fois
par ligne comme au registre.

**Neuf migrations en attente**, toutes datées `20260731` :
`210500_admin_log` (⚠ **210500**, pas 210000 : main portait déjà ce numéro) ·
`220000_admin_console_session` · `230000_admin_console_lot1_socle` ·
`240000_admin_live_and_kyc_funnel` · `250000_activation_and_cron_runs` ·
`260000_admin_security_read` · `270000_admin_agency_note_and_invitations` ·
`280000_admin_console_read_views` · `290000_admin_overview`.

**Tests** : 56 specs dédiées à la console. CI complète verte sur `c1a178af` — **139 fichiers /
1 265 tests** en backend, **87 fichiers / 1 406 tests** en unitaire. Les specs des étapes 9, 10 et 14
exécutent respectivement **19**, **12** et **18** tests, le seed **7** et le garde-fou
d'instrumentation **3** : c'est le compte qui le prouve, pas le statut vert.

⚠ Le job backend a d'abord échoué sur `80418ece` **sans exécuter un seul test** :
« Setup Supabase CLI » est mort sur `rate limit exceeded` et « Run backend tests » a été
SKIPPÉ. C'est le flake connu, sans rapport avec le code — le lire comme un échec de test
aurait envoyé chercher un défaut inexistant. Remède : `gh run rerun <id> --failed`.

## 4. Décisions PO qui bloquent la suite

| # | Décision | Ce qu'elle bloque | Reco |
|---|---|---|---|
| ~~1~~ | ~~Support de la note d'agence~~ — **TRANCHÉE le 31.07** : table `admin_agency_notes` (migration `20260801270000`). ⚠ **Pas** une colonne `agencies.admin_note` comme d'abord recommandé : `agencies_members_select` donne à chaque membre la lecture de toute sa ligne, avec un GRANT de table, et un REVOKE de colonne ne protégerait rien (défaut mesuré sur `verification_*`). La note aurait été lue par l'agence. | ✅ débloquée | — |
| ~~2~~ | ~~Accès du super-admin aux invitations~~ — **TRANCHÉE le 31.07** : RPC `get_admin_agency_invitations(agency_id, limit)`, gardée, qui sert la fiche agence (argument fourni) ET le registre Utilisateurs (argument NULL). Ne rend jamais le `token`. | ✅ débloquée | — |
| 3 | **Enum `agency_plan`** = `starter\|pro\|agency\|enterprise` quand le catalogue dit `entreprise` → **`22P02` en production** sur toute création d'agence Entreprise | Lot 2 (étape 17) | convertir `agencies.plan` en `text` + CHECK, comme `subscriptions.plan` l'est déjà : supprime le 3ᵉ vocabulaire au lieu d'en ajouter un 4ᵉ. Colonne partagée avec le CRM. |
| 4 | **Q5 sièges** — divergence **TRIPLE** : `PLANS.team_members` 1/5/∞ · `PLAN_LIMITS.maxAgents` 1/1/10 · `send-team-invite` en dur 1/3/10/50 (**la seule qui s'applique**) | étape 17 | — |
| 5 | **Périmètre à démonter** — changement de plan et impersonation sont **livrés et branchés** alors que la spec les exclut ; 4 pages (Feature flags, Autonomie, Outils, Styles appris) sont hors carte sans décision écrite | Lot 2 et plan de nettoyage | — |
| ~~6~~ | ~~**`category` NULL sur 95 %**~~ — **REQUALIFIÉE le 01.08** : ce n'était PAS un héritage diffus. 4 616 lignes sur 4 858 venaient d'**un seul émetteur**, `match_suggested` (matching-engine), qui ne posait pas de catégorie. Corrigé, avec 14 autres émetteurs trouvés par garde-fou statique. Le passé reste nul (la table refuse l'UPDATE) : la reco « filtre limité aux événements postérieurs » tient, et devient propre. | ✅ le futur est classé | — |
| 7 | **Q3 rétention Live 30 j** — un trigger interdit toute suppression < 10 ans (LBA art. 7 al. 3) | — | ce n'est pas un réglage mais un arbitrage de conformité ; le levier réel est la fenêtre d'AFFICHAGE |

## 5. Amendements de spec à porter

- **§10.2 « journal d'abord » → « journal dans la même transaction »**. Le verrou de chaîne
  est tenu jusqu'au COMMIT ; journaliser en premier ne garantit rien de plus et croise
  l'ordre de verrouillage des RPC KYB : interblocage `40P01` au rétro-branchement. Règle
  d'ordre : **verrou d'entité PUIS verrou de chaîne**.
- **`admin_console_entry_audit` n'est pas une table** (6 mentions) — nom de fichier.
- **`agency_activity_summary_rpc`** → la fonction s'appelle `get_agency_activity_summary`.
- **`admin_integrations_health`** est une fonction, pas une table historisée : la bande 24 h
  par service de la maquette Monitoring **n'a aucune source**.
- **`admin_request_agency_correction`** prend un motif obligatoire (2 arguments).
- **La surface de revue KYB existe déjà** — P5/Q9 n'est pas une dépendance bloquante.
- **§4.3 « vues »** : `v_kyc_funnel_30d` et `v_security_journal` sont des FONCTIONS.
  PostgreSQL n'applique pas de RLS aux vues ; `security_invoker` rendrait à chaque agent les
  agrégats de son agence, et sans, tout `authenticated` lirait la plateforme entière.
  **Étendu à toutes les vues de l'étape 9** : le nom `v_*` de la spec désigne un contrat de
  lecture, jamais un `CREATE VIEW`.
- **§4.3 : deux des douze vues n'étaient pas à créer.** `v_admin_kpis` =
  `get_admin_dashboard_stats()`, déjà en production, dont les sept colonnes correspondent
  1:1 aux sept champs d'`ADMIN_KPIS`. `v_monitoring_board` = `get_admin_monitoring_health()`
  + `get_admin_ops_health_rpcs()` + `get_admin_cron_runs()`. Les chercher avant d'écrire a
  retiré deux objets du périmètre.
- **§5.7 : trois chiffres de la maquette n'ont AUCUNE source.** `ADMIN_BILLING.mrrTrend`
  (14 points d'historique), `revenue30d` et `churn` ne sont pas dérivables : le dépôt ne
  garde aucun historique de MRR — `subscriptions` ne conserve que l'état courant, sans
  versions, et aucune table de revenu n'existe. Les fabriquer aurait produit une courbe
  crédible et fausse. `get_admin_plans_board()` les NOMME dans son champ `unavailable`
  plutôt que de les taire (un champ absent se lit « bug », un champ qui se nomme se lit
  « pas encore »). Même geste que la bande 24 h de Monitoring, déjà amendée faute de source.
- **§5.7 : la file « sièges saturés » n'est pas calculée**, et c'est délibéré — elle exige un
  plafond de sièges, objet de la décision PO n° 4 (encore ouverte), et §5.7 dit lui-même
  « plafond de sièges APRÈS arbitrage ». En choisir un aurait tranché en silence une
  question posée au PO. `seats_used` est rendu par agence : le jour de l'arbitrage, la file
  se calcule sans nouvelle mesure.
- **§5.1 : deux des quatre signaux « À traiter » n'ont pas de source telle quelle.** Il
  n'existe **aucun système de tickets** (ni table, ni un seul `activity_events` d'action
  `ticket_created` depuis la création de la table) : le signal est déclaré manquant, pas
  simulé. Et le « retard » d'un cron exigerait d'interpréter une expression cron en SQL ;
  ce qui se mesure sans rien interpréter, c'est le dernier **statut** — d'où `crons_failed`,
  sur lequel le pouls se fonde. Les deux manques sont nommés dans `unavailable`.
- **§5.1 : le signal KYB est AJOUTÉ à la maquette**, qui précède le module. La spec tranche
  qu'il « a droit de cité » ici parce qu'il concerne les agences **clientes**, pas les
  clients finaux des agences — la frontière que tout cet écran défend.
- **§5.1 : `errors_24h` et `functions_err` vaudront 0 tant que l'étape 6 n'aura pas fini.**
  L'action `edge_function_error` que `get_admin_monitoring_health()` compte n'est émise
  **nulle part** aujourd'hui (zéro ligne mesurée). La plomberie est juste, la source se
  remplira — ce n'est pas une panne à diagnostiquer.
- **§4.3 « MRR » : deux objets et non un.** `agency_mrr_rule(...)` porte la règle, pure et
  IMMUTABLE ; `agency_mrr(uuid)` est l'entrée nommée par la spec, qui garde puis délègue.
  Motif : la garde appelle `is_super_admin()`, qui joint `profiles` à `auth.users` — une
  jointure d'authentification par agence affichée, pour un verdict déjà rendu à l'entrée de
  la fonction appelante. La règle reste écrite une seule fois, ce qu'exige §4.3.

## 6. Pièges du dépôt, mesurés dans ce chantier

1. **`execSql` tourne en `postgres`.** `set local role` change `current_user`, jamais
   `session_user`. Une RPC gardée ne s'éprouve depuis psql que si sa garde admet `postgres`
   — c'est-à-dire les fonctions de **cron** seulement. Les autres se testent avec un client
   authentifié ou `service_role`.
   **Piège le plus récurrent du chantier : quatre passes de CI perdues dessus**, dont une
   APRÈS l'avoir écrit dans ce document. Réflexe à prendre : avant d'appeler une RPC dans un
   bloc `assertSql`, vérifier que sa garde contient `session_user`. Sinon, `serviceRoleClient()`.
   Contrôle rapide sur un fichier de spec :
   `grep -n "public\.\(get_\|admin_\)" tests/backend/<fichier>.spec.ts` — chaque appel
   dans un gabarit SQL est suspect.
2. **`service_role` n'échappe pas aux GRANT.** `rolbypassrls` ne contourne que la RLS : un
   `revoke` retire réellement le SELECT, et la lecture rend `null` **sans erreur**.
3. **Créer une agence émet un `activity_events`** (`trg_agency_created`), et la table refuse
   l'UPDATE comme le DELETE. Corollaire produit : **aucune agence de moins de 30 jours ne
   peut être `dormant`**.
4. **`deno check` est le seul filet des edge functions** — hors `tsc`, hors vitest.
5. **`pg_trgm` vit dans `extensions`**, invisible sous `search_path = public, pg_temp` :
   `42883` à l'exécution, pas à la création. `unaccent` est dans `public` mais **absente
   d'une base fraîche** → `create extension if not exists`.
6. **`count(*) over ()` est interdit** (`20260729160000`, mesures à l'appui) : il rend
   l'index de tri inutilisable. Sous-requête scalaire.
7. **Un prédicat d'index partiel doit être un LITTÉRAL** — d'où deux fonctions (journal /
   routine) plutôt qu'une paramétrée.
8. **`greatest()` seul est un plancher**, jamais un plafond.
9. **Muter un test de garde avant de le livrer.** Un test de ce chantier était creux : son
   motif matchait dans un **commentaire CSS**. Retirer la vraie protection le laissait vert.
10. **Le piège 9 a une variante SQL, et elle est PIRE — elle se déclenche au moment du
    correctif.** Un contrôle statique sur `prosrc` (position de deux motifs, présence d'un
    appel) lit aussi les **commentaires** de la fonction. Or un bon correctif DÉCRIT le
    défaut qu'il répare, en haut de la fonction, avec les mots du défaut. Mesuré sur
    `admin_log_export` : « le compte et `jsonb_agg` vivaient dans le même select » plaçait
    `jsonb_agg` en position 1062 contre 1159 pour le plafond — le test rougissait sur la
    fonction CORRIGÉE. Parade : `regexp_replace(prosrc, '--[^\n]*', '', 'g')` avant toute
    recherche. Une porte statique doit lire ce qui s'**exécute**, pas ce qui s'**explique**.
11. **Faire journaliser une fonction la fait ENTRER dans le contrat des gestes.** Le
    périmètre `GESTES` se définit par « SECURITY DEFINER qui écrit au registre ». Ajouter
    `admin_log_write` à `changelog_publish_due` — correction juste — l'y a fait entrer, où
    il violait l'enveloppe §10.1 (il rend un `integer` à pg_cron, pas un `jsonb` à un
    écran) : **deux tests cassés d'un coup**, dont le plafond d'exceptions. Réflexe : quand
    on branche la journalisation sur une fonction, vérifier ce que le balayage va lui
    imposer. Ici le périmètre a gagné `has_function_privilege('authenticated', …)` — les
    contrats balayés décrivent ce que la CONSOLE appelle, et un cron n'a pas d'écran à qui
    rendre une enveloppe. Une PROPRIÉTÉ, jamais une exemption nommée.

12. **Aucune porte ne surveille la dérive des PRIVILÈGES.** `check:drift` compare bien ce que
    les fichiers déclarent à ce que la base contient — mais son en-tête EXCLUT explicitement
    policies, triggers et GRANT (« leur absence ne se lit pas dans un simple
    `information_schema` »). Mesuré le 01.08 : `anon` détient `SELECT` sur `admin_changelog`
    **en production**, et **aucune migration du dépôt ne l'accorde**. Conséquence pratique
    qui pique : la base FRAÎCHE de CI ne reproduit pas le défaut, donc un test de fuite y est
    vert avant comme après le correctif — il ne peut être qu'un **cliquet**, jamais une
    démonstration. Réflexe : pour tout ce qui touche aux droits, mesurer en PROD
    (`has_table_privilege`, `pg_policy.polroles`) et ne jamais conclure depuis la CI.
    ⚠ Ampleur mesurée, et moins alarmante qu'un premier chiffre le laissait croire : 79
    tables lisibles par `anon` au sens du GRANT, 30 avec une policy `select` non scopée par
    rôle, mais **une seule** dont le `USING` ne dépend d'aucune identité (`translation_cache`,
    `using (true)`, vraisemblablement voulu). Pour les 28 autres le `USING` teste l'agence :
    `anon` n'y lit rien. Une policy « ouverte » n'est donc PAS une fuite — c'est la clause
    `USING` qui tranche, et il faut la lire branche par branche (celle d'`admin_changelog`
    était `published = true OR is_super_admin()` : la première branche suffisait).
    ✅ **FERMÉ le 01.08** — `scripts/check-privilege-drift.mjs`, branché sur
    `migration-drift.yml` (le seul workflow qui interroge la PRODUCTION ; un test sur base
    fraîche ne peut pas voir une dérive de prod, par construction). Propriété étroite à
    dessein : **aucune table interne n'accorde quoi que ce soit à `anon`** — pas de
    comparaison déclaré/présent (79 tables sont anon-lisibles au sens du GRANT, crier sur
    les 79 serait crier au loup), pas de lecture des clauses `USING`. Prédicat structurel
    (`admin\_%` + courte liste) + garde anti-contrôle creux (< 10 tables = échec).
    ⚠ **Ce que la porte a trouvé en la posant** : SIX tables internes accordaient des droits
    à `anon`, dont **CINQ avec `DELETE, INSERT, UPDATE, TRUNCATE`** — y compris `app_config`,
    qui porte `service_role_key`. Aucune migration ne les accordait : droits par défaut de
    Supabase, jamais révoqués. Révoqués par `20260801410000`, après avoir vérifié qu'aucune
    surface publique ne lit ces tables (une lecture bloquée par la RLS rend `[]`, bloquée par
    le GRANT elle rend une ERREUR — révoquer transforme un silence en erreur visible).

13. **La CI a DEUX rouges qui ne sont pas du code, et ils se ressemblent.**
    (a) **`esm.sh` répond 522.** L'étape `deno check` du job `Unit Tests` télécharge les
    dépendances des 134 Edge Functions ; un 522 sur `@supabase/supabase-js@2` tue le job
    **avant qu'une seule assertion ait tourné**. Vu deux fois le 01.08 en une heure. Signal
    qui le distingue d'un vrai rouge : l'échec porte sur un fichier absent du diff, et le
    commit ne contient parfois que du markdown. Remède : `gh run rerun <id> --failed`.
    (b) **La course des 180 s.** `migration-drift.yml` attend 180 s fixes avant de sonder la
    production, mais `deploy.yml` enchaîne `npm ci`, `tsc -b`, `eslint` et `vite build`
    AVANT d'appliquer les migrations, et il est sérialisé par `concurrency`. Mesuré sur le
    merge de #1054 : le contrôle a réclamé `get_agent_changelog` et
    `kyc_magic_links.email_sent_at` comme absents, alors qu'ils sont arrivés quelques
    minutes plus tard. **Les deux contrôles du workflow remesurent désormais** jusqu'à dix
    fois avant de conclure — l'assertion n'est pas relâchée, elle est patiente.
    ⚠ La leçon vaut au-delà : dans les deux cas, un rouge d'INFRASTRUCTURE se lit comme un
    rouge de code, et c'est ainsi qu'un garde-fou perd sa crédibilité. Le fichier voisin le
    disait déjà — « un garde-fou qui crie sans raison finit ignoré, donc muet le jour où il
    a raison ».

## 7. Reprendre

✅ **La revue est passée, #1046 est mergée, les 14 migrations sont déployées.** Cette section
garde sa valeur de mémoire : elle dit ce que la revue a trouvé, et la procédure §8 reste la
référence pour la prochaine vague de migrations.

**Ce qui est ouvert et ne dépend d'aucune décision PO :**

| Étape | Ce que c'est | État au 01.08 |
|---|---|---|
| **27** | Endpoint agent « What's new » (§5.10) | **◑ backend livré** (`20260801380000`) — `get_agent_changelog()` + fermeture de la fuite `anon`. La CARTE agent est bloquée : la maquette désignée (`today-h-live.jsx`, `HL_NEWS`) **n'existe pas au dépôt**, la pilule « Nouveau » n'a **aucune source** (pas d'état lu/non-lu, et §5.10 interdit d'emprunter celui de `platform_announcements`, Q10), et `PageAujourdhui` est un pager **zéro-scroll** plafonné à 760 px portant déjà trois bandeaux. |
| **28** | Gestes d'exploitation (§5.8) | **⛔ sous-spécifiée, non écrite.** `function_replay` n'a **rien à rejouer** (aucune trace d'invocation d'edge ; `activity_events/edge_function_error` ne garde que `function_name`, `error`, `duration_ms`) — et le plan dit « replay » quand la maquette écrit « Relance demandée », c'est-à-dire **re-planifier**. `wa_deadletter_replay` **n'est pas dans la maquette**, qui offre « Examiner » ; or son README pose que les libellés sont **définitifs**. `calendar_resync` n'a **aucun chemin serveur** (les deux edges refusent tout appelant non propriétaire). ⚠ `admin_lock_entity` exige un **uuid**, qu'un `jobname` de cron n'a pas. ✅ Aucun des quatre n'a besoin de l'outbox : **`pg_net` EST déjà une outbox transactionnelle**. |
| **30** | Surveiller le surveillant (§10.9) | **⛔ sous-spécifiée, non écrite.** Le mécanisme d'alerte **existe entièrement** (`_shared/admin-alerts.ts`, 9 règles à l'époque de ce constat, **11 depuis** — voir plus bas) : c'est un signal à y brancher. Manquent une règle sur le silence d'`activity_events`, un prédicat « heures ouvrées » **plateforme** (aucun calendrier de fériés suisses au dépôt), un cron hebdo sur `admin_log_export`. ⚠ « hors projet » et « chiffré » **ne sont définis nulle part**, et **aucun canal d'alerte hors projet n'existe** — tout tourne dans Supabase, donc tout est muet si Supabase tombe, ce qui est précisément le cas visé. ✅ **Gain PRIS le 01.08** (`20260801390000` + règle 10 d'`admin-alerts.ts`) : une rupture de chaîne est désormais notifiée. ⚠ Il a d'abord fallu réparer un **faux positif** — mesuré en prod, l'unique ligne `crit` du registre était un registre VIDE, le job traduisant `case when status = 'ok' then info else crit` alors que le vérificateur rend TROIS statuts. Et la règle **lit un bilan publié dans `app_config`** au lieu de rappeler la vérification : la rappeler referait un SHA-256 par ligne sur tout le registre une 2ᵉ fois par heure, et `service_role` n'a de toute façon **pas** de SELECT sur `admin_log` (un `.from()` aurait rendu `null` SANS erreur — alerte muette). ⚠ **Limite qui demeure** : l'alerte part de Supabase par Resend, donc muette si Supabase tombe — c'est le cas même que §10.9 vise. **L'étape 30 reste ouverte.** |

Bloquées par les décisions PO 3/4/5 et P4 : **17, 18, 19b**. Par la maquette P5 : **14b**.
Par P3 : **24, 25, 26**.

**Dette d'après-merge, à solder quand la console sera stabilisée :** régénérer
`src/types/database.ts` puis retirer les clients castés (`supabase as unknown as
SupabaseClient`) de `useAdminAgencies`, `useAdminUsers`, `useAdminBilling`, `useChangelog` —
les RPC du chantier n'étaient pas dans les types générés au moment du branchement.

### Ce que la revue a rendu (01.08)

**Deux défauts, corrigés dans `670ee59c`** — sur des migrations jamais déployées, donc repris
sur place :

1. **`admin_log_verify_chain` n'avait qu'une borne BASSE.** Un extrait signé portait un
   verdict couvrant des lignes qu'il ne contenait pas (`rows_checked` ≠ `count`, `last_seq`
   hors extrait), et le coût croissait avec l'**âge** de la fenêtre, pas sa taille. Sur une
   fenêtre valide mais **vide**, `min(seq)` vaut NULL : la borne disparaissait et l'appel
   relisait le registre ENTIER — ce que le plafond de 5000 lignes existe précisément pour
   éviter. `p_to` ajouté, plus un champ `bounded` qui dit sur quoi le verdict porte.
2. **Une erreur métier consommait la clé d'idempotence.** `admin_receipt_try` était appelée
   avant les contrôles dans `admin_kyc_link_regenerate` et `admin_log_export` ; un
   `return admin_error` COMMITTE, donc la clé restait brûlée par un geste qui n'avait rien
   fait, et le réessai répondait `already_done` — un faux succès. Sur la régénération de lien
   KYC, l'écran annonçait un lien réémis alors que rien n'était parti dans l'outbox.

**Vérifié sain, mesuré et non supposé** : 44 fonctions accordées / 44 révoquées de `PUBLIC`
(aucune fuite par grant par défaut), 9 tables créées / 9 avec RLS, chaque `SECURITY DEFINER`
a son `search_path`, idempotence verte (232 migrations), CI verte **sur le SHA exact**
(139 fichiers / 1 265 tests backend, comptés et non lus au statut).

⚠ **Un faux positif à ne pas re-trouver** : `count(*) over ()` apparaît bien dans
`240000` (étape 11) alors que le dépôt l'interdit — mais `260000` **redéfinit**
`get_admin_live_feed` avec une sous-requête scalaire. L'état final est correct ; c'est
l'état intermédiaire qui trompe.

**Restent ouverts, non bloquants** : la clé d'idempotence du changelog est générée par
tentative côté client (`crypto.randomUUID()` dans `mutationFn`), donc elle ne peut jamais
entrer en collision — ce qui protège aujourd'hui est le démontage de la modale, pas le
mécanisme ; et `useAdminBilling.churnedThisMonth` compte tous les `canceled` sans borne de
date alors que le serveur nomme `churn` dans `unavailable`.

**Les cinq points où je regarderais en premier**, parce que ce sont ceux où je suis le moins
sûr de moi — et non les plus gros morceaux :

1. **Les quatre hooks à client casté** — `useAdminAgencies`, `useAdminUsers`,
   `useAdminBilling`, `useChangelog` font `supabase as unknown as SupabaseClient` parce que
   les RPC ne sont pas encore dans `src/types/database.ts` (auto-généré, et son en-tête
   interdit l'édition à la main). C'est le patron du dépôt (`useAdminKybReview`), mais **le
   typage ne vérifie plus rien** sur ces appels : les formes de retour sont re-typées À LA
   MAIN, donc une colonne renommée en SQL ne ferait rougir personne. À régénérer et nettoyer
   dès le merge fait.
2. **Le retrait des cinq exports CSV** (étape 22) — c'est le SEUL endroit où j'ai supprimé
   une capacité visible par un utilisateur. La décision est écrite deux fois dans la spec et
   absente des maquettes, mais elle datait du 31.07 et les boutons étaient plus anciens :
   vaut-il la peine de confirmer que personne ne s'en servait ?
3. **Les 14 migrations n'ont JAMAIS tourné en production** — seulement sur base fraîche en
   CI. C'est le gros de la surface, et c'est là que le risque se concentre. Voir aussi §8.
4. **`admin_changelog` (étape 21)** — la migration ferme la table en écriture, or le
   `useChangelog.ts` **déployé** fait encore un INSERT direct. Migration et front doivent
   donc arriver ENSEMBLE ; c'est le seul couplage d'ordre du lot.
5. **Les deux clés d'action en FRANÇAIS** laissées en place (`MEGGA AI — ${action}` dans
   ai-copilot, `Photos certifiées C2PA` dans c2pa-sign). Je ne les ai pas corrigées :
   changer une clé d'action orpheline les lignes déjà écrites et les libellés i18n qui les
   visent. C'est une décision de contrat — à trancher, pas à oublier.

⚠ **Pour chercher dans le cerveau, greper le seed JSON.** La recherche sémantique ne
déduplique pas : elle a dix places et **une seule entrée les rafle** (mesuré le 01.08 —
`memory search -q "console admin"` rend dix fois `megga/super-admin` et jamais
`megga/console-admin-backend`). Un « rien trouvé » ne prouve donc RIEN. Les entrées du
chantier sont `megga/console-admin-backend` et `megga/console-admin-defauts-dormants`.

**Étape 15 — premier volet livré : le seed.** `scripts/seed-admin-staging.mjs` applique un
jeu **pur et déterministe** (`scripts/_shared/admin-staging-seed.mjs`) : 14 agences,
56 comptes, les **trois** plans C2. Éprouvé par 7 tests unitaires, sans base.

- ⚠ **Deux verrous, dont un non négociable** : la référence du projet de PRODUCTION est
  refusée EN DUR avant toute écriture, et `--confirm` est obligatoire. Le script crée des
  agences fictives ; en production elles apparaîtraient dans le CRM d'un client et dans le
  MRR, et `activity_events` refuse le DELETE — il n'y aurait pas de retour en arrière
  propre. Les trois chemins de refus sortent en `exit=1`, vérifié.
- ⚠ **Amendement — les « 2 échelles Diffusion » de l'étape 15 ne sont pas seedées.** Elles
  supposent `listing_signals`, qui n'existe pas : la Diffusion est du **Lot 3** (étape 24).
  Rien à semer avant que la table existe.
- Le jeu couvre délibérément tous les états d'écran : essai, impayé, résilié, sans
  abonnement, agence suspendue (la règle de MRR §4.3), agence assez ancienne pour être
  dormante, « invité jamais connecté », compte inactif au-delà de 30 jours, les 4 rôles.

**Étape 15 — second volet : le branchement.** Trois hooks passent aux RPC consolidées, en
gardant leur forme exportée pour ne pas churner les pages :

| Hook | Avant | Après |
|---|---|---|
| `useAdminAgencies` | 3 allers-retours (`agencies` + `get_agency_stats` + `subscriptions`) | **1** — `get_admin_agencies()`, plus MRR / score / statut KYB |
| `useAdminUsers` | 2 allers-retours (`profiles` puis `agencies`) | **1** — `get_admin_users()`, plus les champs §5.4 |
| `useAdminBilling` | **MRR recalculé en TypeScript** | `get_admin_plans_board()` |

⚠ **Une divergence réelle, fermée.** L'ancien `useAdminBilling` ne comptait que
`subscriptions.status` et **ignorait les agences suspendues**, qu'`agency_mrr_rule` met à
zéro. Une agence suspendue à l'abonnement actif était donc facturée à l'écran et pas en
base. C'est précisément ce que §4.3 interdit — « une seule fonction SQL, jamais recalculée
côté front ». Ses prix n'étaient pas faux (il lisait bien C2) ; c'est la RÈGLE qui était
dupliquée, et les deux copies avaient déjà divergé.

⚠ **Client casté, volontairement.** Les nouvelles RPC ne sont pas dans
`src/types/database.ts` (auto-généré, en retard sur des migrations non mergées — son en-tête
interdit l'édition à la main). Patron déjà en usage : `useAdminKybReview.ts`,
`useAgencyFollowupSuggestions.ts`. **À nettoyer à la première régénération après le merge**
(`supabase gen types typescript`).

**Ce qui n'est PAS branché, et pourquoi.** `useAdminStats` passe déjà par une RPC unique et
ne viole rien : le rebrancher sur `admin_overview()` ferait payer le journal, le poste de
triage et le tunnel KYC à une page qui ne demande que sept compteurs. La Vue d'ensemble
consomme donc encore `get_admin_dashboard_stats` + une requête d'alertes séparée ; la brancher
sur `admin_overview()` est un travail de PAGE, pas de hook, et appartient à la passe UI.

**Reste** : la base de recette (100 agences / 1 M d'événements) pour mesurer le
**p95 < 300 ms** de l'étape 9, et la démo PO du gate **G1**.

⚠ C'est la seule étape du Lot 1 dont le plan AUTORISE un diff des `admin-*.jsx` (§5 du
plan : exceptions 4, 15, 31). Toutes les autres exigent un diff vide.

⚠ **Neuvième piège, mesuré à l'étape 9** : une RPC dont le nom ne commence ni par `admin_`
ni par `get_admin` sort du balayage de gardes par son seul nom. `agency_mrr` — nommée ainsi
par la spec — a dû être ajoutée à la main au `SCOPE` de
[admin-rpc-guard-sweep.spec.ts](../../tests/backend/admin-rpc-guard-sweep.spec.ts). Toute
future RPC de console au nom non préfixé doit y entrer explicitement, sinon elle est
protégée sans que rien ne le vérifie.

⚠ **Douzième piège — une fenêtre de test qui déborde rend le test creux.** Le garde-fou
d'instrumentation cherchait `category` dans les 1 400 caractères suivant un insert. Dans
`kyc-screening`, deux inserts se suivent de plus près : la catégorie du SECOND satisfaisait
la fenêtre du PREMIER, et retirer celle du premier laissait le test vert. **Seule la
mutation l'a montré** — le test passait, sur du code sain comme sur du code cassé. La
fenêtre s'arrête désormais au prochain émetteur. Corollaire : muter n'est pas optionnel, et
il faut vérifier que la mutation a bien MODIFIÉ le fichier avant de conclure.

⚠ **Onzième piège — « ✅ » ne voulait pas dire « éprouvé ».** Les étapes 11 et 13 étaient
cochées sur des migrations qui s'appliquent, pas sur des fonctions qui répondent :
**aucune spec du dépôt n'appelait `get_admin_kyc_funnel_30d` ni `get_admin_live_feed`**
avant l'étape 10. Or `get_admin_kyc_funnel_30d` levait `42804` à CHAQUE appel —
`percentile_cont` rend un `double precision` là où la colonne était déclarée `numeric`.
Une migration qui s'applique ne prouve que la **syntaxe** : plpgsql ne vérifie les types du
corps qu'à l'exécution. Corrigé dans `240000` (non mergée, donc reprise sur place), et les
deux fonctions ont désormais un test d'appel DIRECT dans
[admin-overview.spec.ts](../../tests/backend/admin-overview.spec.ts) — les couvrir
incidemment aurait montré la panne sans la situer. **À vérifier pour toute étape cochée :
une spec l'appelle-t-elle vraiment ?**

⚠ **Dixième piège, mesuré à l'étape 10** : `category` étant NULL sur 95 % d'`activity_events`
(décision 6), un filtre écrit `category <> 'kyc'` écarte **aussi tous les NULL** — le
journal se vide en silence en croyant ne retirer que la conformité des clients finaux. La
forme correcte est `is distinct from`. Le même piège attend tout filtre d'exclusion posé sur
une colonne majoritairement nulle.

### Ce que la revue du LOT 2 a rendu (01.08)

Portait sur les étapes 16, 19, 20, 21, 22 — livrées **et déployées**, jamais relues. Tout
est parti de `pg_get_functiondef`, jamais du fichier de migration.

**Quatre défauts corrigés** (migration `20260801360000`, deux objets touchés) :

1. **L'empreinte de l'extrait dépendait du FUSEAU de la session.** `admin_log_export`
   signait `jsonb_build_object('ts', l.ts)` — un timestamptz nu se rend dans le fuseau de la
   session. Mesuré sur les lignes réelles : `84c3ff3e…` en UTC, `c01b7b0d…` en
   Europe/Zurich, mêmes données. Le dépôt connaissait pourtant le piège :
   `admin_log_payload_v1` s'en défend nommément, ce qui immunisait la chaîne — mais pas
   l'extrait. ⚠ **Le test qui aurait dû l'attraper s'appelle « l'empreinte est
   REPRODUCTIBLE » et ne le pouvait pas** : ses deux appels passent par le même client, donc
   le même fuseau. Même angle mort que les specs d'idempotence qui n'éprouvaient que le
   chemin heureux. Le `ts` de l'extrait est désormais rendu au format EXACT de la charge de
   chaîne, ce qui permet en prime de recalculer chaque hash sans accès à la base.
2. **Le plafond de 5000 lignes était évalué APRÈS l'agrégat qu'il doit empêcher.**
   `count(*)` et `jsonb_agg` vivaient dans le même select : l'array complet était matérialisé
   avant que `too_many` ne puisse refuser. Le plafond existe contre le statement timeout
   (8 s sur `authenticated`) — il ne pouvait pas l'éviter. L'appelant recevait un timeout,
   jamais `too_many`.
3. **Le plafond ne bornait pas la marche de chaîne sous filtre de famille.** Une chaîne ne se
   vérifie que sur un intervalle CONTIGU de `seq` : `admin_log_verify_chain` relit donc
   toutes les familles entre les bornes — correct, et nécessaire. Mais le plafond ne portait
   que sur le compte FILTRÉ : une famille creuse sur une fenêtre large passait (50 ≤ 5000)
   puis faisait un SHA-256 par ligne sur tout l'intervalle. **Même cause que le défaut de
   fenêtre vide corrigé à la revue du Lot 1**, dont le commentaire nommait pourtant ce
   cas — « une famille filtrée sur une période calme ». Le sous-cas `v_n = 0` avait été
   traité, le cas creux non. Corollaire réglé au passage : `rows_checked` et `count` étaient
   rendus côte à côte en décrivant des populations différentes ; le verdict porte désormais
   `extract_rows`.
4. **Une publication PROGRAMMÉE ne laissait aucune ligne au registre.**
   `changelog_publish_due` (cron `*/10`) rend une nouveauté visible de TOUS les agents ; le
   geste manuel identique journalise en `warn`. Le seul chemin de publication qui atteint
   tout le monde était donc le seul invisible à l'écran Sécurité, et hors chaîne
   d'empreintes.

⚠ **Le cliquet de l'étape 23 ne pouvait pas voir le n° 4**, et c'est le vrai enseignement :
son périmètre s'écrivait `proname ~ '^admin_'`, une convention de **nom**, là où le reste du
fichier définit ses périmètres par une **propriété**. Rejoué avec la propriété (« écrit dans
une table de la console sans `admin_log_write` »), il sortait exactement une fonction —
celle-là. Périmètre élargi ; la liste `DETTE` reste à huit, inchangée.

**Vérifié sain, mesuré et non supposé** : le socle de l'étape 16 en entier (vocabulaire
d'erreur fermé, verrou de transaction à deux clés, atomicité par la primary key), l'ordre
clé-après-contrôles sur les trois RPC concernées, `unaccent` bien en `public`,
`submitted`/`expired` de vrais labels d'enum et `expired_at` une vraie colonne,
`prev_hash`/`hash` en `NOT NULL` — donc pas de trou NULL dans le `<>` de la vérification —
et les contraintes `status`/`published` du changelog.

**Deux constats laissés OUVERTS parce que ce sont des décisions, pas des correctifs :**

- ~~**`admin_kyc_link_regenerate` détruit le lien et rien ne le réémet.**~~ **TRANCHÉ le
  01.08, migration `20260801370000`.** La RPC n'expire plus. Elle dépose le job avec
  `expire_previous: true` — l'invalidation n'est pas abandonnée, elle est **déplacée** chez
  celui qui frappera le nouveau jeton, pour arriver dans le même souffle. Le registre écrit
  désormais `kyc_link_regenerate_requested` et la réponse dit `emission: 'pending'`.
  La décision s'appuie sur une **mesure**, pas sur un goût : les sept documents de spec ne
  décrivent QU'UN scénario, « la cliente n'a jamais reçu son lien » ; aucun ne parle d'un
  lien compromis à tuer, et « invalider » n'y apparaît qu'une fois, comme conséquence de la
  réémission. Sous ce scénario, expirer sans remplacer est le pire des trois états.
  ⚠ **Le worker d'outbox reste à bâtir** — la réémission est donc EN ATTENTE, mais plus rien
  n'est détruit et plus rien de faux n'est scellé.
  ⚠ **Correction d'une estimation trop rapide (01.08)** : j'avais écrit que le worker
  « coûte bien moins cher qu'estimé » parce que `executeSendKycLink` frappe déjà un jeton en
  service-role. C'est vrai de la MÉCANIQUE et faux du travail : **le worker est bloqué par
  une décision, pas par un coût.** Le préflight a lu les 25 fichiers du corpus — « remettre
  le lien à l'agence » n'est défini NULLE PART. La spec ne dit que ce que ce n'est pas :
  pas d'envoi au client par la plateforme, pas de jeton ni d'URL dans la réponse, pas
  d'envoi sortant depuis la console, et rien de conservé côté console à la fermeture de la
  modale — ce qui ferme aussi la console comme lieu de dépôt. **Trois lieux interdits, aucun
  désigné** ; aucun destinataire (ni `agencies.email`, ni `created_by`, ni MLRO : zéro
  occurrence), aucun canal. La maquette annonce la remise comme un fait accompli sans dire
  par quel mécanisme.
  📊 **Mesure qui rend la décision tranchable** : **9 agences actives sur 10 n'ont AUCUN
  e-mail**, alors que **7 profils sur 7** en ont un. Une remise par `agencies.email`
  échouerait donc pour 90 % des agences.
  ✅ **Précédent le plus proche, à reprendre tel quel** : `agency-verification-notify` écrit
  aux profils `admin`/`manager` de l'agence, **replie sur `agencies.email`**, et journalise
  un `..._undeliverable` quand personne n'est joignable — plutôt que de laisser l'envoi
  disparaître.
  ✅ **Livré en attendant (règle 11 d'`admin-alerts.ts`)** : l'absence de consommateur cesse
  d'être SILENCIEUSE. `outbox:stuck` (jobs dus depuis > 6 h que personne n'a pris) et
  `outbox:dead` (le socle promettait qu'ils remontent au Monitoring ; rien ne les y
  remontait). Sans `count: 'exact'` — interdit par §7 de CLAUDE.md sur une table qui peut
  grossir, et une file sans consommateur est celle-là — et filtré sur `next_retry_at`, la
  colonne de l'index partiel, qui dit « dû depuis ».
- **Le plafond 3 compte des LIENS, pas des personnes.** Un contact portant 4 liens déclenche
  `too_many`, alors que la justification du plafond est de ne pas nommer de **personnes**.
  C'est le cas d'usage central qui saute : une cliente qui n'a jamais reçu son lien est
  exactement celle à qui on l'a réémis plusieurs fois. Le test du plafond sème 4 contacts
  DISTINCTS — il prouve qu'on arrête 4 personnes, jamais qu'on laisse passer une personne à
  4 liens. **À trancher** : « correspondance » désigne-t-elle un lien ou une personne ?

### Cinq défauts du chemin KYC, trouvés en instruisant la décision ci-dessus

Hors périmètre de la revue — ils vivent dans le tunnel KYC agent, pas dans la console — mais
ils décident de ce que l'étape 19 peut réellement faire. **Aucun n'est corrigé.**

1. ~~**`sent_at` ne veut pas dire « envoyé ».**~~ **CORRIGÉ le 01.08, migration
   `20260801400000`.** `sent_at` est un `DEFAULT now()` posé à l'INSERT qu'aucun code ne met
   jamais à jour : il valait la même chose que Resend ait répondu 200, 502, ou n'ait jamais
   été appelé. Le champ que le diagnostic remettait comme preuve d'envoi ne distinguait pas
   « envoyé » de « jamais parti ».
   **La correction est ADDITIVE, et c'est le point à retenir** : `email_sent_at` (nullable)
   est écrite par `magic-link-send-email` après le 200 de Resend, et `admin_kyc_link_lookup`
   la remet à la place de `sent_at` — à nombre de champs constant, pour ne pas élargir ce que
   la console divulgue.
   ⚠ **Corriger `sent_at` en place aurait cassé quatre choses**, mesurées avant d'écrire :
   la contrainte `expires_at > sent_at` ; `get_admin_end_user_stats`, qui filtre
   `where sent_at >= v_month_start` — une **cohorte mensuelle** qui aurait perdu des lignes
   SANS erreur, dans une fonction de stats que personne ne recoupe ; et
   `get_admin_kyc_magic_links` + `kyc_magic_link_summary`, qui la remontent aux écrans.
   Mesure qui a tout orienté : `sent_at` et `created_at` sont **tous deux**
   `NOT NULL DEFAULT now()` — doublons à l'insertion. `sent_at` n'apportait aucune
   information, seulement un nom qui promettait autre chose.
2. **La spec et le code se contredisent sur le canal.** Le handoff écrit « le lien part en
   WhatsApp / SMS — zéro e-mail » ; le code ne sait envoyer **que** par e-mail (Resend, via
   `magic-link-send-email`). Personne ne lit `'sms'` : la valeur est validée par
   `magic-link-create`, autorisée par le CHECK, proposée dans `MlkAgentModal` — et consommée
   par rien. **Cocher SMS seul produit un lien que rien n'envoie.**
3. **La défense « ancien jeton invalidé » est inatteignable.** `magic-link-get` teste
   `link.token !== token` sous un commentaire promettant « si l'agent regénère un lien,
   l'ancien token doit être invalidé ». Mais créer un lien **insère une nouvelle ligne** et
   ne réécrit jamais le token d'une ligne existante : aucun chemin ne peut déclencher la
   garde.
4. **Les deux rollbacks sont inopérants.** `magic-link-create` et `executeSendKycLink` font
   un `delete` de rollback si la signature HMAC échoue. Le trigger
   `enforce_kyc_magic_links_retention` lève une exception sur toute suppression de moins de
   10 ans **sauf pour un `super_admin`** — or l'un tourne sous JWT d'agent, l'autre en
   service-role (`auth.uid()` NULL, donc `coalesce(role,'') <> 'super_admin'` est vrai).
   Une signature ratée laisse donc une **ligne orpheline** dont le `token` est l'UUID
   bouche-trou, qui ne vérifiera jamais. Elle compte dans l'entonnoir KYC et dans le plafond
   de 3 de la recherche.
5. **Rien ne balaie les liens périmés.** L'expiration est PARESSEUSE : elle n'arrive que
   dans `magic-link-get` / `-upload` / `-confirm`, au moment où quelqu'un touche le lien. Un
   lien dépassé que personne ne clique reste `pending` indéfiniment, et les compteurs qui
   filtrent `status = 'expired'` le sous-comptent. L'index partiel
   `idx_kyc_magic_links_expires` a exactement la forme qu'un balayeur utiliserait ; le
   balayeur n'existe pas. Contraste mesuré dans le même dépôt : `mark_stale_kyc_dossiers()`
   + cron `kyc-stale-daily` existent pour les **dossiers**, rien pour les **liens**.


### 7ter. LOT 3 — à lire AVANT de commencer

Mesuré le 01.08.2026 (préflight `wf_a5d9245f-306`, 5 lecteurs). **Le Lot 3 est
majoritairement muré, et ce ne sont pas des murs techniques.**

| Étape | État mesuré |
|---|---|
| **24 · 25 · 26** | ⛔ **décision P3** — contrat webhook Immobilier.ch (codes de refus → mapping causes, HMAC). Rien à écrire sans lui. |
| **27** | ◑ **backend LIVRÉ et déployé** (`get_agent_changelog`, `20260801380000`). La **carte agent** est bloquée : la maquette que `front/admin-communications.jsx:9` désigne — `today-h-live.jsx`, `HL_NEWS` — **n'existe pas au dépôt** (2 occurrences, toutes deux des renvois). La pilule « Nouveau » n'a **aucune source** : pas d'état lu/non-lu, et §5.10 interdit d'emprunter celui de `platform_announcements` (Q10). Et `PageAujourdhui` est un pager **zéro-scroll** plafonné à 760 px portant déjà trois bandeaux. |
| **28** | ⛔ **sous-spécifiée.** `function_replay` n'a **RIEN à rejouer** — aucune table d'invocations d'edge ; `activity_events/edge_function_error` ne garde que `function_name`, `error`, `duration_ms`. *Ce n'est pas une RPC qui manque, c'est une trace.* Et le plan dit « replay » quand la maquette écrit « Relance demandée — prochain passage 15:12 », c'est-à-dire **re-planifier** : deux fonctionnalités différentes. `wa_deadletter_replay` **n'est pas dans la maquette** (elle offre « Examiner »), or son README pose que les libellés sont **définitifs**. `calendar_resync` n'a **aucun chemin serveur**. ⚠ **Mais le 4ᵉ geste, `cron_run_now`, est LIVRABLE** — cette ligne le passait sous silence, et c'était le seul qu'elle n'accusait de rien. Mesuré : 46 jobs actifs, **206 030** exécutions tracées dans `cron.job_run_details`, famille `ops` en base, socle étape 16 prêt. *Les crons ont la trace qui manque aux edges : c'est pourquoi `function_replay` n'a rien à rejouer et `cron_run_now` a tout.* ⛔ Et `admin_lock_entity` n'est **pas** un mur : son corps fait `hashtext(p_entity_id::text)`, l'uuid est reconverti en texte à la ligne suivante (`md5(jobname)::uuid` est stable). Lire la SIGNATURE et non le CORPS avait fabriqué un faux mur. ⚠ Avant d'écrire le geste, lire `megga/pgnet-request-loss` : `job_run_details = 'succeeded'` ne prouve pas que la requête est partie — d'où « Relance **demandée** » dans la maquette. |
| **29** | ⛔ **décision P4**. |
| **30** | ⛔ **sous-spécifiée.** Le mécanisme d'alerte **existe entièrement** (`_shared/admin-alerts.ts`, **11 règles** depuis le 01.08) : c'est un signal à y brancher, pas un système à bâtir. Mais « hors projet » et « chiffré » **ne sont définis nulle part**. ⚠ En revanche « aucun canal d'alerte hors projet n'existe » est **FAUX** : `.github/workflows/security-audit.yml` tourne chaque lundi 07:03 UTC sur l'infra GitHub, sonde la prod et **envoie un e-mail par Resend** ([security-audit.mjs:284](../../scripts/security-audit.mjs)). La prémisse tenait (46/46 crons pg_cron sont Supabase) mais la conclusion ne suit pas — les veilleurs externes ne sont pas dans `cron.job`, ils sont dans `.github/workflows/`. Il faut **donner un signal** à un canal, pas en bâtir un. |

✅ **Ce qui est réellement faisable au Lot 3 sans aucune décision : presque rien — mais pas
« rien ».** Les deux « gains gratuits » ont été pris le 01.08 (règle 10, règle 11). ⚠ **Il
reste `cron_run_now`**, corrigé le 01.08 après vérification en base : la ligne 28 le rangeait
sous le même ⛔ que trois gestes qui, eux, sont vraiment murés. Contraintes réelles mais
chiffrables : `statement_timeout = 8s` sur `authenticated`, 2 jobs sur 46 sont des `REFRESH
MATERIALIZED VIEW CONCURRENTLY` (impossibles en transaction), et le CHECK d'`outbox_jobs.kind`
est fermé à `stripe|portal|notify|email`. ⚠ Avant d'ajouter un `kind` : `pg_net` **est déjà
une outbox transactionnelle** (`net.http_request_queue` est écrite dans la transaction de
l'appelant), donc seule la garantie de livraison manquerait — arbitrage de fiabilité, pas
nécessité technique.

⚠ **Le mur dominant du Lot 3 n'est pas les décisions, c'est le VIDE.** Mesuré : `admin_changelog`
**0 ligne**, `property_syndications` **0**, `agency_syndication_config` **0**,
`edge_function_error` **0**, dead-letter WhatsApp **0**, table `deployments` **inexistante**.
Une décision PO rendue demain ne ferait rien apparaître à l'écran. `cron_run_now` échappe au
vide précisément parce que pg_cron est le seul sous-système qui a de l'histoire.

🎯 **Donc, si l'objectif est d'avancer : le meilleur rapport effort/valeur n'est pas au Lot 3,
il est à l'étape 19b du Lot 2.** Son backend existe déjà — les 5 RPC KYB sont en production —
il ne manque que l'habillage, et elle rembourse à elle seule **5 des 8 lignes** de la liste
`DETTE` du cliquet. Elle attend la maquette **P5**, pas du code.

🔧 ✅ **FAIT le 01.08** — la seule tâche du chantier qui ne demandait aucune décision.
`src/types/database.ts` régénéré depuis la production, **les 16 sites de contournement des
14 fichiers sont traités**, et une **porte** défend désormais la propriété. Surface exportée
**strictement identique** sur les 15 fichiers touchés (vérifiée symbole par symbole) : le
contrat que le plan protège n'a pas bougé. `tsc -b`, `lint`, `lint:deadcode`, `lint:prose`,
`build` à 0 ; **88 fichiers / 1413 tests**, inchangé.

Ce qui a été *réparé* plutôt qu'*échappé* : les dispatchers génériques (`callRpc`,
`rpcByToken`, le `rpc<T>` du cockpit) prennent l'union `Parameters<typeof supabase.rpc>[0]`
au lieu de `string` — un dispatcher typé `string` éteint la vérification pour tous ses
appelants d'un coup, sans qu'aucun `as` n'apparaisse à leur ligne. Deux gardes de nullité
ajoutées sur `property_scores.property_id` (nullable en base, clé de Map côté front).

⚠ **Une seule échappatoire subsiste, bornée à deux arguments** : `admin_changelog_save`
déclare ses cinq paramètres SANS DEFAULT (`pronargdefaults = 0`), or c'est le seul signal
que lit le générateur — il les type non-nullables alors qu'`uuid` accepte NULL et qu'une
création passe justement `p_id: null`. Corriger le SQL changerait la signature d'un geste
déjà en production pour un défaut qui n'existe que dans le type ; le nom de la RPC et les
trois autres arguments restent vérifiés.

**Porte posée — `scripts/check-types-freshness.mjs`**, trois propriétés, mutée trois fois
avant livraison (client re-casté → rouge ; RPC hors types → rouge ; parseur cassé → rouge) :
aucun contournement du client typé dans `src/`, aucune RPC appelée hors des types, aucune
relation vivante absente du fichier. Statique sur chaque PR (`unit-tests.yml`, sans secret),
moitié production dans `migration-drift.yml` — le seul workflow qui interroge la prod.
⚠ Elle ne compare **pas** les fonctions : 770 vivantes contre 420 émises, le filtre du
générateur nous échappe, et une porte qui se trompe de périmètre crie au loup.

⚠ **Périmètre corrigé le 01.08 — il était très sous-évalué.** La dérive n'est pas « une
colonne et une fonction » mais **15 relations et 64 fonctions** absentes du fichier (tout le
socle console : `admin_log`, `outbox_jobs`, `rpc_receipts`, `agency_activation`, les `admin_*`
et `get_admin_*`) ; vues et enums sont identiques. Et les casts ne sont pas 4 mais **16 sites
dans 14 fichiers** : un grep sur `as unknown as SupabaseClient` n'en voit que 5, les formes
majoritaires étant `supabase.rpc as unknown as` et `supabase.from as unknown as`.
`useAdminBilling` caste `supabase.rpc`, pas le client.

⛔ **Piège mesuré : « la cible est dans `database.ts` » ne veut PAS dire « le cast est
gratuit ».** L'existence n'est pas la compatibilité. Sur 9 casts à cible typée, **3 seulement**
compilent sans cast (`useFocusMatches`, `useWhatsAppPairing`, `useAgencyTargets`) ; les autres
cassent pour de vraies raisons — `get_today_focus_config` est typée `Args: never` et le hook
passe `{}` ; `property_scores.property_id` est `string | null` et le hook rétrécit à `string` ;
`useAxDashboardData` et `useVisits` castent un **dispatcher générique**, pas un appel.
**Vérifier en compilant, jamais au grep.**

⚠ Ne pas promettre une récolte de bugs : mesuré (tsc d'ombre, types frais, exit 0), la
régénération seule ne casse rien et ne révèle **aucun bug latent**. Et régénérer **seul** ne
vaut presque rien tant que les casts tiennent — une sonde tsc casts en place ne peut
structurellement voir aucune erreur de forme de retour. ⚠ **Aucune porte ne surveille la
fraîcheur de `database.ts`** : `check-migration-drift.mjs` compare migrations→base, jamais
types→base, alors que son propre en-tête raconte qu'un `database.ts` figé avait cassé quatre
gestes du pipeline pendant une semaine en juillet.

## 8. Re-dater les migrations le jour du merge — procédure

> ✅ **APPLIQUÉE le 01.08.2026, et sans re-datage.** Les 6 migrations de #1054 portaient déjà
> le préfixe `20260801*` et le merge a eu lieu à **18:26 UTC**, donc dans la journée UTC de
> leur date : le date-guard les a appliquées telles quelles. **Vérifié en base**, pas déduit
> du log — colonne `email_sent_at` présente, fonction `get_agent_changelog` présente, droits
> `anon` sur les tables internes passés de **38 à 0**, et les cinq fonctions modifiées
> relues une par une via `pg_get_functiondef`.
>
> ⚠ **Ce que ce merge a appris sur la fenêtre** : le seuil est `préfixe >= $(date -u +%Y%m%d)`,
> comparé au jour **UTC**. Écrire une migration à 23 h UTC laisse donc une heure pour la
> merger. Et si elle est sautée, **les Edge Functions se déploient quand même** — d'où une
> désynchronisation silencieuse code/schéma, qui est le vrai danger, pas la migration
> manquante en elle-même.


> ✅ **EXÉCUTÉ le 01.08.2026** (08h05 UTC) : les 14 migrations sont passées de `20260731*`
> à `20260801*`, `main` était à 0 de retard et ne portait aucune migration du 01.08, donc
> aucune collision de stamp. Les références par numéro dans `tests/` et dans ce document ont
> suivi — les trois migrations du 31 **déjà mergées** (`190000`, `200000`, `210000`) n'ont
> pas été touchées, c'est exactement pourquoi la liste est nommée et jamais un glob.
> La procédure ci-dessous reste le mode d'emploi si un rebase impose de recommencer.
>
> ⚠ **Le re-datage n'est valable que pour un merge le 1ᵉʳ août UTC** (l'UTC bascule à 02h00
> heure suisse). Merge reporté au lendemain = tout re-dater.

**Pourquoi.** `deploy.yml` (lignes 108-160) n'applique que les migrations dont l'horodatage
est `>= TODAY` en **UTC**, et ne signale un saut que par un `::warning::`, jamais par un
échec. Une migration datée du 31.07 mergée le 01.08 est donc **sautée définitivement** :
aucun déploiement ultérieur ne la rattrape, le dépôt et la CI restent verts, et le schéma
n'existe pas en production. C'est l'invariant 16 du relais KYB, et le dépôt s'est déjà fait
avoir sur 19 migrations en juillet.

Ce n'est **pas une échéance sur le travail** : la CI valide chaque push indépendamment de
la date. C'est une corvée au moment du merge.

**Quand.** Dès que le jour UTC du merge diffère du jour d'écriture. Vérifier :
`date -u +%Y-%m-%d`.

> 🔴 **UTC A BASCULÉ AU 1ᵉʳ AOÛT 2026 pendant la session.** Les **dix** migrations de la
> liste ci-dessous sont datées `20260731` : elles sont **déjà périmées**. Mergées telles
> quelles, `deploy.yml` les saute **définitivement** — le dépôt reste vert, la CI reste
> verte, et le schéma n'existe pas en production. Le re-datage n'est plus une précaution,
> c'est un prérequis du merge.

```bash
cd /Users/megga/Desktop/megga-real-estate/.claude/worktrees/audit-backend-admin-a43be4
git fetch origin && git rebase origin/main

# Re-date au jour courant en conservant l'ORDRE relatif (les 6 chiffres d'heure ne bougent pas).
# Liste EXPLICITE, jamais un glob sur la date : d'autres personnes déposent des migrations le
# même jour — main en portait déjà une à 20260731210000, ce qui a forcé le décalage d'admin_log
# à 210500. Un glob emporterait leurs fichiers.
NOTRES="
  20260801210500_admin_log.sql
  20260801220000_admin_console_session.sql
  20260801230000_admin_console_lot1_socle.sql
  20260801240000_admin_live_and_kyc_funnel.sql
  20260801250000_activation_and_cron_runs.sql
  20260801260000_admin_security_read.sql
  20260801270000_admin_agency_note_and_invitations.sql
  20260801280000_admin_console_read_views.sql
  20260801290000_admin_overview.sql
  20260801300000_admin_gestures_socle.sql
  20260801310000_admin_kyc_diagnostic.sql
  20260801320000_admin_ai_month_and_drift.sql
  20260801330000_admin_changelog_workflow.sql
  20260801340000_admin_log_export.sql
"
for n in $NOTRES; do
  f="supabase/migrations/$n"
  [ -e "$f" ] || { echo "absent (déjà re-daté ?) : $n"; continue; }
  dst="supabase/migrations/$(date -u +%Y%m%d)${n:8}"
  [ "$f" = "$dst" ] && { echo "déjà à la bonne date : $n"; continue; }
  # Refuser d'écraser un fichier existant : un stamp peut être pris par quelqu'un d'autre.
  [ -e "$dst" ] && { echo "STAMP DÉJÀ PRIS, décaler d'une minute : $dst"; continue; }
  git mv "$f" "$dst"
done

# Contrôle : aucun stamp en double dans l'index.
git ls-files supabase/migrations | xargs -n1 basename | cut -c1-14 | sort | uniq -d

node scripts/check-migration-idempotence.mjs   # doit rester vert
git commit -m "chore(admin): re-date les migrations du Lot 0/1 au jour du merge"
git push
```

**Trois précautions, par ordre d'importance :**

1. **Jamais de date future.** On date au jour du merge, pas en anticipation : une migration
   datée de demain serait sautée aujourd'hui, et personne ne la rattraperait.
2. **Le renommage n'est permis que parce qu'aucune de ces six migrations n'est mergée.** La
   règle du dépôt interdit la reprise sur place d'une migration **déjà en production** — une
   correction se fait alors par un NOUVEAU fichier.
3. **Laisser la CI rejouer avant de merger.** Elle applique toutes les migrations sur une
   base fraîche à chaque push : c'est elle qui prouve que le rejeu tient contre l'état
   **final** de la journée, y compris si Thomas ou Antoine ont mergé des migrations entre-temps.

**Après le merge**, vérifier les OBJETS en base, pas le statut du workflow — c'est la
discipline du dépôt, et c'est ainsi que #1044 a été confirmée :

```sql
select to_regclass('public.admin_log') is not null                  as admin_log,
       to_regclass('public.agency_activation') is not null          as activation,
       (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public'
           and p.proname in ('admin_log_write','admin_log_verify_chain',
                             'get_admin_live_feed','get_admin_security_journal',
                             'get_admin_cron_runs','recompute_agency_activation')) as fonctions;
```
