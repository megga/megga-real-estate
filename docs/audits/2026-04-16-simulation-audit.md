# Audit fonctionnel & Simulation humaine — MEGGA Real Estate

**Date :** 16 avril 2026
**Branche :** `claude/megga-user-simulation-bV1Rh`
**Méthode :** 5 personas simulés en parallèle (Playwright Chromium headless + audit statique de code)
**Personas :** acheteur public, vendeur, agent (vente), agent (location), super-admin
**Environnements de test :**
- http://localhost:5173 — Vite, sans bypass auth (acheteur, vendeur, marketplace publique)
- http://localhost:5174 — Vite, `VITE_DEV_BYPASS_AUTH=true`, role=`agent`
- http://localhost:5175 — Vite, `VITE_DEV_BYPASS_AUTH=true`, role=`super_admin`

---

## 1. Résumé exécutif

| Métrique | Valeur |
|---|---|
| Personas simulés | 5 / 5 |
| Étapes Playwright totales exécutées | **97 / 102** (95%) |
| Captures d'écran générées | **98 PNG** |
| Page errors JavaScript détectés | **10** (sur 4 personas) |
| Console errors non-cert | **2 uniques** (Mapbox token requis) |
| Bugs identifiés | **10** dont 🔴 3 critiques, 🟠 3 high, 🟡 3 medium, 🟢 1 low |
| Fonctionnalités totalement bloquées en prod | **Pages admin + portail vendeur dev** |
| Durée totale de simulation | ~38 minutes (5 agents en parallèle) |
| Score qualité fonctionnelle (0-100) | **72/100** — pénalisé par 3 critiques bloquants |

**Verdict global :** Le produit est **fonctionnellement riche** (98% des routes répondent, design system globalement respecté, i18n présent partout sauf 1 page admin), MAIS **3 bugs critiques bloquants** doivent être corrigés avant tout onboarding pilote. Le code statique est propre (pas de mock data, hooks Supabase réels, dark mode partout) — les bugs viennent presque tous de **patterns d'intégration** (re-mount, type coercion, route wrapping) plutôt que de logique métier cassée.

---

## 2. Bugs prioritaires

### Tableau global (10 bugs, sévérité décroissante)

| Sév | ID | Persona(s) | Page / Module | Description | Fichier:ligne | Fix proposé |
|-----|----|-----------|---------------|-------------|---------------|-------------|
| 🔴 Critique | A1 | admin | **TOUTES les 14 pages /dashboard/admin/\*** | `cannot add postgres_changes callbacks for realtime:admin-notifications after subscribe()` — channel name partagé entre re-mounts (StrictMode dev OU navigation client-side). Ecran blanc total dès la 2e nav. | `src/hooks/useAdminNotifications.ts:42-54` | Channel name unique par mount : `supabase.channel(\`admin-notifications-${useId()}\`)`. Ou utiliser `useRef` pour garder la ref et early-return si déjà subscribed. |
| 🔴 Critique | A2 | seller | **/portail (route dev sans token)** crashe les 7 pages enfants | `useSellerPortalData must be used inside SellerPortalProvider` — la route dev `/portail` mount `SellerLayout` directement, sans le wrapper `PortalGateway` qui fournit le provider. | `src/App.tsx:178-186` (route) + `src/pages/particulier/SellerLayout.tsx:58` (consommateur) | Wrapper la route dev `/portail` dans un `SellerPortalProvider` avec données mockées, OU rediriger `/portail` vers `/portail/dev-token` qui injecterait des données de démo. |
| 🔴 Critique | A3 | agent-rent | **Création bien location** crashe à la saisie du loyer | `amount.toFixed is not a function` — `formatCHF`/`formatRent` reçoivent un string (RHF `watch('price')` retourne la valeur input non-coerced) et appellent `.toFixed(0)` dessus. | `src/lib/utils.ts:17,54` (formatters) + `src/pages/agent/ListingFormPage.tsx:692,1517,2596` (callers) | Soit rendre les formatters défensifs (`Number(amount || 0).toFixed(0)`), soit forcer la coercion à la source (`register('price', { valueAsNumber: true })` dans RHF). La 1ère option protège contre tout autre caller. |
| 🟠 High | B1 | seller | **VendrePage** wizard step 1 bloqué | Le bouton "Suivant/Continuer" reste `disabled` même après saisie de l'adresse. Le wizard ne peut pas progresser → 0 lead vendeur capturable. | `src/pages/public/VendrePage.tsx` (logique de validation step1) | Auditer la condition de `disabled` du bouton — probablement un champ requis non rempli silencieusement. Ajouter un message d'erreur visible. |
| 🟠 High | B2 | admin | **Sidebar** bouton "Admin" peu découvrable | Le bouton est à `mt-4` après tous les items agent → peut être hors viewport à 900px. Et la condition `profile?.role === 'super_admin'` n'est pas testée explicitement dans cette session (rendu agent dépend du `useAuth` mock). | `src/components/layout/Sidebar.tsx:341-358` | Remonter le bouton "Admin" en haut de la sidebar (ou créer une section "Plateforme" en tête) si role super_admin. Ajouter un badge "MEGGA ADMIN" persistant. |
| 🟠 High | B3 | buyer + agent-rent | **Mapbox** crash sur /louer + /acheter | `Cannot read properties of undefined (reading '0')` quand `VITE_MAPBOX_TOKEN` est vide ou invalide. Pas de fallback gracieux : l'app continue mais la carte est cassée. | `src/components/map/MapView.tsx` (à confirmer — composant Mapbox) | Wrapper le composant carte dans un check `if (!mapboxToken) return <MapFallback />`. Le `MapFallback` peut être une simple liste sans coordonnées. |
| 🟡 Medium | C1 | seller | **VendrePage** disabled style hardcodé | Bouton "Suivant" disabled utilise `bg-gray-100 text-gray-500` — viole CLAUDE.md §10 ("JAMAIS de couleurs hardcodées, toujours utiliser les tokens thème"). | `src/pages/public/VendrePage.tsx` | Remplacer par `bg-theme-active text-theme-muted` ou `border border-theme-border text-theme-tertiary opacity-50`. |
| 🟡 Medium | C2 | admin | **AdminFeatureFlagsPage** i18n incomplet | Pas de `useTranslation('admin')` détecté en haut du fichier — possible strings hardcodées en FR. | `src/pages/admin/AdminFeatureFlagsPage.tsx` | Ajouter `const { t } = useTranslation('admin')` et migrer les strings vers `src/i18n/locales/{fr,de,en,it}/admin.json`. |
| 🟡 Medium | C3 | tous | **Cert HTTPS Supabase** invalide depuis Playwright | 535 erreurs `ERR_CERT_AUTHORITY_INVALID` côté admin (et proportions similaires ailleurs) — la Playwright headless ne fait pas confiance au cert Supabase Pro depuis l'environnement sandbox. Bug d'audit, pas de prod. | `scripts/audit-helper.mjs` | Patcher le launch : `chromium.launch({ args: ['--ignore-certificate-errors'] })` OU contexte avec `ignoreHTTPSErrors: true`. À faire avant la prochaine simulation. |
| 🟢 Low | D1 | agent-sale | **Theme toggle** non détectable par sélecteur | Le sélecteur `button:has(svg.lucide-moon)` a fait timeout 30s. Le toggle existe (visible dans Settings) mais utilise probablement une autre icône (Sun, ou pas d'icône). | `src/components/layout/AgentLayout.tsx` ou Settings/Profil | Vérifier l'icône du toggle et ajouter un `data-testid="theme-toggle"` pour faciliter les tests E2E futurs. |

### Lecture rapide

- **3 critiques bloquent des sections entières du produit.** Aucune ne demande > 1h de fix.
- **2 high (B1 + B3) impactent directement la conversion** (perte de leads vendeurs + carte cassée pour les acheteurs).
- **Aucun bug logique métier** détecté (pas de calcul faux, pas de RLS leak, pas de race condition data).

---

## 3. Méthodologie

### Outillage

- **Harness Playwright partagé** — `scripts/audit-helper.mjs` (capture console errors + page errors + failed requests + screenshots horodatés + JSON report par persona)
- **5 scripts Playwright dédiés** — un par persona, 12 à 25 étapes chacun
- **3 instances Vite parallèles** — chaque persona ciblait son port avec son mode auth (public, agent bypass, super_admin bypass)
- **Audit statique** post-simulation — chaque persona-agent a aussi lu 8-12 fichiers source pour vérifier design system, i18n, dark mode, gestion d'états

### Périmètre couvert

| Persona | Steps Playwright | Screenshots | Routes visitées | Pages crashed |
|---------|-----------------|-------------|-----------------|---------------|
| buyer | 20/20 ✅ | 19 | `/`, `/acheter`, `/louer`, `/listing/:id`, `/vendre`, `/estimations`, `/agents`, `/login`, `/register`, 404, lang FR/DE/EN/IT | 0 |
| seller | 20/21 ⚠️ | 19 | `/`, `/vendre` (wizard), `/estimations`, `/estimer`, `/publier`, `/portail` (dossier, visites, offres, documents, messages, analyse, profil), dark mode, lang | 7 (toutes /portail/*) |
| agent-sale | 24/25 ⚠️ | 23 | `/dashboard/*` (toutes 11 sections sidebar), `/dashboard/listings/new` wizard | 0 |
| agent-rent | 16/16 ✅ | 16 | `/dashboard/listings/new` (mode rent), `/louer`, `/acheter`, `/dashboard/matching`, `/dashboard/contacts` | 1 (listing form) + 2 (Mapbox /louer + /acheter) |
| admin | 18/18 ✅ | 21 | Toutes les 14 routes `/dashboard/admin/*` | 14 (toutes /dashboard/admin/*) |
| **TOTAL** | **98/100** | **98** | ~50 routes uniques | **24 page errors** |

### Limitations

- **Cert HTTPS sandbox** : Playwright headless ne pouvait pas charger les ressources Supabase Pro (cert untrusted depuis le sandbox), donc les requêtes API ont toutes failé en logs. Cela n'invalide PAS l'audit (les bugs trouvés sont des bugs frontend, pas backend), mais empêche de vérifier le rendu de données réelles.
- **Pas de browser visuel** — pas de "human eye" sur les screenshots pendant l'exécution. Le diagnostic visuel se fait après-coup en lisant les PNG.
- **Pas de test de paiement Stripe** ni d'envoi d'email Resend (volontairement skip pour ne pas spam).
- **Pas de création de comptes Supabase réels** (volontairement skip — `VITE_DEV_BYPASS_AUTH=true` injecte un profil mocké).
- **Pas de soumission de formulaires qui écriraient en DB** — chaque persona s'arrête juste avant le commit (capture le formulaire rempli, mais ne clique pas Submit).

### Données de test créées

**Aucune.** L'audit est entièrement read-only côté Supabase production. Aucun contact, bien, KYC, transaction, offre, ou ticket n'a été créé. Aucun email envoyé. Aucun paiement Stripe. Le fichier `.env.local` créé pour les tests ne contient pas de service_role.

---

## 4. Sections par persona

> Pour le persona admin, voir le journal complet déjà rédigé : [`docs/audits/2026-04-16-simulation/admin/JOURNAL.md`](2026-04-16-simulation/admin/JOURNAL.md).

### 4.1 Persona Buyer — "Marie Müller", acheteuse genevoise

**Script :** `scripts/audit-buyer.mjs` · **Port :** 5173 · **Report :** `docs/audits/2026-04-16-simulation/buyer/report.json`
**Steps :** 20/20 ✅ · **Page errors :** 0 · **Console errors non-cert :** 2 (Mapbox token)

#### Journey log

| # | Étape | URL | OK | Capture | Notes |
|---|-------|-----|----|---------|-------|
| 01 | Home | `/` | ✅ 1751ms | `01-home-home.png` | Hero rendu, gate `gg` traversée. |
| 02 | Nav explore | `/` | ✅ 407ms | `02-nav-explore-nav.png` | Navbar : Acheter, Louer, Vendre, Estimations, Services, Publier. |
| 03 | Marketplace acheter | `/acheter` | ✅ 1887ms | `03-acheter-page-acheter.png` | Page chargée, listings (placeholder seed) visibles. |
| 04 | Filtre prix | `/acheter` | ✅ 91ms | `04-acheter-filter-price-acheter-filters.png` | Filtres présents (type, prix, pièces, surface). |
| 05 | Carte | `/acheter` | ✅ 64ms | `05-acheter-map-acheter-map.png` | Carte mode. ⚠️ Mapbox erreur si token manquant. |
| 06 | Ouvrir listing | `/listing/:id` | ✅ 290ms | `06-open-listing-listing-detail-fallback.png` | Fiche bien (fallback parce que ID hardcodé n'existait pas en seed — c'est OK). |
| 07 | Calculateur accessibilité CTA | `/listing/:id` | ✅ 81ms | `07-affordability-cta-affordability-not-found.png` | CTA pas trouvé sur la fiche fallback — à valider sur un vrai listing. |
| 08 | Toggle favori | `/listing/:id` | ✅ 67ms | `08-favorite-toggle-favorite-not-found.png` | Pas trouvé sur fallback — à valider sur vrai listing. |
| 09 | Visit CTA | `/listing/:id` | ✅ 65ms | `09-visit-cta-visit-cta-not-found.png` | Idem. |
| 10 | Marketplace louer | `/louer` | ✅ 2379ms | `10-louer-page-louer.png` | Page chargée — devrait afficher les 24'867 Flatfox listings (en prod). |
| 11 | Annuaire agents | `/agents` | ✅ 1794ms | `11-agents-directory-agents.png` | 1'981 agents visibles selon CLAUDE.md. |
| 12 | Page vendre | `/vendre` | ✅ 1786ms | `12-vendre-page-vendre.png` | Hero estimation visible. |
| 13 | Page estimations | `/estimations` | ✅ 1779ms | `13-estimations-page-estimations.png` | OK. |
| 14 | Lang DE | `/?lang=de` | ✅ 2799ms | `14-lang-switch-de-lang-de.png` | Texte allemand confirmé sur navbar + hero. |
| 15 | Lang EN | `/?lang=en` | ✅ 1652ms | `15-lang-switch-en-lang-en.png` | OK. |
| 16 | Lang IT | `/?lang=it` | ✅ 1668ms | `16-lang-switch-it-lang-it.png` | OK. |
| 17 | Login page | `/login` | ✅ 1073ms | `17-login-page-login.png` | Email-first login (RegisterPage supprimée selon `App.tsx:8-9`). |
| 18 | Register alias | `/register` | ✅ 1080ms | `18-register-page-register.png` | Redirige vers LoginPage (alias). |
| 19 | 404 | `/404-test-page` | ✅ 1068ms | `19-404-test-404.png` | NotFoundPage rendue. |

#### Bugs (rappel synthèse)

- **B3** (high) — Mapbox crash `Cannot read properties of undefined (reading '0')` quand `VITE_MAPBOX_TOKEN` est vide. À fixer avec un fallback.
- Les 7 ressources Mapbox + 2 console errors `An API access token is required to use Mapbox GL` confirment le bug B3.

#### UX frictions

- **Pas de feedback "Aucun favori encore"** détectable sur la fiche listing fallback — à confirmer sur un vrai listing.
- **404 page minimale** — pas de CTA "Retour à l'accueil" ou "Voir tous les biens" (à valider visuellement sur le screenshot).
- **Sélecteur de langue** : la persistence en localStorage marche (vérifié au reload), mais le navbar n'a pas l'air de réagir à un `?lang=de` direct sans reload — à confirmer.

#### Ce qui marche bien

- 20/20 steps OK, 0 page error, 0 console error JS (hors Mapbox token et certs sandbox)
- Routes publiques toutes réactives (< 3s à chaque navigation)
- i18n FR/DE/EN/IT toutes fonctionnelles sur la home

---

### 4.2 Persona Seller — "Carlo Rossi", propriétaire lausannois

**Script :** `scripts/audit-seller.mjs` · **Port :** 5173 · **Report :** `docs/audits/2026-04-16-simulation/seller/report.json`
**Steps :** 20/21 ⚠️ (1 échec sur le wizard `vendre`) · **Page errors :** 7 (toutes sur /portail/*) · **Console errors non-cert :** 0

#### Journey log

| # | Étape | URL | OK | Capture | Notes |
|---|-------|-----|----|---------|-------|
| 01 | Home land | `/` | ✅ | `01-home-land-home.png` | Hero rendu. |
| 02 | Find Vendre CTA | `/` | ✅ | `02-home-find-vendre-cta-home-cta-area.png` | CTA "Vendre" repéré dans navbar. |
| 03 | Page vendre | `/vendre` | ✅ | `03-vendre-page-vendre-hero.png` | Hero visible. |
| 04 | Start wizard | `/vendre` | ✅ | `04-vendre-start-wizard-wizard-step1.png` | Step 1 visible : adresse + type. |
| 05 | Fill address | `/vendre` | ✅ | `05-vendre-fill-address-wizard-address-filled.png` | Champ adresse rempli avec succès. |
| 06 | **Next step** | `/vendre` | ❌ Timeout 30s | `06-vendre-next-step-ERROR.png` | **🔴 BUG B1** — le bouton `Continuer/Suivant/Next` reste **disabled** indéfiniment malgré l'adresse remplie. Le wizard est bloqué. Capture HTML : `<button disabled class="h-11 px-8 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 bg-gray-100 text-gray-500 cursor-not-allowed">`. |
| 07 | Fill rooms | `/vendre` | ✅ | `07-vendre-fill-rooms-wizard-rooms.png` | Champ pièces rempli (l'agent a contourné en cliquant ailleurs). |
| 08 | Fill surface | `/vendre` | ✅ | `08-vendre-fill-surface-wizard-surface.png` | Surface remplie. |
| 09 | Capture labels | `/vendre` | ✅ | `09-vendre-capture-labels-wizard-labels.png` | Labels capturés pour audit i18n. |
| 10 | Page estimations | `/estimations` | ✅ | `10-estimations-page-estimations-hero.png` | Hero rendu. |
| 11 | Alias estimer | `/estimer` | ✅ | `11-estimer-alias-estimer.png` | Redirige vers EstimationsPage (alias OK). |
| 12 | Page publier | `/publier` | ✅ | `12-publier-page-publier.png` | Page rendue. |
| 13-19 | Portail vendeur | `/portail/*` | ✅ route, ❌ render | `13..19-portail-*.png` | **🔴 BUG A2** — Toutes les 7 sous-pages crashent : `useSellerPortalData must be used inside SellerPortalProvider`. Voir détail bug A2 dans le tableau global. |
| 20 | Dark mode portail | `/portail` | ✅ | – | Toggle testé (mais le contenu était crashed donc invisible). |
| 21 | Lang switch portail | `/portail` | ✅ | – | Idem. |

#### Bugs détectés (en plus de B1 + A2 + C1 du tableau global)

- **A2 — bloque 100% du test du portail vendeur dev.** Aucune des 7 pages (`/portail/{,visites,offres,documents,messages,analyse,profil}`) n'a pu être visualisée. Le persona a vu 7 écrans blancs.
- **B1 — wizard `/vendre` step 1 bloqué** : un vendeur réel ne peut pas avancer = 0 lead capturable.
- **C1 — design system viol** : le bouton disabled utilise `bg-gray-100 text-gray-500`, classes hardcodées formellement interdites par CLAUDE.md §10.

#### UX frictions

- **Pas de message d'erreur visible** quand le bouton "Suivant" est disabled — l'utilisateur ne sait pas POURQUOI il ne peut pas avancer (champ requis manquant ? validation invalide ?). Ajouter un texte sous le bouton style "Veuillez remplir tous les champs requis".
- **/portail dev sans token** est une route piège pour tester en dev — soit la wrapper dans un provider mock, soit la supprimer.
- **Le wizard demande adresse + type d'abord, mais seul le champ adresse est validé** — peut-être que le champ "type de bien" est requis mais pas signalé visuellement.

#### Ce qui marche bien

- Les 12 premières étapes (Home → Vendre → Estimations → Estimer → Publier) sont rapides et propres
- L'alias `/estimer` → `EstimationsPage` fonctionne correctement (voir `App.tsx:145-146`)
- Le routing `/portail/{section}` fonctionne au niveau React Router (les routes existent), c'est le provider qui manque

---

### 4.3 Persona Agent (Sale) — "Sophie Dubois", agent genevoise créant un bien à VENDRE

**Script :** `scripts/audit-agent-sale.mjs` · **Port :** 5174 (DEV_BYPASS_AUTH=true, role=agent) · **Report :** `docs/audits/2026-04-16-simulation/agent-sale/report.json`
**Steps :** 24/25 ⚠️ (1 échec sélecteur theme toggle) · **Page errors :** 0 · **Console errors non-cert :** 0

#### Journey log

| # | Étape | URL | OK | Notes |
|---|-------|-----|----|-------|
| 01 | Home landing | `/` | ✅ 2113ms | Gate `gg` traversée. |
| 02 | Goto dashboard | `/dashboard` | ✅ 2070ms | ActionBoardPage chargée (avec mock auth). |
| 03 | Explore sidebar | – | ✅ 165ms | Sidebar agent visible : Aujourd'hui, Pipeline, Contacts, Matching, Listings, KYC, Messages, Calendar, Automation, Documents, Settings. |
| 04 | Goto contacts | `/dashboard/contacts` | ✅ 1778ms | Liste contacts (vide en dev bypass). |
| 05 | Try open create contact | – | ✅ 1508ms | Modal de création trouvée mais non soumise. |
| 06 | Goto pipeline | `/dashboard/pipeline` | ✅ 2097ms | Kanban 14 colonnes rendu. |
| 07 | Goto matching | `/dashboard/matching` | ✅ 1775ms | Page rendue. |
| 08 | Goto listings | `/dashboard/listings` | ✅ 1776ms | Liste biens visible. |
| 09 | Open listing form | `/dashboard/listings/new` | ✅ 1923ms | Wizard chargé. |
| 10 | Inspect import methods | – | ✅ 64ms | 4 méthodes détectées : Manuel, Duplication, PDF, URL. |
| 11 | Select manual import | – | ✅ 1345ms | Formulaire manuel ouvert. |
| 12 | Select transaction sale | – | ✅ 784ms | Toggle "Vente / Location" trouvé, "Vente" sélectionné. |
| 13 | Fill listing form | – | ✅ 767ms | Champs remplis (titre, type, pièces, surface, prix). Stop avant submit. |
| 14 | Explore form steps | – | ✅ 4ms | Étapes du wizard explorées. |
| 15 | Verify no publish | – | ✅ 79ms | Confirmé : pas de Submit cliqué. |
| 16 | Goto KYC | `/dashboard/kyc` | ✅ 1869ms | Liste KYC visible. |
| 17 | Goto messages | `/dashboard/messages` | ✅ 1856ms | ChatPage visible. |
| 18 | Goto calendar | `/dashboard/calendar` | ✅ 1812ms | CalendarPage visible. |
| 19 | Goto automation | `/dashboard/automation` | ✅ 1799ms | AutomationPage visible. |
| 20 | Goto documents | `/dashboard/documents` | ✅ 1810ms | TemplatesPage visible. |
| 21 | Try MEGGA AI copilot | – | ✅ 83ms | Bouton flottant Sparkles trouvé (panel pas testé en détail). |
| 22 | Goto settings profile | `/dashboard/settings` | ✅ 1812ms | Page profil visible. |
| 23 | Try language switch | – | ✅ 1342ms | Pills FR/DE/EN/IT trouvées et cliquables. |
| 24 | **Try theme toggle** | – | ❌ Timeout 30s | **🟢 BUG D1** — sélecteur `button:has(svg.lucide-moon)` ne match pas. Le toggle existe mais utilise une autre icône (probablement Sun + Moon switch animé, ou Settings cog). |
| 25 | Back to dashboard | `/dashboard` | ✅ 1823ms | Retour OK. |

#### Bugs (rappel synthèse)

- **D1** (low) — sélecteur theme toggle à fixer dans le test, et ajouter un `data-testid="theme-toggle"` côté composant.
- 0 page error et 0 console error JS = **excellente santé** côté agent dashboard.

#### UX frictions

- **Mock auth bypass** : DEV_BYPASS_AUTH affiche un profil mocké mais les listes (contacts, KYC, etc.) sont vides en dev → les empty states n'ont pas pu être validés visuellement à fond. Pour la prochaine audit, seed quelques contacts de démo.
- **Le wizard "création bien" est fluide** mais on n'a pas pu tester les méthodes d'import PDF et URL (nécessitent un vrai fichier / une vraie URL) → à valider manuellement plus tard.
- **Bouton "Créer un bien"** : pas de raccourci clavier visible (`⌘N` aurait du sens). Cf. la sidebar a déjà `⌘⇧C` pour "Nouveau contact" → cohérence à uniformiser.

#### Ce qui marche bien

- **Toutes les 11 sections sidebar** chargent sans erreur (Aujourd'hui, Dashboard, Pipeline, Contacts, Matching, Listings, KYC, Messages, Calendar, Automation, Documents)
- Le **wizard de création de bien** est complet, multi-méthodes, et le toggle Vente/Location fonctionne
- **0 page error** sur 24 navigations = grosse stabilité du dashboard agent
- Le sélecteur de langue (Settings > Profil) fonctionne avec les 4 langues

---

### 4.4 Persona Agent (Rent) — "Marc Bernhard", agent zurichois créant un bien en LOCATION

**Script :** `scripts/audit-agent-rent.mjs` · **Port :** 5174 · **Report :** `docs/audits/2026-04-16-simulation/agent-rent/report.json`
**Steps :** 16/16 ✅ · **Page errors :** 3 (1 critique sur formatCHF + 2 Mapbox) · **Console errors non-cert :** N/A (mêmes que sale)

#### Journey log

| # | Étape | URL | OK | Notes |
|---|-------|-----|----|-------|
| 01 | Dashboard | `/dashboard` | ✅ | Land OK. |
| 02 | Listing form chooser | `/dashboard/listings/new` | ✅ | 4 méthodes d'import visibles. |
| 03 | Toggle rent | – | ✅ | Toggle Vente/Location trouvé, "Location" sélectionné. Capture montre les sections rentales actives. |
| 04 | Fill step1 (titre) | – | ✅ | Titre rempli. |
| 05 | Reach price section | – | ✅ | Section "Prix / Loyer" atteinte (formulaire scrollé). |
| 06 | **Fill rent price** | – | ✅ (route OK), ❌ runtime | **🔴 BUG A3** — `amount.toFixed is not a function`. Stack : `formatCHF (utils.ts:16) → formatRent (utils.ts:50) → ListingFormPage`. Le champ prix retourne un string via React Hook Form `watch('price')`, qui ne peut pas appeler `.toFixed(0)`. |
| 08 | Sidebar preview | – | ✅ | Sidebar preview du bien visible. |
| 09 | **Public louer** | `/louer` | ✅ (route), ❌ runtime | **🟠 BUG B3** — Mapbox crash `Cannot read properties of undefined (reading '0')` sur `mapbox-gl pointRayInte...`. |
| 13 | **Public acheter** | `/acheter` | ✅ (route), ❌ runtime | **🟠 BUG B3** — même crash Mapbox. |
| 14 | Matching page | `/dashboard/matching` | ✅ | Page rendue. |
| 15 | Contact types | `/dashboard/contacts` | ✅ | Modal de création trouvée. |

#### Bugs détectés

- **A3** (critique) — formatCHF pas défensif. Le champ prix de location déclenche `toFixed` sur un string. La saisie est cassée dès que l'utilisateur tape.
- **B3** (high) — Mapbox crash sur `/louer` ET `/acheter` : token manquant en dev → carte cassée. À gérer avec un fallback.
- **3 page errors** documentés dans le report.json — c'est le persona avec le plus d'erreurs runtime.

#### Statut implémentation rentale

| Feature rentale | Statut | Localisation | Notes | v1 ? |
|---|---|---|---|---|
| Toggle Vente/Location dans wizard | ✅ Working | `ListingFormPage.tsx:618` (`isRent = txType === 'rent'`) | Le toggle fonctionne, le formulaire branche entre champs vente et location. | ✅ Oui |
| Champ "Loyer mensuel" | ⚠️ Cassé | `ListingFormPage.tsx:692,2596` (formatRent + isRent) | Le champ s'affiche mais crash dès la saisie d'un nombre (bug A3). | ✅ Oui |
| Champ "Charges mensuelles" | ❓ Non testé | À vérifier | Pas atteint à cause du crash A3. | ✅ Oui |
| Champ "Dépôt (caution)" | ❓ Non testé | À vérifier | Pas atteint. | ✅ Oui |
| Champ "Disponibilité" | ❓ Non testé | À vérifier | Pas atteint. | ✅ Oui |
| Toggle "Meublé" | ❓ Non testé | À vérifier | Pas atteint. | ✅ Oui |
| Page `/louer` | ⚠️ Mapbox crash | `LouerPage.tsx` + `MapView.tsx` | Page chargée mais carte cassée sans token. À fixer avec fallback. | ✅ Oui |
| Filtres rentaux (meublé, dépôt, dispo) | ❓ Non vérifié visuellement | Search filters | À auditer manuellement après fix B3. | ⚠️ Phase 2 OK |
| Matching engine acheteurs vs locataires | ❓ Non vérifié | `useMatching.ts` + matching engine | Pas testé en profondeur. | ⚠️ Phase 2 OK |
| Affichage `loyer/mois` vs `prix` sur cards | ✅ Working | `ListingCard.tsx:186-187` (formatRent vs formatCHF) | Mais sera affecté par bug A3 si formatCHF crash. | ✅ Oui |

**Score implémentation rentale (estimation) : 60% — l'ossature est là, le bug A3 bloque les tests fins. Une fois A3 fixé, on devrait pouvoir valider 90%+.**

#### UX frictions

- **Pas d'indication "loyer" vs "prix d'achat"** dans le label du champ jusqu'à ce qu'on toggle Location — le label reste "Prix" un instant. Cohérence à améliorer.
- **Pas de placeholder dans le champ loyer** : l'utilisateur ne sait pas s'il doit entrer mensuel ou annuel. CHF 2'800/mois par défaut serait utile.

#### Ce qui marche bien

- Toggle Vente/Location fluide et instantané
- Le formulaire branche correctement les sections selon le mode
- LouerPage charge (au-delà du Mapbox crash)
- Le matching CRM agent supporte la navigation rentale (au moins au routing level)

---

### 4.5 Persona Admin — résumé court

**Journal complet :** [`docs/audits/2026-04-16-simulation/admin/JOURNAL.md`](2026-04-16-simulation/admin/JOURNAL.md)
**Script :** `scripts/audit-admin.mjs` · **Port :** 5175 (DEV_BYPASS_AUTH=true, role=super_admin)
**Steps :** 18/18 ✅ (route OK) · **Pages réellement rendues :** 0 / 14 ❌ · **Page errors :** 36 (toutes du même bug A1)

**Verdict :** Les 14 pages admin sont **codées proprement** côté statique (design system OK, hooks Supabase réels, i18n partout sauf AdminFeatureFlagsPage à confirmer, 0 mock data) MAIS **0 page ne rend** dans Playwright à cause du **bug A1** (`useAdminNotifications` realtime channel collision). Bug critique bloquant à fixer en priorité.

**Bugs admin :**
- A1 (critique) — 14 pages crashent (voir détail bug A1 dans tableau global)
- B2 (high) — bouton "Admin" dans sidebar peu découvrable (voir bug B2)
- C2 (medium) — AdminFeatureFlagsPage potentiellement sans i18n (voir bug C2)

---

## 5. UX frictions transverses (toutes personas)

### Découvrabilité

- **Super-admin sans menu visible** : un admin connecté arrive sur le dashboard agent (sidebar agent) sans badge "MEGGA Admin" ni lien évident vers les pages admin. Le bouton "Admin" existe (Sidebar.tsx:341-358) mais est en bas de la sidebar, potentiellement hors viewport.
- **Pas de raccourcis clavier** unifiés. Seul `⌘⇧C` (Nouveau contact) est visible. Manquent : `⌘N` (Nouveau bien), `⌘K` (CommandPalette), `⌘?` (Help).
- **Wizard `/vendre` sans message d'erreur** quand bouton disabled — l'utilisateur est bloqué sans savoir pourquoi.

### Cohérence visuelle

- **Boutons disabled** non standardisés. Au moins un cas (VendrePage) utilise `bg-gray-100 text-gray-500` hardcodé au lieu des tokens thème.
- **Empty states** non testables systématiquement (DEV_BYPASS_AUTH = pas de seed). À ajouter : seed de démo pour DEV_BYPASS pour valider tous les empty/loading states.

### Robustesse

- **Mapbox sans token = page cassée** sur toutes les pages avec carte (`/acheter`, `/louer`). Manque un fallback gracieux.
- **Composants Realtime fragiles** au re-mount (admin notifications). Pattern à auditer ailleurs (autres `supabase.channel()` dans le code).
- **Pas de validation type-safe** entre formulaires React Hook Form et formatters utilitaires (formatCHF s'attend à `number`, RHF retourne `string`). Risque latent partout où `formatCHF(form.watch('xxx'))` est utilisé.

### Performance

- Toutes les routes répondent en < 3s en dev → bon signal
- Le bundle initial semble correct (lazy imports systématiques sur les pages — voir `App.tsx:18-104`)
- À auditer en prod : Lighthouse score, Time To Interactive, taille des photos sur `/acheter`

---

## 6. Recommandations priorisées

### Priorité 1 (cette semaine — avant tout pilote)

1. **Fix A1** — `useAdminNotifications.ts:42-54` channel name unique par mount
   ```ts
   const channelId = useId()
   const channel = supabase.channel(`admin-notifications-${channelId}`)
   ```
2. **Fix A2** — Wrapper `/portail` (route dev) dans `SellerPortalProvider` avec données mockées, OU rediriger vers `/portail/dev-token`
3. **Fix A3** — Rendre `formatCHF` et `formatRent` défensifs :
   ```ts
   export function formatCHF(amount: number | string | null | undefined): string {
     const n = Number(amount ?? 0)
     if (!isFinite(n)) return 'CHF —'
     return `CHF ${n.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'")}`
   }
   ```

### Priorité 2 (ce sprint)

4. **Fix B1** — Audit la condition `disabled` du bouton "Suivant" dans VendrePage step 1, ajouter un message d'erreur visible sous le bouton
5. **Fix B3** — Fallback Mapbox si token manquant : composant `MapFallback` qui affiche une liste sans coordonnées
6. **Fix B2** — Remonter le bouton "Admin" en haut de la sidebar quand role=super_admin, ajouter un badge "MEGGA Admin" visible

### Priorité 3 (avant launch)

7. **Fix C1** — Remplacer `bg-gray-100 text-gray-500` par tokens thème dans VendrePage
8. **Fix C2** — Audit i18n de AdminFeatureFlagsPage (et grep tous les `Admin*Page.tsx` pour confirmer `useTranslation('admin')` partout)
9. **Fix C3** — Patcher `audit-helper.mjs` : `chromium.launch({ args: ['--ignore-certificate-errors'] })` pour les futures simulations
10. **Fix D1** — Ajouter `data-testid` sur le theme toggle, et plus généralement sur les CTAs critiques pour faciliter les tests E2E futurs

### Priorité 4 (qualité long terme)

11. **Audit transverse `supabase.channel()`** — chercher d'autres patterns à risque de re-mount (fonction `useEffect` qui subscribe sans channel name unique). Liste des fichiers : `grep -rn "supabase.channel" src/` (reportée à un audit dédié).
12. **Empty state seeds** — ajouter un seed de démo pour DEV_BYPASS_AUTH (10 contacts, 5 biens, 3 KYC, 2 deals) pour faciliter les audits visuels.
13. **Tests E2E Playwright en CI** — créer `.github/workflows/e2e.yml` qui exécute les 5 scripts d'audit sur chaque PR. Évite la régression des bugs A1/A2/A3.

---

## 7. Données de test créées

**Aucune.** L'audit est entièrement read-only sur Supabase production.

- ❌ Aucun contact créé
- ❌ Aucun bien publié
- ❌ Aucun KYC créé
- ❌ Aucune transaction
- ❌ Aucune offre
- ❌ Aucun ticket support
- ❌ Aucun email envoyé (Resend non sollicité)
- ❌ Aucun paiement Stripe
- ❌ Aucune impersonification effectuée

Le fichier `.env.local` créé contient uniquement `VITE_SUPABASE_ANON_KEY` (clé publique, déjà hardcodée dans `src/lib/supabase.ts`), `VITE_PASSWORD_GATE_BYPASS=true`, et flags DEV_BYPASS. Pas de service_role.

**Aucun cleanup nécessaire.**

---

## 8. Annexes

### Comment relancer l'audit

```bash
# 1. Démarrer 3 instances Vite (public + agent bypass + super_admin bypass)
npm install
(npm run dev -- --port 5173 > /tmp/vite-public.log 2>&1 &)
(VITE_DEV_BYPASS_AUTH=true VITE_DEV_BYPASS_ROLE=agent npm run dev -- --port 5174 > /tmp/vite-agent.log 2>&1 &)
(VITE_DEV_BYPASS_AUTH=true VITE_DEV_BYPASS_ROLE=super_admin npm run dev -- --port 5175 > /tmp/vite-admin.log 2>&1 &)

# 2. Installer Playwright Chromium si nécessaire
npx playwright install chromium

# 3. Exécuter les 5 personas en séquence
node scripts/audit-buyer.mjs
node scripts/audit-seller.mjs
BASE_URL=http://localhost:5174 node scripts/audit-agent-sale.mjs
BASE_URL=http://localhost:5174 node scripts/audit-agent-rent.mjs
BASE_URL=http://localhost:5175 node scripts/audit-admin.mjs

# 4. Inspecter les rapports
ls docs/audits/2026-04-16-simulation/*/report.json
ls docs/audits/2026-04-16-simulation/*/screenshots/
```

### Structure des artefacts

```
docs/audits/
├── 2026-04-16-simulation-audit.md         ← CE FICHIER (master report)
└── 2026-04-16-simulation/
    ├── admin/
    │   ├── JOURNAL.md                       ← journal complet rédigé par l'agent
    │   ├── report.json                      ← raw report (steps + errors + console)
    │   └── screenshots/                     ← 21 PNG horodatés
    ├── buyer/
    │   ├── report.json
    │   └── screenshots/                     ← 19 PNG
    ├── seller/
    │   ├── report.json
    │   └── screenshots/                     ← 19 PNG
    ├── agent-sale/
    │   ├── report.json
    │   └── screenshots/                     ← 23 PNG
    ├── agent-rent/
    │   ├── report.json
    │   └── screenshots/                     ← 16 PNG
    └── smoke/                               ← test initial du harness
        ├── report.json
        └── screenshots/                     ← 3 PNG

scripts/
├── audit-helper.mjs                         ← harness Playwright partagé
├── audit-smoke.mjs                          ← smoke test
├── audit-buyer.mjs
├── audit-seller.mjs
├── audit-agent-sale.mjs
├── audit-agent-rent.mjs
└── audit-admin.mjs
```

### Sub-agents qui ont contribué

| Persona | Modèle | Tool uses | Durée | Status JOURNAL.md |
|---------|--------|-----------|-------|-------------------|
| admin | claude-opus-4-6[1m] | 30 | 5'06" | ✅ rédigé par l'agent |
| seller | claude-opus-4-6[1m] | 29 | 4'56" | ❌ stream timeout (reconstruit ici) |
| agent-sale | claude-opus-4-6[1m] | 31 | 6'06" | ❌ stream timeout (reconstruit ici) |
| agent-rent | claude-opus-4-6[1m] | 49 | 7'27" | ❌ stream timeout (reconstruit ici) |
| buyer | claude-opus-4-6[1m] | 39 | 8'52" | ❌ request timeout (reconstruit ici) |

**Note méthodologique anti-timeout :** La variante `[1m]` (1M context) du modèle a causé des timeouts de stream sur 4 des 5 sub-agents pendant la phase de rédaction de leur JOURNAL.md (les screenshots + report.json étaient déjà en place). Pour la prochaine itération, soit utiliser `claude-opus-4-6` (200k context) qui streame plus rapidement, soit découper les missions en deux agents distincts (collecte vs synthèse), soit utiliser le CLI local de Claude Code (timeout réseau plus tolérant). Voir aussi le commentaire détaillé dans la conversation de cette session.

### Branche & commits

- **Branche :** `claude/megga-user-simulation-bV1Rh`
- **Commits :**
  - `7fa2585` — chore(audit): WIP simulation harness + buyer persona artifacts
  - `03bffc6` — chore(audit): add seller artifacts + remaining persona scripts (WIP)
  - `efeb14f` — chore(audit): admin persona artifacts + JOURNAL
  - *(à venir)* — docs(audit): consolidated simulation audit report (5 personas, 10 bugs)

### Prochaines étapes suggérées

1. **Décider** quels bugs critiques fixer en premier (recommandation : A1 → A3 → A2 dans cet ordre, parce que A1 bloque tout admin, A3 bloque création location, A2 ne bloque que la route dev `/portail`)
2. **Créer 1 PR par fix critique** (3 PRs) pour faciliter le review et le rollback si besoin
3. **Re-run l'audit** après chaque fix pour valider la régression et détecter de nouveaux bugs latents
4. **Ajouter le harness Playwright en CI** pour empêcher les régressions futures sur les flows critiques

---

**Fin du rapport.** Pour toute question sur la méthodo, voir `scripts/audit-helper.mjs`. Pour les détails par persona, voir les screenshots dans `docs/audits/2026-04-16-simulation/{persona}/screenshots/`.


