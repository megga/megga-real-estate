# Console MEGGA · backend — état du chantier et reprise

> **31 juillet 2026, 20h45 UTC.** Document de reprise : tout ce qu'il faut pour continuer
> sans relire la conversation. Branche : `claude/console-admin-admin-log`, PR **#1046**
> (brouillon, base `main`). Spec : `docs/handoff/console-admin/` · Inventaire du socle :
> [INVENTAIRE_SOCLE.md](INVENTAIRE_SOCLE.md).

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
| **#1046** | **Lot 0 complet + Lot 1 partiel** | **brouillon**, 7 migrations en attente |

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

**Lot 2 — 4 étapes sur 9.** **16 ✅ socle des gestes** · **19 ✅ diagnostic de lien KYC** ·
**20 ✅ relevé IA et dérives** · **21 ✅ changelog « What's new »**.

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

⚠ **Une erreur de l'étape 9, corrigée à l'étape 10** : le commentaire de `20260731280000`
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

**Tests** : 53 specs dédiées à la console. CI complète verte sur `2dbccac1` — **137 fichiers /
1 243 tests** en backend, **86 fichiers / 1 402 tests** en unitaire. Les specs des étapes 9, 10 et 14
exécutent respectivement **19**, **12** et **18** tests, le seed **7** et le garde-fou
d'instrumentation **3** : c'est le compte qui le prouve, pas le statut vert.

⚠ Le job backend a d'abord échoué sur `80418ece` **sans exécuter un seul test** :
« Setup Supabase CLI » est mort sur `rate limit exceeded` et « Run backend tests » a été
SKIPPÉ. C'est le flake connu, sans rapport avec le code — le lire comme un échec de test
aurait envoyé chercher un défaut inexistant. Remède : `gh run rerun <id> --failed`.

## 4. Décisions PO qui bloquent la suite

| # | Décision | Ce qu'elle bloque | Reco |
|---|---|---|---|
| ~~1~~ | ~~Support de la note d'agence~~ — **TRANCHÉE le 31.07** : table `admin_agency_notes` (migration `20260731270000`). ⚠ **Pas** une colonne `agencies.admin_note` comme d'abord recommandé : `agencies_members_select` donne à chaque membre la lecture de toute sa ligne, avec un GRANT de table, et un REVOKE de colonne ne protégerait rien (défaut mesuré sur `verification_*`). La note aurait été lue par l'agence. | ✅ débloquée | — |
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

## 7. Reprendre

```bash
cd /Users/megga/Desktop/megga-real-estate/.claude/worktrees/audit-backend-admin-a43be4
git fetch origin && git rebase origin/main   # main a bougé (PR vitrine de Thomas/Antoine)
```

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

## 8. Re-dater les migrations le jour du merge — procédure

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
  20260731210500_admin_log.sql
  20260731220000_admin_console_session.sql
  20260731230000_admin_console_lot1_socle.sql
  20260731240000_admin_live_and_kyc_funnel.sql
  20260731250000_activation_and_cron_runs.sql
  20260731260000_admin_security_read.sql
  20260731270000_admin_agency_note_and_invitations.sql
  20260731280000_admin_console_read_views.sql
  20260731290000_admin_overview.sql
  20260731300000_admin_gestures_socle.sql
  20260731310000_admin_kyc_diagnostic.sql
  20260731320000_admin_ai_month_and_drift.sql
  20260731330000_admin_changelog_workflow.sql
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
