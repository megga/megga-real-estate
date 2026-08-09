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
(~220 entrées curées) forment le « cerveau système » de MEGGA. Il est **durable** (committé dans git),
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
5. `npm run ruflo:seed` (recharge), puis vérifier avec la commande d'interrogation ci-dessous.
6. Commit + push.

**Interroger :**
```bash
CLAUDE_FLOW_DISABLE_BRIDGE=1 npx ruflo@3.10.46 memory search -q "comment fonctionne le gate KYC" -n megga
```
**Lister :** même préfixe + `memory list -n megga` · **Recharger :** `npm run ruflo:seed`

> 🛠️ **Construire/refondre un algorithme** (matching, analytics, Focus…) : suivre la **méthode des 3 vagues**
> (comprendre → concevoir → implémenter+revue+tests live → entretenir le cerveau), orchestrée via le tool
> `Workflow`. Détail dans le nœud cerveau `megga/methode-algo-vagues`. La qualité vient de la discipline de
> vérification (ancrage code/DB + revue adversariale + tests backend live en CI), pas du nombre de vagues.

> ⚠️ **`CLAUDE_FLOW_DISABLE_BRIDGE=1` + version épinglée : sur TOUTE commande ruflo, lecture comprise.**
> Le flag choisit le magasin. Sans lui, le bridge AgentDB travaille sur un SQLite en mémoire /
> `ruvector.db` que le CLI quitte sans flusher : une **écriture** annonce un succès et ne persiste
> rien, et une **lecture** interroge un magasin vide. Le script `npm run ruflo:seed` pose le flag
> lui-même et vérifie le rappel par une sonde de recherche après import (le « Vectors: 0 » affiché
> par l'import est un compteur factice upstream).
>
> Épingler `ruflo@3.10.46` (la version du script de seed) pour deux raisons, mesurées le 29/07/2026 :
> `npx ruflo` non épinglé résout aujourd'hui **3.32.30**, où la lecture SANS le flag renvoie
> **« No results found » sur un cerveau plein** — un faux négatif silencieux qui se lit comme un
> cerveau vide (3.10.46 tombait, lui, sur le chemin sql.js legacy par défaut, ce qui masquait le
> problème) ; et l'invoquer **réécrit `.claude/helpers/`** au passage (~900 lignes, 3.25.6 → 3.32.30),
> un diff parasite à annuler avant de committer.

> ⚠️ **Deuxième cause de « No results found » sur un cerveau plein : la requête est trop courte.**
> La recherche est **sémantique**, avec un plancher de score : une requête d'un ou deux mots ne le
> franchit pas, même quand le terme est littéralement dans l'entrée. Mesuré le 06/08/2026 sur les
> 222 entrées, **flag posé et version épinglée** : `-q "realadvisor"` → **0 résultat**,
> `-q "resurrection"` → **0 résultat** ; alors que `-q "health check realadvisor regles alerte cron"`
> rend `megga/realadvisor-health-alerting` à **0,75**, et `-q "alerte seuil mass_removal taux de
> resurrection"` la même entrée à **0,76**. Les scores qui ressortent s'échelonnent de **0,80 à 0,70**
> et rien n'a été observé en dessous — plancher **constaté à l'usage, pas lu dans le code amont**
> (l'implémentation vit dans une dépendance transitive), donc à ne pas citer comme une constante.
> *(Corrigé le 06/08/2026 : ce bloc annonçait d'abord « rien sous ~0,72 », démenti depuis par un
> résultat sorti à 0,70.)*
>
> **Donc : interroger par une phrase topique, jamais par un mot-clé.** Le piège est qu'un
> `No results found` sur mot unique est indiscernable d'un cerveau qui ignore le sujet — et le
> réflexe qu'enseigne le bloc ci-dessus (vérifier le flag, vérifier la version) ne mène nulle part
> ici, les deux étant déjà corrects.

> ⚠️ **Fiabilité** : les entrées reflètent le code à leur date d'écriture. En cas de doute, le **code
> fait foi** — re-vérifier puis corriger le seed. Plusieurs entrées portent des `NUANCE`/`ATTENTION`
> issues d'un audit factuel ; les garder à jour.

---

## 0. En une phrase

SaaS immobilier suisse **AI-native, compliance-first**, recentré **CRM-first** (pivot juin 2026) :
CRM transactionnel agent + pipeline LAB/KYC + copilote IA + console super-admin.
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
megga.ch (site statique V3, password-gated)          ─┐
                                                      ├─► Supabase (RLS) ◄─► Edge Functions ◄─► services externes
app.megga.ch (SPA React CRM, /dashboard/* — console  ─┘         ▲
              super-admin comprise — et les parcours            └── pg_cron (flatfox-sync, monitoring…) via pg_net
              publics tokenisés /kyc/:token,
              /reception/:token, /accept-invite/:token)
```

> `kyc.megga.ch` figurait ici comme hôte des liens magiques : ce domaine n'a **jamais eu de
> DNS**. Le parcours client est une route de l'app (`/kyc/:token`) ; les liens sont bâtis
> depuis `MEGGA_APP_URL` (repli `https://app.megga.ch`) par
> [`_shared/app-url.ts`](../supabase/functions/_shared/app-url.ts).

**🟪 Console super-admin : une SURFACE DU CRM** (28 juil. 2026). Les 17 pages d'administration vivent sous
`/dashboard/admin/*`, dans le bundle du CRM : [`src/App.tsx`](../src/App.tsx) monte
[`AdminConsoleRoute`](../src/components/admin/AdminConsoleRoute.tsx) → `AdminConsoleRoutes` → `AdminShell`.
L'isolation sur `admin.megga.ch` (25-26 juil.) a été **annulée** : ni entrée Vite dédiée, ni projet Pages
`megga-admin`, ni passage de session par fragment d'URL — une seule origine, donc plus rien à se transmettre.
L'URL redevient au passage rechargeable, partageable et mémorisable.

Entrée depuis le CRM : ligne « Console admin » du dropdown profil Sugar + recherche ⌘K (les deux gatées par
`useSuperAdminGate`, cf. [`src/lib/adminEntry.ts`](../src/lib/adminEntry.ts)). L'impersonation ouvre un onglet
sur `/dashboard?impersonate=<id>` — URL **relative** : viser un hôte en dur ouvrait la production depuis un
poste de développement. L'id ne donne rien par lui-même, c'est la RPC `admin_log_impersonation` (gardée
`is_super_admin`) qui décide, et [`ImpersonationHandoff`](../src/components/admin/ImpersonationHandoff.tsx)
n'active la vue qu'après l'écriture d'audit.

⛔ **Ne pas reproposer Cloudflare Access** devant la console : posé puis retiré (décision produit — il
réclamait une seconde authentification, à l'encontre du principe « un seul endroit où l'on s'authentifie »),
et le domaine n'existe plus.

⚠️ **Piège vécu** : la règle `_redirects` qui renvoyait `/dashboard/admin/*` vers `admin.megga.ch` a survécu
au retrait du domaine et rendait la console **injoignable** (302 vers le vide) à tout rechargement ou lien
profond. Le serveur de dev ignore `_redirects`, donc les suites e2e restaient vertes. Garde-fou :
[`tests/unit/redirects-guard.spec.ts`](../tests/unit/redirects-guard.spec.ts). Même famille de piège pour les
liens internes, restés à la racine après la refusion :
[`tests/unit/admin-console-paths.spec.ts`](../tests/unit/admin-console-paths.spec.ts).

**📎 Assets servis à la racine (`public/`).** Vite recopie ce dossier **verbatim, sans hash** : le nom d'un
fichier posé là est un contrat d'URL. C'est ce qui héberge les images des e-mails transactionnels —
`public/email/megga-logo-white.png` (wordmark blanc, 600 × 131) et `megga-gg-indigo.png` (sigle `#424bfb`,
la primaire vitrine, 136 × 82) — référencées en **URL absolue** par les gabarits Supabase Auth, qui vivent
dans le dashboard (Authentication → Email Templates) et **pas dans le dépôt**. Un client mail n'accepte ni
chemin relatif ni base64 (Outlook Windows ne rend pas le base64), d'où l'hébergement.
[`public/_headers`](../public/_headers) (30 juil. 2026, PR #1035) fige `/email/*` à un an immuable, au lieu
du défaut Pages `max-age=14400, must-revalidate` ; la vitrine megga.ch le recopie mais l'**ignore**, ce
projet tournant en mode avancé (`_worker.js`), où Cloudflare n'évalue ni `_headers` ni `_redirects`.

⚠️ **Un asset ABSENT répond quand même `200`.** Le fallback SPA (`/*  /index.html  200`, dernière ligne de
`_redirects`) attrape aussi les fichiers manquants : la réponse est un `200` en **`text/html`**. Un contrôle
`curl -I … | grep 200` est donc creux — regarder le `content-type`, et pour un binaire comparer la **somme
SHA-256** des octets servis à la source (ce qui prouve en prime que Cloudflare ne recompresse pas). Vécu le
30 juil. 2026 : `/email/megga-gg-indigo.png` répondait `200` sans exister, et les e-mails partaient sans le
sigle.

---

## 2. Frontend — audiences & routing

4 audiences, gardées par `ProtectedRoute → ConsentGate` (gate nLPD) ; la console super-admin vit SOUS cette
garde, `AdminConsoleRoute` y ajoutant `useSuperAdminGate` (→ RPC `is_super_admin`) et l'audit d'entrée.
`AdminAuthGate` n'existe plus — il servait l'application autonome, retirée le 28.07.2026 ; `PasswordGate`
(« Coming Soon ») a été retiré plus tôt (#555).
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
| **CRM agent** | `/dashboard/*` | voir ci-dessous |
| **Super-admin** | `app.megga.ch/dashboard/admin/*` (surface du CRM) | **17 pages**, accent violet réduit au repère de contexte du rail, **nav groupée en 5 sections** (Pilotage/Clients/Revenus/Opérations/Produit & IA). Gate : `AdminConsoleRoute` → `useSuperAdminGate` (UX) ; le mur réel est en base — `is_super_admin()` exige le rôle **ET** un e-mail allowlisté en dur, lu dans `auth.users` (jamais `profiles.email`, auto-modifiable) — et sur les edges via `_shared/require-super-admin.ts`. ⚠️ **Aucun contrôle AAL2** : le 2FA a été retiré (#873) ; des commentaires d'edge functions l'ont prétendu jusqu'au 28.07, ils ont été corrigés. Chaque **entrée** est auditée (`admin_console_entered` — granularité entrée, pas chargement de page) et l'impersonation reste **audit-first** (RPC `admin_log_impersonation` bloquante), via `?impersonate=<id>` en URL relative. Échappatoire CI : `app_config.super_admin_test_domain` (`.local` only). Chrome Sugar : `AdminShell` + kit `src/components/admin/kit/` (`AdminPager`, `AdminSearchInput`, `AdminSegmentBtn`, `AdminConfirm`, `AdminStat`…), palette re-teintée par `src/styles/admin-console.css` — ⛔ ne JAMAIS y remettre `outline: none`, c'est ce qui avait supprimé tout repère de focus clavier. **[02.08.2026]** Premier geste réellement branché : « Relancer » sur la table Santé des crons du Monitoring (`admin_cron_run_now`) — la confirmation est demandée par le SERVEUR (`details.needs_confirm`), jamais rejouée côté écran. Les événements Sentry portent un tag **`surface` = `console` \| `crm`** (dérivé de l'URL dans `beforeSend`) : c'est lui qui rend mesurable le critère G4 « 48 h sans erreur console ». Runbook d'astreinte + marche à suivre du premier export du registre : `docs/console-admin/`. |

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
**🟨 Appel d'accueil (août 2026)** — une **étape du wizard** d'identité KYB depuis le 4 août.
L'agence y réserve son appel de prise en main avec l'équipe MEGGA, sur des créneaux réellement
libres.

⚠ **Refonte du 04.08.2026, trois changements.** (1) Le rendez-vous n'est plus la *suite* du wizard
mais son **étape 3 sur 5** (signataire → agence → pièce d'identité → **rendez-vous** →
récapitulatif) : le récapitulatif le relit avant l'attestation, et `handleSubmit` mène de nouveau à
`/dashboard`. L'étape est **bloquante** — sauf quand il n'y a rien à réserver (`pool_empty`, ou
aucun créneau sur l'horizon), sans quoi elle enfermerait aujourd'hui même chaque nouvelle agence
hors du CRM, `onboarding_hosts` étant **vide en production**. La réservation est écrite **au clic
sur Confirmer**, pas différée à la soumission. (2) Les trois surfaces (étape, écran agent, page
publique) passent en **MEGGA X** et partagent `src/components/onboarding-call/`
(`OcSlotPicker`/`OcBooking`/`OcBookedCard`) ; le calendrier **réutilise tel quel**
`.mx-datepicker__*` (point 11 de `megga-x-additions.css`), seule la colonne des heures est neuve
(point 14). La console super-admin garde son kit admin — seule sa **densité** a été réduite.
(3) **La page publique était injoignable depuis sa création** : `/rendez-vous/:token` était déclaré
deux fois dans `App.tsx`, et `AppointmentManagePage` (RDV de vérification KYC) vient avant — tout
lien « replanifier ou annuler » d'un e-mail d'appel d'accueil ouvrait l'écran KYC. Elle vit
désormais sur **`/rendez-vous-accueil/:token`**, chemin qui existe à **six endroits solidaires** :
la route, les trois edge (`-book`/`-manage`/`-reminder`) et les gardes de redaction de jeton
(`src/lib/sentry.ts` + sa jumelle `index.html`, `_shared/pii-redaction.ts`) — où
`rendez-vous-accueil` **doit précéder** `rendez-vous` dans l'alternation, faute de quoi le jeton
part en clair chez Sentry (même règle que `kyc-report` avant `kyc` ; garde-fou
`tests/unit/token-routes.spec.ts`).

`/dashboard/rendez-vous-accueil` **survit** pour les agences passées avant l'étape et pour toute
reprise ; il reste **passable** (« Plus tard » pose un drapeau `localStorage`), rappelé ensuite par
`OnboardingCallBanner` (même emplacement que `LabGuardBanner`).

C'est un **objet de plateforme**, pas de tenant : 3 tables neuves (`onboarding_hosts` avec
`weekly_hours` en heure **murale**, `onboarding_host_exceptions`, `onboarding_calls`) plutôt qu'un
détournement de `visits`, dont `property_id`/`contact_id` sont `NOT NULL` et que toute la chaîne
aval lit comme une visite de bien. ⚠ Ce qui ferme réellement la double réservation, ce sont **deux
index partiels uniques** (`host_id, scheduled_at` et `agency_id`, tous deux `WHERE
status='confirmed'`) : une revérification applicative laisse passer deux requêtes concurrentes.
3 edge functions (`onboarding-slots` à **double mode d'authentification** — session d'agent ou
`manage_token` —, `onboarding-call-book`, `onboarding-call-manage`) + `onboarding-call-reminder`
(cron 07:00 UTC). Moteur de créneaux **pur** dans `_shared/onboarding-slots.ts`, converti par
`Intl.DateTimeFormat` avec aller-retour de vérification (une heure inexistante au passage à l'heure
d'été rend `null` au lieu d'un créneau décalé). Console : `/dashboard/admin/onboarding-calls`
(segments Rendez-vous / Hôtes) + carte sur la fiche agence ; le flux live vient gratuitement de
l'audit `actor_kind='system'`, catégorie **`onboarding`** ajoutée au CHECK d'`activity_events`.
Cerveau : `megga/onboarding-call`.

**Routes dev** (showcase, no auth) : `/dev/mandate-sign`, `/dev/sentry-test`.

### Composants (`src/components/`)
- `propertyx/` — **système d'icônes seul** : `MEIcon`, `PxIconFont`, `PxSocialIcon`, `PxWhatsAppButton` + `tokens.ts` (`PX.*`). Les atomes de présentation (PxButton, PxBadge, PxInput, PxAvatar, PxLogo…) et `sections/` ont été retirés avec la marketplace — **ne pas les réintroduire** (cf. CLAUDE.md § Vestiges Property X).
- `megga-x/` — **MEGGA X**, port 1:1 Webflow de la vitrine, scopé `.megga-x`. ⚠ Depuis le 10 août 2026 (PR #1194) c'est aussi la **direction unique du CRM** : Sugar est supprimée, cf. `megga/da-meggax-crm`. Contenu : `MeggaX` + 12 wrappers `Mx*`, CSS générée `src/styles/megga-x.generated.css`, route dev `/design-system/megga-x`. Règle **zéro-invention** ; résidus de marques Webflow encore présents dans la CSS/fontes. Cf. `megga/design-megga-x`.
- `ui/` — primitives headless + Motion (modal, dialog, Sheet, Toast, Shimmer, popover, tabs…).
- `layout/` — `ProtectedRoute`, `ConsentGate` (gate nLPD), `StaleBundleDetector`, `AgentLayout`, `AgentSugarLayout`.
- `crm-sugar/` + `crm-sugar-v3/` — shell CRM, contact detail, KYC (**pager `kyc-pager/`** : frame + liste + vigie + fiche stricte + liseuse ; wizard `kyc-wizard/` avec voie import ; l'ancien écran `kyc/` [KycDossierDetail/KycListView] n'est plus routé, conservé transitoirement), **biens** (`biens/pager/` [BiensPager/BpTopGallery/BpFollowupPage/BpRenewModal/BiensFirstRun/followupData] + `biens/gallery/` + BnScoreBadge — les anciens BnSubmissions/BnDetailOverlay/BnPhoto/biensData/helpers sont **retirés**, superseded par le design final), tokens dark.
- `crm-sugar-wizard/` — wizard « Créer un bien » (`/dashboard/listings/new`, `WizardShell` + **7 étapes** — refonte « complet » juil. 2026 : Step 0 trois portes `SgPorteCard` → Vendeur/Mandat → Adresse → **Caractéristiques guidées** (10 types, 7 questions `data.specsQ` + **accordéon détails `Step3bDetails`** conditionnel au type) → **Photos couverture-héro + pellicule** (upload réel, recadrage canvas → File) → Prix/Description 2 phases (DeepSeek réel) → **Publication checklist 5 critères** bloquants en public seulement. **Pas de Staging Studio** : `crm-staging-studio.jsx` du bundle handoff est un fichier ORPHELIN, monté nulle part). **Dark mode** : `SugarV2` (`tokens.ts`) est un **Proxy** qui résout la palette light/dark à chaque lecture depuis `document.documentElement[data-theme]` (pas de mutation de global au render → robuste React 18 StrictMode/concurrent) ; helpers `sgOn()` / `sgAcc()` pour les littéraux posés **sur l'accent** (accent → near-white en dark, `onBlack` → `#0A0A0F`). Header minimal (× fermer seul, flottant) + indicateur d'autosave en footer ; nav Précédent/Continuer, le CTA de publication vit dans le Step 7. Système distinct du wizard KYC (`kyc-wizard/`, `KycPaletteContext`). **Embedded (juil. 2026, #871)** : prop `embedded` → `position:absolute` (au lieu de `fixed z-9000`), monté en overlay dans le bento du pager Mes biens. **Porte « Importer un mandat » désactivée** : l'ancien chemin injectait un mandat fictif (exclusif, 3.5 %, signé) en base pour n'importe quel PDF — dormante jusqu'à un vrai OCR.
- Domaines : `search/` `listings/` `matching/` `transactions/` `kyc*/` `documents/` `calendar/` `messaging/` `admin/` `directory/` `map/` `ai-copilot/` `skeletons/` `auth-bento/`.

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
- **Biens** : `properties` (internes ; la publication est un **état de cette table** — `status` + `published_at` — il n'y a pas de table `listings` séparée), `property_scores` (score de bien, RPC `calculate_property_scores`), `market_listings` (marché — 144k lignes / 61k actives au 19 juil. 2026 : **Flatfox=location** 98k dont 35k actives, **RealAdvisor=vente** 46k dont 26k actives, + 27 lignes `megga-demo`). ⚠️ `external_listings` **n'existe plus en base** : seul le type TS `ExternalListing` survit (`useExternalMatching.ts`), et l'écran marché du CRM lit `market_listings`. Ingestion marché = **2 surfaces séparées** : `flatfox-sync` (location, partenaire sanctionné, cron 04:00) et **`realadvisor-sync`** (vente only, `realadvisor_sync_runs`). RealAdvisor : accès accordé (Gregory), throttle Cloudflare sur les requêtes **filtrées** → détection de disparition par **oracle `id_in` en pg_net** (crons `probe-fire`/`probe-collect` + `probe-sweep`, dry-run) + `fresh` quotidien (national) + trigger `price_reduced`. Deux briques complètent la boucle : **`rolling`** (cron 22:00, re-crawle un bucket de cantons par nuit, rotation à 3 jours pilotée par `app_config.realadvisor_shard_map` — c'est lui qui porte l'essentiel de l'**ingestion**, `fresh` n'en apporte qu'une poignée) et **`revive`** (crons 02:30/02:45, ré-active les `removed` que RA ressert vivants). L'ensemble est surveillé par la RPC `realadvisor_health_check` (cron 09:00, mail Resend) — 9 règles au 30 juil. 2026, dont `rolling_stopped` et `cron_inactive` sur les 7 jobs RA. ⚠️ Un cron qui délègue à pg_net peut « réussir » sans que la requête parte : la seule preuve d'exécution est un effet mesurable en base. Cf. brain `realadvisor-ingestion`, `megga/realadvisor-health-alerting` et `megga/pgnet-request-loss`. ⚠️ Toute slice scopée sur un canton passe par le **garde-fou de résolution de slug** (`_shared/ra-slice-resolution.ts`) : RA ignore un slug inconnu et sert le catalogue **national**, ce qui produirait un reçu `realadvisor_slice_coverage` `fully_enumerated` mensonger — le contrôle lève avant l'écriture du reçu. Cf. brain `megga/realadvisor-slice-resolution-guard`. **Syndication SORTANTE** (juin 2026) : `property_syndications` (1 ligne par bien×portail, status `queued/published/error/withdrawn`, UNIQUE`(property_id,portal)`, RLS agence) + `agency_syndication_config` (kill-switch `idx_enabled`, token pull, transport `pull`/`ftp`, creds FTP ; write `service_role` seul) — publie les `properties` au format IDX 3.01 sur immobilier.ch. Cf. §5 + brain `megga/syndication-idx`.
- **Pipeline & transactions** : `transactions` (stages lead→…→closed), `crm_offers` (offres/contre-offres ; historique via `parent_offer_id` + audit `activity_events`, pas de table `crm_offers_history`), `visits`, `client_searches`, `matches`.
- **KYC / compliance (clients)** : `kyc_cases`, `kyc_checklist_items`, `kyc_magic_links` + `kyc_magic_link_uploads`, `kyc_screening_decisions`, `documents` (sha256, retention).
- **Rendez-vous de vérification (août 2026)** : `agent_booking_settings` (1 ligne/agent — `is_open` **opt-in à false**, `weekly_hours` jsonb `{"1".."7": [[HH:MM,HH:MM]]}` validé par trigger, `slot_minutes`/`buffer_minutes`/`min_notice_hours`/`max_advance_days`, fuseau) · `agent_time_off` (absences absolues) · `appointments` (RDV **SANS bien** — distinct de `visits`, qui est une visite de bien : `property_id` NOT NULL, `bon`/`rapport`, consommée par pipeline et matching). Anti-double-réservation = **contrainte d'exclusion GiST** `EXCLUDE (agent_id WITH =, slot WITH &&) WHERE status='confirmed'` (btree_gist) : une garde applicative laisse passer deux clients qui valident le même créneau à la même seconde. `slot` est une colonne **générée** `tstzrange(LEAST(...), GREATEST(...), '[)')` — LEAST/GREATEST parce qu'une colonne générée est calculée AVANT les CHECK, si bien qu'un constructeur nu ferait échouer `tstzrange()` et rendrait le CHECK nommé inatteignable. ⚠️ Les policies sont **toutes `TO authenticated`, volontairement** : le client public ne touche jamais PostgREST, il passe par une edge + RPC `service_role`. N'ajoutez pas de policy `anon` (rouvrirait `rls_policy_always_true`, cf. `20260711190000`). Les tables ont été adoptées sur `main` par `20260802190000_adopte_tables_rdv` (créées hors pipeline, cf. brain `megga/rdv-kyc-self-booking`).
- **KYB / vérification des agences** (schéma 26 juil. 2026 ; moteur, connecteurs disponibles et file de revue 28 juil. ; **registre suisse par LINDAS + clé du n° de registre + concordance de pays FR** 29 juil.) : ne pas confondre avec le KYC ci-dessus, qui porte sur les *clients* de l'agence. Ici on vérifie l'agence elle-même à l'onboarding. `legal_forms` + `legal_form_aliases` (référentiel 21 formes CH/FR/LI ; `category` pilote le parcours — `sole_proprietorship` = pas d'UBO tiers, `foundation_or_trust` = diligence renforcée) · `agencies` enrichie (`legal_form_id` FK, `business_registration_number` ex-`ide` — le terme IDE est suisse et mentait dès qu'un SIREN arrive —, `trade_name` cible du rapprochement flou avec le domaine e-mail, `verification_status`/`verification_score`/`verified_at`) · `agency_related_persons` + `agency_person_roles` (`signatory`/`ubo`, historisés ; **distincts de `profiles`** : un ayant droit économique passif n'a pas de compte CRM). ⚠ Depuis le 4 août 2026, `agency_related_persons.agency_role` porte en plus le **rôle d'organisation déclaré** (`admin|manager|agent|assistant`), qui a remplacé la question du *pouvoir de signature* à l'étape 1 du wizard — à ne pas confondre avec `agency_person_roles.role`, qui reste la qualité de **conformité**. `signature_power` n'est pas supprimée (nullable, relue sur les dossiers antérieurs) ; le wizard écrit toujours le rôle `signatory`, que la RPC de soumission exige, simplement sans pouvoir. Le rôle déclaré n'atteint `profiles.role` qu'**à la soumission**, dans `submit_agency_identity` (migration `20260804170100`) — aucune RPC « je change mon propre rôle » n'est exposée au client, ce serait la porte que le verrou anti-escalade `20260627120000` a fermée — et **jamais s'il retirait à l'agence son dernier administrateur** (l'écran porte la réserve au moment du choix). Conséquence : dans une agence solo — le cas de tout onboarding — `profiles.role` ne bouge donc jamais · `verification_check_types` + `verification_check_config` (poids **versionné**, jamais figé sur la ligne de check) + `agency_verification_checks` / `agency_person_verification_checks` (`raw_response` jsonb = pièce d'audit LBA). Score normalisé sur les checks **disponibles** → un pays sans VIES n'est pas pénalisé, ce qui rend le modèle transposable ; les vétos (registre, PEP/sanctions, pièce d'identité) sont **hors score** et ne se compensent jamais. **Moteur écrit** : `recompute_agency_verification` (migration `20260729151200`, `service_role` seul) pose score et statut ; l'edge `agency-verification-run` fait tourner **10 connecteurs réels** (9 entrées statiques de `AGENCY_KYB_SOURCES` + le géocodage, seul à réclamer un secret) — RDAP (`domain_whois_age`), VIES (`vat_lookup`), `recherche-entreprises.api.gouv.fr` FR (`registry_lookup` + `registry_legal_name_match` + `registry_country_match`), géocodage Mapbox (`address_geocode`, réclame le secret `MAPBOX_TOKEN` qui n'est pas posé), **LINDAS** CH (les trois mêmes types de registre, endpoint SPARQL public de la Confédération, sans clé) et le contrôle **interne** de la clé du n° de registre (`registry_number_format`, CH+FR, aucun réseau, `source='internal'`, migration `20260729160000`). Une règle de **juridiction** (`appliesTo` + `selectApplicableSources`) garantit qu'un `check_type` partagé n'a jamais deux propriétaires sur le même dossier. **File de revue admin livrée** (`20260729151500` + `/dashboard/admin/kyb-review`) : valider, rejeter avec motif, relancer, résoudre la pièce d'identité. **Reste en squelette : le registre UID** (`vat_lookup` CH/LI, `createUidRegisterSources`) — jamais testé en API, sort `unavailable`. `oera.li` sans API et absent de LINDAS, carte pro CCI FR sans API. ⚠️ **L'auto-validation dépend désormais du pays, et c'est le fait à connaître** : la **France** a ses quatre vétos d'entité servis et s'auto-valide dès qu'un humain résout la pièce d'identité (mesuré en base) ; la **Suisse** ne le peut pas, LINDAS ne publiant aucun statut actif/radié, ce qui plafonne `registry_lookup` à `partial` et un véto ne passe que sur `match` ; le **Liechtenstein** n'est servi par rien, y compris pour le format de son numéro, alors qu'il est sélectionnable au wizard (dette explicite). Cf. [agency-kyb-verification.md](agency-kyb-verification.md) (conception), [agency-kyb-handoff.md](agency-kyb-handoff.md) §7bis (ce que chaque pays peut auto-valider) et §8 (ce qui reste suspendu) + brains `megga/agency-kyb-verification`, `megga/agency-verification-connectors` et `megga/agency-verification-pending-sources`.
- **Portail vendeur** : ❌ retiré le 26 juillet 2026. Les tables `seller_portals` et `seller_preferences` ont été droppées (0 ligne depuis leur création) avec l'edge function `seller-portal-action`. ⚠️ `vendor_dossiers` n'existait déjà pas en base.
- **Billing** : `subscriptions` (Stripe).
- **Messaging** : le canal réel du CRM est **WhatsApp** — 14 tables `whatsapp_*` (`whatsapp_messages` journal, `whatsapp_agent_links` + `agency_wa_numbers` appairage numéro↔agent, `whatsapp_conversation_insights`, `whatsapp_pending_actions`, `whatsapp_confirmation_log`, `whatsapp_followup_suggestions`, `whatsapp_daily_briefs`, `whatsapp_notices`, `whatsapp_message_corrections`, `whatsapp_rejected_drafts`, `whatsapp_recent_auto_actions`, `whatsapp_tool_usage`, `whatsapp_async_jobs`, `whatsapp_cron_locks`) · `message_templates` · `contact_messages` (formulaire vitrine ; anon fermé juil. 2026). ⚠️ `message_threads`, `messages`, `email_messages_cache` (système Messages maison du CRM agent) et `marketplace_inquiries` **n'existent plus en base**.
- **Favoris/alertes acheteur** : ❌ **plus rien en base** — `market_favorites`, `market_alerts`, `saved_searches` et `newsletter_subscribers` sont partis avec la marketplace publique. Les recherches côté CRM vivent dans `client_searches` (cf. Pipeline).
- **Audit & monitoring** : `activity_events` (immutable, `actor_kind` user/system/ai), `auth_events`, `platform_metrics`, `flatfox_sync_runs`, `realadvisor_sync_runs`. ⚠️ `ticket_events` **n'existe plus** (parti avec le support maison, cf. Support).
- **Admin** : `admin_feature_flags`, `admin_nps_responses`, `admin_notes`, `admin_changelog` · `user_consents` (preuves nLPD immuables user×type×version, INSERT via RPC `record_consent` seule — écrites dès l'inscription par `handle_new_user`, versions dans `legal_document_versions` côté serveur ; `ConsentGate` ne sert plus qu'aux bumps de version et aux comptes OAuth) · `profiles.is_suspended` (miroir du ban GoTrue, écriture service/definer) · `ai_usage_logs.agency_id/module` (attribution coûts IA, historique NULL = « Plateforme »).
- **Support** : `support_tickets` **seule survivante** (vide ; `admin-monitoring` lit encore `open_tickets`→0), dormante depuis le passage à Intercom. ⚠️ `ticket_messages`, `ticket_canned_responses`, `chat_conversations`, `chat_messages` et `ticket_events` ont été **supprimées de la base** : le support maison n'est pas « réversible », le rebrancher voudrait dire le reconstruire. Cf. brain `intercom-support`.
- **IA** : `ai_usage_logs`, `ai_balance_snapshots`, `translation_cache`, `ai_copilot_conversations` (persistance copilote web OPTIONNELLE double-gatée — flag `app_config.copilot_persistence_enabled` + `persist:true` client ; RLS owner-scoped ; cf. brain `megga/copilot-persistence`). ⚠️ Les photos IA ne sont **pas des tables** mais des **colonnes de `properties`** : `photo_tags` (là où l'ancienne doc annonçait `ai_photo_labels`) et `ai_generated_photos` (colonne, pas table homonyme), à côté de `photos` / `photos_cf` / `photos_cf_processed_at` (R2). `photo-vision` et le virtual staging écrivent dans `properties`.

### RLS (modèle agency-first)
- **Agents** : visibilité `WHERE agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())`.
- **Dirigeants d'agence — exception KYB (26 juil. 2026)** : sur les tables KYB, le filtrage par agence **ne suffit pas** — elles portent la PII des dirigeants et actionnaires (date de naissance, n° de pièce d'identité). Nouveau helper `is_agency_admin()` (SECURITY DEFINER, `admin`|`manager`) : un agent simple n'a aucune raison de lire l'identité de l'actionnaire de son agence. Les tables de checks sont en **lecture seule côté client** (suivi de dossier) — aucune policy d'écriture, seul le `service_role` écrit depuis l'edge function de vérification, faute de quoi un client pourrait se déclarer « match ». `verification_check_config` n'a **aucun accès client**, même en lecture : exposer les poids inviterait à optimiser sa saisie pour franchir le seuil d'auto-validation. Le référentiel (`legal_forms`, `legal_form_aliases`, `verification_check_types`) est en `using (true)` assumé (aucune PII, alimente un menu déroulant).
- **Anon (ex-marketplace)** : plus aucune lecture publique d'annonces — `market_listings` et `market_price_history` révoqués pour `anon` (migration `20260719110000`), `contact_messages` fermé (`20260719100000`). Subsiste `seller_leads_anon_insert` (INSERT seul, borné `assigned_agency_id IS NULL` + `status='new'`), **sans écrivain** depuis la suppression du storefront (juil. 2026). Accès anon restants, hors marketplace : `article_views` / `article_feedback` → INSERT, `translation_cache` → SELECT.
- **Acheteur authentifié — plus AUCUNE policy (3 août 2026, #1114)** : `visits_select_by_buyer_email` a été **retirée**. Elle laissait tout compte authentifié lire une ligne `visits` entière — donc son `manage_token`, donc la capability elle-même — au seul motif que la revendication `email` de son JWT égalait `buyer_email`, alors qu'un e-mail revendiqué n'est pas un e-mail prouvé. Son unique consommateur (`components/account/profile/VisitsRow.tsx`) avait disparu au pivot CRM-first, et c'était la **seule** policy de la base à s'appuyer sur cette revendication (vérifié). L'accès acheteur passe désormais uniquement par capability token. `tests/backend/rls-visits-buyer-email.spec.ts` a été **retourné** en garde-fou : rétablir la policy fait rougir la CI.
- **Vendeur** : via `seller_portals.token` (stateless, pas d'auth.users) → READ property/transaction, UPLOAD documents.
- **service_role** (edge functions) : full access ; triggers écrivent `activity_events` (`actor_kind='system'`).
- **super_admin** : silo séparé sur `admin_*` + impersonate audité (audit-first, RPC serveur). Depuis 20260705160000, `is_super_admin()` exige rôle **ET** email allowlisté en dur (lu dans `auth.users` — jamais `profiles.email`, auto-modifiable) : un rôle posé hors allowlist ne débloque rien.
- **Piège soft-delete (prouvé 18 juil. 2026, #871)** : quand un UPDATE lit la table (WHERE), PostgreSQL applique **aussi la policy SELECT à la ligne modifiée** → poser `deleted_at` sur `properties` (policy SELECT exige `deleted_at IS NULL`) échoue en « new row violates row-level security policy », avec ou sans RETURNING. Règle : tout soft-delete côté client passe par une **RPC `SECURITY DEFINER`** qui re-vérifie l'agence — ex. `soft_delete_property` (migration `20260718032751`, renvoie `false` si déjà supprimé ; le trigger `trg_properties_audit` journalise `bien_soft_deleted`, rétention LBA).
- **Cycle de vie des capability tokens (3 août 2026, #1114 + #1119)** — le durcissement de juillet avait scopé les RPC au token mais leur avait laissé **zéro cycle de vie**. Les quatre `*_visit_by_token` ont désormais : péremption **dérivée** (`now() < scheduled_at + 30 j` — pas de colonne, donc pas de dérive `database.ts`), refus des statuts terminaux, annulation et avis à usage unique, note hors 1..5 rendue en booléen au lieu d'un 23514 brut, `search_path` `public, pg_temp`, `VOLATILE` (une fonction `STABLE` est servie en **GET** par PostgREST — donc jeton en query string, donc dans les journaux d'accès), `manage_token` retiré de la réponse, et une ligne `activity_events` par geste.
  - ⚠ **Le piège** : l'unicité de l'avis porte sur **l'avis déjà déposé**, surtout pas sur `status='done'` — `done` est l'état *normal* au dépôt (`automation-engine` ne relance que des visites closes), le refuser fermerait 100 % des avis.
  - ⚠ Les quatre RPC rendent `false`, **pas** une erreur PostgREST : un hook qui ne lit que `error` affiche un succès sur un geste qui n'a rien écrit (cf. `gesteParJeton`, `useVisits.ts`).
  - **Retrait d'un lien de réception** : statut `revoked` + `revoked_at` + RPC `revoke_reception_link` (garde d'agence **interne**, la RLS ne s'applique pas à une SECDEF). Il faut les **trois** gardes dans `record_buyer_reaction` — refus en tête, `FOR UPDATE` sur la lecture d'ouverture, et condition sur l'`UPDATE` final : sans la dernière, une seule réaction de l'acheteur **effaçait** le retrait.
  - **Droits de table** : `anon` révoqué totalement sur `visits`, `kyc_magic_links`, `kyc_magic_link_uploads`, `buyer_reception_links` ; `authenticated` perd `TRUNCATE`/`REFERENCES`/`TRIGGER` (**`TRUNCATE` échappe au RLS** — aucune policy ne peut le rattraper). Anti-récidive : ces quatre tables sont entrées dans `scripts/check-privilege-drift.mjs`.
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
> `megga`/`preview` seul, pas de proxy Supabase). ⚠ Les pages d'auth (`login`, `signup`,
> `reset-password`) et `css/ js/ images/ fonts/` sont **hors du gate** depuis le 26 juillet
> 2026 : le CRM n'ayant plus de page de connexion, gater `/login` fermait l'accès au CRM
> lui-même (un non-connecté de `app.megga.ch` tombait sur un 401 en texte nu), et gater
> `/reset-password` cassait les liens envoyés par e-mail.
> **Blog + SEO + légal (28-29 juin 2026, cf. brain `megga/vitrine-content-seo`)** : `blog.html` + 13 articles
> dans `blog-posts/` (filtrable + recherche câblée + FAQ accordéon, angle **demand-led** avec byline experts MEGGA) ·
> fondations SEO (`sitemap.xml` 21 URLs, `robots.txt`, canonical, JSON-LD) · pages légales `mentions-legales.html`
> (12 sections) + `confidentialite.html` · About refondu (rôle Reto Brunner). **Reste** : image hero encore CodeAI.

---
## 5. Edge functions (71) — catalogue par domaine

> Deno, dans `supabase/functions/`. Déclencheurs : HTTP (défaut), `pg_cron`, webhook Stripe, hooks auth.

**`_shared/`** : `ai-provider.ts` (`callDeepSeek` / `callPublicAI`=DeepSeek seul — **plus de `callClaude`** depuis PR #829, pas de wrapper `callAgentAI` ni de fallback ; coût) · `magic-link-token.ts` (HMAC-SHA256) · `vision.ts` + `photo-vision.ts` (**Gemini** `gemini-2.5-flash-lite` — DeepSeek n'a pas de vision) · `pii-redaction.ts` (catalogue partagé, 8 kinds — l'**ordre compte** : valeur libre en dernier, cf. cerveau `megga/pii-catalogue-traps`) · `wa-agent-redaction.ts` (`redactLlmMessages` = les **2 points d'étranglement** DeepSeek : `whatsapp-agent` et `buildCopilotModelBody`) · `whatsapp-doc-prompt.ts` (OCR rédigé avant troncature) · `require-agent-auth.ts`.

| Domaine | Functions |
|---|---|
| **IA / copilote** | `ai-copilot` (chat agent + actions, **DeepSeek** deepseek-chat) — `ai-search` et `parse-search-query` retirées à l'assainissement #671 |
| **KYC / compliance** | `kyc-screening` (Dilisense PEP/sanctions déterministe — l'analyse Claude a été retirée) · `kyc-report-import` (**PR #853** : lit un rapport KYC/AML externe PDF via Gemini, contrôles proposés jamais auto-validés [MLRO], quota par agence) · `kyc-report-data` + `kyc-report-pdf` (rapport KYC PDF par WhatsApp, Cloudflare Browser Rendering REST API — cf. brain `kyc-report-pdf-whatsapp`) · `delete-account` (nLPD art.32, + branche admin `target_user_id`) · `log-auth-event` (IP hashée) · `audit-pdf-export` (chaîne hash SHA-256, LBA 10 ans ; branche super-admin = scope plateforme) |
| **Admin (P1-P4 07/2026)** | `admin-dsar-export` (JSON nLPD art. 25, journalisé avant retour) · `admin-user-lifecycle` (suspend/reactivate/reset, ban GoTrue, anti-lockout allowlist) · `admin-agency-lifecycle` (suspension agence + ban membres) · `_shared/require-super-admin.ts` (rôle + allowlist + AAL2, adopté par toutes les edges admin) · `_shared/admin-alerts.ts` (alerting cron : seuils `app_config.admin_alert_thresholds`, dédup 24h, destinataires `super_admin_allowlist()`, Resend) |
| **Magic link KYC** | `magic-link-create/get/confirm/send-email/upload` (`magic-link-regenerate` retirée, 0 appelant, undeployée le 18 juil.) |
| **RDV de vérification** (août 2026) | `appointment-slots` (GET public : créneaux proposables ; accepte le jeton du **lien magique** OU un jeton de **rendez-vous** `k='appt'`, sans quoi « déplacer » serait inservable — le client n'a plus le lien magique en main) · `appointment-book` (POST public) · `appointment-manage` (GET/POST : état, report, annulation). Partagés : `booking-slots.ts` (calcul **pur**, testé sur les 2 bascules DST 2026), `booking-freebusy.ts`, `booking-oauth.ts`, `booking-calendar-write.ts`, `booking-email.ts` |
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

**C · Portail vendeur (token)** : ❌ **flux supprimé le 26 juillet 2026.** Il n'a jamais tourné une seule fois — aucun portail n'a jamais été créé, donc aucun lien personnel envoyé. Les URLs `/portal*` et `/portail*` redirigent désormais vers la vitrine ; page, composants, hooks, edge function et tables sont partis (migration `20260726180000`).

**D · KYC (Dilisense)** : transaction reserved/negotiation → `kyc_cases` (vigilance standard/renforcée selon montant + source des fonds) → magic link upload (`kyc_magic_link_uploads`, OCR, sha256) → screening async Dilisense → `kyc_screening_decisions` (PEP/sanctions) → **revue humaine MLRO** (fin de flux). L'ancienne **analyse qualitative Claude** a été **retirée du code**, pas seulement désactivée par flag : `ai_analysis` est forcé à `null` en dur (`kyc-screening/index.ts:251`, retrait #794/#829 — Claude banni au runtime). Le rapport masque la section « Analyse de risque » quand `ai_analysis` est null. Socle = screening factuel Dilisense + revue MLRO. **Canal WhatsApp (livré, cf. brain `kyc-whatsapp-spec`)** : l'agent ouvre/joint/screene depuis sa conversation via **6 outils copilote KYC** (`get_kyc_status` *read* ; `attach_kyc_document` *auto* ; `open_kyc_case`/`send_kyc_link` *confirm* ; `run_kyc_screening`/`send_kyc_report` *slow_async*) ; même moteur, le MLRO valide toujours (jamais `is_completed`/`verified` côté IA). **Rapport KYC en PDF par WhatsApp (livré, cf. brain `kyc-report-pdf-whatsapp`)** : `send_kyc_report` (tier *slow_async*, ~60 s → hors boucle) → edge `kyc-report-pdf` mint un token HMAC court → Cloudflare Browser Rendering (REST API, pas de Worker) rend la route publique `/kyc-report/:token` (même template `PdfPage1/2/3` que le CRM) → PDF officiel uploadé en média Meta éphémère et envoyé en document **qu'à l'agent** ; lecture seule (seul write = audit `kyc_report_sent`), aucune migration. **Import d'un rapport externe (PR #853)** : wizard voie import (dépôt PDF ≤7 Mo) → edge `kyc-report-import` (Gemini, `_shared/kyc-extract.ts`) → contrôles identité/PEP/sanctions **proposés, jamais auto-validés** (garde-fou MLRO) + PDF attaché au dossier en catégorie compliance.

**E · Matching & alertes** : `client_searches` (criteria JSONB) → `matching-engine` **v2** (durci PR #634 : pré-filtre **DUR** `transaction_type`+budget±15%+canton via RPC `match_candidate_listings`, puis scoring **soft** 0-100 — barème dans `app_config.matching_scoring_v2`, déterministe ; + axe **bonus** `pricePosition` en location = position du loyer vs marché du secteur via la MV `market_rent_stats`, PR #674, raison dans `budget.detail`, activation = redéploiement edge) sur `market_listings`+`properties` → `matches` (score+raisons, `score_version`, dédup dure par couple contact×bien, insert via RPC `ON CONFLICT`) → **Atelier Matching** (triptyque plein écran, gestes `E/X/P/R/V`) : Envoyer = deal `new_lead` (créé/rattaché, `transactions.market_listing_id` si bien de veille) + timeline contact (`dossier_envoye`) + reminder +5 j (→ Aujourd'hui, dédup avec `automation-engine`) + `send-property-email` ; Relancer = `sent_at` reset + reminder repoussé + `send-relance-email` ; Plus tard = `snoozed_until`+7 j + reminder custom à échéance ; Écarter = `ignored` (jamais re-proposé) ; Visite = bascule `/dashboard/visits/new` (bien interne). Écritures différées 4,5 s (undo toast avant toute écriture). Alertes email publiques (`market_alerts`/`search-alert` cron via Resend) inchangées.

**F · Audit trail** : tout changement (transaction/KYC/offre/property) → triggers `SECURITY DEFINER` → `activity_events` immutable (actor_id+kind, severity, category, metadata) → timeline contact + audit super-admin + export PDF signé (chaîne de hash).

**G · Monitoring** : `pg_cron` → `admin-monitoring` → `platform_metrics` → `AdminMonitoringPage` (historique 30j) + feature flags.

**H · Prise de rendez-vous KYC en self-service (août 2026)** : au bout du parcours du flux **D**, le client réserve LUI-MÊME sa vérification d'identité — l'aller-retour « quelles sont vos disponibilités ? » disparaît (objectifs #1 et #3). Réglages › **Disponibilités** ouvre `is_open` (opt-in ; sans lui la page publique répond « votre conseiller n'a pas ouvert la réservation ») → `MlkSuccess` propose « Prendre rendez-vous » → `appointment-slots` croise la grille hebdo, les absences, les RDV confirmés, **les visites de bien** (sans quoi un RDV KYC tomberait sur une visite déjà planifiée — la contrainte d'exclusion ne couvre que `appointments`) et le **free/busy des agendas externes** → `appointment-book` → RPC `book_kyc_appointment` → écho dans l'agenda Google/Outlook + confirmation Resend avec lien de gestion `/rendez-vous/<jeton>` → report (2 max) / annulation via `appointment-manage`, tous deux fermés dans la fenêtre de prévenance. Le RDV remonte dans l'agenda agent (3ᵉ source de `useCalendarSugar`, type d'événement `kyc`).
> **Confidentialité par choix d'API, pas par filtrage** : les occupations externes passent par `POST /freeBusy` (Google) et `getSchedule` (Graph), qui ne renvoient QUE des couples début/fin — aucun titre, lieu ni participant ne transite. Un visiteur anonyme ne peut donc rien apprendre de l'agenda de l'agent, même si notre filtrage était fautif.
> **Agenda connecté mais injoignable → on ne propose RIEN** (503 `calendar_unavailable`) plutôt que des créneaux calculés sur une vision partielle : la promesse faite au client est « les disponibilités réelles de l'agent ». Un agent sans agenda connecté est, lui, entièrement décrit par la base — aucune dégradation.
> **Surface de spam bornée par construction**, pas par un compteur : il faut un jeton signé HMAC (donc émis par un agent) et **un lien ne porte qu'UN rendez-vous** (garde `already_booked` en base).

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
npm run dev          # vite — CRM, console super-admin comprise (localhost:5173)
npm run build        # tsc -b && vite build  (+ postbuild overlay-storefront)
npm run lint         # eslint          ·  lint:deadcode  ·  lint:prose (⚠ i18n, hors des autres gates)
npm run lint:types-freshness  # database.ts vs prod : aucun client casté, aucune RPC hors types (#1064)
npm run test:unit    # vitest   ·  test:backend  ·  test:e2e (playwright: ai/admin/visual)
npm run i18n:parity:ci  # parité FR/DE/EN/IT — à lancer dès qu'on touche aux locales
```
CI/CD : push `main` → GitHub Actions → Cloudflare Pages + Supabase edge auto-deploy. **Deux cibles Pages**,
un workflow chacune : `deploy.yml` → megga.ch (vitrine, projet `megga-real-estate`) et `deploy-app.yml` →
app.megga.ch (CRM et console, projet `megga-app`). Les deux créent le projet, attachent le domaine et posent
le CNAME s'ils manquent — rien à préparer à la main. `deploy-admin.yml` a été retiré avec l'app autonome.

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
Prod `megga.ch` actuellement **password-gated** (Basic Auth `realm="MEGGA - acces restreint"`,
pré-lancement) — realm en ASCII pur : un tiret cadratin sort de la plage d'un octet des valeurs
d'en-tête HTTP, Cloudflare le tolérait mais un client strict refuse la réponse entière.
Les pages d'auth échappent au gate (cf. §vitrine).

**Deux veilleurs HORS Supabase** (`.github/workflows/`, seuls dispositifs qui survivent à une panne de la
plateforme — les 47 crons de santé vivent tous dans `cron.job`, donc se taisent ensemble) :
`security-audit.yml` (lundi 07:03 UTC, RLS + policies + gardes edge, mail Resend) et
**`scheduler-heartbeat.yml`** (*/30, #1064) — sonde `cron.job_run_details` et alerte si l'ordonnanceur se tait.
Seuil DÉRIVÉ, pas choisi : deux jobs tournent à la minute et l'écart maximal mesuré sur 6 h de production est de
60 s, donc 10 min de silence = dix battements manqués. ⚠ Le destinataire est en dur : le lire dans
`super_admin_allowlist()` exigerait la base, c'est-à-dire ce qui peut être tombé. La sonde qui ÉCHOUE est
elle-même une alarme. Cf. brain `megga/console-admin-lot3-preflight`.

**Dérive du TYPAGE (#1064)** — `src/types/database.ts` est auto-généré et rien ne le surveillait : 15 relations
et 64 fonctions y manquaient, tenues par 16 casts de client dans 14 fichiers. `check-types-freshness.mjs` défend
trois propriétés (aucun client casté dans `src/`, aucune RPC appelée hors des types, aucune relation vivante
absente) — statique sur chaque PR, moitié production dans `migration-drift.yml`. ⚠ Elle ne compare PAS les
fonctions : 770 vivantes contre 420 émises, le filtre du générateur nous échappe.

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
