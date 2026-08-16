# AUDIT — Backend admin MEGGA (console super-admin)

> Source : `megga/megga-real-estate@main` — `src/AdminApp.tsx`, `src/pages/admin/*` (17 pages), `src/components/admin/*` (30 fichiers), `src/hooks/useAdmin*` (24 hooks), `src/i18n/locales/fr/admin.json`, `supabase/functions/admin-*`, `supabase/migrations/*admin*`.
> Audit du **26 juillet 2026**. Objectif : préparer l'intégration dans le pager du CRM, au style de l'écran Paramètres.

---

## 1. Ce qu'est la console aujourd'hui

**Une application séparée du CRM** — bundle, origine, session distincts (`index.admin.html` + `src/main.admin.tsx` + `vite.admin.config.ts`, déployée sur `admin.megga.ch` via `deploy-admin.yml`).

| Aspect | État |
|---|---|
| Rôle requis | `super_admin` + **allowlist** (`super_admin_allowlist_lockdown`, `useSuperAdminGate`, `require-super-admin.ts`) |
| Entrée | **Uniquement depuis le CRM** : handover de session dans le fragment d'URL (`adminEntry.ts`), effacé de l'historique, jetons en `sessionStorage` → la console meurt avec l'onglet, impossible d'y revenir sans repasser par le CRM. Entrée journalisée (`admin_console_entry_audit`) |
| Étanchéité | `noindex` + robots.txt, **aucun analytics** (ni GTM ni PostHog), pas de panneau MEGGA AI, pas d'Intercom. Sentry conservé |
| Thème | Partage la clé `megga.sugar.dark` du CRM ; `admin-console.css` repointe les variables sur les tokens Sugar |
| Style | **Déjà porté sur la coquille des Paramètres du CRM** : cadre pager r=26 + rail 300 px DANS le cadre + bento à droite, kit `adminKit` (bento par l'ombre, pilules pleines, 4 rayons, icônes 17/1.7) |
| Accent | **Violet conservé** comme repère « tu es dans la plateforme, pas dans ton agence » — réduit à la pastille du rail + item actif |
| i18n | 4 langues complètes (fr/de/en/it, ~40 KB chacune) |

**Conséquence pour nous** : il n'y a pas de refonte visuelle à faire — la grammaire est déjà la bonne. Le travail est de **rapatrier les surfaces dans le pager du CRM** et de trancher 3-4 écarts (voir §5).

---

## 2. Inventaire fonctionnel — 17 surfaces

### Pilotage

**1. Live Feed** (`/live`) — flux temps réel des événements plateforme.
Stats : aujourd'hui · cette heure · types uniques · dernier événement. Pause / reprise. Filtres par type d'entité (contacts, biens, transactions, KYC, emails, visites, matchs, agences) et par action (~20 actions : contact créé, pipeline changé, alerte PEP, KYC validé, email envoyé, visite effectuée, match envoyé, erreur système, connexion…). Tableau heure / action / type / détails.

**2. Vue d'ensemble** (`/`) — accueil.
Pouls de santé (pilule saine / attention requise, dérivé des KYC à risque) · 5 KPI (agences, utilisateurs, biens actifs, transactions, KYC à risque, avec tendance mensuelle) · feed **Alertes** (nouvelle agence, PEP/sanctions, abonnement annulé, erreur Edge Function, ticket) · **Journal d'activité** (temps réel, filtres, charger plus) · **Onboarding tracker** (progression des agences sur 6 jalons : inscrit → contact → bien → KYC → transaction → match ; statut actif / à risque / dormant) · **Billing dashboard** (MRR, revenu, abonnements, ARPU, churn, échoués, revenus 6 mois, prochains renouvellements, paiements récents, sparkline MRR 30 j) · action **Rapport hebdomadaire** (envoi manuel + envoi auto lundi 8 h). Widgets réordonnables (`widgetConfig`).

### Clients

**3. Agences** (`/agencies`) — table : nom, plan, agents, biens, transactions, date, statut, **santé** (`AgencyHealthBadge`). Recherche, export CSV, **suspendre / activer**, **créer une agence** (nom, ville, canton, plan, solo, note interne ; garde-fou doublon). Statuts d'abonnement essai / impayé.

**4. Fiche agence** (`/agencies/:id`) — onglets **Infos** (adresse, tél, email, slug, branding) · **Équipe** (membres, rôles, inscription, **impersonate**) · **Activité** (timeline) · **Biens** · **Transactions** (15 étapes de pipeline) · **Usage & quotas** · **Abonnement** (plan, override manuel audité, note, factures Stripe + prochaine échéance).
**Quotas** (`AgencyQuotaForm`) : coût IA mensuel, biens actifs, messages WhatsApp/mois, stockage MB, seuil d'alerte 50-100 % — *champs vides = illimité, aucun blocage automatique, seulement une alerte*.

**5. Utilisateurs** (`/users`) — table nom, email, agence, rôle, inscription. Recherche, filtres rôle/agence/statut.
**Drawer utilisateur** : identité, agence liée, **changement de rôle**, activité récente, **impersonate** (refusé si l'audit ne peut pas être journalisé), **export DSAR JSON**, cycle de vie : **suspendre / réactiver / reset mot de passe / supprimer** (suppression nLPD art. 32 — confirmation par saisie de l'email exact, anonymisation, dossiers KYC conservés 10 ans, comptes allowlistés protégés).

**6. ~~Support~~** (`/support`, **supprimée juillet 2026** — audit `Audit — Support (Console MEGGA).html`, option B) — un diagnostic rare n'est pas une destination : le rail passe à **13 entrées**. La capacité reste entière sous forme d'**outil** : la ligne « Liens KYC publics » en pied de Vue d'ensemble ouvre la **modale de diagnostic** (`admin-kyc-diagnostic.jsx`) — **1** motif obligatoire (agence + référence du signalement), **2** recherche exacte (e-mail, téléphone ou nom, min. 3 caractères, plafond 3 correspondances), **3** étape atteinte du lien + régénération remise à l'agence. Aucun document, aucun jeton, aucune liste parcourable ; consultation journalisée dans Sécurité, rien conservé à la fermeture. _La page « Clients finaux » (leads vendeurs + attribution, messages storefront, table KYC nominative) reste **supprimée**._ _La page « Clients finaux » (leads vendeurs + attribution, messages storefront, table KYC nominative) est **supprimée** : elle faisait le travail de l'agence et contredisait la règle « la conformité des clients finaux ne remonte pas à la plateforme ». Le tunnel agrégé des liens KYC est descendu en pied de Vue d'ensemble._

**7. Diffusion** (`/diffusion`, ex-`/marketplace` — renommée juillet 2026) — **la publication est automatique** : aucune validation en amont. Contrôle **a posteriori** de ce qui part vers Immobilier.ch (portail unique V1) : deux régimes du même tableau, bascule à 40 signaux — file d'**annonces** groupée (refus du portail · signalé en ligne · parti sans réserve) sous le seuil, file de **causes** avec action en lot, action structurelle et déplié par cause au-dessus. Poste de contrôle plein cadre (contrôles passés après publication) : **laisser en ligne** · **retirer avec motif** · **demander une correction** (points multi-sélection). Recherche par agence ou annonce, concentration des signaux par agence. _Sorti du périmètre : modération éditoriale, prix « juste », leads vendeurs, messages storefront, C2PA._

### Revenus

**8. Plans & quotas** (`/plans`) — comparaison des plans (Starter / Pro / Agency / Entreprise, mensuel + annuel), détail par feature, table des abonnements agences avec **changement de plan** manuel.
*(Le dashboard de facturation lui-même vit dans la Vue d'ensemble.)*

### Ops

**9. Monitoring** (`/monitoring`) — santé : database, functions, erreurs 24 h, requêtes, emails, storage. **Edge Functions** (fonction, statut, invocations, erreurs, dernière invocation ; filtre OK / erreur / sans télémétrie) · **logs d'erreurs** (filtrables) · **santé des crons** (job, cadence, dernière exécution, OK / en retard / jamais) · **Syndication IDX** (par portail : en file / publiés / en erreur / retirés, dernières erreurs, config par agence avec FTP non configuré) · **WhatsApp ops** (envois 24 h, échecs 24 h, taux d'échec 7 j, entrants non mappés, fraîcheur webhook, dead-letters : média en échec, non rejouables, erreurs copilote, jobs KYC échoués, top erreurs de livraison) · **Santé des intégrations** (Resend, webhooks Stripe, calendriers OAuth Google/Outlook avec synchros en retard, latence Realtime).

**10. Audit de sécurité** (`/security`) — journal des actions sensibles : horodatage, sévérité (critique / avertissement / info), action, acteur, entité, metadata complète. Recherche par acteur, filtre par action, KPI événements critiques / avertissements / total, **export PDF avec hash-chain**.

**11. ~~Compliance~~** (`/compliance`, **supprimée le 30 juillet 2026 sans avoir été construite** — audit `Audit — Conformité (Console MEGGA).html`, option B). Décisions : l'assujetti LBA est **l'agence** ; aucune obligation n'exige un écran plateforme ; MEGGA appelle ComplyAdvantage pour le compte des agences. Redistribution : table KYC nominative cross-agences et alertes PEP **supprimées** (rien ne remonte) · consentements nLPD (CGU / confidentialité / marketing) en **lecture seule dans le drawer Utilisateurs** · suppressions de comptes et DSAR déjà dans Utilisateurs + journal Sécurité · santé du screening **ComplyAdvantage** dans Monitoring › Intégrations · complétion agrégée déjà en pied de Vue d'ensemble. Le rail passe à **12 entrées**.

### Produit

**12. Communication** (`/changelog`) — deux onglets : **Changelog** (version, titre, description, publié / brouillon, suppression) et **Annonces in-app** (titre, message, sévérité info/avertissement/critique, plans ciblés, agences ciblées, début / fin, libellé + lien de CTA, publier / dépublier).

**13. Feature flags** (`/feature-flags`) — activation par **plan** et par **agence** (recherche d'agence, retrait, agence supprimée signalée). Interrupteur Sugar par flag.

**14. NPS** (`/nps`) — score NPS (-100 à +100), note moyenne, réponses, promoteurs/détracteurs, distribution des notes, réponses récentes (anonymes possibles). Sondage envoyé après 30 jours d'utilisation.

**15. Autonomie des agents** (`/autonomy`) — MEGGA observe les confirmations oui/non de chaque agent et **suggère** de monter son niveau d'autonomie. Table agent / autonomie / outil / oui-non / suggestion. *Rien n'est élevé automatiquement ; le socle légal (envoi client, offres, KYC) n'est jamais proposé en automatique.*

**16. Usage des outils** (`/tool-usage`) — observabilité du copilote WhatsApp : chaque appel d'outil tracé (outil, tier lecture/auto/confirmation/asynchrone, résultat — jamais le contenu des messages). Table outil / tier / appels / taux d'erreur / dernière utilisation, repérage des outils **jamais utilisés**. Plus **coûts IA par agence** (6 mois, USD, par provider et module).

**17. Styles appris** (`/learning`) — MEGGA distille un style d'écriture par agent (langue, registre, emojis, traits). Statut actif / suggéré / inactif, édition des traits, **activer / désactiver**. *Rien n'est appliqué sans activation humaine.*

### Transverse (dans le shell)

- **Recherche ⌘K** (`AdminSearchDialog`) — agences, utilisateurs, biens, tickets.
- **Notifications** (`AdminNotificationPanel`) — nouvelle agence, alerte PEP, abonnement annulé, erreur système, nouveau ticket ; « tout marquer lu ».
- **Bandeau d'impersonation** (`ImpersonateBanner` / `ImpersonationHandoff`).
- Bascule clair/sombre, retour au CRM, compte + déconnexion en pied de rail.

---

## 3. Socle backend

**Edge functions** : `admin-monitoring` · `admin-stripe-metrics` · `admin-stripe-agency-billing` · `admin-agency-lifecycle` · `admin-user-lifecycle` · `admin-dsar-export` · partagés `require-super-admin.ts`, `admin-alerts.ts`.

**Migrations actives** : allowlist super-admin (lockdown) · RPC ops health · lifecycle & billing · audit d'entrée console · monitoring health v2 · RPC clients finaux · santé des intégrations · création d'agence. Tables du socle : `platform_metrics`, `moderation_actions`, `admin_notes`, `agencies.status`, `properties.moderation_status`.

**Tests** : 9 specs backend (billing, quotas, usage, ops health, allowlist, création d'agence, clients finaux, intégrations) + e2e `admin-coverage`.

---

## 4. Trous et incohérences relevés

| # | Constat | Impact |
|---|---|---|
| T1 | **Support n'existe plus comme route** (`/support` absent de `AdminApp.tsx`) alors que l'i18n porte ~45 clés complètes (tickets, SLA, breach, CSAT, réponses IA, réponses pré-écrites, notes internes, historique) et que la spec le prévoyait. | Fonction pensée, traduite, **non branchée**. À trancher : on l'intègre ou on l'enterre. |
| T2 | **« Marketplace »** est le nom d'une surface qui, côté produit, n'existe plus (marketplace publique supprimée en juin 2026). Ce que la page fait réellement = modération des annonces + leads vendeurs + messages storefront. | Renommer en **« Annonces & modération »** dans l'intégration CRM. |
| T3 | La page Marketplace parle de **portails multiples** (syndication IDX par portail) alors que la V1 ne diffuse que sur **Immobilier.ch**. | Aligner l'affichage sur le portail unique V1. |
| T4 | **Accent violet** de la console vs interdiction du violet dans `CLAUDE.md` (« n'existe pas dans MEGGA », accent unique noir). | Décision à prendre (§5). |
| T5 | Deux surfaces de facturation séparées : `BillingDashboard` (dans la Vue d'ensemble) et **Plans & quotas** (page à part). | Regrouper sous une seule entrée « Revenus ». |
| T6 | Trois pages « IA » distinctes (Autonomie, Styles appris, Usage des outils), chacune peu dense. | Fusionner en **« Copilote IA »** à onglets. |
| T7 | Le rail de la console a un **hover animé** (`transition: background-color .18s`) — la préférence actée du projet est **aucune animation de survol**. | Passer en changement de fond instantané. |
| T8 | `admin-console.css` **duplique à la main** les tokens Sugar (commentaire explicite : « toute évolution de tokens.ts doit être reportée ici »). | Dette connue ; sans objet dans le prototype (on lit `crmPalette`). |

---

## 5. Intégration dans le pager du CRM — **acté (26 juil. 2026)**

**Écran** `admin` du prototype → `crm-screen-admin-proto.jsx` (`window.CRMScreenAdminProto`), même shell que Paramètres : `CrmTopNav` + `CrmIconRail` + cadre r=26 + rail 300 px + bento à droite. Titre de rail « Console » + **pilule pleine noire « Admin MEGGA »** (le violet du repo est supprimé — accent noir unique).

**Fichiers** : `admin-kit.jsx` (atomes Sugar) · `admin-data.jsx` (démo CH) · `admin-overview.jsx` (Vue d'ensemble) · `admin-agencies.jsx` (Agences + création) · `admin-users.jsx` (Utilisateurs + drawer + Clients finaux) · `crm-screen-admin-proto.jsx` (shell + 14 entrées).

**Rail — 14 entrées, 6 groupes** :

| Groupe | Entrées |
|---|---|
| Pilotage | Vue d'ensemble · Live |
| Clients | Agences · Utilisateurs |
| Contenu | Diffusion |
| Revenus | Plans & abonnements *(fusion T5)* |
| Exploitation | Monitoring · Sécurité · Conformité |
| Produit | Communication · Annonces · Feature flags · Satisfaction · Copilote IA *(fusion T6)* |

**Décisions actées** :
1. **Accent noir** `#0B0C0E` partout ; repère plateforme = pilule noire « Admin MEGGA ».
2. **Support hors périmètre** — le support client passe par Intercom (T1 clos).
3. **Densité aérée** : lignes 52 px, cellules 13 px de padding vertical.
4. **Aucune animation de survol** — changement de fond instantané uniquement.
5. **Actions destructives** : modale d'avertissement Sugar + CTA rouge foncé opaque (`#8E1F3D` clair · `#E0738C` sombre), comme la modale « KYC vérifié ».
6. **Monitoring** = une page unique scrollable de bentos empilés (comme le repo).
7. Accès depuis le CRM : **bouton dédié en pied du rail d'icônes** + entrée du sélecteur d'écran ; retour « ← Retour au CRM » en pied du rail de la console.
8. Données de démo : Suisse romande, CHF avec apostrophes, coûts IA en USD.

---

## 6. Avancement

- [x] **Monitoring** (29 juil. 2026) — construit selon le concept **F « le bulletin à file »** (`Console - Monitoring (concepts).html`), qui **remplace la décision §5.6** (bentos empilés) : la file d'incidents en tête (une ligne par incident, impact en sous-texte, action Rejouer/Relancer, logs au déplié), repli « signaux surveillés », puis **état de service** en 7 lignes (bande 24 h + un mot de statut) dont chaque ligne se déplie sur le détail du repo (table des fonctions avec filtres, crons, diffusion, WhatsApp, intégrations, base). Fichier : `admin-monitoring.jsx`. Tout vert → la file disparaît ; jamais de scroll.
- [x] **Lot 2** (28 juil. 2026) — groupe **Clients** :
  - **Agences** — recherche (nom / ville / e-mail), filtres Toutes / Actives / Suspendues, table nom+avatar · plan · agents · biens · deals · MRR · statut · **score de santé** (pilule pleine, `—` pour une agence sans historique) · action de cycle de vie **toujours visible** (le repo la révélait au survol), pagination 8/page, export CSV (`;` + BOM), **créer une agence** (nom, ville, canton, plan, solo, note interne + garde-fou doublon), **suspendre** = modale d'avertissement + CTA rouge foncé opaque.
  - **Utilisateurs** — recherche, filtres par rôle, table compte · e-mail · agence · rôle · inscription, export CSV ; **drawer** : identité, changement de rôle, *Se connecter en tant que* (modale audit-first → retour CRM), **export DSAR JSON réel**, suspendre / réactiver / reset mot de passe, **supprimer** (saisie de l'e-mail exact, nLPD art. 32, KYC 10 ans, comptes allowlistés refusés), activité récente.
  - **Support** — recherche exacte d'un lien KYC (e-mail / téléphone / nom), étapes du lien, régénération remise à l'agence ; jamais de liste de clients finaux.
  - Atomes ajoutés au kit : `AdmSearch`, `AdmPager`, `AdmCircleBtn`, `AdmModal`, `AdmConfirm`, `AdmDrawer`, `AdmLabel`, `admFieldStyle`, `admFloatSurf` (surfaces flottantes **opaques** `#17181A` en sombre), `admCsv`.
  - Données de démo étendues (14 agences, 18 comptes, KYC / leads / messages) et **agrégats de la Vue d'ensemble recalculés depuis ces tables** — plus de compteurs qui se contredisent.
- [x] **Lot 1** — coquille complète (14 entrées, 6 groupes) + **Vue d'ensemble** finie : pouls de santé, 5 KPI, alertes, activité plateforme filtrable, activation des agences (6 jalons), revenus & abonnements (MRR + sparkline + répartition par plan + renouvellements). Les 13 autres sections affichent leur **spec fonctionnelle réelle** (pilule « À construire »).
- [ ] **Lot 3** — fiche agence (pager : Infos · Équipe · Activité · Biens · Transactions · Usage & quotas · Abonnement + `AgencyQuotaForm`, factures Stripe)
- [ ] Exploitation : Sécurité, Conformité
- [ ] Produit : Communication, Annonces, Feature flags, Satisfaction, Copilote IA
- [ ] Contenu : Marketplace (modération, leads vendeurs, messages)
- [ ] Transverse : ⌘K console, notifications, bandeau d'impersonation
