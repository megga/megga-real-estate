# HANDOFF — Console MEGGA · Architecture backend complète

> **31 juillet 2026 · v3 — recâblée sur le repo réel** après lecture de la branche onboarding de Thomas (`megga/megga-real-estate@claude/onboarding-kyb-etape-7-2ad668`) et de son fichier relais `docs/handoff/onboarding-api/HANDOFF_ONBOARDING_API.md`. Toutes les tables et RPC citées « existantes » ont été vérifiées dans les migrations de cette branche.
> Design **gelé** : 10 écrans construits (`admin-*.jsx`, ~4'900 lignes), grammaire Sugar tenue, périmètre acté.
> À lire avec : `AUDIT_ADMIN_CONSOLE.md` (inventaire repo + décisions §5) · `Audit - Console MEGGA (prête à implémenter).html` (readiness) · `HANDOFF_KYC_DIAGNOSTIC.md` (modèle de contrat par geste — **le gabarit à répliquer**) · **`docs/handoff/onboarding-api/HANDOFF_ONBOARDING_API.md`** (côté repo : le relais KYB de Thomas — état, contrat, 16 invariants ; il prime sur les autres docs onboarding) · **`PLAN_CONSOLE_ADMIN_BACKEND.md`** (checklist d'exécution, à cocher).
>
> **La maquette est la spec fonctionnelle.** Chaque section ci-dessous référence son fichier `.jsx` : les champs affichés, les seuils et les libellés y sont définitifs. Ce document ajoute ce que la maquette ne dit pas : tables, RPC, garde-fous, journalisation, webhooks, rétention.
>
> **⚠️ Fidélité maquette — règle absolue pour Claude Code :**
> 1. **Le backend se conforme au front, jamais l'inverse.** Les formes de données servies par les vues/RPC épousent les champs consommés par les `admin-*.jsx` (le jeu `admin-data.jsx` EST le contrat de forme : mêmes clés, mêmes types, mêmes valeurs d'enum).
> 2. **Interdit de modifier les maquettes** : aucun renommage de libellé, aucun champ ajouté/retiré à l'écran, aucun seuil changé (§7), aucune retouche visuelle (Sugar Pure gelé). Seules exceptions autorisées, listées : remplacement de `admin-data.jsx` par les fetchs (étape 15), focus clavier (étape 4), retrait des tweaks de démo (étape 31), et les **amendements actés en §2** (grille de plans réelle à 3 plans, libellé « Dilisense », pilule de vérification KYB) — chacun validé PO, aucun autre.
> 3. **Interdit d'ajouter des écrans, boutons, colonnes ou RPC** non présents dans les maquettes et l'Annexe A — y compris « pour faire mieux ». Exception unique en attente de design : la **revue KYB** (§5.13), dont le backend existe déjà.
> 4. **Tout écart jugé nécessaire** (champ manquant, contrainte technique) = amendement écrit de ce handoff validé par le PO **avant** le code, jamais une décision silencieuse dans une PR.

---

## 0. Les trois principes (non négociables, vérifiés serveur)

1. **Piloter la plateforme, pas les CRM des agences.** Aucune table nominative cross-agences exposée à la console : pas de leads, pas de dossiers KYC de clients finaux parcourables, pas de messages, pas de contacts. Les vues admin agrègent l'usage, jamais le contenu. Deux exceptions nominatives, toutes deux légitimes : `admin_kyc_link_lookup` (§5.5, plafonnée à 3 et motivée) et la **revue KYB** (§5.13) — qui porte sur les **dirigeants/signataires des agences clientes de MEGGA** (le KYB est l'affaire de la plateforme), jamais sur leurs clients finaux.
2. **Contrôle a posteriori.** La publication vers Immobilier.ch est automatique — aucun RPC de validation en amont n'existe. Diffusion constate, retire avec motif, fait corriger. (La revue KYB, elle, EST une validation en amont — mais de l'agence cliente à l'entrée de la plateforme, pas de son contenu.)
3. **Un geste = une RPC = une ligne de journal.** Toute mutation passe par une RPC dédiée derrière la garde `is_super_admin()` (existante au repo), écrit dans `admin_log` (append-only), et retourne le minimum. Jamais de `service_role` côté client, jamais d'UPDATE générique.

---

## 1. Accès & socle (P0 — Lot 0)

| Aspect | Contrat |
|---|---|
| Rôle | `is_super_admin()` (fonction existante) + **allowlist** (`20260705160000_super_admin_allowlist_lockdown.sql`, existante). Cercle fermé 3-4 comptes MEGGA. Patron des RPC admin du repo (« P3 ») : `EXECUTE authenticated` + garde interne `is_super_admin()` → erreur `42501`. **Suivre ce patron partout.** |
| Entrée | Uniquement depuis le CRM : handover de session en fragment d'URL (`adminEntry.ts`), jetons en `sessionStorage`, fragment effacé de l'historique. Journalisation d'entrée : `admin_console_entry_audit` (migration `20260725220000`, existante) — à faire converger vers `admin_log` (famille `session`). |
| 2FA | **Reportée post-MVP** (acté 31 juil.). Compensations : allowlist + journalisation + détection d'anomalie de session (§5.9). |
| « Voir en tant que » | **Retiré de la V1** (acté 31 juil.). `crm-view-as.jsx` dormant, aucune RPC d'impersonation à écrire. |
| Étanchéité | `noindex`, aucun analytics, pas de MEGGA AI, pas d'Intercom. Sentry conservé. |
| Focus clavier | Le kit pose `outline: none` partout — **définir un focus visible avant la prod** (correctif front, `admin-kit.jsx`). |
| Responsive / langue | Desktop-only V1 · FR uniquement (l'i18n 4 langues du repo n'est pas reprise pour la console). |
| Discipline repo | Règles du relais Thomas §8.3, qui s'imposent aussi à ce chantier : **re-dater les migrations le jour du merge** (le date-guard de `deploy.yml` saute silencieusement les migrations antidatées), jamais de reprise sur place d'une migration mergée, `npm run check:drift` avant de conclure, lire le **compte de tests** jamais le code de sortie. |

**Gabarit de RPC (modèle `HANDOFF_KYC_DIAGNOSTIC.md`)** — chaque geste documente : signature (champs autorisés, rien d'autre) · garde-fous · effets (et effets de bord : sessions, portail, Stripe) · journalisation (famille, sévérité, metadata) · réponse minimale · réversibilité · idempotence.

---

## 2. ✅ Couplage avec l'onboarding KYB de Thomas — VÉRIFIÉ sur la branche

> Source : `claude/onboarding-kyb-etape-7-2ad668` (code, étapes 0→7 livrées, 20 migrations en prod) + `claude/audit-onboarding-crm-224432` (audit pré-lancement `audit/*`). Le relais qui fait foi : `docs/handoff/onboarding-api/HANDOFF_ONBOARDING_API.md`. L'onboarding n'est pas qu'un wizard : c'est **le point d'entrée d'un dispositif LAB au niveau agence (KYB)** — signup vitrine → provisioning → gate identité → wizard 5 étapes → vérification 9 sources → moteur de score → revue super-admin → gardes LAB.

| # | Sujet | Ce que fait le repo (vérifié) | Ce que la console consomme |
|---|---|---|---|
| C1 | **Création d'agence** | Signup vitrine → trigger `handle_new_user()` → `provision_solo_agency()` (fondateur `role='admin'`) — **sauf** invitation valide pour cet e-mail. Côté console : **`admin_create_agency` existe déjà** (`20260726005000`). | Deux portes, un invariant d'unicité partagé. **Ne pas réécrire de RPC de création** — brancher la modale de la maquette sur `admin_create_agency` (vérifier son payload vs les champs de la modale : nom, ville, canton, plan, solo, note). |
| C2 | **Grille de plans — RÉSOLUE (Q5 close)** | `src/lib/plans.ts` : **Starter 0 · Pro 89 (71 en annuel) · Entreprise 249 (199) CHF/mois**, 3 plans, features + limites d'affichage (`PLANS`) et gating (`PLAN_LIMITS`) ; `agencies.plan` (enum) ; `get_my_agency_plan()`. | La console lit **ce catalogue** (grille en vigueur de §5.7) + Stripe pour l'état de facturation. Les prix de démo des maquettes (Starter 390 → Entreprise 4'600, 4 plans) = **seed à recaler sur la vraie grille** — les écrans s'adaptent (chips de plan et sièges dynamiques). ⚠️ **Divergence interne à faire trancher par le PO + Thomas** : `PLANS.team_members` = 1/5/∞ mais `PLAN_LIMITS.maxAgents` = 1/1/10 — le plafond de sièges de §5.3 et §5.7 doit citer UNE source. |
| C3 | **Rattachement d'un compte à une agence** | **Par invitation uniquement** : `team_invitations` + edge `accept-team-invite`. ⚠️ La RPC `join_agency(p_agency_id)` n'exige PAS d'invitation (faille S13) — patch écrit et **à appliquer** : `audit/patches/05-S13-join-agency-invite-gate.md`. Pas de table `join_requests` : le concept « demande à rejoindre » du vieux handoff Omelette est **remplacé**. | Utilisateurs : « jamais connecté — invité » = `team_invitations.status='pending'` (+ `expires_at`). « Relancer l'invitation » = régénérer le token de `team_invitations`. Supprimer C3/C6 de l'ancienne spec : plus d'état « en attente de rattachement ». |
| C4 | **Journal d'événements** | **`activity_events` EXISTE** : append-only par trigger (`trg_activity_events_immutable_update`), rétention (`20260705171000`), `action` = **clé technique snake_case** (`20260729100000` : `offer_created`, `kyc_case_opened`, `contact_created`, `note_added`, `stage_change`, `announcement_published`, `quota_changed`…), libellés affichés via i18n `audit.action.*` (repli sur la clé). Colonnes : agency_id, actor_id, `actor_kind` (`user\|system\|ai` ; `system` ⇒ actor_id NULL — contrainte), action, entity_type, entity_id, `category` (CHECK — `kyc`, `deal`, `settings`… ; **`compliance` n'existe pas**), severity, object_label, metadata. | **Live et Vue d'ensemble consomment CETTE table — n'en créer aucune autre.** Le front maquette affiche des libellés FR : mapping clé→libellé côté console (i18n), jamais de libellé en base. Les jalons d'activation (§5.1) se dérivent des actions existantes + `identity_submitted` (KYB). |
| C5 | **Consentements nLPD** | **`user_consents` EXISTE** (`20260705170000`) : (user, type `terms\|privacy\|marketing`, version, accepted_at, ip_hash salé/jour) — immuable, INSERT via `record_consent` seul, SELECT super-admin OK par RLS. Versions courantes : `src/lib/consents.ts` (`terms/privacy = '2026-07'`). Stats : `get_admin_consent_stats()`. | Le drawer Utilisateurs lit `user_consents` directement (RLS suffit). La ligne « Marketing : refusé » = absence de ligne `marketing` à la version courante. |
| C6 | **Gate d'identité (jamais « onboardé »)** | Gate `useIdentityGate` : actif si `agency_id` non nul ET rôle admin/manager ET `agencies.identity_submitted_at IS NULL` ET pas super-admin. « Reprendre plus tard » ne quitte pas la route (invariant 13 du relais). | Deux états distincts dans Utilisateurs : « invité, jamais connecté » (C3) ≠ « connecté, identité non soumise » (`identity_submitted_at` null). Le registre de la maquette n'affiche que le premier — le second se lit côté **Agences** (C9). |
| C7 | **C2PA** | **HORS MVP** (acté 31 juil.) — aucune signature nulle part. | Rien. Ne pas réintroduire. |
| C8 | **REVUE KYB — le backend existe, la surface console manque** | File super-admin **en production** (`/dashboard/admin/kyb-review` côté repo) : 7 RPC — `get_admin_agency_review_queue(p_limit, p_offset)` (tri score ASC `NULLS FIRST`, départage `identity_submitted_at` puis `id`, rend `total_count`), `get_admin_agency_review_detail(p_agency_id)` (chaque check avec poids **à la date du check**, résultat, réponse brute), `admin_validate_agency_review`, `admin_reject_agency_review(p_agency_id, p_reason)`, `admin_relaunch_agency_review`, `admin_resolve_agency_id_document(p_agency_id, p_check_id, p_result∈match\|partial\|mismatch)`, `admin_request_agency_correction` (rouvre gate + saisie, statut `correction_requested`). Notifications Resend sur les 4 décisions. | **Consommer ces RPC telles quelles — zéro nouvelle RPC, zéro réimplémentation du moteur.** La console MEGGA doit ajouter cette surface (§5.13) : design à acter (Q9). Les invariants du relais (§7 : véto ne passe que sur `match`, le moteur n'écrase jamais `rejected`/`validated`, tables de checks sans policy INSERT, colonnes de vérification interdites à `authenticated`) s'imposent. |
| C9 | **Statut de vérification dans Agences** | Colonnes `agencies` : `verification_status` (`pending\|auto_validated\|manual_review\|validated\|rejected\|correction_requested` — `auto_validated` ≠ `validated` : moteur vs humain, distinction d'audit LAB), `verification_score`, `verified_at`, `identity_submitted_at`, `business_registration_number`, `legal_form_id`. Gardes LAB : `is_agency_lab_cleared()` ferme 3 surfaces (dossier KYC client final, e-sign, chemin WhatsApp) tant que non validée. | La liste + fiche Agences exposent le statut de vérification (pilule pleine — amendement maquette acté §fidélité) ; il explique pourquoi une agence « ne peut pas encore » ouvrir de KYC. Écriture : **jamais en direct** (colonnes verrouillées par REVOKE + trigger — invariant 9) — uniquement via les RPC C8. |
| C10 | **Screening PEP/sanctions** | Fournisseur réel = **Dilisense** (`DILISENSE_API_KEY`, déjà posé ; véto `pep_sanctions_screening` branché à l'étape 7 via `createPepSanctionsSources`). | Monitoring › Intégrations affiche la santé **Dilisense** (le libellé « ComplyAdvantage » des maquettes et de CLAUDE.md = à relabelliser — amendement acté). |

> Événements que la console attend d'`activity_events` pour le flux self-serve : `agency_created` (provisioning), `identity_submitted` (RPC `submit_agency_identity`, category `kyc`), décisions de revue, `announcement_published`, `quota_changed` — les trois derniers sont **déjà émis** par les triggers/RPC du repo.

---

## 3. Vue d'ensemble technique

```
CRM agent + onboarding (Supabase, EXISTANT)     Console (même projet)
  triggers + RPC (déjà instrumentés) ─────────▶  activity_events   (EXISTE — journal, append-only, rétention posée)
  RPC admin console (à écrire, patron P3) ────▶  admin_log         (À CRÉER — actions sensibles, hash, 10 ans)
  crons (heartbeat) ──────────────────────────▶  cron_runs         (à créer — vérifier admin_ops_health d'abord)
  connecteur Immobilier.ch (webhooks) ────────▶  listing_signals   (à créer — Diffusion)
  Stripe (webhooks) ──────────────────────────▶  stripe_subscriptions (à créer — miroir lecture)
  passerelle IA (EXISTANTE) ──────────────────▶  ai_usage_logs     (EXISTE — estimated_cost_usd par appel)
  KYB : agency-verification-run + moteur ─────▶  agencies.verification_* + tables de checks (EXISTENT)
  CI/CD (webhook de déploiement) ─────────────▶  deployments       (à créer)
  healthchecks ───────────────────────────────▶  admin_integrations_health (EXISTE, 20260726003000)
```

- **Lecture** : une **vue/RPC agrégée par écran** (un fetch, pas de waterfall). Pagination serveur au-delà des plafonds d'affichage (20 lignes + « voir les N autres » ; Live 14/­page ; revue KYB : la pagination existe déjà côté RPC). ⚠️ Piège mesuré au repo : **PostgREST tronque à 1000 lignes toute liste sans LIMIT** — c'est ce qui avait tronqué la file KYB. Toujours borner.
- **Realtime** : uniquement le flux Live (INSERT sur `activity_events`) et le pouls de la Vue d'ensemble. Le reste : fetch au montage.
- **Écriture** : RPC nominales listées en §5 + Annexe A — aucune autre. Toutes journalisent.

---

## 4. Modèle de données

### 4.1 EXISTE déjà au repo — consommer, ne pas recréer (vérifié sur la branche)

| Ressource | Migration / fichier | Rôle pour la console |
|---|---|---|
| `activity_events` | rétention `20260705171000`, actions techniques `20260729100000` | Live, journal Vue d'ensemble, timeline du drawer Utilisateurs. Append-only par trigger. `action` = clé technique, libellé via i18n. |
| `user_consents` + `record_consent` + `get_admin_consent_stats()` | `20260705170000` | Consentements du drawer Utilisateurs. |
| `team_invitations` + edge `accept-team-invite` (+ patch S13 à appliquer sur `join_agency`) | socle + `audit/patches/05` | Invitations (console « Inviter un membre » et relance). |
| `agency_usage_quotas` + `admin_set_agency_quotas` + `get_admin_agency_usage` + `get_admin_usage_overview` + `get_admin_quota_breaches` | `20260726001000` | **Tout le Copilote IA** (§5.11) : quotas (caps NULL = illimité, `alert_threshold_pct` défaut 80, borné 50-100 — exactement la maquette), usage consolidé, dépassements pour l'alerting. Audité `quota_changed`. |
| `ai_usage_logs` (colonne `estimated_cost_usd`, index agency×created) | `20260705172000` | La source du relevé IA — pas de nouvelle table d'événements IA. |
| `platform_announcements` (+ `_dismissals`, RLS de ciblage plan/agence, trigger d'audit) | `20260726004000` | **Dormante côté design** (la console acte « changelog seul, pas d'annonces ») — ne pas construire d'UI, ne pas supprimer la table (Q10). |
| `admin_changelog` | socle repo (page `/changelog`) | Communications (§5.10) — vérifier les colonnes ; ajouter l'état `scheduled` + cron si absent. |
| `admin_console_entry_audit` | `20260725220000` | Entrées console — à faire converger vers `admin_log`. |
| RPC socle admin | `20260526150000`, `20260705172000` (ops health), `20260705173000` (lifecycle & billing), `20260726002000` (end users), `20260726003000` (integrations health), `20260726005000` (create agency), `20260728190000` (perf cleanup) | Base des écrans Agences / Utilisateurs / Monitoring — **inventorier et réutiliser avant d'écrire** (étape 1 du plan). |
| `agency_activity_summary_rpc` | `20260705210000` | Dernière activité par agence (colonne `last` des maquettes). |
| **KYB** : 8 tables (`legal_forms`, `legal_form_aliases`, `agency_related_persons`, `agency_person_roles`, `verification_check_types` (19 types), `verification_check_config` (pondérations versionnées), `agency_verification_checks`, `agency_person_verification_checks`) + colonnes `agencies.verification_*` + 7 RPC de revue + moteur `recompute_agency_verification` + edge `agency-verification-run` + sweep cron `agency-verification-sweep-hourly` | `20260729150000`→`20260731150000` | §5.13. **Lecture/décision via les RPC C8 uniquement.** Tables de checks : aucune policy INSERT (invariant 8) ; colonnes de vérification interdites à `authenticated` (invariant 9). |
| `platform_metrics` · `moderation_actions` · `admin_notes` · `agencies.status` · `properties.moderation_status` · allowlist super-admin | socle | Comme avant. |

### 4.2 À CRÉER (n'existe pas sur la branche)

| Table | Champs clés | Écrit par | Rétention |
|---|---|---|---|
| `admin_log` | id, ts, severity (`info\|warn\|crit`), family (`session\|identity\|lifecycle\|plans\|deploy\|export\|link\|diffusion\|comm\|ai\|ops\|kyb`), action, actor_user_id, entity_type, entity_id, entity_label, metadata jsonb, prev_hash, hash | **toutes** les RPC console + entrées de session + décisions KYB (en plus de leur écho `activity_events`) | **10 ans**, append-only (trigger REFUSE update/delete), `hash = sha256(prev_hash ‖ canonical(row))`, insert sérialisé |
| `stripe_subscriptions` | agency_id, stripe_customer_id, plan_code (`starter\|pro\|entreprise`), status (`active\|trialing\|past_due\|canceled\|free`), trial_end, current_period_end, mrr_chf, last_invoice_status | webhooks Stripe | miroir, upsert |
| `listing_signals` | id, listing_id, agency_id, cause (enum §5.6), kind (`refus\|enligne`), detected_at, source (`portal_webhook\|internal_check`), status (`open\|closed`), closed_at, closed_by, resolution | webhooks portail + cron de contrôle | fermés 1 an |
| `agency_activation` | agency_id, milestones jsonb (signed_up, first_contact, first_property, first_kyc, first_deal, first_match → timestamps, dérivés d'`activity_events`), score 0-100 (nightly), status (`active\|atRisk\|dormant`), last_activity_at | cron nightly | courante |
| `cron_runs` / `deployments` / `incidents` | comme v2 (§5.8) — **après** inventaire des RPC ops health existantes (`20260705172000`, `20260726000000_admin_monitoring_health_v2`) : ne créer que ce qu'elles ne couvrent pas | crons / webhook CI / dérivation | 90 j / 1 an / 1 an |
| `rpc_receipts` | idempotency_key (unique), rpc, actor_user_id, ts, result_hash | toutes les RPC mutantes console (§10.2) | 24 h |
| `outbox_jobs` | id, kind (`stripe\|portal\|notify\|email`), payload jsonb, attempts, next_retry_at, status (`pending\|done\|dead`) | RPC mutantes → worker | 90 j |
| `ai_drift_dismissals` | month, drift_key, dismissed_by, ts | « Rien à signaler » (§5.11) | 24 mois |
| ~~`plan_config`~~ | **Optionnelle** : la vérité = `src/lib/plans.ts` + produits Stripe. Si une table est voulue, elle est **seedée depuis ce fichier**, jamais une 3ᵉ source. | — | — |
| ~~`consents`, `invitations`, `join_requests`, `ai_usage_events`, `ai_usage_monthly`, `ai_quotas`, `integration_health`, `changelog_entries`~~ | **SUPPRIMÉES de la spec v2** — remplacées par les ressources existantes de §4.1 (`user_consents`, `team_invitations`, —, `ai_usage_logs`, rollup à la volée ou vue matérialisée, `agency_usage_quotas`, `admin_integrations_health`, `admin_changelog`). | | |

### 4.3 Vues de lecture (une par écran)
`v_admin_kpis` · `v_admin_agencies` (+ `verification_status` C9) · `v_admin_agency_detail(id)` (équipe, `team_invitations` en attente, usage via `get_admin_agency_usage`, abonnement, note) · `v_admin_users` (+ anomalies, consentements via `user_consents`) · `v_admin_user_activity(id)` (depuis `activity_events`) · `v_kyc_funnel_30d` (agrégat seul, zéro nom) · `v_diffusion_board` · `v_plans_board` · `v_monitoring_board` · `v_security_journal` · `v_ai_month(month)` (sur `ai_usage_logs`) · `v_changelog`. Revue KYB : **pas de vue à créer** — les 2 RPC de lecture C8 suffisent.

**Règle de comptage MRR** : essai, impayé, suspendu, **Starter (0 CHF)** ⇒ 0 MRR. Une seule fonction SQL `agency_mrr(agency_id)` (prix depuis le catalogue C2), jamais recalculée côté front.

---

## 5. Contrats écran par écran

### 5.1 Vue d'ensemble — `admin-overview.jsx` · lecture seule

- **RPC** `admin_overview()` → un objet : `pulse` · `kpis` (agences, comptes, biens actifs, transactions, MRR) · `signals[]` À traiter (fonction en erreur → Monitoring · paiements échoués → Plans · **dossiers KYB en revue** → §5.13 · tickets → Live) · `journal[]` (depuis `activity_events`, libellés i18n, filtré `category !== 'kyc'` client final) · `activation` (`agency_activation`) · `kyc_funnel` · `revenue`.
- Seuils front : tête 3 familles (`AOV_HEAD_MAX`), journal groupé > 40 évt/h (`AOV_GROUP_THRESHOLD`).
- Aucun signal de **conformité client final** ici — jamais. (Le KYB, affaire de la plateforme, a droit de cité.)

### 5.2 Live — `admin-live.jsx` · lecture + export

- **Lecture** : `activity_events` paginé (14/page), filtres cat (mapping `category`+`entity_type` → les 9 chips de la maquette), action (clés techniques distinctes, affichées via le mapping i18n `audit.action.*` avec repli sur la clé), recherche plein texte (colonne générée normalisée).
- **Realtime** : subscription INSERT ; « Pause » côté client. **Aucun export CSV — nulle part dans la console (décision actée 31 juil. 2026).** Les seuls exports du produit : DSAR (JSON, §5.4) et extrait signé du registre (PDF, §5.9).
- **Rétention** : la migration `20260705171000` existe — vérifier sa fenêtre et l'aligner sur la décision Q3 (reco 30 j).
- **Émission** : le CRM émet déjà (offres, KYC, contacts, notes, WhatsApp, quotas, annonces…). Compléter les manquants du vocabulaire maquette (biens, prix, visites, matching, diffusion) **en clés techniques snake_case** + leurs libellés i18n — jamais de FR en base (`20260729100000` fait foi). Contraintes qui cassent à l'insert : `category='compliance'` n'existe pas ; `actor_kind='system'` ⇒ `actor_id` NULL ; IA = `actor_kind='ai'`.

### 5.3 Agences + fiche — `admin-agencies.jsx` / `admin-agency-detail.jsx`

**Lecture** : `v_admin_agencies` — id, name, email, city, canton, plan (catalogue C2), agents, properties, deals, mrr (`agency_mrr`), status, sub (miroir Stripe), score (activation), since, last (`agency_activity_summary_rpc`), **`verification_status` (C9)**. Mot de santé dérivé front (`agxHealth`), inchangé.
**Fiche** : équipe, invitations en attente (`team_invitations` pending), portefeuille + **usage consolidé via `get_admin_agency_usage` (existante)**, abonnement (catalogue + Stripe), note (`admin_notes`), statut de vérification KYB + lien vers sa revue (§5.13). **Jamais** : contacts, leads, dossiers KYC clients finaux.

**RPC** :

| RPC | Garde-fous | Effets | Journal |
|---|---|---|---|
| **`admin_create_agency` (existante — brancher, pas réécrire)** | unicité `lower(trim(name))` → conflit (même invariant que le provisioning C1) | agence sans membre (le propriétaire est invité ensuite) | `lifecycle` · info |
| `admin_agency_suspend(agency_id)` | agence active | révoque les sessions des membres · dépublie du portail (outbox) · pause Stripe · données intactes | `lifecycle` · **crit** |
| `admin_agency_reactivate(agency_id, settle_past_due)` | agence suspendue | accès restaurés · annonces repoussées · facturation reprend ; relance d'encaissement si `settle_past_due` | `lifecycle` · warn |
| `admin_agency_invite_member(agency_id, email, role)` | sièges < plafond du plan (source C2 — après arbitrage `team_members` vs `maxAgents`) sinon refus net · e-mail sans compte → conflit | ligne `team_invitations` (7 j) + envoi ; aucun siège occupé avant activation | `lifecycle` · info |

Vérifier d'abord ce que couvrent `admin_lifecycle_billing` (`20260705173000`) et `admin-agency-lifecycle` (edge) — étendre plutôt que dupliquer.

### 5.4 Utilisateurs — `admin-users.jsx`

**Lecture** : `v_admin_users` — id, name, email, phone, role, agency, since, last (dérivée d'`activity_events`), suspended, never (= `team_invitations` pending, C3), stale_days, consentements (`user_consents` : type × version × date ; marketing = présence de ligne). Timeline : `v_admin_user_activity` sur `activity_events` (libellés i18n).

**RPC** (vérifier `admin_user_lifecycle` / `admin-dsar-export` existants d'abord — étendre, pas dupliquer) :

| RPC | Garde-fous | Effets | Journal |
|---|---|---|---|
| `admin_user_set_role(user_id, role)` | pas de `super_admin` par cette RPC · refuser de rétrograder le dernier admin d'une agence active (Q8) | rôle mis à jour (attention au trigger `tg_profiles_guard_role_agency` et au lockdown `20260627120000`) | `identity` · warn |
| `admin_user_reset_password(user_id)` | compte non supprimé | lien 1 h | `identity` · info |
| `admin_user_resend_invite(user_id)` | invitation `pending` existante (C3) | régénère le token `team_invitations` 7 j, invalide l'ancien | `identity` · info |
| `admin_user_suspend` / `_reactivate` | refus sur allowlist | déconnexion immédiate ; données intactes | `identity` · warn |
| `admin_user_delete(user_id, confirm)` | **refus serveur si allowlist** (anti-lockout) | anonymisation nLPD art. 32 (le `on delete cascade` d'`user_consents` suit), KYC clients finaux conservés 10 ans côté agence | `identity` · **crit** |
| `admin_user_dsar_export(user_id)` | — | JSON serveur (compte + `user_consents` + activité) — l'edge `admin-dsar-export` existe : réutiliser | `export` · warn |

### 5.5 Diagnostic d'un lien KYC — `admin-kyc-diagnostic.jsx`

**Contrat inchangé : `HANDOFF_KYC_DIAGNOSTIC.md` tel quel** (lookup motivé, plafond 3, régénération remise à l'agence, journalisation). Concerne les **clients finaux** des agences — rien à voir avec le KYB (§5.13).

### 5.6 Diffusion — `admin-diffusion.jsx` · le plus gros contrat externe

Inchangé (v2) : enum de causes gelé (`surface`, `year`, `media`, `nophoto` = refus · `mandate`, `expired`, `duplicate`, `sold`, `price` = en ligne), `listing_signals` alimentée par webhooks connecteur + cron de contrôle (médiane via `market_listings`), 5 RPC (`keep` · `remove` · `request_fix` · `cause_batch` · `field_make_required`), bascule 40 signaux, retraits journalisés. S'appuyer sur `property_syndications` (`20260629140000`) pour l'état de push par annonce.

### 5.7 Plans & abonnements — `admin-plans.jsx` · lecture seule stricte

- **Aucune RPC mutante** — la console ne change pas les plans (acté).
- **Grille en vigueur = catalogue C2** (`src/lib/plans.ts` : Starter 0 · Pro 89/71 · Entreprise 249/199) — plus jamais en dur dans la console, plus jamais les prix de démo. MRR : Starter compte 0.
- Files (impayés · essais qui finissent · sièges saturés — plafond de sièges après arbitrage C2) + portefeuille + renouvellements : miroir `stripe_subscriptions` + webhooks (`invoice.payment_failed/paid`, `customer.subscription.*`, `trial_will_end`).

### 5.8 Monitoring — `admin-monitoring.jsx`

- **Réutiliser l'existant d'abord** : `admin_ops_health_rpcs` (`20260705172000`), `admin_monitoring_health_v2` (`20260726000000`), `admin_integrations_health` (`20260726003000`), `get_admin_quota_breaches` (alerting), `_shared/admin-alerts.ts`.
- Lignes d'état de service : Edge Functions · Crons (**y compris `agency-verification-sweep-hourly`**, filet KYB : 15 min, 5 tentatives, 25 dossiers/passage) · Diffusion · WhatsApp (dead-letters) · Emails Resend · **Intégrations : Resend, webhooks Stripe, screening PEP · Dilisense (C10 — libellé amendé), calendriers OAuth, Realtime, LINDAS/`recherche-entreprises` (sources KYB : leur indisponibilité = dossiers qui partent en revue humaine)** · Base & stockage.
- RPC gestes : `admin_function_replay`, `admin_cron_run_now`, `admin_wa_deadletter_replay`, `admin_calendar_resync` (verrous + journal) ; rollback = deep-link CI (Q4).
- Secrets à poser, relevés du relais Thomas : `MAPBOX_TOKEN` dans les secrets **Supabase** (la valeur existe déjà en secret GitHub `VITE_MAPBOX_TOKEN`) ; `UID_REGISTER_*` = bloqué sur une API inconnue (squelette).

### 5.9 Sécurité — `admin-security.jsx` · le registre

Inchangé (v2) : `admin_log` append-only + chaîne de hash + vérification quotidienne, enrichissement d'anomalie de session (hors-heures + IP inconnue → crit ; baseline dérivée d'`admin_log`), routine repliée, `admin_log_export` PDF signé auto-journalisé, rétention 10 ans. Converger `admin_console_entry_audit` dedans. **Nouvelle famille `kyb`** : chaque décision de revue (§5.13) y écrit aussi (l'écho `activity_events` du repo ne remplace pas le registre console).

### 5.10 Communications — `admin-communications.jsx`

- Objet unique : le changelog « What's new ». **Table `admin_changelog` (existante au repo)** — vérifier ses colonnes ; ajouter l'état `scheduled` + le cron de publication si absents. RPC : save/publish/schedule/unpublish, journalisées `comm`.
- Consommation agent : la page Aujourd'hui lit les entrées publiées (RLS lecture published).
- **`platform_announcements` reste dormante** (Q10) : la RLS de ciblage et le trigger d'audit existent, mais la console actée n'a pas d'UI d'annonces — ne pas en construire, ne pas supprimer la table.

### 5.11 Copilote IA — `admin-copilot.jsx`

- **Tout existe** : usage = `ai_usage_logs` (coût `estimated_cost_usd`, agrégé par `get_admin_agency_usage` / `get_admin_usage_overview` — tri coût IA décroissant, comme la maquette) ; quotas = `agency_usage_quotas.ai_monthly_cost_cap_usd` via **`admin_set_agency_quotas` (existante, auditée `quota_changed`)** ; dépassements = `get_admin_quota_breaches` (seuil `alert_threshold_pct`, défaut **80**, borné 50-100 — exactement la règle maquette « alerte à 80 %, jamais un blocage »).
- À construire seulement : la vue mensuelle 3 mois (`v_ai_month` sur `ai_usage_logs` : mois courant + 2 clos, médiane par compte, part d'agence, comptes à zéro appel avec raison) + `ai_drift_dismissals` + le renvoi Monitoring des échecs d'outils (télémétrie tool-usage existante au repo).

### 5.12 Satisfaction (NPS) — entrée « Bientôt disponible » : ne rien construire.

### 5.13 ★ NOUVEAU — Revue KYB des agences (backend PRÊT, surface console à acter — Q9)

- **Quoi** : arbitrer les dossiers d'identité d'agence en `manual_review` / `correction_requested`. En production **aucun dossier ne s'auto-validait avant l'étape 7** ; depuis, la France peut s'auto-valider, la Suisse plafonne (`registry_lookup` = `partial`, LINDAS ne publie pas le statut actif/radié), le Liechtenstein part toujours en revue — **la file est donc le passage obligé de presque toutes les agences suisses.** C'est un écran de travail quotidien, pas un coin d'exception.
- **Backend : consommer les 7 RPC C8 telles quelles.** Lecture : `get_admin_agency_review_queue` (paginée, `total_count`) + `get_admin_agency_review_detail` (19 types de checks, 6 vétos, poids versionnés à la date du check, `raw_response` en preuve — y compris `raw_response.error_type` qui distingue `KybSourcePendingCredentialsError` de `KybSourceNotWiredError`). Décisions : valider · rejeter (motif, **terminal**) · demander une correction (rouvre le gate) · relancer le moteur · trancher la pièce d'identité (`match|partial|mismatch`). Notifications Resend déjà branchées.
- **Interdits hérités des invariants du relais** : ne jamais écrire dans les tables de checks ni les colonnes `verification_*` (REVOKE + trigger), ne pas réordonner/nettoyer les checks (le départage appartient au moteur), ne pas « débloquer » un pays en assouplissant « un véto ne passe que sur `match` ».
- **Console** : chaque décision écrit `admin_log` famille `kyb` (en plus de l'écho `activity_events` du repo). Le compteur de dossiers en attente remonte dans « À traiter » (Vue d'ensemble, §5.1).
- **Design (Q9, à acter avant Lot 1)** : reco — la file vit dans l'écran **Agences** (section « Vérifications » au-dessus de la liste, même grammaire volume-adaptative), le détail en plein cadre comme la fiche. Pas de 12ᵉ entrée de rail sans décision PO.

---

## 6. Récapitulatif journalisation (`admin_log`)

| Famille | Actions | Sévérité |
|---|---|---|
| `session` | entrée console (+ anomalie hors-heures/IP inconnue) | info / **crit** |
| `lifecycle` | créer/suspendre/réactiver agence, inviter, relancer invitation | info → **crit** |
| `identity` | rôle, reset, suspendre/réactiver, **supprimer** | info → **crit** |
| `kyb` | valider · rejeter · correction · relance moteur · pièce d'identité tranchée | warn → **crit** (rejet) |
| `export` | DSAR (JSON), extrait signé du registre (PDF) — **aucun export CSV (décision 31 juil.)** | warn |
| `link` | recherche KYC (motivée), régénération | info |
| `diffusion` | keep / remove / fix / lot / **champ obligatoire** | info → **crit** |
| `deploy` / `ops` / `comm` / `ai` / `plans` | comme v2 | — |

---

## 7. Seuils & constantes

Comme v2 (40 signaux Diffusion · 40 évt/h journal · 3 familles · 80 % quota IA (= `alert_threshold_pct` défaut, serveur) / 95 % dérive · 3 correspondances KYC · requête ≥ 3 car. · 20 lignes / Live 14 · invitation 7 j · reset 1 h · dormant 30 j · prix 3× médiane · rétentions), **plus les seuils KYB (serveur, exposés par `get_agency_verification_config` — ne pas les dupliquer)** : auto-validation `0.85` · priorité de revue `0.5` · sweep 15 min / 5 tentatives / 25 dossiers · timeout source 10 s.

---

## 8. Ordre d'implémentation (3 lots + lot 0)

**Lot 0 — la porte** : inventaire du socle admin existant (§4.1 — **étape obligatoire avant toute RPC**) · `admin_log` + hash · convergence `admin_console_entry_audit` · focus clavier.

**Lot 1 — la console qui regarde** : compléter l'instrumentation `activity_events` (clés techniques + i18n) · miroir Stripe + catalogue de plans C2 (après arbitrage sièges) · `agency_activation` · vues `v_admin_*` (+ `verification_status`) · `admin_overview()` · Live realtime · Monitoring lecture (réutiliser ops health/integrations health) · Sécurité lecture · **revue KYB en lecture** (queue + détail via RPC existantes, surface actée Q9). Aucun bouton d'action.

**Lot 2 — les gestes** : socle idempotence/outbox · agences (brancher `admin_create_agency`, suspend/reactivate/invite via `team_invitations`) · utilisateurs (étendre `admin_user_lifecycle`/`admin-dsar-export`) · **décisions KYB (brancher les 5 RPC existantes + `admin_log` famille `kyb`)** · diagnostic KYC · Copilote (brancher `admin_set_agency_quotas`, construire `v_ai_month`) · Communications (étendre `admin_changelog`) · export DSAR (JSON) + extrait signé du registre (PDF) — aucun CSV.

**Lot 3 — les boucles externes** : connecteur Immobilier.ch + cron de contrôle + 5 RPC Diffusion · « What's new » agent · dérives IA + renvoi Monitoring · replay/dead-letters · secrets (`MAPBOX_TOKEN` Supabase) · rollback selon Q4.

---

## 9. À trancher

| # | Question | État |
|---|---|---|
| Q1-Q4 | desktop-only · constantes · rétention Live 30 j · rollback = deep-link CI | comme v2 |
| Q5 | Grille de plans | **RÉSOLUE** : Starter 0 / Pro 89 / Entreprise 249 (`src/lib/plans.ts`). Reste l'arbitrage sièges `team_members` (1/5/∞) vs `maxAgents` (1/1/10) — PO + Thomas. |
| Q6 | ~~état « en attente de rattachement »~~ | **CADUQUE** — pas de join requests ; rattachement par invitation (C3). |
| Q7 | allowlist dédiée lookup KYC | inchangée (mesurer le volume). |
| Q8 | dernier admin d'une agence | refus serveur (reco) — à confirmer. |
| **Q9** | **Surface console de la revue KYB** (§5.13) | à acter AVANT le Lot 1 — reco : section dans Agences, détail plein cadre. Design à produire (maquette manquante). |
| **Q10** | `platform_announcements` (table + RLS existantes, design console sans annonces) | reco : dormante — ne pas construire, ne pas supprimer. |
| **Q11** | Libellé « ComplyAdvantage » (maquette Monitoring + CLAUDE.md) vs fournisseur réel **Dilisense** | amendement acté C10 : relabelliser « Screening PEP · Dilisense ». |

---

## 10. Annexe ingénierie système (conventions transverses)

### 10.1 Contrat d'erreur unifié (RPC console à créer)
Enveloppe : `{ ok: false, code, message_fr, details? }`. Codes : `unauthorized` (patron repo : exception `42501` — mapper) · `not_found` · `conflict` · `precondition_failed` · `too_many` · `rate_limited` · `locked` · `upstream_error`. Les RPC **existantes** du repo (KYB, quotas, consents) gardent leur contrat d'origine (exceptions Postgres) — la couche console les mappe, ne les modifie pas.

### 10.2 Idempotence, concurrence, transactions
- Clé d'idempotence sur toute RPC mutante **console** (`rpc_receipts`, 24 h).
- Effets externes (Stripe, portail, envois) : pattern **outbox** — jamais d'appel HTTP dans une transaction Postgres (même règle que l'invariant 14 du relais KYB : c'est la raison du découpage `agency-verification-run` / `record_agency_verification_run`).
- Verrous advisory par entité ; état vérifié dans la transaction.
- **Journal d'abord** : l'insert `admin_log` fait partie de la transaction du geste.

### 10.3 Sécurité applicative
- Webhooks entrants signés (Stripe `Stripe-Signature`, portail HMAC ±5 min, CI secret) ; échec → 401 + compteur santé.
- Patron d'auth des edges internes : comparaison **à temps constant** au `SUPabase_SERVICE_ROLE_KEY` (`safeEqual`, comme `agency-verification-run`) + `verify_jwt = false`.
- Rate limits : lookup KYC 10/h/acteur · exports 20/j · reset 3/h/cible · replay 1/incident/10 min.
- RLS : tables console sans policy pour les agents — accès via RPC `security definer` + `is_super_admin()` (42501). Test : JWT agent sur chaque RPC → refus.
- Sessions console : TTL 8 h ; révocation hors allowlist.

### 10.4 Index & performance
Comme v2 (partitions/jour sur les tables à créer, counts estimés, budget p95 < 300 ms à 100 agences) + **borner toute liste (LIMIT)** — le seuil PostgREST de 1000 lignes a déjà tronqué la file KYB en silence.

### 10.5 Horodatage
UTC stocké ; Europe/Zurich affiché ; fenêtres « 24 h / aujourd'hui / mois » calculées en Europe/Zurich côté serveur.

### 10.6 Migrations & backfill (ordre)
1. Inventaire du socle §4.1 (rien créer en double) → 2. `admin_log` + triggers + migration d'`admin_console_entry_audit` → 3. compléments `activity_events` (clés techniques + i18n) → 4. miroir Stripe + backfill → 5. `agency_activation` backfillée → 6. le reste (§4.2). **Discipline repo (§1)** : re-dater au merge, jamais de reprise sur place, `check:drift`, `lint:migrations`. Corollaire appris au KYB : re-tester le rejeu de CHAQUE migration contre l'état **final** de la journée (cas `42P13` du changement de type de retour → `drop function` avant `create or replace`).

### 10.7 Tests & critères d'acceptation
Comme v2 (par RPC : nominal, garde-fous, idempotence, ligne `admin_log`, refus JWT agent ; chaîne altérée → échec ; fixtures webhooks) + règles du repo : specs backend derrière `describe.skipIf(!HAS_KEYS)` — **lire le compte de tests, jamais l'exit code** ; `supabase db reset` avant de conclure ; les tests de contrat HTTP d'une edge modifiée en worktree ne se vérifient qu'en CI.

### 10.8 Environnements & seed
Staging = seed synthétique versionné (recalé sur la **vraie grille de plans** C2 : 3 plans, plus les 4 de la démo) ; jamais de copie prod (nLPD). Bascule prod par flag d'env. Tweaks de démo hors prod.

### 10.9 Observabilité de la console elle-même
Comme v2 : Sentry taggé, alerte hors console si silence d'`activity_events` 30 min ouvrées, PITR + export hebdo chiffré d'`admin_log`, fallback polling 30 s.

---

## Annexe A — Index des RPC

### A.1 Existantes au repo — brancher telles quelles (ne pas réécrire, ne pas modifier)

| RPC / ressource | Écran | Migration |
|---|---|---|
| `get_admin_agency_review_queue(p_limit, p_offset)` · `get_admin_agency_review_detail(p_agency_id)` | Revue KYB (lecture) | `20260729151500`, `20260729160000` |
| `admin_validate_agency_review` · `admin_reject_agency_review(motif)` · `admin_relaunch_agency_review` · `admin_resolve_agency_id_document` · `admin_request_agency_correction` | Revue KYB (décisions) | `20260729151500`, `20260731150000` |
| `admin_set_agency_quotas` · `get_admin_agency_usage` · `get_admin_usage_overview` · `get_admin_quota_breaches` | Copilote IA + fiche agence | `20260726001000` |
| `get_admin_consent_stats()` · lecture `user_consents` (RLS) | Utilisateurs (drawer) | `20260705170000` |
| `admin_create_agency` | Agences (création) | `20260726005000` |
| RPC ops health · lifecycle & billing · end users · integrations health | Monitoring, Agences, Utilisateurs | `20260705172000-173000`, `20260726002000-003000` |
| `agency_activity_summary_rpc` | colonne « dernière activité » | `20260705210000` |
| `submit_agency_identity` · `is_agency_lab_cleared` · `recompute_agency_verification` · edge `agency-verification-run` | côté agent/moteur — la console ne les appelle pas, elle en lit les effets | `20260729150000+` |

### A.2 À créer (contrat en §5 — toute RPC absente de cet index est hors contrat)

`admin_overview()` · `admin_agency_suspend` / `_reactivate` / `_invite_member` · `admin_user_set_role` / `_reset_password` / `_resend_invite` / `_suspend` / `_reactivate` / `_delete` / `_dsar_export`* · `admin_kyc_link_lookup` / `_regenerate` · `admin_listing_keep` / `_remove` / `_request_fix` · `admin_cause_batch` · `admin_field_make_required` · `admin_function_replay` / `admin_cron_run_now` · `admin_wa_deadletter_replay` · `admin_calendar_resync` · `admin_deploy_rollback` (suspendue à Q4) · `admin_log_export` · `admin_changelog_save` / `_publish` / `_schedule` / `_unpublish`*.
\* en étendant l'existant (`admin_user_lifecycle`, `admin-dsar-export`, `admin_changelog`) plutôt qu'en dupliquant.

Plans & abonnements (5.7) et Satisfaction (5.12) : **zéro RPC mutante — voulu.**

---

*Réf. front : `crm-screen-admin-proto.jsx` (shell, 11 entrées / 6 groupes) · `admin-kit.jsx` · `admin-data.jsx` (jeu de démo — à recaler sur la grille de plans réelle) · un `admin-*.jsx` par écran. Suppressions actées à ne pas rouvrir : Clients finaux, Support (→ modale KYC), Conformité (→ consentements dans Utilisateurs, screening dans Monitoring), C2PA, virtual staging, « Voir en tant que », changement de plan console. Réf. repo : branche `claude/onboarding-kyb-etape-7-2ad668`, relais `docs/handoff/onboarding-api/HANDOFF_ONBOARDING_API.md` (16 invariants — les respecter).*
