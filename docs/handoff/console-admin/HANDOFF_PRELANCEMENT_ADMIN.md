# HANDOFF — Pré-lancement & console admin (digest de la branche audit)

> **31 juillet 2026.** Digest de `megga/megga-real-estate@claude/audit-onboarding-crm-224432` (dossier `audit/` : `STATUS.md` → `PRE_LAUNCH_AUDIT.md` → `PRE_LAUNCH_ADMIN_PLAN.md` → `patches/01-12`) pour ce que ça change au **backend console** (`HANDOFF_CONSOLE_ADMIN_CLAUDE_CODE.md`). État de l'audit au repo : 12 PR de remédiation (10 mergées au 03.07), reste = **migrations admin** (ressort Julien).
> ⚠️ Confidentiel — décrit des failles dont certaines **non corrigées** (need-to-know tant que l'ADMIN_PLAN n'est pas exécuté).

## 1. Bloquants qui précèdent la console (rien ne s'ouvre sans)

| # | Finding | Pourquoi ça bloque la console | Patch |
|---|---|---|---|
| 0.1 | **S13 `join_agency` — brèche multi-tenant CONFIRMÉE LIVE (04.07)** : anon/authenticated rejoint n'importe quelle agence (accès CRM/KYC) | Le registre Utilisateurs et les compteurs Agences de la console seraient pollués par des comptes intrus ; gate `team_invitations` = le C3 de notre spec | `patches/05` |
| 0.2 | **S2/S10/S17 — RPC `SECURITY DEFINER` exécutables par `anon`**, dont **`get_agency_stats` et `get_onboarding_milestones`** (confirmé live) | Ce sont des **sources directes de la console** (portefeuille agences, jalons d'activation §5.1/§5.3) : REVOKE anon + garde `is_super_admin` AVANT de les brancher | `patches/06` |
| 0.3 | S12/S31 — policies `anon` trop larges (`support_tickets`/`visits` `USING(true)`) | Live/journal liraient des tables ouvertes au public ; RPC tokenisées à livrer AVEC le front | `patches/07` |
| 0.4 | **S30 — tout membre peut changer `agencies.plan`/`billing`** | Fausse tout l'écran Plans & abonnements et le MRR (§5.7) : trigger de garde = prérequis du miroir Stripe | `patches/08` |

## 2. Ce que la console reprend de l'audit (absorbé dans la spec)

| Finding / règle | Où c'est dans notre spec |
|---|---|
| **Drift de bookkeeping des migrations — `supabase db push` INTERDIT** (des migrations appliquées apparaissent « non appliquées ») ; appliquer via la Management API (`deploy.yml`) ou à la main, réconcilier par `supabase migration repair` | §10.6 — discipline migrations (avec le date-guard) |
| S14 — `set search_path` sur toute fonction `SECURITY DEFINER` | gabarit de RPC §1 (le patron du repo le fait déjà) |
| P1 — `count: 'exact'` → `estimated` (AdminMonitoring) ; P2/P10 — listes non plafonnées | §10.4 (counts estimés, LIMIT partout) |
| S28 — MFA : 0 policy `aal2` ; **séquencer** MFA obligatoire agents AVANT d'exiger `aal2` sur les tables KYC | cohérent avec « 2FA console post-MVP » (§1) — ne pas confondre les deux chantiers ; le MFA **agents** est un item de lancement (Legal/Admin), pas console |
| JWT service-role : comparer à **`app_config.service_role_key`** (ce que pg_cron forwarde), pas à l'env — repli env conservé | §10.3 — auth des edges internes (compléter le patron `safeEqual`) |
| Sentry scrub (token KYC, PII) ✅ mergé | §10.9 — la console hérite du scrub |
| Golden rule de remédiation : **zéro changement visuel/UX** | = notre règle « fidélité maquette » |
| Leçon de méthode : l'audit brut contenait des imprécisions — **chaque cible re-vérifiée réellement** (grep, build) avant action | = notre étape 1 (inventaire) et §10.7 |

## 3. Ce qui reste chez Julien (tokens admin) — la console n'y touche pas, elle en dépend

Ordre de l'ADMIN_PLAN : **A1 `join_agency`** → A2 grants SECDEF → A4 billing → A5 search_path → (A3 policies anon avec la PR front) → (A6 `aal2` après MFA obligatoire). Secrets : `CONTACT_NOTIFICATION_TO`, `app_config.service_role_key` (vérifier). CI : filet `check-edge-auth.sh` après déploiement complet des gardes ; lint bloquant après `chore/lint-fixes`.

## 4. Go-live (LAUNCH_READINESS) — items qui conditionnent le G4 de notre plan

- **Test de charge k6 sur staging** (aucun test réel encore — script fourni dans `audit/load-test/`) : nos budgets p95 < 300 ms (§10.4) se valident là.
- Supavisor mode *transaction* + limites de connexions · `statement_timeout` + slow queries · plafond Realtime (notre flux Live en dépend) · **PITR : test de restauration réel** (notre §10.9 le suppose) · WAF/rate-limiting Cloudflare sur les endpoints publics · runbook incident + soft launch canary.
- Compliance (Legal, hors console mais à connaître) : data residency `eu-west-1` à valider juridiquement, DPA sous-traitants, rétention KYC LAB art. 7 — cohérent avec la rétention 10 ans d'`admin_log`.

## 5. Impact sur le plan d'exécution

- **Nouvelle dépendance P6** (PLAN §2) : bloquants 0.1→0.4 appliqués (Julien) **avant le G1** — brancher `get_agency_stats`/`get_onboarding_milestones` sans A2 exposerait des RPC anon.
- Le **G4** (go-live console) s'aligne sur la checklist LAUNCH_READINESS §0-1 : pas d'ouverture console prod avant les bloquants + k6.
- ⚠️ À re-vérifier au démarrage : la branche KYB (30.07) est **postérieure** à cet audit (03-04.07) — certains findings ont pu être fermés depuis (ex. `20260627120000` lockdown escalade de rôle, `20260719*` fermetures anon). **S13 restait ouvert sur les deux branches.** L'étape 1 du plan (inventaire) tranche l'état réel.

---

*Sources : `audit/{README,STATUS,PRE_LAUNCH_ADMIN_PLAN,LAUNCH_READINESS}.md` @ `claude/audit-onboarding-crm-224432` · à lire avec `HANDOFF_CONSOLE_ADMIN_CLAUDE_CODE.md` (§2 couplages onboarding KYB) et `PLAN_CONSOLE_ADMIN_BACKEND.md`.*
