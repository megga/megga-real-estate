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
(≈113 entrées curées) forment le « cerveau système » de MEGGA. Il est **durable** (committé dans git),
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

> ⚠️ **Fiabilité** : les entrées reflètent le code à leur date d'écriture. En cas de doute, le **code
> fait foi** — re-vérifier puis corriger le seed. Plusieurs entrées portent des `NUANCE`/`ATTENTION`
> issues d'un audit factuel ; les garder à jour.

---

## 0. En une phrase

SaaS immobilier suisse **AI-native, compliance-first** : marketplace publique (33k+ biens
Flatfox) + CRM transactionnel agent + pipeline LAB/KYC + portail vendeur + copilote IA +
super-admin. Stack React/Vite (Cloudflare Pages) + Supabase (Postgres, 57 edge functions,
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
| **Marketplace publique** | `/buy` `/rent` `/listing/:id` | `SearchPage` (filtres, favoris, carte Mapbox lazy, comparateur), `ListingPage` |
| **Marketing public** | `/about` `/sell` `/estimates` `/services` `/agencies` `/agents` `/help*` | pages secondaires + centre d'aide |
| **Compte visiteur** | `/account` | favoris, recherches sauvegardées, messagerie acheteur |
| **KYC self-service** | `/kyc/:token` | `KycPublicPage` (parcours sans compte, magic link) |
| **Portail vendeur** | `/portal/:token/*` (+ `/portal` dev) | `PortalGateway` — dossier, visites, offres, documents, analytics |
| **CRM agent** | `/dashboard/*` | voir ci-dessous |
| **Super-admin** | `/dashboard/admin/*` | 14 pages (accent violet), `SuperAdminGuard` |

**CRM agent** (layout `AgentSugarLayout`, dark CRM) — pages principales :
`dashboard` (TodaySugar, KPI) · `pipeline` (deals par stage) · `contacts` (+ `/:id` détail) ·
`listings` (+ `/:id`, `/new` wizard, `/:id/edit`) · `transactions/:id` (stepper 8 étapes + bannière KYC + offres) ·
`matching` · `journey` · `calendar` (Google/Outlook) · `documents` (+ generate/templates) ·
`kyc` (+ `/:dossierId`, `/export` PDF) · `network` · `audit` (journal nLPD) · `analytics` · `settings`.

**Onboarding** : `/dashboard/onboarding` (wizard) → `/dashboard/premier-jour` (calibrage IA one-shot).
Flux `PremierJourShell` : `welcome → q0..q3 → synthesis → configuring → today`. La phase `configuring`
rend **`D0Activation`** (écran d'activation IA « atterrissage » grand format, épuré : anneau Meta +
phrases pilotées par les réponses + état succès + toggle thème animé ; pas de particules/progress/ETA) ;
remplace l'ancien `D0Configuring`. Animations **Framer Motion** (anneau Meta rotate + `pathLength`,
anneau de fin spring, défilement texte `AnimatePresence`). Roadmap 4 phases : 1) classic ✅ →
2) Supabase (durée = init réel) → 3) Framer Motion ✅ → 4) setup IA réel en arrière-plan.
**Routes dev** (showcase, no auth) : `/dev/mandate-sign`, `/dev/mfa`, `/dev/sentry-test`, `/dev/configuring`, `/dev/activation`.

### Composants (`src/components/`)
- `propertyx/` — atoms Design System Property X (`Px*` : Button, Badge, Icon, Input, Avatar, Logo… — **source de vérité**, ne pas recréer) + `sections/`.
- `ui/` — primitives headless + Motion (modal, dialog, Sheet, Toast, Shimmer, popover, tabs…).
- `layout/` — `ProtectedRoute`, `PasswordGate`, `StaleBundleDetector`, `AgentLayout`, `AgentSugarLayout`.
- `crm-sugar/` + `crm-sugar-v3/` — shell CRM, contact detail, KYC (pixel-près), tokens dark.
- Domaines : `search/` `listings/` `matching/` `transactions/` `kyc*/` `documents/` `calendar/` `messaging/` `portal/` `seller-portal/` `onboarding*/` `admin/` `directory/` `map/` `ai-copilot/` `skeletons/` `auth-bento/`.

### Hooks (`src/hooks/`, ~100, React Query)
Groupés par domaine : **auth** (`useAuth`, `useImpersonate`) · **contacts** (`useContacts`, `useContactsSugar`, `useContactTimeline`…) · **biens** (`useListings`, `useBiensSugar`, `usePropertyEstimation`, `useNeighborhood`, `useNaturalHazards`) · **transactions** (`useTransactions`, `useUpdateTransactionStage`, `usePipelineSugar`) · **KYC** (`useKycDossiers`, `useMarkKycCheck`, `useCreateKycDossier`) · **matching** (`useMatching`, `useExternalMatching`) · **dashboard** (`useTodaySugarKpi`, `useDashboardCockpit/Funnel/Objectif`, `useDashboardAiHint`) · **marketplace** (`useMarketListings`, `useMapPoints`, `useSmartSearchParser`, `useFavorites`, `useSavedSearches`) · **calendrier** (`useCalendarSugar`, `useGoogleCalendar`, `useOutlookCalendar`) · **IA** (`useCopilot`, `useExtractLead`, `useTranslatedDescription`) · **admin** (`useAdminUsers/Agencies/Monitoring/Compliance`, `useAuditLog`, `useAdminLiveFeed`).

> ⚠️ Realtime : **toujours** `useId()` pour le nom de channel (sinon crash au re-mount). Cf. `useAdminLiveFeed`, `useMessaging`, `useAdminNotifications`.

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
- **Pipeline & transactions** : `transactions` (stages lead→…→closed), `crm_offers` + `crm_offers_history` (offres/contre-offres, audit), `visits`, `client_searches`, `matches`.
- **KYC / compliance** : `kyc_cases`, `kyc_checklist_items`, `kyc_magic_links` + `kyc_magic_link_uploads`, `kyc_screening_decisions`, `documents` (sha256, retention).
- **Portail vendeur** : `seller_portals` (token 6 mois), `vendor_dossiers`.
- **Billing** : `subscriptions` (Stripe).
- **Messaging** : `message_threads`, `messages`, `email_messages_cache`, `message_templates`, `marketplace_inquiries`.
- **Favoris/alertes** : `market_favorites`, `market_alerts`, `saved_searches`, `newsletter_subscribers`.
- **Audit & monitoring** : `activity_events` (immutable, `actor_kind` user/system/ai), `auth_events`, `ticket_events`, `platform_metrics`, `flatfox_sync_runs`.
- **Admin** : `admin_feature_flags`, `admin_nps_responses`, `admin_notes`, `admin_changelog`.
- **Support** : `support_tickets`, `ticket_messages`, `ticket_canned_responses`.
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

## 5. Edge functions (57) — catalogue par domaine

> Deno, dans `supabase/functions/`. Déclencheurs : HTTP (défaut), `pg_cron`, webhook Stripe, hooks auth.

**`_shared/`** : `ai-provider.ts` (Claude/DeepSeek + fallback + coût) · `magic-link-token.ts` (HMAC-SHA256) · `photo-vision.ts` (Claude Vision) · `pii-redaction.ts` (scrub AVS/IBAN/passeport avant IA) · `require-agent-auth.ts`.

| Domaine | Functions |
|---|---|
| **IA / copilote** | `ai-copilot` (chat agent + actions, Claude) · `ai-search` (sémantique pgvector) · `dashboard-ai-hint` · `parse-search-query` (DeepSeek) · `support-chatbot` |
| **KYC / compliance** | `kyc-screening` (Dilisense PEP/sanctions + analyse Claude) · `delete-account` (nLPD art.32) · `log-auth-event` (IP hashée) · `audit-pdf-export` (chaîne hash SHA-256, LBA 10 ans) |
| **Magic link KYC** | `magic-link-create/get/confirm/regenerate/send-email/upload` |
| **Email (Resend)** | `send-email` · `send-property-email` · `send-relance-email` · `send-reminder-email` · `send-team-invite` · `send-visit-email` · `detect-new-device` |
| **Paiements (Stripe)** | `stripe-checkout` · `stripe-portal` · `stripe-webhook` (signature) · `admin-stripe-metrics` (MRR/ARR/churn) |
| **Monitoring** | `admin-monitoring` (cron) · `ai-billing-monitor` (cron, balance DeepSeek) · `weekly-report` (cron) |
| **Calendrier** | `google-calendar-sync` · `outlook-calendar-sync` (OAuth) |
| **Marketplace / scraping** | `flatfox-sync` (cron) · `market-scraper(-batch)` · `external-matching` |
| **Matching / scoring** | `matching-engine` · `score-engine` (contact/property/marché) · `search-alert` (cron) |
| **Documents / media** | `extract-lead` · `extract-property-pdf` · `extract-property-url` · `photo-labeler` (Vision) · `photo-processor` (R2) · `backfill-cf-images` · `c2pa-sign` / `c2pa-verify` |
| **Media IA** | `public-staging` (Gemini, rate-limit IP) · `virtual-staging` (garde-fous LPD : Vision gate + quota plan) |
| **Divers** | `translate-on-demand` (DeepSeek + cache) · `deepgram-token` / `speech-to-text` · `ticket-ai-reply` · `accept-team-invite` · `automation-engine` (cron) · `webhooks` |

**Crons pg_cron** : `flatfox-sync-daily` (04:00 UTC), `platform-metrics-hourly` (`15 * * * *`), + automation-engine / ai-billing-monitor / weekly-report / search-alert.

**Secrets par service** : `ANTHROPIC_API_KEY` (8 fn IA) · `DEEPSEEK_API_KEY` · `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` · `RESEND_API_KEY` · `DILISENSE_API_KEY` · `GOOGLE_AI_API_KEY` · `DEEPGRAM_API_KEY` · `GOOGLE_/MICROSOFT_CLIENT_*` · R2 (`CF_ACCOUNT_ID`, `R2_*`).

---

## 6. Flux end-to-end (les rouages) 🔧

**A · Sync → marketplace** : `pg_cron` 04:00 → `flatfox-sync` → UPSERT `market_listings` (photos→R2, quality/relevance) → RLS anon `status='active'` → `/rent` via `useMarketListings` (partial index) → `/listing/:id` → `marketplace_inquiries` → contact.

**B · Contact → pipeline → closing** : lead (import IA / web / portal) → `contacts` → qualif (score) → `visits` → offres (`crm_offers` + contre-offres, trigger audit) → `transactions` stages (lead→qualified→visit→offer→negotiation→reserved→financing→notary→signed→closed) → gate KYC (LBA art.7, **warn non bloquant**, revu MLRO) → closing + `activity_events` complet.

**C · Portail vendeur (token)** : agent crée `seller_portals` (token 6 mois) → vendeur `/portal/:token` (sans login) → RLS via token (READ property/transac, UPLOAD documents) → updates visibles côté CRM → expiry révoque.

**D · KYC (Dilisense)** : transaction reserved/negotiation → `kyc_cases` (vigilance standard/renforcée selon montant + source des fonds) → magic link upload (`kyc_magic_link_uploads`, OCR, sha256) → screening async Dilisense → `kyc_screening_decisions` (PEP/sanctions) → **revue humaine MLRO** → analyse qualitative Claude (assist, ne remplace pas).

**E · Matching & alertes** : `client_searches` (criteria JSONB) → `matching-engine` compare budget/zones/type vs `market_listings`+`properties` → `matches` (score+raisons) → envoi agent → alertes email (`market_alerts`/`search-alert` cron via Resend).

**F · Audit trail** : tout changement (transaction/KYC/offre/property) → triggers `SECURITY DEFINER` → `activity_events` immutable (actor_id+kind, severity, category, metadata) → timeline contact + audit super-admin + export PDF signé (chaîne de hash).

**G · Monitoring** : `pg_cron` → `admin-monitoring` → `platform_metrics` → `AdminMonitoringPage` (historique 30j) + feature flags.

---

## 6bis · Agent WhatsApp (feature phare #2 — Phase 1) 📱

Vision : l'agent est toujours sur WhatsApp → chaque message remonte dans le CRM (mieux qu'une app). Phase 1 = **miroir entrant lecture seule**.

- **Archi** : abstraction `_shared/whatsapp-gateway.ts` (`WhatsAppProvider`). Phase 1 = **OpenWA** (proto local) ; Phase 4 = **Meta Cloud API**. Webhook signé **HMAC-SHA256** (`verifyHmac` timing-safe), provider détecté par header (`x-openwa-signature` / `x-hub-signature-256`).
- **Inbound** (`whatsapp-webhook`) : message → vérif HMAC (401 sinon) → parse gateway → map `wa_from` → `contacts.phone` (9 derniers chiffres) → INSERT idempotent `whatsapp_messages` (`UNIQUE(provider, provider_message_id)`) → `activity_events` (best-effort) → 200.
- **Données** : `whatsapp_messages` (provider, direction, wa_from/to, contact_id, agency_id, body, media_*, status, `raw` à purger Ph.4) ; `contact_messages` (form public `/contact`). RLS : un agent ne voit que son agence (`get_my_agency_id()`), non-mappés réservés super_admin (test `whatsapp-messages-rls.spec.ts`).
- **CRM** : `useWhatsAppMessages(contactId)` → `CdWhatsAppCard` (bulles) dans `ContactDetailSugarV3Page` ; `PxWhatsAppButton` (lien `wa.me`) + page publique `/contact`.
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
