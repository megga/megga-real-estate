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
(147 entrées curées) forment le « cerveau système » de MEGGA. Il est **durable** (committé dans git),
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
Marketplace publique **désactivée** (routes → vitrine megga.ch) ; backend Flatfox (~34k
`market_listings`) conservé pour le matching. Stack React/Vite (Cloudflare Pages) + Supabase (Postgres, 67 edge functions,
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
           Realtime, pgvector, pg_cron, pg_net · 57 Edge Functions (Deno)
IA         Claude (Sonnet/Haiku, côté agent) + DeepSeek V3 (côté public + fallback)
           via abstraction _shared/ai-provider.ts (tracking coût → ai_usage_logs)
Intégr.    Stripe · Resend · Dilisense (KYC) · Google/Microsoft Calendar · Google AI (staging)
           Deepgram (STT) · Cloudflare R2 (photos) · Flatfox + RealAdvisor (sync marché)
           Intercom (support unique : Messenger + Fin IA LIVE + Inbox + Help Center public ; région US, flag nLPD)
Hosting    Cloudflare Pages · CI/CD GitHub Actions → Pages + Supabase edge auto-deploy
```

**Frontières & flux global :**
```
megga.ch (site statique V3, password-gated)  ─┐
app.megga.ch (SPA React, /dashboard/*)         ├─► Supabase (RLS) ◄─► Edge Functions ◄─► services externes
kyc.megga.ch (magic links KYC publics)        ─┘         ▲
                                                         └── pg_cron (flatfox-sync, monitoring…) via pg_net
```

---

## 2. Frontend — audiences & routing

5 audiences, gardées par `PasswordGate → StaleBundleDetector → ProtectedRoute / SuperAdminGuard`.
QueryClient global : `staleTime 2min`, `retry 1`, `refetchOnWindowFocus`, `networkMode: always`.

| Audience | Préfixe | Pages clés |
|---|---|---|
| **Marketplace SPA** (app.megga.ch) | ~~`/buy` `/rent` `/propriete/:id`~~ → **désactivées** (redirigent vers vitrine megga.ch) | ⚠️ **Pivot juin 2026 — marketplace publique OFF** : `MarketplaceDisabledRedirect` renvoie `/buy /rent /search /propriete/:id /listing/:id` vers megga.ch. `SearchPage`/`PropertyXSinglePropertyPage` conservés (imports commentés, réactivation Sprint 7). `market_listings` + cron Flatfox + `matching-engine` **intacts** (le matching tourne sans affichage public). Écran marché **interne** CRM `/dashboard/market/:externalId` toujours actif. |
| **Marketing public** | `/about` `/sell` `/estimates` `/services` `/agencies` `/agents` `/help*` | pages secondaires + centre d'aide |
| **Compte visiteur** | `/account` | favoris, recherches sauvegardées, messagerie acheteur |
| **KYC self-service** | `/kyc/:token` | `KycPublicPage` (parcours sans compte, magic link) |
| **Portail vendeur** | `/portal/:token` (+ `/portal` dev) | `VotreVentePage` — page unique « Votre vente » (Sugar Pure, lecture seule) : carte bien + galerie/lightbox, parcours arc 6 étapes, 3 jauges donut, offres (+modal décision), timeline, carte agent WhatsApp |
| **CRM agent** | `/dashboard/*` | voir ci-dessous |
| **Super-admin** | `/dashboard/admin/*` | 14 pages (accent violet), `SuperAdminGuard` |

**CRM agent** (layout `AgentSugarLayout`, dark CRM) — pages principales :
`dashboard` (TodaySugar, KPI) · `pipeline` (deals par stage) · `contacts` (+ `/:id` détail) ·
`listings` (+ `/:id`, `/new` wizard, `/:id/edit`) · `transactions/:id` (stepper 8 étapes + bannière KYC + offres) ·
`matching` (**Atelier triptyque plein écran**, juin 2026 — legacy `matching/v2`, démo QA `/dev/matching-atelier`) · `journey` · `calendar` (Google/Outlook) · `documents` (+ generate/templates) ·
`kyc` (+ `/:dossierId`, `/export` PDF) · `network` · `audit` (journal nLPD) · `analytics` · `settings`.

**Onboarding** : `/dashboard/onboarding` (wizard) → `/dashboard/premier-jour` (calibrage IA one-shot).
Flux `PremierJourShell` : `welcome → q0..q3 → synthesis → configuring → today`. La phase `configuring`
rend **`D0Activation`** (écran d'activation IA « atterrissage » grand format, épuré : anneau Meta +
phrases pilotées par les réponses + état succès + toggle thème animé ; pas de particules/progress/ETA) ;
remplace l'ancien `D0Configuring`. Animations **Framer Motion** (anneau Meta rotate + `pathLength`,
anneau de fin spring, défilement texte `AnimatePresence`). Roadmap 4 phases : 1) classic ✅ →
2) Supabase (durée = init réel) ✅ → 3) Framer Motion ✅ → 4) setup IA réel en arrière-plan ✅.
**Provisioning réel (Phase 2+4)** : edge function `day0-activation-setup` (prop `onProvision`) → persiste
`day0_payload`, dérive `compute_agent_preferences` (déterministe, déjà consommé par les engines), génère
un brief LLM de personnalisation (`callClaude`), upsert `agent_ai_profiles` (RLS). L'écran ne passe à
l'état succès qu'une fois le provisioning résolu (durée d'affichage min 14s, cap 22s, fallback gracieux).
**Routes dev** (showcase, no auth) : `/dev/mandate-sign`, `/dev/mfa`, `/dev/sentry-test`, `/dev/configuring`, `/dev/activation`.

### Composants (`src/components/`)
- `propertyx/` — atoms Design System Property X (`Px*` : Button, Badge, Icon, Input, Avatar, Logo… — **source de vérité**, ne pas recréer) + `sections/`.
- `megga-x/` — **MEGGA X**, 2ᵉ design system (port 1:1 Webflow de la vitrine), scopé `.megga-x` parallèle à Sugar : `MeggaX` + 12 wrappers `Mx*`, CSS générée `src/styles/megga-x.generated.css`, route dev `/design-system/megga-x`. Règle **zéro-invention** ; résidus de marques Webflow encore présents dans la CSS/fontes. Cf. `megga/design-megga-x`.
- `ui/` — primitives headless + Motion (modal, dialog, Sheet, Toast, Shimmer, popover, tabs…).
- `layout/` — `ProtectedRoute`, `PasswordGate`, `StaleBundleDetector`, `AgentLayout`, `AgentSugarLayout`.
- `crm-sugar/` + `crm-sugar-v3/` — shell CRM, contact detail, KYC (pixel-près), tokens dark.
- `crm-sugar-wizard/` — wizard « Créer un bien » (`/dashboard/listings/new`, `WizardShell` + 10 étapes + `StagingStudio`). **Dark mode** : `SugarV2` (`tokens.ts`) est un **Proxy** qui résout la palette light/dark à chaque lecture depuis `document.documentElement[data-theme]` (pas de mutation de global au render → robuste React 18 StrictMode/concurrent) ; helpers `sgOn()` / `sgAcc()` pour les littéraux posés **sur l'accent** (accent → near-white en dark, `onBlack` → `#0A0A0F`). Stepper retiré du header (nav Précédent/Continuer + compteur `N/8`). Système distinct du wizard KYC (`kyc-wizard/`, `KycPaletteContext`).
- Domaines : `search/` `listings/` `matching/` `transactions/` `kyc*/` `documents/` `calendar/` `messaging/` `portal/` `seller-portal/` `onboarding*/` `admin/` `directory/` `map/` `ai-copilot/` `skeletons/` `auth-bento/`.

### Hooks (`src/hooks/`, ~100, React Query)
Groupés par domaine : **auth** (`useAuth`, `useImpersonate`) · **contacts** (`useContacts`, `useContactsSugar`, `useContactTimeline`…) · **biens** (`useListings`, `useBiensSugar`, `usePropertyEstimation`, `useNeighborhood`, `useNaturalHazards`) · **transactions** (`useTransactions`, `useUpdateTransactionStage`, `usePipelineSugar`) · **KYC** (`useKycDossiers`, `useMarkKycCheck`, `useCreateKycDossier`) · **matching** (`useMatching`, `useExternalMatching`) · **dashboard** (`useTodaySugarKpi`, `useDashboardCockpit/Funnel/Objectif`, `useDashboardAiHint`) · **marketplace** (`useMarketListings`, `useMapPoints`, `useSmartSearchParser`, `useFavorites`, `useSavedSearches`) · **calendrier** (`useCalendarSugar`, `useGoogleCalendar`, `useOutlookCalendar`) · **IA** (`useCopilot`, `useExtractLead`, `useTranslatedDescription`) · **admin** (`useAdminUsers/Agencies/Monitoring/Compliance`, `useAuditLog`, `useAdminLiveFeed`).

> ⚠️ Realtime : **toujours** `useId()` pour le nom de channel (sinon crash au re-mount). Cf. `useAdminLiveFeed`, `useMessaging`, `useAdminNotifications`, `useAgentNotifications` (centre de notif agent réel, dérivé d'`activity_events` non-user).

### lib (`src/lib/`)
`supabase.ts` (client typé, anon key) · `utils.ts` (`formatCHF` → `CHF 720'000`, `formatDate` DD.MM.YYYY, `cn`) · `constants.ts` (CANTONS, types, stages) · `sugarAdapters.ts` (Supabase → vues CRM) · logique métier (`estimation`, `matching`, `kycUtils`, `cantonalTaxRates`, `plans`) · export (`auditPdfExport`, `exportCsv`) · `figma-catalog.ts` (mapping Figma→React) · intégrations (`mapboxClient`, `captcha`, `sentry`, `posthog`).

### i18n
FR (défaut, eager) + DE/EN/IT (lazy). 16 namespaces : `common, dashboard, settings, contacts, pipeline, listings, kyc, messages, calendar, matching, documents, admin, directory, compte, comingSoon, auth`. Switch = overlay shimmer 350ms.

---

## 3. Base de données (Supabase Postgres)

> Détail complet : [schema.md](schema.md). Extensions actives : `pg_cron`, `pg_net`, `citext`, `pgvector`.

### Tables par domaine
- **Tenant & équipes** : `agencies` (root, plan), `profiles` (rôles agent/manager/admin/assistant/seller/buyer), `agency_profiles` / `agent_profiles` (annuaires publics, tsvector), `team_invitations`.
- **Contacts & leads** : `contacts`, `seller_leads`, `contact_scores`.
- **Biens** : `properties` (internes), `listings` (publiées), `market_listings` (~33k Flatfox), `external_listings` (legacy).
- **Pipeline & transactions** : `transactions` (stages lead→…→closed), `crm_offers` (offres/contre-offres ; historique via `parent_offer_id` + audit `activity_events`, pas de table `crm_offers_history`), `visits`, `client_searches`, `matches`.
- **KYC / compliance** : `kyc_cases`, `kyc_checklist_items`, `kyc_magic_links` + `kyc_magic_link_uploads`, `kyc_screening_decisions`, `documents` (sha256, retention).
- **Portail vendeur** : `seller_portals` (token 6 mois), `vendor_dossiers`.
- **Billing** : `subscriptions` (Stripe).
- **Messaging** : `message_threads`, `messages`, `email_messages_cache`, `message_templates`, `marketplace_inquiries`.
- **Favoris/alertes** : `market_favorites`, `market_alerts`, `saved_searches`, `newsletter_subscribers`.
- **Audit & monitoring** : `activity_events` (immutable, `actor_kind` user/system/ai), `auth_events`, `ticket_events`, `platform_metrics`, `flatfox_sync_runs`.
- **Admin** : `admin_feature_flags`, `admin_nps_responses`, `admin_notes`, `admin_changelog`.
- **Support** : `support_tickets`, `ticket_messages`, `ticket_canned_responses`, `chat_conversations`, `chat_messages` — ⚠️ **DORMANTES** depuis le passage à Intercom (support maison décommissionné ; tables conservées, réversibles ; `admin-monitoring` lit encore `open_tickets`→0). Cf. brain `intercom-support`.
- **IA** : `ai_usage_logs`, `ai_balance_snapshots`, `ai_photo_labels`, `ai_generated_photos`, `translation_cache`.

### RLS (modèle agency-first)
- **Agents** : visibilité `WHERE agency_id IN (SELECT agency_id FROM profiles WHERE id = auth.uid())`.
- **Anon (marketplace)** : `market_listings` → `SELECT WHERE status='active'` ; `marketplace_inquiries` / `newsletter_subscribers` → INSERT only.
- **Acheteur authentifié** : ses `message_threads` (`buyer_user_id = auth.uid()`), favoris.
- **Vendeur** : via `seller_portals.token` (stateless, pas d'auth.users) → READ property/transaction, UPLOAD documents.
- **service_role** (edge functions) : full access ; triggers écrivent `activity_events` (`actor_kind='system'`).
- **super_admin** : silo séparé sur `admin_*` + impersonate audité.

### Storage buckets
`documents` (KYC/transac, CRUD par agency) · `property-photos` (write agent, read public si publié) · `avatars` · `kyc-magic-link/{agency}/{link}/…`.

### Vues
`cantonal_price_medians` (median prix/m² par canton×type — badge « bon prix », refresh post-sync).

---

## 4. Pipeline marketplace (Flatfox / market_listings) ⚙️

- **Source** : API Flatfox (location, 33k+ actifs, 26 cantons, 8 types). Aussi RealAdvisor via `market-scraper(-batch)`.
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

## 4bis · Storefront public statique (megga.ch) 🌐

> ⚠️ **PIVOT juin 2026 — recentrage CRM-first.** megga.ch ne sert **plus** la marketplace : il sert
> désormais la **vitrine SaaS** [`sites/megga-vitrine/`](../sites/megga-vitrine/) (landing → CRM `app.megga.ch`).
> Tout l'ancien storefront marketplace Property X décrit ci-dessous est **conservé en sommeil** dans
> [`sites/_marketplace-phase-ulterieure/`](../sites/_marketplace-phase-ulterieure/) (ex-`sites/property-preview/`),
> **rien supprimé**, réactivable en repointant `scripts/overlay-storefront.mjs`. La table `market_listings`
> (~34k biens) **reste active** : elle nourrit le CRM (matching, estimation, stats copilote). La doc
> ci-dessous reste valable pour ce dossier en sommeil (phase ultérieure = Sprint 7).

> **Vitrine (actuelle, megga.ch)** : `sites/megga-vitrine/` — thème Webflow CodeAI X **rebrandé MEGGA**
> (25 pages FR, home « Votre CRM se pilote depuis WhatsApp », logo MEGGA header+footer, assets 100%
> auto-hébergés — 0 CDN). CTA → `app.megga.ch/auth`. Worker minimal (`_worker.js` = Basic Auth
> `megga`/`preview` seul, pas de proxy Supabase). **Reste** : image hero encore CodeAI (à remplacer).

> **Marketplace (en sommeil)** : un site **Webflow Property X V3** statique dans [`sites/_marketplace-phase-ulterieure/`](../sites/_marketplace-phase-ulterieure/), distinct de la SPA React (app.megga.ch, §2). Overlay sur `dist/` au build via `scripts/overlay-storefront.mjs` (`MEGGA_BUILD_TARGET`).

- **Worker** (`_worker.js`, Cloudflare Pages advanced) : Basic Auth (`ai`/`ai`, gate pré-lancement) + proxy GET **`/api/listings`** → `market_listings` / **`/api/agencies`** → `agency_profiles` (anon key côté serveur, évite CORS navigateur) + endpoint **POST `/api/seller-lead`** → insère dans `seller_leads` (cf. « Publier une annonce »).
- **Home** `index.html` : hero (recherche `megga-search.js` + CTA) + section « Annonces en vedette » (`featured-property-item---main`) branchée par `js/megga-home.js` — annonces récentes via `/api/listings`, photo/titre/prix injectés, lien vers la fiche ; force-visible IX2 + sweep du démo, panneaux hover masqués.
- **Grille** `company-pages/properties.html` : peuplée par `js/megga-properties.js` (clone la demo card Webflow, remplit photo/titre/prix/adresse/features ; recherche lieu via `js/megga-supabase.js` + `js/ch-cities.js`). Photos cartes pinnées **4:3** (`object-fit:cover`, fix `megga-card-image-fix`).
- **Fiche bien** `property/luxury-loft-in-san-francisco.html` (cible unique de toutes les cartes, `?id=<uuid>`) : `js/megga-property.js` lit `?id` → fetch `/api/listings` → remplit galerie (image + miniatures + lightbox `w-json`), titre, prix CHF, adresse, détails (m²/pièces/sdb/garage), Description, équipements FR (Piscine/Ascenseur/Garage/Cheminée via `has_*`) ; retire l'agent démo + tout le « Lorem ipsum » ; `referrerpolicy=no-referrer` sur les photos (anti-hotlink Flatfox). Sans `?id` → reste la démo.
- **Annuaire agences** `company-pages/agencies.html` (copie relabellée de la page agents) : `js/megga-agencies.js` → proxy **`/api/agencies`** (worker → `agency_profiles`, ~5662 agences) clone la carte agent, remplit logo (`object-fit:contain` sur fond blanc — pas rogné comme un avatar), nom, ville·canton, lien vers le site de l'agence ; **barre de recherche** (design du hero home), **filtre canton** et **pagination « Charger plus »** (24/page ; **chargement progressif** — 1re page affichée tout de suite, le reste en arrière-plan) ; lien nav « Agences » ajouté (index/properties/agents). Le worker expose un map `API_TABLES { listings→market_listings, agencies→agency_profiles }`.
- **Détail agence** : la page agent-single `agent/john-carter.html?id=<agency_id>` est réutilisée comme fiche agence (`js/megga-agency-single.js`) — hero (logo, nom, ville·canton, site) + **« Annonces de l'agence »** (listings matchés par `agency_profile_id` **OU** `agency_name` ; ~1158 agences / ~20% en ont) ; masque la bio/articles démo, force-visible les sections Webflow IX2 (scopé `<section>`). Les cartes de l'annuaire y mènent.
- **Publier une annonce** `company-pages/submit-property.html` (branché CRM) : `js/megga-submit.js` francise le formulaire Webflow + unités CH (m²/CHF), remplace les `<select>` démo par les types marketplace canoniques (`apartment…land`, `buy/rent`), injecte un select « Délai de vente » (→ `motivation`), puis **intercepte le submit** (capture-phase, neutralise le handler Webflow mort) → **POST `/api/seller-lead`**. Le worker bâtit une ligne `seller_leads` *whitelistée* côté serveur (`property_data` jsonb + `contact_*` + `motivation`, `source='marketplace'`, `status='new'`, `assigned_agency_id=NULL`) et l'insère avec l'anon key (RLS `seller_leads_anon_insert`). **Réception agent** : (1) **CRM « Biens »** → bandeau Soumissions vendeurs (`useBnSubmissions`→`useSellerLeads('new')`, RLS montre les leads non assignés à tout agent), claim via `useAcceptSellerLead` ; (2) **cloche de notifications** (`useAgentNotifications`) en temps réel — un **trigger** `notify_new_seller_lead()` (SECURITY DEFINER, scopé `source='marketplace'`) écrit un `activity_events` (`actor_kind='system'`, `action='seller_lead_received'`, `category='deal'`) car l'anon ne peut pas insérer dans `activity_events` (immuable 10 ans, LBA). Le funnel React `/vendre` (`source='website'`) reste inchangé.
- **Contact** `company-pages/contact-v1.html` (branché CRM) : `js/megga-contact.js` francise le formulaire, corrige le label erroné du message, **injecte une case de consentement obligatoire** (RLS exige `consent_privacy=true`), **retire la colonne démo « Reach us directly »** (Lorem + fausse boîte mail + réseaux sociaux) et centre le formulaire, dé-Lorem le sous-titre + H1 « Contactez-nous », puis intercepte le submit → **POST `/api/contact-message`**. Le worker insère dans **`contact_messages`** (`source='storefront'`, anon RLS `contact_messages_anon_insert`). **Réception** : trigger `notify_new_contact_message()` (SECURITY DEFINER, scopé `source='storefront'`) → `activity_events` `action='contact_message_received'` → **cloche** (super-admins via `super_admin_read_all_events`) ; le message reste lisible en back-office (RLS super_admin). Le funnel React `/contact` (`source='contact_page'`, 2 emails Resend) reste inchangé. Worker mutualisé : helpers `insertRow()` + `readJsonBody()` partagés par `/api/seller-lead` et `/api/contact-message`.
- **Menu « Pages » (nav + footer)** : `js/megga-nav.js` (injecté sur les 18 pages avec nav/footer) réécrit **tous** les liens démo lieu/type/catégorie → la grille **Annonces** réelle (`/company-pages/properties.html?…`). Mapping par texte : `Los Angeles/San Francisco/San Diego` → `?ville=Genève/Lausanne/Zürich` ; `Apartments/Houses/Lofts/Offices` → `?type=apartment/house/commercial/office` (types à inventaire réel — marché **rent-only**, buy≈12) ; `For sale/For rent` → `?transaction=acheter/louer` ; liens génériques (« Par localisation »…) → grille complète. Redirige aussi les 3 pages démo encore existantes (`los-angeles`/`houses`/`for-sale`) en cas d'accès direct. **Plus aucun lien mort (404) ni grille US**. Filtre `type` ajouté à `megga-supabase.js`/`megga-properties.js` (couvert par `idx_ml_active_tx_canton_type`, <1 s).
- **Terminologie** : le storefront dit « **Annonces** » (plus « Biens ») partout — nav, CTA, filtres (« Type d'annonce »), messages JS ; `megga-search.js` matche le label « Type d'annonce ».
- **Limite connue** : section « More properties » de la fiche **masquée** (pas encore peuplée d'annonces similaires). Formulaire de soumission : `canton`/`postalCode` non collectés (l'agent complète au claim). Pages Agents/About/FAQ/Blog encore démo ; pied de page global encore Lorem (anglais).

---

## 5. Edge functions (67) — catalogue par domaine

> Deno, dans `supabase/functions/`. Déclencheurs : HTTP (défaut), `pg_cron`, webhook Stripe, hooks auth.

**`_shared/`** : `ai-provider.ts` (`callClaude` / `callDeepSeek` / `callPublicAI`=DeepSeek seul — pas de wrapper `callAgentAI` ni de fallback ; coût) · `magic-link-token.ts` (HMAC-SHA256) · `photo-vision.ts` (Claude Vision) · `pii-redaction.ts` (scrub AVS/IBAN/passeport avant IA) · `require-agent-auth.ts`.

| Domaine | Functions |
|---|---|
| **IA / copilote** | `ai-copilot` (chat agent + actions, **DeepSeek** deepseek-chat) · `ai-search` (sémantique pgvector) · `dashboard-ai-hint` (Claude) · `parse-search-query` (DeepSeek) |
| **KYC / compliance** | `kyc-screening` (Dilisense PEP/sanctions + analyse Claude) · `kyc-report-data` + `kyc-report-pdf` (rapport KYC PDF par WhatsApp, Cloudflare Browser Rendering REST API — cf. brain `kyc-report-pdf-whatsapp`) · `delete-account` (nLPD art.32) · `log-auth-event` (IP hashée) · `audit-pdf-export` (chaîne hash SHA-256, LBA 10 ans) |
| **Magic link KYC** | `magic-link-create/get/confirm/regenerate/send-email/upload` |
| **Email (Resend)** | `send-email` · `send-property-email` · `send-relance-email` · `send-reminder-email` · `send-team-invite` · `send-visit-email` · `detect-new-device` |
| **Paiements (Stripe)** | `stripe-checkout` · `stripe-portal` · `stripe-webhook` (signature) · `admin-stripe-metrics` (MRR/ARR/churn) |
| **Monitoring** | `admin-monitoring` (cron) · `ai-billing-monitor` (cron, balance DeepSeek) · `weekly-report` (cron) |
| **Calendrier** | `google-calendar-sync` · `outlook-calendar-sync` (OAuth) |
| **Marketplace / scraping** | `flatfox-sync` (cron) · `market-scraper(-batch)` · `external-matching` |
| **Matching / scoring** | `matching-engine` · `score-engine` (contact/property/marché) · `search-alert` (cron) |
| **Documents / media** | `extract-lead` · `extract-property-pdf` · `extract-property-url` · `photo-labeler` (Vision) · `photo-processor` (R2) · `backfill-cf-images` · `c2pa-sign` / `c2pa-verify` |
| **Media IA** | `public-staging` (Gemini, rate-limit IP) · `virtual-staging` (garde-fous LPD : Vision gate + quota plan) |
| **Divers** | `translate-on-demand` (DeepSeek + cache) · `deepgram-token` / `speech-to-text` · `intercom-identity` (JWT Messenger Security Intercom) · `accept-team-invite` · `automation-engine` (cron) · `webhooks` |

**Crons pg_cron** : `flatfox-sync-daily` (04:00 UTC), `platform-metrics-hourly` (`15 * * * *`), + automation-engine / ai-billing-monitor / weekly-report / search-alert.

**Auth cron→edge (service-key)** : les crons s'authentifient via `Bearer app_config.service_role_key`, qui DOIT égaler l'env edge `SUPABASE_SERVICE_ROLE_KEY` (format `sb_secret_…`, **jamais** le JWT legacy du dashboard). Edge `sync-service-key` (`--no-verify-jwt`, garde `x-sync-token`) recopie env→table ; resync **manuel** (cron horaire + wrapper SQL pas encore en prod). Symptôme d'une clé périmée : crons en 401, 0 match. `get_app_config` non exposée à anon. Cf. `megga/service-key-self-heal`.

**Révocation de session** (Réglages > Sécurité) : `revoke-device-session` (`--no-verify-jwt`) → RPC `revoke_user_session` (SECURITY DEFINER, DELETE `auth.sessions`) coupe le refresh distant ; `user_devices.session_id` lié par `detect-new-device`. L'access token déjà émis reste valide jusqu'à son exp (~1h). Cf. `megga/settings-session-revocation`.

**Secrets par service** : `ANTHROPIC_API_KEY` (8 fn IA) · `DEEPSEEK_API_KEY` · `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` · `RESEND_API_KEY` · `DILISENSE_API_KEY` · `GOOGLE_AI_API_KEY` · `DEEPGRAM_API_KEY` · `GOOGLE_/MICROSOFT_CLIENT_*` · R2 (`CF_ACCOUNT_ID`, `R2_*`).

---

## 6. Flux end-to-end (les rouages) 🔧

**A · Sync → marketplace** : `pg_cron` 04:00 → `flatfox-sync` → UPSERT `market_listings` (photos→R2, quality/relevance) → RLS anon `status='active'` → `/rent` via `useMarketListings` (partial index) → `/listing/:id` → `marketplace_inquiries` → contact.

**B · Contact → pipeline → closing** : lead (import IA / web / portal) → `contacts` → qualif (score) → `visits` → offres (`crm_offers` + contre-offres, trigger audit) → `transactions` stages (lead→qualified→visit→offer→negotiation→reserved→financing→notary→signed→closed) → gate KYC (LBA art.7, **warn non bloquant**, revu MLRO) → closing + `activity_events` complet.

**C · Portail vendeur (token)** : agent crée `seller_portals` (token 6 mois) → vendeur `/portal/:token` (sans login) → **page unique « Votre vente »** (`VotreVentePage` + `components/seller-portal/votre-vente/`, Sugar Pure, lecture seule ; remplace l'ancien mini-CRM 8 pages) → RLS via token (READ property/transac, UPLOAD documents) → updates visibles côté CRM → expiry révoque. Décisions d'offre + paramètres : edge function `seller-portal-action` (token validé, `--no-verify-jwt`) → `offer_decision` journalise un `activity_event` (`actor_kind='system'`) **transmis à l'agent** (jamais de mutation directe `crm_offers`/`transactions`) ; `save/get_preferences` → table `seller_preferences`.

**D · KYC (Dilisense)** : transaction reserved/negotiation → `kyc_cases` (vigilance standard/renforcée selon montant + source des fonds) → magic link upload (`kyc_magic_link_uploads`, OCR, sha256) → screening async Dilisense → `kyc_screening_decisions` (PEP/sanctions) → **revue humaine MLRO** → analyse qualitative Claude (assist, ne remplace pas). **Canal WhatsApp (Phase 1 livrée, cf. brain `kyc-whatsapp-spec`)** : l'agent ouvre/joint/screene depuis sa conversation via 3 outils copilote (`open_kyc_case`, `attach_kyc_document`, `run_kyc_screening`) ; même moteur, le MLRO valide toujours (jamais `is_completed`/`verified` côté IA). **Rapport KYC en PDF par WhatsApp (livré, cf. brain `kyc-report-pdf-whatsapp`)** : `send_kyc_report` (tier auto) → edge `kyc-report-pdf` mint un token HMAC court → Cloudflare Browser Rendering (REST API, pas de Worker) rend la route publique `/kyc-report/:token` (même template `PdfPage1/2/3` que le CRM) → PDF officiel uploadé en média Meta éphémère et envoyé en document **qu'à l'agent** ; lecture seule (seul write = audit `kyc_report_sent`), aucune migration.

**E · Matching & alertes** : `client_searches` (criteria JSONB) → `matching-engine` compare budget/zones/type vs `market_listings`+`properties` → `matches` (score+raisons, dédup dure par couple contact×bien) → **Atelier Matching** (triptyque plein écran, gestes `E/X/P/R/V`) : Envoyer = deal `new_lead` (créé/rattaché, `transactions.market_listing_id` si bien de veille) + timeline contact (`dossier_envoye`) + reminder +5 j (→ Aujourd'hui, dédup avec `automation-engine`) + `send-property-email` ; Relancer = `sent_at` reset + reminder repoussé + `send-relance-email` ; Plus tard = `snoozed_until`+7 j + reminder custom à échéance ; Écarter = `ignored` (jamais re-proposé) ; Visite = bascule `/dashboard/visits/new` (bien interne). Écritures différées 4,5 s (undo toast avant toute écriture). Alertes email publiques (`market_alerts`/`search-alert` cron via Resend) inchangées.

**F · Audit trail** : tout changement (transaction/KYC/offre/property) → triggers `SECURITY DEFINER` → `activity_events` immutable (actor_id+kind, severity, category, metadata) → timeline contact + audit super-admin + export PDF signé (chaîne de hash).

**G · Monitoring** : `pg_cron` → `admin-monitoring` → `platform_metrics` → `AdminMonitoringPage` (historique 30j) + feature flags.

---

## 6bis · Agent WhatsApp (feature phare #2 — Phase 1) 📱

Vision : l'agent est toujours sur WhatsApp → chaque message remonte dans le CRM (mieux qu'une app). Phase 1 = **miroir entrant lecture seule**.

- **Archi** : abstraction `_shared/whatsapp-gateway.ts` (`WhatsAppProvider`). Phase 1 = **OpenWA** (proto local) ; Phase 4 = **Meta Cloud API**. Webhook signé **HMAC-SHA256** (`verifyHmac` timing-safe), provider détecté par header (`x-openwa-signature` / `x-hub-signature-256`).
- **Inbound** (`whatsapp-webhook`) : message → vérif HMAC (401 sinon) → parse gateway → map `wa_from` → `contacts.phone` (9 derniers chiffres) → INSERT idempotent `whatsapp_messages` (`UNIQUE(provider, provider_message_id)`) → `activity_events` (best-effort) → 200.
- **Données** : `whatsapp_messages` (provider, direction, wa_from/to, contact_id, agency_id, body, media_*, status, `raw` à purger Ph.4) ; `contact_messages` (form public `/contact`). RLS : un agent ne voit que son agence (`get_my_agency_id()`), non-mappés réservés super_admin (test `whatsapp-messages-rls.spec.ts`).
- **CRM** : `useWhatsAppMessages(contactId)` → `CdWhatsAppCard` (bulles + transcript notes vocales) dans `ContactDetailSugarV3Page` ; `PxWhatsAppButton` (lien `wa.me`) + page publique `/contact`. **Compréhension MEGGA visible (4 juin 2026)** : `CdConversationInsight` affiche résumé/intention/sentiment/critères/engagements/prochaine action depuis `whatsapp_conversation_insights` (lecture seule, cadre assistance/estimation).
- **Roadmap** : Ph.2 outbound + **conseils IA façon Claude** + actions (« je veux visiter » → visite CRM) ; Ph.3 sync temps réel ; Ph.4 Meta Cloud API + purge `raw`. Secrets : `WHATSAPP_WEBHOOK_SECRET`, `META_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_PROVIDER`.

---

## 7. Compliance (Suisse) 🇨🇭

- **LAB/KYC (LBA)** : `kyc_cases` vigilance standard/renforcée, source des fonds (crypto/mixte → description ≥20 car. requise), screening PEP/sanctions Dilisense, **validation humaine MLRO obligatoire**, rétention 10 ans.
- **nLPD/LPD** : `activity_events` immutable, `retention_until`, droit à l'effacement (`delete-account`), redaction PII **avant** tout appel IA (`_shared/pii-redaction.ts`), IP hashées (salt quotidien).
- **Intégrité média** : C2PA Content Credentials (`c2pa-sign`/`verify`) sur photos IA.
- **IA responsable** : présentée comme « assistance/estimation » (jamais « automatique/garantie »), human-in-the-loop sur KYC + envoi client.

---

## 8. Dev / test / CI

```
npm run dev          # vite (localhost:5173)
npm run build        # tsc -b && vite build  (+ postbuild overlay-storefront)
npm run lint         # eslint
npm run test:unit    # vitest   ·  test:backend  ·  test:e2e (playwright: ai/admin/visual)
```
CI/CD : push `main` → GitHub Actions → Cloudflare Pages + Supabase edge auto-deploy.
Prod `megga.ch` actuellement **password-gated** (Basic Auth `realm="MEGGA — accès restreint"`, pré-lancement).

---

## 9. Index des docs

| Doc | Contenu |
|---|---|
| [CLAUDE.md](../CLAUDE.md) | Source de vérité : règles, conventions, design, perf, état d'implémentation |
| [schema.md](schema.md) | Schéma DB complet |
| [pages.md](pages.md) | 42 écrans MVP |
| [ai-modules.md](ai-modules.md) | Specs modules IA |
| [design-system.md](design-system.md) / [design-system-propertyx.md](design-system-propertyx.md) | Design systems CRM / marketplace |
| [roadmap.md](roadmap.md) · [backlog.md](backlog.md) · [CHANGELOG.md](CHANGELOG.md) | Planning & historique |
