# Inventaire du socle admin — Console MEGGA

> **Étape 1 du `PLAN_CONSOLE_ADMIN_BACKEND.md` · 31 juillet 2026.**
> Livrable : le **delta réel entre le dépôt et la spec** (`HANDOFF_CONSOLE_ADMIN_CLAUDE_CODE.md` §4.1 / §4.2 / Annexe A).
> Périmètre mesuré : base de production `eayczugyrvmtqnnmvjod`, dépôt à `8ddac0e5`, worktree `audit-backend-admin-a43be4`.
> **Aucune migration, aucune RPC, aucun geste** n'accompagne ce document — c'est la condition de sortie de l'étape 1.

245 ressources inventoriées (annexe A), dont 15 à risque bloquant et 57 à risque élevé.

---

## 0. Ce que ce document tranche, et ce qu'il ne tranche pas

Il tranche : **ce qui existe réellement**, sous quel nom, avec quel contrat, et donc ce qu'il ne faut pas réécrire. C'est le garde-fou du risque n°1 du plan (« réécrire ce qui existe déjà »).

Il ne tranche pas : les arbitrages produit. Onze d'entre eux sont posés ici, chiffrés et localisés, à l'intention du PO et de Thomas (§7 et §13). Aucun n'a été décidé en écrivant ce document.

---

## 1. Verdict en une page

| # | Constat mesuré | Conséquence sur le plan |
|---|---|---|
| 1 | **8 des 10 RPC « à créer » de l'Annexe A.2** touchant agences et utilisateurs ont déjà un équivalent en production (RPC ou edge). | Étapes 17-18 : **étendre**, ne pas créer. §4 ci-dessous donne la correspondance nom à nom. |
| 2 | **La surface console de la revue KYB existe déjà** : `AdminKybReviewPage.tsx` (1254 lignes), routée, dans le rail, branchée sur les 7 RPC avec les bonnes signatures. | P5/Q9 n'est **pas** un bloquant fonctionnel du Lot 1. Étapes 14b/19b à requalifier de « brancher » en « habiller en Sugar Pure ». |
| 3 | **`admin_console_entry_audit` n'est pas une table** : c'est le nom du fichier `20260725220000`, qui ne crée que la fonction `admin_log_console_entry(jsonb)` écrivant dans `activity_events`. La spec la cite 6 fois. | Étape 3 : rien à migrer, aucun backfill. La « convergence » se réduit à ajouter un insert `admin_log` dans le corps de la fonction. |
| 4 | **`admin_notes` a été supprimée le 28.07.2026**, trois jours avant la rédaction de la spec qui la donne pour existante et y loge la note de la fiche agence. | §5.3 / §4.3 : recréer un support de note ou retirer le champ. **Arbitrage PO avant le Lot 1.** |
| 5 | **`admin_request_agency_correction` prend un motif obligatoire** (`p_agency_id uuid, p_reason text`, refus sur chaîne blanche). La spec l'écrit sans argument, deux fois. | Un écran construit sur la spec échoue à l'appel. Amendement de la spec, pas de la RPC. |
| 6 | **Le relecteur KYB n'a aucun accès Storage à la pièce d'identité** qu'on lui demande de trancher : les 12 policies du bucket `documents` sont gardées par `get_my_agency_id()`, et un super-admin a `agency_id` NULL. | Étape 19b : il manque une edge service_role émettant une URL signée, ou une policy. À arbitrer avec Thomas. |
| 7 | **Le Live n'est pas temps réel** : `activity_events` n'appartient pas à la publication `supabase_realtime` (qui ne contient que `crm_offers`). L'abonnement existant se connecte, ne reçoit rien, et ne lève aucune erreur. | Prérequis absent du handoff : un `ALTER PUBLICATION` au Lot 0, vérifié par un INSERT test. |
| 8 | **Q3 n'est pas un réglage de fenêtre.** Un trigger `BEFORE DELETE` interdit toute suppression d'`activity_events` de moins de 10 ans, motif LBA art. 7 al. 3 écrit en dur. La purge existante vise 3 ans et 5 catégories, et n'atteint que 4 % du journal (95,3 % des lignes ont `category` NULL). | « Rétention Live 30 j » = renoncer à l'argument LBA. Le levier réel est la **fenêtre d'affichage**, pas la suppression. |
| 9 | **Q5 n'est pas résolue.** La divergence de sièges est **triple** (1/5/∞ · 1/1/10 · 1/3/10/50 en dur dans `send-team-invite`), et l'enum `agency_plan` en base vaut `starter\|pro\|agency\|enterprise` là où le catalogue dit `entreprise`. | **Bug latent en production** : créer une agence Entreprise lève `22P02`. À corriger avant le Lot 2. |
| 10 | **`ai_usage_logs` n'a aucune colonne d'utilisateur**, et son CHECK `provider` exclut `gemini`. | Quatre éléments de `admin-copilot.jsx` sont incalculables ; le total affiché n'est pas le coût IA de la plateforme. Arbitrage PO avant l'étape 20. |
| 11 | **Deux RPC citées par la spec comme sources de la console fuient entre agences** : `get_onboarding_milestones` et `get_agency_activity_summary` sont `SECURITY DEFINER`, `GRANT EXECUTE` à `authenticated`, sans aucune garde. | Bloquant 0.2 **encore ouvert**. Une migration courte, côté Julien, avant le G1. |
| 12 | **Trois capacités que la spec range hors périmètre sont en production et branchées** : changement de plan (`admin_set_agency_plan`), impersonation (`admin_log_impersonation` + 8 fichiers front), listes nominatives cross-agences (Clients finaux, Conformité). | La spec formule une abstention là où il faudra un **démontage**. Décision PO écrite avant le Lot 2. |

---

## 2. Méthode et règle de preuve

**La base fait foi, pas les fichiers.** Trois observations imposent cette règle :

1. `supabase_migrations.schema_migrations` compte **69 lignes et s'arrête à `20260728183020`** : les 28 migrations des 29-31 juillet (tout le lot KYB) n'y figurent pas, alors que tous leurs objets sont vivants. Le registre de bookkeeping n'est pas un oracle de ce qui est en production ; un `supabase migration repair` est à passer avant le prochain lot.
2. **Quatre cas de « fichier ≠ fonction vivante »** ont été mesurés. `get_agency_stats` tient son corps de `20260717190000`, pas de la migration citée par §4.1 ; `get_admin_end_user_stats`, `get_admin_agency_usage` et `get_admin_usage_overview` tiennent le leur de `20260726180000_drop_seller_portal.sql`. Lire la migration citée par la spec donne un contrat périmé (bloc `portals`, colonne `portals_active`).
3. Un commentaire de migration peut être **factuellement faux** : `20260729151600` annonce une « double défense » sur les colonnes de vérification ; la première (REVOKE par colonne) est inopérante, parce qu'un REVOKE de privilège colonne ne retire pas un GRANT accordé au niveau table.

Chaque affirmation de ce document est adossée soit à `pg_catalog` (`pg_get_functiondef`, `pg_policies`, `aclexplode(proacl)`, `has_column_privilege`, `cron.job`), soit à un `chemin:ligne` du dépôt. Chaque domaine a été mesuré une première fois, puis **contre-vérifié par un second passage indépendant chargé de le prendre en défaut** : 245 verdicts, dont 15 réfutations et 37 imprécisions corrigées. Les corrections sont intégrées ; les affirmations du premier passage qu'elles annulent ne figurent pas ici.

Comptes de référence, à ne pas recopier de mémoire : `supabase/migrations/` contient **218 fichiers `.sql`** plus un sous-dossier `_archived/` qui en porte 117 ; le schéma `public` compte **90 relations** (86 tables, 2 vues PostGIS, 2 vues matérialisées) ; **41 jobs cron** actifs ; **71 edge functions déployées** pour 68 dossiers au dépôt.

---

## 3. §4.1 — ce que la spec dit exister, ligne par ligne

| Ressource citée §4.1 | État mesuré | Delta |
|---|---|---|
| `activity_events` | **existe, divergent** | 13 colonnes, 4 CHECK, **3** triggers (la spec n'en cite qu'un). `category` est nullable et NULL sur **95,3 %** des lignes. `severity` vaut `critical`, pas `crit`. Détail §5. |
| `user_consents` + `record_consent` + `get_admin_consent_stats()` | **conforme** | Le sel `consent_ip_salt` est absent d'`app_config` : `record_consent` saute le calcul d'`ip_hash` par configuration. La preuve de consentement est sans IP, et le restera tant que la clé n'est pas posée. |
| `team_invitations` + edge `accept-team-invite` (+ « patch S13 à appliquer ») | **existe, divergent** | Schéma conforme, y compris les 7 jours. **Aucune policy super-admin** : un super-admin (`agency_id` NULL) ne lit aucune invitation en direct. 0 ligne en production. La mention « patch S13 à appliquer » est **périmée** (§6). |
| `agency_usage_quotas` + 4 RPC | **conforme** | Contrat exact, y compris `alert_threshold_pct` défaut 80 borné 50-100. Réserves : 0 ligne en prod, donc `get_admin_quota_breaches()` rend structurellement vide ; et la policy `FOR ALL` permet d'écrire la table en direct, **hors** de la RPC qui porte l'audit. |
| `ai_usage_logs` | **existe, divergent** | Aucune colonne d'utilisateur. CHECK `provider` = `deepseek\|claude-sonnet\|claude-haiku` : **`gemini` serait refusé**, et la vision/OCR/PDF n'est journalisée nulle part. 59 lignes depuis avril, une seule agence, juin à zéro. |
| `platform_announcements` (+ `_dismissals`) | **existe, divergent** | Dormante en **données** (0 ligne), pas en **code** : un onglet « Annonces » complet est routé, avec création, édition et suppression. L'instruction §5.10 « ne pas construire d'UI » arrive après coup et ne dit pas quoi faire de celle qui existe (**Q10 à rouvrir**). |
| `admin_changelog` | **existe, partiel** | 8 colonnes, un booléen `published`, **ni `published_at` ni `scheduled_at`**, aucun trigger, 0 ligne. Le hook ne sait que lister, créer et supprimer : **aucun chemin d'`UPDATE`**. Ses 2 policies testent `profiles.role='super_admin'` en dur et **ignorent donc l'allowlist**. |
| `admin_console_entry_audit` | **n'existe pas** | Nom de fichier pris pour un nom de table. Voir §1 constat 3. |
| RPC socle admin (7 migrations citées) | **existe, divergent** | `20260526150000_restore_admin_rpcs.sql` ne contient aucune fonction préfixée `admin_` : elle porte `get_agency_stats` et `get_onboarding_milestones`. Le patron réel des lectures est `is_super_admin() OR is_service_role()` (18 fonctions), pas `is_super_admin()` seul. |
| `agency_activity_summary_rpc` | **nom inexistant** | La fonction s'appelle **`get_agency_activity_summary(agency_ids uuid[], since_days integer)`**. Elle prend un tableau et une fenêtre — elle ne se branche pas comme un `last_activity_at` par ligne. |
| KYB : 8 tables + colonnes + 7 RPC + moteur + edge + sweep | **conforme sur le fond** | Invariant 8 **vérifié en base** (aucune policy INSERT sur les deux tables de checks). Invariant 9 **à moitié tenu** : le REVOKE par colonne est inopérant, seul le trigger protège. `verification_status` a bien **6** valeurs (la spec a raison, le relais de Thomas en annonce 5 et est périmé). La borne haute citée par §4.1 (`20260731150000`) manque 3 migrations vivantes. |
| `platform_metrics` · `moderation_actions` · `admin_notes` · `agencies.status` · `properties.moderation_status` | **2 sur 5 divergent** | `admin_notes` **supprimée**. `moderation_actions` existe mais **0 ligne**. `platform_metrics` porte 29 081 lignes et 20 types de métriques. `agencies.status` n'a que **deux** états (`active\|suspended`), ce qui contraint tout design de suspension. |
| `admin_integrations_health` | **pas une table** | C'est `get_admin_integrations_health()` → `jsonb`, calculée à la volée. Le schéma §3 la place en bout de flèche comme destination de healthchecks : **rien n'est stocké**, donc la bande 24 h par service de la maquette Monitoring n'a aucune source. |

---

## 4. Annexe A.2 — ce qui existe déjà sous un autre nom

C'est la réponse à la question qui justifiait cette étape.

| RPC « à créer » (Annexe A.2) | Équivalent en production | Verdict |
|---|---|---|
| `admin_agency_suspend` / `_reactivate` | edge **`admin-agency-lifecycle`**, actions `suspend` / `reactivate` | **Étendre.** Déjà : garde super-admin + allowlist, `agencies.status`, ban GoTrue de tous les membres, exclusion des comptes allowlistés, audit. Manque : dépublication portail, pause Stripe, `settle_past_due`, outbox, idempotence, ligne `admin_log`. |
| `admin_agency_invite_member` | **partiel** : table `team_invitations` + edge `send-team-invite` | La table et l'envoi existent ; **la porte super-admin n'existe pas** (l'edge est agence-scopée). Le plafond de sièges est bloqué par l'arbitrage Q5. |
| `admin_user_set_role` | RPC **`admin_set_user_role`** (ordre des mots inversé) | **Étendre.** Deux écarts : elle **autorise** `super_admin` (borné par l'allowlist) alors que §5.4 l'interdit ; aucun garde-fou « dernier admin » (Q8). |
| `admin_user_reset_password` | edge `admin-user-lifecycle`, action `force_password_reset` | **Étendre.** Manque : TTL 1 h explicite, rate limit 3/h/cible, ligne `admin_log`. |
| `admin_user_suspend` / `_reactivate` | edge `admin-user-lifecycle` | **Étendre.** Réserve documentée dans le code : le ban bloque le refresh, les access tokens vivent ≤ 1 h — la « déconnexion immédiate » de §5.4 n'est pas tenue. |
| `admin_user_resend_invite` | **partiel** : action `resend` de `send-team-invite` | Le mécanisme de régénération existe et invalide l'ancien token ; il manque le chemin console. |
| `admin_user_delete` | edge **`delete-account`**, branche admin | L'anti-lockout allowlist exigé est déjà là. Non vérifié : la profondeur réelle de l'anonymisation nLPD art. 32. |
| `admin_user_dsar_export` | edge **`admin-dsar-export`** | **Conforme** au contrat §5.4, journal compris. Manque : rate limit 20/j et la ligne `admin_log`. |
| `admin_overview()` | `get_admin_dashboard_stats()` sert déjà le bloc `kpis` (hors MRR) | À **agréger**, pas à recalculer. |
| `admin_kyc_link_lookup` / `_regenerate` | **rien** — et c'est le point sensible | Le besoin est aujourd'hui servi de façon **non conforme** par `get_admin_kyc_magic_links()` : liste nominative paginée (`contact_name`), sans motif ni plafond, avec un `greatest(p_limit,1)` qui est un plancher et non un plafond. C'est un remplacement, pas un ajout. |

**Deux gestes en trop, à démonter plutôt qu'à ne pas construire :**

- `admin_set_agency_plan(uuid, text, text, text)` — gardée, auditée, appelée par `AdminPlansPage.tsx:88` et `AdminBillingCard.tsx:86`, alors que §5.7 pose « aucune RPC mutante ». Elle est en outre **cassée pour 3 plans sur 4** : sa whitelist accepte `entreprise`, l'enum n'a que `starter\|pro\|agency\|enterprise`.
- `admin_log_impersonation(text, uuid, jsonb)` — gardée, jamais exercée (0 événement), mais le chemin front est **vivant** : `useImpersonate.ts`, `UserDrawer.tsx:236`, `ImpersonationHandoff.tsx`, `App.tsx:591`, `AgentLayout.tsx`, et deux surfaces du CRM agent (`IntercomMessenger.tsx`, `CopilotPanel.tsx`) lisent `impersonating` pour se neutraliser. Le retrait touche donc du code hors du dossier admin.

---

## 5. §4.2 — preuve d'absence et arbitrages

Les **11 noms de §4.2 sont absents de la base**, tous schémas confondus (sonde nominative sur `pg_class`). Aucun n'existe sous son propre nom. Mais quatre ont un équivalent fonctionnel, et trois n'ont pas de producteur.

| Objet | Verdict | Motif |
|---|---|---|
| `admin_log` | **à créer, réduit** | `activity_events` donne déjà l'append-only par trigger, la rétention 10 ans **garantie en base**, acteur/entité/metadata/`object_label`, et la lecture super-admin globale. La chaîne de hash SHA-256 existe aussi, dans `audit-pdf-export` — mais **recalculée à l'export**, donc aveugle à une suppression entre deux exports. Apport irréductible d'`admin_log` : la colonne `family` (12 valeurs console, impossible à loger dans un CHECK `category` à 8 valeurs partagé avec le CRM) et le `prev_hash`/`hash` **stockés à l'insert**. |
| `stripe_subscriptions` | **à abandonner** | `public.subscriptions` existe (15 colonnes, `UNIQUE(agency_id)`, CHECK `plan ∈ starter\|pro\|entreprise` — exactement le `plan_code` voulu) et est déjà upsertée par `stripe-webhook` sur 5 événements. Manquent seulement `trial_end`, `mrr_chf`, `last_invoice_status`, et l'événement `trial_will_end`. **3 colonnes contre une seconde table.** |
| `cron_runs` | **à abandonner** | `cron.job_run_details` porte 202 000+ lignes depuis le 23.03.2026, sans purge. Ce qui manque n'est pas une table mais une RPC : `get_cron_health()` ne rend que le **dernier** run. Un `get_admin_cron_runs(jobname, limit)` suffit. (Ne pas promettre une rétention 90 j : rien ne l'implémente, l'historique est non borné.) |
| `plan_config` | **à ne pas créer** | La « 3ᵉ source » que la spec interdit **existe déjà** : `app_config.plan_pricing`, lue par `compute_platform_mrr_estimate()`. Elle coïncide aujourd'hui avec `src/lib/plans.ts` (0/0 · 89/71 · 249/199) sans qu'aucun test ne le garantisse. Poser ce test, ou seeder l'une depuis l'autre. |
| `agency_activation` | **à réduire** | `get_onboarding_milestones()` calcule déjà 5 jalons **booléens** + `last_activity_at`. Manquent : les jalons en **timestamps**, `signed_up`, le score 0-100, le statut `active\|atRisk\|dormant`, la persistance nightly. |
| `listing_signals` | **à créer** | Aucun doublon. À raccorder à `property_syndications` (état de push) et à `moderation_actions` (journal de retrait) plutôt qu'à ouvrir un troisième journal. **Réserve** : ces deux tables ont **0 ligne** — s'y « appuyer » revient aujourd'hui à s'appuyer sur du vide. |
| `rpc_receipts` | **à créer** | Aucune infrastructure d'idempotence n'existe en base. Point d'exposition immédiat : **les 5 RPC de décision KYB** que la console appelle — un double-clic rejoue la décision. |
| `outbox_jobs` | **à créer** | `whatsapp_async_jobs` n'est pas réutilisable (CHECK sur `tool` à 2 valeurs, colonnes WhatsApp NOT NULL) mais son **patron** est éprouvé et transposable : `status`/`claimed_at`/`retry_count`/`last_error`/`expires_at`. |
| `deployments` | **à reporter** | Le seul objet dont **les deux bouts** manquent : ni table, ni producteur (aucune edge de réception CI parmi les 71 déployées). À traiter avec Q4, dont `admin_deploy_rollback` dépend déjà. |
| `incidents` | **à dériver, pas à créer** | La dérivation est écrite dans le code (`get_admin_integrations_health` compte `action='edge_function_error'`) mais **la source est vide** : 0 ligne de cette action, 3 lignes `severity='critical'` sur 4857. L'écran afficherait « 0 erreur » par absence de producteur, pas par bonne santé. Un émetteur existe pourtant (`_shared/audit-edge-error.ts`) : c'est son câblage qu'il faut vérifier. |
| `ai_drift_dismissals` | **à créer** | Objet le plus simple du lot, aucun doublon, aucune dépendance amont. |

**Les 11 vues de §4.3 sont toutes absentes.** Deux ont un équivalent RPC à ne pas dupliquer : `v_monitoring_board` (4 RPC de santé existantes) et `v_plans_board` (edge `admin-stripe-metrics`). `v_admin_agency_detail(id)` est bloquée sur deux points : la note (`admin_notes` supprimée) et les invitations (`team_invitations` sans policy super-admin).

---

## 6. Bloquants pré-lancement 0.1 → 0.4 : verdicts mesurés

L'audit source date du 3-4 juillet ; la branche KYB du 30-31 juillet lui est postérieure et en a fermé une partie. Voici l'état **aujourd'hui**, mesuré et non recopié.

| # | Verdict | Détail |
|---|---|---|
| **0.1** S13 `join_agency` | **FERMÉ, autrement** | Le `GRANT EXECUTE` est révoqué de `public`, `anon` et `authenticated` (`20260729150600`) : la fonction n'est plus joignable que par `postgres`/`service_role`. Le **patch 05 n'a pas été appliqué** — le corps n'exige toujours aucune invitation. Rien ne bloque l'ouverture de la console. Deux finitions d'hygiène : supprimer la fonction ou lui poser enfin le gate, et retirer de la spec (§C3 et §4.1) la mention « patch écrit et à appliquer », périmée. |
| **0.2** RPC SECDEF exposées | **PARTIEL — c'est le seul vrai reste** | Volet `anon` essentiellement fermé : **14 signatures** (12 `proname`) restent exécutables par `anon`/`PUBLIC` sur 172 fonctions `SECURITY DEFINER`, contre 53 à l'audit, et 12 des 14 sont inoffensives (fonctions de trigger, RPC de visite tokenisées, surcharges PostGIS). **Reste ouvert** : `get_onboarding_milestones` et `get_agency_activity_summary`, `SECURITY DEFINER`, `authenticated`, **sans garde ni filtre d'agence** — tout agent lit les jalons et l'activité de n'importe quelle agence. Résidu apparu **après** le lot de révocation : `realadvisor_fill_agency_logos()` et `suppress_agency_logo_collisions(real)`, deux écritures en masse déclenchables avec la clé anon. |
| **0.3** policies `anon` trop larges | **FERMÉ** | `support_tickets` n'a plus qu'une policy `authenticated` ; `ticket_events` et `ticket_messages` **n'existent plus** ; `anon_select_visit_by_token` est remplacée par la RPC tokenisée `get_visit_by_token`. Sur 91 policies atteignables par `anon`, une seule `USING(true)` subsiste : `translation_cache` (2 lignes, aucun tenant, aucune PII). |
| **0.4** écriture de `agencies.plan` / billing | **PARTIEL** | La formulation d'origine (« tout membre ») est fermée : depuis `20260731170000`, `agencies_members_update` exige `is_agency_admin()`. **Reste ouvert** : aucun trigger de garde billing n'existe et le `GRANT UPDATE` de table est entier — un `admin` ou `manager` d'agence peut écrire `plan`, `billing` et `stripe_customer_id` en direct, sans garde super-admin et **sans trace** (le trigger d'audit ne couvre que les 9 colonnes d'identité et d'adresse). |

**Ce qui reste à faire, côté Julien, avant le G1 — deux migrations courtes :**

1. Garde `is_super_admin() OR is_service_role()` sur `get_onboarding_milestones` et `get_agency_activity_summary` (idiome déjà en place dans `20260717190000`, corps SELECT inchangé), plus le revoke `anon` des deux RPC logos. Aucun risque de régression mesuré : les seuls appelants sont `useOnboardingTracker.ts:45` et `AdminAgenciesPage.tsx:126`, deux surfaces super-admin. ⚠ **Périmé depuis le 03.08** : `useOnboardingTracker` a été supprimé avec la refonte de la Vue d'ensemble (PR #1123). `get_onboarding_milestones` reste en base et n'a plus d'appelant — le funnel d'activation en 6 étapes n'existe donc plus nulle part à l'écran ; le remonter sur Agences ne coûtera que l'UI.
2. Trigger `BEFORE UPDATE` sur `agencies` refusant l'écriture de `plan` / `billing` / `stripe_customer_id` quand `current_user = 'authenticated'`, **sans liste blanche de rôles**. Ne pas reprendre le patch 08 tel quel : il autorise `admin|manager` et laisse donc exactement le trou qui fausse le MRR. Ne pas tenter sa variante « grants colonne » : elle est démontrée inopérante ici. Le gabarit existe déjà dans le dépôt — `agencies_guard_identity_columns()`.

La console n'a rien à faire sur ces deux points : elle en dépend. Elle peut avancer sur tout ce qui ne consomme pas ces quatre RPC.

---

## 7. Erreurs factuelles de la spec — amendements à porter

Chacune est vérifiée en base et porte une étape du plan.

| § de la spec | Ce qu'elle affirme | Ce qui est mesuré |
|---|---|---|
| §1, §4.1, §5.9, §8, §10.6, PLAN:55 (6 mentions) | `admin_console_entry_audit` est une table à faire converger | Nom de fichier ; la migration ne crée qu'une fonction |
| §4.1, §5.3, §4.3 | `admin_notes` existe (« comme avant »), porte la note de la fiche agence | Supprimée le 28.07.2026 (`20260728190000:30`) |
| §3, §4.1, §5.8 | `admin_integrations_health` est une table alimentée par healthchecks | Fonction `jsonb` calculée à la volée, sans historique |
| §4.1, Annexe A.1 | `agency_activity_summary_rpc` | Le nom de la fonction est `get_agency_activity_summary` |
| §2 C8, Annexe A.1 | `admin_request_agency_correction` sans argument | `(p_agency_id uuid, p_reason text)`, motif obligatoire |
| §2 C3, §4.1 | Patch S13 « à appliquer » sur `join_agency` | Fermé autrement le 29.07 ; le patch est sans objet |
| §2 C9 | `verification_status` : la spec dit 6 valeurs, le relais 5 | La spec a raison, le relais est périmé |
| §4.1 (borne `20260731150000`) | fin du lot KYB | Trois migrations vivantes au-delà : `20260731160000`, `170000`, `180000` |
| §5.2, §2 C4 | « `actor_kind='system'` ⇒ `actor_id` NULL », « IA = `actor_kind='ai'` » | La contrainte réelle est `actor_id IS NULL OR actor_kind='user'` : **`ai` aussi** impose `actor_id` NULL. Toute RPC console qui journaliserait une action IA en gardant l'acteur échoue en `23514`. |
| §4.2 | `admin_log.severity ∈ info\|warn\|crit` | `activity_events` dit `critical`. Trois vocabulaires coexistent (`platform_announcements` dit `warning`). |
| §5.10 | « la page Aujourd'hui lit les entrées publiées » (au présent) | Aucun lecteur d'`admin_changelog` côté agent. L'étape 27 part de zéro. |
| §5.11 | « Tout existe » pour le Copilote IA | `ai_usage_logs` n'a pas de colonne d'utilisateur ; `gemini` est hors CHECK |
| §7 | les seuils KYB sont « exposés par `get_agency_verification_config` — ne pas les dupliquer » | Elle n'expose que **2 des 5** seuils, et ses grants excluent `authenticated` : **la console ne peut pas l'appeler**. |
| §5.8, §7 | filet KYB « 15 min » | Trois nombres distincts : cadence cron **horaire** (`25 * * * *`), grâce 15 min, timeout 15 s. La ligne Monitoring doit les afficher séparément. |
| §5.6 | « s'appuyer sur `property_syndications` pour l'état de push » | Table à **0 ligne**, et ses 4 policies sont agence-scopées : la console n'en verra jamais une ligne en lecture directe. |
| §2 C10 / Q11 | relabelliser « ComplyAdvantage » dans Monitoring | Le libellé n'existe dans **aucun** fichier de la console admin ni dans ses locales. Il vit dans le CRM (`locales/*/kyc.json`) et dans `_shared/kyc-extract.ts`. Le relabel est un chantier maquette + CRM, pas Monitoring. |

---

## 8. Contradictions internes du package

- **Revue KYB** : §2 C8 écrit dans la même cellule « File super-admin **en production** (`/dashboard/admin/kyb-review` côté repo) » et « la surface console manque » ; §5.13, Q9 et le plan en font une dépendance bloquante. La surface existe, est routée, est dans le rail, et branche les 7 RPC. Ce qui manque est la **maquette Sugar Pure**.
- **« Voir en tant que »** : la spec §1 acte le retrait ; la maquette du shell (`crm-screen-admin-proto.jsx`, entrée `users`) porte encore une spec « Voir en tant que — LECTURE SEULE » avec audit `admin_log_view_as`. La spec prime ; la contradiction doit être corrigée dans la maquette au moment de l'étape 15.
- **Compte d'entrées** : l'en-tête de `crm-screen-admin-proto.jsx` annonce « 14 entrées » et « 17 pages repo → 14 entrées, 5 groupes » ; le code déclare **11 entrées** (10 construites + « Satisfaction » en `soon`) et **6 groupes**. Un chiffrage pris dans l'en-tête serait faux de 3 entrées.
- **Écrans de maquette** : `front/` contient **12** fichiers d'écran, pas 10 (les décomptes de la spec omettent `admin-agency-detail` et `admin-kyc-diagnostic`).
- **`plan_config`** : §4.2 interdit une 3ᵉ source de prix ; elle existe déjà en base et sert un calcul de MRR en production.
- **Q10** : « ne pas construire d'UI » d'annonces — l'UI existe déjà, complète et routée.

---

## 9. Écarts de sécurité mesurés, hors bloquants 0.1-0.4

Aucun n'est imputable à ce chantier ; tous tombent dans son périmètre d'inventaire.

1. **`activity_events` : `anon` et `authenticated` détiennent `UPDATE`, `DELETE` et `TRUNCATE`** au niveau GRANT. `TRUNCATE` ignore la RLS et ne déclenche aucun trigger ligne-à-ligne, et il n'existe aucun trigger `TRUNCATE`. L'immuabilité revendiquée par le `COMMENT` de la fonction est donc contournable. À traiter avant de bâtir `admin_log` sur le même modèle.
2. **`seller_leads` est un pot commun cross-tenant** : `seller_leads_agents_all` (`FOR ALL`, `authenticated`) autorise `assigned_agency_id IS NULL`, et la policy d'insertion anonyme **force** cette valeur. Tout agent de toute agence peut lire, modifier et supprimer chaque lead entrant, PII comprise.
3. **`subscriptions`** : policy `FOR ALL` avec `USING` mais **sans `WITH CHECK`**, grants d'écriture ouverts, aucun trigger. Un agent peut écrire la ligne d'abonnement de son agence — table qui alimente `compute_platform_mrr_estimate()` et l'écran « lecture seule stricte » de §5.7.
4. ~~**`agency_profiles`** : `read_agency_profiles` = `SELECT` / `authenticated` / `USING(true)` sur 5 906 lignes portant 5 906 `claim_token`.~~ **CORRIGÉ LE 29.07, ce constat est périmé** (revérifié le 03.08.2026). `20260729130000_agency_profiles_read_policy.sql` a repris le `SELECT` au niveau TABLE pour le re-donner **colonne par colonne**, `claim_token` exclu : `authenticated` lit 31 colonnes, et `select claim_token …` rend `42501`. La policy `USING(true)` reste voulue — l'annuaire est un référentiel partagé non cloisonné, et Matching · Recherche en jointe `logo_url` : **ne pas la supprimer**. ⚠ Piège à connaître si l'on revérifie : PostgreSQL nomme la TABLE dans `permission denied` même quand seule une COLONNE manque — une sonde portant sur `claim_token` donne donc l'illusion d'une table fermée. Détail : [docs/audits/2026-08-03-rls-isolation-multi-agence.md](../audits/2026-08-03-rls-isolation-multi-agence.md) §8.
5. **`admin_changelog`** : ses policies testent le rôle en dur et ignorent l'allowlist. Non exploitable aujourd'hui (les 2 comptes `super_admin` sont allowlistés, la table est vide), mais à aligner dans la migration qui ajoutera `scheduled`.
6. **`admin-monitoring`** compare la clé de service par **égalité de chaîne** (`token === svcKey`) alors que §10.3 impose une comparaison à temps constant et que le helper `safeEqual` existe dans le dépôt.
7. **Patron fail-open** dans les deux edges de cycle de vie : l'anti-lockout appelle `super_admin_allowlist_match` en déstructurant `data` sans lire `error`. Si la RPC échoue, la garde tombe à faux.
8. **`super_admin_allowlist_match`** porte une échappatoire CI : une clé `app_config` `super_admin_test_domain` contrainte à `@%.local` accorde le statut par suffixe d'e-mail. Inerte en production (clé absente), mais elle appartient à l'inventaire du mur d'accès.
9. **L'allowlist est un littéral SQL** de 2 adresses, pas une table : toute entrée ou sortie d'un admin exige une migration. §10.3 (« révocation hors allowlist ») et l'étape 31 (« allowlist prod nominale ») n'ont aucun levier runtime.
10. **`get_admin_kyc_magic_links`** rend `contact_name` en liste paginée sans motif ni plafond réel (`greatest()` est un plancher). C'est une liste nominative cross-agences, contraire au principe 1.
11. **`audit-pdf-export` tronque à 10 000 lignes** sur un tri décroissant : la chaîne de hash ne couvre que les événements les plus récents du périmètre filtré. Pour un registre à 10 ans, deux exports du même intervalle peuvent produire deux `chain_hash` différents.
12. **`verify_jwt = false` sur les 68 edges** du projet, sans exception. La garde applicative doit être la toute première instruction de toute nouvelle edge console.
13. **Les gestes mutants ne sont pas rejouables par un worker.** Les 5 RPC de décision KYB n'ont pas de `GRANT` à `service_role`, et `admin_set_agency_plan` est gardée par `is_super_admin()` **seul** — jamais `is_super_admin() OR is_service_role()` comme les 18 RPC de lecture. `is_super_admin()` lit `auth.uid()`, nul sous une clé de service : mesuré le 31.07 en CI, un appel `service_role` rend `42501 forbidden: super_admin required`. Aucun cron, aucune edge, aucun worker d'outbox ne peut donc rejouer une décision KYB ni un changement de plan. À trancher avant d'écrire l'outbox de l'étape 16 : porter le JWT de l'opérateur jusqu'au worker, ou étendre les gardes.

---

## 10. Redondance : la console qui existe déjà

La spec présente le socle comme des ressources « à consommer ». Elles sont en réalité **déjà consommées** par une console en service : 18 pages, 24 hooks, 17 entrées de rail, sous `/dashboard/admin/*`. Le chantier est donc un **remplacement de surface**, et la règle « pas de redondance dans le backend » se joue ici.

**Carte de correspondance (12 écrans de maquette → 18 pages du dépôt)**

| Maquette | Page existante | Nature |
|---|---|---|
| overview | `AdminDashboardPage` | reprise partielle (manquent pulse, « À traiter », activation, tunnel KYC, compteur KYB ; en trop : facturation, rapport hebdo) |
| live | `AdminLiveFeedPage` | reprise |
| agencies · agency-detail | `AdminAgenciesPage` · `AdminAgencyDetailPage` | reprise (à retirer : impersonation, override de plan) |
| users | `AdminUsersPage` + `UserDrawer` | reprise |
| plans | `AdminPlansPage` (poste de triage, PR #1120) | ⚠ `BillingDashboard` **supprimé** le 03.08 avec la refonte de la Vue d'ensemble ; le changement de plan y subsiste, suspendu à la décision PO n° 5 |
| monitoring | `AdminMonitoringPage` | reprise |
| security | `AdminSecurityAuditPage` | reprise, **socle à changer** (`activity_events` → `admin_log`) |
| communications | `AdminCommunicationPage`, onglet Changelog | reprise partielle (l'onglet Annonces est hors périmètre) |
| kyb-review (§5.13) | `AdminKybReviewPage` | **déjà branchée**, à habiller |
| diffusion | `AdminModerationPage` | **remplacement, pas reprise** — objets différents (modération du contenu vs retours du portail) |
| kyc-diagnostic | — | à créer ; le besoin est aujourd'hui servi de façon non conforme par Clients finaux |
| copilot | — | à créer (les 3 pages IA existantes ne sont pas dans la carte) |

**Candidats au retrait — backend exclusif** (part avec la page) : `get_admin_end_user_stats()`, `get_admin_kyc_magic_links()`, `get_admin_compliance_stats()`, `get_admin_moderation_stats()` + `moderation_actions`, `admin_log_impersonation()`, `admin_set_agency_plan()`, `get_whatsapp_autonomy_suggestions()`, `get_whatsapp_tool_usage_stats()`, `get_agent_learned_styles()` / `set_agent_learned_style()`, tables `admin_nps_responses` (0 ligne) et `admin_feature_flags` (**8 lignes, lue par `useFeatureFlags.ts`** — ne pas assimiler à une orpheline).

**À garder même si la page part** (partagé avec le CRM agent ou la vitrine) : `seller_leads`, `contact_messages`, `kyc_magic_links`, `kyc_cases`, `contacts`, `properties.moderation_status`, `ai_usage_logs`, `agency_usage_quotas`, `activity_events`, `platform_metrics`, `subscriptions`, edge `learn-agent-style`, `get_admin_consent_stats()` (à remonter dans le drawer Utilisateurs), et les 4 edges de cycle de vie **à absorber, pas à dupliquer**.

**Sans écran de maquette et sans décision écrite nulle part** — 4 pages : `AdminFeatureFlagsPage`, `AdminAutonomyPage`, `AdminToolUsagePage`, `AdminLearningPage`. La règle « pas de redondance » ne les tranche pas : elles ne doublonnent rien, elles sont hors carte. **Décision PO requise.** `AdminLearningPage` mérite une attention particulière : elle **mute** le style appris d'un agent d'agence, ce qui se confronte au principe « piloter la plateforme, pas les CRM des agences ».

**Trois edges déployées sans dossier au dépôt** : `search-alert`, `seller-portal-action` (dont la table a été supprimée), `sync-service-key` (déployée à la main, entrypoint `/tmp/`). Une ligne « Edge Functions » construite sur la liste déployée afficherait trois fonctions mortes.

**Filets à ne pas casser** : `tests/unit/admin-console-paths.spec.ts` (liste en dur, à mettre à jour à chaque route), `tests/unit/redirects-guard.spec.ts`, `tests/unit/super-admin-gate.spec.ts`, `tests/e2e-admin/admin-coverage.spec.ts`. **Trou mesuré** : `/dashboard/admin/kyb-review` est absente de la liste e2e — la seule surface de décision de conformité livrée n'a aucun test de chargement.

**Le focus clavier de l'étape 4 est déjà en place** : `src/styles/admin-console.css:128-131` pose un anneau `outline: 2px solid !important` sur `.megga-admin-console :focus-visible`, écrit précisément pour survivre à un `outline:none` inline. Le dépôt ne porte qu'**une seule** occurrence d'`outline:'none'` (`adminKit.tsx:536`), la maquette une seule aussi. L'étape 4 se réduit à porter cette règle dans la coquille refondue.

---

## 11. Volumétrie de production, au 31.07.2026

| Table | Lignes | Lecture |
|---|---|---|
| `agencies` | 9 | toutes `status='active'`, toutes `plan='starter'`, **toutes `verification_status='pending'`** |
| `activity_events` | 4 857 | 20 actions distinctes ; `category` NULL sur 4 630 (95,3 %) ; `ip_address` NULL sur **toutes** ; 8 entrées console |
| `platform_metrics` | 29 081 | 20 types ; alimentée par le cron horaire |
| `cron.job_run_details` | 202 000+ | depuis le 23.03.2026, sans purge |
| `ai_usage_logs` | 59 | 1 seule agence, 30 lignes sans `agency_id`, **juin = 0** |
| `ai_balance_snapshots` | 1 053 | seule série historique de coût IA (non citée par la spec) |
| `agency_profiles` | 5 906 | annuaire lisible par tout compte authentifié |
| `subscriptions` · `agency_usage_quotas` · `admin_changelog` · `platform_announcements` · `moderation_actions` · `property_syndications` · `team_invitations` · `admin_nps_responses` | **0** | — |

Deux conséquences directes :

- **Le dispositif KYB n'a jamais été exercé en production** : 0 `identity_submitted_at`, 0 check dans les deux tables, 0 dossier en `manual_review`. Le compteur « À traiter » vaut 0. Toute recette exigera un dossier de test soumis de bout en bout. (Le cron, lui, tourne : 44 exécutions, 100 % `succeeded`, depuis le 29.07.)
- **Un critère de sortie du type « l'écran charge sans erreur » sera vert sans rien prouver.** Le seed synthétique de l'étape 15 est un prérequis de mesure, pas une finition.

---

## 12. Ce qui n'a pas été vérifié

À ne pas tenir pour acquis dans les étapes suivantes :

- La profondeur réelle de l'anonymisation nLPD art. 32 dans `delete-account`, et le sort des dossiers KYC des clients finaux.
- Le comportement réel de `purge_activity_events_retention()` face au trigger `BEFORE DELETE` : la contradiction est déduite de la lecture des deux corps vivants, elle n'a pas été éprouvée (cela demanderait un `DELETE`). C'est le premier test à écrire.
- Le corps ligne à ligne des RPC dont seuls la signature, les grants et la garde ont été comparés.
- Le contenu de `_shared/kyb-sources.ts` : quels connecteurs sont effectivement câblés — non mesurable côté base tant qu'aucun check n'existe.
- Si les 41 jobs cron et les 68 edges citant `activity_events` respectent tous la contrainte de cohérence d'acteur.

---

## 13. Conséquences sur le plan d'exécution

| Étape | Requalification |
|---|---|
| 2 (`admin_log`) | Réduire la table à ce qu'`activity_events` ne peut pas porter (`family`, hash stocké). Prévoir le **rétro-branchement** des gestes existants, pas seulement la création. Ne pas recopier la boucle de rétention qui se journalise elle-même. |
| 3 (convergence entrée console) | **Rien à migrer.** Ajouter un insert `admin_log` dans `admin_log_console_entry`, et décider de la sévérité (`warn` en base vs `info` en §6). L'entrée ne capte ni IP ni user-agent : §5.9 (« anomalie hors-heures + IP inconnue ») n'a pas de donnée d'amorçage. |
| 5 (migrations §4.2) | Passer de 11 objets à **6** (voir §5). Traiter en même temps l'enum `agency_plan` et la 3ᵉ source de prix. |
| 6 (vocabulaire `activity_events`) | Le delta est chiffré : 20 actions en base, 33 clés i18n, ~50 littéraux émis par le code. Trois familles que la spec croit absentes ont un émetteur actif — matching, **biens** (`properties_audit_event()` émet 6 actions `bien_*` qu'aucune i18n ne traduit), diffusion. Manquent réellement : **prix** (aucun émetteur dédié) et **visites** hors WhatsApp. Attention : renommer `stage_change`, `status_change`, `note_added` ou `contact_message_received` casse silencieusement `trg_contact_last_interaction`, donc le CRM agent. |
| 9 (vues) | `v_admin_agency_detail` est bloquée par deux décisions (note, invitations). Borner **toute** liste : trois RPC existantes balaient sans `LIMIT`. |
| 11 (Live realtime) | Ajouter le prérequis `ALTER PUBLICATION` au Lot 0 et le vérifier par un INSERT test. |
| 12 (Monitoring lecture) | Ne pas créer `cron_runs` ni `integration_health`. Écrire une RPC d'historique cron. La bande 24 h par service n'a **aucune source** aujourd'hui. |
| 14b / 19b (KYB) | Requalifier en « habiller », pas « brancher ». Ajouter deux points non prévus : l'accès Storage du relecteur, et le compteur « À traiter » (`get_admin_agency_review_queue` ignore `correction_requested`). |
| 17-18 (gestes) | Étendre 8 équivalents existants. Prévoir le démontage du changement de plan et de l'impersonation. |
| 20 (Copilote) | Bloqué sur l'arbitrage `ai_usage_logs` (colonne d'utilisateur, `gemini`). `get_admin_ai_costs(p_months)` sert déjà ~80 % de `v_ai_month`. |
| 21 (Communications) | Il manque aussi la mutation d'`UPDATE`, absente du dépôt, et un horodatage de publication. |
| 23 (tests) | Le test « JWT agent → refus » échoue aujourd'hui sur deux RPC citées par la spec. À écrire avant les gestes, pas après. |

**Dépendances à re-notifier** : P5 (design KYB) n'est plus bloquante pour le Lot 1. P6 (bloquants pré-lancement) se réduit à deux migrations côté Julien. Q3, Q5, Q8, Q10 et le sort des 4 pages hors carte demandent une décision PO ; Q11 change de destinataire.

---

## Annexe A — census des ressources mesurées

245 ressources, dédupliquées par nom, triées par risque décroissant. L'état est celui de la production au 31.07.2026 ; en cas d'écart avec une ligne ci-dessous, **le corps du document fait foi** (il intègre les corrections de la contre-vérification).

| Ressource | Type | État vs spec | Risque |
|---|---|---|---|
| `activity_events dans la publication supabase_realtime` | table | absent | bloquant |
| `admin_agency_suspend / admin_agency_reactivate` | RPC | partiel | bloquant |
| `admin_console_entry_audit` | table | absent | bloquant |
| `admin_notes` | table | absent | bloquant |
| `admin_request_agency_correction` | RPC | divergent | bloquant |
| `admin_user_set_role` | RPC | divergent | bloquant |
| `AdminCompliancePage.tsx + useAdminCompliance.ts` | front | divergent | bloquant |
| `AdminEndUsersPage.tsx` | front | divergent | bloquant |
| `ai_usage_logs` | table | divergent | bloquant |
| `enum agency_plan vs catalogue 'entreprise'` | contrainte | divergent | bloquant |
| `storage.objects — policies préfixe kyb-identity` | storage | divergent | bloquant |
| `subscriptions` | table | divergent | bloquant |
| `subscriptions — policy agents_own_agency` | policy | divergent | bloquant |
| `team_invitations` | policy | divergent | bloquant |
| `trg_activity_events_immutable_delete` | trigger | présent, non cité | bloquant |
| `activity_events.action — vocabulaire` | colonne | partiel | eleve |
| `activity_events.category` | colonne | divergent | eleve |
| `activity-events-retention` | cron | divergent | eleve |
| `admin_changelog` | table | divergent | eleve |
| `admin_integrations_health` | table | divergent | eleve |
| `admin_log` | table | absent | eleve |
| `admin_log_impersonation` | RPC | présent, non cité | eleve |
| `admin_set_agency_plan` | RPC | présent, non cité | eleve |
| `admin_set_user_role` | RPC | divergent | eleve |
| `admin_user_delete` | RPC | partiel | eleve |
| `admin_user_reset_password` | RPC | partiel | eleve |
| `admin_user_suspend / admin_user_reactivate` | RPC | divergent | eleve |
| `admin_validate_agency_review / admin_reject_agency_review / admin_relaunch_agency_review / admin_resolve_agency_id_document / admin_request_agency_correction` | RPC | conforme | eleve |
| `admin-agency-lifecycle` | edge | divergent | eleve |
| `admin-stripe-metrics` | edge | présent, non cité | eleve |
| `admin-user-lifecycle` | edge | divergent | eleve |
| `AdminAgencyDetailPage.tsx` | front | partiel | eleve |
| `AdminCommunicationPage.tsx + AnnouncementsTab` | front | divergent | eleve |
| `AdminKybReviewPage.tsx + useAdminKybReview.ts` | front | présent, non cité | eleve |
| `AdminLearningPage.tsx + get_agent_learned_styles` | front | présent, non cité | eleve |
| `AdminModerationPage.tsx + useAdminModeration.ts` | front | divergent | eleve |
| `AdminPlansPage.tsx` | front | divergent | eleve |
| `agencies` | grant | divergent | eleve |
| `agencies.identity_submitted_at` | colonne | divergent | eleve |
| `agencies.plan / agencies.billing / agencies.stripe_customer_id` | colonne | partiel | eleve |
| `agencies.verification_score` | colonne | divergent | eleve |
| `agencies.verification_status` | colonne | divergent | eleve |
| `agencies.verified_at` | colonne | divergent | eleve |
| `app_config.plan_pricing` | colonne | présent, non cité | eleve |
| `app_config.plan_pricing + compute_platform_mrr_estimate` | RPC | présent, non cité | eleve |
| `audit-pdf-export` | edge | présent, non cité | eleve |
| `CHECK ai_usage_logs_provider_check` | contrainte | divergent | eleve |
| `compute_platform_mrr_estimate` | RPC | présent, non cité | eleve |
| `Console admin déjà en production` | front | présent, non cité | eleve |
| `Diagnostic de lien KYC` | front | absent | eleve |
| `enum agency_plan` | colonne | divergent | eleve |
| `get_admin_kyc_magic_links` | RPC | conforme | eleve |
| `get_agency_activity_summary` | RPC | divergent | eleve |
| `get_agency_verification_config` | RPC | divergent | eleve |
| `get_onboarding_milestones` | RPC | divergent | eleve |
| `Impersonation` | front | divergent | eleve |
| `listing_signals` | table | absent | eleve |
| `PLAN_LIMITS de send-team-invite` | edge | divergent | eleve |
| `policies admin_changelog_select / admin_changelog_write` | policy | divergent | eleve |
| `Policies RLS team_invitations` | policy | divergent | eleve |
| `property_syndications` | table | divergent | eleve |
| `public.admin_console_entry_audit` | table | absent | eleve |
| `public.properties_audit_event` | trigger | présent, non cité | eleve |
| `purge_activity_events_retention` | RPC | divergent | eleve |
| `rpc_receipts` | table | absent | eleve |
| `src/hooks/useAdminLiveFeed.ts` | front | divergent | eleve |
| `src/lib/plans.ts — PLAN_LIMITS` | front | divergent | eleve |
| `src/pages/admin/AdminKybReviewPage.tsx + src/hooks/useAdminKybReview.ts` | front | présent, non cité | eleve |
| `stripe_subscriptions` | table | absent | eleve |
| `subscriptions.plan` | colonne | présent, non cité | eleve |
| `tests/e2e-admin/admin-coverage.spec.ts + playwright.admin.config.ts` | front | partiel | eleve |
| `Volumétrie de production` | table | divergent | eleve |
| `activity_events` | table | conforme | moyen |
| `activity_events — contraintes CHECK` | contrainte | divergent | moyen |
| `activity_events_actor_kind_coherence` | contrainte | divergent | moyen |
| `activity_events.ip_address` | colonne | divergent | moyen |
| `admin_agency_invite_member` | RPC | partiel | moyen |
| `admin_create_agency` | RPC | divergent | moyen |
| `admin_log_console_entry` | RPC | divergent | moyen |
| `admin_user_resend_invite` | RPC | partiel | moyen |
| `admin-monitoring` | edge | divergent | moyen |
| `admin-stripe-agency-billing` | edge | présent, non cité | moyen |
| `admin-stripe-metrics / admin-stripe-agency-billing / weekly-report / weekly-digest` | edge | présent, non cité | moyen |
| `admin-user-lifecycle + delete-account + admin-dsar-export` | edge | présent, non cité | moyen |
| `AdminAgenciesPage.tsx + useAdminAgencies.ts` | front | partiel | moyen |
| `AdminAutonomyPage.tsx + get_whatsapp_autonomy_suggestions` | front | présent, non cité | moyen |
| `AdminConsoleRoutes.tsx` | front | divergent | moyen |
| `AdminDashboardPage.tsx` | front | partiel | moyen |
| `AdminFeatureFlagsPage.tsx + admin_feature_flags` | front | présent, non cité | moyen |
| `AdminLiveFeedPage.tsx + useAdminLiveFeed.ts` | front | partiel | moyen |
| `AdminMonitoringPage.tsx` | front | partiel | moyen |
| `AdminNpsPage.tsx + admin_nps_responses` | front | divergent | moyen |
| `AdminSecurityAuditPage.tsx + useSecurityAudit.ts` | front | partiel | moyen |
| `AdminShell.tsx` | front | divergent | moyen |
| `AdminToolUsagePage.tsx + get_whatsapp_tool_usage_stats` | front | présent, non cité | moyen |
| `AdminUsersPage.tsx + UserDrawer.tsx` | front | partiel | moyen |
| `agencies — GRANT UPDATE à anon` | grant | présent, non cité | moyen |
| `agencies — volumétrie par verification_status` | table | conforme | moyen |
| `agencies.verification_*` | colonne | partiel | moyen |
| `agencies.verification_sweep_attempts` | colonne | divergent | moyen |
| `agency_activation` | table | partiel | moyen |
| `agency_profiles.read_agency_profiles` | policy | présent, non cité | moyen |
| `audit/patches/05-S13-join-agency-invite-gate.md` | front | divergent | moyen |
| `CHECK activity_events_category_check / _severity_check / _actor_kind_coherence` | contrainte | conforme | moyen |
| `Copilote IA` | front | partiel | moyen |
| `cron agency-verification-sweep-hourly` | cron | divergent | moyen |
| `cron de publication du changelog` | cron | absent | moyen |
| `cron_runs` | table | partiel | moyen |
| `deployments` | table | absent | moyen |
| `edge accept-team-invite` | edge | conforme | moyen |
| `edge send-team-invite` | edge | divergent | moyen |
| `Émission d'activity_events — recensement des points` | trigger | conforme | moyen |
| `Export CSV dans la console` | front | divergent | moyen |
| `Familles §5.2 sans émetteur : prix, visites` | trigger | partiel | moyen |
| `get_admin_agency_review_detail` | RPC | divergent | moyen |
| `get_admin_agency_review_queue` | RPC | divergent | moyen |
| `get_admin_agency_usage` | RPC | divergent | moyen |
| `get_admin_ai_costs` | RPC | présent, non cité | moyen |
| `get_admin_end_user_stats` | RPC | divergent | moyen |
| `get_admin_integrations_health` | RPC | divergent | moyen |
| `get_admin_moderation_stats` | RPC | présent, non cité | moyen |
| `get_admin_quota_breaches` | RPC | conforme | moyen |
| `get_admin_usage_overview` | RPC | divergent | moyen |
| `get_cron_health` | RPC | présent, non cité | moyen |
| `identity_submitted` | RPC | divergent | moyen |
| `incidents` | table | absent | moyen |
| `Index activity_events` | index | partiel | moyen |
| `Inventaire complet : fonctions SECURITY DEFINER du schéma public encore EXECUTE-ables par anon ou PUBLIC` | grant | partiel | moyen |
| `outbox_jobs` | table | partiel | moyen |
| `plan_config` | table | divergent | moyen |
| `platform_announcements` | table | divergent | moyen |
| `policy agency_usage_quotas_super_admin_all` | policy | divergent | moyen |
| `public.join_agency` | RPC | divergent | moyen |
| `public.team_invitations` | table | conforme | moyen |
| `realadvisor_fill_agency_logos` | RPC | divergent | moyen |
| `REVOKE UPDATE` | grant | divergent | moyen |
| `src/components/admin/AnnouncementsTab.tsx + AnnouncementFormModal.tsx + src/hooks/useAnnouncementsAdmin.ts` | front | présent, non cité | moyen |
| `src/components/admin/kit/` | front | non vérifié | moyen |
| `src/hooks/useChangelog.ts + AdminCommunicationPage` | front | partiel | moyen |
| `src/lib/consents.ts — versions courantes` | front | divergent | moyen |
| `stripe-webhook / stripe-checkout / stripe-portal / admin-stripe-metrics / admin-stripe-agency-billing` | edge | partiel | moyen |
| `supabase_migrations.schema_migrations` | table | divergent | moyen |
| `supabase/migrations/20260729100000_activity_events_technical_actions.sql` | contrainte | divergent | moyen |
| `super_admin_allowlist` | RPC | divergent | moyen |
| `super_admin_allowlist_match` | RPC | présent, non cité | moyen |
| `trg_contact_last_interaction` | trigger | présent, non cité | moyen |
| `useAdminSearch.ts` | front | présent, non cité | moyen |
| `v_ai_month` | vue | absent | moyen |
| `Vues §4.3` | vue | absent | moyen |
| `activity_events_severity_check` | contrainte | divergent | faible |
| `admin_feature_flags · admin_nps_responses · platform_announcements` | table | présent, non cité | faible |
| `admin_reject_agency_review` | RPC | divergent | faible |
| `admin_relaunch_agency_review` | RPC | divergent | faible |
| `admin_resolve_agency_id_document` | RPC | divergent | faible |
| `admin_set_agency_quotas` | RPC | conforme | faible |
| `admin_user_dsar_export` | RPC | conforme | faible |
| `admin_validate_agency_review` | RPC | divergent | faible |
| `admin-dsar-export` | edge | conforme | faible |
| `agencies — colonnes de vérification` | colonne | conforme | faible |
| `agencies_audit_identity_columns_trg` | trigger | présent, non cité | faible |
| `agencies_guard_identity_columns_trg` | trigger | présent, non cité | faible |
| `agencies_notify_verification_decision` | trigger | conforme | faible |
| `agencies.business_registration_number` | colonne | divergent | faible |
| `agencies.legal_form_id` | colonne | divergent | faible |
| `agency_related_persons` | table | conforme | faible |
| `agency_usage_quotas` | table | conforme | faible |
| `agency-verification-notify` | edge | conforme | faible |
| `ai_drift_dismissals` | table | absent | faible |
| `c2pa-sign / c2pa-verify` | edge | divergent | faible |
| `cron.job` | cron | conforme | faible |
| `Edges déployées orphelines du dépôt` | edge | divergent | faible |
| `get_admin_compliance_stats` | RPC | présent, non cité | faible |
| `get_admin_consent_stats` | RPC | conforme | faible |
| `get_admin_dashboard_stats` | RPC | présent, non cité | faible |
| `get_agency_stats` | RPC | conforme | faible |
| `invitation_status` | contrainte | conforme | faible |
| `is_service_role` | RPC | présent, non cité | faible |
| `join_agency` | RPC | divergent | faible |
| `Policies UPDATE de profiles + grants colonne` | grant | conforme | faible |
| `policy announcements_select` | policy | conforme | faible |
| `public.user_consents` | table | conforme | faible |
| `recompute_agency_verification` | RPC | divergent | faible |
| `rpc_receipts / outbox_jobs / cron_runs / deployments / incidents / listing_signals / agency_activation / ai_drift_dismissals / stripe_subscriptions` | table | absent | faible |
| `seller-portal-action` | edge | divergent | faible |
| `Socle RPC admin existant` | RPC | conforme | faible |
| `src/lib/adminConsoleAudit.ts` | front | conforme | faible |
| `tests/unit/admin-console-paths.spec.ts` | front | divergent | faible |
| `translation_cache.public_read_translation_cache` | policy | présent, non cité | faible |
| `user_consents + get_admin_consent_stats` | RPC | conforme | faible |
| `verify_jwt des 6 edges admin` | edge | conforme | faible |
| `_agency_identity_completeness_error` | RPC | présent, non cité | aucun |
| `_latest_person_verification_check` | RPC | présent, non cité | aucun |
| `activity_events_actor_kind_check` | contrainte | conforme | aucun |
| `activity_events_category_check` | contrainte | conforme | aucun |
| `admin_overview` | vue | absent | aucun |
| `AdminConsoleRoute.tsx + useSuperAdminGate.ts` | front | conforme | aucun |
| `agencies — policies UPDATE` | policy | conforme | aucun |
| `agencies_guard_verification_columns_trg` | trigger | conforme | aucun |
| `agencies.status` | colonne | conforme | aucun |
| `agency_person_roles` | table | conforme | aucun |
| `agency_person_verification_checks` | table | conforme | aucun |
| `agency_verification_checks` | table | conforme | aucun |
| `agency-verification-run` | edge | conforme | aucun |
| `agency-verification-sweep-hourly` | cron | conforme | aucun |
| `ai_usage_logs.estimated_cost_usd` | colonne | conforme | aucun |
| `check_email_exists` | RPC | conforme | aucun |
| `contacts` | policy | absent | aucun |
| `Diffusion` | front | absent | aucun |
| `get_admin_monitoring_health` | RPC | conforme | aucun |
| `get_admin_seller_portals` | RPC | absent | aucun |
| `get_admin_support_stats` | RPC | absent | aucun |
| `get_admin_syndication_health` | RPC | conforme | aucun |
| `get_admin_whatsapp_health` | RPC | conforme | aucun |
| `get_visit_by_token` | RPC | conforme | aucun |
| `index de ai_usage_logs` | index | conforme | aucun |
| `is_agency_lab_cleared` | RPC | conforme | aucun |
| `is_super_admin` | RPC | conforme | aucun |
| `legal_form_aliases` | table | conforme | aucun |
| `legal_forms` | table | conforme | aucun |
| `Les 11 RPC de maintenance/cron du patch 06` | grant | conforme | aucun |
| `moderation_actions` | table | conforme | aucun |
| `platform_metrics` | table | conforme | aucun |
| `Policies RLS activity_events` | policy | conforme | aucun |
| `properties.moderation_status` | colonne | conforme | aucun |
| `public.activity_events` | table | conforme | aucun |
| `public.admin_log` | table | absent | aucun |
| `record_agency_verification_run` | RPC | conforme | aucun |
| `record_consent` | RPC | conforme | aucun |
| `seller_leads.seller_leads_anon_insert` | policy | conforme | aucun |
| `src/lib/plans.ts — PLANS` | front | conforme | aucun |
| `submit_agency_identity` | RPC | conforme | aucun |
| `support_tickets` | policy | conforme | aucun |
| `sweep_pending_agency_verifications` | RPC | conforme | aucun |
| `tables §4.2 à créer — état de présence` | table | absent | aucun |
| `Tables du schéma public sans RLS` | table | conforme | aucun |
| `tests/unit/redirects-guard.spec.ts` | front | conforme | aucun |
| `tests/unit/super-admin-gate.spec.ts` | front | conforme | aucun |
| `tg_profiles_guard_role_agency` | trigger | conforme | aucun |
| `ticket_events / ticket_messages` | table | absent | aucun |
| `trg_activity_events_immutable_update` | trigger | conforme | aucun |
| `trigger trg_log_announcement_published` | trigger | conforme | aucun |
| `user_consents_select_own_or_admin` | policy | conforme | aucun |
| `verification_check_config` | table | conforme | aucun |
| `verification_check_types` | table | conforme | aucun |
| `visits` | policy | conforme | aucun |
