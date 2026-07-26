# MEGGA Real Estate — Carte du système (les rouages)

> **Document maître de connaissance du système.** Point d'entrée pour comprendre
> rapidement *tous les rouages* : frontend, backend, edge functions, base de données,
> flux end-to-end, intégrations, compliance.
>
> Construit par cartographie directe du code (mai 2026). Document vivant — à mettre à jour
> quand l'architecture évolue. Pour le détail fin, voir les docs spécialisés :
> [schema.md](schema.md) · [pages.md](pages.md) · [ai-modules.md](ai-modules.md) ·
> [design-system.md](design-system.md) · [design-system-propertyx.md](design-system-propertyx.md) ·
> [roadmap.md](roadmap.md)
>
> **Source de vérité produit / règles** : [../CLAUDE.md](../CLAUDE.md)

---

## 🧠 Le cerveau : comment ça marche & comment le maintenir

Ce document **+** [`.claude-flow/knowledge/megga-memory.seed.json`](../.claude-flow/knowledge/megga-memory.seed.json)
(~180 entrées curées) forment le « cerveau système » de MEGGA. Il est **durable** (committé dans git),
**local** (embeddings ONNX, recherche HNSW) et **gratuit** (0 appel API).

**Ce qui est automatique :**
- À chaque démarrage de session Claude Code, le hook `session-start.sh` recharge le seed dans la
  mémoire locale ruflo (`npm run ruflo:seed` en arrière-plan ; `RUFLO_NO_AUTOSEED=1` pour couper).
- `CLAUDE.md` (lu d'office à chaque session) demande de **consulter le cerveau avant de coder**.

**Ce qui est manuel (et volontaire) — la routine d'apprentissage :**
Le cerveau **n'enregistre pas** les conversations tout seul (sinon il se remplit de bruit). Après
avoir livré une feature ou changé l'architecture :
1. Cartographier la zone touchée (lire le code réel — au besoin via des sous-agents).
2. **Vérifier les faits contre le code** avant d'écrire (ne jamais committer une affirmation non vérifiée).
3. Ajouter/corriger les entrées dans le seed JSON (clé stable `megga/<sujet>`, valeur dense ≤ ~600 car., `tags`).
4. Mettre à jour la section correspondante de **ce document** si l'archi a bougé.
5. `npm run ruflo:seed` (recharge), puis vérifier : `npx ruflo memory search -q "<sujet>" -n megga`.
6. Commit + push.

**Interroger :** `npx ruflo memory search -q "comment fonctionne le gate KYC" -n megga`
**Lister :** `npx ruflo memory list -n megga` · **Recharger :** `npm run ruflo:seed`

> 🛠️ **Construire/refondre un algorithme** (matching, analytics, Focus…) : suivre la **méthode des 3 vagues**
> (comprendre → concevoir → implémenter+revue+tests live → entretenir le cerveau), orchestrée via le tool
> `Workflow`. Détail dans le nœud cerveau `megga/methode-algo-vagues`. La qualité vient de la discipline de
> vérification (ancrage code/DB + revue adversariale + tests backend live en CI), pas du nombre de vagues.

> ⚠️ **Écritures directes** (`ruflo memory store`/`import` hors script) : préfixer
> `CLAUDE_FLOW_DISABLE_BRIDGE=1`, sinon ruflo (3.10.x) annonce un succès mais ne persiste rien —
> son bridge AgentDB garde les lignes dans un SQLite en mémoire que le CLI quitte sans flusher.
> Le script `npm run ruflo:seed` pose ce flag lui-même et vérifie le rappel par une sonde de
> recherche après import (le « Vectors: 0 » affiché par l'import est un compteur factice upstream).
> La lecture (`search`/`list`) n'a pas besoin du flag.

> ⚠️ **Fiabilité** : les entrées reflètent le code à leur date d'écriture. En cas de doute, le **code
> fait foi** — re-vérifier puis corriger le seed. Plusieurs entrées portent des `NUANCE`/`ATTENTION`
> issues d'un audit factuel ; les garder à jour.

---

## 0. En une phrase

SaaS immobilier suisse **AI-native, compliance-first**, recentré **CRM-first** (pivot juin 2026) :
CRM transactionnel agent + pipeline LAB/KYC + portail vendeur + copilote IA + super-admin.
Marketplace publique **désactivée** (routes → vitrine megga.ch) ; backend Flatfox (~90k
`market_listings`, ~50k active) conservé pour le matching. Stack React/Vite (Cloudflare Pages) + Supabase (Postgres, 67 edge functions,
RLS, pg_cron). L'IA est **compliance-enabling**, jamais compliance-replacing (validation
humaine obligatoire).

**Les 5 objectifs** (toute feature doit en servir ≥1) : réduire le temps admin · réduire le
risque LAB/KYC · accélérer le closing · augmenter la transparence client · remplacer un outil
fragmenté.

---

## 1. Architecture & déploiement

```
Frontend   React 18 / TS / Vite / Tailwind · React Router v6 · React Query (+ supabase-cache-helpers)
           i18n react-i18next (FR/DE/EN/IT) · Mapbox GL (lazy) · Recharts · Sentry · PostHog
Backend    Supabase Pro (eayczugyrvmtqnnmvjod, eu-west-1) — Postgres 15, Auth, Storage,
           Realtime, pgvector, pg_cron, pg_net · 67 Edge Functions (Deno)
IA         Texte = DeepSeek (deepseek-chat) PARTOUT · Vision/OCR/PDF = Gemini
           (_shared/vision.ts, photo-vision.ts) · AUCUN Claude/Anthropic au runtime
           (retiré PR #829 ; 0 appel api.anthropic.com). Abstraction
           _shared/ai-provider.ts = callDeepSeek + callPublicAI (tracking coût
           → ai_usage_logs) ; ai-copilot et whatsapp-agent appellent DeepSeek en direct.
Intégr.    Stripe · Resend · Dilisense (KYC) · Google/Microsoft Calendar · Google AI (staging)
           Deepgram (STT) · Cloudflare R2 (photos) · Flatfox + RealAdvisor (sync marché entrant)
           immobilier.ch (syndication IDX 3.01 SORTANTE, juin 2026 — cf §5 + brain megga/syndication-idx)
           Intercom (support unique : Messenger + Fin IA LIVE + Inbox + Help Center public + aide « ? » par écran ; région US, flag nLPD)
Hosting    Cloudflare Pages · CI/CD GitHub Actions → Pages + Supabase edge auto-deploy
```

**Frontières & flux global :**
```
megga.ch (site statique V3, password-gated)   ─┐
app.megga.ch (SPA React CRM, /dashboard/*)     │
admin.megga.ch (SPA React console super-admin) ├─► Supabase (RLS) ◄─► Edge Functions ◄─► services externes
kyc.megga.ch (magic links KYC publics)        ─┘         ▲
                                                         └── pg_cron (flatfox-sync, monitoring…) via pg_net
```

**🟪 Console super-admin isolée** (juil. 2026). Les 16 surfaces d'administration ont quitté le bundle du
CRM : elles ont leur propre entrée Vite ([`index.admin.html`](../index.admin.html) → [`src/AdminApp.tsx`](../src/AdminApp.tsx),
`npm run build:admin`), leur propre projet Pages (`megga-admin`) et leur propre origine. Conséquences —
(1) le code d'administration n'est plus servi aux agents, (2) une session volée sur le CRM ne donne pas la
console (origines distinctes ⇒ ni `localStorage` ni cookies partagés), (3) la console a son **propre écran de
connexion** par mot de passe (elle ne passe pas par la vitrine), (4) les routes y sont à la **racine**
(`/users`, `/agencies/:id`…) et `app.megga.ch/dashboard/admin/*` rebondit vers elles.
Entrée depuis le CRM : ligne « Console admin » du dropdown profil Sugar + recherche ⌘K (les deux gatées par
`useSuperAdminGate`, cf. [`src/lib/adminEntry.ts`](../src/lib/adminEntry.ts)). L'impersonation, qui est une vue
DU CRM, se passe par `?impersonate=<id>` ([`ImpersonationHandoff`](../src/components/admin/ImpersonationHandoff.tsx)) :
l'id ne donne rien par lui-même, c'est la RPC `admin_log_impersonation` (gardée `is_super_admin`) qui décide.
⚠️ Reste **une seule action manuelle** au tableau de bord Cloudflare : poser une politique **Zero Trust /
Access** devant `admin.megga.ch` (allow = les e-mails de `super_admin_allowlist()`). Sans elle la console
reste protégée par la DB, mais elle est joignable — Access la rend invisible avant même le chargement du bundle.

---

## 2. Frontend — audiences & routing

4 audiences, gardées par `ProtectedRoute → ConsentGate` (gate nLPD) ; la console super-admin est une
application séparée, gardée par `AdminAuthGate` (connexion + `useSuperAdminGate` → RPC `is_super_admin`). `PasswordGate` (« Coming Soon ») a été **retiré** (#555) : le composant n'existe plus.
QueryClient global : `staleTime 2min`, `retry 1`, `refetchOnWindowFocus`, `networkMode: always`.

**🟪 Arrivée post-connexion** (juil. 2026). La connexion vit sur la vitrine (cf. §4bis) : `megga-auth.js`
passe les jetons dans le **fragment** d'URL vers `app.megga.ch/auth/callback` (deux origines ⇒ deux
`localStorage` ; une redirection nue vers `/dashboard` arrive sans session et reboucle — bug du 19.07.2026).
L'agent traversait ensuite 4 écrans blancs successifs avant le CRM ; ils sont remplacés par **un seul écran**
aux tokens de la vitrine (fond `#030303`, Inter Tight, barre `#424bfb`, halo bas = le dégradé du pied de page
vitrine réduit à 22 Ko). Il existe en **deux jumeaux** : `#megga-boot` inline dans `index.html` (peint dès la
1<sup>re</sup> frame, avant React) et [`BootSplash.tsx`](../src/components/layout/BootSplash.tsx) qui prend le
relais. ⚠️ Les **styles ne vivent que dans `index.html`** (`<style id="megga-boot-style">`) — le composant React
n'en réutilise que les classes, et les deux balisages doivent rester identiques sous peine de clignotement.
Un second temps ([`BootCurtain`](../src/components/layout/BootCurtain.tsx) + `CurtainLift` + le drapeau module
[`crmEntry.ts`](../src/lib/crmEntry.ts)) tient l'écran **au-dessus** du CRM jusqu'à sa première peinture, pour
que le squelette de route reste ce qu'il doit être : un état de navigation interne, pas un écran d'accueil.
⚠️ Le drapeau est au niveau du **module** et non dans un état React, pour survivre à tout remontage de l'arbre
protégé. Cerveau : `megga/ecran-arrivee-post-login`.

**Écrans d'attente de route (refonte 25.07.2026).** `<Routes>` n'est plus keyé par `pathname` et n'est plus
enveloppé d'`AnimatePresence` : la frontière Suspense de `ProtectedRoute` est donc **préservée** d'une route
sœur à l'autre, et React garde la page précédente à l'écran pendant le téléchargement du chunk — plus aucun
écran de chargement entre deux pages CRM. Les feuilles dont l'identité vient de l'URL (`contacts/:id`,
`listings/:id`, `transactions/:id`, `visits/:id`, `kyc/:dossierId`…) sont remontées explicitement par le
wrapper `ByParam` d'`App.tsx`. Quand un fallback est malgré tout nécessaire,
[`SmartPageLoader`](../src/components/skeletons/SmartPageLoader.tsx) aiguille sur **deux** squelettes, car
`/dashboard` recouvre deux chromes : [`SugarPageSkeleton`](../src/components/skeletons/SugarPageSkeleton.tsx)
(top-nav + rail d'icônes, couleurs lues sur `megga.sugar.dark`) pour les surfaces Sugar, et `DashboardSkeleton`
(sidebar + header) pour les routes `AgentLayout` (`/dashboard/admin*`, `contacts/import`, `listings/new`,
`listings/:id/edit`, `market/:externalId`). ⚠️ Le nettoyage de `data-theme` dans `useTheme` est **ref-compté** :
sans ça, le démontage de l'ancien `ThemeProvider` arrachait l'attribut que le nouveau venait de poser.

| Audience | Préfixe | Pages clés |
|---|---|---|
| **Marketplace SPA** (app.megga.ch) | ~~`/buy` `/rent` `/propriete/:id`~~ → **désactivées** (redirigent vers vitrine megga.ch) | ⚠️ **Pivot juin 2026 — marketplace publique OFF** : `MarketplaceDisabledRedirect` renvoie `/buy /rent /search /propriete/:id /listing/:id` vers megga.ch. `SearchPage`/`PropertyXSinglePropertyPage` **retirés** (pages storefront supprimées au pivot CRM-first). `market_listings` + cron Flatfox + `matching-engine` **intacts** (le matching tourne sans affichage public). Écran marché **interne** CRM `/dashboard/market/:externalId` toujours actif. |
| **Redirections hors app** | `/about` `/sell` `/estimates` `/services` `/agencies` `/agents` | → vitrine megga.ch (aucune page rendue) |
| **Centre d'aide** | `/help*` `/aide*` | → `intercom.help/megga/fr` (SPA retirée le 20.07.2026) |
| ~~Compte visiteur~~ | ~~`/account`~~ | **retiré au pivot CRM-first** — la route redirige vers `/dashboard` |
| **KYC self-service** | `/kyc/:token` | `KycPublicPage` (parcours sans compte, magic link) |
| **Portail vendeur** | `/portal/:token` (+ `/portal` dev) | `VotreVentePage` — page unique « Votre vente » (Sugar Pure, lecture seule) : carte bien + galerie/lightbox, parcours arc 6 étapes, 3 jauges donut, offres (+modal décision), timeline, carte agent WhatsApp |
| **CRM agent** | `/dashboard/*` | voir ci-dessous |
| **Super-admin** | **`admin.megga.ch`** (application séparée ; `/dashboard/admin/*` du CRM y rebondit) | 17 pages (accent violet), routes à la **racine** (`/users`, `/agencies/:id`…), **nav groupée en 5 sections** (Pilotage/Clients/Revenus/Opérations/Produit & IA, P6b) ; `AdminAuthGate` — connexion propre à la console + **accès verrouillé** (20260705160000) : rôle + **allowlist email en dur** (2 emails opérateurs, `is_super_admin()` joint `auth.users`), lue par RPC et non plus embarquée dans le bundle ; edges admin gardées `_shared/require-super-admin.ts` ; **ouverture de console auditée** (`admin_console_entered`) et impersonation **audit-first** (RPC `admin_log_impersonation` bloquante), passée au CRM par `?impersonate=<id>`. ⚠️ L'**enrôlement TOTP** décrit dans les versions précédentes n'existe plus (2FA retiré, #873) : le facteur indépendant prévu est **Cloudflare Access** devant le domaine. **Chrome Sugar (lot 0, juil. 2026)** : la console adopte la palette du CRM sans qu'aucune des 17 pages ne soit réécrite — `src/styles/admin-console.css` repointe les variables `--color-*` sur `CRM_TOKENS` (light + noir), et les pages, écrites en classes sémantiques, suivent. Même clé de thème que le CRM (`megga.sugar.dark`, cf. `AdminThemeProvider`) : plus de réglage divergent. Restent aux lots suivants les badges à fond coloré, les bentos bordés et l'iconographie lucide. Échappatoire CI : `app_config.super_admin_test_domain` (`.local` only). **Reprise 07/2026 (plan P5→P8b)** : P5 fiabilisation dette · P6a usage 360°+quotas (`agency_usage_quotas`) · P6b clients finaux (`end-users` : portails/leads/KYC publics, RPC sans token/PII) · P8a annonces in-app (`platform_announcements`) · P8b création d'agence + factures Stripe. |

**CRM agent** (layout `AgentSugarLayout`, dark CRM) — pages principales :
`dashboard` (**cockpit « Aujourd'hui »** refonte juin 2026 — voir l'encadré ci-dessous) · `pipeline` (deals par stage) · `contacts` (+ `/:id` détail) ·
`listings` (**design final juil. 2026, PR #871 : pager vertical Galerie · « À suivre »** — voir l'encadré ci-dessous ; + `/:id`, `/new` wizard, `/:id/edit`) · `transactions/:id` (stepper 8 étapes + bannière KYC + offres) ·
`matching` (**refonte pager juil. 2026, PR #813** : conteneur `MatchingPagerPage` — page 0 = atelier triptyque embarqué, page 1 = recherche hybride marché ; démo QA `/dev/matching-atelier`) · `journey` · `calendar` (Google/Outlook) ·
`kyc` (**refonte pager juil. 2026, PR #853** : 2 pages verticales Dossiers · Vigie dans un bento ; `/:dossierId` = fiche stricte en overlay ; `/bienvenue` = onboarding première ouverture ; `/export` PDF ; wizard embedded + voie import PDF réelle — cf `megga/kyc-ui-hooks`) · `audit` (journal nLPD) · `analytics` (**Cockpit Commission** live — 3 RPC agrégées `SECURITY DEFINER`, objectif persisté dans Réglages › Agence ; **refonte FUSION mono-écran juil. 2026** : cockpit zéro-scroll + parcours compte-neuf porte→fantôme→réel + popover ancré ; cf `megga/analytics-cockpit-commission`) · `settings`. ⚠️ L'écran **Réseau inter-agences** a été retiré (hors périmètre v1) : `NetworkSugarV2Page` supprimée, `/dashboard/network` et `/dashboard/reseau` redirigent vers `/dashboard`.
> ⚠️ L'écran **Documents** autonome (`/dashboard/documents` + générateur/viewer/templates) a été **retiré** (juin 2026, décision produit). Le KYC garde son onglet « Documents » + le flux d'upload/magic-link + la table/bucket `documents`. La génération de contenu d'annonce IA (`megga/doc-generation`) est indépendante et conservée.

**🟦 Cockpit « Aujourd'hui »** (`/dashboard` index, refonte juin 2026, **PR #638**). N'est plus l'écran KPI simple : c'est un cockpit en **2 pages avec pager molette vertical** (code dans `src/components/crm-sugar/today/`, entrée `src/pages/agent/TodaySugarPage.tsx`). Page 0 = cockpit (**colonne Focus** dynamique = file de priorités + rangée Ensuite + bento 2×2 **Agenda / Relances IA / Pipeline / Objectif**), page 1 = **Catalogue de matchs** (mur + fiche détail + lightbox + galerie). Overlays **Mode Focus** + **Session de relance**. Tokens `TK` dark/light (`today/tk.ts`, mutés par `applyTK`), atomes `today/kit.tsx`, fallback démo `today/data.ts` (honnête, et **aucune écriture sur données démo**). **Câblage Supabase** (tuile ← source) :
> - **Focus + Ensuite** ← `useFocusQueue` = **algo Focus scoré** (PR #641) : fusionne 3 sources (deals `usePipelineSugar` + reminders `useReminders` + matches via RPC `focus_top_matches`/`useFocusMatches`), **score de priorité déterministe + tiers** Maintenant/Ensuite/reste + **raison « pourquoi #1 »** (module pur `today/focusScore.ts`, tunables `app_config.today_focus_v1`). Empty-state **honnête** (seed démo gated derrière prop `demo`). Détails : `megga/today-focus-algo`.
> - **Relances** ← `useRelanceLeads` + brouillon **DeepSeek** à la demande (`ai-copilot` action `draft_email`). **Objectif** ← `useAxDashboardData('year','me')` + `axPace` (mirror d'`AxDashboard`). **Pipeline** ← `usePipelineSugar` (9 stages CRM → 4 buckets). **Agenda** ← `useCalendarSugar`. **Catalogue** ← `useMatching` (critères = les 5 `reasons` du moteur).
> - **Écritures réelles** : Focus Fait/Replanifier → reminders `markAsDone`/`snooze` · **match** Replanifier → `snoozeMatch` (`snoozed_until +3j`), Fait = UI-only · deal = UI-only · envoi relance → edge `send-relance-email` (garde-fou `!live`) · « dossier » catalogue → `sendMatch` (`status='sent'`, sans email).
>
> Cerveau : `megga/today-cockpit`, `megga/today-data-wiring`, `megga/today-write-gestures`, `megga/today-focus-algo`.

**🟩 Mes biens** (`/dashboard/listings`, design final juil. 2026, **PR #871** — port du handoff Claude Design Sugar Pure). Pager vertical 2 pages dans un bento (mécanique ContactsPager), code `src/components/crm-sugar/biens/pager/`, entrée `BiensSugarV2Page.tsx`. **Page 0 Galerie** épurée (recherche · statut · tri · Galerie/Liste ; l'ex-bandeau KPI à sparklines illustratives et Export sont retirés). **Page 1 « À suivre »** = file d'actions volume-adaptative (héro / bandeau dense) sur données **réelles** : mandats à renouveler (`mandate_expires_at` ≤ 60 j, adapter enrichi) + brouillons ; bucket diffusion Immobilier.ch **dormant** (gate `idxEnabled`, go-live FTP bloqué). Renouveler → `useUpdateProperty` + audit ; Supprimer → **RPC `soft_delete_property`** (cf. §RLS) ; wizard « Créer un bien » **embarqué** dans le bento ; « Finir/Compléter » un brouillon → `/:id/edit` (édition en place). First-run = cover exacte maquette (`public/biens/`, fond `#0A0B0D` permanent, texte HTML i18n par-dessus). ⚠ Piège connu : le wizard embarqué suit `data-theme` alors que la page suit `megga.sugar.dark` → peut s'ouvrir clair sur bento sombre (unification différée). **Fiche bien** (`/:id`) = `BienDetailSugarV4Page` (refonte juil. 2026, remplace la V3) : mono-page dans un bento, **fond `pageBg` Today/Pipeline** (la V3 utilisait un dégradé vitrine local), héro galerie + **lightbox contenue** + ruban specs, bento sectionnée + pied Visites/Mandat/Diffusion (portail unique Immobilier.ch) ; câblage réel `useProperty`/`usePropertyStats`/deals/matches/`kyc_cases`/`property_syndications`. Cerveau : `megga/biens-pager`.

**Onboarding : SUPPRIMÉ (18 juil. 2026).** L'ancien wizard (`/dashboard/onboarding`, onboarding-sugar)
+ Premier jour (`/dashboard/premier-jour`, calibrage D0) + gate `resolveOnboardingGate` + edge fn
`day0-activation-setup` ont été retirés (~9 600 lignes ; le calibrage n'avait jamais produit de donnée
en prod). Remplacement : `handle_new_user()` auto-provisionne une **agence solo** au signup pour les
rôles agence via `provision_solo_agency` (SECURITY DEFINER interne, best-effort — n'échoue jamais le
signup), renommable dans Réglages › Agence. Migration `20260718130000`. Conservés et dormants :
`day0_payload` / `compute_agent_preferences` / gate d'autonomie WhatsApp (défauts NULL sûrs) et
`agent_ai_profiles` ; le futur réglage d'autonomie vivra dans Réglages. `day0-activation-setup`
**undeployée le 18 juil.** (cf. asymétrie de déploiement edge en fin de carte). Anciennes URLs
`/dashboard/onboarding` et `/dashboard/premier-jour` → redirect `/dashboard`. ⚠ L'auto-provision
n'est **pas couverte par la CI** (`onboarding-agency-rpc.spec` pose le profil à la main et
court-circuite le trigger) : toute modif de `handle_new_user` se vérifie à la main (insert
`auth.users` jetable → contrôle `agency_id` → suppression).
**Routes dev** (showcase, no auth) : `/dev/mandate-sign`, `/dev/sentry-test`.

### Composants (`src/components/`)
- `propertyx/` — **système d'icônes seul** : `MEIcon`, `PxIconFont`, `PxSocialIcon`, `PxWhatsAppButton` + `tokens.ts` (`PX.*`). Les atomes de présentation (PxButton, PxBadge, PxInput, PxAvatar, PxLogo…) et `sections/` ont été retirés avec la marketplace — **ne pas les réintroduire** (cf. CLAUDE.md § Vestiges Property X).
- `megga-x/` — **MEGGA X**, 2ᵉ design system (port 1:1 Webflow de la vitrine), scopé `.megga-x` parallèle à Sugar : `MeggaX` + 12 wrappers `Mx*`, CSS générée `src/styles/megga-x.generated.css`, route dev `/design-system/megga-x`. Règle **zéro-invention** ; résidus de marques Webflow encore présents dans la CSS/fontes. Cf. `megga/design-megga-x`.
- `ui/` — primitives headless + Motion (modal, dialog, Sheet, Toast, Shimmer, popover, tabs…).
- `layout/` — `ProtectedRoute`, `ConsentGate` (gate nLPD), `StaleBundleDetector`, `AgentLayout`, `AgentSugarLayout`.
- `crm-sugar/` + `crm-sugar-v3/` — shell CRM, contact detail, KYC (**pager `kyc-pager/`** : frame + liste + vigie + fiche stricte + liseuse ; wizard `kyc-wizard/` avec voie import ; l'ancien écran `kyc/` [KycDossierDetail/KycListView] n'est plus routé, conservé transitoirement), **biens** (`biens/pager/` [BiensPager/BpTopGallery/BpFollowupPage/BpRenewModal/BiensFirstRun/followupData] + `biens/gallery/` + BnScoreBadge — les anciens BnSubmissions/BnDetailOverlay/BnPhoto/biensData/helpers sont **retirés**, superseded par le design final), tokens dark.
- `crm-sugar-wizard/` — wizard « Créer un bien » (`/dashboard/listings/new`, `WizardShell` + **7 étapes** — refonte « complet » juil. 2026 : Step 0 trois portes `SgPorteCard` → Vendeur/Mandat → Adresse → **Caractéristiques guidées** (10 types, 7 questions `data.specsQ` + **accordéon détails `Step3bDetails`** conditionnel au type) → **Photos couverture-héro + pellicule** (upload réel, recadrage canvas → File) → Prix/Description 2 phases (DeepSeek réel) → **Publication checklist 5 critères** bloquants en public seulement. **Pas de Staging Studio** : `crm-staging-studio.jsx` du bundle handoff est un fichier ORPHELIN, monté nulle part). **Dark mode** : `SugarV2` (`tokens.ts`) est un **Proxy** qui résout la palette light/dark à chaque lecture depuis `document.documentElement[data-theme]` (pas de mutation de global au render → robuste React 18 StrictMode/concurrent) ; helpers `sgOn()` / `sgAcc()` pour les littéraux posés **sur l'accent** (accent → near-white en dark, `onBlack` → `#0A0A0F`). Header minimal (× fermer seul, flottant) + indicateur d'autosave en footer ; nav Précédent/Continuer, le CTA de publication vit dans le Step 7. Système distinct du wizard KYC (`kyc-wizard/`, `KycPaletteContext`). **Embedded (juil. 2026, #871)** : prop `embedded` → `position:absolute` (au lieu de `fixed z-9000`), monté en overlay dans le bento du pager Mes biens. **Porte « Importer un mandat » désactivée** : l'ancien chemin injectait un mandat fictif (exclusif, 3.5 %, signé) en base pour n'importe quel PDF — dormante jusqu'à un vrai OCR.
- Domaines : `search/` `listings/` `matching/` `transactions/` `kyc*/` `documents/` `calendar/` `messaging/` `portal/` `seller-portal/` `admin/` `directory/` `map/` `ai-copilot/` `skeletons/` `auth-bento/`.

### Hooks (`src/hooks/`, ~100, React Query)
Groupés par domaine : **auth** (`useAuth`, `useImpersonate`) · **contacts** (`useContacts`, `useContactsSugar`, `useContactTimeline`…) · **biens** (`useListings`, `useBiensSugar`, `useProperties`, `usePropertyScores`, `usePropertyStats`) · **transactions** (`useTransactions`, `useUpdateTransactionStage`, `usePipelineSugar`) · **KYC** (`useKycDossiers`, `useKycVigie` [dérivation Vigie + décisions], `useMarkKycCheck`, `useCreateKycDossier`) · **matching** (`useMatching`, `useExternalMatching`) · **dashboard** (`useAxDashboardData` [analytics live, 3 RPC], `useAgencyTargets`, `useDailyBrief`, `useContactNextAction`) · **calendrier** (`useCalendarSugar`, `useGoogleCalendar`, `useOutlookCalendar`) · **IA** (`useCopilot`, `useExtractLead`, `useTranslatedDescription`) · **admin** (`useAdminUsers/Agencies/Monitoring/Compliance`, `useAuditLog`, `useAdminLiveFeed`).

> ⚠️ Realtime : **toujours** `useId()` pour le nom de channel (sinon crash au re-mount). Cf. `useAdminLiveFeed`, `useAdminNotifications`, `useAgentNotifications` (centre de notif agent réel, dérivé d'`activity_events` non-user).

### lib (`src/lib/`)
`supabase.ts` (client typé, anon key) · `utils.ts` (`formatCHF` → `CHF 720'000`, `formatDate` DD.MM.YYYY, `cn`) · `constants.ts` (CANTONS, types, stages) · `sugarAdapters.ts` (Supabase → vues CRM) · logique métier (`plans`, `contactNba`, `contactCriteria`) · export (`auditPdfExport`, `exportCsv`) · intégrations (`mapbox`, `captcha`, `sentry`, `posthog`).

### i18n
FR (défaut, eager) + DE/EN/IT (lazy). 12 namespaces : `common, dashboard, settings, contacts, pipeline, listings, kyc, messages, calendar, matching, admin, auth` (`directory`/`compte`/`comingSoon` retirés en juil. 2026 — orphelins post-pivot). Switch = overlay shimmer 350ms.

---

## 3. Base de données (Supabase Postgres)

> Détail complet : [schema.md](schema.md). Extensions actives : `pg_cron`, `pg_net`, `citext`, `pgvector`.

### Tables par domaine
- **Tenant & équipes** : `agencies` (root, plan), `profiles` (rôles agent/manager/admin/assistant/seller/buyer), `agency_profiles` / `agent_profiles` (annuaires publics, tsvector), `team_invitations`.
- **Contacts & leads** : `contacts`, `seller_leads`, `contact_scores`.
- **Biens** : `properties` (internes ; la publication est un **état de cette table** — `status` + `published_at` — il n'y a pas de table `listings` séparée), `property_scores` (score de bien, RPC `calculate_property_scores`), `market_listings` (marché — 144k lignes / 61k actives au 19 juil. 2026 : **Flatfox=location** 98k dont 35k actives, **RealAdvisor=vente** 46k dont 26k actives, + 27 lignes `megga-demo`). ⚠️ `external_listings` **n'existe plus en base** : seul le type TS `ExternalListing` survit (`useExternalMatching.ts`), et l'écran marché du CRM lit `market_listings`. Ingestion marché = **2 surfaces séparées** : `flatfox-sync` (location, partenaire sanctionné, cron 04:00) et **`realadvisor-sync`** (vente only, `realadvisor_sync_runs`). RealAdvisor : accès accordé (Gregory), throttle Cloudflare sur les requêtes **filtrées** → détection de disparition par **oracle `id_in` en pg_net** (crons `probe-fire`/`probe-collect` + `probe-sweep`, dry-run) + `fresh` quotidien (national) + trigger `price_reduced`. Cf. brain `realadvisor-ingestion`. **Syndication SORTANTE** (juin 2026) : `property_syndications` (1 ligne par bien×portail, status `queued/published/error/withdrawn`, UNIQUE`(property_id,portal)`, RLS agence) + `agency_syndication_config` (kill-switch `idx_enabled`, token pull, transport `pull`/`ftp`, creds FTP ; write `service_role` seul) — publie les `properties` au format IDX 3.01 sur immobilier.ch. Cf. §5 + brain `megga/syndication-idx`.
- **Pipeline & transactions** : `transactions` (stages lead→…→closed), `crm_offers` (offres/contre-offres ; historique via `parent_offer_id` + audit `activity_events`, pas de table `crm_offers_history`), `visits`, `client_searches`, `matches`.
- **KYC / compliance (clients)** : `kyc_cases`, `kyc_checklist_items`, `kyc_magic_links` + `kyc_magic_link_uploads`, `kyc_screening_decisions`, `documents` (sha256, retention).
- **KYB / vérification des agences** (26 juil. 2026, schéma seul — **le moteur n'est pas écrit**) : ne pas confondre avec le KYC ci-dessus, qui porte sur les *clients* de l'agence. Ici on vérifie l'agence elle-même à l'onboarding. `legal_forms` + `legal_form_aliases` (référentiel 21 formes CH/FR/LI ; `category` pilote le parcours — `sole_proprietorship` = pas d'UBO tiers, `foundation_or_trust` = diligence renforcée) · `agencies` enrichie (`legal_form_id` FK, `business_registration_number` ex-`ide` — le terme IDE est suisse et mentait dès qu'un SIREN arrive —, `trade_name` cible du rapprochement flou avec le domaine e-mail, `verification_status`/`verification_score`/`verified_at`) · `agency_related_persons` + `agency_person_roles` (`signatory`/`ubo`, historisés ; **distincts de `profiles`** : un ayant droit économique passif n'a pas de compte CRM) · `verification_check_types` + `verification_check_config` (poids **versionné**, jamais figé sur la ligne de check) + `agency_verification_checks` / `agency_person_verification_checks` (`raw_response` jsonb = pièce d'audit LBA). Score normalisé sur les checks **disponibles** → un pays sans VIES n'est pas pénalisé, ce qui rend le modèle transposable ; les vétos (registre, PEP/sanctions, pièce d'identité) sont **hors score** et ne se compensent jamais. Sources testées : FR `recherche-entreprises.api.gouv.fr` + VIES + RDAP publiques ; **Zefix 401** (identifiants à demander), **oera.li sans API** (LI en revue manuelle), carte pro CCI FR sans API. Cf. [agency-kyb-verification.md](agency-kyb-verification.md) + brain `megga/agency-kyb-verification`.
- **Portail vendeur** : `seller_portals` (token 6 mois) + `seller_preferences`. Le portail est **stateless** — il n'a pas de table à lui : tout passe par l'edge function `seller-portal-action` authentifiée au token, qui lit `properties`, `transactions`, `crm_offers`, `visits`, `seller_leads`, `profiles` et journalise dans `activity_events`. ⚠️ `vendor_dossiers` **n'existe pas en base**.
- **Billing** : `subscriptions` (Stripe).
- **Messaging** : le canal réel du CRM est **WhatsApp** — 14 tables `whatsapp_*` (`whatsapp_messages` journal, `whatsapp_agent_links` + `agency_wa_numbers` appairage numéro↔agent, `whatsapp_conversation_insights`, `whatsapp_pending_actions`, `whatsapp_confirmation_log`, `whatsapp_followup_suggestions`, `whatsapp_daily_briefs`, `whatsapp_notices`, `whatsapp_message_corrections`, `whatsapp_rejected_drafts`, `whatsapp_recent_auto_actions`, `whatsapp_tool_usage`, `whatsapp_async_jobs`, `whatsapp_cron_locks`) · `message_templates` · `contact_messages` (formulaire vitrine ; anon fermé juil. 2026). ⚠️ `message_threads`, `messages`, `email_messages_cache` (système Messages maison du CRM agent) et `marketplace_inquiries` **n'existent plus en base**.
- **Favoris/alertes acheteur** : ❌ **plus rien en base** — `market_favorites`, `market_alerts`, `saved_searches` et `newsletter_subscribers` sont partis avec la marketplace publique. Les recherches côté CRM vivent dans `client_searches` (cf. Pipeline).
- **Audit & monitoring** : `activity_events` (immutable, `actor_kind` user/system/ai), `auth_events`, `platform_metrics`, `flatfox_sync_runs`, `realadvisor_sync_runs`. ⚠️ `ticket_events` **n'existe plus** (parti avec le support maison, cf. Support).
- **Admin** : `admin_feature_flags`, `admin_nps_responses`, `admin_notes`, `admin_changelog` · `user_consents` (preuves nLPD immuables user×type×version, INSERT via RPC `record_consent` seule) · `profiles.is_suspended` (miroir du ban GoTrue, écriture service/definer) · `ai_usage_logs.agency_id/module` (attribution coûts IA, historique NULL = « Plateforme »).
- **Support** : `support_tickets` **seule survivante** (vide ; `admin-monitoring` lit encore `open_tickets`→0), dormante depuis le passage à Intercom. ⚠️ `ticket_messages`, `ticket_canned_responses`, `chat_conversations`, `chat_messages` et `ticket_events` ont été **supprimées de la base** : le support maison n'est pas « réversible », le rebrancher voudrait dire le reconstruire. Cf. brain `intercom-support`.
- **IA** : `ai_usage_logs`, `ai_balance_snapshots`, `translation_cache`, `ai_copilot_conversations` (persistance copilote web OPTIONNELLE double-gatée — flag `app_config.copilot_persistence_enabled` + `persist:true` client ; RLS owner-scoped ; cf. brain `megga/copilot-persistence`). ⚠️ Les photos IA ne sont **pas des tables** mais des **colonnes de `properties`** : `photo_tags` (là où l'ancienne doc annonçait `ai_photo_labels`) et `ai_generated_photos` (colonne, pas table homonyme), à côté de `photos` / `photos_cf` / `photos_cf_processed_at` (R2). `photo-vision` et le virtual staging écrivent dans `properties`.

### RLS (modèle agency-first)
- **Agents** : visibilité `WHERE agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())`.
- **Dirigeants d'agence — exception KYB (26 juil. 2026)** : sur les tables KYB, le filtrage par agence **ne suffit pas** — elles portent la PII des dirigeants et actionnaires (date de naissance, n° de pièce d'identité). Nouveau helper `is_agency_admin()` (SECURITY DEFINER, `admin`|`manager`) : un agent simple n'a aucune raison de lire l'identité de l'actionnaire de son agence. Les tables de checks sont en **lecture seule côté client** (suivi de dossier) — aucune policy d'écriture, seul le `service_role` écrit depuis l'edge function de vérification, faute de quoi un client pourrait se déclarer « match ». `verification_check_config` n'a **aucun accès client**, même en lecture : exposer les poids inviterait à optimiser sa saisie pour franchir le seuil d'auto-validation. Le référentiel (`legal_forms`, `legal_form_aliases`, `verification_check_types`) est en `using (true)` assumé (aucune PII, alimente un menu déroulant).
- **Anon (ex-marketplace)** : plus aucune lecture publique d'annonces — `market_listings` et `market_price_history` révoqués pour `anon` (migration `20260719110000`), `contact_messages` fermé (`20260719100000`). Subsiste `seller_leads_anon_insert` (INSERT seul, borné `assigned_agency_id IS NULL` + `status='new'`), **sans écrivain** depuis la suppression du storefront (juil. 2026). Accès anon restants, hors marketplace : `article_views` / `article_feedback` → INSERT, `translation_cache` → SELECT.
- **Acheteur authentifié** : réduit à une seule surface — `visits_select_by_buyer_email` (SELECT sur `visits` où `lower(buyer_email) = lower(auth.jwt()->>'email')`). Les `message_threads` et les tables de favoris qui portaient ce rôle n'existent plus.
- **Vendeur** : via `seller_portals.token` (stateless, pas d'auth.users) → READ property/transaction, UPLOAD documents.
- **service_role** (edge functions) : full access ; triggers écrivent `activity_events` (`actor_kind='system'`).
- **super_admin** : silo séparé sur `admin_*` + impersonate audité (audit-first, RPC serveur). Depuis 20260705160000, `is_super_admin()` exige rôle **ET** email allowlisté en dur (lu dans `auth.users` — jamais `profiles.email`, auto-modifiable) : un rôle posé hors allowlist ne débloque rien.
- **Piège soft-delete (prouvé 18 juil. 2026, #871)** : quand un UPDATE lit la table (WHERE), PostgreSQL applique **aussi la policy SELECT à la ligne modifiée** → poser `deleted_at` sur `properties` (policy SELECT exige `deleted_at IS NULL`) échoue en « new row violates row-level security policy », avec ou sans RETURNING. Règle : tout soft-delete côté client passe par une **RPC `SECURITY DEFINER`** qui re-vérifie l'agence — ex. `soft_delete_property` (migration `20260718032751`, renvoie `false` si déjà supprimé ; le trigger `trg_properties_audit` journalise `bien_soft_deleted`, rétention LBA).
- **Durcissement advisors (11 juil. 2026, #844/#845)** : règle d'or — une capability URL (`manage_token`, `access_token`) se sert via **RPC `SECURITY DEFINER` scopée token**, jamais via une policy `col IS NOT NULL` (≈ `true` ; c'était la fuite `visits`). EXECUTE révoqué anon/authenticated sur les fns SECURITY DEFINER internes (triggers, helpers cron/service, orphelines, RPC CRM fermées à l'anon) ; les helpers de policies (`get_my_agency_id`, `is_super_admin`…) restent exécutables (les quals tournent avec les droits de l'appelant). **Advisors ACCEPTÉS — ne pas « re-fixer »** : `spatial_ref_sys` sans RLS (table PostGIS, owner `supabase_admin` ; vérifié : le rôle `postgres` ne peut ni enable RLS, ni revoke, ni drop l'extension — dashboard = même rôle ; catalogue EPSG public, 0 PII, 0 colonne geometry applicative ; seul vrai fix = ticket support Supabase, à n'ouvrir que si un audit exige un tableau zéro-ERROR) · extensions dans `public` · listing des buckets publics · MV `cantonal_price_medians` exposée · `rls_enabled_no_policy` ×15 (deny-all service-role voulu) · policies INSERT `with_check true` (formulaires publics voulus).

### Storage buckets
`documents` (KYC/transac, CRUD par agency) · `property-photos` (write agent, read public si publié) · `avatars` · `kyc-magic-link/{agency}/{link}/…`.

### Vues
`cantonal_price_medians` (median prix/m² par canton×type — badge « bon prix », refresh post-sync). · **`market_rent_stats`** (MV, **référence de loyer marché** : comparables loyer/m² par segment canton×type×bande-surface + raffinements ville/NPA si n≥20, médiane/p25/p75/n, loyer/m² calculé LIVE — _pas_ `price_per_m2` (75 % NULL sur rent) — refresh `CONCURRENTLY` cron `45 4` ; alimente le matching, cf `megga/market-rent-reference`).

### Instrumentation comportementale (triggers, juin 2026 · #659/#660)
Plomberie qui capture les signaux temporels (fondation de la couche v2 ; cerveau `megga/instrumentation-comportementale`). Triggers DB `SECURITY DEFINER`, append-only, idempotents, scoped agence, 0 PII : `transactions` → events `stage_change`/`status_change` (attribution agent / MEGGA AI via GUC + RPC `wa_move_transaction_stage`) ; `properties` → `published_at` (1re publication, immuable ; lu par `calculate_property_scores`) ; `visits` → `completed_at` sur `done` ; `activity_events`+`whatsapp_messages` → `contacts.last_interaction_at` (recency tout-touch, hors deal mort) ; `contacts(phone)` → back-link `whatsapp_messages.contact_id` (RPC `resolve_contact_by_phone`, `normalize_phone`, exactly-1 + exclusions agent/JID). App/edge : `create_lead_with_optional_deal` rattache `property_id` ; `send_listings` pose `matches.sent_at`. **Producteur de réaction** (#662, cerveau `megga/match-reaction-producer`) : l'agent marque la réponse du client à un dossier envoyé (FocusPanel Matching v2 → `interested`/`rejected`, HITL) ; trigger `set_match_response_at` (BEFORE, immuable) pose `matches.response_at` + `log_match_reaction` (AFTER) trace l'audit — réveille la relance `no_response` J+3 et alimentera les sous-scores réactivité/engagement. Les signaux s'accumulent à l'usage → débloquent vélocité/sous-scores/recalibrage.

---

## 4. Pipeline marketplace (Flatfox / market_listings) ⚙️

- **Source** : API Flatfox (location, ~50k actifs, 26 cantons, 8 types). Aussi RealAdvisor via `market-scraper(-batch)`.
- **Cron** : `flatfox-sync-daily` `0 4 * * *` (04:00 UTC) → edge `flatfox-sync` (chunked self-invoke, 5 pages/chunk, rate-limit 1 req/s, lock singleton).
- **Opérations** : UPSERT (source_id UNIQUE, last_seen_at), mark removed (safety ≥80% vus avant sweep), photos → Cloudflare R2 (`photos_cf` via `photo-processor`), `quality_score`, `relevance_score` (GENERATED).
- **Observabilité** : `flatfox_sync_runs` (status, totaux, chunks) → dashboard admin.

### 🔴 Règles de perf (statement timeout 3-8s sur 33k rows) — voir CLAUDE.md §7
| Règle | Pourquoi |
|---|---|
| **JAMAIS `count: 'exact'`** > 5k rows | seq scan → timeout. Utiliser `estimated` ou pas de count |
| **JAMAIS `ORDER BY` sans partial index** sur le WHERE | sort mémoire full table → timeout |
| **`.eq('status','active')`** pas `.in(...)` | `IN` ne matche pas les partial indexes |
| **Pas de colonnes lourdes en liste** (`description`, `photos`) | 66MB scan ; charger en page détail |

Index clés : `idx_ml_rent_active_created` (WHERE rent+active+quality≥50), `idx_market_listings_tx_type_status`.

---

## 4bis · Vitrine publique statique (megga.ch) 🌐

> **PIVOT juin 2026 — recentrage CRM-first.** megga.ch sert la **vitrine SaaS**
> [`sites/megga-vitrine/`](../sites/megga-vitrine/) (landing → CRM `app.megga.ch`).
> L'ancien storefront marketplace Property X, resté en sommeil dans
> `sites/_marketplace-phase-ulterieure/` depuis le pivot, a été **SUPPRIMÉ du dépôt**
> (juillet 2026, 373 fichiers / 22 Mo). Il reste récupérable dans l'historique git
> (commit `0b321bc5` et antérieurs) si la marketplace est un jour relancée — mais il
> n'encombre plus l'arbre de travail. La table `market_listings` (~90k biens) **reste
> active** : elle nourrit le CRM (matching, estimation, stats copilote).

> **Vitrine (actuelle, megga.ch)** : `sites/megga-vitrine/` — thème Webflow CodeAI X **rebrandé MEGGA**
> (~40 pages FR, home « Votre CRM se pilote depuis WhatsApp », logo MEGGA header+footer, assets 100%
> auto-hébergés — 0 CDN sauf Finsweet filter.js). CTA → `signup.html` / `login.html` : **l'inscription et la connexion vivent sur la vitrine** (inversion post-pivot), pas sur `app.megga.ch/auth`. Worker minimal (`_worker.js` = Basic Auth
> `megga`/`preview` seul, pas de proxy Supabase).
> **Blog + SEO + légal (28-29 juin 2026, cf. brain `megga/vitrine-content-seo`)** : `blog.html` + 13 articles
> dans `blog-posts/` (filtrable + recherche câblée + FAQ accordéon, angle **demand-led** avec byline experts MEGGA) ·
> fondations SEO (`sitemap.xml` 21 URLs, `robots.txt`, canonical, JSON-LD) · pages légales `mentions-legales.html`
> (12 sections) + `confidentialite.html` · About refondu (rôle Reto Brunner). **Reste** : image hero encore CodeAI.

---
## 5. Edge functions (67) — catalogue par domaine

> Deno, dans `supabase/functions/`. Déclencheurs : HTTP (défaut), `pg_cron`, webhook Stripe, hooks auth.

**`_shared/`** : `ai-provider.ts` (`callDeepSeek` / `callPublicAI`=DeepSeek seul — **plus de `callClaude`** depuis PR #829, pas de wrapper `callAgentAI` ni de fallback ; coût) · `magic-link-token.ts` (HMAC-SHA256) · `vision.ts` + `photo-vision.ts` (**Gemini** `gemini-2.5-flash-lite` — DeepSeek n'a pas de vision) · `pii-redaction.ts` (catalogue partagé, 8 kinds — l'**ordre compte** : valeur libre en dernier, cf. cerveau `megga/pii-catalogue-traps`) · `wa-agent-redaction.ts` (`redactLlmMessages` = les **2 points d'étranglement** DeepSeek : `whatsapp-agent` et `buildCopilotModelBody`) · `whatsapp-doc-prompt.ts` (OCR rédigé avant troncature) · `require-agent-auth.ts`.

| Domaine | Functions |
|---|---|
| **IA / copilote** | `ai-copilot` (chat agent + actions, **DeepSeek** deepseek-chat) — `ai-search` et `parse-search-query` retirées à l'assainissement #671 |
| **KYC / compliance** | `kyc-screening` (Dilisense PEP/sanctions déterministe — l'analyse Claude a été retirée) · `kyc-report-import` (**PR #853** : lit un rapport KYC/AML externe PDF via Gemini, contrôles proposés jamais auto-validés [MLRO], quota par agence) · `kyc-report-data` + `kyc-report-pdf` (rapport KYC PDF par WhatsApp, Cloudflare Browser Rendering REST API — cf. brain `kyc-report-pdf-whatsapp`) · `delete-account` (nLPD art.32, + branche admin `target_user_id`) · `log-auth-event` (IP hashée) · `audit-pdf-export` (chaîne hash SHA-256, LBA 10 ans ; branche super-admin = scope plateforme) |
| **Admin (P1-P4 07/2026)** | `admin-dsar-export` (JSON nLPD art. 25, journalisé avant retour) · `admin-user-lifecycle` (suspend/reactivate/reset, ban GoTrue, anti-lockout allowlist) · `admin-agency-lifecycle` (suspension agence + ban membres) · `_shared/require-super-admin.ts` (rôle + allowlist + AAL2, adopté par toutes les edges admin) · `_shared/admin-alerts.ts` (alerting cron : seuils `app_config.admin_alert_thresholds`, dédup 24h, destinataires `super_admin_allowlist()`, Resend) |
| **Magic link KYC** | `magic-link-create/get/confirm/send-email/upload` (`magic-link-regenerate` retirée, 0 appelant, undeployée le 18 juil.) |
| **Email (Resend)** | `send-email` · `send-property-email` · `send-relance-email` · `send-reminder-email` · `send-team-invite` · `send-visit-email` · `detect-new-device` |
| **Paiements (Stripe)** | `stripe-checkout` · `stripe-portal` · `stripe-webhook` (signature) · `admin-stripe-metrics` (MRR/ARR/churn) |
| **Monitoring** | `admin-monitoring` (cron) · `ai-billing-monitor` (cron, balance DeepSeek) · `weekly-report` (cron) |
| **Calendrier** | `google-calendar-sync` · `outlook-calendar-sync` (OAuth) |
| **Marketplace / scraping** | `flatfox-sync` (cron) · `realadvisor-sync` (cron) · `market-scraper` (worker dormant) — `external-matching` retirée du dépôt (élagage juil. 2026, l'UI lit `external_listings` en direct) **et undeployée le 18 juil. 2026** (elle était restée en ligne 15 jours ; `useExternalMatching.ts` ne garde plus que le type `ExternalListing`) |
| **Syndication IDX (sortant)** | `idx-feed` (GET, pull token, CSV IDX 3.01) · `idx-syndicate` (POST push FTP, cron `idx-syndicate-daily` 05:30 + on-demand WhatsApp) — cœur `_shared/idx-feed-core.ts` / `idx-mapper.ts` / `idx-ftp.ts` ; cf. brain `megga/syndication-idx`. **⛔ Go-live BLOQUÉ** sur l'obtention des accès FTP d'immobilier.ch (host/user/password) — blocant **externe** de même nature que la **vérification entreprise Meta** pour le WhatsApp public : tout est construit/déployé/testé, on attend un tiers. |
| **Matching / scoring** | `matching-engine` · `search-alert` (cron) — _score de contact = RPC `calculate_contact_scores` + cron nocturne ; score de bien = RPC `calculate_property_scores` + cron nocturne (santé/chaleur d'un bien interne, 4 axes, PR #654), surfacé dans Focus (famille « bien à pousser », #656) + galerie Mes biens (pastille estimation, #657) ; l'edge `score-engine` a été supprimée (PR #652) ; **référence de loyer marché** = MV `market_rent_stats` + module pur `rent-reference.ts` → axe bonus `pricePosition` du matching en location (position du loyer vs marché, PR #673/#674) ; cf `megga/contact-score`, `megga/property-score`, `megga/market-rent-reference` ; **NBA par contact** = RPC dual-mode `contact_next_action` (cœur service-role, le param = le scope) + wrapper JWT `get_contact_next_action` = « prochaine meilleure action » déterministe (7 règles à priorité absolue, 0 LLM dans le tri, `kyc_note` jamais l'action) partagée par l'agent WhatsApp et le copilote via `get_contact_brief` / `prepare_meeting` (champ `next_action_estimee`, PR #834) ; trigger pré-requis `touch_transactions_updated_at` ; cf `megga/contact-nba`_ |
| **Documents / media** | `extract-lead` · `extract-property-pdf` · `extract-property-url` · `photo-processor` (R2) · `backfill-cf-images` · `c2pa-sign` / `c2pa-verify` |
| **Media IA** | `virtual-staging` (garde-fous LPD : gate **Gemini** Vision + quota plan) — `public-staging` retirée (#671) |
| **Divers** | `translate-on-demand` (DeepSeek + cache ; conservée pour réemploi CRM multilingue — ⚠ à durcir #784 avant usage) · `speech-to-text` · `intercom-identity` (JWT Messenger Security Intercom) · `accept-team-invite` · `automation-engine` (cron) |

**Crons pg_cron** : `flatfox-sync-daily` (04:00 UTC), `platform-metrics-hourly` (`15 * * * *`), `contact-score-nightly` (03:00 UTC, `calculate_contact_scores`), `property-score-nightly` (03:50 UTC, `calculate_property_scores`), `market-rent-stats-refresh` (04:45 UTC, `REFRESH MATERIALIZED VIEW CONCURRENTLY market_rent_stats` — après le sync Flatfox), `idx-syndicate-daily` (`30 5 * * *`, 05:30 UTC, push FTP des feeds IDX agence), + automation-engine / ai-billing-monitor / weekly-report / search-alert.

**Auth cron→edge (service-key)** : les crons s'authentifient via `Bearer app_config.service_role_key`, qui DOIT égaler l'env edge `SUPABASE_SERVICE_ROLE_KEY` (format `sb_secret_…`, **jamais** le JWT legacy du dashboard). Edge `sync-service-key` (`--no-verify-jwt`, garde `x-sync-token`) recopie env→table ; resync **manuel** (cron horaire + wrapper SQL pas encore en prod). Symptôme d'une clé périmée : crons en 401, 0 match. `get_app_config` non exposée à anon. Cf. `megga/service-key-self-heal`.

**Révocation de session** (Réglages > Sécurité) : `revoke-device-session` (`--no-verify-jwt`) → RPC `revoke_user_session` (SECURITY DEFINER, DELETE `auth.sessions`) coupe le refresh distant ; `user_devices.session_id` lié par `detect-new-device`. L'access token déjà émis reste valide jusqu'à son exp (~1h). Cf. `megga/settings-session-revocation`.

**Secrets par service** : `DEEPSEEK_API_KEY` (toute l'inférence texte) · `GEMINI_API_KEY` / `GOOGLE_AI_API_KEY` (vision/OCR/PDF) · `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` · `RESEND_API_KEY` · `DILISENSE_API_KEY` · `GOOGLE_AI_API_KEY` · `DEEPGRAM_API_KEY` · `GOOGLE_/MICROSOFT_CLIENT_*` · R2 (`CF_ACCOUNT_ID`, `R2_*`).

---

## 6. Flux end-to-end (les rouages) 🔧

**A · Sync → marketplace** : `pg_cron` 04:00 → `flatfox-sync` → UPSERT `market_listings` (photos→R2, quality/relevance) → RLS anon `status='active'` → `/rent` via `useMarketListings` (partial index) → `/listing/:id` → `marketplace_inquiries` → contact.

**B · Contact → pipeline → closing** : lead (import IA / web / portal) → `contacts` → qualif (score) → `visits` → offres (`crm_offers` + contre-offres, trigger audit) → `transactions` stages (lead→qualified→visit→offer→negotiation→reserved→financing→notary→signed→closed) → gate KYC (LBA art.7, **warn non bloquant**, revu MLRO) → closing + `activity_events` complet.

**C · Portail vendeur (token)** : agent crée `seller_portals` (token 6 mois) → vendeur `/portal/:token` (sans login) → **page unique « Votre vente »** (`VotreVentePage` + `components/seller-portal/votre-vente/`, Sugar Pure, lecture seule ; remplace l'ancien mini-CRM 8 pages) → RLS via token (READ property/transac, UPLOAD documents) → updates visibles côté CRM → expiry révoque. Décisions d'offre + paramètres : edge function `seller-portal-action` (token validé, `--no-verify-jwt`) → `offer_decision` journalise un `activity_event` (`actor_kind='system'`) **transmis à l'agent** (jamais de mutation directe `crm_offers`/`transactions`) ; `save/get_preferences` → table `seller_preferences`.

**D · KYC (Dilisense)** : transaction reserved/negotiation → `kyc_cases` (vigilance standard/renforcée selon montant + source des fonds) → magic link upload (`kyc_magic_link_uploads`, OCR, sha256) → screening async Dilisense → `kyc_screening_decisions` (PEP/sanctions) → **revue humaine MLRO** (fin de flux). L'ancienne **analyse qualitative Claude** a été **retirée du code**, pas seulement désactivée par flag : `ai_analysis` est forcé à `null` en dur (`kyc-screening/index.ts:251`, retrait #794/#829 — Claude banni au runtime). Le rapport masque la section « Analyse de risque » quand `ai_analysis` est null. Socle = screening factuel Dilisense + revue MLRO. **Canal WhatsApp (livré, cf. brain `kyc-whatsapp-spec`)** : l'agent ouvre/joint/screene depuis sa conversation via **6 outils copilote KYC** (`get_kyc_status` *read* ; `attach_kyc_document` *auto* ; `open_kyc_case`/`send_kyc_link` *confirm* ; `run_kyc_screening`/`send_kyc_report` *slow_async*) ; même moteur, le MLRO valide toujours (jamais `is_completed`/`verified` côté IA). **Rapport KYC en PDF par WhatsApp (livré, cf. brain `kyc-report-pdf-whatsapp`)** : `send_kyc_report` (tier *slow_async*, ~60 s → hors boucle) → edge `kyc-report-pdf` mint un token HMAC court → Cloudflare Browser Rendering (REST API, pas de Worker) rend la route publique `/kyc-report/:token` (même template `PdfPage1/2/3` que le CRM) → PDF officiel uploadé en média Meta éphémère et envoyé en document **qu'à l'agent** ; lecture seule (seul write = audit `kyc_report_sent`), aucune migration. **Import d'un rapport externe (PR #853)** : wizard voie import (dépôt PDF ≤7 Mo) → edge `kyc-report-import` (Gemini, `_shared/kyc-extract.ts`) → contrôles identité/PEP/sanctions **proposés, jamais auto-validés** (garde-fou MLRO) + PDF attaché au dossier en catégorie compliance.

**E · Matching & alertes** : `client_searches` (criteria JSONB) → `matching-engine` **v2** (durci PR #634 : pré-filtre **DUR** `transaction_type`+budget±15%+canton via RPC `match_candidate_listings`, puis scoring **soft** 0-100 — barème dans `app_config.matching_scoring_v2`, déterministe ; + axe **bonus** `pricePosition` en location = position du loyer vs marché du secteur via la MV `market_rent_stats`, PR #674, raison dans `budget.detail`, activation = redéploiement edge) sur `market_listings`+`properties` → `matches` (score+raisons, `score_version`, dédup dure par couple contact×bien, insert via RPC `ON CONFLICT`) → **Atelier Matching** (triptyque plein écran, gestes `E/X/P/R/V`) : Envoyer = deal `new_lead` (créé/rattaché, `transactions.market_listing_id` si bien de veille) + timeline contact (`dossier_envoye`) + reminder +5 j (→ Aujourd'hui, dédup avec `automation-engine`) + `send-property-email` ; Relancer = `sent_at` reset + reminder repoussé + `send-relance-email` ; Plus tard = `snoozed_until`+7 j + reminder custom à échéance ; Écarter = `ignored` (jamais re-proposé) ; Visite = bascule `/dashboard/visits/new` (bien interne). Écritures différées 4,5 s (undo toast avant toute écriture). Alertes email publiques (`market_alerts`/`search-alert` cron via Resend) inchangées.

**F · Audit trail** : tout changement (transaction/KYC/offre/property) → triggers `SECURITY DEFINER` → `activity_events` immutable (actor_id+kind, severity, category, metadata) → timeline contact + audit super-admin + export PDF signé (chaîne de hash).

**G · Monitoring** : `pg_cron` → `admin-monitoring` → `platform_metrics` → `AdminMonitoringPage` (historique 30j) + feature flags.

---

## 6bis · Agent WhatsApp (feature phare #2) 📱

Vision : l'agent est toujours sur WhatsApp → il y pilote son CRM et laisse MEGGA agir depuis la conversation (mieux qu'une app). **État : copilote agentique complet en production** (plus un simple miroir entrant). **5 Edge Functions** : `whatsapp-webhook` (inbound + appairage + confirmations/undo + envoi post-« oui »), `whatsapp-agent` (cerveau boucle function-calling DeepSeek, **36 outils**, HITL), `whatsapp-agent-async` (outils KYC lents, file), `whatsapp-process` (cron minute : média→R2, transcription, insights, avis LPD, purges), `whatsapp-morning-brief` (push proactif quotidien, cf. bullet dédié). L'ancienne `whatsapp-send` (envoi manuel depuis la fiche) a été retirée (élagage juil. 2026, **undeployée le 18 juil.**) — l'outbound vit dans `_shared/whatsapp-gateway`, appelé inline par les fns ci-dessus. `whatsapp-followup-draft` (brouillon T1 à l'accept d'un suivi) a été retirée aussi (data-gated, 0 usage, **undeployée le 18 juil.** ; builders de prompt en réserve dans `_shared/whatsapp-followup-draft.ts`, régénérable depuis #842) ; l'accept/écarte des suivis vit désormais **directement sur les puces du cockpit** (desktop + mobile, `useAgencyFollowupActions` → RPC `accept_followup_suggestion`), la carte fiche étant tombée à la refonte #823. Tiers d'autonomie : `read`/`auto` exécutés, `confirm` = « oui » requis (socle légal client jamais auto), `slow_async` = file.

- **Archi** : abstraction `_shared/whatsapp-gateway.ts` (`WhatsAppProvider`). **Provider prod = Meta Cloud API** (`MetaProvider`) ; `OpenWAProvider` = prototype legacy **dormant** (encore branché + défaut de `getProvider()` → foot-gun, pas du code mort). Webhook signé **HMAC-SHA256** (`verifyHmac` timing-safe), provider détecté par header (`x-hub-signature-256` Meta / `x-openwa-signature`).
- **Inbound** (`whatsapp-webhook`) : message → vérif HMAC (401 sinon) → parse gateway → map `wa_from` → `contacts.phone` (9 derniers chiffres) → INSERT idempotent `whatsapp_messages` (`UNIQUE(provider, provider_message_id)`) → `activity_events` (best-effort) → 200.
- **Données** : `whatsapp_messages` (provider, direction, wa_from/to, contact_id, agency_id, body, media_*, status, `raw` à purger Ph.4) ; `contact_messages` (form public `/contact`). RLS : un agent ne voit que son agence (`get_my_agency_id()`), non-mappés réservés super_admin (test `whatsapp-messages-rls.spec.ts`).
- **CRM** : `useWhatsAppMessages(contactId)` → `CdWhatsAppCard` (bulles + transcript notes vocales) dans `ContactDetailSugarV3Page` ; `PxWhatsAppButton` (lien `wa.me`) + page publique `/contact`. **Compréhension MEGGA visible (4 juin 2026)** : `CdConversationInsight` affiche résumé/intention/sentiment/critères/engagements/prochaine action depuis `whatsapp_conversation_insights` (lecture seule, cadre assistance/estimation).
- **Statuts de livraison (10 juin 2026, sprint « outbound fiable »)** : le webhook ingère les events `statuses` Meta (`parseStatusUpdates` gateway) → progression **monotone** de `whatsapp_messages.status` (`received < sent < delivered < read` ; `failed` terminal, n'écrase jamais `read` ; rejeu/hors-ordre = no-op via `allowedPriorStatuses`). `failed` → `delivery_error` (ex. 131047 = fenêtre 24h), audit `whatsapp_delivery_failed` + alerte WhatsApp à l'agent lié si le message visait un client. CRM : coches ✓/✓✓/lu dans `CdWhatsAppCard`. Migration `20260628150000`.
- **Créer & publier un bien depuis WhatsApp (29 juin 2026, LIVRÉ — cf. brain `megga/whatsapp-listing-tools`)** : 6 nouveaux outils copilote (catalogue total **36** dans `_shared/whatsapp-tools.ts`) ferment le parcours créer→compléter→photographier→publier sans ouvrir l'app : `create_property`/`update_property`/`attach_property_photos` (tier *auto*, brouillon `properties` + RPC atomique `append_property_photo` → R2) puis `publish_to_portals`/`withdraw_from_portals` (tier *confirm*, HITL) + `get_publication_status` (*read*). « Publier » active le brouillon (draft→active) et déclenche la **syndication IDX** (§5 + `megga/syndication-idx`) ; `maybeRepushOnChange` re-pousse le feed sur édition d'un bien déjà publié. DeepSeek-only.
- **Morning brief proactif 07h30 (5 juillet 2026, LIVRÉ — gated OFF)** : inverse le pull (`get_daily_brief`) en push. `whatsapp-morning-brief` (cron) pousse à chaque agent APPAIRÉ sa journée : visites du jour + relances dues (`reminders`) + offres qui expirent (`crm_offers` pending ≤48 h) + nouveaux leads vendeurs (`seller_leads` new, pool inclus). **0 LLM** : lectures de table directes scoppées `agency_id` — dérivé de `profiles.agency_id`, jamais du snapshot du lien d'appairage (audit P2 : lien jamais resyncé après changement d'agence) — (les RPC Focus dérivent l'agence de `auth.uid()` → inutilisables en service role) + gabarit figé `_shared/morning-brief.ts` (pur, testé Vitest, FR/EN via `profiles.spoken_languages`, compteurs honnêtes « N+ » quand une limite SQL est atteinte), pipeline `toWhatsAppText(meggaProse())`. Visites filtrées PAR AGENT (`agent_id` = lui ou non attribuée) ; leads vendeurs bornés 72 h (« nouveaux » reste vrai). Agent-facing → pas de HITL. **Triple cron UTC anti-DST + filet** (05:30 + 06:30 + 07:30, migration `20260705180000`) + gate applicatif « 07h local Zurich » (08h = tick filet anti tick-manqué) + dédup `whatsapp_daily_briefs` (claim insert-first par profil et date locale, re-claim TTL 10 min des claims orphelins via `confirmed_at`, rétention 90 j). Journée vide = pas d'envoi. Hors fenêtre 24h Meta (131047) = échec silencieux journalisé + claim relâché (le teaser template arrivera avec #795). Sortant persisté `whatsapp_messages` (fil copilote, mémoire C1) + audit `whatsapp_morning_brief_sent` (`actor_kind='ai'`). **Opt-in fail-closed** : `app_config.whatsapp_morning_brief_enabled='true'` pour activer (seedé `false`) + opt-out PAR AGENT `whatsapp_agent_links.morning_brief_enabled` (défaut ON, RLS self = l'agent peut l'éteindre sans désappairer) ; kill-switch global `whatsapp_enabled` respecté ; `dryRun`/`force` derrière la garde service-role pour la vérif prod.
- **Roadmap** : suite « outbound fiable » = template Meta de relance (écrire hors fenêtre 24h, approbation Meta Business) + teaser template du morning brief ; puis triage numéros inconnus → leads ; médias sortants (photos `send_listings`) ; DE/IT. Ph.3 sync temps réel ; purge `raw` (cron quotidien actif). Secrets : `WHATSAPP_WEBHOOK_SECRET`, `META_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_PROVIDER`.

---

## 7. Compliance (Suisse) 🇨🇭

- **LAB/KYC (LBA)** : `kyc_cases` vigilance standard/renforcée, source des fonds (crypto/mixte → description ≥20 car. requise), screening PEP/sanctions Dilisense, **validation humaine MLRO obligatoire**, rétention 10 ans.
- **nLPD/LPD** : `activity_events` immutable, `retention_until`, droit à l'effacement (`delete-account`), redaction PII **avant** tout appel IA (`_shared/pii-redaction.ts`), IP hashées (salt quotidien). **Couverture (19 juil. 2026, #872/#879/#884/#885/#886/#892)** : toutes les frontières DeepSeek sont rédigées — tour live WhatsApp, copilote web **y compris les résultats d'outils réinjectés** (le trou historique : ils repartaient en clair dès le 2ᵉ tour), `prepare_meeting`, email/annonce/outils groupe, voix few-shot, et l'OCR de document. Détail : cerveau `megga/pii-redaction-chain` ; pièges regex coûteux : `megga/pii-catalogue-traps`.
- **Intégrité média** : C2PA Content Credentials (`c2pa-sign`/`verify`) sur photos IA.
- **IA responsable** : présentée comme « assistance/estimation » (jamais « automatique/garantie »), human-in-the-loop sur KYC + envoi client.

---

## 8. Dev / test / CI

```
npm run dev          # vite — CRM (localhost:5173)
npm run dev:admin    # vite — console super-admin (localhost:5174, vite.admin.config.ts)
npm run build        # tsc -b && vite build  (+ postbuild overlay-storefront)
npm run build:admin  # tsc -b && vite build --config vite.admin.config.ts → dist-admin/
npm run lint         # eslint
npm run test:unit    # vitest   ·  test:backend  ·  test:e2e (playwright: ai/admin/visual)
```
CI/CD : push `main` → GitHub Actions → Cloudflare Pages + Supabase edge auto-deploy. **Trois cibles Pages**,
un workflow chacune : `deploy.yml` → megga.ch (vitrine, projet `megga-real-estate`), `deploy-app.yml` →
app.megga.ch (CRM, projet `megga-app`), `deploy-admin.yml` → admin.megga.ch (console, projet `megga-admin`).
Les trois créent le projet, attachent le domaine et posent le CNAME s'ils manquent — rien à préparer à la main.

**⚠ Asymétrie déploiement edge (source de dette)** : `deploy.yml` ne fait que **déployer** ce qu'il
trouve dans `supabase/functions/` — rien ne supprime. Retirer une fonction du dépôt ne la retire donc
**pas** de Supabase : elle reste en ligne, souvent en `verify_jwt=false`, joignable et non surveillée.
Purge = workflow **manuel** `.github/workflows/purge-orphan-functions.yml` (PR #877), le MCP Supabase
n'exposant aucune suppression et le jeton de management n'existant que comme secret GitHub :
```
gh workflow run purge-orphan-functions.yml -f slugs="fn-a,fn-b" -f confirm=SUPPRIMER
```
3 garde-fous : confirmation littérale · liste protégée · refus d'un slug encore versionné (il serait
redéployé au merge suivant — la suppression doit partir du dépôt). Inventaire réconcilié le 18 juil.
2026 : **68 déployées ↔ 67 au dépôt**, seul écart volontaire = `sync-service-key` (déployée hors dépôt,
self-heal de la clé service-role, PROTÉGÉE). Contrôle : diff `supabase functions list` ↔
`git ls-tree -d --name-only origin/main:supabase/functions`.
Prod `megga.ch` actuellement **password-gated** (Basic Auth `realm="MEGGA — accès restreint"`, pré-lancement).

**Garde-fous i18n en CI (BLOQUANTS, durcis PR #708 — cf. brain `megga/i18n-guard-ci`)** : `lint:i18n` (ESLint `no-literal-string` mode `jsx-text-only`, **error** sur 8 familles CRM verrouillées : crm-mobile/crm-sugar/crm-sugar-v3/crm-sugar-wizard/matching-atelier/ai-copilot/kyc-report + pages/agent) · `i18n:parity:ci` (parité FR↔EN, FR = référence, EN doit couvrir) · `lint:prose` (tue em/en-dash dans i18n). `deno check` bloquant sur `supabase/functions/**` (les Edge ne sont pas dans `tsc`/`vitest`).

---

## 9. Index des docs

| Doc | Contenu |
|---|---|
| [CLAUDE.md](../CLAUDE.md) | Source de vérité : règles, conventions, design, perf, état d'implémentation |
| [schema.md](schema.md) | Schéma DB complet |
| [pages.md](pages.md) | Inventaire réel des pages et routes (dérivé de `src/App.tsx`) |
| [ai-modules.md](ai-modules.md) | Specs modules IA |
| [design-system.md](design-system.md) / [design-system-propertyx.md](design-system-propertyx.md) | Design systems CRM / marketplace |
| [roadmap.md](roadmap.md) · [backlog.md](backlog.md) · [CHANGELOG.md](CHANGELOG.md) | Planning & historique |
