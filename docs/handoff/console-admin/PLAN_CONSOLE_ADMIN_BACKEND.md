# PLAN D'EXÉCUTION — Console MEGGA · Backend

> **Version 2.0 · 31 juillet 2026.** Plan de projet pour l'implémentation backend de la console super-admin.
> Spec de référence : `HANDOFF_CONSOLE_ADMIN_CLAUDE_CODE.md` (chaque étape pointe sa section §). Gabarit de geste : `HANDOFF_KYC_DIAGNOSTIC.md`.
> Méthode : **une étape = une PR = un livrable vérifiable**. Passage de phase uniquement par **gate** (critères de sortie mesurables, jamais « à peu près »).

---

## 0. Synthèse exécutive

| | |
|---|---|
| Durée estimée | **6-7 semaines** (1 dev backend senior + revues) |
| Jalons | **G0** porte sécurisée (fin S1) → **G1** console en lecture réelle (fin S3) → **G2** gestes contractualisés (fin S5) → **G3** boucles externes (fin S6-7) → **G4** go-live |
| Chemin critique | inventaire de l'existant (§4.1) → migrations → compléments d'instrumentation → vues → RPC → connecteur portail |
| Dépendances externes | **2 bloquantes** : design de la surface Revue KYB (P5, PO) · contrat webhook Immobilier.ch (équipe intégration, bloque S6 seulement) |
| Risque n°1 | ~~Grille de plans~~ (close 31.07 : `src/lib/plans.ts`). Nouveau : **réécrire ce qui existe déjà** — le repo porte `activity_events`, `user_consents`, `team_invitations`, quotas/usage, 7 RPC de revue KYB. **Inventaire §4.1 obligatoire avant toute RPC.** |
| Effort total | ~33 étapes · 14 XS-S, 14 M, 5 L |

---

## 1. Gouvernance & rôles

| Rôle | Qui | Responsabilité |
|---|---|---|
| **R** Réalisation | Claude Code (backend) | Migrations, RPC, webhooks, tests, seed |
| **A** Arbitrage produit | PO | Q1-Q8 du handoff (dont Q5 grille de plans), gates |
| **C** Consultés | Thomas (onboarding KYB) | Couplages C1-C10 (§2 du handoff, vérifiés sur sa branche `claude/onboarding-kyb-etape-7-2ad668`) : création d'agence, catalogue de plans, `team_invitations`, `activity_events`, `user_consents`, revue KYB |
| **C** Consultés | Équipe intégration | Contrat webhook Immobilier.ch (P3), file de dépublication |
| **I** Informés | Ops MEGGA | Alerte hors console, exports `admin_log`, accès allowlist |

**Rituels** : démo à chaque gate (sur staging seedé) · point de synchro Thomas ↔ console **avant S2** (C1-C6) puis à G1 · toute déviation de la spec = amendement du handoff, jamais de décision silencieuse dans le code.

---

## 2. Dépendances amont (à lever AVANT, pas pendant)

| # | Dépendance | Bloque | Owner | Deadline |
|---|---|---|---|---|
| ~~P1~~ | **RÉSOLUE (31.07)** — grille = `src/lib/plans.ts` : Starter 0 / Pro 89 / Entreprise 249 CHF. Reste : arbitrage sièges `team_members` (1/5/∞) vs `maxAgents` (1/1/10) | étape 17 (plafond d'invitation) | PO + Thomas | fin S1 |
| ~~P2~~ | **RÉSOLUE (31.07)** — `activity_events` existe (append-only, clés techniques + i18n `audit.action.*`) ; reste à compléter le vocabulaire manquant (étape 6) | — | — | — |
| P3 | **Contrat webhook portail** (codes de refus → mapping causes, HMAC, §5.6) | Étapes 24-26 (Lot 3 uniquement) | Équipe intégration | fin S4 |
| P4 | Décisions Q4 (rollback : reco deep-link CI) et Q8 (dernier admin : reco refus serveur) | Étapes 18, 29 | PO | avant Lot 2 |
| **P5** | **Design de la surface Revue KYB** (Q9, §5.13) — le backend existe (7 RPC en prod), la maquette console manque. ⚠ **Requalifiée par l'inventaire (31.07)** : la surface EXISTE au repo (`AdminKybReviewPage.tsx`, routée, 7 RPC branchées). P5 ne bloque plus le Lot 1 fonctionnellement — il manque l'habillage Sugar Pure. | Étapes 14b, 19b | PO (+ maquette Omelette) | fin S1 |
| **P6** | **Bloquants pré-lancement 0.1→0.4** (`HANDOFF_PRELANCEMENT_ADMIN.md`). **Mesurés le 31.07** (inventaire §6) : 0.1 fermé autrement, 0.3 fermé, **0.2 et 0.4 partiels**. Les deux migrations de fermeture sont livrées : `20260731190000` (garde super-admin sur `get_onboarding_milestones` / `get_agency_activity_summary` + revoke anon des 2 RPC logos) et `20260731200000` (gel de `agencies.plan` / `billing` / `stripe_customer_id`). | G1 | Julien / CC | avant G1 |

---

## 3. Plan par phases

### Phase 0 — La porte (S1) → **Gate G0**
| # | Étape | § | Effort | Dépend de |
|---|---|---|---|---|
| 1 ✅ | **Inventaire du socle existant (§4.1)** : rôle/allowlist, handover, RPC admin déjà en prod (ops health, lifecycle & billing, end users, integrations health, create agency, quotas/usage, revue KYB) — écrire le delta réel repo ↔ spec — **FAIT (PR #1043, 31.07.2026)** : [docs/console-admin/INVENTAIRE_SOCLE.md](../../console-admin/INVENTAIRE_SOCLE.md), 245 ressources mesurées en base. Lire son §7 (amendements à porter à la spec) et §13 (étapes à requalifier) avant l'étape 2. | §1 §4.1 | S | — |
| 2 ✅ | **FAIT** — `admin_log` réduit (family + chaîne stockée), tête en O(1), 4 triggers dont TRUNCATE, 17 tests. Design passé en revue adversariale : 24 défauts, 7 bloquants. `admin_log` : table, trigger append-only (REFUSE update/delete), chaîne de hash, insert sérialisé, cron de vérification | §4 §5.9 §10.4 | **L** | 1 |
| 3 ✅ | **FAIT** — rien à migrer (`admin_console_entry_audit` est un nom de fichier) : la fonction écrit dans les deux journaux. IP/user-agent depuis `auth.sessions`. TTL 8 h EXPOSÉ, pas imposé (décision PO). Entrée console journalisée (famille `session`, migration `admin_console_entry_audit`), TTL 8 h, révocation hors allowlist | §1 §10.3 | M | 2 |
| 4 ✅ | **FAIT** — l'anneau existait déjà (`admin-console.css`) ; ce qui manquait était le garde-fou. Test vérifié par mutation dans trois directions. | §1 | XS | — |

**G0 — critères de sortie** (état au 31.07.2026, tous couverts par des tests permanents ; balayage de la surface RPC : 32 fonctions et non 27 — les 5 sans préfixe `admin_` sont précisément celles où les fuites se trouvaient) : un JWT agent reçoit `unauthorized` sur toute route admin · une entrée console apparaît dans `admin_log` avec hash chaîné · test « ligne altérée en SQL brut → vérification échoue » vert.

### Phase 1 — La console qui regarde (S2-S3, lecture seule) → **Gate G1**
| # | Étape | § | Effort | Dépend de |
|---|---|---|---|---|
| 5 | Migrations §10.6 : catalogue de plans C2 (source `src/lib/plans.ts` + Stripe) → tables §4.2 seulement (**rien créer en double avec §4.1**) | §4 §10.6 | **L** | G0 |
| 6 | Compléter l'instrumentation `activity_events` (vocabulaire §5.2 en **clés techniques snake_case** + libellés i18n `audit.action.*` ; catégorie CHECK, actor_kind) — offres, KYC, contacts, quotas, annonces émettent déjà | §5.2 §2 C4 | M | 5 |
| 7 | Miroir Stripe : webhooks signés (`invoice.*`, `subscription.*`) + backfill API une passe | §5.7 §10.3 | M | 5 |
| 8 | `agency_activation` : triggers 6 jalons + score nightly + backfill historique (min(created_at) par entité) | §4 §10.6 | M | 6 |
| 9 ✅ | **FAIT** — `agency_mrr()` (règle isolée dans `agency_mrr_rule()`, pure et IMMUTABLE : la garde de l'entrée joint `profiles` à `auth.users`, on ne la rejoue pas par ligne) + **6 vues sur 12 seulement**. `v_admin_kpis` = `get_admin_dashboard_stats()` existante (correspondance 1:1 avec `ADMIN_KPIS`) et `v_monitoring_board` = `get_admin_monitoring_health()` + ops health + `get_admin_cron_runs()` : **rien à créer**. `v_kyc_funnel_30d` / `v_security_journal` déjà posées (240000/260000) ; diffusion, IA et changelog relèvent des lots 2-3. Amendements : mrrTrend / revenue30d / churn **sans source**, file « sièges saturés » suspendue à la décision 4. ⚠ p95 < 300 ms non mesuré — la base de recette (100 agences / 1M événements) n'existe pas encore, elle arrive avec le seed de l'étape 15. | §4 §10.4 | **L** | 5-8 |
| 10 ✅ | **FAIT** — `admin_overview()` ASSEMBLE, elle ne crée rien : elle appelle les sept sources plutôt que de recopier leurs requêtes. ⚠ Le journal filtre par `is distinct from 'kyc'` et non `<> 'kyc'` : `category` est NULL sur 95 % des lignes (décision 6), un `<>` aurait vidé le journal en silence. Amendements : **aucun système de tickets n'existe** (signal §5.1 déclaré manquant, pas simulé) ; `crons_late` remplacé par `crons_failed`, qui se mesure sans interpréter un planning cron ; le signal **KYB est ajouté** à la maquette, qui précède le module. ⚠ Ce plan citait `admin_ops_health_rpcs` (`20260705172000`) — **cette fonction n'existe pas** : la migration a créé `get_admin_syndication_health`, `_whatsapp_health` et `_ai_costs`. | §5.1 | S | 9 |
| 11 | Live : pagination serveur 14/page + Realtime INSERT + fallback polling 30 s | §5.2 §10.9 | M | 6 |
| 12 | Monitoring lecture : `cron_runs` (heartbeats), `integration_health` (cron 5 min), `deployments` (webhook CI signé), incidents dérivés + corrélation déploiement | §5.8 | M | 5 |
| 13 | `v_kyc_funnel_30d` — agrégat seul, zéro nom (revue de code : aucune colonne nominative) | §5.5 | S | 5 |
| 14 ✅ | **FAIT** — migration livrée le 31.07, **tests écrits le 01.08** (`admin-security-read.spec.ts`). Éprouvés : la fenêtre **Europe/Zurich** (Zurich n'est jamais à UTC+0, l'écart existe donc en toute saison), la neutralisation des **jokers** `%`/`_` (un `%` tapé ne doit pas se comporter comme « tout »), la recherche **unaccent**, la partition routine / non-routine, l'arbitrage « compteurs sur la liste principale » (chaque puce non nulle DOIT ouvrir une liste non vide), les **paires ordonnées** de metadata (WITH ORDINALITY) et le NULL sur tableau vide (`[]` est truthy en JS), l'ordre total `ts desc, seq desc`. Au passage : `admin_security_window` et `admin_security_entity` étaient exécutables par **anon** faute de REVOKE — le balayage de gardes ne les voit pas, il ne filtre que les SECURITY DEFINER. | §5.9 | S | 2 |
| 14b | **Revue KYB en lecture** : brancher `get_admin_agency_review_queue` + `get_admin_agency_review_detail` (RPC existantes) sur la surface actée P5 | §5.13 | M | P5, G0 |
| 15 ✅ | **FAIT** — **seed** : `scripts/seed-admin-staging.mjs` + générateur PUR et déterministe (14 agences / 56 comptes / 3 plans C2), 7 tests unitaires sans base ; la référence du projet de **production est refusée en dur** et `--confirm` est obligatoire. **Branchement** : `useAdminAgencies` (3 appels → 1), `useAdminUsers` (2 → 1), `useAdminBilling` (**MRR recalculé en TS → `get_admin_plans_board()`** — les deux règles avaient déjà divergé sur les agences suspendues). Formes exportées préservées : aucune page touchée. ⚠ Amendements : les **2 échelles Diffusion ne sont pas seedées** (`listing_signals` est du Lot 3) ; `useAdminStats` n'est **pas** rebranché sur `admin_overview()` — il passe déjà par une RPC unique, et le brancher ferait payer journal + triage + tunnel à une page qui ne veut que 7 compteurs. | §10.8 | M | 9-14 |

**G1 — critères de sortie** : chaque écran charge sur staging < 1 s sans erreur console · compteurs Vue d'ensemble = sommes des tables (zéro contradiction) · e2e `admin-coverage` vert · **aucun bouton d'action actif** · démo PO.

### Phase 2 — Les gestes (S4-S5) → **Gate G2**
| # | Étape | § | Effort | Dépend de |
|---|---|---|---|---|
| 16 ✅ | **FAIT** — quatre primitives, aucun bouton activé. `admin_error`/`admin_ok` (vocabulaire **fermé** de 8 codes ; un code inventé lève 22023 à l'écriture). `admin_lock_entity` (verrou de **transaction**, deux clés type+id pour éviter une collision silencieuse). `rpc_receipts` + `admin_receipt_try` — l'atomicité vient de la **primary key**, pas d'un test-puis-agit, et le test l'éprouve en CONCURRENCE (10 appels → 1 réservation), parce que deux appels séquentiels passeraient même avec l'implémentation naïve. `outbox_jobs` + enqueue/claim/settle (backoff 30 s→16 min borné, mort après N, jamais repris seul). ⚠ `admin_outbox_claim`/`_settle` ne sont **pas** accordées à `authenticated` : aucun écran n'en a l'usage, et leur garde `session_user` aurait consommé la moitié de la marge du balayage de gardes. ⚠ `digest()` vit dans `extensions` → `sha256()` de `pg_catalog`, sinon 42883 à l'exécution. | §10.1-10.2 | **L** | G1 |
| 17 | Agences : `create` (**brancher `admin_create_agency` existante**, invariant d'unicité partagé C1) · `suspend` (sessions + dépublication + pause Stripe via outbox) · `reactivate` · `invite_member` (**`team_invitations`**, sièges = catalogue C2 après arbitrage) | §5.3 | M | 16 |
| 18 | Utilisateurs : `set_role` (Q8) · `reset_password` · `resend_invite` (C6) · `suspend/reactivate` · `delete` (nLPD art. 32, anti-lockout serveur) · `dsar_export` généré serveur | §5.4 | M | 16 |
| 19 ✅ | **FAIT** — handoff appliqué tel quel : motif OBLIGATOIRE (agence existante + référence), requête normalisée ≥ 3 car., **plafond 3** au-delà duquel seul le COMPTE sort, **sept champs** par correspondance (ni jeton, ni URL, ni documents, ni IP, ni user-agent — toutes présentes sur la ligne, d'où une projection énumérée à la main), rate limit 10/h/acteur compté **dans `admin_log`** pour qu'il ne diverge pas du journal qui fait foi. ⚠ Amendement : la régénération **ne peut pas émettre** le lien — le jeton est un HMAC signé en Edge Function, donc l'émission part dans l'outbox de l'étape 16. ⚠ 4ᵉ argument `p_idempotency_key` ajouté (§10.2 l'impose sur toute RPC mutante). | §5.5 | M | 16 |
| 19b | **Décisions KYB** : brancher les 5 RPC existantes (valider · rejeter · correction · relancer · pièce d'identité) + écriture `admin_log` famille `kyb` — **zéro nouvelle RPC**, invariants du relais Thomas respectés | §5.13 | S | 14b, 16 |
| 20 ✅ | **FAIT** — `get_admin_ai_month()` (mois × agence : coût, appels, **part**, médiane par agence) + dérives du mois EN COURS + `ai_drift_dismissals` et son geste « Rien à signaler », idempotent **par la clé primaire** (mois, dérive) — deux super-admins qui écartent la même dérive convergent au lieu de se doubler. ⚠ `get_admin_ai_costs()` **non recréée** : grain différent (elle descend au provider/module, la part n'y est pas calculable). ⚠ **Amendement : la moitié « par compte » de §5.11 n'a aucune source** — `ai_usage_logs` ne porte aucune colonne d'utilisateur, et toute la chaîne d'écriture est agence. C'est un chantier d'instrumentation, pas une vue ; nommé dans `unavailable`, avec un test qui rougira si la colonne apparaît. ⚠ Dérive = 95 % du plafond (§7), distinct de l'alerte à `alert_threshold_pct` (80). | §5.11 | M | 5 |
| 21 | Communications : **étendre `admin_changelog` (existante)** — état `scheduled` + cron `changelog-publish` + RPC save/publish/schedule/unpublish | §5.10 | S | 16 |
| 22 | Exports journalisés — **DSAR (JSON) + `admin_log_export` PDF signé uniquement ; aucun export CSV (décision 31 juil.)** | §5.4 §5.9 | S | 2 |
| 23 | Tests par RPC : nominal · chaque garde-fou · idempotence (2 appels = 1 effet) · **ligne `admin_log` présente** · refus JWT agent | §10.7 | M | 17-22 |

**G2 — critères de sortie** : matrice de tests §10.7 verte · un geste par écran démontré de bout en bout (UI → RPC → ligne visible dans Sécurité avec metadata) · double-clic sur « Suspendre » = un seul effet · revue sécurité (rate limits actifs, secrets en env).

### Phase 3 — Les boucles externes (S6-S7) → **Gate G3**
| # | Étape | § | Effort | Dépend de |
|---|---|---|---|---|
| 24 | Webhook Immobilier.ch signé (HMAC ±5 min) + table de mapping causes → `listing_signals` | §5.6 | M | P3, 16 |
| 25 | Cron de contrôle post-publication (mandat/échu/doublon adresse normalisée/vendu/prix 3× médiane via `market_listings`) + fermeture auto des signaux | §5.6 | **L** | 24 |
| 26 | RPC Diffusion : `keep` · `remove` (dépublication outbox + notification motif) · `request_fix` · `cause_batch` (digest par agence) · `field_make_required` (flag produit lu par le wizard CRM) | §5.6 | M | 25 |
| 27 | « What's new » : endpoint lecture agent (`published` only, RLS) branché sur la page Aujourd'hui | §5.10 | S | 21 |
| 28 | Ops : `function_replay` · `cron_run_now` · `wa_deadletter_replay` · `calendar_resync` (verrous, journalisés) | §5.8 | M | 16 |
| 29 | Rollback : deep-link CI (décision P4) — RPC seulement si Q4 revalidée par le PO | §5.8 | XS | P4 |
| 30 | « Qui surveille le surveillant » : alerte hors console (silence `activity_events` 30 min ouvrées) + export hebdo chiffré `admin_log` hors projet | §10.9 | S | 6 |

**G3 — critères de sortie** : un refus portail simulé ouvre un signal et le poste de contrôle le traite · un retrait dépublie réellement (staging connecteur) et notifie · une nouveauté publiée apparaît dans « What's new » agent.

### Phase 4 — Go-live → **Gate G4**
| # | Étape | § | Effort |
|---|---|---|---|
| 31 | Bascule prod par flag d'env (pas un déploiement) · retrait des tweaks/échelles de démo · purges & rétentions actives (Live 30 j, partitions) · PITR vérifié · allowlist prod nominale (3-4 comptes) · runbook incident 1 page | §7 §10.8-10.9 | M |

**G4 — critères de sortie** : 48 h en prod sans erreur Sentry console · premier export du registre produit et vérifié · rétentions observées (drop de partition constaté) · PO signe.

---

## 4. Registre des risques

| # | Risque | P×I | Mitigation | Owner |
|---|---|---|---|---|
| R1 | **Réécrire ce qui existe déjà** (tables/RPC §4.1) → doublons, dérive de contrat | **H×H** | Étape 1 = inventaire obligatoire ; revue de PR : toute nouvelle table/RPC cite pourquoi §4.1 ne suffit pas | CC |
| R2 | Onboarding (Thomas) et console créent des agences avec des règles divergentes → doublons | H×H | **`admin_create_agency` existante = la porte console** ; même invariant d'unicité que le provisioning (C1) | Thomas + CC |
| R3 | Instrumentation `activity_events` oubliée dans des coins du CRM → console aveugle | M×H | Étape 6 = liste de couverture exhaustive (vocabulaire §5.2) revue en PR ; compteur « événements/jour » suivi dès staging | CC |
| R4 | Contrat portail livré en retard | M×M | Lot 3 isolé : G2 livrable sans lui ; mock du webhook dès l'étape 24 | Éq. intégration |
| R5 | Fuite nominative (KYC, contenu client dans `detail`) | L×**H** | Revues dédiées étapes 6 et 13 (« aucune colonne nominative ») ; test automatique sur `v_kyc_funnel_30d` ; plafond 3 côté serveur | CC |
| R6 | Chaîne de hash cassée par insert concurrent | M×M | Insert sérialisé (worker unique + file transactionnelle) + test d'altération | CC |
| R7 | Effet externe à moitié appliqué (Stripe OK, portail KO) | M×H | Outbox systématique (§10.2), jamais d'appel externe en transaction ; dead-letters visibles Monitoring | CC |
| R8 | Dérive de périmètre (NPS, 2FA, impersonation, C2PA, staging réintroduits) | M×L | §6 « hors périmètre » fait foi ; toute réintroduction = décision PO écrite | PO |
| R9 | Toucher au moteur KYB ou à ses tables (checks, colonnes `verification_*`) depuis la console | L×**H** | Lecture/décision via les 7 RPC existantes uniquement ; invariants du relais Thomas (véto `match`-only, jamais d'écrasement de `rejected`/`validated`) testés | CC |

---

## 5. Suivi d'avancement

- **Métrique unique** : étapes cochées / 33, publiée à chaque fin de semaine avec le gate visé.
- **Une étape n'est cochée que si** : PR mergée + tests de l'étape verts + ligne de migration réversible + section § du handoff citée dans la description de PR + **diff des `admin-*.jsx` vide** (hors exceptions autorisées : étapes 4, 15, 31 — la fidélité maquette est vérifiée à chaque PR).
- **Blocage > 2 jours** sur une dépendance P3-P5 → escalade PO immédiate (ne pas contourner en codant « en attendant »).
- Tout écart spec ↔ implémentation → amendement de `HANDOFF_CONSOLE_ADMIN_CLAUDE_CODE.md` dans la même PR.

## 6. Hors périmètre (fait foi — ne pas construire)

Satisfaction/NPS (entrée « bientôt » au rail) · 2FA · « Voir en tant que » · **C2PA** (hors MVP, acté 31 juil.) · **virtual staging IA** (version future) · **export CSV (aucun, nulle part — acté 31 juil.)** · pages Clients finaux / Support / Conformité · changement de plan depuis la console · validation d'annonce en amont · i18n (FR seul) · responsive console.
